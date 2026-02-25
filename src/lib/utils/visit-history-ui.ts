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
  const name = `${publisher.first_name ?? ""} ${publisher.last_name ?? ""}`.trim();
  return name || "Unknown Publisher";
}

/** Display string for visit participants (publisher + partner), including guest names. */
export function getVisitParticipantsDisplayName(visit: {
  publisher?: { first_name?: string; last_name?: string } | null;
  partner?: { first_name?: string; last_name?: string } | null;
  publisher_guest_name?: string | null;
  partner_guest_name?: string | null;
}): string {
  const v = visit as Record<string, unknown>;
  const pubGuest = String((v.publisher_guest_name ?? visit.publisher_guest_name) ?? "").trim();
  const partGuest = String((v.partner_guest_name ?? visit.partner_guest_name) ?? "").trim();

  const hasPublisherName = (p: typeof visit.publisher) =>
    p && `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim().length > 0;
  const publisherName = hasPublisherName(visit.publisher)
    ? `${visit.publisher!.first_name ?? ""} ${visit.publisher!.last_name ?? ""}`.trim()
    : pubGuest;
  const partnerName = hasPublisherName(visit.partner)
    ? `${visit.partner!.first_name ?? ""} ${visit.partner!.last_name ?? ""}`.trim()
    : partGuest;
  const parts = [publisherName, partnerName].filter(Boolean);
  if (parts.length === 0) return "Unknown";
  return parts.join(", ");
}

export function getInitials(name: string): string {
  return name?.trim()?.charAt(0).toUpperCase() || "?";
}

/** Two-letter initials from a display name (e.g. "John Doe" -> "JD", "Guest" -> "GU"). For avatar fallbacks. */
export function getInitialsFromName(name: string): string {
  const s = (name ?? "").trim();
  if (!s) return "?";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  return s.slice(0, 2).toUpperCase() || "?";
}

export function getVisitDisplayName(visit: VisitRecord): string {
  return visit.householder_name || visit.establishment_name || "";
}

export function getVisitSearchText(visit: VisitRecord): string {
  const name = getVisitDisplayName(visit);
  const notes = visit.notes || "";
  return `${name} ${notes}`.toLowerCase();
}
