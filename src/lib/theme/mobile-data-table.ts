import { cn } from "@/lib/utils";
import {
  getStudyBibleDarkCardShade,
  studyBibleDarkClasses,
} from "@/lib/theme/study-bible-dark";

/**
 * BWI mobile table chrome (EstablishmentList / ContactList `renderTableView`).
 * Use for phone drawer tables and any max-md data table; tablet+ may add columns via `md:`.
 */
export const mobileDataTableClasses = {
  shell: cn(
    "flex w-full flex-col overflow-hidden overscroll-none rounded-xl border border-border/70 dark:border-[#3a3342]",
    studyBibleDarkClasses.card
  ),
  header: cn("flex-shrink-0 border-b", studyBibleDarkClasses.tableHeader),
  headerRow: studyBibleDarkClasses.tableHeaderRow,
  bodyScroll: cn(
    "no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-none",
    studyBibleDarkClasses.tableBody
  ),
  bodyScrollStyle: {
    overscrollBehavior: "contain" as const,
    touchAction: "pan-y" as const,
  },
  row: (rowKey: string) =>
    cn(
      "cursor-pointer border-b transition-colors dark:border-[#3a3342]",
      getStudyBibleDarkCardShade(rowKey),
      "hover:bg-muted/30",
      studyBibleDarkClasses.cardHover
    ),
  cell: "p-3 min-w-0",
  statusBadge: "text-[10px] leading-4 px-1.5 py-0.5 rounded-sm",
  staticTh:
    "px-3 py-3 text-left align-bottom text-sm font-medium text-white/90 dark:text-[#ded6e7]",
} as const;
