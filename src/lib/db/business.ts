"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cacheGet, cacheSet } from "@/lib/offline/store";

export interface BusinessFiltersState {
  search: string;
  statuses: string[];
  areas: string[];
  myEstablishments: boolean;
  sort?: 'name_asc' | 'name_desc' | 'last_visit_desc' | 'last_visit_asc' | 'area_asc' | 'area_desc';
}

export type EstablishmentStatus = 
  | 'for_scouting'
  | 'for_follow_up'
  | 'for_replenishment'
  | 'accepted_rack'
  | 'declined_rack'
  | 'has_bible_studies';
export type HouseholderStatus = 'interested'|'return_visit'|'bible_study'|'do_not_call';

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
  establishment_id: string;
  name: string;
  status: HouseholderStatus;
  note?: string | null;
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
}

export interface HouseholderWithDetails {
  id: string;
  name: string;
  status: HouseholderStatus;
  note?: string | null;
  establishment_id?: string;
  establishment_name?: string;
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
  
  console.log('Sending establishment data:', establishmentData);
  
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
  const payload: any = { establishment_id: h.establishment_id, name: h.name, status: h.status, note: h.note ?? null };
  if (h.id) {
    const { data, error } = await supabase.from('business_householders').update(payload).eq('id', h.id).select().single();
    if (error) return null; return data as any;
  }
  const { data, error } = await supabase.from('business_householders').insert(payload).select().single();
  if (error) return null; return data as any;
}

