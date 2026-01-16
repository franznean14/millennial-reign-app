"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getFadedStatusColor, getSelectedStatusColor } from "@/lib/utils/status-filter-styles";

export interface VisitFilters {
  search: string;
  statuses: string[];
  areas: string[];
  myUpdatesOnly: boolean;
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
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => {
              const isSelected = filters.statuses.includes(option.value);
              return (
                <Button
                  key={option.value}
                  variant="outline"
                  size="sm"
                  onClick={() => toggleStatus(option.value)}
                  className={cn(
                    "h-8 border rounded-full",
                    isSelected
                      ? getSelectedStatusColor(option.value)
                      : getFadedStatusColor(option.value)
                  )}
                >
                  {option.label}
                </Button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Areas</Label>
          <div className="flex flex-wrap gap-2">
            {areaOptions.map((option) => (
              <Button
                key={option.value}
                variant={filters.areas.includes(option.value) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleArea(option.value)}
                className="h-8"
              >
                {option.value}
              </Button>
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
