"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cacheDelete, cacheGet, cacheSet } from "@/lib/offline/store";
import {
  getBestContactStatus,
  getBestStatus,
  normalizeContactStatusesForForm,
  resolveContactStatuses,
} from "@/lib/utils/status-hierarchy";
import { getEstablishmentVisitsWithUsers, getContactVisitsWithUsers } from "@/lib/db/visit-history";
import {
  CONTACT_FK_COLUMN,
  CONTACTS_TABLE,
  contactFkWritePayload,
  DELETE_CONTACT_RPC,
  DELETE_CONTACT_RPC_LEGACY,
  mapContactFkRow,
} from "@/lib/db/contact-supabase";
import { notifyEstablishmentRackStatusChange } from "@/lib/push/notify-establishment-rack-status";

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
  /** Statuses explicitly excluded from results. */
  excludedStatuses?: string[];
  areas: string[];
  floors: string[];
  myEstablishments: boolean;
  /** Map/list: only establishments (and contacts) with the user's open to-dos. */
  myTodosOnly?: boolean;
  nearMe: boolean;
  userLocation?: [number, number] | null;
  sort?: 'name_asc' | 'name_desc' | 'last_visit_desc' | 'last_visit_asc' | 'area_asc' | 'area_desc' | 'date_added_asc' | 'date_added_desc';
}

export type MyOpenTodoTargets = {
  establishmentIds: Set<string>;
  contactIds: Set<string>;
  /** Establishments with at least one unassigned open congregation to-do (home "Open" pool). */
  openPoolEstablishmentIds: Set<string>;
};

function isUnassignedCallTodo(
  todo: Pick<CallTodo, "publisher_id" | "partner_id" | "publisher_guest_name" | "partner_guest_name">
): boolean {
  return (
    !todo.publisher_id &&
    !todo.partner_id &&
    !(todo.publisher_guest_name?.trim()) &&
    !(todo.partner_guest_name?.trim())
  );
}

export type EstablishmentStatus = 
  | 'for_scouting'
  | 'for_follow_up'
  | 'for_replenishment'
  | 'accepted_rack'
  | 'declined_rack'
  | 'has_bible_studies'
  | 'closed'
  | 'on_hold';
export type ContactStatus =
  | 'potential'
  | 'interested'
  | 'return_visit'
  | 'bible_study'
  | 'do_not_call'
  | 'moved_branch'
  | 'resigned';

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

export interface Contact {
  id?: string;
  establishment_id?: string | null;
  publisher_id?: string | null;
  name: string;
  statuses: ContactStatus[];
  note?: string | null;
  lat?: number | null;
  lng?: number | null;
}

const CONTACT_LIST_SELECT = `
        id,
        name,
        statuses,
        note,
        establishment_id,
        publisher_id,
        lat,
        lng,
        created_at,
        establishment:business_establishments(name, statuses)
      `;

const CONTACT_DETAIL_SELECT =
  "id,name,statuses,note,establishment_id,publisher_id,lat,lng,created_at, establishment:business_establishments(id,name,area,statuses)";

const CALL_TODO_SELECT_BASE = `id, call_id, congregation_id, establishment_id, contact_id:${CONTACT_FK_COLUMN}, body, is_done, publisher_id, partner_id, deadline_date, created_at`;
const CALL_TODO_SELECT_WITH_GUESTS = `id, call_id, congregation_id, establishment_id, contact_id:${CONTACT_FK_COLUMN}, body, is_done, publisher_id, partner_id, publisher_guest_name, partner_guest_name, deadline_date, created_at`;

function mapCallTodoRows<T extends { householder_id?: string | null; contact_id?: string | null }>(
  rows: T[] | null | undefined
): CallTodo[] {
  return (rows ?? []).map((row) => mapContactFkRow(row) as unknown as CallTodo);
}

export interface VisitUpdate {
  id?: string;
  congregation_id?: string;
  establishment_id?: string | null;
  contact_id?: string | null;
  note?: string | null;
  publisher_id?: string | null;
  partner_id?: string | null;
  visit_date?: string; // YYYY-MM-DD
}

/** To-do item associated with a call (establishment or contact call). */
export interface CallTodo {
  id: string;
  call_id?: string | null;
  body: string;
  is_done: boolean;
  congregation_id?: string | null;
  establishment_id?: string | null;
  contact_id?: string | null;
  publisher_id?: string | null;
  partner_id?: string | null;
  publisher_guest_name?: string | null;
  partner_guest_name?: string | null;
  deadline_date?: string | null;
  created_at?: string;
}

/** Open call to-do with minimal call context for home summary and navigation. */
export interface MyOpenCallTodoItem extends CallTodo {
  visit_date?: string | null;
  /** Prefer for display when set; else use visit_date from call */
  deadline_date?: string | null;
  establishment_id?: string | null;
  contact_id?: string | null;
  /** Display name for badge: establishment name or contact name */
  context_name?: string | null;
  /** Establishment name when call is for a contact (for second badge) */
  context_establishment_name?: string | null;
  /** Status for badge color: establishment best status or contact status */
  context_status?: string | null;
  /** Establishment status for its own badge color */
  context_establishment_status?: string | null;
  /** Call created_at for ordering and age-based styling */
  call_created_at?: string | null;
   /** Establishment area for area filters */
  context_area?: string | null;
  /** True when the linked establishment has no lat/lng yet (enriched server-side). */
  context_establishment_missing_location?: boolean;
}

