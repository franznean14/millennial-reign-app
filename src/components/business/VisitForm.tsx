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
import { cacheGet } from "@/lib/offline/store";

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
}

export function VisitForm({ establishments, selectedEstablishmentId, onSaved, initialVisit }: VisitFormProps) {
  const [estId, setEstId] = useState<string>(
    initialVisit?.establishment_id || selectedEstablishmentId || establishments[0]?.id || "none"
  );
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
  
  useEffect(() => {
    if (selectedEstablishmentId) {
      setEstId(selectedEstablishmentId);
    } else if (establishments.length > 0) {
      setEstId(establishments[0]?.id || "none");
    }
  }, [selectedEstablishmentId, establishments]);

  // Prefill from active business filters (status not relevant; prefill area via establishment if possible)
  useEffect(() => {
    (async () => {
      try {
        const filters = await cacheGet<any>("business:filters");
        if (filters && Array.isArray(filters.areas) && filters.areas.length > 0) {
          const area = filters.areas[0];
          // If there is an establishment list, pick one that matches the area
          const match = establishments.find(e => e.area === area);
          if (match?.id) {
            setEstId(match.id);
          }
        }
      } catch {}
    })();
  }, [establishments]);

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
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { 
        establishment_id: estId === "none" ? undefined : estId || undefined, 
        note: note||null,
        visit_date: visitDate.toISOString().split('T')[0],
        publisher_id: publishers[0] || undefined,
        partner_id: publishers[1] || undefined
      };

      if (initialVisit?.id) {
        // Edit mode: update visit
        const ok = await updateVisit({ id: initialVisit.id, ...payload });
        if (ok) {
          toast.success("Visit updated.");
          onSaved({ id: initialVisit.id, ...payload });
          businessEventBus.emit('visit-updated', { id: initialVisit.id, ...payload });
        } else {
          toast.error("Failed to update visit");
        }
      } else {
        // Create mode: background add
        onSaved();
        addVisit(payload)
          .then((ok) => {
            if (ok) {
              const newVisit = {
                id: `temp-${Date.now()}`,
                establishment_id: estId === "none" ? undefined : estId,
                note: note || null,
                visit_date: payload.visit_date!,
                publisher_id: publishers[0] || undefined,
                partner_id: publishers[1] || undefined,
              };
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
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <div className="grid gap-1">
        <Label>Establishment (optional)</Label>
        <Select value={estId} onValueChange={setEstId}>
          <SelectTrigger><SelectValue placeholder="Select establishment"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {establishments.map((e)=> <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      
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
          {publishers.map((publisherId) => {
            const user = getSelectedUser(publisherId);
            return user ? (
              <div key={publisherId} className="flex items-center gap-2 bg-muted px-2 py-1 rounded-md">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="text-xs">
                    {getInitials(user.first_name, user.last_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{user.first_name} {user.last_name}</span>
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
            ) : null;
          })}
        </div>

        {publishers.length < 2 && (
          <Select onValueChange={addPublisher}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Add publisher" />
            </SelectTrigger>
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
      <div className="flex justify-between">
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
