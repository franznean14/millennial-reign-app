"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { BusinessTabToggle } from "@/components/business/BusinessTabToggle";
import { CongregationTabToggle } from "@/components/congregation/CongregationTabToggle";
import { HomeTabToggle } from "@/components/home/HomeTabToggle";
import { AccountTabToggle } from "@/components/account/AccountTabToggle";
import { FilterControls, type FilterBadge } from "@/components/shared/FilterControls";
import { buildFilterBadges } from "@/lib/utils/filter-badges";
import { LayoutGrid, List, Table as TableIcon, X, Crosshair, ChevronLeft, Edit } from "lucide-react";
import type { BusinessFiltersState, EstablishmentWithDetails, HouseholderWithDetails } from "@/lib/db/business";

interface UnifiedPortaledControlsProps {
  currentSection: string;
  // Business props
  businessTab?: 'establishments' | 'householders' | 'map';
  onBusinessTabChange?: (tab: 'establishments' | 'householders' | 'map') => void;
  filters?: BusinessFiltersState;
  onFiltersChange?: (filters: BusinessFiltersState) => void;
  onOpenFilters?: () => void;
  viewMode?: 'detailed' | 'compact' | 'table';
  onCycleViewMode?: () => void;
  onClearSearch?: () => void;
  onRemoveStatus?: (status: string) => void;
  onRemoveArea?: (area: string) => void;
  onRemoveFloor?: (floor: string) => void;
  onClearMyEstablishments?: () => void;
  onClearAllFilters?: () => void;
  onToggleNearMe?: () => void;
  formatStatusLabel?: (status: string) => string;
  selectedEstablishment?: EstablishmentWithDetails | null;
  selectedHouseholder?: HouseholderWithDetails | null;
  onBackClick?: () => void;
  onEditClick?: () => void;
  // Congregation props
  congregationTab?: 'meetings' | 'ministry' | 'admin';
  onCongregationTabChange?: (tab: 'meetings' | 'ministry' | 'admin') => void;
  congregationSelectedHouseholder?: HouseholderWithDetails | null;
  onCongregationBackClick?: () => void;
  onCongregationEditClick?: () => void;
  isElder?: boolean;
  // Home props
  homeTab?: 'summary' | 'events';
  onHomeTabChange?: (tab: 'summary' | 'events') => void;
  // Account props
  accountTab?: 'profile' | 'account';
  onAccountTabChange?: (tab: 'profile' | 'account') => void;
}

