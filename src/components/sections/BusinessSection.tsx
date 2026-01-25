"use client";

import { useCallback, useMemo, useEffect, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SectionShell } from "@/components/shared/SectionShell";
import dynamic from "next/dynamic";
import { StickySearchBar } from "@/components/business/StickySearchBar";
import type {
  BusinessFiltersState,
  EstablishmentWithDetails,
  HouseholderWithDetails,
  VisitWithUser
} from "@/lib/db/business";

type BusinessTab = "establishments" | "householders" | "map";

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

export interface BusinessSectionProps {
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
  popNavigation: () => string | null;
  pushNavigation: (section: string) => void;
  setCurrentSection: (section: string) => void;
  updateEstablishment: (updated: Partial<EstablishmentWithDetails> & { id: string }) => void;
}

export function BusinessSection({
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
  setSelectedEstablishmentDetails,
  selectedHouseholder,
  setSelectedHouseholder,
  selectedHouseholderDetails,
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
  popNavigation,
  pushNavigation,
  setCurrentSection,
  updateEstablishment
}: BusinessSectionProps) {
  const hasActiveFilters =
    filters.search !== "" ||
    filters.statuses.length > 0 ||
    filters.areas.length > 0 ||
    filters.floors.length > 0 ||
    filters.myEstablishments ||
    !!filters.sort;

  const defaultFilters = useMemo<BusinessFiltersState>(
    () => ({
      search: "",
      statuses: [],
      areas: [],
      floors: [],
      myEstablishments: false,
      nearMe: false,
      userLocation: null,
      sort: "last_visit_desc"
    }),
    []
  );

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, [setFilters]);

  const listMotion = {
    initial: { opacity: 0, filter: "blur(6px)" },
    animate: { opacity: 1, filter: "blur(0px)" },
    exit: { opacity: 0, filter: "blur(6px)" },
    transition: { duration: 0.2 }
  };

  const detailsMotion = {
    initial: { opacity: 0, filter: "blur(6px)" },
    animate: { opacity: 1, filter: "blur(0px)" },
    exit: { opacity: 0, filter: "blur(6px)" },
    transition: { duration: 0.3 }
  };

  const getDetailsWrapperClass = (isMap: boolean) =>
    isMap ? "space-y-6 pb-20 px-4 py-6" : "space-y-6";

  const handleSelectEstablishment = useCallback(
    (establishment: EstablishmentWithDetails) => {
      setSelectedEstablishment(establishment);
      pushNavigation(currentSection);
      if (establishment.id) {
        loadEstablishmentDetails(establishment.id);
      }
    },
    [currentSection, loadEstablishmentDetails, pushNavigation, setSelectedEstablishment]
  );

  const handleSelectHouseholder = useCallback(
    (householder: HouseholderWithDetails) => {
      setSelectedHouseholder(householder);
      pushNavigation(currentSection);
      if (householder.id) {
        loadHouseholderDetails(householder.id);
      }
    },
    [currentSection, loadHouseholderDetails, pushNavigation, setSelectedHouseholder]
  );

  const navigateBack = useCallback(
    (fallbackSection: string) => {
      const previousSection = popNavigation();
      const targetSection = previousSection
        ? previousSection.startsWith("business-")
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

  return (
    <>
      {portaledControls}
      <SectionShell
        motionKey="business"
        className={
          businessTab === "map"
            ? "fixed inset-0 z-10"
            : "relative h-[calc(100vh-80px)] overflow-y-auto space-y-4 px-0 pb-20 pt-[90px]"
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
          <AnimatePresence mode="popLayout" initial={false}>
            {!selectedEstablishment && !selectedHouseholder ? (
              businessTab === "establishments" ? (
                <motion.div key="establishment-list" {...listMotion} className="w-full">
                  <EstablishmentList
                    establishments={filteredEstablishments}
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
                <motion.div key="establishment-map" {...listMotion} className="w-full h-full" style={{ height: "100%" }}>
                  <EstablishmentMap
                    establishments={filteredEstablishments}
                    onEstablishmentClick={handleSelectEstablishment}
                    selectedEstablishmentId={undefined}
                    className="h-full"
                  />
                </motion.div>
              )
            ) : selectedHouseholder ? (
              <motion.div key="householder-details" {...detailsMotion} className="w-full">
                <div className={getDetailsWrapperClass(businessTab === "map")}>
                  <HouseholderDetails
                    householder={selectedHouseholderDetails?.householder || selectedHouseholder}
                    visits={selectedHouseholderDetails?.visits || []}
                    establishment={selectedHouseholderDetails?.establishment || null}
                    establishments={
                      selectedHouseholderDetails?.establishment ? [selectedHouseholderDetails.establishment] : []
                    }
                    isLoading={!selectedHouseholderDetails}
                    onBackClick={() => {
                      setSelectedHouseholder(null);
                      setSelectedHouseholderDetails(null);
                      navigateBack("business-householders");
                    }}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div key="establishment-details" {...detailsMotion} className="w-full">
                {selectedEstablishment && (
                  <div className={getDetailsWrapperClass(businessTab === "map")}>
                    <EstablishmentDetails
                      establishment={selectedEstablishment}
                      visits={selectedEstablishmentDetails?.visits || []}
                      householders={selectedEstablishmentDetails?.householders || []}
                      isLoading={!selectedEstablishmentDetails}
                      onBackClick={() => {
                        setSelectedEstablishment(null);
                        setSelectedEstablishmentDetails(null);
                        navigateBack("business-establishments");
                      }}
                      onEstablishmentUpdated={(est) => est?.id && updateEstablishment({ id: est.id!, ...est })}
                      onHouseholderClick={(hh) => {
                        setSelectedHouseholder(hh);
                        if (hh.id) loadHouseholderDetails(hh.id);
                      }}
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
            statusOptions={dynamicStatusOptions}
            areaOptions={dynamicAreaOptions}
            floorOptions={dynamicFloorOptions}
            onClose={() => setFiltersModalOpen(false)}
            isMapView={businessTab === "map"}
          />
        </FormModal>

        {/* FAB handled by UnifiedFab */}
      </SectionShell>
    </>
  );
}
