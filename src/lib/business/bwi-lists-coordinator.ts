"use client";

import {
  getEstablishmentsWithDetails,
  listHouseholders,
  type EstablishmentWithDetails,
  type HouseholderWithDetails,
} from "@/lib/db/business";

/**
 * Single in-flight fetch for establishment + householder list queries.
 * CallHistory and AppClient realtime refetches can overlap; this dedupes concurrent Disk IO.
 */
let inflight: Promise<[EstablishmentWithDetails[], HouseholderWithDetails[]]> | null = null;

export function getSharedEstablishmentsAndHouseholders(): Promise<
  [EstablishmentWithDetails[], HouseholderWithDetails[]]
> {
  if (!inflight) {
    inflight = Promise.all([getEstablishmentsWithDetails(), listHouseholders()]).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
