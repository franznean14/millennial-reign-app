"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusFilterButtons } from "@/components/filters/StatusFilterButtons";
import { getInitialsFromName } from "@/lib/utils/visit-history-ui";
import { FormModal } from "@/components/shared/FormModal";
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerThinRightContent,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DateRangeSelectContent } from "@/components/ui/date-range-select-modal";
import { format } from "date-fns";
import { Calendar, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { Variants } from "motion/react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { getStudyBibleDarkCardShade, studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";

export interface VisitFilters {
  search: string;
  statuses: string[];
  areas: string[];
  /** User ids (publishers/partners) — to-do matches if either assignee is selected. */
  assigneeIds: string[];
  /** Inclusive call/visit date bounds (`YYYY-MM-DD`), Calls filter only. */
  callDateFrom: string | null;
  callDateTo: string | null;
  myUpdatesOnly: boolean;
  bwiOnly: boolean;
  contactOnly: boolean;
}

export interface VisitAssigneeFilterOption {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

export interface VisitFilterOption {
  value: string;
  label: string;
}

interface VisitFiltersFormProps {
  filters: VisitFilters;
  statusOptions: VisitFilterOption[];
  areaOptions: VisitFilterOption[];
  /** When provided and non-empty, shows assignee avatar toggles (e.g. home to-dos). */
  assigneeOptions?: VisitAssigneeFilterOption[];
  /** Subtext under Assignees (defaults to to-do copy). */
  assigneeHelpText?: string;
  /** Calls history: button opens the same date-range UI as event schedules. */
  showCallDateFilter?: boolean;
  /**
   * To-do due date (`YYYY-MM-DD`), same `DateRangeSelectContent` + drawer/modal as Call date.
   * Pass `onDueDateYmdChange` to enable.
   */
  dueDateYmd?: string | null;
  onDueDateYmdChange?: (ymd: string | null) => void;
  onFiltersChange: (filters: VisitFilters) => void;
  onClearFilters: () => void;
}

function parseYmdLocal(ymd: string | null): Date | undefined {
  if (!ymd) return undefined;
  const [y, m, d] = ymd.split("-").map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d || Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return undefined;
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

const DEFAULT_ASSIGNEE_HELP =
  "Show to-dos where this publisher or partner is assigned.";

/** Stagger children for filter sections (Calls / to-do drawer mount). */
const FILTER_STAGGER: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

const FILTER_SECTION: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: [0.4, 0, 0.2, 1] },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] },
  },
};

