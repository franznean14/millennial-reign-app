"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Plus } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { toast } from "@/components/ui/sonner";
import {
  getBwiParticipants,
  addStandaloneTodo,
  updateStandaloneTodo,
  deleteCallTodo,
  getDistinctCallGuestNames,
} from "@/lib/db/business";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getInitialsFromName } from "@/lib/utils/visit-history-ui";

type PublisherSlot = { type: "publisher"; id: string } | { type: "guest"; name: string };

interface TodoFormProps {
  /** Same as VisitForm: list of establishments (id optional for type compatibility with EstablishmentWithDetails[]) */
  establishments: Array<{ id?: string; name: string }>;
  selectedEstablishmentId?: string;
  householderId?: string;
  householderName?: string;
  initialTodo?: {
    id: string;
    body?: string | null;
    deadline_date?: string | null;
    publisher_id?: string | null;
    partner_id?: string | null;
    establishment_id?: string | null;
    householder_id?: string | null;
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
  const [participants, setParticipants] = useState<
    Array<{ id: string; first_name: string; last_name: string; avatar_url?: string }>
  >([]);
  const [addPublisherDrawerOpen, setAddPublisherDrawerOpen] = useState(false);
  const [existingGuests, setExistingGuests] = useState<string[]>([]);
  const [newGuestName, setNewGuestName] = useState("");

  const [slots, setSlots] = useState<PublisherSlot[]>(() => {
    const next: PublisherSlot[] = [];
    if (initialTodo?.publisher_id) next.push({ type: "publisher", id: initialTodo.publisher_id });
    if (initialTodo?.partner_id) next.push({ type: "publisher", id: initialTodo.partner_id });
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
    if (initialTodo.partner_id) next.push({ type: "publisher", id: initialTodo.partner_id });
    setSlots(next);
  }, [initialTodo]);

  useEffect(() => {
    const loadParticipants = async () => {
      try {
        const list = await getBwiParticipants();
        setParticipants(list);
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
    getDistinctCallGuestNames().then(setExistingGuests);
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

  return (
    <form
      className="grid gap-3 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]"
      onSubmit={handleSubmit}
    >
      {householderId ? (
        <div className="grid gap-1">
          <Label>Householder</Label>
          <div className="px-3 py-2 text-sm bg-muted rounded-md">
            {householderName || "Selected householder"}
          </div>
        </div>
      ) : (
        <div className="grid gap-1">
          <Label>Establishment</Label>
          {disableEstablishmentSelect ? (
            <div className="px-3 py-2 text-sm bg-muted rounded-md">
              {establishments.find((e) => e.id === estId)?.name || "Selected establishment"}
            </div>
          ) : (
            <Select value={estId} onValueChange={setEstId}>
              <SelectTrigger>
                <SelectValue placeholder="Select establishment" />
              </SelectTrigger>
                <SelectContent>
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
        <Label>Deadline (optional)</Label>
        <DatePicker
          date={deadlineDate ?? undefined}
          onSelect={(date) => setDeadlineDate(date ?? null)}
          placeholder="Deadline date"
          mobileShowActions
          mobileAllowClear
        />
      </div>

      <div className="grid gap-1">
        <Label>Publishers</Label>
        <div className="flex flex-wrap items-center gap-2">
          {slots.map((slot, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-muted px-2 py-1.5 rounded-md"
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
                className="h-6 w-6 p-0 shrink-0"
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
            >
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
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Publishers
                    </h3>
                    {availableParticipants.length > 0 ? (
                      <ul className="space-y-1">
                        {availableParticipants.map((participant) => (
                          <li key={participant.id}>
                            <Button
                              type="button"
                              variant="ghost"
                              className="w-full justify-start gap-2 h-12 px-3"
                              onClick={() =>
                                addSlot({ type: "publisher", id: participant.id })
                              }
                            >
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={participant.avatar_url} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(
                                    participant.first_name,
                                    participant.last_name
                                  )}
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
                      <p className="text-sm text-muted-foreground py-2">
                        No other publishers available
                      </p>
                    )}
                  </section>
                  <section>
                    <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Guest
                    </h3>
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
        <Label>To-do</Label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="min-h-[120px]"
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
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : initialTodo?.id ? "Update" : "Save"}
          </Button>
        </div>
      </div>
    </form>
  );
}
