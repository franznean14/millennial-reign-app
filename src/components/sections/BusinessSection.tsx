"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { motion, AnimatePresence } from "motion/react";
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
const BusinessDrawerDialogs = dynamic(
  () => import("@/components/business/BusinessDrawerDialogs").then((m) => m.BusinessDrawerDialogs),
  { ssr: false }
);
const BusinessFiltersForm = dynamic(
  () => import("@/components/business/BusinessFiltersForm").then((m) => m.BusinessFiltersForm),
  { ssr: false }
);
const ResponsiveModal = dynamic(() => import("@/components/ui/responsive-modal").then((m) => m.ResponsiveModal), {
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

  return (
    <>
      {portaledControls}
      <motion.div
        key="business"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.3 }}
        className={
          businessTab === "map"
            ? "fixed inset-0 z-10"
            : selectedEstablishment || selectedHouseholder
              ? "space-y-6 pb-20"
              : "space-y-6 pb-20 pt-20"
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
          <AnimatePresence>
            {!selectedEstablishment && !selectedHouseholder ? (
              businessTab === "establishments" ? (
                <motion.div
                  key="establishment-list"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="w-full"
                >
                  <EstablishmentList
                    establishments={filteredEstablishments}
                    onEstablishmentClick={(establishment) => {
                      setSelectedEstablishment(establishment);
                      pushNavigation(currentSection);
                      if (establishment.id) {
                        loadEstablishmentDetails(establishment.id);
                      }
                    }}
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
                <motion.div
                  key="householder-list"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="w-full"
                >
                  <HouseholderList
                    householders={filteredHouseholders}
                    onHouseholderClick={(householder) => {
                      setSelectedHouseholder(householder);
                      pushNavigation(currentSection);
                      if (householder.id) {
                        loadHouseholderDetails(householder.id);
                      }
                    }}
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
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full"
                  style={{ height: "100%" }}
                >
                  <EstablishmentMap
                    establishments={filteredEstablishments}
                    onEstablishmentClick={(establishment) => {
                      setSelectedEstablishment(establishment);
                      pushNavigation(currentSection);
                      if (establishment.id) {
                        loadEstablishmentDetails(establishment.id);
                      }
                    }}
                    selectedEstablishmentId={undefined}
                    className="h-full"
                  />
                </motion.div>
              )
            ) : selectedHouseholder ? (
              <motion.div
                key="householder-details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="w-full"
                layout
              >
                <div className={businessTab === "map" ? "space-y-6 pb-20 px-4 py-6" : "space-y-6 pt-[60px]"}>
                  <HouseholderDetails
                    householder={selectedHouseholder}
                    visits={selectedHouseholderDetails?.visits || []}
                    establishment={selectedHouseholderDetails?.establishment || null}
                    establishments={
                      selectedHouseholderDetails?.establishment ? [selectedHouseholderDetails.establishment] : []
                    }
                    onBackClick={() => {
                      setSelectedHouseholder(null);
                      setSelectedHouseholderDetails(null);
                      const previousSection = popNavigation();
                      if (previousSection) {
                        const targetSection = previousSection.startsWith("business-")
                          ? previousSection
                          : "business-householders";
                        setCurrentSection(targetSection);
                        const url = new URL(window.location.href);
                        url.pathname = targetSection === "home" ? "/" : "/business";
                        window.history.pushState({}, "", url.toString());
                      } else {
                        setCurrentSection("business-householders");
                        const url = new URL(window.location.href);
                        url.pathname = "/business";
                        window.history.pushState({}, "", url.toString());
                      }
                    }}
                  />
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="establishment-details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="w-full"
                layout
              >
                {selectedEstablishment && (
                  <div className={businessTab === "map" ? "space-y-6 pb-20 px-4 py-6" : "space-y-6 pt-[60px]"}>
                    <EstablishmentDetails
                      establishment={selectedEstablishment}
                      visits={selectedEstablishmentDetails?.visits || []}
                      householders={selectedEstablishmentDetails?.householders || []}
                      onBackClick={() => {
                        setSelectedEstablishment(null);
                        setSelectedEstablishmentDetails(null);
                        const previousSection = popNavigation();
                        if (previousSection) {
                          const targetSection = previousSection.startsWith("business-")
                            ? previousSection
                            : "business-establishments";
                          setCurrentSection(targetSection);
                          const url = new URL(window.location.href);
                          url.pathname = targetSection === "home" ? "/" : "/business";
                          window.history.pushState({}, "", url.toString());
                        } else {
                          setCurrentSection("business-establishments");
                          const url = new URL(window.location.href);
                          url.pathname = "/business";
                          window.history.pushState({}, "", url.toString());
                        }
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

        <ResponsiveModal
          open={filtersModalOpen}
          onOpenChange={setFiltersModalOpen}
          title="Sort and Filter"
        >
          <BusinessFiltersForm
            filters={filters}
            onFiltersChange={setFilters}
            onClearFilters={() =>
              setFilters({
                search: "",
                statuses: [],
                areas: [],
                floors: [],
                myEstablishments: false,
                nearMe: false,
                userLocation: null,
                sort: "last_visit_desc"
              })
            }
            hasActiveFilters={hasActiveFilters}
            statusOptions={dynamicStatusOptions}
            areaOptions={dynamicAreaOptions}
            floorOptions={dynamicFloorOptions}
            onClose={() => setFiltersModalOpen(false)}
            isMapView={businessTab === "map"}
          />
        </ResponsiveModal>

        <BusinessDrawerDialogs
          establishments={establishments}
          selectedEstablishmentId={selectedEstablishment?.id}
          selectedArea={filters.areas[0]}
          businessTab={businessTab}
          selectedEstablishment={selectedEstablishment}
          selectedHouseholder={selectedHouseholder}
        />
      </motion.div>
    </>
  );
}
