"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/components/ui/sonner";
import {
  upsertEventSchedule,
  EVENT_TYPE_SELECT_OPTIONS,
  formatEventTypeLabel,
  type EventSchedule,
  type EventType,
  type MinistryType,
  type RecurrencePattern,
} from "@/lib/db/eventSchedules";
import {
  eventTypeUsesVenueDetails,
  formatEventLocationSummary,
  eventTypeImpliesKingdomHall,
} from "@/lib/utils/event-location-display";
import { formatLatLngInputValue, parseLatLngString } from "@/lib/utils/lat-lng-parse";
import {
  readEventScheduleDraft,
  writeEventScheduleDraft,
  clearEventScheduleDraft,
  type EventScheduleDraftV1,
} from "@/lib/congregation/event-schedule-draft";
import { formatTimeLabel } from "@/lib/utils/recurrence";
import { Calendar, Clock, Crosshair } from "lucide-react";
import { DateRangeSelectContent } from "@/components/ui/date-range-select-modal";
import { TimeSelectModal } from "@/components/ui/time-select-modal";
import { format } from "date-fns";

const MEMORIAL_DEFAULT_TITLE = "Memorial of Jesus' Death";

interface EventScheduleFormProps {
  congregationId: string;
  onSaved: (event?: EventSchedule) => void;
  initialData?: EventSchedule | null;
  isEditing?: boolean;
}

