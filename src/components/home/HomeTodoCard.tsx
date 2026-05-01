"use client";

import { useEffect, useState, useCallback, useRef, useMemo, useId } from "react";
import { motion } from "motion/react";
import { ListTodo, ChevronRight, ChevronDown, ChevronUp, MapPinned, BookOpen } from "lucide-react";
import {
  getMyOpenCallTodos,
  getMyCompletedCallTodos,
  getCongregationOpenCallTodos,
  getCongregationCompletedCallTodos,
  getEstablishmentOpenCallTodos,
  getEstablishmentCompletedCallTodos,
  getHouseholderOpenCallTodos,
  getHouseholderCompletedCallTodos,
  getHouseholderDetails,
  getBwiParticipants,
  getEstablishmentDetails,
  updateCallTodo,
  type MyOpenCallTodoItem,
  type EstablishmentWithDetails,
  type VisitWithUser,
  type HouseholderWithDetails,
} from "@/lib/db/business";
import { cacheGet, cacheSet } from "@/lib/offline/store";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FilterControls, type FilterBadge } from "@/components/shared/FilterControls";
import {
  VisitFiltersForm,
  type VisitFilters,
  type VisitFilterOption,
  type VisitAssigneeFilterOption,
} from "@/components/visit/VisitFiltersForm";
import { buildFilterBadges } from "@/lib/utils/filter-badges";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { VisitStatusBadge } from "@/components/visit/VisitStatusBadge";
import { cn } from "@/lib/utils";
import { formatStatusText } from "@/lib/utils/formatters";
import { Badge } from "@/components/ui/badge";
import { FormModal } from "@/components/shared/FormModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitialsFromName } from "@/lib/utils/visit-history-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMobile } from "@/lib/hooks/use-mobile";
import { getBestStatus, getStatusColor, getStatusTextColor } from "@/lib/utils/status-hierarchy";
import { VisitUpdatesSection } from "@/components/business/VisitUpdatesSection";

const todoLayoutTransition = {
  type: "spring",
  stiffness: 400,
  damping: 30,
} as const;
const TODOS_FRESH_MS = 30_000;

const TODOS_CACHE_KEY = (scopeKey: string) => `home-todos:${scopeKey}`;
const TODOS_LOCAL_STORAGE_KEY = (scopeKey: string) => `home-todos:local:${scopeKey}`;
const TODO_FILTERS_LOCAL_STORAGE_KEY = (scopeKey: string) => `home-todos:filters:${scopeKey}`;
const GUEST_SLOT_PREFIX = "guest::";
type EstablishmentDetailsSnapshot = {
  establishment: EstablishmentWithDetails;
  visits: VisitWithUser[];
  householders: HouseholderWithDetails[];
};

type HouseholderDetailsSnapshot = {
  householder: HouseholderWithDetails;
  visits: VisitWithUser[];
  establishment?: { id: string; name: string; area?: string | null } | null;
};

function readLocalTodosCache(
  scopeKey: string
): { open: MyOpenCallTodoItem[]; completed: MyOpenCallTodoItem[]; syncedAt: number } | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(TODOS_LOCAL_STORAGE_KEY(scopeKey));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      open?: MyOpenCallTodoItem[];
      completed?: MyOpenCallTodoItem[];
      syncedAt?: number;
    };
    if (!Array.isArray(parsed?.open) || !Array.isArray(parsed?.completed)) return null;
    return {
      open: parsed.open,
      completed: parsed.completed,
      syncedAt: typeof parsed.syncedAt === "number" ? parsed.syncedAt : 0,
    };
  } catch {
    return null;
  }
}

