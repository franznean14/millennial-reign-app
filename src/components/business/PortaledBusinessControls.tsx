"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BusinessTabToggle } from "./BusinessTabToggle";
import { Search, Filter as FilterIcon, User, UserCheck, LayoutGrid, List, Table as TableIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BusinessFiltersState } from "@/lib/db/business";

interface PortaledBusinessControlsProps {
  businessTab: 'establishments' | 'householders' | 'map';
  onBusinessTabChange: (tab: 'establishments' | 'householders' | 'map') => void;
  filters: BusinessFiltersState;
  onFiltersChange: (filters: BusinessFiltersState) => void;
  onOpenFilters: () => void;
  viewMode: 'detailed' | 'compact' | 'table';
  onCycleViewMode: () => void;
  isVisible: boolean;
  onClearSearch: () => void;
  onRemoveStatus: (status: string) => void;
  onRemoveArea: (area: string) => void;
  onClearMyEstablishments: () => void;
  onClearAllFilters: () => void;
  formatStatusLabel: (status: string) => string;
}

export function PortaledBusinessControls({
  businessTab,
  onBusinessTabChange,
  filters,
  onFiltersChange,
  viewMode,
  onCycleViewMode,
  onOpenFilters,
  isVisible,
  onClearSearch,
  onRemoveStatus,
  onRemoveArea,
  onClearMyEstablishments,
  onClearAllFilters,
  formatStatusLabel
}: PortaledBusinessControlsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="fixed left-1/2 transform -translate-x-1/2 z-[100] space-y-3"
          style={{
            top: businessTab === 'map' ? 16 : 64 // top-4 = 16px, top-16 = 64px
          }}
        >
          {/* Tab Navigation */}
          <motion.div 
            className="flex justify-center"
            layout
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30
            }}
          >
            <BusinessTabToggle
              value={businessTab}
              onValueChange={(value) => {
                onBusinessTabChange(value);
                onFiltersChange({ ...filters, statuses: [] });
              }}
              onClearStatusFilters={() => onFiltersChange({ ...filters, statuses: [] })}
              className="w-[26rem] mx-4"
            />
          </motion.div>

          {/* Search Field with Controls */}
          <motion.div 
            className="flex items-center justify-center gap-3 max-w-full px-4"
            layout
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30
            }}
          >
            {/* My Establishments Button - Left */}
            <Button
              type="button"
              variant={filters.myEstablishments ? "default" : "outline"}
              size="icon"
              className="h-9 w-9 rounded-full flex-shrink-0"
              onClick={() => onFiltersChange({ ...filters, myEstablishments: !filters.myEstablishments })}
              aria-pressed={!!filters.myEstablishments}
              aria-label="My establishments"
              title="My establishments"
            >
              {filters.myEstablishments ? <UserCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
            </Button>

            {/* Search Field - Center */}
            <motion.div 
              className="relative"
              animate={{
                width: businessTab === 'map' ? 320 : 256 // w-80 = 320px, w-64 = 256px
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30,
                duration: 0.1
              }}
            >
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search establishments..."
                value={filters.search}
                onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                className="pl-10 bg-background/95 backdrop-blur-sm border shadow-lg w-full"
              />
            </motion.div>

            {/* Filter Button - Right */}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full flex-shrink-0"
              onClick={onOpenFilters}
              title="Filters"
            >
              <FilterIcon className="h-4 w-4" />
            </Button>

            {/* View Toggle - Only for non-map views */}
            <AnimatePresence mode="wait">
              {businessTab !== 'map' && (
                <motion.div
                  key="view-toggle"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 40 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30
                  }}
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 rounded-full flex-shrink-0"
                    onClick={onCycleViewMode}
                    title={`View: ${viewMode}`}
                  >
                    {viewMode === 'detailed' && <LayoutGrid className="h-4 w-4" />}
                    {viewMode === 'compact' && <List className="h-4 w-4" />}
                    {viewMode === 'table' && <TableIcon className="h-4 w-4" />}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Filter Controls */}
          {(filters.search || filters.statuses.length > 0 || filters.areas.length > 0 || filters.myEstablishments) && (
            <motion.div 
              className="flex justify-center"
              layout
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 30
              }}
            >
              <div className="flex flex-wrap items-center gap-2 bg-background/95 backdrop-blur-sm border rounded-lg p-2 shadow-lg max-w-md">
                {filters.search && (
                  <Badge variant="secondary" className="px-2 py-1 text-xs inline-flex items-center gap-1">
                    <span>Search: {filters.search}</span>
                    <button type="button" onClick={onClearSearch} aria-label="Clear search" className="ml-1 rounded hover:bg-muted p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filters.statuses.map((s) => (
                  <Badge key={s} variant="secondary" className="px-2 py-1 text-xs inline-flex items-center gap-1">
                    <span>{formatStatusLabel(s)}</span>
                    <button type="button" onClick={() => onRemoveStatus(s)} aria-label={`Remove ${formatStatusLabel(s)}`} className="ml-1 rounded hover:bg-muted p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {filters.areas.map((a) => (
                  <Badge key={a} variant="secondary" className="px-2 py-1 text-xs inline-flex items-center gap-1">
                    <span>{a}</span>
                    <button type="button" onClick={() => onRemoveArea(a)} aria-label={`Remove ${a}`} className="ml-1 rounded hover:bg-muted p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {filters.myEstablishments && (
                  <Badge variant="secondary" className="px-2 py-1 text-xs inline-flex items-center gap-1">
                    <span>My Establishments</span>
                    <button type="button" onClick={onClearMyEstablishments} aria-label="Remove My Establishments" className="ml-1 rounded hover:bg-muted p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className="px-2 py-1 text-xs inline-flex items-center gap-1 cursor-pointer"
                  onClick={onClearAllFilters}
                >
                  <span>Clear</span>
                  <X className="h-3 w-3" />
                </Badge>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
