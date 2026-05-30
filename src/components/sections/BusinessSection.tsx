"use client";

import { useCallback, useMemo, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SectionShell } from "@/components/shared/SectionShell";
import dynamic from "next/dynamic";
import { StickySearchBar } from "@/components/business/StickySearchBar";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerWideLeftContentTop, DrawerWideRightContent } from "@/components/ui/drawer";
import { HomeMobileDetailsDrawer } from "@/components/home/HomeMobileDetailsDrawer";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStudyBibleDarkCardShade, studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";
import { useMediaQuery } from "@/hooks/use-media-query";
import type {
  BusinessFiltersState,
  EstablishmentWithDetails,
  HouseholderWithDetails,
  MyOpenTodoTargets,
  VisitWithUser
} from "@/lib/db/business";
import { filterHouseholdersWithMyOpenTodos } from "@/lib/utils/business-todo-filter";

type BusinessTab = "establishments" | "householders" | "map";
type EstablishmentSelectionSource = "list" | "map";
type MapViewState = { center: [number, number]; zoom: number };
type BusinessEditSheet = "establishment" | "householder" | null;

const EstablishmentList = dynamic(
  () => import("@/components/business/EstablishmentList").then((m) => m.EstablishmentList),
  { ssr: false }
);
const HouseholderList = dynamic(
  () => import("@/components/business/HouseholderList").then((m) => m.HouseholderList),
  { ssr: false }
);
const EstablishmentDetails = dynamic(
  () => import("@/components/business/EstablishmentDetails").then((m) => m.EstablishmentDetails),
  { ssr: false }
);
const HouseholderDetails = dynamic(
  () => import("@/components/business/HouseholderDetails").then((m) => m.HouseholderDetails),
  { ssr: false }
);
const EstablishmentMap = dynamic(
  () => import("@/components/business/EstablishmentMap").then((m) => m.EstablishmentMap),
  { ssr: false }
);
const BusinessFiltersForm = dynamic(
  () => import("@/components/business/BusinessFiltersForm").then((m) => m.BusinessFiltersForm),
  { ssr: false }
);
const FormModal = dynamic(() => import("@/components/shared/FormModal").then((m) => m.FormModal), {
  ssr: false
});
const EstablishmentForm = dynamic(
  () => import("@/components/business/EstablishmentForm").then((m) => m.EstablishmentForm),
  { ssr: false }
);
const HouseholderForm = dynamic(
  () => import("@/components/business/HouseholderForm").then((m) => m.HouseholderForm),
  { ssr: false }
);

export interface BusinessSectionProps {
  userId: string | null;
  portaledControls: ReactNode;
  currentSection: string;
  businessTab: BusinessTab;
  filters: BusinessFiltersState;
  setFilters: Dispatch<SetStateAction<BusinessFiltersState>>;
  filtersModalOpen: boolean;
  setFiltersModalOpen: Dispatch<SetStateAction<boolean>>;
  viewMode: "detailed" | "compact" | "table";
  setViewMode: Dispatch<SetStateAction<"detailed" | "compact" | "table">>;
  filteredEstablishments: EstablishmentWithDetails[];
  filteredHouseholders: HouseholderWithDetails[];
  establishments: EstablishmentWithDetails[];
  selectedEstablishment: EstablishmentWithDetails | null;
  setSelectedEstablishment: Dispatch<SetStateAction<EstablishmentWithDetails | null>>;
  selectedEstablishmentDetails: {
    establishment: EstablishmentWithDetails;
    visits: VisitWithUser[];
    householders: HouseholderWithDetails[];
  } | null;
  establishmentDetailsLoading: boolean;
  setSelectedEstablishmentDetails: Dispatch<
    SetStateAction<{
      establishment: EstablishmentWithDetails;
      visits: VisitWithUser[];
      householders: HouseholderWithDetails[];
    } | null>
  >;
  selectedHouseholder: HouseholderWithDetails | null;
  setSelectedHouseholder: Dispatch<SetStateAction<HouseholderWithDetails | null>>;
  selectedHouseholderDetails: {
    householder: HouseholderWithDetails;
    visits: VisitWithUser[];
    establishment?: { id: string; name: string } | null;
  } | null;
  householderDetailsLoading: boolean;
  setSelectedHouseholderDetails: Dispatch<
    SetStateAction<{
      householder: HouseholderWithDetails;
      visits: VisitWithUser[];
      establishment?: { id: string; name: string } | null;
    } | null>
  >;
  loadEstablishmentDetails: (establishmentId: string) => void;
  loadHouseholderDetails: (householderId: string) => void;
  handleDeleteEstablishment: (establishment: EstablishmentWithDetails) => void | Promise<void>;
  handleArchiveEstablishment: (establishment: EstablishmentWithDetails) => void | Promise<void>;
  handleDeleteHouseholder: (householder: HouseholderWithDetails) => void | Promise<void>;
  handleArchiveHouseholder: (householder: HouseholderWithDetails) => void | Promise<void>;
  handleClearAllFilters: () => void;
  handleClearSearch: () => void;
  handleRemoveStatus: (status: string) => void;
  handleRemoveArea: (area: string) => void;
  handleRemoveFloor: (floor: string) => void;
  dynamicStatusOptions: { value: string; label: string }[];
  dynamicAreaOptions: { value: string; label: string }[];
  dynamicFloorOptions: { value: string; label: string }[];
  myOpenTodoTargets: MyOpenTodoTargets;
  popNavigation: () => string | null;
  pushNavigation: (section: string) => void;
  setCurrentSection: (section: string) => void;
  updateEstablishment: (updated: Partial<EstablishmentWithDetails> & { id: string }) => void;
  canManagePersonalTerritoryOwner?: boolean;
}

