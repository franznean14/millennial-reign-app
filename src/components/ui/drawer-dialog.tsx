"use client";

import * as React from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

interface DrawerDialogProps {
  title: string;
  description?: string;
  trigger?: React.ReactNode; // Provide an already-wrapped Trigger element
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  contentClassName?: string;
}

export function DrawerDialog({
  title,
  description,
  trigger,
  children,
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
  contentClassName,
}: DrawerDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {showTrigger && trigger}
        <DialogContent className={contentClassName}>
          <DialogHeader className="text-center">
            <DialogTitle className="font-bold">{title}</DialogTitle>
            {description && <DialogDescription className="text-center">{description}</DialogDescription>}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      {showTrigger && trigger}
      <DrawerContent>
        <DrawerHeader className="text-center">
          <DrawerTitle className="font-bold">{title}</DrawerTitle>
          {description && <DrawerDescription className="text-center">{description}</DrawerDescription>}
        </DrawerHeader>
        {children}
      </DrawerContent>
    </Drawer>
  );
}


