"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerWideLeftContentTop,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface FormModalBodyProps {
  children: ReactNode;
  className?: string;
}

function FormModalBody({ children, className }: FormModalBodyProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [isScrollable, setIsScrollable] = useState(false);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const update = () => {
      const scrollable = el.scrollHeight - el.clientHeight > 4;
      setIsScrollable(scrollable);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      ref={bodyRef}
      className={cn(
        "px-4 min-w-0 overflow-x-hidden",
        isScrollable ? "pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]" : "",
        className
      )}
    >
      {children}
    </div>
  );
}

interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: string;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  /** Breakpoint for center dialog vs bottom sheet when {@link desktopPresentation} is `"auto"`. */
  desktopQuery?: string;
  /**
   * `"auto"`: centered dialog at {@link desktopQuery}, bottom drawer below that.
   * `"left-sheet"`: left edge sheet at {@link tabletQuery} (same pattern as home to-do detail forms), bottom drawer on phones.
   */
  desktopPresentation?: "auto" | "left-sheet";
  /** Used when {@link desktopPresentation} is `"left-sheet"` to switch to bottom drawer on narrow viewports. */
  tabletQuery?: string;
  /** When using left sheet above home stacked contact pane (tablet). */
  leftSheetStackAboveNestedRight?: boolean;
}

export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  headerClassName,
  bodyClassName,
  desktopQuery = "(min-width: 1280px)",
  desktopPresentation = "auto",
  tabletQuery = "(min-width: 768px)",
  leftSheetStackAboveNestedRight = false,
}: FormModalProps) {
  const isDesktop = useMediaQuery(desktopQuery);
  const isTabletUp = useMediaQuery(tabletQuery);
  /** Radix Dialog/Drawer warn if content has no Description; extra copy is screen-reader only when no `description` prop. */
  const a11yDescription =
    description ?? (typeof title === "string" ? `Use the form to ${title}.` : "Dialog form.");
  useEffect(() => {
    if (typeof document === "undefined") return;
    const fabRoot = document.getElementById("fab-root");
    if (!fabRoot) return;
    if (open) {
      const active = document.activeElement as HTMLElement | null;
      if (active && fabRoot.contains(active)) {
        active.blur();
      }
      fabRoot.setAttribute("inert", "");
    } else {
      fabRoot.removeAttribute("inert");
    }
  }, [open]);

  if (desktopPresentation === "left-sheet") {
    if (isTabletUp) {
      return (
        <Drawer
          open={open}
          onOpenChange={onOpenChange}
          direction="left"
          modal
          shouldScaleBackground={false}
        >
          <DrawerWideLeftContentTop
            stackAboveStackedRightSheet={leftSheetStackAboveNestedRight}
            className={className}
          >
            <DrawerHeader
              className={cn("border-b border-border px-4 pb-3 pt-4 text-left", headerClassName)}
            >
              <DrawerTitle className="text-lg font-bold">{title}</DrawerTitle>
              <DrawerDescription className={description ? undefined : "sr-only"}>{a11yDescription}</DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-2">
              <FormModalBody className={cn("pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]", bodyClassName)}>
                {children}
              </FormModalBody>
            </div>
          </DrawerWideLeftContentTop>
        </Drawer>
      );
    }

    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={className}>
          <DrawerHeader className={cn(headerClassName)}>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription className={description ? undefined : "sr-only"}>{a11yDescription}</DrawerDescription>
          </DrawerHeader>
          <FormModalBody className={bodyClassName}>{children}</FormModalBody>
        </DrawerContent>
      </Drawer>
    );
  }

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={className}>
          <DialogHeader className={cn(headerClassName)}>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{a11yDescription}</DialogDescription>
          </DialogHeader>
          <FormModalBody className={bodyClassName}>{children}</FormModalBody>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={className}>
        <DrawerHeader className={cn(headerClassName)}>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription className={description ? undefined : "sr-only"}>{a11yDescription}</DrawerDescription>
        </DrawerHeader>
        <FormModalBody className={bodyClassName}>{children}</FormModalBody>
      </DrawerContent>
    </Drawer>
  );
}
