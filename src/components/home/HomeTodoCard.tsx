"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion } from "motion/react";
import { ListTodo, ChevronRight, ChevronDown, ChevronUp, User, Building2 } from "lucide-react";
import {
  getMyOpenCallTodos,
  getMyCompletedCallTodos,
  getEstablishmentOpenCallTodos,
  getEstablishmentCompletedCallTodos,
  getHouseholderOpenCallTodos,
  getHouseholderCompletedCallTodos,
  updateCallTodo,
  type MyOpenCallTodoItem,
} from "@/lib/db/business";
import { cacheGet, cacheSet } from "@/lib/offline/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FilterControls, type FilterBadge } from "@/components/shared/FilterControls";
import { VisitFiltersForm, type VisitFilters, type VisitFilterOption } from "@/components/visit/VisitFiltersForm";
import { buildFilterBadges } from "@/lib/utils/filter-badges";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { VisitStatusBadge } from "@/components/visit/VisitStatusBadge";
import { cn } from "@/lib/utils";
import { formatStatusText } from "@/lib/utils/formatters";
import { Badge } from "@/components/ui/badge";

const todoLayoutTransition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
} as const;
const TODOS_FRESH_MS = 30_000;

const TODOS_CACHE_KEY = (scopeKey: string) => `home-todos:${scopeKey}`;

function truncateLabel(label: string | null | undefined, max = 28): string {
  if (!label) return "";
  const trimmed = label.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function formatTodoDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  const yearShort = String(d.getFullYear()).slice(-2);
  return `${month} ${day}, '${yearShort}`;
}