export function VisitFiltersForm({
  filters,
  statusOptions,
  areaOptions,
  assigneeOptions,
  assigneeHelpText = DEFAULT_ASSIGNEE_HELP,
  showCallDateFilter = false,
  dueDateYmd = null,
  onDueDateYmdChange,
  onFiltersChange,
  onClearFilters
}: VisitFiltersFormProps) {
  const [callDateModalOpen, setCallDateModalOpen] = useState(false);
  const [dueDateModalOpen, setDueDateModalOpen] = useState(false);
  const isCallDateTabletDrawer = useMediaQuery("(min-width: 768px)");

  const callDateDrawerPanelClass = useMemo(
    () => getStudyBibleDarkCardShade("bwi-visit-filters-call-date"),
    []
  );
  const dueDateDrawerPanelClass = useMemo(
    () => getStudyBibleDarkCardShade("bwi-visit-filters-due-date"),
    []
  );

  const callDateButtonLabel = useMemo(() => {
    const from = filters.callDateFrom;
    const to = filters.callDateTo;
    if (!from && !to) return null;
    const start = parseYmdLocal(from);
    const end = parseYmdLocal(to ?? from);
    if (!start) return null;
    if (!to || from === to) return format(start, "MMMM d, yyyy");
    if (!end) return format(start, "MMMM d, yyyy");
    return `${format(start, "MMMM d, yyyy")} → ${format(end, "MMMM d, yyyy")}`;
  }, [filters.callDateFrom, filters.callDateTo]);

  const dueDateButtonLabel = useMemo(() => {
    if (!dueDateYmd) return null;
    const d = parseYmdLocal(dueDateYmd);
    if (!d) return null;
    return format(d, "MMMM d, yyyy");
  }, [dueDateYmd]);

  const toggleStatus = (status: string) => {
    onFiltersChange({
      ...filters,
      statuses: filters.statuses.includes(status)
        ? filters.statuses.filter((s) => s !== status)
        : [...filters.statuses, status]
    });
  };

  const toggleArea = (area: string) => {
    onFiltersChange({
      ...filters,
      areas: filters.areas.includes(area)
        ? filters.areas.filter((a) => a !== area)
        : [...filters.areas, area]
    });
  };

  const toggleAssignee = (userId: string) => {
    onFiltersChange({
      ...filters,
      assigneeIds: filters.assigneeIds.includes(userId)
        ? filters.assigneeIds.filter((id) => id !== userId)
        : [...filters.assigneeIds, userId],
    });
  };

  const hasActiveFilters =
    filters.statuses.length > 0 ||
    filters.areas.length > 0 ||
    filters.assigneeIds.length > 0 ||
    filters.callDateFrom != null ||
    filters.callDateTo != null ||
    dueDateYmd != null;

  const callBody = (
    <DateRangeSelectContent
      startDate={parseYmdLocal(filters.callDateFrom)}
      endDate={parseYmdLocal(filters.callDateTo) ?? undefined}
      allowRange
      showActions
      showClearAction={Boolean(filters.callDateFrom || filters.callDateTo)}
      onClearAction={() => {
        onFiltersChange({
          ...filters,
          callDateFrom: null,
          callDateTo: null,
        });
        setCallDateModalOpen(false);
      }}
      onSelect={() => {}}
      onConfirm={(start, end) => {
        const from = format(start, "yyyy-MM-dd");
        const to = end ? format(end, "yyyy-MM-dd") : from;
        onFiltersChange({
          ...filters,
          callDateFrom: from,
          callDateTo: to,
        });
        setCallDateModalOpen(false);
      }}
      onCancel={() => setCallDateModalOpen(false)}
    />
  );

  const callDateModal = showCallDateFilter
    ? isCallDateTabletDrawer
      ? (
          <Drawer
            open={callDateModalOpen}
            onOpenChange={setCallDateModalOpen}
            direction="right"
            modal
            nested
            shouldScaleBackground={false}
          >
            <DrawerThinRightContent
              className={cn(
                "border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff]",
                callDateDrawerPanelClass
              )}
            >
              <DrawerHeader className="bg-transparent px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-left">
                <DrawerTitle>Call date</DrawerTitle>
                <DrawerDescription className={studyBibleDarkClasses.muted}>
                  Choose a single date or select a range
                </DrawerDescription>
              </DrawerHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+24px)] pt-4">
                {callBody}
              </div>
            </DrawerThinRightContent>
          </Drawer>
        )
      : (
          <FormModal
            open={callDateModalOpen}
            onOpenChange={setCallDateModalOpen}
            title="Call date"
            description="Choose a single date or select a range"
            className="sm:max-w-[640px]"
          >
            {callBody}
          </FormModal>
        )
    : null;

  const dueDateBody =
    onDueDateYmdChange != null ? (
      <DateRangeSelectContent
        startDate={parseYmdLocal(dueDateYmd)}
        allowRange={false}
        showActions
        showClearAction={Boolean(dueDateYmd)}
        onClearAction={() => {
          onDueDateYmdChange(null);
          setDueDateModalOpen(false);
        }}
        onSelect={() => {}}
        onConfirm={(start) => {
          onDueDateYmdChange(format(start, "yyyy-MM-dd"));
          setDueDateModalOpen(false);
        }}
        onCancel={() => setDueDateModalOpen(false)}
      />
    ) : null;

  const dueDateModal =
    onDueDateYmdChange != null && dueDateBody != null
      ? isCallDateTabletDrawer
        ? (
            <Drawer
              open={dueDateModalOpen}
              onOpenChange={setDueDateModalOpen}
              direction="right"
              modal
              nested
              shouldScaleBackground={false}
            >
              <DrawerThinRightContent
                className={cn(
                  "border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff]",
                  dueDateDrawerPanelClass
                )}
              >
                <DrawerHeader className="bg-transparent px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-left">
                  <DrawerTitle>Due date</DrawerTitle>
                  <DrawerDescription className={studyBibleDarkClasses.muted}>
                    Choose a due date
                  </DrawerDescription>
                </DrawerHeader>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+24px)] pt-4">
                  {dueDateBody}
                </div>
              </DrawerThinRightContent>
            </Drawer>
          )
        : (
            <FormModal
              open={dueDateModalOpen}
              onOpenChange={setDueDateModalOpen}
              title="Due date"
              description="Choose a due date"
              className="sm:max-w-[640px]"
            >
              {dueDateBody}
            </FormModal>
          )
      : null;

  const dueDateFieldsOnly =
    onDueDateYmdChange != null ? (
      <div className="space-y-2">
        <Label>Due date</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 w-full justify-start rounded-md px-3 font-normal text-left"
          aria-label={dueDateButtonLabel ? `Due date: ${dueDateButtonLabel}` : "Select due date"}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest(".due-date-clear")) return;
            setDueDateModalOpen(true);
          }}
        >
          <Calendar className="h-4 w-4 shrink-0" aria-hidden />
          <span
            className={cn(
              "text-sm min-w-0 flex-1 truncate text-left",
              !dueDateButtonLabel && "text-muted-foreground"
            )}
          >
            {dueDateButtonLabel ?? "Select date"}
          </span>
          {dueDateButtonLabel ? (
            <div
              className="due-date-clear filter-x-button h-4 w-4 shrink-0 flex items-center justify-center cursor-pointer hover:opacity-70"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDueDateYmdChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onDueDateYmdChange(null);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label="Clear due date"
            >
              <X className="h-4 w-4 pointer-events-none" />
            </div>
          ) : null}
        </Button>
      </div>
    ) : null;

  const dueDateSection =
    onDueDateYmdChange != null ? (
      <>
        {dueDateFieldsOnly}
        {dueDateModal}
      </>
    ) : null;

  const callDateFieldsOnly = showCallDateFilter ? (
    <div className="space-y-2">
      <Label>Call date</Label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-9 w-full justify-start rounded-md px-3 font-normal text-left"
        aria-label={
          callDateButtonLabel ? `Call date: ${callDateButtonLabel}` : "Select call date or range"
        }
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest(".call-date-clear")) return;
          setCallDateModalOpen(true);
        }}
      >
        <Calendar className="h-4 w-4 shrink-0" aria-hidden />
        <span
          className={cn(
            "text-sm min-w-0 flex-1 truncate text-left",
            !callDateButtonLabel && "text-muted-foreground"
          )}
        >
          {callDateButtonLabel ?? "Select date"}
        </span>
        {callDateButtonLabel ? (
          <div
            className="call-date-clear filter-x-button h-4 w-4 shrink-0 flex items-center justify-center cursor-pointer hover:opacity-70"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onFiltersChange({
                ...filters,
                callDateFrom: null,
                callDateTo: null,
              });
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onFiltersChange({
                  ...filters,
                  callDateFrom: null,
                  callDateTo: null,
                });
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Clear call date"
          >
            <X className="h-4 w-4 pointer-events-none" />
          </div>
        ) : null}
      </Button>
    </div>
  ) : null;

  const callDateSection = showCallDateFilter ? (
    <>
      {callDateFieldsOnly}
      {callDateModal}
    </>
  ) : null;

  const statusSection = (
    <div className="space-y-2">
      <Label>Status</Label>
      <motion.div
        key={`status-${filters.statuses.slice().sort().join("|")}`}
        initial={{ opacity: 0.75, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <StatusFilterButtons
          options={statusOptions}
          selected={filters.statuses}
          onCycle={toggleStatus}
        />
      </motion.div>
    </div>
  );

  const areasSection = (
    <div className="space-y-2">
      <Label>Areas</Label>
      <div className="flex flex-wrap gap-2">
        {areaOptions.map((option) => (
          <motion.div
            key={option.value}
            layout
            initial={false}
            animate={filters.areas.includes(option.value) ? { scale: 1.03 } : { scale: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 26, mass: 0.45 }}
          >
            <Button
              variant={filters.areas.includes(option.value) ? "default" : "outline"}
              size="sm"
              onClick={() => toggleArea(option.value)}
              className="h-8"
            >
              {option.value}
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const assigneesSection =
    assigneeOptions && assigneeOptions.length > 0 ? (
      <div className="space-y-2">
        <Label>Assignees</Label>
        <p className="text-xs text-muted-foreground -mt-1">{assigneeHelpText}</p>
        <div className="flex flex-wrap gap-2">
          {assigneeOptions.map((person) => {
            const selected = filters.assigneeIds.includes(person.id);
            const fullName = `${person.first_name} ${person.last_name}`.trim() || "Member";
            return (
              <motion.div
                key={person.id}
                layout
                initial={false}
                animate={selected ? { scale: 1.04 } : { scale: 1 }}
                transition={{ type: "spring", stiffness: 420, damping: 26, mass: 0.45 }}
              >
                <Button
                  type="button"
                  variant={selected ? "default" : "outline"}
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-full p-0 border-2"
                  aria-pressed={selected}
                  aria-label={
                    selected ? `Remove filter: ${fullName}` : `Filter by assignee: ${fullName}`
                  }
                  title={fullName}
                  onClick={() => toggleAssignee(person.id)}
                >
                  <Avatar className="h-9 w-9 border border-border/60">
                    {person.avatar_url ? <AvatarImage src={person.avatar_url} alt="" /> : null}
                    <AvatarFallback className="text-xs">{getInitialsFromName(fullName)}</AvatarFallback>
                  </Avatar>
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>
    ) : null;

  const clearFiltersButton = (
    <AnimatePresence initial={false} mode="popLayout">
      {hasActiveFilters ? (
        <motion.div
          key="clear-filters-btn"
          layout
          variants={FILTER_SECTION}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          <Button variant="outline" size="sm" onClick={onClearFilters} className="w-full">
            Clear Filters
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <div className="space-y-6">
      <motion.div
        className="flex flex-col gap-6"
        variants={FILTER_STAGGER}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={FILTER_SECTION}>{statusSection}</motion.div>
        <motion.div variants={FILTER_SECTION}>{areasSection}</motion.div>
        {showCallDateFilter ? (
          <motion.div variants={FILTER_SECTION}>{callDateSection}</motion.div>
        ) : null}
        {onDueDateYmdChange != null ? (
          <motion.div variants={FILTER_SECTION}>{dueDateSection}</motion.div>
        ) : null}
        <AnimatePresence initial={false} mode="popLayout">
          {assigneesSection ? (
            <motion.div
              key="assignees-default"
              layout
              variants={FILTER_SECTION}
              initial="hidden"
              animate="show"
              exit="exit"
            >
              {assigneesSection}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>

      {clearFiltersButton}
    </div>
  );
}
