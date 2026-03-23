"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StatusFilterButtons } from "@/components/filters/StatusFilterButtons";
import { motion } from "motion/react";

export interface VisitFilters {
  search: string;
  statuses: string[];
  areas: string[];
  myUpdatesOnly: boolean;
  bwiOnly: boolean;
  householderOnly: boolean;
}

export interface VisitFilterOption {
  value: string;
  label: string;
}

interface VisitFiltersFormProps {
  filters: VisitFilters;
  statusOptions: VisitFilterOption[];
  areaOptions: VisitFilterOption[];
  onFiltersChange: (filters: VisitFilters) => void;
  onClearFilters: () => void;
}

export function VisitFiltersForm({
  filters,
  statusOptions,
  areaOptions,
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

  const hasActiveFilters = filters.statuses.length > 0 || filters.areas.length > 0;

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