export function establishmentHasMapLocation(
  lat?: number | null,
  lng?: number | null
): boolean {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng);
}

/** Establishment to-do (not contact) whose parent establishment has no map coordinates. */
export function isEstablishmentTodoMissingLocation(todo: MyOpenCallTodoItem): boolean {
  return !todo.contact_id && !!todo.establishment_id && todo.context_establishment_missing_location === true;
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
  contact_count?: number;
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
  contact_id?: string | null;
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
  contact?: {
    id: string;
    name: string;
    statuses: ContactStatus[];
  } | null;
  establishment?: {
    id: string;
    name: string;
    status?: string;
  } | null;
}

export interface ContactWithDetails {
  id: string;
  name: string;
  statuses: ContactStatus[];
  note?: string | null;
  establishment_id?: string | null;
  establishment_name?: string | null;
  publisher_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  created_at?: string;
  last_visit_at?: string | null;
  /** Total `calls` rows for this contact. Do not infer from summing `top_visitors` (that double-counts publisher+partner). */
  visit_count?: number;
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
      .select(
        'id, congregation_id, name, description, area, lat, lng, floor, statuses, note, created_at, updated_at, publisher_id, is_deleted, is_archived'
      )
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

export async function getPersonalContacts(userId: string): Promise<Array<{ id: string; name: string }>> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  const cacheKey = `contacts:personal:${userId}`;
  try {
    // If offline, serve from cache
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const cached = await cacheGet<Array<{ id: string; name: string }>>(cacheKey);
      return cached ?? [];
    }
    
    const { data, error } = await supabase
      .from(CONTACTS_TABLE)
      .select('id, name')
      .eq('publisher_id', userId)
      .eq('is_deleted', false)
      .eq('is_archived', false)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching personal contact contacts:', error);
      const cached = await cacheGet<Array<{ id: string; name: string }>>(cacheKey);
      return cached ?? [];
    }
    
    const contacts = (data ?? []).map((hh: any) => ({
      id: hh.id,
      name: hh.name
    }));

    await cacheSet(cacheKey, contacts);
    return contacts;
  } catch (error) {
    console.error('Error getting personal contact contacts:', error);
    const cached = await cacheGet<Array<{ id: string; name: string }>>(cacheKey);
    return cached ?? [];
  }
}

