"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type EventType = 'ministry' | 'meeting' | 'memorial' | 'circuit_overseer' | 'other';
export type MinistryType = 'house_to_house' | 'business_witnessing' | 'memorial_campaign' | 'telephone' | 'letter_writing' | 'public_witnessing' | 'other';
export type RecurrencePattern = 'none' | 'weekly' | 'monthly' | 'yearly' | 'custom';
export type EventStatus = 'active' | 'cancelled' | 'completed' | 'postponed';

export interface EventSchedule {
  id?: string;
  congregation_id: string;
  event_type: EventType;
  ministry_type?: MinistryType | null;
  title: string;
  description?: string | null;
  start_date: string; // YYYY-MM-DD
  end_date?: string | null; // YYYY-MM-DD
  start_time?: string | null; // HH:MM:SS
  end_time?: string | null; // HH:MM:SS
  is_all_day: boolean;
  recurrence_pattern: RecurrencePattern;
  recurrence_end_date?: string | null; // YYYY-MM-DD
  day_of_week?: number | null; // 0-6, Sunday-Saturday
  day_of_month?: number | null; // 1-31
  month_of_year?: number | null; // 1-12
  recurrence_interval: number;
  location?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  status: EventStatus;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export async function upsertEventSchedule(event: EventSchedule): Promise<EventSchedule | null> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  
  const payload: any = {
    congregation_id: event.congregation_id,
    event_type: event.event_type,
    ministry_type: event.event_type === 'ministry' ? event.ministry_type : null,
    title: event.title,
    description: event.description ?? null,
    start_date: event.start_date,
    end_date: event.end_date ?? null,
    start_time: event.is_all_day ? null : (event.start_time ?? null),
    end_time: event.is_all_day ? null : (event.end_time ?? null),
    is_all_day: event.is_all_day,
    recurrence_pattern: event.recurrence_pattern,
    recurrence_end_date: event.recurrence_end_date ?? null,
    day_of_week: event.recurrence_pattern === 'weekly' ? event.day_of_week : null,
    day_of_month: event.recurrence_pattern === 'monthly' ? event.day_of_month : null,
    month_of_year: event.recurrence_pattern === 'yearly' ? event.month_of_year : null,
    recurrence_interval: event.recurrence_interval,
    location: event.location ?? null,
    location_lat: event.location_lat ?? null,
    location_lng: event.location_lng ?? null,
    status: event.status,
    updated_by: (await supabase.auth.getUser()).data.user?.id ?? null,
  };
  
  if (event.id) {
    // Update existing event
    const { data, error } = await supabase
      .from('event_schedules')
      .update(payload)
      .eq('id', event.id)
      .select()
      .single();
    if (error) {
      console.error('Error updating event schedule:', error);
      return null;
    }
    return data as EventSchedule;
  } else {
    // Insert new event
    payload.created_by = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { data, error } = await supabase
      .from('event_schedules')
      .insert(payload)
      .select()
      .single();
    if (error) {
      console.error('Error inserting event schedule:', error);
      return null;
    }
    return data as EventSchedule;
  }
}

export async function listEventSchedules(congregationId: string): Promise<EventSchedule[]> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession().catch(() => {});
  
  const { data, error } = await supabase
    .from('event_schedules')
    .select('*')
    .eq('congregation_id', congregationId)
    .is('deleted_at', null)
    .order('start_date', { ascending: true });
  
  if (error) {
    console.error('Error listing event schedules:', error);
    return [];
  }
  
  return (data as EventSchedule[]) ?? [];
}
