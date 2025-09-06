"use client";

import * as React from "react";
import { useMemo } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { UserPlus } from "lucide-react";
import { HouseholderForm } from "@/components/business/HouseholderForm";

interface HouseholderDrawerDialogProps {
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  positionOffset?: number;
  establishments: any[];
  selectedEstablishmentId?: string;
  onSaved?: (newHouseholder?: any) => void;
}

export function HouseholderDrawerDialog({
  triggerLabel = "Householder",
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
  positionOffset = 0,
  establishments,
  selectedEstablishmentId,
  onSaved,
}: HouseholderDrawerDialogProps) {
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
              <UserPlus className="h-6 w-6" />
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="flex max-h-[85vh] flex-col p-0">
          <DialogHeader className="text-center flex-shrink-0">
            <DialogTitle>New Householder</DialogTitle>
            <DialogDescription>Add a householder for an establishment</DialogDescription>
          </DialogHeader>
          <div className="p-4 pt-0 flex-1 min-h-0 overflow-y-auto ios-touch">
            <HouseholderForm
              establishments={establishments}
              selectedEstablishmentId={selectedEstablishmentId}
              onSaved={(hh) => {
                onSaved?.(hh);
                handleClose();
              }}
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
            <UserPlus className="h-6 w-6" />
          </Button>
        </DrawerTrigger>
      )}
      <DrawerContent>
        <DrawerHeader className="text-center flex-shrink-0">
          <DrawerTitle>New Householder</DrawerTitle>
          <DrawerDescription>Add a householder for an establishment</DrawerDescription>
        </DrawerHeader>
        <div className="p-4 pt-0 flex-1 min-h-0 overflow-y-auto ios-touch">
          <HouseholderForm
            establishments={establishments}
            selectedEstablishmentId={selectedEstablishmentId}
            onSaved={(hh) => {
              onSaved?.(hh);
              handleClose();
            }}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

