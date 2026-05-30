"use client";

import {
  getEstablishmentsWithDetails,
  listContacts,
  type EstablishmentWithDetails,
  type ContactWithDetails,
} from "@/lib/db/business";

/**
 * Single in-flight fetch for establishment + contact list queries.
 * CallHistory and AppClient realtime refetches can overlap; this dedupes concurrent Disk IO.
 */
let inflight: Promise<[EstablishmentWithDetails[], ContactWithDetails[]]> | null = null;

export function getSharedEstablishmentsAndContacts(): Promise<
  [EstablishmentWithDetails[], ContactWithDetails[]]
> {
  if (!inflight) {
    inflight = Promise.all([getEstablishmentsWithDetails(), listContacts()]).finally(() => {
      inflight = null;
    });
  }
  return inflight;
}
