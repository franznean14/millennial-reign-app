"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cacheGet, cacheSet } from "@/lib/offline/store";
import { toast } from "@/components/ui/sonner";

export interface Congregation {
  id?: string;
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  midweek_day: number; // 1=Mon..5=Fri
  midweek_start: string; // HH:MM
  weekend_day: number; // 0=Sun or 6=Sat
  weekend_start: string; // HH:MM
  meeting_duration_minutes: number;
  business_witnessing_enabled?: boolean;
}

export async function getMyCongregation(): Promise<Congregation | null> {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession();
  } catch {}
  try {
    // Serve cached immediately when offline
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      const cached = await cacheGet<Congregation>("cong:mine");
      return cached ?? null;
    }
    const { data } = await supabase.rpc("get_my_congregation");
    const cong = (data as any) ?? null;
    if (cong) await cacheSet("cong:mine", cong);
    return cong;
  } catch {
    const cached = await cacheGet<Congregation>("cong:mine");
    return cached ?? null;
  }
}

export async function isAdmin(uid: string | null): Promise<boolean> {
  if (!uid) return false;
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession();
  } catch {}
  try {
    const { data } = await supabase.rpc("is_admin", { uid });
    return !!data;
  } catch {
    return false;
  }
}

export async function saveCongregation(input: Congregation): Promise<Congregation | null> {
  const supabase = createSupabaseBrowserClient();
  try {
    await supabase.auth.getSession();
  } catch {}
  try {
    // Normalize payload and guarantee non-null meeting duration
    const payload = {
      name: input.name,
      address: input.address ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      midweek_day: input.midweek_day,
      midweek_start: (input.midweek_start ?? "").slice(0, 5),
      weekend_day: input.weekend_day,
      weekend_start: (input.weekend_start ?? "").slice(0, 5),
      meeting_duration_minutes: input.meeting_duration_minutes ?? 105,
      business_witnessing_enabled: !!(input as any).business_witnessing_enabled,
    } as const;
    if (input.id) {
      const { id, ...rest } = input as any;
      const { error } = await supabase
        .from("congregations")
        .update({ ...payload, ...rest })
        .eq("id", id);
      if (error) throw error;
      // Fetch via RPC to avoid returning-row policy evaluation edge cases
      const updated = await getMyCongregation();
      toast.success("Congregation updated");
      return updated;
    }
    // Create and return inserted row
    const { data: createdRow, error } = await supabase
      .from("congregations")
      .insert(payload)
      .select()
      .single();
    if (error) throw error;

    // If creator has no congregation yet, assign them to the new one
    try {
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth.session?.user?.id ?? null;
      if (uid) {
        const { data: me } = await supabase.rpc("get_my_profile");
        const hasCong = !!(me as any)?.congregation_id;
        if (!hasCong && (createdRow as any)?.id) {
          // Use RPC which enforces admin/elder permissions server-side
          try {
            await supabase.rpc("transfer_user_to_congregation", {
              target_user: uid,
              new_congregation: (createdRow as any).id,
            });
          } catch {}
        }
      }
    } catch {}

    toast.success("Congregation created");
    // Prefer fetching via RPC so read policies are respected after assignment
    const current = await getMyCongregation();
    return current ?? (createdRow as any);
  } catch (e: any) {
    const msg = e?.message || "Failed to save congregation";
    toast.error(msg);
    return null;
  }
}
