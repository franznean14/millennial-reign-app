"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronDown, Crosshair } from "lucide-react";
import { upsertContact, type ContactStatus } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";
import { useMobile } from "@/lib/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  getStatusTextColor,
  normalizeContactStatusesForForm,
  resolveContactStatuses,
  toggleContactStatusForForm,
} from "@/lib/utils/status-hierarchy";
import { formatContactStatusLabel } from "@/lib/utils/contact-status-tabs";
import { sidebarFormClasses } from "@/components/business/sidebar-form-styles";

const CONTACT_STATUS_OPTIONS: { value: ContactStatus; label: string }[] = [
  { value: "potential", label: "Potential" },
  { value: "interested", label: "Interested" },
  { value: "return_visit", label: "Return Visit" },
  { value: "bible_study", label: "Bible Study" },
  { value: "do_not_call", label: "Do Not Call" },
  { value: "moved_branch", label: "Moved" },
  { value: "resigned", label: "Resigned" },
];

interface ContactFormProps {
  establishments: any[];
  selectedEstablishmentId?: string;
  onSaved: (newContact?: any) => void;
  // Edit mode props
  isEditing?: boolean;
  initialData?: {
    id: string;
    establishment_id?: string | null;
    name: string;
    statuses: ContactStatus[];
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

export function ContactForm({ establishments, selectedEstablishmentId, onSaved, isEditing = false, initialData = null, onDelete, onArchive, disableEstablishmentSelect = false, context = 'bwi', publisherId }: ContactFormProps) {
  const [estId, setEstId] = useState<string>(
    isEditing && initialData?.establishment_id 
      ? initialData.establishment_id || ""
      : selectedEstablishmentId || establishments[0]?.id || ""
  );
  const [name, setName] = useState(initialData?.name || "");
  const [status, setStatus] = useState<string[]>(() =>
    normalizeContactStatusesForForm(
      initialData
        ? resolveContactStatuses({ statuses: initialData.statuses })
        : ["potential"]
    )
  );
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
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
    
    // Only for new contacts (not editing) and only in BWI context
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
      const raw = window.localStorage.getItem("business:filters:contacts");
      if (!raw) return;
      const filters = JSON.parse(raw) as any;
      if (filters && Array.isArray(filters.statuses) && filters.statuses.length > 0) {
        setStatus(normalizeContactStatusesForForm([...filters.statuses]));
      }
    } catch {}
  }, []);

  // Update form fields when initialData changes (e.g., when editing a different contact or modal opens)
  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      setStatus(
        normalizeContactStatusesForForm(
          resolveContactStatuses({ statuses: initialData.statuses })
        )
      );
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
      
      const statusesPayload = normalizeContactStatusesForForm(status) as ContactStatus[];

      const result = await upsertContact({
        id: initialData?.id,
        establishment_id: context === "congregation" ? null : estId || null,
        publisher_id: context === "congregation" ? publisherId : initialData?.publisher_id || null,
        name,
        statuses: statusesPayload,
        note: note || null,
        lat: latValue,
        lng: lngValue,
      });
      
      if (result) {
        toast.success(isEditing ? "Contact updated successfully!" : "Contact saved successfully!");
        onSaved(result);
        businessEventBus.emit(isEditing ? 'contact-updated' : 'contact-added', result);
      } else {
        toast.error(isEditing ? "Failed to update contact" : "Failed to save contact");
      }
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : isEditing
            ? "Error updating contact"
            : "Error saving contact";
      toast.error(message);
      console.error("Error saving/updating contact:", error);
    } finally {
      setSaving(false);
    }
  };
  
  const isCongregationContext = context === 'congregation';
  const showEstablishmentField = !isCongregationContext;
  
  return (
    <form className={cn("grid gap-3 pb-4", sidebarFormClasses.form)} onSubmit={handleSubmit}>
      {showEstablishmentField && (
        <div className="grid gap-1">
          <Label className={sidebarFormClasses.label}>Establishment</Label>
          {disableEstablishmentSelect || isEditing ? (
            <div className={cn("rounded-md px-3 py-2", sidebarFormClasses.staticField)}>
              {establishments.find(e => e.id === estId)?.name || 'Selected establishment'}
            </div>
          ) : (
            <Select value={estId} onValueChange={setEstId}>
              <SelectTrigger className={cn("h-10 text-sm", sidebarFormClasses.selectTrigger)}>
                <SelectValue placeholder="Select establishment" />
              </SelectTrigger>
              <SelectContent className={cn("max-h-64 text-sm", sidebarFormClasses.selectContent)}>
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
        <Label className={sidebarFormClasses.label}>Name</Label>
        <Input className={sidebarFormClasses.input} value={name} onChange={e=>setName(e.target.value)} required />
      </div>
      <div className="grid gap-1">
        <Label className={sidebarFormClasses.label}>Status</Label>
        <DropdownMenu open={statusDropdownOpen} onOpenChange={setStatusDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className={cn("h-9 w-full justify-between px-3 text-sm", sidebarFormClasses.button)}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                  {(status.length ? status : ["potential"]).map((s) => (
                    <Badge
                      key={s}
                      variant="outline"
                      className={cn(
                        "flex h-6 items-center gap-1 px-2 py-0 text-xs font-medium",
                        getStatusTextColor(s)
                      )}
                    >
                      <span className="max-w-[8rem] truncate">
                        {formatContactStatusLabel(s)}
                      </span>
                      {status.includes(s) && (
                        <span
                          role="button"
                          tabIndex={-1}
                          onPointerDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatus((prev) => prev.filter((value) => value !== s));
                          }}
                          className="ml-1 inline-flex items-center justify-center rounded-full px-1 text-[10px] leading-none hover:bg-background/40"
                          aria-label={`Remove ${formatContactStatusLabel(s)}`}
                        >
                          ×
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className={cn("max-h-[320px] w-64 overflow-y-auto text-sm", sidebarFormClasses.popover)}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Tap to toggle contact statuses
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {CONTACT_STATUS_OPTIONS.map((statusOption) => {
              const textColor =
                getStatusTextColor(statusOption.value)
                  .split(" ")
                  .find((c) => c.startsWith("text-")) ?? "";
              const isActive = status.includes(statusOption.value);
              return (
                <DropdownMenuCheckboxItem
                  key={statusOption.value}
                  checked={isActive}
                  onCheckedChange={(checked) => {
                    setStatus((prev) =>
                      toggleContactStatusForForm(prev, statusOption.value, !!checked)
                    );
                  }}
                  onSelect={(e) => e.preventDefault()}
                  className={cn("flex items-center justify-between gap-2 py-2.5 text-sm", textColor)}
                >
                  <span>{statusOption.label}</span>
                  {isActive && (
                    <span className="ml-2 inline-flex h-5 items-center rounded-full bg-primary/10 px-2 text-[10px] uppercase tracking-wide text-primary">
                      ACTIVE
                    </span>
                  )}
                </DropdownMenuCheckboxItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {isCongregationContext && (
        <div className="grid gap-1">
          <Label className={sidebarFormClasses.label}>GPS</Label>
          <div className="flex gap-2">
            <Input 
              className={cn("flex-1", sidebarFormClasses.input)}
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
              className={sidebarFormClasses.button}
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
        <Label className={sidebarFormClasses.label}>Note</Label>
        <Textarea className={sidebarFormClasses.textarea} value={note} onChange={e=>setNote(e.target.value)} />
      </div>
      <div className={`flex py-4 ${isEditing && (onDelete || onArchive) ? "justify-between" : "justify-end"}`}>
        {isEditing && (onDelete || onArchive) && (
          <div className="flex gap-2">
            {onDelete && (
              <Popover open={confirmOpen} onOpenChange={setConfirmOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="destructive" disabled={saving}>Delete</Button>
                </PopoverTrigger>
                <PopoverContent className={cn("w-56", sidebarFormClasses.popover)} align="start">
                  <div className="space-y-3">
                    <p className="text-sm">Delete this contact?</p>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" className={sidebarFormClasses.button} onClick={() => setConfirmOpen(false)}>Cancel</Button>
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
                <PopoverContent className={cn("w-56", sidebarFormClasses.popover)} align="start">
                  <div className="space-y-3">
                    <p className="text-sm">Archive this contact?</p>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" className={sidebarFormClasses.button} onClick={() => setArchiveConfirmOpen(false)}>Cancel</Button>
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
        <Button type="submit" className={sidebarFormClasses.primaryButton} disabled={saving}>
          {saving ? (isEditing ? "Updating..." : "Saving...") : (isEditing ? "Update" : "Save")}
        </Button>
      </div>
    </form>
  );
}
