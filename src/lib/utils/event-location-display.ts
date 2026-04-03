import type { EventSchedule, EventType } from "@/lib/db/eventSchedules";

/** Event types that use venue name, address, and coordinates for maps/directions. */
export const EVENT_TYPES_WITH_VENUE_DETAILS: readonly EventType[] = [
  "cabr",
  "caco",
  "regional_convention",
  "memorial",
  "annual_pioneers_meeting",
] as const;

export function eventTypeUsesVenueDetails(eventType: EventType): boolean {
  return (EVENT_TYPES_WITH_VENUE_DETAILS as readonly string[]).includes(eventType);
}

/** Meeting and CO visits are held at the congregation Kingdom Hall — no separate location field. */
export function eventTypeImpliesKingdomHall(eventType: EventType): boolean {
  return eventType === "meeting" || eventType === "circuit_overseer";
}

/** Single block of text for compact lists (venue + address, or legacy `location`). */
export function formatEventLocationSummary(
  event: Pick<EventSchedule, "location" | "venue_name" | "venue_address">
): string {
  const name = event.venue_name?.trim();
  const addr = event.venue_address?.trim();
  if (name || addr) {
    return [name, addr].filter(Boolean).join("\n");
  }
  return event.location?.trim() ?? "";
}

/** Like {@link formatEventLocationSummary} but empty for types that are always at the Kingdom Hall. */
export function formatEventLocationSummaryForDisplay(
  event: Pick<EventSchedule, "event_type" | "location" | "venue_name" | "venue_address">
): string {
  if (eventTypeImpliesKingdomHall(event.event_type)) return "";
  return formatEventLocationSummary(event).trim();
}

export function eventMapsDirectionsUrl(
  event: Pick<EventSchedule, "event_type" | "location_lat" | "location_lng">
): string | null {
  if (eventTypeImpliesKingdomHall(event.event_type)) return null;
  const lat = event.location_lat;
  const lng = event.location_lng;
  if (lat == null || lng == null) return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (Number.isNaN(nLat) || Number.isNaN(nLng)) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${nLat},${nLng}`;
}
