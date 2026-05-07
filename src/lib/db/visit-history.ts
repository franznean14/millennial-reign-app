"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cacheGet, cacheSet, cacheDelete } from "@/lib/offline/store";
import { buildVisitRecords, dedupeAndSortVisits, takeTopVisits, type VisitRecord } from "@/lib/utils/visit-history";
import type { VisitWithUser } from "@/lib/db/business";
import { getBestStatus } from "@/lib/utils/status-hierarchy";

type VisitQueryResult = {
  id: string;
  visit_date: string;
  note?: string | null;
  created_at: string;
  updated_at?: string | null;
  establishment_id?: string | null;
  householder_id?: string | null;
  publisher_id?: string | null;
  partner_id?: string | null;
  publisher_guest_name?: string | null;
  partner_guest_name?: string | null;
  business_establishments?: { name?: string | null; statuses?: string[] | null; area?: string | null } | null;
  householders?: {
    name?: string | null;
    status?: string | null;
    establishment_id?: string | null;
    publisher_id?: string | null;
    business_establishments?: { name?: string | null; statuses?: string[] | null; area?: string | null } | null;
  } | null;
  publisher?: { first_name: string; last_name: string; avatar_url?: string | null } | null;
  partner?: { first_name: string; last_name: string; avatar_url?: string | null } | null;
};

type ProfileRef = {
  id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
};

type EstablishmentRef = {
  id?: string | null;
  name?: string | null;
  status?: string | null;
  statuses?: string[] | null;
  area?: string | null;
};

type HouseholderRef = {
  id?: string | null;
  name?: string | null;
  status?: string | null;
  establishment_id?: string | null;
  publisher_id?: string | null;
  business_establishments?: EstablishmentRef | EstablishmentRef[] | null;
};

type VisitWithUserRaw = {
  id: string;
  note?: string | null;
  visit_date: string;
  publisher_id?: string | null;
  partner_id?: string | null;
  publisher_guest_name?: string | null;
  partner_guest_name?: string | null;
  householder_id?: string | null;
  establishment_id?: string | null;
  publisher?: ProfileRef | ProfileRef[] | null;
  partner?: ProfileRef | ProfileRef[] | null;
  householder?: HouseholderRef | HouseholderRef[] | null;
  establishment?: EstablishmentRef | EstablishmentRef[] | null;
};

function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

async function fetchEstablishmentVisits(limit: number, offset: number) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("calls")
    .select(
      `
        id,
        visit_date,
        note,
        created_at,
        establishment_id,
        publisher_id,
        partner_id,
        publisher_guest_name,
        partner_guest_name,
        business_establishments(name, statuses, area),
        publisher:profiles!calls_publisher_id_fkey(first_name, last_name, avatar_url),
        partner:profiles!calls_partner_id_fkey(first_name, last_name, avatar_url)
      `
    )
    .is("householder_id", null)
    .not("establishment_id", "is", null)
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data || []) as unknown as VisitQueryResult[];
}

async function fetchHouseholderVisits(limit: number, offset: number) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("calls")
    .select(
      `
        id,
        visit_date,
        note,
        created_at,
        establishment_id,
        householder_id,
        publisher_id,
        partner_id,
        publisher_guest_name,
        partner_guest_name,
        householders(name, status, establishment_id, publisher_id, business_establishments(name, statuses, area)),
        business_establishments(name, statuses, area),
        publisher:profiles!calls_publisher_id_fkey(first_name, last_name, avatar_url),
        partner:profiles!calls_partner_id_fkey(first_name, last_name, avatar_url)
      `
    )
    .not("householder_id", "is", null)
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data || []) as unknown as VisitQueryResult[];
}

export async function getRecentBwiVisits(limit = 5, forceRefresh = false): Promise<VisitRecord[]> {
  const cacheKey = "bwi-visits-all-v2";
  
  // Offline-first: use cache only when offline. When online, always refetch so the Home Calls card
  // stays current (IndexedDB snapshots were masking fresh visits until the drawer forced a refresh).
  if (!forceRefresh) {
    const cached = await cacheGet<{ visits?: VisitRecord[] }>(cacheKey);
    if (cached?.visits?.length && isOffline()) {
      return cached.visits;
    }
  }

  // If offline and no cache, return empty
  if (isOffline() && forceRefresh) {
    const cached = await cacheGet<{ visits?: VisitRecord[] }>(cacheKey);
    return cached?.visits ?? [];
  }

  const [establishmentVisits, householderVisits] = await Promise.all([
    fetchEstablishmentVisits(limit, 0),
    fetchHouseholderVisits(limit, 0)
  ]);

  const combined = buildVisitRecords(establishmentVisits, householderVisits);
  const recent = takeTopVisits(combined, limit);

  await cacheSet(cacheKey, { visits: recent, timestamp: new Date().toISOString() });

  return recent;
}

