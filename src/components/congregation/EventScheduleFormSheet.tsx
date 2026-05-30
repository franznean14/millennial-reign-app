"use client";

import dynamic from "next/dynamic";
import { FormModal } from "@/components/shared/FormModal";
import { getStudyBibleDarkCardShade } from "@/lib/theme/study-bible-dark";
import type { EventSchedule } from "@/lib/db/eventSchedules";

const EventScheduleForm = dynamic(
  () => import("@/components/congregation/EventScheduleForm").then((m) => m.EventScheduleForm),
  { ssr: false }
);

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
  const isEditing = initialData != null;
  const title = isEditing ? "Edit Event Schedule" : "New Event Schedule";
  const description = isEditing
    ? "Update date, recurrence, location, and other schedule details."
    : "Create a new event schedule.";
  const drawerShade = getStudyBibleDarkCardShade(`cong-event-schedule-form:${congregationId}`);

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      desktopPresentation="left-sheet"
      leftSheetStackAboveNestedRight={stackAboveDetailsSheet}
      className={drawerShade}
      drawerContentClassName={drawerShade}
      headerClassName="text-center sm:text-center"
      drawerDescriptionClassName="px-1 pt-1 text-center leading-snug"
    >
      {open ? (
        <EventScheduleForm
          congregationId={congregationId}
          initialData={initialData ?? undefined}
          isEditing={isEditing}
          onSaved={onSaved}
        />
      ) : null}
    </FormModal>
  );
}
