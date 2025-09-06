"use client";

import * as React from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from "@/components/ui/drawer";
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
        <DrawerTrigger asChild>
          <Button variant="outline">{triggerLabel}</Button>
        </DrawerTrigger>
      )}
      <DrawerContent>
        <DrawerHeader className="text-center">
          <DrawerTitle>Field Service</DrawerTitle>
          <DrawerDescription>Record your daily activity.</DrawerDescription>
        </DrawerHeader>
        <FieldServiceForm userId={userId} onClose={() => setOpen(false)} />
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}


