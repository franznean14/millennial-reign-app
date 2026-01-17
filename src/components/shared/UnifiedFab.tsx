"use client";

import { useMemo, useState } from "react";
import { FormModal } from "@/components/shared/FormModal";
import { FabMenu } from "@/components/shared/FabMenu";
import { EstablishmentForm } from "@/components/business/EstablishmentForm";
import { HouseholderForm } from "@/components/business/HouseholderForm";
import { VisitForm } from "@/components/business/VisitForm";
import FieldServiceForm from "@/components/fieldservice/FieldServiceForm";
import { EventScheduleForm } from "@/components/congregation/EventScheduleForm";
import { AddUserToCongregationForm } from "@/components/congregation/AddUserToCongregationForm";
import { Plus, X, UserPlus, FilePlus2, Building2, Calendar } from "lucide-react";
import type { EstablishmentWithDetails, HouseholderWithDetails } from "@/lib/db/business";

type BusinessTab = "establishments" | "householders" | "map";
type CongregationTab = "meetings" | "ministry" | "admin";

interface UnifiedFabProps {
  currentSection: string;
  userId: string;
  // business
  establishments: EstablishmentWithDetails[];
  selectedEstablishment: EstablishmentWithDetails | null;
  selectedHouseholder: HouseholderWithDetails | null;
  selectedArea?: string;
  businessTab: BusinessTab;
  // congregation
  congregationId?: string | null;
  congregationTab: CongregationTab;
  isElder: boolean;
  isAdmin: boolean;
  congregationSelectedHouseholder: HouseholderWithDetails | null;
}

type FabActionKey =
  | "business-establishment"
  | "business-householder"
  | "business-visit"
  | "congregation-householder"
  | "congregation-user"
  | "congregation-visit"
  | "congregation-schedule"
  | "field-service"
  | null;

