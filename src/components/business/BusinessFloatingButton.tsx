"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Building2, UserPlus, FilePlus2, X, Crosshair } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { isBusinessEnabled, isBusinessParticipant, listEstablishments, upsertEstablishment, upsertHouseholder, addVisit, getUniqueAreas, getUniqueFloors, type EstablishmentStatus, getBwiParticipants } from "@/lib/db/business";
import { toast } from "sonner";
import { businessEventBus } from "@/lib/events/business-events";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function useGeo() {
  const [coords, setCoords] = useState<{lat:number;lng:number}|null>(null);
  const get = () => {
    if (!navigator?.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }));
  };
  return { coords, get };
}

export function BusinessFloatingButton({ 
  selectedArea, 
  selectedEstablishmentId,
  onEstablishmentAdded,
  onHouseholderAdded,
  onVisitAdded
}: { 
  selectedArea?: string; 
  selectedEstablishmentId?: string;
  onEstablishmentAdded?: (establishment: any) => void;
  onHouseholderAdded?: (householder: any) => void;
  onVisitAdded?: (visit: any) => void;
}) {
  const [enabled, setEnabled] = useState(false);
  const [participant, setParticipant] = useState(false);
  const [establishments, setEstablishments] = useState<any[]>([]);
  const [open, setOpen] = useState<null | 'est' | 'hh' | 'visit'>(null);
  const [expanded, setExpanded] = useState(false);
  const { coords, get } = useGeo();

  // Check if business features are enabled
  useEffect(() => {
    (async () => {
      setEnabled(await isBusinessEnabled());
      setParticipant(await isBusinessParticipant());
      setEstablishments(await listEstablishments());
    })();
  }, []);

  const canUse = enabled && participant;

  if (!canUse) return null;

  return (
    <>
      {/* Main floating button - same positioning as FieldServiceModal */}
      <Button
        onClick={() => setExpanded(!expanded)}
        className={`fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px] ${
          expanded ? 'rotate-45' : ''
        }`}
        size="lg"
      >
        {expanded ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </Button>

      {/* Expandable buttons - positioned above main button */}
      <div className={`fixed right-4 z-40 flex flex-col gap-2 transition-all duration-300 ease-out items-end bottom-[calc(max(env(safe-area-inset-bottom),0px)+144px)] md:right-6 md:bottom-[168px] ${
        expanded 
          ? 'opacity-100 translate-y-0 pointer-events-auto' 
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}>
        <Button
          variant="outline"
          className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
          onClick={() => setOpen('est')}
        >
          <Building2 className="h-4 w-4 mr-2"/>
          Establishment
        </Button>
        <Button
          variant="outline"
          className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
          onClick={() => setOpen('hh')}
        >
          <UserPlus className="h-4 w-4 mr-2"/>
          Householder
        </Button>
        <Button
          variant="default"
          className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
          onClick={() => setOpen('visit')}
        >
          <FilePlus2 className="h-4 w-4 mr-2"/>
          Visit
        </Button>
      </div>

      {/* Establishment form */}
      <ResponsiveModal open={open==='est'} onOpenChange={(o)=> setOpen(o? 'est': null)} title="New Establishment" description="Add a business establishment" className="sm:max-w-[560px]">
        <EstablishmentForm 
          onGetLocation={get} 
          coords={coords} 
          onSaved={async () => { 
            setOpen(null); 
            setEstablishments(await listEstablishments());
          }} 
          selectedArea={selectedArea}
        />
      </ResponsiveModal>
      <ResponsiveModal open={open==='hh'} onOpenChange={(o)=> setOpen(o? 'hh': null)} title="New Householder" description="Add a householder for an establishment" className="sm:max-w-[560px]">
        <HouseholderForm 
          establishments={establishments} 
          selectedEstablishmentId={selectedEstablishmentId}
          onSaved={() => {
            setOpen(null);
          }} 
        />
      </ResponsiveModal>
      <ResponsiveModal open={open==='visit'} onOpenChange={(o)=> setOpen(o? 'visit': null)} title="Visit Update" description="Record a visit note" className="sm:max-w-[560px]">
        <VisitForm 
          establishments={establishments} 
          selectedEstablishmentId={selectedEstablishmentId}
          onSaved={() => {
            setOpen(null);
          }} 
        />
      </ResponsiveModal>
    </>
  );
}

function EstablishmentForm({ onSaved, coords, onGetLocation, selectedArea }: { 
  onSaved: (newEstablishment?: any)=>void; 
  coords: {lat:number;lng:number}|null; 
  onGetLocation: ()=>void; 
  selectedArea?: string; 
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState(selectedArea || "");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [floor, setFloor] = useState("");
  const [status, setStatus] = useState<EstablishmentStatus>('for_scouting');
  const [note, setNote] = useState("");
  const [gps, setGps] = useState<string>("");
  const [areas, setAreas] = useState<string[]>([]);
  const [floors, setFloors] = useState<string[]>([]);
  const [showAreaInput, setShowAreaInput] = useState(false);
  const [showFloorInput, setShowFloorInput] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(()=>{ 
    if(coords){ 
      setLat(coords.lat); 
      setLng(coords.lng);
      setGps(`${coords.lat}, ${coords.lng}`);
    }
  },[coords?.lat, coords?.lng]);

  useEffect(() => {
    (async () => {
      setAreas(await getUniqueAreas());
      setFloors(await getUniqueFloors());
    })();
  }, []);

  // Update area when selectedArea prop changes
  useEffect(() => {
    if (selectedArea) {
      setArea(selectedArea);
    }
  }, [selectedArea]);

  const parseGps = (input: string): { lat: number; lng: number } | null => {
    const nums = (input || "").trim().replace(/,/g, " ").split(/\s+/).filter(Boolean).map((s) => Number(s));
    if (nums.length < 2 || nums.some((n) => Number.isNaN(n))) return null;
    const a = nums[0];
    const b = nums[1];
    const inLat = (v: number) => v >= -90 && v <= 90;
    const inLng = (v: number) => v >= -180 && v <= 180;
    // Prefer a as lat when valid
    if (inLat(a) && inLng(b)) return { lat: a, lng: b };
    // If a can't be lat but can be lng, and b can be lat -> reversed
    if (!inLat(a) && inLng(a) && inLat(b)) return { lat: b, lng: a };
    // If both could be lat (ambiguous), assume a=lat, b=lng
    if (inLat(a) && inLat(b)) return { lat: a, lng: b };
    return null;
  };

  const defaultFloors = ["Ground Floor", "2nd Floor", "3rd Floor"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const result = await upsertEstablishment({ 
        name, 
        description: description||null, 
        area: area||null, 
        lat, 
        lng, 
        floor: floor||null, 
        status, 
        note: note||null 
      });
      
      if (result) {
        toast.success("Establishment saved successfully!");
        onSaved(result);
        // Emit event for live update
        businessEventBus.emit('establishment-added', result);
      } else {
        toast.error("Failed to save establishment");
      }
    } catch (error) {
      toast.error("Error saving establishment");
      console.error('Error saving establishment:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="grid gap-3" onSubmit={handleSubmit}>
      <div className="grid gap-1">
        <Label>Name</Label>
        <Input value={name} onChange={e=>setName(e.target.value)} required />
      </div>
      
      <div className="grid gap-1">
        <Label>Description</Label>
        <Textarea 
          value={description} 
          onChange={e=>setDescription(e.target.value)} 
          placeholder="Brief description of the establishment"
        />
      </div>
      
      <div className="grid gap-1">
        <Label>Area</Label>
        {showAreaInput ? (
          <div className="flex gap-2">
            <Input 
              className="flex-1"
              value={area} 
              onChange={e=>setArea(e.target.value)}
              placeholder="Enter area name"
              autoFocus
            />
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowAreaInput(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Select value={area} onValueChange={(value) => {
            if (value === "__custom__") {
              setShowAreaInput(true);
              setArea("");
            } else {
              setArea(value);
            }
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Select area or add new" />
            </SelectTrigger>
            <SelectContent>
              {areas.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
              <SelectItem value="__custom__">
                + Add new area
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid gap-1">
        <Label>GPS</Label>
        <div className="flex gap-2">
          <Input 
            className="flex-1"
            placeholder="14.5995, 120.9842"
            value={gps}
            onChange={(e) => {
              const v = e.target.value;
              setGps(v);
              const parsed = parseGps(v);
              if (!v.trim()) {
                setLat(null);
                setLng(null);
              } else if (parsed) {
                setLat(parsed.lat);
                setLng(parsed.lng);
              }
            }}
          />
          <Button 
            type="button" 
            variant="outline" 
            size="icon"
            onClick={onGetLocation}
            title="Use current location"
          >
            <Crosshair className="h-4 w-4" />
          </Button>
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
        {showFloorInput ? (
          <div className="flex gap-2">
            <Input 
              className="flex-1"
              value={floor} 
              onChange={e=>setFloor(e.target.value)}
              placeholder="Enter floor name"
              autoFocus
            />
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowFloorInput(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Select value={floor} onValueChange={(value) => {
            if (value === "__custom__") {
              setShowFloorInput(true);
              setFloor("");
            } else {
              setFloor(value);
            }
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Select floor or add new" />
            </SelectTrigger>
            <SelectContent>
              {defaultFloors.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
              {floors.filter(f => !defaultFloors.includes(f)).map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
              <SelectItem value="__custom__">
                + Add new floor
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid gap-1">
        <Label>Note</Label>
        <Textarea value={note} onChange={e=>setNote(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}

function HouseholderForm({ 
  establishments, 
  selectedEstablishmentId, 
  onSaved 
}: { 
  establishments: any[]; 
  selectedEstablishmentId?: string;
  onSaved: (newHouseholder?: any)=>void; 
}) {
  const [estId, setEstId] = useState<string>(
    selectedEstablishmentId || establishments[0]?.id || ""
  );
  const [name, setName] = useState("");
  const [status, setStatus] = useState<'interested'|'return_visit'|'bible_study'|'do_not_call'>("interested");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  
  // Update estId when selectedEstablishmentId changes
  useEffect(() => {
    if (selectedEstablishmentId) {
      setEstId(selectedEstablishmentId);
    } else if (establishments.length > 0) {
      setEstId(establishments[0]?.id || "");
    }
  }, [selectedEstablishmentId, establishments]);
  
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
        // Emit event for live update
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
    <form className="grid gap-3" onSubmit={handleSubmit}>
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
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}

function VisitForm({ 
  establishments, 
  selectedEstablishmentId, 
  onSaved 
}: { 
  establishments: any[]; 
  selectedEstablishmentId?: string;
  onSaved: (newVisit?: any)=>void; 
}) {
  // Find the selected establishment to get its ID
  const selectedEstablishment = selectedEstablishmentId 
    ? establishments.find(est => est.id === selectedEstablishmentId)
    : null;
  
  const [estId, setEstId] = useState<string>(
    selectedEstablishmentId || establishments[0]?.id || "none"
  );
  const [note, setNote] = useState("");
  const [visitDate, setVisitDate] = useState<Date>(new Date()); // Default to today
  const [saving, setSaving] = useState(false);
  const [publishers, setPublishers] = useState<string[]>([]); // Array of user IDs
  const [participants, setParticipants] = useState<Array<{
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  }>>([]);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  } | null>(null);
  
  // Update estId when selectedEstablishmentId changes
  useEffect(() => {
    if (selectedEstablishmentId) {
      setEstId(selectedEstablishmentId);
    } else if (establishments.length > 0) {
      setEstId(establishments[0]?.id || "none");
    }
  }, [selectedEstablishmentId, establishments]);

  // Load participants and set current user as default publisher
  useEffect(() => {
    const loadParticipants = async () => {
      try {
        const participantsList = await getBwiParticipants();
        console.log('Loaded participants:', participantsList); // Debug log
        setParticipants(participantsList);
        
        // Get current user profile
        const supabase = createSupabaseBrowserClient();
        const { data: profile } = await supabase.rpc('get_my_profile');
        if (profile) {
          const currentUserData = participantsList.find(p => p.id === profile.id);
          if (currentUserData) {
            console.log('Setting current user as first publisher:', currentUserData); // Debug log
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
      const ok = await addVisit({ 
        establishment_id: estId === "none" ? undefined : estId || undefined, 
        note: note||null,
        visit_date: visitDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
        publisher_id: publishers[0] || undefined,
        partner_id: publishers[1] || undefined
      }); 
      
      if (ok) {
        toast.success("Visit recorded successfully!");
        onSaved(ok);
        // Create a visit object for animation
        const newVisit = {
          id: Date.now().toString(), // Temporary ID
          establishment_id: estId === "none" ? undefined : estId,
          note: note || null,
          visit_date: visitDate.toISOString().split('T')[0],
          publisher_id: publishers[0] || undefined,
          partner_id: publishers[1] || undefined,
          created_at: new Date().toISOString()
        };
        // Emit event for live update
        businessEventBus.emit('visit-added', newVisit);
      } else {
        toast.error("Failed to record visit");
      }
    } catch (error) {
      toast.error("Error recording visit");
      console.error('Error recording visit:', error);
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
        
        {/* Display selected publishers */}
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

        {/* Add publisher dropdown */}
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
        <Textarea value={note} onChange={e=>setNote(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
