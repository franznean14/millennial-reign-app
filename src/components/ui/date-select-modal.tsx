"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { ChevronLeft, ChevronRight } from "lucide-react";

function startOfGrid(view: Date) {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const s = new Date(first);
  s.setDate(first.getDay() === 0 ? 1 - 0 : 1 - first.getDay());
  return s;
}

export function DateSelectModal({
  open,
  onOpenChange,
  value,
  onSelect,
  title = "Select Date",
  description = "Choose a date",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value?: Date;
  onSelect: (date: Date) => void;
  title?: string;
  description?: string;
}) {
  const [view, setView] = useState<Date>(value ?? new Date());
  const [mode, setMode] = useState<"days"|"months"|"years">("days");

  const days = useMemo(() => {
    const start = startOfGrid(view);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [view]);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    idx: i,
    label: new Date(2000, i, 1).toLocaleString(undefined, { month: "short" })
  })), []);

  const years = useMemo(() => {
    const base = view.getFullYear();
    const start = base - 7; // show 12 years centered around current
    return Array.from({ length: 12 }, (_, i) => start + i);
  }, [view]);
  const inMonth = (d: Date) => d.getMonth() === view.getMonth();
  const isSameDay = (a?: Date, b?: Date) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const monthLabel = useMemo(() => view.toLocaleString(undefined, { month: "long" }), [view]);
  const yearLabel = useMemo(() => String(view.getFullYear()), [view]);

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title={title} description={description} className="sm:max-w-[640px]">
      <div className="p-4 pt-0">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode("months")}>{monthLabel}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode("years")}>{yearLabel}</Button>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setView((v) => {
                const n = new Date(v);
                if (mode === "days") n.setMonth(n.getMonth() - 1);
                else if (mode === "months") n.setFullYear(n.getFullYear() - 1);
                else n.setFullYear(n.getFullYear() - 12);
                return n;
              })}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setView((v) => {
                const n = new Date(v);
                if (mode === "days") n.setMonth(n.getMonth() + 1);
                else if (mode === "months") n.setFullYear(n.getFullYear() + 1);
                else n.setFullYear(n.getFullYear() + 12);
                return n;
              })}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {mode === "days" && (
          <>
            <div className="grid grid-cols-7 gap-1 px-1 pt-3 text-xs opacity-70">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={`${d}-${i}`} className="text-center">
                  {d}
                </div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1 p-1">
              {days.map((d, i) => {
                const sel = isSameDay(d, value);
                const muted = !inMonth(d);
                return (
                  <Button
                    key={i}
                    type="button"
                    variant={sel ? "default" : "ghost"}
                    size="sm"
                    className={`relative h-10 ${muted ? "opacity-50" : ""}`}
                    onClick={() => {
                      onSelect(d);
                      onOpenChange(false);
                    }}
                  >
                    {d.getDate()}
                  </Button>
                );
              })}
            </div>
          </>
        )}

        {mode === "months" && (
          <div className="mt-3 grid grid-cols-3 gap-2 p-1">
            {months.map((m) => (
              <Button
                key={m.idx}
                type="button"
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
          <div className="mt-3 grid grid-cols-3 gap-2 p-1">
            {years.map((y) => (
              <Button
                key={y}
                type="button"
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
    </ResponsiveModal>
  );
}
