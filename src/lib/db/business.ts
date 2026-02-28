"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cacheDelete, cacheGet, cacheSet } from "@/lib/offline/store";
import { getBestStatus } from "@/lib/utils/status-hierarchy";
import { getEstablishmentVisitsWithUsers, getHouseholderVisitsWithUsers } from "@/lib/db/visit-history";

// Calculate distance between two coordinates using Haversine formula
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
}

export interface BusinessFiltersState {
  search: string;
  statuses: string[];
  areas: string[];
  floors: string[];
  myEstablishments: boolean;
  nearMe: boolean;
  /** When true, hide establishments that are taken as personal territory (publisher_id set). */
  excludePersonalTerritory?: boolean;
  userLocation?: [number, number] | null;
  sort?: 'name_asc' | 'name_desc' | 'last_visit_desc' | 'last_visit_asc' | 'area_asc' | 'area_desc' | 'date_added_asc' | 'date_added_desc';
}

export type EstablishmentStatus = 
  | 'for_scouting'
  | 'for_follow_up'
  | 'for_replenishment'
  | 'accepted_rack'
  | 'declined_rack'
  | 'has_bible_studies'
  | 'closed';
export type HouseholderStatus = 'potential'|'interested'|'return_visit'|'bible_study'|'do_not_call';

export interface Establishment {
  id?: string;
  name: string;
  description?: string | null;
  area?: string | null;
  lat?: number | null;
  lng?: number | null;
  floor?: string | null;
  status: EstablishmentStatus;
  note?: string | null;
}

export interface Householder {
  id?: string;
  establishment_id?: string | null;
  publisher_id?: string | null;
  name: string;
  status: HouseholderStatus;
  note?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface VisitUpdate {
  id?: string;
  congregation_id?: string;
  establishment_id?: string | null;
  householder_id?: string | null;
  note?: string | null;
  publisher_id?: string | null;
  partner_id?: string | null;
  visit_date?: string; // YYYY-MM-DD
}

/** To-do item associated with a call (establishment or householder call). */
export interface CallTodo {
  id: string;
  call_id?: string | null;
  body: string;
  is_done: boolean;
  congregation_id?: string | null;
  establishment_id?: string | null;
  householder_id?: string | null;
  publisher_id?: string | null;
  partner_id?: string | null;
  deadline_date?: string | null;
  created_at?: string;
}

/** Open call to-do with minimal call context for home summary and navigation. */
export interface MyOpenCallTodoItem extends CallTodo {
  visit_date?: string | null;
  /** Prefer for display when set; else use visit_date from call */
  deadline_date?: string | null;
  establishment_id?: string | null;
  householder_id?: string | null;
  /** Display name for badge: establishment name or householder name */
  context_name?: string | null;
  /** Establishment name when call is for a householder (for second badge) */
  context_establishment_name?: string | null;
  /** Status for badge color: establishment best status or householder status */
  context_status?: string | null;
  /** Establishment status for its own badge color */
  context_establishment_status?: string | null;
  /** Call created_at for ordering and age-based styling */
  call_created_at?: string | null;
   /** Establishment area for area filters */
  context_area?: string | null;
}

export interface EstablishmentWithDetails {
  id?: string;
  name: string;
  description?: string | null;
  area?: string | null;
  lat?: number | null;
  lng?: number | null;
  floor?: string | null;
  statuses: string[]; // Changed from status to statuses
  note?: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  updated_by?: string;
  /** Publisher who has taken this establishment as personal territory */
  publisher_id?: string | null;
  /** Resolved profile when publisher_id is set */
  assigned_user?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  } | null;
  visit_count?: number;
  householder_count?: number;
  last_visit_at?: string | null;
  top_visitors?: Array<{
    user_id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  }>;
}

export interface VisitWithUser {
  id: string;
  note?: string | null;
  visit_date: string;
  publisher_id?: string | null;
  partner_id?: string | null;
  publisher_guest_name?: string | null;
  partner_guest_name?: string | null;
  householder_id?: string | null;
  establishment_id?: string | null;
  publisher?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  } | null;
  partner?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  } | null;
  householder?: {
    id: string;
    name: string;
    status: string;
  } | null;
  establishment?: {
    id: string;
    name: string;
    status?: string;
  } | null;
}

export interface HouseholderWithDetails {
  id: string;
  name: string;
  status: HouseholderStatus;
  note?: string | null;
  establishment_id?: string | null;
  establishment_name?: string | null;
  publisher_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  created_at?: string;
  last_visit_at?: string | null;
  assigned_user?: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  } | null;
  top_visitors?: Array<{
    user_id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    visit_count: number;
  }>;
}

export async function isBusinessEnabled(): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  try { await supabase.auth.getSession(); } catch {}
  try { const { data } = await supabase.rpc('is_business_enabled'); return !!data; } catch { return false; }
}

export async function isBusinessParticipant(): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  try { await supabase.auth.getSession(); } catch {}
  try { const { data } = await supabase.rpc('is_business_participant'); return !!data; } catch { return false; }
}

export async function listEstablishments(): Promise<Establishment[]> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  const cacheKey = 'establishments:list';
  try {
    // If offline, serve from cache
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = await cacheGet<Establishment[]>(cacheKey);
      return cached ?? [];
    }
    const { data } = await supabase
      .from('business_establishments')
      .select('*')
      .eq('is_deleted', false)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false });
    const list = (data as any) ?? [];
    await cacheSet(cacheKey, list);
    return list;
  } catch {
    const cached = await cacheGet<Establishment[]>(cacheKey);
    return cached ?? [];
  }
}

export async function getPersonalContactHouseholders(userId: string): Promise<Array<{ id: string; name: string }>> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  const cacheKey = `householders:personal:${userId}`;
  try {
    // If offline, serve from cache
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = await cacheGet<Array<{ id: string; name: string }>>(cacheKey);
      return cached ?? [];
    }
    
    const { data, error } = await supabase
      .from('householders')
      .select('id, name')
      .eq('publisher_id', userId)
      .eq('is_deleted', false)
      .eq('is_archived', false)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching personal contact householders:', error);
      const cached = await cacheGet<Array<{ id: string; name: string }>>(cacheKey);
      return cached ?? [];
    }
    
    const householders = (data ?? []).map((hh: any) => ({
      id: hh.id,
      name: hh.name
    }));

    await cacheSet(cacheKey, householders);
    return householders;
  } catch (error) {
    console.error('Error getting personal contact householders:', error);
    const cached = await cacheGet<Array<{ id: string; name: string }>>(cacheKey);
    return cached ?? [];
  }
}