export async function getBwiVisitsPage({
  userId,
  offset = 0,
  pageSize = 20,
  forceRefresh = false
}: {
  userId?: string;
  offset?: number;
  pageSize?: number;
  forceRefresh?: boolean;
}): Promise<VisitRecord[]> {
  const cacheKey = `bwi-all-visits-v2-${userId ?? "all"}-${offset}`;
  
  // If forcing refresh and online, skip cache to avoid snap/re-render
  if (forceRefresh && !isOffline()) {
    // Clear cache first to ensure fresh fetch
    await cacheDelete(cacheKey);
  }
  
  // Offset 0: use cache only when offline. When online, fetch so merged list matches server order.
  if (!forceRefresh && offset === 0) {
    const cached = await cacheGet<{ visits?: VisitRecord[] }>(cacheKey);
    if (cached?.visits?.length && isOffline()) {
      return cached.visits;
    }
  }

  // If offline and forcing refresh, return cached data if available
  if (isOffline()) {
    const cached = await cacheGet<{ visits?: VisitRecord[] }>(cacheKey);
    return cached?.visits ?? [];
  }

  const [establishmentVisits, householderVisits] = await Promise.all([
    fetchEstablishmentVisits(pageSize, offset),
    fetchHouseholderVisits(pageSize, offset)
  ]);

  const combined = buildVisitRecords(establishmentVisits, householderVisits);
  const sorted = dedupeAndSortVisits(combined);

  if (offset === 0) {
    await cacheSet(cacheKey, { visits: sorted, timestamp: new Date().toISOString() });
  }

  return sorted;
}

function normalizeProfileRef(value: ProfileRef | ProfileRef[] | null | undefined): VisitWithUser["publisher"] {
  const profile = Array.isArray(value) ? value[0] : value;
  if (!profile?.id) return null;
  return {
    id: profile.id,
    first_name: profile.first_name ?? "",
    last_name: profile.last_name ?? "",
    avatar_url: profile.avatar_url ?? undefined,
  };
}

function normalizeHouseholderRef(value: HouseholderRef | HouseholderRef[] | null | undefined): VisitWithUser["householder"] {
  const householder = Array.isArray(value) ? value[0] : value;
  if (!householder?.id) return null;
  return {
    id: householder.id,
    name: householder.name ?? "Contact",
    status: householder.status ?? "potential",
  };
}

function normalizeEstablishmentRef(value: EstablishmentRef | EstablishmentRef[] | null | undefined): VisitWithUser["establishment"] {
  const establishment = Array.isArray(value) ? value[0] : value;
  if (!establishment?.id) return null;
  return {
    id: establishment.id,
    name: establishment.name ?? "Establishment",
    status: getBestStatus(establishment.statuses || (establishment.status ? [establishment.status] : [])),
  };
}

function normalizeVisitWithUser(visit: VisitWithUserRaw): VisitWithUser {
  const publisher = normalizeProfileRef(visit.publisher);
  const partner = normalizeProfileRef(visit.partner);
  const householder = normalizeHouseholderRef(visit.householder);
  const establishment = normalizeEstablishmentRef(visit.establishment);

  return {
    id: visit.id,
    note: visit.note ?? null,
    visit_date: visit.visit_date,
    publisher_id: visit.publisher_id ?? publisher?.id ?? null,
    partner_id: visit.partner_id ?? partner?.id ?? null,
    publisher_guest_name: visit.publisher_guest_name ?? null,
    partner_guest_name: visit.partner_guest_name ?? null,
    householder_id: visit.householder_id ?? null,
    establishment_id: visit.establishment_id ?? null,
    publisher,
    partner,
    householder,
    establishment,
  };
}

export async function getEstablishmentVisitsWithUsers(establishmentId: string): Promise<VisitWithUser[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("calls")
    .select(
      `
        id,
        note,
        visit_date,
        publisher_id,
        partner_id,
        publisher_guest_name,
        partner_guest_name,
        householder_id,
        establishment_id,
        publisher:profiles!calls_publisher_id_fkey(id, first_name, last_name, avatar_url),
        partner:profiles!calls_partner_id_fkey(id, first_name, last_name, avatar_url),
        householder:householders!calls_householder_id_fkey(id, name, status)
      `
    )
    .eq("establishment_id", establishmentId)
    .order("visit_date", { ascending: false });

  if (error) throw error;
  return (data as VisitWithUserRaw[] | null)?.map(normalizeVisitWithUser) || [];
}

export async function getHouseholderVisitsWithUsers(householderId: string): Promise<VisitWithUser[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("calls")
    .select(
      `
        id,
        note,
        visit_date,
        publisher_id,
        partner_id,
        publisher_guest_name,
        partner_guest_name,
        establishment_id,
        householder_id,
        publisher:profiles!calls_publisher_id_fkey(id, first_name, last_name, avatar_url),
        partner:profiles!calls_partner_id_fkey(id, first_name, last_name, avatar_url),
        householder:householders!calls_householder_id_fkey(id, name, status),
        establishment:business_establishments!calls_establishment_id_fkey(id, name, statuses)
      `
    )
    .eq("householder_id", householderId)
    .order("visit_date", { ascending: false });

  if (error) throw error;
  return (data as VisitWithUserRaw[] | null)?.map(normalizeVisitWithUser) || [];
}
