"use client";

import type { ReactNode } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";

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
        className={cn(studyBibleDarkClasses.drawerPanel, "max-h-[90vh]", contentClassName)}
        handleClassName={studyBibleDarkClasses.drawerHandle}
      >
        <DrawerHeader className="bg-transparent px-4 pb-3 pt-4 text-center">
          <DrawerTitle className="text-center text-lg font-bold">{title}</DrawerTitle>
        </DrawerHeader>
        <div
          className={cn(
            "overflow-y-auto px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-3",
            bodyClassName
          )}
        >
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
