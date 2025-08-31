"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type EstablishmentStatus = 'for_scouting'|'for_follow_up'|'accepted_rack'|'declined_rack'|'has_bible_studies';
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

export interface EstablishmentWithDetails extends Establishment {
  visit_count?: number;
  householder_count?: number;
  top_visitors?: Array<{
    user_id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
    visit_count: number;
  }>;
}

export interface VisitWithUser {
  id: string;
  note?: string | null;
  visit_date: string;
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
  const { data } = await supabase
    .from('business_establishments')
    .select('*')
    .eq('is_deleted', false)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });
  return (data as any) ?? [];
}

export async function upsertEstablishment(e: Establishment): Promise<Establishment | null> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  
  // Get user's congregation_id
  const { data: profile } = await supabase.rpc('get_my_profile');
  if (!profile?.congregation_id) {
    throw new Error('User not assigned to a congregation');
  }
  
  const payload: any = {
    congregation_id: profile.congregation_id,
    name: e.name,
    description: e.description ?? null,
    area: e.area ?? null,
    lat: e.lat ?? null,
    lng: e.lng ?? null,
    floor: e.floor ?? null,
    status: e.status,
    note: e.note ?? null,
    created_by: profile.id,
  };
  
  if (e.id) {
    const { data, error } = await supabase.from('business_establishments').update(payload).eq('id', e.id).select().single();
    if (error) return null; return data as any;
  }
  const { data, error } = await supabase.from('business_establishments').insert(payload).select().single();
  if (error) return null; return data as any;
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

export async function addVisit(v: VisitUpdate): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  
  // Get user's congregation_id
  const { data: profile } = await supabase.rpc('get_my_profile');
  if (!profile?.congregation_id) {
    throw new Error('User not assigned to a congregation');
  }
  
  const payload: any = {
    congregation_id: profile.congregation_id,
    establishment_id: v.establishment_id ?? null,
    householder_id: v.householder_id ?? null,
    note: v.note ?? null,
    publisher_id: v.publisher_id ?? null, // Make sure this is included
    partner_id: v.partner_id ?? null,
    visit_date: v.visit_date ?? null,
  };
  
  console.log('Adding visit with payload:', payload); // Debug log
  
  const { error } = await supabase.from('business_visits').insert(payload);
  
  if (error) {
    console.error('Error adding visit:', error);
  }
  
  return !error;
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
  await supabase.auth.getSession().catch(() => {});
  
  // Get establishments with visit and householder counts (exclude archived and deleted)
  const { data: establishments } = await supabase
    .from('business_establishments')
    .select(`
      *,
      visits:business_visits(count),
      householders:business_householders(count)
    `)
    .eq('is_deleted', false)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false });
  
  if (!establishments) return [];
  
  // Get top visitors for each establishment (both publishers and partners)
  const establishmentsWithDetails = await Promise.all(
    establishments.map(async (est) => {
      const { data: topVisitors } = await supabase
        .from('business_visits')
        .select(`
          publisher_id,
          partner_id,
          publisher:profiles!business_visits_publisher_id_fkey(first_name, last_name, avatar_url),
          partner:profiles!business_visits_partner_id_fkey(first_name, last_name, avatar_url)
        `)
        .eq('establishment_id', est.id)
        .or('publisher_id.not.is.null,partner_id.not.is.null');
      
      const visitorCounts = new Map<string, { count: number; profile: any }>();
      topVisitors?.forEach(visit => {
        // Count publisher visits
        if (visit.publisher_id && visit.publisher) {
          const existing = visitorCounts.get(visit.publisher_id);
          visitorCounts.set(visit.publisher_id, {
            count: (existing?.count || 0) + 1,
            profile: visit.publisher
          });
        }
        // Count partner visits
        if (visit.partner_id && visit.partner) {
          const existing = visitorCounts.get(visit.partner_id);
          visitorCounts.set(visit.partner_id, {
            count: (existing?.count || 0) + 1,
            profile: visit.partner
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
        .slice(0, 3); // Show top 3 instead of 2
      
      return {
        ...est,
        visit_count: est.visits?.[0]?.count || 0,
        householder_count: est.householders?.[0]?.count || 0,
        top_visitors: topVisitorsList
      };
    })
  );
  
  return establishmentsWithDetails;
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
  const transformedVisits = visits?.map(visit => {
    console.log('Processing visit:', visit); // Debug log
    console.log('Visit publisher data:', visit.publisher); // Debug publisher data
    console.log('Visit partner data:', visit.partner); // Debug partner data
    return {
      id: visit.id,
      note: visit.note,
      visit_date: visit.visit_date,
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

