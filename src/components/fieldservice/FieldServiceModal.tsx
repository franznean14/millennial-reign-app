"use client";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import { getDailyRecord, listDailyByMonth, upsertDailyRecord, isDailyEmpty, deleteDailyRecord } from "@/lib/db/dailyRecords";
import { useMobile } from "@/lib/hooks/use-mobile";

function toLocalStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function FieldServiceModal({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const isMobile = useMobile();
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
      } catch (e: any) {
        toast.error(e.message ?? "Failed to save");
      }
    }, 1000);
  };

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

  const changeMonth = (delta: number) => {
    const next = new Date(view);
    next.setMonth(next.getMonth() + delta);
    setView(next);
  };

  const Panel = (
    <div className="grid md:grid-cols-2">
      <div className="p-4 border-b md:border-b-0 md:border-r">
        <div className="flex items-center justify-between pb-3">
          <Button variant="ghost" size="sm" onClick={() => changeMonth(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-sm font-medium">{monthLabel}</div>
          <Button variant="ghost" size="sm" onClick={() => changeMonth(1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
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
      </div>
      <div className="p-4">
        <div className="mt-0 grid gap-4">
          {isMobile ? (
            <MobileHours
              value={hours}
              onChange={(v, dir) => {
                setHours(v);
                setDirty(true);
              }}
              onIncrement={(dir) => {
                setHours((h) => {
                  const n = Number(h || 0);
                  const next = isNaN(n) ? (dir === 'inc' ? 1 : 0) : Math.max(0, n + (dir === 'inc' ? 1 : -1));
                  return String(next);
                });
                setDirty(true);
              }}
            />
          ) : (
            <div className="grid gap-1 text-sm place-items-center">
              <span className="opacity-70">Hours</span>
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 rounded-full"
                  onClick={() => setHours((h) => { 
                    const n = Number(h || 0); 
                    const next = isNaN(n) ? 0 : Math.max(0, n - 1); 
                    setDirty(true); 
                    return String(next); 
                  })}
                >
                  −
                </Button>
                <Input 
                  className="w-28 text-center" 
                  value={hours} 
                  inputMode="decimal" 
                  placeholder="0" 
                  onChange={(e) => { 
                    setHours(e.target.value); 
                    setDirty(true); 
                  }} 
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-10 w-10 rounded-full"
                  onClick={() => setHours((h) => { 
                    const n = Number(h || 0); 
                    const next = isNaN(n) ? 1 : n + 1; 
                    setDirty(true); 
                    return String(next); 
                  })}
                >
                  +
                </Button>
              </div>
            </div>
          )}
          <div className="grid gap-1 text-sm">
            <span className="opacity-70">Bible Studies</span>
            <div className="flex flex-wrap gap-2">
              {studies.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
                  {s}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0.5"
                    onClick={() => removeStudy(s)}
                  >
                    ×
                  </Button>
                </span>
              ))}
            </div>
            <Input 
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
          <div className="grid gap-1 text-sm">
            <span className="opacity-70">Note</span>
            <Textarea 
              className="min-h-[96px]" 
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

  useEffect(() => {
    if (open) {
      loadMonthMarks();
      load(date);
    }
  }, [open, view]);

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
    <>
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          className="fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-200 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px]"
          size="lg"
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}
      
      <ResponsiveModal
        open={open}
        onOpenChange={setOpen}
        title="Field Service"
        description="Record your field service activity for the selected date"
        className={isMobile ? "p-0 w-full" : "w-[min(96vw,720px)]"}
      >
        {Panel}
      </ResponsiveModal>
    </>
  );
}