export function BusinessSection({
  userId,
  portaledControls,
  currentSection,
  businessTab,
  filters,
  setFilters,
  filtersModalOpen,
  setFiltersModalOpen,
  viewMode,
  setViewMode,
  filteredEstablishments,
  filteredHouseholders,
  establishments,
  selectedEstablishment,
  setSelectedEstablishment,
  selectedEstablishmentDetails,
  establishmentDetailsLoading,
  setSelectedEstablishmentDetails,
  selectedHouseholder,
  setSelectedHouseholder,
  selectedHouseholderDetails,
  householderDetailsLoading,
  setSelectedHouseholderDetails,
  loadEstablishmentDetails,
  loadHouseholderDetails,
  handleDeleteEstablishment,
  handleArchiveEstablishment,
  handleDeleteHouseholder,
  handleArchiveHouseholder,
  handleClearAllFilters,
  handleClearSearch,
  handleRemoveStatus,
  handleRemoveArea,
  handleRemoveFloor,
  dynamicStatusOptions,
  dynamicAreaOptions,
  dynamicFloorOptions,
  myOpenTodoTargets,
  popNavigation,
  pushNavigation,
  setCurrentSection,
  updateEstablishment,
  canManagePersonalTerritoryOwner = false,
}: BusinessSectionProps) {
  const [selectedEstablishmentSource, setSelectedEstablishmentSource] = useState<EstablishmentSelectionSource>("list");
  const [lastMapSelectedEstablishmentId, setLastMapSelectedEstablishmentId] = useState<string | undefined>(undefined);
  const [mapViewState, setMapViewState] = useState<MapViewState | null>(null);
  const [businessEditSheet, setBusinessEditSheet] = useState<BusinessEditSheet>(null);
  const isTabletUp = useMediaQuery("(min-width: 768px)");
  /** Tablet+ uses right edge sheets; phone map keeps the map visible and uses a bottom drawer. */
  const useMobileMapBottomDetails = !isTabletUp && businessTab === "map";
  const overlayMapDetails = isTabletUp || businessTab === "map";

  const bwiBizScope = userId ?? "anon";
  const businessEstablishmentDetailShade = useMemo(
    () => getStudyBibleDarkCardShade(`bwi-business-est-detail:${bwiBizScope}`),
    [bwiBizScope]
  );
  const businessHouseholderDetailShade = useMemo(
    () => getStudyBibleDarkCardShade(`bwi-business-hh-detail:${bwiBizScope}`),
    [bwiBizScope]
  );
  const businessContactStackShade = useMemo(
    () => getStudyBibleDarkCardShade(`bwi-business-contact-stack:${bwiBizScope}`),
    [bwiBizScope]
  );
  const businessEntityEditShade = useMemo(
    () => getStudyBibleDarkCardShade(`bwi-business-entity-edit:${bwiBizScope}`),
    [bwiBizScope]
  );

  const hasActiveFilters =
    filters.search !== "" ||
    filters.statuses.length > 0 ||
    (filters.excludedStatuses?.length ?? 0) > 0 ||
    filters.areas.length > 0 ||
    filters.floors.length > 0 ||
    filters.myEstablishments ||
    filters.myTodosOnly ||
    !!filters.sort;

  const defaultFilters = useMemo<BusinessFiltersState>(
    () => ({
      search: "",
      statuses: [],
      excludedStatuses: [],
      areas: [],
      floors: [],
      myEstablishments: false,
      myTodosOnly: false,
      nearMe: false,
      userLocation: null,
      sort: "last_visit_desc"
    }),
    []
  );

  const visibleEstablishmentHouseholders = useCallback(
    (householders: HouseholderWithDetails[]) => {
      if (!filters.myTodosOnly) return householders;
      return filterHouseholdersWithMyOpenTodos(householders, myOpenTodoTargets);
    },
    [filters.myTodosOnly, myOpenTodoTargets]
  );

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, [setFilters]);

  const listMotion = {
    initial: false,
    animate: { opacity: 1 },
    exit: { opacity: 1 },
    transition: { duration: 0 }
  };

  const detailsMotion = {
    initial: { opacity: 0, filter: "blur(6px)" },
    animate: { opacity: 1, filter: "blur(0px)" },
    exit: { opacity: 0, filter: "blur(6px)" },
    transition: { duration: 0.3 }
  };

  const mapDetailsMotion = {
    initial: { opacity: 0, x: 18, scale: 0.985, filter: "blur(4px)" },
    animate: { opacity: 1, x: 0, scale: 1, filter: "blur(0px)" },
    exit: { opacity: 0, x: -18, scale: 0.985, filter: "blur(4px)" },
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const }
  };

  const getDetailsWrapperClass = (_isMap: boolean) => "space-y-6";

  const handleSelectEstablishment = useCallback(
    (establishment: EstablishmentWithDetails, source: EstablishmentSelectionSource = "list") => {
      setSelectedEstablishmentSource(source);
      if (source === "map" && establishment.id) {
        setLastMapSelectedEstablishmentId(establishment.id);
      }
      setSelectedEstablishment(establishment);
      if (!overlayMapDetails) {
        pushNavigation(currentSection);
      }
      if (establishment.id) {
        loadEstablishmentDetails(establishment.id);
      }
    },
    [currentSection, loadEstablishmentDetails, pushNavigation, setSelectedEstablishment, overlayMapDetails]
  );

  const handleSelectHouseholder = useCallback(
    (householder: HouseholderWithDetails) => {
      setSelectedHouseholder(householder);
      if (!overlayMapDetails) {
        pushNavigation(currentSection);
      }
      if (householder.id) {
        loadHouseholderDetails(householder.id);
      }
    },
    [currentSection, loadHouseholderDetails, pushNavigation, setSelectedHouseholder, overlayMapDetails]
  );

  const navigateBack = useCallback(
    (fallbackSection: string) => {
      const previousSection = popNavigation();
      const targetSection = previousSection
        ? previousSection === "home" || previousSection.startsWith("business-")
          ? previousSection
          : fallbackSection
        : fallbackSection;
      setCurrentSection(targetSection);
      const url = new URL(window.location.href);
      url.pathname = targetSection === "home" ? "/" : "/business";
      window.history.pushState({}, "", url.toString());
    },
    [popNavigation, setCurrentSection]
  );

  // Lock global scroll while on the BWI (business) section; section itself provides scrolling
  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    html.classList.add("app-scroll-locked");
    document.body.classList.add("app-scroll-locked");
    return () => {
      html.classList.remove("app-scroll-locked");
      document.body.classList.remove("app-scroll-locked");
    };
  }, []);

  const closeEstablishmentSideDetails = useCallback(() => {
    setBusinessEditSheet(null);
    setSelectedHouseholder(null);
    setSelectedHouseholderDetails(null);
    setSelectedEstablishment(null);
    setSelectedEstablishmentDetails(null);
  }, [
    setSelectedEstablishment,
    setSelectedEstablishmentDetails,
    setSelectedHouseholder,
    setSelectedHouseholderDetails,
  ]);

  const closeHouseholderSideDetails = useCallback(() => {
    setBusinessEditSheet(null);
    setSelectedHouseholder(null);
    setSelectedHouseholderDetails(null);
  }, [setSelectedHouseholder, setSelectedHouseholderDetails]);

  const handleEstablishmentEditSaved = useCallback(
    (updated?: Partial<EstablishmentWithDetails> & { id?: string }) => {
      setBusinessEditSheet(null);
      if (updated?.id) {
        updateEstablishment({ id: updated.id, ...updated });
        loadEstablishmentDetails(updated.id);
        setSelectedEstablishment((prev) => {
          if (!prev || prev.id !== updated.id) return prev;
          return { ...prev, ...updated, id: prev.id, name: updated.name ?? prev.name } as EstablishmentWithDetails;
        });
        return;
      }
      if (selectedEstablishment?.id) {
        loadEstablishmentDetails(selectedEstablishment.id);
      }
    },
    [loadEstablishmentDetails, selectedEstablishment?.id, setSelectedEstablishment, updateEstablishment]
  );

  const handleHouseholderEditSaved = useCallback(
    (updated?: Partial<HouseholderWithDetails> & { id?: string }) => {
      setBusinessEditSheet(null);
      if (updated?.id) {
        setSelectedHouseholder((prev) => {
          if (!prev || prev.id !== updated.id) return prev;
          return { ...prev, ...updated, id: prev.id, name: updated.name ?? prev.name } as HouseholderWithDetails;
        });
        loadHouseholderDetails(updated.id);
      } else if (selectedHouseholder?.id) {
        loadHouseholderDetails(selectedHouseholder.id);
      }
      if (selectedEstablishment?.id) {
        loadEstablishmentDetails(selectedEstablishment.id);
      }
    },
    [
      loadEstablishmentDetails,
      loadHouseholderDetails,
      selectedEstablishment?.id,
      selectedHouseholder?.id,
      setSelectedHouseholder,
    ]
  );

  const renderHouseholderDetails = (options?: { stacked?: boolean }) => {
    if (!selectedHouseholder) return null;
    return (
      <HouseholderDetails
        householder={selectedHouseholderDetails?.householder || selectedHouseholder}
        visits={selectedHouseholderDetails?.visits || []}
        establishment={selectedHouseholderDetails?.establishment || null}
        establishments={
          selectedHouseholderDetails?.establishment ? [selectedHouseholderDetails.establishment] : []
        }
        isLoading={householderDetailsLoading}
        onBackClick={closeHouseholderSideDetails}
        publisherId={userId}
        onRequestSummaryEdit={() => setBusinessEditSheet("householder")}
        preferLeftDetailPanel={isTabletUp}
        insideStackedContactPane={options?.stacked}
      />
    );
  };

  const renderEstablishmentDetails = () => {
    if (!selectedEstablishment) return null;
    return (
      <EstablishmentDetails
        establishment={selectedEstablishmentDetails?.establishment ?? selectedEstablishment}
        visits={selectedEstablishmentDetails?.visits || []}
        householders={visibleEstablishmentHouseholders(selectedEstablishmentDetails?.householders || [])}
        isLoading={establishmentDetailsLoading}
        canManagePersonalTerritoryOwner={canManagePersonalTerritoryOwner}
        onBackClick={closeEstablishmentSideDetails}
        onRequestSummaryEdit={() => setBusinessEditSheet("establishment")}
        onEstablishmentUpdated={(est) => est?.id && updateEstablishment({ id: est.id!, ...est })}
        onHouseholderClick={(hh) => {
          setSelectedHouseholder(hh);
          if (hh.id) loadHouseholderDetails(hh.id);
        }}
        preferLeftDetailPanel={isTabletUp}
        insideStackedContactPane={!!selectedHouseholder && !!selectedEstablishment}
        publisherId={userId}
      />
    );
  };

  return (
    <>
      {portaledControls}
      <SectionShell
        motionKey="business"
        className={
          businessTab === "map"
            ? "fixed inset-0 z-10"
            : cn(
                // Same shell model as HomeSection: fill flex parent to the viewport bottom (no 100vh-80px gap),
                // edge-to-edge scroll; bottom padding only reserves space above fixed nav when scrolled to end.
                "relative flex-1 min-h-0 w-full overflow-y-auto overscroll-none scrollbar-hide space-y-4 px-0 overflow-x-hidden",
                "pb-[calc(max(env(safe-area-inset-bottom),0px)+96px)] md:pb-0",
                "pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+90px)] md:pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+84px)]",
                "md:h-[100lvh]"
              )
        }
      >
        <StickySearchBar
          filters={filters}
          onFiltersChange={setFilters}
          onClearSearch={handleClearSearch}
          isVisible={false}
          businessTab={businessTab}
        />

        <motion.div
          className={businessTab === "map" ? "w-full h-full" : "w-full"}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <AnimatePresence initial={false}>
            {overlayMapDetails || (!selectedEstablishment && !selectedHouseholder) ? (
              businessTab === "establishments" ? (
                <motion.div key="establishment-list" {...listMotion} className="w-full">
                  <EstablishmentList
                    establishments={filteredEstablishments}
                    currentUserId={userId}
                    onEstablishmentClick={handleSelectEstablishment}
                    onEstablishmentDelete={handleDeleteEstablishment}
                    onEstablishmentArchive={handleArchiveEstablishment}
                    myEstablishmentsOnly={filters.myEstablishments}
                    onMyEstablishmentsChange={(checked) =>
                      setFilters((prev) => ({ ...prev, myEstablishments: checked }))
                    }
                    onOpenFilters={() => setFiltersModalOpen(true)}
                    filters={filters}
                    onClearAllFilters={handleClearAllFilters}
                    onClearSearch={handleClearSearch}
                    onRemoveStatus={handleRemoveStatus}
                    onRemoveArea={handleRemoveArea}
                    onRemoveFloor={handleRemoveFloor}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                  />
                </motion.div>
              ) : businessTab === "householders" ? (
                <motion.div key="householder-list" {...listMotion} className="w-full">
                  <HouseholderList
                    householders={filteredHouseholders}
                    onHouseholderClick={handleSelectHouseholder}
                    onHouseholderDelete={handleDeleteHouseholder}
                    onHouseholderArchive={handleArchiveHouseholder}
                    myHouseholdersOnly={filters.myEstablishments}
                    onMyHouseholdersChange={(checked) =>
                      setFilters((prev) => ({ ...prev, myEstablishments: checked }))
                    }
                    onOpenFilters={() => setFiltersModalOpen(true)}
                    filters={filters}
                    onClearAllFilters={handleClearAllFilters}
                    onClearSearch={handleClearSearch}
                    onRemoveStatus={handleRemoveStatus}
                    onRemoveArea={handleRemoveArea}
                    onRemoveFloor={handleRemoveFloor}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="establishment-map"
                  initial={{ opacity: 0.85, x: -12, scale: 1.01, filter: "blur(4px)" }}
                  animate={{ opacity: 1, x: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, x: -20, scale: 0.985, filter: "blur(6px)" }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full h-full"
                  style={{ height: "100%" }}
                >
                  <EstablishmentMap
                    establishments={filteredEstablishments}
                    onEstablishmentClick={(establishment) => handleSelectEstablishment(establishment, "map")}
                    selectedEstablishmentId={lastMapSelectedEstablishmentId}
                    initialView={mapViewState ?? undefined}
                    onViewChange={setMapViewState}
                    className="h-full"
                    currentUserId={userId}
                  />
                </motion.div>
              )
            ) : selectedHouseholder ? (
              <motion.div
                key="householder-details"
                {...(businessTab === "map" ? mapDetailsMotion : detailsMotion)}
                className="w-full"
              >
                <div className={getDetailsWrapperClass(businessTab === "map")}>
                  <HouseholderDetails
                    householder={selectedHouseholderDetails?.householder || selectedHouseholder}
                    visits={selectedHouseholderDetails?.visits || []}
                    establishment={selectedHouseholderDetails?.establishment || null}
                    establishments={
                      selectedHouseholderDetails?.establishment ? [selectedHouseholderDetails.establishment] : []
                    }
                    isLoading={householderDetailsLoading}
                    onBackClick={() => {
                      setSelectedHouseholder(null);
                      setSelectedHouseholderDetails(null);
                      if (selectedEstablishment) {
                        // Came from establishment details → stay; view will show establishment details
                        return;
                      }
                      navigateBack("business-householders");
                    }}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="establishment-details"
                {...(businessTab === "map" ? mapDetailsMotion : detailsMotion)}
                className="w-full"
              >
                {selectedEstablishment && (
                  <div className={getDetailsWrapperClass(businessTab === "map")}>
                    <EstablishmentDetails
                      establishment={selectedEstablishmentDetails?.establishment ?? selectedEstablishment}
                      visits={selectedEstablishmentDetails?.visits || []}
                      householders={visibleEstablishmentHouseholders(selectedEstablishmentDetails?.householders || [])}
                      isLoading={establishmentDetailsLoading}
                      canManagePersonalTerritoryOwner={canManagePersonalTerritoryOwner}
                      onBackClick={() => {
                        setSelectedEstablishment(null);
                        setSelectedEstablishmentDetails(null);
                        navigateBack(selectedEstablishmentSource === "map" ? "business-map" : "business-establishments");
                      }}
                      onEstablishmentUpdated={(est) => est?.id && updateEstablishment({ id: est.id!, ...est })}
                      onHouseholderClick={(hh) => {
                        setSelectedHouseholder(hh);
                        if (hh.id) loadHouseholderDetails(hh.id);
                      }}
                      preferLeftDetailPanel={isTabletUp}
                      insideStackedContactPane={!!selectedHouseholder && !!selectedEstablishment}
                      publisherId={userId}
                    />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <FormModal
          open={filtersModalOpen}
          onOpenChange={setFiltersModalOpen}
          title="Sort and Filter"
        >
          <BusinessFiltersForm
            filters={filters}
            onFiltersChange={setFilters}
            onClearFilters={clearFilters}
            hasActiveFilters={hasActiveFilters}
            scope={businessTab}
            statusOptions={dynamicStatusOptions}
            areaOptions={dynamicAreaOptions}
            floorOptions={dynamicFloorOptions}
            onClose={() => setFiltersModalOpen(false)}
            isMapView={businessTab === "map"}
          />
        </FormModal>

        {isTabletUp ? (
          <>
            <Drawer
              open={!!selectedEstablishment}
              onOpenChange={(open) => {
                if (!open) closeEstablishmentSideDetails();
              }}
              direction="right"
              modal
              nested
              shouldScaleBackground={false}
            >
              <DrawerWideRightContent
                className={cn(
                  "border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff]",
                  businessEstablishmentDetailShade
                )}
              >
                <DrawerHeader className="bg-transparent px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center">
                  <DrawerTitle className="text-center text-xl font-extrabold tracking-tight">
                    {selectedEstablishmentDetails?.establishment.name || selectedEstablishment?.name || "Establishment Details"}
                  </DrawerTitle>
                </DrawerHeader>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2">
                  {renderEstablishmentDetails()}
                </div>
              </DrawerWideRightContent>
            </Drawer>

            <Drawer
              open={!!selectedHouseholder && !selectedEstablishment}
              onOpenChange={(open) => {
                if (!open) closeHouseholderSideDetails();
              }}
              direction="right"
              modal
              nested
              shouldScaleBackground={false}
            >
              <DrawerWideRightContent
                className={cn(
                  "border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff]",
                  businessHouseholderDetailShade
                )}
              >
                <DrawerHeader className="bg-transparent px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center">
                  <DrawerTitle className="text-center text-xl font-extrabold tracking-tight">
                    {selectedHouseholderDetails?.householder.name || selectedHouseholder?.name || "Contact Details"}
                  </DrawerTitle>
                </DrawerHeader>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2">
                  {renderHouseholderDetails()}
                </div>
              </DrawerWideRightContent>
            </Drawer>

            <Drawer
              open={!!selectedHouseholder && !!selectedEstablishment}
              onOpenChange={(open) => {
                if (!open) closeHouseholderSideDetails();
              }}
              direction="right"
              modal
              shouldScaleBackground={false}
            >
              <DrawerWideRightContent
                stackAboveDetailsSheet
                className={cn("border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff]", businessContactStackShade)}
              >
                <DrawerHeader className="bg-transparent px-2 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-left sm:px-4">
                  <div className="relative flex items-center justify-center gap-1 pr-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute left-0 h-9 w-9 shrink-0"
                      onClick={closeHouseholderSideDetails}
                      aria-label="Back to establishment"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <DrawerTitle className="px-10 text-center text-xl font-extrabold tracking-tight">
                      {selectedHouseholderDetails?.householder.name || selectedHouseholder?.name || "Contact Details"}
                    </DrawerTitle>
                  </div>
                </DrawerHeader>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2">
                  {renderHouseholderDetails({ stacked: true })}
                </div>
              </DrawerWideRightContent>
            </Drawer>

            <Drawer
              open={!!businessEditSheet}
              onOpenChange={(open) => {
                if (!open) setBusinessEditSheet(null);
              }}
              direction="left"
              modal
              shouldScaleBackground={false}
            >
              <DrawerWideLeftContentTop
                stackAboveStackedRightSheet={!!selectedHouseholder && !!selectedEstablishment}
                className={cn("border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff]", businessEntityEditShade)}
              >
                <DrawerHeader className="bg-transparent px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center">
                  <DrawerTitle className="text-center text-lg font-bold">
                    {businessEditSheet === "householder" ? "Edit Contact" : "Edit Establishment"}
                  </DrawerTitle>
                </DrawerHeader>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2">
                  {businessEditSheet === "establishment" && selectedEstablishment ? (
                    <EstablishmentForm
                      key={selectedEstablishment.id}
                      onSaved={handleEstablishmentEditSaved}
                      onDelete={async () => {
                        await handleDeleteEstablishment(selectedEstablishment);
                        closeEstablishmentSideDetails();
                      }}
                      onArchive={async () => {
                        await handleArchiveEstablishment(selectedEstablishment);
                        closeEstablishmentSideDetails();
                      }}
                      selectedArea={selectedEstablishment.area || undefined}
                      initialData={selectedEstablishmentDetails?.establishment ?? selectedEstablishment}
                      isEditing
                    />
                  ) : businessEditSheet === "householder" && selectedHouseholder ? (
                    <HouseholderForm
                      key={selectedHouseholder.id}
                      establishments={selectedEstablishment ? [selectedEstablishment] : establishments}
                      selectedEstablishmentId={selectedHouseholder.establishment_id ?? undefined}
                      isEditing
                      initialData={{
                        id: selectedHouseholder.id,
                        establishment_id: selectedHouseholder.establishment_id || "",
                        name: selectedHouseholder.name,
                        status: selectedHouseholder.status as any,
                        note: selectedHouseholder.note || null,
                        lat: selectedHouseholder.lat ?? null,
                        lng: selectedHouseholder.lng ?? null,
                        publisher_id: selectedHouseholder.publisher_id ?? null,
                      }}
                      onSaved={handleHouseholderEditSaved}
                      onDelete={async () => {
                        await handleDeleteHouseholder(selectedHouseholder);
                        closeHouseholderSideDetails();
                      }}
                      onArchive={async () => {
                        await handleArchiveHouseholder(selectedHouseholder);
                        closeHouseholderSideDetails();
                      }}
                      disableEstablishmentSelect={!!selectedEstablishment}
                      publisherId={userId ?? undefined}
                    />
                  ) : null}
                </div>
              </DrawerWideLeftContentTop>
            </Drawer>
          </>
        ) : null}

        {useMobileMapBottomDetails ? (
          <>
            <HomeMobileDetailsDrawer
              open={!!selectedEstablishment}
              onOpenChange={(open) => {
                if (!open) closeEstablishmentSideDetails();
              }}
              title={
                selectedEstablishmentDetails?.establishment.name ||
                selectedEstablishment?.name ||
                "Establishment Details"
              }
              bodyClassName="space-y-3"
              contentClassName={businessEstablishmentDetailShade}
            >
              {renderEstablishmentDetails()}
            </HomeMobileDetailsDrawer>

            <HomeMobileDetailsDrawer
              open={!!selectedHouseholder && !selectedEstablishment}
              onOpenChange={(open) => {
                if (!open) closeHouseholderSideDetails();
              }}
              title={
                selectedHouseholderDetails?.householder.name ||
                selectedHouseholder?.name ||
                "Contact Details"
              }
              bodyClassName="space-y-3"
              contentClassName={businessHouseholderDetailShade}
            >
              {renderHouseholderDetails()}
            </HomeMobileDetailsDrawer>

            <Drawer
              nested
              open={!!selectedHouseholder && !!selectedEstablishment}
              onOpenChange={(open) => {
                if (!open) closeHouseholderSideDetails();
              }}
            >
              <DrawerContent
                className={cn(
                  studyBibleDarkClasses.drawerPanel,
                  businessContactStackShade,
                  "max-h-[90vh]"
                )}
                handleClassName={studyBibleDarkClasses.drawerHandle}
              >
                <DrawerHeader className="bg-transparent px-2 pb-3 pt-4 text-left">
                  <div className="relative flex items-center justify-center gap-1 pr-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute left-0 h-9 w-9 shrink-0"
                      onClick={closeHouseholderSideDetails}
                      aria-label="Back to establishment"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <DrawerTitle className="px-10 text-center text-lg font-bold">
                      {selectedHouseholderDetails?.householder.name ||
                        selectedHouseholder?.name ||
                        "Contact Details"}
                    </DrawerTitle>
                  </div>
                </DrawerHeader>
                <div className="overflow-y-auto px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2 space-y-3">
                  {renderHouseholderDetails({ stacked: true })}
                </div>
              </DrawerContent>
            </Drawer>

            <FormModal
              open={!!businessEditSheet}
              onOpenChange={(open) => {
                if (!open) setBusinessEditSheet(null);
              }}
              title={businessEditSheet === "householder" ? "Edit Contact" : "Edit Establishment"}
            >
              {businessEditSheet === "establishment" && selectedEstablishment ? (
                <EstablishmentForm
                  key={selectedEstablishment.id}
                  onSaved={handleEstablishmentEditSaved}
                  onDelete={async () => {
                    await handleDeleteEstablishment(selectedEstablishment);
                    closeEstablishmentSideDetails();
                  }}
                  onArchive={async () => {
                    await handleArchiveEstablishment(selectedEstablishment);
                    closeEstablishmentSideDetails();
                  }}
                  selectedArea={selectedEstablishment.area || undefined}
                  initialData={selectedEstablishmentDetails?.establishment ?? selectedEstablishment}
                  isEditing
                />
              ) : businessEditSheet === "householder" && selectedHouseholder ? (
                <HouseholderForm
                  key={selectedHouseholder.id}
                  establishments={selectedEstablishment ? [selectedEstablishment] : establishments}
                  selectedEstablishmentId={selectedHouseholder.establishment_id ?? undefined}
                  isEditing
                  initialData={{
                    id: selectedHouseholder.id,
                    establishment_id: selectedHouseholder.establishment_id || "",
                    name: selectedHouseholder.name,
                    status: selectedHouseholder.status as any,
                    note: selectedHouseholder.note || null,
                    lat: selectedHouseholder.lat ?? null,
                    lng: selectedHouseholder.lng ?? null,
                    publisher_id: selectedHouseholder.publisher_id ?? null,
                  }}
                  onSaved={handleHouseholderEditSaved}
                  onDelete={async () => {
                    await handleDeleteHouseholder(selectedHouseholder);
                    closeHouseholderSideDetails();
                  }}
                  onArchive={async () => {
                    await handleArchiveHouseholder(selectedHouseholder);
                    closeHouseholderSideDetails();
                  }}
                  disableEstablishmentSelect={!!selectedEstablishment}
                  publisherId={userId ?? undefined}
                />
              ) : null}
            </FormModal>
          </>
        ) : null}

        {/* FAB handled by UnifiedFab */}
      </SectionShell>
    </>
  );
}
