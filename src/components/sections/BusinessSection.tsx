"use client";

import { useCallback, useMemo, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SectionShell } from "@/components/shared/SectionShell";
import dynamic from "next/dynamic";
import { StickySearchBar } from "@/components/business/StickySearchBar";
import { DetailsDrawer } from "@/components/shared/DetailsDrawer";
import { cn } from "@/lib/utils";
import { getStudyBibleDarkCardShade } from "@/lib/theme/study-bible-dark";
import { resolveDetailsDrawerTitle } from "@/lib/utils/status-hierarchy";
import { useMediaQuery } from "@/hooks/use-media-query";
import type {
  BusinessFiltersState,
  EstablishmentWithDetails,
  ContactWithDetails,
  MyOpenTodoTargets,
  VisitWithUser
} from "@/lib/db/business";
import { filterContactsWithMyOpenTodos } from "@/lib/utils/business-todo-filter";

type BusinessTab = "establishments" | "contacts" | "map";
type EstablishmentSelectionSource = "list" | "map";
type MapViewState = { center: [number, number]; zoom: number };
type BusinessEditSheet = "establishment" | "contact" | null;

const EstablishmentList = dynamic(
  () => import("@/components/business/EstablishmentList").then((m) => m.EstablishmentList),
  { ssr: false }
);
const ContactList = dynamic(
  () => import("@/components/business/ContactList").then((m) => m.ContactList),
  { ssr: false }
);
const EstablishmentDetails = dynamic(
  () => import("@/components/business/EstablishmentDetails").then((m) => m.EstablishmentDetails),
  { ssr: false }
);
const ContactDetails = dynamic(
  () => import("@/components/business/ContactDetails").then((m) => m.ContactDetails),
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
const ContactForm = dynamic(
  () => import("@/components/business/ContactForm").then((m) => m.ContactForm),
  { ssr: false }
);

export interface BusinessSectionProps {
  userId: string | null;
  portaledControls: ReactNode;
  businessTab: BusinessTab;
  filters: BusinessFiltersState;
  setFilters: Dispatch<SetStateAction<BusinessFiltersState>>;
  filtersModalOpen: boolean;
  setFiltersModalOpen: Dispatch<SetStateAction<boolean>>;
  viewMode: "detailed" | "compact" | "table";
  setViewMode: Dispatch<SetStateAction<"detailed" | "compact" | "table">>;
  filteredEstablishments: EstablishmentWithDetails[];
  filteredContacts: ContactWithDetails[];
  establishments: EstablishmentWithDetails[];
  selectedEstablishment: EstablishmentWithDetails | null;
  setSelectedEstablishment: Dispatch<SetStateAction<EstablishmentWithDetails | null>>;
  selectedEstablishmentDetails: {
    establishment: EstablishmentWithDetails;
    visits: VisitWithUser[];
    contacts: ContactWithDetails[];
  } | null;
  establishmentDetailsLoading: boolean;
  setSelectedEstablishmentDetails: Dispatch<
    SetStateAction<{
      establishment: EstablishmentWithDetails;
      visits: VisitWithUser[];
      contacts: ContactWithDetails[];
    } | null>
  >;
  selectedContact: ContactWithDetails | null;
  setSelectedContact: Dispatch<SetStateAction<ContactWithDetails | null>>;
  selectedContactDetails: {
    contact: ContactWithDetails;
    visits: VisitWithUser[];
    establishment?: { id: string; name: string } | null;
  } | null;
  contactDetailsLoading: boolean;
  setSelectedContactDetails: Dispatch<
    SetStateAction<{
      contact: ContactWithDetails;
      visits: VisitWithUser[];
      establishment?: { id: string; name: string } | null;
    } | null>
  >;
  loadEstablishmentDetails: (establishmentId: string) => void;
  loadContactDetails: (contactId: string) => void;
  handleDeleteEstablishment: (establishment: EstablishmentWithDetails) => void | Promise<void>;
  handleArchiveEstablishment: (establishment: EstablishmentWithDetails) => void | Promise<void>;
  handleDeleteContact: (contact: ContactWithDetails) => void | Promise<void>;
  handleArchiveContact: (contact: ContactWithDetails) => void | Promise<void>;
  handleClearAllFilters: () => void;
  handleClearSearch: () => void;
  handleRemoveStatus: (status: string) => void;
  handleRemoveArea: (area: string) => void;
  handleRemoveFloor: (floor: string) => void;
  dynamicStatusOptions: { value: string; label: string }[];
  dynamicAreaOptions: { value: string; label: string }[];
  dynamicFloorOptions: { value: string; label: string }[];
  myOpenTodoTargets: MyOpenTodoTargets;
  updateEstablishment: (updated: Partial<EstablishmentWithDetails> & { id: string }) => void;
  canManagePersonalTerritoryOwner?: boolean;
}

export function BusinessSection({
  userId,
  portaledControls,
  businessTab,
  filters,
  setFilters,
  filtersModalOpen,
  setFiltersModalOpen,
  viewMode,
  setViewMode,
  filteredEstablishments,
  filteredContacts,
  establishments,
  selectedEstablishment,
  setSelectedEstablishment,
  selectedEstablishmentDetails,
  establishmentDetailsLoading,
  setSelectedEstablishmentDetails,
  selectedContact,
  setSelectedContact,
  selectedContactDetails,
  contactDetailsLoading,
  setSelectedContactDetails,
  loadEstablishmentDetails,
  loadContactDetails,
  handleDeleteEstablishment,
  handleArchiveEstablishment,
  handleDeleteContact,
  handleArchiveContact,
  handleClearAllFilters,
  handleClearSearch,
  handleRemoveStatus,
  handleRemoveArea,
  handleRemoveFloor,
  dynamicStatusOptions,
  dynamicAreaOptions,
  dynamicFloorOptions,
  myOpenTodoTargets,
  updateEstablishment,
  canManagePersonalTerritoryOwner = false,
}: BusinessSectionProps) {
  const [lastMapSelectedEstablishmentId, setLastMapSelectedEstablishmentId] = useState<string | undefined>(undefined);
  const [mapViewState, setMapViewState] = useState<MapViewState | null>(null);
  const [businessEditSheet, setBusinessEditSheet] = useState<BusinessEditSheet>(null);
  const isTabletUp = useMediaQuery("(min-width: 768px)");
  /** Phone: list/map stays visible; establishment/contact details open in bottom drawers. */
  const useMobileBottomDetails = !isTabletUp;

  const bwiBizScope = userId ?? "anon";
  const businessEstablishmentDetailShade = useMemo(
    () => getStudyBibleDarkCardShade(`bwi-business-est-detail:${bwiBizScope}`),
    [bwiBizScope]
  );
  const businessContactDetailShade = useMemo(
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

  const activeEstablishment = selectedEstablishmentDetails?.establishment ?? selectedEstablishment;
  const activeContact = selectedContactDetails?.contact ?? selectedContact;
  const establishmentDrawerTitle = useMemo(
    () =>
      resolveDetailsDrawerTitle(
        {
          kind: "establishment",
          name: activeEstablishment?.name,
          statuses: activeEstablishment?.statuses,
          publisher_id: activeEstablishment?.publisher_id,
        },
        userId
      ),
    [activeEstablishment, userId]
  );
  const contactDrawerTitle = useMemo(
    () =>
      resolveDetailsDrawerTitle(
        {
          kind: "contact",
          name: activeContact?.name,
          statuses: activeContact?.statuses,
          publisher_id: activeContact?.publisher_id,
        },
        userId
      ),
    [activeContact, userId]
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

  const visibleEstablishmentContacts = useCallback(
    (contacts: ContactWithDetails[]) => {
      if (!filters.myTodosOnly) return contacts;
      return filterContactsWithMyOpenTodos(contacts, myOpenTodoTargets);
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

  const handleSelectEstablishment = useCallback(
    (establishment: EstablishmentWithDetails, source: EstablishmentSelectionSource = "list") => {
      if (source === "map" && establishment.id) {
        setLastMapSelectedEstablishmentId(establishment.id);
      }
      setSelectedEstablishment(establishment);
      if (establishment.id) {
        loadEstablishmentDetails(establishment.id);
      }
    },
    [loadEstablishmentDetails, setSelectedEstablishment]
  );

  const handleSelectContact = useCallback(
    (contact: ContactWithDetails) => {
      setSelectedContact(contact);
      if (contact.id) {
        loadContactDetails(contact.id);
      }
    },
    [loadContactDetails, setSelectedContact]
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
    setSelectedContact(null);
    setSelectedContactDetails(null);
    setSelectedEstablishment(null);
    setSelectedEstablishmentDetails(null);
  }, [
    setSelectedEstablishment,
    setSelectedEstablishmentDetails,
    setSelectedContact,
    setSelectedContactDetails,
  ]);

  const closeContactSideDetails = useCallback(() => {
    setBusinessEditSheet(null);
    setSelectedContact(null);
    setSelectedContactDetails(null);
  }, [setSelectedContact, setSelectedContactDetails]);

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

  const handleContactEditSaved = useCallback(
    (updated?: Partial<ContactWithDetails> & { id?: string }) => {
      setBusinessEditSheet(null);
      if (updated?.id) {
        setSelectedContact((prev) => {
          if (!prev || prev.id !== updated.id) return prev;
          return { ...prev, ...updated, id: prev.id, name: updated.name ?? prev.name } as ContactWithDetails;
        });
        loadContactDetails(updated.id);
      } else if (selectedContact?.id) {
        loadContactDetails(selectedContact.id);
      }
      if (selectedEstablishment?.id) {
        loadEstablishmentDetails(selectedEstablishment.id);
      }
    },
    [
      loadEstablishmentDetails,
      loadContactDetails,
      selectedEstablishment?.id,
      selectedContact?.id,
      setSelectedContact,
    ]
  );

  const renderContactDetails = (options?: { stacked?: boolean }) => {
    if (!selectedContact) return null;
    return (
      <ContactDetails
        contact={selectedContactDetails?.contact || selectedContact}
        visits={selectedContactDetails?.visits || []}
        establishment={selectedContactDetails?.establishment || null}
        establishments={
          selectedContactDetails?.establishment ? [selectedContactDetails.establishment] : []
        }
        isLoading={contactDetailsLoading}
        onBackClick={closeContactSideDetails}
        publisherId={userId}
        onRequestSummaryEdit={() => setBusinessEditSheet("contact")}
        preferLeftDetailPanel={isTabletUp}
        insideStackedContactPane={options?.stacked}
        detailsDrawerSurfaceKey={
          options?.stacked
            ? `bwi-business-contact-stack:${bwiBizScope}`
            : `bwi-business-hh-detail:${bwiBizScope}`
        }
      />
    );
  };

  const renderEstablishmentDetails = () => {
    if (!selectedEstablishment) return null;
    return (
      <EstablishmentDetails
        establishment={selectedEstablishmentDetails?.establishment ?? selectedEstablishment}
        visits={selectedEstablishmentDetails?.visits || []}
        contacts={visibleEstablishmentContacts(selectedEstablishmentDetails?.contacts || [])}
        isLoading={establishmentDetailsLoading}
        canManagePersonalTerritoryOwner={canManagePersonalTerritoryOwner}
        onBackClick={closeEstablishmentSideDetails}
        onRequestSummaryEdit={() => setBusinessEditSheet("establishment")}
        onEstablishmentUpdated={(est) => est?.id && updateEstablishment({ id: est.id!, ...est })}
        onContactClick={(hh) => {
          setSelectedContact(hh);
          if (hh.id) loadContactDetails(hh.id);
        }}
        preferLeftDetailPanel={isTabletUp}
        insideStackedContactPane={!!selectedContact && !!selectedEstablishment}
        publisherId={userId}
        detailsDrawerSurfaceKey={`bwi-business-est-detail:${bwiBizScope}`}
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
            {businessTab === "establishments" ? (
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
            ) : businessTab === "contacts" ? (
              <motion.div key="contact-list" {...listMotion} className="w-full">
                <ContactList
                  contacts={filteredContacts}
                  onContactClick={handleSelectContact}
                  onContactDelete={handleDeleteContact}
                  onContactArchive={handleArchiveContact}
                  myContactsOnly={filters.myEstablishments}
                  onMyContactsChange={(checked) =>
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
                  openPoolEstablishmentIds={myOpenTodoTargets.openPoolEstablishmentIds}
                />
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

        <DetailsDrawer
          open={!!selectedEstablishment}
          onOpenChange={(open) => {
            if (!open) closeEstablishmentSideDetails();
          }}
          entityName={establishmentDrawerTitle.name}
          titleStatus={establishmentDrawerTitle.titleStatus}
          bodyClassName="space-y-3"
          contentClassName={businessEstablishmentDetailShade}
        >
          {renderEstablishmentDetails()}
        </DetailsDrawer>

        <DetailsDrawer
          open={!!selectedContact && !selectedEstablishment}
          onOpenChange={(open) => {
            if (!open) closeContactSideDetails();
          }}
          entityName={contactDrawerTitle.name}
          titleStatus={contactDrawerTitle.titleStatus}
          bodyClassName="space-y-3"
          contentClassName={businessContactDetailShade}
        >
          {renderContactDetails()}
        </DetailsDrawer>

        <DetailsDrawer
          open={!!selectedContact && !!selectedEstablishment}
          onOpenChange={(open) => {
            if (!open) closeContactSideDetails();
          }}
          entityName={contactDrawerTitle.name}
          titleStatus={contactDrawerTitle.titleStatus}
          bodyClassName="space-y-3"
          contentClassName={businessContactStackShade}
          stackAboveParentSheet={useMobileBottomDetails}
          stackAboveDetailsSheet={isTabletUp}
        >
          {renderContactDetails({ stacked: true })}
        </DetailsDrawer>

        <FormModal
          open={!!businessEditSheet}
          onOpenChange={(open) => {
            if (!open) setBusinessEditSheet(null);
          }}
          title={businessEditSheet === "contact" ? "Edit Contact" : "Edit Establishment"}
          headerClassName="text-center"
          desktopPresentation={isTabletUp ? "left-sheet" : "auto"}
          leftSheetStackAboveNestedRight={!!selectedContact && !!selectedEstablishment}
          stackAboveParentSheet={
            useMobileBottomDetails && !(!!selectedContact && !!selectedEstablishment)
          }
          stackAboveStackedParentSheet={!!selectedContact && !!selectedEstablishment}
          className={cn(
            "border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff]",
            businessEntityEditShade
          )}
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
          ) : businessEditSheet === "contact" && selectedContact ? (
            <ContactForm
              key={selectedContact.id}
              establishments={selectedEstablishment ? [selectedEstablishment] : establishments}
              selectedEstablishmentId={selectedContact.establishment_id ?? undefined}
              isEditing
              initialData={{
                id: selectedContact.id,
                establishment_id: selectedContact.establishment_id || "",
                name: selectedContact.name,
                statuses: selectedContact.statuses,
                note: selectedContact.note || null,
                lat: selectedContact.lat ?? null,
                lng: selectedContact.lng ?? null,
                publisher_id: selectedContact.publisher_id ?? null,
              }}
              onSaved={handleContactEditSaved}
              onDelete={async () => {
                await handleDeleteContact(selectedContact);
                closeContactSideDetails();
              }}
              onArchive={async () => {
                await handleArchiveContact(selectedContact);
                closeContactSideDetails();
              }}
              disableEstablishmentSelect={!!selectedEstablishment}
              publisherId={userId ?? undefined}
            />
          ) : null}
        </FormModal>

        {/* FAB handled by UnifiedFab */}
      </SectionShell>
    </>
  );
}
