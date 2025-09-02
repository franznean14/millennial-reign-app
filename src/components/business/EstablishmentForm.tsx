"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Crosshair, ChevronDown } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { upsertEstablishment, getUniqueAreas, getUniqueFloors } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";

interface EstablishmentFormProps {
  onSaved: (newEstablishment?: any) => void;
  selectedArea?: string;
  initialData?: any;
  isEditing?: boolean;
}

export function EstablishmentForm({ onSaved, selectedArea, initialData, isEditing = false }: EstablishmentFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [area, setArea] = useState(initialData?.area || selectedArea || "");
  const [lat, setLat] = useState<number | null>(initialData?.lat || null);
  const [lng, setLng] = useState<number | null>(initialData?.lng || null);
  const [floor, setFloor] = useState(initialData?.floor || "");
  const [status, setStatus] = useState<string[]>(initialData?.statuses || []);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [note, setNote] = useState(initialData?.note || "");
  const [gps, setGps] = useState<string>(initialData?.lat && initialData?.lng ? `${initialData.lat}, ${initialData.lng}` : "");
  const [areas, setAreas] = useState<string[]>([]);
  const [floors, setFloors] = useState<string[]>([]);
  const [showAreaInput, setShowAreaInput] = useState(false);
  const [showFloorInput, setShowFloorInput] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const getCurrentLocation = () => {
    if (!navigator?.geolocation) return;
    navigator.geolocation.getCurrentPosition((p) => {
      const coords = { lat: p.coords.latitude, lng: p.coords.longitude };
      setLat(coords.lat);
      setLng(coords.lng);
      setGps(`${coords.lat}, ${coords.lng}`);
    });
  };

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
      const establishmentData = { 
        name, 
        description: description||null, 
        area: area||null, 
        lat, 
        lng, 
        floor: floor||null, 
        statuses: status,
        note: note||null 
      };

      let result;
      if (isEditing && initialData?.id) {
        // Update existing establishment
        result = await upsertEstablishment({ 
          id: initialData.id,
          ...establishmentData
        });
      } else {
        // Create new establishment
        result = await upsertEstablishment(establishmentData);
      }
      
      if (result) {
        toast.success(isEditing ? "Establishment updated successfully!" : "Establishment saved successfully!");
        onSaved(result);
        // Emit event for live update
        if (isEditing) {
          businessEventBus.emit('establishment-updated', result);
        } else {
          businessEventBus.emit('establishment-added', result);
        }
      } else {
        toast.error(isEditing ? "Failed to update establishment" : "Failed to save establishment");
      }
    } catch (error) {
      toast.error(isEditing ? "Error updating establishment" : "Error saving establishment");
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
            onClick={getCurrentLocation}
            title="Use current location"
          >
            <Crosshair className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-1">
        <Label>Status</Label>
        <DropdownMenu open={statusDropdownOpen} onOpenChange={setStatusDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              {status.length === 0 ? "Select Statuses" : `${status.length} selected`}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Select Statuses</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {[
              { value: "for_scouting", label: "For Scouting" },
              { value: "for_follow_up", label: "For Follow Up" },
              { value: "for_replenishment", label: "For Replenishment" },
              { value: "accepted_rack", label: "Accepted Rack" },
              { value: "declined_rack", label: "Declined Rack" },
              { value: "has_bible_studies", label: "Has Bible Studies" }
            ].map((statusOption) => (
              <DropdownMenuCheckboxItem
                key={statusOption.value}
                checked={status.includes(statusOption.value)}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setStatus([...status, statusOption.value]);
                  } else {
                    setStatus(status.filter(s => s !== statusOption.value));
                  }
                }}
                onSelect={(e) => e.preventDefault()}
              >
                {statusOption.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
          {saving ? (isEditing ? "Updating..." : "Saving...") : (isEditing ? "Update" : "Save")}
        </Button>
      </div>
    </form>
  );
}
