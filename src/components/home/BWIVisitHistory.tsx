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
import { getBwiVisitsPage, getRecentBwiVisits } from "@/lib/db/visit-history";
import { VisitTimelineRow } from "@/components/visit/VisitTimelineRow";
import { FilterControls, type FilterBadge } from "@/components/shared/FilterControls";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useMobile } from "@/lib/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface BWIVisitHistoryProps {
  userId: string;
  onVisitClick?: (visit: VisitRecord) => void;
}

interface VisitFilters {
  search: string;
  statuses: string[];
  areas: string[];
  myUpdatesOnly: boolean;
}

export function BWIVisitHistory({ userId, onVisitClick }: BWIVisitHistoryProps) {
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [allVisitsRaw, setAllVisitsRaw] = useState<VisitRecord[]>([]); // Store all visits without filtering
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState<VisitFilters>({
    search: "",
    statuses: [],
    areas: [],
    myUpdatesOnly: false,
  });
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useMobile();

  // Get dynamic filter options from available visits
  const filterOptions = useMemo(() => {
    const statusSet = new Set<string>();
    const areaSet = new Set<string>();
    
    allVisitsRaw.forEach(visit => {
      if (visit.establishment_status) {
        statusSet.add(visit.establishment_status);
      }
      if (visit.establishment_area) {
        areaSet.add(visit.establishment_area);
      }
    });

    return {
      statuses: Array.from(statusSet).map(status => ({
        value: status,
        label: formatStatusText(status)
      })),
      areas: Array.from(areaSet).map(area => ({
        value: area,
        label: area
      }))
    };
  }, [allVisitsRaw]);

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

  // Apply all filters to visits
  const allVisits = useMemo(() => {
    let filtered = [...allVisitsRaw];

    // Filter by my updates
    if (filters.myUpdatesOnly) {
      filtered = filtered.filter(visit => visit.publisher_id === userId);
    }

    // Filter by search
    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(visit => {
        const name = (visit.householder_name || visit.establishment_name || "").toLowerCase();
        const notes = (visit.notes || "").toLowerCase();
        return name.includes(searchLower) || notes.includes(searchLower);
      });
    }

    // Filter by status
    if (filters.statuses.length > 0) {
      filtered = filtered.filter(visit => 
        visit.establishment_status && filters.statuses.includes(visit.establishment_status)
      );
    }

    // Filter by area
    if (filters.areas.length > 0) {
      filtered = filtered.filter(visit => 
        visit.establishment_area && filters.areas.includes(visit.establishment_area)
      );
    }

    return filtered;
  }, [allVisitsRaw, filters, userId]);

  // Load initial visits (last 5) - show all visits
  useEffect(() => {
    const loadInitialVisits = async () => {
      if (!userId) return;
      
      setLoading(true);
      
      try {
        const sortedVisits = await getRecentBwiVisits(5);
        setVisits(sortedVisits);
      } catch (error) {
        console.error('Error loading visit history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialVisits();
  }, [userId]);

  // Load all visits for drawer
  const loadAllVisits = async (offset = 0) => {
    if (!userId) return;
    
    setLoadingMore(true);
    
    try {
      const sortedVisits = await getBwiVisitsPage({ userId, offset, pageSize: 20 });

      if (offset === 0) {
        setAllVisitsRaw(sortedVisits);
      } else {
        setAllVisitsRaw(prev => [...prev, ...sortedVisits]);
      }

      setHasMore(sortedVisits.length === 40); // 20 from each query
    } catch (error) {
      console.error('Error loading more visits:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSeeMore = () => {
    setShowDrawer(true);
    // Always load data when drawer opens
    loadAllVisits(0);
  };

  // Load data when drawer opens (only once, not when filter changes)
  useEffect(() => {
    if (showDrawer && allVisitsRaw.length === 0) {
      loadAllVisits(0);
    }
  }, [showDrawer]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadAllVisits(allVisits.length);
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

  // Helper function to get faded status color
  function getFadedStatusColor(status: string) {
    switch (status) {
      case 'inappropriate':
        return 'text-red-800/50 border-red-800/30';
      case 'declined_rack':
        return 'text-red-500/50 border-red-500/30';
      case 'for_scouting':
        return 'text-cyan-500/50 border-cyan-500/30';
      case 'for_follow_up':
        return 'text-orange-500/50 border-orange-500/30';
      case 'accepted_rack':
        return 'text-blue-500/50 border-blue-500/30';
      case 'for_replenishment':
        return 'text-purple-500/50 border-purple-500/30';
      case 'has_bible_studies':
        return 'text-emerald-500/50 border-emerald-500/30';
      case 'closed':
        return 'text-slate-500/50 border-slate-500/30';
      default:
        return 'text-gray-500/50 border-gray-500/30';
    }
  }

  // Helper function to get selected status color
  function getSelectedStatusColor(status: string) {
    switch (status) {
      case 'inappropriate':
        return 'text-red-800 border-red-800 bg-red-800/5';
      case 'declined_rack':
        return 'text-red-500 border-red-500 bg-red-500/5';
      case 'for_scouting':
        return 'text-cyan-500 border-cyan-500 bg-cyan-500/5';
      case 'for_follow_up':
        return 'text-orange-500 border-orange-500 bg-orange-500/5';
      case 'accepted_rack':
        return 'text-blue-500 border-blue-500 bg-blue-500/5';
      case 'for_replenishment':
        return 'text-purple-500 border-purple-500 bg-purple-500/5';
      case 'has_bible_studies':
        return 'text-emerald-500 border-emerald-500 bg-emerald-500/10';
      case 'closed':
        return 'text-slate-500 border-slate-500 bg-slate-500/5';
      default:
        return 'text-gray-500 border-gray-500 bg-gray-500/5';
    }
  }

  // Render filter form
  function renderFilterForm() {
    const toggleStatus = (status: string) => {
      setFilters(prev => ({
        ...prev,
        statuses: prev.statuses.includes(status)
          ? prev.statuses.filter(s => s !== status)
          : [...prev.statuses, status]
      }));
    };

    const toggleArea = (area: string) => {
      setFilters(prev => ({
        ...prev,
        areas: prev.areas.includes(area)
          ? prev.areas.filter(a => a !== area)
          : [...prev.areas, area]
      }));
    };

    const clearFilters = () => {
      setFilters(prev => ({
        ...prev,
        statuses: [],
        areas: []
      }));
    };

    const hasActiveFilters = filters.statuses.length > 0 || filters.areas.length > 0;

    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex flex-wrap gap-2">
              {filterOptions.statuses.map((option) => {
                const isSelected = filters.statuses.includes(option.value);
                return (
                  <Button
                    key={option.value}
                    variant="outline"
                    size="sm"
                    onClick={() => toggleStatus(option.value)}
                    className={cn(
                      "h-8 border rounded-full",
                      isSelected
                        ? getSelectedStatusColor(option.value)
                        : getFadedStatusColor(option.value)
                    )}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Areas</Label>
            <div className="flex flex-wrap gap-2">
              {filterOptions.areas.map((option) => (
                <Button
                  key={option.value}
                  variant={filters.areas.includes(option.value) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleArea(option.value)}
                  className="h-8"
                >
                  {option.value}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="w-full"
          >
            Clear Filters
          </Button>
        )}
      </div>
    );
  }

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
              {allVisits.map((visit, index) => (
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
                  {renderVisitRow(visit, index, allVisits.length, true)}
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
          
          {!hasMore && allVisits.length > 0 && (
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
              {renderFilterForm()}
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
              {renderFilterForm()}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
