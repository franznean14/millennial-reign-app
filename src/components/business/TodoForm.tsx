"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Plus, Calendar, Users, FileText, Link2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerThinRightContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { getStudyBibleDarkCardShade } from "@/lib/theme/study-bible-dark";
import { sidebarFormClasses } from "@/components/business/sidebar-form-styles";
import {
  getBwiParticipants,
  addStandaloneTodo,
  updateStandaloneTodo,
  deleteCallTodo,
  getDistinctCallGuestNames,
} from "@/lib/db/business";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getInitialsFromName } from "@/lib/utils/visit-history-ui";
import { useMediaQuery } from "@/hooks/use-media-query";

type PublisherSlot = { type: "publisher"; id: string } | { type: "guest"; name: string };
const PARTICIPANTS_CACHE_KEY = "business:participants:local:v1";
const GUEST_NAMES_CACHE_KEY = "business:guest-names:local:v1";

/** Quick-fill buttons for common establishment to-dos; tablet uses a 3-column layout. */
const NEW_TODO_BODY_PRESETS = [
  { label: "Replenish", body: "Replenish" },
  { label: "Follow Up", body: "Follow up" },
  { label: "Proposal", body: "Proposal" },
] as const;

interface TodoFormProps {
  /** Same as CallForm: list of establishments (id optional for type compatibility with EstablishmentWithDetails[]) */
  establishments: Array<{ id?: string; name: string }>;
  selectedEstablishmentId?: string;
  householderId?: string;
  householderName?: string;
  initialTodo?: {
    id: string;
    call_id?: string | null;
    body?: string | null;
    deadline_date?: string | null;
    publisher_id?: string | null;
    partner_id?: string | null;
    publisher_guest_name?: string | null;
    partner_guest_name?: string | null;
    establishment_id?: string | null;
    householder_id?: string | null;
    call_note?: string | null;
    call_visit_date?: string | null;
    call_publishers?: string[];
  } | null;
  onSaved: () => void;
  disableEstablishmentSelect?: boolean;
}

