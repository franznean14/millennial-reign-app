"use client";

import { MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventSchedule } from "@/lib/db/eventSchedules";
import { eventMapsDirectionsUrl } from "@/lib/utils/event-location-display";

interface EventScheduleDirectionsLinkProps {
  event: EventSchedule;
  className?: string;
  variant?: "pill" | "icon";
}

/**
 * Opens Google Maps directions when the event has latitude & longitude.
 */
export function EventScheduleDirectionsLink({
  event,
  className,
  variant = "pill",
}: EventScheduleDirectionsLinkProps) {
  const url = eventMapsDirectionsUrl(event);
  if (!url) return null;

  if (variant === "icon") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#e2dde8] text-[#6b5196] transition-colors hover:bg-[#ece8f2] dark:border-[#5a5068] dark:text-[#ded6e7] dark:hover:bg-[#3b3348]",
          className
        )}
        aria-label="Directions"
        title="Directions"
        onClick={(e) => e.stopPropagation()}
      >
        <MapPinned className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </a>
    );
  }

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
