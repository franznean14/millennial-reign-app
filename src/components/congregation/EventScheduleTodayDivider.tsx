"use client";

import { cn } from "@/lib/utils";
import { studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";

/** Separates past schedules from today/upcoming when nothing is scheduled for today. */
export function EventScheduleTodayDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-3",
        "bg-[#ece8f2]/80 dark:bg-[#80778e]/15",
        className
      )}
      role="separator"
      aria-label="Today"
    >
      <span className="h-0.5 flex-1 rounded-full bg-[#6b5196]/35 dark:bg-[#80778e]/55" />
      <span
        className={cn(
          "shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider",
          "bg-[#6b5196] text-white shadow-sm",
          "dark:bg-[#80778e] dark:text-white dark:shadow-[0_0_14px_rgba(128,119,142,0.35)]"
        )}
      >
        Today
      </span>
      <span className="h-0.5 flex-1 rounded-full bg-[#6b5196]/35 dark:bg-[#80778e]/55" />
    </div>
  );
}
