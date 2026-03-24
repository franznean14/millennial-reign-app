"use client";

export type FilterBadge = {
  type: "status" | "excluded_status" | "area" | "floor" | "assignee";
  value: string;
  label: string;
  /** Profile image when filtering by publisher/partner (to-do assignee). */
  avatarUrl?: string;
};

export function buildFilterBadges({
  statuses,
  excludedStatuses,
  areas,
  floors,
  formatStatusLabel
}: {
  statuses: string[];
  excludedStatuses?: string[];
  areas: string[];
  floors?: string[];
  formatStatusLabel: (status: string) => string;
}): FilterBadge[] {
  const badges: FilterBadge[] = [];

  statuses.forEach((status) => {
    badges.push({ type: "status", value: status, label: formatStatusLabel(status) });
  });

  (excludedStatuses ?? []).forEach((status) => {
    badges.push({ type: "excluded_status", value: status, label: formatStatusLabel(status) });
  });

  areas.forEach((area) => {
    badges.push({ type: "area", value: area, label: area });
  });

  (floors ?? []).forEach((floor) => {
    badges.push({ type: "floor", value: floor, label: floor });
  });

  return badges;
}
