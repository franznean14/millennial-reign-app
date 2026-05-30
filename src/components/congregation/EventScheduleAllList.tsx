"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { EventScheduleTodayDivider } from "@/components/congregation/EventScheduleTodayDivider";
import { cn } from "@/lib/utils";
import { studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";
import {
  splitEventScheduleRowsPastAndUpcoming,
  type EventScheduleAllRow,
} from "@/lib/utils/event-schedule-display";
import { isEventScheduleOccurringToday } from "@/lib/utils/recurrence";

export type EventScheduleAllListRenderContext = {
  isOccurringToday: boolean;
};

interface EventScheduleAllListProps {
  rows: EventScheduleAllRow[];
  renderRow: (row: EventScheduleAllRow, context: EventScheduleAllListRenderContext) => ReactNode;
  className?: string;
  emptyText?: string;
  isEmpty?: boolean;
}

export function EventScheduleAllList({
  rows,
  renderRow,
  className,
  emptyText = "No events scheduled.",
  isEmpty,
}: EventScheduleAllListProps) {
  const { past, upcoming } = useMemo(() => splitEventScheduleRowsPastAndUpcoming(rows), [rows]);

  const today = new Date();
  const upcomingHasToday = upcoming.some((row) => isEventScheduleOccurringToday(row.event, today));

  const showTodayDivider = past.length > 0 && upcoming.length > 0 && !upcomingHasToday;

  if (isEmpty ?? rows.length === 0) {
    return <div className={cn("text-sm text-muted-foreground", studyBibleDarkClasses.muted)}>{emptyText}</div>;
  }

  const renderWithToday = (row: EventScheduleAllRow, keyPrefix: string, index: number) => {
    const isOccurringToday = isEventScheduleOccurringToday(row.event, today);
    return (
      <div key={`${keyPrefix}-${row.event.id ?? `${row.displayYmd}-${row.event.title}`}-${index}`}>
        {renderRow(row, { isOccurringToday })}
      </div>
    );
  };

  return (
    <div className={className}>
      {past.map((row, index) => renderWithToday(row, "past", index))}
      {showTodayDivider ? <EventScheduleTodayDivider /> : null}
      {upcoming.map((row, index) => renderWithToday(row, "upcoming", index))}
    </div>
  );
}
