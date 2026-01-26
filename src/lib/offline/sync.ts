"use client";

import { cacheGet, cacheSet, outboxReadAll, outboxRemove } from "./store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function initOfflineSync() {
  const supabase = createSupabaseBrowserClient();

  const dispatchReachability = (reachable: boolean, backendReachable?: boolean, originReachable?: boolean) => {
    try {
      const detail = {
        reachable,
        backendReachable: backendReachable ?? reachable,
        originReachable: originReachable ?? reachable,
      };
      window.dispatchEvent(new CustomEvent("app-net-reachable", { detail }));
    } catch {}
  };

  const pingBackend = async () => {
    try {
      // Prefer a lightweight HEAD request to Supabase Auth health endpoint
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (base) {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 3000);
        try {
          await fetch(`${base.replace(/\/$/, "")}/auth/v1/health`, { method: "HEAD", mode: "no-cors", cache: "no-store", signal: ctrl.signal });
          dispatchReachability(true, true, undefined);
          return true;
        } finally {
          clearTimeout(to);
        }
      }
      // If no base URL, assume reachable when browser reports online
      if (navigator.onLine) {
        dispatchReachability(true, true, undefined);
        return true;
      }
      dispatchReachability(false, false, undefined);
      return false;
    } catch {
      dispatchReachability(false, false, undefined);
      return false;
    }
  };

  const pingOrigin = async () => {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 3000);
      try {
        const url = `${location.origin}/ping?ts=${Date.now()}`;
        await fetch(url, { method: "HEAD", mode: "no-cors", cache: "no-store", signal: ctrl.signal });
        dispatchReachability(true, undefined, true);
        return true;
      } finally {
        clearTimeout(to);
      }
    } catch {
      dispatchReachability(false, undefined, false);
      return false;
    }
  };

  const flushOutbox = async () => {
    try {
      await supabase.auth.getSession();
      const items = await outboxReadAll();
      if (!items.length) return;

      // Separate operations
      const daily = items.filter((i) => i.type === "upsert_daily");
      const deletes = items.filter((i) => i.type === "delete_daily");
      const profiles = items.filter((i) => i.type === "upsert_profile");
      const bibleStudyVisits = items.filter((i) => i.type === "add_bible_study_with_visit");
      const bibleStudyDeletes = items.filter((i) => i.type === "delete_bible_study_with_visit");

      let anyFlushed = false;

      // Batch daily upserts in chunks to speed up sync
      const chunkSize = 200;
      for (let i = 0; i < daily.length; i += chunkSize) {
        const chunk = daily.slice(i, i + chunkSize);
        const payloads = chunk.map((c: any) => c.payload);
        try {
          const { data } = await supabase
            .from("daily_records")
            .upsert(payloads, { onConflict: "user_id,date" })
            .select();
          const returned = (data ?? payloads) as any[];
          // Update caches and remove outbox entries
          // Build a quick lookup for removing outbox entries
          const keys = new Set(returned.map((r) => `${r.user_id}:${r.date}`));
          for (const rec of returned) {
            const keyDay = `daily:${rec.user_id}:${rec.date}`;
            await cacheSet(keyDay, rec);
            const month = String(rec.date).slice(0, 7);
            const keyMonth = `daily:${rec.user_id}:month:${month}`;
            const monthCache = (await cacheGet<any[]>(keyMonth)) || [];
            const idx = monthCache.findIndex((r) => r.date === rec.date);
            if (idx >= 0) monthCache[idx] = rec; else monthCache.push(rec);
            monthCache.sort((a, b) => a.date.localeCompare(b.date));
            await cacheSet(keyMonth, monthCache);
          }
          // Remove chunk entries from outbox
          for (const item of chunk) {
            await outboxRemove(item.id!);
          }
          anyFlushed = true;
        } catch {}
      }

      // Process profile updates (few, do sequentially)
      for (const item of profiles) {
        try {
          const { data: userRes } = await supabase.auth.getUser();
          const uid = userRes.user?.id;
          if (!uid) throw new Error("No session");
          const payload = { id: uid, ...item.payload } as any;
          await supabase.from("profiles").upsert(payload, { onConflict: "id" });
          await outboxRemove(item.id!);
          anyFlushed = true;
        } catch {}
      }

      // Process bible study visit RPC calls (sequential to preserve order)
      for (const item of bibleStudyVisits) {
        try {
          const { data, error } = await supabase.rpc("add_bible_study_with_visit", item.payload);
          if (error) throw error;
          const rec = data?.[0]?.daily_record as any;
          if (rec?.user_id && rec?.date) {
            const keyDay = `daily:${rec.user_id}:${rec.date}`;
            await cacheSet(keyDay, rec);
            const month = String(rec.date).slice(0, 7);
            const keyMonth = `daily:${rec.user_id}:month:${month}`;
            const monthCache = (await cacheGet<any[]>(keyMonth)) || [];
            const idx = monthCache.findIndex((r) => r.date === rec.date);
            if (idx >= 0) monthCache[idx] = rec; else monthCache.push(rec);
            monthCache.sort((a, b) => a.date.localeCompare(b.date));
            await cacheSet(keyMonth, monthCache);
          }
          await outboxRemove(item.id!);
          anyFlushed = true;
        } catch {}
      }

      // Process bible study deletes (sequential to preserve order)
      for (const item of bibleStudyDeletes) {
        try {
          const { data, error } = await supabase.rpc("delete_bible_study_with_visit", item.payload);
          if (error) throw error;
          const rec = data?.[0]?.daily_record as any;
          if (rec?.user_id && rec?.date) {
            const keyDay = `daily:${rec.user_id}:${rec.date}`;
            await cacheSet(keyDay, rec);
            const month = String(rec.date).slice(0, 7);
            const keyMonth = `daily:${rec.user_id}:month:${month}`;
            const monthCache = (await cacheGet<any[]>(keyMonth)) || [];
            const idx = monthCache.findIndex((r) => r.date === rec.date);
            if (idx >= 0) monthCache[idx] = rec; else monthCache.push(rec);
            monthCache.sort((a, b) => a.date.localeCompare(b.date));
            await cacheSet(keyMonth, monthCache);
          }
          await outboxRemove(item.id!);
          anyFlushed = true;
        } catch {}
      }

      // Batch delete dailies (group by user_id)
      if (deletes.length) {
        const byUser = new Map<string, any[]>();
        for (const d of deletes) {
          const u = d.payload.user_id;
          if (!byUser.has(u)) byUser.set(u, []);
          byUser.get(u)!.push(d);
        }
        for (const [userId, list] of byUser.entries()) {
          try {
            const dates = list.map((x) => x.payload.date);
            await supabase.from("daily_records").delete().eq("user_id", userId).in("date", dates);
            // Update caches
            for (const dt of dates) {
              const keyDay = `daily:${userId}:${dt}`;
              await cacheSet(keyDay, null);
              const mk = String(dt).slice(0, 7);
              const keyMonth = `daily:${userId}:month:${mk}`;
              const monthCache = (await cacheGet<any[]>(keyMonth)) || [];
              const next = monthCache.filter((r) => r.date !== dt);
              await cacheSet(keyMonth, next);
            }
            for (const it of list) await outboxRemove(it.id!);
            anyFlushed = true;
          } catch {}
        }
      }

      if (anyFlushed) {
        try {
          window.dispatchEvent(new CustomEvent("daily-record-updated"));
          window.dispatchEvent(new CustomEvent("offline-sync-flushed"));
        } catch {}
      }
    } catch {}
  };

  const hydrateCache = async () => {
    try {
      await supabase.auth.getSession();
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id;
      if (!userId) return;

      // Get profile for timezone and cache it
      const { data: profile } = await supabase.rpc("get_my_profile");
      if (profile) await cacheSet(`profile:${userId}`, profile);
      const timeZone: string | undefined = (profile?.time_zone as string) || undefined;

      // Compute current month/service year boundaries in user's TZ
      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || undefined, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
      const y = Number(parts.find((p) => p.type === "year")?.value || now.getFullYear());
      const m = Number(parts.find((p) => p.type === "month")?.value || now.getMonth() + 1) - 1; // 0-based
      const ymd = (yy: number, mmIndex: number, dd: number) => {
        const mm = String(mmIndex + 1).padStart(2, "0");
        const ddStr = String(dd).padStart(2, "0");
        return `${yy}-${mm}-${ddStr}`;
      };
      const monthStart = ymd(y, m, 1);
      const serviceYearStart = m >= 8 ? ymd(y, 8, 1) : ymd(y - 1, 8, 1);
      const serviceYearEnd = m >= 8 ? ymd(y + 1, 8, 1) : ymd(y, 8, 1);

      // Pull down records for current service year in one request
      const { data, error } = await supabase
        .from("daily_records")
        .select("id, user_id, date, hours, bible_studies, note")
        .eq("user_id", userId)
        .gte("date", serviceYearStart)
        .lt("date", serviceYearEnd)
        .order("date", { ascending: true });
      if (error) throw error;
      const list = (data ?? []) as any[];

      // Populate day cache and month caches
      const monthMap = new Map<string, any[]>();
      for (const rec of list) {
        await cacheSet(`daily:${rec.user_id}:${rec.date}`, rec);
        const mk = String(rec.date).slice(0, 7);
        const arr = monthMap.get(mk) ?? [];
        arr.push(rec);
        monthMap.set(mk, arr);
      }
      for (const [mk, arr] of monthMap.entries()) {
        arr.sort((a, b) => a.date.localeCompare(b.date));
        await cacheSet(`daily:${userId}:month:${mk}`, arr);
      }

      // Notify UI to refresh from cache; no network fetch in listeners
      try {
        window.dispatchEvent(new CustomEvent("daily-record-updated"));
      } catch {}
    } catch {}
  };

  const runOnlineTasks = () => {
    if (!navigator.onLine) return;
    // Fire in parallel
    void flushOutbox();
    void hydrateCache();
    // Silence noisy cross-origin pings; origin ping is sufficient for UX
    void pingOrigin();
  };

  const onOnline = () => {
    dispatchReachability(true, true, true);
    runOnlineTasks();
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") runOnlineTasks();
  };

  window.addEventListener("online", onOnline);
  window.addEventListener("offline", () => dispatchReachability(false, false, false));
  document.addEventListener("visibilitychange", onVisible);
  // Kick once on load
  if (navigator.onLine) {
    // Assume both reachable at first; subsequent pings correct this quickly.
    dispatchReachability(true, true, true);
    runOnlineTasks();
  } else {
    dispatchReachability(false, false, false);
  }

  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
