import { cacheGet } from "@/lib/offline/store";
import {
  getEstablishmentDetails,
  getHouseholderDetails,
  type EstablishmentWithDetails,
  type HouseholderWithDetails,
  type VisitWithUser,
} from "@/lib/db/business";

export function establishmentDetailsCacheKey(establishmentId: string) {
  return `establishment:details:${establishmentId}`;
}

export function householderDetailsCacheKey(householderId: string) {
  return `householder:details:v3:${householderId}`;
}

export type EstablishmentDetailsSnapshot = {
  establishment: EstablishmentWithDetails;
  visits: VisitWithUser[];
  householders: HouseholderWithDetails[];
};

export type HouseholderDetailsSnapshot = {
  householder: HouseholderWithDetails;
  visits: VisitWithUser[];
  establishment?: { id: string; name: string; area?: string | null; statuses?: string[] | null } | null;
};

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

/** Session memory → IndexedDB → stub (same order as BWI loadHouseholderDetailsSwr). */
export async function resolveHouseholderDetailsSnapshot(
  householderId: string,
  memoryCache: Map<string, HouseholderDetailsSnapshot>,
  fallbackStub: HouseholderDetailsSnapshot
): Promise<{ snapshot: HouseholderDetailsSnapshot; hadWarmCache: boolean }> {
  const fromMemory = memoryCache.get(householderId);
  if (fromMemory) {
    return { snapshot: fromMemory, hadWarmCache: true };
  }

  const fromIdb = await cacheGet<HouseholderDetailsSnapshot>(householderDetailsCacheKey(householderId));
  if (fromIdb) {
    memoryCache.set(householderId, fromIdb);
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
    householders: result.householders,
  });
}

export async function warmHouseholderDetailsInMemory(
  householderId: string,
  memoryCache: Map<string, HouseholderDetailsSnapshot>
): Promise<void> {
  if (memoryCache.has(householderId)) return;

  const fromIdb = await cacheGet<HouseholderDetailsSnapshot>(householderDetailsCacheKey(householderId));
  if (fromIdb) {
    memoryCache.set(householderId, fromIdb);
    return;
  }

  const result = await getHouseholderDetails(householderId);
  if (!result) return;
  memoryCache.set(householderId, {
    householder: result.householder,
    visits: result.visits,
    establishment: result.establishment,
  });
}
