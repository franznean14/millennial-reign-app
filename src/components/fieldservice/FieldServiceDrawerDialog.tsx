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
import { ChevronLeft, ChevronRight, FilePlus2 } from "lucide-react";
import { NumberFlowInput } from "@/components/ui/number-flow-input";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "@/components/ui/sonner";
import { getDailyRecord, listDailyByMonth, upsertDailyRecord, isDailyEmpty, deleteDailyRecord } from "@/lib/db/dailyRecords";

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
            <Button
              aria-label={triggerLabel}
              title={triggerLabel}
              className="fixed right-4 bottom-32 md:right-6 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation"
              size="lg"
            >
              <FilePlus2 className="h-6 w-6" />
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="flex max-h-[85vh] flex-col p-0">
          <DialogHeader className="text-center flex-shrink-0">
            <DialogTitle>Field Service</DialogTitle>
            <DialogDescription>
              Record your ministry activity.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 pt-0 flex-1 min-h-0 overflow-y-auto ios-touch">
            <MinimalFieldService userId={userId} />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DrawerTrigger asChild>
          <Button
            aria-label={triggerLabel}
            title={triggerLabel}
            className="fixed right-4 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:right-6 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation"
            size="lg"
          >
            <FilePlus2 className="h-6 w-6" />
          </Button>
        </DrawerTrigger>
      )}
      <DrawerContent>
        <DrawerHeader className="text-center flex-shrink-0">
          <DrawerTitle>Field Service</DrawerTitle>
          <DrawerDescription>Record your daily activity.</DrawerDescription>
        </DrawerHeader>
        <div className="p-4 pt-0 flex-1 min-h-0 overflow-y-auto ios-touch">
          <MinimalFieldService userId={userId} />
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
  bibleStudies: z.array(z.string()),
  note: z.string().max(1000),
});

type FsFormValues = z.infer<typeof fsSchema>;

