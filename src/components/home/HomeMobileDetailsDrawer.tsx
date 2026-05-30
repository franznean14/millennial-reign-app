"use client";

import type { ReactNode } from "react";
import { DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { FormDrawerRoot, FormDrawerContent } from "@/components/shared/FormDrawerPhone";
import { drawerFormScrollPadClass } from "@/lib/theme/form-drawer-phone";
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
    <FormDrawerRoot open={open} onOpenChange={onOpenChange}>
      <FormDrawerContent
        className={cn(studyBibleDarkClasses.drawerPanel, "max-h-[90vh]", contentClassName)}
        handleClassName={studyBibleDarkClasses.drawerHandle}
      >
        <DrawerHeader className="bg-transparent px-4 pb-3 pt-4 text-center">
          <DrawerTitle className="text-center text-lg font-bold">{title}</DrawerTitle>
        </DrawerHeader>
        <div className={cn("overflow-y-auto px-4 pt-3", drawerFormScrollPadClass, bodyClassName)}>
          {children}
        </div>
      </FormDrawerContent>
    </FormDrawerRoot>
  );
}
