"use client";

import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerWideRightContent,
} from "@/components/ui/drawer";
import { FormDrawerRoot, FormDrawerContent } from "@/components/shared/FormDrawerPhone";
import { drawerFormScrollPadClass, drawerFormScrollPadTightClass } from "@/lib/theme/form-drawer-phone";
import { getStatusTitleColor } from "@/lib/utils/status-hierarchy";
import { cn } from "@/lib/utils";
import { studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";

/** Phone shell: header stays pinned; only the body region scrolls. */
const DETAILS_DRAWER_PHONE_INNER_LAYOUT =
  "[&_.drawer-content-inner]:flex [&_.drawer-content-inner]:flex-col [&_.drawer-content-inner]:min-h-0 [&_.drawer-content-inner]:overflow-hidden [&_.drawer-content-inner]:!overflow-y-hidden [&_.drawer-content-inner]:!pb-0";

export const DETAILS_DRAWER_PHONE_TITLE_CLASS =
  "text-center text-xl font-extrabold w-full truncate";
export const DETAILS_DRAWER_TABLET_TITLE_CLASS =
  "text-center text-2xl font-extrabold tracking-tight w-full truncate";

const DETAILS_DRAWER_STICKY_HEADER_CLASS =
  "sticky top-0 z-10 shrink-0 bg-transparent border-b border-border/50 dark:border-[#1c1921]/80";

export interface DetailsDrawerTitleProps {
  name: string;
  titleStatus?: string;
  variant?: "phone" | "tablet";
  className?: string;
}

/** Status-colored establishment/contact name for any details drawer shell. */
export function DetailsDrawerTitle({
  name,
  titleStatus,
  variant = "phone",
  className,
}: DetailsDrawerTitleProps) {
  const colorClass = titleStatus
    ? getStatusTitleColor(titleStatus)
    : "text-foreground dark:text-[#fffaff]";

  return (
    <DrawerTitle
      className={cn(
        variant === "tablet" ? DETAILS_DRAWER_TABLET_TITLE_CLASS : DETAILS_DRAWER_PHONE_TITLE_CLASS,
        colorClass,
        className
      )}
    >
      {name}
    </DrawerTitle>
  );
}

export interface DetailsDrawerHeaderProps extends DetailsDrawerTitleProps {
  onBack?: () => void;
  backAriaLabel?: string;
  description?: string;
  headerClassName?: string;
}

export function DetailsDrawerHeader({
  name,
  titleStatus,
  variant = "phone",
  onBack,
  backAriaLabel = "Back",
  description,
  headerClassName,
}: DetailsDrawerHeaderProps) {
  const title = (
    <DetailsDrawerTitle
      name={name}
      titleStatus={titleStatus}
      variant={variant}
      className={onBack ? "px-10" : undefined}
    />
  );

  if (onBack) {
    return (
      <DrawerHeader
        className={cn(
          DETAILS_DRAWER_STICKY_HEADER_CLASS,
          variant === "tablet"
            ? "px-2 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-left sm:px-4"
            : "px-2 pb-3 pt-2 text-left",
          headerClassName
        )}
      >
        <div className="relative flex items-center justify-center gap-1 pr-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-0 h-9 w-9 shrink-0"
            onClick={onBack}
            aria-label={backAriaLabel}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          {title}
        </div>
        {description ? <DrawerDescription className="sr-only">{description}</DrawerDescription> : null}
      </DrawerHeader>
    );
  }

  return (
    <DrawerHeader
      className={cn(
        DETAILS_DRAWER_STICKY_HEADER_CLASS,
        "text-center",
        variant === "tablet"
          ? "px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)]"
          : "px-4 pb-3 pt-2",
        headerClassName
      )}
    >
      {title}
      {description ? <DrawerDescription className="sr-only">{description}</DrawerDescription> : null}
    </DrawerHeader>
  );
}

export interface DetailsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** Establishment or contact display name. */
  entityName: string;
  /** Status token for {@link getStatusTitleColor} on the title. */
  titleStatus?: string;
  contentClassName?: string;
  bodyClassName?: string;
  headerClassName?: string;
  /** Phone: stack above another open bottom sheet. */
  stackAboveParentSheet?: boolean;
  /** Tablet: stack above another open right sheet. */
  stackAboveDetailsSheet?: boolean;
  fitContent?: boolean;
  onBack?: () => void;
  backAriaLabel?: string;
  description?: string;
  layout?: "auto" | "phone" | "tablet";
  tabletQuery?: string;
  nested?: boolean;
}

/**
 * Unified establishment/contact details drawer — phone bottom sheet or tablet right sheet.
 * Change title styling/stacking here to update every details drawer in the app.
 */
export function DetailsDrawer({
  open,
  onOpenChange,
  children,
  entityName,
  titleStatus,
  contentClassName,
  bodyClassName,
  headerClassName,
  stackAboveParentSheet = false,
  stackAboveDetailsSheet = false,
  fitContent = false,
  onBack,
  backAriaLabel,
  description,
  layout = "auto",
  tabletQuery = "(min-width: 768px)",
  nested,
}: DetailsDrawerProps) {
  const isTabletUp = useMediaQuery(tabletQuery);
  const useTablet = layout === "tablet" || (layout === "auto" && isTabletUp);
  const scrollPadClass = stackAboveParentSheet ? drawerFormScrollPadTightClass : drawerFormScrollPadClass;
  const drawerNested = nested ?? stackAboveParentSheet;

  if (useTablet) {
    return (
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        direction="right"
        modal
        nested
        shouldScaleBackground={false}
      >
        <DrawerWideRightContent
          stackAboveDetailsSheet={stackAboveDetailsSheet}
          className={cn(
            "flex flex-col overflow-hidden border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff] md:max-h-[100lvh]",
            contentClassName
          )}
        >
          <DetailsDrawerHeader
            name={entityName}
            titleStatus={titleStatus}
            variant="tablet"
            onBack={onBack}
            backAriaLabel={backAriaLabel}
            description={description}
            headerClassName={headerClassName}
          />
          <div
            className={cn(
              "min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2",
              bodyClassName
            )}
          >
            {children}
          </div>
        </DrawerWideRightContent>
      </Drawer>
    );
  }

  return (
    <FormDrawerRoot open={open} onOpenChange={onOpenChange} nested={drawerNested}>
      <FormDrawerContent
        fitContent={fitContent}
        stackAboveParentSheet={stackAboveParentSheet}
        className={cn(
          studyBibleDarkClasses.drawerPanel,
          DETAILS_DRAWER_PHONE_INNER_LAYOUT,
          !fitContent && "max-h-[90vh]",
          contentClassName
        )}
        handleClassName={studyBibleDarkClasses.drawerHandle}
      >
        <DetailsDrawerHeader
          name={entityName}
          titleStatus={titleStatus}
          variant="phone"
          onBack={onBack}
          backAriaLabel={backAriaLabel}
          description={description}
          headerClassName={headerClassName}
        />
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-2",
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
