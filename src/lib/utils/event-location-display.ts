import type { EventSchedule, EventType } from "@/lib/db/eventSchedules";

/** Event types that use venue name, address, and coordinates for maps/directions. */
export const EVENT_TYPES_WITH_VENUE_DETAILS: readonly EventType[] = [
  "cabr",
  "caco",
  "regional_convention",
  "memorial",
] as const;

export function eventTypeUsesVenueDetails(eventType: EventType): boolean {
  return (EVENT_TYPES_WITH_VENUE_DETAILS as readonly string[]).includes(eventType);
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

export function eventMapsDirectionsUrl(
  event: Pick<EventSchedule, "location_lat" | "location_lng">
): string | null {
  const lat = event.location_lat;
  const lng = event.location_lng;
  if (lat == null || lng == null) return null;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (Number.isNaN(nLat) || Number.isNaN(nLng)) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${nLat},${nLng}`;
}
