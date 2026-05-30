export const RACK_PUSH_STATUSES = ["accepted_rack", "for_replenishment"] as const;

export type RackPushStatus = (typeof RACK_PUSH_STATUSES)[number];

export function getNewlyAddedRackStatuses(
  previousStatuses: string[] | null | undefined,
  nextStatuses: string[] | null | undefined
): RackPushStatus[] {
  const prev = new Set(previousStatuses ?? []);
  return (nextStatuses ?? []).filter(
    (s): s is RackPushStatus =>
      !prev.has(s) && (RACK_PUSH_STATUSES as readonly string[]).includes(s)
  );
}

export function buildRackStatusNotificationMessage(
  status: RackPushStatus,
  establishmentName: string,
  area: string | null | undefined
): { title: string; body: string } {
  const name = establishmentName.trim() || "Establishment";
  if (status === "accepted_rack") {
    return {
      title: "Rack accepted",
      body: `${name} accepted rack`,
    };
  }
  const place = area?.trim() || name;
  return {
    title: "For replenishment",
    body: `Rack placed in ${place}`,
  };
}

type NotificationPreferences = {
  enabled?: boolean;
  types?: string[];
};

export function userWantsPushNotifications(
  preferences: NotificationPreferences | null | undefined
): boolean {
  if (!preferences) return true;
  if (preferences.enabled === false) return false;
  const types = preferences.types ?? ["assignment", "reminder", "announcement"];
  return types.includes("announcement") || types.includes("business");
}
