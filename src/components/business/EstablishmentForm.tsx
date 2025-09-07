"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Crosshair, ChevronDown } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { upsertEstablishment, getUniqueAreas, getUniqueFloors, findEstablishmentDuplicates } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";
import { cacheGet, cacheSet } from "@/lib/offline/store";
import { useMobile } from "@/lib/hooks/use-mobile";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Determine whether a draft object has any meaningful data
function isNonEmptyDraft(d: any | null | undefined): boolean {
  if (!d) return false;
  const hasText = (v?: string | null) => typeof v === "string" && v.trim().length > 0;
  const hasNum = (v?: number | null) => typeof v === "number" && !Number.isNaN(v);
  const hasArray = (v?: any[]) => Array.isArray(v) && v.length > 0;
  return (
    hasText(d.name) ||
    hasText(d.description) ||
    hasText(d.area) ||
    hasNum(d.lat) ||
    hasNum(d.lng) ||
    hasText(d.floor) ||
    hasArray(d.statuses) ||
    hasText(d.note) ||
    hasText(d.gps)
  );
}

interface EstablishmentFormProps {
  onSaved: (newEstablishment?: any) => void;
  onDelete?: () => Promise<void> | void;
  selectedArea?: string;
  initialData?: any;
  isEditing?: boolean;
  // Optional external draft from parent/global state (session-scoped persistence)
  draft?: {
    name?: string;
    description?: string | null;
    area?: string | null;
    lat?: number | null;
    lng?: number | null;
    floor?: string | null;
    statuses?: string[];
    note?: string | null;
    gps?: string | null;
  } | null;
  onDraftChange?: (draft: any) => void;
}

