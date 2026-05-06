"use client";

import dynamic from "next/dynamic";
import { useMediaQuery } from "@/hooks/use-media-query";
import { FormModal } from "@/components/shared/FormModal";
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerWideLeftContentTop,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import type { EventSchedule } from "@/lib/db/eventSchedules";

const EventScheduleForm = dynamic(
  () => import("@/components/congregation/EventScheduleForm").then((m) => m.EventScheduleForm),
  { ssr: false }
);

/** Match Ministry schedules / congregation drawer surfaces (#181714, #1c1921 borders). */
const sheetChrome =
  "flex flex-col overflow-hidden dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff] md:max-h-[100lvh]";

const sheetHeaderChrome =
  "shrink-0 border-b border-border px-5 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] dark:border-[#1c1921] dark:bg-[#181714]";

export interface EventScheduleFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  congregationId: string;
  /** When set, form opens in edit mode; otherwise create. */
  initialData: EventSchedule | null;
  onSaved: (event?: EventSchedule) => void | Promise<void>;
  /**
   * When opening the left sheet above a stacked right drawer (ministry/contact panes).
   * @default true
   */
  stackAboveDetailsSheet?: boolean;
}

/**
 * Shared tablet+ **left** sheet and phone drawer/dialog for congregation event schedules.
 */
export function EventScheduleFormSheet({
  open,
  onOpenChange,
  congregationId,
  initialData,
  onSaved,
  stackAboveDetailsSheet = true,
}: EventScheduleFormSheetProps) {
  const isMdUp = useMediaQuery("(min-width: 768px)");
  const isEditing = initialData != null;
  const title = isEditing ? "Edit Event Schedule" : "New Event Schedule";
  const description = isEditing
    ? "Update date, recurrence, location, and other schedule details."
    : "Create a new event schedule.";

  const form = open ? (
    <EventScheduleForm
      congregationId={congregationId}
      initialData={initialData ?? undefined}
      isEditing={isEditing}
      onSaved={onSaved}
    />
  ) : null;

  if (isMdUp) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} direction="left" modal nested shouldScaleBackground={false}>
        <DrawerWideLeftContentTop
          stackAboveStackedRightSheet={stackAboveDetailsSheet}
          className={sheetChrome}
        >
          <DrawerHeader className={cn(sheetHeaderChrome, "text-center sm:text-center")}>
            <DrawerTitle className="text-center text-lg font-bold tracking-tight">{title}</DrawerTitle>
            <DrawerDescription className="px-1 pt-1 text-center text-sm leading-snug text-muted-foreground dark:text-[#ded6e7]/80">
              {description}
            </DrawerDescription>
          </DrawerHeader>
          <div className="schedule-form-sheet-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-4 dark:bg-[#181714]">
            {form}
          </div>
        </DrawerWideLeftContentTop>
      </Drawer>
    );
  }

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className="dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff]"
      headerClassName={cn(sheetHeaderChrome, "text-center sm:text-center")}
      drawerContentClassName="dark:border-[#1c1921] dark:bg-[#181714]"
    >
      <div className="px-0.5 pt-1">{form}</div>
    </FormModal>
  );
}
