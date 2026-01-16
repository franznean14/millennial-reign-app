"use client";

import { useState, useEffect } from "react";
import { FabMenu } from "@/components/shared/FabMenu";
import { Plus, Building2, UserPlus, FilePlus2, X } from "lucide-react";
import { FormModal } from "@/components/shared/FormModal";
import { isBusinessEnabled, isBusinessParticipant, listEstablishments } from "@/lib/db/business";
import { EstablishmentForm as EstablishmentFormStandalone } from "@/components/business/EstablishmentForm";
import { HouseholderForm } from "@/components/business/HouseholderForm";
import { VisitForm } from "@/components/business/VisitForm";

export function BusinessFloatingButton({ 
  selectedArea, 
  selectedEstablishmentId,
  onEstablishmentAdded,
  onHouseholderAdded,
  onVisitAdded,
  // Householder context props
  householderId,
  householderName,
  householderStatus
}: { 
  selectedArea?: string; 
  selectedEstablishmentId?: string;
  onEstablishmentAdded?: (establishment: any) => void;
  onHouseholderAdded?: (householder: any) => void;
  onVisitAdded?: (visit: any) => void;
  // Householder context props
  householderId?: string;
  householderName?: string;
  householderStatus?: string;
}) {
  const [enabled, setEnabled] = useState(false);
  const [participant, setParticipant] = useState(false);
  const [establishments, setEstablishments] = useState<any[]>([]);
  const [open, setOpen] = useState<null | 'est' | 'hh' | 'visit'>(null);
  // In-memory draft for New Establishment (session scoped)
  const [newEstDraft, setNewEstDraft] = useState<any>(null);

  // Check if business features are enabled
  useEffect(() => {
    (async () => {
      setEnabled(await isBusinessEnabled());
      setParticipant(await isBusinessParticipant());
      setEstablishments(await listEstablishments());
    })();
  }, []);

  const canUse = enabled && participant;

  if (!canUse) return null;

  return (
    <>
      <FabMenu
        label="Business actions"
        mainIcon={<Plus className="h-6 w-6" />}
        mainIconOpen={<X className="h-6 w-6" />}
        actions={[
          {
            label: "Establishment",
            icon: <Building2 className="h-4 w-4" />,
            onClick: () => setOpen("est"),
            variant: "outline"
          },
          {
            label: "Householder",
            icon: <UserPlus className="h-4 w-4" />,
            onClick: () => setOpen("hh"),
            variant: "outline"
          },
          {
            label: "Visit",
            icon: <FilePlus2 className="h-4 w-4" />,
            onClick: () => setOpen("visit")
          }
        ]}
      />

      {/* Establishment form (standalone component) */}
      <FormModal open={open==='est'} onOpenChange={(o)=> setOpen(o? 'est': null)} title="New Establishment" description="Add a business establishment" className="sm:max-w-[560px]">
        <EstablishmentFormStandalone 
          onSaved={async () => { 
            setOpen(null); 
            setEstablishments(await listEstablishments());
            setNewEstDraft(null);
          }} 
          selectedArea={selectedArea}
          draft={newEstDraft}
          onDraftChange={setNewEstDraft}
        />
      </FormModal>
      <FormModal open={open==='hh'} onOpenChange={(o)=> setOpen(o? 'hh': null)} title="New Householder" description="Add a householder for an establishment" className="sm:max-w-[560px]">
        <HouseholderForm 
          establishments={establishments} 
          selectedEstablishmentId={selectedEstablishmentId}
          onSaved={() => {
            setOpen(null);
          }} 
        />
      </FormModal>
      <FormModal open={open==='visit'} onOpenChange={(o)=> setOpen(o? 'visit': null)} title="Visit Update" description="Record a visit note" className="sm:max-w-[560px]">
        <VisitForm 
          establishments={establishments} 
          selectedEstablishmentId={selectedEstablishmentId}
          householderId={householderId}
          householderName={householderName}
          householderStatus={householderStatus}
          onSaved={() => {
            setOpen(null);
          }} 
        />
      </FormModal>
    </>
  );
}

// inline HouseholderForm and VisitForm removed; using standalone components above

// Export the EstablishmentForm component
// (Inline EstablishmentForm is no longer exported; use the standalone component at
// '@/components/business/EstablishmentForm' instead.)
