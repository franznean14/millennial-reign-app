"use client";

import { MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventSchedule } from "@/lib/db/eventSchedules";
import { eventMapsDirectionsUrl } from "@/lib/utils/event-location-display";

interface EventScheduleDirectionsLinkProps {
  event: EventSchedule;
  className?: string;
}

/**
 * Opens Google Maps directions when the event has latitude & longitude.
 * Compact pill for use beside the event-type badge (icon + “Directions”).
 */
export function EventScheduleDirectionsLink({ event, className }: EventScheduleDirectionsLinkProps) {
  const url = eventMapsDirectionsUrl(event);
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/60 bg-primary/10 px-2 py-0.5 text-[10px] font-medium leading-none text-primary shadow-sm transition-all hover:bg-primary/20 hover:border-primary hover:scale-[1.02] active:scale-100",
        className
      )}
      aria-label="Directions"
      title="Directions"
      onClick={(e) => e.stopPropagation()}
    >
      <MapPinned className="h-3 w-3 shrink-0" aria-hidden />
      <span>Directions</span>
    </a>
  );
}
