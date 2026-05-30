"use client";

import type { ReactNode } from "react";
import { Calendar, Clock, MapPin, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";
import type { EventSchedule } from "@/lib/db/eventSchedules";
import { formatTimeLabel, getNextOccurrenceOnOrAfter } from "@/lib/utils/recurrence";
import {
  formatEventDetailPrimaryDate,
  getEventScheduleListTypeSubtitle,
} from "@/lib/utils/event-schedule-display";
import { eventTypeImpliesKingdomHall } from "@/lib/utils/event-location-display";
import { EventScheduleLocationBlock } from "@/components/congregation/EventScheduleLocationBlock";

function formatEventDetailTimeLine(event: EventSchedule): string | null {
  if (event.is_all_day) return "All day";
  if (!event.start_time) return null;
  const start = formatTimeLabel(event.start_time);
  if (event.end_time) return `${start} – ${formatTimeLabel(event.end_time)}`;
  return start;
}

function DetailSection({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: typeof Calendar;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border p-4 space-y-2.5",
        studyBibleDarkClasses.divider,
        "bg-muted/25 dark:bg-[#2a2534]/50",
        className
      )}
    >
      <div className={cn("flex items-center gap-2 text-xs font-semibold uppercase tracking-wide", studyBibleDarkClasses.muted)}>
        <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
        {label}
      </div>
      {children}
    </section>
  );
}

export interface EventScheduleDetailPanelProps {
  event: EventSchedule;
  className?: string;
}

/** Structured read-only detail for event right sheets and modals. */
export function EventScheduleDetailPanel({ event, className }: EventScheduleDetailPanelProps) {
  const detailNext = getNextOccurrenceOnOrAfter(event, new Date());
  const dateLine = formatEventDetailPrimaryDate(event, detailNext);
  const timeLine = formatEventDetailTimeLine(event);
  const typeSubtitle = getEventScheduleListTypeSubtitle(event);
  const notes = event.description?.trim();
  const showLocation = !eventTypeImpliesKingdomHall(event.event_type);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Sheet title is the event name; only show event type here when it differs (e.g. custom title). */}
      {typeSubtitle ? (
        <p
          className={cn(
            "text-sm leading-snug -mt-1 text-center md:text-left",
            studyBibleDarkClasses.muted
          )}
        >
          {typeSubtitle}
        </p>
      ) : null}

      <DetailSection icon={Calendar} label="When">
        <p className="text-base font-medium leading-snug text-foreground dark:text-[#fffaff]">{dateLine}</p>
        {timeLine ? (
          <p className={cn("flex items-center gap-1.5 text-sm", studyBibleDarkClasses.subtle)}>
            <Clock className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
            {timeLine}
          </p>
        ) : null}
      </DetailSection>

      {showLocation ? (
        <DetailSection icon={MapPin} label="Where">
          <EventScheduleLocationBlock event={event} layout="panel" />
        </DetailSection>
      ) : null}

      {notes ? (
        <DetailSection icon={StickyNote} label="Notes">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground dark:text-[#fffaff]">{notes}</p>
        </DetailSection>
      ) : null}
    </div>
  );
}
