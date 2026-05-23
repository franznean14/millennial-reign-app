"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ArrowDownAZ, ArrowUpAZ, ArrowDownWideNarrow, ArrowUpWideNarrow } from "lucide-react";
import { Label } from "@/components/ui/label";
import { StatusFilterButtons } from "@/components/filters/StatusFilterButtons";
import type { BusinessFiltersState } from "@/lib/db/business";
import { cn } from "@/lib/utils";


interface BusinessFiltersFormProps {
  filters: BusinessFiltersState;
  onFiltersChange: (filters: BusinessFiltersState) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  scope: "establishments" | "householders" | "map";
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
  scope,
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
      excludedStatuses: [],
      areas: [],
      floors: [],
      myEstablishments: false,
      nearMe: false,
      userLocation: null
    });
  };
  const filterButtonClass =
    "border-border dark:border-[#1c1921] dark:bg-[#30283c] text-foreground dark:text-[#fffaff] dark:hover:bg-[#3b3348] dark:data-[state=open]:bg-[#3b3348]";
  const activeFilterButtonClass =
    "dark:!bg-[#80778e] dark:!text-white dark:hover:!bg-[#8c839a]";

  const cycleStatus = (status: string) => {
    const selectedStatuses = localFilters.statuses ?? [];
    const excludedStatuses = localFilters.excludedStatuses ?? [];
    const isSelected = selectedStatuses.includes(status);
    const isExcluded = excludedStatuses.includes(status);

    // Cycle order: unselected -> selected -> exclude -> unselected
    if (!isSelected && !isExcluded) {
      const newFilters = {
        ...localFilters,
        statuses: [...selectedStatuses, status],
        excludedStatuses: excludedStatuses.filter((s) => s !== status),
      };
      setLocalFilters(newFilters);
      applyFiltersImmediately(newFilters);
      return;
    }

    if (isSelected) {
      const newFilters = {
        ...localFilters,
        statuses: selectedStatuses.filter((s) => s !== status),
        excludedStatuses: [...excludedStatuses.filter((s) => s !== status), status],
      };
      setLocalFilters(newFilters);
      applyFiltersImmediately(newFilters);
      return;
    }

    const newFilters = {
      ...localFilters,
      statuses: selectedStatuses.filter((s) => s !== status),
      excludedStatuses: excludedStatuses.filter((s) => s !== status),
    };
    setLocalFilters(newFilters);
    applyFiltersImmediately(newFilters);
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
    <div className="space-y-6 pb-[calc(max(env(safe-area-inset-bottom),0px)+40px)] text-foreground dark:text-[#fffaff]">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-muted-foreground dark:text-[#ded6e7]">Status</Label>
          <div className="flex flex-wrap gap-2">
            <StatusFilterButtons
              options={statusOptions}
              selected={localFilters.statuses}
              excluded={localFilters.excludedStatuses ?? []}
              onCycle={cycleStatus}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-muted-foreground dark:text-[#ded6e7]">Areas</Label>
          <div className="flex flex-wrap gap-2">
            {areaOptions.map((option) => (
              <Button
                key={option.value}
                variant={localFilters.areas.includes(option.value) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleArea(option.value)}
                className={cn("h-8", filterButtonClass, localFilters.areas.includes(option.value) && activeFilterButtonClass)}
              >
                {option.value}
              </Button>
            ))}
          </div>
        </div>

        {scope !== "householders" && (
          <div className="space-y-2">
            <Label className="text-muted-foreground dark:text-[#ded6e7]">Floors</Label>
            <div className="flex flex-wrap gap-2">
              {floorOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={localFilters.floors.includes(option.value) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleFloor(option.value)}
                  className={cn("h-8", filterButtonClass, localFilters.floors.includes(option.value) && activeFilterButtonClass)}
                >
                  {option.value}
                </Button>
              ))}
            </div>
          </div>
        )}

        {!isMapView && (
          <div className="space-y-2">
            <Label className="text-muted-foreground dark:text-[#ded6e7]">Sort by</Label>
            {(() => {
              const current = (localFilters.sort as string) || 'last_visit_desc';
              const underscoreIndex = current.lastIndexOf('_');
              const parsedKey = underscoreIndex >= 0 ? (current.slice(0, underscoreIndex)) : 'last_visit';
              const parsedDir = underscoreIndex >= 0 ? (current.slice(underscoreIndex + 1)) : 'desc';
              
              // Ensure key is valid
              const validKeys = ['last_visit', 'name', 'area', 'date_added'] as const;
              const validDirs = ['asc', 'desc'] as const;
              
              const currentKey = validKeys.includes(parsedKey as any) ? parsedKey : 'last_visit';
              const currentDir: 'asc' | 'desc' = validDirs.includes(parsedDir as any) ? (parsedDir as 'asc' | 'desc') : 'desc';
              const currentIsAsc = currentDir === 'asc';
              
              const makeSort = (k: string, d: 'asc'|'desc') => `${k}_${d}` as const;
              
              return (
                <div className="flex items-center gap-2">
                  <Select
                    value={currentKey}
                    onValueChange={(newKey) => {
                      // When changing the sort key, preserve the current direction
                      const newSort = makeSort(newKey, currentDir) as any;
                      const next = { ...localFilters, sort: newSort };
                      setLocalFilters(next);
                      applyFiltersImmediately(next);
                    }}
                  >
                    <SelectTrigger className="min-w-[180px] border-border dark:border-[#1c1921] dark:bg-[#30283c] text-foreground dark:text-[#fffaff]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border dark:border-[#1c1921] dark:bg-[#2a2534] text-foreground dark:text-[#fffaff]">
                      <SelectItem value="last_visit">Last Call</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="area">Area</SelectItem>
                      <SelectItem value="date_added">Date Added</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={filterButtonClass}
                    aria-label={`Toggle ${currentIsAsc ? 'descending' : 'ascending'}`}
                    onClick={() => {
                      // Toggle the direction for the current key
                      const newDir: 'asc' | 'desc' = currentIsAsc ? 'desc' : 'asc';
                      const newSort = makeSort(currentKey, newDir) as any;
                      const next = { ...localFilters, sort: newSort };
                      setLocalFilters(next);
                      applyFiltersImmediately(next);
                    }}
                  >
                    {currentKey === 'name' ? (
                      currentIsAsc ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />
                    ) : (
                      currentIsAsc ? <ArrowUpWideNarrow className="h-4 w-4" /> : <ArrowDownWideNarrow className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={handleClear} className={filterButtonClass}>
          Clear All
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className={filterButtonClass}>
            Cancel
          </Button>
          <Button onClick={onClose} className={activeFilterButtonClass}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