export async function listHouseholders(): Promise<HouseholderWithDetails[]> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  const cacheKey = 'householders:list';
  try {
    // Return cached data immediately if available (for fast initial load)
    const cached = await cacheGet<HouseholderWithDetails[]>(cacheKey);
    if (cached?.length && typeof navigator !== 'undefined' && !navigator.onLine) {
      // If offline, return cached data
      return cached;
    }
    
    // Fetch fresh data
    const { data, error } = await supabase
      .from('householders')
      .select(`
        id,
        name,
        status,
        note,
        establishment_id,
        publisher_id,
        lat,
        lng,
        created_at,
        establishment:business_establishments(name, statuses)
      `)
      .eq('is_deleted', false)
      .eq('is_archived', false)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching householders:', error);
      return [];
    }
    if (!data) return [];

    const householderIds = (data ?? []).map((hh: any) => hh.id).filter(Boolean);
    type HouseholderVisitRow = {
      householder_id?: string | null;
      visit_date?: string | null;
      publisher?:
        | { id: string; first_name: string; last_name: string; avatar_url?: string | null }
        | Array<{ id: string; first_name: string; last_name: string; avatar_url?: string | null }>
        | null;
      partner?:
        | { id: string; first_name: string; last_name: string; avatar_url?: string | null }
        | Array<{ id: string; first_name: string; last_name: string; avatar_url?: string | null }>
        | null;
    };
    const { data: visits, error: visitsError } = householderIds.length
      ? await supabase
          .from('calls')
          .select(
            `
              householder_id,
              visit_date,
              publisher:profiles!calls_publisher_id_fkey(id, first_name, last_name, avatar_url),
              partner:profiles!calls_partner_id_fkey(id, first_name, last_name, avatar_url)
            `
          )
          .in('householder_id', householderIds)
      : { data: [] as HouseholderVisitRow[], error: null };
    if (visitsError) {
      console.error('Error fetching householder visits for list:', visitsError);
    }

    const visitsByHouseholder = new Map<string, HouseholderVisitRow[]>();
    (visits ?? []).forEach((visit) => {
      const householderId = visit.householder_id;
      if (!householderId) return;
      const bucket = visitsByHouseholder.get(householderId) || [];
      bucket.push(visit);
      visitsByHouseholder.set(householderId, bucket);
    });

    // Transform the data to match HouseholderWithDetails interface
    const householders: HouseholderWithDetails[] = (data ?? []).map((hh: any) => {
      // Get establishment name
      const establishment = Array.isArray(hh.establishment) ? hh.establishment[0] : hh.establishment;
      
      // Get unique visitors with visit counts
      const visitors = new Map();
      const hhVisits = visitsByHouseholder.get(hh.id) || [];
      hhVisits.forEach((visit: HouseholderVisitRow) => {
        const publisher = Array.isArray(visit.publisher) ? visit.publisher[0] : visit.publisher;
        const partner = Array.isArray(visit.partner) ? visit.partner[0] : visit.partner;
        if (publisher) {
          const key = publisher.id;
          if (!visitors.has(key)) {
            visitors.set(key, {
              user_id: publisher.id,
              first_name: publisher.first_name,
              last_name: publisher.last_name,
              avatar_url: publisher.avatar_url,
              visit_count: 0
            });
          }
          visitors.get(key).visit_count++;
        }
        if (partner) {
          const key = partner.id;
          if (!visitors.has(key)) {
            visitors.set(key, {
              user_id: partner.id,
              first_name: partner.first_name,
              last_name: partner.last_name,
              avatar_url: partner.avatar_url,
              visit_count: 0
            });
          }
          visitors.get(key).visit_count++;
        }
      });

      // Calculate last_visit_at from visits
      const last_visit_at = hhVisits
        .map((v: any) => v?.visit_date)
        .filter(Boolean)
        .sort((a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0))[0] || null;

      return {
        id: hh.id,
        name: hh.name,
        status: hh.status,
        note: hh.note,
        establishment_id: hh.establishment_id,
        establishment_name: establishment?.name,
        publisher_id: hh.publisher_id ?? null,
        lat: hh.lat ?? null,
        lng: hh.lng ?? null,
        created_at: hh.created_at,
        last_visit_at,
        top_visitors: Array.from(visitors.values()).sort((a, b) => b.visit_count - a.visit_count)
      };
    });

    await cacheSet(cacheKey, householders);
    return householders;
  } catch (error) {
    console.error('Error listing householders:', error);
    const cached = await cacheGet<HouseholderWithDetails[]>(cacheKey);
    return cached ?? [];
  }
}

export async function upsertEstablishment(establishment: {
  id?: string;
  name: string;
  description?: string | null;
  area?: string | null;
  lat?: number | null;
  lng?: number | null;
  floor?: string | null;
  statuses?: string[];
  note?: string | null;
}): Promise<any> {
  const supabase = createSupabaseBrowserClient();
  
  // Get current user's congregation_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('congregation_id')
    .eq('id', (await supabase.auth.getUser()).data.user?.id)
    .single();
  
  if (!profile?.congregation_id) {
    throw new Error('User not associated with a congregation');
  }
  
  // Ensure statuses is always an array
  const establishmentData = {
    ...establishment,
    statuses: establishment.statuses || ['for_scouting'],
    congregation_id: profile.congregation_id
  };
  
  
  try {
    if (establishmentData.id) {
      // Update existing establishment
      const { data, error } = await supabase
        .from('business_establishments')
        .update({
          name: establishmentData.name,
          description: establishmentData.description,
          area: establishmentData.area,
          lat: establishmentData.lat,
          lng: establishmentData.lng,
          floor: establishmentData.floor,
          statuses: establishmentData.statuses,
          note: establishmentData.note,
          updated_at: new Date().toISOString()
        })
        .eq('id', establishmentData.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating establishment:', error);
        throw error;
      }
      
      return data;
    } else {
      // Prevent exact duplicate (same name + same area within congregation)
      const { data: dup } = await supabase
        .from('business_establishments')
        .select('id')
        .eq('congregation_id', establishmentData.congregation_id)
        .eq('is_deleted', false)
        .eq('is_archived', false)
        .ilike('name', establishmentData.name)
        [establishmentData.area ? 'eq' : 'is']('area', establishmentData.area ? establishmentData.area : null)
        .limit(1);
      if ((dup as any[])?.length) {
        throw new Error('Duplicate: an establishment with this name already exists in this area.');
      }
      // Insert new establishment
      const { data, error } = await supabase
        .from('business_establishments')
        .insert({
          name: establishmentData.name,
          description: establishmentData.description,
          area: establishmentData.area,
          lat: establishmentData.lat,
          lng: establishmentData.lng,
          floor: establishmentData.floor,
          statuses: establishmentData.statuses,
          note: establishmentData.note,
          congregation_id: establishmentData.congregation_id,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error inserting establishment:', error);
        throw error;
      }
      
      return data;
    }
  } catch (error) {
    console.error('Error upserting establishment:', error);
    throw error;
  }
}

/** Set or clear the publisher who has taken this establishment as personal territory. */
export async function updateEstablishmentPublisherId(
  establishmentId: string,
  publisherId: string | null
): Promise<EstablishmentWithDetails | null> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});

  const { data, error } = await supabase
    .from('business_establishments')
    .update({
      publisher_id: publisherId,
      updated_at: new Date().toISOString()
    })
    .eq('id', establishmentId)
    .eq('is_deleted', false)
    .select()
    .single();

  if (error) {
    console.error('Error updating establishment publisher_id:', error);
    return null;
  }

  const establishment = data as any;
  if (establishment?.publisher_id) {
    try {
      const profileModule = await import('@/lib/db/profiles');
      const profile = await profileModule.getProfile(establishment.publisher_id);
      if (profile) {
        establishment.assigned_user = {
          id: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          avatar_url: profile.avatar_url ?? undefined
        };
      }
    } catch (e) {
      // optional
    }
  } else {
    establishment.assigned_user = null;
  }

  const cacheKey = `establishment:details:${establishmentId}`;
  await cacheDelete(cacheKey);
  return establishment as EstablishmentWithDetails;
}

