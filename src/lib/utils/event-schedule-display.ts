"use client";

import { format } from "date-fns";
import type { EventSchedule } from "@/lib/db/eventSchedules";

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

/**
 * Detail sheet: prefer full calendar range when set; else single next/occurrence day.
 */
export function formatEventDetailPrimaryDate(event: EventSchedule, nextYmd: string | null): string {
  if (isCalendarDateRange(event) && event.end_date) {
    return formatScheduleDateRangeLong(event.start_date, event.end_date);
  }
  if (nextYmd) return formatScheduleDayLong(nextYmd);
  return formatScheduleDayLong(event.start_date);
}
