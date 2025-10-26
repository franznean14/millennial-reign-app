"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Building2, UserPlus, FilePlus2, X } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
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
  const [expanded, setExpanded] = useState(false);
  // In-memory draft for New Establishment (session scoped)
  const [newEstDraft, setNewEstDraft] = useState<any>(null);
  const fabContainerRef = useRef<HTMLDivElement>(null);

  // Check if business features are enabled
  useEffect(() => {
    (async () => {
      setEnabled(await isBusinessEnabled());
      setParticipant(await isBusinessParticipant());
      setEstablishments(await listEstablishments());
    })();
  }, []);

  const canUse = enabled && participant;

  // Collapse expanded buttons when clicking/tapping outside
  useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (event: PointerEvent) => {
      const root = fabContainerRef.current;
      if (!root) return;
      const target = event.target as Node | null;
      if (target && !root.contains(target)) {
        setExpanded(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, { capture: true });
    return () => document.removeEventListener('pointerdown', handlePointerDown, { capture: true } as any);
  }, [expanded]);

  if (!canUse) return null;

  return (
    <>
      {/* Container to detect outside clicks */}
      <div ref={fabContainerRef}>
        {/* Main floating button - same positioning as FieldServiceModal */}
        <Button
          onClick={() => setExpanded(!expanded)}
          className={`fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px]`}
          size="lg"
        >
          {expanded ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>

        {/* Expandable buttons - positioned above main button */}
        <div className={`fixed right-4 z-40 flex flex-col gap-2 transition-all duration-300 ease-out items-end bottom-[calc(max(env(safe-area-inset-bottom),0px)+144px)] md:right-6 md:bottom-[168px] ${
          expanded 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}>
          <Button
            variant="outline"
            className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => { setOpen('est'); setExpanded(false); }}
          >
            <Building2 className="h-4 w-4 mr-2"/>
            Establishment
          </Button>
          <Button
            variant="outline"
            className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => { setOpen('hh'); setExpanded(false); }}
          >
            <UserPlus className="h-4 w-4 mr-2"/>
            Householder
          </Button>
          <Button
            variant="default"
            className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => { setOpen('visit'); setExpanded(false); }}
          >
            <FilePlus2 className="h-4 w-4 mr-2"/>
            Visit
          </Button>
        </div>
      </div>

      {/* Establishment form (standalone component) */}
      <ResponsiveModal open={open==='est'} onOpenChange={(o)=> setOpen(o? 'est': null)} title="New Establishment" description="Add a business establishment" className="sm:max-w-[560px]">
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
      </ResponsiveModal>
      <ResponsiveModal open={open==='hh'} onOpenChange={(o)=> setOpen(o? 'hh': null)} title="New Householder" description="Add a householder for an establishment" className="sm:max-w-[560px]">
        <HouseholderForm 
          establishments={establishments} 
          selectedEstablishmentId={selectedEstablishmentId}
          onSaved={() => {
            setOpen(null);
          }} 
        />
      </ResponsiveModal>
      <ResponsiveModal open={open==='visit'} onOpenChange={(o)=> setOpen(o? 'visit': null)} title="Visit Update" description="Record a visit note" className="sm:max-w-[560px]">
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
      </ResponsiveModal>
    </>
  );
}

// inline HouseholderForm and VisitForm removed; using standalone components above

// Export the EstablishmentForm component
// (Inline EstablishmentForm is no longer exported; use the standalone component at
// '@/components/business/EstablishmentForm' instead.)
