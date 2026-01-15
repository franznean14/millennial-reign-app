"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ArrowDownAZ, ArrowUpAZ, ArrowDownWideNarrow, ArrowUpWideNarrow } from "lucide-react";
import { Label } from "@/components/ui/label";
import type { BusinessFiltersState } from "@/lib/db/business";

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
            {statusOptions.map((option) => (
              <Button
                key={option.value}
                variant={localFilters.statuses.includes(option.value) ? "default" : "outline"}
                size="sm"
                onClick={() => toggleStatus(option.value)}
                className="h-8"
              >
                {option.label}
              </Button>
            ))}
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
