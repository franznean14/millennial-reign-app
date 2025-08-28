"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cacheGet, cacheSet } from "@/lib/offline/store";
import { formatDateHuman } from "@/lib/utils";
import { TopStudies } from "@/components/home/TopStudies";

type StudyCount = [string, number];

function sumHours(records: { hours: number }[]) {
  return records.reduce((acc, r) => acc + (Number(r.hours) || 0), 0);
}

function topStudies(records: { bible_studies: string[] | null }[], limit = 5): StudyCount[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    for (const name of r.bible_studies ?? []) {
      const key = name.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export function HomeSummary({
  userId,
  monthStart,
  nextMonthStart,
  serviceYearStart,
  serviceYearEnd,
  initialMonthHours,
  initialSyHours,
  initialStudies,
  isRegularPioneer,
  timeZone,
}: {
  userId?: string;
  monthStart: string;
  nextMonthStart: string;
  serviceYearStart: string;
  serviceYearEnd: string;
  initialMonthHours: number;
  initialSyHours: number;
  initialStudies: StudyCount[];
  isRegularPioneer: boolean;
  timeZone?: string | null;
}) {
  const [uid, setUid] = useState<string | null>(userId ?? null);
  const [monthHours, setMonthHours] = useState(initialMonthHours);
  const [syHours, setSyHours] = useState(initialSyHours);
  const [studies, setStudies] = useState<StudyCount[]>(initialStudies);
  const [localPioneer, setLocalPioneer] = useState<boolean>(isRegularPioneer);

  const fmtHours = (v: number) => {
    if (!isFinite(v)) return "0";
    const rounded = Math.round(v);
    if (Math.abs(v - rounded) < 1e-9) return String(rounded);
    const s = v.toFixed(2).replace(/(\.\d*[1-9])0+$/, "$1").replace(/\.0+$/, "");
    return s;
  };

  const refresh = async () => {
    if (!uid) return;
    const supabase = createSupabaseBrowserClient();
    // Ensure session is hydrated to satisfy RLS
    await supabase.auth.getSession();
    const [{ data: monthData }, { data: syData }] = await Promise.all([
      supabase
        .from("daily_records")
        .select("date,hours,bible_studies")
        .eq("user_id", uid)
        .gte("date", monthStart)
        .lt("date", nextMonthStart),
      supabase
        .from("daily_records")
        .select("date,hours")
        .eq("user_id", uid)
        .gte("date", serviceYearStart)
        .lt("date", serviceYearEnd),
    ]);
    const month = monthData ?? [];
    const sy = syData ?? [];
    setMonthHours(sumHours(month));
    setSyHours(sumHours(sy));
    setStudies(topStudies(month, 5));
  };

  const refreshFromCache = async () => {
    try {
      if (!uid) return;
      const monthKey = monthStart.slice(0, 7);
      const month = (await cacheGet<any[]>(`daily:${uid}:month:${monthKey}`)) || [];
      if (month.length) {
        setMonthHours(sumHours(month));
        setStudies(topStudies(month, 5));
      }
      // Service year: iterate months via local y/m increments
      const syStart = serviceYearStart.slice(0, 7);
      const syEnd = serviceYearEnd.slice(0, 7);
      const [syStartY, syStartM] = syStart.split("-").map((s) => Number(s));
      const accum: any[] = [];
      let y = syStartY;
      let m = syStartM; // 1-12
      const fmt = (yy: number, mm: number) => `${String(yy).padStart(4, "0")}-${String(mm).padStart(2, "0")}`;
      while (fmt(y, m) !== syEnd) {
        const key = `daily:${uid}:month:${fmt(y, m)}`;
        const list = (await cacheGet<any[]>(key)) || [];
        if (list.length) accum.push(...list);
        m += 1;
        if (m > 12) {
          m = 1;
          y += 1;
        }
      }
      if (accum.length) setSyHours(sumHours(accum));
    } catch {}
  };

  // Hydrate uid on mount if not provided
  useEffect(() => {
    if (uid) return;
    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .getSession()
      .then(({ data }) => {
        const id = data.session?.user?.id ?? null;
        if (id) setUid(id);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Try cached profile to infer pioneer if SSR said false
  useEffect(() => {
    if (!uid) return;
    if (localPioneer) return;
    (async () => {
      try {
        const prof = await cacheGet<any>(`profile:${uid}`);
        if (Array.isArray(prof?.privileges) && prof.privileges.includes("Regular Pioneer")) {
          setLocalPioneer(true);
        }
      } catch {}
    })();
  }, [uid, localPioneer]);

  // Subscribe to events and realtime once uid is known
  useEffect(() => {
    if (!uid) return;
    const supabase = createSupabaseBrowserClient();
    let refreshTimer: any = null;
    const schedule = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refresh().catch(() => {});
      }, 500);
    };

    const handler = () => {
      // cache first; avoid immediate network refetch for offline-first UX
      refreshFromCache();
    };
    window.addEventListener("daily-record-updated", handler as any);

    const channel = supabase
      .channel("home-daily-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_records", filter: `user_id=eq.${uid}` },
        async (payload: any) => {
          try {
            const rec = payload?.new;
            if (rec?.date && rec?.user_id === uid) {
              await cacheSet(`daily:${uid}:${rec.date}`, rec);
              const mk = String(rec.date).slice(0, 7);
              const keyMonth = `daily:${uid}:month:${mk}`;
              const monthCache = (await cacheGet<any[]>(keyMonth)) || [];
              const idx = monthCache.findIndex((r) => r.date === rec.date);
              if (idx >= 0) monthCache[idx] = rec; else monthCache.push(rec);
              monthCache.sort((a, b) => a.date.localeCompare(b.date));
              await cacheSet(keyMonth, monthCache);
            }
          } catch {}
          // Always re-read from cache for display
          refreshFromCache();
        }
      )
      .subscribe();

    // Initial cache hydrate + one-time network fetch if online
    (async () => {
      await refreshFromCache();
      if (typeof navigator !== "undefined" && navigator.onLine) {
        try {
          await refresh();
        } catch {}
      }
    })();

    return () => {
      window.removeEventListener("daily-record-updated", handler as any);
      try {
        supabase.removeChannel(channel);
      } catch {}
      if (refreshTimer) clearTimeout(refreshTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">This Month</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Combined hours card */}
        <div className="sm:col-span-3 rounded-lg border p-6">
          <div className="flex flex-row items-end justify-between gap-6">
            <div>
              <div className="text-5xl font-semibold leading-tight">{fmtHours(monthHours)}</div>
              <div className="mt-0.5 text-sm opacity-70">Hours</div>
            </div>
            {localPioneer ? (
              <div className="text-right">
                <div className="text-xs opacity-70">This service year</div>
                <div className="mt-1 text-2xl font-semibold leading-tight">{fmtHours(syHours)}</div>
                <div className="text-xs opacity-70 mt-1">Since {formatDateHuman(serviceYearStart, timeZone || undefined)}</div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Top studies */}
        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium mb-2">Top Bible Studies</div>
          <TopStudies items={studies} />
        </div>
      </div>
    </section>
  );
}
