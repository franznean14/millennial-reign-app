"use client";

import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from "@/components/ui/drawer";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NumberFlowInput } from "@/components/ui/number-flow-input";
import { Label } from "@/components/ui/label";
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
            <Button variant="outline">{triggerLabel}</Button>
          </DialogTrigger>
        )}
        <DialogContent>
          <DialogHeader className="text-center">
            <DialogTitle>Field Service</DialogTitle>
            <DialogDescription>
              Record your daily activity.
            </DialogDescription>
          </DialogHeader>
          <FieldServiceFormContent userId={userId} onClose={() => setOpen(false)} />
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
        <DrawerHeader className="text-center">
          <DrawerTitle>Field Service</DrawerTitle>
          <DrawerDescription>Record your daily activity.</DrawerDescription>
        </DrawerHeader>
        <FieldServiceFormContent userId={userId} onClose={() => setOpen(false)} />
        <DrawerFooter className="pt-2">
          <DrawerClose asChild>
            <Button variant="outline">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// Inline Field Service form content
function toLocalStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface FieldServiceFormContentProps {
  userId: string;
  onClose: () => void;
}

function FieldServiceFormContent({ userId }: FieldServiceFormContentProps) {
  const [view, setView] = useState<Date>(new Date());
  const [mode, setMode] = useState<"days"|"months"|"years">("days");
  const [date, setDate] = useState<string>(toLocalStr(new Date()));
  const [hours, setHours] = useState<string>("");
  const [studies, setStudies] = useState<string[]>([]);
  const [note, setNote] = useState<string>("");
  const debounceRef = useRef<any>(null);
  const notifyRef = useRef<any>(null);
  const [dirty, setDirty] = useState(false);
  const [monthMarks, setMonthMarks] = useState<Record<string, boolean>>({});

  const monthLabel = useMemo(() => view.toLocaleString(undefined, { month: "long" }), [view]);
  const yearLabel = useMemo(() => String(view.getFullYear()), [view]);

  const start = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const s = new Date(first);
    s.setDate(first.getDay() === 0 ? 1 - 0 : 1 - first.getDay());
    return s;
  }, [view]);

  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });

  const isSelected = (d: Date) => toLocalStr(d) === date;
  const inMonth = (d: Date) => d.getMonth() === view.getMonth();
  const viewMonthKey = () => `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, "0")}`;

  const loadMonthMarks = async () => {
    try {
      const month = viewMonthKey();
      const list = await listDailyByMonth(userId, month);
      const marks: Record<string, boolean> = {};
      for (const r of list) {
        if (!(r as any) || (typeof r !== "object")) continue;
        const h = Number((r as any).hours || 0);
        const bs = Array.isArray((r as any).bible_studies) ? (r as any).bible_studies.filter(Boolean) : [];
        const n = ((r as any).note ?? "").toString().trim();
        const empty = (!h || h === 0) && bs.length === 0 && n.length === 0;
        if (!empty) marks[(r as any).date] = true;
      }
      setMonthMarks(marks);
    } catch {}
  };

  const load = async (d: string) => {
    try {
      const rec = await getDailyRecord(userId, d);
      setHours(rec ? String(rec.hours) : "");
      setStudies(rec?.bible_studies ?? []);
      setNote(rec?.note ?? "");
      setDirty(false);
    } catch {}
  };

  const scheduleSave = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const payload = {
        user_id: userId,
        date,
        hours: Number(hours || 0),
        bible_studies: studies,
        note: note.trim() || null,
      };
      try {
        if (isDailyEmpty(payload)) {
          await deleteDailyRecord(userId, date);
          setMonthMarks((m) => {
            const cp = { ...m };
            delete cp[date];
            return cp;
          });
        } else {
          await upsertDailyRecord(payload);
          setMonthMarks((m) => ({ ...m, [date]: true }));
        }
        setDirty(false);
        try {
          window.dispatchEvent(new CustomEvent('daily-records-changed', { detail: { userId } }));
        } catch {}
      } catch (e: any) {
        toast.error(e.message ?? "Failed to save");
      }
    }, 1000);
  };

  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent('daily-records-changed', { detail: { userId } }));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours]);

  const addStudy = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (studies.includes(trimmed)) return;
    setStudies((s) => [...s, trimmed]);
    setDirty(true);
  };

  const removeStudy = (name: string) => {
    setStudies((s) => s.filter((n) => n !== name));
    setDirty(true);
  };

  const changeStep = (delta: number) => {
    const next = new Date(view);
    if (mode === "days") next.setMonth(next.getMonth() + delta);
    else if (mode === "months") next.setFullYear(next.getFullYear() + delta);
    else next.setFullYear(next.getFullYear() + delta * 12);
    setView(next);
  };

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    idx: i,
    label: new Date(2000, i, 1).toLocaleString(undefined, { month: "short" })
  })), []);

  const years = useMemo(() => {
    const base = view.getFullYear();
    const start = base - 7;
    return Array.from({ length: 12 }, (_, i) => start + i);
  }, [view]);

  useEffect(() => {
    loadMonthMarks();
    load(date);
  }, [view]);

  useEffect(() => {
    if (dirty) {
      scheduleSave();
      if (notifyRef.current) clearTimeout(notifyRef.current);
      notifyRef.current = setTimeout(() => {
        toast.success("Saving...");
      }, 500);
    }
  }, [dirty, hours, studies, note]);

  return (
    <div className="grid md:grid-cols-2 gap-4 pb-10">
      <div className="p-4 border-b md:border-b-0 md:border-r">
        <div className="flex items-center justify-between pb-3">
          <Button variant="ghost" size="sm" onClick={() => changeStep(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
        
          <div className="text-sm font-medium flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setMode("months")}>{monthLabel}</Button>
            <Button variant="ghost" size="sm" onClick={() => setMode("years")}>{yearLabel}</Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => changeStep(1)}>
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
                const sel = isSelected(d);
                const muted = !inMonth(d);
                const ds = toLocalStr(d);
                const hasData = !!monthMarks[ds];
                return (
                  <Button
                    key={i}
                    variant={sel ? "default" : "ghost"}
                    size="sm"
                    className={`relative h-10 ${muted ? "opacity-50" : ""}`}
                    onClick={() => {
                      setDate(ds);
                      setView(d);
                      load(ds);
                    }}
                  >
                    {d.getDate()}
                    {hasData && <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />}
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
      <div>
        <div className="grid gap-4 px-4">
          <div className="grid gap-2 place-items-center">
            <Label>Hours</Label>
            <NumberFlowInput
              value={parseInt(hours) || 0}
              onChange={(newValue) => {
                setHours(String(newValue));
                setDirty(true);
              }}
              min={0}
              max={24}
              size="md"
              className="mx-auto"
            />
          </div>

          <div className="grid gap-2">
            <Label>Bible Studies</Label>
            <div className="flex flex-wrap gap-2">
              {studies.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
                  {s}
                  <Button variant="ghost" size="sm" className="h-auto p-0.5" onClick={() => removeStudy(s)}>
                    ×
                  </Button>
                </span>
              ))}
            </div>
            <Input 
              className="px-3"
              placeholder="Type a name and press Enter"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = (e.target as HTMLInputElement).value;
                  addStudy(v);
                  (e.target as HTMLInputElement).value = "";
                }
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label>Note</Label>
            <Textarea
              className="px-3"
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setDirty(true);
              }}
              placeholder="Optional note for this day"
            />
          </div>
        </div>
      </div>
    </div>
  );
}


