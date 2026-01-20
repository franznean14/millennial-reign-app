"use client";

import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/shared/FormModal";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const to12Hour = (h24: number): number => (h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24);
const to24Hour = (h12: number, amPm: "AM" | "PM"): number =>
  amPm === "AM" ? (h12 === 12 ? 0 : h12) : h12 === 12 ? 12 : h12 + 12;

const getCurrentTimeRounded = () => {
  const now = new Date();
  const h24 = now.getHours();
  const m = Math.round(now.getMinutes() / 5) * 5;
  const finalM = m >= 60 ? 0 : m;
  const finalH24 = m >= 60 ? (h24 + 1) % 24 : h24;
  return {
    h24: finalH24,
    h12: to12Hour(finalH24),
    m: finalM,
    amPm: (finalH24 >= 12 ? "PM" : "AM") as "AM" | "PM",
  };
};

const calculateEndFromStart = (h12: number, m: number, amPm: "AM" | "PM") => {
  const start24 = to24Hour(h12, amPm);
  const end24 = (start24 + 1) % 24;
  return {
    h12: to12Hour(end24),
    m,
    amPm: (end24 >= 12 ? "PM" : "AM") as "AM" | "PM",
  };
};

export function TimeSelectModal({
  open,
  onOpenChange,
  startValue,
  endValue,
  onSelect,
  title = "Select Time",
  description = "Choose start and end time",
  inline = false,
  onRequestClose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startValue?: string;
  endValue?: string;
  onSelect: (start: string, end: string) => void;
  title?: string;
  description?: string;
  inline?: boolean;
  onRequestClose?: () => void;
}) {
  const [mode, setMode] = useState<"start" | "end">("start");
  const [sH, setSH] = useState(12);
  const [sM, setSM] = useState(0);
  const [sAP, setSAP] = useState<"AM" | "PM">("AM");
  const [eH, setEH] = useState(1);
  const [eM, setEM] = useState(0);
  const [eAP, setEAP] = useState<"AM" | "PM">("AM");
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);
  const amPmRef = useRef<HTMLDivElement>(null);
  const scrollTimers = useRef<Record<"hours" | "minutes" | "ampm", number | null>>({
    hours: null,
    minutes: null,
    ampm: null,
  });

  useEffect(() => {
    if (!open && !inline) return;

    if (startValue) {
      const [h, m] = startValue.split(":").map(Number);
      setSH(to12Hour(h));
      setSM(m || 0);
      setSAP(h >= 12 ? "PM" : "AM");
    } else {
      const cur = getCurrentTimeRounded();
      setSH(cur.h12);
      setSM(cur.m);
      setSAP(cur.amPm);
    }

    if (endValue) {
      const [h, m] = endValue.split(":").map(Number);
      setEH(to12Hour(h));
      setEM(m || 0);
      setEAP(h >= 12 ? "PM" : "AM");
    } else if (startValue) {
      const [h, m] = startValue.split(":").map(Number);
      const end = calculateEndFromStart(to12Hour(h), m || 0, h >= 12 ? "PM" : "AM");
      setEH(end.h12);
      setEM(end.m);
      setEAP(end.amPm);
    } else {
      const cur = getCurrentTimeRounded();
      const end = calculateEndFromStart(cur.h12, cur.m, cur.amPm);
      setEH(end.h12);
      setEM(end.m);
      setEAP(end.amPm);
    }
  }, [open, inline, startValue, endValue]);

  const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), []);
  const hours = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);

  const currentH = mode === "start" ? sH : eH;
  const currentM = mode === "start" ? sM : eM;
  const currentAP = mode === "start" ? sAP : eAP;

  const setH = mode === "start" ? setSH : setEH;
  const setM = mode === "start" ? setSM : setEM;
  const setAP = mode === "start" ? setSAP : setEAP;

  const pickClosest = (container: HTMLDivElement | null, type: "hours" | "minutes" | "ampm") => {
    if (!container) return;
    const items = Array.from(container.querySelectorAll("button")) as HTMLButtonElement[];
    if (!items.length) return;
    const rect = container.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    let closest: HTMLButtonElement | null = null;
    let closestDist = Infinity;
    for (const btn of items) {
      const r = btn.getBoundingClientRect();
      const dist = Math.abs(r.top + r.height / 2 - centerY);
      if (dist < closestDist) {
        closestDist = dist;
        closest = btn;
        }
      }
    if (!closest) return;
    const value = closest.textContent?.trim() ?? "";
    if (type === "hours") {
      const v = Number(value);
      if (!Number.isNaN(v)) setH(v);
    } else if (type === "minutes") {
      const v = Number(value);
      if (!Number.isNaN(v)) setM(v);
    } else {
      if (value === "AM" || value === "PM") setAP(value);
    }
  };

  const handleScroll = (type: "hours" | "minutes" | "ampm") => {
    const key = type;
    if (scrollTimers.current[key]) {
      window.clearTimeout(scrollTimers.current[key]!);
    }
    scrollTimers.current[key] = window.setTimeout(() => {
      const container =
        type === "hours" ? hoursRef.current : type === "minutes" ? minutesRef.current : amPmRef.current;
      pickClosest(container, type);
    }, 120);
  };

  const scrollToValue = (container: HTMLDivElement | null, value: string) => {
    if (!container) return;
    const items = Array.from(container.querySelectorAll("button")) as HTMLButtonElement[];
    const match = items.find((btn) => btn.textContent?.trim() === value);
    if (!match) return;
    const targetTop = match.offsetTop - (container.clientHeight / 2 - match.clientHeight / 2);
    container.scrollTo({ top: targetTop, behavior: "auto" });
  };

  useEffect(() => {
    const h = hoursRef.current;
    const m = minutesRef.current;
    const a = amPmRef.current;
    const onHours = () => handleScroll("hours");
    const onMinutes = () => handleScroll("minutes");
    const onAmPm = () => handleScroll("ampm");
    if (h) h.addEventListener("scroll", onHours, { passive: true });
    if (m) m.addEventListener("scroll", onMinutes, { passive: true });
    if (a) a.addEventListener("scroll", onAmPm, { passive: true });
    return () => {
      if (h) h.removeEventListener("scroll", onHours);
      if (m) m.removeEventListener("scroll", onMinutes);
      if (a) a.removeEventListener("scroll", onAmPm);
    };
  }, [mode, currentH, currentM, currentAP]);

  useEffect(() => {
    if (!open && !inline) return;
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      scrollToValue(hoursRef.current, String(currentH));
      scrollToValue(minutesRef.current, String(currentM).padStart(2, "0"));
      scrollToValue(amPmRef.current, String(currentAP));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [open, inline, currentH, currentM, currentAP]);

  const handleConfirm = () => {
    const s24 = to24Hour(sH, sAP);
    const e24 = to24Hour(eH, eAP);
    onSelect(`${String(s24).padStart(2, "0")}:${String(sM).padStart(2, "0")}`, `${String(e24).padStart(2, "0")}:${String(eM).padStart(2, "0")}`);
    if (inline) {
      onRequestClose?.();
          } else {
      onOpenChange(false);
    }
  };

  const content = (
    <div className="px-4 pt-4 pb-2">
        <div className="flex gap-2 mb-4 py-3">
        <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as "start" | "end")} className="w-full">
            <ToggleGroupItem value="start" className="flex-1 py-6 px-4">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">Start</span>
                <span className="text-sm font-medium">
                {sH}:{String(sM).padStart(2, "0")} {sAP}
                </span>
              </div>
            </ToggleGroupItem>
            <ToggleGroupItem value="end" className="flex-1 py-6 px-4">
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">End</span>
                <span className="text-sm font-medium">
                {eH}:{String(eM).padStart(2, "0")} {eAP}
                </span>
              </div>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="relative flex items-center justify-center gap-4 py-4">
      <div className="absolute left-4 right-4 h-[44px] top-1/2 -translate-y-1/2 bg-primary/5 pointer-events-none z-10 rounded-md" />

        <TimeColumn ref={hoursRef} values={hours} current={currentH} onChange={setH} />
        <TimeColumn
          ref={minutesRef}
          values={minutes}
          current={currentM}
          onChange={setM}
          format={(v) => String(v).padStart(2, "0")}
        />
        <TimeColumn ref={amPmRef} values={["AM", "PM"]} current={currentAP} onChange={setAP} />
          </div>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button type="button" variant="outline" onClick={() => (inline ? onRequestClose?.() : onOpenChange(false))}>
          Cancel
        </Button>
        <Button type="button" onClick={handleConfirm}>
          Confirm
                </Button>
            </div>
          </div>
  );

  if (inline) return content;

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className="sm:max-w-[400px]"
      bodyClassName="p-0"
    >
      {content}
    </FormModal>
  );
}

const TimeColumn = forwardRef<HTMLDivElement, {
  values: (number | string)[];
  current: number | string;
  onChange: (val: any) => void;
  format?: (val: any) => string;
}>(({ values, current, onChange, format }, ref) => {
  return (
          <div className="flex flex-col items-center gap-2 relative">
            <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-background to-transparent pointer-events-none z-10" />
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
            <div 
        ref={ref}
              className="time-picker-scroll flex flex-col gap-1 max-h-[200px] overflow-y-auto scrollbar-hide relative"
        style={{ scrollSnapType: "y mandatory" }}
            >
              <div className="h-[88px] flex-shrink-0" />
        {values.map((val) => (
              <Button
            key={val}
                type="button"
                variant="ghost"
                size="sm"
                className="w-16 text-base flex-shrink-0"
            style={{ scrollSnapAlign: "center" }}
            onClick={() => onChange(val)}
              >
            {format ? format(val) : val}
          </Button>
        ))}
        <div className="h-[88px] flex-shrink-0" />
      </div>
    </div>
  );
});
TimeColumn.displayName = "TimeColumn";
