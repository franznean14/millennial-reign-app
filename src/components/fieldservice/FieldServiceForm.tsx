"use client";

import { Plus, ChevronRight } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { resolveContactStatuses } from "@/lib/utils/status-hierarchy";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState, useCallback, type ReactElement } from "react";
import { getDailyRecord, listDailyByMonth, upsertDailyRecord, isDailyEmpty, deleteDailyRecord } from "@/lib/db/dailyRecords";
import { useMobile } from "@/lib/hooks/use-mobile";
import { motion } from "framer-motion";
import { NumberFlowInput } from "@/components/ui/number-flow-input";
import { getPersonalContacts, listEstablishments } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { outboxEnqueue } from "@/lib/offline/store";
import { CallForm } from "@/components/business/CallForm";
import { ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getStudyBibleDarkCardShade, studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";
import { FormModal } from "@/components/shared/FormModal";

function toLocalStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Note stored on `calls` when Field Service creates a visit for a Bible Study contact. */
const BIBLE_STUDY_CALL_NOTE = "Bible Study";

interface FieldServiceFormProps {
  userId: string;
  onClose: () => void;
  isOpen?: boolean;
}

export default function FieldServiceForm({ userId, onClose, isOpen = true }: FieldServiceFormProps) {
  const isMobile = useMobile();
  const [view, setView] = useState<Date>(() => {
    if (typeof window === "undefined") return new Date();
    const stored = localStorage.getItem(`fieldservice:selectedDate:${userId}`);
    if (stored) {
      const [y, m, d] = stored.split("-").map(Number);
      if (y && m && d) return new Date(y, m - 1, d);
    }
    return new Date();
  });
  const [mode, setMode] = useState<"days"|"months"|"years">("days");
  const [date, setDate] = useState<string>(() => {
    if (typeof window === "undefined") return toLocalStr(new Date());
    const stored = localStorage.getItem(`fieldservice:selectedDate:${userId}`);
    return stored || toLocalStr(new Date());
  });
  const [hours, setHours] = useState<string>("");
  const [studies, setStudies] = useState<string[]>([]);
  const [note, setNote] = useState<string>("");
  const debounceRef = useRef<any>(null);
  const notifyRef = useRef<any>(null);
  const [dirty, setDirty] = useState(false);
  const [monthMarks, setMonthMarks] = useState<Record<string, { hours: number; hasNotes: boolean; hasBibleStudies: boolean }>>({});
  const [personalContacts, setPersonalContacts] = useState<Array<{ id: string; name: string }>>([]);
  const [bibleStudiesInputFocused, setBibleStudiesInputFocused] = useState(false);
  const [bibleStudiesInputValue, setBibleStudiesInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [editVisitId, setEditVisitId] = useState<string | null>(null);
  const [editVisit, setEditVisit] = useState<{
    id: string;
    establishment_id?: string | null;
    contact_id?: string | null;
    note?: string | null;
    publisher_id?: string | null;
    partner_id?: string | null;
    visit_date?: string;
  } | null>(null);
  const [establishments, setEstablishments] = useState<any[]>([]);
  const pendingKey = (d: string) => `fieldservice:pending:${userId}:${d}`;

  const readPending = (d: string) => {
    if (typeof window === "undefined") {
      return { adds: new Set<string>(), deletes: new Set<string>() };
    }
    try {
      const raw = localStorage.getItem(pendingKey(d));
      if (!raw) return { adds: new Set<string>(), deletes: new Set<string>() };
      const parsed = JSON.parse(raw) as { adds?: string[]; deletes?: string[] };
      return {
        adds: new Set(parsed.adds ?? []),
        deletes: new Set(parsed.deletes ?? []),
      };
    } catch {
      return { adds: new Set<string>(), deletes: new Set<string>() };
    }
  };

  const writePending = (d: string, adds: Set<string>, deletes: Set<string>) => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        pendingKey(d),
        JSON.stringify({ adds: Array.from(adds), deletes: Array.from(deletes) })
      );
    } catch {}
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(`fieldservice:selectedDate:${userId}`, date);
  }, [date, userId]);

  const monthLabel = useMemo(() => view.toLocaleString(undefined, { month: "long" }), [view]);
  const yearLabel = useMemo(() => String(view.getFullYear()), [view]);

  const start = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const s = new Date(first);
    s.setDate(first.getDay() === 0 ? 1 - 0 : 1 - first.getDay());
    return s;
  }, [view]);

  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  const isSelected = (d: Date) => toLocalStr(d) === date;
  const inMonth = (d: Date) => d.getMonth() === view.getMonth();
  const viewMonthKey = () => `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, "0")}`;

  const loadMonthMarks = async () => {
    try {
      const month = viewMonthKey();
      const list = await listDailyByMonth(userId, month);
      const marks: Record<string, { hours: number; hasNotes: boolean; hasBibleStudies: boolean }> = {};
      for (const r of list) {
        if (!(r as any) || (typeof r !== "object")) continue;
        const h = Number((r as any).hours || 0);
        const bs = Array.isArray((r as any).bible_studies) ? (r as any).bible_studies.filter(Boolean) : [];
        const n = ((r as any).note ?? "").toString().trim();
        const hasBibleStudies = bs.length > 0;
        const hasNotes = n.length > 0;
        // Only mark dates that have at least one of: hours, notes, or bible studies
        if (h > 0 || hasNotes || hasBibleStudies) {
          marks[(r as any).date] = { hours: h, hasNotes, hasBibleStudies };
        }
      }
      setMonthMarks(marks);
    } catch {}
  };

  // Use refs to always get the latest state values
  const studiesRef = useRef(studies);
  const hoursRef = useRef(hours);
  const noteRef = useRef(note);
  const dateRef = useRef(date);
  const dirtyRef = useRef(dirty);
  const pendingAddsRef = useRef<Set<string>>(new Set());
  const pendingDeletesRef = useRef<Set<string>>(new Set());

  // Update refs when state changes
  useEffect(() => {
    studiesRef.current = studies;
  }, [studies]);
  useEffect(() => {
    hoursRef.current = hours;
  }, [hours]);
  useEffect(() => {
    noteRef.current = note;
  }, [note]);
  useEffect(() => {
    dateRef.current = date;
  }, [date]);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  const loadPendingForDate = (d: string) => {
    const { adds, deletes } = readPending(d);
    pendingAddsRef.current = adds;
    pendingDeletesRef.current = deletes;
  };

  const persistPendingForDate = (d: string) => {
    writePending(d, pendingAddsRef.current, pendingDeletesRef.current);
  };

  const reconcilePendingStudies = (serverStudies: string[]) => {
    const serverSet = new Set(serverStudies);
    pendingAddsRef.current.forEach((entry) => {
      if (serverSet.has(entry)) pendingAddsRef.current.delete(entry);
    });
    pendingDeletesRef.current.forEach((entry) => {
      if (!serverSet.has(entry)) pendingDeletesRef.current.delete(entry);
    });
    persistPendingForDate(dateRef.current);
  };

  const applyPendingStudies = (serverStudies: string[]) => {
    const next = serverStudies.filter((entry) => !pendingDeletesRef.current.has(entry));
    pendingAddsRef.current.forEach((entry) => {
      if (!next.includes(entry)) next.push(entry);
    });
    return next;
  };

  const load = async (d: string) => {
    try {
      loadPendingForDate(d);
      const rec = await getDailyRecord(userId, d);
      // Don't overwrite form state if user switched day or has unsaved changes (avoids stutter after add/delete)
      if (dateRef.current !== d) return;
      if (dirtyRef.current) return;
      const serverStudies = rec?.bible_studies ?? [];
      reconcilePendingStudies(serverStudies);
      const mergedStudies = applyPendingStudies(serverStudies);
      setHours(rec ? String(rec.hours) : "");
      setStudies(mergedStudies);
      setNote(rec?.note ?? "");
      setBibleStudiesInputValue("");
      setDirty(false);
    } catch {}
  };
  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      // Use the latest values from refs to ensure we always have the current state
      let currentStudies = studiesRef.current;
      const currentHours = hoursRef.current;
      const currentNote = noteRef.current;
      
      // Filter out temporary placeholders - only save actual visit IDs or plain text entries
      currentStudies = currentStudies.filter(s => !isTemporaryPlaceholder(s));
      
      const payload = {
        user_id: userId,
        date,
        hours: Number(currentHours || 0),
        bible_studies: currentStudies,
        note: currentNote.trim() || null,
      };
      try {
        if (isDailyEmpty(payload)) {
          await deleteDailyRecord(userId, date);
          setMonthMarks((m) => {
            const cp = { ...m };
            delete cp[date];
            return cp;
          });
          // Reload month marks to update bible study indicators
          loadMonthMarks();
        } else {
          await upsertDailyRecord(payload);
          // Update month marks to reflect hours, notes, and bible studies
          const hours = Number(currentHours || 0);
          const hasBibleStudies = currentStudies.length > 0;
          const hasNotes = (currentNote.trim() || "").length > 0;
          setMonthMarks((m) => {
            if (hours > 0 || hasNotes || hasBibleStudies) {
              return { ...m, [date]: { hours, hasNotes, hasBibleStudies } };
            } else {
              const cp = { ...m };
              delete cp[date];
              return cp;
            }
          });
        }
        setDirty(false);
        try {
          window.dispatchEvent(new CustomEvent('daily-records-changed', { detail: { userId } }));
        } catch {}
      } catch (e: any) {
        console.error('Error saving daily record:', e);
        toast.error(e.message ?? "Failed to save");
      }
    }, 1000);
  }, [userId, date]);

  // Helper to check if a study entry is a visit ID
  const isVisitId = (study: string): boolean => {
    return study.startsWith("visit:");
  };

  // Helper to check if a study entry is a contact ID (legacy support)
  const isContactId = (study: string): boolean => {
    return study.startsWith("contact:");
  };

  // Helper to get visit ID from study entry
  const getVisitId = (study: string): string | null => {
    if (isVisitId(study)) {
      return study.replace("visit:", "");
    }
    return null;
  };

  // Helper to get contact ID from study entry (legacy support)
  const getContactId = (study: string): string | null => {
    if (isContactId(study)) {
      return study.replace("contact:", "");
    }
    if (study.startsWith("householder:")) {
      return study.replace("householder:", "");
    }
    return null;
  };

  // State to cache visit-to-contact name mappings
  const [visitNamesCache, setVisitNamesCache] = useState<Map<string, string>>(new Map());
  // State to cache visit-to-contact ID mappings (for filtering)
  const [visitContactIdCache, setVisitContactIdCache] = useState<Map<string, string>>(new Map());
  // Track which visit IDs are currently loading
  const [loadingVisitIds, setLoadingVisitIds] = useState<Set<string>>(new Set());

  // Load visit names for display
  useEffect(() => {
    const loadVisitNames = async () => {
      const visitIds = studies
        .map(s => getVisitId(s))
        .filter((id): id is string => id !== null);
      
      if (visitIds.length === 0) {
        setLoadingVisitIds(new Set());
        return;
      }

      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      
      // Check which visits we need to fetch
      const missingIds = visitIds.filter(id => !visitNamesCache.has(id));
      
      // When offline, try to load from cache
      if (isOffline && missingIds.length > 0) {
        const { cacheGet } = await import("@/lib/offline/store");
        const newCache = new Map(visitNamesCache);
        const newContactIdCache = new Map(visitContactIdCache);
        
        for (const visitId of missingIds) {
          // Try to load from visit name cache
          const cachedName = await cacheGet<string>(`visit:${visitId}:name`);
          const cachedContactId = await cacheGet<string>(`visit:${visitId}:householder_id`);
          
          if (cachedName) {
            newCache.set(visitId, cachedName);
          }
          if (cachedContactId) {
            newContactIdCache.set(visitId, cachedContactId);
          }
        }
        
        setVisitNamesCache(newCache);
        setVisitContactIdCache(newContactIdCache);
        setLoadingVisitIds(new Set());
        return;
      }

      if (missingIds.length === 0) {
        setLoadingVisitIds(new Set());
        return;
      }

      // Mark these IDs as loading
      setLoadingVisitIds(new Set(missingIds));

      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.getSession();
        
        const { data: visits, error } = await supabase
          .from('calls')
          .select(`
            id,
            householder_id,
            householders:calls_householder_id_fkey(id, name)
          `)
          .in('id', missingIds);

        if (error) throw error;

        const { cacheSet } = await import("@/lib/offline/store");
        const newCache = new Map(visitNamesCache);
        const newContactIdCache = new Map(visitContactIdCache);
        visits?.forEach((visit: any) => {
          const linkedContact = visit.householders ?? visit.contacts;
          const contactName = Array.isArray(linkedContact)
            ? linkedContact[0]?.name
            : linkedContact?.name;
          if (contactName) {
            newCache.set(visit.id, contactName);
            cacheSet(`visit:${visit.id}:name`, contactName);
          }
          if (visit.householder_id) {
            newContactIdCache.set(visit.id, visit.householder_id);
            cacheSet(`visit:${visit.id}:householder_id`, visit.householder_id);
          }
        });
        setVisitNamesCache(newCache);
        setVisitContactIdCache(newContactIdCache);
        
        // Clear loading state for successfully loaded visits
        setLoadingVisitIds(prev => {
          const next = new Set(prev);
          visits?.forEach((visit: any) => {
            next.delete(visit.id);
          });
          return next;
        });
      } catch (error) {
        console.error('Error loading visit names:', error);
        // Clear loading state on error
        setLoadingVisitIds(new Set());
      }
    };

    loadVisitNames();
  }, [studies, visitNamesCache]);

  // Helper to check if a study entry is a temporary placeholder
  const isTemporaryPlaceholder = (study: string): boolean => {
    return study.startsWith("temp:");
  };

  // Helper to check if a study entry is loading
  const isStudyLoading = (study: string): boolean => {
    // Temporary placeholders are always "loading" (being processed)
    if (isTemporaryPlaceholder(study)) {
      return true;
    }
    const visitId = getVisitId(study);
    return visitId ? loadingVisitIds.has(visitId) : false;
  };

  // Helper to get display name for a study entry
  const getStudyDisplayName = (study: string): string | null => {
    // Check for temporary placeholder
    if (isTemporaryPlaceholder(study)) {
      // Extract the name from temp:name format
      return study.replace("temp:", "");
    }

    // Check for visit ID first (new format)
    const visitId = getVisitId(study);
    if (visitId) {
      const name = visitNamesCache.get(visitId);
      if (name) return name;
      const householderId = visitContactIdCache.get(visitId);
      if (householderId) {
        const contact = personalContacts.find((c) => c.id === householderId);
        if (contact?.name) return contact.name;
      }
      // Return null while loading (don't show raw visit ID)
      if (loadingVisitIds.has(visitId)) return null;
      return null;
    }

    // Legacy support for contact ID
    const contactId = getContactId(study);
    if (contactId) {
      const contact = personalContacts.find(c => c.id === contactId);
      return contact ? contact.name : study;
    }

    // Plain text name
    return study;
  };

  const addStudy = async (
    nameOrId: string,
    isContactIdParam: boolean = false,
    contactNameParam?: string
  ) => {
    const trimmed = nameOrId.trim();
    if (!trimmed) return;
    
    let contactId: string | null = null;
    let contactName: string = contactNameParam?.trim() || trimmed;

    if (isContactIdParam && !contactNameParam) {
      const contact = personalContacts.find(c => c.id === trimmed);
      if (contact?.name) contactName = contact.name;
    }
    
    // OPTIMISTIC UI UPDATE: Add temporary placeholder immediately for instant feedback
    const tempPlaceholder = `temp:${contactName}`;
    
    // Check if already exists before adding
    const currentStudies = studiesRef.current;
    if (currentStudies.includes(tempPlaceholder)) return;
    if (currentStudies.some(s => {
      const visitId = getVisitId(s);
      const hhId = getContactId(s);
      if (isContactIdParam && hhId === trimmed) return true;
      if (visitId) {
        const visitContactId = visitContactIdCache.get(visitId);
        if (visitContactId === trimmed) return true;
      }
      return false;
    })) return;
    
    // Add temporary placeholder immediately for instant UI feedback
    setStudies((s) => {
      // Double-check to avoid duplicates
      if (s.includes(tempPlaceholder)) return s;
      if (s.some(existing => {
        const visitId = getVisitId(existing);
        const hhId = getContactId(existing);
        if (isContactIdParam && hhId === trimmed) return true;
        if (visitId) {
          const visitContactId = visitContactIdCache.get(visitId);
          if (visitContactId === trimmed) return true;
        }
        return false;
      })) return s;
      return [...s, tempPlaceholder];
    });
    setBibleStudiesInputValue("");
    inputRef.current?.focus();
    
    // Now do async operations in the background
    try {
      if (isContactIdParam) {
        // It's already a contact ID from the dropdown
        contactId = trimmed;
        // Get the contact name from personal contacts
        const contact = personalContacts.find(c => c.id === trimmed);
        if (contact) {
          contactName = contact.name;
        } else {
          // Need to fetch the name
          const { listContacts } = await import("@/lib/db/business");
          const allContacts = await listContacts();
          const contact = allContacts.find(h => h.id === trimmed);
          if (contact) {
            contactName = contact.name;
          }
        }
      } else {
        // It's a custom name - create a contact automatically
        try {
          const { upsertContact } = await import("@/lib/db/business");
          const newContact = await upsertContact({
            name: trimmed,
            statuses: ["bible_study"],
            publisher_id: userId,
            note: null,
            establishment_id: null,
            lat: null,
            lng: null
          });
          
          if (newContact && newContact.id) {
            contactId = newContact.id;
            contactName = newContact.name;
            // Refresh personal contacts to include the new one
            const contacts = await getPersonalContacts(userId);
            setPersonalContacts(contacts);
            toast.success(`Created contact: ${trimmed}`);
          } else {
            // Fallback to plain text if creation fails
            // Replace temp placeholder with plain text
            setStudies((s) => {
              const filtered = s.filter(entry => entry !== tempPlaceholder);
              if (filtered.includes(trimmed)) return filtered;
              return [...filtered, trimmed];
            });
            pendingDeletesRef.current.delete(trimmed);
            pendingAddsRef.current.add(trimmed);
            persistPendingForDate(dateRef.current);
            setDirty(true);
            toast.error("Failed to create contact. Using name only.");
            return;
          }
        } catch (error: any) {
          console.error('Error creating contact:', error);
          // Replace temp placeholder with plain text
          setStudies((s) => {
            const filtered = s.filter(entry => entry !== tempPlaceholder);
            if (filtered.includes(trimmed)) return filtered;
            return [...filtered, trimmed];
          });
          pendingDeletesRef.current.delete(trimmed);
          pendingAddsRef.current.add(trimmed);
          persistPendingForDate(dateRef.current);
          setDirty(true);
          toast.error(error?.message || "Failed to create contact. Using name only.");
          return;
        }
      }
      
      // If we have a contact ID, create a visit entry, then replace temp placeholder with visit:ID
      if (contactId) {
        try {
          const { upsertContact, listContacts } = await import("@/lib/db/business");
          
          // Get the contact to check current status
          const allContacts = await listContacts();
          const contact = allContacts.find(h => h.id === contactId);
          
          if (!contact) {
            // Remove temp placeholder on error
            setStudies((s) => s.filter(entry => entry !== tempPlaceholder));
            toast.error("Contact not found");
            return;
          }

          let updatedContact = contact;
          
          // Update status to bible_study if not already
          if (!resolveContactStatuses(contact).includes("bible_study")) {
            const updated = await upsertContact({
              id: contact.id,
              name: contact.name,
              statuses: ["bible_study"],
              publisher_id: contact.publisher_id,
              note: contact.note,
              establishment_id: contact.establishment_id,
              lat: contact.lat,
              lng: contact.lng
            });
            
            if (updated) {
              updatedContact = {
                ...contact,
                statuses: ["bible_study"]
              };
            }
          }
          
          const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
          let visitId: string | null = null;
          let rpcData: any[] | null = null;

          if (isOffline) {
            if (typeof crypto === "undefined" || !crypto.randomUUID) {
              console.error("crypto.randomUUID unavailable for offline visit id");
              setStudies((s) => s.filter(entry => entry !== tempPlaceholder));
              toast.error("Offline add requires secure UUID support");
              return;
            }
            visitId = crypto.randomUUID();
            await outboxEnqueue({
              type: "add_bible_study_with_visit",
              payload: {
                p_visit_date: date,
                p_householder_id: contactId,
                p_establishment_id: contact.establishment_id ?? null,
                p_note: BIBLE_STUDY_CALL_NOTE,
                p_visit_id: visitId
              }
            });
            toast.success("Saved offline. Will sync when online.");
          } else {
            const supabase = createSupabaseBrowserClient();
            await supabase.auth.getSession();
            const { data, error } = await supabase.rpc("add_bible_study_with_visit", {
              p_visit_date: date,
              p_householder_id: contactId,
              p_establishment_id: contact.establishment_id ?? null,
              p_note: BIBLE_STUDY_CALL_NOTE,
              p_visit_id: null
            });

            if (error || !data || data.length === 0) {
              console.error('Failed to create visit entry via RPC:', { error, contactId, userId, date });
              // Remove temp placeholder on error
              setStudies((s) => s.filter(entry => entry !== tempPlaceholder));
              toast.error("Failed to create visit entry");
              return;
            }
            rpcData = data as any[];
            visitId = (data[0]?.visit_id as string | undefined) ?? null;
          }

          if (!visitId) {
            console.error('RPC response missing visit_id:', rpcData);
            setStudies((s) => s.filter(entry => entry !== tempPlaceholder));
            toast.error("Failed to create visit entry");
            return;
          }

          // Replace temp placeholder with visit:ID
          const studyEntry = `visit:${visitId}`;
          
          // Check if visit ID already exists (shouldn't happen, but be safe)
          const currentStudiesAfterTemp = studiesRef.current;
          if (currentStudiesAfterTemp.some(s => {
            const existingVisitId = getVisitId(s);
            return existingVisitId === visitId;
          })) {
            // Visit ID already exists, just remove temp placeholder
            setStudies((s) => s.filter(entry => entry !== tempPlaceholder));
            return;
          }
          
          // Replace temp placeholder with actual visit ID
          setStudies((s) => {
            const filtered = s.filter(entry => entry !== tempPlaceholder);
            // Double-check visit ID doesn't exist
            if (filtered.some(existing => {
              const existingVisitId = getVisitId(existing);
              return existingVisitId === visitId;
            })) {
              return filtered;
            }
            return [...filtered, studyEntry];
          });

          pendingDeletesRef.current.delete(studyEntry);
          pendingAddsRef.current.add(studyEntry);
          persistPendingForDate(dateRef.current);
          
          // Load the visit name and contact ID into cache immediately
          setVisitNamesCache(prev => {
            const newCache = new Map(prev);
            newCache.set(visitId, contact.name);
            return newCache;
          });
          setVisitContactIdCache(prev => {
            const newCache = new Map(prev);
            newCache.set(visitId, contactId as string);
            return newCache;
          });
          
          // Emit events to refresh visit history
          try {
            const visitEvent = {
              id: visitId,
              establishment_id: contact.establishment_id ?? null,
              householder_id: contactId,
              note: BIBLE_STUDY_CALL_NOTE,
              publisher_id: userId,
              partner_id: null,
              visit_date: date
            };
            window.dispatchEvent(new CustomEvent('visit-added', { detail: { contactId, date, visitId } }));
            businessEventBus.emit('visit-added', visitEvent);
            businessEventBus.emit('contact-updated', updatedContact);
          } catch {}
          
          // Mark as dirty to trigger save
          setDirty(true);
        } catch (error: any) {
          console.error('Error creating visit entry:', error);
          // Remove temp placeholder on error
          setStudies((s) => s.filter(entry => entry !== tempPlaceholder));
          toast.error(error?.message || "Failed to create visit entry");
          return;
        }
      } else {
        // Plain text entry (shouldn't happen, but handle gracefully)
        // Replace temp placeholder with plain text
        setStudies((s) => {
          const filtered = s.filter(entry => entry !== tempPlaceholder);
          if (filtered.includes(trimmed)) return filtered;
          return [...filtered, trimmed];
        });
        pendingDeletesRef.current.delete(trimmed);
        pendingAddsRef.current.add(trimmed);
        persistPendingForDate(dateRef.current);
        setDirty(true);
      }
    } catch (error: any) {
      console.error('Unexpected error in addStudy:', error);
      // Remove temp placeholder on error
      setStudies((s) => s.filter(entry => entry !== tempPlaceholder));
      toast.error(error?.message || "Failed to add bible study");
    }
  };

  const removeStudy = async (studyEntry: string) => {
    // If it's a temporary placeholder, just remove it (no visit created yet)
    if (isTemporaryPlaceholder(studyEntry)) {
      setStudies((s) => s.filter((n) => n !== studyEntry));
      setDirty(true);
      return;
    }
    
    // If it's a visit ID, delete the visit entry
    const visitId = getVisitId(studyEntry);
    if (visitId) {
      pendingAddsRef.current.delete(studyEntry);
      pendingDeletesRef.current.add(studyEntry);
      persistPendingForDate(dateRef.current);
      // Optimistically remove from UI and emit event immediately
      setStudies((s) => s.filter((n) => n !== studyEntry));
      setDirty(true);
      
      // Emit event optimistically to update BWI visit history immediately
      try {
        window.dispatchEvent(new CustomEvent('visit-deleted', { detail: { visitId } }));
        businessEventBus.emit('visit-deleted', { id: visitId });
      } catch {}
      
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
      if (isOffline) {
        try {
          await outboxEnqueue({
            type: "delete_bible_study_with_visit",
            payload: {
              p_visit_id: visitId,
              p_visit_date: date
            }
          });
          toast.success("Deleted offline. Will sync when online.");
        } catch (error: any) {
          console.error('Error queueing delete visit entry:', error);
          toast.error(error?.message || "Failed to queue delete");
        }
        return;
      }

      // Delete the visit entry via RPC in the background
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.getSession();
        const { error } = await supabase.rpc("delete_bible_study_with_visit", {
          p_visit_id: visitId,
          p_visit_date: date
        });
        if (error) {
          console.error('Failed to delete visit entry:', visitId);
          toast.error("Failed to delete visit entry");
          // Note: We don't revert the optimistic update - the visit is already removed from UI
        }
      } catch (error: any) {
        console.error('Error deleting visit entry:', error);
        toast.error(error?.message || "Failed to delete visit entry");
        // Note: We don't revert the optimistic update - the visit is already removed from UI
      }
    } else {
      pendingAddsRef.current.delete(studyEntry);
      pendingDeletesRef.current.add(studyEntry);
      persistPendingForDate(dateRef.current);
      // Not a visit ID, just remove from studies array
      setStudies((s) => s.filter((n) => n !== studyEntry));
      setDirty(true);
    }
  };

  const changeStep = (delta: number) => {
    const next = new Date(view);
    if (mode === "days") next.setMonth(next.getMonth() + delta);
    else if (mode === "months") next.setFullYear(next.getFullYear() + delta);
    else next.setFullYear(next.getFullYear() + delta * 12);
    setView(next);
  };

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    idx: i,
    label: new Date(2000, i, 1).toLocaleString(undefined, { month: "short" })
  })), []);

  const years = useMemo(() => {
    const base = view.getFullYear();
    const start = base - 7;
    return Array.from({ length: 12 }, (_, i) => start + i);
  }, [view]);

  // Load personal contact contacts
  useEffect(() => {
    const loadPersonalContacts = async () => {
      try {
        const contacts = await getPersonalContacts(userId);
        setPersonalContacts(contacts);
      } catch (error) {
        console.error('Error loading personal contacts:', error);
      }
    };
    loadPersonalContacts();
  }, [userId]);

  const callEditPaneShade = useMemo(
    () => getStudyBibleDarkCardShade(`fieldservice-call-edit:${userId}`),
    [userId]
  );

  // Load establishments for CallForm
  useEffect(() => {
    const loadEstablishments = async () => {
      try {
        const ests = await listEstablishments();
        setEstablishments(ests);
      } catch (error) {
        console.error('Error loading establishments:', error);
      }
    };
    loadEstablishments();
  }, []);

  // Load visit data when editVisitId changes
  useEffect(() => {
    if (!editVisitId) {
      setEditVisit(null);
      return;
    }

    const loadVisit = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.getSession();
        const { data, error } = await supabase
          .from('calls')
          .select('id, establishment_id, householder_id, note, publisher_id, partner_id, visit_date')
          .eq('id', editVisitId)
          .single();

        if (error) throw error;
        if (data) {
          setEditVisit({
            id: data.id,
            establishment_id: data.establishment_id,
            contact_id: data.householder_id ?? null,
            note: data.note,
            publisher_id: data.publisher_id,
            partner_id: data.partner_id,
            visit_date: data.visit_date,
          });
        }
      } catch (error) {
        console.error('Error loading visit:', error);
        toast.error('Failed to load visit details');
        setEditVisitId(null);
      }
    };

    loadVisit();
  }, [editVisitId]);

  // Reload month marks when calendar view (month) changes (dots on calendar).
  useEffect(() => {
    loadMonthMarks();
  }, [view]);

  // Always default to today when the drawer opens.
  useEffect(() => {
    if (!isOpen) return;
    const today = new Date();
    const todayStr = toLocalStr(today);
    setMode("days");
    setView(today);
    setDirty(false);
    setDate(todayStr);
  }, [isOpen, userId]);

  // Load selected date only when the user switches day — do NOT reload when dirty flips to false
  // after save, or we overwrite optimistic add/delete with cache and cause stutter (add disappears,
  // deleted study reappears as loading chip).
  useEffect(() => {
    load(date);
  }, [date]);

  useEffect(() => {
    if (dirty) {
      scheduleSave();
      if (notifyRef.current) clearTimeout(notifyRef.current);
      notifyRef.current = setTimeout(() => {
        toast.success("Saving...");
      }, 500);
    }
  }, [dirty, scheduleSave, studies, hours, note]);

  return (
    <>
    <div>
      <div className="px-4 pb-0 pt-2 text-center">
        <h2 className="text-lg font-semibold text-[#1a1820] dark:text-[#fffaff]">Field Service</h2>
        <p className={cn("text-sm", studyBibleDarkClasses.fieldServiceSubtitle)}>
          Record your daily activity.
        </p>
      </div>
      <div className="grid md:grid-cols-2">
        <div
          className={cn(
            "p-4 border-b md:border-b-0 md:border-r",
            studyBibleDarkClasses.fieldServiceDivider,
            studyBibleDarkClasses.fieldServiceCalendarPane
          )}
        >
        <div className="flex items-center justify-between pb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => changeStep(-1)}
            className={studyBibleDarkClasses.fieldServiceNavControl}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2 text-base font-semibold text-[#1a1820] dark:text-[#fffaff]">
            <Button
              variant="ghost"
              size="sm"
              className={cn("text-base", studyBibleDarkClasses.fieldServiceNavControl)}
              onClick={() => setMode("months")}
            >
              {monthLabel}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn("text-base", studyBibleDarkClasses.fieldServiceNavControl)}
              onClick={() => setMode("years")}
            >
              {yearLabel}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => changeStep(1)}
            className={studyBibleDarkClasses.fieldServiceNavControl}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        {mode === "days" && (
          <>
            <div
              className={cn(
                "grid grid-cols-7 gap-1 px-1 text-xs font-medium",
                studyBibleDarkClasses.fieldServiceWeekday
              )}
            >
              {"S,M,T,W,T,F,S".split(",").map((d, i) => (
                <div key={`${d}-${i}`} className="text-center">
                  {d}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1 p-1">
              {days.map((d, i) => {
                const sel = isSelected(d);
                const muted = !inMonth(d);
                const ds = toLocalStr(d);
                const mark = monthMarks[ds];
                const hours = mark?.hours ?? 0;
                const hasHours = hours > 0;
                const hasNotes = mark?.hasNotes ?? false;
                const hasBibleStudies = mark?.hasBibleStudies ?? false;
                const showDot = hasHours || hasNotes || hasBibleStudies;
                const hasHighHours = hours >= 8;
                
                // Determine dot color/style
                let dotElement: ReactElement | null = null;
                if (hasBibleStudies && hasNotes) {
                  // Half green/half brown - use a gradient approach with two overlapping divs
                  dotElement = (
                    <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full overflow-hidden flex">
                      <span className="w-1/2 h-full bg-emerald-500" />
                      <span className="w-1/2 h-full bg-amber-700" />
                    </span>
                  );
                } else if (hasBibleStudies) {
                  // Green dot for bible studies
                  dotElement = <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />;
                } else if (hasNotes) {
                  // Brown dot for notes (amber-700, similar to RV orange but more brown)
                  dotElement = <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-amber-700" />;
                } else if (hasHours) {
                  // Black dot for hours only in light mode, white in dark mode
                  dotElement = <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-black dark:bg-white border border-gray-300 dark:border-gray-600" />;
                }
                
                // Determine button styling
                let buttonClassName = cn(
                  "relative h-10",
                  muted && "opacity-50",
                  !hasHighHours && !sel && "hover:bg-[#ded6e7] dark:hover:bg-[#3b3348]"
                );
                if (hasHighHours) {
                  // Purple/yellow/turquoise gradient background for 8+ hours
                  // Override default button styles to show gradient
                  buttonClassName = cn(
                    buttonClassName,
                    "!bg-gradient-to-br !from-purple-500 !via-yellow-400 !to-cyan-400 !text-gray-900 dark:!text-gray-900 !font-semibold hover:!opacity-90"
                  );
                }
                
                return (
                  <Button
                    key={i}
                    variant={hasHighHours ? "default" : (sel ? "default" : "ghost")}
                    size="sm"
                    className={buttonClassName}
                    onClick={() => {
                      setDate(ds);
                      setView(d);
                      load(ds);
                    }}
                  >
                    {d.getDate()}
                    {showDot && dotElement}
                  </Button>
                );
              })}
            </div>
          </>
        )}
        {mode === "months" && (
          <div className="mt-1 grid grid-cols-3 gap-2 p-1">
            {months.map((m) => (
              <Button
                key={m.idx}
                variant={m.idx === view.getMonth() ? "default" : "ghost"}
                className={m.idx !== view.getMonth() ? studyBibleDarkClasses.fieldServiceNavControl : undefined}
                onClick={() => {
                  const n = new Date(view);
                  n.setMonth(m.idx);
                  setView(n);
                  setMode("days");
                }}
              >
                {m.label}
              </Button>
            ))}
          </div>
        )}
        {mode === "years" && (
          <div className="mt-1 grid grid-cols-3 gap-2 p-1">
            {years.map((y) => (
              <Button
                key={y}
                variant={y === view.getFullYear() ? "default" : "ghost"}
                className={y !== view.getFullYear() ? studyBibleDarkClasses.fieldServiceNavControl : undefined}
                onClick={() => {
                  const n = new Date(view);
                  n.setFullYear(y);
                  setView(n);
                  setMode("months");
                }}
              >
                {y}
              </Button>
            ))}
          </div>
        )}
      </div>
        <div className={cn("p-4 pt-6 pb-0", studyBibleDarkClasses.fieldServiceFormPane)}>
        <div className="mt-2 grid gap-3">
          <div className="grid gap-2 place-items-center text-sm">
            <NumberFlowInput
              value={parseInt(hours) || 0}
              onChange={(newValue) => {
                setHours(String(newValue));
                setDirty(true);
              }}
              min={0}
              max={24}
              size="md"
              className={cn("mx-auto", studyBibleDarkClasses.fieldServiceHoursControl)}
            />
            <span className={cn("mt-1", studyBibleDarkClasses.fieldServiceLabel)}>Hours</span>
          </div>
          <div className="grid gap-1 text-sm">
            <span className={studyBibleDarkClasses.fieldServiceLabel}>Bible Studies</span>
            <div className="flex flex-wrap gap-2">
              {studies.map((s) => {
                const visitId = getVisitId(s);
                const displayName = getStudyDisplayName(s);
                const isLoading = isStudyLoading(s);
                const isTemp = isTemporaryPlaceholder(s);
                
                return (
                  <span
                    key={s}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs",
                      studyBibleDarkClasses.fieldServiceChip
                    )}
                  >
                    {isLoading && !isTemp ? (
                      // Show skeleton only for visit IDs that are loading, not temp placeholders
                      <Skeleton className="h-4 w-20" />
                    ) : visitId && displayName ? (
                      <button
                        type="button"
                        onClick={() => setEditVisitId(visitId)}
                        className="cursor-pointer hover:underline"
                      >
                        {displayName}
                      </button>
                    ) : displayName ? (
                      <span className={isTemp ? "opacity-70" : ""}>{displayName}</span>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeStudy(s);
                      }}
                    >
                      ×
                    </Button>
                  </span>
                );
              })}
            </div>
            <div className="relative">
              <Input
                ref={inputRef}
                className={studyBibleDarkClasses.fieldServiceInput}
                placeholder="Type a name and press Enter"
                value={bibleStudiesInputValue}
                onChange={(e) => setBibleStudiesInputValue(e.target.value)}
                onFocus={(e) => {
                  setBibleStudiesInputFocused(true);
                  requestAnimationFrame(() => {
                    e.target.scrollIntoView({ block: "nearest", behavior: "smooth" });
                  });
                }}
                onBlur={(e) => {
                  // Check if the blur is going to the dropdown
                  const relatedTarget = e.relatedTarget as HTMLElement;
                  if (relatedTarget && relatedTarget.closest('.bible-studies-dropdown')) {
                    // Don't close if clicking inside dropdown
                    return;
                  }
                  // Delay to allow click on dropdown item
                  setTimeout(() => setBibleStudiesInputFocused(false), 200);
                }}
                onKeyDown={(e) => { 
                  if (e.key === "Enter") { 
                    e.preventDefault(); 
                    const v = bibleStudiesInputValue.trim();
                    if (v) {
                      addStudy(v, false);
                    }
                  } 
                }} 
              />
              {bibleStudiesInputFocused && personalContacts.length > 0 && (
                <div
                  className={cn(
                    "bible-studies-dropdown absolute z-50 mt-1 w-full max-h-[200px] overflow-y-auto rounded-md border p-1 shadow-md",
                    studyBibleDarkClasses.fieldServiceInput,
                    "bg-[#f5f2f8] dark:bg-[#2a2534]"
                  )}
                  onMouseDown={(e) => {
                    // Prevent input blur when clicking in dropdown
                    e.preventDefault();
                  }}
                >
                  {personalContacts
                    .filter(contact => 
                      !bibleStudiesInputValue || 
                      contact.name.toLowerCase().includes(bibleStudiesInputValue.toLowerCase())
                    )
                    .filter(contact => {
                      // Check if contact is already added (by visit ID or contact ID)
                      // Also check temporary placeholders
                      return !studies.some(s => {
                        // Skip temporary placeholders in this check (they're being processed)
                        if (isTemporaryPlaceholder(s)) {
                          const tempName = s.replace("temp:", "");
                          return tempName === contact.name || tempName === contact.id;
                        }
                        
                        const visitId = getVisitId(s);
                        const hhId = getContactId(s);
                        
                        // Check legacy contact ID format
                        if (hhId === contact.id) {
                          return true;
                        }
                        
                        // Check if this contact is linked to any visit in the studies list
                        if (visitId) {
                          const visitContactId = visitContactIdCache.get(visitId);
                          if (visitContactId === contact.id) {
                            return true;
                          }
                        }
                        
                        return false;
                      });
                    })
                    .map((contact) => (
                      <Button
                        key={contact.id}
                        variant="ghost"
                        className="w-full justify-start text-sm h-auto py-2 px-2"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          addStudy(contact.id, true, contact.name);
                          // Clear input but keep dropdown open
                          setBibleStudiesInputValue("");
                          // Refocus input to keep dropdown visible
                          setTimeout(() => {
                            inputRef.current?.focus();
                          }, 0);
                        }}
                      >
                        {contact.name}
                      </Button>
                    ))}
                  {personalContacts.filter(contact => 
                    !bibleStudiesInputValue || 
                    contact.name.toLowerCase().includes(bibleStudiesInputValue.toLowerCase())
                  ).filter(contact => 
                    !studies.some(s => getContactId(s) === contact.id)
                  ).length === 0 && (
                    <div className="text-xs text-muted-foreground px-2 py-2 text-center">
                      No available contacts
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-1 text-sm">
            <span className={studyBibleDarkClasses.fieldServiceLabel}>Note</span>
            <Textarea
              className={cn("min-h-[112px]", studyBibleDarkClasses.fieldServiceInput)}
              value={note}
              onFocus={(e) => {
                requestAnimationFrame(() => {
                  e.target.scrollIntoView({ block: "nearest", behavior: "smooth" });
                });
              }}
              onChange={(e) => {
                setNote(e.target.value);
                setDirty(true);
              }}
              placeholder="Credits...?"
            />
          </div>
        </div>
        </div>
      </div>
    </div>

    <FormModal
      open={!!editVisitId && !!editVisit}
      onOpenChange={(open) => {
        if (!open) setEditVisitId(null);
      }}
      title="Edit Call"
      headerClassName="text-center bg-transparent dark:bg-transparent"
      className={callEditPaneShade}
      drawerContentClassName="h-[85svh] max-h-[85svh] [&_.drawer-content-inner]:flex [&_.drawer-content-inner]:flex-col [&_.drawer-content-inner]:overflow-hidden"
      drawerHandleClassName="dark:bg-[#80778e] dark:shadow-[0_0_18px_rgba(128,119,142,0.45)]"
      stackAboveParentSheet
    >
      {editVisit ? (
        <CallForm
          establishments={establishments}
          initialVisit={editVisit}
          contactId={editVisit.contact_id || undefined}
          contactName={editVisitId ? visitNamesCache.get(editVisitId) || undefined : undefined}
          onSaved={() => {
            setEditVisitId(null);
            load(date);
          }}
          disableEstablishmentSelect={!!editVisit.contact_id}
        />
      ) : null}
    </FormModal>
    </>
  );
}
