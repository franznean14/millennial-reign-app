"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import type { BusinessFiltersState } from "@/lib/db/business";

interface BusinessFiltersFormProps {
  filters: BusinessFiltersState;
  onFiltersChange: (filters: BusinessFiltersState) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  statusOptions: Array<{ value: string; label: string }>;
  areaOptions: Array<{ value: string; label: string }>;
  onClose: () => void;
}

export function BusinessFiltersForm({ 
  filters, 
  onFiltersChange, 
  onClearFilters, 
  hasActiveFilters, 
  statusOptions, 
  areaOptions,
  onClose 
}: BusinessFiltersFormProps) {
  const [localFilters, setLocalFilters] = useState<BusinessFiltersState>(filters);

  // Update local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  // Debounced function to apply filters
  const debouncedApplyFilters = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (newFilters: BusinessFiltersState) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          onFiltersChange(newFilters);
        }, 300); // 300ms delay
      };
    })(),
    [onFiltersChange]
  );

  // Apply filters immediately for non-search fields
  const applyFiltersImmediately = useCallback((newFilters: BusinessFiltersState) => {
    onFiltersChange(newFilters);
  }, [onFiltersChange]);

  const handleClear = () => {
    onClearFilters();
    setLocalFilters({
      search: "",
      statuses: [],
      areas: [],
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

  const handleSearchChange = (searchValue: string) => {
    const newFilters = { ...localFilters, search: searchValue };
    setLocalFilters(newFilters);
    debouncedApplyFilters(newFilters); // Debounced for search
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Search</Label>
          <Input
            placeholder="Search establishments..."
            value={localFilters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            autoFocus
          />
        </div>

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
