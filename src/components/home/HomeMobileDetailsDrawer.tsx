"use client";

import type { ReactNode } from "react";
import { DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { FormDrawerRoot, FormDrawerContent } from "@/components/shared/FormDrawerPhone";
import { drawerFormScrollPadClass, drawerFormScrollPadTightClass } from "@/lib/theme/form-drawer-phone";
import { cn } from "@/lib/utils";
import { studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";

interface HomeMobileDetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  contentClassName?: string;
  bodyClassName?: string;
  /** Stack above another bottom sheet (e.g. contacts list) without closing it. */
  stackAboveParentSheet?: boolean;
  /** Size sheet to content height (capped) instead of default max viewport height. */
  fitContent?: boolean;
}

export function HomeMobileDetailsDrawer({
  open,
  onOpenChange,
  title,
  children,
  contentClassName,
  bodyClassName,
  stackAboveParentSheet = false,
  fitContent = false,
}: HomeMobileDetailsDrawerProps) {
  const scrollPadClass = stackAboveParentSheet ? drawerFormScrollPadTightClass : drawerFormScrollPadClass;

  return (
    <FormDrawerRoot open={open} onOpenChange={onOpenChange} nested={stackAboveParentSheet}>
      <FormDrawerContent
        fitContent={fitContent}
        stackAboveParentSheet={stackAboveParentSheet}
        className={cn(
          studyBibleDarkClasses.drawerPanel,
          !fitContent && "max-h-[90vh]",
          contentClassName
        )}
        handleClassName={studyBibleDarkClasses.drawerHandle}
      >
        <DrawerHeader className="bg-transparent px-4 pb-3 pt-4 text-center">
          <DrawerTitle className="text-center text-lg font-bold">{title}</DrawerTitle>
        </DrawerHeader>
        <div
          className={cn(
            "overflow-y-auto px-4 pt-3",
            fitContent && "max-h-[72svh]",
            scrollPadClass,
            bodyClassName
          )}
        >
          {children}
        </div>
      </FormDrawerContent>
    </FormDrawerRoot>
  );
}
