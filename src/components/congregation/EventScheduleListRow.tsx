"use client";

import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";
import type { EventSchedule } from "@/lib/db/eventSchedules";
import { getEventTypeAccentRailClass } from "@/lib/utils/event-type-accent";
import {
  formatEventListDateLine,
  getEventScheduleListPrimaryLabel,
  getEventScheduleListTypeSubtitle,
} from "@/lib/utils/event-schedule-display";
import {
  eventMapsDirectionsUrl,
  formatEventLocationSummaryForDisplay,
} from "@/lib/utils/event-location-display";
import { EventScheduleDirectionsLink } from "@/components/congregation/EventScheduleDirectionsLink";

export interface EventScheduleListRowProps {
  event: EventSchedule;
  displayYmd: string;
  onClick?: () => void;
  /** e.g. past / ended hint on admin “All” tab */
  statusHint?: string;
  showChevron?: boolean;
  /** Highlights the row when the schedule occurs on the current local day. */
  isToday?: boolean;
  className?: string;
}

/**
 * Compact event row for home and congregation lists — single title line, optional type subtitle, date + location meta.
 */
export function EventScheduleListRow({
  event,
  displayYmd,
  onClick,
  statusHint,
  showChevron = false,
  isToday = false,
  className,
}: EventScheduleListRowProps) {
  const primary = getEventScheduleListPrimaryLabel(event);
  const typeSubtitle = getEventScheduleListTypeSubtitle(event);
  const dateLine = formatEventListDateLine(event, displayYmd);
  const location = formatEventLocationSummaryForDisplay(event);
  const railClass = getEventTypeAccentRailClass(event.event_type);
  const hasTrailing = Boolean(eventMapsDirectionsUrl(event)) || showChevron;

  const content = (
    <>
      <span
        className={cn(
          "shrink-0 self-stretch rounded-full min-h-[2.5rem]",
          isToday ? "w-1 shadow-[0_0_10px_rgba(128,119,142,0.45)]" : "w-0.5",
          railClass
        )}
        aria-hidden
      />
      <div className="min-w-0 flex-1 py-3.5 pl-3 pr-1">
        <p className="text-sm font-medium leading-snug text-foreground dark:text-[#fffaff] line-clamp-2">
          {primary}
        </p>
        {typeSubtitle ? (
          <p className={cn("mt-0.5 text-xs leading-snug line-clamp-1", studyBibleDarkClasses.muted)}>
            {typeSubtitle}
          </p>
        ) : null}
        <p className={cn("mt-1 text-xs leading-snug", studyBibleDarkClasses.subtle)}>
          {dateLine}
          {statusHint ? (
            <span className="ml-1.5 text-[10px] uppercase tracking-wide opacity-80">{statusHint}</span>
          ) : null}
        </p>
        {location ? (
          <p className={cn("mt-0.5 text-xs leading-snug line-clamp-2", studyBibleDarkClasses.muted)}>
            {location}
          </p>
        ) : null}
      </div>
      {hasTrailing ? (
        <div className="flex shrink-0 items-center gap-1.5 self-center py-3.5 pl-1 pr-0.5">
          <EventScheduleDirectionsLink event={event} variant="icon" />
          {showChevron ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground/70 dark:text-[#cfc5db]/70" aria-hidden />
          ) : null}
        </div>
      ) : null}
    </>
  );

  const rowSurface = isToday
    ? "bg-[#ece8f2]/90 ring-1 ring-inset ring-[#6b5196]/30 dark:bg-[#80778e]/22 dark:ring-[#80778e]/50"
    : undefined;
  const rowHover = isToday
    ? "hover:bg-[#e4deea] dark:hover:bg-[#80778e]/30"
    : "hover:bg-muted/30 dark:hover:bg-[#3b3348]/40";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn("flex w-full items-stretch text-left transition-colors", rowSurface, rowHover, className)}
      >
        {content}
      </button>
    );
  }

  return <div className={cn("flex w-full items-stretch", rowSurface, className)}>{content}</div>;
}
