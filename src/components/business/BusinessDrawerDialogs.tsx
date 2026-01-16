"use client";

import * as React from "react";
import { useState } from "react";
import { FormModal } from "@/components/shared/FormModal";
import { FabMenu } from "@/components/shared/FabMenu";
import { Plus, X, UserPlus, FilePlus2 } from "lucide-react";
import { EstablishmentForm } from "@/components/business/EstablishmentForm";
import { HouseholderForm } from "@/components/business/HouseholderForm";
import { VisitForm } from "@/components/business/VisitForm";
import type { EstablishmentWithDetails } from "@/lib/db/business";

interface BusinessDrawerDialogsProps {
  establishments: EstablishmentWithDetails[];
  selectedEstablishmentId?: string;
  selectedArea?: string;
  businessTab?: 'establishments' | 'householders' | 'map';
  selectedEstablishment?: EstablishmentWithDetails | null;
  selectedHouseholder?: any | null;
}

export function BusinessDrawerDialogs({ 
  establishments, 
  selectedEstablishmentId, 
  selectedArea, 
  businessTab = 'establishments',
  selectedEstablishment,
  selectedHouseholder 
}: BusinessDrawerDialogsProps) {
  // When viewing a householder, use the householder's establishment_id
  // Otherwise, use the selected establishment's ID or the provided selectedEstablishmentId
  const establishmentId = selectedHouseholder?.establishment_id || selectedEstablishment?.id || selectedEstablishmentId;
  const [openEst, setOpenEst] = useState(false);
  const [openHh, setOpenHh] = useState(false);
  const [openVisit, setOpenVisit] = useState(false);
  const actions = [];

  // Determine which form to open based on current state
  const showEstablishmentForm = !selectedEstablishment && !selectedHouseholder && businessTab === 'establishments';
  const showHouseholderForm = !selectedEstablishment && !selectedHouseholder && businessTab === 'householders';
  const showVisitForm = selectedEstablishment || selectedHouseholder;
  const showExpandableButtons = selectedEstablishment && !selectedHouseholder; // Only for establishment details
  const showHouseholderDialog = showHouseholderForm;

  if (showExpandableButtons) {
    actions.push(
      {
        label: "New Householder",
        icon: <UserPlus className="h-4 w-4" />,
        onClick: () => setOpenHh(true),
        variant: "outline"
      },
      {
        label: "New Visit",
        icon: <FilePlus2 className="h-4 w-4" />,
        onClick: () => setOpenVisit(true)
      }
    );
  } else if (showEstablishmentForm) {
    actions.push({
      label: "New Establishment",
      icon: <Plus className="h-4 w-4" />,
      onClick: () => setOpenEst(true)
    });
  } else if (showHouseholderDialog) {
    actions.push({
      label: "New Householder",
      icon: <UserPlus className="h-4 w-4" />,
      onClick: () => setOpenHh(true),
      variant: "outline"
    });
  } else if (showVisitForm) {
    actions.push({
      label: "New Visit",
      icon: <FilePlus2 className="h-4 w-4" />,
      onClick: () => setOpenVisit(true)
    });
  }

  return (
    <>
      <FabMenu
        label="Business actions"
        mainIcon={<Plus className="h-6 w-6" />}
        mainIconOpen={<X className="h-6 w-6" />}
        actions={actions}
      />
      {(showEstablishmentForm || openEst) && (
        <FormModal
          open={openEst}
          onOpenChange={setOpenEst}
          title="New Establishment"
          description="Add a business establishment."
          headerClassName="text-center"
        >
          <EstablishmentForm
            onSaved={() => setOpenEst(false)}
            selectedArea={selectedArea}
          />
        </FormModal>
      )}
      {(showHouseholderDialog || openHh) && (
        <FormModal
          open={openHh}
          onOpenChange={setOpenHh}
          title="New Householder"
          description="Add a householder for an establishment."
          headerClassName="text-center"
        >
          <HouseholderForm
            establishments={establishments}
            selectedEstablishmentId={establishmentId}
            onSaved={() => setOpenHh(false)}
            disableEstablishmentSelect={!!showExpandableButtons}
          />
        </FormModal>
      )}
      {(showVisitForm || openVisit) && (
        <FormModal
          open={openVisit}
          onOpenChange={setOpenVisit}
          title="Visit Update"
          description="Record a visit note."
          headerClassName="text-center"
        >
          <VisitForm
            establishments={establishments}
            selectedEstablishmentId={establishmentId}
            householderId={selectedHouseholder?.id}
            householderName={selectedHouseholder?.name}
            householderStatus={selectedHouseholder?.status}
            onSaved={() => setOpenVisit(false)}
            disableEstablishmentSelect={!!showExpandableButtons}
          />
        </FormModal>
      )}
    </>
  );
}


