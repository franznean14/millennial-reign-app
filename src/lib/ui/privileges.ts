import type { Privilege } from "@/lib/db/types";

export const PRIVILEGE_STYLES: Record<Privilege, string> = {
  "Elder": "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700",
  "Ministerial Servant": "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-700",
  "Regular Pioneer": "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/30 dark:text-violet-200 dark:border-violet-700",
  "Auxiliary Pioneer": "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700",
};

export function privilegeChipClass(p: Privilege) {
  return `inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${PRIVILEGE_STYLES[p] ?? "bg-muted"}`;
}

