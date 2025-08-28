"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Profile, Role } from "./types";
import { cacheGet, cacheSet, outboxEnqueue } from "@/lib/offline/store";
import { toast } from "@/components/ui/sonner";

const TABLE = "profiles";

export async function getProfile(userId: string): Promise<Profile | null> {
  const supabase = createSupabaseBrowserClient();
  // Offline-first: serve from cache when available or when offline
  const cached = await cacheGet<Profile>(`profile:${userId}`);
  if (cached) return cached;
  // If offline, do not attempt network
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;
  // Ensure session is hydrated (avoids RLS errors during initial hydration)
  try {
    await supabase.auth.getSession();
  } catch {}
  try {
    const { data } = await supabase.rpc("get_my_profile");
    const prof = (data as Profile) ?? null;
    if (prof) await cacheSet(`profile:${userId}`, prof);
    return prof;
  } catch {
    // As a last resort return null (prevents dev overlay noise offline)
    return null;
  }
}

export async function upsertProfile(input: Omit<Profile, "id" | "role"> & { id: string; role?: Role }) {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession();
  } catch {}
  const { first_name, last_name, middle_name, date_of_birth, date_of_baptism, privileges, avatar_url, time_zone, username } = input as any;
  try {
    const { data, error } = await supabase.rpc("upsert_my_profile_v2", {
      first_name,
      last_name,
      middle_name: middle_name ?? null,
      date_of_birth: date_of_birth ?? null,
      date_of_baptism: date_of_baptism ?? null,
      privileges,
      avatar_url: avatar_url ?? null,
      time_zone: time_zone ?? null,
      username: username ?? null,
    });
    if (error) throw error;
    const prof = data as Profile;
    await cacheSet(`profile:${input.id}`, prof);
    return prof;
  } catch (e) {
    await outboxEnqueue({
      type: "upsert_profile",
      payload: { first_name, last_name, middle_name, date_of_birth, date_of_baptism, privileges, avatar_url, time_zone, username },
    });
    const optimistic: Profile = {
      id: input.id,
      first_name,
      last_name,
      middle_name: middle_name ?? null,
      date_of_birth: date_of_birth ?? null,
      date_of_baptism: date_of_baptism ?? null,
      privileges: privileges ?? [],
      avatar_url: avatar_url ?? null,
      role: (input as any).role ?? "user",
      time_zone: time_zone ?? null,
      username: username ?? null,
    };
    await cacheSet(`profile:${input.id}`, optimistic);
    toast.success("Saved offline. Will sync when online.");
    return optimistic;
  }
}