function BusinessControlsContent({
  businessTab,
  onBusinessTabChange,
  filters,
  onFiltersChange,
  onOpenFilters,
  viewMode,
  onCycleViewMode,
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
}: {
  businessTab: 'establishments' | 'householders' | 'map';
  onBusinessTabChange: (tab: 'establishments' | 'householders' | 'map') => void;
  filters: BusinessFiltersState;
  onFiltersChange: (filters: BusinessFiltersState) => void;
  onOpenFilters: () => void;
  viewMode: 'detailed' | 'compact' | 'table';
  onCycleViewMode: () => void;
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
}) {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (filters.search && filters.search.trim() !== "") {
      setIsSearchActive(true);
    }
  }, [filters.search]);

  const handleSearchFieldReady = () => {
    if (searchInputRef.current) {
      const attemptFocus = () => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      };
      attemptFocus();
      setTimeout(attemptFocus, 250);
      setTimeout(attemptFocus, 400);
    }
  };

  useEffect(() => {
    if (isSearchActive) {
      const timer = setTimeout(() => {
        handleSearchFieldReady();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isSearchActive]);

  const handleClearSearchAndRestore = () => {
    onClearSearch();
    setIsSearchActive(false);
  };

  const hasFilterOptions = filters.statuses.length > 0 || filters.areas.length > 0 || filters.floors.length > 0;
  const showOtherButtons = !hasFilterOptions && !filters.myEstablishments && !isSearchActive;
  const badges: FilterBadge[] = buildFilterBadges({
    statuses: filters.statuses,
    areas: filters.areas,
    floors: filters.floors,
    formatStatusLabel
  });
  const isDetailsView = !!selectedEstablishment || !!selectedHouseholder;
  const detailsName = selectedEstablishment?.name || selectedHouseholder?.name || "";

  return (
    <div
      className={`absolute z-[100] pointer-events-auto space-y-3 px-4 ${
        typeof window !== "undefined" && window.innerWidth >= 1024 ? "left-64 right-0" : "left-0 right-0"
      }`}
      style={{
        top: businessTab === "map"
          ? "calc(var(--device-safe-top, 0px) + 10px)"
          : typeof window !== "undefined" && window.innerWidth >= 1024
            ? "calc(var(--device-safe-top, 0px) + 100px)"
            : "calc(var(--device-safe-top, 0px) + 10px)"
      }}
    >
      {typeof window !== "undefined" && window.innerWidth < 1024 && (
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

      {typeof window !== "undefined" && window.innerWidth >= 1024 && isDetailsView && (
        <AnimatePresence mode="wait">
          <motion.div
            key="desktop-details-header"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 w-full bg-background/95 backdrop-blur-sm border rounded-lg p-1 shadow-lg"
          >
            <Button variant="ghost" size="sm" onClick={onBackClick} className="flex-shrink-0 px-3 py-2 h-9">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-[2] min-w-0 px-3 flex items-center justify-center">
              <span className="text-base font-semibold text-foreground truncate w-full text-center">{detailsName}</span>
            </div>
            <Button variant="outline" size="sm" onClick={onEditClick} className="flex-shrink-0 px-3 py-2 h-9">
              <Edit className="h-4 w-4" />
            </Button>
          </motion.div>
        </AnimatePresence>
      )}

      {!isDetailsView && (
        <motion.div
          key="buttons-row"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-3 max-w-full px-4 justify-center"
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
              if (!filters.search || filters.search.trim() === "") {
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
              if (badge.type === "status") {
                onRemoveStatus(badge.value);
              } else if (badge.type === "area") {
                onRemoveArea(badge.value);
              } else if (badge.type === "floor") {
                onRemoveFloor(badge.value);
              }
            }}
            containerClassName="justify-center"
            maxWidthClassName="mx-4"
          />

          {showOtherButtons && (
            <AnimatePresence mode="wait">
              {businessTab !== "map" && (
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
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
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

          {showOtherButtons && (
            <AnimatePresence mode="wait">
              {businessTab !== "map" && (
                <motion.div
                  key="view-toggle"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40, transition: { duration: 0 } }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full flex-shrink-0"
                    onClick={onCycleViewMode}
                    title={`View: ${viewMode}`}
                  >
                    {viewMode === "detailed" && <LayoutGrid className="h-4 w-4" />}
                    {viewMode === "compact" && <List className="h-4 w-4" />}
                    {viewMode === "table" && <TableIcon className="h-4 w-4" />}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </motion.div>
      )}
    </div>
  );
}

function CongregationControlsContent({
  congregationTab,
  onCongregationTabChange,
  isElder,
  selectedHouseholder,
  onBackClick,
  onEditClick
}: {
  congregationTab: 'meetings' | 'ministry' | 'admin';
  onCongregationTabChange: (tab: 'meetings' | 'ministry' | 'admin') => void;
  isElder?: boolean;
  selectedHouseholder?: HouseholderWithDetails | null;
  onBackClick?: () => void;
  onEditClick?: () => void;
}) {
  const isDetailsView = !!selectedHouseholder;
  const detailsName = selectedHouseholder?.name || "";

  return (
    <div
      className={`absolute z-[100] pointer-events-auto space-y-3 px-4 ${
        typeof window !== "undefined" && window.innerWidth >= 1024 ? "left-64 right-0" : "left-0 right-0"
      }`}
      style={{
        top: typeof window !== "undefined" && window.innerWidth >= 1024
          ? "calc(var(--device-safe-top, 0px) + 100px)"
          : "calc(var(--device-safe-top, 0px) + 10px)"
      }}
    >
      {typeof window !== "undefined" && window.innerWidth < 1024 && (
        <div className="w-full h-[52px]">
          <CongregationTabToggle
            value={congregationTab}
            onValueChange={onCongregationTabChange}
            className="w-full h-full"
            isElder={isElder}
            isDetailsView={isDetailsView}
            detailsName={detailsName}
            onBackClick={onBackClick}
            onEditClick={onEditClick}
          />
        </div>
      )}

      {typeof window !== "undefined" && window.innerWidth >= 1024 && isDetailsView && (
        <AnimatePresence mode="wait">
          <motion.div
            key="desktop-details-header"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 w-full bg-background/95 backdrop-blur-sm border rounded-lg p-1 shadow-lg"
          >
            <Button variant="ghost" size="sm" onClick={onBackClick} className="flex-shrink-0 px-3 py-2 h-9">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex-[2] min-w-0 px-3 flex items-center justify-center">
              <span className="text-base font-semibold text-foreground truncate w-full text-center">{detailsName}</span>
            </div>
            <Button variant="outline" size="sm" onClick={onEditClick} className="flex-shrink-0 px-3 py-2 h-9">
              <Edit className="h-4 w-4" />
            </Button>
          </motion.div>
        </AnimatePresence>
      )}

      {typeof window !== "undefined" && window.innerWidth >= 1024 && !isDetailsView && (
        <div className="w-full h-[52px]">
          <CongregationTabToggle
            value={congregationTab}
            onValueChange={onCongregationTabChange}
            className="w-full h-full"
            isElder={isElder}
          />
        </div>
      )}
    </div>
  );
}

function HomeControlsContent({
  homeTab,
  onHomeTabChange
}: {
  homeTab: 'summary' | 'events';
  onHomeTabChange: (tab: 'summary' | 'events') => void;
}) {
  return (
    <div
      className={`absolute z-[100] pointer-events-auto space-y-3 px-4 ${
        typeof window !== "undefined" && window.innerWidth >= 1024 ? "left-64 right-0" : "left-0 right-0"
      }`}
      style={{
        top: typeof window !== "undefined" && window.innerWidth >= 1024
          ? "calc(var(--device-safe-top, 0px) + 100px)"
          : "calc(var(--device-safe-top, 0px) + 10px)"
      }}
    >
      <div className="w-full h-[52px]">
        <HomeTabToggle value={homeTab} onValueChange={onHomeTabChange} className="w-full h-full" />
      </div>
    </div>
  );
}

function AccountControlsContent({
  accountTab,
  onAccountTabChange
}: {
  accountTab: 'profile' | 'account';
  onAccountTabChange: (tab: 'profile' | 'account') => void;
}) {
  return (
    <div
      className={`absolute z-[100] pointer-events-auto space-y-3 px-4 ${
        typeof window !== "undefined" && window.innerWidth >= 1024 ? "left-64 right-0" : "left-0 right-0"
      }`}
      style={{
        top: typeof window !== "undefined" && window.innerWidth >= 1024
          ? "calc(var(--device-safe-top, 0px) + 100px)"
          : "calc(var(--device-safe-top, 0px) + 10px)"
      }}
    >
      <div className="w-full h-[52px]">
        <AccountTabToggle value={accountTab} onValueChange={onAccountTabChange} className="w-full h-full" />
      </div>
    </div>
  );
}

export function UnifiedPortaledControls(props: UnifiedPortaledControlsProps) {
  const { currentSection } = props;
  const [mounted, setMounted] = useState(false);
  const showBusinessControls = currentSection === 'business' || currentSection.startsWith('business-');
  const showCongregationControls = currentSection === 'congregation';
  const showHomeControls = currentSection === 'home';
  const showAccountControls = currentSection === 'account';

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const content = showBusinessControls && props.businessTab !== undefined ? (
    <BusinessControlsContent
      businessTab={props.businessTab}
      onBusinessTabChange={props.onBusinessTabChange!}
      filters={props.filters!}
      onFiltersChange={props.onFiltersChange!}
      onOpenFilters={props.onOpenFilters!}
      viewMode={props.viewMode!}
      onCycleViewMode={props.onCycleViewMode!}
      onClearSearch={props.onClearSearch!}
      onRemoveStatus={props.onRemoveStatus!}
      onRemoveArea={props.onRemoveArea!}
      onRemoveFloor={props.onRemoveFloor!}
      onClearMyEstablishments={props.onClearMyEstablishments!}
      onClearAllFilters={props.onClearAllFilters!}
      onToggleNearMe={props.onToggleNearMe!}
      formatStatusLabel={props.formatStatusLabel!}
      selectedEstablishment={props.selectedEstablishment}
      selectedHouseholder={props.selectedHouseholder}
      onBackClick={props.onBackClick!}
      onEditClick={props.onEditClick!}
    />
  ) : showCongregationControls && props.congregationTab !== undefined ? (
    <CongregationControlsContent
      congregationTab={props.congregationTab}
      onCongregationTabChange={props.onCongregationTabChange!}
      isElder={props.isElder}
      selectedHouseholder={props.congregationSelectedHouseholder}
      onBackClick={props.onCongregationBackClick}
      onEditClick={props.onCongregationEditClick}
    />
  ) : showHomeControls && props.homeTab !== undefined ? (
    <HomeControlsContent homeTab={props.homeTab} onHomeTabChange={props.onHomeTabChange!} />
  ) : showAccountControls && props.accountTab !== undefined ? (
    <AccountControlsContent accountTab={props.accountTab} onAccountTabChange={props.onAccountTabChange!} />
  ) : null;

  if (!content) return null;

  return createPortal(
    <div data-portaled-controls>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSection}
          initial={{ opacity: 0, filter: "blur(6px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 pointer-events-none"
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
}
