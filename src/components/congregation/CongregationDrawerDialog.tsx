"use client";

import * as React from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { FabMenu } from "@/components/shared/FabMenu";
import { FormModal } from "@/components/shared/FormModal";
import { UserPlus, Plus, FilePlus2 } from "lucide-react";
import { AddUserToCongregationForm } from "@/components/congregation/AddUserToCongregationForm";
import { HouseholderForm } from "@/components/business/HouseholderForm";
import { VisitForm } from "@/components/business/VisitForm";

interface CongregationDrawerDialogProps {
  congregationId: string;
  onUserAdded?: (user: any) => void;
  congregationTab?: 'meetings' | 'ministry' | 'admin';
  userId?: string | null;
  selectedHouseholder?: { id: string; name: string; status?: string; establishment_id?: string | null } | null;
}

export function CongregationDrawerDialog({ congregationId, onUserAdded, congregationTab = 'meetings', userId, selectedHouseholder }: CongregationDrawerDialogProps) {
  const [open, setOpen] = React.useState(false);
  // Consider desktop at >=1280px so medium tablets use floating FAB
  const isDesktop = useMediaQuery("(min-width: 1280px)");
  const isMinistryTab = congregationTab === 'ministry';
  const isHouseholderDetails = !!selectedHouseholder;
  const triggerLabel = isHouseholderDetails
    ? "New visit"
    : isMinistryTab
      ? "Add householder"
      : "Add user to congregation";
  const triggerIcon = isHouseholderDetails ? <FilePlus2 className="h-6 w-6" /> : isMinistryTab ? <Plus className="h-6 w-6" /> : <UserPlus className="h-6 w-6" />;

  const handleAdded = (user: any) => {
    onUserAdded?.(user);
    try {
      window.dispatchEvent(new CustomEvent('congregation-refresh'));
    } catch {}
    setOpen(false);
  };

  const handleHouseholderSaved = () => {
    try {
      window.dispatchEvent(new CustomEvent('congregation-refresh'));
    } catch {}
    setOpen(false);
  };

  if (isDesktop) {
    return (
      <>
        <Button
          variant="outline"
          className="fixed right-4 bottom-[104px] z-40 md:right-6 lg:right-8 lg:bottom-8"
          title={triggerLabel}
          aria-label={triggerLabel}
          onClick={() => setOpen(true)}
        >
            {isHouseholderDetails ? <FilePlus2 className="h-4 w-4 mr-2" /> : isMinistryTab ? <Plus className="h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />} {isHouseholderDetails ? "New Visit" : "Add"}
          </Button>
        <FormModal
          open={open}
          onOpenChange={setOpen}
          title={isHouseholderDetails ? "New Visit" : isMinistryTab ? "New Householder" : "Add Publisher"}
          description={isHouseholderDetails ? "Record a visit update" : isMinistryTab ? "Add a personal householder with location" : "Add a user to this congregation."}
          headerClassName="text-center"
        >
            {isHouseholderDetails ? (
              <VisitForm
                establishments={[]}
                selectedEstablishmentId="none"
                disableEstablishmentSelect
                householderId={selectedHouseholder?.id}
                householderName={selectedHouseholder?.name}
                householderStatus={selectedHouseholder?.status}
                onSaved={() => setOpen(false)}
              />
            ) : isMinistryTab ? (
              <HouseholderForm 
                establishments={[]}
                onSaved={handleHouseholderSaved}
                context="congregation"
                publisherId={userId || undefined}
              />
            ) : (
              <AddUserToCongregationForm congregationId={congregationId} onUserAdded={handleAdded} onClose={() => setOpen(false)} />
            )}
        </FormModal>
      </>
    );
  }

  return (
    <>
      <FabMenu
        label={triggerLabel}
        mainIcon={triggerIcon}
        mainIconOpen={triggerIcon}
        mainClassName="bg-primary text-primary-foreground lg:h-16 lg:w-16 lg:right-8 lg:bottom-8"
        actions={[
          {
            label: isHouseholderDetails ? "New Visit" : isMinistryTab ? "Add Householder" : "Add Publisher",
            icon: isHouseholderDetails ? <FilePlus2 className="h-4 w-4" /> : isMinistryTab ? <Plus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />,
            onClick: () => setOpen(true)
          }
        ]}
      />
      <FormModal
        open={open}
        onOpenChange={setOpen}
        title={isHouseholderDetails ? "New Visit" : isMinistryTab ? "New Householder" : "Add Publisher"}
        description={isHouseholderDetails ? "Record a visit update" : isMinistryTab ? "Add a personal householder with location" : "Add a user to this congregation."}
        headerClassName="text-center"
      >
          {isHouseholderDetails ? (
            <VisitForm
              establishments={[]}
              selectedEstablishmentId="none"
              disableEstablishmentSelect
              householderId={selectedHouseholder?.id}
              householderName={selectedHouseholder?.name}
              householderStatus={selectedHouseholder?.status}
              onSaved={() => setOpen(false)}
            />
          ) : isMinistryTab ? (
            <HouseholderForm 
              establishments={[]}
              onSaved={handleHouseholderSaved}
              context="congregation"
              publisherId={userId || undefined}
            />
          ) : (
            <AddUserToCongregationForm congregationId={congregationId} onUserAdded={handleAdded} onClose={() => setOpen(false)} />
          )}
      </FormModal>
    </>
  );
}


