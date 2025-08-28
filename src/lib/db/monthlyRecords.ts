"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { MonthlyRecord } from "./types";

const TABLE = "monthly_records";

export async function listMonthlyRecords(userId: string): Promise<MonthlyRecord[]> {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, user_id, month, hours, bible_studies, note")
    .eq("user_id", userId)
    .order("month", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MonthlyRecord[];
}

export async function upsertMonthlyRecord(input: Omit<MonthlyRecord, "id"> & { id?: string }) {
  const supabase = createSupabaseBrowserClient();
  await supabase.auth.getSession();
  const { data, error } = await supabase.from(TABLE).upsert(input, { onConflict: "user_id,month" }).select().single();
  if (error) throw error;
  return data as MonthlyRecord;
}
