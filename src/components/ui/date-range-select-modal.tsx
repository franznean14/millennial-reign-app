"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/shared/FormModal";
import { ChevronLeft, ChevronRight } from "lucide-react";

function startOfGrid(view: Date) {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const s = new Date(first);
  s.setDate(first.getDay() === 0 ? 1 - 0 : 1 - first.getDay());
  return s;
}

export function DateRangeSelectContent({
  startDate,
  endDate,
  onSelect,
  allowRange = true,
  onRequestClose,
  showActions = false,
  onConfirm,
  onCancel,
  showClearAction = false,
  onClearAction,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
}: {
  startDate?: Date;
  endDate?: Date;
  onSelect: (start: Date, end?: Date) => void;
  allowRange?: boolean;
  onRequestClose?: () => void;
  showActions?: boolean;
  onConfirm?: (start: Date, end?: Date) => void;
  onCancel?: () => void;
  showClearAction?: boolean;
  onClearAction?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  const [view, setView] = useState<Date>(startDate ?? new Date());
  const [mode, setMode] = useState<"days"|"months"|"years">("days");
  const [selectionStart, setSelectionStart] = useState<Date | null>(startDate ?? null);
  const [selectionEnd, setSelectionEnd] = useState<Date | null>(endDate ?? null);
  const [isSelectingRange, setIsSelectingRange] = useState(false);

  // Update selection when props change
  useEffect(() => {
    if (startDate) setSelectionStart(startDate);
    if (endDate) setSelectionEnd(endDate);
  }, [startDate, endDate]);

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
    const start = base - 7;
    return Array.from({ length: 12 }, (i) => start + i);
  }, [view]);

  const inMonth = (d: Date) => d.getMonth() === view.getMonth();
  const isSameDay = (a?: Date, b?: Date) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const isInRange = (d: Date) => {
    if (!selectionStart || !selectionEnd) return false;
    const start = selectionStart < selectionEnd ? selectionStart : selectionEnd;
    const end = selectionStart < selectionEnd ? selectionEnd : selectionStart;
    return d >= start && d <= end;
  };
  const monthLabel = useMemo(() => view.toLocaleString(undefined, { month: "long" }), [view]);
  const yearLabel = useMemo(() => String(view.getFullYear()), [view]);

  const handleDateClick = (d: Date) => {
    if (!allowRange) {
      setSelectionStart(d);
      setSelectionEnd(null);
      if (!showActions) {
      onSelect(d, undefined);
        onRequestClose?.();
      }
      return;
    }

    if (!selectionStart || (selectionStart && selectionEnd)) {
      // Start new selection
      setSelectionStart(d);
      setSelectionEnd(null);
      setIsSelectingRange(true);
    } else if (selectionStart && !selectionEnd) {
      // Complete range selection
      const start = selectionStart < d ? selectionStart : d;
      const end = selectionStart < d ? d : selectionStart;
      setSelectionStart(start);
      setSelectionEnd(end);
      setIsSelectingRange(false);
      if (!showActions) {
      onSelect(start, end);
        onRequestClose?.();
      }
    }
  };

  const handleClear = () => {
    setSelectionStart(null);
    setSelectionEnd(null);
    setIsSelectingRange(false);
    onClearAction?.();
  };

  const handleConfirm = () => {
    if (!selectionStart) return;
    if (!allowRange) {
      onConfirm?.(selectionStart, undefined);
      return;
    }
    onConfirm?.(selectionStart, selectionEnd ?? undefined);
  };

  return (
      <div>
        <div className="flex items-center border-b pb-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
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
          <div className="flex-1 flex items-center justify-center gap-2 text-sm font-medium">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode("months")}>{monthLabel}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setMode("years")}>{yearLabel}</Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0"
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

        {allowRange && (selectionStart || selectionEnd) && (
          <div className="flex items-center justify-between mt-2 pb-2 border-b">
            <div className="text-sm">
              {selectionStart && selectionEnd ? (
                <span>
                  {selectionStart.toLocaleDateString()} - {selectionEnd.toLocaleDateString()}
                </span>
              ) : selectionStart ? (
                <span>Select end date</span>
              ) : null}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
              Clear
            </Button>
          </div>
        )}

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
                const sel = isSameDay(d, selectionStart) || isSameDay(d, selectionEnd);
                const inRange = allowRange && isInRange(d);
                const muted = !inMonth(d);
                return (
                  <Button
                    key={i}
                    type="button"
                    variant={sel ? "default" : inRange ? "secondary" : "ghost"}
                    size="sm"
                    className={`relative h-10 ${muted ? "opacity-50" : ""}`}
                    onClick={() => handleDateClick(d)}
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

        {showActions && (
          <div className="flex items-center justify-between gap-2 pt-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+12px)] border-t">
            <div>
              {showClearAction ? (
                <Button type="button" variant="outline" onClick={handleClear}>
                  Clear
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => onCancel?.()}>
                {cancelLabel}
              </Button>
              <Button type="button" disabled={!selectionStart} onClick={handleConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </div>
        )}
      </div>
  );
}

