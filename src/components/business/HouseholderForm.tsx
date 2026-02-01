"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Crosshair } from "lucide-react";
import { upsertHouseholder } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";
import { useMobile } from "@/lib/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { getStatusTextColor } from "@/lib/utils/status-hierarchy";

interface HouseholderFormProps {
  establishments: any[];
  selectedEstablishmentId?: string;
  onSaved: (newHouseholder?: any) => void;
  // Edit mode props
  isEditing?: boolean;
  initialData?: {
    id: string;
    establishment_id?: string | null;
    name: string;
    status: 'potential'|'interested'|'return_visit'|'bible_study'|'do_not_call';
    note?: string | null;
    lat?: number | null;
    lng?: number | null;
    publisher_id?: string | null;
  } | null;
  onDelete?: () => Promise<void> | void;
  onArchive?: () => Promise<void> | void;
  disableEstablishmentSelect?: boolean;
  // Context props
  context?: 'bwi' | 'congregation';
  publisherId?: string;
}

export function HouseholderForm({ establishments, selectedEstablishmentId, onSaved, isEditing = false, initialData = null, onDelete, onArchive, disableEstablishmentSelect = false, context = 'bwi', publisherId }: HouseholderFormProps) {
  const [estId, setEstId] = useState<string>(
    isEditing && initialData?.establishment_id 
      ? initialData.establishment_id || ""
      : selectedEstablishmentId || establishments[0]?.id || ""
  );
  const [name, setName] = useState(initialData?.name || "");
  const [status, setStatus] = useState<'potential'|'interested'|'return_visit'|'bible_study'|'do_not_call'>(initialData?.status || "potential");
  const [note, setNote] = useState(initialData?.note || "");
  
  // Convert lat/lng to numbers if they're strings (PostgreSQL numeric types can be returned as strings)
  // Use a function to compute initial values to handle all edge cases
  const getInitialCoords = () => {
    if (!initialData) return { lat: null, lng: null, gps: "" };
    
    const latVal = initialData.lat;
    const lngVal = initialData.lng;
    
    // Handle null/undefined
    if (latVal == null || lngVal == null) {
      return { lat: null, lng: null, gps: "" };
    }
    
    // Convert strings to numbers
    const latNum = typeof latVal === 'string' ? parseFloat(latVal) : latVal;
    const lngNum = typeof lngVal === 'string' ? parseFloat(lngVal) : lngVal;
    
    // Validate numbers (including 0 which is valid for coordinates)
    if (isNaN(latNum) || isNaN(lngNum)) {
      return { lat: null, lng: null, gps: "" };
    }
    
    return {
      lat: latNum,
      lng: lngNum,
      gps: `${latNum}, ${lngNum}`
    };
  };
  
  const initialCoords = getInitialCoords();
  const [lat, setLat] = useState<number | null>(initialCoords.lat);
  const [lng, setLng] = useState<number | null>(initialCoords.lng);
  const [gps, setGps] = useState<string>(initialCoords.gps);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const isMobile = useMobile();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [archiveConfirmOpen, setArchiveConfirmOpen] = useState(false);
  
  // Parse GPS string to lat/lng
  const parseGps = (gpsStr: string): { lat: number; lng: number } | null => {
    const parts = gpsStr.split(',').map(s => s.trim());
    if (parts.length !== 2) return null;
    const lat = parseFloat(parts[0]);
    const lng = parseFloat(parts[1]);
    if (isNaN(lat) || isNaN(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  };
  
  // Get current location
  const getCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
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
  
  useEffect(() => {
    // In edit mode, always preserve the original establishment_id and don't change it
    if (isEditing && initialData?.establishment_id) {
      setEstId(initialData.establishment_id);
      return;
    }
    
    // Only for new householders (not editing) and only in BWI context
    if (!isEditing && context === 'bwi') {
      if (selectedEstablishmentId) {
        setEstId(selectedEstablishmentId);
      } else if (establishments.length > 0) {
        setEstId(establishments[0]?.id || "");
      }
    }
  }, [isEditing, initialData?.establishment_id, selectedEstablishmentId, establishments, context]);

  // Prefill from active business filters (area doesn't apply here; status can)
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem("business:filters:householders");
      if (!raw) return;
      const filters = JSON.parse(raw) as any;
      if (filters && Array.isArray(filters.statuses) && filters.statuses.length > 0) {
        const preferred = filters.statuses[0] as any;
        setStatus(preferred);
      }
    } catch {}
  }, []);

  // Update form fields when initialData changes (e.g., when editing a different householder or modal opens)
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setStatus(initialData.status || "potential");
      setNote(initialData.note || "");
      
      // Convert lat/lng to numbers if they're strings
      const newLat = initialData.lat != null 
        ? (typeof initialData.lat === 'string' ? parseFloat(initialData.lat) : initialData.lat)
        : null;
      const newLng = initialData.lng != null 
        ? (typeof initialData.lng === 'string' ? parseFloat(initialData.lng) : initialData.lng)
        : null;
      
      const validLat = newLat != null && !isNaN(newLat) ? newLat : null;
      const validLng = newLng != null && !isNaN(newLng) ? newLng : null;
      
      setLat(validLat);
      setLng(validLng);
      
      // Update GPS string
      if (validLat != null && validLng != null) {
        setGps(`${validLat}, ${validLng}`);
      } else {
        setGps("");
      }
    }
  }, [initialData]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      // Parse GPS coordinates if provided but not yet parsed
      let finalLat = lat;
      let finalLng = lng;
      
      if (gps.trim() && (!finalLat || !finalLng)) {
        const parsed = parseGps(gps);
        if (parsed) {
          finalLat = parsed.lat;
          finalLng = parsed.lng;
        }
      }
      
      // Ensure lat/lng are numbers or null (not undefined)
      // Only allow GPS coordinates in congregation context (ministry page)
      const latValue = isCongregationContext && typeof finalLat === 'number' && !isNaN(finalLat) ? finalLat : null;
      const lngValue = isCongregationContext && typeof finalLng === 'number' && !isNaN(finalLng) ? finalLng : null;
      
      const result = await upsertHouseholder({ 
        id: initialData?.id,
        establishment_id: context === 'congregation' ? null : (estId || null), 
        publisher_id: context === 'congregation' ? publisherId : (initialData?.publisher_id || null),
        name, 
        status, 
        note: note||null,
        lat: latValue,
        lng: lngValue
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
  
  const isCongregationContext = context === 'congregation';
  const showEstablishmentField = !isCongregationContext;
  
  return (
    <form className="grid gap-3 pb-10" onSubmit={handleSubmit}>
      {showEstablishmentField && (
        <div className="grid gap-1">
          <Label>Establishment</Label>
          {disableEstablishmentSelect || isEditing ? (
            <div className="px-3 py-2 text-sm bg-muted rounded-md">
              {establishments.find(e => e.id === estId)?.name || 'Selected establishment'}
            </div>
          ) : (
            <Select value={estId} onValueChange={setEstId}>
              <SelectTrigger className="h-10 text-sm">
                <SelectValue placeholder="Select establishment" />
              </SelectTrigger>
              <SelectContent className="max-h-64 text-sm">
                {establishments.map((e) => (
                  <SelectItem
                    key={e.id}
                    value={e.id}
                    className="py-2.5 text-sm"
                  >
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
      <div className="grid gap-1">
        <Label>Name</Label>
        <Input value={name} onChange={e=>setName(e.target.value)} required />
      </div>
      <div className="grid gap-1">
        <Label>Status</Label>
        <Select value={status} onValueChange={(v:any)=> setStatus(v)}>
          <SelectTrigger
            className={cn(
              "h-10 text-sm",
              status
                ? getStatusTextColor(status)
                    .split(" ")
                    .find((c) => c.startsWith("text-")) ?? ""
                : ""
            )}
          >
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent className="max-h-64 text-sm">
            <SelectItem
              value="potential"
              className={cn("py-2.5 text-sm", getStatusTextColor("potential"))}
            >
              Potential
            </SelectItem>
            <SelectItem
              value="interested"
              className={cn("py-2.5 text-sm", getStatusTextColor("interested"))}
            >
              Interested
            </SelectItem>
            <SelectItem
              value="return_visit"
              className={cn("py-2.5 text-sm", getStatusTextColor("return_visit"))}
            >
              Return Visit
            </SelectItem>
            <SelectItem
              value="bible_study"
              className={cn("py-2.5 text-sm", getStatusTextColor("bible_study"))}
            >
              Bible Study
            </SelectItem>
            <SelectItem
              value="do_not_call"
              className={cn("py-2.5 text-sm", getStatusTextColor("do_not_call"))}
            >
              Do Not Call
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isCongregationContext && (
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
      )}
      <div className="grid gap-1">
        <Label>Note</Label>
        <Textarea value={note} onChange={e=>setNote(e.target.value)} />
      </div>
      <div className={`flex py-4 ${isEditing && (onDelete || onArchive) ? "justify-between" : "justify-end"}`}>
        {isEditing && (onDelete || onArchive) && (
          <div className="flex gap-2">
            {onDelete && (
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
            {onArchive && (
              <Popover open={archiveConfirmOpen} onOpenChange={setArchiveConfirmOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="secondary" disabled={saving}>Archive</Button>
                </PopoverTrigger>
                <PopoverContent className="w-56" align="start">
                  <div className="space-y-3">
                    <p className="text-sm">Archive this householder?</p>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setArchiveConfirmOpen(false)}>Cancel</Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={saving}
                        onClick={async () => {
                          try {
                            setSaving(true);
                            await onArchive();
                            setArchiveConfirmOpen(false);
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
          </div>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? (isEditing ? "Updating..." : "Saving...") : (isEditing ? "Update" : "Save")}
        </Button>
      </div>
    </form>
  );
}
