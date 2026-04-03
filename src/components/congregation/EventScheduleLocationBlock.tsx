"use client";

import { Building2, MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EventSchedule } from "@/lib/db/eventSchedules";
import {
  eventMapsDirectionsUrl,
  eventTypeImpliesKingdomHall,
  formatEventLocationSummary,
} from "@/lib/utils/event-location-display";

interface EventScheduleLocationBlockProps {
  event: EventSchedule;
}

export function EventScheduleLocationBlock({ event }: EventScheduleLocationBlockProps) {
  if (eventTypeImpliesKingdomHall(event.event_type)) return null;

  const summary = formatEventLocationSummary(event);
  const name = event.venue_name?.trim();
  const addr = event.venue_address?.trim();
  const lat = event.location_lat;
  const lng = event.location_lng;
  const hasCoords = lat != null && lng != null;
  const directionsUrl = eventMapsDirectionsUrl(event);
  const legacy = event.location?.trim();

  if (!name && !addr && !hasCoords && !legacy) {
    return <p className="text-sm text-muted-foreground">No location set</p>;
  }

  const showStructured = !!(name || addr || hasCoords);

  if (showStructured) {
    return (
      <div className="space-y-3 text-sm">
        {name ? (
          <div>
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Venue
            </p>
            <p className="font-medium text-foreground">{name}</p>
          </div>
        ) : null}
        {addr ? (
          <div>
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Address
            </p>
            <p className="text-muted-foreground whitespace-pre-wrap">{addr}</p>
          </div>
        ) : null}
        {hasCoords ? (
          <p className="text-xs text-muted-foreground tabular-nums">
            GPS coordinates: {Number(lat).toFixed(6)} {Number(lng).toFixed(6)}
          </p>
        ) : null}
        {directionsUrl ? (
          <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
            <a href={directionsUrl} target="_blank" rel="noopener noreferrer">
              <Navigation className="h-4 w-4 mr-2" aria-hidden />
              Directions
            </a>
          </Button>
        ) : null}
        {!name && !addr && legacy ? (
          <div className="flex items-start gap-2 text-muted-foreground pt-1 border-t border-border/60">
            <MapPin className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
            <span className="whitespace-pre-wrap">{legacy}</span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 text-sm text-muted-foreground">
      <MapPin className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      <span className="whitespace-pre-wrap">{legacy ?? summary}</span>
    </div>
  );
}