function MobileHours({
  value,
  onChange,
  onIncrement,
}: {
  value: string;
  onChange: (v: string, dir?: 'inc' | 'dec') => void;
  onIncrement: (dir: 'inc' | 'dec') => void;
}) {
  const [animKey, setAnimKey] = useState(0);
  const [dir, setDir] = useState<'inc' | 'dec' | null>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const startX = useRef<number | null>(null);
  const baseVal = useRef<number>(0);
  const lastDx = useRef<number>(0);

  const parseVal = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  };

  const commitSwipe = (dx: number) => {
    const stepPx = 36; // pixels per increment
    const steps = Math.round(dx / stepPx); // dx>0 => dec; dx<0 => inc
    if (steps === 0) return;
    const candidate = Math.max(0, baseVal.current - steps); // right -> dec, left -> inc
    const direction: 'inc' | 'dec' = steps < 0 ? 'inc' : 'dec';
    setDir(direction);
    setAnimKey((k) => k + 1);
    onChange(String(candidate), direction);
  };

  return (
    <div className="grid gap-3 place-items-center">
      <div
        className="relative w-full max-w-[20rem] mx-auto py-2 select-none"
        onPointerDown={(e) => {
          startX.current = e.clientX;
          baseVal.current = Math.max(0, parseVal(value));
          setPreview(baseVal.current);
          setDragging(true);
        }}
        onPointerMove={(e) => {
          if (startX.current == null) return;
          const dx = e.clientX - startX.current;
          lastDx.current = dx;
          const stepPx = 36;
          const steps = Math.round(dx / stepPx); // positive dx: swipe right
          const candidate = Math.max(0, baseVal.current - steps); // right -> dec
          setPreview(candidate);
          setDir(steps < 0 ? 'inc' : steps > 0 ? 'dec' : null);
        }}
        onPointerUp={() => {
          if (startX.current == null) return;
          commitSwipe(lastDx.current);
          startX.current = null;
          setDragging(false);
          setPreview(null);
        }}
        onPointerCancel={() => {
          startX.current = null;
          setDragging(false);
          setPreview(null);
        }}
        >
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="outline"
              size="sm"
              className={`h-12 w-12 rounded-full transition-all duration-200 ${dragging ? 'opacity-50 -translate-x-2' : ''}`}
              onClick={() => {
                setDir('dec');
                setAnimKey((k) => k + 1);
                onIncrement('dec');
              }}
            >
              −
            </Button>

          <div className="relative text-center">
            {/* Visible animated display */}
            <div
              key={animKey}
              className={`pointer-events-none mx-auto w-full max-w-[8ch] text-7xl leading-[1.15] font-extrabold tracking-tight text-foreground ${dragging ? '' : (dir === 'inc' ? 'animate-in slide-in-from-right-2 fade-in duration-200' : dir === 'dec' ? 'animate-in slide-in-from-left-2 fade-in duration-200' : '')}`}
              aria-hidden
            >
              {(preview != null ? preview : parseVal(value)) || 0}
            </div>
            {/* Roulette side numbers while dragging */}
            {(() => {
              const STEP_PX = 36;
              const dx = lastDx.current || 0;
              const center = (preview != null ? preview : parseVal(value)) || 0;
              const leftVal = Math.max(0, center - 1);
              const rightVal = Math.max(0, center + 1);
              const leftAlpha = dragging ? Math.max(0, Math.min(0.85, dx > 0 ? Math.abs(dx) / STEP_PX : 0.25)) : 0;
              const rightAlpha = dragging ? Math.max(0, Math.min(0.85, dx < 0 ? Math.abs(dx) / STEP_PX : 0.25)) : 0;
              const leftStyle = { left: '50%', transform: 'translateX(calc(-50% - 6ch))', opacity: leftAlpha } as React.CSSProperties;
              const rightStyle = { left: '50%', transform: 'translateX(calc(-50% + 6ch))', opacity: rightAlpha } as React.CSSProperties;
              return (
                <>
                  <div className="pointer-events-none absolute top-0 text-7xl leading-[1.15] font-extrabold text-foreground/80" style={leftStyle} aria-hidden>
                    {leftVal}
                  </div>
                  <div className="pointer-events-none absolute top-0 text-7xl leading-[1.15] font-extrabold text-foreground/80" style={rightStyle} aria-hidden>
                    {rightVal}
                  </div>
                </>
              );
            })()}
            {/* Transparent overlay input for editing */}
            <Input
              aria-label="Hours"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className={`absolute inset-0 mx-auto w-full max-w-[8ch] border-none bg-transparent text-transparent caret-foreground text-7xl leading-[1.15] font-extrabold tracking-tight text-center appearance-none focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-none ${dragging ? 'pointer-events-none' : ''}`}
            />
            <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Hours</div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className={`h-12 w-12 rounded-full transition-all duration-200 ${dragging ? 'opacity-50 translate-x-2' : ''}`}
            onClick={() => {
              setDir('inc');
              setAnimKey((k) => k + 1);
              onIncrement('inc');
            }}
          >
            +
          </Button>
        </div>
      </div>
    </div>
  );
}
