"use client";

import { useMobile } from "@/lib/hooks/use-mobile";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";

import { ReactNode, useEffect, useState } from "react";

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className
}: ResponsiveModalProps) {
  const isMobile = useMobile();
  const [isOpen, setIsOpen] = useState(open);

  useEffect(() => setIsOpen(open), [open]);
  useEffect(() => {
    const root = document.documentElement;
    if (isOpen) {
      root.classList.add("overscroll-none", "touch-none", "dialog-open");
    } else {
      root.classList.remove("overscroll-none", "touch-none", "dialog-open");
    }
  }, [isOpen]);

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(o) => { setIsOpen(o); onOpenChange(o); }}>
        <DrawerContent className={`${className || ""}`}>
          <DrawerHeader className="flex-shrink-0">
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div className="p-4 pt-0 flex-1 min-h-0 overflow-y-auto ios-touch">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="p-4 pt-0">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}