export function UnifiedFab({
  currentSection,
  userId,
  establishments,
  selectedEstablishment,
  selectedHouseholder,
  selectedArea,
  businessTab,
  congregationId,
  congregationTab,
  isElder,
  isAdmin,
  congregationSelectedHouseholder
}: UnifiedFabProps) {
  const [openKey, setOpenKey] = useState<FabActionKey>(null);

  const businessEstablishmentId =
    selectedHouseholder?.establishment_id || selectedEstablishment?.id || undefined;
  const isBusinessDetails = !!selectedEstablishment || !!selectedHouseholder;
  const showExpandableButtons = !!selectedEstablishment && !selectedHouseholder;
  const showEstablishmentForm = !selectedEstablishment && !selectedHouseholder && businessTab === "establishments";
  const showHouseholderForm = !selectedEstablishment && !selectedHouseholder && businessTab === "householders";
  const showVisitForm = !!selectedEstablishment || !!selectedHouseholder;

  const canManageCongregation = isElder || isAdmin;
  const isCongregationAdminTab = congregationTab === "admin" && isElder;
  const isCongregationMinistryTab = congregationTab === "ministry";
  const isCongregationDetails = !!congregationSelectedHouseholder;

  const actions = useMemo(() => {
    const items: { key: FabActionKey; label: string; icon: JSX.Element; variant?: "default" | "outline" }[] = [];

    if (currentSection === "business" || currentSection.startsWith("business-")) {
      if (showExpandableButtons) {
        items.push(
          { key: "business-householder", label: "New Householder", icon: <UserPlus className="h-4 w-4" />, variant: "outline" },
          { key: "business-visit", label: "New Visit", icon: <FilePlus2 className="h-4 w-4" /> }
        );
      } else if (showEstablishmentForm) {
        items.push({ key: "business-establishment", label: "New Establishment", icon: <Building2 className="h-4 w-4" /> });
      } else if (showHouseholderForm) {
        items.push({ key: "business-householder", label: "New Householder", icon: <UserPlus className="h-4 w-4" />, variant: "outline" });
      } else if (showVisitForm) {
        items.push({ key: "business-visit", label: "New Visit", icon: <FilePlus2 className="h-4 w-4" /> });
      }
    }

    if (currentSection === "congregation" && canManageCongregation) {
      if (isCongregationAdminTab) {
        items.push({ key: "congregation-schedule", label: "New Schedule", icon: <Calendar className="h-4 w-4" /> });
      } else if (isCongregationMinistryTab && isCongregationDetails) {
        items.push({ key: "congregation-visit", label: "New Visit", icon: <FilePlus2 className="h-4 w-4" /> });
      } else if (isCongregationMinistryTab) {
        items.push({ key: "congregation-householder", label: "Add Householder", icon: <UserPlus className="h-4 w-4" /> });
      } else {
        items.push({ key: "congregation-user", label: "Add Publisher", icon: <UserPlus className="h-4 w-4" /> });
      }
    }

    if (currentSection === "home") {
      items.push({ key: "field-service", label: "Field Service", icon: <FilePlus2 className="h-4 w-4" /> });
    }

    return items;
  }, [
    businessTab,
    canManageCongregation,
    currentSection,
    isCongregationAdminTab,
    isCongregationDetails,
    isCongregationMinistryTab,
    showEstablishmentForm,
    showExpandableButtons,
    showHouseholderForm,
    showVisitForm
  ]);

  if (actions.length === 0) return null;

  const mainIcon = actions.length === 1 ? actions[0].icon : <Plus className="h-6 w-6" />;
  const mainIconOpen = actions.length === 1 ? actions[0].icon : <X className="h-6 w-6" />;

  return (
    <>
      <FabMenu
        label="Actions"
        mainIcon={mainIcon}
        mainIconOpen={mainIconOpen}
        mainClassName="bg-primary text-primary-foreground lg:h-16 lg:w-16 lg:right-8 lg:bottom-8"
        actions={actions.map((action) => ({
          label: action.label,
          icon: action.icon,
          variant: action.variant,
          onClick: () => setOpenKey(action.key)
        }))}
      />

      <FormModal
        open={openKey === "business-establishment"}
        onOpenChange={(open) => setOpenKey(open ? "business-establishment" : null)}
        title="New Establishment"
        description="Add a business establishment."
        headerClassName="text-center"
      >
        <EstablishmentForm
          onSaved={() => setOpenKey(null)}
          selectedArea={selectedArea}
        />
      </FormModal>

      <FormModal
        open={openKey === "business-householder"}
        onOpenChange={(open) => setOpenKey(open ? "business-householder" : null)}
        title="New Householder"
        description="Add a householder for an establishment."
        headerClassName="text-center"
      >
        <HouseholderForm
          establishments={establishments}
          selectedEstablishmentId={businessEstablishmentId}
          onSaved={() => setOpenKey(null)}
          disableEstablishmentSelect={showExpandableButtons}
        />
      </FormModal>

      <FormModal
        open={openKey === "business-visit"}
        onOpenChange={(open) => setOpenKey(open ? "business-visit" : null)}
        title="Visit Update"
        description="Record a visit note."
        headerClassName="text-center"
      >
        <VisitForm
          establishments={establishments}
          selectedEstablishmentId={businessEstablishmentId}
          householderId={selectedHouseholder?.id}
          householderName={selectedHouseholder?.name}
          householderStatus={selectedHouseholder?.status}
          onSaved={() => setOpenKey(null)}
          disableEstablishmentSelect={showExpandableButtons}
        />
      </FormModal>

      <FormModal
        open={openKey === "congregation-householder"}
        onOpenChange={(open) => setOpenKey(open ? "congregation-householder" : null)}
        title="New Householder"
        description="Add a personal householder with location"
        headerClassName="text-center"
      >
        <HouseholderForm
          establishments={[]}
          onSaved={() => setOpenKey(null)}
          context="congregation"
          publisherId={userId}
        />
      </FormModal>

      <FormModal
        open={openKey === "congregation-user"}
        onOpenChange={(open) => setOpenKey(open ? "congregation-user" : null)}
        title="Add Publisher"
        description="Add a user to this congregation."
        headerClassName="text-center"
      >
        {congregationId ? (
          <AddUserToCongregationForm
            congregationId={congregationId}
            onUserAdded={() => {
              try {
                window.dispatchEvent(new CustomEvent("congregation-refresh"));
              } catch {}
              setOpenKey(null);
            }}
            onClose={() => setOpenKey(null)}
          />
        ) : null}
      </FormModal>

      <FormModal
        open={openKey === "congregation-visit"}
        onOpenChange={(open) => setOpenKey(open ? "congregation-visit" : null)}
        title="New Visit"
        description="Record a visit update"
        headerClassName="text-center"
      >
        <VisitForm
          establishments={[]}
          selectedEstablishmentId="none"
          disableEstablishmentSelect
          householderId={congregationSelectedHouseholder?.id}
          householderName={congregationSelectedHouseholder?.name}
          householderStatus={congregationSelectedHouseholder?.status}
          onSaved={() => setOpenKey(null)}
        />
      </FormModal>

      <FormModal
        open={openKey === "congregation-schedule"}
        onOpenChange={(open) => setOpenKey(open ? "congregation-schedule" : null)}
        title="New Event Schedule"
        description="Create a new event schedule"
        headerClassName="text-center"
      >
        {congregationId ? (
          <EventScheduleForm
            congregationId={congregationId}
            onSaved={() => {
              try {
                window.dispatchEvent(new CustomEvent("event-schedule-refresh"));
              } catch {}
              setOpenKey(null);
            }}
          />
        ) : null}
      </FormModal>

      <FormModal
        open={openKey === "field-service"}
        onOpenChange={(open) => setOpenKey(open ? "field-service" : null)}
        title="Field Service"
        description="Record your daily activity."
        headerClassName="text-center"
      >
        <FieldServiceForm userId={userId} onClose={() => setOpenKey(null)} />
      </FormModal>
    </>
  );
}