// Find potential duplicates for a name within the same area (prefix match)
export async function findEstablishmentDuplicates(name: string, area?: string | null, exact?: boolean): Promise<any[]> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  if (!name) return [];
  // Get congregation
  const { data: profile } = await supabase
    .from('profiles')
    .select('congregation_id')
    .eq('id', (await supabase.auth.getUser()).data.user?.id)
    .single();
  if (!profile?.congregation_id) return [];
  const query = supabase
    .from('business_establishments')
    .select('id,name,area')
    .eq('congregation_id', profile.congregation_id)
    .eq('is_deleted', false)
    .eq('is_archived', false)
    [area ? 'eq' : 'is']('area', area ? area : null);
  if (exact) {
    query.ilike('name', name);
  } else {
    query.ilike('name', `${name}%`);
  }
  const { data } = await query.limit(5);
  return (data as any[]) ?? [];
}

export async function upsertHouseholder(h: Householder): Promise<Householder | null> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  
  // Ensure lat/lng are proper numbers or null (database expects numeric(9,6) and numeric(11,8))
  const latValue = typeof h.lat === 'number' && !isNaN(h.lat) ? Number(h.lat.toFixed(6)) : null;
  const lngValue = typeof h.lng === 'number' && !isNaN(h.lng) ? Number(h.lng.toFixed(8)) : null;
  
  const payload: any = { 
    name: h.name, 
    status: h.status, 
    note: h.note ?? null,
    establishment_id: h.establishment_id ?? null,
    publisher_id: h.publisher_id ?? null,
    lat: latValue,
    lng: lngValue
  };
  if (h.id) {
    const { data, error } = await supabase.from('householders').update(payload).eq('id', h.id).select().single();
    if (error) {
      console.error('Error updating householder:', error);
      return null;
    }
    return data as any;
  }
  const { data, error } = await supabase.from('householders').insert(payload).select().single();
  if (error) {
    console.error('Error inserting householder:', error);
    return null;
  }
  return data as any;
}

export async function deleteHouseholder(householderId: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  
  // Get user's profile
  const { data: profile } = await supabase.rpc('get_my_profile');
  if (!profile?.id) {
    throw new Error('User not authenticated');
  }
  
  // Use RPC function to bypass RLS for deletion
  const { error } = await supabase.rpc('delete_householder', {
    householder_id: householderId,
    deleted_by_user: profile.id
  });
    
  if (error) {
    console.error('Error deleting householder:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    return false;
  }
  return true;
}

export async function archiveHouseholder(householderId: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  
  // Get user's profile
  const { data: profile } = await supabase.rpc('get_my_profile');
  if (!profile?.id) {
    throw new Error('User not authenticated');
  }
  
  const { error } = await supabase
    .from('householders')
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_by: profile.id
    })
    .eq('id', householderId);
    
  if (error) {
    console.error('Error archiving householder:', error);
    return false;
  }
  return true;
}

export async function addVisit(visit: {
  establishment_id?: string;
  householder_id?: string;
  note?: string | null;
  publisher_id?: string;
  partner_id?: string;
  publisher_guest_name?: string | null;
  partner_guest_name?: string | null;
  visit_date?: string;
}): Promise<{
  id: string;
  establishment_id?: string | null;
  householder_id?: string | null;
  note?: string | null;
  publisher_id?: string | null;
  partner_id?: string | null;
  publisher_guest_name?: string | null;
  partner_guest_name?: string | null;
  visit_date: string;
} | null> {
  const supabase = createSupabaseBrowserClient();
  
  try {
    // Get current user's congregation_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('congregation_id')
      .eq('id', (await supabase.auth.getUser()).data.user?.id)
      .single();
    
    if (!profile?.congregation_id) {
      console.error('User not associated with a congregation');
      return null;
    }

    // If establishment_id is provided, verify it exists
    if (visit.establishment_id && visit.establishment_id !== 'none') {
      const { data: establishment } = await supabase
        .from('business_establishments')
        .select('id')
        .eq('id', visit.establishment_id)
        .eq('congregation_id', profile.congregation_id)
        .single();
      
      if (!establishment) {
        console.error('Establishment not found:', visit.establishment_id);
        return null;
      }
    }


    const { data, error } = await supabase
      .from('calls')
      .insert({
        congregation_id: profile.congregation_id,
        establishment_id: visit.establishment_id === 'none' ? null : visit.establishment_id,
        householder_id: visit.householder_id || null,
        note: visit.note,
        publisher_id: visit.publisher_id || null,
        partner_id: visit.partner_id || null,
        publisher_guest_name: visit.publisher_guest_name ?? null,
        partner_guest_name: visit.partner_guest_name ?? null,
        visit_date: visit.visit_date || new Date().toISOString().split('T')[0]
      })
      .select('id, establishment_id, householder_id, note, publisher_id, partner_id, publisher_guest_name, partner_guest_name, visit_date')
      .single();

    if (error) {
      console.error('Error adding visit:', error);
      console.error('Error details:', error.message, error.details, error.hint);
      return null;
    }

    return (data as any) ?? null;
  } catch (error) {
    console.error('Unexpected error in addVisit:', error);
    return null;
  }
}

export async function updateVisit(visit: {
  id: string;
  establishment_id?: string | null;
  householder_id?: string | null;
  note?: string | null;
  publisher_id?: string | null;
  partner_id?: string | null;
  publisher_guest_name?: string | null;
  partner_guest_name?: string | null;
  visit_date?: string;
}): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession().catch(() => {});
    const { error } = await supabase
      .from('calls')
      .update({
        establishment_id: visit.establishment_id ?? null,
        householder_id: visit.householder_id ?? null,
        note: visit.note ?? null,
        publisher_id: visit.publisher_id ?? null,
        partner_id: visit.partner_id ?? null,
        publisher_guest_name: visit.publisher_guest_name ?? null,
        partner_guest_name: visit.partner_guest_name ?? null,
        visit_date: visit.visit_date ?? undefined
      })
      .eq('id', visit.id);
    if (error) {
      console.error('Error updating visit:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Unexpected error in updateVisit:', error);
    return false;
  }
}

export async function deleteVisit(visitId: string, _establishmentId?: string | null): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession().catch(() => {});
    
    // First, get the visit to find the publisher_id (user who created it)
    // This is needed to find which user's daily records might contain this visit
    let publisherId: string | null = null;
    try {
      const { data: visit } = await supabase
        .from('calls')
        .select('publisher_id')
        .eq('id', visitId)
        .maybeSingle();
      publisherId = visit?.publisher_id || null;
    } catch (e) {
      console.error('Error fetching visit for publisher_id:', e);
    }
    
    // Remove the visit ID from all daily records that reference it
    const visitIdString = `visit:${visitId}`;
    try {
      // Get the current user's ID to find their daily records
      const { data: { user } } = await supabase.auth.getUser();
      const userIdToCheck = publisherId || user?.id;
      
      if (userIdToCheck) {
        // Fetch all daily records for the publisher (or current user if publisher not found)
        // Using a reasonable date range (last 2 years to present)
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        const dateFrom = twoYearsAgo.toISOString().split('T')[0];
        
        const { data: dailyRecords, error: fetchError } = await supabase
          .from('daily_records')
          .select('id, user_id, date, bible_studies')
          .eq('user_id', userIdToCheck)
          .gte('date', dateFrom);
        
        if (!fetchError && dailyRecords && dailyRecords.length > 0) {
          // Filter records that contain the visit ID
          const recordsToUpdate = dailyRecords.filter((record: any) => 
            Array.isArray(record.bible_studies) && record.bible_studies.includes(visitIdString)
          );
          
          // Update each daily record to remove the visit ID
          for (const record of recordsToUpdate) {
            const updatedStudies = (record.bible_studies || []).filter(
              (study: string) => study !== visitIdString
            );
            
            // Update the record
            const { error: updateError } = await supabase
              .from('daily_records')
              .update({ bible_studies: updatedStudies })
              .eq('id', record.id);
            
            if (updateError) {
              console.error('Error updating daily record:', updateError);
            } else {
              // Update cache
              const { cacheSet, cacheGet } = await import("@/lib/offline/store");
              const dayKey = `daily:${record.user_id}:${record.date}`;
              const updatedRecord = { ...record, bible_studies: updatedStudies };
              await cacheSet(dayKey, updatedRecord);
              
              // Update month cache
              const month = record.date.slice(0, 7);
              const monthKey = `daily:${record.user_id}:month:${month}`;
              const monthCache = (await cacheGet(monthKey)) || [];
              const recordIndex = monthCache.findIndex((r: any) => r.date === record.date);
              if (recordIndex >= 0) {
                monthCache[recordIndex] = updatedRecord;
                await cacheSet(monthKey, monthCache.sort((a: any, b: any) => a.date.localeCompare(b.date)));
              }
              
              // Emit event to notify UI of daily record change
              try {
                window.dispatchEvent(new CustomEvent('daily-records-changed', { 
                  detail: { userId: record.user_id } 
                }));
              } catch {}
            }
          }
        }
      }
    } catch (cleanupError) {
      console.error('Error cleaning up visit ID from daily records:', cleanupError);
      // Continue with visit deletion even if cleanup fails
    }
    
    // Delete the visit
    const { error, status } = await supabase
      .from('calls')
      .delete()
      .eq('id', visitId);
    if (error) {
      console.error('Error deleting visit:', { status, error });
      return false;
    }
    return true;
  } catch (error) {
    console.error('Unexpected error in deleteVisit:', error);
    return false;
  }
}

