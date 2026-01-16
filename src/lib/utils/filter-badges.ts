"use client";

export type FilterBadge = {
  type: "status" | "area" | "floor";
  value: string;
  label: string;
};

export function buildFilterBadges({
  statuses,
  areas,
  floors,
  formatStatusLabel
}: {
  statuses: string[];
  areas: string[];
  floors?: string[];
  formatStatusLabel: (status: string) => string;
}): FilterBadge[] {
  const badges: FilterBadge[] = [];

  statuses.forEach((status) => {
    badges.push({ type: "status", value: status, label: formatStatusLabel(status) });
  });

  areas.forEach((area) => {
    badges.push({ type: "area", value: area, label: area });
  });

  (floors ?? []).forEach((floor) => {
    badges.push({ type: "floor", value: floor, label: floor });
  });

  return badges;
}
