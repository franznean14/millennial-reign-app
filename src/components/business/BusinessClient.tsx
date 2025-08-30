"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Building2, UserPlus, FilePlus2 } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isBusinessEnabled, isBusinessParticipant, listEstablishments, upsertEstablishment, upsertHouseholder, addVisit, type EstablishmentStatus } from "@/lib/db/business";

function useGeo() {
  const [coords, setCoords] = useState<{lat:number;lng:number}|null>(null);
  const get = () => {
    if (!navigator?.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }));
  };
  return { coords, get };
}

export function BusinessClient() {
  const [enabled, setEnabled] = useState(false);
  const [participant, setParticipant] = useState(false);
  const [establishments, setEstablishments] = useState<any[]>([]);
  const [open, setOpen] = useState<null | 'est' | 'hh' | 'visit'>(null);
  const { coords, get } = useGeo();

  useEffect(() => {
    (async () => {
      setEnabled(await isBusinessEnabled());
      setParticipant(await isBusinessParticipant());
      setEstablishments(await listEstablishments());
    })();
  }, []);

  const canUse = enabled && participant;

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4">
        <div className="text-base font-medium">Business Witnessing</div>
        <div className="mt-1 text-sm opacity-70">Track establishments, householders, and visits.</div>
      </div>

      {!enabled && (
        <div className="rounded-md border p-4 text-sm">Your congregation has not enabled this feature.</div>
      )}
      {enabled && !participant && (
        <div className="rounded-md border p-4 text-sm">You are not enrolled as a participant for this feature.</div>
      )}

      {canUse && (
        <div className="grid gap-2">
          {establishments.map((e) => (
            <div key={e.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{e.name}</div>
                <div className="text-xs opacity-70 uppercase">{String(e.status || '').replace(/_/g,' ')}</div>
              </div>
              <div className="text-sm opacity-70">{e.area || '—'}</div>
            </div>
          ))}
          {establishments.length === 0 && (
            <div className="text-sm opacity-70">No establishments yet.</div>
          )}
        </div>
      )}

      {/* Remove the old floating buttons since they're now handled by BusinessFloatingButton */}

      {/* Establishment form */}
      <ResponsiveModal open={open==='est'} onOpenChange={(o)=> setOpen(o? 'est': null)} title="New Establishment" description="Add a business establishment" className="sm:max-w-[560px]">
        <EstablishmentForm onGetLocation={get} coords={coords} onSaved={async ()=>{ setOpen(null); setEstablishments(await listEstablishments()); }} />
      </ResponsiveModal>
      <ResponsiveModal open={open==='hh'} onOpenChange={(o)=> setOpen(o? 'hh': null)} title="New Householder" description="Add a householder for an establishment" className="sm:max-w-[560px]">
        <HouseholderForm establishments={establishments} onSaved={()=> setOpen(null)} />
      </ResponsiveModal>
      <ResponsiveModal open={open==='visit'} onOpenChange={(o)=> setOpen(o? 'visit': null)} title="Visit Update" description="Record a visit note" className="sm:max-w-[560px]">
        <VisitForm establishments={establishments} onSaved={()=> setOpen(null)} />
      </ResponsiveModal>
    </div>
  );
}

function EstablishmentForm({ onSaved, coords, onGetLocation }: { onSaved: ()=>void; coords: {lat:number;lng:number}|null; onGetLocation: ()=>void; }) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [floor, setFloor] = useState("");
  const [status, setStatus] = useState<EstablishmentStatus>('for_scouting');
  const [note, setNote] = useState("");

  useEffect(()=>{ if(coords){ setLat(coords.lat); setLng(coords.lng);} },[coords?.lat, coords?.lng]);

  return (
    <form className="grid gap-3" onSubmit={async (e)=>{ e.preventDefault(); await upsertEstablishment({ name, area: area||null, lat, lng, floor: floor||null, status, note: note||null }); onSaved(); }}>
      <div className="grid gap-1">
        <Label>Name</Label>
        <Input value={name} onChange={e=>setName(e.target.value)} required />
      </div>
      <div className="grid gap-1">
        <Label>Area</Label>
        <Input value={area} onChange={e=>setArea(e.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label>Coordinates</Label>
        <div className="flex gap-2">
          <Input value={lat??''} onChange={e=>setLat(e.target.value? Number(e.target.value): null)} placeholder="lat" />
          <Input value={lng??''} onChange={e=>setLng(e.target.value? Number(e.target.value): null)} placeholder="lng" />
          <Button type="button" variant="outline" onClick={onGetLocation}>Use current</Button>
        </div>
      </div>
      <div className="grid gap-1">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v:any)=> setStatus(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="for_scouting">For Scouting</SelectItem>
            <SelectItem value="for_follow_up">For Follow Up</SelectItem>
            <SelectItem value="accepted_rack">Accepted Rack</SelectItem>
            <SelectItem value="declined_rack">Declined Rack</SelectItem>
            <SelectItem value="has_bible_studies">Has Bible Studies</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1">
        <Label>Floor</Label>
        <Input value={floor} onChange={e=>setFloor(e.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label>Note</Label>
        <Textarea value={note} onChange={e=>setNote(e.target.value)} />
      </div>
      <div className="flex justify-end"><Button type="submit">Save</Button></div>
    </form>
  );
}

function HouseholderForm({ establishments, onSaved }: { establishments: any[]; onSaved: ()=>void; }) {
  const [estId, setEstId] = useState<string>(establishments[0]?.id || "");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<'interested'|'return_visit'|'bible_study'|'do_not_call'>("interested");
  const [note, setNote] = useState("");
  useEffect(()=>{ if(!estId && establishments[0]?.id) setEstId(establishments[0].id); },[establishments?.length]);
  return (
    <form className="grid gap-3" onSubmit={async (e)=>{ e.preventDefault(); await upsertHouseholder({ establishment_id: estId, name, status, note: note||null }); onSaved(); }}>
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
      <div className="flex justify-end"><Button type="submit">Save</Button></div>
    </form>
  );
}

function VisitForm({ establishments, onSaved }: { establishments: any[]; onSaved: ()=>void; }) {
  const [estId, setEstId] = useState<string>(establishments[0]?.id || "");
  const [note, setNote] = useState("");
  return (
    <form className="grid gap-3" onSubmit={async (e)=>{ e.preventDefault(); const ok = await addVisit({ establishment_id: estId || undefined, note: note||null }); if (ok) onSaved(); }}>
      <div className="grid gap-1">
        <Label>Establishment (optional)</Label>
        <Select value={estId} onValueChange={setEstId}>
          <SelectTrigger><SelectValue placeholder="Select establishment"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="">None</SelectItem>
            {establishments.map((e)=> <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1">
        <Label>Update Note</Label>
        <Textarea value={note} onChange={e=>setNote(e.target.value)} />
      </div>
      <div className="flex justify-end"><Button type="submit">Save</Button></div>
    </form>
  );
}
