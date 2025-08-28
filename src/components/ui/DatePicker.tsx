"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronDown, ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";

type Props = {
  label: string;
  value: string | null | undefined; // YYYY-MM-DD
  onChange: (val: string | null) => void;
  required?: boolean;
  mode?: "popover" | "dialog";
};

function fmt(d: Date) {
  return d.toLocaleDateString();
}

function toStrLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromStr(s?: string | null) {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return undefined;
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? undefined : dt;
}

export function DatePicker({ label, value, onChange, mode = "popover" }: Props) {
  const selected = fromStr(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => selected ?? new Date());

  const display = useMemo(() => (selected ? fmt(selected) : "Select date"), [selected]);

  // Build month grid
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDay() === 0 ? 1 - 0 : 1 - first.getDay()); // start from Sunday
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }

  const sameDay = (a?: Date, b?: Date) => !!a && !!b && a.toDateString() === b.toDateString();
  const inMonth = (d: Date) => d.getMonth() === view.getMonth();

  const changeMonth = (delta: number) => {
    const next = new Date(view);
    next.setMonth(view.getMonth() + delta);
    setView(next);
  };

  // month/year lists for larger UI controls
  const MONTHS = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const currentYear = new Date().getFullYear();
  const YEARS = Array.from({ length: 140 }, (_, i) => currentYear + 10 - i); // from current+10 down to ~1894

  const Header = (
    <div className="flex items-center justify-between gap-2 pb-3">
      <button className="rounded p-1 hover:bg-muted" onClick={() => changeMonth(-1)} aria-label="Prev month">
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-2">
        <Select value={String(view.getMonth())} onValueChange={(val) => { const next = new Date(view); next.setMonth(Number(val)); setView(next); }}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Month</SelectLabel>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i)}>{m}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={String(view.getFullYear())} onValueChange={(val) => { const next = new Date(view); next.setFullYear(Number(val)); setView(next); }}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Year</SelectLabel>
              {YEARS.map((yy) => (
                <SelectItem key={yy} value={String(yy)}>{yy}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <button className="rounded p-1 hover:bg-muted" onClick={() => changeMonth(1)} aria-label="Next month">
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );

  const Grid = (
    <>
      <div className="grid grid-cols-7 gap-1 px-2 text-xs font-medium opacity-70">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={`${d}-${i}`} className="text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1 p-2">
        {days.map((d, i) => {
          const sel = sameDay(d, selected);
          const muted = !inMonth(d);
          return (
            <button
              key={i}
              className={`h-10 w-10 sm:h-11 sm:w-11 rounded text-sm ${
                sel
                  ? "bg-primary text-primary-foreground"
                  : muted
                  ? "opacity-50 hover:bg-muted"
                  : "hover:bg-muted"
              }`}
              onClick={() => {
                onChange(toStrLocal(d));
                setOpen(false);
                setView(d);
              }}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 px-2 pb-1">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-muted"
          onClick={() => {
            const t = new Date();
            onChange(toStrLocal(t));
            setOpen(false);
            setView(t);
          }}
        >
          <CalendarIcon className="h-3.5 w-3.5" /> Today
        </button>
        <button
          type="button"
          className="rounded border px-2 py-1 text-xs hover:bg-muted"
          onClick={() => {
            onChange(null);
            setOpen(false);
          }}
        >
          Clear
        </button>
      </div>
    </>
  );

  return (
    <div className="grid gap-1 text-sm">
      <span className="opacity-70">{label}</span>
      {mode === "popover" ? (
        <DropdownMenu.Root open={open} onOpenChange={setOpen}>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="inline-flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 hover:bg-muted">
              <span className="truncate">{display}</span>
              <ChevronDown className="h-4 w-4 opacity-70" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content side="top" align="start" sideOffset={6} collisionPadding={8} className="z-[70] w-[min(92vw,380px)] rounded-md border bg-background p-3 shadow-md opacity-0 -translate-y-1 transition-[opacity,transform] duration-150 ease-in-out data-[state=open]:opacity-100 data-[state=open]:translate-y-0">
            {Header}
            {Grid}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      ) : (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Trigger asChild>
            <button type="button" className="inline-flex w-full items-center justify-between rounded-md border bg-background px-3 py-2 hover:bg-muted">
              <span className="truncate">{display}</span>
              <ChevronDown className="h-4 w-4 opacity-70" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-[80] w-[min(96vw,560px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-4 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0">
              <div className="flex items-center justify-between">
                <Dialog.Title className="text-base font-medium">{label}</Dialog.Title>
                <Dialog.Close asChild>
                  <button className="rounded-md p-1 hover:bg-muted" aria-label="Close">
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>
              <div className="mt-3">
                {Header}
                {Grid}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