function MinimalFieldService({ userId }: { userId: string }) {
  const [view, setView] = useState<Date>(new Date());
  const [selected, setSelected] = useState<Date>(new Date());
  const [mode, setMode] = useState<"days" | "months" | "years">("days");
  const [monthMarks, setMonthMarks] = useState<Record<string, boolean>>({});
  const debounceRef = React.useRef<any>(null);
  const notifyRef = React.useRef<any>(null);
  const [studyDraft, setStudyDraft] = useState<string>("");
  const form = useForm<FsFormValues>({
    resolver: zodResolver(fsSchema),
    defaultValues: { hours: 0, bibleStudies: [], note: "" },
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

  // Month and year pickers
  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => ({
      idx: i,
      label: new Date(2000, i, 1).toLocaleString(undefined, { month: "short" }),
    })),
    []
  );

  const years = useMemo(() => {
    const base = view.getFullYear();
    const startYear = base - 7;
    return Array.from({ length: 12 }, (_, i) => startYear + i);
  }, [view]);

  // Helpers
  const ymd = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // Load month marks and current day record
  const loadMonthMarks = async () => {
    try {
      const month = `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, "0")}`;
      const list = await listDailyByMonth(userId, month);
      const marks: Record<string, boolean> = {};
      for (const r of list) {
        const hours = Number((r as any).hours || 0);
        const bs = Array.isArray((r as any).bible_studies) ? (r as any).bible_studies.filter(Boolean) : [];
        const note = ((r as any).note ?? "").toString().trim();
        const empty = (!hours || hours === 0) && bs.length === 0 && note.length === 0;
        if (!empty) marks[(r as any).date] = true;
      }
      setMonthMarks(marks);
    } catch {}
  };

  const loadDay = async (dateStr: string) => {
    try {
      const rec = await getDailyRecord(userId, dateStr);
      form.setValue("hours", rec ? Number(rec.hours || 0) : 0, { shouldDirty: false });
      form.setValue("bibleStudies", Array.isArray(rec?.bible_studies) ? rec!.bible_studies : [], { shouldDirty: false });
      form.setValue("note", rec?.note || "");
      form.clearErrors();
    } catch {}
  };

  // Save (debounced)
  const scheduleSave = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const values = form.getValues();
    const dateStr = ymd(selected);
    debounceRef.current = setTimeout(async () => {
      const payload = {
        user_id: userId,
        date: dateStr,
        hours: Number(values.hours || 0),
        bible_studies: Array.isArray(values.bibleStudies)
          ? values.bibleStudies.filter((s) => !!s && s.trim().length > 0)
          : [],
        note: values.note?.trim() || null,
      };
      try {
        if (isDailyEmpty(payload)) {
          await deleteDailyRecord(userId, dateStr);
          setMonthMarks((m) => {
            const cp = { ...m };
            delete cp[dateStr];
            return cp;
          });
        } else {
          await upsertDailyRecord(payload);
          setMonthMarks((m) => ({ ...m, [dateStr]: true }));
        }
        // Notify home summary to refresh
        try {
          window.dispatchEvent(new CustomEvent('daily-records-changed', { detail: { userId } }));
        } catch {}
      } catch {}
    }, 800);
  };

  // Live update when hours changes
  React.useEffect(() => {
    const sub = form.watch((_, { name }) => {
      if (name === "hours" || name === "bibleStudies" || name === "note") {
        if (form.formState.isDirty) {
          scheduleSave();
          try {
            if (notifyRef.current) clearTimeout(notifyRef.current);
            notifyRef.current = setTimeout(() => {
              toast.success("Saving...");
            }, 500);
          } catch {}
        }
      }
    });
    return () => sub.unsubscribe();
  }, [form]);

  // On view change or selected change, load data
  React.useEffect(() => {
    loadMonthMarks();
    loadDay(ymd(selected));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  return (
    <div className="grid md:grid-cols-2 gap-4 pb-10">
      {/* Calendar */}
      <div className="p-4 border-b md:border-b-0 md:border-r">
        <div className="flex items-center justify-between pb-3">
          <Button variant="ghost" size="sm" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-sm font-medium flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMode("months")}>{monthLabel}</Button>
            <Button variant="ghost" size="sm" onClick={() => setMode("years")}>{yearLabel}</Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {mode === "days" && (
          <>
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
                    onClick={() => {
                      setSelected(d);
                      loadDay(ymd(d));
                    }}
                  >
                    {d.getDate()}
                    {monthMarks[ymd(d)] && (
                      <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </Button>
                );
              })}
            </div>
          </>
        )}

        {mode === "months" && (
          <div className="mt-1 grid grid-cols-3 gap-2 p-1">
            {months.map((m) => (
              <Button
                key={m.idx}
                variant={m.idx === view.getMonth() ? "default" : "ghost"}
                onClick={() => {
                  const n = new Date(view);
                  n.setMonth(m.idx);
                  setView(n);
                  setMode("days");
                }}
              >
                {m.label}
              </Button>
            ))}
          </div>
        )}

        {mode === "years" && (
          <div className="mt-1 grid grid-cols-3 gap-2 p-1">
            {years.map((y) => (
              <Button
                key={y}
                variant={y === view.getFullYear() ? "default" : "ghost"}
                onClick={() => {
                  const n = new Date(view);
                  n.setFullYear(y);
                  setView(n);
                  setMode("months");
                }}
              >
                {y}
              </Button>
            ))}
          </div>
        )}
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
                  {/* Dismissable badges */}
                  <div className="flex flex-wrap gap-2">
                    {(field.value || []).map((s: string) => (
                      <span key={s} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
                        {s}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0.5"
                          onClick={() => field.onChange((field.value || []).filter((n: string) => n !== s))}
                        >
                          ×
                        </Button>
                      </span>
                    ))}
                  </div>
                  <FormControl>
                    <Input
                      value={studyDraft}
                      onChange={(e) => setStudyDraft(e.target.value)}
                      placeholder="Type a name and press Enter"
                      className="px-3"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const v = studyDraft.trim();
                          if (v && !(field.value || []).includes(v)) {
                            field.onChange([...(field.value || []), v]);
                          }
                          setStudyDraft("");
                        }
                      }}
                    />
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