// --- Call to-dos (for establishment and householder calls) ---

export async function getCallTodos(callId: string): Promise<CallTodo[]> {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession().catch(() => {});
    const { data, error } = await supabase
      .from('call_todos')
      .select('id, call_id, body, is_done, publisher_id, partner_id, deadline_date, created_at')
      .eq('call_id', callId)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error fetching call todos:', error);
      return [];
    }
    return (data ?? []) as CallTodo[];
  } catch (e) {
    console.error('getCallTodos:', e);
    return [];
  }
}

export async function addCallTodo(
  callId: string,
  body: string,
  isDone = false,
  extra?: { publisher_id?: string | null; partner_id?: string | null; deadline_date?: string | null }
): Promise<CallTodo | null> {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession().catch(() => {});
    const payload: Record<string, unknown> = { call_id: callId, body: body.trim(), is_done: isDone };
    if (extra?.publisher_id !== undefined) payload.publisher_id = extra.publisher_id;
    if (extra?.partner_id !== undefined) payload.partner_id = extra.partner_id;
    if (extra?.deadline_date !== undefined) payload.deadline_date = extra.deadline_date;
    const { data, error } = await supabase
      .from('call_todos')
      .insert(payload)
      .select('id, call_id, body, is_done, publisher_id, partner_id, deadline_date, created_at')
      .single();
    if (error) {
      console.error('Error adding call todo:', error);
      return null;
    }
    return data as CallTodo;
  } catch (e) {
    console.error('addCallTodo:', e);
    return null;
  }
}

