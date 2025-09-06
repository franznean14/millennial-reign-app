"use client";

import { useState, useEffect } from "react";
import { cacheGet } from "@/lib/offline/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { upsertHouseholder } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";
import { useMobile } from "@/lib/hooks/use-mobile";

interface HouseholderFormProps {
  establishments: any[];
  selectedEstablishmentId?: string;
  onSaved: (newHouseholder?: any) => void;
}

export function HouseholderForm({ establishments, selectedEstablishmentId, onSaved }: HouseholderFormProps) {
  const [estId, setEstId] = useState<string>(
    selectedEstablishmentId || establishments[0]?.id || ""
  );
  const [name, setName] = useState("");
  const [status, setStatus] = useState<'interested'|'return_visit'|'bible_study'|'do_not_call'>("interested");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const isMobile = useMobile();
  
  useEffect(() => {
    if (selectedEstablishmentId) {
      setEstId(selectedEstablishmentId);
    } else if (establishments.length > 0) {
      setEstId(establishments[0]?.id || "");
    }
  }, [selectedEstablishmentId, establishments]);

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
        establishment_id: estId, 
        name, 
        status, 
        note: note||null 
      });
      
      if (result) {
        toast.success("Householder saved successfully!");
        onSaved(result);
        businessEventBus.emit('householder-added', result);
      } else {
        toast.error("Failed to save householder");
      }
    } catch (error) {
      toast.error("Error saving householder");
      console.error('Error saving householder:', error);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <form className="grid gap-3 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]" onSubmit={handleSubmit}>
      <div className="grid gap-1">
        <Label>Establishment</Label>
        <Select value={estId} onValueChange={setEstId}>
          <SelectTrigger><SelectValue placeholder="Select establishment"/></SelectTrigger>
          <SelectContent>
            {establishments.map((e)=> <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1">
        <Label>Name</Label>
        <Input value={name} onChange={e=>setName(e.target.value)} required className={isMobile ? "text-[16px]" : undefined} />
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
        <Textarea value={note} onChange={e=>setNote(e.target.value)} className="text-[16px]" />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