export function EstablishmentForm({ onSaved, onDelete, selectedArea, initialData, isEditing = false, draft: externalDraft, onDraftChange }: EstablishmentFormProps) {
  // Persist unsaved draft locally to survive modal close
  const draftKey = (isEditing && initialData?.id
    ? `draft:establishment:edit:${initialData.id}`
    : `draft:establishment:new`) + (selectedArea ? `:${selectedArea}` : "");
  const draftAppliedRef = useRef(false);
  const isMobile = useMobile();

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
  const [dupCandidates, setDupCandidates] = useState<any[]>([]);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Prevent emitting/saving empty draft before initial load completes
  const loadCompleteRef = useRef(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setAreas(await getUniqueAreas());
      setFloors(await getUniqueFloors());
      // Prefill from active business filters if available
      try {
        const filters = await cacheGet<any>("business:filters");
        if (filters) {
          if (!draftAppliedRef.current) {
            if (!area && Array.isArray(filters.areas) && filters.areas.length > 0) {
              setArea(filters.areas[0]);
            }
            if (Array.isArray(filters.statuses) && filters.statuses.length > 0 && (!status || status.length === 0)) {
              setStatus([...filters.statuses]);
            }
          }
        }
      } catch {}
      // Load any existing draft (if present) - only apply non-empty fields to avoid wiping prefill
      try {
        const persisted = await cacheGet<any>(draftKey);
        const draft = isNonEmptyDraft(externalDraft) ? externalDraft : persisted;
        if (draft && active) {
          draftAppliedRef.current = true;
          if (typeof draft.name === "string" && draft.name.trim().length > 0) setName(draft.name);
          if (typeof draft.description === "string") setDescription(draft.description);
          if (typeof draft.area === "string" && draft.area.trim().length > 0) setArea(draft.area);
          if (typeof draft.lat === "number") setLat(draft.lat);
          if (typeof draft.lng === "number") setLng(draft.lng);
          if (typeof draft.floor === "string") setFloor(draft.floor);
          if (Array.isArray(draft.statuses) && draft.statuses.length > 0) setStatus(draft.statuses);
          if (typeof draft.note === "string") setNote(draft.note);
          if (typeof draft.gps === "string") setGps(draft.gps);
        }
      } catch {}
      // Mark initial load complete so subsequent changes can emit and persist
      loadCompleteRef.current = true;
    })();
    return () => { active = false };
    // Re-load draft when the key changes (e.g., switching from new to edit or selectedArea changes)
  }, [draftKey, externalDraft]);

  // Update area when selectedArea prop changes (but do not override explicit user input)
  useEffect(() => {
    if (selectedArea && !area) {
      setArea(selectedArea);
    }
  }, [selectedArea]);

  // Keep the latest draft in a ref and persist with debounce
  const latestDraftRef = useRef<any>(null);
  useEffect(() => {
    latestDraftRef.current = { name, description, area, lat, lng, floor, statuses: status, note, gps };
    // Do not emit/persist until initial load completes to avoid overwriting persisted data with empties
    if (!loadCompleteRef.current) return;
    if (onDraftChange) onDraftChange(latestDraftRef.current);
    const id = setTimeout(() => {
      // Only persist non-empty drafts to avoid clearing prefills
      if (isNonEmptyDraft(latestDraftRef.current)) {
        cacheSet(draftKey, latestDraftRef.current).catch(() => {});
      }
    }, 150);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, description, area, lat, lng, floor, status, note, gps]);

  // Proactive duplicate detection as the user types (prefix match) - only for NEW establishments
  useEffect(() => {
    if (isEditing) {
      setDupCandidates([]);
      return;
    }
    const id = setTimeout(async () => {
      try {
        if (name && name.trim().length >= 2) {
          const results = await findEstablishmentDuplicates(name.trim(), area || null, false);
          setDupCandidates(results);
        } else {
          setDupCandidates([]);
        }
      } catch {
        setDupCandidates([]);
      }
    }, 250);
    return () => clearTimeout(id);
  }, [name, area, isEditing]);

  // Flush draft immediately on unmount to avoid losing the latest edits when closing the modal quickly
  useEffect(() => {
    return () => {
      if (latestDraftRef.current) {
        cacheSet(draftKey, latestDraftRef.current).catch(() => {});
      }
    };
  }, [draftKey]);

  const getCurrentLocation = async () => {
    if (!navigator?.geolocation) {
      toast.error("Geolocation is not supported by this browser");
      return;
    }

    // Check if we're in a secure context
    if (!window.isSecureContext) {
      toast.error("Location access requires HTTPS. Please use a secure connection.");
      return;
    }

    // Check current permission state
    try {
      const permission = await navigator.permissions.query({ name: 'geolocation' });
      if (permission.state === 'denied') {
        toast.error("Location access is blocked. Please enable location permissions in your browser settings.");
        return;
      }
    } catch (e) {
      // Permissions API not supported, continue anyway
      console.log("Permissions API not supported, proceeding with geolocation request");
    }
    
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { 
          lat: position.coords.latitude, 
          lng: position.coords.longitude 
        };
        setLat(coords.lat);
        setLng(coords.lng);
        setGps(`${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}`);
        setGpsLoading(false);
        toast.success("Location obtained successfully");
      },
      (error) => {
        setGpsLoading(false);
        let errorMessage = "Failed to get location";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied. Please check your browser settings and allow location access for this site.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information unavailable. Please check your device's location settings.";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out. Please try again.";
            break;
          default:
            errorMessage = `Location error: ${error.message}`;
        }
        toast.error(errorMessage);
        console.error("Geolocation error:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000 // 1 minute
      }
    );
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
        // Clear draft after successful save and invalidate establishments cache
        try { 
          await cacheSet(draftKey, null);
          await cacheSet('establishments:list', null);
        } catch {}
        // For new entries, reset the form and reapply active filters prefill
        if (!isEditing) {
          setName("");
          setDescription("");
          setArea("");
          setLat(null);
          setLng(null);
          setFloor("");
          setStatus([]);
          setNote("");
          setGps("");
          draftAppliedRef.current = false;
          try {
            const filters = await cacheGet<any>("business:filters");
            if (filters) {
              if (Array.isArray(filters.areas) && filters.areas.length > 0) {
                setArea(filters.areas[0]);
              }
              if (Array.isArray(filters.statuses) && filters.statuses.length > 0) {
                setStatus([...filters.statuses]);
              }
            }
          } catch {}
        }
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
    <form className="grid gap-3 pb-10" onSubmit={handleSubmit}>
      <div className="grid gap-1">
        <Label>Name</Label>
        <Input value={name} onChange={e=>setName(e.target.value)} required />
        {dupCandidates.length > 0 && (
          <div className="mt-1 text-xs text-orange-400">
            Possible duplicates in this area:
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              {dupCandidates.map((d) => (
                <li key={d.id}>{d.name}{d.area ? ` – ${d.area}` : ""}</li>
              ))}
            </ul>
          </div>
        )}
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
            disabled={gpsLoading}
            title={gpsLoading ? "Getting location..." : "Use current location"}
          >
            {gpsLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Crosshair className="h-4 w-4" />
            )}
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
      <div className={`flex py-4 ${isEditing && onDelete ? "justify-between" : "justify-end"}`}>
        {isEditing && onDelete && (
          <Popover open={confirmOpen} onOpenChange={setConfirmOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="destructive" disabled={saving}>
                Delete
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 text-center">
              <div className="space-y-2">
                <div className="font-medium">Delete Establishment?</div>
                <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)} disabled={deleting}>Cancel</Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      try {
                        setDeleting(true);
                        await onDelete();
                        setConfirmOpen(false);
                      } finally {
                        setDeleting(false);
                      }
                    }}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting..." : "Delete"}
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
