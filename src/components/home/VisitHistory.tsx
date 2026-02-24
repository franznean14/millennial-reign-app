"use client";

import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { formatVisitDateLong, getVisitDisplayName } from "@/lib/utils/visit-history-ui";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/shared/FormModal";
import { Building2, Calendar, ChevronRight, History } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getTimelineDotSize, getTimelineLineStyle, getVisitTypeDotColor } from "@/lib/utils/visit-timeline";
import type { VisitRecord } from "@/lib/utils/visit-history";
import { useBwiVisitHistory } from "@/lib/hooks/use-bwi-visit-history";
import { VisitTimelineRow } from "@/components/visit/VisitTimelineRow";
import { FilterControls } from "@/components/shared/FilterControls";
import { VisitFiltersForm } from "@/components/visit/VisitFiltersForm";
import { VisitAvatars } from "@/components/visit/VisitAvatars";
import { VisitList } from "@/components/visit/VisitList";
import { VisitRowContent } from "@/components/visit/VisitRowContent";
import { VisitStatusBadge } from "@/components/visit/VisitStatusBadge";
import { cn } from "@/lib/utils";
import { getVisitSearchText } from "@/lib/utils/visit-history-ui";
import { useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getEstablishmentsWithDetails, listHouseholders, type EstablishmentWithDetails, type HouseholderWithDetails } from "@/lib/db/business";
import { getStatusTextColor } from "@/lib/utils/status-hierarchy";
import NumberFlow from "@number-flow/react";
import { cacheGet, cacheSet } from "@/lib/offline/store";

interface VisitHistoryProps {
  userId: string;
  onVisitClick?: (visit: VisitRecord) => void;
  onNavigateToBusinessWithStatus?: (
    tab: "establishments" | "householders",
    status: string,
    area?: string
  ) => void;
  bwiAreaFilter: "all" | string;
  onBwiAreaChange: (area: "all" | string) => void;
}

function BwiStatusCell({
  onClick,
  children,
  className,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn("w-full text-left cursor-pointer hover:opacity-80 transition-opacity", className)}
      >
        {children}
      </button>
    );
  }
  return <div className={className}>{children}</div>;
}

