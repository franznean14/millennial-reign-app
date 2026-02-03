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
import { cn } from "@/lib/utils";
import { LayoutGrid, List, Table as TableIcon, X, Crosshair, ChevronLeft, Edit } from "lucide-react";
import type { BusinessFiltersState, EstablishmentWithDetails, HouseholderWithDetails } from "@/lib/db/business";
import {
  getHeaderToastState,
  subscribeHeaderToast,
  type HeaderToastVariant,
} from "@/lib/header-toast-store";

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

type HeaderToastProp = { message: string; variant: HeaderToastVariant } | null;

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
  onEditClick,
  headerToast = null
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
  headerToast?: HeaderToastProp;
}) {
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
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
    setIsExiting(true);
    // Delay the state change to allow exit animation to complete
    setTimeout(() => {
      setIsSearchActive(false);
      setIsExiting(false);
    }, 300);
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
  // When both are set we're on householder details (opened from establishment); show householder name
  const detailsName = selectedHouseholder?.name || selectedEstablishment?.name || "";

  return (
    <div
      className={`absolute z-[100] pointer-events-auto space-y-3 px-4 ${
        typeof window !== "undefined" && window.innerWidth >= 1024 ? "left-64 right-0" : "left-0 right-0"
      }`}
      style={{
        top: businessTab === "map"
          ? typeof window !== "undefined" && window.innerWidth >= 1024 && !isDetailsView
            ? "calc(var(--device-safe-top, 0px) + 10px)"
            : "calc(var(--device-safe-top, 0px) + 10px)"
          : typeof window !== "undefined" && window.innerWidth >= 1024
            ? "calc(var(--device-safe-top, 0px) + 100px)"
            : "calc(var(--device-safe-top, 0px) + 10px)"
      }}
    >
      {typeof window !== "undefined" && window.innerWidth < 1024 && (
        <div className="w-full h-[52px] overflow-hidden">
          <AnimatePresence mode="wait">
            {headerToast?.message ? (
              <motion.div
                key="toast"
                initial={headerToastInitial}
                animate={headerToastAnimate}
                exit={headerToastExit}
                transition={headerToastTransition}
                className={cn("w-full h-full flex items-center justify-center rounded-lg border px-4 text-center", TOAST_VARIANT_STYLES[headerToast.variant])}
              >
                <span className="text-sm font-medium line-clamp-2">{headerToast.message}</span>
              </motion.div>
            ) : (
              <motion.div
                key="normal"
                initial={headerToastInitial}
                animate={headerToastAnimate}
                exit={headerToastExit}
                transition={headerToastTransition}
                className="w-full h-full"
              >
                <BusinessTabToggle
                  value={businessTab}
                  onValueChange={(value) => {
                    if (!isDetailsView) {
                      onBusinessTabChange(value);
                    }
                  }}
                  onClearStatusFilters={() => onFiltersChange({ ...filters, statuses: [] })}
                  className="w-full h-full"
                  isDetailsView={isDetailsView}
                  detailsName={detailsName}
                  onBackClick={onBackClick}
                  onEditClick={onEditClick}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {typeof window !== "undefined" && window.innerWidth >= 1024 && !isDetailsView && (
        <div className="w-full h-[52px] mb-2 overflow-hidden">
          <AnimatePresence mode="wait">
            {headerToast?.message ? (
              <motion.div
                key="toast"
                initial={headerToastInitial}
                animate={headerToastAnimate}
                exit={headerToastExit}
                transition={headerToastTransition}
                className={cn("w-full h-full flex items-center justify-center rounded-lg border px-4 text-center", TOAST_VARIANT_STYLES[headerToast.variant])}
              >
                <span className="text-sm font-medium line-clamp-2">{headerToast.message}</span>
              </motion.div>
            ) : (
              <motion.div
                key="normal"
                initial={headerToastInitial}
                animate={headerToastAnimate}
                exit={headerToastExit}
                transition={headerToastTransition}
                className="w-full h-full"
              >
                <BusinessTabToggle
                  value={businessTab}
                  onValueChange={(value) => {
                    onBusinessTabChange(value);
                  }}
                  onClearStatusFilters={() => onFiltersChange({ ...filters, statuses: [] })}
                  className="w-full h-full"
                  isDetailsView={false}
                  detailsName=""
                />
              </motion.div>
            )}
          </AnimatePresence>
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
          className="flex items-center gap-3 w-full"
          layout="position"
          initial={false}
          style={{
            justifyContent: isSearchActive ? "flex-start" : "center",
          }}
          transition={{ type: "spring", stiffness: 300, damping: 30, bounce: 0 }}
        >
          <motion.div 
            layout="position"
            initial={false}
            transition={{ type: "spring", stiffness: 300, damping: 30, bounce: 0 }}
            className={isSearchActive ? "flex-1 min-w-0" : "flex-shrink-0"}
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
                  setIsExiting(true);
                  setTimeout(() => {
                    setIsSearchActive(false);
                    setIsExiting(false);
                  }, 300);
                }
              }}
              myActive={filters.myEstablishments}
              myLabel={businessTab === 'householders' ? 'My Householders' : 'My Establishments'}
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
              containerClassName={(isSearchActive && !isExiting) ? "w-full !max-w-none !px-0" : "justify-center"}
              maxWidthClassName={(isSearchActive && !isExiting) ? "" : "mx-4"}
            />
          </motion.div>

          {showOtherButtons && (
            <AnimatePresence mode="popLayout" initial={false}>
              {businessTab !== "map" && (
                filters.nearMe ? (
                  <motion.div
                    key="near-me-expanded"
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
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
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
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
            <AnimatePresence mode="popLayout" initial={false}>
              {businessTab !== "map" && (
                <motion.div
                  key="view-toggle"
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
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
  onEditClick,
  headerToast = null
}: {
  congregationTab: 'meetings' | 'ministry' | 'admin';
  onCongregationTabChange: (tab: 'meetings' | 'ministry' | 'admin') => void;
  isElder?: boolean;
  selectedHouseholder?: HouseholderWithDetails | null;
  onBackClick?: () => void;
  onEditClick?: () => void;
  headerToast?: HeaderToastProp;
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
        <div className="w-full h-[52px] overflow-hidden">
          <AnimatePresence mode="wait">
            {headerToast?.message ? (
              <motion.div
                key="toast"
                initial={headerToastInitial}
                animate={headerToastAnimate}
                exit={headerToastExit}
                transition={headerToastTransition}
                className={cn("w-full h-full flex items-center justify-center rounded-lg border px-4 text-center", TOAST_VARIANT_STYLES[headerToast.variant])}
              >
                <span className="text-sm font-medium line-clamp-2">{headerToast.message}</span>
              </motion.div>
            ) : (
              <motion.div
                key="normal"
                initial={headerToastInitial}
                animate={headerToastAnimate}
                exit={headerToastExit}
                transition={headerToastTransition}
                className="w-full h-full"
              >
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
              </motion.div>
            )}
          </AnimatePresence>
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
        <div className="w-full h-[52px] overflow-hidden">
          <AnimatePresence mode="wait">
            {headerToast?.message ? (
              <motion.div
                key="toast"
                initial={headerToastInitial}
                animate={headerToastAnimate}
                exit={headerToastExit}
                transition={headerToastTransition}
                className={cn("w-full h-full flex items-center justify-center rounded-lg border px-4 text-center", TOAST_VARIANT_STYLES[headerToast.variant])}
              >
                <span className="text-sm font-medium line-clamp-2">{headerToast.message}</span>
              </motion.div>
            ) : (
              <motion.div
                key="normal"
                initial={headerToastInitial}
                animate={headerToastAnimate}
                exit={headerToastExit}
                transition={headerToastTransition}
                className="w-full h-full"
              >
                <CongregationTabToggle
                  value={congregationTab}
                  onValueChange={onCongregationTabChange}
                  className="w-full h-full"
                  isElder={isElder}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function HomeControlsContent({
  homeTab,
  onHomeTabChange,
  headerToast = null
}: {
  homeTab: 'summary' | 'events';
  onHomeTabChange: (tab: 'summary' | 'events') => void;
  headerToast?: HeaderToastProp;
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
      <div className="w-full h-[52px] overflow-hidden">
        <AnimatePresence mode="wait">
          {headerToast?.message ? (
            <motion.div
              key="toast"
              initial={headerToastInitial}
              animate={headerToastAnimate}
              exit={headerToastExit}
              transition={headerToastTransition}
              className={cn("w-full h-full flex items-center justify-center rounded-lg border px-4 text-center", TOAST_VARIANT_STYLES[headerToast.variant])}
            >
              <span className="text-sm font-medium line-clamp-2">{headerToast.message}</span>
            </motion.div>
          ) : (
            <motion.div
              key="normal"
              initial={headerToastInitial}
              animate={headerToastAnimate}
              exit={headerToastExit}
              transition={headerToastTransition}
              className="w-full h-full"
            >
              <HomeTabToggle value={homeTab} onValueChange={onHomeTabChange} className="w-full h-full" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function AccountControlsContent({
  accountTab,
  onAccountTabChange,
  headerToast = null
}: {
  accountTab: 'profile' | 'account';
  onAccountTabChange: (tab: 'profile' | 'account') => void;
  headerToast?: HeaderToastProp;
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
      <div className="w-full h-[52px] overflow-hidden">
        <AnimatePresence mode="wait">
          {headerToast?.message ? (
            <motion.div
              key="toast"
              initial={headerToastInitial}
              animate={headerToastAnimate}
              exit={headerToastExit}
              transition={headerToastTransition}
              className={cn("w-full h-full flex items-center justify-center rounded-lg border px-4 text-center", TOAST_VARIANT_STYLES[headerToast.variant])}
            >
              <span className="text-sm font-medium line-clamp-2">{headerToast.message}</span>
            </motion.div>
          ) : (
            <motion.div
              key="normal"
              initial={headerToastInitial}
              animate={headerToastAnimate}
              exit={headerToastExit}
              transition={headerToastTransition}
              className="w-full h-full"
            >
              <AccountTabToggle value={accountTab} onValueChange={onAccountTabChange} className="w-full h-full" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Shared animation for toast ↔ header swap (spring + slide + scale) */
const headerToastTransition = { type: "spring" as const, stiffness: 700, damping: 38 };
const headerToastInitial = { opacity: 0, y: 6, scale: 0.97 };
const headerToastAnimate = { opacity: 1, y: 0, scale: 1 };
const headerToastExit = { opacity: 0, y: -6, scale: 0.97 };

/** Toast variant styles (original sonner-style colors) applied to the header row when toast is active */
/** Original sonner-style: light mode + dark mode (darker low-opacity bg, brighter border) */
const TOAST_VARIANT_STYLES: Record<HeaderToastVariant, string> = {
  success:
    "bg-green-600 text-white border-green-700 dark:bg-green-950/80 dark:border-green-600 dark:text-white",
  error:
    "bg-destructive text-destructive-foreground border-destructive/80 dark:bg-red-950/80 dark:border-red-500 dark:text-red-50",
  info:
    "bg-blue-600 text-white border-blue-700 dark:bg-blue-950/80 dark:border-blue-500 dark:text-white",
  warning:
    "bg-amber-600 text-white border-amber-700 dark:bg-amber-950/80 dark:border-amber-500 dark:text-white",
  default:
    "bg-primary text-primary-foreground border-primary/80 dark:bg-primary/20 dark:border-primary dark:text-primary-foreground",
};

function useHeaderToastState() {
  const [state, setState] = useState(getHeaderToastState);
  useEffect(() => {
    return subscribeHeaderToast(() => setState(getHeaderToastState()));
  }, []);
  return state;
}

export function UnifiedPortaledControls(props: UnifiedPortaledControlsProps) {
  const { currentSection } = props;
  const [mounted, setMounted] = useState(false);
  const headerToast = useHeaderToastState();
  const showBusinessControls = currentSection === 'business' || currentSection.startsWith('business-');
  const showCongregationControls = currentSection === 'congregation';
  const showHomeControls = currentSection === 'home';
  const showAccountControls = currentSection === 'account';

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const headerToastProp = headerToast.message ? { message: headerToast.message, variant: headerToast.variant } : null;

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
        headerToast={headerToastProp}
      />
  ) : showCongregationControls && props.congregationTab !== undefined ? (
    <CongregationControlsContent
        congregationTab={props.congregationTab}
        onCongregationTabChange={props.onCongregationTabChange!}
        isElder={props.isElder}
      selectedHouseholder={props.congregationSelectedHouseholder}
      onBackClick={props.onCongregationBackClick}
      onEditClick={props.onCongregationEditClick}
      headerToast={headerToastProp}
    />
  ) : showHomeControls && props.homeTab !== undefined ? (
    <HomeControlsContent homeTab={props.homeTab} onHomeTabChange={props.onHomeTabChange!} headerToast={headerToastProp} />
  ) : showAccountControls && props.accountTab !== undefined ? (
    <AccountControlsContent accountTab={props.accountTab} onAccountTabChange={props.onAccountTabChange!} headerToast={headerToastProp} />
  ) : null;

  if (!content) return null;

  return createPortal(
    <div data-portaled-controls>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSection}
          initial={{ opacity: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(4px)" }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 pointer-events-none z-[200]"
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body
  );
}
