"use client";

import { useState, useEffect } from "react";
import { cacheGet } from "@/lib/offline/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { upsertHouseholder } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";
import { useMobile } from "@/lib/hooks/use-mobile";

interface HouseholderFormProps {
  establishments: any[];
  selectedEstablishmentId?: string;
  onSaved: (newHouseholder?: any) => void;
  // Edit mode props
  isEditing?: boolean;
  initialData?: {
    id: string;
    establishment_id: string;
    name: string;
    status: 'interested'|'return_visit'|'bible_study'|'do_not_call';
    note?: string | null;
  } | null;
  onDelete?: () => Promise<void> | void;
  disableEstablishmentSelect?: boolean;
}

export function HouseholderForm({ establishments, selectedEstablishmentId, onSaved, isEditing = false, initialData = null, onDelete, disableEstablishmentSelect = false }: HouseholderFormProps) {
  const [estId, setEstId] = useState<string>(
    initialData?.establishment_id || selectedEstablishmentId || establishments[0]?.id || ""
  );
  const [name, setName] = useState(initialData?.name || "");
  const [status, setStatus] = useState<'interested'|'return_visit'|'bible_study'|'do_not_call'>(initialData?.status || "interested");
  const [note, setNote] = useState(initialData?.note || "");
  const [saving, setSaving] = useState(false);
  const isMobile = useMobile();
  const [confirmOpen, setConfirmOpen] = useState(false);
  
  useEffect(() => {
    if (initialData?.establishment_id) {
      setEstId(initialData.establishment_id);
      return;
    }
    if (selectedEstablishmentId) {
      setEstId(selectedEstablishmentId);
    } else if (establishments.length > 0) {
      setEstId(establishments[0]?.id || "");
    }
  }, [initialData?.establishment_id, selectedEstablishmentId, establishments]);

  // Prefill from active business filters (area doesn't apply here; status can)
  useEffect(() => {
    (async () => {
      try {
        const filters = await cacheGet<any>("business:filters");
        if (filters && Array.isArray(filters.statuses) && filters.statuses.length > 0) {
          const preferred = filters.statuses[0] as any;
          setStatus(preferred);
        }
      } catch {}
    })();
  }, []);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const result = await upsertHouseholder({ 
        id: initialData?.id,
        establishment_id: estId, 
        name, 
        status, 
        note: note||null 
      });
      
      if (result) {
        toast.success(isEditing ? "Householder updated successfully!" : "Householder saved successfully!");
        onSaved(result);
        businessEventBus.emit(isEditing ? 'householder-updated' : 'householder-added', result);
      } else {
        toast.error(isEditing ? "Failed to update householder" : "Failed to save householder");
      }
    } catch (error) {
      toast.error(isEditing ? "Error updating householder" : "Error saving householder");
      console.error('Error saving/updating householder:', error);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <form className="grid gap-3 pb-10" onSubmit={handleSubmit}>
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
              {establishments.map((e)=> <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="grid gap-1">
        <Label>Name</Label>
        <Input value={name} onChange={e=>setName(e.target.value)} required />
      </div>
      <div className="grid gap-1">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v:any)=> setStatus(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="interested">Interested</SelectItem>
            <SelectItem value="return_visit">Return Visit</SelectItem>
            <SelectItem value="bible_study">Bible Study</SelectItem>
            <SelectItem value="do_not_call">Do Not Call</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1">
        <Label>Note</Label>
        <Textarea value={note} onChange={e=>setNote(e.target.value)} />
      </div>
      <div className={`flex py-4 ${isEditing && onDelete ? "justify-between" : "justify-end"}`}>
        {isEditing && onDelete && (
          <Popover open={confirmOpen} onOpenChange={setConfirmOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="destructive" disabled={saving}>Delete</Button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="start">
              <div className="space-y-3">
                <p className="text-sm">Delete this householder?</p>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={saving}
                    onClick={async () => {
                      try {
                        setSaving(true);
                        await onDelete();
                        setConfirmOpen(false);
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
        )}
        <Button type="submit" disabled={saving}>
          {saving ? (isEditing ? "Updating..." : "Saving...") : (isEditing ? "Update" : "Save")}
        </Button>
      </div>
    </form>
  );
}
