"use client";

import type { VisitRecord } from "@/lib/utils/visit-history";

export function formatVisitDateLong(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export function formatVisitDateShort(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function getPublisherName(publisher?: { first_name: string; last_name: string } | null): string {
  if (!publisher) return "Unknown Publisher";
  return `${publisher.first_name} ${publisher.last_name}`.trim();
}

export function getInitials(name: string): string {
  return name?.trim()?.charAt(0).toUpperCase() || "?";
}

export function getVisitDisplayName(visit: VisitRecord): string {
  return visit.householder_name || visit.establishment_name || "";
}

export function getVisitSearchText(visit: VisitRecord): string {
  const name = getVisitDisplayName(visit);
  const notes = visit.notes || "";
  return `${name} ${notes}`.toLowerCase();
}
