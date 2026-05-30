"use client";

import React, { type ReactNode, type RefObject } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitialsFromName } from "@/lib/utils/visit-history-ui";
import { Filter as FilterIcon, SquarePen, Search, User, UserCheck, Users, X, Building2, ListTodo, Crosshair } from "lucide-react";
import { getStatusTextColor } from "@/lib/utils/status-hierarchy";
import { cn } from "@/lib/utils";
import { studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";
import type { FilterBadge } from "@/lib/utils/filter-badges";

export type { FilterBadge } from "@/lib/utils/filter-badges";

const filterToolbarSpring = {
  type: "spring" as const,
  stiffness: 420,
  damping: 34,
  mass: 0.85,
};

const filterToolbarPop = {
  initial: { opacity: 0, scale: 0.9, x: -10 },
  animate: { opacity: 1, scale: 1, x: 0 },
  exit: { opacity: 0, scale: 0.9, x: -10 },
  transition: filterToolbarSpring,
};

function FilterToolbarMotionShell({
  show,
  layoutId,
  children,
}: {
  show: boolean;
  layoutId: string;
  children: ReactNode;
}) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {show ? (
        <motion.div
          key={layoutId}
          layout
          layoutId={layoutId}
          className="shrink-0"
          {...filterToolbarPop}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function FilterToolbarTogglePair({
  active,
  layoutId,
  activeChild,
  inactiveChild,
}: {
  active: boolean;
  layoutId: string;
  activeChild: ReactNode;
  inactiveChild: ReactNode;
}) {
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {active ? (
        <motion.div
          key={`${layoutId}-on`}
          layout
          layoutId={layoutId}
          className="shrink-0"
          {...filterToolbarPop}
        >
          {activeChild}
        </motion.div>
      ) : (
        <motion.div
          key={`${layoutId}-off`}
          layout
          layoutId={layoutId}
          className="shrink-0"
          {...filterToolbarPop}
        >
          {inactiveChild}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface FilterControlsProps {
  isSearchActive: boolean;
  searchValue: string;
  searchInputRef?: RefObject<HTMLInputElement | null>;
  onSearchActivate: () => void;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  onSearchBlur: () => void;
  myActive?: boolean;
  myLabel?: string;
  onMyActivate?: () => void;
  onMyClear?: () => void;
  showMyFilter?: boolean;
  bwiActive?: boolean;
  bwiLabel?: string;
  onBwiActivate?: () => void;
  onBwiClear?: () => void;
  householderActive?: boolean;
  householderLabel?: string;
  onHouseholderActivate?: () => void;
  onHouseholderClear?: () => void;
  showTodoFilter?: boolean;
  todosActive?: boolean;
  todosLabel?: string;
  todosTitle?: string;
  onTodosActivate?: () => void;
  onTodosClear?: () => void;
  showNearMeFilter?: boolean;
  nearMeActive?: boolean;
  onNearMeToggle?: () => void;
  filterBadges: FilterBadge[];
  onOpenFilters: () => void;
  onClearFilters: () => void;
  onRemoveBadge: (badge: FilterBadge) => void;
  containerClassName?: string;
  maxWidthClassName?: string;
  preserveActionButtonsWhenTogglesActive?: boolean;
  showEditButton?: boolean;
  editLabel?: string;
  onEditClick?: () => void;
  trailingActions?: ReactNode;
}

export function FilterControls({
  isSearchActive,
  searchValue,
  searchInputRef,
  onSearchActivate,
  onSearchChange,
  onSearchClear,
  onSearchBlur,
  myActive = false,
  myLabel = "My Items",
  onMyActivate,
  onMyClear,
  showMyFilter = true,
  bwiActive = false,
  bwiLabel = "BWI Only",
  onBwiActivate,
  onBwiClear,
  householderActive = false,
  householderLabel = "Personal Contacts Only",
  onHouseholderActivate,
  onHouseholderClear,
  showTodoFilter = false,
  todosActive = false,
  todosLabel = "My To-Dos",
  todosTitle,
  onTodosActivate,
  onTodosClear,
  showNearMeFilter = false,
  nearMeActive = false,
  onNearMeToggle,
  filterBadges,
  onOpenFilters,
  onClearFilters,
  onRemoveBadge,
  containerClassName,
  maxWidthClassName,
  preserveActionButtonsWhenTogglesActive = false,
  showEditButton = false,
  editLabel = "Edit",
  onEditClick,
  trailingActions
}: FilterControlsProps) {
  const hasActiveFilters = filterBadges.length > 0;
  const toolbarAllowsHorizontalOverflow = preserveActionButtonsWhenTogglesActive;
  const toolbarGapClass = "gap-3";
  const filterIconButtonClass = cn(
    "h-9 w-9 rounded-full flex-shrink-0 shadow-none border",
    studyBibleDarkClasses.filterToolbarButton
  );
  const filterPillActiveClass = cn(
    "shadow-none border",
    studyBibleDarkClasses.filterToolbarButtonActive
  );
  const searchInputClass =
    "border-[#e2dde8] !bg-[#ece8f2] text-[#1a1820] placeholder:text-[#8e89a3] dark:border-[#1c1921] dark:!bg-[#3b3348] dark:text-[#fffaff] dark:placeholder:text-[#ded6e7]/70";

  const toolbarRowClassName = cn(
    "flex items-center flex-nowrap",
    toolbarGapClass,
    "w-max shrink-0",
    maxWidthClassName,
    containerClassName
  );

  const filtersMegaButton = (
    <FilterToolbarMotionShell show={hasActiveFilters} layoutId="filter-toolbar-filters-mega">
      <Button
        type="button"
        variant="default"
        size="sm"
        className={cn(
          "h-auto min-h-9 rounded-full px-3 py-1.5 flex items-center gap-1.5 shrink-0 max-w-none text-primary-foreground",
          filterPillActiveClass
        )}
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
        <div className="flex items-center gap-1 flex-nowrap shrink-0">
          <AnimatePresence mode="popLayout" initial={false}>
            {filterBadges.map((badge) => {
              const badgeKey = `${badge.type}-${badge.value}`;
              if (badge.type === "assignee") {
                return (
                  <motion.div
                    key={badgeKey}
                    layout
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={filterToolbarSpring}
                    className="shrink-0"
                  >
                    <Badge
                      variant="secondary"
                      className="filter-badge h-6 w-6 shrink-0 p-0 rounded-full cursor-pointer hover:opacity-70 overflow-hidden border border-primary-foreground/25"
                      title={badge.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveBadge(badge);
                      }}
                    >
                      <Avatar className="h-6 w-6 rounded-full">
                        {badge.avatarUrl ? (
                          <AvatarImage src={badge.avatarUrl} alt="" className="object-cover" />
                        ) : null}
                        <AvatarFallback className="rounded-full text-[8px] bg-muted text-foreground">
                          {getInitialsFromName(badge.label)}
                        </AvatarFallback>
                      </Avatar>
                    </Badge>
                  </motion.div>
                );
              }
              const badgeClassName =
                badge.type === "status"
                  ? cn(
                      "filter-badge h-5 text-xs px-1.5 py-0 cursor-pointer hover:opacity-70 border rounded-full flex-shrink-0",
                      getStatusTextColor(badge.value)
                    )
                  : badge.type === "excluded_status"
                    ? cn(
                        "filter-badge h-5 text-xs px-1.5 py-0 cursor-pointer hover:opacity-70 border rounded-full line-through decoration-2 flex-shrink-0",
                        getStatusTextColor(badge.value)
                      )
                    : cn(
                        "filter-badge h-5 text-xs px-1.5 py-0 cursor-pointer hover:opacity-70 border rounded-full flex-shrink-0",
                        "text-muted-foreground border-muted-foreground/50 bg-muted"
                      );
              return (
                <motion.div
                  key={badgeKey}
                  layout
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={filterToolbarSpring}
                  className="shrink-0"
                >
                  <Badge
                    variant="secondary"
                    className={badgeClassName}
                    title={badge.label}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveBadge(badge);
                    }}
                  >
                    {badge.label}
                  </Badge>
                </motion.div>
              );
            })}
          </AnimatePresence>
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
    </FilterToolbarMotionShell>
  );

  const myActivePill = (
    <Button
      type="button"
      variant="default"
      size="sm"
      className={cn("h-9 rounded-full px-3 flex items-center gap-2 text-primary-foreground", filterPillActiveClass)}
      onClick={onMyClear}
      aria-label={myLabel}
    >
      <UserCheck className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
      <span className="text-sm whitespace-nowrap text-primary-foreground">{myLabel}</span>
      <X className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
    </Button>
  );
  const myInactiveIcon = (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      className={filterIconButtonClass}
      onClick={onMyActivate}
      aria-pressed={false}
      aria-label={myLabel}
      title={myLabel}
    >
      <User className="h-4 w-4 text-foreground" />
    </Button>
  );
  const todosActivePill = (
    <Button
      type="button"
      variant="default"
      size="sm"
      className={cn("h-9 rounded-full px-3 flex items-center gap-2 text-primary-foreground", filterPillActiveClass)}
      onClick={onTodosClear}
      aria-label={todosLabel}
    >
      <ListTodo className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
      <span className="text-sm whitespace-nowrap text-primary-foreground">{todosLabel}</span>
      <X className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
    </Button>
  );
  const todosTooltip = todosTitle ?? todosLabel;
  const todosInactiveIcon = (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      className={filterIconButtonClass}
      onClick={onTodosActivate}
      aria-pressed={false}
      aria-label={todosLabel}
      title={todosTooltip}
    >
      <ListTodo className="h-4 w-4 text-foreground" />
    </Button>
  );
  const nearMeActivePill = (
    <Button
      type="button"
      variant="default"
      size="sm"
      className={cn("h-9 rounded-full px-3 flex items-center gap-2 flex-shrink-0 text-primary-foreground", filterPillActiveClass)}
      onClick={onNearMeToggle}
      aria-label="Near me"
    >
      <Crosshair className="h-4 w-4 flex-shrink-0" />
      <span className="text-sm whitespace-nowrap">Near Me</span>
      <X className="h-4 w-4 flex-shrink-0" />
    </Button>
  );
  const nearMeInactiveIcon = (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      className={filterIconButtonClass}
      onClick={onNearMeToggle}
      aria-pressed={false}
      aria-label="Near me"
      title="Near me"
    >
      <Crosshair className="h-4 w-4" />
    </Button>
  );

  const businessToolbar = toolbarAllowsHorizontalOverflow ? (
    <motion.div
      layout
      style={{ position: "relative" }}
      className={toolbarRowClassName}
      transition={filterToolbarSpring}
    >
      {showMyFilter && onMyActivate && onMyClear ? (
        <FilterToolbarTogglePair
          active={myActive}
          layoutId="filter-toolbar-my"
          activeChild={myActivePill}
          inactiveChild={myInactiveIcon}
        />
      ) : null}
      <FilterToolbarMotionShell
        show={!!(bwiActive && !householderActive && onBwiClear)}
        layoutId="filter-toolbar-bwi-active"
      >
        <Button
          type="button"
          variant="default"
          size="sm"
          className={cn("h-9 rounded-full px-3 flex items-center gap-2 text-primary-foreground", filterPillActiveClass)}
          onClick={onBwiClear}
          aria-label={bwiLabel}
        >
          <Building2 className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
          <span className="text-sm whitespace-nowrap text-primary-foreground">{bwiLabel}</span>
          <X className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
        </Button>
      </FilterToolbarMotionShell>
      <FilterToolbarMotionShell
        show={!!(householderActive && onHouseholderClear)}
        layoutId="filter-toolbar-householder-active"
      >
        <Button
          type="button"
          variant="default"
          size="sm"
          className={cn("h-9 rounded-full px-3 flex items-center gap-2 text-primary-foreground", filterPillActiveClass)}
          onClick={onHouseholderClear}
          aria-label={householderLabel}
        >
          <Users className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
          <span className="text-sm whitespace-nowrap text-primary-foreground">{householderLabel}</span>
          <X className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
        </Button>
      </FilterToolbarMotionShell>
      {showTodoFilter && onTodosActivate && onTodosClear ? (
        <FilterToolbarTogglePair
          active={todosActive}
          layoutId="filter-toolbar-todos"
          activeChild={todosActivePill}
          inactiveChild={todosInactiveIcon}
        />
      ) : null}
      {showNearMeFilter && onNearMeToggle ? (
        <FilterToolbarTogglePair
          active={nearMeActive}
          layoutId="filter-toolbar-near-me"
          activeChild={nearMeActivePill}
          inactiveChild={nearMeInactiveIcon}
        />
      ) : null}
      {filtersMegaButton}
      <FilterToolbarMotionShell
        show={!bwiActive && !householderActive && !!onBwiActivate}
        layoutId="filter-toolbar-bwi-inactive"
      >
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={filterIconButtonClass}
          onClick={onBwiActivate}
          aria-pressed={false}
          aria-label={bwiLabel}
          title={bwiLabel}
        >
          <Building2 className="h-4 w-4 text-foreground" />
        </Button>
      </FilterToolbarMotionShell>
      <FilterToolbarMotionShell
        show={!!((bwiActive || householderActive) && onHouseholderActivate && !householderActive)}
        layoutId="filter-toolbar-householder-inactive"
      >
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={filterIconButtonClass}
          onClick={onHouseholderActivate}
          aria-label={householderLabel}
          title={householderLabel}
        >
          <Users className="h-4 w-4 text-foreground" />
        </Button>
      </FilterToolbarMotionShell>
      <FilterToolbarMotionShell
        show={!!(householderActive && onBwiActivate)}
        layoutId="filter-toolbar-bwi-companion"
      >
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={filterIconButtonClass}
          onClick={onBwiActivate}
          aria-label={bwiLabel}
          title={bwiLabel}
        >
          <Building2 className="h-4 w-4 text-foreground" />
        </Button>
      </FilterToolbarMotionShell>
      <motion.div layout className="shrink-0" transition={filterToolbarSpring}>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={filterIconButtonClass}
          onClick={onSearchActivate}
          aria-label="Search"
          title="Search"
        >
          <Search className="h-4 w-4 text-foreground" />
        </Button>
      </motion.div>
      <motion.div layout className="shrink-0" transition={filterToolbarSpring}>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={filterIconButtonClass}
          onClick={onOpenFilters}
          aria-label="Filter"
          title="Filter"
        >
          <FilterIcon className="h-4 w-4 text-foreground" />
        </Button>
      </motion.div>
      <FilterToolbarMotionShell show={!!(showEditButton && onEditClick)} layoutId="filter-toolbar-edit">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className={filterIconButtonClass}
          onClick={onEditClick}
          aria-label={editLabel}
          title={editLabel}
        >
          <SquarePen className="h-4 w-4 text-foreground" />
        </Button>
      </FilterToolbarMotionShell>
      <FilterToolbarMotionShell show={!!trailingActions} layoutId="filter-toolbar-trailing">
        {trailingActions}
      </FilterToolbarMotionShell>
    </motion.div>
  ) : null;

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
              className={cn("bg-background/95 backdrop-blur-sm border shadow-lg h-9 rounded-full w-full pr-10", searchInputClass)}
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
      ) : businessToolbar ? (
        businessToolbar
      ) : hasActiveFilters ? (
        <div
          style={{ position: "relative" }}
          className={cn(
            "flex items-center flex-nowrap",
            toolbarGapClass,
            toolbarAllowsHorizontalOverflow ? "w-max shrink-0" : "max-w-[calc(100vw-3rem)]",
            maxWidthClassName,
            containerClassName
          )}
        >
          <Button
            type="button"
            variant="default"
            size="sm"
            className={cn(
              "h-auto min-h-9 rounded-full px-3 py-1.5 flex items-center gap-1.5 shrink-0 text-primary-foreground",
              toolbarAllowsHorizontalOverflow ? "max-w-none" : "max-w-full",
              filterPillActiveClass
            )}
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
            <div
              className={cn(
                "flex items-center gap-1",
                toolbarAllowsHorizontalOverflow
                  ? "flex-nowrap shrink-0"
                  : "min-w-0 flex-1 overflow-hidden"
              )}
            >
              {filterBadges.map((badge, index) => {
                const isRightmost =
                  !toolbarAllowsHorizontalOverflow &&
                  index >= filterBadges.length - 2 &&
                  filterBadges.length > 3;
                if (badge.type === "assignee") {
                  return (
                    <Badge
                      key={`assignee-${badge.value}-${index}`}
                      variant="secondary"
                      className="filter-badge h-6 w-6 shrink-0 p-0 rounded-full cursor-pointer hover:opacity-70 overflow-hidden border border-primary-foreground/25"
                      title={badge.label}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveBadge(badge);
                      }}
                    >
                      <Avatar className="h-6 w-6 rounded-full">
                        {badge.avatarUrl ? (
                          <AvatarImage src={badge.avatarUrl} alt="" className="object-cover" />
                        ) : null}
                        <AvatarFallback className="rounded-full text-[8px] bg-muted text-foreground">
                          {getInitialsFromName(badge.label)}
                        </AvatarFallback>
                      </Avatar>
                    </Badge>
                  );
                }
                const badgeClassName =
                  badge.type === "status"
                    ? cn(
                        "filter-badge h-5 text-xs px-1.5 py-0 cursor-pointer hover:opacity-70 border rounded-full",
                        getStatusTextColor(badge.value),
                        isRightmost ? "max-w-[60px] truncate" : "flex-shrink-0"
                      )
                    : badge.type === "excluded_status"
                      ? cn(
                          "filter-badge h-5 text-xs px-1.5 py-0 cursor-pointer hover:opacity-70 border rounded-full line-through decoration-2",
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
          {preserveActionButtonsWhenTogglesActive && showMyFilter && myActive && onMyClear && (
            <Button
              type="button"
              variant="default"
              size="sm"
              className={cn("h-9 rounded-full px-3 flex items-center gap-2 text-primary-foreground", filterPillActiveClass)}
              onClick={onMyClear}
              aria-label={myLabel}
            >
              <UserCheck className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
              <span className="text-sm whitespace-nowrap text-primary-foreground">{myLabel}</span>
              <X className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
            </Button>
          )}
          {preserveActionButtonsWhenTogglesActive && showMyFilter && !myActive && onMyActivate && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={filterIconButtonClass}
              onClick={onMyActivate}
              aria-pressed={false}
              aria-label={myLabel}
              title={myLabel}
            >
              <User className="h-4 w-4 text-foreground" />
            </Button>
          )}
          {preserveActionButtonsWhenTogglesActive && (bwiActive || householderActive) && onBwiActivate && (
            <Button
              type="button"
              variant={householderActive ? "secondary" : "default"}
              size="sm"
              className={cn(
                "h-9 rounded-full flex items-center gap-2",
                householderActive ? "px-2" : "px-3",
                householderActive ? cn("shadow-none border", studyBibleDarkClasses.filterToolbarButton) : filterPillActiveClass
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
          {preserveActionButtonsWhenTogglesActive && (bwiActive || householderActive) && onHouseholderActivate && !householderActive && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={filterIconButtonClass}
              onClick={onHouseholderActivate}
              aria-label={householderLabel}
              title={householderLabel}
            >
              <Users className="h-4 w-4 text-foreground" />
            </Button>
          )}
          {preserveActionButtonsWhenTogglesActive && householderActive && onHouseholderClear && (
            <Button
              type="button"
              variant="default"
              size="sm"
              className={cn("h-9 rounded-full px-3 flex items-center gap-2 text-primary-foreground", filterPillActiveClass)}
              onClick={onHouseholderClear}
              aria-label={householderLabel}
            >
              <Users className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
              <span className="text-sm whitespace-nowrap text-primary-foreground">{householderLabel}</span>
              <X className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
            </Button>
          )}
          {preserveActionButtonsWhenTogglesActive && showTodoFilter && todosActive && onTodosClear && (
            <Button
              type="button"
              variant="default"
              size="sm"
              className={cn("h-9 rounded-full px-3 flex items-center gap-2 text-primary-foreground", filterPillActiveClass)}
              onClick={onTodosClear}
              aria-label={todosLabel}
            >
              <ListTodo className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
              <span className="text-sm whitespace-nowrap text-primary-foreground">{todosLabel}</span>
              <X className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
            </Button>
          )}
          {preserveActionButtonsWhenTogglesActive && showTodoFilter && !todosActive && onTodosActivate && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={filterIconButtonClass}
              onClick={onTodosActivate}
              aria-pressed={false}
              aria-label={todosLabel}
              title={todosTooltip}
            >
              <ListTodo className="h-4 w-4 text-foreground" />
            </Button>
          )}
          {preserveActionButtonsWhenTogglesActive && !bwiActive && !householderActive && onBwiActivate && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={filterIconButtonClass}
              onClick={onBwiActivate}
              aria-pressed={false}
              aria-label={bwiLabel}
              title={bwiLabel}
            >
              <Building2 className="h-4 w-4 text-foreground" />
            </Button>
          )}
          {preserveActionButtonsWhenTogglesActive && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={filterIconButtonClass}
              onClick={onSearchActivate}
              aria-label="Search"
              title="Search"
            >
              <Search className="h-4 w-4 text-foreground" />
            </Button>
          )}
          {preserveActionButtonsWhenTogglesActive && showEditButton && onEditClick && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={filterIconButtonClass}
              onClick={onEditClick}
              aria-label={editLabel}
              title={editLabel}
            >
              <SquarePen className="h-4 w-4 text-foreground" />
            </Button>
          )}
          {trailingActions}
        </div>
      ) : (showMyFilter && myActive) || bwiActive || householderActive || (showTodoFilter && todosActive) ? (
        <div
          className={cn(
            "flex items-center flex-nowrap",
            toolbarGapClass,
            toolbarAllowsHorizontalOverflow ? "w-max shrink-0" : "",
            containerClassName
          )}
        >
          {showMyFilter && myActive && onMyClear && (
            <Button
              type="button"
              variant="default"
              size="sm"
              className={cn("h-9 rounded-full px-3 flex items-center gap-2 text-primary-foreground", filterPillActiveClass)}
              onClick={onMyClear}
              aria-label={myLabel}
            >
              <UserCheck className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
              <span className="text-sm whitespace-nowrap text-primary-foreground">{myLabel}</span>
              <X className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
            </Button>
          )}
          {showMyFilter && !myActive && onMyActivate && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={filterIconButtonClass}
              onClick={onMyActivate}
              aria-pressed={false}
              aria-label={myLabel}
              title={myLabel}
            >
              <User className="h-4 w-4 text-foreground" />
            </Button>
          )}
          {(bwiActive || householderActive) && onBwiActivate && (
            <Button
              type="button"
              variant={householderActive ? "secondary" : "default"}
              size="sm"
              className={cn(
                "h-9 rounded-full flex items-center gap-2",
                householderActive ? "px-2" : "px-3",
                householderActive ? cn("shadow-none border", studyBibleDarkClasses.filterToolbarButton) : filterPillActiveClass
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
              variant="secondary"
              size="icon"
              className={filterIconButtonClass}
              onClick={onHouseholderActivate}
              aria-label={householderLabel}
              title={householderLabel}
            >
              <Users className="h-4 w-4 text-foreground" />
            </Button>
          )}
          {householderActive && onHouseholderClear && (
            <Button
              type="button"
              variant="default"
              size="sm"
              className={cn("h-9 rounded-full px-3 flex items-center gap-2 text-primary-foreground", filterPillActiveClass)}
              onClick={onHouseholderClear}
              aria-label={householderLabel}
            >
              <Users className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
              <span className="text-sm whitespace-nowrap text-primary-foreground">{householderLabel}</span>
              <X className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
            </Button>
          )}
          {showTodoFilter && todosActive && onTodosClear && (
            <Button
              type="button"
              variant="default"
              size="sm"
              className={cn("h-9 rounded-full px-3 flex items-center gap-2 text-primary-foreground", filterPillActiveClass)}
              onClick={onTodosClear}
              aria-label={todosLabel}
            >
              <ListTodo className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
              <span className="text-sm whitespace-nowrap text-primary-foreground">{todosLabel}</span>
              <X className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
            </Button>
          )}
          {preserveActionButtonsWhenTogglesActive && !bwiActive && !householderActive && onBwiActivate && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={filterIconButtonClass}
              onClick={onBwiActivate}
              aria-pressed={false}
              aria-label={bwiLabel}
              title={bwiLabel}
            >
              <Building2 className="h-4 w-4 text-foreground" />
            </Button>
          )}
          {preserveActionButtonsWhenTogglesActive && (
            <>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className={filterIconButtonClass}
                onClick={onSearchActivate}
                aria-label="Search"
                title="Search"
              >
                <Search className="h-4 w-4 text-foreground" />
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className={filterIconButtonClass}
                onClick={onOpenFilters}
                aria-label="Filter"
                title="Filter"
              >
                <FilterIcon className="h-4 w-4 text-foreground" />
              </Button>
              {showTodoFilter && !todosActive && onTodosActivate && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className={filterIconButtonClass}
                  onClick={onTodosActivate}
                  aria-pressed={false}
                  aria-label={todosLabel}
                  title={todosTooltip}
                >
                  <ListTodo className="h-4 w-4 text-foreground" />
                </Button>
              )}
              {showEditButton && onEditClick && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className={filterIconButtonClass}
                  onClick={onEditClick}
                  aria-label={editLabel}
                  title={editLabel}
                >
                  <SquarePen className="h-4 w-4 text-foreground" />
                </Button>
              )}
            </>
          )}
          {trailingActions}
        </div>
      ) : (
        <div
          style={{ position: "relative" }}
          className={cn(
            "flex items-center flex-nowrap",
            toolbarGapClass,
            toolbarAllowsHorizontalOverflow ? "w-max shrink-0" : "",
            containerClassName
          )}
        >
          {showMyFilter && onMyActivate && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={filterIconButtonClass}
              onClick={onMyActivate}
              aria-pressed={false}
              aria-label={myLabel}
              title={myLabel}
            >
              <User className="h-4 w-4 text-foreground" />
            </Button>
          )}
          {onBwiActivate && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={filterIconButtonClass}
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
            variant="secondary"
            size="icon"
            className={filterIconButtonClass}
            onClick={onSearchActivate}
            aria-label="Search"
            title="Search"
          >
            <Search className="h-4 w-4 text-foreground" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className={filterIconButtonClass}
            onClick={onOpenFilters}
            aria-label="Filter"
            title="Filter"
          >
            <FilterIcon className="h-4 w-4 text-foreground" />
          </Button>
          {showTodoFilter && todosActive && onTodosClear && (
            <Button
              type="button"
              variant="default"
              size="sm"
              className={cn("h-9 rounded-full px-3 flex items-center gap-2 text-primary-foreground", filterPillActiveClass)}
              onClick={onTodosClear}
              aria-label={todosLabel}
            >
              <ListTodo className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
              <span className="text-sm whitespace-nowrap text-primary-foreground">{todosLabel}</span>
              <X className="h-4 w-4 flex-shrink-0 text-primary-foreground" />
            </Button>
          )}
          {showTodoFilter && !todosActive && onTodosActivate && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={filterIconButtonClass}
              onClick={onTodosActivate}
              aria-pressed={false}
              aria-label={todosLabel}
              title={todosTooltip}
            >
              <ListTodo className="h-4 w-4 text-foreground" />
            </Button>
          )}
          {showEditButton && onEditClick && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className={filterIconButtonClass}
              onClick={onEditClick}
              aria-label={editLabel}
              title={editLabel}
            >
              <SquarePen className="h-4 w-4 text-foreground" />
            </Button>
          )}
          {trailingActions}
        </div>
      )}
    </>
  );
}
