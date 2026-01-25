"use client";

import { Plus, ChevronRight } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { getDailyRecord, listDailyByMonth, upsertDailyRecord, isDailyEmpty, deleteDailyRecord } from "@/lib/db/dailyRecords";
import { useMobile } from "@/lib/hooks/use-mobile";
import { motion } from "framer-motion";
import { NumberFlowInput } from "@/components/ui/number-flow-input";
import { getPersonalContactHouseholders, listEstablishments } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { VisitForm } from "@/components/business/VisitForm";
import { ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function toLocalStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface FieldServiceFormProps {
  userId: string;
  onClose: () => void;
}

export default function FieldServiceForm({ userId, onClose }: FieldServiceFormProps) {
  const isMobile = useMobile();
  const [view, setView] = useState<Date>(new Date());
  const [mode, setMode] = useState<"days"|"months"|"years">("days");
  const [date, setDate] = useState<string>(toLocalStr(new Date()));
  const [hours, setHours] = useState<string>("");
  const [studies, setStudies] = useState<string[]>([]);
  const [note, setNote] = useState<string>("");
  const debounceRef = useRef<any>(null);
  const notifyRef = useRef<any>(null);
  const [dirty, setDirty] = useState(false);
  const [monthMarks, setMonthMarks] = useState<Record<string, boolean>>({});
  const [personalContacts, setPersonalContacts] = useState<Array<{ id: string; name: string }>>([]);
  const [bibleStudiesInputFocused, setBibleStudiesInputFocused] = useState(false);
  const [bibleStudiesInputValue, setBibleStudiesInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [editVisitId, setEditVisitId] = useState<string | null>(null);
  const [editVisit, setEditVisit] = useState<{
    id: string;
    establishment_id?: string | null;
    householder_id?: string | null;
    note?: string | null;
    publisher_id?: string | null;
    partner_id?: string | null;
    visit_date?: string;
  } | null>(null);
  const [establishments, setEstablishments] = useState<any[]>([]);

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
      const marks: Record<string, boolean> = {};
      for (const r of list) {
        if (!(r as any) || (typeof r !== "object")) continue;
        const h = Number((r as any).hours || 0);
        const bs = Array.isArray((r as any).bible_studies) ? (r as any).bible_studies.filter(Boolean) : [];
        const n = ((r as any).note ?? "").toString().trim();
        const empty = (!h || h === 0) && bs.length === 0 && n.length === 0;
        if (!empty) marks[(r as any).date] = true;
      }
      setMonthMarks(marks);
    } catch {}
  };

  const load = async (d: string) => {
    try {
      const rec = await getDailyRecord(userId, d);
      setHours(rec ? String(rec.hours) : "");
      setStudies(rec?.bible_studies ?? []);
      setNote(rec?.note ?? "");
      setBibleStudiesInputValue("");
      setDirty(false);
    } catch {}
  };

  // Use refs to always get the latest state values
  const studiesRef = useRef(studies);
  const hoursRef = useRef(hours);
  const noteRef = useRef(note);
  
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

  const scheduleSave = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      // Use the latest values from refs to ensure we always have the current state
      const currentStudies = studiesRef.current;
      const currentHours = hoursRef.current;
      const currentNote = noteRef.current;
      
      const payload = {
        user_id: userId,
        date,
        hours: Number(currentHours || 0),
        bible_studies: currentStudies,
        note: currentNote.trim() || null,
      };
      console.log('Saving daily record with payload:', payload);
      console.log('Bible studies array:', payload.bible_studies);
      try {
        if (isDailyEmpty(payload)) {
          await deleteDailyRecord(userId, date);
          setMonthMarks((m) => {
            const cp = { ...m };
            delete cp[date];
            return cp;
          });
        } else {
          const result = await upsertDailyRecord(payload);
          console.log('Daily record saved successfully:', result);
          setMonthMarks((m) => ({ ...m, [date]: true }));
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

  // Helper to check if a study entry is a householder ID (legacy support)
  const isHouseholderId = (study: string): boolean => {
    return study.startsWith("householder:");
  };

  // Helper to get visit ID from study entry
  const getVisitId = (study: string): string | null => {
    if (isVisitId(study)) {
      return study.replace("visit:", "");
    }
    return null;
  };

  // Helper to get householder ID from study entry (legacy support)
  const getHouseholderId = (study: string): string | null => {
    if (isHouseholderId(study)) {
      return study.replace("householder:", "");
    }
    return null;
  };

  // State to cache visit-to-householder name mappings
  const [visitNamesCache, setVisitNamesCache] = useState<Map<string, string>>(new Map());
  // State to cache visit-to-householder ID mappings (for filtering)
  const [visitHouseholderIdCache, setVisitHouseholderIdCache] = useState<Map<string, string>>(new Map());
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

      // Check which visits we need to fetch
      const missingIds = visitIds.filter(id => !visitNamesCache.has(id));
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

        const newCache = new Map(visitNamesCache);
        const newHouseholderIdCache = new Map(visitHouseholderIdCache);
        visits?.forEach((visit: any) => {
          if (visit.householders && visit.householders.name) {
            newCache.set(visit.id, visit.householders.name);
          }
          if (visit.householder_id) {
            newHouseholderIdCache.set(visit.id, visit.householder_id);
          }
        });
        setVisitNamesCache(newCache);
        setVisitHouseholderIdCache(newHouseholderIdCache);
        
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

  // Helper to check if a study entry is loading
  const isStudyLoading = (study: string): boolean => {
    const visitId = getVisitId(study);
    return visitId ? loadingVisitIds.has(visitId) : false;
  };

  // Helper to get display name for a study entry
  const getStudyDisplayName = (study: string): string | null => {
    // Check for visit ID first (new format)
    const visitId = getVisitId(study);
    if (visitId) {
      const name = visitNamesCache.get(visitId);
      if (name) return name;
      // Return null if still loading (don't show visit ID)
      return null;
    }

    // Legacy support for householder ID
    const householderId = getHouseholderId(study);
    if (householderId) {
      const contact = personalContacts.find(c => c.id === householderId);
      return contact ? contact.name : study;
    }

    // Plain text name
    return study;
  };

  const addStudy = async (nameOrId: string, isHouseholderIdParam: boolean = false) => {
    const trimmed = nameOrId.trim();
    if (!trimmed) return;
    
    let studyEntry: string;
    let householderId: string | null = null;
    
    if (isHouseholderIdParam) {
      // It's already a householder ID from the dropdown
      householderId = trimmed;
    } else {
      // It's a custom name - create a householder automatically
      try {
        const { upsertHouseholder } = await import("@/lib/db/business");
        const newHouseholder = await upsertHouseholder({
          name: trimmed,
          status: "bible_study",
          publisher_id: userId,
          note: null,
          establishment_id: null,
          lat: null,
          lng: null
        });
        
        if (newHouseholder && newHouseholder.id) {
          householderId = newHouseholder.id;
          // Refresh personal contacts to include the new one
          const contacts = await getPersonalContactHouseholders(userId);
          setPersonalContacts(contacts);
          toast.success(`Created householder: ${trimmed}`);
        } else {
          // Fallback to plain text if creation fails
          studyEntry = trimmed;
          toast.error("Failed to create householder. Using name only.");
          setStudies((s) => [...s, studyEntry]);
          setDirty(true);
          setBibleStudiesInputValue("");
          inputRef.current?.focus();
          return;
        }
      } catch (error: any) {
        console.error('Error creating householder:', error);
        // Fallback to plain text if creation fails
        studyEntry = trimmed;
        toast.error(error?.message || "Failed to create householder. Using name only.");
        setStudies((s) => [...s, studyEntry]);
        setDirty(true);
        setBibleStudiesInputValue("");
        inputRef.current?.focus();
        return;
      }
    }
    
    // If we have a householder ID, create a visit entry first, then store visit:ID
    if (householderId) {
      try {
        const { addVisit, upsertHouseholder, listHouseholders } = await import("@/lib/db/business");
        
        // Get the householder to check current status
        const allHouseholders = await listHouseholders();
        const householder = allHouseholders.find(h => h.id === householderId);
        
        if (!householder) {
          toast.error("Householder not found");
          return;
        }

        let updatedHouseholder = householder;
        
        // Update status to bible_study if not already
        if (householder.status !== "bible_study") {
          const updated = await upsertHouseholder({
            id: householder.id,
            name: householder.name,
            status: "bible_study",
            publisher_id: householder.publisher_id,
            note: householder.note,
            establishment_id: householder.establishment_id,
            lat: householder.lat,
            lng: householder.lng
          });
          
          if (updated) {
            updatedHouseholder = {
              ...householder,
              status: "bible_study"
            };
          }
        }
        
        // Create visit entry first
        // Only include establishment_id if the householder has one
        // If householder doesn't have establishment_id, explicitly set to undefined (not null)
        const visitPayload: {
          householder_id: string;
          publisher_id: string;
          visit_date: string;
          note: null;
          establishment_id?: string;
        } = {
          householder_id: householderId,
          publisher_id: userId,
          visit_date: date,
          note: null,
          // Explicitly set to undefined if householder doesn't have one, to prevent any database defaults
          establishment_id: householder.establishment_id ? householder.establishment_id : undefined
        };
        
        const visit = await addVisit(visitPayload);
        
        if (!visit || !visit.id) {
          console.error('Failed to create visit entry:', { visit, householderId, userId, date });
          toast.error("Failed to create visit entry");
          return;
        }

        console.log('Visit created successfully:', visit.id);

        // Store visit:ID in the studies array
        studyEntry = `visit:${visit.id}`;
        
        console.log('Study entry to be saved:', studyEntry);
        
        // Check if already exists (check both visit ID and householder ID formats for legacy support)
        if (studies.includes(studyEntry)) {
          console.log('Study entry already exists, skipping');
          return;
        }
        const visitIdFromEntry = getVisitId(studyEntry);
        if (visitIdFromEntry && studies.some(s => getVisitId(s) === visitIdFromEntry)) {
          console.log('Visit ID already exists in studies, skipping');
          return;
        }
        // Also check for existing householder ID (legacy)
        if (studies.some(s => getHouseholderId(s) === householderId)) {
          console.log('Householder ID already exists in studies, skipping');
          return;
        }
        
        // Load the visit name and householder ID into cache immediately
        setVisitNamesCache(prev => {
          const newCache = new Map(prev);
          newCache.set(visit.id, householder.name);
          return newCache;
        });
        setVisitHouseholderIdCache(prev => {
          const newCache = new Map(prev);
          if (visit.householder_id) {
            newCache.set(visit.id, visit.householder_id);
          }
          return newCache;
        });
        
        // Emit events to refresh visit history
        try {
          window.dispatchEvent(new CustomEvent('visit-added', { detail: { householderId, date, visitId: visit.id } }));
          businessEventBus.emit('visit-added', visit);
          businessEventBus.emit('householder-updated', updatedHouseholder);
        } catch {}
        
        // Add the study entry to state immediately after visit creation
        console.log('Adding study entry to state:', studyEntry);
        console.log('Current studies before add:', studies);
        setStudies((s) => {
          const updated = [...s, studyEntry];
          console.log('Updated studies array:', updated);
          return updated;
        });
        setDirty(true);
        setBibleStudiesInputValue("");
        inputRef.current?.focus();
        return; // Return early since we've already added the study
      } catch (error: any) {
        console.error('Error creating visit entry:', error);
        toast.error(error?.message || "Failed to create visit entry");
        return;
      }
    } else {
      // Plain text entry (shouldn't happen, but handle gracefully)
      studyEntry = trimmed;
      
      // Check if already exists
      if (studies.includes(studyEntry)) return;
      if (studies.some(s => !isVisitId(s) && !isHouseholderId(s) && s === trimmed)) return;
      
      // Add plain text study entry
      console.log('Adding plain text study entry to state:', studyEntry);
      setStudies((s) => {
        const updated = [...s, studyEntry];
        console.log('Updated studies array:', updated);
        return updated;
      });
      setDirty(true);
      setBibleStudiesInputValue("");
      inputRef.current?.focus();
    }
  };

  const removeStudy = async (studyEntry: string) => {
    // If it's a visit ID, delete the visit entry
    const visitId = getVisitId(studyEntry);
    if (visitId) {
      // Optimistically remove from UI and emit event immediately
      setStudies((s) => s.filter((n) => n !== studyEntry));
      setDirty(true);
      
      // Emit event optimistically to update BWI visit history immediately
      try {
        window.dispatchEvent(new CustomEvent('visit-deleted', { detail: { visitId } }));
        businessEventBus.emit('visit-deleted', { id: visitId });
      } catch {}
      
      // Delete the visit entry in the background
      try {
        const { deleteVisit } = await import("@/lib/db/business");
        const deleted = await deleteVisit(visitId);
        if (deleted) {
          console.log('Visit entry deleted:', visitId);
        } else {
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

  // Load personal contact householders
  useEffect(() => {
    const loadPersonalContacts = async () => {
      try {
        const contacts = await getPersonalContactHouseholders(userId);
        setPersonalContacts(contacts);
      } catch (error) {
        console.error('Error loading personal contacts:', error);
      }
    };
    loadPersonalContacts();
  }, [userId]);

  // Load establishments for VisitForm
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
          setEditVisit(data);
        }
      } catch (error) {
        console.error('Error loading visit:', error);
        toast.error('Failed to load visit details');
        setEditVisitId(null);
      }
    };

    loadVisit();
  }, [editVisitId]);

  useEffect(() => {
    loadMonthMarks();
    load(date);
  }, [view]);

  useEffect(() => {
    if (dirty) {
      scheduleSave();
      if (notifyRef.current) clearTimeout(notifyRef.current);
      notifyRef.current = setTimeout(() => {
        toast.success("Saving...");
      }, 500);
    }
  }, [dirty, scheduleSave]);

  // If editing a visit, show only the edit form
  if (editVisitId && editVisit) {
    return (
      <div className="-mx-4 px-4 pb-10 relative">
        <div className="mb-4 flex items-center justify-center gap-2 relative pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditVisitId(null)}
            className="h-8 w-8 p-0 absolute left-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h2 className="text-lg font-semibold">Edit Visit</h2>
            <p className="text-sm text-muted-foreground">Update visit details</p>
          </div>
        </div>
        <VisitForm
          establishments={establishments}
          initialVisit={editVisit}
          householderId={editVisit.householder_id || undefined}
          householderName={visitNamesCache.get(editVisitId) || undefined}
          onSaved={() => {
            setEditVisitId(null);
            // Refresh the studies to get updated visit data
            load(date);
          }}
          disableEstablishmentSelect={!!editVisit.householder_id}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="p-4 pb-0 text-center">
        <h2 className="text-lg font-semibold">Field Service</h2>
        <p className="text-sm text-muted-foreground">Record your daily activity.</p>
      </div>
      <div className="grid md:grid-cols-2">
        <div className="p-4 border-b md:border-b-0 md:border-r">
        <div className="flex items-center justify-between pb-3">
          <Button variant="ghost" size="sm" onClick={() => changeStep(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-sm font-medium flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMode("months")}>{monthLabel}</Button>
            <Button variant="ghost" size="sm" onClick={() => setMode("years")}>{yearLabel}</Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => changeStep(1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        {mode === "days" && (
          <>
            <div className="grid grid-cols-7 gap-1 px-1 text-xs opacity-70">
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
                const hasData = !!monthMarks[ds];
                return (
                  <Button
                    key={i}
                    variant={sel ? "default" : "ghost"}
                    size="sm"
                    className={`relative h-10 ${muted ? "opacity-50" : ""}`}
                    onClick={() => {
                      setDate(ds);
                      setView(d);
                      load(ds);
                    }}
                  >
                    {d.getDate()}
                    {hasData && <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />}
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
        <div className="p-4 pb-10">
        <div className="mt-0 grid gap-4">
          <div className="grid gap-1 text-sm place-items-center">
            <span className="opacity-70">Hours</span>
            <NumberFlowInput
              value={parseInt(hours) || 0}
              onChange={(newValue) => {
                setHours(String(newValue));
                setDirty(true);
              }}
              min={0}
              max={24}
              size="md"
              className="mx-auto"
            />
          </div>
          <div className="grid gap-1 text-sm">
            <span className="opacity-70">Bible Studies</span>
            <div className="flex flex-wrap gap-2">
              {studies.map((s) => {
                const visitId = getVisitId(s);
                const displayName = getStudyDisplayName(s);
                const isLoading = isStudyLoading(s);
                
                return (
                  <span key={s} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
                    {isLoading ? (
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
                      <span>{displayName}</span>
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
                placeholder="Type a name and press Enter" 
                value={bibleStudiesInputValue}
                onChange={(e) => setBibleStudiesInputValue(e.target.value)}
                onFocus={() => setBibleStudiesInputFocused(true)}
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
                  className="bible-studies-dropdown absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md p-1 max-h-[200px] overflow-y-auto"
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
                      // Check if contact is already added (by visit ID or householder ID)
                      return !studies.some(s => {
                        const visitId = getVisitId(s);
                        const hhId = getHouseholderId(s);
                        
                        // Check legacy householder ID format
                        if (hhId === contact.id) {
                          return true;
                        }
                        
                        // Check if this contact is linked to any visit in the studies list
                        if (visitId) {
                          const visitHouseholderId = visitHouseholderIdCache.get(visitId);
                          if (visitHouseholderId === contact.id) {
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
                          addStudy(contact.id, true);
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
                    !studies.some(s => getHouseholderId(s) === contact.id)
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
            <span className="opacity-70">Note</span>
            <Textarea 
              className="min-h-[112px]" 
              value={note} 
              onChange={(e) => { 
                setNote(e.target.value); 
                setDirty(true); 
              }} 
              placeholder="Optional note for this day" 
            />
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