export async function updateCallTodo(
  id: string,
  updates: { body?: string; is_done?: boolean; deadline_date?: string | null }
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession().catch(() => {});
    const payload: { body?: string; is_done?: boolean; deadline_date?: string | null } = {};
    if (updates.body !== undefined) payload.body = updates.body.trim();
    if (updates.is_done !== undefined) payload.is_done = updates.is_done;
    if (updates.deadline_date !== undefined) payload.deadline_date = updates.deadline_date;
    if (Object.keys(payload).length === 0) return true;
    const { error } = await supabase.from('call_todos').update(payload).eq('id', id);
    if (error) {
      console.error('Error updating call todo:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('updateCallTodo:', e);
    return false;
  }
}

/** Keep call-linked todo participant columns aligned with their parent call participants. */
export async function syncCallTodoParticipantsForCall(
  callId: string,
  participants: { publisher_id?: string | null; partner_id?: string | null }
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession().catch(() => {});
    const { error } = await supabase
      .from("call_todos")
      .update({
        publisher_id: participants.publisher_id ?? null,
        partner_id: participants.partner_id ?? null,
      })
      .eq("call_id", callId);
    if (error) {
      console.error("syncCallTodoParticipantsForCall:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("syncCallTodoParticipantsForCall:", e);
    return false;
  }
}

export async function deleteCallTodo(id: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession().catch(() => {});
    const { error } = await supabase.from('call_todos').delete().eq('id', id);
    if (error) {
      console.error('Error deleting call todo:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('deleteCallTodo:', e);
    return false;
  }
}

/** Create a standalone to-do item (no call row is created). */
export async function addStandaloneTodo(params: {
  establishment_id?: string | null;
  householder_id?: string | null;
  body: string;
  deadline_date?: string | null;
  publisher_id?: string | null;
  partner_id?: string | null;
  publisher_guest_name?: string | null;
  partner_guest_name?: string | null;
}): Promise<CallTodo | null> {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession().catch(() => {});
    const { data: profile } = await supabase
      .from("profiles")
      .select("congregation_id")
      .eq("id", (await supabase.auth.getUser()).data.user?.id)
      .single();
    if (!profile?.congregation_id) return null;

    const payload = {
      call_id: null,
      congregation_id: profile.congregation_id,
      establishment_id: params.establishment_id ?? null,
      householder_id: params.householder_id ?? null,
      body: params.body.trim(),
      is_done: false,
      publisher_id: params.publisher_id ?? null,
      partner_id: params.partner_id ?? null,
      deadline_date: params.deadline_date?.trim() || null,
    };
    const { data, error } = await supabase
      .from("call_todos")
      .insert(payload)
      .select("id, call_id, congregation_id, establishment_id, householder_id, body, is_done, publisher_id, partner_id, deadline_date, created_at")
      .single();
    if (error) {
      console.error("Error adding standalone todo:", error);
      return null;
    }
    return (data as CallTodo) ?? null;
  } catch (e) {
    console.error("addStandaloneTodo:", e);
    return null;
  }
}

export async function updateStandaloneTodo(
  id: string,
  updates: {
    body?: string;
    deadline_date?: string | null;
    publisher_id?: string | null;
    partner_id?: string | null;
  }
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession().catch(() => {});
    const payload: {
      body?: string;
      deadline_date?: string | null;
      publisher_id?: string | null;
      partner_id?: string | null;
    } = {};
    if (updates.body !== undefined) payload.body = updates.body.trim();
    if (updates.deadline_date !== undefined) payload.deadline_date = updates.deadline_date;
    if (updates.publisher_id !== undefined) payload.publisher_id = updates.publisher_id;
    if (updates.partner_id !== undefined) payload.partner_id = updates.partner_id;
    if (Object.keys(payload).length === 0) return true;
    const { error } = await supabase.from("call_todos").update(payload).eq("id", id);
    if (error) {
      console.error("updateStandaloneTodo:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("updateStandaloneTodo:", e);
    return false;
  }
}

function buildCallMetaById(calls: any[]): Map<string, { visit_date: string | null; establishment_id: string | null; householder_id: string | null; context_name: string | null; context_establishment_name: string | null; context_status: string | null; context_establishment_status: string | null; call_created_at: string | null; context_area: string | null }> {
  return new Map(
    calls.map((c) => {
      const establishment = Array.isArray((c as any).establishment)
        ? (c as any).establishment[0]
        : (c as any).establishment;
      const householder = Array.isArray((c as any).householder)
        ? (c as any).householder[0]
        : (c as any).householder;
      const context_name = (c.householder_id && householder?.name
        ? householder.name
        : establishment?.name ?? null) as string | null;
      const context_establishment_name = (establishment?.name ?? null) as string | null;
      const establishment_status = establishment?.statuses
        ? getBestStatus(establishment.statuses as string[])
        : null;
      const context_status = c.householder_id && householder?.status
        ? householder.status
        : establishment_status;
      return [
        c.id,
        {
          visit_date: c.visit_date ?? null,
          establishment_id: c.establishment_id ?? null,
          householder_id: c.householder_id ?? null,
          context_name: context_name ?? null,
          context_establishment_name: context_establishment_name ?? null,
          context_status: context_status ?? null,
          context_establishment_status: establishment_status ?? null,
          call_created_at: c.created_at ?? null,
          context_area: establishment?.area ?? null,
        },
      ];
    })
  );
}

async function enrichTodoItems(
  todos: CallTodo[]
): Promise<MyOpenCallTodoItem[]> {
  const supabase = createSupabaseBrowserClient();
  const callIds = todos
    .map((t) => t.call_id)
    .filter((id): id is string => !!id);

  let callMetaById = new Map<string, { visit_date: string | null; establishment_id: string | null; householder_id: string | null; context_name: string | null; context_establishment_name: string | null; context_status: string | null; context_establishment_status: string | null; call_created_at: string | null; context_area: string | null }>();
  if (callIds.length > 0) {
    const { data: calls } = await supabase
      .from("calls")
      .select(
        "id, created_at, visit_date, establishment_id, householder_id, establishment:business_establishments!calls_establishment_id_fkey(name, statuses, area), householder:householders!calls_householder_id_fkey(name, status)"
      )
      .in("id", callIds);
    if (calls?.length) {
      callMetaById = buildCallMetaById(calls);
    }
  }

  const establishmentIds = new Set<string>();
  const householderIds = new Set<string>();
  for (const t of todos) {
    const callMeta = t.call_id ? callMetaById.get(t.call_id) : undefined;
    const effectiveEstablishmentId = t.establishment_id ?? callMeta?.establishment_id ?? null;
    const effectiveHouseholderId = t.householder_id ?? callMeta?.householder_id ?? null;
    if (effectiveEstablishmentId) establishmentIds.add(effectiveEstablishmentId);
    if (effectiveHouseholderId) householderIds.add(effectiveHouseholderId);
  }

  const [establishmentRows, householderRows] = await Promise.all([
    establishmentIds.size
      ? supabase
          .from("business_establishments")
          .select("id, name, statuses, area")
          .in("id", Array.from(establishmentIds))
      : Promise.resolve({ data: [], error: null } as any),
    householderIds.size
      ? supabase
          .from("householders")
          .select("id, name, status, establishment_id")
          .in("id", Array.from(householderIds))
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  const establishmentById = new Map<string, { id: string; name: string; statuses?: string[] | null; area?: string | null }>();
  for (const e of establishmentRows.data ?? []) {
    establishmentById.set(e.id, e);
  }
  const householderById = new Map<string, { id: string; name: string; status?: string | null; establishment_id?: string | null }>();
  for (const h of householderRows.data ?? []) {
    householderById.set(h.id, h);
  }

  const items = todos.map((t) => {
    const callMeta = t.call_id ? callMetaById.get(t.call_id) : undefined;
    const effectiveEstablishmentId = t.establishment_id ?? callMeta?.establishment_id ?? null;
    const effectiveHouseholderId = t.householder_id ?? callMeta?.householder_id ?? null;
    const establishment = effectiveEstablishmentId ? establishmentById.get(effectiveEstablishmentId) : undefined;
    const householder = effectiveHouseholderId ? householderById.get(effectiveHouseholderId) : undefined;
    const householderEstablishment = householder?.establishment_id
      ? establishmentById.get(householder.establishment_id)
      : undefined;
    const establishmentStatus = establishment?.statuses
      ? getBestStatus(establishment.statuses)
      : null;

    const context_name = householder?.name ?? establishment?.name ?? callMeta?.context_name ?? null;
    const context_status = householder?.status ?? establishmentStatus ?? callMeta?.context_status ?? null;
    const context_establishment_name = householder
      ? householderEstablishment?.name ?? establishment?.name ?? callMeta?.context_establishment_name ?? null
      : establishment?.name ?? callMeta?.context_establishment_name ?? null;
    const context_establishment_status = householder
      ? (householderEstablishment?.statuses ? getBestStatus(householderEstablishment.statuses) : establishmentStatus ?? callMeta?.context_establishment_status ?? null)
      : establishmentStatus ?? callMeta?.context_establishment_status ?? null;
    const context_area = establishment?.area ?? callMeta?.context_area ?? null;

    return {
      ...(t as CallTodo),
      visit_date: callMeta?.visit_date ?? null,
      establishment_id: effectiveEstablishmentId,
      householder_id: effectiveHouseholderId,
      context_name,
      context_establishment_name,
      context_status,
      context_establishment_status,
      call_created_at: callMeta?.call_created_at ?? t.created_at ?? null,
      context_area,
    } as MyOpenCallTodoItem;
  });

  items.sort((a, b) => {
    const aAt = a.call_created_at ?? "";
    const bAt = b.call_created_at ?? "";
    return aAt.localeCompare(bAt);
  });

  return items;
}

/** Open (incomplete) to-dos for todos where the user is publisher or partner. */
export async function getMyOpenCallTodos(userId: string, limit = 15): Promise<MyOpenCallTodoItem[]> {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession().catch(() => {});
    const { data: calls, error: callsError } = await supabase
      .from("calls")
      .select("id")
      .or(`publisher_id.eq.${userId},partner_id.eq.${userId}`)
      .limit(200);
    if (callsError) return [];
    const callIds = (calls ?? []).map((c) => c.id);

    const linkedPromise = callIds.length
      ? supabase
          .from("call_todos")
          .select("id, call_id, congregation_id, establishment_id, householder_id, body, is_done, publisher_id, partner_id, deadline_date, created_at")
          .eq("is_done", false)
          .in("call_id", callIds)
          .limit(limit)
      : Promise.resolve({ data: [], error: null } as any);
    const standalonePromise = supabase
      .from("call_todos")
      .select("id, call_id, congregation_id, establishment_id, householder_id, body, is_done, publisher_id, partner_id, deadline_date, created_at")
      .eq("is_done", false)
      .is("call_id", null)
      .or(`publisher_id.eq.${userId},partner_id.eq.${userId}`)
      .limit(limit);
    const [{ data: linked, error: linkedError }, { data: standalone, error: standaloneError }] = await Promise.all([
      linkedPromise,
      standalonePromise,
    ]);
    if (linkedError || standaloneError) return [];

    const byId = new Map<string, CallTodo>();
    for (const t of (linked ?? []) as CallTodo[]) byId.set(t.id, t);
    for (const t of (standalone ?? []) as CallTodo[]) byId.set(t.id, t);
    const merged = Array.from(byId.values()).slice(0, limit);
    if (merged.length === 0) return [];
    return await enrichTodoItems(merged);
  } catch (e) {
    console.error('getMyOpenCallTodos:', e);
    return [];
  }
}

/** Completed (done) to-dos for todos where the user is publisher or partner. */
export async function getMyCompletedCallTodos(userId: string, limit = 20): Promise<MyOpenCallTodoItem[]> {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession().catch(() => {});
    const { data: calls, error: callsError } = await supabase
      .from("calls")
      .select("id")
      .or(`publisher_id.eq.${userId},partner_id.eq.${userId}`)
      .limit(200);
    if (callsError) return [];
    const callIds = (calls ?? []).map((c) => c.id);

    const linkedPromise = callIds.length
      ? supabase
          .from("call_todos")
          .select("id, call_id, congregation_id, establishment_id, householder_id, body, is_done, publisher_id, partner_id, deadline_date, created_at")
          .eq("is_done", true)
          .in("call_id", callIds)
          .limit(limit)
      : Promise.resolve({ data: [], error: null } as any);
    const standalonePromise = supabase
      .from("call_todos")
      .select("id, call_id, congregation_id, establishment_id, householder_id, body, is_done, publisher_id, partner_id, deadline_date, created_at")
      .eq("is_done", true)
      .is("call_id", null)
      .or(`publisher_id.eq.${userId},partner_id.eq.${userId}`)
      .limit(limit);
    const [{ data: linked, error: linkedError }, { data: standalone, error: standaloneError }] = await Promise.all([
      linkedPromise,
      standalonePromise,
    ]);
    if (linkedError || standaloneError) return [];

    const byId = new Map<string, CallTodo>();
    for (const t of (linked ?? []) as CallTodo[]) byId.set(t.id, t);
    for (const t of (standalone ?? []) as CallTodo[]) byId.set(t.id, t);
    const merged = Array.from(byId.values()).slice(0, limit);
    if (merged.length === 0) return [];
    return await enrichTodoItems(merged);
  } catch (e) {
    console.error('getMyCompletedCallTodos:', e);
    return [];
  }
}

async function getScopedCallTodos(options: {
  establishmentId?: string;
  householderId?: string;
  isDone: boolean;
  limit?: number;
}): Promise<MyOpenCallTodoItem[]> {
  const { establishmentId, householderId, isDone, limit = 50 } = options;
  if (!establishmentId && !householderId) return [];

  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession().catch(() => {});
    let callsQuery = supabase.from("calls").select("id").limit(300);
    if (establishmentId) callsQuery = callsQuery.eq("establishment_id", establishmentId);
    if (householderId) callsQuery = callsQuery.eq("householder_id", householderId);
    const { data: calls, error: callsError } = await callsQuery;
    if (callsError) return [];
    const callIds = (calls ?? []).map((c) => c.id);

    const linkedPromise = callIds.length
      ? supabase
          .from("call_todos")
          .select("id, call_id, congregation_id, establishment_id, householder_id, body, is_done, publisher_id, partner_id, deadline_date, created_at")
          .eq("is_done", isDone)
          .in("call_id", callIds)
          .limit(limit)
      : Promise.resolve({ data: [], error: null } as any);

    let standaloneQuery = supabase
      .from("call_todos")
      .select("id, call_id, congregation_id, establishment_id, householder_id, body, is_done, publisher_id, partner_id, deadline_date, created_at")
      .eq("is_done", isDone)
      .is("call_id", null)
      .limit(limit);
    if (establishmentId) standaloneQuery = standaloneQuery.eq("establishment_id", establishmentId);
    if (householderId) standaloneQuery = standaloneQuery.eq("householder_id", householderId);

    const [{ data: linked, error: linkedError }, { data: standalone, error: standaloneError }] = await Promise.all([
      linkedPromise,
      standaloneQuery,
    ]);
    if (linkedError || standaloneError) return [];

    const byId = new Map<string, CallTodo>();
    for (const t of (linked ?? []) as CallTodo[]) byId.set(t.id, t);
    for (const t of (standalone ?? []) as CallTodo[]) byId.set(t.id, t);
    const merged = Array.from(byId.values()).slice(0, limit);
    if (merged.length === 0) return [];
    return await enrichTodoItems(merged);
  } catch (e) {
    console.error("getScopedCallTodos:", e);
    return [];
  }
}

export function getEstablishmentOpenCallTodos(establishmentId: string, limit = 50): Promise<MyOpenCallTodoItem[]> {
  return getScopedCallTodos({ establishmentId, isDone: false, limit });
}

export function getEstablishmentCompletedCallTodos(establishmentId: string, limit = 50): Promise<MyOpenCallTodoItem[]> {
  return getScopedCallTodos({ establishmentId, isDone: true, limit });
}

export function getHouseholderOpenCallTodos(householderId: string, limit = 50): Promise<MyOpenCallTodoItem[]> {
  return getScopedCallTodos({ householderId, isDone: false, limit });
}

export function getHouseholderCompletedCallTodos(householderId: string, limit = 50): Promise<MyOpenCallTodoItem[]> {
  return getScopedCallTodos({ householderId, isDone: true, limit });
}

/** Distinct guest names used in calls for the current user's congregation (for "Guest" dropdown). */
export async function getDistinctCallGuestNames(): Promise<string[]> {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession().catch(() => {});
    const { data: profile } = await supabase
      .from('profiles')
      .select('congregation_id')
      .eq('id', (await supabase.auth.getUser()).data.user?.id)
      .single();
    if (!profile?.congregation_id) return [];
    const { data, error } = await supabase
      .from('calls')
      .select('publisher_guest_name, partner_guest_name')
      .eq('congregation_id', profile.congregation_id);
    if (error) {
      console.error('getDistinctCallGuestNames:', error);
      return [];
    }
    const names = new Set<string>();
    (data ?? []).forEach((row: any) => {
      const a = row?.publisher_guest_name?.trim();
      const b = row?.partner_guest_name?.trim();
      if (a) names.add(a);
      if (b) names.add(b);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  } catch (e) {
    console.error('getDistinctCallGuestNames:', e);
    return [];
  }
}

export async function getUniqueAreas(): Promise<string[]> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  const { data } = await supabase
    .from('business_establishments')
    .select('area')
    .not('area', 'is', null)
    .not('area', 'eq', '');
  
  const areas = (data as any[] || [])
    .map(item => item.area)
    .filter(Boolean)
    .filter((value, index, self) => self.indexOf(value) === index) // unique
    .sort();
  
  return areas;
}

export async function getUniqueFloors(): Promise<string[]> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  const { data } = await supabase
    .from('business_establishments')
    .select('floor')
    .not('floor', 'is', null)
    .not('floor', 'eq', '');
  
  const floors = (data as any[] || [])
    .map(item => item.floor)
    .filter(Boolean)
    .filter((value, index, self) => self.indexOf(value) === index) // unique
    .sort();
  
  return floors;
}

export async function getEstablishmentsWithDetails(): Promise<EstablishmentWithDetails[]> {
  const supabase = createSupabaseBrowserClient();
  const cacheKey = 'establishments:with-details';
  
  try {
    // Return cached data immediately if available (for fast initial load)
    const cached = await cacheGet<EstablishmentWithDetails[]>(cacheKey);
    if (cached?.length && typeof navigator !== 'undefined' && !navigator.onLine) {
      // If offline, return cached data
      return cached;
    }
    
    // Get current user's congregation_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('congregation_id')
      .eq('id', (await supabase.auth.getUser()).data.user?.id)
      .single();
    
    if (profileError) {
      console.error('Error fetching profile:', profileError);
      const cached = await cacheGet<EstablishmentWithDetails[]>(cacheKey);
      return cached ?? [];
    }
    
    if (!profile?.congregation_id) {
      return [];
    }


    // Get establishments with only fields used in list views
    const { data, error } = await supabase
      .from('business_establishments')
      .select(`
        id,
        name,
        statuses,
        area,
        floor,
        description,
        note,
        lat,
        lng,
        created_at,
        updated_at,
        publisher_id
      `)
      .eq('congregation_id', profile.congregation_id)
      .eq('is_deleted', false)
      .eq('is_archived', false)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching establishments:', error);
      console.error('Error details:', error.message, error.details, error.hint);
      return [];
    }


    const establishmentIds = (data ?? []).map((row) => row.id).filter(Boolean);

    type VisitRow = {
      establishment_id?: string | null;
      visit_date?: string | null;
      publisher?:
        | { id: string; first_name: string; last_name: string; avatar_url?: string | null }
        | Array<{ id: string; first_name: string; last_name: string; avatar_url?: string | null }>
        | null;
      partner?:
        | { id: string; first_name: string; last_name: string; avatar_url?: string | null }
        | Array<{ id: string; first_name: string; last_name: string; avatar_url?: string | null }>
        | null;
    };

    const [visitsResult, householdersResult] = await Promise.all([
      establishmentIds.length
        ? supabase
            .from('calls')
            .select(
              `
                establishment_id,
                visit_date,
                publisher:profiles!calls_publisher_id_fkey(id, first_name, last_name, avatar_url),
                partner:profiles!calls_partner_id_fkey(id, first_name, last_name, avatar_url)
              `
            )
            .in('establishment_id', establishmentIds)
        : Promise.resolve({ data: [] as VisitRow[] }),
      establishmentIds.length
        ? supabase
            .from('householders')
            .select('id, establishment_id')
            .in('establishment_id', establishmentIds)
            .eq('is_deleted', false)
            .eq('is_archived', false)
        : Promise.resolve({ data: [] as { id: string; establishment_id?: string | null }[] })
    ]);

    const visitsError = (visitsResult as any)?.error;
    if (visitsError) {
      console.error('Error fetching establishment visits for list:', visitsError);
    }
    const householdersError = (householdersResult as any)?.error;
    if (householdersError) {
      console.error('Error fetching householders for list:', householdersError);
    }

    const visits = (visitsResult as any)?.data as VisitRow[] | undefined;
    const householders = (householdersResult as any)?.data as { id: string; establishment_id?: string | null }[] | undefined;

    const visitStats = new Map<
      string,
      {
        visit_count: number;
        last_visit_at: string | null;
        visitorCounts: Map<string, { count: number; profile: any }>;
      }
    >();

    (visits ?? []).forEach((visit) => {
      const establishmentId = visit.establishment_id;
      if (!establishmentId) return;
      if (!visitStats.has(establishmentId)) {
        visitStats.set(establishmentId, {
          visit_count: 0,
          last_visit_at: null,
          visitorCounts: new Map()
        });
      }
      const stats = visitStats.get(establishmentId)!;
      stats.visit_count += 1;
      if (visit.visit_date) {
        if (!stats.last_visit_at || visit.visit_date > stats.last_visit_at) {
          stats.last_visit_at = visit.visit_date;
        }
      }
      const publisher = Array.isArray(visit.publisher) ? visit.publisher[0] : visit.publisher;
      const partner = Array.isArray(visit.partner) ? visit.partner[0] : visit.partner;
      if (publisher) {
        const existing = stats.visitorCounts.get(publisher.id);
        stats.visitorCounts.set(publisher.id, {
          count: (existing?.count || 0) + 1,
          profile: publisher
        });
      }
      if (partner) {
        const existing = stats.visitorCounts.get(partner.id);
        stats.visitorCounts.set(partner.id, {
          count: (existing?.count || 0) + 1,
          profile: partner
        });
      }
    });

    const householdersByEstablishment = new Map<string, number>();
    (householders ?? []).forEach((householder) => {
      const establishmentId = householder.establishment_id;
      if (!establishmentId) return;
      householdersByEstablishment.set(establishmentId, (householdersByEstablishment.get(establishmentId) || 0) + 1);
    });

    // Transform the data to include counts and top visitors
    const establishments = (data ?? []).map((establishment) => {
      const stats = visitStats.get(establishment.id) || {
        visit_count: 0,
        last_visit_at: null,
        visitorCounts: new Map<string, { count: number; profile: any }>()
      };
      const top_visitors = Array.from(stats.visitorCounts.entries())
        .map(([user_id, data]) => ({
          user_id,
          first_name: data.profile.first_name,
          last_name: data.profile.last_name,
          avatar_url: data.profile.avatar_url,
          visit_count: data.count
        }))
        .sort((a, b) => b.visit_count - a.visit_count)
        .slice(0, 5);

      return {
        ...establishment,
        visit_count: stats.visit_count,
        householder_count: householdersByEstablishment.get(establishment.id) || 0,
        last_visit_at: stats.last_visit_at,
        top_visitors
      } as EstablishmentWithDetails;
    });

    // Cache the results and return fresh data so refetches (e.g. from Realtime) show latest immediately
    await cacheSet(cacheKey, establishments);
    return establishments;
  } catch (error) {
    console.error('Unexpected error in getEstablishmentsWithDetails:', error);
    const cached = await cacheGet<EstablishmentWithDetails[]>(cacheKey);
    return cached ?? [];
  }
}

