"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { StatusFilterButtons } from "@/components/filters/StatusFilterButtons";
import { getInitialsFromName } from "@/lib/utils/visit-history-ui";
import { motion } from "motion/react";

export interface VisitFilters {
  search: string;
  statuses: string[];
  areas: string[];
  /** User ids (publishers/partners) — to-do matches if either assignee is selected. */
  assigneeIds: string[];
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
  onFiltersChange: (filters: VisitFilters) => void;
  onClearFilters: () => void;
}

export function VisitFiltersForm({
  filters,
  statusOptions,
  areaOptions,
  assigneeOptions,
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

  const hasActiveFilters =
    filters.statuses.length > 0 || filters.areas.length > 0 || filters.assigneeIds.length > 0;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
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
            <p className="text-xs text-muted-foreground -mt-1">
              Show to-dos where this publisher or partner is assigned.
            </p>
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