export function EventScheduleForm({ congregationId, onSaved, initialData = null, isEditing = false }: EventScheduleFormProps) {
  const isDraftMode = !isEditing && !initialData?.id;
  const [draftHydrated, setDraftHydrated] = useState(() => !isDraftMode);

  const initialImplicitKh = initialData?.event_type
    ? eventTypeImpliesKingdomHall(initialData.event_type)
    : false;

  const [eventType, setEventType] = useState<EventType>(initialData?.event_type || 'ministry');
  const [ministryType, setMinistryType] = useState<MinistryType | ''>(initialData?.ministry_type || '');
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(initialData?.description || "");
  const [startDate, setStartDate] = useState<Date | null>(initialData?.start_date ? new Date(initialData.start_date) : new Date());
  const [endDate, setEndDate] = useState<Date | null>(initialData?.end_date ? new Date(initialData.end_date) : null);
  const [startTime, setStartTime] = useState(initialData?.start_time?.slice(0, 5) || "");
  const [endTime, setEndTime] = useState(initialData?.end_time?.slice(0, 5) || "");
  const [isAllDay, setIsAllDay] = useState(initialData?.is_all_day ?? false);
  const [recurrencePattern, setRecurrencePattern] = useState<RecurrencePattern>(initialData?.recurrence_pattern || 'none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(initialData?.recurrence_end_date ? new Date(initialData.recurrence_end_date) : null);
  const [dayOfWeek, setDayOfWeek] = useState<string>(initialData?.day_of_week?.toString() || "");
  const [dayOfMonth, setDayOfMonth] = useState<string>(initialData?.day_of_month?.toString() || "");
  const [monthOfYear, setMonthOfYear] = useState<string>(initialData?.month_of_year?.toString() || "");
  const [recurrenceInterval, setRecurrenceInterval] = useState(initialData?.recurrence_interval || 1);
  const [location, setLocation] = useState(initialImplicitKh ? "" : (initialData?.location || ""));
  const [venueName, setVenueName] = useState(initialImplicitKh ? "" : (initialData?.venue_name ?? ""));
  const [venueAddress, setVenueAddress] = useState(initialImplicitKh ? "" : (initialData?.venue_address ?? ""));
  const [locationLat, setLocationLat] = useState<number | null>(initialImplicitKh ? null : (initialData?.location_lat ?? null));
  const [locationLng, setLocationLng] = useState<number | null>(initialImplicitKh ? null : (initialData?.location_lng ?? null));
  const [latLngInput, setLatLngInput] = useState(() => {
    if (initialImplicitKh) return "";
    const la = initialData?.location_lat;
    const ln = initialData?.location_lng;
    if (la != null && ln != null) return formatLatLngInputValue(Number(la), Number(ln));
    return "";
  });
  const [showLocationCoords, setShowLocationCoords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activePanel, setActivePanel] = useState<"form" | "date" | "time" | "recurrence">("form");
  const prevEventTypeRef = useRef<EventType | undefined>(undefined);
  const draftSnapshotRef = useRef<EventScheduleDraftV1 | null>(null);

  // Format date as YYYY-MM-DD (used by submit + draft persistence; declared before effects).
  const formatDate = (date: Date | null): string => {
    if (!date) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Restore unsaved new-event draft when reopening the FAB drawer (cleared on successful submit).
  useEffect(() => {
    if (!isDraftMode) {
      setDraftHydrated(true);
      return;
    }
    const d = readEventScheduleDraft(congregationId);
    if (d) {
      setEventType(d.eventType);
      setMinistryType(d.ministryType);
      setTitle(d.title);
      setDescription(d.description);
      setStartDate(d.startDate ? new Date(`${d.startDate}T12:00:00`) : new Date());
      setEndDate(d.endDate ? new Date(`${d.endDate}T12:00:00`) : null);
      setStartTime(d.startTime);
      setEndTime(d.endTime);
      setIsAllDay(d.isAllDay);
      setRecurrencePattern(d.recurrencePattern);
      setRecurrenceEndDate(d.recurrenceEndDate ? new Date(`${d.recurrenceEndDate}T12:00:00`) : null);
      setDayOfWeek(d.dayOfWeek);
      setDayOfMonth(d.dayOfMonth);
      setMonthOfYear(d.monthOfYear);
      setRecurrenceInterval(d.recurrenceInterval);
      if (eventTypeImpliesKingdomHall(d.eventType)) {
        setLocation("");
        setVenueName("");
        setVenueAddress("");
        setLocationLat(null);
        setLocationLng(null);
        setLatLngInput("");
        setShowLocationCoords(false);
      } else {
        setLocation(d.location);
        setVenueName(d.venueName ?? "");
        setVenueAddress(d.venueAddress ?? "");
        setLocationLat(d.locationLat);
        setLocationLng(d.locationLng);
        setLatLngInput(
          d.locationLat != null && d.locationLng != null
            ? formatLatLngInputValue(d.locationLat, d.locationLng)
            : ""
        );
        setShowLocationCoords(d.showLocationCoords);
      }
      setActivePanel(d.activePanel);
      prevEventTypeRef.current = d.eventType;
    }
    setDraftHydrated(true);
  }, [congregationId, isDraftMode]);

  // Memorial title default; clear location when switching to Meeting / CO (Kingdom Hall is implicit).
  useEffect(() => {
    if (prevEventTypeRef.current === undefined) {
      prevEventTypeRef.current = eventType;
      return;
    }
    if (eventType === "memorial" && prevEventTypeRef.current !== "memorial") {
      setTitle(MEMORIAL_DEFAULT_TITLE);
    }
    if (
      eventTypeImpliesKingdomHall(eventType) &&
      prevEventTypeRef.current !== eventType &&
      !eventTypeImpliesKingdomHall(prevEventTypeRef.current)
    ) {
      setLocation("");
      setVenueName("");
      setVenueAddress("");
      setLocationLat(null);
      setLocationLng(null);
      setLatLngInput("");
      setShowLocationCoords(false);
    }
    prevEventTypeRef.current = eventType;
  }, [eventType]);

  // Persist create-form draft while the drawer is closed (sessionStorage per congregation).
  useEffect(() => {
    if (!isDraftMode || !draftHydrated) return;
    const implicitKh = eventTypeImpliesKingdomHall(eventType);
    const venueParsed =
      !implicitKh && eventTypeUsesVenueDetails(eventType) ? parseLatLngString(latLngInput.trim()) : null;
    const draftLat = implicitKh
      ? null
      : eventTypeUsesVenueDetails(eventType)
        ? (venueParsed?.lat ?? null)
        : locationLat;
    const draftLng = implicitKh
      ? null
      : eventTypeUsesVenueDetails(eventType)
        ? (venueParsed?.lng ?? null)
        : locationLng;
    const draft: EventScheduleDraftV1 = {
      v: 1,
      eventType,
      ministryType,
      title,
      description,
      startDate: startDate ? formatDate(startDate) : null,
      endDate: endDate ? formatDate(endDate) : null,
      startTime,
      endTime,
      isAllDay,
      recurrencePattern,
      recurrenceEndDate: recurrenceEndDate ? formatDate(recurrenceEndDate) : null,
      dayOfWeek,
      dayOfMonth,
      monthOfYear,
      recurrenceInterval,
      location,
      venueName,
      venueAddress,
      locationLat: draftLat,
      locationLng: draftLng,
      showLocationCoords,
      activePanel,
    };
    draftSnapshotRef.current = draft;
    const t = window.setTimeout(() => writeEventScheduleDraft(congregationId, draft), 400);
    return () => {
      window.clearTimeout(t);
      if (draftSnapshotRef.current) {
        writeEventScheduleDraft(congregationId, draftSnapshotRef.current);
      }
    };
  }, [
    isDraftMode,
    draftHydrated,
    congregationId,
    eventType,
    ministryType,
    title,
    description,
    startDate,
    endDate,
    startTime,
    endTime,
    isAllDay,
    recurrencePattern,
    recurrenceEndDate,
    dayOfWeek,
    dayOfMonth,
    monthOfYear,
    recurrenceInterval,
    location,
    venueName,
    venueAddress,
    latLngInput,
    locationLat,
    locationLng,
    showLocationCoords,
    activePanel,
  ]);

  // Ensure drawer scroll resets when switching panels to keep header visible
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reset = () => {
      const scrollContainer = document.querySelector(".drawer-content-inner") as HTMLElement | null;
      if (scrollContainer) {
        scrollContainer.scrollTo({ top: 0, behavior: "auto" });
      }
    };
    reset();
    const timer = setTimeout(reset, 0);
    return () => clearTimeout(timer);
  }, [activePanel]);

  // Reset ministry_type when event_type changes (after draft hydrate so restored drafts are not overwritten).
  useEffect(() => {
    if (!draftHydrated) return;
    if (eventType !== "ministry") {
      setMinistryType("");
    } else if (!ministryType) {
      setMinistryType("house_to_house");
    }
  }, [eventType, draftHydrated, ministryType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!startDate) {
        toast.error("Start date is required");
        setSaving(false);
        return;
      }

      if (eventTypeUsesVenueDetails(eventType)) {
        const t = latLngInput.trim();
        if (t && !parseLatLngString(t)) {
          toast.error(
            "Latitude & longitude: enter two numbers separated by a comma or space (order is detected automatically)."
          );
          setSaving(false);
          return;
        }
      }

      const trimmedTitle = title.trim();
      if (eventType !== "annual_pioneers_meeting" && !trimmedTitle) {
        toast.error("Title is required");
        setSaving(false);
        return;
      }
      const resolvedTitle =
        eventType === "annual_pioneers_meeting" && !trimmedTitle
          ? formatEventTypeLabel("annual_pioneers_meeting")
          : trimmedTitle;

      const eventData: EventSchedule = {
        id: initialData?.id,
        congregation_id: congregationId,
        event_type: eventType,
        ministry_type: eventType === 'ministry' ? (ministryType as MinistryType) : null,
        title: resolvedTitle,
        description: description.trim() || null,
        start_date: formatDate(startDate),
        end_date: endDate ? formatDate(endDate) : null,
        start_time: isAllDay ? null : (startTime || null),
        end_time: isAllDay ? null : (endTime || null),
        is_all_day: isAllDay,
        recurrence_pattern: recurrencePattern,
        recurrence_end_date: recurrencePattern !== 'none' && recurrenceEndDate ? formatDate(recurrenceEndDate) : null,
        day_of_week: recurrencePattern === 'weekly' ? (dayOfWeek ? parseInt(dayOfWeek) : null) : null,
        day_of_month: recurrencePattern === 'monthly' ? (dayOfMonth ? parseInt(dayOfMonth) : null) : null,
        month_of_year: recurrencePattern === 'yearly' ? (monthOfYear ? parseInt(monthOfYear) : null) : null,
        recurrence_interval: recurrenceInterval,
        venue_name: eventTypeImpliesKingdomHall(eventType)
          ? null
          : eventTypeUsesVenueDetails(eventType)
            ? venueName.trim() || null
            : null,
        venue_address: eventTypeImpliesKingdomHall(eventType)
          ? null
          : eventTypeUsesVenueDetails(eventType)
            ? venueAddress.trim() || null
            : null,
        location: eventTypeImpliesKingdomHall(eventType)
          ? null
          : eventTypeUsesVenueDetails(eventType)
            ? formatEventLocationSummary({
                venue_name: venueName,
                venue_address: venueAddress,
                location: null,
              }) || null
            : location.trim() || null,
        location_lat: (() => {
          if (eventTypeImpliesKingdomHall(eventType)) return null;
          if (eventTypeUsesVenueDetails(eventType)) {
            const p = parseLatLngString(latLngInput.trim());
            return p?.lat ?? null;
          }
          return showLocationCoords ? locationLat : (initialData?.location_lat ?? null);
        })(),
        location_lng: (() => {
          if (eventTypeImpliesKingdomHall(eventType)) return null;
          if (eventTypeUsesVenueDetails(eventType)) {
            const p = parseLatLngString(latLngInput.trim());
            return p?.lng ?? null;
          }
          return showLocationCoords ? locationLng : (initialData?.location_lng ?? null);
        })(),
        status: 'active',
      };

      const result = await upsertEventSchedule(eventData);

      if (result) {
        if (isDraftMode) clearEventScheduleDraft(congregationId);
        toast.success(isEditing ? "Event schedule updated successfully!" : "Event schedule created successfully!");
        onSaved(result);
      } else {
        toast.error(
          isEditing
            ? "Failed to update event schedule"
            : "Failed to create event schedule. If you chose a new event type, apply the latest database migration (event_type_t) to your Supabase project."
        );
      }
    } catch (error) {
      toast.error(isEditing ? "Error updating event schedule" : "Error creating event schedule");
      console.error('Error saving event schedule:', error);
    } finally {
      setSaving(false);
    }
  };

  const weekDays = [
    { value: '0', label: 'Sunday' },
    { value: '1', label: 'Monday' },
    { value: '2', label: 'Tuesday' },
    { value: '3', label: 'Wednesday' },
    { value: '4', label: 'Thursday' },
    { value: '5', label: 'Friday' },
    { value: '6', label: 'Saturday' },
  ];

  const months = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  if (activePanel !== "form") {
    const panelDescription =
      activePanel === "date"
        ? "Choose a single date or select a range"
        : activePanel === "time"
          ? "Choose start and end time"
          : "Choose when recurrence ends";

    return (
      <div className="space-y-4 pb-10">
        <div className="text-sm text-muted-foreground">{panelDescription}</div>

        {activePanel === "date" && (
          <>
            <DateRangeSelectContent
              startDate={startDate || undefined}
              endDate={endDate || undefined}
              allowRange={true}
              showActions
              onSelect={(start, end) => {
                setStartDate(start);
                if (end) {
                  setEndDate(end);
                } else {
                  setEndDate(null);
                }
              }}
              onConfirm={(start, end) => {
                setStartDate(start);
                setEndDate(end ?? null);
                setActivePanel("form");
              }}
              onCancel={() => setActivePanel("form")}
            />
          </>
        )}

        {activePanel === "time" && (
          <TimeSelectModal
            inline
            open={true}
            onOpenChange={() => {}}
            startValue={startTime}
            endValue={endTime}
            onSelect={(start, end) => {
              setStartTime(start);
              setEndTime(end);
              setActivePanel("form");
            }}
            onRequestClose={() => setActivePanel("form")}
            title="Select Time"
            description="Choose start and end time"
          />
        )}

        {activePanel === "recurrence" && (
          <>
            <DateRangeSelectContent
              startDate={recurrenceEndDate || undefined}
              allowRange={false}
              showActions
              onSelect={(date) => {
                if (startDate && date >= startDate) {
                  setRecurrenceEndDate(date);
                } else {
                  toast.error("Recurrence end date must be after start date");
                }
              }}
              onConfirm={(date) => {
                if (startDate && date >= startDate) {
                  setRecurrenceEndDate(date);
                  setActivePanel("form");
                } else {
                  toast.error("Recurrence end date must be after start date");
                }
              }}
              onCancel={() => setActivePanel("form")}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <form className="grid gap-3 pb-10" onSubmit={handleSubmit}>
      <div className="grid gap-1">
        <Label>Event Type</Label>
        <Select value={eventType} onValueChange={(v) => setEventType(v as EventType)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {EVENT_TYPE_SELECT_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {eventType === 'ministry' && (
        <div className="grid gap-1">
          <Label>Ministry Type</Label>
          <Select value={ministryType} onValueChange={(v) => setMinistryType(v as MinistryType)}>
            <SelectTrigger><SelectValue placeholder="Select ministry type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="house_to_house">House-to-House</SelectItem>
              <SelectItem value="business_witnessing">Business Witnessing</SelectItem>
              <SelectItem value="memorial_campaign">Memorial Campaign</SelectItem>
              <SelectItem value="telephone">Telephone</SelectItem>
              <SelectItem value="letter_writing">Letter Writing</SelectItem>
              <SelectItem value="public_witnessing">Public Witnessing</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid gap-1">
        <Label>Title{eventType === "annual_pioneers_meeting" ? " (optional)" : ""}</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required={eventType !== "annual_pioneers_meeting"}
          placeholder={eventType === "annual_pioneers_meeting" ? "Optional" : undefined}
        />
      </div>

      <div className="grid gap-1">
        <Label>Description</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>

      <div className="grid gap-1">
        <Label>Date</Label>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start text-left font-normal"
          onClick={() => setActivePanel("date")}
        >
          <Calendar className="mr-2 h-4 w-4" />
          {startDate && endDate ? (
            <span>{format(startDate, "PPP")} → {format(endDate, "PPP")}</span>
          ) : startDate ? (
            <span>{format(startDate, "PPP")}</span>
          ) : (
            <span className="text-muted-foreground">Select date or range</span>
          )}
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox 
          id="all-day" 
          checked={isAllDay} 
          onCheckedChange={(checked) => setIsAllDay(checked === true)}
        />
        <Label htmlFor="all-day" className="cursor-pointer">All Day Event</Label>
      </div>

      {!isAllDay && (
        <div className="grid gap-1">
          <Label>Time</Label>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-start text-left font-normal"
            onClick={() => setActivePanel("time")}
          >
            <Clock className="mr-2 h-4 w-4" />
            {startTime && endTime ? (
              <span>{formatTimeLabel(startTime)} → {formatTimeLabel(endTime)}</span>
            ) : startTime ? (
              <span>{formatTimeLabel(startTime)} → Select end time</span>
            ) : (
              <span className="text-muted-foreground">09:00AM → 05:00PM</span>
            )}
          </Button>
        </div>
      )}

      <div className="grid gap-1">
        <Label>Recurrence</Label>
        <Select value={recurrencePattern} onValueChange={(v) => setRecurrencePattern(v as RecurrencePattern)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Recurrence</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {recurrencePattern === 'weekly' && (
        <div className="grid gap-1">
          <Label>Day of Week</Label>
          <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
            <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
            <SelectContent>
              {weekDays.map(day => (
                <SelectItem key={day.value} value={day.value}>{day.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {recurrencePattern === 'monthly' && (
        <div className="grid gap-1">
          <Label>Day of Month (1-31)</Label>
          <Input 
            type="number" 
            min="1" 
            max="31" 
            value={dayOfMonth} 
            onChange={(e) => setDayOfMonth(e.target.value)}
            placeholder="e.g., 15"
          />
        </div>
      )}

      {recurrencePattern === 'yearly' && (
        <>
          <div className="grid gap-1">
            <Label>Month</Label>
            <Select value={monthOfYear} onValueChange={setMonthOfYear}>
              <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
              <SelectContent>
                {months.map(month => (
                  <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label>Day of Month (1-31)</Label>
            <Input 
              type="number" 
              min="1" 
              max="31" 
              value={dayOfMonth} 
              onChange={(e) => setDayOfMonth(e.target.value)}
              placeholder="e.g., 15"
            />
          </div>
        </>
      )}

      {recurrencePattern !== 'none' && (
        <>
          <div className="grid gap-1">
            <Label>Repeat Every (interval)</Label>
            <Input 
              type="number" 
              min="1" 
              value={recurrenceInterval} 
              onChange={(e) => setRecurrenceInterval(parseInt(e.target.value) || 1)}
              placeholder="e.g., 2 for every 2 weeks"
            />
          </div>
          <div className="grid gap-1">
            <Label>Recurrence End Date (optional, leave empty for indefinite)</Label>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start text-left font-normal"
              onClick={() => setActivePanel("recurrence")}
            >
              <Calendar className="mr-2 h-4 w-4" />
              {recurrenceEndDate ? (
                <span>{format(recurrenceEndDate, "PPP")}</span>
              ) : (
                <span className="text-muted-foreground">Select recurrence end date</span>
              )}
            </Button>
          </div>
        </>
      )}

      {eventTypeUsesVenueDetails(eventType) ? (
        <div className="grid gap-3">
          <div className="grid gap-1">
            <Label>Venue name</Label>
            <Input
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="e.g., Iloilo Convention Center"
            />
          </div>
          <div className="grid gap-1">
            <Label>Address</Label>
            <Textarea
              value={venueAddress}
              onChange={(e) => setVenueAddress(e.target.value)}
              placeholder="Street, barangay, city, postal code"
              rows={4}
              className="min-h-[88px] resize-y"
            />
          </div>
          <div className="grid gap-1">
            <Label>Latitude & longitude</Label>
            <div className="flex items-center gap-2">
              <Input
                value={latLngInput}
                onChange={(e) => setLatLngInput(e.target.value)}
                onBlur={() => {
                  const t = latLngInput.trim();
                  if (!t) {
                    setLocationLat(null);
                    setLocationLng(null);
                    return;
                  }
                  const p = parseLatLngString(t);
                  if (p) {
                    setLocationLat(p.lat);
                    setLocationLng(p.lng);
                    setLatLngInput(formatLatLngInputValue(p.lat, p.lng));
                  }
                }}
                placeholder="e.g. 10.714535, 122.545075"
                className="min-w-0 flex-1"
                autoComplete="off"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                aria-label="Use current location for coordinates"
                onClick={() => {
                  if (!navigator.geolocation) {
                    toast.error("Geolocation is not supported on this device");
                    return;
                  }
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const { latitude, longitude } = position.coords;
                      setLocationLat(latitude);
                      setLocationLng(longitude);
                      setLatLngInput(formatLatLngInputValue(latitude, longitude));
                      toast.success("Coordinates captured");
                    },
                    (error) => {
                      toast.error(error.message || "Unable to get location");
                    },
                    { enableHighAccuracy: true, timeout: 10000 }
                  );
                }}
              >
                <Crosshair className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : !eventTypeImpliesKingdomHall(eventType) ? (
        <div className="grid gap-1">
          <Label>Location</Label>
          <div className="flex items-center gap-2">
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Kingdom Hall"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Use current location"
              onClick={() => {
                if (!navigator.geolocation) {
                  toast.error("Geolocation is not supported on this device");
                  return;
                }
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    const { latitude, longitude } = position.coords;
                    setLocationLat(latitude);
                    setLocationLng(longitude);
                    setShowLocationCoords(true);
                    toast.success("Location captured");
                  },
                  (error) => {
                    toast.error(error.message || "Unable to get location");
                  },
                  { enableHighAccuracy: true, timeout: 10000 }
                );
              }}
            >
              <Crosshair className="h-4 w-4" />
            </Button>
          </div>
          {showLocationCoords && (
            <div className="grid gap-1">
              <Label className="text-xs text-muted-foreground">Lat / Long</Label>
              <Input
                readOnly
                value={
                  locationLat !== null && locationLng !== null
                    ? `${locationLat.toFixed(6)}, ${locationLng.toFixed(6)}`
                    : ""
                }
              />
            </div>
          )}
        </div>
      ) : null}

      <div className="flex justify-end py-4">
        <Button type="submit" disabled={saving}>
          {saving ? (isEditing ? "Updating..." : "Creating...") : (isEditing ? "Update" : "Create")}
        </Button>
      </div>
    </form>
  );
}
