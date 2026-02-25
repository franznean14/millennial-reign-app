"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "motion/react";
import { ListTodo, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";
import { formatDateHuman } from "@/lib/utils";
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

const todoLayoutTransition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
} as const;
const TODOS_FRESH_MS = 30_000;

const TODOS_CACHE_KEY = (scopeKey: string) => `home-todos:${scopeKey}`;

/** Age-based row styling: <7 days green, 7+ yellow, 14+ orange, 21+ red (oldest on top). */
function getTodoAgeBorderClass(callCreatedAt: string | null | undefined): string {
  if (!callCreatedAt) return "";
  const created = new Date(callCreatedAt).getTime();
  const now = Date.now();
  const daysMs = 24 * 60 * 60 * 1000;
  const daysOld = (now - created) / daysMs;
  if (daysOld >= 21) return "border-l-4 border-l-red-500 dark:border-l-red-600";
  if (daysOld >= 14) return "border-l-4 border-l-orange-500 dark:border-l-orange-600";
  if (daysOld >= 7) return "border-l-4 border-l-yellow-500 dark:border-l-yellow-600";
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

  const displayTodos = openTodos.slice(0, 5);
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
            <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-70" />
          </button>
          <ul className="space-y-3">
            {openTodos.length === 0 ? (
              <li className="text-sm text-muted-foreground py-1">{emptyText}</li>
            ) : (
              displayTodos.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  timeZone={timeZone}
                  onMarkDone={handleMarkDone}
                  onTap={hasNavigation ? handleTodoTap : undefined}
                  showCheckbox
                  layoutId={`card-${todo.id}`}
                  layoutTransition={todoLayoutTransition}
                />
              ))
            )}
          </ul>
          {completedTodos.length > 0 && (
            <>
              <div className="text-xs text-muted-foreground mt-4 mb-2 font-medium">Done</div>
              <ul className="space-y-3">
                {completedTodos.slice(0, 3).map((todo) => (
                  <TodoRow
                    key={todo.id}
                    todo={{ ...todo, is_done: true }}
                    timeZone={timeZone}
                    onMarkDone={handleMarkDone}
                    onTap={hasNavigation ? handleTodoTap : undefined}
                    showCheckbox
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
          <DrawerHeader className="px-4 pt-4 pb-2">
            <DrawerTitle className="text-left flex items-center gap-1.5">
              <ListTodo className="h-4 w-4 shrink-0" />
              To-Do
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
            {openTodos.length === 0 && completedTodos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">{emptyDrawerText}</p>
            ) : (
              <>
                {openTodos.length > 0 && (
                  <ul className="space-y-1 pb-2">
                    {openTodos.map((todo) => (
                      <TodoRow
                        key={todo.id}
                        todo={todo}
                        timeZone={timeZone}
                        onMarkDone={handleMarkDone}
                        onTap={hasNavigation ? handleTodoTap : undefined}
                        showCheckbox
                        layoutId={`drawer-${todo.id}`}
                        layoutTransition={todoLayoutTransition}
                      />
                    ))}
                  </ul>
                )}
                {completedTodos.length > 0 && (
                  <>
                    <div className="text-xs text-muted-foreground mt-4 mb-2 font-medium">Done</div>
                    <ul className="space-y-1">
                      {(drawerDoneExpanded ? completedTodos : completedTodos.slice(0, 3)).map(
                        (todo) => (
                          <TodoRow
                            key={todo.id}
                            todo={{ ...todo, is_done: true }}
                            timeZone={timeZone}
                            onMarkDone={handleMarkDone}
                            onTap={hasNavigation ? handleTodoTap : undefined}
                            showCheckbox
                            layoutId={`drawer-${todo.id}`}
                            layoutTransition={todoLayoutTransition}
                          />
                        )
                      )}
                    </ul>
                    {completedTodos.length > 3 && (
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
                            Show more ({completedTodos.length - 3} more)
                          </>
                        )}
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
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
}: {
  todo: MyOpenCallTodoItem;
  timeZone: string | null;
  onMarkDone: (todo: MyOpenCallTodoItem, checked: boolean) => void;
  onTap?: (todo: MyOpenCallTodoItem) => void;
  showCheckbox?: boolean;
  layoutId?: string;
  layoutTransition?: { type: "spring"; stiffness: number; damping: number };
}) {
  const canNavigate = !!onTap && (!!todo.call_id || !!todo.establishment_id || !!todo.householder_id);
  const status = todo.context_status || "for_scouting";
  const isDone = !!todo.is_done;
  const ageBorderClass = isDone ? "" : getTodoAgeBorderClass(todo.call_created_at);
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
      <div className="min-w-0 flex-1 flex flex-col gap-1">
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
        {todo.context_name ? (
          <VisitStatusBadge
            status={status}
            label={todo.context_name}
            className={cn("w-fit truncate max-w-full", isDone && "opacity-70")}
          />
        ) : null}
      </div>
      {todo.visit_date ? (
        <span className="text-xs text-muted-foreground shrink-0 pt-0.5">
          {formatDateHuman(todo.visit_date, timeZone || undefined)}
        </span>
      ) : null}
    </>
  );
  const finalClassName = cn(
    "flex items-center gap-2 text-sm group",
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
