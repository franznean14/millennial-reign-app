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

export function formatTimeLabel(timeStr: string | null | undefined): string {
  if (!timeStr) return "";
  const [hours, minutes] = timeStr.split(":");
  const h = parseInt(hours, 10);
  const am = h < 12;
  const h12 = h % 12 || 12;
  return `${h12}:${minutes.padStart(2, "0")} ${am ? "AM" : "PM"}`;
}
