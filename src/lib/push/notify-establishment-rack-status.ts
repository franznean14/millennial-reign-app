import { getNewlyAddedRackStatuses } from "@/lib/push/establishment-status";

/** Fire-and-forget push to other subscribed users when rack-related statuses are newly added. */
export function notifyEstablishmentRackStatusChange(params: {
  establishmentId: string;
  previousStatuses?: string[] | null;
  nextStatuses?: string[] | null;
}): void {
  const added = getNewlyAddedRackStatuses(params.previousStatuses, params.nextStatuses);
  if (added.length === 0) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  void fetch("/api/push/establishment-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      establishmentId: params.establishmentId,
      previousStatuses: params.previousStatuses ?? [],
    }),
  }).catch((err) => {
    console.warn("Establishment rack status push failed:", err);
  });
}
