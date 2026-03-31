"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusFilterButtons } from "@/components/filters/StatusFilterButtons";
import { getInitialsFromName } from "@/lib/utils/visit-history-ui";
import { FormModal } from "@/components/shared/FormModal";
import { DateRangeSelectContent } from "@/components/ui/date-range-select-modal";
import { format } from "date-fns";
import { Calendar, X } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

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
  householderOnly: boolean;
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

export function VisitFiltersForm({
  filters,
  statusOptions,
  areaOptions,
  assigneeOptions,
  assigneeHelpText = DEFAULT_ASSIGNEE_HELP,
  showCallDateFilter = false,
  onFiltersChange,
  onClearFilters
}: VisitFiltersFormProps) {
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

  const [callDateModalOpen, setCallDateModalOpen] = useState(false);

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

  const hasActiveFilters =
    filters.statuses.length > 0 ||
    filters.areas.length > 0 ||
    filters.assigneeIds.length > 0 ||
    filters.callDateFrom != null ||
    filters.callDateTo != null;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {showCallDateFilter ? (
          <>
            <div className="space-y-2">
              <Label>Call date</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Include visits on and between these dates.
              </p>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-auto min-h-9 w-fit max-w-md rounded-full px-3 py-1.5 font-normal text-primary-foreground inline-flex items-center gap-1.5 justify-start"
                aria-label={
                  callDateButtonLabel ? `Call date: ${callDateButtonLabel}` : "Select call date or range"
                }
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (target.closest(".call-date-clear")) return;
                  setCallDateModalOpen(true);
                }}
              >
                <Calendar className="h-4 w-4 shrink-0 text-primary-foreground" aria-hidden />
                <span
                  className={cn(
                    "text-sm min-w-0 flex-1 truncate text-left",
                    !callDateButtonLabel && "text-primary-foreground/85"
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
                    <X className="h-4 w-4 text-primary-foreground pointer-events-none" />
                  </div>
                ) : null}
              </Button>
            </div>

            <FormModal
              open={callDateModalOpen}
              onOpenChange={setCallDateModalOpen}
              title="Call date"
              description="Choose a single date or select a range"
              className="sm:max-w-[640px]"
            >
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
            </FormModal>
          </>
        ) : null}

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

        {assigneeOptions && assigneeOptions.length > 0 ? (
          <div className="space-y-2">
            <Label>Assignees</Label>
            <p className="text-xs text-muted-foreground -mt-1">{assigneeHelpText}</p>
            <div className="flex flex-wrap gap-2">
              {assigneeOptions.map((person) => {
                const selected = filters.assigneeIds.includes(person.id);
                const fullName =
                  `${person.first_name} ${person.last_name}`.trim() || "Member";
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
                        selected
                          ? `Remove filter: ${fullName}`
                          : `Filter by assignee: ${fullName}`
                      }
                      title={fullName}
                      onClick={() => toggleAssignee(person.id)}
                    >
                      <Avatar className="h-9 w-9 border border-border/60">
                        {person.avatar_url ? (
                          <AvatarImage src={person.avatar_url} alt="" />
                        ) : null}
                        <AvatarFallback className="text-xs">
                          {getInitialsFromName(fullName)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {hasActiveFilters && (
        <Button
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          className="w-full"
        >
          Clear Filters
        </Button>
      )}
    </div>
  );
}
