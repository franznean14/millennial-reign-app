"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import NumberFlow from "@number-flow/react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDateHuman } from "@/lib/utils";
import { cacheGet, cacheSet } from "@/lib/offline/store";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDailyRecord, listDailyByMonth, upsertDailyRecord, isDailyEmpty, deleteDailyRecord } from "@/lib/db/dailyRecords";
import { NumberFlowInput } from "@/components/ui/number-flow-input";

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

function toLocalStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface DesktopHomeSummaryProps {
  userId: string;
  monthStart: string;
  nextMonthStart: string;
  serviceYearStart: string;
  serviceYearEnd: string;
  onNavigateToCongregation?: () => void;
}

export function DesktopHomeSummary({
  userId,
  monthStart,
  nextMonthStart,
  serviceYearStart,
  serviceYearEnd,
  onNavigateToCongregation,
}: DesktopHomeSummaryProps) {
  // Home summary state
  const [monthHours, setMonthHours] = useState(0);
  const [syHours, setSyHours] = useState(0);
  const [studies, setStudies] = useState<StudyCount[]>([]);
  const [localPioneer, setLocalPioneer] = useState(false);
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [range, setRange] = useState({
    mStart: monthStart,
    mNext: nextMonthStart,
    syStart: serviceYearStart,
    syEnd: serviceYearEnd,
  });

  // Field service form state
  const [view, setView] = useState<Date>(new Date());
  const [mode, setMode] = useState<"days"|"months"|"years">("days");
  const [date, setDate] = useState<string>(toLocalStr(new Date()));
  const [hours, setHours] = useState<string>("");
  const [formStudies, setFormStudies] = useState<string[]>([]);
  const [note, setNote] = useState<string>("");
  const debounceRef = useRef<any>(null);
  const notifyRef = useRef<any>(null);
  const [dirty, setDirty] = useState(false);
  const [monthMarks, setMonthMarks] = useState<Record<string, boolean>>({});

  const fmtHours = (h: number) => {
    return h % 1 === 0 ? h.toString() : h.toFixed(2);
  };

  const monthLabel = useMemo(() => view.toLocaleString(undefined, { month: "long" }), [view]);
  const yearLabel = useMemo(() => String(view.getFullYear()), [view]);

  const start = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const s = new Date(first);
    s.setDate(first.getDay() === 0 ? 1 - 0 : 1 - first.getDay());
    return s;
  }, [view]);

  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  const isSelected = (d: Date) => toLocalStr(d) === date;
  const inMonth = (d: Date) => d.getMonth() === view.getMonth();
  const viewMonthKey = () => `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, "0")}`;

  // Get user timezone
  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  // Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    setIsOffline(!navigator.onLine);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
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
    
    // If offline, don't attempt network request
    if (isOffline) {
      return;
    }
    
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
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Error fetching home summary data:', error);
      }
    }
  };

  // Field service form functions
  const loadMonthMarks = async () => {
    try {
      const month = viewMonthKey();
      const list = await listDailyByMonth(userId, month);
      const marks: Record<string, boolean> = {};
      for (const r of list) {
        if (!(r as any) || (typeof r !== "object")) continue;
        const h = Number((r as any).hours || 0);
        const bs = Array.isArray((r as any).bible_studies) ? (r as any).bible_studies.filter(Boolean) : [];
        const n = ((r as any).note ?? "").toString().trim();
        const empty = (!h || h === 0) && bs.length === 0 && n.length === 0;
        if (!empty) marks[(r as any).date] = true;
      }
      setMonthMarks(marks);
    } catch {}
  };

  const load = async (d: string) => {
    try {
      const rec = await getDailyRecord(userId, d);
      setHours(rec ? String(rec.hours) : "");
      setFormStudies(rec?.bible_studies ?? []);
      setNote(rec?.note ?? "");
      setDirty(false);
    } catch {}
  };

  const scheduleSave = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const payload = {
        user_id: userId,
        date,
        hours: Number(hours || 0),
        bible_studies: formStudies,
        note: note.trim() || null,
      };
      try {
        if (isDailyEmpty(payload)) {
          await deleteDailyRecord(userId, date);
          setMonthMarks((m) => {
            const cp = { ...m };
            delete cp[date];
            return cp;
          });
        } else {
          await upsertDailyRecord(payload);
          setMonthMarks((m) => ({ ...m, [date]: true }));
        }
        setDirty(false);
        try {
          window.dispatchEvent(new CustomEvent('daily-records-changed', { detail: { userId } }));
        } catch {}
      } catch (e: any) {
        toast.error(e.message ?? "Failed to save");
      }
    }, 1000);
  };

  const addStudy = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (formStudies.includes(trimmed)) return;
    setFormStudies((s) => [...s, trimmed]);
    setDirty(true);
  };

  const removeStudy = (name: string) => {
    setFormStudies((s) => s.filter((n) => n !== name));
    setDirty(true);
  };

  const changeStep = (delta: number) => {
    const next = new Date(view);
    if (mode === "days") next.setMonth(next.getMonth() + delta);
    else if (mode === "months") next.setFullYear(next.getFullYear() + delta);
    else next.setFullYear(next.getFullYear() + delta * 12);
    setView(next);
  };

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    idx: i,
    label: new Date(2000, i, 1).toLocaleString(undefined, { month: "short" })
  })), []);

  const years = useMemo(() => {
    const base = view.getFullYear();
    const start = base - 7;
    return Array.from({ length: 12 }, (_, i) => start + i);
  }, [view]);

  // Load data when component mounts or ranges change
  useEffect(() => {
    if (!uid) return;
    refresh();
  }, [uid, range.mStart, range.mNext, range.syStart, range.syEnd]);

  useEffect(() => {
    loadMonthMarks();
    load(date);
  }, [view]);

  useEffect(() => {
    if (dirty) {
      scheduleSave();
      if (notifyRef.current) clearTimeout(notifyRef.current);
      notifyRef.current = setTimeout(() => {
        toast.success("Saving...");
      }, 500);
    }
  }, [dirty, hours, formStudies, note]);

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
    <div className="w-1/3">
      <Card 
        className={onNavigateToCongregation ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''}
        onClick={onNavigateToCongregation}
      >
        <CardHeader>
          <CardTitle>This Month</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Hours Summary */}
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

            {/* Calendar */}
            <div>
              <div className="text-sm font-medium mb-3">Field Service Activity</div>
              <div className="flex items-center justify-between pb-3">
                <Button variant="ghost" size="sm" onClick={() => changeStep(-1)}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="text-sm font-medium flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setMode("months")}>{monthLabel}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setMode("years")}>{yearLabel}</Button>
                </div>
                <Button variant="ghost" size="sm" onClick={() => changeStep(1)}>
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
              {mode === "days" && (
                <>
                  <div className="grid grid-cols-7 gap-1 px-1 text-xs opacity-70">
                    {"S,M,T,W,T,F,S".split(",").map((d, i) => (
                      <div key={`${d}-${i}`} className="text-center">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1 p-1">
                    {days.map((d, i) => {
                      const sel = isSelected(d);
                      const muted = !inMonth(d);
                      const ds = toLocalStr(d);
                      const hasData = !!monthMarks[ds];
                      return (
                        <Button
                          key={i}
                          variant={sel ? "default" : "ghost"}
                          size="sm"
                          className={`relative h-10 ${muted ? "opacity-50" : ""}`}
                          onClick={() => {
                            setDate(ds);
                            setView(d);
                            load(ds);
                          }}
                        >
                          {d.getDate()}
                          {hasData && <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />}
                        </Button>
                      );
                    })}
                  </div>
                </>
              )}
              {mode === "months" && (
                <div className="mt-1 grid grid-cols-3 gap-2 p-1">
                  {months.map((m) => (
                    <Button
                      key={m.idx}
                      variant={m.idx === view.getMonth() ? "default" : "ghost"}
                      onClick={() => {
                        const n = new Date(view);
                        n.setMonth(m.idx);
                        setView(n);
                        setMode("days");
                      }}
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>
              )}
              {mode === "years" && (
                <div className="mt-1 grid grid-cols-3 gap-2 p-1">
                  {years.map((y) => (
                    <Button
                      key={y}
                      variant={y === view.getFullYear() ? "default" : "ghost"}
                      onClick={() => {
                        const n = new Date(view);
                        n.setFullYear(y);
                        setView(n);
                        setMode("months");
                      }}
                    >
                      {y}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Form Fields */}
            <div>
              <div className="text-sm font-medium mb-3">Daily Record</div>
              <div className="space-y-4">
              <div className="grid gap-1 text-sm place-items-center">
                <span className="opacity-70">Hours</span>
                <NumberFlowInput
                  value={parseInt(hours) || 0}
                  onChange={(newValue) => {
                    setHours(String(newValue));
                    setDirty(true);
                  }}
                  min={0}
                  max={24}
                  size="md"
                  className="mx-auto"
                />
              </div>
              <div className="grid gap-1 text-sm">
                <span className="opacity-70">Bible Studies</span>
                <div className="flex flex-wrap gap-2">
                  {formStudies.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
                      {s}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0.5"
                        onClick={() => removeStudy(s)}
                      >
                        ×
                      </Button>
                    </span>
                  ))}
                </div>
                <Input 
                  placeholder="Type a name and press Enter" 
                  onKeyDown={(e) => { 
                    if (e.key === "Enter") { 
                      e.preventDefault(); 
                      const v = (e.target as HTMLInputElement).value; 
                      addStudy(v); 
                      (e.target as HTMLInputElement).value = ""; 
                    } 
                  }} 
                />
              </div>
              <div className="grid gap-1 text-sm">
                <span className="opacity-70">Note</span>
                <Textarea 
                  className="min-h-[112px]" 
                  value={note} 
                  onChange={(e) => { 
                    setNote(e.target.value); 
                    setDirty(true); 
                  }} 
                  placeholder="Optional note for this day" 
                />
              </div>
            </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
