"use client";

import React, { type RefObject } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filter as FilterIcon, Search, User, UserCheck, X } from "lucide-react";
import { getStatusTextColor } from "@/lib/utils/status-hierarchy";
import { cn } from "@/lib/utils";

export type FilterBadge = {
  type: "status" | "area" | "floor";
  value: string;
  label: string;
};

interface FilterControlsProps {
  isSearchActive: boolean;
  searchValue: string;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  onSearchActivate: () => void;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  onSearchBlur: () => void;
  myActive: boolean;
  myLabel: string;
  onMyActivate: () => void;
  onMyClear: () => void;
  filterBadges: FilterBadge[];
  onOpenFilters: () => void;
  onClearFilters: () => void;
  onRemoveBadge: (badge: FilterBadge) => void;
  containerClassName?: string;
  maxWidthClassName?: string;
}

export function FilterControls({
  isSearchActive,
  searchValue,
  searchInputRef,
  onSearchActivate,
  onSearchChange,
  onSearchClear,
  onSearchBlur,
  myActive,
  myLabel,
  onMyActivate,
  onMyClear,
  filterBadges,
  onOpenFilters,
  onClearFilters,
  onRemoveBadge,
  containerClassName,
  maxWidthClassName
}: FilterControlsProps) {
  const hasActiveFilters = filterBadges.length > 0;

  return (
    <AnimatePresence mode="wait">
      {isSearchActive ? (
        <motion.div
          key="search-field"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={cn("flex items-center gap-2 max-w-full px-4 w-full", containerClassName)}
        >
          <div className="relative flex-1">
            <Input
              ref={searchInputRef}
              placeholder="Search ..."
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              onBlur={onSearchBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
                if (e.key === "Escape") {
                  onSearchClear();
                }
              }}
              className="bg-background/95 backdrop-blur-sm border shadow-lg h-9 rounded-full w-full pr-10"
            />
            {searchValue.trim() !== "" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 hover:bg-muted/50 rounded-full"
                onClick={onSearchClear}
                aria-label="Clear search"
              >
                <X className="h-4 w-4 text-foreground" />
              </Button>
            )}
          </div>
        </motion.div>
      ) : hasActiveFilters ? (
        <motion.div
          key="filter-expanded"
          initial={{ width: 36, opacity: 0 }}
          animate={{ width: "auto", opacity: 1 }}
          exit={{ width: 36, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "flex items-center gap-1 max-w-[calc(100vw-3rem)]",
            maxWidthClassName,
            containerClassName
          )}
        >
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-auto min-h-9 rounded-full px-3 py-1.5 flex items-center gap-1.5 max-w-full text-primary-foreground"
            onClick={(e) => {
              const target = e.target as HTMLElement;
              if (!target.closest(".filter-badge") && !target.closest(".filter-x-button")) {
                onOpenFilters();
              }
            }}
            aria-label="Filters"
          >
            <FilterIcon className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
            <span className="text-sm whitespace-nowrap flex-shrink-0 text-primary-foreground">Filters</span>
            <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
              {filterBadges.map((badge, index) => {
                const isRightmost = index >= filterBadges.length - 2 && filterBadges.length > 3;
                const badgeClassName =
                  badge.type === "status"
                    ? cn(
                        "filter-badge h-5 text-xs px-1.5 py-0 cursor-pointer hover:opacity-70 border rounded-full",
                        getStatusTextColor(badge.value),
                        isRightmost ? "max-w-[60px] truncate" : "flex-shrink-0"
                      )
                    : cn(
                        "filter-badge h-5 text-xs px-1.5 py-0 cursor-pointer hover:opacity-70 border rounded-full",
                        "text-muted-foreground border-muted-foreground/50 bg-muted",
                        isRightmost ? "max-w-[60px] truncate" : "flex-shrink-0"
                      );
                return (
                  <Badge
                    key={`${badge.type}-${badge.value}-${index}`}
                    variant="secondary"
                    className={badgeClassName}
                    title={isRightmost ? badge.label : undefined}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveBadge(badge);
                    }}
                  >
                    {badge.label}
                  </Badge>
                );
              })}
            </div>
            <div
              className="filter-x-button h-4 w-4 flex-shrink-0 flex items-center justify-center cursor-pointer hover:opacity-70"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onClearFilters();
              }}
              aria-label="Clear filters"
            >
              <X className="h-4 w-4 text-primary-foreground" />
            </div>
          </Button>
        </motion.div>
      ) : myActive ? (
        <motion.div
          key="my-expanded"
          initial={{ width: 36, opacity: 0 }}
          animate={{ width: "auto", opacity: 1 }}
          exit={{ width: 36, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn("flex items-center gap-1", containerClassName)}
        >
          <Button
            type="button"
            variant="default"
            size="sm"
            className="h-9 rounded-full px-3 flex items-center gap-2 text-primary-foreground"
            onClick={onMyClear}
            aria-label={myLabel}
          >
            <UserCheck className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
            <span className="text-sm whitespace-nowrap text-primary-foreground">{myLabel}</span>
            <X className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
          </Button>
        </motion.div>
      ) : (
        <motion.div
          key="buttons-row"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className={cn("flex items-center gap-3", containerClassName)}
        >
          <motion.div
            key="my-icon"
            initial={{ width: "auto", opacity: 0 }}
            animate={{ width: 36, opacity: 1 }}
            exit={{ width: "auto", opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full flex-shrink-0"
              onClick={onMyActivate}
              aria-pressed={false}
              aria-label={myLabel}
              title={myLabel}
            >
              <User className="h-4 w-4 text-foreground" />
            </Button>
          </motion.div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full flex-shrink-0"
            onClick={onSearchActivate}
            aria-label="Search"
            title="Search"
          >
            <Search className="h-4 w-4 text-foreground" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full flex-shrink-0"
            onClick={onOpenFilters}
            aria-label="Filter"
            title="Filter"
          >
            <FilterIcon className="h-4 w-4 text-foreground" />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
