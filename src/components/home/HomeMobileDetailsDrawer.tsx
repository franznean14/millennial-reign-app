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
  /** Stack above another bottom sheet (e.g. contacts list) without closing it. */
  stackAboveParentSheet?: boolean;
}

const STACK_ABOVE_PARENT_Z = 150;

export function HomeMobileDetailsDrawer({
  open,
  onOpenChange,
  title,
  children,
  contentClassName,
  bodyClassName,
  stackAboveParentSheet = false,
}: HomeMobileDetailsDrawerProps) {
  const stackStyle = stackAboveParentSheet ? ({ zIndex: STACK_ABOVE_PARENT_Z } as const) : undefined;

  return (
    <FormDrawerRoot open={open} onOpenChange={onOpenChange} nested={stackAboveParentSheet}>
      <FormDrawerContent
        className={cn(
          studyBibleDarkClasses.drawerPanel,
          "max-h-[90vh]",
          stackAboveParentSheet && "!z-[150]",
          contentClassName
        )}
        overlayClassName={stackAboveParentSheet ? "!z-[150]" : undefined}
        style={stackStyle}
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
