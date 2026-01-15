"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/sonner";
import { addVisit, getBwiParticipants, updateVisit, deleteVisit } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getBestStatus } from "@/lib/utils/status-hierarchy";
import { cacheGet } from "@/lib/offline/store";
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
  const isMobile = useMobile();

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
    if (establishments.length > 0) {
      setEstId(establishments[0]?.id || "none");
      return;
    }
    setEstId("none");
  }, [selectedEstablishmentId, initialVisit?.establishment_id, establishments]);
  
  // Ensure partner shows immediately even if participants have not loaded yet
  useEffect(() => {
    if (!initialVisit?.id) return;
    const next: string[] = [];
    if (initialVisit.publisher_id) next.push(initialVisit.publisher_id);
    if (initialVisit.partner_id && initialVisit.partner_id !== initialVisit.publisher_id) next.push(initialVisit.partner_id);
    setPublishers(next);
  }, [initialVisit?.id, initialVisit?.publisher_id, initialVisit?.partner_id]);
  const [note, setNote] = useState(initialVisit?.note || "");
  const [visitDate, setVisitDate] = useState<Date>(initialVisit?.visit_date ? new Date(initialVisit.visit_date) : new Date());
  const [saving, setSaving] = useState(false);
  const [publishers, setPublishers] = useState<string[]>(() => {
    const initial: string[] = [];
    if (initialVisit?.publisher_id) initial.push(initialVisit.publisher_id);
    if (initialVisit?.partner_id && initialVisit.partner_id !== initialVisit.publisher_id) initial.push(initialVisit.partner_id);
    return initial;
  });
  const [participants, setParticipants] = useState<Array<{
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  }>>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  
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
    (async () => {
      try {
        const filters = await cacheGet<any>("business:filters");
        if (filters && Array.isArray(filters.areas) && filters.areas.length > 0) {
          const area = filters.areas[0];
          const match = establishments.find(e => e.area === area);
          if (match?.id) {
            setEstId(match.id);
          }
        }
      } catch {}
    })();
  }, [establishments, initialVisit?.id, selectedEstablishmentId]);

  useEffect(() => {
    const loadParticipants = async () => {
      try {
        const participantsList = await getBwiParticipants();
        setParticipants(participantsList);
        
        const supabase = createSupabaseBrowserClient();
        const { data: profile } = await supabase.rpc('get_my_profile');
        if (profile && (!initialVisit || publishers.length === 0)) {
          const currentUserData = participantsList.find(p => p.id === profile.id);
          if (currentUserData) {
            setPublishers([currentUserData.id]);
          }
        }
      } catch (error) {
        console.error('Error loading participants:', error);
      }
    };
    
    loadParticipants();
  }, []);

  // Sync publishers when editing a specific visit (ensures partner pre-fills)
  useEffect(() => {
    if (initialVisit?.id) {
      const next: string[] = [];
      if (initialVisit.publisher_id) next.push(initialVisit.publisher_id);
      if (initialVisit.partner_id && initialVisit.partner_id !== initialVisit.publisher_id) next.push(initialVisit.partner_id);
      setPublishers(next);
    }
  }, [initialVisit?.id, initialVisit?.publisher_id, initialVisit?.partner_id]);
  
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
      const payload = { 
        establishment_id: estId === "none" ? undefined : estId || undefined, 
        note: note?.trim() || null,
        visit_date: formatLocalDate(visitDate),
        publisher_id: publishers[0] || undefined,
        partner_id: publishers[1] || undefined,
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
          toast.success("Visit updated.");
          onSaved({ id: initialVisit.id, ...payload });
          const publisherId = payload.publisher_id;
          const partnerId = payload.partner_id;
          const publisher = publisherId ? participants.find(p => p.id === publisherId) : undefined;
          const partner = partnerId ? participants.find(p => p.id === partnerId) : undefined;
          businessEventBus.emit('visit-updated', {
            id: initialVisit.id,
            ...payload,
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
          });
        } else {
          toast.error("Failed to update visit");
        }
      } else {
        // Create mode: background add
        onSaved();
        addVisit(payload)
          .then((created) => {
            if (created && created.id) {
              const publisherId = created.publisher_id || (publishers[0] || undefined);
              const partnerId = created.partner_id || (publishers[1] || undefined);
              const publisher = publisherId ? participants.find(p => p.id === publisherId) : undefined;
              const partner = partnerId ? participants.find(p => p.id === partnerId) : undefined;

              const newVisit = {
                id: created.id,
                establishment_id: created.establishment_id || (estId === "none" ? undefined : estId),
                householder_id: created.householder_id || householderId,
                note: created.note || null,
                visit_date: created.visit_date!,
                publisher_id: publisherId,
                partner_id: partnerId,
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
              toast.success("Visit recorded successfully!");
            } else {
              toast.error("Failed to record visit");
            }
          })
          .catch((e) => {
            console.error('addVisit error', e);
            toast.error("Error recording visit");
          });
      }
    } catch (error) {
      toast.error("Error saving visit");
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

  const addPublisher = (userId: string) => {
    if (publishers.length < 2 && !publishers.includes(userId)) {
      setPublishers([...publishers, userId]);
    }
  };

  const removePublisher = (userId: string) => {
    setPublishers(publishers.filter(id => id !== userId));
  };

  const availableParticipants = participants.filter(p => !publishers.includes(p.id));
  
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
          placeholder="Select visit date"
        />
      </div>

      <div className="grid gap-1">
        <Label>Publishers ({publishers.length}/2)</Label>
        
        <div className="flex flex-wrap gap-2 mb-2">
          {publishers.map((publisherId, index) => {
            const user = getSelectedUser(publisherId);
            return (
              <div key={publisherId || index} className="flex items-center gap-2 bg-muted px-2 py-1 rounded-md">
                <Avatar className="h-6 w-6">
                  {user?.avatar_url && <AvatarImage src={user.avatar_url} />}
                  <AvatarFallback className="text-xs">
                    {user ? getInitials(user.first_name, user.last_name) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">
                  {user ? `${user.first_name} ${user.last_name}` : 'Publisher'}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0"
                  onClick={() => removePublisher(publisherId)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>

        {publishers.length < 2 && (
          <Select onValueChange={addPublisher}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Add publisher" /></SelectTrigger>
            <SelectContent>
              {availableParticipants.length > 0 ? (
                availableParticipants.map((participant) => (
                  <SelectItem key={participant.id} value={participant.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={participant.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {getInitials(participant.first_name, participant.last_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{participant.first_name} {participant.last_name}</span>
                    </div>
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-participants" disabled>
                  No participants available
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        )}
      </div>
      
      <div className="grid gap-1">
        <Label>Update Note</Label>
        <Textarea value={note} onChange={e=>setNote(e.target.value)} className="min-h-[120px]" />
      </div>
      <div className="flex justify-between py-4">
        {initialVisit?.id ? (
          <Popover open={confirmOpen} onOpenChange={setConfirmOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="destructive" disabled={saving}>Delete</Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="start">
              <div className="space-y-3">
                <p className="text-sm">Delete this visit update?</p>
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
