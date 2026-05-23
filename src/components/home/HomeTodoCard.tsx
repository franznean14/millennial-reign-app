"use client";

import { useEffect, useState, useCallback, useRef, useMemo, useId, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  ListTodo,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  MapPinned,
} from "lucide-react";
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
  updateStandaloneTodo,
  type MyOpenCallTodoItem,
  type EstablishmentWithDetails,
  type VisitWithUser,
  type HouseholderWithDetails,
  type HouseholderStatus,
} from "@/lib/db/business";
import { getProfile } from "@/lib/db/profiles";
import { cacheGet, cacheSet, cacheDelete } from "@/lib/offline/store";
import {
  establishmentDetailsCacheKey,
  householderDetailsCacheKey,
  resolveEstablishmentDetailsSnapshot,
  resolveHouseholderDetailsSnapshot,
  warmEstablishmentDetailsInMemory,
  warmHouseholderDetailsInMemory,
  type EstablishmentDetailsSnapshot,
  type HouseholderDetailsSnapshot,
} from "@/lib/db/entity-details-cache";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FilterControls, type FilterBadge } from "@/components/shared/FilterControls";
import {
  VisitFiltersForm,
  type VisitFilters,
  type VisitFilterOption,
  type VisitAssigneeFilterOption,
} from "@/components/visit/VisitFiltersForm";
import { buildFilterBadges } from "@/lib/utils/filter-badges";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerWideRightContent,
  DrawerWideLeftContent,
  DrawerWideLeftContentTop,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { VisitStatusBadge } from "@/components/visit/VisitStatusBadge";
import { cn } from "@/lib/utils";
import { formatStatusText } from "@/lib/utils/formatters";
import { Badge } from "@/components/ui/badge";
import { FormModal } from "@/components/shared/FormModal";
import { useHomeTodoDetailsFabOptional } from "@/components/home/home-todo-details-fab-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAssigneeAvatarInitials } from "@/lib/utils/visit-history-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMobile } from "@/lib/hooks/use-mobile";
import { getBestStatus, getStatusColor, getStatusTextColor } from "@/lib/utils/status-hierarchy";
import { CallSection } from "@/components/business/CallSection";
import { ContactsSection } from "@/components/business/ContactsSection";
import { TodoForm } from "@/components/business/TodoForm";
import { EstablishmentForm } from "@/components/business/EstablishmentForm";
import { EstablishmentSummaryFields } from "@/components/business/EstablishmentSummaryFields";
import { HouseholderSummaryFields } from "@/components/business/HouseholderSummaryFields";
import { HouseholderForm } from "@/components/business/HouseholderForm";
import { useMediaQuery } from "@/hooks/use-media-query";
import { studyBibleDarkClasses, getStudyBibleDarkCardShade } from "@/lib/theme/study-bible-dark";
import { HomeMobileDetailsDrawer } from "@/components/home/HomeMobileDetailsDrawer";

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
const PARTICIPANTS_CACHE_KEY = "business:participants:local:v1";

type ParticipantProfile = { first_name: string; last_name: string; avatar_url?: string };

function participantsToById(
  participants: Array<{ id: string; first_name: string; last_name: string; avatar_url?: string }>
): Record<string, ParticipantProfile> {
  const nextMap: Record<string, ParticipantProfile> = {};
  participants.forEach((participant) => {
    if (!participant.id) return;
    nextMap[participant.id] = {
      first_name: participant.first_name,
      last_name: participant.last_name,
      avatar_url: participant.avatar_url,
    };
  });
  return nextMap;
}

type TodoEditorItem = MyOpenCallTodoItem & {
  call_note?: string | null;
  call_visit_date?: string | null;
  call_publishers?: string[];
};

type TodoEditorContext = {
  initialTodo: TodoEditorItem;
  establishments: Array<{ id?: string; name: string }>;
  selectedEstablishmentId?: string;
  householderId?: string;
  householderName?: string;
  disableEstablishmentSelect?: boolean;
};

