"use client";

import * as React from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from "@/components/ui/drawer";
import { FilePlus2 } from "lucide-react";
import { Portal as RadixPortal } from "@radix-ui/react-portal";
import FieldServiceForm from "@/components/fieldservice/FieldServiceForm";

interface FieldServiceDrawerDialogProps {
  userId: string;
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function FieldServiceDrawerDialog({ userId, triggerLabel = "Field Service", open: controlledOpen, onOpenChange, showTrigger = true }: FieldServiceDrawerDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  // Treat true desktop at >=1280px so medium tablets (e.g., iPad landscape)
  // still use the floating circular trigger like Business view
  const isDesktop = useMediaQuery("(min-width: 1280px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {showTrigger && (
          <DialogTrigger asChild>
            <Button variant="outline">{triggerLabel}</Button>
          </DialogTrigger>
        )}
        <DialogContent>
          <DialogHeader className="text-center">
            <DialogTitle>Field Service</DialogTitle>
            <DialogDescription>
              Record your daily activity.
            </DialogDescription>
          </DialogHeader>
          <FieldServiceForm userId={userId} onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <RadixPortal container={typeof document !== 'undefined' ? document.getElementById('fab-root') : undefined}>
          <DrawerTrigger asChild>
            <Button
              type="button"
              aria-label={triggerLabel}
              title={triggerLabel}
              className="fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl bg-primary text-primary-foreground hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px] lg:h-16 lg:w-16 lg:right-8 lg:bottom-8"
            >
              <FilePlus2 className="h-6 w-6" />
            </Button>
          </DrawerTrigger>
        </RadixPortal>
      )}
      <DrawerContent>
        <DrawerHeader className="text-center">
          <DrawerTitle>Field Service</DrawerTitle>
          <DrawerDescription>Record your daily activity.</DrawerDescription>
        </DrawerHeader>
        <FieldServiceForm userId={userId} onClose={() => setOpen(false)} />
      </DrawerContent>
    </Drawer>
  );
}
