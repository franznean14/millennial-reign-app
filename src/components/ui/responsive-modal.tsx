"use client";

import { useMobile } from "@/lib/hooks/use-mobile";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}

export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  headerClassName,
  bodyClassName
}: ResponsiveModalProps) {
  const isMobile = useMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className={cn(className)}
        >
          <DrawerHeader className={cn(headerClassName)}>
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div className={cn("p-4 pt-0", bodyClassName)}>
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogHeader className={cn(headerClassName)}>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className={cn("p-4 pt-0", bodyClassName)}>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}



