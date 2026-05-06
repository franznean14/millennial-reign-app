"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { List, LayoutGrid, Table as TableIcon, Filter, User, UserCheck, X, Building2, ChevronUp, ChevronDown } from "lucide-react";
import { type HouseholderWithDetails, type BusinessFiltersState } from "@/lib/db/business";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { useListViewMode } from "@/lib/hooks/use-list-view-mode";
import { useInfiniteList } from "@/lib/hooks/use-infinite-list";
import {
  usePersistedTableSort,
  type TableSortDir,
} from "@/lib/hooks/use-persisted-table-sort";
import { formatHouseholderStatusCompactText, formatStatusText } from "@/lib/utils/formatters";
import { getStudyBibleDarkCardFade, getStudyBibleDarkCardShade, studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";
import { getStatusTitleColor } from "@/lib/utils/status-hierarchy";

interface HouseholderListProps {
  householders: HouseholderWithDetails[];
  onHouseholderClick: (householder: HouseholderWithDetails) => void;
  onHouseholderDelete?: (householder: HouseholderWithDetails) => void;
  onHouseholderArchive?: (householder: HouseholderWithDetails) => void;
  myHouseholdersOnly?: boolean;
  onMyHouseholdersChange?: (checked: boolean) => void;
  onOpenFilters?: () => void;
  filters?: BusinessFiltersState;
  onClearAllFilters?: () => void;
  onClearSearch?: () => void;
  onRemoveStatus?: (status: string) => void;
  onRemoveArea?: (area: string) => void;
  onRemoveFloor?: (floor: string) => void;
  viewMode?: 'detailed' | 'compact' | 'table';
  onViewModeChange?: (viewMode: 'detailed' | 'compact' | 'table') => void;
}

type ViewMode = 'detailed' | 'compact' | 'table';

const HOUSEHOLDER_DETAILED_COLUMN_ORDER = [
  "bible_study",
  "return_visit",
  "interested",
  "potential",
  "do_not_call",
  "moved_branch",
  "resigned",
];

type HhTableSortKey = "name" | "status" | "establishment" | "last_call" | "calls";

const HH_TABLE_SORT_KEYS: readonly HhTableSortKey[] = [
  "name",
  "status",
  "establishment",
  "last_call",
  "calls",
];

const HH_TABLE_DEFAULT_DIRS: Record<HhTableSortKey, TableSortDir> = {
  name: "asc",
  status: "asc",
  establishment: "asc",
  last_call: "desc",
  calls: "desc",
};

function NameWithAvatarsCell({
  name,
  visitors
}: {
  name: string;
  visitors?: Array<{ user_id?: string; avatar_url?: string; first_name?: string; last_name?: string }>;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="truncate flex-1 min-w-0" title={name}>
        {name}
      </div>
      {visitors && visitors.length > 0 && (
        <div className="flex items-center flex-shrink-0">
          {visitors.slice(0, 3).map((visitor, i) => (
            <Avatar key={visitor.user_id || i} className={`h-5 w-5 ring-1 ring-background ${i > 0 ? '-ml-2' : ''}`}>
              <AvatarImage src={visitor.avatar_url} />
              <AvatarFallback className="text-xs">
                {`${visitor.first_name ?? ''} ${visitor.last_name ?? ''}`.trim().charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
          ))}
          {visitors.length > 3 && (
            <span className="text-xs text-muted-foreground ml-2">+{visitors.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}

function EstablishmentNameCell({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-1 min-w-0 w-full">
      <Building2 className="h-3 w-3 flex-shrink-0" />
      <div className="truncate flex-1 min-w-0" title={name}>
        {name}
      </div>
    </div>
  );
}

function formatTableDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function HouseholderTableSortTh({
  label,
  sortKey,
  sort,
  onToggle,
  className,
}: {
  label: string;
  sortKey: HhTableSortKey;
  sort: { column: HhTableSortKey; dir: TableSortDir };
  onToggle: (k: HhTableSortKey) => void;
  className?: string;
}) {
  const active = sort.column === sortKey;
  return (
    <th
      scope="col"
      className={className}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle(sortKey);
        }}
        className={cn(
          "inline-flex min-h-11 w-full min-w-0 items-center gap-0.5 py-3 pl-3 pr-1 text-left font-medium touch-manipulation",
          "rounded-md hover:bg-muted/25 active:bg-muted/40 dark:hover:bg-[#3b3348]/60 dark:active:bg-[#3b3348]",
          active && "text-foreground dark:text-[#fffaff]"
        )}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="flex shrink-0 flex-col leading-none" aria-hidden="true">
          <ChevronUp
            className={cn(
              "h-2.5 w-2.5",
              active && sort.dir === "asc" ? "text-[#80778e]" : "opacity-30"
            )}
          />
          <ChevronDown
            className={cn(
              "-mt-0.5 h-2.5 w-2.5",
              active && sort.dir === "desc" ? "text-[#80778e]" : "opacity-30"
            )}
          />
        </span>
      </button>
    </th>
  );
}

export function HouseholderList({ 
  householders, 
  onHouseholderClick,
  onHouseholderDelete,
  onHouseholderArchive,
  myHouseholdersOnly,
  onMyHouseholdersChange,
  onOpenFilters,
  filters,
  onClearAllFilters,
  onClearSearch,
  onRemoveStatus,
  onRemoveArea,
  viewMode: externalViewMode,
  onViewModeChange
}: HouseholderListProps) {
  
  // Reset scroll position to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const { viewMode } = useListViewMode<ViewMode>({
    defaultViewMode: "detailed",
    externalViewMode,
    onViewModeChange,
    storageKey: "householder-view-mode",
    allowedModes: ["detailed", "compact", "table"],
    cycleOrder: ["detailed", "compact", "table"],
  });

  const { sort: householderTableSort, toggleColumn: toggleHouseholderTableSort } =
    usePersistedTableSort<HhTableSortKey>({
      storageKey: "bwi-householder-table-sort",
      allowedColumns: HH_TABLE_SORT_KEYS,
      defaultColumn: "name",
      defaultDirs: HH_TABLE_DEFAULT_DIRS,
    });

  const tableBodyScrollRef = useRef<HTMLDivElement>(null);

  // Prevent page scrolling when in table view
  useEffect(() => {
    if (viewMode === 'table') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [viewMode]);

  const hasActiveFilters = !!filters && (
    !!filters.search || (filters.statuses?.length ?? 0) > 0 || (filters.areas?.length ?? 0) > 0 || !!filters.myEstablishments
  );

  const formatStatusCompactText = formatHouseholderStatusCompactText;

  const truncateHouseholderName = (name: string, maxLength: number = 20) => {
    return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
  };

  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'do_not_call':
        return 'bg-red-500';
      case 'interested':
        return 'bg-blue-500';
      case 'return_visit':
        return 'bg-orange-500';
      case 'bible_study':
        return 'bg-emerald-500';
      case 'moved_branch':
      case 'resigned':
        return 'bg-stone-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusTextColorClass = (status: string) => {
    switch (status) {
      case 'potential':
        return 'text-cyan-600 border-cyan-200 bg-cyan-50 dark:text-cyan-400 dark:border-cyan-800 dark:bg-cyan-950';
      case 'do_not_call':
        return 'text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950';
      case 'interested':
        return 'text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-950';
      case 'return_visit':
        return 'text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:bg-orange-950';
      case 'bible_study':
        return 'text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950';
      case 'moved_branch':
      case 'resigned':
        return 'text-stone-600 border-stone-200 bg-stone-50 dark:text-stone-400 dark:border-stone-700 dark:bg-stone-950';
      default:
        return 'text-gray-600 border-gray-200 bg-gray-50 dark:text-gray-400 dark:border-gray-800 dark:bg-gray-950';
    }
  };

  const getHouseholderCallTotal = (householder: HouseholderWithDetails) =>
    householder.visit_count ?? 0;

  const sortedHouseholdersForTable = useMemo(() => {
    if (viewMode !== "table") return householders;
    const { column, dir } = householderTableSort;
    const mult = dir === "asc" ? 1 : -1;
    const list = [...householders];

    const cmpStr = (a: string, b: string) =>
      mult * a.localeCompare(b, undefined, { sensitivity: "base" });
    const cmpNum = (a: number, b: number) =>
      mult * (a === b ? 0 : a < b ? -1 : 1);

    const cmpVisitDateStr = (
      a: string | null | undefined,
      b: string | null | undefined
    ) => {
      const av = (a ?? "").trim();
      const bv = (b ?? "").trim();
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return mult * av.localeCompare(bv);
    };

    list.sort((ha, hb) => {
      let cmp = 0;
      switch (column) {
        case "name":
          cmp = cmpStr((ha.name || "").toLowerCase(), (hb.name || "").toLowerCase());
          break;
        case "status":
          cmp = cmpStr(
            formatStatusCompactText(ha.status).toLowerCase(),
            formatStatusCompactText(hb.status).toLowerCase()
          );
          break;
        case "establishment":
          cmp = cmpStr(
            (ha.establishment_name || "").toLowerCase(),
            (hb.establishment_name || "").toLowerCase()
          );
          break;
        case "last_call":
          cmp = cmpVisitDateStr(ha.last_visit_at, hb.last_visit_at);
          break;
        case "calls":
          cmp = cmpNum(getHouseholderCallTotal(ha), getHouseholderCallTotal(hb));
          break;
        default:
          cmp = 0;
      }
      if (cmp !== 0) return cmp;
      return (ha.name || "").localeCompare(hb.name || "", undefined, {
        sensitivity: "base",
      });
    });
    return list;
  }, [viewMode, householders, householderTableSort, formatStatusCompactText]);

  const householdersForSlice = sortedHouseholdersForTable;

  const { visibleCount, sentinelRef } = useInfiniteList({
    itemsLength: householdersForSlice.length,
    viewMode,
    initialCounts: { detailed: 7, compact: 10, table: 40 },
    stepCounts: { detailed: 5, compact: 10, table: 40 },
  });

  const visibleHouseholders = useMemo(
    () => householdersForSlice.slice(0, visibleCount),
    [householdersForSlice, visibleCount]
  );

  useEffect(() => {
    if (viewMode !== "table") return;
    tableBodyScrollRef.current?.scrollTo({ top: 0 });
  }, [viewMode, householderTableSort.column, householderTableSort.dir]);

  const detailedStatusColumns = useMemo(() => {
    const statuses = Array.from(new Set(householders.map((householder) => householder.status || "potential")));
    statuses.sort((a, b) => {
      const aIndex = HOUSEHOLDER_DETAILED_COLUMN_ORDER.indexOf(a);
      const bIndex = HOUSEHOLDER_DETAILED_COLUMN_ORDER.indexOf(b);
      const normalizedA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
      const normalizedB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
      return normalizedA - normalizedB || a.localeCompare(b);
    });
    return statuses;
  }, [householders]);

  const renderDetailedView = (householder: HouseholderWithDetails, index: number) => (
    <motion.div
      key={householder.id}
      initial={{ opacity: 0, filter: "blur(6px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="w-full max-w-full min-w-0 overflow-hidden md:max-w-none md:overflow-visible"
    >
      <Card
        className={cn(
          "w-full max-w-full cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] md:max-w-none md:overflow-visible",
          studyBibleDarkClasses.bwiCard,
          getStudyBibleDarkCardShade(householder.id || householder.name),
          studyBibleDarkClasses.cardHover
        )}
        onClick={() => onHouseholderClick(householder)}
      >
        <CardHeader>
          <div className="flex items-start justify-between w-full min-w-0 gap-2 md:min-w-[auto]">
            <div className="flex-1 min-w-0">
              <div className="w-full min-w-0 md:min-w-[auto]">
                <CardTitle className="text-2xl sm:text-3xl font-black flex flex-col sm:flex-row sm:items-center gap-2 w-full min-w-0 md:min-w-[auto]">
                  <div className="relative min-w-0 flex-1 max-w-[320px] overflow-hidden">
                    <span 
                      className={`whitespace-nowrap block pr-8 ${
                        householder.name.length > 35 ? 'animate-marquee' : ''
                      }`}
                      title={householder.name}
                      style={{
                        '--marquee-distance': householder.name.length > 35 
                          ? `calc(-100% + ${Math.max(320 - (householder.name.length * 8), 200)}px)`
                          : '-80%'
                      } as React.CSSProperties}
                    >
                      {householder.name}
                    </span>
                    <div className={cn("absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card via-card/50 to-transparent pointer-events-none", getStudyBibleDarkCardFade(householder.id || householder.name))}></div>
                  </div>
                </CardTitle>
                
                {/* Establishment name */}
                {householder.establishment_name && (
                  <div className="mt-2 flex min-w-0 items-center gap-1 text-sm font-medium">
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate md:whitespace-normal">{householder.establishment_name}</span>
                  </div>
                )}
                {/* Status Badge */}
                <div className="mt-2 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(getStatusTextColorClass(householder.status))}
                  >
                    {formatStatusText(householder.status)}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="text-center">
                <p className="text-sm font-medium">{householder.top_visitors?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Visitors</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between w-full min-w-0 gap-2 md:min-w-[auto]">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Overlapping avatars for top visitors - up to 5 */}
              <div className="flex items-center flex-shrink-0">
                {householder.top_visitors?.slice(0, 5).map((visitor, index) => (
                  <Avatar 
                    key={visitor.user_id || index} 
                    className={`h-6 w-6 ring-2 ring-background ${index > 0 ? '-ml-2' : ''}`}
                  >
                    <AvatarImage src={visitor.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {`${visitor.first_name} ${visitor.last_name}`.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              {householder.top_visitors && householder.top_visitors.length > 5 && (
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  +{householder.top_visitors.length - 5} more
                </span>
              )}
              {householder.note && (
                <div className="relative min-w-0 flex-1 max-w-[320px] overflow-hidden">
                  <span 
                    className={`text-xs text-muted-foreground whitespace-nowrap block pr-8 ${
                      householder.note.length > 55 ? 'animate-marquee' : ''
                    }`}
                    style={{
                      '--marquee-distance': householder.note.length > 55 
                        ? `calc(-100% + ${Math.max(320 - (householder.note.length * 6), 200)}px)`
                        : '-80%'
                    } as React.CSSProperties}
                  >
                    {householder.note}
                  </span>
                  <div className={cn("absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card via-card/50 to-transparent pointer-events-none", getStudyBibleDarkCardFade(householder.id || householder.name))}></div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const renderCompactView = (householder: HouseholderWithDetails, index: number) => (
    <motion.div
      key={householder.id}
      initial={{ opacity: 0, filter: "blur(6px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="w-full"
    >
      <Card
        className={cn(
          "cursor-pointer hover:shadow-md transition-all duration-300 hover:scale-[1.02] overflow-hidden",
          studyBibleDarkClasses.bwiCard,
          getStudyBibleDarkCardShade(householder.id || householder.name),
          studyBibleDarkClasses.cardHover
        )}
        onClick={() => onHouseholderClick(householder)}
      >
        <div className="py-0 px-3">
          <div className="flex items-center justify-between gap-2 min-w-0">
            {/* Left side - Name, status, establishment, and avatars */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap min-w-0">
                <h3 className="font-semibold text-sm truncate" title={householder.name}>{truncateHouseholderName(householder.name)}</h3>
                
                {/* Status Badge */}
                <div className="flex items-center gap-1">
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs px-1.5 py-0.5", getStatusTextColorClass(householder.status))}
                  >
                    {formatStatusText(householder.status)}
                  </Badge>
                </div>
              </div>
              
              {/* Establishment and avatars in same line */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {householder.establishment_name && (
                  <span className="truncate flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {householder.establishment_name}
                  </span>
                )}
                
                {/* Avatars inline with establishment */}
                {(householder.top_visitors && householder.top_visitors.length > 0) && (
                  <div className="flex items-center ml-2">
                    {householder.top_visitors.slice(0, 3).map((visitor, index) => (
                      <Avatar 
                        key={visitor.user_id || index} 
                        className={`h-4 w-4 ring-1 ring-background ${index > 0 ? '-ml-1' : ''}`}
                      >
                        <AvatarImage src={visitor.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {`${visitor.first_name} ${visitor.last_name}`.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {householder.top_visitors.length > 3 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        +{householder.top_visitors.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );

  const renderTableView = () => (
    <div className={cn("w-full h-full flex flex-col overscroll-none overflow-hidden rounded-xl border border-border/70 dark:border-[#3a3342]", studyBibleDarkClasses.card)} style={{ overscrollBehavior: 'none' }}>
      {/* Fixed Table Header */}
      <div className="flex-shrink-0 border-b bg-background dark:border-[#1c1921] dark:bg-[#30283c]">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className={cn("border-b dark:border-[#1c1921]", studyBibleDarkClasses.muted)}>
              <HouseholderTableSortTh
                label="Name"
                sortKey="name"
                sort={householderTableSort}
                onToggle={toggleHouseholderTableSort}
                className="w-[40%] md:w-[30%] p-0 align-bottom"
              />
              <HouseholderTableSortTh
                label="Status"
                sortKey="status"
                sort={householderTableSort}
                onToggle={toggleHouseholderTableSort}
                className="w-[20%] md:w-[16%] p-0 align-bottom"
              />
              <HouseholderTableSortTh
                label="Establishment"
                sortKey="establishment"
                sort={householderTableSort}
                onToggle={toggleHouseholderTableSort}
                className="w-[40%] md:w-[30%] p-0 align-bottom"
              />
              <HouseholderTableSortTh
                label="Last call"
                sortKey="last_call"
                sort={householderTableSort}
                onToggle={toggleHouseholderTableSort}
                className="hidden md:table-cell w-[14%] p-0 align-bottom"
              />
              <HouseholderTableSortTh
                label="Calls"
                sortKey="calls"
                sort={householderTableSort}
                onToggle={toggleHouseholderTableSort}
                className="hidden md:table-cell w-[10%] p-0 align-bottom"
              />
            </tr>
          </thead>
        </table>
      </div>
      
      {/* Scrollable Table Body */}
      <div
        ref={tableBodyScrollRef}
        className="flex-1 overflow-y-auto no-scrollbar overscroll-none pb-[calc(max(env(safe-area-inset-bottom),0px)+255px)] md:pb-[max(env(safe-area-inset-bottom),0px)+16px)] dark:bg-[#24231f]"
        style={{ overscrollBehavior: "contain", touchAction: "pan-y" }}
      >
        <table className="w-full text-sm table-fixed">
          <tbody>
            {visibleHouseholders.map((householder, index) => (
              <tr
                key={householder.id || index}
                className={cn(
                  "cursor-pointer border-b transition-colors",
                  "dark:border-[#3a3342]",
                  getStudyBibleDarkCardShade(String(householder.id ?? householder.name ?? index)),
                  "hover:bg-muted/30",
                  studyBibleDarkClasses.cardHover
                )}
                onClick={() => onHouseholderClick(householder)}
              >
                <td className="p-3 min-w-0 w-[40%] md:w-[30%]">
                  <NameWithAvatarsCell name={householder.name} visitors={householder.top_visitors} />
                </td>
                <td className="p-3 w-[20%] md:w-[16%]">
                  <div className="flex items-center gap-1 min-w-0">
                    <Badge 
                      variant="outline" 
                      className={cn("text-[10px] leading-4 px-1.5 py-0.5 rounded-sm", getStatusTextColorClass(householder.status))}
                    >
                      {formatStatusCompactText(householder.status)}
                    </Badge>
                  </div>
                </td>
                <td className="p-3 min-w-0 w-[40%] md:w-[30%]">
                  {householder.establishment_name ? (
                    <EstablishmentNameCell name={householder.establishment_name} />
                  ) : null}
                </td>
                <td className="hidden md:table-cell p-3 min-w-0 md:w-[14%] text-muted-foreground dark:text-[#ded6e7]">
                  {formatTableDate(householder.last_visit_at)}
                </td>
                <td className="hidden md:table-cell p-3 md:w-[10%]">
                  {getHouseholderCallTotal(householder)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleCount < householdersForSlice.length && (
          <div ref={sentinelRef} className="h-16 w-full" aria-label="Load more trigger" />
        )}
      </div>
    </div>
  );

  return (
    <div
      className={
        viewMode === 'table'
          ? "w-full overflow-hidden flex flex-col overscroll-none mt-10"
          : "w-full"
      }
      style={
        viewMode === "table"
          ? {
              overscrollBehavior: "none",
              // Use the large viewport on tablet+ so iPad paints through the bottom safe area.
              height: "100lvh"
            }
          : undefined
      }
    >

      {/* Householders */}
      <AnimatePresence mode="wait" initial={false}>
        {viewMode === 'table' ? (
          <motion.div
            key="table"
            className="w-full h-full flex-1 min-h-0"
            layout
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {renderTableView()}
          </motion.div>
        ) : (
          <motion.div
            key="cards"
            initial={{ opacity: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            {viewMode === "detailed" ? (
              <>
                <div className="grid gap-4 mt-10 w-full md:hidden">
                  {visibleHouseholders.map((householder, index) =>
                    renderDetailedView(householder, index)
                  )}
                </div>
                <div
                  className="no-scrollbar mt-10 hidden h-[calc(100lvh-max(env(safe-area-inset-top),var(--device-safe-top,0px))-128px)] min-h-[420px] w-full overflow-x-auto overscroll-x-contain md:grid md:grid-flow-col md:gap-4"
                  style={{
                    gridAutoColumns: "32%",
                  }}
                >
                  {detailedStatusColumns.map((status) => {
                    const columnHouseholders = householders.filter((householder) => (householder.status || "potential") === status);
                    return (
                      <section
                        key={status}
                        className="flex min-h-0 min-w-0 flex-col rounded-lg border border-transparent bg-transparent"
                        aria-label={`${formatStatusText(status)} contacts`}
                      >
                        <div className={cn("mb-3 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wide dark:border-[#1c1921] dark:bg-[#30283c]", getStatusTitleColor(status))}>
                          {formatStatusText(status)}
                        </div>
                        <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pb-[calc(max(env(safe-area-inset-bottom),0px)+132px)] md:pb-[max(env(safe-area-inset-bottom),0px)+12px)] pr-1">
                          {columnHouseholders.map((householder, index) =>
                            renderDetailedView(householder, index)
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="grid gap-4 mt-10 w-full">
                {visibleHouseholders.map((householder, index) =>
                  renderCompactView(householder, index)
                )}
              </div>
            )}
            {visibleCount < householdersForSlice.length && (
              <div
                ref={sentinelRef}
                className={cn("h-20 w-full", viewMode === "detailed" && "md:hidden")}
                aria-label="Load more trigger"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
