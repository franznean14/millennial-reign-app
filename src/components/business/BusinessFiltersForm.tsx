"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ArrowDownAZ, ArrowUpAZ, ArrowDownWideNarrow, ArrowUpWideNarrow } from "lucide-react";
import { Label } from "@/components/ui/label";
import { getStatusTextColor } from "@/lib/utils/status-hierarchy";
import { cn } from "@/lib/utils";
import type { BusinessFiltersState } from "@/lib/db/business";

// Helper function to get faded status color for unselected state
const getFadedStatusColor = (status: string) => {
  switch (status) {
    case 'inappropriate':
      return 'text-red-800/50 border-red-800/30';
    case 'declined_rack':
      return 'text-red-500/50 border-red-500/30';
    case 'for_scouting':
      return 'text-cyan-500/50 border-cyan-500/30';
    case 'for_follow_up':
      return 'text-orange-500/50 border-orange-500/30';
    case 'accepted_rack':
      return 'text-blue-500/50 border-blue-500/30';
    case 'for_replenishment':
      return 'text-purple-500/50 border-purple-500/30';
    case 'has_bible_studies':
      return 'text-emerald-500/50 border-emerald-500/30';
    case 'closed':
      return 'text-slate-500/50 border-slate-500/30';
    // Householder statuses
    case 'potential':
      return 'text-gray-500/50 border-gray-500/30';
    case 'interested':
      return 'text-blue-500/50 border-blue-500/30';
    case 'return_visit':
      return 'text-orange-500/50 border-orange-500/30';
    case 'bible_study':
      return 'text-emerald-500/50 border-emerald-500/30';
    case 'do_not_call':
      return 'text-red-500/50 border-red-500/30';
    default:
      return 'text-gray-500/50 border-gray-500/30';
  }
};

// Helper function to get selected status color (solid outline with faded background)
const getSelectedStatusColor = (status: string) => {
  // Extract color names and create solid border with faded background
  switch (status) {
    case 'inappropriate':
      return 'text-red-800 border-red-800 bg-red-800/5';
    case 'declined_rack':
      return 'text-red-500 border-red-500 bg-red-500/5';
    case 'for_scouting':
      return 'text-cyan-500 border-cyan-500 bg-cyan-500/5';
    case 'for_follow_up':
      return 'text-orange-500 border-orange-500 bg-orange-500/5';
    case 'accepted_rack':
      return 'text-blue-500 border-blue-500 bg-blue-500/5';
    case 'for_replenishment':
      return 'text-purple-500 border-purple-500 bg-purple-500/5';
    case 'has_bible_studies':
      return 'text-emerald-500 border-emerald-500 bg-emerald-500/10';
    case 'closed':
      return 'text-slate-500 border-slate-500 bg-slate-500/5';
    // Householder statuses
    case 'potential':
      return 'text-gray-500 border-gray-500 bg-gray-500/5';
    case 'interested':
      return 'text-blue-500 border-blue-500 bg-blue-500/5';
    case 'return_visit':
      return 'text-orange-500 border-orange-500 bg-orange-500/5';
    case 'bible_study':
      return 'text-emerald-500 border-emerald-500 bg-emerald-500/10';
    case 'do_not_call':
      return 'text-red-500 border-red-500 bg-red-500/5';
    default:
      return 'text-gray-500 border-gray-500 bg-gray-500/5';
  }
};

interface BusinessFiltersFormProps {
  filters: BusinessFiltersState;
  onFiltersChange: (filters: BusinessFiltersState) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  statusOptions: Array<{ value: string; label: string }>;
  areaOptions: Array<{ value: string; label: string }>;
  floorOptions: Array<{ value: string; label: string }>;
  onClose: () => void;
  isMapView?: boolean;
}

export function BusinessFiltersForm({ 
  filters, 
  onFiltersChange, 
  onClearFilters, 
  hasActiveFilters, 
  statusOptions, 
  areaOptions,
  floorOptions,
  onClose,
  isMapView = false
}: BusinessFiltersFormProps) {
  const [localFilters, setLocalFilters] = useState<BusinessFiltersState>(filters);

  // Update local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Apply filters immediately for all fields
  const applyFiltersImmediately = useCallback((newFilters: BusinessFiltersState) => {
    onFiltersChange(newFilters);
  }, [onFiltersChange]);

  const handleClear = () => {
    onClearFilters();
    setLocalFilters({
      search: "",
      statuses: [],
      areas: [],
      floors: [],
      myEstablishments: false
    });
  };

  const toggleStatus = (status: string) => {
    const newFilters = {
      ...localFilters,
      statuses: localFilters.statuses.includes(status) 
        ? localFilters.statuses.filter(s => s !== status)
        : [...localFilters.statuses, status]
    };
    setLocalFilters(newFilters);
    applyFiltersImmediately(newFilters); // Apply immediately for status changes
  };

  const toggleArea = (area: string) => {
    const newFilters = {
      ...localFilters,
      areas: localFilters.areas.includes(area) 
        ? localFilters.areas.filter(a => a !== area)
        : [...localFilters.areas, area]
    };
    setLocalFilters(newFilters);
    applyFiltersImmediately(newFilters); // Apply immediately for area changes
  };

  const toggleFloor = (floor: string) => {
    const newFilters = {
      ...localFilters,
      floors: localFilters.floors.includes(floor) 
        ? localFilters.floors.filter(f => f !== floor)
        : [...localFilters.floors, floor]
    };
    setLocalFilters(newFilters);
    applyFiltersImmediately(newFilters); // Apply immediately for floor changes
  };

  // Search field removed from filters form

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => {
              const isSelected = localFilters.statuses.includes(option.value);
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
                variant={localFilters.areas.includes(option.value) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleArea(option.value)}
                className="h-8"
              >
                {option.value}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Floors</Label>
          <div className="flex flex-wrap gap-2">
            {floorOptions.map((option) => (
              <Button
                key={option.value}
                variant={localFilters.floors.includes(option.value) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleFloor(option.value)}
                className="h-8"
              >
                {option.value}
              </Button>
            ))}
          </div>
        </div>

        {!isMapView && (
          <div className="space-y-2">
            <Label>Sort by</Label>
            {(() => {
              const current = (localFilters.sort as string) || 'last_visit_desc';
              const underscoreIndex = current.lastIndexOf('_');
              const key = underscoreIndex >= 0 ? (current.slice(0, underscoreIndex)) : 'last_visit';
              const dir = underscoreIndex >= 0 ? (current.slice(underscoreIndex + 1)) : 'desc';
              const isAsc = dir === 'asc';
              const makeSort = (k: string, d: 'asc'|'desc') => `${k}_${d}` as const;
              return (
                <div className="flex items-center gap-2">
                  <Select
                    value={key as any}
                    onValueChange={(newKey) => {
                      const next = { ...localFilters, sort: makeSort(newKey, isAsc ? 'asc' : 'desc') as any };
                      setLocalFilters(next);
                      applyFiltersImmediately(next);
                    }}
                  >
                    <SelectTrigger className="min-w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="last_visit">Last Visit</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="area">Area</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label={`Toggle ${isAsc ? 'descending' : 'ascending'}`}
                    onClick={() => {
                      const next = { ...localFilters, sort: makeSort(key, isAsc ? 'desc' : 'asc') as any };
                      setLocalFilters(next);
                      applyFiltersImmediately(next);
                    }}
                  >
                    {key === 'name' ? (
                      isAsc ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />
                    ) : (
                      isAsc ? <ArrowUpWideNarrow className="h-4 w-4" /> : <ArrowDownWideNarrow className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handleClear}>
          Clear All
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
