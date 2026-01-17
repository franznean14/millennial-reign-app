"use client";

import { useState, useEffect, useRef, useCallback, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/shared/FormModal";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

// --- Time Utilities ---
const to12Hour = (h24: number): number => (h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24);
const to24Hour = (h12: number, amPm: "AM" | "PM"): number => {
  if (amPm === "AM") return h12 === 12 ? 0 : h12;
  return h12 === 12 ? 12 : h12 + 12;
};

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

// --- TimeSelectModal Component ---
export function TimeSelectModal({
  open,
  onOpenChange,
  startValue,
  endValue,
  onSelect,
  title = "Select Time",
  description = "Choose start and end time",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startValue?: string;
  endValue?: string;
  onSelect: (start: string, end: string) => void;
  title?: string;
  description?: string;
}) {
  const [mode, setMode] = useState<"start" | "end">("start");
  const [, setHasInteracted] = useState(false);

  // Separate states for Start and End
  const [sH, setSH] = useState(12);
  const [sM, setSM] = useState(0);
  const [sAP, setSAP] = useState<"AM" | "PM">("AM");
  
  const [eH, setEH] = useState(1);
  const [eM, setEM] = useState(0);
  const [eAP, setEAP] = useState<"AM" | "PM">("AM");

  const hRef = useRef<HTMLDivElement>(null);
  const mRef = useRef<HTMLDivElement>(null);
  const apRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);

  // Initialize values when opening
  useEffect(() => {
    if (!open) return;

    if (startValue) {
      const [h, m] = startValue.split(":").map(Number);
      setSH(to12Hour(h));
      setSM(m || 0);
      setSAP(h >= 12 ? "PM" : "AM");
      setHasInteracted(true);
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
      setHasInteracted(true);
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
  }, [open, startValue, endValue]);

  // Sync scroll positions when mode or modal opens
  const syncScroll = useCallback((h: number, m: number, ap: "AM" | "PM") => {
    isScrollingRef.current = true;
    
    const scrollTo = (ref: React.RefObject<HTMLDivElement | null>, val: string | number) => {
      const container = ref.current;
      if (!container) return;
      const btn = Array.from(container.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === String(val).padStart(typeof val === "number" && ref === mRef ? 2 : 0, "0")
      );
      if (btn) btn.scrollIntoView({ behavior: "auto", block: "center" });
    };

    setTimeout(() => {
      scrollTo(hRef, h);
      scrollTo(mRef, m);
      scrollTo(apRef, ap);
      setTimeout(() => { isScrollingRef.current = false; }, 50);
    }, 10);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (mode === "start") syncScroll(sH, sM, sAP);
    else syncScroll(eH, eM, eAP);
  }, [open, mode, sH, sM, sAP, eH, eM, eAP, syncScroll]);

  const handleValueChange = (type: "h" | "m" | "ap", val: any) => {
    setHasInteracted(true);
    if (mode === "start") {
      if (type === "h") setSH(val);
      else if (type === "m") setSM(val);
      else setSAP(val);
    } else {
      if (type === "h") setEH(val);
      else if (type === "m") setEM(val);
      else setEAP(val);
    }
  };

  const handleConfirm = () => {
    const s24 = to24Hour(sH, sAP);
    const e24 = to24Hour(eH, eAP);
    onSelect(
      `${String(s24).padStart(2, "0")}:${String(sM).padStart(2, "0")}`,
      `${String(e24).padStart(2, "0")}:${String(eM).padStart(2, "0")}`
    );
    onOpenChange(false);
  };

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className="sm:max-w-[400px]"
      bodyClassName="px-0 pb-0"
    >
      <div className="space-y-4 px-4 pt-4 pb-6">
        {/* Toggle between Start and End */}
        <ToggleGroup 
          type="single" 
          value={mode} 
          onValueChange={(v) => v && setMode(v as "start" | "end")} 
          className="w-full bg-muted/30 p-1 rounded-lg"
        >
          <ToggleGroupItem value="start" className="flex-1 py-6 h-auto data-[state=on]:bg-background shadow-none">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider opacity-60 font-bold">Start</span>
              <span className="text-sm font-semibold">
                {sH}:{String(sM).padStart(2, "0")} {sAP}
              </span>
            </div>
          </ToggleGroupItem>
          <ToggleGroupItem value="end" className="flex-1 py-6 h-auto data-[state=on]:bg-background shadow-none">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] uppercase tracking-wider opacity-60 font-bold">End</span>
              <span className="text-sm font-semibold">
                {eH}:{String(eM).padStart(2, "0")} {eAP}
              </span>
            </div>
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Picker Columns */}
        <div className="relative flex justify-center items-center gap-2 py-4 select-none">
          {/* Highlight streak */}
          <div className="absolute left-0 right-0 h-10 top-1/2 -translate-y-1/2 border-y border-primary/10 bg-primary/5 pointer-events-none rounded-lg" />

          {/* Hour Column */}
          <TimeColumn
            ref={hRef}
            values={Array.from({ length: 12 }, (_, i) => i + 1)}
            current={mode === "start" ? sH : eH}
            onChange={(v) => handleValueChange("h", v)}
          />

          {/* Minute Column (5 min intervals) */}
          <TimeColumn
            ref={mRef}
            values={Array.from({ length: 12 }, (_, i) => i * 5)}
            current={mode === "start" ? sM : eM}
            onChange={(v) => handleValueChange("m", v)}
            format={(v) => String(v).padStart(2, "0")}
          />

          {/* AM/PM Column */}
          <TimeColumn
            ref={apRef}
            values={["AM", "PM"]}
            current={mode === "start" ? sAP : eAP}
            onChange={(v) => handleValueChange("ap", v)}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={handleConfirm}>
            Confirm
          </Button>
        </div>
      </div>
    </FormModal>
  );
}

// --- Helper Components ---

interface TimeColumnProps {
  values: (number | string)[];
  current: number | string;
  onChange: (val: any) => void;
  format?: (val: any) => string;
}

const TimeColumn = forwardRef<HTMLDivElement, TimeColumnProps>(({ values, current, onChange, format }, ref) => {
  return (
    <div className="relative group">
      {/* Fade Overlays */}
      <div className="absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none opacity-80" />
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none opacity-80" />
      
      <div
        ref={ref}
        className="flex flex-col overflow-y-auto scrollbar-hide h-[160px] w-16 items-center"
        style={{ scrollSnapType: "y mandatory" }}
      >
        <div className="h-[60px] flex-shrink-0" /> {/* Top Spacer */}
        {values.map((v) => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={cn(
              "h-10 w-full flex-shrink-0 flex items-center justify-center text-base transition-all",
              current === v ? "font-bold text-primary scale-110" : "opacity-30 hover:opacity-100"
            )}
            style={{ scrollSnapAlign: "center" }}
          >
            {format ? format(v) : v}
          </button>
        ))}
        <div className="h-[60px] flex-shrink-0" /> {/* Bottom Spacer */}
      </div>
    </div>
  );
});

TimeColumn.displayName = "TimeColumn";