export function VisitHistory({
  userId,
  onVisitClick,
  onNavigateToBusinessWithStatus,
  bwiAreaFilter,
  onBwiAreaChange,
}: VisitHistoryProps) {
  const [showDrawer, setShowDrawer] = useState(false);
  const [activePanel, setActivePanel] = useState<"list" | "filters">("list");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<"bwi" | "visit-history">("bwi");
  const activeTabRef = useRef<"bwi" | "visit-history">("bwi");
  const visitHistoryPointerDownTabRef = useRef<"bwi" | "visit-history">("bwi");
  const bwiPointerDownTabRef = useRef<"bwi" | "visit-history">("bwi");
  const [bwiLabelFlash, setBwiLabelFlash] = useState(true);
  const [bwiEstablishments, setBwiEstablishments] = useState<EstablishmentWithDetails[]>([]);
  const [bwiHouseholders, setBwiHouseholders] = useState<HouseholderWithDetails[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasFocusedRef = useRef(false);
  const searchDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  const {
    visits,
    loading,
    allVisitsRawCount,
    filteredVisits: hookFilteredVisits,
    filterOptions,
    filterBadges,
    filters,
    setFilters,
    clearFilters,
    clearSearch,
    loadAllVisits,
    loadMore,
    loadingMore,
    hasMore
  } = useBwiVisitHistory({ userId });

  // Client-side search filtering - filters locally without updating hook state
  // This prevents all items from unmounting/remounting, only items that don't match will exit
  // Keep filters.search empty so hookFilteredVisits doesn't include search filtering
  // Then apply localSearchValue locally for instant, fluid filtering
  // Use a ref to track previous filtered list to maintain stable references when possible
  const filteredVisitsRef = useRef<typeof hookFilteredVisits>([]);
  
  const filteredVisits = useMemo(() => {
    // Ensure filters.search is empty so hookFilteredVisits is filtered by everything except search
    const baseFiltered = hookFilteredVisits;
    
    // Apply local search filter
    if (!localSearchValue.trim()) {
      // If search is empty and base hasn't changed, return previous to maintain reference
      if (filteredVisitsRef.current.length === baseFiltered.length &&
          filteredVisitsRef.current.every((v, i) => v.id === baseFiltered[i]?.id)) {
        return filteredVisitsRef.current;
      }
      const result = baseFiltered;
      filteredVisitsRef.current = result;
      return result;
    }
    
    const searchLower = localSearchValue.trim().toLowerCase();
    const result = baseFiltered.filter((visit) => 
      getVisitSearchText(visit).includes(searchLower)
    );
    
    // Update ref for next comparison
    filteredVisitsRef.current = result;
    return result;
  }, [hookFilteredVisits, localSearchValue]);

  // Apply all filters to visits (handled by hook)

  const handleSeeMore = () => {
    setShowDrawer(true);
    // Only load if we don't have data yet
    // If data already exists, don't reload to avoid the snap/re-render
    if (allVisitsRawCount === 0) {
      // Always force a fresh fetch for the drawer's initial load so it's fully up to date
      // (card preview uses recent data; this keeps the drawer in sync with it)
      loadAllVisits(0, true);
    }
  };

  // Keep ref in sync with state
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Flash "BWI" on load, then show "All"
  useEffect(() => {
    if (activeTab !== "bwi") return;
    const t = setTimeout(() => setBwiLabelFlash(false), 2000);
    return () => clearTimeout(t);
  }, [activeTab]);

  // Available areas from establishments (unique, sorted), for BWI area cycle
  const bwiAreasSorted = useMemo(() => {
    const set = new Set<string>();
    bwiEstablishments.forEach((est) => {
      const a = est.area?.trim();
      if (a) set.add(a);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [bwiEstablishments]);

  // Filter BWI data by selected area (establishments by area; householders by their establishment's area)
  // Compare trimmed areas so "Tresmavica Building" matches "Tresmavica Building " from DB
  const { filteredByAreaEstablishments, filteredByAreaHouseholders } = useMemo(() => {
    if (bwiAreaFilter === "all") {
      return { filteredByAreaEstablishments: bwiEstablishments, filteredByAreaHouseholders: bwiHouseholders };
    }
    const areaNorm = bwiAreaFilter.trim();
    const inArea = (e: EstablishmentWithDetails) => (e.area?.trim() ?? "") === areaNorm;
    const estIdsInArea = new Set(bwiEstablishments.filter(inArea).map((e) => e.id));
    return {
      filteredByAreaEstablishments: bwiEstablishments.filter(inArea),
      filteredByAreaHouseholders: bwiHouseholders.filter((hh) =>
        hh.establishment_id ? estIdsInArea.has(hh.establishment_id) : false
      ),
    };
  }, [bwiEstablishments, bwiHouseholders, bwiAreaFilter]);

  const handleBwiPointerDown = () => {
    bwiPointerDownTabRef.current = activeTabRef.current;
  };

  const handleBwiTabClick = (e: React.MouseEvent) => {
    if (bwiPointerDownTabRef.current !== "bwi") return;
    e.preventDefault();
    e.stopPropagation();
    // Cycle area: All -> first area -> ... -> last area -> All
    onBwiAreaChange((() => {
      if (bwiAreaFilter === "all") return bwiAreasSorted[0] ?? "all";
      const i = bwiAreasSorted.indexOf(bwiAreaFilter);
      if (i < 0 || i === bwiAreasSorted.length - 1) return "all";
      return bwiAreasSorted[i + 1] ?? "all";
    })());
  };

  useEffect(() => {
    let isMounted = true;
    const loadBwiData = async () => {
      if (activeTab !== "bwi") return;
      
      // Load from cache first (like HomeSummary does)
      const cacheKey = 'bwi-summary-data';
      const cached = await cacheGet<{ establishments?: EstablishmentWithDetails[], householders?: HouseholderWithDetails[] }>(cacheKey);
      if (cached?.establishments || cached?.householders) {
        if (!isMounted) return;
        setBwiEstablishments(cached.establishments || []);
        setBwiHouseholders((cached.householders || []).filter((hh) => !!hh.establishment_id));
      }
      
      // Only fetch fresh data if we don't have data yet or if we're online
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }
      
      try {
        const [establishments, householders] = await Promise.all([
          getEstablishmentsWithDetails(),
          listHouseholders()
        ]);
        if (!isMounted) return;
        setBwiEstablishments(establishments);
        setBwiHouseholders(householders.filter((hh) => !!hh.establishment_id));
        
        // Cache the data for next time
        await cacheSet(cacheKey, { establishments, householders });
      } catch (error) {
        console.error("Error loading BWI summary data:", error);
      }
    };
    loadBwiData();
    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  const establishmentStatusCounts = useMemo(() => {
    const counts = {
      for_replenishment: 0,
      accepted_rack: 0,
      for_follow_up: 0,
      for_scouting: 0
    };
    filteredByAreaEstablishments.forEach((est) => {
      const statuses = est.statuses ?? [];
      if (statuses.includes("for_replenishment")) counts.for_replenishment += 1;
      if (statuses.includes("accepted_rack")) counts.accepted_rack += 1;
      if (statuses.includes("for_follow_up")) counts.for_follow_up += 1;
      if (statuses.includes("for_scouting")) counts.for_scouting += 1;
    });
    return counts;
  }, [filteredByAreaEstablishments]);

  const householderStatusCounts = useMemo(() => {
    const counts = {
      bible_study: 0,
      return_visit: 0,
      interested: 0,
      potential: 0
    };
    filteredByAreaHouseholders.forEach((hh) => {
      switch (hh.status) {
        case "bible_study":
          counts.bible_study += 1;
          break;
        case "return_visit":
          counts.return_visit += 1;
          break;
        case "interested":
          counts.interested += 1;
          break;
        case "potential":
          counts.potential += 1;
          break;
        default:
          break;
      }
    });
    return counts;
  }, [filteredByAreaHouseholders]);

  // Helper to extract just the text color class
  const getStatusTextColorClass = (status: string) => {
    const colorString = getStatusTextColor(status);
    return colorString.split(" ")[0]; // Extract just the text color class
  };

  const handleTabChange = (value: string) => {
    const currentActiveTab = activeTabRef.current;
    if (value !== currentActiveTab) {
      setActiveTab(value as "bwi" | "visit-history");
    }
  };

  const handleVisitHistoryPointerDown = () => {
    visitHistoryPointerDownTabRef.current = activeTabRef.current;
  };

  const handleVisitHistoryTabClick = (e: React.MouseEvent) => {
    // Use the tab that was active at pointer-down time
    const tabAtPointerDown = visitHistoryPointerDownTabRef.current;
    if (tabAtPointerDown === "visit-history") {
      e.preventDefault();
      e.stopPropagation();
      handleSeeMore();
    }
  };


  const formatVisitDate = formatVisitDateLong;

  const navigateWithBwiArea = (tab: "establishments" | "householders", status: string) => {
    if (!onNavigateToBusinessWithStatus) return;
    const area = bwiAreaFilter !== "all" ? bwiAreaFilter.trim() : undefined;
    onNavigateToBusinessWithStatus(tab, status, area || undefined);
  };

  const filterForm = (
    <VisitFiltersForm
      filters={filters}
      statusOptions={filterOptions.statuses}
      areaOptions={filterOptions.areas}
      onFiltersChange={setFilters}
      onClearFilters={clearFilters}
    />
  );

  const renderVisitRow = (visit: VisitRecord, index: number, total: number, isDrawer: boolean) => {
    return (
      <VisitTimelineRow
        onClick={() => handleVisitClick(visit)}
        index={index}
        total={total}
        rootClassName="hover:opacity-80 transition-opacity"
        lineStyle={getTimelineLineStyle(isDrawer)}
        dot={
          <div
            className={`${getTimelineDotSize()} rounded-full ${getVisitTypeDotColor(visit.visit_type)} relative z-10 flex-shrink-0`}
          />
        }
        contentClassName="ml-3"
        avatarClassName="ml-4"
        avatar={
          <VisitAvatars
            publisher={visit.publisher ?? null}
            partner={visit.partner ?? null}
            sizeClassName="w-6 h-6"
            textClassName="text-[10px]"
          />
        }
      >
        <VisitRowContent
          title={getVisitDisplayName(visit)}
          titleBadge={
            visit.visit_type === "householder" && visit.establishment_name ? (
              <VisitStatusBadge
                status={visit.establishment_status || "for_scouting"}
                label={visit.establishment_name}
              />
            ) : undefined
          }
          metaIcon={<Calendar className="h-3 w-3" />}
          metaText={formatVisitDate(visit.visit_date)}
          metaClassName={isDrawer ? "mb-2" : ""}
          notes={visit.notes}
          notesClassName={isDrawer ? "leading-relaxed" : "mt-1 line-clamp-1"}
        />
      </VisitTimelineRow>
    );
  };

  const handleVisitClick = (visit: VisitRecord) => {
    if (onVisitClick) {
      onVisitClick(visit);
    }
  };

  // Auto-focus search input when search becomes active (only once, and only if not already focused)
  // This effect should NOT run when user is typing to prevent focus disruption
  useEffect(() => {
    // Don't run if user is actively typing
    if (isTypingRef.current) {
      return;
    }
    
    if (isSearchActive && searchInputRef.current && !hasFocusedRef.current) {
      // Only focus if the input is not already focused
      const timer = setTimeout(() => {
        // Double-check that user is not typing and input is not already focused
        if (!isTypingRef.current && 
            searchInputRef.current && 
            document.activeElement !== searchInputRef.current &&
            !searchInputRef.current.matches(':focus-within')) {
          searchInputRef.current.focus();
          hasFocusedRef.current = true;
        }
      }, 200);
      return () => clearTimeout(timer);
    }
    if (!isSearchActive) {
      hasFocusedRef.current = false;
    }
  }, [isSearchActive]);

  // Keep filters.search empty to ensure hook doesn't filter by search
  // This allows us to do all search filtering client-side for better performance
  useEffect(() => {
    // If filters.search has a value, clear it (search is now client-side only)
    // Only clear if localSearchValue is also empty (user cleared search via clearSearch)
    if (filters.search && filters.search.trim() !== '' && (!localSearchValue || localSearchValue.trim() === "")) {
      clearSearch();
    }
    
    // Activate search if there's a local search value
    if (localSearchValue && localSearchValue.trim() !== '') {
      setIsSearchActive(true);
    }
  }, [filters.search, localSearchValue, clearSearch]);

  // Prevent drawer from receiving focus during typing
  // Use a more targeted approach that doesn't interfere with normal focus behavior
  useEffect(() => {
    if (!isTypingRef.current) return;
    
    const input = searchInputRef.current;
    if (!input) return;
    
    // Only intervene if focus has moved away from input to drawer/body
    const checkFocus = () => {
      if (!isTypingRef.current || !input) return;
      
      const activeElement = document.activeElement;
      // If focus moved to body or drawer container, restore to input
      if (activeElement !== input && 
          (activeElement === document.body || 
           activeElement?.tagName === 'DIV' && 
           activeElement?.closest('[role="dialog"]'))) {
        // Restore focus to input
        const selectionStart = input.selectionStart;
        const selectionEnd = input.selectionEnd;
        input.focus();
        if (selectionStart !== null && selectionEnd !== null) {
          try {
            input.setSelectionRange(selectionStart, selectionEnd);
          } catch (e) {
            // Ignore errors
          }
        }
      }
    };
    
    // Check focus after a short delay to catch focus shifts
    const timeoutId = setTimeout(checkFocus, 0);
    return () => clearTimeout(timeoutId);
  }, [localSearchValue]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceTimerRef.current) {
        clearTimeout(searchDebounceTimerRef.current);
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg border overflow-hidden bg-background">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-0 -mb-px p-0 h-auto bg-transparent gap-0 border-0 border-b-0 [&>*]:border-0 relative z-10">
            <TabsTrigger 
              value="bwi"
              onPointerDown={handleBwiPointerDown}
              onClick={handleBwiTabClick}
              className={cn(
                "rounded-tl-lg rounded-tr-none rounded-bl-none rounded-br-none",
                "bg-primary text-primary-foreground dark:text-primary-foreground font-medium",
                "data-[state=active]:!bg-background data-[state=active]:!text-foreground",
                "shadow-none",
                "relative h-10 px-4",
                "transition-all duration-200",
                "hover:bg-primary/90 data-[state=active]:hover:!bg-background",
                "!border-0 border-b-0 focus-visible:ring-0 focus-visible:outline-none",
                "[&>svg]:text-primary-foreground data-[state=active]:[&>svg]:text-foreground",
                "after:hidden"
              )}
            >
              <motion.div
                layout="position"
                transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
                className="inline-flex items-center gap-1.5 shrink-0 grow-0"
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <span>
                  {bwiLabelFlash ? "BWI" : bwiAreaFilter === "all" ? "All" : bwiAreaFilter}
                </span>
              </motion.div>
            </TabsTrigger>
            <TabsTrigger 
              value="visit-history"
              onPointerDown={handleVisitHistoryPointerDown}
              onClick={handleVisitHistoryTabClick}
              className={cn(
                "rounded-tr-lg rounded-tl-none rounded-bl-none rounded-br-none",
                "bg-primary text-primary-foreground dark:text-primary-foreground font-medium",
                "data-[state=active]:!bg-background data-[state=active]:!text-foreground",
                "shadow-none",
                "relative h-10 px-4",
                "transition-all duration-200",
                "hover:bg-primary/90 data-[state=active]:hover:!bg-background",
                "!border-0 border-b-0 focus-visible:ring-0 focus-visible:outline-none",
                "[&>svg]:text-primary-foreground data-[state=active]:[&>svg]:text-foreground",
                "after:hidden"
              )}
            >
              <History className="h-4 w-4" />
              <span>Calls</span>
              {activeTab === "visit-history" ? (
                <ChevronRight className="h-4 w-4 opacity-70" />
              ) : null}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="bwi" className="mt-0 rounded-b-lg bg-background p-4 overflow-y-auto scrollbar-hide">
            <div className="space-y-6">
                {/* Establishment Status Section */}
                <div>
                  <div className="grid grid-cols-2 gap-4 items-end">
                    <BwiStatusCell onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("establishments", "for_replenishment") : undefined}>
                      <div className={cn("text-5xl font-semibold leading-tight", getStatusTextColorClass("for_replenishment"))}>
                        <NumberFlow value={establishmentStatusCounts.for_replenishment} locales="en-US" format={{ useGrouping: false }} />
                      </div>
                      <div className="mt-1 text-sm opacity-70">For Replenishment</div>
                    </BwiStatusCell>
                    <BwiStatusCell onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("establishments", "accepted_rack") : undefined}>
                      <div className={cn("text-2xl font-semibold", getStatusTextColorClass("accepted_rack"))}>
                        <NumberFlow value={establishmentStatusCounts.accepted_rack} locales="en-US" format={{ useGrouping: false }} />
                      </div>
                      <div className="text-sm opacity-70 mt-0.5">Rack Accepted</div>
                    </BwiStatusCell>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <BwiStatusCell onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("establishments", "for_follow_up") : undefined}>
                      <div className={cn("text-2xl font-semibold", getStatusTextColorClass("for_follow_up"))}>
                        <NumberFlow value={establishmentStatusCounts.for_follow_up} locales="en-US" format={{ useGrouping: false }} />
                      </div>
                      <div className="text-sm opacity-70 mt-0.5">For Follow Up</div>
                    </BwiStatusCell>
                    <BwiStatusCell onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("establishments", "for_scouting") : undefined}>
                      <div className={cn("text-2xl font-semibold", getStatusTextColorClass("for_scouting"))}>
                        <NumberFlow value={establishmentStatusCounts.for_scouting} locales="en-US" format={{ useGrouping: false }} />
                      </div>
                      <div className="text-sm opacity-70 mt-0.5">For Scouting</div>
                    </BwiStatusCell>
                  </div>
                </div>

                {/* Householder Status Section */}
                <div className="pt-4 border-t pb-0">
                  <div className="text-xs text-muted-foreground mb-4">Householder status</div>
                  
                  <div className="grid grid-cols-2 gap-4 items-end">
                    <BwiStatusCell onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("householders", "bible_study") : undefined}>
                      <div className={cn("text-5xl font-semibold leading-tight", getStatusTextColorClass("bible_study"))}>
                        <NumberFlow value={householderStatusCounts.bible_study} locales="en-US" format={{ useGrouping: false }} />
                      </div>
                      <div className="mt-1 text-sm opacity-70">Bible Study</div>
                    </BwiStatusCell>
                    <BwiStatusCell onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("householders", "return_visit") : undefined}>
                      <div className={cn("text-2xl font-semibold", getStatusTextColorClass("return_visit"))}>
                        <NumberFlow value={householderStatusCounts.return_visit} locales="en-US" format={{ useGrouping: false }} />
                      </div>
                      <div className="text-sm opacity-70 mt-0.5">Return Visit</div>
                    </BwiStatusCell>
                    <BwiStatusCell onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("householders", "interested") : undefined}>
                      <div className={cn("text-2xl font-semibold", getStatusTextColorClass("interested"))}>
                        <NumberFlow value={householderStatusCounts.interested} locales="en-US" format={{ useGrouping: false }} />
                      </div>
                      <div className="text-sm opacity-70 mt-0.5">Interested</div>
                    </BwiStatusCell>
                    <BwiStatusCell onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("householders", "potential") : undefined}>
                      <div className={cn("text-2xl font-semibold", getStatusTextColorClass("potential"))}>
                        <NumberFlow value={householderStatusCounts.potential} locales="en-US" format={{ useGrouping: false }} />
                      </div>
                      <div className="text-sm opacity-70 mt-0.5">Potential</div>
                    </BwiStatusCell>
                  </div>
                </div>
              </div>
          </TabsContent>
          <TabsContent value="visit-history" className="mt-0 rounded-b-lg bg-background p-4">
            <div className="text-sm text-muted-foreground">Loading...</div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border overflow-hidden bg-background">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-0 -mb-px p-0 h-auto bg-transparent gap-0 border-0 [&>*]:border-0 relative z-10">
            <TabsTrigger 
              value="bwi"
              onPointerDown={handleBwiPointerDown}
              onClick={handleBwiTabClick}
              className={cn(
                "rounded-tl-lg rounded-tr-none rounded-bl-none rounded-br-none",
                "bg-primary text-primary-foreground dark:text-primary-foreground font-medium",
                "data-[state=active]:!bg-background data-[state=active]:!text-foreground",
                "shadow-none",
                "relative h-10 px-4",
                "transition-all duration-200",
                "hover:bg-primary/90 data-[state=active]:hover:!bg-background",
                "!border-0 focus-visible:ring-0 focus-visible:outline-none",
                "[&>svg]:text-primary-foreground data-[state=active]:[&>svg]:text-foreground",
                "after:hidden"
              )}
            >
              <motion.div
                layout="position"
                transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
                className="inline-flex items-center gap-1.5 shrink-0 grow-0"
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <span>
                  {bwiLabelFlash ? "BWI" : bwiAreaFilter === "all" ? "All" : bwiAreaFilter}
                </span>
              </motion.div>
            </TabsTrigger>
            <TabsTrigger 
              value="visit-history"
              onPointerDown={handleVisitHistoryPointerDown}
              onClick={handleVisitHistoryTabClick}
              className={cn(
                "rounded-tr-lg rounded-tl-none rounded-bl-none rounded-br-none",
                "bg-primary text-primary-foreground dark:text-primary-foreground font-medium",
                "data-[state=active]:!bg-background data-[state=active]:!text-foreground",
                "shadow-none",
                "relative h-10 px-4",
                "transition-all duration-200",
                "hover:bg-primary/90 data-[state=active]:hover:!bg-background",
                "!border-0 focus-visible:ring-0 focus-visible:outline-none",
                "[&>svg]:text-primary-foreground data-[state=active]:[&>svg]:text-foreground",
                "after:hidden"
              )}
            >
              <History className="h-4 w-4" />
              <span>Calls</span>
              {activeTab === "visit-history" ? (
                <ChevronRight className="h-4 w-4 opacity-70" />
              ) : null}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="bwi" className="mt-0 rounded-b-lg bg-background p-4 overflow-y-auto scrollbar-hide">
            <div className="space-y-6">
                {/* Establishment Status Section */}
                <div>
                  <div className="grid grid-cols-2 gap-4 items-end">
                    <BwiStatusCell onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("establishments", "for_replenishment") : undefined}>
                      <div className={cn("text-5xl font-semibold leading-tight", getStatusTextColorClass("for_replenishment"))}>
                        <NumberFlow value={establishmentStatusCounts.for_replenishment} locales="en-US" format={{ useGrouping: false }} />
                      </div>
                      <div className="mt-1 text-sm opacity-70">For Replenishment</div>
                    </BwiStatusCell>
                    <BwiStatusCell onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("establishments", "accepted_rack") : undefined}>
                      <div className={cn("text-2xl font-semibold", getStatusTextColorClass("accepted_rack"))}>
                        <NumberFlow value={establishmentStatusCounts.accepted_rack} locales="en-US" format={{ useGrouping: false }} />
                      </div>
                      <div className="text-sm opacity-70 mt-0.5">Rack Accepted</div>
                    </BwiStatusCell>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <BwiStatusCell onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("establishments", "for_follow_up") : undefined}>
                      <div className={cn("text-2xl font-semibold", getStatusTextColorClass("for_follow_up"))}>
                        <NumberFlow value={establishmentStatusCounts.for_follow_up} locales="en-US" format={{ useGrouping: false }} />
                      </div>
                      <div className="text-sm opacity-70 mt-0.5">For Follow Up</div>
                    </BwiStatusCell>
                    <BwiStatusCell onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("establishments", "for_scouting") : undefined}>
                      <div className={cn("text-2xl font-semibold", getStatusTextColorClass("for_scouting"))}>
                        <NumberFlow value={establishmentStatusCounts.for_scouting} locales="en-US" format={{ useGrouping: false }} />
                      </div>
                      <div className="text-sm opacity-70 mt-0.5">For Scouting</div>
                    </BwiStatusCell>
                  </div>
                </div>

                {/* Householder Status Section */}
                <div className="pt-4 border-t pb-0">
                  <div className="text-xs text-muted-foreground mb-4">Householder status</div>
                  
                  <div className="grid grid-cols-2 gap-4 items-end">
                    <BwiStatusCell onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("householders", "bible_study") : undefined}>
                      <div className={cn("text-5xl font-semibold leading-tight", getStatusTextColorClass("bible_study"))}>
                        <NumberFlow value={householderStatusCounts.bible_study} locales="en-US" format={{ useGrouping: false }} />
                      </div>
                      <div className="mt-1 text-sm opacity-70">Bible Study</div>
                    </BwiStatusCell>
                    <BwiStatusCell onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("householders", "return_visit") : undefined}>
                      <div className={cn("text-2xl font-semibold", getStatusTextColorClass("return_visit"))}>
                        <NumberFlow value={householderStatusCounts.return_visit} locales="en-US" format={{ useGrouping: false }} />
                      </div>
                      <div className="text-sm opacity-70 mt-0.5">Return Visit</div>
                    </BwiStatusCell>
                    <BwiStatusCell onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("householders", "interested") : undefined}>
                      <div className={cn("text-2xl font-semibold", getStatusTextColorClass("interested"))}>
                        <NumberFlow value={householderStatusCounts.interested} locales="en-US" format={{ useGrouping: false }} />
                      </div>
                      <div className="text-sm opacity-70 mt-0.5">Interested</div>
                    </BwiStatusCell>
                    <BwiStatusCell onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("householders", "potential") : undefined}>
                      <div className={cn("text-2xl font-semibold", getStatusTextColorClass("potential"))}>
                        <NumberFlow value={householderStatusCounts.potential} locales="en-US" format={{ useGrouping: false }} />
                      </div>
                      <div className="text-sm opacity-70 mt-0.5">Potential</div>
                    </BwiStatusCell>
                  </div>
                </div>
              </div>
          </TabsContent>
          
          <TabsContent value="visit-history" className="mt-0 rounded-b-lg bg-background p-4">
            <div className="flex items-center justify-between mb-3">
              {/* Legend */}
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-muted-foreground">Establishment</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-muted-foreground">Householder</span>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <VisitList
                items={visits}
                getKey={(visit) => visit.id}
                renderItem={(visit, index, total) => renderVisitRow(visit, index, total, false)}
                className="space-y-6"
                isEmpty={visits.length === 0}
                emptyText="No calls recorded yet."
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Drawer for all visits */}
      <FormModal
        open={showDrawer}
        onOpenChange={(open) => {
          setShowDrawer(open);
          if (!open) setActivePanel("list");
        }}
        title={activePanel === "filters" ? "Filter Calls" : "Calls"}
        description={activePanel === "filters" ? "Filter by status and area" : undefined}
      >
        {activePanel === "filters" ? (
          <div className="pb-[calc(max(env(safe-area-inset-bottom),0px)+40px)]">
            {filterForm}
            <div className="flex justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => setActivePanel("list")}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Filter Controls - Centered when search inactive */}
            <div className={cn(
              "mb-4 w-full flex",
              isSearchActive ? "justify-start" : "justify-center"
            )}>
              <FilterControls
                isSearchActive={isSearchActive}
                searchValue={localSearchValue}
                searchInputRef={searchInputRef}
                onSearchActivate={() => {
                  setIsSearchActive(true);
                  hasFocusedRef.current = false;
                }}
                onSearchChange={(value) => {
                  // Mark that user is actively typing to prevent focus effects from running
                  isTypingRef.current = true;
                  
                  // Update local value immediately for responsive UI (client-side filtering)
                  setLocalSearchValue(value);
                  
                  // Don't update filters.search - keep search completely client-side
                  // This prevents rerenders and keeps items mounted, only unmounting items that don't match
                  
                  // Reset typing flag after a short delay to allow focus effects to run when user stops
                  setTimeout(() => {
                    isTypingRef.current = false;
                  }, 500);
                }}
                onSearchClear={() => {
                  setLocalSearchValue("");
                  // Clear search in filters too for consistency
                  clearSearch();
                  setIsSearchActive(false);
                  hasFocusedRef.current = false;
                  isTypingRef.current = false;
                }}
                onSearchBlur={() => {
                  // Mark that typing has stopped
                  isTypingRef.current = false;
                  setIsTyping(false);
                  if (!localSearchValue || localSearchValue.trim() === "") {
                    setIsSearchActive(false);
                    hasFocusedRef.current = false;
                  }
                }}
                myActive={filters.myUpdatesOnly}
                myLabel="My Visits"
                onMyActivate={() => setFilters(prev => ({ ...prev, myUpdatesOnly: true }))}
                onMyClear={() => setFilters(prev => ({ ...prev, myUpdatesOnly: false }))}
                bwiActive={filters.bwiOnly}
                bwiLabel="BWI Only"
                onBwiActivate={() => setFilters(prev => ({ ...prev, bwiOnly: true, householderOnly: false }))}
                onBwiClear={() => setFilters(prev => ({ ...prev, bwiOnly: false }))}
                householderActive={filters.householderOnly}
                householderLabel="Personal Contacts Only"
                onHouseholderActivate={() => setFilters(prev => ({ ...prev, householderOnly: true, bwiOnly: false }))}
                onHouseholderClear={() => setFilters(prev => ({ ...prev, householderOnly: false }))}
                filterBadges={filterBadges}
                onOpenFilters={() => setActivePanel("filters")}
                onClearFilters={clearFilters}
                onRemoveBadge={(badge) => {
                  if (badge.type === "status") {
                    setFilters(prev => ({ ...prev, statuses: prev.statuses.filter(s => s !== badge.value) }));
                  } else if (badge.type === "area") {
                    setFilters(prev => ({ ...prev, areas: prev.areas.filter(a => a !== badge.value) }));
                  }
                }}
                containerClassName={isSearchActive ? "w-full !max-w-none !px-0" : "justify-center"}
                maxWidthClassName={isSearchActive ? "" : "mx-4"}
              />
            </div>

            <div 
              className="relative max-h-[70vh] overflow-y-auto pb-[calc(max(env(safe-area-inset-bottom),0px)+40px)]"
              tabIndex={-1}
              onFocus={(e) => {
                // If focus moves to the scrollable container, return it to the input if user is typing
                if (isTypingRef.current && searchInputRef.current && e.target === e.currentTarget) {
                  e.preventDefault();
                  e.stopPropagation();
                  // Use setTimeout to ensure this happens after any other focus handlers
                  setTimeout(() => {
                    if (searchInputRef.current && isTypingRef.current) {
                      const input = searchInputRef.current;
                      const selectionStart = input.selectionStart;
                      const selectionEnd = input.selectionEnd;
                      input.focus();
                      if (selectionStart !== null && selectionEnd !== null) {
                        try {
                          input.setSelectionRange(selectionStart, selectionEnd);
                        } catch (e) {
                          // Ignore
                        }
                      }
                    }
                  }, 0);
                }
              }}
            >
              <motion.div 
                className="space-y-4"
                layout={!isTyping}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  {filteredVisits.map((visit, index) => (
                    <motion.div
                      key={visit.id}
                      layout={!isTyping}
                      initial={false}
                      animate={{ opacity: 1, height: "auto", y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -10 }}
                      transition={{ 
                        duration: 0.3,
                        ease: [0.4, 0, 0.2, 1],
                        layout: { duration: 0.3, ease: [0.4, 0, 0.2, 1] }
                      }}
                    >
                      {renderVisitRow(visit, index, filteredVisits.length, true)}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
              
              {loadingMore && (
                <div className="text-center py-4">
                  <div className="text-sm opacity-70">Loading more visits...</div>
                </div>
              )}
              
              {hasMore && !loadingMore && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={loadMore}
                >
                  Load More
                </Button>
              )}
              
              {!hasMore && filteredVisits.length > 0 && (
                <div className="text-center py-4">
                  <div className="text-sm opacity-70">No more visits to load</div>
                </div>
              )}
            </div>
          </>
        )}
      </FormModal>
    </>
  );
}
