"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Profile, Role, Gender } from "./types";
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

// Admin function to update another user's profile (only specific fields)
export async function updateUserProfile(targetUserId: string, updates: {
  privileges?: string[];
  group_name?: string | null;
  congregation_id?: string | null;
}) {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession();
  } catch {}

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetUserId)
      .select()
      .single();

    if (error) throw error;
    
    const profile = data as Profile;
    await cacheSet(`profile:${targetUserId}`, profile);
    return profile;
  } catch (e: any) {
    const msg = e?.message || "Failed to update user profile";
    console.error("Admin profile update error:", e);
    throw new Error(msg);
  }
}

export async function upsertProfile(input: Omit<Profile, "id" | "role"> & { id: string; role?: Role }) {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession();
  } catch {}
  const { first_name, last_name } = input as any;
  // Helper to sanitize privileges consistently across try/catch paths
  const sanitizePrivileges = (raw: any, gender: Gender | null) => {
    let privs: string[] = Array.isArray(raw) ? [...raw] : [];
    privs = Array.from(new Set(privs));
    const allowed = ['Elder','Ministerial Servant','Regular Pioneer','Auxiliary Pioneer','Secretary','Coordinator','Group Overseer'];
    privs = privs.filter((p) => allowed.includes(p));
    if (privs.includes('Regular Pioneer') && privs.includes('Auxiliary Pioneer')) {
      privs = privs.filter((p) => p !== 'Auxiliary Pioneer');
    }
    if (privs.includes('Ministerial Servant') && privs.includes('Elder')) {
      privs = privs.filter((p) => p !== 'Ministerial Servant');
    }
    const elderOnly = ['Secretary','Coordinator','Group Overseer'];
    if (elderOnly.some((p) => privs.includes(p)) && !privs.includes('Elder')) {
      // Drop elder-only if Elder isn't present
      privs = privs.filter((p) => !elderOnly.includes(p));
    }
    if ((privs.includes('Ministerial Servant') || privs.includes('Elder')) && gender !== 'male') {
      // Drop MS/Elder when gender isn't male
      privs = privs.filter((p) => p !== 'Ministerial Servant' && p !== 'Elder');
    }
    return privs;
  };
  // Normalize optional fields: empty strings -> null; dates as 'YYYY-MM-DD' or null; arrays default
  const norm = {
    middle_name: (input as any).middle_name ? String((input as any).middle_name) : null,
    date_of_birth: (() => {
      const v = (input as any).date_of_birth;
      if (!v) return null;
      const s = String(v);
      return s.length === 10 ? s : null;
    })(),
    date_of_baptism: (() => {
      const v = (input as any).date_of_baptism;
      if (!v) return null;
      const s = String(v);
      return s.length === 10 ? s : null;
    })(),
    privileges: Array.isArray((input as any).privileges) ? (input as any).privileges : [],
    avatar_url: (input as any).avatar_url ? String((input as any).avatar_url) : null,
    time_zone: (input as any).time_zone ? String((input as any).time_zone) : null,
    username: (input as any).username ? String((input as any).username) : null,
    // profile fields
    gender: ((): Gender | null => {
      const g = (input as any).gender;
      if (!g) return null;
      const s = String(g).toLowerCase();
      return s === "male" || s === "female" ? (s as Gender) : null;
    })(),
    congregation_id: (input as any).congregation_id ?? null,
    group_name: (input as any).group_name ? String((input as any).group_name) : null,
  } as const;
  // Ensure we always have a computed list for offline optimistic path
  let computedPrivs: string[] = sanitizePrivileges((input as any).privileges, norm.gender);
  try {
    // Proactively check username availability if provided
    if (norm.username) {
      try {
        const { data: ok } = await supabase.rpc("is_username_available", { u: norm.username });
        if (ok === false) {
          throw new Error("Username already taken. Try a different one.");
        }
      } catch (e) {
        if ((e as any)?.message) throw e;
      }
    }
    // Single codepath: upsert via table with RLS, avoids RPC casting issues
    // Enforce client-side constraints to align with DB checks
    const gender = norm.gender;
    let privs: string[] = sanitizePrivileges((input as any).privileges, gender);
    // Strict errors for invalid requests
    if ((['Secretary','Coordinator','Group Overseer'] as string[]).some((p) => (input as any).privileges?.includes?.(p)) && !privs.includes('Elder')) {
      throw new Error('Secretary/Coordinator/Group Overseer require Elder.');
    }
    if ((['Ministerial Servant','Elder'] as string[]).some((p) => (input as any).privileges?.includes?.(p)) && gender !== 'male') {
      throw new Error('Ministerial Servant or Elder requires gender=male.');
    }
    computedPrivs = privs;

    const record: any = {
      id: input.id,
      first_name,
      last_name,
      middle_name: norm.middle_name,
      date_of_birth: norm.date_of_birth as any,
      date_of_baptism: norm.date_of_baptism as any,
      privileges: privs as any,
      avatar_url: norm.avatar_url,
      time_zone: norm.time_zone,
      username: norm.username,
      gender: norm.gender as any,
      group_name: norm.group_name as any,
      // Contact information fields
      phone_number: (input as any).phone_number ? String((input as any).phone_number) : null,
      address: (input as any).address ? String((input as any).address) : null,
      address_latitude: (input as any).address_latitude ? Number((input as any).address_latitude) : null,
      address_longitude: (input as any).address_longitude ? Number((input as any).address_longitude) : null,
    };
    // Only include congregation_id when explicitly provided by caller.
    if (Object.prototype.hasOwnProperty.call(input as any, 'congregation_id')) {
      (record as any).congregation_id = norm.congregation_id as any;
    }
    const { data, error } = await supabase
      .from(TABLE)
      .upsert(record, { onConflict: "id" })
      .select()
      .single();
    if (error) throw error;
    const prof = data as Profile;
    await cacheSet(`profile:${input.id}`, prof);
    return prof;
  } catch (e: any) {
    // Unique violation or other constraint: surface helpful message and queue offline
    const code = e?.code || e?.details || "";
    const msg = e?.message || "Failed to save profile";
    if (/insufficient_privilege/i.test(msg)) {
      throw new Error("You don’t have permission to change congregation assignment. Ask an elder or admin.");
    }
    if (String(code).includes("23505") || /unique/i.test(msg)) {
      // Likely username conflict
      const hint = "Username already taken. Try a different one.";
      // eslint-disable-next-line no-console
      console.warn("Profile save unique violation:", e);
      throw new Error(hint);
    }
    await outboxEnqueue({
      type: "upsert_profile",
      payload: { first_name, last_name, ...norm },
    });
    const optimistic: Profile = {
      id: input.id,
      first_name,
      last_name,
      middle_name: norm.middle_name,
      date_of_birth: norm.date_of_birth as any,
      date_of_baptism: norm.date_of_baptism as any,
      privileges: computedPrivs as any,
      avatar_url: norm.avatar_url,
      role: (input as any).role ?? "user",
      time_zone: norm.time_zone,
      username: norm.username,
      gender: norm.gender as any,
      congregation_id: (Object.prototype.hasOwnProperty.call(input as any, 'congregation_id') ? (norm.congregation_id as any) : (undefined as any)),
      group_name: norm.group_name,
      // Contact information fields
      phone_number: (input as any).phone_number ? String((input as any).phone_number) : null,
      address: (input as any).address ? String((input as any).address) : null,
      address_latitude: (input as any).address_latitude ? Number((input as any).address_latitude) : null,
      address_longitude: (input as any).address_longitude ? Number((input as any).address_longitude) : null,
    };
    await cacheSet(`profile:${input.id}`, optimistic);
    toast.error("Working offline. Changes queued.", { description: msg });
    return optimistic;
  }
}
