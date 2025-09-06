"use client";

import * as React from "react";
import { useMemo } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { FilePlus2 } from "lucide-react";
import { VisitForm } from "@/components/business/VisitForm";

interface VisitDrawerDialogProps {
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  positionOffset?: number;
  establishments: any[];
  selectedEstablishmentId?: string;
  onSaved?: (newVisit?: any) => void;
  initialVisit?: {
    id: string;
    establishment_id?: string | null;
    householder_id?: string | null;
    note?: string | null;
    publisher_id?: string | null;
    partner_id?: string | null;
    visit_date?: string;
  };
}

export function VisitDrawerDialog({
  triggerLabel = "Visit",
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
  positionOffset = 0,
  establishments,
  selectedEstablishmentId,
  onSaved,
  initialVisit,
}: VisitDrawerDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const bottomCalc = useMemo(() => `calc(max(env(safe-area-inset-bottom),0px)+${80 + positionOffset * 64}px)`, [positionOffset]);

  const handleClose = () => setOpen(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {showTrigger && (
          <DialogTrigger asChild>
            <Button
              aria-label={triggerLabel}
              title={triggerLabel}
              className="fixed right-4 md:right-6 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation"
              size="lg"
              style={{ bottom: bottomCalc }}
            >
              <FilePlus2 className="h-6 w-6" />
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="flex max-h-[85vh] flex-col p-0">
          <DialogHeader className="text-center flex-shrink-0">
            <DialogTitle>Visit Update</DialogTitle>
            <DialogDescription>Record a visit note</DialogDescription>
          </DialogHeader>
          <div className="p-4 pt-0 flex-1 min-h-0 overflow-y-auto ios-touch">
            <VisitForm
              establishments={establishments}
              selectedEstablishmentId={selectedEstablishmentId}
              onSaved={(v) => {
                onSaved?.(v);
                handleClose();
              }}
              initialVisit={initialVisit}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DrawerTrigger asChild>
          <Button
            aria-label={triggerLabel}
            title={triggerLabel}
            className="fixed right-4 md:right-6 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation"
            size="lg"
            style={{ bottom: bottomCalc }}
          >
            <FilePlus2 className="h-6 w-6" />
          </Button>
        </DrawerTrigger>
      )}
      <DrawerContent>
        <DrawerHeader className="text-center flex-shrink-0">
          <DrawerTitle>Visit Update</DrawerTitle>
          <DrawerDescription>Record a visit note</DrawerDescription>
        </DrawerHeader>
        <div className="p-4 pt-0 flex-1 min-h-0 overflow-y-auto ios-touch">
          <VisitForm
            establishments={establishments}
            selectedEstablishmentId={selectedEstablishmentId}
            onSaved={(v) => {
              onSaved?.(v);
              handleClose();
            }}
            initialVisit={initialVisit}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