function compareDeadlineAsc(a: MyOpenCallTodoItem, b: MyOpenCallTodoItem): number {
  const aDeadline = a.deadline_date ? new Date(`${a.deadline_date}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
  const bDeadline = b.deadline_date ? new Date(`${b.deadline_date}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
  if (aDeadline !== bDeadline) return aDeadline - bDeadline;
  const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
  return aCreated - bCreated;
}

/** Deadline-based styling: passed red, <7 days orange, <14 yellow, >=14 green. */
function getTodoAgeBorderClass(deadlineDate: string | null | undefined): string {
  if (!deadlineDate) return "";
  const deadline = new Date(`${deadlineDate}T00:00:00`).getTime();
  if (Number.isNaN(deadline)) return "";
  const nowDate = new Date();
  const todayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
  const daysMs = 24 * 60 * 60 * 1000;
  const daysUntilDeadline = (deadline - todayStart) / daysMs;
  if (daysUntilDeadline < 0) return "border-l-4 border-l-red-500 dark:border-l-red-600";
  if (daysUntilDeadline < 7) return "border-l-4 border-l-orange-500 dark:border-l-orange-600";
  if (daysUntilDeadline < 14) return "border-l-4 border-l-yellow-500 dark:border-l-yellow-600";
  return "border-l-4 border-l-green-500 dark:border-l-green-600";
}

interface HomeTodoCardProps {
  userId?: string;
  establishmentId?: string;
  householderId?: string;
  onTodoTap?: (todo: MyOpenCallTodoItem) => void;
  onNavigateToTodoCall?: (params: {
    establishmentId?: string;
    householderId?: string;
  }) => void;
}

export function HomeTodoCard({
  userId,
  establishmentId,
  householderId,
  onTodoTap,
  onNavigateToTodoCall,
}: HomeTodoCardProps) {
  const [openTodos, setOpenTodos] = useState<MyOpenCallTodoItem[]>([]);
  const [completedTodos, setCompletedTodos] = useState<MyOpenCallTodoItem[]>([]);
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDoneExpanded, setDrawerDoneExpanded] = useState(false);
  const hasLoadedRef = useRef(false);
  const lastSyncedAtRef = useRef(0);
  const inFlightRef = useRef(false);
  const [filters, setFilters] = useState<VisitFilters>({
    search: "",
    statuses: [],
    areas: [],
    myUpdatesOnly: false,
    bwiOnly: false,
    householderOnly: false,
  });
  const [activePanel, setActivePanel] = useState<"list" | "filters">("list");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const scopeKey = establishmentId
    ? `establishment:${establishmentId}`
    : householderId
      ? `householder:${householderId}`
      : userId
        ? `user:${userId}`
        : null;

  const loadTodos = useCallback((opts?: { useCache?: boolean; forceNetwork?: boolean }) => {
    if (!scopeKey) return;
    const useCache = opts?.useCache ?? true;
    const forceNetwork = opts?.forceNetwork ?? true;
    const key = TODOS_CACHE_KEY(scopeKey);
    if (useCache && !hasLoadedRef.current) {
      cacheGet<{ open: MyOpenCallTodoItem[]; completed: MyOpenCallTodoItem[] }>(key).then((cached) => {
        if (cached && Array.isArray(cached.open) && Array.isArray(cached.completed)) {
          setOpenTodos(cached.open);
          setCompletedTodos(cached.completed);
        }
      });
    }

    if (!forceNetwork && Date.now() - lastSyncedAtRef.current < TODOS_FRESH_MS) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const openQuery = establishmentId
      ? getEstablishmentOpenCallTodos(establishmentId, 50)
      : householderId
        ? getHouseholderOpenCallTodos(householderId, 50)
        : userId
          ? getMyOpenCallTodos(userId, 50)
          : Promise.resolve<MyOpenCallTodoItem[]>([]);
    const completedQuery = establishmentId
      ? getEstablishmentCompletedCallTodos(establishmentId, 50)
      : householderId
        ? getHouseholderCompletedCallTodos(householderId, 50)
        : userId
          ? getMyCompletedCallTodos(userId, 20)
          : Promise.resolve<MyOpenCallTodoItem[]>([]);

    Promise.all([openQuery, completedQuery])
      .then(([open, completed]) => {
        hasLoadedRef.current = true;
        lastSyncedAtRef.current = Date.now();
        setOpenTodos(open);
        setCompletedTodos(completed);
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [scopeKey, establishmentId, householderId, userId]);

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  useEffect(() => {
    loadTodos({ useCache: true, forceNetwork: true });
  }, [loadTodos]);

  useEffect(() => {
    if (drawerOpen) loadTodos({ useCache: false, forceNetwork: false });
  }, [drawerOpen, loadTodos]);

  useEffect(() => {
    if (!scopeKey || !hasLoadedRef.current) return;
    cacheSet(TODOS_CACHE_KEY(scopeKey), { open: openTodos, completed: completedTodos });
  }, [scopeKey, openTodos, completedTodos]);

  const allTodos = useMemo(
    () => [...openTodos, ...completedTodos],
    [openTodos, completedTodos]
  );

  const statusOptions: VisitFilterOption[] = useMemo(() => {
    const values = new Set<string>();
    allTodos.forEach((t) => {
      if (t.context_status) values.add(t.context_status);
    });
    return Array.from(values).map((value) => ({
      value,
      label: formatStatusText(value),
    }));
  }, [allTodos]);

  const areaOptions: VisitFilterOption[] = useMemo(() => {
    const values = new Set<string>();
    allTodos.forEach((t) => {
      const area = t.context_area?.trim();
      if (area) values.add(area);
    });
    return Array.from(values).map((value) => ({ value, label: value }));
  }, [allTodos]);

  const filterBadges: FilterBadge[] = useMemo(
    () =>
      buildFilterBadges({
        statuses: filters.statuses,
        areas: filters.areas,
        formatStatusLabel: formatStatusText,
      }),
    [filters.statuses, filters.areas]
  );

  const clearFilters = useCallback(() => {
    setFilters((prev) => ({ ...prev, statuses: [], areas: [] }));
  }, []);

  // Live update for both card and drawer
  useEffect(() => {
    if (!scopeKey) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`todos-live-${scopeKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "call_todos" }, () => {
        loadTodos({ useCache: false, forceNetwork: true });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "calls" }, () => {
        loadTodos({ useCache: false, forceNetwork: true });
      })
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [scopeKey, loadTodos]);

  const handleMarkDone = (todo: MyOpenCallTodoItem, checked: boolean) => {
    // Optimistic update: move todo immediately, then revert on failure
    const prevOpen = openTodos;
    const prevCompleted = completedTodos;

    if (checked) {
      setOpenTodos((prev) => prev.filter((t) => t.id !== todo.id));
      setCompletedTodos((prev) => [{ ...todo, is_done: true }, ...prev]);
    } else {
      setCompletedTodos((prev) => prev.filter((t) => t.id !== todo.id));
      setOpenTodos((prev) => [{ ...todo, is_done: false }, ...prev]);
    }

    updateCallTodo(todo.id, { is_done: checked }).then((ok) => {
      if (!ok) {
        // Revert if the server update failed
        setOpenTodos(prevOpen);
        setCompletedTodos(prevCompleted);
      }
    });
  };

  const handleTodoTap = (todo: MyOpenCallTodoItem) => {
    if (onTodoTap) {
      onTodoTap(todo);
      setDrawerOpen(false);
      return;
    }
    if (!onNavigateToTodoCall) return;
    if (todo.householder_id) {
      onNavigateToTodoCall({ householderId: todo.householder_id });
    } else if (todo.establishment_id) {
      onNavigateToTodoCall({ establishmentId: todo.establishment_id });
    }
    setDrawerOpen(false);
  };

  const applyFilters = useCallback(
    (items: MyOpenCallTodoItem[]): MyOpenCallTodoItem[] => {
      // Only apply filters/search/BWI/contacts for the main home card (user scope)
      if (!userId || establishmentId || householderId) return items;

      return items.filter((todo) => {
        // Search (body + context name)
        if (searchValue.trim()) {
          const term = searchValue.trim().toLowerCase();
          const haystack =
            `${todo.body ?? ""} ${todo.context_name ?? ""}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }

        // Status filter
        if (filters.statuses.length > 0) {
          if (!todo.context_status || !filters.statuses.includes(todo.context_status)) {
            return false;
          }
        }

        // Area filter
        if (filters.areas.length > 0) {
          const area = todo.context_area?.trim();
          if (!area || !filters.areas.includes(area)) {
            return false;
          }
        }

        // Establishments Only / Contacts Only
        if (filters.bwiOnly && (!todo.establishment_id || !!todo.householder_id)) {
          return false;
        }
        if (filters.householderOnly && !todo.householder_id) {
          return false;
        }

        return true;
      });
    },
    [userId, establishmentId, householderId, filters, searchValue]
  );

  const filteredOpenTodos = useMemo(
    () => [...applyFilters(openTodos)].sort(compareDeadlineAsc),
    [applyFilters, openTodos]
  );
  const filteredCompletedTodos = useMemo(
    () => [...applyFilters(completedTodos)].sort(compareDeadlineAsc),
    [applyFilters, completedTodos]
  );

  const displayTodos = filteredOpenTodos.slice(0, 5);
  const openCount = openTodos.length;
  const hasNavigation = !!(onNavigateToTodoCall || onTodoTap);
  const emptyText = userId
    ? "No open to-dos from your calls"
    : "No open to-dos for this call history";
  const emptyDrawerText = userId
    ? "No to-dos from your calls"
    : "No to-dos for this call history";

  return (
    <>
      <div className="rounded-lg border overflow-hidden bg-background">
        <div className="p-4">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5 w-full text-left hover:text-foreground transition-colors"
          >
            <ListTodo className="h-4 w-4 shrink-0" />
            <span>To-Do</span>
            {openCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-4 rounded-full px-1.5 text-[10px] leading-none"
              >
                {openCount}
              </Badge>
            )}
            <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-70" />
          </button>
          <ul className="space-y-4">
            {filteredOpenTodos.length === 0 ? (
              <li className="text-sm text-muted-foreground py-1">{emptyText}</li>
            ) : (
              displayTodos.map((todo, index) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  timeZone={timeZone}
                  onMarkDone={handleMarkDone}
                  onTap={hasNavigation ? handleTodoTap : undefined}
                  showCheckbox
                  rowIndex={index}
                  layoutId={`card-${todo.id}`}
                  layoutTransition={todoLayoutTransition}
                />
              ))
            )}
          </ul>
          {filteredCompletedTodos.length > 0 && (
            <>
              <div className="text-xs text-muted-foreground mt-4 mb-2 font-medium">Done</div>
              <ul className="space-y-4">
                {filteredCompletedTodos.slice(0, 3).map((todo, index) => (
                  <TodoRow
                    key={todo.id}
                    todo={{ ...todo, is_done: true }}
                    timeZone={timeZone}
                    onMarkDone={handleMarkDone}
                    onTap={hasNavigation ? handleTodoTap : undefined}
                    showCheckbox
                    rowIndex={index}
                    layoutId={`card-${todo.id}`}
                    layoutTransition={todoLayoutTransition}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setDrawerDoneExpanded(false);
        }}
      >
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="px-4 pt-4 pb-2 items-center">
            <DrawerTitle className="flex w-full items-center justify-center gap-2 text-center text-lg font-bold">
              <ListTodo className="h-4 w-4 shrink-0" />
              {activePanel === "filters" ? "Filter To-Dos" : "To-Do"}
              {activePanel === "list" && openCount > 0 && (
                <Badge
                  variant="secondary"
                  className="h-5 rounded-full px-2 text-[11px] leading-none"
                >
                  {openCount}
                </Badge>
              )}
            </DrawerTitle>
          </DrawerHeader>
          {activePanel === "filters" ? (
            <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
              <VisitFiltersForm
                filters={filters}
                statusOptions={statusOptions}
                areaOptions={areaOptions}
                onFiltersChange={setFilters}
                onClearFilters={clearFilters}
              />
              <div className="flex justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActivePanel("list")}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
              {userId && !establishmentId && !householderId && (
                <div className="mb-4 w-full flex justify-center">
                  <FilterControls
                    isSearchActive={isSearchActive}
                    searchValue={searchValue}
                    searchInputRef={searchInputRef}
                    onSearchActivate={() => setIsSearchActive(true)}
                    onSearchChange={(value) => setSearchValue(value)}
                    onSearchClear={() => {
                      setSearchValue("");
                      setIsSearchActive(false);
                    }}
                    onSearchBlur={() => {
                      if (!searchValue.trim()) setIsSearchActive(false);
                    }}
                    showMyFilter={false}
                    bwiActive={filters.bwiOnly}
                    bwiLabel="Establishments Only"
                    onBwiActivate={() =>
                      setFilters((prev) => ({
                        ...prev,
                        bwiOnly: true,
                        householderOnly: false,
                      }))
                    }
                    onBwiClear={() =>
                      setFilters((prev) => ({ ...prev, bwiOnly: false }))
                    }
                    householderActive={filters.householderOnly}
                    householderLabel="Contacts Only"
                    onHouseholderActivate={() =>
                      setFilters((prev) => ({
                        ...prev,
                        householderOnly: true,
                        bwiOnly: false,
                      }))
                    }
                    onHouseholderClear={() =>
                      setFilters((prev) => ({
                        ...prev,
                        householderOnly: false,
                      }))
                    }
                    filterBadges={filterBadges}
                    onOpenFilters={() => setActivePanel("filters")}
                    onClearFilters={clearFilters}
                    onRemoveBadge={(badge) => {
                      if (badge.type === "status") {
                        setFilters((prev) => ({
                          ...prev,
                          statuses: prev.statuses.filter(
                            (s) => s !== badge.value
                          ),
                        }));
                      } else if (badge.type === "area") {
                        setFilters((prev) => ({
                          ...prev,
                          areas: prev.areas.filter((a) => a !== badge.value),
                        }));
                      }
                    }}
                    containerClassName={
                      isSearchActive ? "w-full !max-w-none !px-0" : "justify-center"
                    }
                    maxWidthClassName={isSearchActive ? "" : "mx-4"}
                  />
                </div>
              )}

              {filteredOpenTodos.length === 0 && filteredCompletedTodos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">{emptyDrawerText}</p>
              ) : (
                <>
                  {filteredOpenTodos.length > 0 && (
                    <ul className="space-y-3 pb-2">
                      {filteredOpenTodos.map((todo, index) => (
                        <TodoRow
                          key={todo.id}
                          todo={todo}
                          timeZone={timeZone}
                          onMarkDone={handleMarkDone}
                          onTap={hasNavigation ? handleTodoTap : undefined}
                          showCheckbox
                          rowIndex={index}
                          layoutId={`drawer-${todo.id}`}
                          layoutTransition={todoLayoutTransition}
                        />
                      ))}
                    </ul>
                  )}
                  {filteredCompletedTodos.length > 0 && (
                    <>
                      <div className="text-xs text-muted-foreground mt-5 mb-2 font-medium">
                        Done
                      </div>
                      <ul className="space-y-3">
                        {(drawerDoneExpanded
                          ? filteredCompletedTodos
                          : filteredCompletedTodos.slice(0, 3)
                        ).map((todo, index) => (
                          <TodoRow
                            key={todo.id}
                            todo={{ ...todo, is_done: true }}
                            timeZone={timeZone}
                            onMarkDone={handleMarkDone}
                            onTap={hasNavigation ? handleTodoTap : undefined}
                            showCheckbox
                            rowIndex={index}
                            layoutId={`drawer-${todo.id}`}
                            layoutTransition={todoLayoutTransition}
                          />
                        ))}
                      </ul>
                      {filteredCompletedTodos.length > 3 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 w-full text-muted-foreground hover:text-foreground"
                          onClick={() => setDrawerDoneExpanded((prev) => !prev)}
                        >
                          {drawerDoneExpanded ? (
                            <>
                              <ChevronUp className="h-4 w-4 mr-1" />
                              Show less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4 mr-1" />
                              Show more (
                              {filteredCompletedTodos.length - 3} more)
                            </>
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}

function TodoRow({
  todo,
  timeZone,
  onMarkDone,
  onTap,
  showCheckbox = false,
  layoutId,
  layoutTransition,
  rowIndex,
}: {
  todo: MyOpenCallTodoItem;
  timeZone: string | null;
  onMarkDone: (todo: MyOpenCallTodoItem, checked: boolean) => void;
  onTap?: (todo: MyOpenCallTodoItem) => void;
  showCheckbox?: boolean;
  layoutId?: string;
  layoutTransition?: { type: "spring"; stiffness: number; damping: number };
  rowIndex?: number;
}) {
  const canNavigate = !!onTap && (!!todo.call_id || !!todo.establishment_id || !!todo.householder_id);
  const householderStatus = todo.context_status || "for_scouting";
  const establishmentStatus = todo.context_establishment_status || "for_scouting";
  const isDone = !!todo.is_done;
  const displayDate = todo.deadline_date;
  const ageBorderClass = isDone ? "" : getTodoAgeBorderClass(displayDate);
  const isHouseholder = !!todo.householder_id;
  const isEvenRow = typeof rowIndex === "number" && rowIndex % 2 === 1;
  const content = (
    <>
      {showCheckbox ? (
        <Checkbox
          checked={isDone}
          onCheckedChange={(checked) => onMarkDone(todo, checked === true)}
          className="mt-0 shrink-0 h-5 w-5"
          aria-label={isDone ? "Mark as not done" : "Mark as done"}
        />
      ) : (
        <span
          className="rounded border border-border bg-muted/50 w-5 h-5 shrink-0"
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {todo.context_name ? (
            <>
              {isHouseholder ? (
                <span className="inline-flex items-center gap-1 w-fit max-w-[55%] min-w-0 shrink">
                  <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <VisitStatusBadge
                    status={householderStatus}
                    label={truncateLabel(todo.context_name, 28)}
                    className={cn("truncate max-w-full whitespace-nowrap", isDone && "opacity-70")}
                  />
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 w-fit max-w-[55%] min-w-0 shrink">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <VisitStatusBadge
                    status={establishmentStatus}
                    label={truncateLabel(todo.context_name, 28)}
                    className={cn("truncate max-w-full whitespace-nowrap", isDone && "opacity-70")}
                  />
                </span>
              )}
              {isHouseholder && todo.context_establishment_name ? (
                <VisitStatusBadge
                  status={establishmentStatus}
                  label={truncateLabel(todo.context_establishment_name, 24)}
                  className={cn("truncate max-w-[45%] whitespace-nowrap border-muted bg-muted/50", isDone && "opacity-70")}
                />
              ) : null}
            </>
          ) : null}
          {displayDate ? (
            <span className="text-xs text-muted-foreground shrink-0 ml-auto pl-2 pr-1">
              {formatTodoDate(displayDate)}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => onTap?.(todo)}
          className={cn(
            "text-left line-clamp-2 py-0.5 rounded w-full",
            canNavigate && "hover:bg-muted/50 active:bg-muted transition-colors",
            isDone && "text-muted-foreground line-through"
          )}
          disabled={!canNavigate}
        >
          {todo.body}
        </button>
      </div>
    </>
  );
  const finalClassName = cn(
    "flex items-center gap-2 text-sm group rounded-md",
    isEvenRow && "bg-muted/30",
    ageBorderClass && "pl-2",
    ageBorderClass
  );
  if (layoutId) {
    return (
      <motion.li
        layoutId={layoutId}
        layout
        transition={layoutTransition}
        className={finalClassName}
      >
        {content}
      </motion.li>
    );
  }
  return <li className={finalClassName}>{content}</li>;
}
