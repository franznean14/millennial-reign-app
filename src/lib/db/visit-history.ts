"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cacheGet, cacheSet } from "@/lib/offline/store";
import { buildVisitRecords, dedupeAndSortVisits, takeTopVisits, type VisitRecord } from "@/lib/utils/visit-history";
import type { VisitWithUser } from "@/lib/db/business";
import { getBestStatus } from "@/lib/utils/status-hierarchy";

type VisitQueryResult = {
  id: string;
  visit_date: string;
  note?: string | null;
  created_at: string;
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

export async function getRecentBwiVisits(limit = 5): Promise<VisitRecord[]> {
  const cacheKey = "bwi-visits-all-v2";
  const cached = await cacheGet<{ visits?: VisitRecord[] }>(cacheKey);

  if (cached?.visits?.length) {
    return cached.visits;
  }

  if (isOffline()) {
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
  pageSize = 20
}: {
  userId?: string;
  offset?: number;
  pageSize?: number;
}): Promise<VisitRecord[]> {
  const cacheKey = `bwi-all-visits-v2-${userId ?? "all"}-${offset}`;
  const cached = await cacheGet<{ visits?: VisitRecord[] }>(cacheKey);

  if (offset === 0 && cached?.visits?.length) {
    return cached.visits;
  }

  if (isOffline()) {
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
