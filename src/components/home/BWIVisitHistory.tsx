"use client";

import { useEffect, useState, useRef } from "react";
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

interface BWIVisitHistoryProps {
  userId: string;
  onVisitClick?: (visit: VisitRecord) => void;
}

export function BWIVisitHistory({ userId, onVisitClick }: BWIVisitHistoryProps) {
  const [showDrawer, setShowDrawer] = useState(false);
  const [activePanel, setActivePanel] = useState<"list" | "filters">("list");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const {
    visits,
    loading,
    allVisitsRawCount,
    filteredVisits,
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

  // Apply all filters to visits (handled by hook)

  const handleSeeMore = () => {
    setShowDrawer(true);
    // Only load if we don't have data yet
    // If data already exists, don't reload to avoid the snap/re-render
    if (allVisitsRawCount === 0) {
      loadAllVisits(0, false); // Don't force refresh on initial load to use cache smoothly
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

  // Auto-focus search input when search becomes active
  useEffect(() => {
    if (isSearchActive && searchInputRef.current) {
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isSearchActive]);

  // Auto-activate search if there's search text
  useEffect(() => {
    if (filters.search && filters.search.trim() !== '') {
      setIsSearchActive(true);
    }
  }, [filters.search]);

  if (loading) {
    return (
      <div className="rounded-lg border p-4">
        <div className="text-sm font-medium mb-2 text-foreground">BWI Visit History</div>
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
            BWI Visit History
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
        title={activePanel === "filters" ? "Filter Visits" : "BWI Visit History"}
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
            {/* Filter Controls - Centered */}
            <div className="mb-4 flex justify-center">
              <FilterControls
                isSearchActive={isSearchActive}
                searchValue={filters.search}
                searchInputRef={searchInputRef}
                onSearchActivate={() => setIsSearchActive(true)}
                onSearchChange={(value) => setFilters(prev => ({ ...prev, search: value }))}
                onSearchClear={() => {
                  clearSearch();
                  setIsSearchActive(false);
                }}
                onSearchBlur={() => {
                  if (!filters.search || filters.search.trim() === "") {
                    setIsSearchActive(false);
                  }
                }}
                myActive={filters.myUpdatesOnly}
                myLabel="My Updates"
                onMyActivate={() => setFilters(prev => ({ ...prev, myUpdatesOnly: true }))}
                onMyClear={() => setFilters(prev => ({ ...prev, myUpdatesOnly: false }))}
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
                containerClassName="justify-center"
                maxWidthClassName="mx-4"
              />
            </div>

            <div className="relative max-h-[70vh] overflow-y-auto">
              <motion.div 
                className="space-y-4"
                layout
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              >
                <AnimatePresence mode="popLayout">
                  {filteredVisits.map((visit, index) => (
                    <motion.div
                      key={visit.id}
                      layout
                      initial={{ opacity: 0, height: 0, y: -10 }}
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
