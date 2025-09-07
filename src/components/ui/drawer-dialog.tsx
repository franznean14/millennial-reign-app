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
  /** Optional DOM node to portal into (e.g., #drawer-root); falls back to body */
  container?: HTMLElement | null;
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
  container,
}: DrawerDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const portalContainer = container ?? (typeof document !== "undefined" ? document.getElementById("drawer-root") : null) ?? (typeof document !== "undefined" ? document.body : undefined);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {showTrigger && trigger}
        <DialogContent className={contentClassName} container={portalContainer as any}>
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
      <DrawerContent container={portalContainer as any}>
        <DrawerHeader className="text-center">
          <DrawerTitle className="font-bold">{title}</DrawerTitle>
          {description && <DrawerDescription className="text-center">{description}</DrawerDescription>}
        </DrawerHeader>
        {children}
      </DrawerContent>
    </Drawer>
  );
}


