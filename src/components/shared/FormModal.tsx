"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerWideLeftContentTop,
  DrawerWideRightContent,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { getStudyBibleDarkCardShade, studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";

const FORM_MODAL_SHELL_BASE = cn(studyBibleDarkClasses.drawerPanel);
const FORM_MODAL_DRAWER_HANDLE = studyBibleDarkClasses.drawerHandle;
const FORM_MODAL_PHONE_SHADE = getStudyBibleDarkCardShade("form-modal:phone:v1");
const FORM_MODAL_LEFT_SHEET_TABLET_SHADE = getStudyBibleDarkCardShade("form-modal:left-sheet-tablet:v1");
const FORM_MODAL_DIALOG_SHADE = getStudyBibleDarkCardShade("form-modal:dialog-desktop:v1");

interface FormModalBodyProps {
  children: ReactNode;
  className?: string;
}

function FormModalBody({ children, className }: FormModalBodyProps) {
  /**
   * Bottom drawers must always reserve nav + home-indicator space. Previously we only padded when the
   * body was scrollable; short forms (edit establishment / call / to-do) got no pb, leaving an empty
   * strip above the sheet edge on iOS (especially after keyboard focus).
   */
  return (
    <div
      className={cn(
        "px-4 min-w-0 overflow-x-hidden text-[#1a1820] text-foreground dark:text-[#fffaff]",
        "max-xl:pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] xl:pb-6",
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
  /**
   * Extra classes for the bottom {@link DrawerContent} on phone only (not the tablet+ left sheet or dialog).
   * Use for drawer height, top offset (`mt-*`), etc.
   */
  drawerContentClassName?: string;
  /** Breakpoint for center dialog vs bottom sheet when {@link desktopPresentation} is `"auto"`. */
  desktopQuery?: string;
  /**
   * `"auto"`: centered dialog at {@link desktopQuery}, bottom drawer below that.
   * `"left-sheet"`: left edge sheet at {@link tabletQuery} (same pattern as home to-do detail forms), bottom drawer on phones.
   * `"right-sheet"`: right edge sheet at {@link tabletQuery}, bottom drawer on phones.
   */
  desktopPresentation?: "auto" | "left-sheet" | "right-sheet";
  /** Used when {@link desktopPresentation} is `"left-sheet"` to switch to bottom drawer on narrow viewports. */
  tabletQuery?: string;
  /** When using left sheet above home stacked contact pane (tablet). */
  leftSheetStackAboveNestedRight?: boolean;
  /** When open, skip marking `#fab-root` inert so a docked FAB stays tappable (tablet bulk sheet). */
  skipFabRootInert?: boolean;
  /**
   * Merged with the tablet left/right sheet main content wrapper (default scroll area).
   * Use e.g. `md:overflow-hidden md:flex md:flex-col` when the child form manages its own scroll regions.
   */
  sheetBodyScrollClassName?: string;
  /** Bottom-sheet drag handle (passed to {@link DrawerContent} on phone). */
  drawerHandleClassName?: string;
  /** Visible subtitle under the title on bottom drawers when {@link description} is set. */
  drawerDescriptionClassName?: string;
  /** Merged onto sheet/dialog title (e.g. `text-left` for detail panels). */
  titleClassName?: string;
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
  drawerContentClassName,
  desktopQuery = "(min-width: 1280px)",
  desktopPresentation = "auto",
  tabletQuery = "(min-width: 768px)",
  leftSheetStackAboveNestedRight = false,
  skipFabRootInert = false,
  sheetBodyScrollClassName,
  drawerHandleClassName,
  drawerDescriptionClassName,
  titleClassName,
}: FormModalProps) {
  const isDesktop = useMediaQuery(desktopQuery);
  const isTabletUp = useMediaQuery(tabletQuery);
  const resolvedDrawerHandle = cn(FORM_MODAL_DRAWER_HANDLE, drawerHandleClassName);
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

    if (!skipFabRootInert) {
      const active = document.activeElement as HTMLElement | null;
      if (active && fabRoot.contains(active)) {
        active.blur();
      }
      fabRoot.setAttribute("inert", "");
    }

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
      if (!skipFabRootInert) {
        fabRoot.removeAttribute("inert");
      }
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
  }, [open, skipFabRootInert]);

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
            className={cn(FORM_MODAL_SHELL_BASE, FORM_MODAL_LEFT_SHEET_TABLET_SHADE, "md:max-h-[100lvh]", className)}
          >
            <DrawerHeader
              className={cn(
                "shrink-0 bg-transparent px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center sm:text-center text-foreground dark:text-[#fffaff]",
                headerClassName
              )}
            >
              <DrawerTitle className="text-center text-lg font-bold">{title}</DrawerTitle>
              <DrawerDescription className={description ? undefined : "sr-only"}>{a11yDescription}</DrawerDescription>
            </DrawerHeader>
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain pt-2",
                sheetBodyScrollClassName
              )}
            >
              <FormModalBody className={bodyClassName}>
                {children}
              </FormModalBody>
            </div>
          </DrawerWideLeftContentTop>
        </Drawer>
      );
    }

    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className={cn(FORM_MODAL_SHELL_BASE, FORM_MODAL_PHONE_SHADE, className, drawerContentClassName)}
          handleClassName={resolvedDrawerHandle}
        >
          <DrawerHeader className={cn("bg-transparent text-foreground dark:text-[#fffaff]", headerClassName)}>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription
              className={description ? cn("text-sm", studyBibleDarkClasses.muted, drawerDescriptionClassName) : "sr-only"}
            >
              {a11yDescription}
            </DrawerDescription>
          </DrawerHeader>
          <FormModalBody className={bodyClassName}>{children}</FormModalBody>
        </DrawerContent>
      </Drawer>
    );
  }

  if (desktopPresentation === "right-sheet") {
    if (isTabletUp) {
      return (
        <Drawer open={open} onOpenChange={onOpenChange} direction="right" modal shouldScaleBackground={false}>
          <DrawerWideRightContent
            className={cn(
              "border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff] md:max-h-[100lvh]",
              getStudyBibleDarkCardShade("bwi-bulk-todos-right-sheet:v1"),
              className
            )}
          >
            <DrawerHeader
              className={cn(
                "shrink-0 bg-transparent px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center text-foreground dark:text-[#fffaff]",
                headerClassName
              )}
            >
              <DrawerTitle className={cn("text-lg font-bold w-full", titleClassName ?? "text-center")}>
                {title}
              </DrawerTitle>
              <DrawerDescription
                className={description ? cn("text-sm", studyBibleDarkClasses.muted, titleClassName?.includes("text-left") ? "text-left" : "text-center") : "sr-only"}
              >
                {a11yDescription}
              </DrawerDescription>
            </DrawerHeader>
            <div
              className={cn(
                "min-h-0 flex-1 overflow-y-auto overscroll-contain pt-2",
                sheetBodyScrollClassName
              )}
            >
              <FormModalBody className={bodyClassName}>
                {children}
              </FormModalBody>
            </div>
          </DrawerWideRightContent>
        </Drawer>
      );
    }

    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className={cn(
            "border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff]",
            getStudyBibleDarkCardShade("bwi-bulk-todos-right-sheet:phone"),
            className,
            drawerContentClassName
          )}
          handleClassName={resolvedDrawerHandle}
        >
          <DrawerHeader className={cn("bg-transparent text-foreground dark:text-[#fffaff]", headerClassName)}>
            <DrawerTitle className={cn("text-lg font-bold w-full", titleClassName)}>{title}</DrawerTitle>
            <DrawerDescription
              className={
                description
                  ? cn("text-sm", studyBibleDarkClasses.muted, drawerDescriptionClassName, titleClassName)
                  : "sr-only"
              }
            >
              {a11yDescription}
            </DrawerDescription>
          </DrawerHeader>
          <FormModalBody className={bodyClassName}>{children}</FormModalBody>
        </DrawerContent>
      </Drawer>
    );
  }

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(FORM_MODAL_SHELL_BASE, FORM_MODAL_DIALOG_SHADE, className)}>
          <DialogHeader className={cn("bg-transparent text-foreground dark:text-[#fffaff]", headerClassName)}>
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
      <DrawerContent
        className={cn(FORM_MODAL_SHELL_BASE, FORM_MODAL_PHONE_SHADE, className, drawerContentClassName)}
        handleClassName={resolvedDrawerHandle}
      >
        <DrawerHeader className={cn("bg-transparent text-foreground dark:text-[#fffaff]", headerClassName)}>
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription
            className={
              description ? cn("text-sm", studyBibleDarkClasses.muted, drawerDescriptionClassName) : "sr-only"
            }
          >
            {a11yDescription}
          </DrawerDescription>
        </DrawerHeader>
        <FormModalBody className={bodyClassName}>{children}</FormModalBody>
      </DrawerContent>
    </Drawer>
  );
}