export async function deleteHouseholder(householderId: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  const { error } = await supabase.from('business_householders').delete().eq('id', householderId);
  if (error) {
    console.error('Error deleting householder:', error);
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
  visit_date?: string;
}): Promise<{
  id: string;
  establishment_id?: string | null;
  householder_id?: string | null;
  note?: string | null;
  publisher_id?: string | null;
  partner_id?: string | null;
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

    console.log('Adding visit with data:', {
      congregation_id: profile.congregation_id,
      establishment_id: visit.establishment_id === 'none' ? null : visit.establishment_id,
      householder_id: visit.householder_id || null,
      note: visit.note,
      publisher_id: visit.publisher_id || null,
      partner_id: visit.partner_id || null,
      visit_date: visit.visit_date || new Date().toISOString().split('T')[0]
    });

    const { data, error } = await supabase
      .from('business_visits')
      .insert({
        congregation_id: profile.congregation_id,
        establishment_id: visit.establishment_id === 'none' ? null : visit.establishment_id,
        householder_id: visit.householder_id || null,
        note: visit.note,
        publisher_id: visit.publisher_id || null,
        partner_id: visit.partner_id || null,
        visit_date: visit.visit_date || new Date().toISOString().split('T')[0]
      })
      .select('id, establishment_id, householder_id, note, publisher_id, partner_id, visit_date')
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
  visit_date?: string;
}): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession().catch(() => {});
    const { error } = await supabase
      .from('business_visits')
      .update({
        establishment_id: visit.establishment_id ?? null,
        householder_id: visit.householder_id ?? null,
        note: visit.note ?? null,
        publisher_id: visit.publisher_id ?? null,
        partner_id: visit.partner_id ?? null,
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
    const { error, status } = await supabase
      .from('business_visits')
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
  
  try {
    // Get current user's congregation_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('congregation_id')
      .eq('id', (await supabase.auth.getUser()).data.user?.id)
      .single();
    
    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return [];
    }
    
    if (!profile?.congregation_id) {
      console.log('User not associated with a congregation');
      return [];
    }

    console.log('Fetching establishments for congregation:', profile.congregation_id);

    // Get establishments with visit and householder counts
    const { data, error } = await supabase
      .from('business_establishments')
      .select(`
        *,
        visits:business_visits!business_visits_establishment_id_fkey(
          id,
          visit_date,
          publisher:profiles!business_visits_publisher_id_fkey(
            id,
            first_name,
            last_name,
            avatar_url
          ),
          partner:profiles!business_visits_partner_id_fkey(
            id,
            first_name,
            last_name,
            avatar_url
          )
        ),
        householders:business_householders!business_householders_establishment_id_fkey(
          id
        )
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

    console.log('Raw establishments data:', data);

    // Transform the data to include counts and top visitors
    const establishments = data?.map(establishment => {
      // Count visits and householders
      const visit_count = establishment.visits?.length || 0;
      const householder_count = establishment.householders?.length || 0;
      const last_visit_at = (establishment.visits || [])
        .map((v: any) => v?.visit_date)
        .filter(Boolean)
        .sort((a: string, b: string) => (a < b ? 1 : a > b ? -1 : 0))[0] || null;
      
      // Get top visitors (publishers and partners who visited most)
      const visitorCounts = new Map<string, { count: number; profile: any }>();
      
      establishment.visits?.forEach((visit: any) => {
        // Count publisher
        if (visit.publisher) {
          const existing = visitorCounts.get(visit.publisher.id);
          visitorCounts.set(visit.publisher.id, {
            count: (existing?.count || 0) + 1,
            profile: visit.publisher
          });
        }
        
        // Count partner
        if (visit.partner) {
          const existing = visitorCounts.get(visit.partner.id);
          visitorCounts.set(visit.partner.id, {
            count: (existing?.count || 0) + 1,
            profile: visit.partner
          });
        }
      });
      
      const top_visitors = Array.from(visitorCounts.entries())
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
        visit_count,
        householder_count,
        last_visit_at,
        top_visitors
      };
    }) || [];

    console.log('Processed establishments:', establishments);
    return establishments;
  } catch (error) {
    console.error('Unexpected error in getEstablishmentsWithDetails:', error);
    return [];
  }
}

export async function getEstablishmentDetails(establishmentId: string): Promise<{
  establishment: EstablishmentWithDetails;
  visits: VisitWithUser[];
  householders: HouseholderWithDetails[];
} | null> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  
  // Get establishment details
  const { data: establishment } = await supabase
    .from('business_establishments')
    .select('*')
    .eq('id', establishmentId)
    .single();
  
  if (!establishment) return null;
  
  // Get visits with user details - fix the query to properly join profiles
  const { data: visits } = await supabase
    .from('business_visits')
    .select(`
      id,
      note,
      visit_date,
      publisher_id,
      partner_id,
      publisher:profiles!business_visits_publisher_id_fkey(id, first_name, last_name, avatar_url),
      partner:profiles!business_visits_partner_id_fkey(id, first_name, last_name, avatar_url)
    `)
    .eq('establishment_id', establishmentId)
    .order('visit_date', { ascending: false });

  console.log('Raw visits data:', visits); // Debug log

  // Transform visits to match VisitWithUser type
  const transformedVisits = (visits as any[])?.map((visit: any) => {
    console.log('Processing visit:', visit); // Debug log
    console.log('Visit publisher data:', visit.publisher); // Debug publisher data
    console.log('Visit partner data:', visit.partner); // Debug partner data
    return {
      id: visit.id,
      note: visit.note,
      visit_date: visit.visit_date,
      publisher_id: visit.publisher_id ?? (Array.isArray(visit.publisher) ? (visit.publisher[0]?.id ?? null) : (visit.publisher?.id ?? null)),
      partner_id: visit.partner_id ?? (Array.isArray(visit.partner) ? (visit.partner[0]?.id ?? null) : (visit.partner?.id ?? null)),
      publisher: Array.isArray(visit.publisher) ? visit.publisher[0] || null : visit.publisher || null,
      partner: Array.isArray(visit.partner) ? visit.partner[0] || null : visit.partner || null
    };
  }) || [];

  console.log('Transformed visits:', transformedVisits); // Debug log
  
  // Get householders for this establishment only (no user assignment)
  const { data: householders } = await supabase
    .from('business_householders')
    .select(`
      id,
      name,
      status,
      note
    `)
    .eq('establishment_id', establishmentId)
    .order('name');
  
  // Get top visitors for establishment
  const { data: topVisitors } = await supabase
    .from('business_visits')
    .select(`
      publisher_id,
      profiles!business_visits_publisher_id_fkey(first_name, last_name, avatar_url)
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
  
  return {
    establishment: {
      ...establishment,
      top_visitors: topVisitorsList
    },
    visits: transformedVisits,
    householders: householders || []
  };
}

export async function getHouseholderDetails(householderId: string): Promise<{
  householder: HouseholderWithDetails;
  visits: VisitWithUser[];
  establishment?: { id: string; name: string } | null;
} | null> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});

  // Householder with establishment
  const { data: hh } = await supabase
    .from('business_householders')
    .select('id,name,status,note,establishment_id, establishment:business_establishments(id,name)')
    .eq('id', householderId)
    .single();

  if (!hh) return null;

  // Visits for householder with publisher/partner
  const { data: visits } = await supabase
    .from('business_visits')
    .select(`
      id,
      note,
      visit_date,
      publisher_id,
      partner_id,
      establishment_id,
      publisher:profiles!business_visits_publisher_id_fkey(id, first_name, last_name, avatar_url),
      partner:profiles!business_visits_partner_id_fkey(id, first_name, last_name, avatar_url)
    `)
    .eq('householder_id', householderId)
    .order('visit_date', { ascending: false });

  const transformedVisits = (visits as any[])?.map((visit: any) => ({
    id: visit.id,
    note: visit.note,
    visit_date: visit.visit_date,
    publisher_id: visit.publisher_id ?? (Array.isArray(visit.publisher) ? (visit.publisher[0]?.id ?? null) : (visit.publisher?.id ?? null)),
    partner_id: visit.partner_id ?? (Array.isArray(visit.partner) ? (visit.partner[0]?.id ?? null) : (visit.partner?.id ?? null)),
    publisher: Array.isArray(visit.publisher) ? visit.publisher[0] || null : visit.publisher || null,
    partner: Array.isArray(visit.partner) ? visit.partner[0] || null : visit.partner || null,
  })) || [];

  const establishment = Array.isArray((hh as any).establishment) ? (hh as any).establishment[0] : (hh as any).establishment;

  const householder: HouseholderWithDetails = {
    id: hh.id,
    name: hh.name,
    status: hh.status,
    note: hh.note,
    establishment_id: hh.establishment_id,
    establishment_name: establishment?.name,
  };

  return {
    householder,
    visits: transformedVisits,
    establishment: establishment ? { id: establishment.id, name: establishment.name } : null,
  };
}

export async function getBwiParticipants(): Promise<Array<{
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}>> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  
  // Get user's congregation_id
  const { data: profile } = await supabase.rpc('get_my_profile');
  if (!profile?.congregation_id) {
    console.log('No congregation_id found for user'); // Debug log
    return [];
  }
  
  console.log('Fetching participants for congregation:', profile.congregation_id); // Debug log
  
  const { data, error } = await supabase
    .from('business_participants')
    .select(`
      user_id,
      profiles!business_participants_user_id_fkey(id, first_name, last_name, avatar_url)
    `)
    .eq('congregation_id', profile.congregation_id)
    .eq('active', true);
  
  console.log('Raw participants data:', data); // Debug log
  console.log('Participants error:', error); // Debug log
  
  if (error) {
    console.error('Error fetching participants:', error);
    return [];
  }
  
  const participants = data?.map(item => {
    const profile = Array.isArray(item.profiles) ? item.profiles[0] : item.profiles;
    return {
      id: item.user_id,
      first_name: profile?.first_name || '',
      last_name: profile?.last_name || '',
      avatar_url: profile?.avatar_url
    };
  }) || [];
  
  console.log('Processed participants:', participants); // Debug log
  return participants;
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

