"use client";

import type { EventType, MinistryType, RecurrencePattern } from "@/lib/db/eventSchedules";

const PREFIX = "event-schedule-draft:v1:";

export interface EventScheduleDraftV1 {
  v: 1;
  eventType: EventType;
  ministryType: MinistryType | "";
  title: string;
  description: string;
  startDate: string | null;
  endDate: string | null;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  recurrencePattern: RecurrencePattern;
  recurrenceEndDate: string | null;
  dayOfWeek: string;
  dayOfMonth: string;
  monthOfYear: string;
  recurrenceInterval: number;
  location: string;
  venueName: string;
  venueAddress: string;
  locationLat: number | null;
  locationLng: number | null;
  showLocationCoords: boolean;
  activePanel: "form" | "date" | "time" | "recurrence";
}

function key(congregationId: string) {
  return `${PREFIX}${congregationId}`;
}

export function readEventScheduleDraft(congregationId: string): EventScheduleDraftV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key(congregationId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EventScheduleDraftV1;
    if (parsed?.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeEventScheduleDraft(congregationId: string, draft: EventScheduleDraftV1): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key(congregationId), JSON.stringify(draft));
  } catch {
    // quota / private mode
  }
}

export function clearEventScheduleDraft(congregationId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(key(congregationId));
  } catch {
    // ignore
  }
}