export async function getEstablishmentDetails(establishmentId: string): Promise<{
  establishment: EstablishmentWithDetails;
  visits: VisitWithUser[];
  householders: HouseholderWithDetails[];
} | null> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  const cacheKey = `establishment:details:${establishmentId}`;
  
  try {
    // If offline, serve from cache
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = await cacheGet<{
        establishment: EstablishmentWithDetails;
        visits: VisitWithUser[];
        householders: HouseholderWithDetails[];
      }>(cacheKey);
      return cached ?? null;
    }
  
  // Get establishment details — exclude soft-deleted/archived (same filter as list so details detect delete)
  const { data: establishment } = await supabase
    .from('business_establishments')
    .select('*')
    .eq('id', establishmentId)
    .eq('is_deleted', false)
    .eq('is_archived', false)
    .single();
  
  if (!establishment) {
    // Row not found (e.g. soft-deleted by another user) — clear cache and return null so UI can show list + toast
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      await cacheDelete(cacheKey);
    }
    return null;
  }
  
  const transformedVisits = await getEstablishmentVisitsWithUsers(establishmentId);
  
  // Get householders for this establishment only (no user assignment)
  const { data: householders } = await supabase
    .from('householders')
    .select(`
      id,
      name,
      status,
      note
    `)
    .eq('establishment_id', establishmentId)
    .eq('is_deleted', false)
    .eq('is_archived', false)
    .order('name');
  
  // Get top visitors for establishment
  const { data: topVisitors } = await supabase
    .from('calls')
    .select(`
      publisher_id,
      profiles!calls_publisher_id_fkey(first_name, last_name, avatar_url)
    `)
    .eq('establishment_id', establishmentId)
    .not('publisher_id', 'is', null);
  
  const visitorCounts = new Map<string, { count: number; profile: any }>();
  topVisitors?.forEach(visit => {
    if (visit.publisher_id && visit.profiles) {
      const existing = visitorCounts.get(visit.publisher_id);
      visitorCounts.set(visit.publisher_id, {
        count: (existing?.count || 0) + 1,
        profile: visit.profiles
      });
    }
  });
  
  const topVisitorsList = Array.from(visitorCounts.entries())
    .map(([user_id, data]) => ({
      user_id,
      first_name: data.profile.first_name,
      last_name: data.profile.last_name,
      avatar_url: data.profile.avatar_url,
      visit_count: data.count
    }))
    .sort((a, b) => b.visit_count - a.visit_count)
    .slice(0, 2);

  let assigned_user: EstablishmentWithDetails['assigned_user'] = null;
  if (establishment.publisher_id) {
    try {
      const profileModule = await import('@/lib/db/profiles');
      const profile = await profileModule.getProfile(establishment.publisher_id);
      if (profile) {
        assigned_user = {
          id: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          avatar_url: profile.avatar_url ?? undefined
        };
      }
    } catch (e) {
      // optional
    }
  }
  
  const result = {
    establishment: {
      ...establishment,
      publisher_id: establishment.publisher_id ?? null,
      assigned_user,
      top_visitors: topVisitorsList
    },
    visits: transformedVisits,
    householders: householders || []
  };
  
  // Cache the results
  await cacheSet(cacheKey, result);
  return result;
  } catch (error) {
    console.error('Error fetching establishment details:', error);
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (!isOffline) return null;
    const cached = await cacheGet<{
      establishment: EstablishmentWithDetails;
      visits: VisitWithUser[];
      householders: HouseholderWithDetails[];
    }>(cacheKey);
    return cached ?? null;
  }
}

