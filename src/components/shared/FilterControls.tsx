"use client";

import React, { type RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filter as FilterIcon, Search, User, UserCheck, X, Building2, Home } from "lucide-react";
import { getStatusTextColor } from "@/lib/utils/status-hierarchy";
import { getExcludeFilterBadgeClass } from "@/lib/utils/status-filter-styles";
import { cn } from "@/lib/utils";
import type { FilterBadge } from "@/lib/utils/filter-badges";

export type { FilterBadge } from "@/lib/utils/filter-badges";

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
  bwiActive?: boolean;
  bwiLabel?: string;
  onBwiActivate?: () => void;
  onBwiClear?: () => void;
  householderActive?: boolean;
  householderLabel?: string;
  onHouseholderActivate?: () => void;
  onHouseholderClear?: () => void;
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
  bwiActive = false,
  bwiLabel = "BWI Only",
  onBwiActivate,
  onBwiClear,
  householderActive = false,
  householderLabel = "Personal Contacts Only",
  onHouseholderActivate,
  onHouseholderClear,
  filterBadges,
  onOpenFilters,
  onClearFilters,
  onRemoveBadge,
  containerClassName,
  maxWidthClassName
}: FilterControlsProps) {
  const hasActiveFilters = filterBadges.length > 0;

  return (
    <>
      {isSearchActive ? (
        <div
          className={cn(
            "flex items-center gap-2 w-full",
            containerClassName?.includes("!max-w-none") ? "" : "max-w-full",
            containerClassName?.includes("!px-0") ? "" : "px-4",
            containerClassName
          )}
        >
          <div className="relative flex-1 w-full">
            <Input
              ref={searchInputRef}
              placeholder="Search ..."
              value={searchValue}
              onChange={(e) => {
                onSearchChange(e.target.value);
              }}
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
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
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
        </div>
      ) : hasActiveFilters ? (
        <div
          style={{ position: "relative" }}
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
                    : badge.type === "exclude_personal_territory"
                      ? cn(
                          "filter-badge h-5 text-xs px-1.5 py-0 cursor-pointer hover:opacity-70",
                          getExcludeFilterBadgeClass(),
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
        </div>
      ) : myActive || bwiActive || householderActive ? (
        <div
          className={cn("flex items-center gap-1", containerClassName)}
        >
          {myActive && (
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
          )}
          {(bwiActive || householderActive) && onBwiActivate && (
            <Button
              type="button"
              variant={householderActive ? "outline" : "default"}
              size="sm"
              className={cn(
                "h-9 rounded-full flex items-center gap-2",
                householderActive ? "px-2" : "px-3"
              )}
              onClick={householderActive ? onBwiActivate : onBwiClear}
              aria-label={bwiLabel}
            >
              <Building2 className={cn(
                "h-4 w-4 flex-shrink-0",
                householderActive ? "text-foreground" : "text-primary-foreground"
              )} />
              {!householderActive && (
                <>
                  <span className="text-sm whitespace-nowrap text-primary-foreground">{bwiLabel}</span>
                  <X className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
                </>
              )}
            </Button>
          )}
          {(bwiActive || householderActive) && onHouseholderActivate && !householderActive && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full flex-shrink-0"
              onClick={onHouseholderActivate}
              aria-label={householderLabel}
              title={householderLabel}
            >
              <Home className="h-4 w-4 text-foreground" />
            </Button>
          )}
          {householderActive && onHouseholderClear && (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-9 rounded-full px-3 flex items-center gap-2 text-primary-foreground"
              onClick={onHouseholderClear}
              aria-label={householderLabel}
            >
              <Home className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
              <span className="text-sm whitespace-nowrap text-primary-foreground">{householderLabel}</span>
              <X className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
            </Button>
          )}
        </div>
      ) : (
        <div
          style={{ position: "relative" }}
          className={cn("flex items-center gap-3", containerClassName)}
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
          {onBwiActivate && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-full flex-shrink-0"
              onClick={onBwiActivate}
              aria-pressed={false}
              aria-label={bwiLabel}
              title={bwiLabel}
            >
              <Building2 className="h-4 w-4 text-foreground" />
            </Button>
          )}
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
        </div>
      )}
    </>
  );
}
