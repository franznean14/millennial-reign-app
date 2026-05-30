"use client";

import { format } from "date-fns";
import { formatEventTypeLabel, type EventSchedule } from "@/lib/db/eventSchedules";
import { getNextOccurrenceOnOrAfter } from "@/lib/utils/recurrence";

/** Multi-day block: one-off schedule with an end date after start (e.g. convention Aug 7–9). */
export function isCalendarDateRange(event: EventSchedule): boolean {
  return (
    event.recurrence_pattern === "none" &&
    Boolean(event.end_date) &&
    event.end_date! > event.start_date
  );
}

function parseLocalDay(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) return new Date(ymd);
  return new Date(y, m - 1, d);
}

/** "August 7, 2026" */
export function formatScheduleDayLong(ymd: string): string {
  try {
    return format(parseLocalDay(ymd), "MMMM d, yyyy");
  } catch {
    return ymd;
  }
}

/** "August 7–9, 2026" or cross-month/year variants. */
export function formatScheduleDateRangeLong(startYmd: string, endYmd: string): string {
  const s = parseLocalDay(startYmd);
  const e = parseLocalDay(endYmd);
  const sameYear = s.getFullYear() === e.getFullYear();
  const sameMonth = sameYear && s.getMonth() === e.getMonth();
  if (sameMonth) {
    return `${format(s, "MMMM d")}–${format(e, "d, yyyy")}`;
  }
  if (sameYear) {
    return `${format(s, "MMMM d")} – ${format(e, "MMMM d, yyyy")}`;
  }
  return `${format(s, "MMMM d, yyyy")} – ${format(e, "MMMM d, yyyy")}`;
}

/**
 * Timeline / list line: for multi-day non-recurring events, show the full range; otherwise the anchor day (e.g. next occurrence).
 */
export function formatEventListDateLine(event: EventSchedule, anchorYmd: string): string {
  if (isCalendarDateRange(event) && event.end_date) {
    return formatScheduleDateRangeLong(event.start_date, event.end_date);
  }
  return formatScheduleDayLong(anchorYmd);
}

export type EventScheduleAllRow = {
  event: EventSchedule;
  /** Sort/display anchor — next occurrence or original start when past. */
  displayYmd: string;
  hasNext: boolean;
};

/** All active non-ministry schedules, including past one-offs and ended recurrence. */
export function buildNonMinistryEventScheduleRows(
  events: EventSchedule[],
  now: Date = new Date()
): EventScheduleAllRow[] {
  const rows: EventScheduleAllRow[] = [];
  for (const ev of events) {
    if (ev.event_type === "ministry") continue;
    if (ev.status !== "active") continue;
    const next = getNextOccurrenceOnOrAfter(ev, now);
    rows.push({
      event: ev,
      displayYmd: next ?? ev.start_date,
      hasNext: !!next,
    });
  }
  rows.sort(
    (a, b) =>
      a.displayYmd.localeCompare(b.displayYmd) || a.event.title.localeCompare(b.event.title)
  );
  return rows;
}

/** Split sorted all-rows at the first upcoming occurrence (hasNext), for a Today divider in the UI. */
export function splitEventScheduleRowsPastAndUpcoming(rows: EventScheduleAllRow[]): {
  past: EventScheduleAllRow[];
  upcoming: EventScheduleAllRow[];
} {
  const firstUpcomingIdx = rows.findIndex((r) => r.hasNext);
  if (firstUpcomingIdx < 0) return { past: rows, upcoming: [] };
  if (firstUpcomingIdx === 0) return { past: [], upcoming: rows };
  return {
    past: rows.slice(0, firstUpcomingIdx),
    upcoming: rows.slice(firstUpcomingIdx),
  };
}

/** Primary list label — avoids repeating the type badge when title matches the event type. */
export function getEventScheduleListPrimaryLabel(event: EventSchedule): string {
  const typeLabel = formatEventTypeLabel(event.event_type);
  const title = event.title?.trim() ?? "";
  if (!title || title === typeLabel) return typeLabel;
  if (event.event_type === "circuit_overseer" && /^co\s*visit$/i.test(title)) return typeLabel;
  return title;
}

/** Muted type line when the primary label is a custom title. */
export function getEventScheduleListTypeSubtitle(event: EventSchedule): string | null {
  const typeLabel = formatEventTypeLabel(event.event_type);
  const primary = getEventScheduleListPrimaryLabel(event);
  return primary === typeLabel ? null : typeLabel;
}

export function formatEventDetailPrimaryDate(event: EventSchedule, nextYmd: string | null): string {
  if (isCalendarDateRange(event) && event.end_date) {
    return formatScheduleDateRangeLong(event.start_date, event.end_date);
  }
  if (nextYmd) return formatScheduleDayLong(nextYmd);
  return formatScheduleDayLong(event.start_date);
}
