"use client";

import { useEffect, useLayoutEffect, useState, useRef } from "react";
import { formatVisitDateLong, getVisitDisplayName } from "@/lib/utils/visit-history-ui";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/shared/FormModal";
import { Calendar, ChevronRight } from "lucide-react";
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

interface VisitHistoryProps {
  userId: string;
  onVisitClick?: (visit: VisitRecord) => void;
}

export function VisitHistory({ userId, onVisitClick }: VisitHistoryProps) {
  const [showDrawer, setShowDrawer] = useState(false);
  const [activePanel, setActivePanel] = useState<"list" | "filters">("list");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
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

  const formatVisitDate = formatVisitDateLong;

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
      <div className="rounded-lg border p-4">
        <div className="text-sm font-medium mb-2 text-foreground">Visit History</div>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <button 
            onClick={handleSeeMore}
            className="flex items-center gap-2 text-sm font-bold text-foreground hover:opacity-80 transition-opacity"
          >
            Visit History
            <ChevronRight className="h-4 w-4" />
          </button>
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
            emptyText="No visits recorded yet."
          />
        </div>
      </div>

      {/* Drawer for all visits */}
      <FormModal
        open={showDrawer}
        onOpenChange={(open) => {
          setShowDrawer(open);
          if (!open) setActivePanel("list");
        }}
        title={activePanel === "filters" ? "Filter Visits" : "Visit History"}
        description={activePanel === "filters" ? "Filter by status and area" : "Complete visit history with infinite scroll"}
      >
        {activePanel === "filters" ? (
          <div className="pb-6">
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
                householderLabel="Householder Only"
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
              className="relative max-h-[70vh] overflow-y-auto"
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