type TodoMutationEventDetail = {
  kind: "upsert" | "delete" | "mark_done";
  todo?: Partial<MyOpenCallTodoItem> & { id: string };
  todoId?: string;
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

type TodoAssigneeSlot =
  | { type: "publisher"; id: string }
  | { type: "guest"; name: string };

function getTodoAssigneeSlots(todo: MyOpenCallTodoItem): TodoAssigneeSlot[] {
  const slots: TodoAssigneeSlot[] = [];
  if (todo.publisher_id) {
    slots.push({ type: "publisher", id: todo.publisher_id });
  } else if (todo.publisher_guest_name?.trim()) {
    slots.push({ type: "guest", name: todo.publisher_guest_name.trim() });
  }

  if (todo.partner_id) {
    if (!slots.some((slot) => slot.type === "publisher" && slot.id === todo.partner_id)) {
      slots.push({ type: "publisher", id: todo.partner_id });
    }
  } else if (todo.partner_guest_name?.trim()) {
    const guestName = todo.partner_guest_name.trim();
    if (!slots.some((slot) => slot.type === "guest" && slot.name === guestName)) {
      slots.push({ type: "guest", name: guestName });
    }
  }
  return slots.slice(0, 2);
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
  prefillScopeKey?: string;
  prefillOpenTodos?: MyOpenCallTodoItem[];
  prefillCompletedTodos?: MyOpenCallTodoItem[];
  onTodoTap?: (todo: MyOpenCallTodoItem) => void;
  onNavigateToTodoCall?: (params: {
    establishmentId?: string;
    householderId?: string;
  }) => void;
  /** When true (home to-do details companion), open scoped to-do list in a left sheet on tablet+ with a single column. */
  preferLeftCompanionDrawer?: boolean;
  /** When set, only this responsive instance publishes UnifiedFab context (HomeView mounts two cards). */
  fabBridgeLayout?: "belowXl" | "xlAndUp";
  className?: string;
  headerVariant?: "default" | "bar";
  /**
   * Headless mount (e.g. bulk target picker): render only establishment/contact details drawers and
   * nested editors — same surfaces as tapping a home to-do row.
   */
  detailsBridgeOnly?: boolean;
  detailsBridgeSyntheticTodo?: MyOpenCallTodoItem | null;
  detailsBridgeOpen?: boolean;
  onDetailsBridgeOpenChange?: (open: boolean) => void;
}

export function HomeTodoCard({
  userId,
  establishmentId,
  householderId,
  prefillScopeKey,
  prefillOpenTodos,
  prefillCompletedTodos,
  onTodoTap,
  onNavigateToTodoCall,
  preferLeftCompanionDrawer = false,
  fabBridgeLayout,
  className,
  headerVariant = "default",
  detailsBridgeOnly = false,
  detailsBridgeSyntheticTodo = null,
  detailsBridgeOpen = false,
  onDetailsBridgeOpenChange,
}: HomeTodoCardProps) {
  const [openTodos, setOpenTodos] = useState<MyOpenCallTodoItem[]>(() => prefillOpenTodos ?? []);
  const [completedTodos, setCompletedTodos] = useState<MyOpenCallTodoItem[]>(() => prefillCompletedTodos ?? []);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTodoExpanded, setDrawerTodoExpanded] = useState(true);
  const [drawerOpenSectionExpanded, setDrawerOpenSectionExpanded] = useState(true);
  const [drawerDoneExpanded, setDrawerDoneExpanded] = useState(false);
  const hasLoadedRef = useRef(false);
  const lastSyncedAtRef = useRef(0);
  const inFlightRef = useRef(false);
  const queuedForceRefreshRef = useRef(false);
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
  const [participantsById, setParticipantsById] = useState<Record<string, ParticipantProfile>>({});
  const [participantsReady, setParticipantsReady] = useState(false);
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
  const [todoEditorContext, setTodoEditorContext] = useState<TodoEditorContext | null>(null);
  const [todoEditorUseLeftPanel, setTodoEditorUseLeftPanel] = useState(false);
  const [detailsEntityEditOpen, setDetailsEntityEditOpen] = useState(false);
  /** Inline edit for a contact opened from the establishment-details subsheet (tablet left form). */
  const [contactSubdrawerEntityEditOpen, setContactSubdrawerEntityEditOpen] = useState(false);
  const [takeTodoConfirmOpen, setTakeTodoConfirmOpen] = useState(false);
  const [todoPendingTake, setTodoPendingTake] = useState<MyOpenCallTodoItem | null>(null);
  const [takingTodoId, setTakingTodoId] = useState<string | null>(null);
  /** Home-scope todo realtime filters call_todos/calls by congregation_id (from profile). */
  const [todoRealtimeCongregationId, setTodoRealtimeCongregationId] = useState<string | null>(null);
  const layoutScopeId = useId();
  /** Unique per mount — two HomeTodoCards can mount (hidden breakpoint sibling); Supabase reuses channel topics by name. */
  const realtimeChannelSlotRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `s${Math.random().toString(36).slice(2)}`
  );
  const establishmentDetailsCacheRef = useRef(new Map<string, EstablishmentDetailsSnapshot>());
  const householderDetailsCacheRef = useRef(new Map<string, HouseholderDetailsSnapshot>());
  const realtimeTodoReloadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useMobile();
  const isTodoDetailsSideLayout = useMediaQuery("(min-width: 768px)");
  const isXlViewport = useMediaQuery("(min-width: 1280px)");
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

  const todoDrawerShadeKey = scopeKey ?? `anon:${layoutScopeId}`;
  const todoMainDrawerPanelClass = useMemo(
    () => getStudyBibleDarkCardShade(`bwi-todos-list-drawer:${todoDrawerShadeKey}`),
    [todoDrawerShadeKey]
  );
  const todoFilterDrawerPanelClass = useMemo(
    () => getStudyBibleDarkCardShade(`bwi-todos-filter-drawer:${filterScopeKey ?? todoDrawerShadeKey}`),
    [filterScopeKey, todoDrawerShadeKey]
  );
  const todoDetailsSheetPanelClass = useMemo(
    () => getStudyBibleDarkCardShade(`bwi-todos-details:${todoDrawerShadeKey}`),
    [todoDrawerShadeKey]
  );
  const todoContactSheetPanelClass = useMemo(
    () => getStudyBibleDarkCardShade(`bwi-todos-contact:${todoDrawerShadeKey}`),
    [todoDrawerShadeKey]
  );
  const todoEntityEditSheetPanelClass = useMemo(
    () => getStudyBibleDarkCardShade(`bwi-todos-entity-edit:${todoDrawerShadeKey}`),
    [todoDrawerShadeKey]
  );
  const todoEditorSheetPanelClass = useMemo(
    () => getStudyBibleDarkCardShade(`bwi-todos-editor:${todoDrawerShadeKey}`),
    [todoDrawerShadeKey]
  );
  const todoBulkEditPickerPanelClass = useMemo(
    () => getStudyBibleDarkCardShade(`bwi-todos-bulk-edit-picker:${todoDrawerShadeKey}`),
    [todoDrawerShadeKey]
  );

  const loadTodos = useCallback((opts?: {
    useCache?: boolean;
    forceNetwork?: boolean;
    trustFreshLocalCache?: boolean;
    /** When true, never replace a non-empty in-memory list with an empty cache/network snapshot. */
    preserveNonEmpty?: boolean;
  }) => {
    if (!scopeKey) return;
    const useCache = opts?.useCache ?? true;
    const forceNetwork = opts?.forceNetwork ?? true;
    const trustFreshLocalCache = opts?.trustFreshLocalCache ?? false;
    const preserveNonEmpty = opts?.preserveNonEmpty ?? false;
    const key = TODOS_CACHE_KEY(scopeKey);
    const genAtStart = loadGenRef.current;
    const isCurrent = () => genAtStart === loadGenRef.current;

    const applyLists = (open: MyOpenCallTodoItem[], completed: MyOpenCallTodoItem[]) => {
      if (!isCurrent()) return;
      const incomingCount = open.length + completed.length;
      setOpenTodos((prev) =>
        preserveNonEmpty && incomingCount === 0 && prev.length > 0 ? prev : open
      );
      setCompletedTodos((prev) =>
        preserveNonEmpty && incomingCount === 0 && prev.length > 0 ? prev : completed
      );
    };

    let usedFreshLocalCache = false;
    let localCachedItemCount = 0;
    if (useCache) {
      const localCached = readLocalTodosCache(scopeKey);
      if (localCached) {
        applyLists(localCached.open, localCached.completed);
        localCachedItemCount = localCached.open.length + localCached.completed.length;
        usedFreshLocalCache =
          localCached.syncedAt > 0 && Date.now() - localCached.syncedAt < TODOS_FRESH_MS;
      }

      // Prefer localStorage as source of truth when it has data; IndexedDB is only a fallback
      // (and must not overwrite LS after a scope switch — generation guard).
      if (localCachedItemCount === 0) {
        const genAtIdb = loadGenRef.current;
        cacheGet<{ open: MyOpenCallTodoItem[]; completed: MyOpenCallTodoItem[] }>(key).then((cached) => {
          if (genAtIdb !== loadGenRef.current) return;
          if (cached && Array.isArray(cached.open) && Array.isArray(cached.completed)) {
            applyLists(cached.open, cached.completed);
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
    if (inFlightRef.current) {
      if (forceNetwork) queuedForceRefreshRef.current = true;
      return;
    }
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
    const isUnassignedTodo = (item: MyOpenCallTodoItem): boolean => {
      return (
        !item.publisher_id &&
        !item.partner_id &&
        !(item.publisher_guest_name?.trim()) &&
        !(item.partner_guest_name?.trim())
      );
    };

    const openQuery = establishmentId
      ? getEstablishmentOpenCallTodos(establishmentId, 50)
      : householderId
        ? getHouseholderOpenCallTodos(householderId, 50)
        : userId
          ? (filters.myUpdatesOnly
              ? Promise.all([
                  getMyOpenCallTodos(userId, 120),
                  getCongregationOpenCallTodos(220),
                ]).then(([mine, congregation]) =>
                  mergeById(mine, congregation.filter(isUnassignedTodo)))
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
        applyLists(open, completed);
      })
      .finally(() => {
        if (genAtFetch === loadGenRef.current) {
          inFlightRef.current = false;
          if (queuedForceRefreshRef.current) {
            queuedForceRefreshRef.current = false;
            setTimeout(() => {
              loadTodos({ useCache: false, forceNetwork: true, trustFreshLocalCache: false });
            }, 0);
          }
        }
      });
  }, [scopeKey, establishmentId, householderId, userId, filters.myUpdatesOnly]);

  const scheduleRealtimeTodoReload = useCallback(() => {
    if (realtimeTodoReloadDebounceRef.current) clearTimeout(realtimeTodoReloadDebounceRef.current);
    realtimeTodoReloadDebounceRef.current = setTimeout(() => {
      realtimeTodoReloadDebounceRef.current = null;
      loadTodos({ useCache: false, forceNetwork: true });
    }, 350);
  }, [loadTodos]);

  useEffect(() => {
    if (!userId || detailsBridgeOnly) {
      setTodoRealtimeCongregationId(null);
      return;
    }
    if (establishmentId || householderId) {
      setTodoRealtimeCongregationId(null);
      return;
    }
    let cancelled = false;
    void getProfile(userId).then((p) => {
      if (!cancelled) setTodoRealtimeCongregationId(p?.congregation_id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, detailsBridgeOnly, establishmentId, householderId]);

  useEffect(() => {
    if (!scopeKey) return;
    loadGenRef.current += 1;
    hasLoadedRef.current = false;
    lastSyncedAtRef.current = 0;
    inFlightRef.current = false;
    const snap = readLocalTodosCache(scopeKey);
    if (snap) {
      setOpenTodos(snap.open);
      setCompletedTodos(snap.completed);
      return;
    }
    const canUsePrefill = prefillScopeKey === scopeKey;
    if (canUsePrefill) {
      setOpenTodos(prefillOpenTodos ?? []);
      setCompletedTodos(prefillCompletedTodos ?? []);
    }
  }, [scopeKey, prefillScopeKey, prefillOpenTodos, prefillCompletedTodos]);

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
    let cancelled = false;
    const loadParticipants = async () => {
      try {
        try {
          const cachedRaw = window.localStorage.getItem(PARTICIPANTS_CACHE_KEY);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw) as {
              items?: Array<{ id: string; first_name: string; last_name: string; avatar_url?: string }>;
            };
            if (Array.isArray(cached?.items) && cached.items.length > 0) {
              const filtered = cached.items.filter(
                (item): item is { id: string; first_name: string; last_name: string; avatar_url?: string } =>
                  typeof item?.id === "string"
              );
              if (!cancelled && filtered.length > 0) {
                setParticipantsById(participantsToById(filtered));
              }
            }
          }
        } catch {
          // ignore corrupt participant cache
        }

        const participants = await getBwiParticipants();
        if (cancelled) return;
        setParticipantsById(participantsToById(participants));
        window.localStorage.setItem(PARTICIPANTS_CACHE_KEY, JSON.stringify({ items: participants }));
      } catch {
        if (!cancelled) setParticipantsById({});
      } finally {
        if (!cancelled) setParticipantsReady(true);
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
      preserveNonEmpty: true,
    });
  }, [loadTodos, filters.myUpdatesOnly]);

  useEffect(() => {
    if (!drawerOpen) return;
    // Stale-while-revalidate: drawer shares in-memory card data; refresh in background only when stale.
    loadTodos({
      useCache: true,
      forceNetwork: false,
      trustFreshLocalCache: false,
      preserveNonEmpty: true,
    });
  }, [drawerOpen, loadTodos]);

  const openTodoDrawer = useCallback(() => {
    if (scopeKey) {
      const localCached = readLocalTodosCache(scopeKey);
      if (localCached && localCached.open.length + localCached.completed.length > 0) {
        setOpenTodos((prev) => (prev.length > 0 ? prev : localCached.open));
        setCompletedTodos((prev) => (prev.length > 0 ? prev : localCached.completed));
      }
    }
    setDrawerOpen(true);
  }, [scopeKey]);

  useEffect(() => {
    if (detailsBridgeOnly) return;
    if (!drawerOpen) {
      setTodoDetailsDrawerOpen(false);
      setContactDetailsSubdrawerOpen(false);
    }
  }, [drawerOpen, detailsBridgeOnly]);

  useEffect(() => {
    if (!todoDetailsDrawerOpen) return;
    let cancelled = false;

    void (async () => {
      const householderId = selectedTodoForDetails?.householder_id;
      if (householderId) {
        const fallbackStub: HouseholderDetailsSnapshot = {
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
                name:
                  selectedTodoForDetails.context_establishment_name?.trim() || "Establishment",
                area: selectedTodoForDetails.context_area ?? null,
              }
            : null,
        };

        const { snapshot, hadWarmCache } = await resolveHouseholderDetailsSnapshot(
          householderId,
          householderDetailsCacheRef.current,
          fallbackStub
        );
        if (cancelled) return;

        setSelectedHouseholderDetails(snapshot);
        setSelectedTodoDetails(null);
        setIsLoadingTodoDetails(!hadWarmCache);

        try {
          const result = await getHouseholderDetails(householderId);
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
          } else if (!hadWarmCache) {
            setSelectedHouseholderDetails(null);
          }
        } finally {
          if (!cancelled) setIsLoadingTodoDetails(false);
        }
        return;
      }

      const establishmentId = selectedTodoForDetails?.establishment_id;
      if (!establishmentId) return;

      const fallbackStub: EstablishmentDetailsSnapshot = {
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
      };

      const { snapshot, hadWarmCache } = await resolveEstablishmentDetailsSnapshot(
        establishmentId,
        establishmentDetailsCacheRef.current,
        fallbackStub
      );
      if (cancelled) return;

      setSelectedTodoDetails(snapshot);
      setSelectedHouseholderDetails(null);
      setIsLoadingTodoDetails(!hadWarmCache);

      try {
        const result = await getEstablishmentDetails(establishmentId);
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
        } else if (!hadWarmCache) {
          setSelectedTodoDetails(null);
        }
      } finally {
        if (!cancelled) setIsLoadingTodoDetails(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [todoDetailsDrawerOpen, selectedTodoForDetails?.establishment_id, selectedTodoForDetails?.householder_id, selectedTodoForDetails?.context_name, selectedTodoForDetails?.context_status, selectedTodoForDetails?.context_area, selectedTodoForDetails?.context_establishment_status, selectedTodoForDetails?.context_establishment_name]);

  useEffect(() => {
    if (!contactDetailsSubdrawerOpen) return;
    const householderId = selectedContactFromEstablishment?.id;
    if (!householderId) return;

    let cancelled = false;

    void (async () => {
      const fallbackStub: HouseholderDetailsSnapshot = {
        householder: selectedContactFromEstablishment,
        visits: [],
        establishment: selectedContactFromEstablishment.establishment_id
          ? {
              id: selectedContactFromEstablishment.establishment_id,
              name: selectedContactFromEstablishment.establishment_name ?? "",
              area: null,
            }
          : null,
      };

      const { snapshot, hadWarmCache } = await resolveHouseholderDetailsSnapshot(
        householderId,
        householderDetailsCacheRef.current,
        fallbackStub
      );
      if (cancelled) return;

      setContactSubdrawerDetails(snapshot);
      setIsLoadingContactSubdrawerDetails(!hadWarmCache);

      try {
        const result = await getHouseholderDetails(householderId);
        if (cancelled || !result) return;
        const nextSnapshot: HouseholderDetailsSnapshot = {
          householder: result.householder,
          visits: result.visits,
          establishment: result.establishment,
        };
        householderDetailsCacheRef.current.set(householderId, nextSnapshot);
        setContactSubdrawerDetails(nextSnapshot);
      } finally {
        if (!cancelled) setIsLoadingContactSubdrawerDetails(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contactDetailsSubdrawerOpen, selectedContactFromEstablishment]);

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
        const isUnassigned = getTodoAssigneeSlots(todo).length === 0;
        if (!isMine && !isUnassigned) return false;
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

  // Live update for both card and drawer (congregation- or entity-scoped — avoids global table fan-out)
  useEffect(() => {
    if (!scopeKey || detailsBridgeOnly) return;

    let todoFilter: string;
    let callsFilterStr: string;
    if (establishmentId) {
      todoFilter = `establishment_id=eq.${establishmentId}`;
      callsFilterStr = `establishment_id=eq.${establishmentId}`;
    } else if (householderId) {
      todoFilter = `householder_id=eq.${householderId}`;
      callsFilterStr = `householder_id=eq.${householderId}`;
    } else if (todoRealtimeCongregationId) {
      todoFilter = `congregation_id=eq.${todoRealtimeCongregationId}`;
      callsFilterStr = `congregation_id=eq.${todoRealtimeCongregationId}`;
    } else {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`todos-live-${scopeKey}-${realtimeChannelSlotRef.current}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_todos", filter: todoFilter },
        () => {
          scheduleRealtimeTodoReload();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls", filter: callsFilterStr },
        () => {
          scheduleRealtimeTodoReload();
        }
      )
      .subscribe();

    return () => {
      if (realtimeTodoReloadDebounceRef.current) {
        clearTimeout(realtimeTodoReloadDebounceRef.current);
        realtimeTodoReloadDebounceRef.current = null;
      }
      try {
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [
    scopeKey,
    detailsBridgeOnly,
    establishmentId,
    householderId,
    todoRealtimeCongregationId,
    scheduleRealtimeTodoReload,
  ]);

  // Fallback live-update channel for local mutations (e.g., bulk submit)
  useEffect(() => {
    if (detailsBridgeOnly) return;
    const handleTodosMutated = (event: Event) => {
      const detail = (event as CustomEvent<TodoMutationEventDetail | undefined>).detail;
      const matchesScope = (todo: Partial<MyOpenCallTodoItem> & { id: string }) => {
        if (establishmentId) return todo.establishment_id === establishmentId;
        if (householderId) return todo.householder_id === householderId;
        if (!userId) return false;
        if (filters.myUpdatesOnly) {
          return todo.publisher_id === userId || todo.partner_id === userId;
        }
        return true;
      };

      if (detail?.kind === "upsert" && detail.todo && matchesScope(detail.todo)) {
        const optimisticTodo = detail.todo as MyOpenCallTodoItem;
        setOpenTodos((prev) => {
          const next = [optimisticTodo, ...prev.filter((item) => item.id !== optimisticTodo.id)];
          return next.slice(0, 300);
        });
        setCompletedTodos((prev) => prev.filter((item) => item.id !== optimisticTodo.id));
      } else if (detail?.kind === "delete" && detail.todoId) {
        setOpenTodos((prev) => prev.filter((item) => item.id !== detail.todoId));
        setCompletedTodos((prev) => prev.filter((item) => item.id !== detail.todoId));
      } else if (detail?.kind === "mark_done" && detail.todoId) {
        setOpenTodos((prevOpen) => {
          const target = prevOpen.find((item) => item.id === detail.todoId);
          if (!target) return prevOpen;
          setCompletedTodos((prevCompleted) => [{ ...target, is_done: true }, ...prevCompleted.filter((x) => x.id !== target.id)]);
          return prevOpen.filter((item) => item.id !== detail.todoId);
        });
      }

      // Always revalidate after optimistic patch so server state wins.
      loadTodos({ useCache: false, forceNetwork: true });
    };
    window.addEventListener("business-todos-mutated", handleTodosMutated);
    return () => {
      window.removeEventListener("business-todos-mutated", handleTodosMutated);
    };
  }, [loadTodos, establishmentId, householderId, userId, filters.myUpdatesOnly, detailsBridgeOnly]);

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

  const handleTakeTodoPrompt = useCallback((todo: MyOpenCallTodoItem) => {
    if (!userId) return;
    setTodoPendingTake(todo);
    setTakeTodoConfirmOpen(true);
  }, [userId]);

  const handleConfirmTakeTodo = useCallback(async () => {
    if (!userId || !todoPendingTake || takingTodoId) return;
    const target = todoPendingTake;
    setTakingTodoId(target.id);
    const previousOpen = openTodos;
    const previousCompleted = completedTodos;
    const optimistic: MyOpenCallTodoItem = {
      ...target,
      publisher_id: userId,
      partner_id: null,
      publisher_guest_name: null,
      partner_guest_name: null,
    };
    setOpenTodos((prev) => [optimistic, ...prev.filter((item) => item.id !== target.id)]);
    setTakeTodoConfirmOpen(false);
    setTodoPendingTake(null);
    const ok = await updateStandaloneTodo(target.id, {
      publisher_id: userId,
      partner_id: null,
      publisher_guest_name: null,
      partner_guest_name: null,
    });
    if (!ok) {
      setOpenTodos(previousOpen);
      setCompletedTodos(previousCompleted);
    } else {
      try {
        window.dispatchEvent(
          new CustomEvent("business-todos-mutated", {
            detail: { kind: "upsert", todo: optimistic },
          })
        );
      } catch {}
      loadTodos({ useCache: false, forceNetwork: true, trustFreshLocalCache: false });
    }
    setTakingTodoId(null);
  }, [userId, todoPendingTake, takingTodoId, openTodos, completedTodos, loadTodos]);

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
    const shouldOpenTodoContextDetails =
      userId &&
      !establishmentId &&
      !householderId &&
      (!!todo.establishment_id || !!todo.householder_id) &&
      !onTodoTap;
    if (shouldOpenTodoContextDetails) {
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
          const isUnassigned = getTodoAssigneeSlots(todo).length === 0;
          if (!isMine && !isUnassigned) return false;
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

    Promise.all([
      ...establishmentIds.map((id) => warmEstablishmentDetailsInMemory(id, establishmentDetailsCacheRef.current)),
      ...householderIds.map((id) => warmHouseholderDetailsInMemory(id, householderDetailsCacheRef.current)),
    ]).catch(() => {
      // no-op; background prefetch only
    });
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
      ...establishmentIds.map((id) => warmEstablishmentDetailsInMemory(id, establishmentDetailsCacheRef.current)),
      ...householderIds.map((id) => warmHouseholderDetailsInMemory(id, householderDetailsCacheRef.current)),
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

  const isTodoAssigned = useCallback((todo: MyOpenCallTodoItem) => {
    return Boolean(
      todo.publisher_id ||
      todo.partner_id ||
      todo.publisher_guest_name?.trim() ||
      todo.partner_guest_name?.trim()
    );
  }, []);
  const selectableAssignedTodos = useMemo(
    () => filteredOpenTodos.filter(isTodoAssigned),
    [filteredOpenTodos, isTodoAssigned]
  );
  const selectableUnassignedTodos = useMemo(
    () => filteredOpenTodos.filter((todo) => !isTodoAssigned(todo)),
    [filteredOpenTodos, isTodoAssigned]
  );
  const selectableTodos = useMemo(
    () => [...selectableAssignedTodos, ...selectableUnassignedTodos],
    [selectableAssignedTodos, selectableUnassignedTodos]
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
    const allKnownTodos = [...openTodos, ...completedTodos];

    const prefilledRows = chosen.map((todo, index) => {
      let resolvedHouseholderId = todo.householder_id ?? null;
      let resolvedEstablishmentId = todo.establishment_id ?? null;

      // Fallback #1: infer from same call context already loaded in memory.
      if (!resolvedHouseholderId && !resolvedEstablishmentId && todo.call_id) {
        const callMatch = allKnownTodos.find(
          (item) =>
            item.call_id === todo.call_id &&
            (item.householder_id || item.establishment_id)
        );
        resolvedHouseholderId = callMatch?.householder_id ?? null;
        resolvedEstablishmentId = callMatch?.establishment_id ?? null;
      }

      // Fallback #2: infer from matching context labels/status/area when call_id is absent.
      if (!resolvedHouseholderId && !resolvedEstablishmentId) {
        const contextMatch = allKnownTodos.find((item) => {
          if (!item.householder_id && !item.establishment_id) return false;
          return (
            (item.context_name ?? "") === (todo.context_name ?? "") &&
            (item.context_establishment_name ?? "") === (todo.context_establishment_name ?? "") &&
            (item.context_status ?? "") === (todo.context_status ?? "") &&
            (item.context_area ?? "") === (todo.context_area ?? "")
          );
        });
        resolvedHouseholderId = contextMatch?.householder_id ?? null;
        resolvedEstablishmentId = contextMatch?.establishment_id ?? null;
      }

      // Fallback #3: when already scoped, use current scope target.
      if (!resolvedHouseholderId && !resolvedEstablishmentId) {
        if (householderId) resolvedHouseholderId = householderId;
        else if (establishmentId) resolvedEstablishmentId = establishmentId;
      }

      const targetKey = resolvedHouseholderId
        ? `householder:${resolvedHouseholderId}`
        : resolvedEstablishmentId
          ? `establishment:${resolvedEstablishmentId}`
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
  }, [selectedTodoIds, selectableTodos, applyBulkEditRows, openTodos, completedTodos, householderId, establishmentId]);

  const displayTodos = filteredOpenTodos.slice(0, 5);
  const displayCompletedPreview = filteredCompletedTodos.slice(0, 1);
  const openCount = filteredOpenTodos.length;
  const doneCount = filteredCompletedTodos.length;
  const hasNavigation = !!(onNavigateToTodoCall || onTodoTap);
  const showAssigneeAvatars = Boolean(userId || establishmentId || householderId);
  const showOtherPublisherDecorations = Boolean(
    userId && !establishmentId && !householderId && !filters.myUpdatesOnly
  );
  const prefersCompanionLeftTodoDrawer = Boolean(
    preferLeftCompanionDrawer && isTodoDetailsSideLayout && (!!establishmentId || !!householderId)
  );
  const useSingleColumnTodoDrawerBody = prefersCompanionLeftTodoDrawer;
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
  const selectedHouseholder = selectedHouseholderDetails?.householder ?? null;
  const selectedHouseholderEstablishment = selectedHouseholderDetails?.establishment ?? null;
  const householderSurfaceClass = selectedHouseholder
    ? (selectedHouseholder.publisher_id
        ? "border-emerald-500/45 bg-emerald-500/8"
        : getHouseholderCardColor(selectedHouseholder.status))
    : "";
  const householderArea =
    selectedHouseholderEstablishment?.area?.trim() ?? "";
  const householderNote = selectedHouseholder?.note?.trim() ?? "";
  const householderEstablishmentName =
    selectedHouseholderEstablishment?.name?.trim() ||
    selectedHouseholder?.establishment_name?.trim() ||
    "";
  const householderEstablishmentStatus = getBestStatus(
    selectedHouseholderEstablishment?.statuses ??
      (selectedTodoForDetails?.context_establishment_status
        ? [selectedTodoForDetails.context_establishment_status]
        : [])
  );
  const selectedDetailVisits = useMemo(
    () =>
      [...(isHouseholderDetail ? selectedHouseholderDetails?.visits ?? [] : selectedTodoDetails?.visits ?? [])].sort(
        (a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()
      ),
    [isHouseholderDetail, selectedHouseholderDetails?.visits, selectedTodoDetails?.visits]
  );
  const selectedDetailHouseholders = selectedTodoDetails?.householders ?? [];
  const establishmentPrefillOpenTodos = useMemo(
    () =>
      selectedEstablishmentDetails?.id
        ? openTodos.filter((todo) => todo.establishment_id === selectedEstablishmentDetails.id)
        : [],
    [openTodos, selectedEstablishmentDetails?.id]
  );
  const establishmentPrefillCompletedTodos = useMemo(
    () =>
      selectedEstablishmentDetails?.id
        ? completedTodos.filter((todo) => todo.establishment_id === selectedEstablishmentDetails.id)
        : [],
    [completedTodos, selectedEstablishmentDetails?.id]
  );
  const householderPrefillOpenTodos = useMemo(
    () =>
      selectedHouseholder?.id
        ? openTodos.filter((todo) => todo.householder_id === selectedHouseholder.id)
        : [],
    [openTodos, selectedHouseholder?.id]
  );
  const householderPrefillCompletedTodos = useMemo(
    () =>
      selectedHouseholder?.id
        ? completedTodos.filter((todo) => todo.householder_id === selectedHouseholder.id)
        : [],
    [completedTodos, selectedHouseholder?.id]
  );
  const contactSubdrawerHouseholder = contactSubdrawerDetails?.householder ?? selectedContactFromEstablishment;
  const contactSubdrawerEstablishment = contactSubdrawerDetails?.establishment ?? null;
  const contactSubdrawerPrefillOpenTodos = useMemo(
    () =>
      contactSubdrawerHouseholder?.id
        ? openTodos.filter((todo) => todo.householder_id === contactSubdrawerHouseholder.id)
        : [],
    [openTodos, contactSubdrawerHouseholder?.id]
  );
  const contactSubdrawerPrefillCompletedTodos = useMemo(
    () =>
      contactSubdrawerHouseholder?.id
        ? completedTodos.filter((todo) => todo.householder_id === contactSubdrawerHouseholder.id)
        : [],
    [completedTodos, contactSubdrawerHouseholder?.id]
  );
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
  const contactSubdrawerNote = contactSubdrawerHouseholder?.note?.trim() ?? "";
  const contactSubdrawerEstablishmentName =
    contactSubdrawerEstablishment?.name?.trim() ||
    contactSubdrawerHouseholder?.establishment_name?.trim() ||
    "";
  const contactSubdrawerEstablishmentStatus = getBestStatus(
    contactSubdrawerEstablishment?.statuses ?? []
  );
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
              statuses: null,
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
    setContactSubdrawerEntityEditOpen(false);
    setContactDetailsSubdrawerOpen(true);
  }, [openTodos, completedTodos]);

  const closeContactDetailsSubdrawer = useCallback(() => {
    setContactDetailsSubdrawerOpen(false);
    setSelectedContactFromEstablishment(null);
    setContactSubdrawerEntityEditOpen(false);
  }, []);
  const openTodoEditorFromDetails = useCallback(
    (
      todo: MyOpenCallTodoItem,
      visits: VisitWithUser[],
      options: {
        establishments: Array<{ id?: string; name: string }>;
        selectedEstablishmentId?: string;
        householderId?: string;
        householderName?: string;
        disableEstablishmentSelect?: boolean;
      }
    ) => {
      const matchedVisit = todo.call_id ? visits.find((visit) => visit.id === todo.call_id) : null;
      const callPublishers = [matchedVisit?.publisher, matchedVisit?.partner]
        .filter((person): person is NonNullable<typeof person> => !!person)
        .map((person) => `${person.first_name} ${person.last_name}`.trim())
        .filter(Boolean);
      if (matchedVisit?.publisher_guest_name?.trim()) {
        callPublishers.push(matchedVisit.publisher_guest_name.trim());
      }
      if (matchedVisit?.partner_guest_name?.trim()) {
        callPublishers.push(matchedVisit.partner_guest_name.trim());
      }

      setTodoEditorUseLeftPanel(isTodoDetailsSideLayout);
      setTodoEditorContext({
        initialTodo: {
          ...todo,
          call_note: matchedVisit?.note ?? null,
          call_visit_date: matchedVisit?.visit_date ?? todo.visit_date ?? null,
          call_publishers: Array.from(new Set(callPublishers)),
        },
        establishments: options.establishments,
        selectedEstablishmentId: options.selectedEstablishmentId,
        householderId: options.householderId,
        householderName: options.householderName,
        disableEstablishmentSelect: options.disableEstablishmentSelect,
      });
    },
    [isTodoDetailsSideLayout]
  );
  useEffect(() => {
    if (!todoDetailsDrawerOpen || isHouseholderDetail) return;
    if (selectedDetailHouseholders.length === 0) return;

    Promise.all(
      selectedDetailHouseholders.slice(0, 20).map((householder) => {
        if (!householder.id) return Promise.resolve();
        return warmHouseholderDetailsInMemory(householder.id, householderDetailsCacheRef.current);
      })
    ).catch(() => {
      // prewarm only
    });
  }, [todoDetailsDrawerOpen, isHouseholderDetail, selectedDetailHouseholders]);

  const handleTodoDetailsDrawerChange = useCallback(
    (open: boolean) => {
      setTodoDetailsDrawerOpen(open);
      if (!open) {
        setSelectedTodoForDetails(null);
        setSelectedTodoDetails(null);
        setSelectedHouseholderDetails(null);
        setSelectedContactFromEstablishment(null);
        setContactDetailsSubdrawerOpen(false);
        setDetailsEntityEditOpen(false);
        setContactSubdrawerEntityEditOpen(false);
        if (detailsBridgeOnly) {
          onDetailsBridgeOpenChange?.(false);
        }
      }
    },
    [detailsBridgeOnly, onDetailsBridgeOpenChange]
  );

  useEffect(() => {
    if (!detailsBridgeOnly) return;
    if (detailsBridgeOpen && detailsBridgeSyntheticTodo) {
      setSelectedTodoForDetails(detailsBridgeSyntheticTodo);
      setTodoDetailsDrawerOpen(true);
    }
  }, [detailsBridgeOnly, detailsBridgeOpen, detailsBridgeSyntheticTodo]);

  useEffect(() => {
    if (!detailsBridgeOnly) return;
    if (!detailsBridgeOpen) {
      setTodoDetailsDrawerOpen(false);
      setSelectedTodoForDetails(null);
      setSelectedTodoDetails(null);
      setSelectedHouseholderDetails(null);
      setSelectedContactFromEstablishment(null);
      setContactDetailsSubdrawerOpen(false);
      setDetailsEntityEditOpen(false);
      setContactSubdrawerEntityEditOpen(false);
      setTodoEditorContext(null);
      setTodoEditorUseLeftPanel(false);
    }
  }, [detailsBridgeOnly, detailsBridgeOpen]);

  const refreshTodoDetailEntity = useCallback(async () => {
    const hhTarget = selectedTodoForDetails?.householder_id;
    const estTarget = selectedTodoForDetails?.establishment_id;
    if (hhTarget) {
      await cacheDelete(householderDetailsCacheKey(hhTarget));
      const result = await getHouseholderDetails(hhTarget);
      if (result) {
        const snap: HouseholderDetailsSnapshot = {
          householder: result.householder,
          visits: result.visits,
          establishment: result.establishment,
        };
        householderDetailsCacheRef.current.set(hhTarget, snap);
        setSelectedHouseholderDetails(snap);
      }
    } else if (estTarget) {
      await cacheDelete(establishmentDetailsCacheKey(estTarget));
      const result = await getEstablishmentDetails(estTarget);
      if (result) {
        const snap: EstablishmentDetailsSnapshot = {
          establishment: result.establishment,
          visits: result.visits,
          householders: result.householders,
        };
        establishmentDetailsCacheRef.current.set(estTarget, snap);
        setSelectedTodoDetails(snap);
      }
    }
    loadTodos({ useCache: false, forceNetwork: true, trustFreshLocalCache: false });
  }, [selectedTodoForDetails?.householder_id, selectedTodoForDetails?.establishment_id, loadTodos]);

  const refreshAfterContactSubdrawerEdit = useCallback(async () => {
    const hhId = contactSubdrawerHouseholder?.id;
    if (hhId) {
      await cacheDelete(householderDetailsCacheKey(hhId));
      const result = await getHouseholderDetails(hhId);
      if (result) {
        const snap: HouseholderDetailsSnapshot = {
          householder: result.householder,
          visits: result.visits,
          establishment: result.establishment,
        };
        householderDetailsCacheRef.current.set(hhId, snap);
        setContactSubdrawerDetails(snap);
        setSelectedContactFromEstablishment((prev) =>
          prev?.id === hhId ? { ...prev, ...result.householder } : prev
        );
      }
    }
    await refreshTodoDetailEntity();
    try {
      window.dispatchEvent(new CustomEvent("business-todos-mutated"));
      window.dispatchEvent(new CustomEvent("app-business-refresh"));
    } catch {
      /* ignore */
    }
  }, [contactSubdrawerHouseholder?.id, refreshTodoDetailEntity]);

  const broadcastTodosAndBusinessRefresh = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent("business-todos-mutated"));
      window.dispatchEvent(new CustomEvent("app-business-refresh"));
    } catch {
      /* ignore */
    }
  }, []);

  /** Keep the opened to-do row in sync when lists revalidate after save. */
  useEffect(() => {
    const selId = selectedTodoForDetails?.id;
    if (!selId) return;
    const next = [...openTodos, ...completedTodos].find((t) => t.id === selId);
    if (!next) return;
    setSelectedTodoForDetails((prev) => {
      if (!prev || prev.id !== selId) return prev;
      const sig = (t: MyOpenCallTodoItem) =>
        `${t.body}\0${t.is_done}\0${String(t.deadline_date ?? "")}\0${String(t.publisher_id ?? "")}\0${String(t.partner_id ?? "")}\0${String(t.context_name ?? "")}\0${String(t.context_status ?? "")}`;
      if (sig(prev) === sig(next)) return prev;
      return next;
    });
  }, [openTodos, completedTodos, selectedTodoForDetails?.id]);

  const homeTodoDetailsFabSurface = useMemo<"estMain" | "hhMain" | "contactSub" | null>(() => {
    if (contactDetailsSubdrawerOpen) return "contactSub";
    if (!todoDetailsDrawerOpen || !selectedTodoForDetails) return null;
    return isHouseholderDetail ? "hhMain" : "estMain";
  }, [
    contactDetailsSubdrawerOpen,
    todoDetailsDrawerOpen,
    selectedTodoForDetails,
    isHouseholderDetail,
  ]);

  const homeTodoDetailsFabFormConfig = useMemo(() => {
    if (!homeTodoDetailsFabSurface) return null;
    if (homeTodoDetailsFabSurface === "estMain") {
      if (!selectedEstablishmentDetails?.id) return null;
      return {
        establishments: [{ id: selectedEstablishmentDetails.id, name: selectedEstablishmentDetails.name }],
        selectedEstablishmentId: selectedEstablishmentDetails.id as string,
      };
    }
    if (homeTodoDetailsFabSurface === "hhMain") {
      const estId =
        selectedHouseholderEstablishment?.id ??
        selectedHouseholder?.establishment_id ??
        selectedTodoForDetails?.establishment_id ??
        undefined;
      const estName =
        selectedHouseholderEstablishment?.name?.trim() ||
        selectedHouseholder?.establishment_name?.trim() ||
        selectedTodoForDetails?.context_establishment_name?.trim() ||
        (estId ? "Establishment" : "");
      if (!selectedHouseholder?.id || !estId || !estName) return null;
      return {
        establishments: [{ id: estId, name: estName }],
        selectedEstablishmentId: estId,
        householderId: selectedHouseholder.id,
        householderName: selectedHouseholder.name,
        householderStatus: selectedHouseholder.status,
      };
    }
    const est =
      contactSubdrawerEstablishment?.id != null
        ? { id: contactSubdrawerEstablishment.id, name: contactSubdrawerEstablishment.name }
        : selectedEstablishmentDetails?.id != null
          ? { id: selectedEstablishmentDetails.id, name: selectedEstablishmentDetails.name }
          : contactSubdrawerHouseholder?.establishment_id
            ? {
                id: contactSubdrawerHouseholder.establishment_id,
                name: contactSubdrawerHouseholder.establishment_name?.trim() || "Establishment",
              }
            : null;
    const hh = contactSubdrawerHouseholder;
    if (!est?.id || !est.name?.trim() || !hh?.id) return null;
    return {
      establishments: [{ id: est.id, name: est.name }],
      selectedEstablishmentId: est.id,
      householderId: hh.id,
      householderName: hh.name,
      householderStatus: hh.status,
    };
  }, [
    homeTodoDetailsFabSurface,
    selectedEstablishmentDetails?.id,
    selectedEstablishmentDetails?.name,
    selectedHouseholderEstablishment?.id,
    selectedHouseholderEstablishment?.name,
    selectedHouseholder?.id,
    selectedHouseholder?.establishment_id,
    selectedHouseholder?.establishment_name,
    selectedHouseholder?.name,
    selectedHouseholder?.status,
    selectedTodoForDetails?.establishment_id,
    selectedTodoForDetails?.context_establishment_name,
    contactSubdrawerEstablishment,
    contactSubdrawerHouseholder,
  ]);

  const afterHomeTodoDetailsQuickCreateSaved = useCallback(async () => {
    if (contactDetailsSubdrawerOpen && contactSubdrawerHouseholder?.id) {
      await refreshAfterContactSubdrawerEdit();
    } else {
      await refreshTodoDetailEntity();
      broadcastTodosAndBusinessRefresh();
    }
  }, [
    contactDetailsSubdrawerOpen,
    contactSubdrawerHouseholder?.id,
    refreshAfterContactSubdrawerEdit,
    refreshTodoDetailEntity,
    broadcastTodosAndBusinessRefresh,
  ]);

  const homeTodoDetailsFabCtx = useHomeTodoDetailsFabOptional();
  const setTodoDetailsFabOverride = homeTodoDetailsFabCtx?.setTodoDetailsFabOverride;
  const setHideHomeFab = homeTodoDetailsFabCtx?.setHideHomeFab;

  const isMainHomeTodoWidget = Boolean(userId && establishmentId == null && householderId == null);
  const fabBridgeActiveForViewport =
    isMainHomeTodoWidget &&
    fabBridgeLayout != null &&
    ((fabBridgeLayout === "belowXl" && !isXlViewport) || (fabBridgeLayout === "xlAndUp" && isXlViewport));

  const shouldPublishHomeTodoDetailsFab =
    !detailsBridgeOnly &&
    homeTodoDetailsFabFormConfig != null &&
    !detailsEntityEditOpen &&
    !contactSubdrawerEntityEditOpen &&
    !(todoEditorUseLeftPanel && todoEditorContext);

  useEffect(() => {
    if (!setTodoDetailsFabOverride || !fabBridgeActiveForViewport) return;

    if (shouldPublishHomeTodoDetailsFab && homeTodoDetailsFabFormConfig) {
      setTodoDetailsFabOverride({
        showNewContact: homeTodoDetailsFabSurface === "estMain",
        establishments: homeTodoDetailsFabFormConfig.establishments.map((e) => ({
          id: (e.id ?? homeTodoDetailsFabFormConfig.selectedEstablishmentId) as string,
          name: e.name,
        })),
        selectedEstablishmentId: homeTodoDetailsFabFormConfig.selectedEstablishmentId,
        householderId: homeTodoDetailsFabFormConfig.householderId,
        householderName: homeTodoDetailsFabFormConfig.householderName,
        householderStatus: homeTodoDetailsFabFormConfig.householderStatus,
        onAfterSave: afterHomeTodoDetailsQuickCreateSaved,
        stackLeftFormAboveNestedDetails: contactDetailsSubdrawerOpen && isTodoDetailsSideLayout,
      });
    } else {
      setTodoDetailsFabOverride(null);
    }

    return () => {
      setTodoDetailsFabOverride(null);
    };
  }, [
    afterHomeTodoDetailsQuickCreateSaved,
    fabBridgeActiveForViewport,
    setTodoDetailsFabOverride,
    homeTodoDetailsFabFormConfig,
    homeTodoDetailsFabSurface,
    shouldPublishHomeTodoDetailsFab,
    contactDetailsSubdrawerOpen,
    isTodoDetailsSideLayout,
  ]);

  useEffect(() => {
    if (!setHideHomeFab || !isMainHomeTodoWidget || detailsBridgeOnly) return;
    const shouldHide = detailsEntityEditOpen || contactSubdrawerEntityEditOpen;
    setHideHomeFab(shouldHide);
    return () => {
      if (shouldHide) setHideHomeFab(false);
    };
  }, [
    contactSubdrawerEntityEditOpen,
    detailsBridgeOnly,
    detailsEntityEditOpen,
    isMainHomeTodoWidget,
    setHideHomeFab,
  ]);

  const canDetailSummaryEdit = isHouseholderDetail
    ? !!selectedHouseholder?.id
    : !!selectedEstablishmentDetails?.id;

  const openEntityEditorFromDetailsSidebar = useCallback(() => {
    const hasTarget = isHouseholderDetail
      ? !!selectedHouseholder?.id
      : !!selectedEstablishmentDetails?.id;
    if (!hasTarget) return;
    setContactSubdrawerEntityEditOpen(false);
    setDetailsEntityEditOpen(true);
  }, [isHouseholderDetail, selectedHouseholder?.id, selectedEstablishmentDetails?.id]);

  const canContactSubdrawerSummaryEdit = !!contactSubdrawerHouseholder?.id;

  const openContactSubdrawerEntityEditor = useCallback(() => {
    if (!contactSubdrawerHouseholder?.id) return;
    setDetailsEntityEditOpen(false);
    setContactSubdrawerEntityEditOpen(true);
  }, [contactSubdrawerHouseholder?.id]);

  const renderTodoDetailsBody = () => (
    <>
      {isLoadingTodoDetails && !selectedTodoDetails && !selectedHouseholderDetails ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading details...</div>
      ) : (
        isHouseholderDetail ? (
          <div
            className={cn(
              canDetailSummaryEdit &&
                "cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
            role={canDetailSummaryEdit ? "button" : undefined}
            tabIndex={canDetailSummaryEdit ? 0 : undefined}
            onClick={canDetailSummaryEdit ? openEntityEditorFromDetailsSidebar : undefined}
            onKeyDown={
              canDetailSummaryEdit
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openEntityEditorFromDetailsSidebar();
                    }
                  }
                : undefined
            }
            aria-label={
              canDetailSummaryEdit ? `Edit ${selectedHouseholder?.name ?? "contact"}` : undefined
            }
          >
            <Card
              className={cn(
                "w-full",
                householderSurfaceClass,
                canDetailSummaryEdit && "hover:opacity-95 transition-opacity"
              )}
            >
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
                {householderEstablishmentName ? (
                  <Badge
                    variant="outline"
                    className={cn("flex-shrink-0", getStatusTextColor(householderEstablishmentStatus))}
                  >
                    {householderEstablishmentName}
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
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <MapPinned className="h-4 w-4" />
                </a>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              <HouseholderSummaryFields area={householderArea} note={householderNote} />
            </CardContent>
          </Card>
          </div>
        ) : (
          <div
            className={cn(
              canDetailSummaryEdit &&
                "cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            )}
            role={canDetailSummaryEdit ? "button" : undefined}
            tabIndex={canDetailSummaryEdit ? 0 : undefined}
            onClick={canDetailSummaryEdit ? openEntityEditorFromDetailsSidebar : undefined}
            onKeyDown={
              canDetailSummaryEdit
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openEntityEditorFromDetailsSidebar();
                    }
                  }
                : undefined
            }
            aria-label={
              canDetailSummaryEdit
                ? `Edit ${selectedEstablishmentDetails?.name ?? "establishment"}`
                : undefined
            }
          >
          <Card
            className={cn(
              "w-full",
              detailSurfaceClass,
              canDetailSummaryEdit && "hover:opacity-95 transition-opacity"
            )}
          >
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
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <MapPinned className="h-4 w-4" />
                </a>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              <EstablishmentSummaryFields
                area={selectedEstablishmentDetails?.area}
                description={selectedEstablishmentDetails?.description}
                floor={selectedEstablishmentDetails?.floor}
                note={selectedEstablishmentDetails?.note}
              />
            </CardContent>
          </Card>
          </div>
        )
      )}

      {isHouseholderDetail && selectedHouseholder?.id ? (
        <HomeTodoCard
          householderId={selectedHouseholder.id}
          prefillScopeKey={`householder:${selectedHouseholder.id}`}
          prefillOpenTodos={householderPrefillOpenTodos}
          prefillCompletedTodos={householderPrefillCompletedTodos}
          preferLeftCompanionDrawer
          onTodoTap={(todo) =>
            openTodoEditorFromDetails(todo, selectedDetailVisits, {
              establishments: selectedHouseholderEstablishment
                ? [{ id: selectedHouseholderEstablishment.id, name: selectedHouseholderEstablishment.name }]
                : [],
              selectedEstablishmentId: selectedHouseholderEstablishment?.id,
              householderId: selectedHouseholder.id,
              householderName: selectedHouseholder.name,
              disableEstablishmentSelect: true,
            })
          }
        />
      ) : null}
      {!isHouseholderDetail && selectedEstablishmentDetails?.id ? (
        <HomeTodoCard
          establishmentId={selectedEstablishmentDetails.id}
          prefillScopeKey={`establishment:${selectedEstablishmentDetails.id}`}
          prefillOpenTodos={establishmentPrefillOpenTodos}
          prefillCompletedTodos={establishmentPrefillCompletedTodos}
          preferLeftCompanionDrawer
          onTodoTap={(todo) =>
            openTodoEditorFromDetails(todo, selectedDetailVisits, {
              establishments: [{ id: selectedEstablishmentDetails.id, name: selectedEstablishmentDetails.name }],
              selectedEstablishmentId: selectedEstablishmentDetails.id,
              disableEstablishmentSelect: true,
            })
          }
        />
      ) : null}

      {selectedDetailVisits.length > 0 ? (
        <CallSection
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
            void refreshTodoDetailEntity().then(() => broadcastTodosAndBusinessRefresh());
          }}
          preferLeftDetailPanel={isTodoDetailsSideLayout}
          insideStackedContactPane={
            Boolean(!isHouseholderDetail && contactDetailsSubdrawerOpen && isTodoDetailsSideLayout)
          }
        />
      ) : null}

      {!isHouseholderDetail && selectedEstablishmentDetails?.id ? (
        <ContactsSection
          establishmentId={selectedEstablishmentDetails.id}
          householders={selectedDetailHouseholders}
          onHouseholderClick={openContactDetailsSubdrawer}
          preferLeftDetailPanel={isTodoDetailsSideLayout}
          insideStackedContactPane={Boolean(contactDetailsSubdrawerOpen && isTodoDetailsSideLayout)}
          isLoading={false}
        />
      ) : null}
    </>
  );

  const renderTodoDrawerBody = () => (
    <>
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
        <p className={cn("text-sm text-muted-foreground py-4", studyBibleDarkClasses.muted)}>{emptyDrawerText}</p>
      ) : (
        <>
          {/* Phone: stacked collapsible sections (also used for scoped left companion drawer on tablet) */}
          <div className={cn(useSingleColumnTodoDrawerBody ? "block" : "md:hidden")}>
          <div className="mt-2 overflow-hidden rounded-t-lg border border-border bg-muted/15 dark:border-[#1c1921] dark:bg-[#30283c]">
            <button
              type="button"
              onClick={() => setDrawerTodoExpanded((prev) => !prev)}
              className={cn("w-full flex items-center justify-between px-3 py-2 text-sm text-muted-foreground font-bold hover:text-foreground transition-colors", studyBibleDarkClasses.muted)}
            >
              <span>To-Do ({filteredAssignedOpenTodos.length})</span>
              {drawerTodoExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
          {drawerTodoExpanded && (
            filteredAssignedOpenTodos.length > 0 ? (
              <ul className="space-y-3 rounded-b-lg border-x border-b border-border p-2 dark:border-[#1c1921] dark:bg-[#2a2534]">
                {filteredAssignedOpenTodos.map((todo, index) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    onMarkDone={handleMarkDone}
                    onTap={hasNavigation ? handleTodoTap : undefined}
                    showCheckbox
                    currentUserId={userId}
                    showAssigneeAvatars={showAssigneeAvatars}
                    highlightOtherPublishers={showOtherPublisherDecorations}
                    participantsById={participantsById}
                    participantsReady={participantsReady}
                    rowIndex={index}
                    layoutId={`${layoutScopeId}-drawer-${todo.id}`}
                    layoutTransition={todoLayoutTransition}
                    clampBody={false}
                    hideHouseholderNameBadge={!!householderId}
                    hideHouseholderEstablishmentBadge={!!householderId}
                  />
                ))}
              </ul>
            ) : (
              <p className={cn("rounded-b-lg border-x border-b border-border px-3 py-2 text-xs text-muted-foreground dark:border-[#1c1921] dark:bg-[#2a2534]", studyBibleDarkClasses.muted)}>No assigned to-dos.</p>
            )
          )}

          <div className="mt-3 overflow-hidden rounded-t-lg border border-border bg-muted/15 dark:border-[#1c1921] dark:bg-[#30283c]">
            <button
              type="button"
              onClick={() => setDrawerOpenSectionExpanded((prev) => !prev)}
              className={cn("w-full flex items-center justify-between px-3 py-2 text-sm text-muted-foreground font-bold hover:text-foreground transition-colors", studyBibleDarkClasses.muted)}
            >
              <span>Open ({filteredUnassignedOpenTodos.length})</span>
              {drawerOpenSectionExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
          {drawerOpenSectionExpanded && (
            filteredUnassignedOpenTodos.length > 0 ? (
              <ul className="space-y-3 rounded-b-lg border-x border-b border-border p-2 dark:border-[#1c1921] dark:bg-[#2a2534]">
                {filteredUnassignedOpenTodos.map((todo, index) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    onMarkDone={handleMarkDone}
                    onTap={hasNavigation ? handleTodoTap : undefined}
                    showCheckbox
                    currentUserId={userId}
                    showAssigneeAvatars={showAssigneeAvatars}
                    highlightOtherPublishers={showOtherPublisherDecorations}
                    participantsById={participantsById}
                    participantsReady={participantsReady}
                    rowIndex={index}
                    layoutId={`${layoutScopeId}-drawer-${todo.id}`}
                    layoutTransition={todoLayoutTransition}
                    clampBody={false}
                    hideHouseholderNameBadge={!!householderId}
                    hideHouseholderEstablishmentBadge={!!householderId}
                    headerAction={
                      userId ? (
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          className="h-7 rounded-full px-3 text-xs font-semibold bg-emerald-600/95 text-white shadow-sm hover:bg-emerald-500 hover:shadow-md hover:scale-[1.02] active:scale-100 transition-all"
                          disabled={takingTodoId === todo.id}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleTakeTodoPrompt(todo);
                          }}
                        >
                          Take
                        </Button>
                      ) : null
                    }
                  />
                ))}
              </ul>
            ) : (
              <p className={cn("rounded-b-lg border-x border-b border-border px-3 py-2 text-xs text-muted-foreground dark:border-[#1c1921] dark:bg-[#2a2534]", studyBibleDarkClasses.muted)}>No unassigned to-dos.</p>
            )
          )}

          <div className="mt-3 overflow-hidden rounded-t-lg border border-border bg-muted/15 dark:border-[#1c1921] dark:bg-[#30283c]">
            <button
              type="button"
              onClick={() => setDrawerDoneExpanded((prev) => !prev)}
              className={cn("w-full flex items-center justify-between px-3 py-2 text-sm text-muted-foreground font-bold hover:text-foreground transition-colors", studyBibleDarkClasses.muted)}
            >
              <span>Done ({filteredCompletedTodos.length})</span>
              {drawerDoneExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
          {drawerDoneExpanded && (
            filteredCompletedTodos.length > 0 ? (
              <ul className="space-y-3 rounded-b-lg border-x border-b border-border p-2 dark:border-[#1c1921] dark:bg-[#2a2534]">
                {filteredCompletedTodos.map((todo, index) => (
                  <TodoRow
                    key={todo.id}
                    todo={{ ...todo, is_done: true }}
                    onMarkDone={handleMarkDone}
                    onTap={hasNavigation ? handleTodoTap : undefined}
                    showCheckbox
                    currentUserId={userId}
                    showAssigneeAvatars={showAssigneeAvatars}
                    highlightOtherPublishers={showOtherPublisherDecorations}
                    participantsById={participantsById}
                    participantsReady={participantsReady}
                    rowIndex={index}
                    layoutId={`${layoutScopeId}-drawer-${todo.id}`}
                    layoutTransition={todoLayoutTransition}
                    clampBody={false}
                    hideHouseholderNameBadge={!!householderId}
                    hideHouseholderEstablishmentBadge={!!householderId}
                  />
                ))}
              </ul>
            ) : (
              <p className={cn("rounded-b-lg border-x border-b border-border px-3 py-2 text-xs text-muted-foreground dark:border-[#1c1921] dark:bg-[#2a2534]", studyBibleDarkClasses.muted)}>No done to-dos.</p>
            )
          )}
          </div>

          {/* iPad / md+: three columns with independent scroll */}
          <div
            className={cn(
              useSingleColumnTodoDrawerBody
                ? "hidden"
                : "hidden md:grid md:h-[calc(80dvh-10rem)] md:min-h-[320px] md:grid-cols-3 md:gap-3 md:items-stretch"
            )}
          >
            <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-muted/15 dark:border-[#1c1921] dark:bg-[#2a2534]">
              <div className={cn("shrink-0 border-b border-border px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground dark:border-[#1c1921] dark:bg-[#30283c]", studyBibleDarkClasses.muted)}>
                To-Do ({filteredAssignedOpenTodos.length})
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
                {filteredAssignedOpenTodos.length > 0 ? (
                  <ul className="space-y-3">
                    {filteredAssignedOpenTodos.map((todo, index) => (
                      <TodoRow
                        key={todo.id}
                        todo={todo}
                        onMarkDone={handleMarkDone}
                        onTap={hasNavigation ? handleTodoTap : undefined}
                        showCheckbox
                        currentUserId={userId}
                        showAssigneeAvatars={showAssigneeAvatars}
                        highlightOtherPublishers={showOtherPublisherDecorations}
                        participantsById={participantsById}
                    participantsReady={participantsReady}
                        rowIndex={index}
                        layoutId={`${layoutScopeId}-drawer-md-to-${todo.id}`}
                        layoutTransition={todoLayoutTransition}
                        clampBody={false}
                        hideHouseholderNameBadge={!!householderId}
                        hideHouseholderEstablishmentBadge={!!householderId}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className={cn("text-xs text-muted-foreground py-1", studyBibleDarkClasses.muted)}>No assigned to-dos.</p>
                )}
              </div>
            </div>
            <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-muted/15 dark:border-[#1c1921] dark:bg-[#2a2534]">
              <div className={cn("shrink-0 border-b border-border px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground dark:border-[#1c1921] dark:bg-[#30283c]", studyBibleDarkClasses.muted)}>
                Open ({filteredUnassignedOpenTodos.length})
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
                {filteredUnassignedOpenTodos.length > 0 ? (
                  <ul className="space-y-3">
                    {filteredUnassignedOpenTodos.map((todo, index) => (
                      <TodoRow
                        key={todo.id}
                        todo={todo}
                        onMarkDone={handleMarkDone}
                        onTap={hasNavigation ? handleTodoTap : undefined}
                        showCheckbox
                        currentUserId={userId}
                        showAssigneeAvatars={showAssigneeAvatars}
                        highlightOtherPublishers={showOtherPublisherDecorations}
                        participantsById={participantsById}
                    participantsReady={participantsReady}
                        rowIndex={index}
                        layoutId={`${layoutScopeId}-drawer-md-open-${todo.id}`}
                        layoutTransition={todoLayoutTransition}
                        clampBody={false}
                        hideHouseholderNameBadge={!!householderId}
                        hideHouseholderEstablishmentBadge={!!householderId}
                        headerAction={
                          userId ? (
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              className="h-7 rounded-full px-3 text-xs font-semibold bg-emerald-600/95 text-white shadow-sm hover:bg-emerald-500 hover:shadow-md hover:scale-[1.02] active:scale-100 transition-all"
                              disabled={takingTodoId === todo.id}
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleTakeTodoPrompt(todo);
                              }}
                            >
                              Take
                            </Button>
                          ) : null
                        }
                      />
                    ))}
                  </ul>
                ) : (
                  <p className={cn("text-xs text-muted-foreground py-1", studyBibleDarkClasses.muted)}>No unassigned to-dos.</p>
                )}
              </div>
            </div>
            <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-muted/15 dark:border-[#1c1921] dark:bg-[#2a2534]">
              <div className={cn("shrink-0 border-b border-border px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground dark:border-[#1c1921] dark:bg-[#30283c]", studyBibleDarkClasses.muted)}>
                Done ({filteredCompletedTodos.length})
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-3">
                {filteredCompletedTodos.length > 0 ? (
                  <ul className="space-y-3">
                    {filteredCompletedTodos.map((todo, index) => (
                      <TodoRow
                        key={todo.id}
                        todo={{ ...todo, is_done: true }}
                        onMarkDone={handleMarkDone}
                        onTap={hasNavigation ? handleTodoTap : undefined}
                        showCheckbox
                        currentUserId={userId}
                        showAssigneeAvatars={showAssigneeAvatars}
                        highlightOtherPublishers={showOtherPublisherDecorations}
                        participantsById={participantsById}
                    participantsReady={participantsReady}
                        rowIndex={index}
                        layoutId={`${layoutScopeId}-drawer-md-done-${todo.id}`}
                        layoutTransition={todoLayoutTransition}
                        clampBody={false}
                        hideHouseholderNameBadge={!!householderId}
                        hideHouseholderEstablishmentBadge={!!householderId}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className={cn("text-xs text-muted-foreground py-1", studyBibleDarkClasses.muted)}>No done to-dos.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );

  const renderContactSubdrawerBody = () => (
    <>
      {isLoadingContactSubdrawerDetails && !contactSubdrawerHouseholder ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading details...</div>
      ) : null}

      {contactSubdrawerHouseholder ? (
        <div
          className={cn(
            canContactSubdrawerSummaryEdit &&
              "cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
          role={canContactSubdrawerSummaryEdit ? "button" : undefined}
          tabIndex={canContactSubdrawerSummaryEdit ? 0 : undefined}
          onClick={canContactSubdrawerSummaryEdit ? openContactSubdrawerEntityEditor : undefined}
          onKeyDown={
            canContactSubdrawerSummaryEdit
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openContactSubdrawerEntityEditor();
                  }
                }
              : undefined
          }
          aria-label={
            canContactSubdrawerSummaryEdit
              ? `Edit ${contactSubdrawerHouseholder.name ?? "contact"}`
              : undefined
          }
        >
          <Card
            className={cn(
              "w-full",
              contactSubdrawerSurfaceClass,
              canContactSubdrawerSummaryEdit && "hover:opacity-95 transition-opacity"
            )}
          >
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
              {contactSubdrawerEstablishmentName ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "flex-shrink-0",
                    getStatusTextColor(contactSubdrawerEstablishmentStatus)
                  )}
                >
                  {contactSubdrawerEstablishmentName}
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
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <MapPinned className="h-4 w-4" />
              </a>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-4">
            <HouseholderSummaryFields area={contactSubdrawerArea} note={contactSubdrawerNote} />
          </CardContent>
        </Card>
        </div>
      ) : null}

      {contactSubdrawerHouseholder?.id ? (
        <HomeTodoCard
          householderId={contactSubdrawerHouseholder.id}
          prefillScopeKey={`householder:${contactSubdrawerHouseholder.id}`}
          prefillOpenTodos={contactSubdrawerPrefillOpenTodos}
          prefillCompletedTodos={contactSubdrawerPrefillCompletedTodos}
          preferLeftCompanionDrawer
          onTodoTap={(todo) =>
            openTodoEditorFromDetails(todo, contactSubdrawerVisits, {
              establishments: contactSubdrawerEstablishment
                ? [{ id: contactSubdrawerEstablishment.id, name: contactSubdrawerEstablishment.name }]
                : [],
              selectedEstablishmentId: contactSubdrawerEstablishment?.id,
              householderId: contactSubdrawerHouseholder.id,
              householderName: contactSubdrawerHouseholder.name,
              disableEstablishmentSelect: true,
            })
          }
        />
      ) : null}

      {contactSubdrawerVisits.length > 0 ? (
        <CallSection
          visits={contactSubdrawerVisits}
          isHouseholderContext
          establishments={contactSubdrawerEstablishment ? [contactSubdrawerEstablishment] : []}
          selectedEstablishmentId={contactSubdrawerEstablishment?.id}
          householderId={contactSubdrawerHouseholder?.id}
          householderName={contactSubdrawerHouseholder?.name}
          householderStatus={contactSubdrawerHouseholder?.status}
          isLoading={false}
          onVisitUpdated={() => {
            void refreshAfterContactSubdrawerEdit();
          }}
          preferLeftDetailPanel={isTodoDetailsSideLayout}
          insideStackedContactPane={isTodoDetailsSideLayout}
        />
      ) : null}
    </>
  );

  const entityEditDrawerTitle =
    contactSubdrawerEntityEditOpen || isHouseholderDetail ? "Edit Contact" : "Edit Establishment";

  const entityEditForms = (
    <>
      {contactSubdrawerEntityEditOpen && contactSubdrawerHouseholder?.id ? (
        <HouseholderForm
          key={contactSubdrawerHouseholder.id}
          establishments={
            contactSubdrawerEstablishment?.id
              ? [contactSubdrawerEstablishment as { id: string; name: string }]
              : []
          }
          selectedEstablishmentId={contactSubdrawerEstablishment?.id ?? undefined}
          isEditing
          initialData={{
            id: contactSubdrawerHouseholder.id,
            establishment_id: contactSubdrawerHouseholder.establishment_id ?? null,
            name: contactSubdrawerHouseholder.name,
            status: (contactSubdrawerHouseholder.status as HouseholderStatus) ?? "potential",
            note: contactSubdrawerHouseholder.note ?? null,
            lat: contactSubdrawerHouseholder.lat ?? null,
            lng: contactSubdrawerHouseholder.lng ?? null,
            publisher_id: contactSubdrawerHouseholder.publisher_id ?? null,
          }}
          disableEstablishmentSelect={!!contactSubdrawerEstablishment?.id}
          onSaved={() => {
            setContactSubdrawerEntityEditOpen(false);
            void refreshAfterContactSubdrawerEdit();
          }}
        />
      ) : isHouseholderDetail && selectedHouseholder?.id ? (
        <HouseholderForm
          key={selectedHouseholder.id}
          establishments={
            selectedHouseholderEstablishment?.id
              ? [selectedHouseholderEstablishment as { id: string; name: string }]
              : []
          }
          selectedEstablishmentId={selectedHouseholderEstablishment?.id ?? undefined}
          isEditing
          initialData={{
            id: selectedHouseholder.id,
            establishment_id: selectedHouseholder.establishment_id ?? null,
            name: selectedHouseholder.name,
            status: (selectedHouseholder.status as HouseholderStatus) ?? "potential",
            note: selectedHouseholder.note ?? null,
            lat: selectedHouseholder.lat ?? null,
            lng: selectedHouseholder.lng ?? null,
            publisher_id: selectedHouseholder.publisher_id ?? null,
          }}
          disableEstablishmentSelect={!!selectedHouseholderEstablishment?.id}
          onSaved={() => {
            setDetailsEntityEditOpen(false);
            void refreshTodoDetailEntity().then(() => broadcastTodosAndBusinessRefresh());
          }}
        />
      ) : selectedEstablishmentDetails?.id ? (
        <EstablishmentForm
          key={selectedEstablishmentDetails.id}
          isEditing
          initialData={selectedEstablishmentDetails}
          selectedArea={selectedEstablishmentDetails.area ?? undefined}
          onSaved={() => {
            setDetailsEntityEditOpen(false);
            void refreshTodoDetailEntity().then(() => broadcastTodosAndBusinessRefresh());
          }}
        />
      ) : null}
    </>
  );

  const detailsAndEditorLayers = (
    <>
      {isTodoDetailsSideLayout ? (
      <Drawer
        open={todoDetailsDrawerOpen}
        onOpenChange={handleTodoDetailsDrawerChange}
        direction="right"
        modal
        nested
        shouldScaleBackground={false}
      >
        <DrawerWideRightContent
          className={cn("dark:border-[#1c1921] dark:text-[#fffaff]", todoDetailsSheetPanelClass)}
        >
          <DrawerHeader className="bg-transparent px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center">
            <DrawerTitle className="text-center text-xl font-extrabold tracking-tight">{isHouseholderDetail
                ? (selectedHouseholder?.name || selectedTodoForDetails?.context_name || "Contact Details")
                : (selectedEstablishmentDetails?.name || selectedTodoForDetails?.context_name || "Establishment Details")}</DrawerTitle>
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2 space-y-3">
            {renderTodoDetailsBody()}
          </div>
        </DrawerWideRightContent>
      </Drawer>
      ) : (
      <HomeMobileDetailsDrawer
        open={todoDetailsDrawerOpen}
        onOpenChange={handleTodoDetailsDrawerChange}
        contentClassName={todoDetailsSheetPanelClass}
        title={
          isHouseholderDetail
            ? (selectedHouseholder?.name || selectedTodoForDetails?.context_name || "Contact Details")
            : (selectedEstablishmentDetails?.name || selectedTodoForDetails?.context_name || "Establishment Details")
        }
        bodyClassName="space-y-3"
      >
        {renderTodoDetailsBody()}
      </HomeMobileDetailsDrawer>
      )}

      {/* Second right sheet (portaled). Must sit above estab drawer (z-100) and left companion (z-102) so
          Framer `layoutId` layers from estab todos cannot paint on top of contact UI. */}
      {isTodoDetailsSideLayout ? (
        <Drawer
          open={contactDetailsSubdrawerOpen && todoDetailsDrawerOpen}
          onOpenChange={(open) => {
            setContactDetailsSubdrawerOpen(open);
            if (!open) {
              setSelectedContactFromEstablishment(null);
            }
          }}
          direction="right"
          modal
          shouldScaleBackground={false}
        >
          <DrawerWideRightContent
            stackAboveDetailsSheet
            className={cn("dark:border-[#1c1921] dark:text-[#fffaff]", todoContactSheetPanelClass)}
          >
            <DrawerHeader className="bg-transparent px-2 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-left sm:px-4">
              <div className="relative flex items-center justify-center gap-1 pr-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute left-0 h-9 w-9 shrink-0"
                  onClick={closeContactDetailsSubdrawer}
                  aria-label="Back to establishment"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <DrawerTitle className="px-10 text-center text-xl font-extrabold tracking-tight">
                  {contactSubdrawerHouseholder?.name || "Contact Details"}
                </DrawerTitle>
              </div>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2 space-y-3">
              {renderContactSubdrawerBody()}
            </div>
          </DrawerWideRightContent>
        </Drawer>
      ) : (
        <HomeMobileDetailsDrawer
          open={contactDetailsSubdrawerOpen}
          onOpenChange={(open) => {
            setContactDetailsSubdrawerOpen(open);
            if (!open) {
              setSelectedContactFromEstablishment(null);
            }
          }}
          contentClassName={todoContactSheetPanelClass}
          title={contactSubdrawerHouseholder?.name || "Contact Details"}
          bodyClassName="space-y-3"
        >
          {renderContactSubdrawerBody()}
        </HomeMobileDetailsDrawer>
      )}

      {isTodoDetailsSideLayout ? (
        <Drawer
          open={detailsEntityEditOpen || contactSubdrawerEntityEditOpen}
          onOpenChange={(open) => {
            if (!open) {
              setDetailsEntityEditOpen(false);
              setContactSubdrawerEntityEditOpen(false);
            }
          }}
          direction="left"
          modal
          nested
          shouldScaleBackground={false}
        >
          <DrawerWideLeftContentTop
            stackAboveStackedRightSheet={contactDetailsSubdrawerOpen && isTodoDetailsSideLayout}
            className={cn("dark:border-[#1c1921] dark:text-[#fffaff]", todoEntityEditSheetPanelClass)}
          >
            <DrawerHeader className="bg-transparent px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center">
              <DrawerTitle className="text-center text-lg font-bold">{entityEditDrawerTitle}</DrawerTitle>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2">
              {entityEditForms}
            </div>
          </DrawerWideLeftContentTop>
        </Drawer>
      ) : (
        <HomeMobileDetailsDrawer
          open={detailsEntityEditOpen || contactSubdrawerEntityEditOpen}
          onOpenChange={(open) => {
            if (!open) {
              setDetailsEntityEditOpen(false);
              setContactSubdrawerEntityEditOpen(false);
            }
          }}
          title={entityEditDrawerTitle}
          contentClassName={cn(todoEntityEditSheetPanelClass, "md:max-h-[80dvh]")}
        >
          {entityEditForms}
        </HomeMobileDetailsDrawer>
      )}

      {todoEditorUseLeftPanel && todoEditorContext ? (
        <Drawer
          open={!!todoEditorContext}
          onOpenChange={(open) => {
            if (!open) {
              setTodoEditorContext(null);
              setTodoEditorUseLeftPanel(false);
            }
          }}
          direction="left"
          modal
          shouldScaleBackground={false}
        >
          <DrawerWideLeftContentTop
            stackAboveStackedRightSheet={contactDetailsSubdrawerOpen && isTodoDetailsSideLayout}
            className={cn("dark:border-[#1c1921] dark:text-[#fffaff]", todoEditorSheetPanelClass)}
          >
            <DrawerHeader className="bg-transparent px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center">
              <DrawerTitle className="text-center text-lg font-bold">Edit To-Do</DrawerTitle>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2">
              <TodoForm
                establishments={todoEditorContext.establishments}
                selectedEstablishmentId={todoEditorContext.selectedEstablishmentId}
                initialTodo={todoEditorContext.initialTodo}
                householderId={todoEditorContext.householderId}
                householderName={todoEditorContext.householderName}
                disableEstablishmentSelect={todoEditorContext.disableEstablishmentSelect}
                onSaved={() => {
                  setTodoEditorContext(null);
                  setTodoEditorUseLeftPanel(false);
                  void refreshTodoDetailEntity().then(() => broadcastTodosAndBusinessRefresh());
                }}
              />
            </div>
          </DrawerWideLeftContentTop>
        </Drawer>
      ) : (
      <FormModal
        open={!!todoEditorContext}
        onOpenChange={(open) => {
          if (!open) {
            setTodoEditorContext(null);
            setTodoEditorUseLeftPanel(false);
          }
        }}
        title="Edit To-Do"
        headerClassName="text-center"
      >
        {todoEditorContext ? (
          <TodoForm
            establishments={todoEditorContext.establishments}
            selectedEstablishmentId={todoEditorContext.selectedEstablishmentId}
            initialTodo={todoEditorContext.initialTodo}
            householderId={todoEditorContext.householderId}
            householderName={todoEditorContext.householderName}
            disableEstablishmentSelect={todoEditorContext.disableEstablishmentSelect}
            onSaved={() => {
              setTodoEditorContext(null);
              setTodoEditorUseLeftPanel(false);
              void refreshTodoDetailEntity().then(() => broadcastTodosAndBusinessRefresh());
            }}
          />
        ) : null}
      </FormModal>
      )}
    </>
  );

  if (detailsBridgeOnly) {
    return detailsAndEditorLayers;
  }

  return (
    <>
      <div className={cn("rounded-lg border overflow-hidden bg-background", studyBibleDarkClasses.todoCard, className)}>
        <div className={cn("flex h-full min-h-0 flex-col", headerVariant === "bar" ? "" : "p-4")}>
          <button
            type="button"
            onClick={openTodoDrawer}
            className={cn(
              headerVariant === "bar"
                ? "flex h-10 shrink-0 items-center gap-2 border-b px-4 text-sm font-medium hover:bg-muted/50 transition-colors"
                : "text-xs text-muted-foreground mb-4 flex items-center gap-1.5 w-full text-left hover:text-foreground transition-colors",
              headerVariant === "bar" ? studyBibleDarkClasses.callsHeader : studyBibleDarkClasses.muted
            )}
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
              <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-80 dark:opacity-100" />
          </button>
          <div className={cn("min-h-0 flex-1 overflow-y-auto scrollbar-hide", headerVariant === "bar" && "p-4")}>
            <ul className="space-y-2.5">
              {filteredOpenTodos.length === 0 && filteredCompletedTodos.length === 0 ? (
                <li className={cn("text-sm text-muted-foreground py-1", studyBibleDarkClasses.muted)}>{emptyText}</li>
              ) : (
                displayTodos.map((todo, index) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    onMarkDone={handleMarkDone}
                    onTap={hasNavigation ? handleTodoTap : undefined}
                    showCheckbox
                    currentUserId={userId}
                    showAssigneeAvatars={showAssigneeAvatars}
                    highlightOtherPublishers={showOtherPublisherDecorations}
                    participantsById={participantsById}
                    participantsReady={participantsReady}
                    rowIndex={index}
                    layoutId={`${layoutScopeId}-card-${todo.id}`}
                    layoutTransition={todoLayoutTransition}
                    hideHouseholderNameBadge={!!householderId}
                    hideHouseholderEstablishmentBadge={!!householderId}
                  />
                ))
              )}
            </ul>
            {filteredCompletedTodos.length > 0 && (
              <>
                <div className={cn("text-xs text-muted-foreground mt-4 mb-2 font-medium inline-flex items-center gap-1.5", studyBibleDarkClasses.muted)}>
                  <span>Done</span>
                  <Badge
                    variant="secondary"
                    className="h-4 rounded-full px-1.5 text-[10px] leading-none"
                  >
                    {doneCount}
                  </Badge>
                </div>
                {filteredOpenTodos.length === 0 && (
                  <ul className="space-y-2.5">
                    {displayCompletedPreview.map((todo, index) => (
                      <TodoRow
                        key={todo.id}
                        todo={{ ...todo, is_done: true }}
                        onMarkDone={handleMarkDone}
                        onTap={hasNavigation ? handleTodoTap : undefined}
                        showCheckbox
                        currentUserId={userId}
                        showAssigneeAvatars={showAssigneeAvatars}
                        highlightOtherPublishers={showOtherPublisherDecorations}
                        participantsById={participantsById}
                    participantsReady={participantsReady}
                        rowIndex={index}
                        layoutId={`${layoutScopeId}-card-${todo.id}`}
                        layoutTransition={todoLayoutTransition}
                        hideHouseholderNameBadge={!!householderId}
                        hideHouseholderEstablishmentBadge={!!householderId}
                      />
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) {
            setDrawerTodoExpanded(true);
            setDrawerOpenSectionExpanded(true);
            setDrawerDoneExpanded(false);
            setFilterDrawerOpen(false);
          }
        }}
        {...(prefersCompanionLeftTodoDrawer
          ? { direction: "left" as const, modal: true, nested: true, shouldScaleBackground: false }
          : {})}
      >
        {prefersCompanionLeftTodoDrawer ? (
          <DrawerWideLeftContent
            className={cn("dark:border-[#1c1921] dark:text-[#fffaff]", todoMainDrawerPanelClass)}
          >
            <DrawerHeader className="shrink-0 bg-transparent px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center">
              <DrawerTitle className="flex w-full flex-wrap items-center justify-center gap-2 text-center text-lg font-bold">
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
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2">
                {renderTodoDrawerBody()}
              </div>
            </div>
          </DrawerWideLeftContent>
        ) : (
          <DrawerContent
            className={cn(
              "h-[85svh] max-h-[85svh] md:h-[92dvh] md:max-h-[92dvh] dark:border-[#1c1921] dark:text-[#fffaff] [&_.drawer-content-inner]:flex [&_.drawer-content-inner]:flex-col [&_.drawer-content-inner]:overflow-hidden",
              todoMainDrawerPanelClass
            )}
            handleClassName="dark:bg-[#80778e] dark:shadow-[0_0_18px_rgba(128,119,142,0.45)]"
          >
            <DrawerHeader className="px-4 pt-4 pb-2 items-center shrink-0 bg-transparent">
              <DrawerTitle className="flex w-full flex-wrap items-center justify-center gap-2 text-center text-lg font-bold">
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
            <div className="flex min-h-0 flex-1 flex-col px-4">
              <div
                className={cn(
                  "relative min-h-0 flex-1",
                  isTodoDetailsSideLayout
                    ? "overflow-hidden"
                    : "overflow-y-auto overscroll-contain pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]"
                )}
              >
                {renderTodoDrawerBody()}
              </div>
            </div>
          </DrawerContent>
        )}
      </Drawer>

      <Drawer open={takeTodoConfirmOpen} onOpenChange={setTakeTodoConfirmOpen}>
        <DrawerContent className="flex flex-col" style={{ maxHeight: "50vh", height: "50vh" }}>
          <div className="flex flex-1 flex-col justify-center px-4 min-h-0">
            <DrawerHeader className="pt-6 px-4 pb-2 text-center">
              <DrawerTitle className="text-center">Take this To-Do?</DrawerTitle>
            </DrawerHeader>
            <DrawerFooter className="flex flex-col gap-3 p-0 pt-4 pb-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full h-12"
                onClick={() => {
                  setTakeTodoConfirmOpen(false);
                  setTodoPendingTake(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="lg"
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white"
                disabled={!todoPendingTake || !userId || takingTodoId === todoPendingTake?.id}
                onClick={handleConfirmTakeTodo}
              >
                {takingTodoId === todoPendingTake?.id ? "Taking..." : "Take"}
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      {isTodoDetailsSideLayout ? (
        <Drawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen} direction="left" modal shouldScaleBackground={false}>
          <DrawerWideLeftContent
            className={cn("dark:border-[#1c1921] dark:text-[#fffaff]", todoFilterDrawerPanelClass)}
          >
            <DrawerHeader className="shrink-0 bg-transparent px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center">
              <DrawerTitle className="flex w-full items-center justify-center gap-2 text-center text-lg font-bold">
                <ListTodo className="h-4 w-4 shrink-0" />
                Filter To-Dos
              </DrawerTitle>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2">
                <VisitFiltersForm
                  filters={filters}
                  statusOptions={statusOptions}
                  areaOptions={areaOptions}
                  assigneeOptions={assigneeFilterOptions}
                  dueDateYmd={dueDateFilter ? toLocalDateString(dueDateFilter) : null}
                  onDueDateYmdChange={(ymd) => setDueDateFilter(ymd ? parseLocalDateString(ymd) : null)}
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
            </div>
          </DrawerWideLeftContent>
        </Drawer>
      ) : (
        <Drawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen} modal shouldScaleBackground={false}>
          <DrawerContent
            className={cn(
              "max-h-[85svh] dark:border-[#1c1921] dark:text-[#fffaff] [&_.drawer-content-inner]:flex [&_.drawer-content-inner]:flex-col [&_.drawer-content-inner]:overflow-hidden",
              todoFilterDrawerPanelClass
            )}
            handleClassName="dark:bg-[#80778e] dark:shadow-[0_0_18px_rgba(128,119,142,0.45)]"
          >
            <DrawerHeader className="shrink-0 bg-transparent px-4 pb-2 pt-4 text-center">
              <DrawerTitle className="flex w-full items-center justify-center gap-2 text-center text-lg font-bold">
                <ListTodo className="h-4 w-4 shrink-0" />
                Filter To-Dos
              </DrawerTitle>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2">
                <VisitFiltersForm
                  filters={filters}
                  statusOptions={statusOptions}
                  areaOptions={areaOptions}
                  assigneeOptions={assigneeFilterOptions}
                  dueDateYmd={dueDateFilter ? toLocalDateString(dueDateFilter) : null}
                  onDueDateYmdChange={(ymd) => setDueDateFilter(ymd ? parseLocalDateString(ymd) : null)}
                  onFiltersChange={setFilters}
                  onClearFilters={clearFilters}
                />
                <div className="flex justify-end pt-4">
                  <Button type="button" variant="outline" onClick={() => setFilterDrawerOpen(false)}>
                    Done
                  </Button>
                </div>
              </div>
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {detailsAndEditorLayers}



      {isTodoDetailsSideLayout ? (
        <Drawer
          open={bulkEditPromptOpen}
          onOpenChange={setBulkEditPromptOpen}
          direction="right"
          modal
          nested
          shouldScaleBackground={false}
        >
          <DrawerWideRightContent
            className={cn(
              "dark:border-[#1c1921] dark:text-[#fffaff] md:max-h-[100lvh]",
              todoBulkEditPickerPanelClass
            )}
          >
            <DrawerHeader className="bg-transparent shrink-0 px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center">
              <DrawerTitle className="text-center text-xl font-bold">Edit To-Dos</DrawerTitle>
              <DrawerDescription className={cn("text-center text-sm", studyBibleDarkClasses.muted)}>
                Select which filtered to-dos to load into bulk edit.
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2">
              <div className="flex min-h-0 flex-1 flex-col space-y-4 overflow-hidden">
                <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border", studyBibleDarkClasses.todoCard)}>
                  {selectableTodos.length === 0 ? (
                    <p className={cn("text-sm px-2 py-3", studyBibleDarkClasses.muted)}>
                      No to-dos available from current filters.
                    </p>
                  ) : (
                    <>
                      <div
                        className={cn(
                          "flex shrink-0 items-center gap-2 border-b px-3 py-2 dark:border-[#1c1921]",
                          studyBibleDarkClasses.laneTitleBar
                        )}
                      >
                        <Checkbox
                          id="bulk-edit-select-all-tablet"
                          checked={
                            bulkEditSelectAllState.allSelected
                              ? true
                              : bulkEditSelectAllState.someSelected
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={(value) => toggleBulkEditSelectAll(value === true)}
                          aria-label={
                            bulkEditSelectAllState.allSelected ? "Unselect all" : "Select all"
                          }
                        />
                        <Label
                          htmlFor="bulk-edit-select-all-tablet"
                          className="cursor-pointer text-sm font-medium dark:text-[#fffaff]"
                        >
                          Select all
                        </Label>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto space-y-3 p-2">
                        {selectableAssignedTodos.length > 0 ? (
                          <div className="space-y-2">
                            <p className={cn("px-1 text-xs font-semibold uppercase tracking-wide", studyBibleDarkClasses.muted)}>
                              To-Do ({selectableAssignedTodos.length})
                            </p>
                            {selectableAssignedTodos.map((todo) => (
                              <BulkEditTodoListItem
                                key={todo.id}
                                todo={todo}
                                checked={selectedTodoIds.includes(todo.id)}
                                participantsById={participantsById}
                                participantsReady={participantsReady}
                                onCheckedChange={(next) => toggleSelectedTodo(todo.id, next)}
                              />
                            ))}
                          </div>
                        ) : null}
                        {selectableUnassignedTodos.length > 0 ? (
                          <div className="space-y-2">
                            <p className={cn("px-1 text-xs font-semibold uppercase tracking-wide", studyBibleDarkClasses.muted)}>
                              Open ({selectableUnassignedTodos.length})
                            </p>
                            {selectableUnassignedTodos.map((todo) => (
                              <BulkEditTodoListItem
                                key={todo.id}
                                todo={todo}
                                checked={selectedTodoIds.includes(todo.id)}
                                participantsById={participantsById}
                                participantsReady={participantsReady}
                                onCheckedChange={(next) => toggleSelectedTodo(todo.id, next)}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
                <div className="flex shrink-0 justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="dark:border-[#80778e]/55 dark:text-[#fffaff] dark:hover:bg-[#3b3348]/70"
                    onClick={() => setBulkEditPromptOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="dark:bg-[#80778e] dark:text-white dark:hover:bg-[#9a92a8]"
                    onClick={confirmBulkEdit}
                    disabled={selectedTodoIds.length === 0}
                  >
                    Load Selected ({selectedTodoIds.length})
                  </Button>
                </div>
              </div>
            </div>
          </DrawerWideRightContent>
        </Drawer>
      ) : (
        <FormModal
          open={bulkEditPromptOpen}
          onOpenChange={setBulkEditPromptOpen}
          title="Edit To-Dos"
          description="Select which filtered to-dos to load into bulk edit."
          headerClassName="text-center shrink-0 bg-transparent dark:bg-transparent px-4 pb-2 pt-2"
          className={cn(
            todoBulkEditPickerPanelClass,
            "dark:border-[#1c1921] dark:text-[#fffaff] max-h-[85svh] [&_.drawer-content-inner]:flex [&_.drawer-content-inner]:flex-col [&_.drawer-content-inner]:min-h-0 [&_.drawer-content-inner]:overflow-hidden"
          )}
          drawerHandleClassName="dark:bg-[#80778e] dark:shadow-[0_0_18px_rgba(128,119,142,0.45)]"
          drawerDescriptionClassName="text-center px-2"
          bodyClassName="flex min-h-0 flex-1 flex-col px-4 pb-2 pt-0"
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]">
            <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border", studyBibleDarkClasses.todoCard)}>
              {selectableTodos.length === 0 ? (
                <p className={cn("text-sm px-2 py-3", studyBibleDarkClasses.muted)}>
                  No to-dos available from current filters.
                </p>
              ) : (
                <>
                  <div
                    className={cn(
                      "flex items-center gap-2 border-b px-3 py-2 shrink-0 dark:border-[#1c1921]",
                      studyBibleDarkClasses.laneTitleBar
                    )}
                  >
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
                    <Label htmlFor="bulk-edit-select-all" className="text-sm font-medium cursor-pointer dark:text-[#fffaff]">
                      Select all
                    </Label>
                  </div>
                  <div className="min-h-0 flex-1 max-h-[50vh] overflow-y-auto space-y-3 p-2">
                    {selectableAssignedTodos.length > 0 ? (
                      <div className="space-y-2">
                        <p className={cn("px-1 text-xs font-semibold uppercase tracking-wide", studyBibleDarkClasses.muted)}>
                          To-Do ({selectableAssignedTodos.length})
                        </p>
                        {selectableAssignedTodos.map((todo) => (
                          <BulkEditTodoListItem
                            key={todo.id}
                            todo={todo}
                            checked={selectedTodoIds.includes(todo.id)}
                            participantsById={participantsById}
                            participantsReady={participantsReady}
                            onCheckedChange={(next) => toggleSelectedTodo(todo.id, next)}
                          />
                        ))}
                      </div>
                    ) : null}
                    {selectableUnassignedTodos.length > 0 ? (
                      <div className="space-y-2">
                        <p className={cn("px-1 text-xs font-semibold uppercase tracking-wide", studyBibleDarkClasses.muted)}>
                          Open ({selectableUnassignedTodos.length})
                        </p>
                        {selectableUnassignedTodos.map((todo) => (
                          <BulkEditTodoListItem
                            key={todo.id}
                            todo={todo}
                            checked={selectedTodoIds.includes(todo.id)}
                            participantsById={participantsById}
                            participantsReady={participantsReady}
                            onCheckedChange={(next) => toggleSelectedTodo(todo.id, next)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </>
              )}
            </div>
            <div className="flex shrink-0 justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="dark:border-[#80778e]/55 dark:text-[#fffaff] dark:hover:bg-[#3b3348]/70"
                onClick={() => setBulkEditPromptOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="dark:bg-[#80778e] dark:text-white dark:hover:bg-[#9a92a8]"
                onClick={confirmBulkEdit}
                disabled={selectedTodoIds.length === 0}
              >
                Load Selected ({selectedTodoIds.length})
              </Button>
            </div>
          </div>
        </FormModal>
      )}

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

/** Assignee avatar for todo rows — uses cached publisher profiles; never shows "AS" from a placeholder. */
function TodoAssigneeAvatar({
  slot,
  profile,
  participantsReady,
  className = "h-5 w-5 border border-border/70 dark:border-[#1c1921]",
}: {
  slot: TodoAssigneeSlot;
  profile?: ParticipantProfile;
  participantsReady: boolean;
  className?: string;
}) {
  const isPublisher = slot.type === "publisher";
  const { initials, isLoading, displayName } = getAssigneeAvatarInitials({
    isPublisher,
    profile: isPublisher ? profile : null,
    guestName: isPublisher ? undefined : slot.name,
    participantsReady,
  });

  return (
    <Avatar className={className}>
      {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={displayName} /> : null}
      <AvatarFallback
        className={cn("text-[10px]", isLoading && "animate-pulse bg-muted/60 text-transparent dark:bg-[#3b3348]/60")}
      >
        {isLoading ? "\u00a0" : initials}
      </AvatarFallback>
    </Avatar>
  );
}

/** Edit To-Dos picker row — matches drawer density: context badges, assignees, due date, body, area. */
function BulkEditTodoListItem({
  todo,
  checked,
  participantsById,
  participantsReady,
  onCheckedChange,
}: {
  todo: MyOpenCallTodoItem;
  checked: boolean;
  participantsById: Record<string, ParticipantProfile>;
  participantsReady: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const householderStatus = todo.context_status || "for_scouting";
  const establishmentStatus = todo.context_establishment_status || "for_scouting";
  const isHouseholder = !!todo.householder_id;
  const assigneeSlots = getTodoAssigneeSlots(todo);
  const areaLabel = todo.context_area?.trim() ?? "";
  const displayDate = todo.deadline_date;

  return (
    <label
      className={cn(
        "flex items-start gap-2 rounded-md px-2 py-2 cursor-pointer",
        "hover:bg-muted/40 dark:hover:bg-[#3b3348]/45"
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="mt-1 shrink-0 h-5 w-5"
      />
      <div className="min-w-0 flex-1 flex flex-col gap-2 pr-2.5">
        {todo.context_name || assigneeSlots.length > 0 ? (
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
                      className={cn(
                        "truncate min-w-0 max-w-[55%] whitespace-nowrap",
                        getStatusTextColor(establishmentStatus)
                      )}
                    />
                  ) : null}
                </>
              ) : null}
            </div>
            {assigneeSlots.length > 0 ? (
              <div className="inline-flex items-center gap-1 shrink-0 ml-auto pl-1">
                {assigneeSlots.map((slot, idx) => (
                  <TodoAssigneeAvatar
                    key={`${todo.id}-${slot.type === "publisher" ? slot.id : `guest-${slot.name}-${idx}`}`}
                    slot={slot}
                    profile={slot.type === "publisher" ? participantsById[slot.id] : undefined}
                    participantsReady={participantsReady}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="flex items-start gap-2 w-full min-w-0">
          <p className="text-left text-base leading-snug line-clamp-2 flex-1 min-w-0 dark:text-[#fffaff]">{todo.body}</p>
          {displayDate || areaLabel ? (
            <div className="flex flex-col items-end gap-0.5 shrink-0 max-w-[45%] text-right">
              {displayDate ? (
                <span className={cn("text-xs tabular-nums leading-snug pt-0.5", studyBibleDarkClasses.muted)}>
                  {formatTodoDate(displayDate)}
                </span>
              ) : null}
              {areaLabel ? (
                <span className={cn("text-xs leading-snug", studyBibleDarkClasses.subtle)} title={areaLabel}>
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
  onMarkDone,
  onTap,
  showCheckbox = false,
  currentUserId,
  showAssigneeAvatars = false,
  highlightOtherPublishers = false,
  participantsById = {},
  participantsReady = false,
  layoutId,
  layoutTransition,
  rowIndex,
  clampBody = true,
  hideHouseholderNameBadge = false,
  hideHouseholderEstablishmentBadge = false,
  headerAction,
}: {
  todo: MyOpenCallTodoItem;
  onMarkDone: (todo: MyOpenCallTodoItem, checked: boolean) => void;
  onTap?: (todo: MyOpenCallTodoItem) => void;
  showCheckbox?: boolean;
  currentUserId?: string;
  showAssigneeAvatars?: boolean;
  highlightOtherPublishers?: boolean;
  participantsById?: Record<string, ParticipantProfile>;
  participantsReady?: boolean;
  layoutId?: string;
  layoutTransition?: { type: "spring"; stiffness: number; damping: number };
  rowIndex?: number;
  clampBody?: boolean;
  hideHouseholderNameBadge?: boolean;
  hideHouseholderEstablishmentBadge?: boolean;
  headerAction?: ReactNode;
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
  const assigneeSlots = getTodoAssigneeSlots(todo);
  const areaLabel = todo.context_area?.trim() ?? "";
  const hasNameBadge = isHouseholder ? !hideHouseholderNameBadge && !!todo.context_name : !!todo.context_name;
  const hasEstablishmentBadge =
    isHouseholder && !!todo.context_establishment_name && !hideHouseholderEstablishmentBadge;
  const hasVisibleBadges = hasNameBadge || hasEstablishmentBadge;
  const collapseHeaderRow = !hasVisibleBadges && !headerAction;
  const assigneeAvatarsNode =
    showAssigneeAvatars && assigneeSlots.length > 0 ? (
      <div className="inline-flex items-center gap-1 shrink-0 ml-auto pl-1">
        {assigneeSlots.map((slot, idx) => (
          <TodoAssigneeAvatar
            key={`${todo.id}-${slot.type === "publisher" ? slot.id : `guest-${slot.name}-${idx}`}`}
            slot={slot}
            profile={slot.type === "publisher" ? participantsById[slot.id] : undefined}
            participantsReady={participantsReady}
            className="h-5 w-5 border border-border/70"
          />
        ))}
      </div>
    ) : null;
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
        {!collapseHeaderRow && (todo.context_name || (showAssigneeAvatars && assigneeSlots.length > 0) || !!headerAction) ? (
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
                  {isHouseholder && todo.context_establishment_name && !hideHouseholderEstablishmentBadge ? (
                    <VisitStatusBadge
                      status={establishmentStatus}
                      label={truncateLabel(todo.context_establishment_name, 24)}
                      className={cn(
                        "truncate min-w-0 max-w-[55%] whitespace-nowrap",
                        getStatusTextColor(establishmentStatus),
                        isDone && "opacity-70"
                      )}
                    />
                  ) : null}
                </>
              ) : null}
            </div>
            {headerAction ?? assigneeAvatarsNode}
          </div>
        ) : null}
        <div className={cn("flex gap-2 w-full min-w-0", collapseHeaderRow ? "items-center" : "items-start")}>
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
          {displayDate || areaLabel || (collapseHeaderRow && assigneeAvatarsNode) ? (
            <div
              className={cn(
                "flex flex-col items-end gap-0.5 shrink-0 max-w-[45%] text-right",
                isDone && "opacity-70"
              )}
            >
              {collapseHeaderRow ? assigneeAvatarsNode : null}
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
    "flex items-center gap-2 text-sm group rounded-md py-2.5 pl-2 dark:text-[#fffaff]",
    isEvenRow && "bg-muted/30",
    hasOtherPublisherHighlight &&
      "border border-dashed border-muted-foreground/40 dark:border-[#5a5068] px-1.5 py-2.5",
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
