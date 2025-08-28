"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DailyRecord } from "./types";
import { cacheGet, cacheSet, outboxEnqueue } from "@/lib/offline/store";
import { toast } from "@/components/ui/sonner";

const TABLE = "daily_records";

export async function getDailyRecord(userId: string, date: string): Promise<DailyRecord | null> {
  // Offline-first: serve cached if present, then fall back to network
  const cached = await cacheGet<DailyRecord>(`daily:${userId}:${date}`);
  if (cached) return cached;
  // If offline, avoid network errors
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;
  try {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.getSession();
    const { data } = await supabase
      .from(TABLE)
      .select("id, user_id, date, hours, bible_studies, note")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();
    const rec = (data as DailyRecord) ?? null;
    if (rec) await cacheSet(`daily:${userId}:${date}`, rec);
    return rec;
  } catch {
    return null;
  }
}

export async function upsertDailyRecord(input: Omit<DailyRecord, "id"> & { id?: string }) {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession();
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(input, { onConflict: "user_id,date" })
      .select()
      .single();
    if (error) throw error;
    const rec = data as DailyRecord;
    await cacheSet(`daily:${input.user_id}:${input.date}`, rec);
    const month = input.date.slice(0, 7);
    // Update cached month list if present
    const key = `daily:${input.user_id}:month:${month}`;
    const monthCache = (await cacheGet<DailyRecord[]>(key)) || [];
    const idx = monthCache.findIndex((r) => r.date === input.date);
    if (idx >= 0) monthCache[idx] = rec; else monthCache.push(rec);
    await cacheSet(key, monthCache.sort((a, b) => a.date.localeCompare(b.date)));
    return rec;
  } catch (e) {
    await outboxEnqueue({ type: "upsert_daily", payload: input });
    await cacheSet(`daily:${input.user_id}:${input.date}`, input);
    const month = input.date.slice(0, 7);
    const key = `daily:${input.user_id}:month:${month}`;
    const monthCache = (await cacheGet<DailyRecord[]>(key)) || [];
    const idx = monthCache.findIndex((r) => r.date === input.date);
    if (idx >= 0) monthCache[idx] = input as DailyRecord; else monthCache.push(input as DailyRecord);
    await cacheSet(key, monthCache.sort((a, b) => a.date.localeCompare(b.date)));
    toast.success("Saved offline. Will sync when online.");
    return input as DailyRecord;
  }
}

export async function listDailyByMonth(userId: string, month: string): Promise<DailyRecord[]> {
  // month: YYYY-MM
  const key = `daily:${userId}:month:${month}`;
  const cached = await cacheGet<DailyRecord[]>(key);
  if (cached) return cached;
  if (typeof navigator !== "undefined" && !navigator.onLine) return [];
  try {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.getSession();
    const { data } = await supabase
      .from(TABLE)
      .select("id, user_id, date, hours, bible_studies, note")
      .eq("user_id", userId)
      .gte("date", month + "-01")
      .lt("date", month + "-32")
      .order("date", { ascending: true });
    const list = (data ?? []) as DailyRecord[];
    await cacheSet(key, list);
    return list;
  } catch {
    return [];
  }
}

export function isDailyEmpty(rec: { hours?: number | null; bible_studies?: string[] | null; note?: string | null | undefined }) {
  const h = Number(rec.hours || 0);
  const bs = Array.isArray(rec.bible_studies) ? rec.bible_studies.filter(Boolean) : [];
  const n = (rec.note ?? "").toString().trim();
  return (!h || h === 0) && bs.length === 0 && n.length === 0;
}

export async function deleteDailyRecord(userId: string, date: string) {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession();
    const { error } = await supabase.from(TABLE).delete().eq("user_id", userId).eq("date", date);
    if (error) throw error;
  } catch (e) {
    // queue offline delete
    await outboxEnqueue({ type: "delete_daily", payload: { user_id: userId, date } });
  }
  // Remove from caches
  try {
    const dayKey = `daily:${userId}:${date}`;
    // set undefined value won't remove in IDB, but we can set null; better to overwrite with null sentinel
    await cacheSet(dayKey, null);
    const month = date.slice(0, 7);
    const key = `daily:${userId}:month:${month}`;
    const monthCache = (await cacheGet<DailyRecord[]>(key)) || [];
    const next = monthCache.filter((r) => r.date !== date);
    await cacheSet(key, next);
  } catch {}
}

export type DailyRecordUpsert = Omit<DailyRecord, "id"> & { id?: string };
