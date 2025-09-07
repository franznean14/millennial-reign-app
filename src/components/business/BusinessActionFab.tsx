"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Building2, UserPlus, FilePlus2, X } from "lucide-react";
import { DrawerDialog } from "@/components/ui/drawer-dialog";
import { DrawerDialogTriggerButton } from "@/components/ui/drawer-dialog-trigger-button";
import { EstablishmentForm } from "@/components/business/EstablishmentForm";
import { HouseholderForm } from "@/components/business/HouseholderForm";
import { VisitForm } from "@/components/business/VisitForm";
import { isBusinessEnabled, isBusinessParticipant, listEstablishments } from "@/lib/db/business";

export function BusinessActionFab({
  selectedArea,
  selectedEstablishmentId,
}: {
  selectedArea?: string;
  selectedEstablishmentId?: string;
}) {
  const [enabled, setEnabled] = useState(false);
  const [participant, setParticipant] = useState(false);
  const [establishments, setEstablishments] = useState<any[]>([]);
  const [open, setOpen] = useState<null | "est" | "hh" | "visit">(null);
  const [expanded, setExpanded] = useState(false);
  const fabContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      setEnabled(await isBusinessEnabled());
      setParticipant(await isBusinessParticipant());
      setEstablishments(await listEstablishments());
    })();
  }, []);

  const canUse = enabled && participant;

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
    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", handlePointerDown, { capture: true } as any);
  }, [expanded]);

  if (!canUse) return null;

  return (
    <>
      <div ref={fabContainerRef}>
        {/* Main floating button - same positioning as elsewhere */}
        <Button
          onClick={() => setExpanded(!expanded)}
          className={`fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[80px] ${expanded ? "rotate-45" : ""}`}
          size="lg"
        >
          {expanded ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>

        {/* Expandable buttons above */}
        <div
          className={`fixed right-4 z-40 flex flex-col gap-2 transition-all duration-300 ease-out items-end bottom-[144px] md:right-6 ${
            expanded ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
          }`}
        >
          <Button
            variant="outline"
            className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => setOpen("est")}
          >
            <Building2 className="h-4 w-4 mr-2" />
            Establishment
          </Button>
          <Button
            variant="outline"
            className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => setOpen("hh")}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Householder
          </Button>
          <Button
            variant="default"
            className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => setOpen("visit")}
          >
            <FilePlus2 className="h-4 w-4 mr-2" />
            Visit
          </Button>
        </div>
      </div>

      {/* DrawerDialogs for each action (no internal triggers) */}
      <DrawerDialog
        title="New Establishment"
        description="Add a business establishment"
        showTrigger={false}
        open={open === "est"}
        onOpenChange={(o) => setOpen(o ? "est" : null)}
      >
        <div className="p-4 pt-0">
          <EstablishmentForm
            selectedArea={selectedArea}
            onSaved={async () => {
              setOpen(null);
              setEstablishments(await listEstablishments());
            }}
          />
        </div>
      </DrawerDialog>

      <DrawerDialog
        title="New Householder"
        description="Add a householder for an establishment"
        showTrigger={false}
        open={open === "hh"}
        onOpenChange={(o) => setOpen(o ? "hh" : null)}
      >
        <div className="p-4 pt-0">
          <HouseholderForm
            establishments={establishments}
            selectedEstablishmentId={selectedEstablishmentId}
            onSaved={() => setOpen(null)}
          />
        </div>
      </DrawerDialog>

      <DrawerDialog
        title="Visit Update"
        description="Record a visit note"
        showTrigger={false}
        open={open === "visit"}
        onOpenChange={(o) => setOpen(o ? "visit" : null)}
      >
        <div className="p-4 pt-0">
          <VisitForm
            establishments={establishments}
            selectedEstablishmentId={selectedEstablishmentId}
            onSaved={() => setOpen(null)}
          />
        </div>
      </DrawerDialog>
    </>
  );
}

export default BusinessActionFab;


