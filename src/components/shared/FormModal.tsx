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
        "dark:text-[#fffaff]",
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
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const OPEN_COUNT_KEY = "formModalOpenCount";
    const PREV_Z_KEY = "formModalPrevZIndex";

    if (!open) {
      fabRoot.removeAttribute("inert");
      return;
    }

    const active = document.activeElement as HTMLElement | null;
    if (active && fabRoot.contains(active)) {
      active.blur();
    }
    fabRoot.setAttribute("inert", "");

    // On mobile, keep form drawers above FAB/menu so submit controls remain tappable.
    if (isMobile) {
      const currentCount = Number(fabRoot.dataset[OPEN_COUNT_KEY] ?? "0");
      const nextCount = currentCount + 1;
      fabRoot.dataset[OPEN_COUNT_KEY] = String(nextCount);
      if (nextCount === 1) {
        fabRoot.dataset[PREV_Z_KEY] = fabRoot.style.zIndex ?? "";
        fabRoot.style.zIndex = "40";
      }
    }

    return () => {
      fabRoot.removeAttribute("inert");
      if (!isMobile) return;

      const currentCount = Number(fabRoot.dataset[OPEN_COUNT_KEY] ?? "0");
      const nextCount = Math.max(0, currentCount - 1);
      if (nextCount === 0) {
        const prevZ = fabRoot.dataset[PREV_Z_KEY];
        if (prevZ && prevZ.length > 0) {
          fabRoot.style.zIndex = prevZ;
        } else {
          fabRoot.style.removeProperty("z-index");
        }
        delete fabRoot.dataset[OPEN_COUNT_KEY];
        delete fabRoot.dataset[PREV_Z_KEY];
      } else {
        fabRoot.dataset[OPEN_COUNT_KEY] = String(nextCount);
      }
    };
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
            className={cn("dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff]", className)}
          >
            <DrawerHeader
              className={cn("border-b border-border px-4 pb-3 pt-4 text-left dark:border-[#1c1921] dark:bg-[#181714]", headerClassName)}
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
        <DrawerContent className={cn("dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff]", className)}>
          <DrawerHeader className={cn("dark:bg-[#181714]", headerClassName)}>
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
        <DialogContent className={cn("dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff]", className)}>
          <DialogHeader className={cn("dark:bg-[#181714]", headerClassName)}>
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
      <DrawerContent className={cn("dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff]", className)}>
        <DrawerHeader className={cn("dark:bg-[#181714]", headerClassName)}>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription className={description ? undefined : "sr-only"}>{a11yDescription}</DrawerDescription>
        </DrawerHeader>
        <FormModalBody className={bodyClassName}>{children}</FormModalBody>
      </DrawerContent>
    </Drawer>
  );
}
