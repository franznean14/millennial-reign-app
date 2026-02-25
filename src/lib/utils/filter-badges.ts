"use client";

export type FilterBadge = {
  type: "status" | "area" | "floor" | "exclude_personal_territory";
  value: string;
  label: string;
};

export function buildFilterBadges({
  statuses,
  areas,
  floors,
  excludePersonalTerritory,
  formatStatusLabel
}: {
  statuses: string[];
  areas: string[];
  floors?: string[];
  excludePersonalTerritory?: boolean;
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

  if (excludePersonalTerritory) {
    badges.push({ type: "exclude_personal_territory", value: "exclude_personal_territory", label: "Exclude Personal Territory" });
  }

  return badges;
}
