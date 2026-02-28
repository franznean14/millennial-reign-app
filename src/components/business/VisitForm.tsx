"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { toast } from "@/components/ui/sonner";
import { addVisit, getBwiParticipants, updateVisit, deleteVisit, getCallTodos, addCallTodo, updateCallTodo, deleteCallTodo, getDistinctCallGuestNames, syncCallTodoParticipantsForCall } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBestStatus } from "@/lib/utils/status-hierarchy";
import { getInitialsFromName } from "@/lib/utils/visit-history-ui";
import { cn } from "@/lib/utils";
import { useMobile } from "@/lib/hooks/use-mobile";

interface VisitFormProps {
  establishments: any[];
  selectedEstablishmentId?: string;
  onSaved: (newVisit?: any) => void;
  initialVisit?: {
    id: string;
    establishment_id?: string | null;
    householder_id?: string | null;
    note?: string | null;
    publisher_id?: string | null;
    partner_id?: string | null;
    publisher_guest_name?: string | null;
    partner_guest_name?: string | null;
    visit_date?: string;
  };
  // Householder context
  householderId?: string;
  householderName?: string;
  householderStatus?: string;
  // Optional prefill for note (used when creating)
  prefillNote?: string;
  disableEstablishmentSelect?: boolean;
}

export function VisitForm({ establishments, selectedEstablishmentId, onSaved, initialVisit, householderId, householderName, householderStatus, prefillNote, disableEstablishmentSelect = false }: VisitFormProps) {
  const [estId, setEstId] = useState<string>(
    selectedEstablishmentId || initialVisit?.establishment_id || establishments[0]?.id || "none"
  );
  const [householderEstablishmentId, setHouseholderEstablishmentId] = useState<string | null>(null);
  const isMobile = useMobile();

  // Fetch householder's establishment_id when householderId is provided or when editing a visit with householder_id
  useEffect(() => {
    const hhId = householderId || initialVisit?.householder_id;
    if (!hhId) {
      setHouseholderEstablishmentId(null);
      return;
    }

    const fetchHouseholderEstablishment = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.getSession();
        const { data, error } = await supabase
          .from('householders')
          .select('establishment_id')
          .eq('id', hhId)
          .single();

        if (error) throw error;
        if (data?.establishment_id) {
          setHouseholderEstablishmentId(data.establishment_id);
        } else {
          setHouseholderEstablishmentId(null);
        }
      } catch (error) {
        console.error('Error fetching householder establishment:', error);
        setHouseholderEstablishmentId(null);
      }
    };

    fetchHouseholderEstablishment();
  }, [householderId, initialVisit?.householder_id]);

  // Keep estId in sync when props change with clear priority
  useEffect(() => {
    if (selectedEstablishmentId) {
      setEstId(selectedEstablishmentId);
      return;
    }
    if (initialVisit?.establishment_id) {
      setEstId(initialVisit.establishment_id);
      return;
    }
    
    const hhId = householderId || initialVisit?.householder_id;
    if (hhId) {
      // If there's a householder, only use its establishment_id if it has one
      // If householder doesn't have establishment_id, set to "none" (don't default to first establishment)
      if (householderEstablishmentId) {
        setEstId(householderEstablishmentId);
      } else {
        setEstId("none");
      }
      return;
    }
    
    // No householder context, use first establishment or "none"
    if (establishments.length > 0) {
      setEstId(establishments[0]?.id || "none");
      return;
    }
    setEstId("none");
  }, [selectedEstablishmentId, initialVisit?.establishment_id, householderEstablishmentId, householderId, initialVisit?.householder_id, establishments]);
  
  const [note, setNote] = useState(initialVisit?.note || "");
  const [visitDate, setVisitDate] = useState<Date>(initialVisit?.visit_date ? new Date(initialVisit.visit_date) : new Date());
  const [saving, setSaving] = useState(false);
  const [participants, setParticipants] = useState<Array<{
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  }>>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // To-dos: for new call they're local until save; for edit they're loaded and synced to server
  type TodoItem = { id?: string; body: string; is_done: boolean; deadline_date?: string | null };
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [todoInput, setTodoInput] = useState("");
  const [showTodoInput, setShowTodoInput] = useState(false);
  const [todosLoaded, setTodosLoaded] = useState(false);
  const [editingTodoKey, setEditingTodoKey] = useState<string | null>(null);
  const [editingTodoDraft, setEditingTodoDraft] = useState("");
  const [addPublisherDrawerOpen, setAddPublisherDrawerOpen] = useState(false);
  const [existingGuests, setExistingGuests] = useState<string[]>([]);
  const [newGuestName, setNewGuestName] = useState("");

  type PublisherSlot = { type: "publisher"; id: string } | { type: "guest"; name: string };
  const [slots, setSlots] = useState<PublisherSlot[]>(() => {
    const from = initialVisit;
    if (!from) return [];
    const result: PublisherSlot[] = [];
    if (from.publisher_id) result.push({ type: "publisher", id: from.publisher_id });
    else if (from.publisher_guest_name?.trim()) result.push({ type: "guest", name: from.publisher_guest_name.trim() });
    if (from.partner_id) result.push({ type: "publisher", id: from.partner_id });
    else if (from.partner_guest_name?.trim()) result.push({ type: "guest", name: from.partner_guest_name.trim() });
    return result;
  });
  
  // (Removed duplicate sync effect; handled by the prioritized effect above)
  // Prefill note when creating a visit with a provided prefill
  useEffect(() => {
    if (!initialVisit?.id && prefillNote && !note) {
      setNote(prefillNote);
    }
  }, [initialVisit?.id, prefillNote]);

  // Prefill from active business filters ONLY when creating and no explicit selection
  useEffect(() => {
    if (initialVisit?.id || selectedEstablishmentId) return;
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem("business:filters:establishments");
      if (!raw) return;
      const filters = JSON.parse(raw) as any;
      if (filters && Array.isArray(filters.areas) && filters.areas.length > 0) {
        const area = filters.areas[0];
        const match = establishments.find(e => e.area === area);
        if (match?.id) {
          setEstId(match.id);
        }
      }
    } catch {}
  }, [establishments, initialVisit?.id, selectedEstablishmentId]);

  useEffect(() => {
    const loadParticipants = async () => {
      try {
        const participantsList = await getBwiParticipants();
        setParticipants(participantsList);
        const supabase = createSupabaseBrowserClient();
        const { data: profile } = await supabase.rpc('get_my_profile');
        if (profile && !initialVisit?.id) {
          setSlots((prev) => (prev.length === 0 ? [{ type: 'publisher' as const, id: profile.id }] : prev));
        }
      } catch (error) {
        console.error('[VisitForm] Error loading participants:', error);
      }
    };
    loadParticipants();
  }, []);

  useEffect(() => {
    if (!initialVisit?.id) return;
    const next: PublisherSlot[] = [];
    if (initialVisit.publisher_id) next.push({ type: 'publisher', id: initialVisit.publisher_id });
    else if (initialVisit.publisher_guest_name?.trim()) next.push({ type: 'guest', name: initialVisit.publisher_guest_name.trim() });
    if (initialVisit.partner_id) next.push({ type: 'publisher', id: initialVisit.partner_id });
    else if (initialVisit.partner_guest_name?.trim()) next.push({ type: 'guest', name: initialVisit.partner_guest_name.trim() });
    setSlots(next);
  }, [initialVisit?.id, initialVisit?.publisher_id, initialVisit?.partner_id, initialVisit?.publisher_guest_name, initialVisit?.partner_guest_name]);

  // Load to-dos when editing an existing call
  useEffect(() => {
    if (!initialVisit?.id) {
      setTodos([]);
      setTodosLoaded(true);
      return;
    }
    let cancelled = false;
    getCallTodos(initialVisit.id).then((list) => {
      if (!cancelled) {
        setTodos(list.map((t) => ({ id: t.id, body: t.body, is_done: t.is_done, deadline_date: t.deadline_date ?? null })));
        setTodosLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, [initialVisit?.id]);

  // Helper to format date as YYYY-MM-DD in local timezone (not UTC)
  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Determine establishment_id based on householder context
      let finalEstablishmentId: string | undefined;
      const hhId = householderId || initialVisit?.householder_id;
      
      if (hhId) {
        // If there's a householder, only use establishment_id if the householder has one
        // If householder doesn't have establishment_id, visit should also not have one
        finalEstablishmentId = householderEstablishmentId || undefined;
      } else {
        // No householder, use selected establishment (or none)
        finalEstablishmentId = estId === "none" ? undefined : estId || undefined;
      }

      const slot0 = slots[0];
      const slot1 = slots[1];
      const payload = { 
        establishment_id: finalEstablishmentId, 
        note: note?.trim() || null,
        visit_date: formatLocalDate(visitDate),
        publisher_id: slot0?.type === 'publisher' ? slot0.id : undefined,
        partner_id: slot1?.type === 'publisher' ? slot1.id : undefined,
        publisher_guest_name: slot0?.type === 'guest' ? slot0.name : null,
        partner_guest_name: slot1?.type === 'guest' ? slot1.name : null,
        householder_id: householderId || initialVisit?.householder_id || undefined,
      };

      if (!payload.note) {
        toast.error('Visit note is required');
        setSaving(false);
        return;
      }

      if (initialVisit?.id) {
        // Edit mode: update visit
        const ok = await updateVisit({ id: initialVisit.id, ...payload });
        if (ok) {
          await syncCallTodoParticipantsForCall(initialVisit.id, {
            publisher_id: payload.publisher_id ?? null,
            partner_id: payload.partner_id ?? null,
          });
          toast.success("Call updated.");
          onSaved({ id: initialVisit.id, ...payload });
          const publisher = payload.publisher_id ? participants.find(p => p.id === payload.publisher_id) : undefined;
          const partner = payload.partner_id ? participants.find(p => p.id === payload.partner_id) : undefined;
          businessEventBus.emit('visit-updated', {
            id: initialVisit.id,
            ...payload,
            publisher: publisher ? { id: publisher.id, first_name: publisher.first_name, last_name: publisher.last_name, avatar_url: publisher.avatar_url } : undefined,
            partner: partner ? { id: partner.id, first_name: partner.first_name, last_name: partner.last_name, avatar_url: partner.avatar_url } : undefined,
          });
        } else {
          toast.error("Failed to update call");
        }
      } else {
        // Create mode: background add
        onSaved();
        addVisit(payload)
          .then(async (created) => {
            if (created && created.id) {
              for (const t of todos) {
                await addCallTodo(created.id, t.body, t.is_done, {
                  deadline_date: t.deadline_date ?? null,
                  publisher_id: created.publisher_id ?? null,
                  partner_id: created.partner_id ?? null,
                });
              }
              const publisher = created.publisher_id ? participants.find(p => p.id === created.publisher_id) : undefined;
              const partner = created.partner_id ? participants.find(p => p.id === created.partner_id) : undefined;

              const newVisit = {
                id: created.id,
                establishment_id: created.establishment_id || (estId === "none" ? undefined : estId),
                householder_id: created.householder_id || householderId,
                note: created.note || null,
                visit_date: created.visit_date!,
                publisher_id: created.publisher_id ?? undefined,
                partner_id: created.partner_id ?? undefined,
                publisher_guest_name: created.publisher_guest_name ?? undefined,
                partner_guest_name: created.partner_guest_name ?? undefined,
                publisher: publisher ? {
                  id: publisher.id,
                  first_name: publisher.first_name,
                  last_name: publisher.last_name,
                  avatar_url: publisher.avatar_url,
                } : undefined,
                partner: partner ? {
                  id: partner.id,
                  first_name: partner.first_name,
                  last_name: partner.last_name,
                  avatar_url: partner.avatar_url,
                } : undefined,
                // Add establishment relationship if available
                establishment: estId && estId !== "none" ? establishments.find(e => e.id === estId) ? {
                  id: estId,
                  name: establishments.find(e => e.id === estId)!.name,
                  status: getBestStatus(establishments.find(e => e.id === estId)!.statuses || []) || 'for_scouting'
                } : undefined : undefined,
                // Add householder relationship if available
                householder: householderId && householderName ? {
                  id: householderId,
                  name: householderName,
                  status: householderStatus || 'potential'
                } : undefined,
              } as any;
              
              businessEventBus.emit('visit-added', newVisit);
              toast.success("Call recorded successfully!");
            } else {
              toast.error("Failed to record call");
            }
          })
          .catch((e) => {
            console.error('addVisit error', e);
            toast.error("Error recording call");
          });
      }
    } catch (error) {
      toast.error("Error saving call");
      console.error('Error saving visit:', error);
    } finally {
      setSaving(false);
    }
  };

  const getSelectedUser = (userId: string) => {
    return participants.find(p => p.id === userId);
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const addSlot = useCallback((slot: PublisherSlot) => {
    if (slots.length >= 2) return;
    if (slot.type === 'publisher' && slots.some(s => s.type === 'publisher' && s.id === slot.id)) return;
    if (slot.type === 'guest' && slots.some(s => s.type === 'guest' && s.name === slot.name)) return;
    setSlots((prev) => [...prev, slot]);
    setAddPublisherDrawerOpen(false);
    setNewGuestName("");
  }, [slots]);

  const removeSlot = useCallback((index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const availableParticipants = participants.filter(p => !slots.some(s => s.type === 'publisher' && s.id === p.id));
  const availableGuestNames = existingGuests.filter(name => !slots.some(s => s.type === 'guest' && s.name === name));

  useEffect(() => {
    if (!addPublisherDrawerOpen) return;
    getDistinctCallGuestNames().then(setExistingGuests);
  }, [addPublisherDrawerOpen]);

  const getSlotDisplayName = (slot: PublisherSlot) => {
    if (slot.type === 'publisher') {
      const user = participants.find(p => p.id === slot.id);
      return user ? `${user.first_name} ${user.last_name}` : 'Publisher';
    }
    return slot.name;
  };

  const handleAddTodo = useCallback(async () => {
    const body = todoInput.trim();
    if (!body) return;
    setTodoInput("");
    setShowTodoInput(false);
    if (initialVisit?.id) {
      const slot0 = slots[0];
      const slot1 = slots[1];
      const created = await addCallTodo(initialVisit.id, body, false, {
        deadline_date: null,
        publisher_id: slot0?.type === "publisher" ? slot0.id : null,
        partner_id: slot1?.type === "publisher" ? slot1.id : null,
      });
      if (created) setTodos((prev) => [...prev, { id: created.id, body: created.body, is_done: created.is_done, deadline_date: created.deadline_date ?? null }]);
      else toast.error("Failed to add to-do");
    } else {
      setTodos((prev) => [...prev, { body, is_done: false, deadline_date: null }]);
    }
  }, [initialVisit?.id, todoInput, slots]);

  const formatDeadlineLabel = (dateStr?: string | null) => {
    if (!dateStr) return "Deadline";
    const parsed = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return "Deadline";
    return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const handleSetTodoDeadline = async (item: TodoItem, index: number, date: Date | null) => {
    const nextDeadline = date ? formatLocalDate(date) : null;
    if (item.id) {
      const ok = await updateCallTodo(item.id, { deadline_date: nextDeadline });
      if (!ok) {
        toast.error("Failed to update deadline");
        return;
      }
      setTodos((prev) => prev.map((t) => (t.id === item.id ? { ...t, deadline_date: nextDeadline } : t)));
      return;
    }
    setTodos((prev) => prev.map((t, i) => (i === index ? { ...t, deadline_date: nextDeadline } : t)));
  };

  const handleToggleTodo = useCallback(async (item: TodoItem) => {
    const next = !item.is_done;
    if (item.id) {
      const ok = await updateCallTodo(item.id, { is_done: next });
      if (ok) setTodos((prev) => prev.map((t) => (t.id === item.id ? { ...t, is_done: next } : t)));
      else toast.error("Failed to update to-do");
    } else {
      setTodos((prev) => prev.map((t) => (t === item ? { ...t, is_done: next } : t)));
    }
  }, []);

  const handleRemoveTodo = useCallback(async (item: TodoItem) => {
    setEditingTodoKey(null);
    setEditingTodoDraft("");
    if (item.id) {
      const ok = await deleteCallTodo(item.id);
      if (ok) setTodos((prev) => prev.filter((t) => t.id !== item.id));
      else toast.error("Failed to remove to-do");
    } else {
      setTodos((prev) => prev.filter((t) => t !== item));
    }
  }, []);

  const getTodoKey = (item: TodoItem, index: number) => item.id ?? `draft-${index}`;

  const handleStartEditTodo = useCallback((item: TodoItem, index: number) => {
    setEditingTodoKey(getTodoKey(item, index));
    setEditingTodoDraft(item.body);
  }, []);

  const handleCommitEditTodo = useCallback(
    async (item: TodoItem, index: number) => {
      const key = getTodoKey(item, index);
      if (editingTodoKey !== key) return;
      const trimmed = editingTodoDraft.trim();
      setEditingTodoKey(null);
      setEditingTodoDraft("");
      if (trimmed === item.body) return;
      if (!trimmed) return;
      if (item.id) {
        const ok = await updateCallTodo(item.id, { body: trimmed });
        if (ok) setTodos((prev) => prev.map((t) => (t.id === item.id ? { ...t, body: trimmed } : t)));
        else toast.error("Failed to update to-do");
      } else {
        setTodos((prev) => prev.map((t, i) => (i === index ? { ...t, body: trimmed } : t)));
      }
    },
    [editingTodoKey, editingTodoDraft]
  );

  const handleCancelEditTodo = useCallback(() => {
    setEditingTodoKey(null);
    setEditingTodoDraft("");
  }, []);

  return (
    <form className="grid gap-3 pb-10" onSubmit={handleSubmit}>
      {householderId ? (
        <div className="grid gap-1">
          <Label>Householder</Label>
          <div className="px-3 py-2 text-sm bg-muted rounded-md">
            {householderName || 'Selected householder'}
          </div>
        </div>
      ) : (
        <div className="grid gap-1">
          <Label>Establishment</Label>
          {disableEstablishmentSelect ? (
            <div className="px-3 py-2 text-sm bg-muted rounded-md">
              {establishments.find(e => e.id === estId)?.name || 'Selected establishment'}
            </div>
          ) : (
            <Select value={estId} onValueChange={setEstId}>
              <SelectTrigger><SelectValue placeholder="Select establishment"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {establishments.map((e)=> <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
      
      <div className="grid gap-1">
        <Label>Visit Date</Label>
        <DatePicker
          date={visitDate}
          onSelect={(date) => setVisitDate(date || new Date())}
          placeholder="Select call date"
        />
      </div>

      <div className="grid gap-1">
        <Label>Publishers</Label>
        <div className="flex flex-wrap items-center gap-2">
          {slots.map((slot, index) => (
            <div key={index} className="flex items-center gap-2 bg-muted px-2 py-1.5 rounded-md">
              <Avatar className="h-6 w-6 shrink-0">
                {slot.type === "publisher" && getSelectedUser(slot.id)?.avatar_url && (
                  <AvatarImage src={getSelectedUser(slot.id)!.avatar_url} alt={getSlotDisplayName(slot)} />
                )}
                <AvatarFallback
                  className={
                    slot.type === "guest"
                      ? "text-xs bg-amber-500/25 text-amber-800 dark:bg-amber-500/30 dark:text-amber-200 ring-1 ring-amber-500/50 dark:ring-amber-400/40"
                      : "text-xs"
                  }
                >
                  {slot.type === "publisher" && getSelectedUser(slot.id)
                    ? getInitials(getSelectedUser(slot.id)!.first_name, getSelectedUser(slot.id)!.last_name)
                    : getInitialsFromName(slot.type === "guest" ? slot.name : "?")}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{getSlotDisplayName(slot)}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 shrink-0"
                onClick={() => removeSlot(index)}
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {slots.length < 2 && (
            <Drawer open={addPublisherDrawerOpen} onOpenChange={(open) => { setAddPublisherDrawerOpen(open); if (!open) setNewGuestName(""); }}>
              <DrawerTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full shrink-0"
                  aria-label="Add publisher or guest"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[70vh]">
                <DrawerHeader className="text-center">
                  <DrawerTitle>Select publisher or guest</DrawerTitle>
                </DrawerHeader>
                <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] space-y-6">
                  <section>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Publishers</h3>
                    {availableParticipants.length > 0 ? (
                      <ul className="space-y-1">
                        {availableParticipants.map((participant) => (
                          <li key={participant.id}>
                            <Button
                              type="button"
                              variant="ghost"
                              className="w-full justify-start gap-2 h-12 px-3"
                              onClick={() => addSlot({ type: "publisher", id: participant.id })}
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={participant.avatar_url} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(participant.first_name, participant.last_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span>{participant.first_name} {participant.last_name}</span>
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground py-2">No other publishers available</p>
                    )}
                  </section>
                  <section>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Guest</h3>
                    <div className="space-y-2">
                      {availableGuestNames.map((name) => (
                        <Button
                          key={name}
                          type="button"
                          variant="ghost"
                          className="w-full justify-start gap-2 h-12 px-3"
                          onClick={() => addSlot({ type: "guest", name })}
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="text-xs bg-amber-500/25 text-amber-800 dark:bg-amber-500/30 dark:text-amber-200 ring-1 ring-amber-500/50 dark:ring-amber-400/40">
                              {getInitialsFromName(name)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{name}</span>
                        </Button>
                      ))}
                      <div className="flex gap-2 pt-1">
                        <Input
                          placeholder="New guest name"
                          value={newGuestName}
                          onChange={(e) => setNewGuestName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const name = newGuestName.trim();
                              if (name) addSlot({ type: "guest", name });
                            }
                          }}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            const name = newGuestName.trim();
                            if (name) addSlot({ type: "guest", name });
                          }}
                          disabled={!newGuestName.trim()}
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  </section>
                </div>
              </DrawerContent>
            </Drawer>
          )}
        </div>
      </div>
      
      <div className="grid gap-1">
        <Label>Update Note</Label>
        <Textarea value={note} onChange={e=>setNote(e.target.value)} className="min-h-[120px]" />
      </div>

      <div className="grid gap-1 min-w-0 overflow-hidden">
        <Label>To-Do</Label>
        {todosLoaded && (
          <>
            <ul className="space-y-2 min-w-0">
              {todos.map((item, index) => {
                const todoKey = getTodoKey(item, index);
                const isEditing = editingTodoKey === todoKey;
                return (
                  <li key={todoKey} className="flex items-center gap-2 min-w-0">
                    <Checkbox
                      checked={item.is_done}
                      onCheckedChange={() => handleToggleTodo(item)}
                      aria-label={item.is_done ? "Mark not done" : "Mark done"}
                      className="shrink-0"
                    />
                    {isEditing ? (
                      <Input
                        value={editingTodoDraft}
                        onChange={(e) => setEditingTodoDraft(e.target.value)}
                        onBlur={() => {
                          const t = editingTodoDraft.trim();
                          if (t) handleCommitEditTodo(item, index);
                          else handleCancelEditTodo();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const t = editingTodoDraft.trim();
                            if (t) handleCommitEditTodo(item, index);
                            else handleCancelEditTodo();
                          }
                          if (e.key === "Escape") {
                            e.preventDefault();
                            handleCancelEditTodo();
                          }
                        }}
                        className="flex-1 min-w-0 h-8 text-sm"
                        autoFocus
                        aria-label="Edit to-do"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleStartEditTodo(item, index)}
                        className={cn(
                          "flex-1 text-sm min-w-0 truncate text-left py-1 rounded hover:bg-muted/50 active:bg-muted transition-colors",
                          item.is_done && "text-muted-foreground line-through"
                        )}
                      >
                        {item.body}
                      </button>
                    )}
                    <DatePicker
                      date={item.deadline_date ? new Date(`${item.deadline_date}T00:00:00`) : undefined}
                      onSelect={(date) => {
                        void handleSetTodoDeadline(item, index, date ?? null);
                      }}
                      placeholder={formatDeadlineLabel(item.deadline_date)}
                      className="w-auto h-7 min-w-[98px] px-2 text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleRemoveTodo(item)}
                      aria-label="Remove to-do"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </li>
                );
              })}
            </ul>
            {showTodoInput ? (
              <div className="flex gap-2 mt-2 min-w-0">
                <Input
                  value={todoInput}
                  onChange={(e) => setTodoInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleAddTodo(); }
                    if (e.key === "Escape") { setShowTodoInput(false); setTodoInput(""); }
                  }}
                  placeholder="To-do..."
                  className="flex-1 min-w-0"
                  autoFocus
                />
                <Button type="button" variant="secondary" size="sm" onClick={handleAddTodo} disabled={!todoInput.trim()} className="shrink-0">
                  Add
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setShowTodoInput(false); setTodoInput(""); }} className="shrink-0">
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 gap-1 w-fit"
                onClick={() => setShowTodoInput(true)}
              >
                <Plus className="h-4 w-4" />
                Add to-do
              </Button>
            )}
          </>
        )}
      </div>

      <div className="flex justify-between py-4">
        {initialVisit?.id ? (
          <Popover open={confirmOpen} onOpenChange={setConfirmOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="destructive" disabled={saving}>Delete</Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="start">
              <div className="space-y-3">
                <p className="text-sm">Delete this call?</p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={saving}
                    onClick={async () => {
                      if (!initialVisit?.id) return;
                      setSaving(true);
                      try {
                        const ok = await deleteVisit(initialVisit.id);
                        if (ok) {
                          businessEventBus.emit('visit-deleted', { id: initialVisit.id });
                          toast.success('Visit deleted');
                          setConfirmOpen(false);
                          onSaved();
                        } else {
                          toast.error('Failed to delete visit');
                        }
                      } finally {
                        setSaving(false);
                      }
                    }}
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        ) : <span />}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : (initialVisit?.id ? 'Update' : 'Save')}
        </Button>
      </div>
    </form>
  );
}
