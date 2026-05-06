"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { List, LayoutGrid, Table as TableIcon, Filter, User, UserCheck, X, ChevronUp, ChevronDown } from "lucide-react";
import { type EstablishmentWithDetails, type BusinessFiltersState } from "@/lib/db/business";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { getStatusColor, getStatusTextColor, getBestStatus, getStatusTitleColor } from "@/lib/utils/status-hierarchy";
import { useListViewMode } from "@/lib/hooks/use-list-view-mode";
import { useInfiniteList } from "@/lib/hooks/use-infinite-list";
import {
  usePersistedTableSort,
  type TableSortDir,
} from "@/lib/hooks/use-persisted-table-sort";
import { formatEstablishmentStatusCompactText, formatStatusText } from "@/lib/utils/formatters";
import { getStudyBibleDarkCardFade, getStudyBibleDarkCardShade, studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";

interface EstablishmentListProps {
  establishments: EstablishmentWithDetails[];
  currentUserId?: string | null;
  onEstablishmentClick: (establishment: EstablishmentWithDetails) => void;
  onEstablishmentDelete?: (establishment: EstablishmentWithDetails) => void;
  onEstablishmentArchive?: (establishment: EstablishmentWithDetails) => void;
  myEstablishmentsOnly?: boolean;
  onMyEstablishmentsChange?: (checked: boolean) => void;
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

const ESTABLISHMENT_DETAILED_COLUMN_ORDER = [
  "personal_territory",
  "has_bible_studies",
  "for_replenishment",
  "accepted_rack",
  "for_follow_up",
  "for_scouting",
  "rack_pulled_out",
  "declined_rack",
  "closed",
  "on_hold",
  "inappropriate",
];

type EstTableSortKey =
  | "name"
  | "status"
  | "area"
  | "last_call"
  | "calls"
  | "contacts"
  | "floor";

const EST_TABLE_SORT_KEYS: readonly EstTableSortKey[] = [
  "name",
  "status",
  "area",
  "last_call",
  "calls",
  "contacts",
  "floor",
];

const EST_TABLE_DEFAULT_DIRS: Record<EstTableSortKey, TableSortDir> = {
  name: "asc",
  status: "asc",
  area: "asc",
  last_call: "desc",
  calls: "desc",
  contacts: "desc",
  floor: "asc",
};

function MarqueeCell({
  text
}: {
  text: string;
}) {
  return (
    <div className="truncate" title={text}>
      {text}
    </div>
  );
}

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

function formatTableDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function EstablishmentTableSortTh({
  label,
  sortKey,
  sort,
  onToggle,
  className,
}: {
  label: string;
  sortKey: EstTableSortKey;
  sort: { column: EstTableSortKey; dir: TableSortDir };
  onToggle: (k: EstTableSortKey) => void;
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

export function EstablishmentList({ 
  establishments, 
  currentUserId,
  onEstablishmentClick,
  onEstablishmentDelete,
  onEstablishmentArchive,
  myEstablishmentsOnly,
  onMyEstablishmentsChange,
  onOpenFilters,
  filters,
  onClearAllFilters,
  onClearSearch,
  onRemoveStatus,
  onRemoveArea,
  viewMode: externalViewMode,
  onViewModeChange
}: EstablishmentListProps) {
  
  // Reset scroll position to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const { viewMode } = useListViewMode<ViewMode>({
    defaultViewMode: "detailed",
    externalViewMode,
    onViewModeChange,
    storageKey: "establishment-view-mode",
    allowedModes: ["detailed", "compact", "table"],
    cycleOrder: ["detailed", "compact", "table"],
  });

  const { sort: establishmentTableSort, toggleColumn: toggleEstablishmentTableSort } =
    usePersistedTableSort<EstTableSortKey>({
      storageKey: "bwi-establishment-table-sort",
      allowedColumns: EST_TABLE_SORT_KEYS,
      defaultColumn: "name",
      defaultDirs: EST_TABLE_DEFAULT_DIRS,
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
    !!filters.search ||
    (filters.statuses?.length ?? 0) > 0 ||
    (filters.excludedStatuses?.length ?? 0) > 0 ||
    (filters.areas?.length ?? 0) > 0 ||
    !!filters.myEstablishments
  );

  const formatStatusCompactText = formatEstablishmentStatusCompactText;

  const truncateEstablishmentName = (name: string, maxLength: number = 20) => {
    return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
  };

  const getStatusDotColorClass = (status: string) => {
    switch (status) {
      case 'declined_rack':
        return 'bg-red-500';
      case 'for_scouting':
        return 'bg-cyan-500';
      case 'for_follow_up':
        return 'bg-orange-500';
      case 'accepted_rack':
        return 'bg-blue-500';
      case 'for_replenishment':
        return 'bg-purple-500';
      case 'has_bible_studies':
        return 'bg-emerald-500';
      case 'closed':
        return 'bg-slate-500';
      case 'on_hold':
        return 'bg-stone-500';
      case 'rack_pulled_out':
        return 'bg-amber-500';
      default:
        return 'bg-gray-500';
    }
  };

  const PERSONAL_TERRITORY_LABEL = "Personal Territory";
  const OWNED_PERSONAL_TERRITORY_BADGE_CLASS = "text-pink-400 border-pink-400/60";
  const OTHER_PERSONAL_TERRITORY_BADGE_CLASS = "text-pink-300 border-pink-400/60 border-dashed bg-pink-500/5";

  const isPersonalTerritory = (establishment: EstablishmentWithDetails) =>
    !!establishment.publisher_id;
  const isOwnedPersonalTerritory = (establishment: EstablishmentWithDetails) =>
    !!(currentUserId && establishment.publisher_id === currentUserId);

  const getPrimaryStatusLabel = (establishment: EstablishmentWithDetails) => {
    if (isPersonalTerritory(establishment)) return PERSONAL_TERRITORY_LABEL;
    if (establishment.statuses?.length) return formatStatusText(getBestStatus(establishment.statuses));
    return "Unknown";
  };

  const getPrimaryStatusLabelCompact = (establishment: EstablishmentWithDetails) => {
    if (isPersonalTerritory(establishment)) return "Personal";
    if (establishment.statuses?.length) return formatStatusCompactText(getBestStatus(establishment.statuses));
    return "—";
  };

  const getPrimaryStatusClass = (establishment: EstablishmentWithDetails) =>
    isPersonalTerritory(establishment)
      ? (isOwnedPersonalTerritory(establishment)
          ? OWNED_PERSONAL_TERRITORY_BADGE_CLASS
          : OTHER_PERSONAL_TERRITORY_BADGE_CLASS)
      : getStatusTextColor(getBestStatus(establishment.statuses || []));

  const getDetailedColumnStatus = (establishment: EstablishmentWithDetails) => {
    if (isPersonalTerritory(establishment)) return "personal_territory";
    const statuses = establishment.statuses || [];
    if (statuses.includes("has_bible_studies")) return "has_bible_studies";
    return getBestStatus(statuses);
  };

  const detailedStatusColumns = useMemo(() => {
    const statuses = Array.from(new Set(establishments.map(getDetailedColumnStatus)));
    statuses.sort((a, b) => {
      const aIndex = ESTABLISHMENT_DETAILED_COLUMN_ORDER.indexOf(a);
      const bIndex = ESTABLISHMENT_DETAILED_COLUMN_ORDER.indexOf(b);
      const normalizedA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
      const normalizedB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
      return normalizedA - normalizedB || a.localeCompare(b);
    });
    return statuses;
  }, [establishments]);

  const getSecondaryStatusesForDots = (establishment: EstablishmentWithDetails) => {
    const statuses = establishment.statuses || [];
    if (!statuses.length) return [];
    if (isPersonalTerritory(establishment)) return statuses;
    const best = getBestStatus(statuses);
    return statuses.filter((s) => s !== best);
  };

  const sortedEstablishmentsForTable = useMemo(() => {
    if (viewMode !== "table") return establishments;
    const { column, dir } = establishmentTableSort;
    const mult = dir === "asc" ? 1 : -1;
    const list = [...establishments];

    const cmpStr = (a: string, b: string) =>
      mult * a.localeCompare(b, undefined, { sensitivity: "base" });
    const cmpNum = (a: number, b: number) =>
      mult * (a === b ? 0 : a < b ? -1 : 1);

    /** YYYY-MM-DD; empty dates sort last regardless of asc/desc */
    const cmpVisitDateStr = (
      a: string | null | undefined,
      b: string | null | undefined
    ) => {
      const av = (a ?? "").trim();
      const bv = (b ?? "").trim();
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      const raw = av.localeCompare(bv);
      return mult * raw;
    };

    const statusSortLabel = (e: EstablishmentWithDetails) => {
      if (e.publisher_id) return "personal territory";
      if (e.statuses?.length)
        return formatStatusCompactText(getBestStatus(e.statuses));
      return "\uFFFF";
    };

    list.sort((ea, eb) => {
      let cmp = 0;
      switch (column) {
        case "name":
          cmp = cmpStr((ea.name || "").toLowerCase(), (eb.name || "").toLowerCase());
          break;
        case "status":
          cmp = cmpStr(statusSortLabel(ea).toLowerCase(), statusSortLabel(eb).toLowerCase());
          break;
        case "area":
          cmp = cmpStr((ea.area || "").toLowerCase(), (eb.area || "").toLowerCase());
          break;
        case "last_call":
          cmp = cmpVisitDateStr(ea.last_visit_at, eb.last_visit_at);
          break;
        case "calls":
          cmp = cmpNum(ea.visit_count ?? 0, eb.visit_count ?? 0);
          break;
        case "contacts":
          cmp = cmpNum(ea.householder_count ?? 0, eb.householder_count ?? 0);
          break;
        case "floor":
          cmp = cmpStr((ea.floor || "").toLowerCase(), (eb.floor || "").toLowerCase());
          break;
        default:
          cmp = 0;
      }
      if (cmp !== 0) return cmp;
      return (ea.name || "").localeCompare(eb.name || "", undefined, {
        sensitivity: "base",
      });
    });
    return list;
  }, [viewMode, establishments, establishmentTableSort, formatStatusCompactText]);

  const establishmentsForSlice = sortedEstablishmentsForTable;

  const { visibleCount, sentinelRef } = useInfiniteList({
    itemsLength: establishmentsForSlice.length,
    viewMode,
    initialCounts: { detailed: 7, compact: 10, table: 40 },
    stepCounts: { detailed: 5, compact: 10, table: 40 },
  });

  const visibleEstablishments = useMemo(
    () => establishmentsForSlice.slice(0, visibleCount),
    [establishmentsForSlice, visibleCount]
  );

  useEffect(() => {
    if (viewMode !== "table") return;
    tableBodyScrollRef.current?.scrollTo({ top: 0 });
  }, [viewMode, establishmentTableSort.column, establishmentTableSort.dir]);

  const renderDetailedView = (establishment: EstablishmentWithDetails, index: number) => (
    <motion.div
      key={establishment.id}
      initial={{ opacity: 0, filter: "blur(6px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="w-full"
    >
      <Card
        className={cn(
          "cursor-pointer hover:shadow-md transition-all duration-300 hover:scale-[1.02]",
          studyBibleDarkClasses.bwiCard,
          getStudyBibleDarkCardShade(establishment.id || establishment.name),
          studyBibleDarkClasses.cardHover
        )}
        onClick={() => onEstablishmentClick(establishment)}
      >
        <CardHeader>
          <div className="flex items-start justify-between w-full gap-2">
            <div className="flex-1 min-w-0">
              <div className="w-full">
                <CardTitle className="text-2xl sm:text-3xl font-black flex flex-col sm:flex-row sm:items-center gap-2 w-full">
                  <div className="relative min-w-0 flex-1 max-w-[320px] overflow-hidden">
                    <span 
                      className={`whitespace-nowrap block pr-8 ${
                        establishment.name.length > 30 ? 'animate-marquee' : ''
                      }`}
                      title={establishment.name}
                      style={{
                        '--marquee-distance': establishment.name.length > 30 
                          ? `calc(-100% + ${Math.max(320 - (establishment.name.length * 8), 200)}px)`
                          : '-80%'
                      } as React.CSSProperties}
                    >
                      {establishment.name}
                    </span>
                    <div className={cn("absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card via-card/50 to-transparent pointer-events-none", getStudyBibleDarkCardFade(establishment.id || establishment.name))}></div>
                  </div>
                </CardTitle>
                
                {/* Area label */}
                {establishment.area && (
                  <div className="mt-2 text-sm font-medium">{establishment.area}</div>
                )}
                {/* Status Badge with Hierarchy / Personal Territory */}
                <div className="mt-2 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(getPrimaryStatusClass(establishment))}
                  >
                    {getPrimaryStatusLabel(establishment)}
                  </Badge>

                  {/* Additional status dots */}
                  {getSecondaryStatusesForDots(establishment).length > 0 && (
                    <div className="flex gap-1">
                      {getSecondaryStatusesForDots(establishment).map((status) => {
                          // Get the solid color for the dot
                          let dotColor = '';
                          switch (status) {
                            case 'declined_rack':
                              dotColor = 'bg-red-500';
                              break;
                            case 'for_scouting':
                              dotColor = 'bg-cyan-500';
                              break;
                            case 'for_follow_up':
                              dotColor = 'bg-orange-500';
                              break;
                            case 'accepted_rack':
                              dotColor = 'bg-blue-500';
                              break;
                            case 'for_replenishment':
                              dotColor = 'bg-purple-500';
                              break;
                            case 'has_bible_studies':
                              dotColor = 'bg-emerald-500';
                              break;
                            case 'on_hold':
                              dotColor = 'bg-stone-500';
                              break;
                            default:
                              dotColor = 'bg-gray-500';
                          }

                          return (
                            <div
                              key={status}
                              className={cn("w-3 h-3 rounded-full", dotColor)}
                              title={formatStatusText(status)}
                            />
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="text-center">
                <p className="text-sm font-medium">{establishment.visit_count || 0}</p>
                <p className="text-xs text-muted-foreground">Visits</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">{establishment.householder_count || 0}</p>
                <p className="text-xs text-muted-foreground">BS</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">0</p>
                <p className="text-xs text-muted-foreground">RV</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between w-full gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Overlapping avatars for top visitors - up to 5 */}
              <div className="flex items-center flex-shrink-0">
                {establishment.top_visitors?.slice(0, 5).map((visitor, index) => (
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
              {establishment.top_visitors && establishment.top_visitors.length > 5 && (
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  +{establishment.top_visitors.length - 5} more
                </span>
              )}
              {establishment.description && (
                <div className="relative min-w-0 flex-1 max-w-[320px] overflow-hidden">
                  <span 
                    className={`text-xs text-muted-foreground whitespace-nowrap block pr-8 ${
                      establishment.description.length > 50 ? 'animate-marquee' : ''
                    }`}
                    style={{
                      '--marquee-distance': establishment.description.length > 50 
                        ? `calc(-100% + ${Math.max(320 - (establishment.description.length * 6), 200)}px)`
                        : '-80%'
                    } as React.CSSProperties}
                  >
                    {establishment.description}
                  </span>
                  <div className={cn("absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card via-card/50 to-transparent pointer-events-none", getStudyBibleDarkCardFade(establishment.id || establishment.name))}></div>
                </div>
              )}
            </div>
            {establishment.floor && (
              <span className="text-xs text-muted-foreground flex-shrink-0">{establishment.floor}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const renderCompactView = (establishment: EstablishmentWithDetails, index: number) => (
    <motion.div
      key={establishment.id}
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
          getStudyBibleDarkCardShade(establishment.id || establishment.name),
          studyBibleDarkClasses.cardHover
        )}
        onClick={() => onEstablishmentClick(establishment)}
      >
        <div className="py-0 px-3">
          <div className="flex items-center justify-between gap-2 min-w-0">
            {/* Left side - Name, status, area, and avatars */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap min-w-0">
                <h3 className="font-semibold text-sm truncate" title={establishment.name}>{truncateEstablishmentName(establishment.name)}</h3>
                
                {/* Status Badge with Hierarchy / Personal Territory */}
                <div className="flex items-center gap-1">
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs px-1.5 py-0.5", getPrimaryStatusClass(establishment))}
                  >
                    {getPrimaryStatusLabel(establishment)}
                  </Badge>
                  
                  {/* Additional status dots */}
                  {getSecondaryStatusesForDots(establishment).length > 0 && (
                    <div className="flex gap-1">
                      {getSecondaryStatusesForDots(establishment).map((status) => {
                          // Get the solid color for the dot
                          let dotColor = '';
                          switch (status) {
                            case 'declined_rack':
                              dotColor = 'bg-red-500';
                              break;
                            case 'for_scouting':
                              dotColor = 'bg-cyan-500';
                              break;
                            case 'for_follow_up':
                              dotColor = 'bg-orange-500';
                              break;
                            case 'accepted_rack':
                              dotColor = 'bg-blue-500';
                              break;
                            case 'for_replenishment':
                              dotColor = 'bg-purple-500';
                              break;
                            case 'has_bible_studies':
                              dotColor = 'bg-emerald-500';
                              break;
                            case 'rack_pulled_out':
                              dotColor = 'bg-amber-500';
                              break;
                            case 'on_hold':
                              dotColor = 'bg-stone-500';
                              break;
                            default:
                              dotColor = 'bg-gray-500';
                          }
                          
                          return (
                            <div
                              key={status}
                              className={cn("w-3 h-3 rounded-full", dotColor)}
                              title={formatStatusText(status)}
                            />
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Area and avatars in same line */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {establishment.area && (
                  <span className="truncate">{establishment.area}</span>
                )}
                {establishment.floor && (
                  <span className="flex-shrink-0">• {establishment.floor}</span>
                )}
                
                {/* Avatars inline with area */}
                {(establishment.top_visitors && establishment.top_visitors.length > 0) && (
                  <div className="flex items-center ml-2">
                    {establishment.top_visitors.slice(0, 3).map((visitor, index) => (
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
                    {establishment.top_visitors.length > 3 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        +{establishment.top_visitors.length - 3}
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
              <EstablishmentTableSortTh
                label="Name"
                sortKey="name"
                sort={establishmentTableSort}
                onToggle={toggleEstablishmentTableSort}
                className="w-[50%] md:w-[28%] p-0 align-bottom"
              />
              <EstablishmentTableSortTh
                label="Status"
                sortKey="status"
                sort={establishmentTableSort}
                onToggle={toggleEstablishmentTableSort}
                className="w-[23%] md:w-[16%] p-0 align-bottom"
              />
              <EstablishmentTableSortTh
                label="Area"
                sortKey="area"
                sort={establishmentTableSort}
                onToggle={toggleEstablishmentTableSort}
                className="w-[27%] md:w-[16%] p-0 align-bottom"
              />
              <EstablishmentTableSortTh
                label="Last call"
                sortKey="last_call"
                sort={establishmentTableSort}
                onToggle={toggleEstablishmentTableSort}
                className="hidden md:table-cell w-[14%] p-0 align-bottom"
              />
              <EstablishmentTableSortTh
                label="Calls"
                sortKey="calls"
                sort={establishmentTableSort}
                onToggle={toggleEstablishmentTableSort}
                className="hidden md:table-cell w-[9%] p-0 align-bottom"
              />
              <EstablishmentTableSortTh
                label="Contacts"
                sortKey="contacts"
                sort={establishmentTableSort}
                onToggle={toggleEstablishmentTableSort}
                className="hidden md:table-cell w-[10%] p-0 align-bottom"
              />
              <EstablishmentTableSortTh
                label="Floor"
                sortKey="floor"
                sort={establishmentTableSort}
                onToggle={toggleEstablishmentTableSort}
                className="hidden md:table-cell w-[7%] p-0 align-bottom"
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
            {visibleEstablishments.map((establishment, index) => (
              <tr
                key={establishment.id || index}
                className={cn(
                  "cursor-pointer border-b transition-colors",
                  "dark:border-[#3a3342]",
                  getStudyBibleDarkCardShade(String(establishment.id ?? establishment.name ?? index)),
                  "hover:bg-muted/30",
                  studyBibleDarkClasses.cardHover
                )}
                onClick={() => onEstablishmentClick(establishment)}
              >
                <td className="p-3 min-w-0 w-[50%] md:w-[28%]">
                  <NameWithAvatarsCell name={establishment.name} visitors={establishment.top_visitors} />
                </td>
                <td className="p-3 w-[23%] md:w-[16%]">
                  <div className="flex items-center gap-1 min-w-0">
                    <Badge 
                      variant="outline" 
                      className={cn("text-[10px] leading-4 px-1.5 py-0.5 rounded-sm", getPrimaryStatusClass(establishment))}
                    >
                      {getPrimaryStatusLabelCompact(establishment)}
                    </Badge>
                    {getSecondaryStatusesForDots(establishment).length > 0 && (
                      <div className="flex items-center gap-0.5">
                        {getSecondaryStatusesForDots(establishment)
                          .slice(0, 3)
                          .map((status) => (
                            <div key={status} className={cn("w-1.5 h-1.5 rounded-full", getStatusDotColorClass(status))} title={formatStatusText(status)} />
                          ))}
                        {getSecondaryStatusesForDots(establishment).length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{getSecondaryStatusesForDots(establishment).length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-3 min-w-0 w-[27%] md:w-[16%]">
                  <MarqueeCell text={establishment.area || '-'} />
                </td>
                <td className="hidden md:table-cell p-3 min-w-0 md:w-[14%] text-muted-foreground dark:text-[#ded6e7]">
                  {formatTableDate(establishment.last_visit_at)}
                </td>
                <td className="hidden md:table-cell p-3 md:w-[9%]">
                  {establishment.visit_count ?? 0}
                </td>
                <td className="hidden md:table-cell p-3 md:w-[10%]">
                  {establishment.householder_count ?? 0}
                </td>
                <td className="hidden md:table-cell p-3 min-w-0 md:w-[7%] text-muted-foreground dark:text-[#ded6e7]">
                  <MarqueeCell text={establishment.floor || "-"} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleCount < establishmentsForSlice.length && (
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

      {/* Establishments */}
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
                  {visibleEstablishments.map((establishment, index) =>
                    renderDetailedView(establishment, index)
                  )}
                </div>
                <div
                  className="no-scrollbar mt-10 hidden h-[calc(100lvh-max(env(safe-area-inset-top),var(--device-safe-top,0px))-128px)] min-h-[420px] w-full overflow-x-auto overscroll-x-contain md:grid md:grid-flow-col md:gap-4"
                  style={{
                    gridAutoColumns: "32%",
                  }}
                >
                  {detailedStatusColumns.map((status) => {
                    const columnEstablishments = establishments.filter((establishment) => getDetailedColumnStatus(establishment) === status);
                    return (
                      <section
                        key={status}
                        className="flex min-h-0 min-w-0 flex-col rounded-lg border border-transparent bg-transparent"
                        aria-label={`${formatStatusText(status)} establishments`}
                      >
                        <div className={cn("mb-3 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wide dark:border-[#1c1921] dark:bg-[#30283c]", getStatusTitleColor(status))}>
                          {formatStatusText(status)}
                        </div>
                        <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pb-[calc(max(env(safe-area-inset-bottom),0px)+132px)] md:pb-[max(env(safe-area-inset-bottom),0px)+12px)] pr-1">
                          {columnEstablishments.map((establishment, index) =>
                            renderDetailedView(establishment, index)
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="grid gap-4 mt-10 w-full">
                {visibleEstablishments.map((establishment, index) =>
                  renderCompactView(establishment, index)
                )}
              </div>
            )}
            {visibleCount < establishmentsForSlice.length && (
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
