"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import NumberFlow from "@number-flow/react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDateHuman } from "@/lib/utils";
import { cacheGet, cacheSet } from "@/lib/offline/store";
import { Plus, ChevronLeft, ChevronRight, Eye, Copy } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDailyRecord, listDailyByMonth, upsertDailyRecord, isDailyEmpty, deleteDailyRecord } from "@/lib/db/dailyRecords";
import { NumberFlowInput } from "@/components/ui/number-flow-input";
import { FormModal } from "@/components/shared/FormModal";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DailyRecord } from "@/lib/db/types";

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
  const [dataLoaded, setDataLoaded] = useState(false);
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
  const [recordsDrawerOpen, setRecordsDrawerOpen] = useState(false);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [activeServiceYear, setActiveServiceYear] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

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
      setDataLoaded(true);
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
      setDataLoaded(true);
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
      setDataLoaded(false);
    }
  }, [uid]);

  // Load daily records when drawer opens
  useEffect(() => {
    if (!recordsDrawerOpen || !uid) return;
    
    const loadRecords = async () => {
      setRecordsLoading(true);
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.getSession();
        // Fetch all daily records for the user
        const { data, error } = await supabase
          .from("daily_records")
          .select("id, user_id, date, hours, bible_studies, note")
          .eq("user_id", uid)
          .order("date", { ascending: false });
        
        if (error) throw error;
        setDailyRecords((data ?? []) as DailyRecord[]);
      } catch (error) {
        console.error("Error loading daily records:", error);
        setDailyRecords([]);
      } finally {
        setRecordsLoading(false);
      }
    };
    
    loadRecords();
  }, [recordsDrawerOpen, uid]);

  // Cache for householder names (visit/householder IDs → name) so BS = unique householder names
  const [householderNamesCache, setHouseholderNamesCache] = useState<Map<string, string>>(new Map());
  const cacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!uid || !recordsDrawerOpen) return;
    const visitIds = new Set<string>();
    const householderIds = new Set<string>();
    dailyRecords.forEach(r => {
      if (Array.isArray(r.bible_studies)) {
        r.bible_studies.forEach(bs => {
          if (bs && bs.trim()) {
            if (bs.startsWith("visit:")) visitIds.add(bs.replace("visit:", ""));
            else if (bs.startsWith("householder:")) householderIds.add(bs.replace("householder:", ""));
          }
        });
      }
    });
    const fetchNames = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.getSession();
        const newCache = new Map(cacheRef.current);
        if (visitIds.size > 0) {
          const toFetch = Array.from(visitIds).filter(id => !cacheRef.current.has(`visit:${id}`));
          if (toFetch.length > 0) {
            const { data: visits } = await supabase
              .from("calls")
              .select("id, householders:calls_householder_id_fkey(id, name)")
              .in("id", toFetch);
            (visits ?? []).forEach((v: any) => {
              if (v.householders?.name) newCache.set(`visit:${v.id}`, v.householders.name);
            });
          }
        }
        if (householderIds.size > 0) {
          const toFetch = Array.from(householderIds).filter(id => !cacheRef.current.has(`householder:${id}`));
          if (toFetch.length > 0) {
            const { listHouseholders } = await import("@/lib/db/business");
            const householders = await listHouseholders();
            householders.forEach(hh => {
              if (hh.id && householderIds.has(hh.id)) newCache.set(`householder:${hh.id}`, hh.name);
            });
          }
        }
        cacheRef.current = newCache;
        setHouseholderNamesCache(newCache);
      } catch (e) {
        console.error("Error fetching householder names:", e);
      }
    };
    if (visitIds.size > 0 || householderIds.size > 0) fetchNames();
  }, [recordsDrawerOpen, dailyRecords, uid]);

  // Aggregate daily records by month — BS = unique householder names
  const monthlyAggregates = useMemo(() => {
    const resolveToName = (key: string) => cacheRef.current.get(key) ?? key;
    const monthMap = new Map<string, {
      month: string;
      hours: number;
      uniqueBS: Set<string>;
      notes: string[];
    }>();
    dailyRecords.forEach(record => {
      const month = record.date.slice(0, 7);
      if (!monthMap.has(month)) {
        monthMap.set(month, { month, hours: 0, uniqueBS: new Set<string>(), notes: [] });
      }
      const agg = monthMap.get(month)!;
      agg.hours += Number(record.hours) || 0;
      if (Array.isArray(record.bible_studies)) {
        record.bible_studies.forEach(bs => {
          if (bs && bs.trim()) agg.uniqueBS.add(resolveToName(bs.trim()));
        });
      }
      if (record.note && record.note.trim()) agg.notes.push(record.note.trim());
    });
    return Array.from(monthMap.values()).map(agg => ({
      month: agg.month,
      hours: agg.hours,
      bsCount: agg.uniqueBS.size,
      notes: agg.notes,
    }));
  }, [dailyRecords, householderNamesCache]);

  // Get service years from records (September to August)
  const serviceYears = useMemo(() => {
    const years = new Set<number>();
    monthlyAggregates.forEach(agg => {
      const [year, month] = agg.month.split('-').map(Number);
      // Service year is the year that contains September
      // If month is Sep-Dec, service year is that year
      // If month is Jan-Aug, service year is previous year
      const serviceYear = month >= 9 ? year : year - 1;
      years.add(serviceYear);
    });
    return Array.from(years).sort((a, b) => b - a); // Most recent first
  }, [monthlyAggregates]);

  // Set initial active service year
  useEffect(() => {
    if (serviceYears.length > 0 && activeServiceYear === null) {
      setActiveServiceYear(String(serviceYears[0]));
    }
  }, [serviceYears, activeServiceYear]);

  // Filter records by active service year
  const filteredRecords = useMemo(() => {
    if (activeServiceYear === null) return [];
    const year = parseInt(activeServiceYear);
    return monthlyAggregates.filter(agg => {
      const [recordYear, recordMonth] = agg.month.split('-').map(Number);
      const recordServiceYear = recordMonth >= 9 ? recordYear : recordYear - 1;
      return recordServiceYear === year;
    }).sort((a, b) => {
      // Sort by month descending (most recent first)
      return b.month.localeCompare(a.month);
    });
  }, [monthlyAggregates, activeServiceYear]);

  // Format month for display
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const monthShort = date.toLocaleDateString('en-US', { month: 'short' });
    const yearShort = `'${year.slice(-2)}`;
    return `${monthShort} ${yearShort}`;
  };

  // Get month detail data — BS displayed as unique householder names
  const monthDetailData = useMemo(() => {
    if (!selectedMonth) return null;
    const resolveToName = (key: string) => cacheRef.current.get(key) ?? key;
    const monthRecords = dailyRecords.filter(r => r.date.startsWith(selectedMonth));
    const totalHours = monthRecords.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
    const uniqueBS = new Set<string>();
    monthRecords.forEach(r => {
      if (Array.isArray(r.bible_studies)) {
        r.bible_studies.forEach(bs => {
          if (bs && bs.trim()) uniqueBS.add(resolveToName(bs.trim()));
        });
      }
    });
    const notes = monthRecords
      .filter(r => r.note && r.note.trim())
      .map(r => ({
        date: r.date,
        note: r.note!.trim(),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
    
    return {
      month: selectedMonth,
      totalHours,
      bibleStudies: Array.from(uniqueBS).sort(),
      notes,
    };
  }, [selectedMonth, dailyRecords, householderNamesCache]);

  // Copy month data to clipboard — BS = unique householder names
  const copyMonthToClipboard = async (month: string) => {
    const resolveToName = (key: string) => cacheRef.current.get(key) ?? key;
    const monthRecords = dailyRecords.filter(r => r.date.startsWith(month));
    const totalHours = monthRecords.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
    const uniqueBS = new Set<string>();
    monthRecords.forEach(r => {
      if (Array.isArray(r.bible_studies)) {
        r.bible_studies.forEach(bs => {
          if (bs && bs.trim()) uniqueBS.add(resolveToName(bs.trim()));
        });
      }
    });
    
    // Collect notes with dates
    const notes = monthRecords
      .filter(r => r.note && r.note.trim())
      .map(r => ({
        date: r.date,
        note: r.note!.trim(),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
    
    const lines = [
      `Month: ${formatMonth(month)}`,
      `Hours: ${fmtHours(totalHours)}`,
      '',
      'Bible Studies:',
      ...Array.from(uniqueBS).sort().map(bs => `- ${bs}`),
      '',
      'Notes:',
      ...notes.map(n => {
        const date = new Date(n.date);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `${dateStr}: ${n.note}`;
      }),
    ];
    
    const text = lines.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Calculate service year totals — BS = unique householder names
  const serviceYearTotals = useMemo(() => {
    if (filteredRecords.length === 0) {
      return { totalHours: 0, totalBS: 0, totalNotes: 0 };
    }
    const resolveToName = (key: string) => cacheRef.current.get(key) ?? key;
    const allUniqueBS = new Set<string>();
    let totalHours = 0;
    let totalNotes = 0;
    const year = activeServiceYear ? parseInt(activeServiceYear) : null;
    if (year) {
      dailyRecords.forEach(record => {
        const [recordYear, recordMonth] = record.date.slice(0, 7).split('-').map(Number);
        const recordServiceYear = recordMonth >= 9 ? recordYear : recordYear - 1;
        if (recordServiceYear === year) {
          totalHours += Number(record.hours) || 0;
          if (record.note && record.note.trim()) totalNotes++;
          if (Array.isArray(record.bible_studies)) {
            record.bible_studies.forEach(bs => {
              if (bs && bs.trim()) allUniqueBS.add(resolveToName(bs.trim()));
            });
          }
        }
      });
    }
    return { totalHours, totalBS: allUniqueBS.size, totalNotes };
  }, [filteredRecords, dailyRecords, activeServiceYear, householderNamesCache]);

  return (
    <>
      <div className="w-1/3">
        <Card 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setRecordsDrawerOpen(true)}
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
                    <NumberFlow key={`sy-hours-${dataLoaded}`} value={syHours} locales="en-US" format={{ useGrouping: false }} />
                  </div>
                  <div className="text-xs opacity-70 mt-1">Since {(() => {
                    if (!serviceYearStart) return "—";
                    const parts = serviceYearStart.split("-");
                    if (parts.length >= 2) {
                      const [y, m] = parts;
                      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                      const monthIndex = parseInt(m, 10) - 1;
                      return `${monthNames[monthIndex] || m} ${y}`;
                    }
                    return formatDateHuman(serviceYearStart, timeZone || undefined);
                  })()}</div>
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

      <FormModal
        open={recordsDrawerOpen}
        onOpenChange={setRecordsDrawerOpen}
        title="Monthly Records"
      >
        <div className="space-y-4">
          {serviceYears.length > 0 ? (
            <>
              <div className="flex justify-center">
                <div className="bg-background/95 backdrop-blur-sm border p-0.1 rounded-lg shadow-lg w-full max-w-screen-sm relative overflow-hidden">
                  <div className="w-full overflow-x-auto no-scrollbar">
                    <ToggleGroup
                      type="single"
                      value={selectedMonth ? "back" : (activeServiceYear ?? undefined)}
                      onValueChange={(v) => {
                        if (v === "back") {
                          setSelectedMonth(null);
                        } else if (v) {
                          setActiveServiceYear(v);
                          setSelectedMonth(null);
                        }
                      }}
                      className="w-max min-w-full h-full justify-center"
                    >
                      {selectedMonth ? (
                        <>
                          <ToggleGroupItem
                            value="back"
                            className="data-[state=on]:!bg-primary data-[state=on]:!text-primary-foreground data-[state=on]:shadow-sm min-w-0 px-3 h-12 flex items-center justify-center transition-colors"
                          >
                            <ChevronLeft className="h-4 w-4 mr-2" />
                            <span className="text-[11px] font-medium">{formatMonth(selectedMonth)}</span>
                          </ToggleGroupItem>
                        </>
                      ) : (
                        serviceYears.map((year) => (
                          <ToggleGroupItem
                            key={year}
                            value={String(year)}
                            className="data-[state=on]:!bg-primary data-[state=on]:!text-primary-foreground data-[state=on]:shadow-sm min-w-0 px-3 h-12 flex items-center justify-center transition-colors"
                            title={String(year)}
                          >
                            <span className="text-[11px] font-medium text-center truncate w-full">{year}</span>
                          </ToggleGroupItem>
                        ))
                      )}
                    </ToggleGroup>
                  </div>
                </div>
              </div>

              {selectedMonth && monthDetailData ? (
                /* Detail View */
                <div className="space-y-4">
                  {/* Hours Summary */}
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <div className="text-center">
                      <div className="text-3xl font-semibold">{fmtHours(monthDetailData.totalHours)}</div>
                      <div className="text-sm text-muted-foreground mt-1">Hours</div>
                    </div>
                  </div>

                  {/* Bible Studies Table */}
                  {monthDetailData.bibleStudies.length > 0 ? (
                    <div className="rounded-lg border">
                      <div className="px-4 py-3 border-b bg-muted/30">
                        <h3 className="text-sm font-semibold">Bible Studies</h3>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <tbody>
                            {monthDetailData.bibleStudies.map((bs, idx) => (
                              <tr key={idx} className="border-b last:border-b-0">
                                <td className="p-3">{bs}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
                      No Bible Studies
                    </div>
                  )}

                  {/* Notes Table */}
                  {monthDetailData.notes.length > 0 ? (
                    <div className="rounded-lg border">
                      <div className="px-4 py-3 border-b bg-muted/30">
                        <h3 className="text-sm font-semibold">Notes</h3>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-3 w-[30%]">Date</th>
                              <th className="text-left py-2 px-3 w-[70%]">Note</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthDetailData.notes.map((note, idx) => {
                              const date = new Date(note.date);
                              const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                              return (
                                <tr key={idx} className="border-b last:border-b-0">
                                  <td className="p-3 text-muted-foreground">{dateStr}</td>
                                  <td className="p-3">{note.note}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
                      No Notes
                    </div>
                  )}
                </div>
              ) : (
                /* List View */
                <>
                  {/* Summary Section */}
                  {activeServiceYear && (
                    <div className="rounded-lg border p-4 bg-muted/30">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-semibold">{fmtHours(serviceYearTotals.totalHours)}</div>
                          <div className="text-xs text-muted-foreground mt-1">Hours</div>
                        </div>
                        <div>
                          <div className="text-2xl font-semibold">{serviceYearTotals.totalBS}</div>
                          <div className="text-xs text-muted-foreground mt-1">BS</div>
                        </div>
                        <div>
                          <div className="text-2xl font-semibold">{serviceYearTotals.totalNotes}</div>
                          <div className="text-xs text-muted-foreground mt-1">Notes</div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="text-center py-4 text-sm text-muted-foreground">
              No records found
            </div>
          )}

          {!selectedMonth && (
            <div className="w-full h-[calc(70vh)] overflow-hidden flex flex-col overscroll-none">
              {/* Fixed Table Header */}
              <div className="flex-shrink-0 border-b bg-background">
                <table className="w-full text-sm table-fixed">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-3 w-[30%]">Month</th>
                      <th className="text-center py-3 px-3 w-[20%]">Hours</th>
                      <th className="text-center py-3 px-3 w-[20%]">BS</th>
                      <th className="text-center py-3 px-3 w-[30%]">Notes</th>
                      <th className="w-auto"></th>
                    </tr>
                  </thead>
                </table>
              </div>

              {/* Scrollable Table Body */}
              <div
                className="flex-1 overflow-y-auto no-scrollbar overscroll-none"
                style={{ overscrollBehavior: "contain", touchAction: "pan-y" }}
                onClick={(e) => e.stopPropagation()}
              >
                <table className="w-full text-sm table-fixed">
                  <tbody>
                    {recordsLoading ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                          Loading...
                        </td>
                      </tr>
                    ) : filteredRecords.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-sm text-muted-foreground">
                          No records found
                        </td>
                      </tr>
                    ) : (
                      filteredRecords.map((agg) => (
                        <tr key={agg.month} className="border-b hover:bg-muted/30 group">
                          <td className="p-3 w-[30%]">
                            <span className="font-medium">{formatMonth(agg.month)}</span>
                          </td>
                          <td className="p-3 w-[20%] text-center">
                            <span>{fmtHours(agg.hours)}</span>
                          </td>
                          <td className="p-3 w-[20%] text-center">
                            <span>{agg.bsCount}</span>
                          </td>
                          <td className="p-3 w-[30%] min-w-0 text-center">
                            <span className="truncate block text-muted-foreground">
                              {agg.notes.length > 0 ? `${agg.notes.length} note${agg.notes.length > 1 ? 's' : ''}` : ""}
                            </span>
                          </td>
                          <td className="p-3 w-auto" style={{ pointerEvents: 'auto', position: 'relative', zIndex: 10002 }}>
                            <div className="flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
                              <button
                                type="button"
                                className="h-8 w-8 p-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground active:bg-accent/80"
                                style={{ 
                                  touchAction: 'manipulation', 
                                  zIndex: 10002, 
                                  position: 'relative',
                                  pointerEvents: 'auto',
                                  WebkitTapHighlightColor: 'transparent'
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setSelectedMonth(agg.month);
                                }}
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setSelectedMonth(agg.month);
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setSelectedMonth(agg.month);
                                }}
                                title="View details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                className="h-8 w-8 p-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground active:bg-accent/80"
                                style={{ 
                                  touchAction: 'manipulation', 
                                  zIndex: 10002, 
                                  position: 'relative',
                                  pointerEvents: 'auto',
                                  WebkitTapHighlightColor: 'transparent'
                                }}
                                onTouchStart={async (e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  await copyMonthToClipboard(agg.month);
                                }}
                                onMouseDown={async (e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  await copyMonthToClipboard(agg.month);
                                }}
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  await copyMonthToClipboard(agg.month);
                                }}
                                title="Copy to clipboard"
                              >
                                <Copy className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </FormModal>
    </>
  );
}
