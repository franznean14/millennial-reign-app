"use client";

import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Search, Filter, X, ChevronDown } from "lucide-react";
import { type EstablishmentStatus } from "@/lib/db/business";

interface MultiSelectProps {
  label: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
  onSelectionChange: (values: string[]) => void;
  placeholder: string;
}

function MultiSelect({ label, options, selectedValues, onSelectionChange, placeholder }: MultiSelectProps) {
  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onSelectionChange(selectedValues.filter(v => v !== value));
    } else {
      onSelectionChange([...selectedValues, value]);
    }
  };

  const handleSelectAll = () => {
    if (selectedValues.length === options.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(options.map(opt => opt.value));
    }
  };

  const displayText = selectedValues.length === 0 
    ? placeholder
    : selectedValues.length === options.length
    ? "All"
    : `${selectedValues.length} selected`;

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            {displayText}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Select {label}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              className="h-auto p-1 text-xs"
            >
              {selectedValues.length === options.length ? "Clear All" : "Select All"}
            </Button>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={selectedValues.includes(option.value)}
              onCheckedChange={() => handleToggle(option.value)}
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

interface BusinessFiltersProps {
  showFilters: boolean;
  filters: {
    search: string;
    statuses: string[];
    areas: string[];
    myEstablishments: boolean;
  };
  onFiltersChange: (filters: any) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  statusOptions: { value: string; label: string }[];
  areaOptions: { value: string; label: string }[];
}

export function BusinessFilters({ 
  showFilters, 
  filters, 
  onFiltersChange, 
  onClearFilters, 
  hasActiveFilters, 
  statusOptions, 
  areaOptions 
}: BusinessFiltersProps) {
  return (
    <AnimatePresence>
      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-4 p-4 border rounded-lg bg-card"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search"
                  value={filters.search}
                  onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Area Filter */}
            <MultiSelect
              label="Area"
              options={areaOptions}
              selectedValues={filters.areas}
              onSelectionChange={(values) => onFiltersChange({ ...filters, areas: values })}
              placeholder="All areas"
            />

            {/* Status Filter */}
            <MultiSelect
              label="Status"
              options={statusOptions}
              selectedValues={filters.statuses}
              onSelectionChange={(values) => onFiltersChange({ ...filters, statuses: values })}
              placeholder="All statuses"
            />

            {/* My Establishments Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="my-establishments"
                checked={filters.myEstablishments}
                onCheckedChange={(checked) => onFiltersChange({ ...filters, myEstablishments: checked })}
              />
              <Label htmlFor="my-establishments" className="text-sm font-medium">
                My Establishments
              </Label>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <Button
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                disabled={!hasActiveFilters}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Clear Filters
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}