export async function listContacts(): Promise<ContactWithDetails[]> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  const cacheKey = 'contacts:list:v3';
  try {
    // Return cached data immediately if available (for fast initial load)
    let cached = await cacheGet<ContactWithDetails[]>(cacheKey);
    if (!cached?.length) {
      cached = await cacheGet<ContactWithDetails[]>("householders:list:v3");
    }
    if (cached?.length && typeof navigator !== 'undefined' && !navigator.onLine) {
      // If offline, return cached data
      return cached;
    }
    
    // Fetch fresh data
    const listQuery = (select: string) =>
      supabase
        .from(CONTACTS_TABLE)
        .select(select)
        .eq("is_deleted", false)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false });

    const { data, error } = await listQuery(CONTACT_LIST_SELECT);

    if (error) {
      console.error("Error fetching contacts:", error);
      return [];
    }
    if (!data) return [];

    const contactIds = (data ?? []).map((hh: any) => hh.id).filter(Boolean);
    type ContactVisitRow = {
      contact_id?: string | null;
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
    const { data: visits, error: visitsError } = contactIds.length
      ? await supabase
          .from('calls')
          .select(
            `
              contact_id:${CONTACT_FK_COLUMN},
              visit_date,
              publisher:profiles!calls_publisher_id_fkey(id, first_name, last_name, avatar_url),
              partner:profiles!calls_partner_id_fkey(id, first_name, last_name, avatar_url)
            `
          )
          .in(CONTACT_FK_COLUMN, contactIds)
      : { data: [] as ContactVisitRow[], error: null };
    if (visitsError) {
      console.error('Error fetching contact visits for list:', visitsError);
    }

    const visitsByContact = new Map<string, ContactVisitRow[]>();
    (visits ?? []).forEach((visit) => {
      const contactId = visit.contact_id ?? visit.contact_id;
      if (!contactId) return;
      const bucket = visitsByContact.get(contactId) || [];
      bucket.push(visit);
      visitsByContact.set(contactId, bucket);
    });

    // Transform the data to match ContactWithDetails interface
    const contacts: ContactWithDetails[] = (data ?? []).map((hh: any) => {
      // Get establishment name
      const establishment = Array.isArray(hh.establishment) ? hh.establishment[0] : hh.establishment;
      
      // Get unique visitors with visit counts
      const visitors = new Map();
      const hhVisits = visitsByContact.get(hh.id) || [];
      hhVisits.forEach((visit: ContactVisitRow) => {
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
        statuses: resolveContactStatuses(hh) as ContactStatus[],
        note: hh.note,
        establishment_id: hh.establishment_id,
        establishment_name: establishment?.name,
        publisher_id: hh.publisher_id ?? null,
        lat: hh.lat ?? null,
        lng: hh.lng ?? null,
        created_at: hh.created_at,
        last_visit_at,
        visit_count: hhVisits.length,
        top_visitors: Array.from(visitors.values()).sort((a, b) => b.visit_count - a.visit_count)
      };
    });

    await cacheSet(cacheKey, contacts);
    return contacts;
  } catch (error) {
    console.error('Error listing contacts:', error);
    const cached = await cacheGet<ContactWithDetails[]>(cacheKey);
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
      const { data: existingRow } = await supabase
        .from('business_establishments')
        .select('statuses')
        .eq('id', establishmentData.id)
        .single();
      const previousStatuses = (existingRow?.statuses as string[] | undefined) ?? [];

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

      notifyEstablishmentRackStatusChange({
        establishmentId: establishmentData.id,
        previousStatuses,
        nextStatuses: establishmentData.statuses,
      });
      
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

      if (data?.id) {
        notifyEstablishmentRackStatusChange({
          establishmentId: data.id,
          previousStatuses: [],
          nextStatuses: establishmentData.statuses,
        });
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

/** Readable message for PostgREST errors (console/overlay often show `{}` for the raw object). */
function formatContactWriteError(
  error: { message?: string; code?: string; details?: string; hint?: string } | null
): string {
  if (!error) return "Could not save contact.";
  const msg = (error.message || "").trim();
  const details = (error.details || "").trim();
  const hint = (error.hint || "").trim();
  const code = (error.code || "").trim();
  const combined = [msg, details, hint].filter(Boolean).join(" — ");
  if (combined) {
    if (/householder_status|invalid input value for enum/i.test(combined)) {
      return `${combined} Apply contact status migrations (e.g. supabase/migrations/20260331130000_add_householder_moved_resigned_status.sql, 20260530130000_add_householder_statuses_array.sql) to your Supabase project.`;
    }
    if (/column.*statuses|statuses.*does not exist/i.test(combined)) {
      return `${combined} Apply supabase/migrations/20260530130000_add_householder_statuses_array.sql to your Supabase project.`;
    }
    return combined;
  }
  if (code) return `Database error (${code}). Try again or check Supabase logs.`;
  return "Could not save contact.";
}

export async function upsertContact(h: Contact): Promise<Contact | null> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  
  // Ensure lat/lng are proper numbers or null (database expects numeric(9,6) and numeric(11,8))
  const latValue = typeof h.lat === 'number' && !isNaN(h.lat) ? Number(h.lat.toFixed(6)) : null;
  const lngValue = typeof h.lng === 'number' && !isNaN(h.lng) ? Number(h.lng.toFixed(8)) : null;
  
  const statusesPayload = normalizeContactStatusesForForm(
    (h.statuses?.length ? h.statuses : ["potential"]) as string[]
  ) as ContactStatus[];

  const payload = {
    name: h.name,
    statuses: statusesPayload,
    note: h.note ?? null,
    establishment_id: h.establishment_id ?? null,
    publisher_id: h.publisher_id ?? null,
    lat: latValue,
    lng: lngValue,
  };

  const runWrite = async () => {
    if (h.id) {
      return supabase.from(CONTACTS_TABLE).update(payload).eq("id", h.id).select().single();
    }
    return supabase.from(CONTACTS_TABLE).insert(payload).select().single();
  };

  const { data, error } = await runWrite();

  if (error) {
    const text = formatContactWriteError(error);
    console.error(h.id ? "Error updating contact:" : "Error inserting contact:", text, {
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(text);
  }
  return data as any;
}

export async function deleteContact(contactId: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  
  // Get user's profile
  const { data: profile } = await supabase.rpc('get_my_profile');
  if (!profile?.id) {
    throw new Error('User not authenticated');
  }
  
  // Use RPC function to bypass RLS for deletion
  let { error } = await supabase.rpc(DELETE_CONTACT_RPC, {
    contact_id: contactId,
    deleted_by_user: profile.id,
  });
  if (error) {
    ({ error } = await supabase.rpc(DELETE_CONTACT_RPC_LEGACY, {
      householder_id: contactId,
      deleted_by_user: profile.id,
    }));
  }
    
  if (error) {
    console.error('Error deleting contact:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
    return false;
  }
  return true;
}

export async function archiveContact(contactId: string): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  
  // Get user's profile
  const { data: profile } = await supabase.rpc('get_my_profile');
  if (!profile?.id) {
    throw new Error('User not authenticated');
  }
  
  const { error } = await supabase
    .from(CONTACTS_TABLE)
    .update({
      is_archived: true,
      archived_at: new Date().toISOString(),
      archived_by: profile.id
    })
    .eq('id', contactId);
    
  if (error) {
    console.error('Error archiving contact:', error);
    return false;
  }
  return true;
}

export async function addVisit(visit: {
  establishment_id?: string;
  contact_id?: string;
  note?: string | null;
  publisher_id?: string;
  partner_id?: string;
  publisher_guest_name?: string | null;
  partner_guest_name?: string | null;
  visit_date?: string;
}): Promise<{
  id: string;
  establishment_id?: string | null;
  contact_id?: string | null;
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
        ...contactFkWritePayload(visit.contact_id),
        note: visit.note,
        publisher_id: visit.publisher_id || null,
        partner_id: visit.partner_id || null,
        publisher_guest_name: visit.publisher_guest_name ?? null,
        partner_guest_name: visit.partner_guest_name ?? null,
        visit_date: visit.visit_date || new Date().toISOString().split('T')[0]
      })
      .select(`id, establishment_id, contact_id:${CONTACT_FK_COLUMN}, note, publisher_id, partner_id, publisher_guest_name, partner_guest_name, visit_date`)
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
  contact_id?: string | null;
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
        ...contactFkWritePayload(visit.contact_id),
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

// --- Call to-dos (for establishment and contact calls) ---

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
    return mapCallTodoRows((data ?? []) as Array<{ householder_id?: string | null; contact_id?: string | null }>);
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

function isGuestColumnMissingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const details = JSON.stringify(error).toLowerCase();
  return (
    details.includes("publisher_guest_name") ||
    details.includes("partner_guest_name") ||
    details.includes("column") && details.includes("does not exist")
  );
}

export async function addStandaloneTodo(params: {
  establishment_id?: string | null;
  contact_id?: string | null;
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

    const payload: Record<string, unknown> = {
      call_id: null,
      congregation_id: profile.congregation_id,
      establishment_id: params.establishment_id ?? null,
      ...contactFkWritePayload(params.contact_id),
      body: params.body.trim(),
      is_done: false,
      publisher_id: params.publisher_id ?? null,
      partner_id: params.partner_id ?? null,
      deadline_date: params.deadline_date?.trim() || null,
    };
    const hasGuestNames = !!(params.publisher_guest_name?.trim() || params.partner_guest_name?.trim());
    if (hasGuestNames) {
      payload.publisher_guest_name = params.publisher_guest_name?.trim() || null;
      payload.partner_guest_name = params.partner_guest_name?.trim() || null;
    }
    const { data, error } = await supabase
      .from("call_todos")
      .insert(payload)
      .select(hasGuestNames ? CALL_TODO_SELECT_WITH_GUESTS : CALL_TODO_SELECT_BASE)
      .single();
    if (error) {
      if (hasGuestNames && isGuestColumnMissingError(error)) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.publisher_guest_name;
        delete fallbackPayload.partner_guest_name;
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("call_todos")
          .insert(fallbackPayload)
          .select(CALL_TODO_SELECT_BASE)
          .single();
        if (!fallbackError) {
          return (fallbackData as unknown as CallTodo) ?? null;
        }
      }
      console.error("Error adding standalone todo:", error);
      return null;
    }
    return (data as unknown as CallTodo) ?? null;
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
    publisher_guest_name?: string | null;
    partner_guest_name?: string | null;
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
      publisher_guest_name?: string | null;
      partner_guest_name?: string | null;
    } = {};
    if (updates.body !== undefined) payload.body = updates.body.trim();
    if (updates.deadline_date !== undefined) payload.deadline_date = updates.deadline_date;
    if (updates.publisher_id !== undefined) payload.publisher_id = updates.publisher_id;
    if (updates.partner_id !== undefined) payload.partner_id = updates.partner_id;
    if (updates.publisher_guest_name !== undefined) payload.publisher_guest_name = updates.publisher_guest_name;
    if (updates.partner_guest_name !== undefined) payload.partner_guest_name = updates.partner_guest_name;
    if (Object.keys(payload).length === 0) return true;
    const { error } = await supabase.from("call_todos").update(payload).eq("id", id);
    if (error) {
      if (isGuestColumnMissingError(error)) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.publisher_guest_name;
        delete fallbackPayload.partner_guest_name;
        const { error: fallbackError } = await supabase.from("call_todos").update(fallbackPayload).eq("id", id);
        if (!fallbackError) return true;
      }
      console.error("updateStandaloneTodo:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("updateStandaloneTodo:", e);
    return false;
  }
}

/** Update a to-do row with full editable fields (used by bulk edit flow). */
export async function updateTodoForBulkEdit(
  id: string,
  updates: {
    establishment_id?: string | null;
    contact_id?: string | null;
    body?: string;
    deadline_date?: string | null;
    publisher_id?: string | null;
    partner_id?: string | null;
    publisher_guest_name?: string | null;
    partner_guest_name?: string | null;
  }
): Promise<boolean> {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession().catch(() => {});
    const payload: Record<string, unknown> = {};
    if (updates.establishment_id !== undefined) payload.establishment_id = updates.establishment_id;
    if (updates.contact_id !== undefined) {
      Object.assign(payload, contactFkWritePayload(updates.contact_id));
    }
    if (updates.body !== undefined) payload.body = updates.body.trim();
    if (updates.deadline_date !== undefined) payload.deadline_date = updates.deadline_date;
    if (updates.publisher_id !== undefined) payload.publisher_id = updates.publisher_id;
    if (updates.partner_id !== undefined) payload.partner_id = updates.partner_id;
    if (updates.publisher_guest_name !== undefined) payload.publisher_guest_name = updates.publisher_guest_name;
    if (updates.partner_guest_name !== undefined) payload.partner_guest_name = updates.partner_guest_name;
    if (Object.keys(payload).length === 0) return true;
    const { error } = await supabase.from("call_todos").update(payload).eq("id", id);
    if (error) {
      if (isGuestColumnMissingError(error)) {
        const fallbackPayload = { ...payload };
        delete fallbackPayload.publisher_guest_name;
        delete fallbackPayload.partner_guest_name;
        const { error: fallbackError } = await supabase.from("call_todos").update(fallbackPayload).eq("id", id);
        if (!fallbackError) return true;
      }
      console.error("updateTodoForBulkEdit:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("updateTodoForBulkEdit:", e);
    return false;
  }
}

function buildCallMetaById(calls: any[]): Map<string, { visit_date: string | null; establishment_id: string | null; contact_id: string | null; context_name: string | null; context_establishment_name: string | null; context_status: string | null; context_establishment_status: string | null; call_created_at: string | null; context_area: string | null }> {
  return new Map(
    calls.map((c) => {
      const establishment = Array.isArray((c as any).establishment)
        ? (c as any).establishment[0]
        : (c as any).establishment;
      const contact = Array.isArray((c as any).contact)
        ? (c as any).contact[0]
        : (c as any).contact;
      const callContactId = c.contact_id ?? c.contact_id;
      const context_name = (callContactId && contact?.name
        ? contact.name
        : establishment?.name ?? null) as string | null;
      const context_establishment_name = (establishment?.name ?? null) as string | null;
      const establishment_status = establishment?.statuses
        ? getBestStatus(establishment.statuses as string[])
        : null;
      const context_status = callContactId && contact?.statuses?.length
        ? getBestContactStatus(resolveContactStatuses(contact))
        : establishment_status;
      return [
        c.id,
        {
          visit_date: c.visit_date ?? null,
          establishment_id: c.establishment_id ?? null,
          contact_id: callContactId ?? null,
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

  let callMetaById = new Map<string, { visit_date: string | null; establishment_id: string | null; contact_id: string | null; context_name: string | null; context_establishment_name: string | null; context_status: string | null; context_establishment_status: string | null; call_created_at: string | null; context_area: string | null }>();
  if (callIds.length > 0) {
    const { data: calls } = await supabase
      .from("calls")
      .select(
        `id, created_at, visit_date, establishment_id, contact_id:${CONTACT_FK_COLUMN}, establishment:business_establishments!calls_establishment_id_fkey(name, statuses, area), contact:householders!calls_householder_id_fkey(name, statuses)`
      )
      .in("id", callIds);
    if (calls?.length) {
      callMetaById = buildCallMetaById(calls);
    }
  }

  const establishmentIds = new Set<string>();
  const contactIds = new Set<string>();
  for (const t of todos) {
    const callMeta = t.call_id ? callMetaById.get(t.call_id) : undefined;
    const effectiveEstablishmentId = t.establishment_id ?? callMeta?.establishment_id ?? null;
    const effectiveContactId = t.contact_id ?? callMeta?.contact_id ?? null;
    if (effectiveEstablishmentId) establishmentIds.add(effectiveEstablishmentId);
    if (effectiveContactId) contactIds.add(effectiveContactId);
  }

  const [establishmentRows, contactRows] = await Promise.all([
    establishmentIds.size
      ? supabase
          .from("business_establishments")
          .select("id, name, statuses, area, lat, lng")
          .in("id", Array.from(establishmentIds))
      : Promise.resolve({ data: [], error: null } as any),
    contactIds.size
      ? supabase
          .from(CONTACTS_TABLE)
          .select("id, name, statuses, establishment_id")
          .in("id", Array.from(contactIds))
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  const establishmentById = new Map<
    string,
    { id: string; name: string; statuses?: string[] | null; area?: string | null; lat?: number | null; lng?: number | null }
  >();
  for (const e of establishmentRows.data ?? []) {
    establishmentById.set(e.id, e);
  }
  const contactById = new Map<string, { id: string; name: string; statuses?: ContactStatus[] | null; establishment_id?: string | null }>();
  for (const h of contactRows.data ?? []) {
    contactById.set(h.id, h);
  }

  // Contact to-dos may only reference householder_id; load parent establishment for name/status/area.
  const parentEstablishmentIds = Array.from(
    new Set(
      (contactRows.data ?? [])
        .map((h: { establishment_id?: string | null }) => h.establishment_id)
        .filter((id: string | null | undefined): id is string => !!id && !establishmentById.has(id))
    )
  );
  if (parentEstablishmentIds.length > 0) {
    const { data: parentRows } = await supabase
      .from("business_establishments")
      .select("id, name, statuses, area, lat, lng")
      .in("id", parentEstablishmentIds);
    for (const e of parentRows ?? []) {
      establishmentById.set(e.id, e);
    }
  }

  const items = todos.map((t) => {
    const callMeta = t.call_id ? callMetaById.get(t.call_id) : undefined;
    const effectiveEstablishmentId = t.establishment_id ?? callMeta?.establishment_id ?? null;
    const effectiveContactId = t.contact_id ?? callMeta?.contact_id ?? null;
    const establishment = effectiveEstablishmentId ? establishmentById.get(effectiveEstablishmentId) : undefined;
    const contact = effectiveContactId ? contactById.get(effectiveContactId) : undefined;
    const contactEstablishment = contact?.establishment_id
      ? establishmentById.get(contact.establishment_id)
      : undefined;
    const establishmentStatus = establishment?.statuses
      ? getBestStatus(establishment.statuses)
      : null;

    const context_name = contact?.name ?? establishment?.name ?? callMeta?.context_name ?? null;
    const context_status = contact?.statuses?.length
      ? getBestContactStatus(resolveContactStatuses(contact))
      : establishmentStatus ?? callMeta?.context_status ?? null;
    const context_establishment_name = contact
      ? contactEstablishment?.name ?? establishment?.name ?? callMeta?.context_establishment_name ?? null
      : establishment?.name ?? callMeta?.context_establishment_name ?? null;
    const context_establishment_status = contact
      ? (contactEstablishment?.statuses ? getBestStatus(contactEstablishment.statuses) : establishmentStatus ?? callMeta?.context_establishment_status ?? null)
      : establishmentStatus ?? callMeta?.context_establishment_status ?? null;
    const context_area =
      contactEstablishment?.area ?? establishment?.area ?? callMeta?.context_area ?? null;
    const establishmentForLocation = contact ? contactEstablishment ?? establishment : establishment;
    const context_establishment_missing_location = establishmentForLocation
      ? !establishmentHasMapLocation(establishmentForLocation.lat, establishmentForLocation.lng)
      : undefined;

    return {
      ...(t as CallTodo),
      visit_date: callMeta?.visit_date ?? null,
      establishment_id: effectiveEstablishmentId,
      contact_id: effectiveContactId,
      context_name,
      context_establishment_name,
      context_status,
      context_establishment_status,
      call_created_at: callMeta?.call_created_at ?? t.created_at ?? null,
      context_area,
      context_establishment_missing_location,
    } as MyOpenCallTodoItem;
  });

  items.sort((a, b) => {
    const aAt = a.call_created_at ?? "";
    const bAt = b.call_created_at ?? "";
    return aAt.localeCompare(bAt);
  });

  return items;
}

/** Raw open to-dos where the user is publisher or partner (or linked via their calls). */
async function fetchMyOpenTodoRows(userId: string, limit = 500): Promise<CallTodo[]> {
  const supabase = createSupabaseBrowserClient();
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
        .select(CALL_TODO_SELECT_WITH_GUESTS)
        .eq("is_done", false)
        .in("call_id", callIds)
        .limit(limit)
    : Promise.resolve({ data: [], error: null } as { data: CallTodo[]; error: null });
  const standalonePromise = supabase
    .from("call_todos")
    .select(CALL_TODO_SELECT_WITH_GUESTS)
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
  for (const t of mapCallTodoRows((linked ?? []) as Array<{ householder_id?: string | null; contact_id?: string | null }>)) byId.set(t.id, t);
  for (const t of mapCallTodoRows((standalone ?? []) as Array<{ householder_id?: string | null; contact_id?: string | null }>)) byId.set(t.id, t);
  return Array.from(byId.values()).slice(0, limit);
}

/** Establishment and contact ids for home/map "My To-Dos" (assigned to user + congregation open pool). */
export async function getMyOpenTodoTargets(userId: string): Promise<MyOpenTodoTargets> {
  const empty: MyOpenTodoTargets = {
    establishmentIds: new Set(),
    contactIds: new Set(),
    openPoolEstablishmentIds: new Set(),
  };
  try {
    const [mineRows, congregationRows] = await Promise.all([
      fetchMyOpenTodoRows(userId, 500),
      getCongregationOpenCallTodos(500),
    ]);
    const byId = new Map<string, CallTodo>();
    for (const t of mineRows) byId.set(t.id, t);
    for (const t of congregationRows) {
      if (!byId.has(t.id)) byId.set(t.id, t);
    }
    const merged = Array.from(byId.values());
    if (merged.length === 0) return empty;

    const items = await enrichTodoItems(merged);
    const establishmentIds = new Set<string>();
    const contactIds = new Set<string>();
    const openPoolEstablishmentIds = new Set<string>();

    for (const t of items) {
      const unassigned = isUnassignedCallTodo(t);
      const isMine = t.publisher_id === userId || t.partner_id === userId;
      if (!unassigned && !isMine) continue;

      if (t.establishment_id) {
        establishmentIds.add(t.establishment_id);
        if (unassigned) openPoolEstablishmentIds.add(t.establishment_id);
      }
      if (t.contact_id) {
        contactIds.add(t.contact_id);
      }
    }

    return { establishmentIds, contactIds, openPoolEstablishmentIds };
  } catch (e) {
    console.error("getMyOpenTodoTargets:", e);
    return empty;
  }
}

/** Open (incomplete) to-dos for todos where the user is publisher or partner. */
export async function getMyOpenCallTodos(userId: string, limit = 15): Promise<MyOpenCallTodoItem[]> {
  try {
    const merged = await fetchMyOpenTodoRows(userId, limit);
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
          .select(CALL_TODO_SELECT_WITH_GUESTS)
          .eq("is_done", true)
          .in("call_id", callIds)
          .limit(limit)
      : Promise.resolve({ data: [], error: null } as any);
    const standalonePromise = supabase
      .from("call_todos")
      .select(CALL_TODO_SELECT_WITH_GUESTS)
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
    for (const t of mapCallTodoRows((linked ?? []) as Array<{ householder_id?: string | null; contact_id?: string | null }>)) byId.set(t.id, t);
    for (const t of mapCallTodoRows((standalone ?? []) as Array<{ householder_id?: string | null; contact_id?: string | null }>)) byId.set(t.id, t);
    const merged = Array.from(byId.values()).slice(0, limit);
    if (merged.length === 0) return [];
    return await enrichTodoItems(merged);
  } catch (e) {
    console.error('getMyCompletedCallTodos:', e);
    return [];
  }
}

async function getCongregationCallTodos(isDone: boolean, limit = 50): Promise<MyOpenCallTodoItem[]> {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession().catch(() => {});
    const { data: profile } = await supabase.rpc("get_my_profile");
    if (!profile?.congregation_id) return [];

    const { data, error } = await supabase
      .from("call_todos")
      .select(CALL_TODO_SELECT_WITH_GUESTS)
      .eq("congregation_id", profile.congregation_id)
      .eq("is_done", isDone)
      .limit(limit);
    if (error) return [];

    const merged = mapCallTodoRows((data ?? []) as Array<{ householder_id?: string | null; contact_id?: string | null }>).slice(0, limit);
    if (merged.length === 0) return [];
    return await enrichTodoItems(merged);
  } catch (e) {
    console.error("getCongregationCallTodos:", e);
    return [];
  }
}

/** Open (incomplete) to-dos across the whole congregation. */
export async function getCongregationOpenCallTodos(limit = 50): Promise<MyOpenCallTodoItem[]> {
  return getCongregationCallTodos(false, limit);
}

/** Completed (done) to-dos across the whole congregation. */
export async function getCongregationCompletedCallTodos(limit = 50): Promise<MyOpenCallTodoItem[]> {
  return getCongregationCallTodos(true, limit);
}

async function getScopedCallTodos(options: {
  establishmentId?: string;
  contactId?: string;
  isDone: boolean;
  limit?: number;
}): Promise<MyOpenCallTodoItem[]> {
  const { establishmentId, contactId, isDone, limit = 50 } = options;
  if (!establishmentId && !contactId) return [];

  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession().catch(() => {});
    let callsQuery = supabase.from("calls").select("id").limit(300);
    if (establishmentId) callsQuery = callsQuery.eq("establishment_id", establishmentId);
    if (contactId) callsQuery = callsQuery.eq(CONTACT_FK_COLUMN, contactId);
    const { data: calls, error: callsError } = await callsQuery;
    if (callsError) return [];
    const callIds = (calls ?? []).map((c) => c.id);

    const linkedPromise = callIds.length
      ? supabase
          .from("call_todos")
          .select(CALL_TODO_SELECT_WITH_GUESTS)
          .eq("is_done", isDone)
          .in("call_id", callIds)
          .limit(limit)
      : Promise.resolve({ data: [], error: null } as any);

    let standaloneQuery = supabase
      .from("call_todos")
      .select(CALL_TODO_SELECT_WITH_GUESTS)
      .eq("is_done", isDone)
      .is("call_id", null)
      .limit(limit);
    if (establishmentId) standaloneQuery = standaloneQuery.eq("establishment_id", establishmentId);
    if (contactId) standaloneQuery = standaloneQuery.eq(CONTACT_FK_COLUMN, contactId);

    const [{ data: linked, error: linkedError }, { data: standalone, error: standaloneError }] = await Promise.all([
      linkedPromise,
      standaloneQuery,
    ]);
    if (linkedError || standaloneError) return [];

    const byId = new Map<string, CallTodo>();
    for (const t of mapCallTodoRows((linked ?? []) as Array<{ householder_id?: string | null; contact_id?: string | null }>)) byId.set(t.id, t);
    for (const t of mapCallTodoRows((standalone ?? []) as Array<{ householder_id?: string | null; contact_id?: string | null }>)) byId.set(t.id, t);
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

export function getContactOpenCallTodos(contactId: string, limit = 50): Promise<MyOpenCallTodoItem[]> {
  return getScopedCallTodos({ contactId, isDone: false, limit });
}

export function getContactCompletedCallTodos(contactId: string, limit = 50): Promise<MyOpenCallTodoItem[]> {
  return getScopedCallTodos({ contactId, isDone: true, limit });
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

    const [visitsResult, contactsResult] = await Promise.all([
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
            .from(CONTACTS_TABLE)
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
    const contactsError = (contactsResult as any)?.error;
    if (contactsError) {
      console.error('Error fetching contacts for list:', contactsError);
    }

    const visits = (visitsResult as any)?.data as VisitRow[] | undefined;
    const contacts = (contactsResult as any)?.data as { id: string; establishment_id?: string | null }[] | undefined;

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

    const contactsByEstablishment = new Map<string, number>();
    (contacts ?? []).forEach((contact) => {
      const establishmentId = contact.establishment_id;
      if (!establishmentId) return;
      contactsByEstablishment.set(establishmentId, (contactsByEstablishment.get(establishmentId) || 0) + 1);
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
        contact_count: contactsByEstablishment.get(establishment.id) || 0,
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
  contacts: ContactWithDetails[];
} | null> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  const cacheKey = `establishment:details:${establishmentId}`;
  
  try {
    // Offline-first: serve last details from IndexedDB when we cannot reach the network reliably.
    // When online, always fetch fresh visits — cache-only returns were leaving Calls sections stale until another interaction.
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    if (offline) {
      const cached = await cacheGet<{
        establishment: EstablishmentWithDetails;
        visits: VisitWithUser[];
        contacts: ContactWithDetails[];
      }>(cacheKey);
      if (cached) return cached;
    }

  // Get establishment details — exclude soft-deleted/archived (same filter as list so details detect delete)
  // Use maybeSingle so 0 rows → { data: null, error: null }; .single() uses PGRST116 and some clients log opaque error objects.
  const { data: establishment, error: establishmentError } = await supabase
    .from('business_establishments')
    .select(
      'id, congregation_id, name, description, area, lat, lng, floor, statuses, note, created_at, updated_at, created_by, publisher_id, is_deleted, is_archived'
    )
    .eq('id', establishmentId)
    .eq('is_deleted', false)
    .eq('is_archived', false)
    .maybeSingle();

  if (establishmentError) {
    const cachedAfterErr = await cacheGet<{
      establishment: EstablishmentWithDetails;
      visits: VisitWithUser[];
      contacts: ContactWithDetails[];
    }>(cacheKey);
    if (cachedAfterErr) return cachedAfterErr;
    const pg = establishmentError as {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    };
    // warn: graceful fallback (null); structured fields avoid Turbopack/console showing `{}` for the raw object
    console.warn('getEstablishmentDetails: establishment query failed', {
      establishmentId,
      code: pg.code,
      message: pg.message,
      details: pg.details,
      hint: pg.hint,
    });
    // Return null (do not throw): callers batch detail fetches with Promise.all; throwing would skip refreshing contacts/lists.
    return null;
  }

  if (!establishment) {
    // No row matched filters — soft-deleted, archived, or not visible under RLS
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      await cacheDelete(cacheKey);
    }
    return null;
  }
  
  const transformedVisits = await getEstablishmentVisitsWithUsers(establishmentId);
  
  // Get contacts for this establishment only (no user assignment)
  const { data: contacts } = await supabase
    .from(CONTACTS_TABLE)
    .select(`
      id,
      name,
      statuses,
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
    contacts: contacts || []
  };
  
  // Cache the results
  await cacheSet(cacheKey, result);
  return result;
  } catch (error) {
    console.error('Error fetching establishment details:', error);
    const cached = await cacheGet<{
      establishment: EstablishmentWithDetails;
      visits: VisitWithUser[];
      contacts: ContactWithDetails[];
    }>(cacheKey);
    return cached ?? null;
  }
}

export async function getContactDetails(contactId: string): Promise<{
  contact: ContactWithDetails;
  visits: VisitWithUser[];
  establishment?: { id: string; name: string; area?: string | null; statuses?: string[] | null } | null;
} | null> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  const cacheKey = `contact:details:v5:${contactId}`;
  
  try {
    // Offline-first only; when online, fetch fresh visits for the Calls section (same as establishment details).
    const offline = typeof navigator !== "undefined" && !navigator.onLine;
    if (offline) {
      const cached = await cacheGet<{
        contact: ContactWithDetails;
        visits: VisitWithUser[];
        establishment?: { id: string; name: string; area?: string | null; statuses?: string[] | null } | null;
      }>(cacheKey);
      if (cached) return cached;
    }

  // Contact with establishment and publisher profile
  // Fetch visits first to ensure they're always loaded, even if contact query fails
  const transformedVisits = await getContactVisitsWithUsers(contactId);
  
  // Fetch contact without publisher join (more reliable). Exclude soft-deleted (deleted_at / is_deleted).
  const detailQuery = (select: string) =>
    supabase
      .from(CONTACTS_TABLE)
      .select(select)
      .eq("id", contactId)
      .eq("is_deleted", false)
      .eq("is_archived", false)
      .single();

  type ContactDetailRow = {
    id: string;
    name: string;
    statuses?: ContactStatus[] | null;
    note?: string | null;
    establishment_id?: string | null;
    publisher_id?: string | null;
    lat?: number | null;
    lng?: number | null;
    created_at?: string;
    establishment?: { id: string; name: string; area?: string | null; statuses?: string[] | null } | { id: string; name: string; area?: string | null; statuses?: string[] | null }[] | null;
  };

  const res = await detailQuery(CONTACT_DETAIL_SELECT);
  const hh = res.data as ContactDetailRow | null;
  const hhError = res.error;

  if (hhError || !hh) {
    // Row not found (e.g. soft-deleted by another user) — return null so UI can show list + toast
    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    if (!isOffline) {
      await cacheDelete(cacheKey);
      return null;
    }
    const cached = await cacheGet<{
      contact: ContactWithDetails;
      visits: VisitWithUser[];
      establishment?: { id: string; name: string; area?: string | null; statuses?: string[] | null } | null;
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

  const contact: ContactWithDetails = {
    id: hh.id,
    name: hh.name,
    statuses: resolveContactStatuses(hh) as ContactStatus[],
    note: hh.note,
    establishment_id: hh.establishment_id,
    establishment_name: establishment?.name,
    publisher_id: hh.publisher_id,
    lat: hh.lat,
    lng: hh.lng,
    created_at: hh.created_at,
    last_visit_at,
    visit_count: transformedVisits.length,
    assigned_user: publisher ? {
      id: publisher.id,
      first_name: publisher.first_name,
      last_name: publisher.last_name,
      avatar_url: publisher.avatar_url || undefined
    } : null,
  };

  const result = {
    contact,
    visits: transformedVisits,
    establishment: establishment
      ? {
          id: establishment.id,
          name: establishment.name,
          area: establishment.area ?? null,
          statuses: establishment.statuses ?? null,
        }
      : null,
  };
  
  // Cache the results
  await cacheSet(cacheKey, result);
  return result;
  } catch (error) {
    console.error('Error fetching contact details:', error);
    const cached = await cacheGet<{
      contact: ContactWithDetails;
      visits: VisitWithUser[];
      establishment?: { id: string; name: string; area?: string | null; statuses?: string[] | null } | null;
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

