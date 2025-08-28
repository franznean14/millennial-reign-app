"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { getDailyRecord, listDailyByMonth, upsertDailyRecord, isDailyEmpty, deleteDailyRecord } from "@/lib/db/dailyRecords";

function toLocalStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function FieldServiceModal({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(new Date());
  const [date, setDate] = useState<string>(toLocalStr(new Date()));
  const [hours, setHours] = useState<string>("");
  const [studies, setStudies] = useState<string[]>([]);
  const [note, setNote] = useState<string>("");
  const debounceRef = useRef<any>(null);
  const notifyRef = useRef<any>(null);
  const [dirty, setDirty] = useState(false);
  const [monthMarks, setMonthMarks] = useState<Record<string, boolean>>({});

  const monthLabel = useMemo(() => view.toLocaleString(undefined, { month: "long", year: "numeric" }), [view]);

  // Build calendar grid
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
        // Treat zero/empty records as no data
        // @ts-ignore r matches DailyRecord shape
        if (!(r as any) || (typeof r !== "object")) continue;
        // lazy import util via inline helper
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
          // optimistically mark the date as having saved data
          setMonthMarks((m) => ({ ...m, [date]: true }));
        }
        if (notifyRef.current) clearTimeout(notifyRef.current);
        notifyRef.current = setTimeout(() => {
          toast.success("Saved");
        }, 100);
      } catch (e) {
        toast.error("Failed to save");
      }
    }, 500);
  };

  useEffect(() => {
    if (dirty) scheduleSave();
  }, [dirty, hours, studies, note]);

  useEffect(() => {
    load(date);
  }, [date]);

  useEffect(() => {
    loadMonthMarks();
    const handler = (e: any) => {
      const d = e.detail?.date;
      if (!d) {
        loadMonthMarks();
        return;
      }
      const mk = d.slice(0, 7);
      if (mk === viewMonthKey()) loadMonthMarks();
    };
    window.addEventListener("daily-record-updated", handler as any);
    return () => window.removeEventListener("daily-record-updated", handler as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const addStudy = (name: string) => {
    const v = name.trim();
    if (!v) return;
    setStudies((arr) => (arr.includes(v) ? arr : [...arr, v]));
    setDirty(true);
  };

  const removeStudy = (name: string) => {
    setStudies((arr) => arr.filter((x) => x !== name));
    setDirty(true);
  };

  const changeMonth = (delta: number) => {
    const next = new Date(view);
    next.setMonth(view.getMonth() + delta);
    setView(next);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {!open && (
        <Dialog.Trigger asChild>
          <button 
            className="fixed bottom-20 right-4 z-[999999] inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-primary-foreground shadow-2xl hover:shadow-3xl transition-all duration-200 hover:scale-110 active:scale-95 touch-manipulation md:bottom-6 md:right-6" 
            style={{ 
              zIndex: 2147483647,
              position: 'fixed',
              pointerEvents: 'auto'
            }}
          >
            <Plus className="h-6 w-6" />
          </button>
        </Dialog.Trigger>
      )}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" style={{ zIndex: 2147483646 }} />
        {open && (
          <Dialog.Close asChild>
            <button 
              className="fixed bottom-20 right-4 z-[999999] inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-primary-foreground shadow-2xl hover:shadow-3xl transition-all duration-200 hover:scale-110 active:scale-95 touch-manipulation md:bottom-6 md:right-6" 
              aria-label="Close"
              style={{ 
                zIndex: 2147483647,
                position: 'fixed',
                pointerEvents: 'auto'
              }}
            >
              <X className="h-6 w-6" />
            </button>
          </Dialog.Close>
        )}
        <Dialog.Content 
          className="fixed left-1/2 top-1/2 w-[min(96vw,720px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-0 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0"
          style={{ zIndex: 2147483646 }}
        >
          <div className="grid md:grid-cols-2">
            {/* Calendar side */}
            <div className="p-4 border-b md:border-b-0 md:border-r">
              <div className="flex items-center justify-between pb-3">
                <button className="rounded p-1 hover:bg-muted" onClick={() => changeMonth(-1)}>
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div className="text-sm font-medium">{monthLabel}</div>
                <button className="rounded p-1 hover:bg-muted" onClick={() => changeMonth(1)}>
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 px-1 text-xs opacity-70">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
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
                    <button
                      key={i}
                      className={`relative h-10 rounded text-sm ${
                        sel
                          ? "bg-primary text-primary-foreground"
                          : muted
                          ? "opacity-50 hover:bg-muted"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => {
                        setDate(ds);
                        setView(d);
                        load(ds);
                      }}
                    >
                      {d.getDate()}
                      {hasData && <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form side */}
            <div className="p-4">
              <div className="flex items-center justify-between">
                <Dialog.Title className="text-base font-medium">Field Service</Dialog.Title>
                <Dialog.Close asChild>
                  <button className="rounded-md p-1 hover:bg-muted" aria-label="Close">
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>
              <div className="mt-4 grid gap-4">
                {/* Hours with plus/minus */}
                <div className="grid gap-1 text-sm place-items-center">
                  <span className="opacity-70">Hours</span>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-full border text-xl hover:bg-muted"
                      onClick={() =>
                        setHours((h) => {
                          const n = Number(h || 0);
                          const next = isNaN(n) ? 0 : Math.max(0, n - 1);
                          const out = String(next);
                          setDirty(true);
                          return out;
                        })
                      }
                      aria-label="Decrease hours"
                    >
                      −
                    </button>
                    <input
                      className="w-28 rounded-md border bg-background px-3 py-2 text-center"
                      value={hours}
                      inputMode="decimal"
                      placeholder="0"
                      onChange={(e) => {
                        setHours(e.target.value);
                        setDirty(true);
                      }}
                    />
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-full border text-xl hover:bg-muted"
                      onClick={() =>
                        setHours((h) => {
                          const n = Number(h || 0);
                          const next = isNaN(n) ? 1 : n + 1;
                          const out = String(next);
                          setDirty(true);
                          return out;
                        })
                      }
                      aria-label="Increase hours"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Bible studies names chips with input */}
                <div className="grid gap-1 text-sm">
                  <span className="opacity-70">Bible Studies</span>
                  <div className="flex flex-wrap gap-2">
                    {studies.map((s) => (
                      <span key={s} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
                        {s}
                        <button className="rounded p-0.5 hover:bg-muted" onClick={() => removeStudy(s)} aria-label={`Remove ${s}`}>
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    className="rounded-md border bg-background px-3 py-2"
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

                {/* Note */}
                <div className="grid gap-1 text-sm">
                  <span className="opacity-70">Note</span>
                  <textarea
                    className="min-h-[96px] rounded-md border bg-background px-3 py-2"
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
