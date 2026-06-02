"use client";

import * as React from "react";
import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/shared/FormModal";
import { nestedFormPickerFormModalStackProps } from "@/components/shared/FormDrawerPhone";
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerThinRightContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DateRangeSelectContent } from "@/components/ui/date-range-select-modal";
import { useMediaQuery } from "@/hooks/use-media-query";

interface DatePickerProps {
  date?: Date;
  onSelect?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  mobileShowActions?: boolean;
  mobileAllowClear?: boolean;
  defaultToTodayOnOpen?: boolean;
}

export function DatePicker({
  date,
  onSelect,
  placeholder = "Select date",
  className,
  mobileShowActions = false,
  mobileAllowClear = false,
  defaultToTodayOnOpen = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  /** Under `md`: bottom sheet. `md` and up: thin right drawer (matches call-date picker on tablet). */
  const isNarrowForSheet = useMediaQuery("(max-width: 767px)");
  const effectiveDate = date ?? (open && defaultToTodayOnOpen ? new Date() : undefined);

  const sheetBody = (
    <DateRangeSelectContent
      startDate={effectiveDate}
      allowRange={false}
      showActions={mobileShowActions}
      showClearAction={mobileAllowClear && !!date}
      onClearAction={() => {
        onSelect?.(undefined);
        setOpen(false);
      }}
      onSelect={(selected) => {
        onSelect?.(selected);
        setOpen(false);
      }}
      onConfirm={(selected) => {
        onSelect?.(selected);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
      onRequestClose={() => setOpen(false)}
    />
  );

  if (isNarrowForSheet) {
    return (
      <>
        <Button
          variant="outline"
          type="button"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
          onClick={() => setOpen(true)}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
        <FormModal
          open={open}
          onOpenChange={setOpen}
          title="Select Date"
          description="Choose a date"
          className="sm:max-w-[640px]"
          {...nestedFormPickerFormModalStackProps}
        >
          {sheetBody}
        </FormModal>
      </>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        type="button"
        className={cn(
          "w-full justify-start text-left font-normal",
          !date && "text-muted-foreground",
          className
        )}
        onClick={() => setOpen(true)}
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {date ? format(date, "PPP") : <span>{placeholder}</span>}
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        direction="right"
        modal
        nested
        shouldScaleBackground={false}
      >
        <DrawerThinRightContent
          stackAboveFormSheet
          className="border-border dark:border-[#1c1921] bg-card dark:bg-[#181714] text-foreground dark:text-[#fffaff]"
        >
          <DrawerHeader className="px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center bg-card dark:bg-[#181714]">
            <DrawerTitle className="text-center text-lg font-bold">Select Date</DrawerTitle>
            <DrawerDescription className="text-muted-foreground dark:text-[#ded6e7]/75">Choose a date</DrawerDescription>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+24px)] pt-4 bg-card dark:bg-[#181714]">
            {sheetBody}
          </div>
        </DrawerThinRightContent>
      </Drawer>
    </>
  );
}
