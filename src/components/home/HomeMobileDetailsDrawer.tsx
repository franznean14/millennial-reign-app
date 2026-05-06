"use client";

import type { ReactNode } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface HomeMobileDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  bodyClassName?: string;
}

export function HomeMobileDetailsDrawer({
  open,
  onOpenChange,
  title,
  children,
  contentClassName,
  bodyClassName,
}: HomeMobileDetailsDrawerProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className={cn(
          "max-h-[90vh] dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff]",
          contentClassName
        )}
        handleClassName="dark:bg-[#80778e] dark:shadow-[0_0_18px_rgba(128,119,142,0.45)]"
      >
        <DrawerHeader className="border-b border-border px-4 pb-3 pt-4 text-center dark:border-[#1c1921] dark:bg-[#181714]">
          <DrawerTitle className="text-center text-lg font-bold">{title}</DrawerTitle>
        </DrawerHeader>
        <div
          className={cn(
            "overflow-y-auto px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-3 dark:bg-[#181714]",
            bodyClassName
          )}
        >
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
