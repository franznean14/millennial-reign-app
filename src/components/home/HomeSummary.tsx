"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import NumberFlow from "@number-flow/react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDateHuman } from "@/lib/utils";
import { cacheGet, cacheSet } from "@/lib/offline/store";
import { FormModal } from "@/components/shared/FormModal";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { Eye, Copy, ChevronLeft } from "lucide-react";
import { toast } from "@/components/ui/sonner";
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

async function copyTextWithFallback(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

interface HomeSummaryProps {
  userId: string;
  monthStart: string;
  nextMonthStart: string;
  serviceYearStart: string;
  serviceYearEnd: string;
  onNavigateToCongregation?: () => void;
}

export function HomeSummary({
  userId,
  monthStart,
  nextMonthStart,
  serviceYearStart,
  serviceYearEnd,
  onNavigateToCongregation,
}: HomeSummaryProps) {
  const [monthHours, setMonthHours] = useState(0);
  const [syHours, setSyHours] = useState(0);
  const [studies, setStudies] = useState<StudyCount[]>([]);
  const [localPioneer, setLocalPioneer] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [recordsDrawerOpen, setRecordsDrawerOpen] = useState(false);
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [activeServiceYear, setActiveServiceYear] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
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

  // Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    // Set initial state
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

  // Cache for householder names (from visit IDs and legacy householder IDs) — used to count unique householder names for BS
  const [householderNamesCache, setHouseholderNamesCache] = useState<Map<string, string>>(new Map());
  const cacheRef = useRef<Map<string, string>>(new Map());

  // Load householder names for ALL visit IDs and householder IDs in daily records (so table/summary BS = unique names)
  useEffect(() => {
    if (!uid || !recordsDrawerOpen) return;
    const visitIds = new Set<string>();
    const householderIds = new Set<string>();
    dailyRecords.forEach(r => {
      if (Array.isArray(r.bible_studies)) {
        r.bible_studies.forEach(bs => {
          if (bs && bs.trim()) {
            if (bs.startsWith("visit:")) {
              visitIds.add(bs.replace("visit:", ""));
            } else if (bs.startsWith("householder:")) {
              householderIds.add(bs.replace("householder:", ""));
            }
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
          const visitIdsToFetch = Array.from(visitIds).filter(id => !cacheRef.current.has(`visit:${id}`));
          if (visitIdsToFetch.length > 0) {
            const { data: visits, error: visitError } = await supabase
              .from('calls')
              .select(`
                id,
                householder_id,
                householders:calls_householder_id_fkey(id, name)
              `)
              .in('id', visitIdsToFetch);
            if (!visitError && visits) {
              visits.forEach((visit: any) => {
                if (visit.householders && visit.householders.name) {
                  newCache.set(`visit:${visit.id}`, visit.householders.name);
                }
              });
            }
          }
        }
        if (householderIds.size > 0) {
          const idsToFetch = Array.from(householderIds).filter(id => !cacheRef.current.has(`householder:${id}`));
          if (idsToFetch.length > 0) {
            const { listHouseholders } = await import("@/lib/db/business");
            const householders = await listHouseholders();
            householders.forEach(hh => {
              if (hh.id && householderIds.has(hh.id)) {
                newCache.set(`householder:${hh.id}`, hh.name);
              }
            });
          }
        }
        cacheRef.current = newCache;
        setHouseholderNamesCache(newCache);
      } catch (error) {
        console.error('Error fetching householder names:', error);
      }
    };
    if (visitIds.size > 0 || householderIds.size > 0) fetchNames();
  }, [recordsDrawerOpen, dailyRecords, uid]);

  // Aggregate daily records by month — BS = unique householder names (resolve visit/householder IDs via cache)
  const monthlyAggregates = useMemo(() => {
    const monthMap = new Map<string, {
      month: string;
      hours: number;
      uniqueBS: Set<string>;
      notes: string[];
    }>();
    const resolveToName = (key: string) => cacheRef.current.get(key) ?? key;

    dailyRecords.forEach(record => {
      const month = record.date.slice(0, 7); // YYYY-MM
      if (!monthMap.has(month)) {
        monthMap.set(month, {
          month,
          hours: 0,
          uniqueBS: new Set<string>(),
          notes: [],
        });
      }
      const agg = monthMap.get(month)!;
      agg.hours += Number(record.hours) || 0;
      if (Array.isArray(record.bible_studies)) {
        record.bible_studies.forEach(bs => {
          if (bs && bs.trim()) {
            agg.uniqueBS.add(resolveToName(bs.trim()));
          }
        });
      }
      if (record.note && record.note.trim()) {
        agg.notes.push(record.note.trim());
      }
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

  // SwipeableTableRow component
  const SwipeableTableRow = ({
    month,
    hours,
    bsCount,
    notesCount,
    formatMonth,
    fmtHours,
    onViewDetails,
    onCopy,
  }: {
    month: string;
    hours: number;
    bsCount: number;
    notesCount: number;
    formatMonth: (month: string) => string;
    fmtHours: (hours: number) => string;
    onViewDetails: () => void;
    onCopy: () => Promise<void>;
  }) => {
    const BUTTON_WIDTH = 80; // Exact width of action buttons container
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
      setIsSwiping(false);
      // Prevent table from scrolling horizontally
      e.stopPropagation();
    };

    const handleTouchMove = (e: React.TouchEvent) => {
      if (touchStartX.current === null || touchStartY.current === null) return;
      
      const deltaX = e.touches[0].clientX - touchStartX.current;
      const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);
      const absDeltaX = Math.abs(deltaX);
      
      // Only handle horizontal swipe if it's clearly horizontal (more horizontal than vertical)
      if (absDeltaX > deltaY && absDeltaX > 5) {
        setIsSwiping(true);
        e.stopPropagation();
        // Swipe left (negative deltaX) reveals actions
        // Limit swipe to exactly match button width
        const newOffset = Math.max(-BUTTON_WIDTH, Math.min(0, deltaX));
        setSwipeOffset(newOffset);
      } else if (deltaY > absDeltaX && deltaY > 10) {
        // If vertical movement is clearly dominant, reset swipe and allow table scrolling
        if (isSwiping || absDeltaX > 0) {
          setSwipeOffset(0);
          setIsSwiping(false);
          touchStartX.current = null;
          touchStartY.current = null;
        }
        // Don't prevent default - allow vertical scrolling
      }
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      
      // If swiped more than half way, snap to fully open/closed
      if (swipeOffset < -BUTTON_WIDTH / 2) {
        setSwipeOffset(-BUTTON_WIDTH);
      } else {
        setSwipeOffset(0);
      }
      
      touchStartX.current = null;
      touchStartY.current = null;
      setIsSwiping(false);
      e.stopPropagation();
    };

      return (
      <tr 
        className="border-b hover:bg-muted/30 group relative"
        style={{ 
          overflow: 'visible',
          zIndex: 1,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Table content cells - swipeable */}
        <td className="p-3 w-[30%] bg-background relative" style={{ transform: `translateX(${swipeOffset}px)`, transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <span className="font-medium">{formatMonth(month)}</span>
        </td>
        <td className="p-3 w-[20%] text-center bg-background relative" style={{ transform: `translateX(${swipeOffset}px)`, transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <span>{fmtHours(hours)}</span>
        </td>
        <td className="p-3 w-[20%] text-center bg-background relative" style={{ transform: `translateX(${swipeOffset}px)`, transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <span>{bsCount}</span>
        </td>
        <td className="p-3 w-[30%] min-w-0 text-center bg-background relative" style={{ transform: `translateX(${swipeOffset}px)`, transition: isSwiping ? 'none' : 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <span className="truncate block text-muted-foreground">
            {notesCount > 0 ? `${notesCount} note${notesCount > 1 ? 's' : ''}` : ""}
          </span>
          {/* Background action buttons (mobile) - always rendered, revealed on swipe */}
          <div 
            className="absolute top-0 right-0 h-full flex items-center justify-center gap-2 md:hidden"
            style={{ 
              width: `${BUTTON_WIDTH}px`,
              height: '100%',
              right: `${swipeOffset}px`,
              transition: isSwiping ? 'none' : 'right 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: Math.abs(swipeOffset) > 10 ? 1 : 0,
              zIndex: 10,
              backgroundColor: 'hsl(var(--muted))',
              padding: '0 8px',
              display: 'flex',
              pointerEvents: swipeOffset < -BUTTON_WIDTH / 2 ? 'auto' : 'none',
            }}
          >
            <button
              type="button"
              className="h-9 w-9 p-0 flex items-center justify-center rounded-md bg-background border border-border hover:bg-accent hover:text-accent-foreground active:bg-accent/80 text-foreground shadow-sm flex-shrink-0"
              style={{ 
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                pointerEvents: 'auto',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails();
                setSwipeOffset(0);
              }}
              title="View details"
            >
              <Eye className="h-4 w-4 text-foreground" />
            </button>
            <button
              type="button"
              className="h-9 w-9 p-0 flex items-center justify-center rounded-md bg-background border border-border hover:bg-accent hover:text-accent-foreground active:bg-accent/80 text-foreground shadow-sm flex-shrink-0"
              style={{ 
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                pointerEvents: 'auto',
              }}
              onClick={async (e) => {
                e.stopPropagation();
                await onCopy();
                setSwipeOffset(0);
              }}
              title="Copy to clipboard"
            >
              <Copy className="h-4 w-4 text-foreground" />
            </button>
          </div>
        </td>
        {/* Desktop: always visible on hover */}
        <td className="p-3 w-auto hidden md:table-cell bg-background z-10">
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              className="h-8 w-8 p-0 flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails();
              }}
              title="View details"
            >
              <Eye className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="h-8 w-8 p-0 flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
              onClick={async (e) => {
                e.stopPropagation();
                await onCopy();
              }}
              title="Copy to clipboard"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
      );
  };

  // Format month for display (short format: "Jan '26")
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const monthShort = date.toLocaleDateString('en-US', { month: 'short' });
    const yearShort = `'${year.slice(-2)}`;
    return `${monthShort} ${yearShort}`;
  };

  // Format full month and year for display (full format: "January 2026")
  const formatFullMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    const monthFull = date.toLocaleDateString('en-US', { month: 'long' });
    return `${monthFull} ${year}`;
  };

  // Get month detail data
  const monthDetailData = useMemo(() => {
    if (!selectedMonth) return null;
    
    const monthRecords = dailyRecords.filter(r => r.date.startsWith(selectedMonth));
    const totalHours = monthRecords.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
    
    // Collect Bible Study names with session counts
    const bsSessionCounts = new Map<string, number>();
    monthRecords.forEach(r => {
      if (Array.isArray(r.bible_studies)) {
        r.bible_studies.forEach(bs => {
          if (bs && bs.trim()) {
            const trimmedBS = bs.trim();
            bsSessionCounts.set(trimmedBS, (bsSessionCounts.get(trimmedBS) || 0) + 1);
          }
        });
      }
    });
    
    // Convert to array of {name, sessions} and resolve visit IDs and householder IDs to names
    const bibleStudies = Array.from(bsSessionCounts.entries())
      .map(([nameOrId, sessions]) => {
        // Check if it's a visit ID (new format)
        if (nameOrId.startsWith("visit:")) {
          const resolvedName = cacheRef.current.get(nameOrId) || nameOrId;
          return { name: resolvedName, sessions, id: null };
        }
        // Check if it's a householder ID (legacy format)
        else if (nameOrId.startsWith("householder:")) {
          const resolvedName = cacheRef.current.get(nameOrId) || nameOrId;
          return { name: resolvedName, sessions, id: null };
        }
        // Plain text name
        return { name: nameOrId, sessions, id: null };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    
    // Collect notes with dates
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
      bibleStudies,
      notes,
    };
  }, [selectedMonth, dailyRecords, householderNamesCache]);

  // Copy month data to clipboard
  const copyMonthToClipboard = async (month: string) => {
    const monthRecords = dailyRecords.filter(r => r.date.startsWith(month));
    const totalHours = monthRecords.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
    
    // Collect unique Bible Study names (resolved from visit IDs or householder IDs)
    const uniqueBS = new Set<string>();
    monthRecords.forEach(r => {
      if (Array.isArray(r.bible_studies)) {
        r.bible_studies.forEach(bs => {
          if (bs && bs.trim()) {
            // Resolve visit ID or householder ID to name
            const resolvedName = cacheRef.current.get(bs.trim()) || bs.trim();
            uniqueBS.add(resolvedName);
          }
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
    
    const bsCount = uniqueBS.size;
    const lines = [
      formatFullMonth(month),
      `Hours: ${fmtHours(totalHours)}`,
      `Bible Studie${bsCount !== 1 ? 's' : ''}: ${bsCount}`,
      '',
      'Notes:',
      ...notes.map(n => {
        const date = new Date(n.date);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `${dateStr}: ${n.note}`;
      }),
    ];
    
    const text = lines.join('\n');
    const copied = await copyTextWithFallback(text);
    if (copied) {
      toast.success('Copied to clipboard');
    } else {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Calculate service year totals — BS = unique householder names (resolve visit/householder IDs via cache)
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
          if (record.note && record.note.trim()) {
            totalNotes++;
          }
          if (Array.isArray(record.bible_studies)) {
            record.bible_studies.forEach(bs => {
              if (bs && bs.trim()) {
                allUniqueBS.add(resolveToName(bs.trim()));
              }
            });
          }
        }
      });
    }
    return {
      totalHours,
      totalBS: allUniqueBS.size,
      totalNotes,
    };
  }, [filteredRecords, dailyRecords, activeServiceYear, householderNamesCache]);

  return (
    <>
      <section>
        <h2 className="text-lg font-semibold mb-3">This Month</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {/* Combined hours card */}
          <div 
            className="sm:col-span-3 rounded-lg border p-6 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setRecordsDrawerOpen(true)}
          >
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
          </div>

        </div>
      </section>

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
                    {selectedMonth ? (
                      <div className="flex items-center gap-1 w-full h-12">
                        {/* Back Button - Left */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedMonth(null)}
                          className="flex-shrink-0 px-3 h-12 flex items-center justify-center transition-colors hover:bg-muted"
                        >
                          <ChevronLeft className="h-4 w-4 flex-shrink-0" />
                        </Button>
                        
                        {/* Month and Year - Middle (wider, plain text, no button feel) */}
                        <div className="flex-[2] min-w-0 px-3 h-12 flex items-center justify-center bg-transparent border-none">
                          <span className="text-sm font-semibold text-foreground truncate w-full text-center pointer-events-none">
                            {formatFullMonth(selectedMonth)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <ToggleGroup
                        type="single"
                        value={activeServiceYear ? String(activeServiceYear) : undefined}
                        onValueChange={(v) => {
                          if (v) {
                            setActiveServiceYear(v);
                            setSelectedMonth(null);
                          }
                        }}
                        className="w-max min-w-full h-full justify-center"
                      >
                        {serviceYears.map((year) => (
                          <ToggleGroupItem
                            key={year}
                            value={String(year)}
                            className="data-[state=on]:!bg-primary data-[state=on]:!text-primary-foreground data-[state=on]:shadow-sm min-w-0 px-3 h-12 flex items-center justify-center transition-colors"
                            title={String(year)}
                          >
                            <span className="text-[11px] font-medium text-center truncate w-full">{year}</span>
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    )}
                  </div>
                </div>
              </div>

              {selectedMonth && monthDetailData ? (
                /* Detail View */
                <div className="space-y-4 pb-6">
                  {/* Hours Summary */}
                  <div className="rounded-lg border p-4 bg-muted/30">
                    <div className="text-center">
                      <div className="text-3xl font-semibold">{fmtHours(monthDetailData.totalHours)}</div>
                      <div className="text-sm text-muted-foreground mt-1">Hours</div>
                    </div>
                  </div>

                  {/* Bible Studies Table */}
                  {monthDetailData.bibleStudies && monthDetailData.bibleStudies.length > 0 ? (
                    <div className="rounded-lg border">
                      <div className="px-4 py-3 border-b bg-muted/30">
                        <h3 className="text-sm font-semibold">Bible Studies</h3>
                      </div>
                      <div className="max-h-[200px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <tbody>
                            {monthDetailData.bibleStudies.map((bs, idx) => (
                              <tr key={idx} className="border-b last:border-b-0">
                                <td className="p-3">{bs.name}</td>
                                <td className="p-3 text-right text-muted-foreground">{bs.sessions} session{bs.sessions !== 1 ? 's' : ''}</td>
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
            <div className="w-full h-[calc(70vh)] overflow-y-auto overflow-x-visible flex flex-col overscroll-none">
            {/* Fixed Table Header */}
            <div className="flex-shrink-0 border-b bg-background">
              <table className="w-full text-sm table-fixed" style={{ touchAction: 'none' }}>
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
                className="flex-1 overflow-y-auto overflow-x-hidden no-scrollbar overscroll-none"
                style={{ 
                  overscrollBehavior: "contain",
                  touchAction: 'pan-y', // Only allow vertical panning
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <table className="w-full text-sm table-fixed" style={{ touchAction: 'none', position: 'relative' }}>
                  <tbody style={{ position: 'relative' }}>
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
                      filteredRecords.map((agg) => {
                        const rowKey = `row-${agg.month}`;
                        return (
                          <SwipeableTableRow
                            key={rowKey}
                            month={agg.month}
                            hours={agg.hours}
                            bsCount={agg.bsCount}
                            notesCount={agg.notes.length}
                            formatMonth={formatMonth}
                            fmtHours={fmtHours}
                            onViewDetails={() => setSelectedMonth(agg.month)}
                            onCopy={() => copyMonthToClipboard(agg.month)}
                          />
                        );
                      })
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