export async function getHouseholderDetails(householderId: string): Promise<{
  householder: HouseholderWithDetails;
  visits: VisitWithUser[];
  establishment?: { id: string; name: string } | null;
} | null> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  const cacheKey = `householder:details:v2:${householderId}`;
  
  try {
    // If offline, serve from cache
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = await cacheGet<{
        householder: HouseholderWithDetails;
        visits: VisitWithUser[];
        establishment?: { id: string; name: string } | null;
      }>(cacheKey);
      return cached ?? null;
    }

  // Householder with establishment and publisher profile
  // Fetch visits first to ensure they're always loaded, even if householder query fails
  const transformedVisits = await getHouseholderVisitsWithUsers(householderId);
  
  // Fetch householder without publisher join (more reliable). Exclude soft-deleted (deleted_at / is_deleted).
  const { data: hh, error: hhError } = await supabase
    .from('householders')
    .select('id,name,status,note,establishment_id,publisher_id,lat,lng,created_at, establishment:business_establishments(id,name,statuses)')
    .eq('id', householderId)
    .eq('is_deleted', false)
    .eq('is_archived', false)
    .single();

  if (hhError || !hh) {
    // Row not found (e.g. soft-deleted by another user) — return null so UI can show list + toast
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (!isOffline) {
      await cacheDelete(cacheKey);
      return null;
    }
    const cached = await cacheGet<{
      householder: HouseholderWithDetails;
      visits: VisitWithUser[];
      establishment?: { id: string; name: string } | null;
    }>(cacheKey);
    return cached ?? null;
  }
  
  // Fetch publisher profile separately if needed
  let publisher = null;
  if (hh.publisher_id) {
    try {
      const profileModule = await import('@/lib/db/profiles');
      publisher = await profileModule.getProfile(hh.publisher_id);
    } catch (e) {
      // Silently fail - publisher profile is optional
      console.debug('Could not fetch publisher profile:', e);
    }
  }

  const establishment = Array.isArray((hh as any).establishment) ? (hh as any).establishment[0] : (hh as any).establishment;

  // Calculate last_visit_at from visits
  const last_visit_at = transformedVisits.length > 0
    ? transformedVisits
        .map((v) => v.visit_date)
        .filter(Boolean)
        .sort((a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0))[0] || null
    : null;

  const householder: HouseholderWithDetails = {
    id: hh.id,
    name: hh.name,
    status: hh.status,
    note: hh.note,
    establishment_id: hh.establishment_id,
    establishment_name: establishment?.name,
    publisher_id: hh.publisher_id,
    lat: hh.lat,
    lng: hh.lng,
    created_at: hh.created_at,
    last_visit_at,
    assigned_user: publisher ? {
      id: publisher.id,
      first_name: publisher.first_name,
      last_name: publisher.last_name,
      avatar_url: publisher.avatar_url || undefined
    } : null,
  };

  const result = {
    householder,
    visits: transformedVisits,
    establishment: establishment ? { id: establishment.id, name: establishment.name } : null,
  };
  
  // Cache the results
  await cacheSet(cacheKey, result);
  return result;
  } catch (error) {
    console.error('Error fetching householder details:', error);
    const cached = await cacheGet<{
      householder: HouseholderWithDetails;
      visits: VisitWithUser[];
      establishment?: { id: string; name: string } | null;
    }>(cacheKey);
    return cached ?? null;
  }
}

