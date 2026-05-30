"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TableSortDir } from "@/lib/hooks/use-persisted-table-sort";
import { studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";

export function MobileDataTableSortTh<T extends string>({
  label,
  sortKey,
  sort,
  onToggle,
  className,
}: {
  label: string;
  sortKey: T;
  sort: { column: T; dir: TableSortDir };
  onToggle: (key: T) => void;
  className?: string;
}) {
  const active = sort.column === sortKey;
  return (
    <th
      scope="col"
      className={className}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle(sortKey);
        }}
        className={cn(
          "inline-flex min-h-11 w-full min-w-0 touch-manipulation items-center gap-0.5 rounded-md py-3 pl-3 pr-1 text-left font-medium",
          studyBibleDarkClasses.tableHeaderSortButton,
          active && studyBibleDarkClasses.tableHeaderSortButtonActive
        )}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="flex shrink-0 flex-col leading-none" aria-hidden="true">
          <ChevronUp
            className={cn(
              "h-2.5 w-2.5",
              active && sort.dir === "asc"
                ? studyBibleDarkClasses.tableHeaderSortChevronActive
                : "opacity-30"
            )}
          />
          <ChevronDown
            className={cn(
              "-mt-0.5 h-2.5 w-2.5",
              active && sort.dir === "desc"
                ? studyBibleDarkClasses.tableHeaderSortChevronActive
                : "opacity-30"
            )}
          />
        </span>
      </button>
    </th>
  );
}