/** Persist to-dos for a scope (offline-first; primary source for instant load). */
function writeLocalTodosCache(
  scopeKey: string,
  open: MyOpenCallTodoItem[],
  completed: MyOpenCallTodoItem[],
  syncedAt: number
): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      TODOS_LOCAL_STORAGE_KEY(scopeKey),
      JSON.stringify({ open, completed, syncedAt })
    );
  } catch {
    // quota / private mode
  }
}
const BULK_TODO_DRAFT_KEY = "business:bulk-todos:draft:v1";
type BulkPrefillRow = {
  id: string;
  targetKey: string;
  body: string;
  slots: string[];
  dueDate: string | null;
  sourceTodoId?: string | null;
  sourceCallId?: string | null;
  original?: {
    targetKey: string;
    body: string;
    slots: string[];
    dueDate: string | null;
  };
};

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

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDateString(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function compareDeadlineAsc(a: MyOpenCallTodoItem, b: MyOpenCallTodoItem): number {
  const aDeadline = a.deadline_date ? new Date(`${a.deadline_date}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
  const bDeadline = b.deadline_date ? new Date(`${b.deadline_date}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
  if (aDeadline !== bDeadline) return aDeadline - bDeadline;
  const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
  const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
  return aCreated - bCreated;
}

function compareLatestDesc(a: MyOpenCallTodoItem, b: MyOpenCallTodoItem): number {
  const getLatestMs = (todo: MyOpenCallTodoItem) => {
    const createdMs = todo.created_at ? new Date(todo.created_at).getTime() : 0;
    const callCreatedMs = todo.call_created_at ? new Date(todo.call_created_at).getTime() : 0;
    const deadlineMs = todo.deadline_date ? new Date(`${todo.deadline_date}T00:00:00`).getTime() : 0;
    return Math.max(createdMs, callCreatedMs, deadlineMs);
  };
  return getLatestMs(b) - getLatestMs(a);
}

/** Deadline-based styling: subtle background tint by urgency. */
function getTodoAgeBorderClass(
  deadlineDate: string | null | undefined,
  softened = false
): string {
  if (!deadlineDate) return "";
  const deadline = new Date(`${deadlineDate}T00:00:00`).getTime();
  if (Number.isNaN(deadline)) return "";
  const nowDate = new Date();
  const todayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
  const daysMs = 24 * 60 * 60 * 1000;
  const daysUntilDeadline = (deadline - todayStart) / daysMs;
  if (softened) {
    if (daysUntilDeadline < 0) return "bg-red-500/[0.025] dark:bg-red-500/[0.04]";
    if (daysUntilDeadline < 7) return "bg-orange-500/[0.022] dark:bg-orange-500/[0.036]";
    if (daysUntilDeadline < 14) return "bg-yellow-500/[0.02] dark:bg-yellow-500/[0.034]";
    return "bg-green-500/[0.02] dark:bg-green-500/[0.034]";
  }
  if (daysUntilDeadline < 0) return "bg-red-500/[0.04] dark:bg-red-500/[0.06]";
  if (daysUntilDeadline < 7) return "bg-orange-500/[0.035] dark:bg-orange-500/[0.055]";
  if (daysUntilDeadline < 14) return "bg-yellow-500/[0.03] dark:bg-yellow-500/[0.05]";
  return "bg-green-500/[0.03] dark:bg-green-500/[0.05]";
}

function getHouseholderStatusColorClass(status: string) {
  switch (status) {
    case "potential":
      return "text-cyan-600 border-cyan-200 bg-cyan-50 dark:text-cyan-400 dark:border-cyan-800 dark:bg-cyan-950";
    case "do_not_call":
      return "text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950";
    case "interested":
      return "text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-950";
    case "return_visit":
      return "text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:bg-orange-950";
    case "bible_study":
      return "text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950";
    case "moved_branch":
    case "resigned":
      return "text-stone-600 border-stone-200 bg-stone-50 dark:text-stone-400 dark:border-stone-700 dark:bg-stone-950";
    default:
      return "text-gray-600 border-gray-200 bg-gray-50 dark:text-gray-400 dark:border-gray-800 dark:bg-gray-950";
  }
}

function getHouseholderCardColor(status: string) {
  switch (status) {
    case "potential":
      return "border-cyan-500/50 bg-cyan-500/5";
    case "do_not_call":
      return "border-red-500/50 bg-red-500/5";
    case "interested":
      return "border-blue-500/50 bg-blue-500/5";
    case "return_visit":
      return "border-orange-500/50 bg-orange-500/5";
    case "bible_study":
      return "border-emerald-500/50 bg-emerald-500/5";
    case "moved_branch":
    case "resigned":
      return "border-stone-600/40 bg-stone-800/10";
    default:
      return "border-gray-500/50 bg-gray-500/5";
  }
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
  const [drawerTodoExpanded, setDrawerTodoExpanded] = useState(true);
  const [drawerOpenSectionExpanded, setDrawerOpenSectionExpanded] = useState(false);
  const [drawerDoneExpanded, setDrawerDoneExpanded] = useState(false);
  const hasLoadedRef = useRef(false);
  const lastSyncedAtRef = useRef(0);
  const inFlightRef = useRef(false);
  /** Bumps on scope change so stale IndexedDB / network results never overwrite the active list. */
  const loadGenRef = useRef(0);
  const [filters, setFilters] = useState<VisitFilters>({
    search: "",
    statuses: [],
    areas: [],
    assigneeIds: [],
    callDateFrom: null,
    callDateTo: null,
    myUpdatesOnly: true,
    bwiOnly: false,
    householderOnly: false,
  });
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [dueDateFilter, setDueDateFilter] = useState<Date | null>(null);
  const [participantsById, setParticipantsById] = useState<
    Record<string, { first_name: string; last_name: string; avatar_url?: string }>
  >({});
  const [bulkEditPromptOpen, setBulkEditPromptOpen] = useState(false);
  const [selectedTodoIds, setSelectedTodoIds] = useState<string[]>([]);
  const [bulkDraftMergePromptOpen, setBulkDraftMergePromptOpen] = useState(false);
  const [pendingBulkPrefillRows, setPendingBulkPrefillRows] = useState<BulkPrefillRow[]>([]);
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [todoDetailsDrawerOpen, setTodoDetailsDrawerOpen] = useState(false);
  const [selectedTodoForDetails, setSelectedTodoForDetails] = useState<MyOpenCallTodoItem | null>(null);
  const [selectedTodoDetails, setSelectedTodoDetails] = useState<EstablishmentDetailsSnapshot | null>(null);
  const [selectedHouseholderDetails, setSelectedHouseholderDetails] =
    useState<HouseholderDetailsSnapshot | null>(null);
  const [isLoadingTodoDetails, setIsLoadingTodoDetails] = useState(false);
  const [contactDetailsSubdrawerOpen, setContactDetailsSubdrawerOpen] = useState(false);
  const [selectedContactFromEstablishment, setSelectedContactFromEstablishment] =
    useState<HouseholderWithDetails | null>(null);
  const [contactSubdrawerDetails, setContactSubdrawerDetails] = useState<HouseholderDetailsSnapshot | null>(null);
  const [isLoadingContactSubdrawerDetails, setIsLoadingContactSubdrawerDetails] = useState(false);
  const layoutScopeId = useId();
  const establishmentDetailsCacheRef = useRef(new Map<string, EstablishmentDetailsSnapshot>());
  const householderDetailsCacheRef = useRef(new Map<string, HouseholderDetailsSnapshot>());
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useMobile();
  const userScopeMode =
    userId && !establishmentId && !householderId
      ? (filters.myUpdatesOnly ? "my" : "all")
      : null;
  const scopeKey = establishmentId
    ? `establishment:${establishmentId}`
    : householderId
      ? `householder:${householderId}`
      : userId
        ? `user:${userId}:${userScopeMode ?? "my"}`
        : null;
  const filterScopeKey = establishmentId
    ? `establishment:${establishmentId}`
    : householderId
      ? `householder:${householderId}`
      : userId
        ? `user:${userId}`
        : null;

  const loadTodos = useCallback((opts?: { useCache?: boolean; forceNetwork?: boolean; trustFreshLocalCache?: boolean }) => {
    if (!scopeKey) return;
    const useCache = opts?.useCache ?? true;
    const forceNetwork = opts?.forceNetwork ?? true;
    const trustFreshLocalCache = opts?.trustFreshLocalCache ?? false;
    const key = TODOS_CACHE_KEY(scopeKey);
    const genAtStart = loadGenRef.current;
    const isCurrent = () => genAtStart === loadGenRef.current;

    let usedFreshLocalCache = false;
    let localCachedItemCount = 0;
    if (useCache) {
      const localCached = readLocalTodosCache(scopeKey);
      if (localCached) {
        if (isCurrent()) {
          setOpenTodos(localCached.open);
          setCompletedTodos(localCached.completed);
        }
        localCachedItemCount = localCached.open.length + localCached.completed.length;
        usedFreshLocalCache =
          localCached.syncedAt > 0 && Date.now() - localCached.syncedAt < TODOS_FRESH_MS;
      } else if (isCurrent()) {
        // Avoid showing the previous scope's rows while this scope has no snapshot yet.
        setOpenTodos([]);
        setCompletedTodos([]);
      }

      // Prefer localStorage as source of truth when it has data; IndexedDB is only a fallback
      // (and must not overwrite LS after a scope switch — generation guard).
      if (localCachedItemCount === 0) {
        const genAtIdb = loadGenRef.current;
        cacheGet<{ open: MyOpenCallTodoItem[]; completed: MyOpenCallTodoItem[] }>(key).then((cached) => {
          if (genAtIdb !== loadGenRef.current) return;
          if (cached && Array.isArray(cached.open) && Array.isArray(cached.completed)) {
            setOpenTodos(cached.open);
            setCompletedTodos(cached.completed);
          }
        });
      }
    }

    // Only skip network if fresh local cache has actual items.
    // If it's fresh-but-empty, still fetch to avoid hiding real server data.
    if (trustFreshLocalCache && usedFreshLocalCache && localCachedItemCount > 0) {
      hasLoadedRef.current = true;
      lastSyncedAtRef.current = Date.now();
      return;
    }

    if (!forceNetwork && Date.now() - lastSyncedAtRef.current < TODOS_FRESH_MS) return;
    if (inFlightRef.current) return;
    const genAtFetch = loadGenRef.current;
    inFlightRef.current = true;
    const mergeById = (...groups: MyOpenCallTodoItem[][]): MyOpenCallTodoItem[] => {
      const byId = new Map<string, MyOpenCallTodoItem>();
      for (const group of groups) {
        for (const item of group) {
          byId.set(item.id, item);
        }
      }
      return Array.from(byId.values());
    };

    const openQuery = establishmentId
      ? getEstablishmentOpenCallTodos(establishmentId, 50)
      : householderId
        ? getHouseholderOpenCallTodos(householderId, 50)
        : userId
          ? (filters.myUpdatesOnly
              ? getMyOpenCallTodos(userId, 80)
              : Promise.all([
                  getMyOpenCallTodos(userId, 120),
                  getCongregationOpenCallTodos(180),
                ]).then(([mine, congregation]) => mergeById(mine, congregation)))
          : Promise.resolve<MyOpenCallTodoItem[]>([]);
    const completedQuery = establishmentId
      ? getEstablishmentCompletedCallTodos(establishmentId, 50)
      : householderId
        ? getHouseholderCompletedCallTodos(householderId, 50)
        : userId
          ? (filters.myUpdatesOnly
              ? getMyCompletedCallTodos(userId, 40)
              : Promise.all([
                  getMyCompletedCallTodos(userId, 80),
                  getCongregationCompletedCallTodos(120),
                ]).then(([mine, congregation]) => mergeById(mine, congregation)))
          : Promise.resolve<MyOpenCallTodoItem[]>([]);

    Promise.all([openQuery, completedQuery])
      .then(([open, completed]) => {
        if (genAtFetch !== loadGenRef.current) return;
        hasLoadedRef.current = true;
        lastSyncedAtRef.current = Date.now();
        setOpenTodos(open);
        setCompletedTodos(completed);
      })
      .finally(() => {
        if (genAtFetch === loadGenRef.current) {
          inFlightRef.current = false;
        }
      });
  }, [scopeKey, establishmentId, householderId, userId, filters.myUpdatesOnly]);

  useEffect(() => {
    if (!scopeKey) return;
    loadGenRef.current += 1;
    hasLoadedRef.current = false;
    lastSyncedAtRef.current = 0;
    inFlightRef.current = false;
    const snap = readLocalTodosCache(scopeKey);
    setOpenTodos(snap?.open ?? []);
    setCompletedTodos(snap?.completed ?? []);
  }, [scopeKey]);

  useEffect(() => {
    if (!filterScopeKey) return;
    try {
      const raw = window.localStorage.getItem(TODO_FILTERS_LOCAL_STORAGE_KEY(filterScopeKey));
      if (!raw) {
        setFiltersHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw) as {
        filters?: VisitFilters;
        searchValue?: string;
        dueDate?: string | null;
      };
      const hydrated = parsed.filters;
      if (hydrated) {
        setFilters((prev) => ({
          ...prev,
          search: typeof hydrated.search === "string" ? hydrated.search : prev.search,
          statuses: Array.isArray(hydrated.statuses) ? hydrated.statuses : prev.statuses,
          areas: Array.isArray(hydrated.areas) ? hydrated.areas : prev.areas,
          assigneeIds: Array.isArray(hydrated.assigneeIds)
            ? hydrated.assigneeIds.filter((id): id is string => typeof id === "string")
            : prev.assigneeIds,
          myUpdatesOnly:
            typeof hydrated.myUpdatesOnly === "boolean"
              ? hydrated.myUpdatesOnly
              : prev.myUpdatesOnly,
          bwiOnly: typeof hydrated.bwiOnly === "boolean" ? hydrated.bwiOnly : prev.bwiOnly,
          householderOnly:
            typeof hydrated.householderOnly === "boolean"
              ? hydrated.householderOnly
              : prev.householderOnly,
          callDateFrom:
            hydrated.callDateFrom === null || typeof hydrated.callDateFrom === "string"
              ? hydrated.callDateFrom
              : prev.callDateFrom,
          callDateTo:
            hydrated.callDateTo === null || typeof hydrated.callDateTo === "string"
              ? hydrated.callDateTo
              : prev.callDateTo,
        }));
      }
      if (typeof parsed.searchValue === "string") {
        setSearchValue(parsed.searchValue);
        setIsSearchActive(parsed.searchValue.trim().length > 0);
      }
      setDueDateFilter(parseLocalDateString(parsed.dueDate));
    } catch {
      // no-op
    } finally {
      setFiltersHydrated(true);
    }
  }, [filterScopeKey]);

  useEffect(() => {
    if (!filterScopeKey || !filtersHydrated) return;
    try {
      window.localStorage.setItem(
        TODO_FILTERS_LOCAL_STORAGE_KEY(filterScopeKey),
        JSON.stringify({
          filters,
          searchValue,
          dueDate: dueDateFilter ? toLocalDateString(dueDateFilter) : null,
        })
      );
    } catch {
      // no-op
    }
  }, [filterScopeKey, filtersHydrated, filters, searchValue, dueDateFilter]);

  // Warm up "all to-dos" in localStorage while user is on My To-Dos (re-fetch when snapshot is missing or stale).
  useEffect(() => {
    if (!userId || establishmentId || householderId || !filters.myUpdatesOnly) return;
    const allScopeKey = `user:${userId}:all`;
    const existingLocal = readLocalTodosCache(allScopeKey);
    const hasRows =
      !!existingLocal && (existingLocal.open.length > 0 || existingLocal.completed.length > 0);
    const freshEnough =
      !!existingLocal &&
      existingLocal.syncedAt > 0 &&
      Date.now() - existingLocal.syncedAt < TODOS_FRESH_MS;
    if (hasRows && freshEnough) return;
    let cancelled = false;
    const mergeById = (...groups: MyOpenCallTodoItem[][]): MyOpenCallTodoItem[] => {
      const byId = new Map<string, MyOpenCallTodoItem>();
      for (const group of groups) {
        for (const item of group) byId.set(item.id, item);
      }
      return Array.from(byId.values());
    };
    Promise.all([
      Promise.all([getMyOpenCallTodos(userId, 120), getCongregationOpenCallTodos(180)]).then(([mine, congregation]) =>
        mergeById(mine, congregation)
      ),
      Promise.all([getMyCompletedCallTodos(userId, 80), getCongregationCompletedCallTodos(120)]).then(
        ([mine, congregation]) => mergeById(mine, congregation)
      ),
    ]).then(([open, completed]) => {
      if (cancelled) return;
      const syncedAt = Date.now();
      cacheSet(TODOS_CACHE_KEY(allScopeKey), { open, completed });
      writeLocalTodosCache(allScopeKey, open, completed, syncedAt);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, establishmentId, householderId, filters.myUpdatesOnly]);

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadParticipants = async () => {
      try {
        const participants = await getBwiParticipants();
        if (cancelled) return;
        const nextMap: Record<string, { first_name: string; last_name: string; avatar_url?: string }> = {};
        participants.forEach((participant) => {
          if (!participant.id) return;
          nextMap[participant.id] = {
            first_name: participant.first_name,
            last_name: participant.last_name,
            avatar_url: participant.avatar_url,
          };
        });
        setParticipantsById(nextMap);
      } catch {
        if (!cancelled) setParticipantsById({});
      }
    };
    loadParticipants();
    return () => {
      cancelled = true;
    };
  }, []);

  // Only skip a network round-trip when "My To-Dos" has a fresh local snapshot.
  // Congregation scope must always revalidate: LS may be mine-only if a prior merge missed congregation data.
  useEffect(() => {
    loadTodos({
      useCache: true,
      forceNetwork: false,
      trustFreshLocalCache: filters.myUpdatesOnly,
    });
  }, [loadTodos, filters.myUpdatesOnly]);

  useEffect(() => {
    if (drawerOpen) loadTodos({ useCache: true, forceNetwork: false, trustFreshLocalCache: false });
  }, [drawerOpen, loadTodos]);

  useEffect(() => {
    if (!drawerOpen) {
      setTodoDetailsDrawerOpen(false);
      setContactDetailsSubdrawerOpen(false);
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (!todoDetailsDrawerOpen) return;
    const householderId = selectedTodoForDetails?.householder_id;
    if (householderId) {
      const cachedHouseholder = householderDetailsCacheRef.current.get(householderId);
      if (cachedHouseholder) {
        setSelectedHouseholderDetails(cachedHouseholder);
      } else {
        setSelectedHouseholderDetails({
          householder: {
            id: householderId,
            name: selectedTodoForDetails?.context_name ?? "Contact",
            status: (selectedTodoForDetails?.context_status as HouseholderWithDetails["status"]) ?? "potential",
            note: null,
            establishment_id: selectedTodoForDetails?.establishment_id ?? null,
            establishment_name: selectedTodoForDetails?.context_establishment_name ?? null,
            publisher_id: null,
            lat: null,
            lng: null,
          },
          visits: [],
          establishment: selectedTodoForDetails?.establishment_id
            ? {
                id: selectedTodoForDetails.establishment_id,
                name: selectedTodoForDetails.context_establishment_name ?? "",
                area: selectedTodoForDetails.context_area ?? null,
              }
            : null,
        });
      }
      setSelectedTodoDetails(null);

      let cancelled = false;
      setIsLoadingTodoDetails(!cachedHouseholder);
      getHouseholderDetails(householderId)
        .then((result) => {
          if (cancelled) return;
          const nextSnapshot = result
            ? {
                householder: result.householder,
                visits: result.visits,
                establishment: result.establishment,
              }
            : null;
          if (nextSnapshot) {
            householderDetailsCacheRef.current.set(householderId, nextSnapshot);
            setSelectedHouseholderDetails(nextSnapshot);
          } else if (!cachedHouseholder) {
            setSelectedHouseholderDetails(null);
          }
        })
        .finally(() => {
          if (!cancelled) setIsLoadingTodoDetails(false);
        });

      return () => {
        cancelled = true;
      };
    }

    const establishmentId = selectedTodoForDetails?.establishment_id;
    if (!establishmentId) return;

    const cached = establishmentDetailsCacheRef.current.get(establishmentId);
    if (cached) {
      setSelectedTodoDetails(cached);
    } else {
      setSelectedTodoDetails({
        establishment: {
          id: establishmentId,
          name: selectedTodoForDetails?.context_name ?? "Establishment",
          area: selectedTodoForDetails?.context_area ?? null,
          description: null,
          floor: null,
          note: null,
          statuses: selectedTodoForDetails?.context_establishment_status
            ? [selectedTodoForDetails.context_establishment_status]
            : selectedTodoForDetails?.context_status
              ? [selectedTodoForDetails.context_status]
              : ["for_scouting"],
          lat: null,
          lng: null,
        },
        visits: [],
        householders: [],
      });
    }
    setSelectedHouseholderDetails(null);

    let cancelled = false;
    setIsLoadingTodoDetails(!cached);
    getEstablishmentDetails(establishmentId)
      .then((result) => {
        if (cancelled) return;
        const nextSnapshot = result
          ? {
              establishment: result.establishment,
              visits: result.visits,
              householders: result.householders,
            }
          : null;
        if (nextSnapshot) {
          establishmentDetailsCacheRef.current.set(establishmentId, nextSnapshot);
          setSelectedTodoDetails(nextSnapshot);
        } else if (!cached) {
          setSelectedTodoDetails(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTodoDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [todoDetailsDrawerOpen, selectedTodoForDetails?.establishment_id, selectedTodoForDetails?.householder_id]);

  useEffect(() => {
    if (!contactDetailsSubdrawerOpen) return;
    const householderId = selectedContactFromEstablishment?.id;
    if (!householderId) return;

    const cached = householderDetailsCacheRef.current.get(householderId);
    if (cached) {
      setContactSubdrawerDetails(cached);
    } else {
      setContactSubdrawerDetails({
        householder: selectedContactFromEstablishment,
        visits: [],
        establishment: selectedContactFromEstablishment.establishment_id
          ? {
              id: selectedContactFromEstablishment.establishment_id,
              name: selectedContactFromEstablishment.establishment_name ?? "",
              area: null,
            }
          : null,
      });
    }

    let cancelled = false;
    setIsLoadingContactSubdrawerDetails(!cached);
    getHouseholderDetails(householderId)
      .then((result) => {
        if (cancelled || !result) return;
        const nextSnapshot: HouseholderDetailsSnapshot = {
          householder: result.householder,
          visits: result.visits,
          establishment: result.establishment,
        };
        householderDetailsCacheRef.current.set(householderId, nextSnapshot);
        setContactSubdrawerDetails(nextSnapshot);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingContactSubdrawerDetails(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contactDetailsSubdrawerOpen, selectedContactFromEstablishment?.id]);

  useEffect(() => {
    if (!scopeKey || !hasLoadedRef.current) return;
    const syncedAt = Date.now();
    cacheSet(TODOS_CACHE_KEY(scopeKey), { open: openTodos, completed: completedTodos });
    writeLocalTodosCache(scopeKey, openTodos, completedTodos, syncedAt);
  }, [scopeKey, openTodos, completedTodos]);

  const allTodos = useMemo(
    () => [...openTodos, ...completedTodos],
    [openTodos, completedTodos]
  );

  /** Todos matching search, due date, scope toggles — used to populate Status/Areas/Assignees chips (excludes chip filters themselves). */
  const todosForFilterChipOptions = useMemo(() => {
    if (!userId || establishmentId || householderId) {
      return allTodos;
    }
    return allTodos.filter((todo) => {
      if (searchValue.trim()) {
        const term = searchValue.trim().toLowerCase();
        const haystack =
          `${todo.body ?? ""} ${todo.context_name ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (dueDateFilter) {
        const selectedDate = toLocalDateString(dueDateFilter);
        if (!todo.deadline_date || todo.deadline_date !== selectedDate) {
          return false;
        }
      }
      if (filters.bwiOnly && (!todo.establishment_id || !!todo.householder_id)) {
        return false;
      }
      if (filters.householderOnly && !todo.householder_id) {
        return false;
      }
      if (filters.myUpdatesOnly && userId) {
        const isMine = todo.publisher_id === userId || todo.partner_id === userId;
        if (!isMine) return false;
      }
      return true;
    });
  }, [
    allTodos,
    userId,
    establishmentId,
    householderId,
    searchValue,
    dueDateFilter,
    filters.bwiOnly,
    filters.householderOnly,
    filters.myUpdatesOnly,
  ]);

  const statusOptions: VisitFilterOption[] = useMemo(() => {
    const values = new Set<string>();
    todosForFilterChipOptions.forEach((t) => {
      if (t.context_status) values.add(t.context_status);
    });
    return Array.from(values).map((value) => ({
      value,
      label: formatStatusText(value),
    }));
  }, [todosForFilterChipOptions]);

  const areaOptions: VisitFilterOption[] = useMemo(() => {
    const values = new Set<string>();
    todosForFilterChipOptions.forEach((t) => {
      const area = t.context_area?.trim();
      if (area) values.add(area);
    });
    return Array.from(values).map((value) => ({ value, label: value }));
  }, [todosForFilterChipOptions]);

  const assigneeFilterOptions: VisitAssigneeFilterOption[] = useMemo(() => {
    const ids = new Set<string>();
    todosForFilterChipOptions.forEach((t) => {
      if (t.publisher_id) ids.add(t.publisher_id);
      if (t.partner_id) ids.add(t.partner_id);
    });
    return Array.from(ids)
      .map((id) => {
        const p = participantsById[id];
        return {
          id,
          first_name: p?.first_name ?? "",
          last_name: p?.last_name ?? "",
          avatar_url: p?.avatar_url,
        };
      })
      .sort((a, b) => {
        const na = `${a.first_name} ${a.last_name}`.trim() || a.id;
        const nb = `${b.first_name} ${b.last_name}`.trim() || b.id;
        return na.localeCompare(nb, undefined, { sensitivity: "base" });
      });
  }, [todosForFilterChipOptions, participantsById]);

  // When a due date is set, drop chip selections that no longer exist for that date (after todos are loaded).
  useEffect(() => {
    if (!userId || establishmentId || householderId) return;
    if (!dueDateFilter || allTodos.length === 0) return;
    const validStatus = new Set(statusOptions.map((o) => o.value));
    const validArea = new Set(areaOptions.map((o) => o.value));
    const validAssignee = new Set(assigneeFilterOptions.map((o) => o.id));
    setFilters((prev) => {
      const nextStatuses = prev.statuses.filter((s) => validStatus.has(s));
      const nextAreas = prev.areas.filter((a) => validArea.has(a));
      const nextAssignees = prev.assigneeIds.filter((id) => validAssignee.has(id));
      if (
        nextStatuses.length === prev.statuses.length &&
        nextAreas.length === prev.areas.length &&
        nextAssignees.length === prev.assigneeIds.length
      ) {
        return prev;
      }
      return {
        ...prev,
        statuses: nextStatuses,
        areas: nextAreas,
        assigneeIds: nextAssignees,
      };
    });
  }, [
    userId,
    establishmentId,
    householderId,
    dueDateFilter,
    allTodos.length,
    statusOptions,
    areaOptions,
    assigneeFilterOptions,
  ]);

  const filterBadges: FilterBadge[] = useMemo(() => {
    const base = buildFilterBadges({
      statuses: filters.statuses,
      areas: filters.areas,
      formatStatusLabel: formatStatusText,
    });
    const assigneeBadges: FilterBadge[] = filters.assigneeIds.map((id) => {
      const p = participantsById[id];
      const label = p ? `${p.first_name} ${p.last_name}`.trim() || "Assignee" : "Assignee";
      return {
        type: "assignee" as const,
        value: id,
        label,
        avatarUrl: p?.avatar_url,
      };
    });
    const dueDateBadges: FilterBadge[] =
      dueDateFilter != null
        ? [
            {
              type: "due_date" as const,
              value: toLocalDateString(dueDateFilter),
              label: formatTodoDate(toLocalDateString(dueDateFilter)),
            },
          ]
        : [];
    return [...base, ...assigneeBadges, ...dueDateBadges];
  }, [filters.statuses, filters.areas, filters.assigneeIds, participantsById, dueDateFilter]);

  const clearFilters = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      statuses: [],
      areas: [],
      assigneeIds: [],
      callDateFrom: null,
      callDateTo: null,
    }));
    setDueDateFilter(null);
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
    const primeScopedTodoCaches = (targetTodo: MyOpenCallTodoItem) => {
      const now = Date.now();
      if (targetTodo.householder_id) {
        const targetHouseholderId = targetTodo.householder_id;
        const scopedOpen = openTodos.filter((item) => item.householder_id === targetHouseholderId);
        const scopedCompleted = completedTodos.filter((item) => item.householder_id === targetHouseholderId);
        const scopedKey = `householder:${targetHouseholderId}`;
        cacheSet(TODOS_CACHE_KEY(scopedKey), { open: scopedOpen, completed: scopedCompleted });
        writeLocalTodosCache(scopedKey, scopedOpen, scopedCompleted, now);
        return;
      }
      if (targetTodo.establishment_id) {
        const targetEstablishmentId = targetTodo.establishment_id;
        const scopedOpen = openTodos.filter((item) => item.establishment_id === targetEstablishmentId);
        const scopedCompleted = completedTodos.filter((item) => item.establishment_id === targetEstablishmentId);
        const scopedKey = `establishment:${targetEstablishmentId}`;
        cacheSet(TODOS_CACHE_KEY(scopedKey), { open: scopedOpen, completed: scopedCompleted });
        writeLocalTodosCache(scopedKey, scopedOpen, scopedCompleted, now);
      }
    };
    const shouldOpenMobileSubdrawer =
      isMobile &&
      userId &&
      !establishmentId &&
      !householderId &&
      (!!todo.establishment_id || !!todo.householder_id);
    if (shouldOpenMobileSubdrawer) {
      primeScopedTodoCaches(todo);
      setSelectedTodoForDetails(todo);
      setTodoDetailsDrawerOpen(true);
      return;
    }
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

        // Assignee filter (publisher or partner)
        if (filters.assigneeIds.length > 0) {
          const pub = todo.publisher_id;
          const part = todo.partner_id;
          const matches =
            (pub && filters.assigneeIds.includes(pub)) ||
            (part && filters.assigneeIds.includes(part));
          if (!matches) return false;
        }

        // Due date filter
        if (dueDateFilter) {
          const selectedDate = toLocalDateString(dueDateFilter);
          if (!todo.deadline_date || todo.deadline_date !== selectedDate) {
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

        // My To-Dos toggle
        if (filters.myUpdatesOnly && userId) {
          const isMine = todo.publisher_id === userId || todo.partner_id === userId;
          if (!isMine) return false;
        }

        return true;
      });
    },
    [userId, establishmentId, householderId, filters, searchValue, dueDateFilter]
  );

  const filteredOpenTodos = useMemo(
    () => [...applyFilters(openTodos)].sort(compareDeadlineAsc),
    [applyFilters, openTodos]
  );
  const filteredCompletedTodos = useMemo(
    () => [...applyFilters(completedTodos)].sort(compareLatestDesc),
    [applyFilters, completedTodos]
  );
  useEffect(() => {
    if (!drawerOpen || !isMobile || !userId || establishmentId || householderId) return;
    const todosForPrefetch = [...filteredOpenTodos, ...filteredCompletedTodos];
    const establishmentIds = Array.from(
      new Set(
        todosForPrefetch
          .map((todo) => todo.establishment_id)
          .filter((id): id is string => !!id)
      )
    ).slice(0, 10);
    const householderIds = Array.from(
      new Set(
        todosForPrefetch
          .map((todo) => todo.householder_id)
          .filter((id): id is string => !!id)
      )
    ).slice(0, 10);
    if (establishmentIds.length === 0 && householderIds.length === 0) return;

    let cancelled = false;
    Promise.all([
      ...establishmentIds.map(async (id) => {
        if (establishmentDetailsCacheRef.current.has(id)) return;
        const result = await getEstablishmentDetails(id);
        if (!result || cancelled) return;
        establishmentDetailsCacheRef.current.set(id, {
          establishment: result.establishment,
          visits: result.visits,
          householders: result.householders,
        });
      }),
      ...householderIds.map(async (id) => {
        if (householderDetailsCacheRef.current.has(id)) return;
        const result = await getHouseholderDetails(id);
        if (!result || cancelled) return;
        householderDetailsCacheRef.current.set(id, {
          householder: result.householder,
          visits: result.visits,
          establishment: result.establishment,
        });
      }),
    ]).catch(() => {
      // no-op; background prefetch only
    });
    return () => {
      cancelled = true;
    };
  }, [
    drawerOpen,
    isMobile,
    userId,
    establishmentId,
    householderId,
    filteredOpenTodos,
    filteredCompletedTodos,
  ]);

  useEffect(() => {
    if (!isMobile || !userId || establishmentId || householderId) return;
    const targets = [...openTodos, ...completedTodos];
    if (targets.length === 0) return;

    const now = Date.now();
    const establishmentIds = Array.from(
      new Set(targets.map((todo) => todo.establishment_id).filter((id): id is string => !!id))
    ).slice(0, 30);
    const householderIds = Array.from(
      new Set(targets.map((todo) => todo.householder_id).filter((id): id is string => !!id))
    ).slice(0, 30);

    establishmentIds.forEach((id) => {
      const scopedOpen = openTodos.filter((item) => item.establishment_id === id);
      const scopedCompleted = completedTodos.filter((item) => item.establishment_id === id);
      const scopedKey = `establishment:${id}`;
      cacheSet(TODOS_CACHE_KEY(scopedKey), { open: scopedOpen, completed: scopedCompleted });
      writeLocalTodosCache(scopedKey, scopedOpen, scopedCompleted, now);
    });

    householderIds.forEach((id) => {
      const scopedOpen = openTodos.filter((item) => item.householder_id === id);
      const scopedCompleted = completedTodos.filter((item) => item.householder_id === id);
      const scopedKey = `householder:${id}`;
      cacheSet(TODOS_CACHE_KEY(scopedKey), { open: scopedOpen, completed: scopedCompleted });
      writeLocalTodosCache(scopedKey, scopedOpen, scopedCompleted, now);
    });

    Promise.all([
      ...establishmentIds.map(async (id) => {
        if (establishmentDetailsCacheRef.current.has(id)) return;
        const result = await getEstablishmentDetails(id);
        if (!result) return;
        establishmentDetailsCacheRef.current.set(id, {
          establishment: result.establishment,
          visits: result.visits,
          householders: result.householders,
        });
      }),
      ...householderIds.map(async (id) => {
        if (householderDetailsCacheRef.current.has(id)) return;
        const result = await getHouseholderDetails(id);
        if (!result) return;
        householderDetailsCacheRef.current.set(id, {
          householder: result.householder,
          visits: result.visits,
          establishment: result.establishment,
        });
      }),
    ]).catch(() => {
      // prewarm only
    });
  }, [
    isMobile,
    userId,
    establishmentId,
    householderId,
    openTodos,
    completedTodos,
  ]);

  const cardOpenTodos = useMemo(
    () => [...openTodos].sort(compareDeadlineAsc),
    [openTodos]
  );
  const cardCompletedTodos = useMemo(
    () => [...completedTodos].sort(compareLatestDesc),
    [completedTodos]
  );
  const selectableTodos = useMemo(
    () => [...filteredOpenTodos],
    [filteredOpenTodos]
  );

  const openBulkEditPrompt = useCallback(() => {
    if (selectableTodos.length === 0) return;
    setSelectedTodoIds(selectableTodos.map((todo) => todo.id));
    setBulkEditPromptOpen(true);
  }, [selectableTodos]);

  const toggleSelectedTodo = useCallback((todoId: string, checked: boolean) => {
    setSelectedTodoIds((prev) => {
      if (checked) {
        if (prev.includes(todoId)) return prev;
        return [...prev, todoId];
      }
      return prev.filter((id) => id !== todoId);
    });
  }, []);

  const bulkEditSelectAllState = useMemo(() => {
    const n = selectableTodos.length;
    if (n === 0) return { allSelected: false, someSelected: false };
    const idSet = new Set(selectedTodoIds);
    let count = 0;
    for (const t of selectableTodos) {
      if (idSet.has(t.id)) count += 1;
    }
    return {
      allSelected: count === n,
      someSelected: count > 0 && count < n,
    };
  }, [selectableTodos, selectedTodoIds]);

  const toggleBulkEditSelectAll = useCallback(
    (checked: boolean) => {
      if (checked) {
        setSelectedTodoIds(selectableTodos.map((t) => t.id));
      } else {
        setSelectedTodoIds([]);
      }
    },
    [selectableTodos]
  );

  const applyBulkEditRows = useCallback((rowsToApply: BulkPrefillRow[], strategy: "overwrite" | "append") => {
    let finalRows = rowsToApply;
    if (strategy === "append") {
      try {
        const raw = window.localStorage.getItem(BULK_TODO_DRAFT_KEY);
        const parsed = raw ? (JSON.parse(raw) as { rows?: BulkPrefillRow[] }) : null;
        const existingRows = Array.isArray(parsed?.rows) ? parsed.rows : [];
        finalRows = [...existingRows, ...rowsToApply];
      } catch {
        finalRows = rowsToApply;
      }
    }

    try {
      window.localStorage.setItem(BULK_TODO_DRAFT_KEY, JSON.stringify({ rows: finalRows }));
    } catch {}

    try {
      window.dispatchEvent(
        new CustomEvent("business-bulk-todos-prefill", {
          detail: { rows: finalRows },
        })
      );
      window.dispatchEvent(new CustomEvent("open-business-bulk-todos", { detail: { mode: "edit" } }));
    } catch {}

    setBulkDraftMergePromptOpen(false);
    setPendingBulkPrefillRows([]);
    setBulkEditPromptOpen(false);
    setDrawerOpen(false);
  }, []);

  const confirmBulkEdit = useCallback(() => {
    const selectedSet = new Set(selectedTodoIds);
    const chosen = selectableTodos.filter((todo) => selectedSet.has(todo.id));
    if (chosen.length === 0) return;

    const prefilledRows = chosen.map((todo, index) => {
      const targetKey = todo.householder_id
        ? `householder:${todo.householder_id}`
        : todo.establishment_id
          ? `establishment:${todo.establishment_id}`
          : "none";
      const slots = [todo.publisher_id, todo.partner_id]
        .filter((value): value is string => !!value)
        .filter((value, idx, arr) => arr.indexOf(value) === idx)
        .slice(0, 2);
      if (slots.length < 2 && todo.publisher_guest_name?.trim()) {
        slots.push(`${GUEST_SLOT_PREFIX}${todo.publisher_guest_name.trim()}`);
      }
      if (slots.length < 2 && todo.partner_guest_name?.trim()) {
        slots.push(`${GUEST_SLOT_PREFIX}${todo.partner_guest_name.trim()}`);
      }
      return {
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        targetKey,
        body: todo.body ?? "",
        slots,
        dueDate: todo.deadline_date ?? null,
        sourceTodoId: todo.id,
        sourceCallId: todo.call_id ?? null,
        original: {
          targetKey,
          body: todo.body ?? "",
          slots,
          dueDate: todo.deadline_date ?? null,
        },
      };
    });

    try {
      const raw = window.localStorage.getItem(BULK_TODO_DRAFT_KEY);
      const parsed = raw ? (JSON.parse(raw) as { rows?: unknown[] }) : null;
      const existingRows = Array.isArray(parsed?.rows) ? parsed.rows : [];
      if (existingRows.length > 0) {
        setPendingBulkPrefillRows(prefilledRows);
        setBulkDraftMergePromptOpen(true);
        return;
      }
    } catch {}

    applyBulkEditRows(prefilledRows, "overwrite");
  }, [selectedTodoIds, selectableTodos, applyBulkEditRows]);

  const displayTodos = cardOpenTodos.slice(0, 5);
  const openCount = filteredOpenTodos.length;
  const doneCount = filteredCompletedTodos.length;
  const hasNavigation = !!(onNavigateToTodoCall || onTodoTap);
  const showAssigneeAvatars = Boolean(userId || establishmentId || householderId);
  const showOtherPublisherDecorations = Boolean(
    userId && !establishmentId && !householderId && !filters.myUpdatesOnly
  );
  const isTodoAssigned = useCallback((todo: MyOpenCallTodoItem) => {
    return Boolean(
      todo.publisher_id ||
      todo.partner_id ||
      todo.publisher_guest_name?.trim() ||
      todo.partner_guest_name?.trim()
    );
  }, []);
  const filteredAssignedOpenTodos = useMemo(
    () => filteredOpenTodos.filter(isTodoAssigned),
    [filteredOpenTodos, isTodoAssigned]
  );
  const filteredUnassignedOpenTodos = useMemo(
    () => filteredOpenTodos.filter((todo) => !isTodoAssigned(todo)),
    [filteredOpenTodos, isTodoAssigned]
  );
  const emptyText = userId
    ? "No open to-dos from your calls"
    : "No open to-dos for this call history";
  const emptyDrawerText = userId
    ? "No to-dos from your calls"
    : "No to-dos for this call history";
  const isHouseholderDetail = Boolean(selectedTodoForDetails?.householder_id);
  const selectedEstablishmentDetails = selectedTodoDetails?.establishment ?? null;
  const detailPrimaryStatus = selectedEstablishmentDetails
    ? getBestStatus(selectedEstablishmentDetails.statuses || [])
    : "for_scouting";
  const detailSurfaceClass = selectedEstablishmentDetails
    ? getStatusColor(detailPrimaryStatus)
    : "";
  const detailDescription = selectedEstablishmentDetails?.description?.trim() ?? "";
  const detailNote = selectedEstablishmentDetails?.note?.trim() ?? "";
  const detailFloor = selectedEstablishmentDetails?.floor?.trim() ?? "";
  const detailArea = selectedEstablishmentDetails?.area?.trim() ?? "";
  const selectedHouseholder = selectedHouseholderDetails?.householder ?? null;
  const selectedHouseholderEstablishment = selectedHouseholderDetails?.establishment ?? null;
  const householderSurfaceClass = selectedHouseholder
    ? (selectedHouseholder.publisher_id
        ? "border-emerald-500/45 bg-emerald-500/8"
        : getHouseholderCardColor(selectedHouseholder.status))
    : "";
  const householderArea =
    selectedHouseholderEstablishment?.area?.trim() ?? "";
  const householderEstablishmentName =
    selectedHouseholderEstablishment?.name?.trim() ||
    selectedHouseholder?.establishment_name?.trim() ||
    "";
  const selectedDetailVisits = useMemo(
    () =>
      [...(isHouseholderDetail ? selectedHouseholderDetails?.visits ?? [] : selectedTodoDetails?.visits ?? [])].sort(
        (a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()
      ),
    [isHouseholderDetail, selectedHouseholderDetails?.visits, selectedTodoDetails?.visits]
  );
  const selectedDetailHouseholders = selectedTodoDetails?.householders ?? [];
  const contactSubdrawerHouseholder = contactSubdrawerDetails?.householder ?? selectedContactFromEstablishment;
  const contactSubdrawerEstablishment = contactSubdrawerDetails?.establishment ?? null;
  const contactSubdrawerVisits = useMemo(
    () =>
      [...(contactSubdrawerDetails?.visits ?? [])].sort(
        (a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()
      ),
    [contactSubdrawerDetails?.visits]
  );
  const contactSubdrawerSurfaceClass = contactSubdrawerHouseholder
    ? (contactSubdrawerHouseholder.publisher_id
        ? "border-emerald-500/45 bg-emerald-500/8"
        : getHouseholderCardColor(contactSubdrawerHouseholder.status))
    : "";
  const contactSubdrawerArea = contactSubdrawerEstablishment?.area?.trim() ?? "";
  const contactSubdrawerEstablishmentName =
    contactSubdrawerEstablishment?.name?.trim() ||
    contactSubdrawerHouseholder?.establishment_name?.trim() ||
    "";
  const openContactDetailsSubdrawer = useCallback((householder: HouseholderWithDetails) => {
    const cached = householderDetailsCacheRef.current.get(householder.id);
    if (cached) {
      setContactSubdrawerDetails(cached);
    } else {
      setContactSubdrawerDetails({
        householder,
        visits: [],
        establishment: householder.establishment_id
          ? {
              id: householder.establishment_id,
              name: householder.establishment_name ?? "",
              area: null,
            }
          : null,
      });
    }

    // Prime scoped to-do snapshot so nested householder card opens from local cache instantly.
    const now = Date.now();
    const scopedOpen = openTodos.filter((item) => item.householder_id === householder.id);
    const scopedCompleted = completedTodos.filter((item) => item.householder_id === householder.id);
    const scopedKey = `householder:${householder.id}`;
    cacheSet(TODOS_CACHE_KEY(scopedKey), { open: scopedOpen, completed: scopedCompleted });
    writeLocalTodosCache(scopedKey, scopedOpen, scopedCompleted, now);

    setSelectedContactFromEstablishment(householder);
    setContactDetailsSubdrawerOpen(true);
  }, [openTodos, completedTodos]);
  useEffect(() => {
    if (!todoDetailsDrawerOpen || isHouseholderDetail) return;
    if (selectedDetailHouseholders.length === 0) return;

    Promise.all(
      selectedDetailHouseholders.slice(0, 20).map(async (householder) => {
        if (!householder.id || householderDetailsCacheRef.current.has(householder.id)) return;
        const result = await getHouseholderDetails(householder.id);
        if (!result) return;
        householderDetailsCacheRef.current.set(householder.id, {
          householder: result.householder,
          visits: result.visits,
          establishment: result.establishment,
        });
      })
    ).catch(() => {
      // prewarm only
    });
  }, [todoDetailsDrawerOpen, isHouseholderDetail, selectedDetailHouseholders]);

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
          <ul className="space-y-2.5">
            {cardOpenTodos.length === 0 ? (
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
                  currentUserId={userId}
                  showAssigneeAvatars={showAssigneeAvatars}
                  highlightOtherPublishers={showOtherPublisherDecorations}
                  participantsById={participantsById}
                  rowIndex={index}
                  layoutId={`${layoutScopeId}-card-${todo.id}`}
                  layoutTransition={todoLayoutTransition}
                  hideHouseholderNameBadge={!!householderId}
                />
              ))
            )}
          </ul>
          {cardCompletedTodos.length > 0 && (
            <>
              <div className="text-xs text-muted-foreground mt-4 mb-2 font-medium">Done</div>
              <ul className="space-y-2.5">
                {cardCompletedTodos.slice(0, 3).map((todo, index) => (
                  <TodoRow
                    key={todo.id}
                    todo={{ ...todo, is_done: true }}
                    timeZone={timeZone}
                    onMarkDone={handleMarkDone}
                    onTap={hasNavigation ? handleTodoTap : undefined}
                    showCheckbox
                    currentUserId={userId}
                    showAssigneeAvatars={showAssigneeAvatars}
                    highlightOtherPublishers={showOtherPublisherDecorations}
                    participantsById={participantsById}
                    rowIndex={index}
                    layoutId={`${layoutScopeId}-card-${todo.id}`}
                    layoutTransition={todoLayoutTransition}
                    hideHouseholderNameBadge={!!householderId}
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
          if (!open) {
            setDrawerTodoExpanded(true);
            setDrawerOpenSectionExpanded(false);
            setDrawerDoneExpanded(false);
            setFilterDrawerOpen(false);
          }
        }}
      >
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="px-4 pt-4 pb-2 items-center">
            <DrawerTitle className="flex w-full items-center justify-center gap-2 text-center text-lg font-bold">
              <ListTodo className="h-4 w-4 shrink-0" />
              To-Do
              <Badge
                variant="secondary"
                className="h-5 rounded-full px-2 text-[11px] leading-none"
              >
                Open {openCount}
              </Badge>
              <Badge
                variant="outline"
                className="h-5 rounded-full px-2 text-[11px] leading-none"
              >
                Done {doneCount}
              </Badge>
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]">
              {userId && !establishmentId && !householderId && (
                <div className="mb-4 w-full overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  <div className="w-max min-w-full flex justify-center">
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
                    showMyFilter={Boolean(userId)}
                    myActive={Boolean(userId) && filters.myUpdatesOnly}
                    myLabel="My To-Dos"
                    onMyActivate={() =>
                      setFilters((prev) => ({
                        ...prev,
                        myUpdatesOnly: true,
                      }))
                    }
                    onMyClear={() =>
                      setFilters((prev) => ({
                        ...prev,
                        myUpdatesOnly: false,
                      }))
                    }
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
                    onOpenFilters={() => setFilterDrawerOpen(true)}
                    onClearFilters={clearFilters}
                    preserveActionButtonsWhenTogglesActive
                    showEditButton
                    editLabel="Edit To-Dos"
                    onEditClick={openBulkEditPrompt}
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
                      } else if (badge.type === "assignee") {
                        setFilters((prev) => ({
                          ...prev,
                          assigneeIds: prev.assigneeIds.filter((id) => id !== badge.value),
                        }));
                      } else if (badge.type === "due_date") {
                        setDueDateFilter(null);
                      }
                    }}
                    containerClassName={
                      isSearchActive ? "w-full !max-w-none !px-0" : "justify-center whitespace-nowrap"
                    }
                    maxWidthClassName={isSearchActive ? "" : "mx-4"}
                  />
                  </div>
                </div>
              )}

              {filteredOpenTodos.length === 0 && filteredCompletedTodos.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">{emptyDrawerText}</p>
              ) : (
                <>
                  <div className="mt-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setDrawerTodoExpanded((prev) => !prev)}
                      className="w-full flex items-center justify-between text-sm text-muted-foreground font-bold hover:text-foreground transition-colors"
                    >
                      <span>To-Do ({filteredAssignedOpenTodos.length})</span>
                      {drawerTodoExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                  </div>
                  {drawerTodoExpanded && (
                    filteredAssignedOpenTodos.length > 0 ? (
                      <ul className="space-y-3 pb-2">
                        {filteredAssignedOpenTodos.map((todo, index) => (
                          <TodoRow
                            key={todo.id}
                            todo={todo}
                            timeZone={timeZone}
                            onMarkDone={handleMarkDone}
                            onTap={hasNavigation ? handleTodoTap : undefined}
                            showCheckbox
                            currentUserId={userId}
                            showAssigneeAvatars={showAssigneeAvatars}
                            highlightOtherPublishers={showOtherPublisherDecorations}
                            participantsById={participantsById}
                            rowIndex={index}
                            layoutId={`${layoutScopeId}-drawer-${todo.id}`}
                            layoutTransition={todoLayoutTransition}
                            clampBody={false}
                            hideHouseholderNameBadge={!!householderId}
                          />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground py-1 mb-2">No assigned to-dos.</p>
                    )
                  )}

                  <div className="mt-4 mb-3">
                    <button
                      type="button"
                      onClick={() => setDrawerOpenSectionExpanded((prev) => !prev)}
                      className="w-full flex items-center justify-between text-sm text-muted-foreground font-bold hover:text-foreground transition-colors"
                    >
                      <span>Open ({filteredUnassignedOpenTodos.length})</span>
                      {drawerOpenSectionExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                  </div>
                  {drawerOpenSectionExpanded && (
                    filteredUnassignedOpenTodos.length > 0 ? (
                      <ul className="space-y-3 pb-2">
                        {filteredUnassignedOpenTodos.map((todo, index) => (
                          <TodoRow
                            key={todo.id}
                            todo={todo}
                            timeZone={timeZone}
                            onMarkDone={handleMarkDone}
                            onTap={hasNavigation ? handleTodoTap : undefined}
                            showCheckbox
                            currentUserId={userId}
                            showAssigneeAvatars={showAssigneeAvatars}
                            highlightOtherPublishers={showOtherPublisherDecorations}
                            participantsById={participantsById}
                            rowIndex={index}
                            layoutId={`${layoutScopeId}-drawer-${todo.id}`}
                            layoutTransition={todoLayoutTransition}
                            clampBody={false}
                            hideHouseholderNameBadge={!!householderId}
                          />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground py-1 mb-2">No unassigned to-dos.</p>
                    )
                  )}

                  <div className="mt-4 mb-3">
                    <button
                      type="button"
                      onClick={() => setDrawerDoneExpanded((prev) => !prev)}
                      className="w-full flex items-center justify-between text-sm text-muted-foreground font-bold hover:text-foreground transition-colors"
                    >
                      <span>Done ({filteredCompletedTodos.length})</span>
                      {drawerDoneExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </button>
                  </div>
                  {drawerDoneExpanded && (
                    filteredCompletedTodos.length > 0 ? (
                      <ul className="space-y-3">
                        {filteredCompletedTodos.map((todo, index) => (
                          <TodoRow
                            key={todo.id}
                            todo={{ ...todo, is_done: true }}
                            timeZone={timeZone}
                            onMarkDone={handleMarkDone}
                            onTap={hasNavigation ? handleTodoTap : undefined}
                            showCheckbox
                            currentUserId={userId}
                            showAssigneeAvatars={showAssigneeAvatars}
                            highlightOtherPublishers={showOtherPublisherDecorations}
                            participantsById={participantsById}
                            rowIndex={index}
                            layoutId={`${layoutScopeId}-drawer-${todo.id}`}
                            layoutTransition={todoLayoutTransition}
                            clampBody={false}
                            hideHouseholderNameBadge={!!householderId}
                          />
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground py-1">No done to-dos.</p>
                    )
                  )}
                </>
              )}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader className="px-4 pt-4 pb-2 items-center">
            <DrawerTitle className="flex w-full items-center justify-center gap-2 text-center text-lg font-bold">
              <ListTodo className="h-4 w-4 shrink-0" />
              Filter To-Dos
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]">
            <div className="space-y-2 mb-4">
              <Label>Due Date</Label>
              <DatePicker
                date={dueDateFilter ?? undefined}
                onSelect={(date) => setDueDateFilter(date ?? null)}
                placeholder="Select due date"
                mobileShowActions
                mobileAllowClear
                defaultToTodayOnOpen
              />
            </div>
            <VisitFiltersForm
              filters={filters}
              statusOptions={statusOptions}
              areaOptions={areaOptions}
              assigneeOptions={assigneeFilterOptions}
              onFiltersChange={setFilters}
              onClearFilters={clearFilters}
            />
            <div className="flex justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFilterDrawerOpen(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={todoDetailsDrawerOpen}
        onOpenChange={(open) => {
          setTodoDetailsDrawerOpen(open);
        }}
      >
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="px-4 pt-4 pb-2 items-center">
            <DrawerTitle className="flex w-full items-center justify-center gap-2 text-center text-xl font-extrabold tracking-tight">
              {isHouseholderDetail
                ? (selectedHouseholder?.name || selectedTodoForDetails?.context_name || "Contact Details")
                : (selectedEstablishmentDetails?.name || selectedTodoForDetails?.context_name || "Establishment Details")}
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] space-y-3">
            {isLoadingTodoDetails && !selectedTodoDetails && !selectedHouseholderDetails ? (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading details...</div>
            ) : (
              isHouseholderDetail ? (
                <Card className={cn("w-full", householderSurfaceClass)}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <div className="flex w-full min-w-0 flex-1 flex-wrap items-center gap-2 pr-1">
                      {selectedHouseholder?.status?.trim() ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "flex-shrink-0 capitalize",
                            getHouseholderStatusColorClass(selectedHouseholder.status)
                          )}
                        >
                          {formatStatusText(selectedHouseholder.status)}
                        </Badge>
                      ) : null}
                    </div>
                    {selectedHouseholder?.lat != null && selectedHouseholder?.lng != null ? (
                      <a
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/60 bg-primary/10 text-primary shadow-sm transition-all hover:bg-primary/20 hover:border-primary hover:scale-[1.03] active:scale-100"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedHouseholder.lat},${selectedHouseholder.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open directions"
                        title="Open directions"
                      >
                        <MapPinned className="h-4 w-4" />
                      </a>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {householderArea ? (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Area</p>
                          <p>{householderArea}</p>
                        </div>
                      ) : null}
                      {householderEstablishmentName ? (
                        <div className={householderArea ? undefined : "col-span-2"}>
                          <p className="text-sm font-medium text-muted-foreground">Establishment</p>
                          <p className="break-words">{householderEstablishmentName}</p>
                        </div>
                      ) : null}
                      {selectedHouseholder?.note?.trim() ? (
                        <div className="col-span-2">
                          <p className="text-sm font-medium text-muted-foreground">Note</p>
                          <p className="text-sm break-words">{selectedHouseholder.note.trim()}</p>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className={cn("w-full", detailSurfaceClass)}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      {selectedEstablishmentDetails ? (
                        <>
                          <Badge
                            variant="outline"
                            className={cn("flex-shrink-0", getStatusTextColor(detailPrimaryStatus))}
                          >
                            {formatStatusText(detailPrimaryStatus)}
                          </Badge>
                          {(selectedEstablishmentDetails.statuses || [])
                            .filter((status) => status !== detailPrimaryStatus)
                            .slice(0, 2)
                            .map((status) => (
                              <Badge
                                key={status}
                                variant="outline"
                                className={getStatusTextColor(status)}
                              >
                                {formatStatusText(status)}
                              </Badge>
                            ))}
                        </>
                      ) : null}
                    </div>
                    {selectedEstablishmentDetails?.lat != null && selectedEstablishmentDetails?.lng != null ? (
                      <a
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/60 bg-primary/10 text-primary shadow-sm transition-all hover:bg-primary/20 hover:border-primary hover:scale-[1.03] active:scale-100"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedEstablishmentDetails.lat},${selectedEstablishmentDetails.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open directions"
                        title="Open directions"
                      >
                        <MapPinned className="h-4 w-4" />
                      </a>
                    ) : null}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {detailArea ? (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Area</p>
                          <p>{detailArea}</p>
                        </div>
                      ) : null}
                      {detailDescription ? (
                        <div className={detailFloor ? undefined : "col-span-2"}>
                          <p className="text-sm font-medium text-muted-foreground">Description</p>
                          <p className="break-words">{detailDescription}</p>
                        </div>
                      ) : null}
                      {detailDescription && detailFloor ? (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Floor</p>
                          <p>{detailFloor}</p>
                        </div>
                      ) : null}
                      {!detailDescription && detailNote ? (
                        <div className={detailFloor ? undefined : "col-span-2"}>
                          <p className="text-sm font-medium text-muted-foreground">Note</p>
                          <p className="text-sm break-words">
                            {detailNote.length > 100 ? `${detailNote.slice(0, 100)}...` : detailNote}
                          </p>
                        </div>
                      ) : null}
                      {!detailDescription && detailNote && detailFloor ? (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Floor</p>
                          <p>{detailFloor}</p>
                        </div>
                      ) : null}
                      {detailDescription && detailNote ? (
                        <div className="col-span-2">
                          <p className="text-sm font-medium text-muted-foreground">Note</p>
                          <p className="text-sm break-words">
                            {detailNote.length > 100 ? `${detailNote.slice(0, 100)}...` : detailNote}
                          </p>
                        </div>
                      ) : null}
                      {!detailDescription && !detailNote && detailFloor ? (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Floor</p>
                          <p>{detailFloor}</p>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              )
            )}

            {isHouseholderDetail && selectedHouseholder?.id ? (
              <HomeTodoCard householderId={selectedHouseholder.id} />
            ) : null}
            {!isHouseholderDetail && selectedEstablishmentDetails?.id ? (
              <HomeTodoCard establishmentId={selectedEstablishmentDetails.id} />
            ) : null}

            {selectedDetailVisits.length > 0 ? (
              <VisitUpdatesSection
                visits={selectedDetailVisits}
                isHouseholderContext={isHouseholderDetail}
                establishments={
                  isHouseholderDetail
                    ? (selectedHouseholderEstablishment
                        ? [selectedHouseholderEstablishment]
                        : [])
                    : (selectedEstablishmentDetails
                        ? [{ id: selectedEstablishmentDetails.id ?? "", name: selectedEstablishmentDetails.name }]
                        : [])
                }
                selectedEstablishmentId={
                  isHouseholderDetail
                    ? selectedHouseholderEstablishment?.id
                    : selectedEstablishmentDetails?.id
                }
                householderId={isHouseholderDetail ? selectedHouseholder?.id : undefined}
                householderName={isHouseholderDetail ? selectedHouseholder?.name : undefined}
                householderStatus={isHouseholderDetail ? selectedHouseholder?.status : undefined}
                isLoading={false}
                onVisitUpdated={() => {
                  // parent snapshots refresh via cache/network flow
                }}
              />
            ) : null}

            {!isHouseholderDetail && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 flex-shrink-0" />
                    <span>Contacts{selectedDetailHouseholders.length ? ` (${selectedDetailHouseholders.length})` : ""}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {selectedDetailHouseholders.length > 0 ? (
                    <div className="px-4 py-2 space-y-2">
                      {selectedDetailHouseholders
                        .filter((householder, index, self) =>
                          index === self.findIndex((h) => h.id === householder.id)
                        )
                        .map((householder) => (
                          <button
                            key={householder.id}
                            type="button"
                            onClick={() => openContactDetailsSubdrawer(householder)}
                            className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors flex items-center gap-3"
                          >
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="text-[11px] font-semibold">
                                {getInitialsFromName(householder.name) || "HH"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium truncate">{householder.name}</p>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-xs px-2 py-0.5 h-5 leading-none",
                                    getHouseholderStatusColorClass(householder.status)
                                  )}
                                >
                                  {formatStatusText(householder.status)}
                                </Badge>
                              </div>
                              {householder.note && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {householder.note}
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground px-4">
                      <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No contacts yet</p>
                      <p className="text-sm">Contacts will appear here when calls are added</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={contactDetailsSubdrawerOpen}
        onOpenChange={(open) => {
          setContactDetailsSubdrawerOpen(open);
          if (!open) {
            setSelectedContactFromEstablishment(null);
          }
        }}
      >
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="px-4 pt-4 pb-2 items-center">
            <DrawerTitle className="flex w-full items-center justify-center gap-2 text-center text-xl font-extrabold tracking-tight">
              {contactSubdrawerHouseholder?.name || "Contact Details"}
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] space-y-3">
            {isLoadingContactSubdrawerDetails && !contactSubdrawerHouseholder ? (
              <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading details...</div>
            ) : null}

            {contactSubdrawerHouseholder ? (
              <Card className={cn("w-full", contactSubdrawerSurfaceClass)}>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <div className="flex w-full min-w-0 flex-1 flex-wrap items-center gap-2 pr-1">
                    {contactSubdrawerHouseholder.status?.trim() ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "flex-shrink-0 capitalize",
                          getHouseholderStatusColorClass(contactSubdrawerHouseholder.status)
                        )}
                      >
                        {formatStatusText(contactSubdrawerHouseholder.status)}
                      </Badge>
                    ) : null}
                  </div>
                  {contactSubdrawerHouseholder.lat != null && contactSubdrawerHouseholder.lng != null ? (
                    <a
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/60 bg-primary/10 text-primary shadow-sm transition-all hover:bg-primary/20 hover:border-primary hover:scale-[1.03] active:scale-100"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${contactSubdrawerHouseholder.lat},${contactSubdrawerHouseholder.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open directions"
                      title="Open directions"
                    >
                      <MapPinned className="h-4 w-4" />
                    </a>
                  ) : null}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {contactSubdrawerArea ? (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Area</p>
                        <p>{contactSubdrawerArea}</p>
                      </div>
                    ) : null}
                    {contactSubdrawerEstablishmentName ? (
                      <div className={contactSubdrawerArea ? undefined : "col-span-2"}>
                        <p className="text-sm font-medium text-muted-foreground">Establishment</p>
                        <p className="break-words">{contactSubdrawerEstablishmentName}</p>
                      </div>
                    ) : null}
                    {contactSubdrawerHouseholder.note?.trim() ? (
                      <div className="col-span-2">
                        <p className="text-sm font-medium text-muted-foreground">Note</p>
                        <p className="text-sm break-words">{contactSubdrawerHouseholder.note.trim()}</p>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {contactSubdrawerHouseholder?.id ? (
              <HomeTodoCard householderId={contactSubdrawerHouseholder.id} />
            ) : null}

            {contactSubdrawerVisits.length > 0 ? (
              <VisitUpdatesSection
                visits={contactSubdrawerVisits}
                isHouseholderContext
                establishments={contactSubdrawerEstablishment ? [contactSubdrawerEstablishment] : []}
                selectedEstablishmentId={contactSubdrawerEstablishment?.id}
                householderId={contactSubdrawerHouseholder?.id}
                householderName={contactSubdrawerHouseholder?.name}
                householderStatus={contactSubdrawerHouseholder?.status}
                isLoading={false}
                onVisitUpdated={() => {
                  // parent snapshots refresh via cache/network flow
                }}
              />
            ) : null}
          </div>
        </DrawerContent>
      </Drawer>

      <FormModal
        open={bulkEditPromptOpen}
        onOpenChange={setBulkEditPromptOpen}
        title="Edit To-Dos"
        description="Select which filtered to-dos to load into bulk edit."
        headerClassName="text-center"
      >
        <div className="space-y-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]">
          <div className="overflow-hidden rounded-md border">
            {selectableTodos.length === 0 ? (
              <p className="text-sm text-muted-foreground px-2 py-3">No to-dos available from current filters.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b bg-muted/25 px-3 py-2">
                  <Checkbox
                    id="bulk-edit-select-all"
                    checked={
                      bulkEditSelectAllState.allSelected
                        ? true
                        : bulkEditSelectAllState.someSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={(value) => toggleBulkEditSelectAll(value === true)}
                    aria-label={bulkEditSelectAllState.allSelected ? "Unselect all" : "Select all"}
                  />
                  <Label htmlFor="bulk-edit-select-all" className="text-sm font-medium cursor-pointer">
                    Select all
                  </Label>
                </div>
                <div className="max-h-[50vh] overflow-y-auto space-y-2 p-2">
                  {selectableTodos.map((todo) => (
                    <BulkEditTodoListItem
                      key={todo.id}
                      todo={todo}
                      checked={selectedTodoIds.includes(todo.id)}
                      participantsById={participantsById}
                      onCheckedChange={(next) => toggleSelectedTodo(todo.id, next)}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setBulkEditPromptOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmBulkEdit}
              disabled={selectedTodoIds.length === 0}
            >
              Load Selected ({selectedTodoIds.length})
            </Button>
          </div>
        </div>
      </FormModal>

      <FormModal
        open={bulkDraftMergePromptOpen}
        onOpenChange={setBulkDraftMergePromptOpen}
        title="Existing To-Dos in Draft"
        description="Choose how to load selected to-dos into the bulk form."
        headerClassName="text-center"
      >
        <div className="space-y-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]">
          <p className="text-sm text-muted-foreground">
            You already have unsubmitted to-dos in the bulk form.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setBulkDraftMergePromptOpen(false);
                setPendingBulkPrefillRows([]);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => applyBulkEditRows(pendingBulkPrefillRows, "overwrite")}
            >
              Overwrite
            </Button>
            <Button
              type="button"
              onClick={() => applyBulkEditRows(pendingBulkPrefillRows, "append")}
            >
              Add to Existing
            </Button>
          </div>
        </div>
      </FormModal>
    </>
  );
}

/** Edit To-Dos picker row — matches drawer density: context badges, assignees, due date, body, area. */
function BulkEditTodoListItem({
  todo,
  checked,
  participantsById,
  onCheckedChange,
}: {
  todo: MyOpenCallTodoItem;
  checked: boolean;
  participantsById: Record<string, { first_name: string; last_name: string; avatar_url?: string }>;
  onCheckedChange: (checked: boolean) => void;
}) {
  const householderStatus = todo.context_status || "for_scouting";
  const establishmentStatus = todo.context_establishment_status || "for_scouting";
  const isHouseholder = !!todo.householder_id;
  const assigneeIds = [todo.publisher_id, todo.partner_id]
    .filter((value): value is string => !!value)
    .filter((value, idx, arr) => arr.indexOf(value) === idx)
    .slice(0, 2);
  const areaLabel = todo.context_area?.trim() ?? "";
  const displayDate = todo.deadline_date;

  return (
    <label className="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-muted/40 cursor-pointer">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-1 shrink-0 h-5 w-5"
      />
      <div className="min-w-0 flex-1 flex flex-col gap-2 pr-2.5">
        {todo.context_name || assigneeIds.length > 0 ? (
          <div className="flex items-center gap-1.5 min-w-0 w-full">
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
              {todo.context_name ? (
                <>
                  {isHouseholder ? (
                    <span className="inline-flex items-center gap-1 min-w-0 max-w-[72%] shrink">
                      <VisitStatusBadge
                        status={householderStatus}
                        label={truncateLabel(todo.context_name, 28)}
                        className="truncate max-w-full whitespace-nowrap"
                      />
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 min-w-0 max-w-[72%] shrink">
                      <VisitStatusBadge
                        status={establishmentStatus}
                        label={truncateLabel(todo.context_name, 28)}
                        className="truncate max-w-full whitespace-nowrap"
                      />
                    </span>
                  )}
                  {isHouseholder && todo.context_establishment_name ? (
                    <VisitStatusBadge
                      status={establishmentStatus}
                      label={truncateLabel(todo.context_establishment_name, 24)}
                      className="truncate min-w-0 max-w-[55%] whitespace-nowrap border-muted bg-muted/50"
                    />
                  ) : null}
                </>
              ) : null}
            </div>
            {assigneeIds.length > 0 ? (
              <div className="inline-flex items-center gap-1 shrink-0 ml-auto pl-1">
                {assigneeIds.map((id) => {
                  const profile = participantsById[id];
                  const fullName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Assigned";
                  return (
                    <Avatar key={`${todo.id}-${id}`} className="h-5 w-5 border border-border/70">
                      {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={fullName} /> : null}
                      <AvatarFallback className="text-[10px]">{getInitialsFromName(fullName || "A")}</AvatarFallback>
                    </Avatar>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-start gap-2 w-full min-w-0">
          <p className="text-left text-base leading-snug line-clamp-2 flex-1 min-w-0">{todo.body}</p>
          {displayDate || areaLabel ? (
            <div className="flex flex-col items-end gap-0.5 shrink-0 max-w-[45%] text-right">
              {displayDate ? (
                <span className="text-xs text-muted-foreground tabular-nums leading-snug pt-0.5">
                  {formatTodoDate(displayDate)}
                </span>
              ) : null}
              {areaLabel ? (
                <span className="text-xs text-muted-foreground leading-snug" title={areaLabel}>
                  {truncateLabel(areaLabel, 36)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </label>
  );
}

function TodoRow({
  todo,
  timeZone,
  onMarkDone,
  onTap,
  showCheckbox = false,
  currentUserId,
  showAssigneeAvatars = false,
  highlightOtherPublishers = false,
  participantsById = {},
  layoutId,
  layoutTransition,
  rowIndex,
  clampBody = true,
  hideHouseholderNameBadge = false,
}: {
  todo: MyOpenCallTodoItem;
  timeZone: string | null;
  onMarkDone: (todo: MyOpenCallTodoItem, checked: boolean) => void;
  onTap?: (todo: MyOpenCallTodoItem) => void;
  showCheckbox?: boolean;
  currentUserId?: string;
  showAssigneeAvatars?: boolean;
  highlightOtherPublishers?: boolean;
  participantsById?: Record<string, { first_name: string; last_name: string; avatar_url?: string }>;
  layoutId?: string;
  layoutTransition?: { type: "spring"; stiffness: number; damping: number };
  rowIndex?: number;
  clampBody?: boolean;
  hideHouseholderNameBadge?: boolean;
}) {
  const canNavigate = !!onTap && (!!todo.call_id || !!todo.establishment_id || !!todo.householder_id);
  const householderStatus = todo.context_status || "for_scouting";
  const establishmentStatus = todo.context_establishment_status || "for_scouting";
  const isDone = !!todo.is_done;
  const displayDate = todo.deadline_date;
  const isHouseholder = !!todo.householder_id;
  const isEvenRow = typeof rowIndex === "number" && rowIndex % 2 === 1;
  const isMine = !currentUserId || todo.publisher_id === currentUserId || todo.partner_id === currentUserId;
  const hasOtherPublisherHighlight = highlightOtherPublishers && !isMine;
  const ageBorderClass = isDone ? "" : getTodoAgeBorderClass(displayDate, hasOtherPublisherHighlight);
  const assigneeIds = [todo.publisher_id, todo.partner_id]
    .filter((value): value is string => !!value)
    .filter((value, idx, arr) => arr.indexOf(value) === idx)
    .slice(0, 2);
  const areaLabel = todo.context_area?.trim() ?? "";
  const content = (
    <>
      {showCheckbox ? (
        <Checkbox
          checked={isDone}
          onCheckedChange={(checked) => onMarkDone(todo, checked === true)}
          className="shrink-0 h-5 w-5"
          aria-label={isDone ? "Mark as not done" : "Mark as done"}
        />
      ) : (
        <span
          className="rounded border border-border bg-muted/50 w-5 h-5 shrink-0"
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1 flex flex-col gap-2.5 pr-2.5">
        {todo.context_name || (showAssigneeAvatars && assigneeIds.length > 0) ? (
          <div className="flex items-center gap-1.5 min-w-0 w-full">
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
              {todo.context_name ? (
                <>
                  {isHouseholder ? (
                    hideHouseholderNameBadge ? null : (
                      <span className="inline-flex items-center gap-1 min-w-0 max-w-[72%] shrink">
                        <VisitStatusBadge
                          status={householderStatus}
                          label={truncateLabel(todo.context_name, 28)}
                          className={cn("truncate max-w-full whitespace-nowrap", isDone && "opacity-70")}
                        />
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1 min-w-0 max-w-[72%] shrink">
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
                      className={cn(
                        "truncate min-w-0 max-w-[55%] whitespace-nowrap border-muted bg-muted/50",
                        isDone && "opacity-70"
                      )}
                    />
                  ) : null}
                </>
              ) : null}
            </div>
            {showAssigneeAvatars && assigneeIds.length > 0 ? (
              <div className="inline-flex items-center gap-1 shrink-0 ml-auto pl-1">
                {assigneeIds.map((id) => {
                  const profile = participantsById[id];
                  const fullName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Assigned";
                  return (
                    <Avatar key={`${todo.id}-${id}`} className="h-5 w-5 border border-border/70">
                      {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={fullName} /> : null}
                      <AvatarFallback className="text-[10px]">
                        {getInitialsFromName(fullName || "A")}
                      </AvatarFallback>
                    </Avatar>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-start gap-2 w-full min-w-0">
          <button
            type="button"
            onClick={() => onTap?.(todo)}
            className={cn(
              "text-left text-base leading-snug py-0.5 rounded flex-1 min-w-0",
              clampBody && "line-clamp-2",
              canNavigate && "hover:bg-muted/50 active:bg-muted transition-colors",
              isDone && "text-muted-foreground line-through"
            )}
            disabled={!canNavigate}
          >
            {todo.body}
          </button>
          {displayDate || areaLabel ? (
            <div
              className={cn(
                "flex flex-col items-end gap-0.5 shrink-0 max-w-[45%] text-right",
                isDone && "opacity-70"
              )}
            >
              {displayDate ? (
                <span className="text-xs text-muted-foreground tabular-nums leading-snug pt-0.5">
                  {formatTodoDate(displayDate)}
                </span>
              ) : null}
              {areaLabel ? (
                <span className="text-xs text-muted-foreground leading-snug" title={areaLabel}>
                  {truncateLabel(areaLabel, 36)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
  const finalClassName = cn(
    "flex items-center gap-2 text-sm group rounded-md py-2.5 pl-2",
    isEvenRow && "bg-muted/30",
    hasOtherPublisherHighlight &&
      "border border-dashed border-muted-foreground/40 dark:border-muted-foreground/30 px-1.5 py-2.5",
    ageBorderClass
  );
  const otherPublisherStyle = undefined;
  if (layoutId) {
    return (
      <motion.li
        layoutId={layoutId}
        layout
        transition={layoutTransition}
        className={finalClassName}
        style={otherPublisherStyle}
      >
        {content}
      </motion.li>
    );
  }
  return (
    <li className={finalClassName} style={otherPublisherStyle}>
      {content}
    </li>
  );
}