export async function getBwiParticipants(): Promise<Array<{
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}>> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  const cacheKey = 'bwi:participants';
  
  try {
    // If offline, serve from cache
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = await cacheGet<Array<{
        id: string;
        first_name: string;
        last_name: string;
        avatar_url?: string;
      }>>(cacheKey);
      return cached ?? [];
    }
    
    // Get user's congregation_id
    const { data: profile } = await supabase.rpc('get_my_profile');
    if (!profile?.congregation_id) {
      return [];
    }

    // Primary: active BWI participants for this congregation
    const { data, error } = await supabase
      .from('business_participants')
      .select(`
        user_id,
        profiles!business_participants_user_id_fkey(id, first_name, last_name, avatar_url)
      `)
      .eq('congregation_id', profile.congregation_id)
      .eq('active', true);

    let participants: Array<{ id: string; first_name: string; last_name: string; avatar_url?: string }> =
      data?.map((item) => {
        const p = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
        return {
          id: item.user_id,
          first_name: p?.first_name || "",
          last_name: p?.last_name || "",
          avatar_url: p?.avatar_url
        };
      }) || [];

    // Fallback: if there are no explicit BWI participants (or query fails), use all congregation members.
    // This ensures elders and other users can still select publishers for visit updates.
    if ((!participants || participants.length === 0) || error) {
      try {
        const { data: profilesFallback } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, avatar_url")
          .eq("congregation_id", profile.congregation_id);

        if (profilesFallback && profilesFallback.length > 0) {
          participants =
            profilesFallback.map((p: any) => ({
              id: p.id,
              first_name: p.first_name || "",
              last_name: p.last_name || "",
              avatar_url: p.avatar_url || undefined
            })) || participants;
        }
      } catch (fallbackError) {
        console.error("Error fetching congregation profiles as fallback for participants:", fallbackError);
      }
    }

    // Cache the results (whatever list we ended up with)
    await cacheSet(cacheKey, participants);
    return participants;
  } catch (error) {
    console.error('Error fetching participants:', error);
    const cached = await cacheGet<Array<{
      id: string;
      first_name: string;
      last_name: string;
      avatar_url?: string;
    }>>(cacheKey);
    return cached ?? [];
  }
}

export async function archiveEstablishment(establishmentId: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  
  // Get user's profile
  const { data: profile } = await supabase.rpc('get_my_profile');
  if (!profile?.id) {
    throw new Error('User not authenticated');
  }
  
  const { error } = await supabase
    .from('business_establishments')
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_by: profile.id
    })
    .eq('id', establishmentId);
  
  if (error) {
    console.error('Failed to archive establishment:', error);
    return false;
  }
  
  return true;
}

export async function deleteEstablishment(establishmentId: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  
  // Get user's profile
  const { data: profile } = await supabase.rpc('get_my_profile');
  if (!profile?.id) {
    throw new Error('User not authenticated');
  }
  
  const { error } = await supabase
    .from('business_establishments')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: profile.id
    })
    .eq('id', establishmentId);
  
  if (error) {
    console.error('Failed to delete establishment:', error);
    return false;
  }
  
  return true;
}

