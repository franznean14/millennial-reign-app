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
  business_establishments?: { name?: string | null; statuses?: string[] | null; area?: string | null } | null;
  householders?: {
    name?: string | null;
    establishment_id?: string | null;
    business_establishments?: { name?: string | null; statuses?: string[] | null; area?: string | null } | null;
  } | null;
  publisher?: { first_name: string; last_name: string; avatar_url?: string | null } | null;
  partner?: { first_name: string; last_name: string; avatar_url?: string | null } | null;
};

type VisitWithUserRaw = {
  id: string;
  note?: string | null;
  visit_date: string;
  publisher_id?: string | null;
  partner_id?: string | null;
  householder_id?: string | null;
  establishment_id?: string | null;
  publisher?: any;
  partner?: any;
  householder?: any;
  establishment?: any;
};

function isOffline() {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

async function fetchEstablishmentVisits(limit: number, offset: number) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("business_visits")
    .select(
      `
        id,
        visit_date,
        note,
        created_at,
        establishment_id,
        publisher_id,
        business_establishments(name, statuses, area),
        publisher:profiles!business_visits_publisher_id_fkey(first_name, last_name, avatar_url),
        partner:profiles!business_visits_partner_id_fkey(first_name, last_name, avatar_url)
      `
    )
    .is("householder_id", null)
    .not("establishment_id", "is", null)
    .order("visit_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data || []) as VisitQueryResult[];
}

async function fetchHouseholderVisits(limit: number, offset: number) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("business_visits")
    .select(
      `
        id,
        visit_date,
        note,
        created_at,
        householder_id,
        publisher_id,
        householders(name, establishment_id, business_establishments(name, statuses, area)),
        business_establishments(name, statuses, area),
        publisher:profiles!business_visits_publisher_id_fkey(first_name, last_name, avatar_url),
        partner:profiles!business_visits_partner_id_fkey(first_name, last_name, avatar_url)
      `
    )
    .not("householder_id", "is", null)
    .order("visit_date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data || []) as VisitQueryResult[];
}

export async function getRecentBwiVisits(limit = 5, forceRefresh = false): Promise<VisitRecord[]> {
  const cacheKey = "bwi-visits-all-v2";
  
  // Only use cache if not forcing refresh and we're offline
  if (!forceRefresh) {
  const cached = await cacheGet<{ visits?: VisitRecord[] }>(cacheKey);
  if (cached?.visits?.length) {
      // If offline, return cached data
      if (isOffline()) {
    return cached.visits;
      }
      // If online, still return cached for speed, but fetch fresh in background
      // (For now, we'll force refresh when events fire)
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
  
  // Only use cache if not forcing refresh
  if (!forceRefresh && offset === 0) {
  const cached = await cacheGet<{ visits?: VisitRecord[] }>(cacheKey);
    if (cached?.visits?.length) {
      // If offline, return cached data
      if (isOffline()) {
        return cached.visits;
      }
      // If online and not forcing refresh, return cached for speed
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

function normalizeVisitWithUser(visit: VisitWithUserRaw): VisitWithUser {
  return {
    id: visit.id,
    note: visit.note ?? null,
    visit_date: visit.visit_date,
    publisher_id:
      visit.publisher_id ??
      (Array.isArray(visit.publisher) ? (visit.publisher[0]?.id ?? null) : (visit.publisher?.id ?? null)),
    partner_id:
      visit.partner_id ??
      (Array.isArray(visit.partner) ? (visit.partner[0]?.id ?? null) : (visit.partner?.id ?? null)),
    householder_id: visit.householder_id ?? null,
    establishment_id: visit.establishment_id ?? null,
    publisher: Array.isArray(visit.publisher) ? visit.publisher[0] || null : visit.publisher || null,
    partner: Array.isArray(visit.partner) ? visit.partner[0] || null : visit.partner || null,
    householder: Array.isArray(visit.householder) ? visit.householder[0] || null : visit.householder || null,
    establishment: Array.isArray(visit.establishment)
      ? visit.establishment[0]
        ? {
            ...visit.establishment[0],
            status: getBestStatus((visit.establishment[0] as any)?.statuses || [])
          }
        : null
      : visit.establishment
        ? {
            ...visit.establishment,
            status: getBestStatus((visit.establishment as any)?.statuses || [])
          }
        : null
  };
}

export async function getEstablishmentVisitsWithUsers(establishmentId: string): Promise<VisitWithUser[]> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("business_visits")
    .select(
      `
        id,
        note,
        visit_date,
        publisher_id,
        partner_id,
        householder_id,
        establishment_id,
        publisher:profiles!business_visits_publisher_id_fkey(id, first_name, last_name, avatar_url),
        partner:profiles!business_visits_partner_id_fkey(id, first_name, last_name, avatar_url),
        householder:householders!business_visits_householder_id_fkey(id, name, status)
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
    .from("business_visits")
    .select(
      `
        id,
        note,
        visit_date,
        publisher_id,
        partner_id,
        establishment_id,
        householder_id,
        publisher:profiles!business_visits_publisher_id_fkey(id, first_name, last_name, avatar_url),
        partner:profiles!business_visits_partner_id_fkey(id, first_name, last_name, avatar_url),
        householder:householders!business_visits_householder_id_fkey(id, name, status),
        establishment:business_establishments!business_visits_establishment_id_fkey(id, name, statuses)
      `
    )
    .eq("householder_id", householderId)
    .order("visit_date", { ascending: false });

  if (error) throw error;
  return (data as VisitWithUserRaw[] | null)?.map(normalizeVisitWithUser) || [];
}
