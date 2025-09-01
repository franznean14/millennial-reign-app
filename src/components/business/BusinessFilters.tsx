"use client";

import { useState } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Search, X, ChevronDown } from "lucide-react";
import { type BusinessFiltersState } from "@/lib/db/business";

interface BusinessFiltersProps {
  filters: BusinessFiltersState;
  onFiltersChange: (filters: BusinessFiltersState) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  statusOptions: { value: string; label: string; }[];
  areaOptions: { value: string; label: string; }[];
}

export function BusinessFilters({ 
  filters, 
  onFiltersChange, 
  onClearFilters,
  hasActiveFilters,
  statusOptions,
  areaOptions
}: BusinessFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Motion values for drag functionality
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, -100], [1, 0]);
  const yTransform = useTransform(y, [0, -100], [0, -100]);

  const handleDragEnd = (event: any, info: PanInfo) => {
    // For top drawer: dragging up (negative y) should close
    // For bottom drawer: dragging down (positive y) would close
    if (info.offset.y < -50) {
      // Dragged up - close the drawer
      y.set(-100);
      setTimeout(() => setIsExpanded(false), 300);
    } else {
      // Spring back to original position
      y.set(0);
    }
  };

  const handleStatusChange = (statusValue: string, checked: boolean) => {
    if (checked) {
      onFiltersChange({
        ...filters,
        statuses: [...filters.statuses, statusValue]
      });
    } else {
      onFiltersChange({
        ...filters,
        statuses: filters.statuses.filter(s => s !== statusValue)
      });
    }
  };

  const handleAreaChange = (areaValue: string, checked: boolean) => {
    if (checked) {
      onFiltersChange({
        ...filters,
        areas: [...filters.areas, areaValue]
      });
    } else {
      onFiltersChange({
        ...filters,
        areas: filters.areas.filter(a => a !== areaValue)
      });
    }
  };

  return (
    <div className="w-full">
      {/* Search Field - Always visible */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search establishments..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-10"
          onFocus={() => setIsExpanded(true)}
        />
      </div>

      {/* Expanded Filters Drawer */}
      <AnimatePresence>
        {isExpanded && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => setIsExpanded(false)}
            />
            
            {/* Drawer */}
            <motion.div
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              transition={{ 
                type: "spring",
                damping: 25,
                stiffness: 300
              }}
              style={{ 
                y: yTransform, 
                opacity,
                maxHeight: '80vh',
                overflowY: 'auto'
              }}
              drag="y"
              dragConstraints={{ top: -100, bottom: 0 }}
              dragElastic={0.1}
              onDragEnd={handleDragEnd}
              className="fixed top-0 left-0 right-0 z-50 bg-background border-b shadow-lg touch-none"
            >
              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Search Field */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search establishments..."
                      value={filters.search}
                      onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {filters.statuses.length === 0 ? "All Statuses" : `${filters.statuses.length} selected`}
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuLabel>Select Statuses</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {statusOptions.map((status) => (
                        <DropdownMenuCheckboxItem
                          key={status.value}
                          checked={filters.statuses.includes(status.value)}
                          onCheckedChange={(checked) => handleStatusChange(status.value, checked)}
                          onSelect={(e) => e.preventDefault()}
                        >
                          {status.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Area Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Area</label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {filters.areas.length === 0 ? "All Areas" : `${filters.areas.length} selected`}
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuLabel>Select Areas</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {areaOptions.map((area) => (
                        <DropdownMenuCheckboxItem
                          key={area.value}
                          checked={filters.areas.includes(area.value)}
                          onCheckedChange={(checked) => handleAreaChange(area.value, checked)}
                          onSelect={(e) => e.preventDefault()}
                        >
                          {area.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* My Establishments Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">My Establishments</Label>
                    <p className="text-xs text-muted-foreground">Show only establishments I've visited</p>
                  </div>
                  <Switch
                    checked={filters.myEstablishments}
                    onCheckedChange={(checked) => onFiltersChange({ ...filters, myEstablishments: checked })}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={onClearFilters}
                    className="flex-1"
                  >
                    Clear All
                  </Button>
                  <Button 
                    onClick={() => setIsExpanded(false)}
                    className="flex-1"
                  >
                    Done
                  </Button>
                </div>
              </div>

              {/* Handlebar at the bottom for dragging up to close */}
              <div className="mx-auto mb-4 h-2 w-[100px] rounded-full bg-muted" />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}