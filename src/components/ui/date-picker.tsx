"use client";

import * as React from "react";
import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMobile } from "@/lib/hooks/use-mobile";
import { FormModal } from "@/components/shared/FormModal";
import { DateRangeSelectContent } from "@/components/ui/date-range-select-modal";

interface DatePickerProps {
  date?: Date;
  onSelect?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  mobileShowActions?: boolean;
  mobileAllowClear?: boolean;
}

export function DatePicker({
  date,
  onSelect,
  placeholder = "Select date",
  className,
  mobileShowActions = false,
  mobileAllowClear = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useMobile();

  if (isMobile) {
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
        >
          <DateRangeSelectContent
            startDate={date}
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
        </FormModal>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          type="button"
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(selectedDate) => {
            onSelect?.(selectedDate);
            setOpen(false);
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
