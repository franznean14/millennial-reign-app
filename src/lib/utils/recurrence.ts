"use client";

import type { EventSchedule } from "@/lib/db/eventSchedules";

export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isEventOccurringToday(event: EventSchedule, today: Date): boolean {
  if (event.status !== "active") return false;
  if (event.event_type !== "ministry") return false;

  const todayStr = toLocalDateString(today);
  const todayDayOfWeek = today.getDay();
  const todayDayOfMonth = today.getDate();
  const todayMonth = today.getMonth() + 1;

  if (todayStr < event.start_date) return false;
  if (event.recurrence_end_date && todayStr > event.recurrence_end_date) return false;

  if (event.recurrence_pattern === "none") {
    if (event.end_date) {
      return todayStr >= event.start_date && todayStr <= event.end_date;
    }
    return todayStr === event.start_date;
  }

  if (event.recurrence_pattern === "weekly") {
    if (event.day_of_week == null) return false;
    if (event.day_of_week !== todayDayOfWeek) return false;

    const startDate = new Date(event.start_date);
    const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const weeksDiff = Math.floor(daysDiff / 7);
    return weeksDiff % event.recurrence_interval === 0;
  }

  if (event.recurrence_pattern === "monthly") {
    if (event.day_of_month == null) return false;
    if (event.day_of_month !== todayDayOfMonth) return false;

    const startDate = new Date(event.start_date);
    const monthsDiff =
      (today.getFullYear() - startDate.getFullYear()) * 12 + (today.getMonth() - startDate.getMonth());
    return monthsDiff % event.recurrence_interval === 0;
  }

  if (event.recurrence_pattern === "yearly") {
    if (event.month_of_year == null || event.day_of_month == null) return false;
    if (event.month_of_year !== todayMonth || event.day_of_month !== todayDayOfMonth) return false;

    const startDate = new Date(event.start_date);
    const yearsDiff = today.getFullYear() - startDate.getFullYear();
    return yearsDiff % event.recurrence_interval === 0;
  }

  return false;
}

/** Next calendar date (local) on which the event occurs, on or after `from`, or null if none. For non-ministry schedules (meetings, memorial, etc.). */
export function getNextOccurrenceOnOrAfter(event: EventSchedule, from: Date): string | null {
  if (event.status !== "active") return null;
  const fromStr = toLocalDateString(from);
  const interval = Math.max(1, event.recurrence_interval || 1);
  const endCap = event.recurrence_end_date;

  const beforeRecurrenceEnd = (d: string) => !endCap || d <= endCap;

  if (event.recurrence_pattern === "none") {
    if (event.end_date) {
      if (fromStr > event.end_date) return null;
      if (fromStr < event.start_date) return event.start_date;
      return fromStr;
    }
    if (fromStr <= event.start_date) return event.start_date;
    return null;
  }

  if (event.recurrence_pattern === "custom") {
    return null;
  }

  const startAnchor = new Date(`${event.start_date}T12:00:00`);
  let cursor = new Date(from);
  cursor.setHours(12, 0, 0, 0);
  if (toLocalDateString(cursor) < event.start_date) {
    cursor = new Date(`${event.start_date}T12:00:00`);
  }

  for (let i = 0; i < 800; i++) {
    const s = toLocalDateString(cursor);
    if (!beforeRecurrenceEnd(s)) return null;
    if (s < event.start_date) {
      cursor.setDate(cursor.getDate() + 1);
      continue;
    }

    if (event.recurrence_pattern === "weekly") {
      if (event.day_of_week != null && cursor.getDay() === event.day_of_week) {
        const daysDiff = Math.floor((cursor.getTime() - startAnchor.getTime()) / (1000 * 60 * 60 * 24));
        const weeksDiff = Math.floor(daysDiff / 7);
        if (weeksDiff >= 0 && weeksDiff % interval === 0 && s >= fromStr) {
          return s;
        }
      }
    } else if (event.recurrence_pattern === "monthly") {
      if (event.day_of_month != null && cursor.getDate() === event.day_of_month) {
        const monthsDiff =
          (cursor.getFullYear() - startAnchor.getFullYear()) * 12 +
          (cursor.getMonth() - startAnchor.getMonth());
        if (monthsDiff >= 0 && monthsDiff % interval === 0 && s >= fromStr) {
          return s;
        }
      }
    } else if (event.recurrence_pattern === "yearly") {
      if (
        event.month_of_year != null &&
        event.day_of_month != null &&
        cursor.getMonth() + 1 === event.month_of_year &&
        cursor.getDate() === event.day_of_month
      ) {
        const yearsDiff = cursor.getFullYear() - startAnchor.getFullYear();
        if (yearsDiff >= 0 && yearsDiff % interval === 0 && s >= fromStr) {
          return s;
        }
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
}

export function formatTimeLabel(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours, 10);
  const am = h < 12;
  const h12 = h % 12 || 12;
  return `${h12}:${minutes.padStart(2, "0")} ${am ? "AM" : "PM"}`;
}
