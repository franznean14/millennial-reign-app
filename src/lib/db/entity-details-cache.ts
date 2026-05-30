import { cacheGet } from "@/lib/offline/store";
import {
  getEstablishmentDetails,
  getContactDetails,
  type EstablishmentWithDetails,
  type ContactWithDetails,
  type VisitWithUser,
} from "@/lib/db/business";

export function establishmentDetailsCacheKey(establishmentId: string) {
  return `establishment:details:${establishmentId}`;
}

export function contactDetailsCacheKey(contactId: string) {
  return `contact:details:v5:${contactId}`;
}

export type EstablishmentDetailsSnapshot = {
  establishment: EstablishmentWithDetails;
  visits: VisitWithUser[];
  contacts: ContactWithDetails[];
};

export type ContactDetailsSnapshot = {
  contact: ContactWithDetails;
  visits: VisitWithUser[];
  establishment?: { id: string; name: string; area?: string | null; statuses?: string[] | null } | null;
};

function legacyContactDetailsCacheKey(contactId: string) {
  return `householder:details:v3:${contactId}`;
}

/** Normalize IndexedDB snapshots written before the Contact rename. */
function normalizeContactDetailsSnapshot(raw: unknown): ContactDetailsSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  if (record.contact && typeof record.contact === "object") {
    return raw as ContactDetailsSnapshot;
  }
  if (record.householder && typeof record.householder === "object") {
    return {
      contact: record.householder as ContactWithDetails,
      visits: (record.visits as VisitWithUser[]) ?? [],
      establishment:
        (record.establishment as ContactDetailsSnapshot["establishment"]) ?? null,
    };
  }
  return null;
}

/** Session memory → IndexedDB → stub (same order as BWI AppClient loadEstablishmentDetails). */
export async function resolveEstablishmentDetailsSnapshot(
  establishmentId: string,
  memoryCache: Map<string, EstablishmentDetailsSnapshot>,
  fallbackStub: EstablishmentDetailsSnapshot
): Promise<{ snapshot: EstablishmentDetailsSnapshot; hadWarmCache: boolean }> {
  const fromMemory = memoryCache.get(establishmentId);
  if (fromMemory) {
    return { snapshot: fromMemory, hadWarmCache: true };
  }

  const fromIdb = await cacheGet<EstablishmentDetailsSnapshot>(
    establishmentDetailsCacheKey(establishmentId)
  );
  if (fromIdb) {
    memoryCache.set(establishmentId, fromIdb);
    return { snapshot: fromIdb, hadWarmCache: true };
  }

  return { snapshot: fallbackStub, hadWarmCache: false };
}

/** Session memory → IndexedDB → stub (same order as BWI loadContactDetailsSwr). */
export async function resolveContactDetailsSnapshot(
  contactId: string,
  memoryCache: Map<string, ContactDetailsSnapshot>,
  fallbackStub: ContactDetailsSnapshot
): Promise<{ snapshot: ContactDetailsSnapshot; hadWarmCache: boolean }> {
  const fromMemory = memoryCache.get(contactId);
  if (fromMemory) {
    return { snapshot: fromMemory, hadWarmCache: true };
  }

  const fromIdb =
    normalizeContactDetailsSnapshot(await cacheGet(contactDetailsCacheKey(contactId))) ??
    normalizeContactDetailsSnapshot(await cacheGet(legacyContactDetailsCacheKey(contactId)));
  if (fromIdb) {
    memoryCache.set(contactId, fromIdb);
    return { snapshot: fromIdb, hadWarmCache: true };
  }

  return { snapshot: fallbackStub, hadWarmCache: false };
}

/** Prefetch for drawer open: hydrate memory from IndexedDB, network only on cache miss. */
export async function warmEstablishmentDetailsInMemory(
  establishmentId: string,
  memoryCache: Map<string, EstablishmentDetailsSnapshot>
): Promise<void> {
  if (memoryCache.has(establishmentId)) return;

  const fromIdb = await cacheGet<EstablishmentDetailsSnapshot>(
    establishmentDetailsCacheKey(establishmentId)
  );
  if (fromIdb) {
    memoryCache.set(establishmentId, fromIdb);
    return;
  }

  const result = await getEstablishmentDetails(establishmentId);
  if (!result) return;
  memoryCache.set(establishmentId, {
    establishment: result.establishment,
    visits: result.visits,
    contacts: result.contacts,
  });
}

export async function warmContactDetailsInMemory(
  contactId: string,
  memoryCache: Map<string, ContactDetailsSnapshot>
): Promise<void> {
  if (memoryCache.has(contactId)) return;

  const fromIdb =
    normalizeContactDetailsSnapshot(await cacheGet(contactDetailsCacheKey(contactId))) ??
    normalizeContactDetailsSnapshot(await cacheGet(legacyContactDetailsCacheKey(contactId)));
  if (fromIdb) {
    memoryCache.set(contactId, fromIdb);
    return;
  }

  const result = await getContactDetails(contactId);
  if (!result) return;
  memoryCache.set(contactId, {
    contact: result.contact,
    visits: result.visits,
    establishment: result.establishment,
  });
}
