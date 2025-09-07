"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from "@/components/ui/drawer";
import { FilePlus2 } from "lucide-react";
import { DrawerDialogTriggerButton } from "@/components/ui/drawer-dialog-trigger-button";
import { FieldServiceForm } from "@/components/fieldservice/FieldServiceForm";

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
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {showTrigger && (
          <DrawerDialogTriggerButton label={triggerLabel} icon={<FilePlus2 className="h-6 w-6" />} />
        )}
        <DialogContent className="flex max-h-[85vh] flex-col p-0">
          <DialogHeader className="text-center flex-shrink-0">
            <DialogTitle>Field Service</DialogTitle>
            <DialogDescription>
              Record your ministry activity.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 pt-0 flex-1 min-h-0 overflow-y-auto ios-touch">
            <FieldServiceForm userId={userId} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DrawerDialogTriggerButton label={triggerLabel} icon={<FilePlus2 className="h-6 w-6" />} />
      )}
      <DrawerContent>
        <DrawerHeader className="text-center flex-shrink-0">
          <DrawerTitle>Field Service</DrawerTitle>
          <DrawerDescription>Record your daily activity.</DrawerDescription>
        </DrawerHeader>
        <div className="p-4 pt-0 flex-1 min-h-0 overflow-y-auto ios-touch">
          <FieldServiceForm userId={userId} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
