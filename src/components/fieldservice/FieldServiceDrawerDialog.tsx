"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from "@/components/ui/drawer";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { NumberFlowInput } from "@/components/ui/number-flow-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface FieldServiceDrawerDialogProps {
  userId: string;
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function FieldServiceDrawerDialog({ userId, triggerLabel = "Field Service", open: controlledOpen, onOpenChange, showTrigger = true }: FieldServiceDrawerDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {showTrigger && (
          <DialogTrigger asChild>
            <Button variant="outline">{triggerLabel}</Button>
          </DialogTrigger>
        )}
        <DialogContent className="flex max-h-[85vh] flex-col p-0">
          <DialogHeader className="text-center flex-shrink-0">
            <DialogTitle>Field Service</DialogTitle>
            <DialogDescription>
              Record your daily activity.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 pt-0 flex-1 min-h-0 overflow-y-auto ios-touch">
            <MinimalFieldService />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DrawerTrigger asChild>
          <Button variant="outline">{triggerLabel}</Button>
        </DrawerTrigger>
      )}
      <DrawerContent>
        <DrawerHeader className="text-center flex-shrink-0">
          <DrawerTitle>Field Service</DrawerTitle>
          <DrawerDescription>Record your daily activity.</DrawerDescription>
        </DrawerHeader>
        <div className="p-4 pt-0 flex-1 min-h-0 overflow-y-auto ios-touch">
          <MinimalFieldService />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function startOfCalendarGrid(view: Date) {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const s = new Date(first);
  s.setDate(first.getDay() === 0 ? 1 - 0 : 1 - first.getDay());
  return s;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const fsSchema = z.object({
  hours: z.number().min(0, "Must be ≥ 0").max(24, "Must be ≤ 24"),
  bibleStudies: z.string().max(200),
  note: z.string().max(1000),
});

type FsFormValues = z.infer<typeof fsSchema>;

function MinimalFieldService() {
  const [view, setView] = useState<Date>(new Date());
  const [selected, setSelected] = useState<Date>(new Date());
  const form = useForm<FsFormValues>({
    resolver: zodResolver(fsSchema),
    defaultValues: { hours: 0, bibleStudies: "", note: "" },
  });

  const monthLabel = useMemo(() => view.toLocaleString(undefined, { month: "long" }), [view]);
  const yearLabel = useMemo(() => String(view.getFullYear()), [view]);

  const start = useMemo(() => startOfCalendarGrid(view), [view]);
  const days = useMemo(() => Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  }), [start]);

  const inMonth = (d: Date) => d.getMonth() === view.getMonth();

  return (
    <div className="grid md:grid-cols-2 gap-4 pb-10">
      {/* Calendar */}
      <div className="p-4 border-b md:border-b-0 md:border-r">
        <div className="flex items-center justify-between pb-3">
          <Button variant="ghost" size="sm" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-sm font-medium flex items-center gap-2">
            <span>{monthLabel}</span>
            <span>{yearLabel}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 px-1 text-xs opacity-70">
          {"S,M,T,W,T,F,S".split(",").map((d, i) => (
            <div key={`${d}-${i}`} className="text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1 p-1">
          {days.map((d, i) => {
            const selectedDay = isSameDay(d, selected);
            const muted = !inMonth(d);
            return (
              <Button
                key={i}
                variant={selectedDay ? "default" : "ghost"}
                size="sm"
                className={`relative h-10 ${muted ? "opacity-50" : ""}`}
                onClick={() => setSelected(d)}
              >
                {d.getDate()}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Hours */}
      <div>
        <Form {...form}>
          <form className="grid gap-4 px-4" onSubmit={(e) => e.preventDefault()}>
            <FormField
              control={form.control}
              name="hours"
              render={({ field }) => (
                <FormItem className="grid gap-2 place-items-center">
                  <FormLabel>Hours</FormLabel>
                  <FormControl>
                    <NumberFlowInput
                      value={field.value ?? 0}
                      onChange={(v) => field.onChange(v)}
                      min={0}
                      max={24}
                      size="lg"
                      className="mx-auto"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bibleStudies"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>Bible Studies</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Names, comma-separated (optional)" className="px-3" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Optional note for this day" className="px-3" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>
    </div>
  );
}


