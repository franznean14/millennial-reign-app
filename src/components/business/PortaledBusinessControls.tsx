"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { BusinessTabToggle } from "./BusinessTabToggle";
import { LayoutGrid, List, Table as TableIcon, X, Crosshair, ChevronLeft, Edit } from "lucide-react";
import type { BusinessFiltersState, EstablishmentWithDetails, HouseholderWithDetails } from "@/lib/db/business";
import { FilterControls, type FilterBadge } from "@/components/shared/FilterControls";

interface PortaledBusinessControlsProps {
  businessTab: 'establishments' | 'householders' | 'map';
  onBusinessTabChange: (tab: 'establishments' | 'householders' | 'map') => void;
  filters: BusinessFiltersState;
  onFiltersChange: (filters: BusinessFiltersState) => void;
  onOpenFilters: () => void;
  viewMode: 'detailed' | 'compact' | 'table';
  onCycleViewMode: () => void;
  isVisible: boolean;
  onClearSearch: () => void;
  onRemoveStatus: (status: string) => void;
  onRemoveArea: (area: string) => void;
  onRemoveFloor: (floor: string) => void;
  onClearMyEstablishments: () => void;
  onClearAllFilters: () => void;
  onToggleNearMe: () => void;
  formatStatusLabel: (status: string) => string;
  selectedEstablishment?: EstablishmentWithDetails | null;
  selectedHouseholder?: HouseholderWithDetails | null;
  onBackClick: () => void;
  onEditClick: () => void;
}

