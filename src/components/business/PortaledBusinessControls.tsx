"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BusinessTabToggle } from "./BusinessTabToggle";
import { Search, Filter as FilterIcon, User, UserCheck, LayoutGrid, List, Table as TableIcon, X, Crosshair } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getStatusTextColor } from "@/lib/utils/status-hierarchy";
import { cn } from "@/lib/utils";
import type { BusinessFiltersState } from "@/lib/db/business";

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
  formatStatusLabel
}: PortaledBusinessControlsProps) {
  const [mounted, setMounted] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
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
    setIsSearchFocused(false);
  };

  if (!mounted) return null;

  // Check if filter button should be expanded (has statuses, areas, or floors)
  const hasFilterOptions = filters.statuses.length > 0 || filters.areas.length > 0 || filters.floors.length > 0;
  
  // Determine which buttons to show when filter is expanded
  const showOtherButtons = !hasFilterOptions;

  // Get all applied filter badges
  const getAppliedFilterBadges = () => {
    const badges: Array<{ type: 'status' | 'area' | 'floor'; value: string; label: string }> = [];
    
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

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className={`fixed z-[100] space-y-3 px-4 ${
            typeof window !== 'undefined' && window.innerWidth >= 1024 
              ? 'left-64 right-0' // Desktop: start after sidebar (16rem = 256px = 64 in Tailwind)
              : 'left-0 right-0' // Mobile: full width
          }`}
          style={{
            top: businessTab === 'map' ? 16 : (typeof window !== 'undefined' && window.innerWidth >= 1024 ? 100 : 10) // Lower on desktop, normal on mobile
          }}
        >
          {/* Tab Navigation - Only on mobile */}
          {typeof window !== 'undefined' && window.innerWidth < 1024 && (
            <motion.div 
              className="w-full"
              layout
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30
              }}
            >
              <BusinessTabToggle
                value={businessTab}
                onValueChange={(value) => {
                  onBusinessTabChange(value);
                  onFiltersChange({ ...filters, statuses: [] });
                }}
                onClearStatusFilters={() => onFiltersChange({ ...filters, statuses: [] })}
                className="w-full"
              />
            </motion.div>
          )}

                {/* Controls Row - Toggle between buttons and search */}
                <AnimatePresence mode="wait">
                  {isSearchActive ? (
                    <motion.div
                      key="search-field"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      onAnimationComplete={handleSearchFieldReady}
                      className="flex items-center gap-2 max-w-full px-4 w-full"
                    >
                      <div className="relative flex-1">
                        <Input
                          ref={searchInputRef}
                          placeholder={businessTab === 'establishments' ? "Search establishments..." : businessTab === 'householders' ? "Search householders..." : "Search locations..."}
                          value={filters.search}
                          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                          onFocus={() => setIsSearchFocused(true)}
                          onBlur={() => {
                            setIsSearchFocused(false);
                            // If search is empty when blurring, restore buttons
                            if (!filters.search || filters.search.trim() === '') {
                              setIsSearchActive(false);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                            if (e.key === 'Escape') {
                              handleClearSearchAndRestore();
                            }
                          }}
                          className="bg-background/95 backdrop-blur-sm border shadow-lg h-9 rounded-full w-full pr-10"
                        />
                        {(filters.search && filters.search.trim() !== '') && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 hover:bg-muted/50 rounded-full"
                            onClick={handleClearSearchAndRestore}
                            aria-label="Clear search"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="buttons-row"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className={`flex items-center gap-3 max-w-full px-4 ${
                        typeof window !== 'undefined' && window.innerWidth >= 1024 
                          ? 'justify-center' // Desktop: center in main content area
                          : 'justify-center' // Mobile: center as before
                      }`}
                      layout
                    >
                      {/* My Establishments Button - Expands when active, hidden when filters are expanded */}
                      {showOtherButtons && (
                        <AnimatePresence mode="wait">
                          {filters.myEstablishments ? (
                          <motion.div
                            key="my-establishments-expanded"
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
                              onClick={onClearMyEstablishments}
                              aria-label="My establishments"
                            >
                              <UserCheck className="h-4 w-4 flex-shrink-0" />
                              <span className="text-sm whitespace-nowrap">My Establishments</span>
                              <X className="h-4 w-4 flex-shrink-0" />
                            </Button>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="my-establishments-icon"
                            initial={{ width: "auto", opacity: 0 }}
                            animate={{ width: 36, opacity: 1 }}
                            exit={{ width: "auto", opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-full flex-shrink-0"
                              onClick={() => onFiltersChange({ ...filters, myEstablishments: !filters.myEstablishments })}
                              aria-pressed={false}
                              aria-label="My establishments"
                              title="My establishments"
                            >
                              <User className="h-4 w-4" />
                            </Button>
                          </motion.div>
                          )}
                        </AnimatePresence>
                      )}

                      {/* Near Me Button - Expands when active, only for non-map views, hidden when filters are expanded */}
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

                      {/* Search Button - Hidden when filters are expanded */}
                      {showOtherButtons && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-full flex-shrink-0"
                          onClick={() => {
                            setIsSearchActive(true);
                          }}
                          aria-label="Search"
                          title="Search"
                        >
                          <Search className="h-4 w-4" />
                        </Button>
                      )}

                      {/* Filter Button - Expands when filters are active */}
                      <AnimatePresence mode="wait">
                        {hasFilterOptions ? (
                          <motion.div
                            key="filter-expanded"
                            initial={{ width: 36, opacity: 0 }}
                            animate={{ width: "auto", opacity: 1 }}
                            exit={{ width: 36, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="flex items-center gap-1 max-w-[calc(100vw-3rem)] mx-4"
                          >
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="h-auto min-h-9 rounded-full px-3 py-1.5 flex items-center gap-1.5 max-w-full"
                              onClick={(e) => {
                                // If clicking a badge, don't open filter modal
                                const target = e.target as HTMLElement;
                                if (!target.closest('.filter-badge') && !target.closest('.filter-x-button')) {
                                  onOpenFilters();
                                }
                              }}
                              aria-label="Filters"
                            >
                              <FilterIcon className="h-4 w-4 flex-shrink-0" />
                              <span className="text-sm whitespace-nowrap flex-shrink-0">Filters</span>
                              <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
                                {badges.map((badge, index) => {
                                  // Contract the rightmost badges (last 2) if there are many badges
                                  const isRightmost = index >= badges.length - 2 && badges.length > 3;
                                  // Apply status color scheme for status badges, neutral for areas/floors
                                  const badgeClassName = badge.type === 'status' 
                                    ? cn(
                                        "filter-badge h-5 text-xs px-1.5 py-0 cursor-pointer hover:opacity-70 border rounded-full",
                                        getStatusTextColor(badge.value),
                                        isRightmost ? 'max-w-[60px] truncate' : 'flex-shrink-0'
                                      )
                                    : cn(
                                        "filter-badge h-5 text-xs px-1.5 py-0 cursor-pointer hover:opacity-70 border rounded-full",
                                        "text-muted-foreground border-muted-foreground/50 bg-muted",
                                        isRightmost ? 'max-w-[60px] truncate' : 'flex-shrink-0'
                                      );
                                  return (
                                    <Badge
                                      key={`${badge.type}-${badge.value}-${index}`}
                                      variant="secondary"
                                      className={badgeClassName}
                                      title={isRightmost ? badge.label : undefined}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (badge.type === 'status') {
                                          onRemoveStatus(badge.value);
                                        } else if (badge.type === 'area') {
                                          onRemoveArea(badge.value);
                                        } else if (badge.type === 'floor') {
                                          onRemoveFloor(badge.value);
                                        }
                                      }}
                                    >
                                      {badge.label}
                                    </Badge>
                                  );
                                })}
                              </div>
                              <div
                                className="filter-x-button h-4 w-4 flex-shrink-0 flex items-center justify-center cursor-pointer hover:opacity-70"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  onFiltersChange({
                                    ...filters,
                                    statuses: [],
                                    areas: [],
                                    floors: []
                                  });
                                }}
                                aria-label="Clear filters"
                              >
                                <X className="h-4 w-4" />
                              </div>
                            </Button>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="filter-icon"
                            initial={{ width: "auto", opacity: 0 }}
                            animate={{ width: 36, opacity: 1 }}
                            exit={{ width: "auto", opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-9 w-9 rounded-full flex-shrink-0"
                              onClick={onOpenFilters}
                              title="Filters"
                            >
                              <FilterIcon className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* View Toggle - Only for non-map views, hidden when filters are expanded */}
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
                </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
