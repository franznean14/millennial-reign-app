"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cacheGet, cacheSet } from "@/lib/offline/store";
import type { MonthlyRecord } from "./types";

const TABLE = "monthly_records";

export async function listMonthlyRecords(userId: string): Promise<MonthlyRecord[]> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession();
  const key = `monthly:${userId}`;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const cached = await cacheGet<MonthlyRecord[]>(key);
    return cached ?? [];
  }
  try {
    const { data } = await supabase
      .from(TABLE)
      .select("id, user_id, month, hours, bible_studies, note")
      .eq("user_id", userId)
      .order("month", { ascending: false });
    const list = (data ?? []) as MonthlyRecord[];
    await cacheSet(key, list);
    return list;
  } catch {
    const cached = await cacheGet<MonthlyRecord[]>(key);
    return cached ?? [];
  }
}

export async function upsertMonthlyRecord(input: Omit<MonthlyRecord, "id"> & { id?: string }) {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession();
  const { data, error } = await supabase.from(TABLE).upsert(input, { onConflict: "user_id,month" }).select().single();
  if (error) throw error;
  const rec = data as MonthlyRecord;
  try {
    const key = `monthly:${input.user_id}`;
    const cached = (await cacheGet<MonthlyRecord[]>(key)) || [];
    const idx = cached.findIndex((r) => r.month === input.month);
    if (idx >= 0) cached[idx] = rec; else cached.unshift(rec);
    await cacheSet(key, cached);
  } catch {}
  return rec;
}
