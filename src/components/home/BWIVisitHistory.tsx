"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { formatVisitDateLong, getInitials, getPublisherName } from "@/lib/utils/visit-history-ui";
import { Button } from "@/components/ui/button";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Calendar, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { getStatusTextColor, getStatusColor } from "@/lib/utils/status-hierarchy";
import { formatStatusText } from "@/lib/utils/formatters";
import type { VisitRecord } from "@/lib/utils/visit-history";
import { useBwiVisitHistory } from "@/lib/hooks/use-bwi-visit-history";
import { VisitTimelineRow } from "@/components/visit/VisitTimelineRow";
import { FilterControls, type FilterBadge } from "@/components/shared/FilterControls";
import { VisitFiltersForm } from "@/components/visit/VisitFiltersForm";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useMobile } from "@/lib/hooks/use-mobile";

interface BWIVisitHistoryProps {
  userId: string;
  onVisitClick?: (visit: VisitRecord) => void;
}

export function BWIVisitHistory({ userId, onVisitClick }: BWIVisitHistoryProps) {
  const [showDrawer, setShowDrawer] = useState(false);
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useMobile();

  const {
    visits,
    loading,
    allVisitsRawCount,
    filteredVisits,
    filterOptions,
    filters,
    setFilters,
    loadAllVisits,
    loadingMore,
    hasMore
  } = useBwiVisitHistory({ userId });

  const filterBadges = useMemo<FilterBadge[]>(() => {
    const badges: Array<{ type: "status" | "area"; value: string; label: string }> = [];
    filters.statuses.forEach(status => {
      badges.push({ type: "status", value: status, label: formatStatusText(status) });
    });
    filters.areas.forEach(area => {
      badges.push({ type: "area", value: area, label: area });
    });
    return badges;
  }, [filters.statuses, filters.areas]);

  const hasActiveFilters = filterBadges.length > 0;

  // Apply all filters to visits (handled by hook)

  const handleSeeMore = () => {
    setShowDrawer(true);
    // Always load data when drawer opens
    loadAllVisits(0);
  };

  // Load data when drawer opens (only once, not when filter changes)
  useEffect(() => {
    if (showDrawer && allVisitsRawCount === 0) {
      loadAllVisits(0);
    }
  }, [showDrawer, allVisitsRawCount, loadAllVisits]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadAllVisits(allVisitsRawCount);
    }
  };

  const formatVisitDate = (dateString: string) => formatVisitDateLong(dateString);

  const getVisitTypeColor = (type: 'establishment' | 'householder') => {
    return type === 'establishment' ? 'bg-blue-500' : 'bg-green-500';
  };

  const renderVisitRow = (visit: VisitRecord, index: number, total: number, isDrawer: boolean) => {
    const publisherName = getPublisherName(visit.publisher || null);
    const lineHeight = "calc(100% + 1rem)";

    return (
      <VisitTimelineRow
        onClick={() => handleVisitClick(visit)}
        index={index}
        total={total}
        rootClassName="hover:opacity-80 transition-opacity"
        lineStyle={{ left: 6, top: 12, height: lineHeight, zIndex: 0 }}
        dot={
          <div
            className={`w-3 h-3 rounded-full ${getVisitTypeColor(visit.visit_type)} relative z-10 flex-shrink-0`}
          />
        }
        contentClassName="ml-3"
        avatarClassName="ml-4"
        avatar={
          visit.publisher && (
            <>
              {visit.publisher.avatar_url ? (
                <Image
                  src={visit.publisher.avatar_url}
                  alt={publisherName}
                  width={24}
                  height={24}
                  className="rounded-full object-cover ring-2 ring-background w-6 h-6"
                />
              ) : (
                <div className="rounded-full bg-gray-600 flex items-center justify-center text-white text-[10px] ring-2 ring-background w-6 h-6">
                  {getInitials(publisherName)}
                </div>
              )}
              {visit.partner && (
                <Image
                  src={visit.partner.avatar_url || ""}
                  alt={`${visit.partner.first_name} ${visit.partner.last_name}`}
                  width={24}
                  height={24}
                  className="rounded-full object-cover ring-2 ring-background -ml-2 w-6 h-6"
                />
              )}
            </>
          )
        }
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-foreground">
            {visit.householder_name || visit.establishment_name}
          </span>
          {visit.visit_type === "householder" && visit.establishment_name && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full border ${getStatusTextColor(
                visit.establishment_status || "for_scouting"
              )}`}
              title={`Status: ${visit.establishment_status || "for_scouting"}`}
            >
              {visit.establishment_name}
            </span>
          )}
        </div>
        <div className={`flex items-center gap-1 text-xs text-muted-foreground ${isDrawer ? "mb-2" : ""}`}>
          <Calendar className="h-3 w-3" />
          {formatVisitDate(visit.visit_date)}
        </div>
        {visit.notes && (
          <div className={`text-xs text-muted-foreground ${isDrawer ? "leading-relaxed" : "mt-1 line-clamp-1"}`}>
            {visit.notes}
          </div>
        )}
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

  if (visits.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <div className="text-sm font-medium mb-2 text-foreground">BWI Visit History</div>
        <div className="text-sm text-muted-foreground">No visits recorded yet.</div>
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
          <div className="space-y-6">
            {visits.map((visit, index) => (
              <div key={visit.id} className="contents">
                {renderVisitRow(visit, index, visits.length, false)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Drawer for all visits */}
      <ResponsiveModal
        open={showDrawer}
        onOpenChange={setShowDrawer}
        title="BWI Visit History"
        description="Complete visit history with infinite scroll"
      >
        {/* Filter Controls - Centered */}
        <div className="mb-4 flex justify-center">
          <FilterControls
            isSearchActive={isSearchActive}
            searchValue={filters.search}
            searchInputRef={searchInputRef}
            onSearchActivate={() => setIsSearchActive(true)}
            onSearchChange={(value) => setFilters(prev => ({ ...prev, search: value }))}
            onSearchClear={() => {
              setFilters(prev => ({ ...prev, search: "" }));
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
            onOpenFilters={() => setFiltersModalOpen(true)}
            onClearFilters={() => setFilters(prev => ({ ...prev, statuses: [], areas: [] }))}
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
              onClick={handleLoadMore}
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
      </ResponsiveModal>

      {/* Filter Form Drawer/Modal */}
      {isMobile ? (
        <Drawer open={filtersModalOpen} onOpenChange={setFiltersModalOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Filter Visits</DrawerTitle>
              <DrawerDescription>Filter by status and area</DrawerDescription>
            </DrawerHeader>
            <div className="px-4 pb-4">
              <VisitFiltersForm
                filters={filters}
                statusOptions={filterOptions.statuses}
                areaOptions={filterOptions.areas}
                onFiltersChange={setFilters}
                onClearFilters={() =>
                  setFilters(prev => ({
                    ...prev,
                    statuses: [],
                    areas: []
                  }))
                }
              />
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={filtersModalOpen} onOpenChange={setFiltersModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Filter Visits</DialogTitle>
              <DialogDescription>Filter by status and area</DialogDescription>
            </DialogHeader>
            <div className="px-4">
              <VisitFiltersForm
                filters={filters}
                statusOptions={filterOptions.statuses}
                areaOptions={filterOptions.areas}
                onFiltersChange={setFilters}
                onClearFilters={() =>
                  setFilters(prev => ({
                    ...prev,
                    statuses: [],
                    areas: []
                  }))
                }
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