export function PortaledBusinessControls({
  businessTab,
  onBusinessTabChange,
  filters,
  onFiltersChange,
  viewMode,
  onCycleViewMode,
  onOpenFilters,
  isVisible,
  onClearSearch,
  onRemoveStatus,
  onRemoveArea,
  onRemoveFloor,
  onClearMyEstablishments,
  onClearAllFilters,
  onToggleNearMe,
  formatStatusLabel,
  selectedEstablishment,
  selectedHouseholder,
  onBackClick,
  onEditClick
}: PortaledBusinessControlsProps) {
  const [mounted, setMounted] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-activate search if there's search text
  useEffect(() => {
    if (filters.search && filters.search.trim() !== '') {
      setIsSearchActive(true);
    }
  }, [filters.search]);

  // Auto-focus search input when search becomes active
  const handleSearchFieldReady = () => {
    if (searchInputRef.current) {
      // Multiple attempts to ensure focus works
      const attemptFocus = () => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          // Force scroll into view on mobile
          searchInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };
      
      // Try immediately
      attemptFocus();
      
      // Try after animation completes (200ms)
      setTimeout(attemptFocus, 250);
      
      // One more attempt for stubborn cases
      setTimeout(attemptFocus, 400);
    }
  };

  useEffect(() => {
    if (isSearchActive) {
      // Wait for DOM update and animation
      const timer = setTimeout(() => {
        handleSearchFieldReady();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isSearchActive]);

  // Clear search and restore buttons when search is cleared
  const handleClearSearchAndRestore = () => {
    onClearSearch();
    setIsSearchActive(false);
  };

  if (!mounted) return null;

  // Check if filter button should be expanded (has statuses, areas, or floors)
  const hasFilterOptions = filters.statuses.length > 0 || filters.areas.length > 0 || filters.floors.length > 0;
  
  // Determine which buttons to show when filter is expanded
  const showOtherButtons = !hasFilterOptions && !filters.myEstablishments && !isSearchActive;

  // Get all applied filter badges
  const getAppliedFilterBadges = () => {
    const badges: FilterBadge[] = [];
    
    // Add status badges
    filters.statuses.forEach(status => {
      badges.push({
        type: 'status',
        value: status,
        label: formatStatusLabel(status)
      });
    });
    
    // Add area badges
    filters.areas.forEach(area => {
      badges.push({
        type: 'area',
        value: area,
        label: area
      });
    });
    
    // Add floor badges
    filters.floors.forEach(floor => {
      badges.push({
        type: 'floor',
        value: floor,
        label: floor
      });
    });
    
    return badges;
  };

  const badges = getAppliedFilterBadges();
  const isDetailsView = !!selectedEstablishment || !!selectedHouseholder;
  const detailsName = selectedEstablishment?.name || selectedHouseholder?.name || '';

  return createPortal(
    <div
          className={`fixed z-[100] space-y-3 px-4 ${
            typeof window !== 'undefined' && window.innerWidth >= 1024 
              ? 'left-64 right-0' // Desktop: start after sidebar (16rem = 256px = 64 in Tailwind)
              : 'left-0 right-0' // Mobile: full width
          }`}
          style={{
        top: businessTab === 'map' ? 10 : (typeof window !== 'undefined' && window.innerWidth >= 1024 ? 100 : 10) // Lower on desktop, normal on mobile
          }}
        >
          {/* Tab Navigation - Always show on mobile, even in details view */}
          {typeof window !== 'undefined' && window.innerWidth < 1024 && (
            <div className="w-full h-[52px]">
              <BusinessTabToggle
                value={businessTab}
                onValueChange={(value) => {
                  if (!isDetailsView) {
                  onBusinessTabChange(value);
                  onFiltersChange({ ...filters, statuses: [] });
                  }
                }}
                onClearStatusFilters={() => onFiltersChange({ ...filters, statuses: [] })}
                className="w-full h-full"
                isDetailsView={isDetailsView}
                detailsName={detailsName}
                onBackClick={onBackClick}
                onEditClick={onEditClick}
              />
            </div>
          )}

          {/* Desktop Details Header - Show on desktop when in details view */}
          {typeof window !== 'undefined' && window.innerWidth >= 1024 && isDetailsView && (
            <AnimatePresence mode="wait">
              <motion.div
                key="desktop-details-header"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2 w-full bg-background/95 backdrop-blur-sm border rounded-lg p-1 shadow-lg"
              >
              {/* Back Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={onBackClick}
                className="flex-shrink-0 px-3 py-2 h-9"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              {/* Name - Wider, plain text */}
              <div className="flex-[2] min-w-0 px-3 flex items-center justify-center">
                <span className="text-base font-semibold text-foreground truncate w-full text-center">
                  {detailsName}
                </span>
              </div>
              
              {/* Edit Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={onEditClick}
                className="flex-shrink-0 px-3 py-2 h-9"
              >
                <Edit className="h-4 w-4" />
              </Button>
            </motion.div>
            </AnimatePresence>
          )}

                {/* Controls Row - Toggle between buttons and search - Only show when not in details view */}
                {!isDetailsView && (
                  <motion.div
                    key="buttons-row"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-center gap-3 max-w-full px-4 ${
                      typeof window !== 'undefined' && window.innerWidth >= 1024 
                        ? 'justify-center'
                        : 'justify-center'
                    }`}
                    layout
                  >
                    <FilterControls
                      isSearchActive={isSearchActive}
                      searchValue={filters.search}
                      searchInputRef={searchInputRef}
                      onSearchActivate={() => setIsSearchActive(true)}
                      onSearchChange={(value) => onFiltersChange({ ...filters, search: value })}
                      onSearchClear={handleClearSearchAndRestore}
                      onSearchBlur={() => {
                        if (!filters.search || filters.search.trim() === '') {
                          setIsSearchActive(false);
                        }
                      }}
                      myActive={filters.myEstablishments}
                      myLabel="My Establishments"
                      onMyActivate={() => onFiltersChange({ ...filters, myEstablishments: true })}
                      onMyClear={onClearMyEstablishments}
                      filterBadges={badges}
                      onOpenFilters={onOpenFilters}
                      onClearFilters={() =>
                        onFiltersChange({
                          ...filters,
                          statuses: [],
                          areas: [],
                          floors: []
                        })
                      }
                      onRemoveBadge={(badge) => {
                        if (badge.type === 'status') {
                          onRemoveStatus(badge.value);
                        } else if (badge.type === 'area') {
                          onRemoveArea(badge.value);
                        } else if (badge.type === 'floor') {
                          onRemoveFloor(badge.value);
                        }
                      }}
                      containerClassName="justify-center"
                      maxWidthClassName="mx-4"
                    />

                    {/* Near Me Button - Only for non-map views, hidden when filters/search are active */}
                    {showOtherButtons && (
                      <AnimatePresence mode="wait">
                        {businessTab !== 'map' && (
                          filters.nearMe ? (
                            <motion.div
                              key="near-me-expanded"
                              initial={{ width: 36, opacity: 0 }}
                              animate={{ width: "auto", opacity: 1 }}
                              exit={{ width: 36, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="flex items-center gap-1"
                            >
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                className="h-9 rounded-full px-3 flex items-center gap-2"
                                onClick={onToggleNearMe}
                                aria-label="Near me"
                              >
                                <Crosshair className="h-4 w-4 flex-shrink-0" />
                                <span className="text-sm whitespace-nowrap">Near Me</span>
                                <X className="h-4 w-4 flex-shrink-0" />
                              </Button>
                            </motion.div>
                          ) : (
                            <motion.div
                              key="near-me-icon"
                              initial={{ opacity: 0, x: 40 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 40, transition: { duration: 0 } }}
                              transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 30
                              }}
                            >
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-9 w-9 rounded-full flex-shrink-0"
                                onClick={onToggleNearMe}
                                aria-pressed={false}
                                aria-label="Near me"
                                title="Near me"
                              >
                                <Crosshair className="h-4 w-4" />
                              </Button>
                            </motion.div>
                          )
                        )}
                      </AnimatePresence>
                    )}

                    {/* View Toggle - Only for non-map views, hidden when filters/search are active */}
                    {showOtherButtons && (
                      <AnimatePresence mode="wait">
                        {businessTab !== 'map' && (
                          <motion.div
                            key="view-toggle"
                            initial={{ opacity: 0, x: 40 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 40, transition: { duration: 0 } }}
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 30
                            }}
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-full flex-shrink-0"
                              onClick={onCycleViewMode}
                              title={`View: ${viewMode}`}
                            >
                              {viewMode === 'detailed' && <LayoutGrid className="h-4 w-4" />}
                              {viewMode === 'compact' && <List className="h-4 w-4" />}
                              {viewMode === 'table' && <TableIcon className="h-4 w-4" />}
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                  </motion.div>
                )}
    </div>,
    document.body
  );
}
