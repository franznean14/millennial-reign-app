import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateHuman(input?: string | Date | null, timeZone?: string) {
  if (!input) return "—";
  let d: Date | null = null;
  if (input instanceof Date) {
    d = input;
  } else if (typeof input === "string") {
    // Support YYYY-MM or YYYY-MM-DD
    const parts = input.split("-");
    if (parts.length === 2) {
      const [y, m] = parts.map((n) => parseInt(n, 10));
      if (y && m) d = new Date(y, m - 1, 1);
    } else if (parts.length === 3) {
      const [y, m, day] = parts.map((n) => parseInt(n, 10));
      if (y && m && day) d = new Date(y, m - 1, day);
    }
  }
  if (!d || isNaN(d.getTime())) return String(input);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", timeZone: timeZone || undefined });
}

export function formatHours(value: number): string {
  if (!isFinite(value)) return "0";
  if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
  const s = value.toFixed(2);
  return s.replace(/(\.\d*[1-9])0+$/, "$1").replace(/\.0+$/, "");
}
