"use client";

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
