"use client";

import { useEffect, useState, useMemo } from "react";
import NumberFlow from "@number-flow/react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDateHuman } from "@/lib/utils";
import { cacheGet, cacheSet } from "@/lib/offline/store";

type StudyCount = [string, number];

function topStudies(records: { bible_studies: string[] | null }[], limit = 5): StudyCount[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    for (const name of r.bible_studies ?? []) {
      const key = name.trim();
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit);
}

function sumHours(records: { hours: number }[]) {
  return records.reduce((acc, r) => acc + (Number(r.hours) || 0), 0);
}

interface HomeSummaryProps {
  userId: string;
  monthStart: string;
  nextMonthStart: string;
  serviceYearStart: string;
  serviceYearEnd: string;
}

export function HomeSummary({
  userId,
  monthStart,
  nextMonthStart,
  serviceYearStart,
  serviceYearEnd,
}: HomeSummaryProps) {
  const [monthHours, setMonthHours] = useState(0);
  const [syHours, setSyHours] = useState(0);
  const [studies, setStudies] = useState<StudyCount[]>([]);
  const [localPioneer, setLocalPioneer] = useState(false);
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [range, setRange] = useState({
    mStart: monthStart,
    mNext: nextMonthStart,
    syStart: serviceYearStart,
    syEnd: serviceYearEnd,
  });

  const fmtHours = (h: number) => {
    // Only show decimals if the number has decimal places
    return h % 1 === 0 ? h.toString() : h.toFixed(2);
  };

  // Get user timezone
  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);


  // Set user ID
  useEffect(() => {
    setUid(userId);
  }, [userId]);

  // Update date ranges when props change
  useEffect(() => {
    setRange({
      mStart: monthStart,
      mNext: nextMonthStart,
      syStart: serviceYearStart,
      syEnd: serviceYearEnd,
    });
  }, [monthStart, nextMonthStart, serviceYearStart, serviceYearEnd]);

  const refresh = async () => {
    if (!uid || !range.mStart || !range.mNext || !range.syStart || !range.syEnd) return;
    
    const cacheKey = `home-summary-${uid}-${range.mStart}-${range.mNext}-${range.syStart}-${range.syEnd}`;
    
    // Try to load from cache first
    const cachedData = await cacheGet(cacheKey);
    if (cachedData) {
      setMonthHours(cachedData.monthHours || 0);
      setSyHours(cachedData.syHours || 0);
      setStudies(cachedData.studies || []);
      setLocalPioneer(cachedData.localPioneer || false);
    }
    
    // Create AbortController for this request
    const abortController = new AbortController();
    
    try {
      const supabase = createSupabaseBrowserClient();

      const [month, sy, profile] = await Promise.all([
        supabase
          .from("daily_records")
          .select("hours,bible_studies")
          .eq("user_id", uid)
          .gte("date", range.mStart)
          .lt("date", range.mNext),
        supabase
          .from("daily_records")
          .select("hours")
          .eq("user_id", uid)
          .gte("date", range.syStart)
          .lt("date", range.syEnd),
        supabase
          .from("profiles")
          .select("privileges")
          .eq("id", uid)
          .single(),
      ]);

      if (month.data) {
        const monthHoursValue = sumHours(month.data);
        const studiesValue = topStudies(month.data, 5);
        setMonthHours(monthHoursValue);
        setStudies(studiesValue);
      }
      if (sy.data) {
        const syHoursValue = sumHours(sy.data);
        setSyHours(syHoursValue);
      }
      if (profile.data) {
        const privileges = profile.data.privileges;
        const pioneerValue = Array.isArray(privileges) && privileges.includes("Regular Pioneer");
        setLocalPioneer(pioneerValue);
      }
      
      // Cache the data
      const dataToCache = {
        monthHours: month.data ? sumHours(month.data) : 0,
        syHours: sy.data ? sumHours(sy.data) : 0,
        studies: month.data ? topStudies(month.data, 5) : [],
        localPioneer: profile.data ? (Array.isArray(profile.data.privileges) && profile.data.privileges.includes("Regular Pioneer")) : false,
        timestamp: new Date().toISOString()
      };
      
      await cacheSet(cacheKey, dataToCache);
      
    } catch (error) {
      // Only log errors that aren't from cancellation
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error fetching home summary data:', error);
      }
    }
  };

  // Update timezone-based ranges
  useEffect(() => {
    if (!timeZone) return;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const ymd = (yy: number, mmIndex: number, dd: number) => {
      const mm = String(mmIndex + 1).padStart(2, "0");
      const ddStr = String(dd).padStart(2, "0");
      return `${yy}-${mm}-${ddStr}`;
    };
    const mStart = ymd(y, m, 1);
    const mNext = m === 11 ? ymd(y + 1, 0, 1) : ymd(y, m + 1, 1);
    const syStart = m >= 8 ? ymd(y, 8, 1) : ymd(y - 1, 8, 1);
    const syEnd = m >= 8 ? ymd(y + 1, 8, 1) : ymd(y, 8, 1);
    setRange({ mStart, mNext, syStart, syEnd });
  }, [timeZone]);

  // Load data when component mounts or ranges change
  useEffect(() => {
    if (!uid) return;
    refresh();
  }, [uid, range.mStart, range.mNext, range.syStart, range.syEnd]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!uid) return;
    const supabase = createSupabaseBrowserClient();

    const channel = supabase
      .channel("home-daily-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_records", filter: `user_id=eq.${uid}` },
        async (payload: any) => {
          // Only refresh if component is still mounted and user is still logged in
          if (uid) {
            refresh();
          }
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [uid]);

  // Listen to local app events (optimistic/offline updates)
  useEffect(() => {
    if (!uid) return;
    const handler = (e: any) => {
      if (!uid) return;
      try {
        const target = e?.detail?.userId;
        if (!target || target === uid) refresh();
      } catch {
        refresh();
      }
    };
    window.addEventListener("daily-records-changed", handler as any);
    return () => window.removeEventListener("daily-records-changed", handler as any);
  }, [uid, range.mStart, range.mNext, range.syStart, range.syEnd]);

  // Cleanup effect - reset state when user logs out
  useEffect(() => {
    if (!uid) {
      setMonthHours(0);
      setSyHours(0);
      setStudies([]);
      setLocalPioneer(false);
    }
  }, [uid]);

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">This Month</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Combined hours card */}
        <div className="sm:col-span-3 rounded-lg border p-6">
          <div className="flex flex-row items-end justify-between gap-6">
            <div>
              <div className="text-5xl font-semibold leading-tight">
                <NumberFlow value={Number(fmtHours(monthHours))} locales="en-US" format={{ useGrouping: false }} />
              </div>
              <div className="mt-0.5 text-sm opacity-70">Hours</div>
            </div>
            {localPioneer ? (
              <div className="text-right">
                <div className="text-xs opacity-70">This service year</div>
                <div className="mt-1 text-2xl font-semibold leading-tight">
                  <NumberFlow value={Number(fmtHours(syHours))} locales="en-US" format={{ useGrouping: false }} />
                </div>
                <div className="text-xs opacity-70 mt-1">Since {formatDateHuman(serviceYearStart, timeZone || undefined)}</div>
              </div>
            ) : null}
          </div>
        </div>

      </div>
    </section>
  );
}