export function TodoForm({
  establishments,
  selectedEstablishmentId,
  householderId,
  householderName,
  initialTodo,
  onSaved,
  disableEstablishmentSelect = false,
}: TodoFormProps) {
  const [estId, setEstId] = useState<string>(
    selectedEstablishmentId || (establishments[0]?.id as string) || "none"
  );
  const [householderEstablishmentId, setHouseholderEstablishmentId] = useState<string | null>(null);
  const [body, setBody] = useState(initialTodo?.body ?? "");
  const [deadlineDate, setDeadlineDate] = useState<Date | null>(
    initialTodo?.deadline_date ? new Date(initialTodo.deadline_date) : null
  );
  const [saving, setSaving] = useState(false);
  const usePublisherSidebar = useMediaQuery("(min-width: 768px)");
  const bwiTodoFormScope = householderId ?? initialTodo?.id ?? selectedEstablishmentId ?? "new-todo";
  const publisherPickerShade = useMemo(
    () => getStudyBibleDarkCardShade(`bwi-todoform-publishers:${bwiTodoFormScope}`),
    [bwiTodoFormScope]
  );
  const [participants, setParticipants] = useState<
    Array<{ id: string; first_name: string; last_name: string; avatar_url?: string }>
  >([]);
  const [addPublisherDrawerOpen, setAddPublisherDrawerOpen] = useState(false);
  const [existingGuests, setExistingGuests] = useState<string[]>([]);
  const [newGuestName, setNewGuestName] = useState("");

  const [slots, setSlots] = useState<PublisherSlot[]>(() => {
    const next: PublisherSlot[] = [];
    if (initialTodo?.publisher_id) next.push({ type: "publisher", id: initialTodo.publisher_id });
    else if (initialTodo?.publisher_guest_name?.trim()) next.push({ type: "guest", name: initialTodo.publisher_guest_name.trim() });
    if (initialTodo?.partner_id) next.push({ type: "publisher", id: initialTodo.partner_id });
    else if (initialTodo?.partner_guest_name?.trim()) next.push({ type: "guest", name: initialTodo.partner_guest_name.trim() });
    return next;
  });

  useEffect(() => {
    if (householderId) {
      const fetchHouseholderEstablishment = async () => {
        try {
          const supabase = createSupabaseBrowserClient();
          await supabase.auth.getSession();
          const { data, error } = await supabase
            .from("householders")
            .select("establishment_id")
            .eq("id", householderId)
            .single();
          if (error) throw error;
          setHouseholderEstablishmentId(data?.establishment_id ?? null);
        } catch {
          setHouseholderEstablishmentId(null);
        }
      };
      fetchHouseholderEstablishment();
    } else {
      setHouseholderEstablishmentId(null);
    }
  }, [householderId]);

  useEffect(() => {
    if (selectedEstablishmentId) {
      setEstId(selectedEstablishmentId);
      return;
    }
    if (initialTodo?.establishment_id) {
      setEstId(initialTodo.establishment_id);
      return;
    }
    if (householderId && householderEstablishmentId) {
      setEstId(householderEstablishmentId);
      return;
    }
    if (establishments.length > 0 && establishments[0]?.id) {
      setEstId(establishments[0].id);
    } else if (establishments.length > 0) {
      setEstId("none");
    } else {
      setEstId("none");
    }
  }, [selectedEstablishmentId, initialTodo?.establishment_id, householderEstablishmentId, householderId, establishments]);

  useEffect(() => {
    if (!initialTodo) return;
    setBody(initialTodo.body ?? "");
    setDeadlineDate(initialTodo.deadline_date ? new Date(initialTodo.deadline_date) : null);
    const next: PublisherSlot[] = [];
    if (initialTodo.publisher_id) next.push({ type: "publisher", id: initialTodo.publisher_id });
    else if (initialTodo.publisher_guest_name?.trim()) next.push({ type: "guest", name: initialTodo.publisher_guest_name.trim() });
    if (initialTodo.partner_id) next.push({ type: "publisher", id: initialTodo.partner_id });
    else if (initialTodo.partner_guest_name?.trim()) next.push({ type: "guest", name: initialTodo.partner_guest_name.trim() });
    setSlots(next);
  }, [initialTodo]);

  useEffect(() => {
    const loadParticipants = async () => {
      try {
        const cachedRaw = window.localStorage.getItem(PARTICIPANTS_CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as {
            items?: Array<{ id: string; first_name: string; last_name: string; avatar_url?: string }>;
          };
          if (Array.isArray(cached?.items) && cached.items.length > 0) {
            setParticipants(
              cached.items.filter(
                (item): item is { id: string; first_name: string; last_name: string; avatar_url?: string } =>
                  typeof item?.id === "string"
              )
            );
          }
        }
        const list = await getBwiParticipants();
        setParticipants(list);
        window.localStorage.setItem(PARTICIPANTS_CACHE_KEY, JSON.stringify({ items: list }));
        const supabase = createSupabaseBrowserClient();
        const { data: profile } = await supabase.rpc("get_my_profile");
        if (!initialTodo && profile && slots.length === 0) {
          setSlots([{ type: "publisher", id: profile.id }]);
        }
      } catch (error) {
        console.error("[TodoForm] Error loading participants:", error);
      }
    };
    loadParticipants();
  }, [initialTodo, slots.length]);

  useEffect(() => {
    if (!addPublisherDrawerOpen) return;
    try {
      const cachedRaw = window.localStorage.getItem(GUEST_NAMES_CACHE_KEY);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as { names?: string[] };
        if (Array.isArray(cached?.names)) {
          setExistingGuests(
            Array.from(
              new Set(
                cached.names
                  .map((value) => (typeof value === "string" ? value.trim() : ""))
                  .filter((value) => value.length > 0)
              )
            )
          );
        }
      }
    } catch {}
    getDistinctCallGuestNames().then((names) => {
      const normalized = Array.from(
        new Set(
          names
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter((value) => value.length > 0)
        )
      );
      setExistingGuests(normalized);
      try {
        window.localStorage.setItem(GUEST_NAMES_CACHE_KEY, JSON.stringify({ names: normalized }));
      } catch {}
    });
  }, [addPublisherDrawerOpen]);

  const formatLocalDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) {
      toast.error("To-do is required");
      return;
    }
    setSaving(true);
    try {
      const slot0 = slots[0];
      const slot1 = slots[1];
      const establishmentId = estId === "none" ? undefined : estId;
      if (initialTodo?.id) {
        const ok = await updateStandaloneTodo(initialTodo.id, {
          body: trimmed,
          deadline_date: deadlineDate ? formatLocalDate(deadlineDate) : null,
          publisher_id: slot0?.type === "publisher" ? slot0.id : null,
          partner_id: slot1?.type === "publisher" ? slot1.id : null,
          publisher_guest_name: slot0?.type === "guest" ? slot0.name : null,
          partner_guest_name: slot1?.type === "guest" ? slot1.name : null,
        });
        if (ok) {
          toast.success("To-do updated.");
          onSaved();
        } else {
          toast.error("Failed to update to-do");
        }
      } else {
        const todo = await addStandaloneTodo({
          establishment_id: establishmentId || null,
          householder_id: householderId || null,
          body: trimmed,
          deadline_date: deadlineDate ? formatLocalDate(deadlineDate) : null,
          publisher_id: slot0?.type === "publisher" ? slot0.id : null,
          partner_id: slot1?.type === "publisher" ? slot1.id : null,
          publisher_guest_name: slot0?.type === "guest" ? slot0.name : null,
          partner_guest_name: slot1?.type === "guest" ? slot1.name : null,
        });
        if (todo) {
          toast.success("To-do added.");
          onSaved();
        } else {
          toast.error("Failed to add to-do");
        }
      }
    } catch {
      toast.error("Error saving to-do");
    } finally {
      setSaving(false);
    }
  };

  const getSelectedUser = (userId: string) =>
    participants.find((p) => p.id === userId);

  const getInitials = (firstName: string, lastName: string) =>
    `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

  const addSlot = useCallback((slot: PublisherSlot) => {
    setSlots((prev) => {
      if (prev.length >= 2) return prev;
      if (
        slot.type === "publisher" &&
        prev.some((s) => s.type === "publisher" && s.id === slot.id)
      )
        return prev;
      if (
        slot.type === "guest" &&
        prev.some((s) => s.type === "guest" && s.name === slot.name)
      )
        return prev;
      return [...prev, slot];
    });
    if (slot.type === "guest") {
      setExistingGuests((prev) => {
        const next = Array.from(new Set([...prev, slot.name.trim()])).filter((value) => value.length > 0);
        try {
          window.localStorage.setItem(GUEST_NAMES_CACHE_KEY, JSON.stringify({ names: next }));
        } catch {}
        return next;
      });
    }
    setAddPublisherDrawerOpen(false);
    setNewGuestName("");
  }, []);

  const removeSlot = useCallback((index: number) => {
    setSlots((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const availableParticipants = participants.filter(
    (p) => !slots.some((s) => s.type === "publisher" && s.id === p.id)
  );
  const availableGuestNames = existingGuests.filter(
    (name) => !slots.some((s) => s.type === "guest" && s.name === name)
  );

  const getSlotDisplayName = (slot: PublisherSlot) => {
    if (slot.type === "publisher") {
      const user = participants.find((p) => p.id === slot.id);
      return user ? `${user.first_name} ${user.last_name}` : "Publisher";
    }
    return slot.name;
  };

  const publisherPickerContent = (
    <>
      <DrawerHeader className="bg-transparent pb-3 pt-4 text-center md:pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)]">
        <DrawerTitle className="text-center text-lg font-bold">Select publisher or guest</DrawerTitle>
      </DrawerHeader>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-4">
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground dark:text-[#ded6e7]/75">
            Publishers
          </h3>
          {availableParticipants.length > 0 ? (
            <ul className="space-y-1">
              {availableParticipants.map((participant) => (
                <li key={participant.id}>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-12 w-full justify-start gap-2 px-3 dark:text-[#fffaff] dark:hover:bg-[#3b3348]"
                    onClick={() => addSlot({ type: "publisher", id: participant.id })}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={participant.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {getInitials(participant.first_name, participant.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span>
                      {participant.first_name} {participant.last_name}
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-2 text-sm text-muted-foreground dark:text-[#ded6e7]/75">
              No other publishers available
            </p>
          )}
        </section>
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground dark:text-[#ded6e7]/75">
            Guest
          </h3>
          <div className="space-y-2">
            {availableGuestNames.map((name) => (
              <Button
                key={name}
                type="button"
                variant="ghost"
                className="h-12 w-full justify-start gap-2 px-3 dark:text-[#fffaff] dark:hover:bg-[#3b3348]"
                onClick={() => addSlot({ type: "guest", name })}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="text-xs bg-amber-500/25 text-amber-800 ring-1 ring-amber-500/50 dark:bg-amber-500/30 dark:text-amber-200 dark:ring-amber-400/40">
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
                className={cn("flex-1", sidebarFormClasses.input)}
              />
              <Button
                type="button"
                size="sm"
                className={sidebarFormClasses.primaryButton}
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
    </>
  );

  return (
    <form
      className={cn("grid gap-3 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]", sidebarFormClasses.form)}
      onSubmit={handleSubmit}
    >
      {initialTodo?.call_id ? (
        <div className={cn("space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3", sidebarFormClasses.panel)}>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Linked Call To-Do</span>
          </div>
          {initialTodo.call_visit_date ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>
                {new Date(`${initialTodo.call_visit_date}T00:00:00`).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          ) : null}
          {slots.length > 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              <div className="inline-flex items-center gap-1.5">
                {slots.slice(0, 2).map((slot, index) => {
                  const profile = slot.type === "publisher" ? getSelectedUser(slot.id) : null;
                  const fullName =
                    slot.type === "publisher"
                      ? profile
                        ? `${profile.first_name} ${profile.last_name}`.trim()
                        : "Publisher"
                      : slot.name;
                  return (
                    <Avatar key={`${slot.type}-${slot.type === "publisher" ? slot.id : slot.name}-${index}`} className="h-6 w-6 border border-border/70">
                      {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={fullName} /> : null}
                      <AvatarFallback
                        className={slot.type === "guest" ? "text-[10px] bg-amber-500/25 text-amber-800 dark:bg-amber-500/30 dark:text-amber-200" : "text-[10px]"}
                        title={fullName}
                      >
                        {slot.type === "publisher" && profile
                          ? getInitials(profile.first_name, profile.last_name)
                          : getInitialsFromName(fullName || "P")}
                      </AvatarFallback>
                    </Avatar>
                  );
                })}
              </div>
            </div>
          ) : null}
          {initialTodo.call_note?.trim() ? (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span className="line-clamp-3">{initialTodo.call_note.trim()}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {householderId ? (
        <div className="grid gap-1">
          <Label className={sidebarFormClasses.label}>Householder</Label>
          <div className={cn("rounded-md px-3 py-2", sidebarFormClasses.staticField)}>
            {householderName || "Selected householder"}
          </div>
        </div>
      ) : (
        <div className="grid gap-1">
          <Label className={sidebarFormClasses.label}>Establishment</Label>
          {disableEstablishmentSelect ? (
            <div className={cn("rounded-md px-3 py-2", sidebarFormClasses.staticField)}>
              {establishments.find((e) => e.id === estId)?.name || "Selected establishment"}
            </div>
          ) : (
            <Select value={estId} onValueChange={setEstId}>
              <SelectTrigger className={sidebarFormClasses.selectTrigger}>
                <SelectValue placeholder="Select establishment" />
              </SelectTrigger>
                <SelectContent className={sidebarFormClasses.selectContent}>
                <SelectItem value="none">None</SelectItem>
                {establishments.filter((e): e is { id: string; name: string } => !!e.id).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      <div className="grid gap-1">
        <Label className={sidebarFormClasses.label}>Deadline (optional)</Label>
        <DatePicker
          date={deadlineDate ?? undefined}
          onSelect={(date) => setDeadlineDate(date ?? null)}
          placeholder="Deadline date"
          className={sidebarFormClasses.button}
          mobileShowActions
          mobileAllowClear
          defaultToTodayOnOpen
        />
      </div>

      <div className="grid gap-1">
        <Label className={sidebarFormClasses.label}>Publishers</Label>
        <div className="flex flex-wrap items-center gap-2">
          {slots.map((slot, index) => (
            <div
              key={index}
              className={cn("flex items-center gap-2 rounded-md px-2 py-1.5", sidebarFormClasses.chip)}
            >
              <Avatar className="h-6 w-6 shrink-0">
                {slot.type === "publisher" && getSelectedUser(slot.id)?.avatar_url && (
                  <AvatarImage
                    src={getSelectedUser(slot.id)!.avatar_url}
                    alt={getSlotDisplayName(slot)}
                  />
                )}
                <AvatarFallback
                  className={
                    slot.type === "guest"
                      ? "text-xs bg-amber-500/25 text-amber-800 dark:bg-amber-500/30 dark:text-amber-200 ring-1 ring-amber-500/50 dark:ring-amber-400/40"
                      : "text-xs"
                  }
                >
                  {slot.type === "publisher" && getSelectedUser(slot.id)
                    ? getInitials(
                        getSelectedUser(slot.id)!.first_name,
                        getSelectedUser(slot.id)!.last_name
                      )
                    : getInitialsFromName(
                        slot.type === "guest" ? slot.name : "?"
                      )}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{getSlotDisplayName(slot)}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 shrink-0 p-0 dark:text-[#ded6e7] dark:hover:bg-[#3b3348]"
                onClick={() => removeSlot(index)}
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {slots.length < 2 && (
            <Drawer
              open={addPublisherDrawerOpen}
              onOpenChange={(open) => {
                setAddPublisherDrawerOpen(open);
                if (!open) setNewGuestName("");
              }}
              {...(usePublisherSidebar
                ? { direction: "right" as const, modal: true, nested: true, shouldScaleBackground: false }
                : {})}
            >
              <DrawerTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className={cn("h-9 w-9 shrink-0 rounded-full", sidebarFormClasses.button)}
                  aria-label="Add publisher or guest"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DrawerTrigger>
              {usePublisherSidebar ? (
                <DrawerThinRightContent
                  className={cn("dark:border-[#1c1921] dark:text-[#fffaff]", publisherPickerShade)}
                >
                  {publisherPickerContent}
                </DrawerThinRightContent>
              ) : (
                <DrawerContent className={cn("max-h-[70vh]", sidebarFormClasses.popover)}>
                  {publisherPickerContent}
                </DrawerContent>
              )}
            </Drawer>
          )}
        </div>
      </div>

      <div className="grid gap-1">
        <Label className={sidebarFormClasses.label}>To-do</Label>
        {!initialTodo?.id ? (
          <div
            className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-3"
            role="group"
            aria-label="Common to-do presets"
          >
            {NEW_TODO_BODY_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="outline"
                className={cn(
                  "h-auto min-h-10 w-full justify-center px-2 py-2.5 text-center text-sm font-medium leading-tight",
                  sidebarFormClasses.button,
                  body.trim() === preset.body ? "ring-1 ring-[#80778e]/80 dark:ring-[#80778e]/90" : ""
                )}
                onClick={() => setBody(preset.body)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        ) : null}
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className={cn("min-h-[120px]", sidebarFormClasses.textarea)}
          placeholder="What needs to be done?"
        />
      </div>

      <div className="flex justify-end py-4">
        <div className="flex w-full items-center justify-between">
          {initialTodo?.id ? (
            <Button
              type="button"
              variant="destructive"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const ok = await deleteCallTodo(initialTodo.id);
                  if (ok) {
                    toast.success("To-do deleted.");
                    try {
                      window.dispatchEvent(
                        new CustomEvent("business-todos-mutated", {
                          detail: { kind: "delete", todoId: initialTodo.id } satisfies {
                            kind: "delete";
                            todoId: string;
                          },
                        })
                      );
                      window.dispatchEvent(new CustomEvent("app-business-refresh"));
                    } catch {
                      /* ignore */
                    }
                    onSaved();
                  } else {
                    toast.error("Failed to delete to-do");
                  }
                } finally {
                  setSaving(false);
                }
              }}
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" className={sidebarFormClasses.primaryButton} disabled={saving}>
            {saving ? "Saving..." : initialTodo?.id ? "Update" : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}
