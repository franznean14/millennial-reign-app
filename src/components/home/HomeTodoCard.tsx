"use client";

import {
  useEffect,
  useState,
  useCallback,
  useRef,
  useMemo,
  useId,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
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
  getContactOpenCallTodos,
  getContactCompletedCallTodos,
  getContactDetails,
  getBwiParticipants,
  getEstablishmentDetails,
  updateCallTodo,
  updateStandaloneTodo,
  type MyOpenCallTodoItem,
  type EstablishmentWithDetails,
  type VisitWithUser,
  type ContactWithDetails,
  type ContactStatus,
  isEstablishmentTodoMissingLocation,
} from "@/lib/db/business";
import { getProfile } from "@/lib/db/profiles";
import { canAssignCongregationOpenTodos } from "@/lib/app/nav-permissions-cache";
import { cacheGet, cacheSet, cacheDelete } from "@/lib/offline/store";
import {
  establishmentDetailsCacheKey,
  contactDetailsCacheKey,
  resolveEstablishmentDetailsSnapshot,
  resolveContactDetailsSnapshot,
  warmEstablishmentDetailsInMemory,
  warmContactDetailsInMemory,
  type EstablishmentDetailsSnapshot,
  type ContactDetailsSnapshot,
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
import { MissingEstablishmentLocationIcon } from "@/components/business/MissingEstablishmentLocationIcon";
import { cn } from "@/lib/utils";
import { formatStatusText } from "@/lib/utils/formatters";
import { Badge } from "@/components/ui/badge";
import { FormModal } from "@/components/shared/FormModal";
import { FormDrawerRoot, FormDrawerContent } from "@/components/shared/FormDrawerPhone";
import { drawerFormScrollPadClass, homeListDrawerHeightClass, homeListDrawerTabletColumnsClass } from "@/lib/theme/form-drawer-phone";
import { useHomeTodoDetailsFabOptional } from "@/components/home/home-todo-details-fab-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAssigneeAvatarInitials } from "@/lib/utils/visit-history-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMobile } from "@/lib/hooks/use-mobile";
import { getBestStatus, getContactPrimaryStatus, getStatusColor, getStatusTextColor, resolveContactStatuses } from "@/lib/utils/status-hierarchy";
import { CallSection } from "@/components/business/CallSection";
import { ContactsSection } from "@/components/business/ContactsSection";
import { TodoForm } from "@/components/business/TodoForm";
import { EstablishmentForm } from "@/components/business/EstablishmentForm";
import { EstablishmentSummaryFields } from "@/components/business/EstablishmentSummaryFields";
import { ContactSummaryFields } from "@/components/business/ContactSummaryFields";
import { ContactForm } from "@/components/business/ContactForm";
import { useMediaQuery } from "@/hooks/use-media-query";
import { studyBibleDarkClasses, getStudyBibleDarkCardShade, getStudyBibleHomeCardShade } from "@/lib/theme/study-bible-dark";
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
const HOME_TODO_FILTERS_SYNC_EVENT = "home-todos-filters-sync";
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
  contactId?: string;
  contactName?: string;
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

function stringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function visitFiltersEqual(a: VisitFilters, b: VisitFilters): boolean {
  return (
    a.search === b.search &&
    a.myUpdatesOnly === b.myUpdatesOnly &&
    a.bwiOnly === b.bwiOnly &&
    a.contactOnly === b.contactOnly &&
    a.callDateFrom === b.callDateFrom &&
    a.callDateTo === b.callDateTo &&
    stringArraysEqual(a.statuses, b.statuses) &&
    stringArraysEqual(a.areas, b.areas) &&
    stringArraysEqual(a.assigneeIds, b.assigneeIds)
  );
}

function mergeVisitFiltersFromHydrated(prev: VisitFilters, hydrated: VisitFilters): VisitFilters {
  return {
    search: typeof hydrated.search === "string" ? hydrated.search : prev.search,
    statuses: Array.isArray(hydrated.statuses) ? hydrated.statuses : prev.statuses,
    areas: Array.isArray(hydrated.areas) ? hydrated.areas : prev.areas,
    assigneeIds: Array.isArray(hydrated.assigneeIds)
      ? hydrated.assigneeIds.filter((id): id is string => typeof id === "string")
      : prev.assigneeIds,
    myUpdatesOnly:
      typeof hydrated.myUpdatesOnly === "boolean" ? hydrated.myUpdatesOnly : prev.myUpdatesOnly,
    bwiOnly: typeof hydrated.bwiOnly === "boolean" ? hydrated.bwiOnly : prev.bwiOnly,
    contactOnly:
      typeof hydrated.contactOnly === "boolean"
        ? hydrated.contactOnly
        : prev.contactOnly,
    callDateFrom:
      hydrated.callDateFrom === null || typeof hydrated.callDateFrom === "string"
        ? hydrated.callDateFrom
        : prev.callDateFrom,
    callDateTo:
      hydrated.callDateTo === null || typeof hydrated.callDateTo === "string"
        ? hydrated.callDateTo
        : prev.callDateTo,
  };
}

type StoredTodoFiltersPayload = {
  filters?: VisitFilters;
  searchValue?: string;
  dueDate?: string | null;
};

function serializeStoredTodoFiltersPayload(
  filters: VisitFilters,
  searchValue: string,
  dueDateFilter: Date | null
): string {
  return JSON.stringify({
    filters,
    searchValue,
    dueDate: dueDateFilter ? toLocalDateString(dueDateFilter) : null,
  });
}

function dueDatesEqual(a: Date | null, b: Date | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return toLocalDateString(a) === toLocalDateString(b);
}

function applyStoredTodoFiltersFromParsed(
  parsed: StoredTodoFiltersPayload,
  current: {
    filters: VisitFilters;
    searchValue: string;
    dueDateFilter: Date | null;
  },
  setters: {
    setFilters: Dispatch<SetStateAction<VisitFilters>>;
    setSearchValue: Dispatch<SetStateAction<string>>;
    setIsSearchActive: Dispatch<SetStateAction<boolean>>;
    setDueDateFilter: Dispatch<SetStateAction<Date | null>>;
  }
): void {
  const hydrated = parsed.filters;
  if (hydrated) {
    const merged = mergeVisitFiltersFromHydrated(current.filters, hydrated);
    if (!visitFiltersEqual(current.filters, merged)) {
      setters.setFilters(merged);
    }
  }
  if (typeof parsed.searchValue === "string" && parsed.searchValue !== current.searchValue) {
    setters.setSearchValue(parsed.searchValue);
    setters.setIsSearchActive(parsed.searchValue.trim().length > 0);
  }
  const nextDue = parseLocalDateString(parsed.dueDate);
  if (!dueDatesEqual(current.dueDateFilter, nextDue)) {
    setters.setDueDateFilter(nextDue);
  }
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
    if (daysUntilDeadline < 0) return "bg-red-500/[0.1] dark:bg-red-500/[0.04]";
    if (daysUntilDeadline < 7) return "bg-orange-500/[0.09] dark:bg-orange-500/[0.036]";
    if (daysUntilDeadline < 14) return "bg-yellow-500/[0.08] dark:bg-yellow-500/[0.034]";
    return "bg-green-500/[0.08] dark:bg-green-500/[0.034]";
  }
  if (daysUntilDeadline < 0) return "bg-red-500/[0.14] dark:bg-red-500/[0.06]";
  if (daysUntilDeadline < 7) return "bg-orange-500/[0.12] dark:bg-orange-500/[0.055]";
  if (daysUntilDeadline < 14) return "bg-yellow-500/[0.1] dark:bg-yellow-500/[0.05]";
  return "bg-green-500/[0.1] dark:bg-green-500/[0.05]";
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

function isUnassignedTodoItem(todo: MyOpenCallTodoItem): boolean {
  return (
    !todo.publisher_id &&
    !todo.partner_id &&
    !(todo.publisher_guest_name?.trim()) &&
    !(todo.partner_guest_name?.trim())
  );
}

/** Matches home "My To-Dos" filter: assigned to me or unassigned congregation pool. */
function matchesMyTodosFilter(todo: MyOpenCallTodoItem, userId: string): boolean {
  const isMine = todo.publisher_id === userId || todo.partner_id === userId;
  return isMine || isUnassignedTodoItem(todo);
}

function getContactStatusColorClass(status: string) {
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

function getContactCardColor(status: string) {
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
  contactId?: string;
  prefillScopeKey?: string;
  prefillOpenTodos?: MyOpenCallTodoItem[];
  prefillCompletedTodos?: MyOpenCallTodoItem[];
  onTodoTap?: (todo: MyOpenCallTodoItem) => void;
  onNavigateToTodoCall?: (params: {
    establishmentId?: string;
    contactId?: string;
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
  /** Bulk form: set true while est/contact/to-do editors are open so bulk submit stays isolated. */
  onDetailsBridgeNestedFormActiveChange?: (active: boolean) => void;
  /** Override profile-derived permission to assign open-pool to-dos (admin + Elder). */
  canAssignOpenTodos?: boolean;
}

export function HomeTodoCard({
  userId,
  establishmentId,
  contactId,
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
  onDetailsBridgeNestedFormActiveChange,
  canAssignOpenTodos: canAssignOpenTodosProp,
}: HomeTodoCardProps) {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const effectiveUserId = userId ?? sessionUserId;
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
  const filtersSyncInProgressRef = useRef(false);
  const skipPersistAfterSyncRef = useRef(false);
  const [filters, setFilters] = useState<VisitFilters>({
    search: "",
    statuses: [],
    areas: [],
    assigneeIds: [],
    callDateFrom: null,
    callDateTo: null,
    myUpdatesOnly: true,
    bwiOnly: false,
    contactOnly: false,
  });
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [dueDateFilter, setDueDateFilter] = useState<Date | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const searchValueRef = useRef(searchValue);
  searchValueRef.current = searchValue;
  const dueDateFilterRef = useRef(dueDateFilter);
  dueDateFilterRef.current = dueDateFilter;
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
  const [selectedContactDetails, setSelectedContactDetails] =
    useState<ContactDetailsSnapshot | null>(null);
  const [isLoadingTodoDetails, setIsLoadingTodoDetails] = useState(false);
  const [contactDetailsSubdrawerOpen, setContactDetailsSubdrawerOpen] = useState(false);
  const [selectedContactFromEstablishment, setSelectedContactFromEstablishment] =
    useState<ContactWithDetails | null>(null);
  const [contactSubdrawerDetails, setContactSubdrawerDetails] = useState<ContactDetailsSnapshot | null>(null);
  const [isLoadingContactSubdrawerDetails, setIsLoadingContactSubdrawerDetails] = useState(false);
  const [todoEditorContext, setTodoEditorContext] = useState<TodoEditorContext | null>(null);
  const [todoEditorUseLeftPanel, setTodoEditorUseLeftPanel] = useState(false);
  const [detailsEntityEditOpen, setDetailsEntityEditOpen] = useState(false);
  /** Inline edit for a contact opened from the establishment-details subsheet (tablet left form). */
  const [contactSubdrawerEntityEditOpen, setContactSubdrawerEntityEditOpen] = useState(false);
  const [takeTodoConfirmOpen, setTakeTodoConfirmOpen] = useState(false);
  const [todoPendingTake, setTodoPendingTake] = useState<MyOpenCallTodoItem | null>(null);
  const [takingTodoId, setTakingTodoId] = useState<string | null>(null);
  const [canAssignOpenTodosResolved, setCanAssignOpenTodosResolved] = useState(false);
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
  const contactDetailsCacheRef = useRef(new Map<string, ContactDetailsSnapshot>());
  const realtimeTodoReloadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const isMobile = useMobile();
  const isTodoDetailsSideLayout = useMediaQuery("(min-width: 768px)");
  const isXlViewport = useMediaQuery("(min-width: 1280px)");
  // Home scope always caches the full congregation list; "My To-Dos" is applied client-side
  // (same as status/area/search) so the card preview and drawer stay in sync when toggling.
  const scopeKey = establishmentId
    ? `establishment:${establishmentId}`
    : contactId
      ? `contact:${contactId}`
      : userId
        ? `user:${userId}:all`
        : null;
  const filterScopeKey = establishmentId
    ? `establishment:${establishmentId}`
    : contactId
      ? `contact:${contactId}`
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
  const homeTodoCardShade = useMemo(() => getStudyBibleHomeCardShade("todo"), []);

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
    const openQuery = establishmentId
      ? getEstablishmentOpenCallTodos(establishmentId, 50)
      : contactId
        ? getContactOpenCallTodos(contactId, 50)
        : userId
          ? Promise.all([
              getMyOpenCallTodos(userId, 120),
              getCongregationOpenCallTodos(180),
            ]).then(([mine, congregation]) => mergeById(mine, congregation))
          : Promise.resolve<MyOpenCallTodoItem[]>([]);
    const completedQuery = establishmentId
      ? getEstablishmentCompletedCallTodos(establishmentId, 50)
      : contactId
        ? getContactCompletedCallTodos(contactId, 50)
        : userId
          ? Promise.all([
              getMyCompletedCallTodos(userId, 80),
              getCongregationCompletedCallTodos(120),
            ]).then(([mine, congregation]) => mergeById(mine, congregation))
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
  }, [scopeKey, establishmentId, contactId, userId]);

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
    if (establishmentId || contactId) {
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
  }, [userId, detailsBridgeOnly, establishmentId, contactId]);

  useEffect(() => {
    if (userId) {
      setSessionUserId(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!cancelled) setSessionUserId(session?.user?.id ?? null);
      } catch {
        if (!cancelled) setSessionUserId(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const canAssignOpenTodos = canAssignOpenTodosProp ?? canAssignOpenTodosResolved;

  useEffect(() => {
    if (canAssignOpenTodosProp !== undefined) return;
    const uid = effectiveUserId;
    if (!uid) {
      setCanAssignOpenTodosResolved(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const cached = await cacheGet<{ role?: string | null; privileges?: string[] | null }>(
        `profile:${uid}`
      );
      if (cached && !cancelled) {
        setCanAssignOpenTodosResolved(canAssignCongregationOpenTodos(cached));
        return;
      }
      const profile = await getProfile(uid);
      if (!cancelled) setCanAssignOpenTodosResolved(canAssignCongregationOpenTodos(profile));
    })();
    return () => {
      cancelled = true;
    };
  }, [canAssignOpenTodosProp, effectiveUserId]);

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
      const parsed = JSON.parse(raw) as StoredTodoFiltersPayload;
      applyStoredTodoFiltersFromParsed(
        parsed,
        { filters, searchValue, dueDateFilter },
        { setFilters, setSearchValue, setIsSearchActive, setDueDateFilter }
      );
    } catch {
      // no-op
    } finally {
      setFiltersHydrated(true);
    }
  }, [filterScopeKey]);

  // Keep mobile + tablet HomeTodoCard instances aligned when filters change in either sibling.
  useEffect(() => {
    if (!filterScopeKey) return;
    const applyStoredFilters = () => {
      try {
        const raw = window.localStorage.getItem(TODO_FILTERS_LOCAL_STORAGE_KEY(filterScopeKey));
        if (!raw) return;
        const parsed = JSON.parse(raw) as StoredTodoFiltersPayload;
        applyStoredTodoFiltersFromParsed(
          parsed,
          {
            filters: filtersRef.current,
            searchValue: searchValueRef.current,
            dueDateFilter: dueDateFilterRef.current,
          },
          { setFilters, setSearchValue, setIsSearchActive, setDueDateFilter }
        );
      } catch {
        // no-op
      }
    };
    const onFiltersSynced = (event: Event) => {
      const detail = (event as CustomEvent<{ filterScopeKey?: string }>).detail;
      if (detail?.filterScopeKey !== filterScopeKey) return;
      filtersSyncInProgressRef.current = true;
      skipPersistAfterSyncRef.current = true;
      applyStoredFilters();
      filtersSyncInProgressRef.current = false;
    };
    window.addEventListener(HOME_TODO_FILTERS_SYNC_EVENT, onFiltersSynced);
    return () => window.removeEventListener(HOME_TODO_FILTERS_SYNC_EVENT, onFiltersSynced);
  }, [filterScopeKey]);

  useEffect(() => {
    if (!filterScopeKey || !filtersHydrated || filtersSyncInProgressRef.current) return;
    if (skipPersistAfterSyncRef.current) {
      skipPersistAfterSyncRef.current = false;
      return;
    }
    try {
      const storageKey = TODO_FILTERS_LOCAL_STORAGE_KEY(filterScopeKey);
      const payload = serializeStoredTodoFiltersPayload(filters, searchValue, dueDateFilter);
      if (window.localStorage.getItem(storageKey) === payload) return;
      window.localStorage.setItem(storageKey, payload);
      window.dispatchEvent(
        new CustomEvent(HOME_TODO_FILTERS_SYNC_EVENT, {
          detail: { filterScopeKey },
        })
      );
    } catch {
      // no-op
    }
  }, [filterScopeKey, filtersHydrated, filters, searchValue, dueDateFilter]);

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

  // Initial / scope load — home "My To-Dos" is client-side only (see applyFilters).
  useEffect(() => {
    loadTodos({
      useCache: true,
      forceNetwork: false,
      trustFreshLocalCache: false,
      preserveNonEmpty: true,
    });
  }, [loadTodos]);

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
      const contactId = selectedTodoForDetails?.contact_id;
      if (contactId) {
        const fallbackStub: ContactDetailsSnapshot = {
          contact: {
            id: contactId,
            name: selectedTodoForDetails?.context_name ?? "Contact",
            statuses: selectedTodoForDetails?.context_status
              ? [selectedTodoForDetails.context_status as ContactStatus]
              : ["potential"],
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

        const { snapshot, hadWarmCache } = await resolveContactDetailsSnapshot(
          contactId,
          contactDetailsCacheRef.current,
          fallbackStub
        );
        if (cancelled) return;

        setSelectedContactDetails(snapshot);
        setSelectedTodoDetails(null);
        setIsLoadingTodoDetails(!hadWarmCache);

        try {
          const result = await getContactDetails(contactId);
          if (cancelled) return;
          const nextSnapshot = result
            ? {
                contact: result.contact,
                visits: result.visits,
                establishment: result.establishment,
              }
            : null;
          if (nextSnapshot) {
            contactDetailsCacheRef.current.set(contactId, nextSnapshot);
            setSelectedContactDetails(nextSnapshot);
          } else if (!hadWarmCache) {
            setSelectedContactDetails(null);
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
        contacts: [],
      };

      const { snapshot, hadWarmCache } = await resolveEstablishmentDetailsSnapshot(
        establishmentId,
        establishmentDetailsCacheRef.current,
        fallbackStub
      );
      if (cancelled) return;

      setSelectedTodoDetails(snapshot);
      setSelectedContactDetails(null);
      setIsLoadingTodoDetails(!hadWarmCache);

      try {
        const result = await getEstablishmentDetails(establishmentId);
        if (cancelled) return;
        const nextSnapshot = result
          ? {
              establishment: result.establishment,
              visits: result.visits,
              contacts: result.contacts,
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
  }, [todoDetailsDrawerOpen, selectedTodoForDetails?.establishment_id, selectedTodoForDetails?.contact_id, selectedTodoForDetails?.context_name, selectedTodoForDetails?.context_status, selectedTodoForDetails?.context_area, selectedTodoForDetails?.context_establishment_status, selectedTodoForDetails?.context_establishment_name]);

  useEffect(() => {
    if (!contactDetailsSubdrawerOpen) return;
    const contactId = selectedContactFromEstablishment?.id;
    if (!contactId) return;

    let cancelled = false;

    void (async () => {
      const fallbackStub: ContactDetailsSnapshot = {
        contact: selectedContactFromEstablishment,
        visits: [],
        establishment: selectedContactFromEstablishment.establishment_id
          ? {
              id: selectedContactFromEstablishment.establishment_id,
              name: selectedContactFromEstablishment.establishment_name ?? "",
              area: null,
            }
          : null,
      };

      const { snapshot, hadWarmCache } = await resolveContactDetailsSnapshot(
        contactId,
        contactDetailsCacheRef.current,
        fallbackStub
      );
      if (cancelled) return;

      setContactSubdrawerDetails(snapshot);
      setIsLoadingContactSubdrawerDetails(!hadWarmCache);

      try {
        const result = await getContactDetails(contactId);
        if (cancelled || !result) return;
        const nextSnapshot: ContactDetailsSnapshot = {
          contact: result.contact,
          visits: result.visits,
          establishment: result.establishment,
        };
        contactDetailsCacheRef.current.set(contactId, nextSnapshot);
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
    if (!userId || establishmentId || contactId) {
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
      if (filters.bwiOnly && (!todo.establishment_id || !!todo.contact_id)) {
        return false;
      }
      if (filters.contactOnly && !todo.contact_id) {
        return false;
      }
      if (filters.myUpdatesOnly && userId) {
        if (!matchesMyTodosFilter(todo, userId)) return false;
      }
      return true;
    });
  }, [
    allTodos,
    userId,
    establishmentId,
    contactId,
    searchValue,
    dueDateFilter,
    filters.bwiOnly,
    filters.contactOnly,
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
    if (!userId || establishmentId || contactId) return;
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
    contactId,
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
    } else if (contactId) {
      todoFilter = `householder_id=eq.${contactId}`;
      callsFilterStr = `householder_id=eq.${contactId}`;
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
    contactId,
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
        if (contactId) return todo.contact_id === contactId;
        if (!userId) return false;
        if (filters.myUpdatesOnly) {
          return matchesMyTodosFilter(todo as MyOpenCallTodoItem, userId);
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
  }, [loadTodos, establishmentId, contactId, userId, filters.myUpdatesOnly, detailsBridgeOnly]);

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
    if (!effectiveUserId) return;
    setTodoPendingTake(todo);
    setTakeTodoConfirmOpen(true);
  }, [effectiveUserId]);

  const handleConfirmTakeTodo = useCallback(async () => {
    if (!effectiveUserId || !todoPendingTake || takingTodoId) return;
    const target = todoPendingTake;
    setTakingTodoId(target.id);
    const previousOpen = openTodos;
    const previousCompleted = completedTodos;
    const optimistic: MyOpenCallTodoItem = {
      ...target,
      publisher_id: effectiveUserId,
      partner_id: null,
      publisher_guest_name: null,
      partner_guest_name: null,
    };
    setOpenTodos((prev) => [optimistic, ...prev.filter((item) => item.id !== target.id)]);
    setTakeTodoConfirmOpen(false);
    setTodoPendingTake(null);
    const ok = await updateStandaloneTodo(target.id, {
      publisher_id: effectiveUserId,
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
  }, [effectiveUserId, todoPendingTake, takingTodoId, openTodos, completedTodos, loadTodos]);

  const handleTodoTap = (todo: MyOpenCallTodoItem) => {
    const primeScopedTodoCaches = (targetTodo: MyOpenCallTodoItem) => {
      const now = Date.now();
      if (targetTodo.contact_id) {
        const targetContactId = targetTodo.contact_id;
        const scopedOpen = openTodos.filter((item) => item.contact_id === targetContactId);
        const scopedCompleted = completedTodos.filter((item) => item.contact_id === targetContactId);
        const scopedKey = `contact:${targetContactId}`;
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
      !contactId &&
      (!!todo.establishment_id || !!todo.contact_id) &&
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
    if (todo.contact_id) {
      onNavigateToTodoCall({ contactId: todo.contact_id });
    } else if (todo.establishment_id) {
      onNavigateToTodoCall({ establishmentId: todo.establishment_id });
    }
    setDrawerOpen(false);
  };

  const applyFilters = useCallback(
    (items: MyOpenCallTodoItem[]): MyOpenCallTodoItem[] => {
      // Only apply filters/search/BWI/contacts for the main home card (user scope)
      if (!userId || establishmentId || contactId) return items;

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
        if (filters.bwiOnly && (!todo.establishment_id || !!todo.contact_id)) {
          return false;
        }
        if (filters.contactOnly && !todo.contact_id) {
          return false;
        }

        // My To-Dos toggle
        if (filters.myUpdatesOnly && userId) {
          if (!matchesMyTodosFilter(todo, userId)) return false;
        }

        return true;
      });
    },
    [userId, establishmentId, contactId, filters, searchValue, dueDateFilter]
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
    if (!drawerOpen || !isMobile || !userId || establishmentId || contactId) return;
    const todosForPrefetch = [...filteredOpenTodos, ...filteredCompletedTodos];
    const establishmentIds = Array.from(
      new Set(
        todosForPrefetch
          .map((todo) => todo.establishment_id)
          .filter((id): id is string => !!id)
      )
    ).slice(0, 10);
    const contactIds = Array.from(
      new Set(
        todosForPrefetch
          .map((todo) => todo.contact_id)
          .filter((id): id is string => !!id)
      )
    ).slice(0, 10);
    if (establishmentIds.length === 0 && contactIds.length === 0) return;

    Promise.all([
      ...establishmentIds.map((id) => warmEstablishmentDetailsInMemory(id, establishmentDetailsCacheRef.current)),
      ...contactIds.map((id) => warmContactDetailsInMemory(id, contactDetailsCacheRef.current)),
    ]).catch(() => {
      // no-op; background prefetch only
    });
  }, [
    drawerOpen,
    isMobile,
    userId,
    establishmentId,
    contactId,
    filteredOpenTodos,
    filteredCompletedTodos,
  ]);

  useEffect(() => {
    if (!isMobile || !userId || establishmentId || contactId) return;
    const targets = [...openTodos, ...completedTodos];
    if (targets.length === 0) return;

    const now = Date.now();
    const establishmentIds = Array.from(
      new Set(targets.map((todo) => todo.establishment_id).filter((id): id is string => !!id))
    ).slice(0, 30);
    const contactIds = Array.from(
      new Set(targets.map((todo) => todo.contact_id).filter((id): id is string => !!id))
    ).slice(0, 30);

    establishmentIds.forEach((id) => {
      const scopedOpen = openTodos.filter((item) => item.establishment_id === id);
      const scopedCompleted = completedTodos.filter((item) => item.establishment_id === id);
      const scopedKey = `establishment:${id}`;
      cacheSet(TODOS_CACHE_KEY(scopedKey), { open: scopedOpen, completed: scopedCompleted });
      writeLocalTodosCache(scopedKey, scopedOpen, scopedCompleted, now);
    });

    contactIds.forEach((id) => {
      const scopedOpen = openTodos.filter((item) => item.contact_id === id);
      const scopedCompleted = completedTodos.filter((item) => item.contact_id === id);
      const scopedKey = `contact:${id}`;
      cacheSet(TODOS_CACHE_KEY(scopedKey), { open: scopedOpen, completed: scopedCompleted });
      writeLocalTodosCache(scopedKey, scopedOpen, scopedCompleted, now);
    });

    Promise.all([
      ...establishmentIds.map((id) => warmEstablishmentDetailsInMemory(id, establishmentDetailsCacheRef.current)),
      ...contactIds.map((id) => warmContactDetailsInMemory(id, contactDetailsCacheRef.current)),
    ]).catch(() => {
      // prewarm only
    });
  }, [
    isMobile,
    userId,
    establishmentId,
    contactId,
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
      let resolvedContactId = todo.contact_id ?? null;
      let resolvedEstablishmentId = todo.establishment_id ?? null;

      // Fallback #1: infer from same call context already loaded in memory.
      if (!resolvedContactId && !resolvedEstablishmentId && todo.call_id) {
        const callMatch = allKnownTodos.find(
          (item) =>
            item.call_id === todo.call_id &&
            (item.contact_id || item.establishment_id)
        );
        resolvedContactId = callMatch?.contact_id ?? null;
        resolvedEstablishmentId = callMatch?.establishment_id ?? null;
      }

      // Fallback #2: infer from matching context labels/status/area when call_id is absent.
      if (!resolvedContactId && !resolvedEstablishmentId) {
        const contextMatch = allKnownTodos.find((item) => {
          if (!item.contact_id && !item.establishment_id) return false;
          return (
            (item.context_name ?? "") === (todo.context_name ?? "") &&
            (item.context_establishment_name ?? "") === (todo.context_establishment_name ?? "") &&
            (item.context_status ?? "") === (todo.context_status ?? "") &&
            (item.context_area ?? "") === (todo.context_area ?? "")
          );
        });
        resolvedContactId = contextMatch?.contact_id ?? null;
        resolvedEstablishmentId = contextMatch?.establishment_id ?? null;
      }

      // Fallback #3: when already scoped, use current scope target.
      if (!resolvedContactId && !resolvedEstablishmentId) {
        if (contactId) resolvedContactId = contactId;
        else if (establishmentId) resolvedEstablishmentId = establishmentId;
      }

      const targetKey = resolvedContactId
        ? `contact:${resolvedContactId}`
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
  }, [selectedTodoIds, selectableTodos, applyBulkEditRows, openTodos, completedTodos, contactId, establishmentId]);

  const filteredAssignedOpenTodos = useMemo(
    () => filteredOpenTodos.filter(isTodoAssigned),
    [filteredOpenTodos, isTodoAssigned]
  );
  const filteredUnassignedOpenTodos = useMemo(
    () => filteredOpenTodos.filter((todo) => !isTodoAssigned(todo)),
    [filteredOpenTodos, isTodoAssigned]
  );
  const showSplitOpenHeaderBadges = Boolean(userId && !establishmentId && !contactId);
  /** Match drawer section order (assigned, then unassigned) so the home card preview aligns with the full list. */
  const cardPreviewOpenTodos = useMemo(() => {
    if (userId && !establishmentId && !contactId) {
      return [...filteredAssignedOpenTodos, ...filteredUnassignedOpenTodos];
    }
    return filteredOpenTodos;
  }, [
    userId,
    establishmentId,
    contactId,
    filteredOpenTodos,
    filteredAssignedOpenTodos,
    filteredUnassignedOpenTodos,
  ]);
  const maxCardPreviewRows = 5;
  const cardPreviewAssignedList = useMemo(() => {
    if (!showSplitOpenHeaderBadges) return [];
    return filteredAssignedOpenTodos.slice(0, maxCardPreviewRows);
  }, [showSplitOpenHeaderBadges, filteredAssignedOpenTodos]);
  const cardPreviewUnassignedList = useMemo(() => {
    if (!showSplitOpenHeaderBadges) return [];
    const remaining = maxCardPreviewRows - cardPreviewAssignedList.length;
    return filteredUnassignedOpenTodos.slice(0, Math.max(0, remaining));
  }, [showSplitOpenHeaderBadges, cardPreviewAssignedList.length, filteredUnassignedOpenTodos]);
  const displayTodos = cardPreviewOpenTodos.slice(0, maxCardPreviewRows);
  const displayCompletedPreview = filteredCompletedTodos.slice(0, 1);
  const openCount = filteredOpenTodos.length;
  const assignedOpenCount = filteredAssignedOpenTodos.length;
  const unassignedOpenCount = filteredUnassignedOpenTodos.length;
  const doneCount = filteredCompletedTodos.length;

  const renderTodoHeaderBadges = (badgeClassName: string) => {
    if (showSplitOpenHeaderBadges) {
      return (
        <>
          <Badge
            variant="secondary"
            className={cn(badgeClassName, studyBibleDarkClasses.todoBadgeAssigned)}
          >
            To-Do {assignedOpenCount}
          </Badge>
          <Badge
            variant="secondary"
            className={cn(badgeClassName, studyBibleDarkClasses.todoBadgeOpen)}
          >
            Open {unassignedOpenCount}
          </Badge>
        </>
      );
    }
    if (openCount > 0) {
      return (
        <Badge
          variant="secondary"
          className={cn(badgeClassName, studyBibleDarkClasses.todoBadgeOpen)}
        >
          Open {openCount}
        </Badge>
      );
    }
    return null;
  };

  const hasNavigation = !!(onNavigateToTodoCall || onTodoTap);

  const renderCardSectionLabel = (label: string, count: number) => (
    <div
      className={cn(
        "text-xs font-semibold tracking-wide inline-flex items-center gap-1.5",
        studyBibleDarkClasses.sectionLabel
      )}
    >
      <span>{label}</span>
      <Badge
        variant="secondary"
        className={cn(
          "h-4 rounded-full px-1.5 text-[10px] font-semibold leading-none",
          label === "Open"
            ? studyBibleDarkClasses.todoBadgeOpen
            : studyBibleDarkClasses.todoBadgeAssigned
        )}
      >
        {count}
      </Badge>
    </div>
  );

  const showAssigneeAvatars = Boolean(userId || establishmentId || contactId);
  const showOtherPublisherDecorations = Boolean(
    userId && !establishmentId && !contactId && !filters.myUpdatesOnly
  );
  const prefersCompanionLeftTodoDrawer = Boolean(
    preferLeftCompanionDrawer && isTodoDetailsSideLayout && (!!establishmentId || !!contactId)
  );
  const useSingleColumnTodoDrawerBody = prefersCompanionLeftTodoDrawer;
  const emptyText = userId
    ? "No open to-dos from your calls"
    : "No open to-dos for this call history";
  const emptyDrawerText = userId
    ? "No to-dos from your calls"
    : "No to-dos for this call history";
  const isContactDetail = Boolean(selectedTodoForDetails?.contact_id);
  const selectedEstablishmentDetails = selectedTodoDetails?.establishment ?? null;
  const detailPrimaryStatus = selectedEstablishmentDetails
    ? getBestStatus(selectedEstablishmentDetails.statuses || [])
    : "for_scouting";
  const detailSurfaceClass = selectedEstablishmentDetails
    ? getStatusColor(detailPrimaryStatus)
    : "";
  const selectedContact = selectedContactDetails?.contact ?? null;
  const selectedContactEstablishment = selectedContactDetails?.establishment ?? null;
  const contactSurfaceClass = selectedContact
    ? (selectedContact.publisher_id
        ? "border-emerald-500/45 bg-emerald-500/8"
        : getContactCardColor(getContactPrimaryStatus(selectedContact)))
    : "";
  const contactArea =
    selectedContactEstablishment?.area?.trim() ?? "";
  const contactNote = selectedContact?.note?.trim() ?? "";
  const contactEstablishmentName =
    selectedContactEstablishment?.name?.trim() ||
    selectedContact?.establishment_name?.trim() ||
    "";
  const contactEstablishmentStatus = getBestStatus(
    selectedContactEstablishment?.statuses ??
      (selectedTodoForDetails?.context_establishment_status
        ? [selectedTodoForDetails.context_establishment_status]
        : [])
  );
  const selectedDetailVisits = useMemo(
    () =>
      [...(isContactDetail ? selectedContactDetails?.visits ?? [] : selectedTodoDetails?.visits ?? [])].sort(
        (a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()
      ),
    [isContactDetail, selectedContactDetails?.visits, selectedTodoDetails?.visits]
  );
  const selectedDetailContacts = selectedTodoDetails?.contacts ?? [];
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
  const contactPrefillOpenTodos = useMemo(
    () =>
      selectedContact?.id
        ? openTodos.filter((todo) => todo.contact_id === selectedContact.id)
        : [],
    [openTodos, selectedContact?.id]
  );
  const contactPrefillCompletedTodos = useMemo(
    () =>
      selectedContact?.id
        ? completedTodos.filter((todo) => todo.contact_id === selectedContact.id)
        : [],
    [completedTodos, selectedContact?.id]
  );
  const contactSubdrawerContact = contactSubdrawerDetails?.contact ?? selectedContactFromEstablishment;
  const contactSubdrawerEstablishment = contactSubdrawerDetails?.establishment ?? null;
  const contactSubdrawerPrefillOpenTodos = useMemo(
    () =>
      contactSubdrawerContact?.id
        ? openTodos.filter((todo) => todo.contact_id === contactSubdrawerContact.id)
        : [],
    [openTodos, contactSubdrawerContact?.id]
  );
  const contactSubdrawerPrefillCompletedTodos = useMemo(
    () =>
      contactSubdrawerContact?.id
        ? completedTodos.filter((todo) => todo.contact_id === contactSubdrawerContact.id)
        : [],
    [completedTodos, contactSubdrawerContact?.id]
  );
  const contactSubdrawerVisits = useMemo(
    () =>
      [...(contactSubdrawerDetails?.visits ?? [])].sort(
        (a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime()
      ),
    [contactSubdrawerDetails?.visits]
  );
  const contactSubdrawerSurfaceClass = contactSubdrawerContact
    ? (contactSubdrawerContact.publisher_id
        ? "border-emerald-500/45 bg-emerald-500/8"
        : getContactCardColor(getContactPrimaryStatus(contactSubdrawerContact)))
    : "";
  const contactSubdrawerArea = contactSubdrawerEstablishment?.area?.trim() ?? "";
  const contactSubdrawerNote = contactSubdrawerContact?.note?.trim() ?? "";
  const contactSubdrawerEstablishmentName =
    contactSubdrawerEstablishment?.name?.trim() ||
    contactSubdrawerContact?.establishment_name?.trim() ||
    "";
  const contactSubdrawerEstablishmentStatus = getBestStatus(
    contactSubdrawerEstablishment?.statuses ?? []
  );
  const openContactDetailsSubdrawer = useCallback((contact: ContactWithDetails) => {
    const cached = contactDetailsCacheRef.current.get(contact.id);
    if (cached) {
      setContactSubdrawerDetails(cached);
    } else {
      setContactSubdrawerDetails({
        contact,
        visits: [],
        establishment: contact.establishment_id
          ? {
              id: contact.establishment_id,
              name: contact.establishment_name ?? "",
              area: null,
              statuses: null,
            }
          : null,
      });
    }

    // Prime scoped to-do snapshot so nested contact card opens from local cache instantly.
    const now = Date.now();
    const scopedOpen = openTodos.filter((item) => item.contact_id === contact.id);
    const scopedCompleted = completedTodos.filter((item) => item.contact_id === contact.id);
    const scopedKey = `contact:${contact.id}`;
    cacheSet(TODOS_CACHE_KEY(scopedKey), { open: scopedOpen, completed: scopedCompleted });
    writeLocalTodosCache(scopedKey, scopedOpen, scopedCompleted, now);

    setSelectedContactFromEstablishment(contact);
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
        contactId?: string;
        contactName?: string;
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
        contactId: options.contactId,
        contactName: options.contactName,
        disableEstablishmentSelect: options.disableEstablishmentSelect,
      });
    },
    [isTodoDetailsSideLayout]
  );

  const openTodoEditorFromList = useCallback((todo: MyOpenCallTodoItem) => {
    const establishments =
      todo.establishment_id && (todo.context_name || todo.context_establishment_name)
        ? [
            {
              id: todo.establishment_id,
              name: todo.context_establishment_name ?? todo.context_name ?? "",
            },
          ]
        : todo.establishment_id
          ? [{ id: todo.establishment_id, name: "" }]
          : [];
    setTodoEditorUseLeftPanel(Boolean(preferLeftCompanionDrawer && isTodoDetailsSideLayout));
    setTodoEditorContext({
      initialTodo: todo,
      establishments,
      selectedEstablishmentId: todo.establishment_id ?? undefined,
      contactId: todo.contact_id ?? undefined,
      contactName: todo.contact_id ? todo.context_name ?? undefined : undefined,
      disableEstablishmentSelect: Boolean(establishmentId || contactId || todo.contact_id),
    });
  }, [
    establishmentId,
    contactId,
    isTodoDetailsSideLayout,
    preferLeftCompanionDrawer,
  ]);

  const handleAssignOpenTodo = useCallback(
    (todo: MyOpenCallTodoItem) => {
      if (onTodoTap) {
        onTodoTap(todo);
        return;
      }
      openTodoEditorFromList(todo);
    },
    [onTodoTap, openTodoEditorFromList]
  );

  const renderOpenTodoTakeButton = useCallback(
    (todo: MyOpenCallTodoItem): ReactNode => {
      if (!isUnassignedTodoItem(todo) || !effectiveUserId) return null;
      return (
        <Button
          type="button"
          variant="default"
          size="sm"
          className="h-7 rounded-full px-3 text-xs font-semibold bg-emerald-600/95 text-white shadow-sm hover:bg-emerald-500 hover:shadow-md hover:scale-[1.02] active:scale-100 transition-all shrink-0"
          disabled={takingTodoId === todo.id}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleTakeTodoPrompt(todo);
          }}
        >
          Take
        </Button>
      );
    },
    [effectiveUserId, handleTakeTodoPrompt, takingTodoId]
  );

  const showAssignInHomeTodoDrawer = Boolean(
    canAssignOpenTodos && !establishmentId && !contactId
  );

  const renderHomeDrawerOpenTodoActions = useCallback(
    (todo: MyOpenCallTodoItem): ReactNode => {
      if (!isUnassignedTodoItem(todo) || !effectiveUserId) return null;
      return (
        <div className="flex items-center gap-1.5 shrink-0">
          {showAssignInHomeTodoDrawer ? (
            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-7 rounded-full px-3 text-xs font-semibold shrink-0 border-0 shadow-none bg-yellow-500 text-gray-950 hover:bg-yellow-600 hover:shadow-none dark:bg-yellow-500 dark:text-gray-950 dark:hover:bg-yellow-400"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleAssignOpenTodo(todo);
              }}
            >
              Assign
            </Button>
          ) : null}
          {renderOpenTodoTakeButton(todo)}
        </div>
      );
    },
    [
      effectiveUserId,
      handleAssignOpenTodo,
      renderOpenTodoTakeButton,
      showAssignInHomeTodoDrawer,
    ]
  );

  const renderCardTodoRow = (todo: MyOpenCallTodoItem, index: number, listTier?: "assigned" | "unassigned") => (
    <TodoRow
      key={todo.id}
      todo={todo}
      onMarkDone={handleMarkDone}
      onTap={hasNavigation ? handleTodoTap : undefined}
      showCheckbox
      currentUserId={effectiveUserId ?? undefined}
      showAssigneeAvatars={showAssigneeAvatars}
      highlightOtherPublishers={showOtherPublisherDecorations}
      participantsById={participantsById}
      participantsReady={participantsReady}
      rowIndex={index}
      layoutId={`${layoutScopeId}-card-${todo.id}`}
      layoutTransition={todoLayoutTransition}
      hideContactNameBadge={!!contactId}
      hideContactEstablishmentBadge={!!contactId}
      listTier={listTier}
      headerAction={isUnassignedTodoItem(todo) ? renderOpenTodoTakeButton(todo) : undefined}
    />
  );

  useEffect(() => {
    if (!todoDetailsDrawerOpen || isContactDetail) return;
    if (selectedDetailContacts.length === 0) return;

    Promise.all(
      selectedDetailContacts.slice(0, 20).map((contact) => {
        if (!contact.id) return Promise.resolve();
        return warmContactDetailsInMemory(contact.id, contactDetailsCacheRef.current);
      })
    ).catch(() => {
      // prewarm only
    });
  }, [todoDetailsDrawerOpen, isContactDetail, selectedDetailContacts]);

  const handleTodoDetailsDrawerChange = useCallback(
    (open: boolean) => {
      setTodoDetailsDrawerOpen(open);
      if (!open) {
        setSelectedTodoForDetails(null);
        setSelectedTodoDetails(null);
        setSelectedContactDetails(null);
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
      setSelectedContactDetails(null);
      setSelectedContactFromEstablishment(null);
      setContactDetailsSubdrawerOpen(false);
      setDetailsEntityEditOpen(false);
      setContactSubdrawerEntityEditOpen(false);
      setTodoEditorContext(null);
      setTodoEditorUseLeftPanel(false);
    }
  }, [detailsBridgeOnly, detailsBridgeOpen]);

  useEffect(() => {
    if (!detailsBridgeOnly || !onDetailsBridgeNestedFormActiveChange) return;
    const nestedFormActive =
      detailsEntityEditOpen || contactSubdrawerEntityEditOpen || !!todoEditorContext;
    onDetailsBridgeNestedFormActiveChange(nestedFormActive);
    return () => {
      onDetailsBridgeNestedFormActiveChange(false);
    };
  }, [
    contactSubdrawerEntityEditOpen,
    detailsBridgeOnly,
    detailsEntityEditOpen,
    onDetailsBridgeNestedFormActiveChange,
    todoEditorContext,
  ]);

  const refreshTodoDetailEntity = useCallback(async () => {
    const hhTarget = selectedTodoForDetails?.contact_id;
    const estTarget = selectedTodoForDetails?.establishment_id;
    if (hhTarget) {
      await cacheDelete(contactDetailsCacheKey(hhTarget));
      const result = await getContactDetails(hhTarget);
      if (result) {
        const snap: ContactDetailsSnapshot = {
          contact: result.contact,
          visits: result.visits,
          establishment: result.establishment,
        };
        contactDetailsCacheRef.current.set(hhTarget, snap);
        setSelectedContactDetails(snap);
      }
    } else if (estTarget) {
      await cacheDelete(establishmentDetailsCacheKey(estTarget));
      const result = await getEstablishmentDetails(estTarget);
      if (result) {
        const snap: EstablishmentDetailsSnapshot = {
          establishment: result.establishment,
          visits: result.visits,
          contacts: result.contacts,
        };
        establishmentDetailsCacheRef.current.set(estTarget, snap);
        setSelectedTodoDetails(snap);
      }
    }
    loadTodos({ useCache: false, forceNetwork: true, trustFreshLocalCache: false });
  }, [selectedTodoForDetails?.contact_id, selectedTodoForDetails?.establishment_id, loadTodos]);

  const refreshAfterContactSubdrawerEdit = useCallback(async () => {
    const hhId = contactSubdrawerContact?.id;
    if (hhId) {
      await cacheDelete(contactDetailsCacheKey(hhId));
      const result = await getContactDetails(hhId);
      if (result) {
        const snap: ContactDetailsSnapshot = {
          contact: result.contact,
          visits: result.visits,
          establishment: result.establishment,
        };
        contactDetailsCacheRef.current.set(hhId, snap);
        setContactSubdrawerDetails(snap);
        setSelectedContactFromEstablishment((prev) =>
          prev?.id === hhId ? { ...prev, ...result.contact } : prev
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
  }, [contactSubdrawerContact?.id, refreshTodoDetailEntity]);

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
    return isContactDetail ? "hhMain" : "estMain";
  }, [
    contactDetailsSubdrawerOpen,
    todoDetailsDrawerOpen,
    selectedTodoForDetails,
    isContactDetail,
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
        selectedContactEstablishment?.id ??
        selectedContact?.establishment_id ??
        selectedTodoForDetails?.establishment_id ??
        undefined;
      const estName =
        selectedContactEstablishment?.name?.trim() ||
        selectedContact?.establishment_name?.trim() ||
        selectedTodoForDetails?.context_establishment_name?.trim() ||
        (estId ? "Establishment" : "");
      if (!selectedContact?.id || !estId || !estName) return null;
      return {
        establishments: [{ id: estId, name: estName }],
        selectedEstablishmentId: estId,
        contactId: selectedContact.id,
        contactName: selectedContact.name,
        contactStatus: getContactPrimaryStatus(selectedContact),
      };
    }
    const est =
      contactSubdrawerEstablishment?.id != null
        ? { id: contactSubdrawerEstablishment.id, name: contactSubdrawerEstablishment.name }
        : selectedEstablishmentDetails?.id != null
          ? { id: selectedEstablishmentDetails.id, name: selectedEstablishmentDetails.name }
          : contactSubdrawerContact?.establishment_id
            ? {
                id: contactSubdrawerContact.establishment_id,
                name: contactSubdrawerContact.establishment_name?.trim() || "Establishment",
              }
            : null;
    const hh = contactSubdrawerContact;
    if (!est?.id || !est.name?.trim() || !hh?.id) return null;
    return {
      establishments: [{ id: est.id, name: est.name }],
      selectedEstablishmentId: est.id,
      contactId: hh.id,
      contactName: hh.name,
      contactStatus: getContactPrimaryStatus(hh),
    };
  }, [
    homeTodoDetailsFabSurface,
    selectedEstablishmentDetails?.id,
    selectedEstablishmentDetails?.name,
    selectedContactEstablishment?.id,
    selectedContactEstablishment?.name,
    selectedContact?.id,
    selectedContact?.establishment_id,
    selectedContact?.establishment_name,
    selectedContact?.name,
    selectedContact ? getContactPrimaryStatus(selectedContact) : undefined,
    selectedTodoForDetails?.establishment_id,
    selectedTodoForDetails?.context_establishment_name,
    contactSubdrawerEstablishment,
    contactSubdrawerContact,
  ]);

  const afterHomeTodoDetailsQuickCreateSaved = useCallback(async () => {
    if (contactDetailsSubdrawerOpen && contactSubdrawerContact?.id) {
      await refreshAfterContactSubdrawerEdit();
    } else {
      await refreshTodoDetailEntity();
      broadcastTodosAndBusinessRefresh();
    }
  }, [
    contactDetailsSubdrawerOpen,
    contactSubdrawerContact?.id,
    refreshAfterContactSubdrawerEdit,
    refreshTodoDetailEntity,
    broadcastTodosAndBusinessRefresh,
  ]);

  const homeTodoDetailsFabCtx = useHomeTodoDetailsFabOptional();
  const setTodoDetailsFabOverride = homeTodoDetailsFabCtx?.setTodoDetailsFabOverride;
  const setHomeTodoListFabBridgeSlot = homeTodoDetailsFabCtx?.setHomeTodoListFabBridgeSlot;
  const setHomeFabBlockingDrawer = homeTodoDetailsFabCtx?.setHomeFabBlockingDrawer;
  const homeTodoListFabBridgeSlot =
    fabBridgeLayout === "xlAndUp" ? ("xlAndUp" as const) : ("belowXl" as const);
  const setHideHomeFab = homeTodoDetailsFabCtx?.setHideHomeFab;

  const isMainHomeTodoWidget = Boolean(userId && establishmentId == null && contactId == null);
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
        contactId: homeTodoDetailsFabFormConfig.contactId,
        contactName: homeTodoDetailsFabFormConfig.contactName,
        contactStatus: homeTodoDetailsFabFormConfig.contactStatus,
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

  useEffect(() => {
    if (!setHomeTodoListFabBridgeSlot || !isMainHomeTodoWidget || detailsBridgeOnly) return;
    setHomeTodoListFabBridgeSlot(homeTodoListFabBridgeSlot, {
      todoListDrawerOpen: drawerOpen,
      bulkEditPickerOpen: bulkEditPromptOpen,
      canBulkEditTodos: canAssignOpenTodos,
      selectedBulkEditCount: selectedTodoIds.length,
    });
    return () => {
      setHomeTodoListFabBridgeSlot(homeTodoListFabBridgeSlot, null);
    };
  }, [
    bulkEditPromptOpen,
    canAssignOpenTodos,
    detailsBridgeOnly,
    drawerOpen,
    homeTodoListFabBridgeSlot,
    isMainHomeTodoWidget,
    selectedTodoIds.length,
    setHomeTodoListFabBridgeSlot,
  ]);

  useEffect(() => {
    if (!setHomeFabBlockingDrawer || !fabBridgeActiveForViewport || detailsBridgeOnly) return;
    setHomeFabBlockingDrawer("todo-filter", filterDrawerOpen);
    setHomeFabBlockingDrawer("todo-details", todoDetailsDrawerOpen);
    setHomeFabBlockingDrawer("todo-contact-sub", contactDetailsSubdrawerOpen);
    setHomeFabBlockingDrawer(
      "todo-entity-edit",
      detailsEntityEditOpen || contactSubdrawerEntityEditOpen
    );
  }, [
    contactDetailsSubdrawerOpen,
    contactSubdrawerEntityEditOpen,
    detailsBridgeOnly,
    detailsEntityEditOpen,
    fabBridgeActiveForViewport,
    filterDrawerOpen,
    setHomeFabBlockingDrawer,
    todoDetailsDrawerOpen,
  ]);

  useEffect(() => {
    if (!fabBridgeActiveForViewport) return;
    const openPicker = () => openBulkEditPrompt();
    const cancelPicker = () => setBulkEditPromptOpen(false);
    const loadPicker = () => confirmBulkEdit();
    window.addEventListener("home-todo-open-bulk-edit-picker", openPicker);
    window.addEventListener("home-bulk-edit-picker-cancel", cancelPicker);
    window.addEventListener("home-bulk-edit-picker-load", loadPicker);
    return () => {
      window.removeEventListener("home-todo-open-bulk-edit-picker", openPicker);
      window.removeEventListener("home-bulk-edit-picker-cancel", cancelPicker);
      window.removeEventListener("home-bulk-edit-picker-load", loadPicker);
    };
  }, [confirmBulkEdit, fabBridgeActiveForViewport, openBulkEditPrompt]);

  const canDetailSummaryEdit = isContactDetail
    ? !!selectedContact?.id
    : !!selectedEstablishmentDetails?.id;

  const openEntityEditorFromDetailsSidebar = useCallback(() => {
    const hasTarget = isContactDetail
      ? !!selectedContact?.id
      : !!selectedEstablishmentDetails?.id;
    if (!hasTarget) return;
    setContactSubdrawerEntityEditOpen(false);
    setDetailsEntityEditOpen(true);
  }, [isContactDetail, selectedContact?.id, selectedEstablishmentDetails?.id]);

  const canContactSubdrawerSummaryEdit = !!contactSubdrawerContact?.id;

  const openContactSubdrawerEntityEditor = useCallback(() => {
    if (!contactSubdrawerContact?.id) return;
    setDetailsEntityEditOpen(false);
    setContactSubdrawerEntityEditOpen(true);
  }, [contactSubdrawerContact?.id]);

  const renderTodoDetailsBody = () => (
    <>
      {isLoadingTodoDetails && !selectedTodoDetails && !selectedContactDetails ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading details...</div>
      ) : (
        isContactDetail ? (
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
              canDetailSummaryEdit ? `Edit ${selectedContact?.name ?? "contact"}` : undefined
            }
          >
            <Card
              className={cn(
                "w-full",
                contactSurfaceClass,
                canDetailSummaryEdit && "hover:opacity-95 transition-opacity"
              )}
            >
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div className="flex w-full min-w-0 flex-1 flex-wrap items-center gap-2 pr-1">
                {selectedContact?.statuses?.length ? (
                  <Badge
                    variant="outline"
                    className={cn(
                      "flex-shrink-0 capitalize",
                      getContactStatusColorClass(getContactPrimaryStatus(selectedContact))
                    )}
                  >
                    {formatStatusText(getContactPrimaryStatus(selectedContact))}
                  </Badge>
                ) : null}
                {contactEstablishmentName ? (
                  <Badge
                    variant="outline"
                    className={cn("flex-shrink-0", getStatusTextColor(contactEstablishmentStatus))}
                  >
                    {contactEstablishmentName}
                  </Badge>
                ) : null}
              </div>
              {selectedContact?.lat != null && selectedContact?.lng != null ? (
                <a
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/60 bg-primary/10 text-primary shadow-sm transition-all hover:bg-primary/20 hover:border-primary hover:scale-[1.03] active:scale-100"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedContact.lat},${selectedContact.lng}`}
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
              <ContactSummaryFields area={contactArea} note={contactNote} />
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

      {isContactDetail && selectedContact?.id ? (
        <HomeTodoCard
          contactId={selectedContact.id}
          userId={effectiveUserId ?? undefined}
          prefillScopeKey={`contact:${selectedContact.id}`}
          prefillOpenTodos={contactPrefillOpenTodos}
          prefillCompletedTodos={contactPrefillCompletedTodos}
          preferLeftCompanionDrawer
          onTodoTap={(todo) =>
            openTodoEditorFromDetails(todo, selectedDetailVisits, {
              establishments: selectedContactEstablishment
                ? [{ id: selectedContactEstablishment.id, name: selectedContactEstablishment.name }]
                : [],
              selectedEstablishmentId: selectedContactEstablishment?.id,
              contactId: selectedContact.id,
              contactName: selectedContact.name,
              disableEstablishmentSelect: true,
            })
          }
        />
      ) : null}
      {!isContactDetail && selectedEstablishmentDetails?.id ? (
        <HomeTodoCard
          establishmentId={selectedEstablishmentDetails.id}
          userId={effectiveUserId ?? undefined}
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
          isContactContext={isContactDetail}
          establishments={
            isContactDetail
              ? (selectedContactEstablishment
                  ? [selectedContactEstablishment]
                  : [])
              : (selectedEstablishmentDetails
                  ? [{ id: selectedEstablishmentDetails.id ?? "", name: selectedEstablishmentDetails.name }]
                  : [])
          }
          selectedEstablishmentId={
            isContactDetail
              ? selectedContactEstablishment?.id
              : selectedEstablishmentDetails?.id
          }
          contactId={isContactDetail ? selectedContact?.id : undefined}
          contactName={isContactDetail ? selectedContact?.name : undefined}
          contactStatus={isContactDetail && selectedContact ? getContactPrimaryStatus(selectedContact) : undefined}
          isLoading={false}
          onVisitUpdated={() => {
            void refreshTodoDetailEntity().then(() => broadcastTodosAndBusinessRefresh());
          }}
          preferLeftDetailPanel={isTodoDetailsSideLayout}
          insideStackedContactPane={
            Boolean(!isContactDetail && contactDetailsSubdrawerOpen && isTodoDetailsSideLayout)
          }
        />
      ) : null}

      {!isContactDetail && selectedEstablishmentDetails?.id ? (
        <ContactsSection
          establishmentId={selectedEstablishmentDetails.id}
          contacts={selectedDetailContacts}
          onContactClick={openContactDetailsSubdrawer}
          preferLeftDetailPanel={isTodoDetailsSideLayout}
          insideStackedContactPane={Boolean(contactDetailsSubdrawerOpen && isTodoDetailsSideLayout)}
          isLoading={false}
        />
      ) : null}
    </>
  );

  const renderTodoDrawerFilters = () =>
    userId && !establishmentId && !contactId ? (
      <div className="mb-4 w-full shrink-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
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
                contactOnly: false,
              }))
            }
            onBwiClear={() =>
              setFilters((prev) => ({ ...prev, bwiOnly: false }))
            }
            contactActive={filters.contactOnly}
            contactLabel="Contacts Only"
            onContactActivate={() =>
              setFilters((prev) => ({
                ...prev,
                contactOnly: true,
                bwiOnly: false,
              }))
            }
            onContactClear={() =>
              setFilters((prev) => ({
                ...prev,
                contactOnly: false,
              }))
            }
            filterBadges={filterBadges}
            onOpenFilters={() => setFilterDrawerOpen(true)}
            onClearFilters={clearFilters}
            preserveActionButtonsWhenTogglesActive
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
    ) : null;

  const renderTodoDrawerListBody = () => (
    <>
      {filteredOpenTodos.length === 0 && filteredCompletedTodos.length === 0 ? (
        <p className={cn("text-sm py-4", studyBibleDarkClasses.todoMeta)}>{emptyDrawerText}</p>
      ) : (
        <>
          {/* Phone: stacked collapsible sections (also used for scoped left companion drawer on tablet) */}
          <div className={cn(useSingleColumnTodoDrawerBody ? "block" : "md:hidden")}>
          <div className={cn("mt-2 overflow-hidden rounded-t-lg", studyBibleDarkClasses.todoDrawerSectionShell)}>
            <button
              type="button"
              onClick={() => setDrawerTodoExpanded((prev) => !prev)}
              className={cn("w-full flex items-center justify-between px-3 py-2", studyBibleDarkClasses.todoDrawerSectionHeader)}
            >
              <span>To-Do ({filteredAssignedOpenTodos.length})</span>
              {drawerTodoExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
          {drawerTodoExpanded && (
            filteredAssignedOpenTodos.length > 0 ? (
              <ul className={cn("space-y-3 rounded-b-lg p-2", studyBibleDarkClasses.todoDrawerSectionBody)}>
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
                    hideContactNameBadge={!!contactId}
                    hideContactEstablishmentBadge={!!contactId}
                  />
                ))}
              </ul>
            ) : (
              <p className={cn("rounded-b-lg px-3 py-2 text-xs", studyBibleDarkClasses.todoDrawerSectionBody, studyBibleDarkClasses.todoMeta)}>No assigned to-dos.</p>
            )
          )}

          <div className={cn("mt-3 overflow-hidden rounded-t-lg", studyBibleDarkClasses.todoDrawerSectionShell)}>
            <button
              type="button"
              onClick={() => setDrawerOpenSectionExpanded((prev) => !prev)}
              className={cn("w-full flex items-center justify-between px-3 py-2", studyBibleDarkClasses.todoDrawerSectionHeader)}
            >
              <span>Open ({filteredUnassignedOpenTodos.length})</span>
              {drawerOpenSectionExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
          {drawerOpenSectionExpanded && (
            filteredUnassignedOpenTodos.length > 0 ? (
              <ul className={cn("space-y-3 rounded-b-lg p-2", studyBibleDarkClasses.todoDrawerSectionBody)}>
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
                    hideContactNameBadge={!!contactId}
                    hideContactEstablishmentBadge={!!contactId}
                    headerAction={renderHomeDrawerOpenTodoActions(todo)}
                  />
                ))}
              </ul>
            ) : (
              <p className={cn("rounded-b-lg px-3 py-2 text-xs", studyBibleDarkClasses.todoDrawerSectionBody, studyBibleDarkClasses.todoMeta)}>No unassigned to-dos.</p>
            )
          )}

          <div className={cn("mt-3 overflow-hidden rounded-t-lg", studyBibleDarkClasses.todoDrawerSectionShell)}>
            <button
              type="button"
              onClick={() => setDrawerDoneExpanded((prev) => !prev)}
              className={cn("w-full flex items-center justify-between px-3 py-2", studyBibleDarkClasses.todoDrawerSectionHeader)}
            >
              <span>Done ({filteredCompletedTodos.length})</span>
              {drawerDoneExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
          {drawerDoneExpanded && (
            filteredCompletedTodos.length > 0 ? (
              <ul className={cn("space-y-3 rounded-b-lg p-2", studyBibleDarkClasses.todoDrawerSectionBody)}>
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
                    hideContactNameBadge={!!contactId}
                    hideContactEstablishmentBadge={!!contactId}
                  />
                ))}
              </ul>
            ) : (
              <p className={cn("rounded-b-lg px-3 py-2 text-xs", studyBibleDarkClasses.todoDrawerSectionBody, studyBibleDarkClasses.todoMeta)}>No done to-dos.</p>
            )
          )}
          </div>

          {/* iPad / md+: three columns with independent scroll */}
          <div
            className={cn(
              useSingleColumnTodoDrawerBody
                ? "hidden"
                : cn("hidden md:grid md:min-h-[320px] md:grid-cols-3 md:gap-3 md:items-stretch", homeListDrawerTabletColumnsClass)
            )}
          >
            <div className={cn("flex min-h-0 flex-col", studyBibleDarkClasses.todoDrawerColumnShell)}>
              <div className={studyBibleDarkClasses.todoDrawerColumnHeader}>
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
                        hideContactNameBadge={!!contactId}
                        hideContactEstablishmentBadge={!!contactId}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className={cn("text-xs py-1", studyBibleDarkClasses.todoMeta)}>No assigned to-dos.</p>
                )}
              </div>
            </div>
            <div className={cn("flex min-h-0 flex-col", studyBibleDarkClasses.todoDrawerColumnShell)}>
              <div className={studyBibleDarkClasses.todoDrawerColumnHeader}>
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
                        hideContactNameBadge={!!contactId}
                        hideContactEstablishmentBadge={!!contactId}
                        headerAction={renderHomeDrawerOpenTodoActions(todo)}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className={cn("text-xs py-1", studyBibleDarkClasses.todoMeta)}>No unassigned to-dos.</p>
                )}
              </div>
            </div>
            <div className={cn("flex min-h-0 flex-col", studyBibleDarkClasses.todoDrawerColumnShell)}>
              <div className={studyBibleDarkClasses.todoDrawerColumnHeader}>
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
                        hideContactNameBadge={!!contactId}
                        hideContactEstablishmentBadge={!!contactId}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className={cn("text-xs py-1", studyBibleDarkClasses.todoMeta)}>No done to-dos.</p>
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
      {isLoadingContactSubdrawerDetails && !contactSubdrawerContact ? (
        <div className="rounded-lg border p-4 text-sm text-muted-foreground">Loading details...</div>
      ) : null}

      {contactSubdrawerContact ? (
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
              ? `Edit ${contactSubdrawerContact.name ?? "contact"}`
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
              {contactSubdrawerContact.statuses?.length ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "flex-shrink-0 capitalize",
                    getContactStatusColorClass(getContactPrimaryStatus(contactSubdrawerContact))
                  )}
                >
                  {formatStatusText(getContactPrimaryStatus(contactSubdrawerContact))}
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
            {contactSubdrawerContact.lat != null && contactSubdrawerContact.lng != null ? (
              <a
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/60 bg-primary/10 text-primary shadow-sm transition-all hover:bg-primary/20 hover:border-primary hover:scale-[1.03] active:scale-100"
                href={`https://www.google.com/maps/dir/?api=1&destination=${contactSubdrawerContact.lat},${contactSubdrawerContact.lng}`}
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
            <ContactSummaryFields area={contactSubdrawerArea} note={contactSubdrawerNote} />
          </CardContent>
        </Card>
        </div>
      ) : null}

      {contactSubdrawerContact?.id ? (
        <HomeTodoCard
          contactId={contactSubdrawerContact.id}
          userId={effectiveUserId ?? undefined}
          prefillScopeKey={`contact:${contactSubdrawerContact.id}`}
          prefillOpenTodos={contactSubdrawerPrefillOpenTodos}
          prefillCompletedTodos={contactSubdrawerPrefillCompletedTodos}
          preferLeftCompanionDrawer
          onTodoTap={(todo) =>
            openTodoEditorFromDetails(todo, contactSubdrawerVisits, {
              establishments: contactSubdrawerEstablishment
                ? [{ id: contactSubdrawerEstablishment.id, name: contactSubdrawerEstablishment.name }]
                : [],
              selectedEstablishmentId: contactSubdrawerEstablishment?.id,
              contactId: contactSubdrawerContact.id,
              contactName: contactSubdrawerContact.name,
              disableEstablishmentSelect: true,
            })
          }
        />
      ) : null}

      {contactSubdrawerVisits.length > 0 ? (
        <CallSection
          visits={contactSubdrawerVisits}
          isContactContext
          establishments={contactSubdrawerEstablishment ? [contactSubdrawerEstablishment] : []}
          selectedEstablishmentId={contactSubdrawerEstablishment?.id}
          contactId={contactSubdrawerContact?.id}
          contactName={contactSubdrawerContact?.name}
          contactStatus={contactSubdrawerContact ? getContactPrimaryStatus(contactSubdrawerContact) : undefined}
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
    contactSubdrawerEntityEditOpen || isContactDetail ? "Edit Contact" : "Edit Establishment";

  const entityEditForms = (
    <>
      {contactSubdrawerEntityEditOpen && contactSubdrawerContact?.id ? (
        <ContactForm
          key={contactSubdrawerContact.id}
          establishments={
            contactSubdrawerEstablishment?.id
              ? [contactSubdrawerEstablishment as { id: string; name: string }]
              : []
          }
          selectedEstablishmentId={contactSubdrawerEstablishment?.id ?? undefined}
          isEditing
          initialData={{
            id: contactSubdrawerContact.id,
            establishment_id: contactSubdrawerContact.establishment_id ?? null,
            name: contactSubdrawerContact.name,
            statuses: contactSubdrawerContact.statuses,
            note: contactSubdrawerContact.note ?? null,
            lat: contactSubdrawerContact.lat ?? null,
            lng: contactSubdrawerContact.lng ?? null,
            publisher_id: contactSubdrawerContact.publisher_id ?? null,
          }}
          disableEstablishmentSelect={!!contactSubdrawerEstablishment?.id}
          onSaved={() => {
            setContactSubdrawerEntityEditOpen(false);
            void refreshAfterContactSubdrawerEdit();
          }}
        />
      ) : isContactDetail && selectedContact?.id ? (
        <ContactForm
          key={selectedContact.id}
          establishments={
            selectedContactEstablishment?.id
              ? [selectedContactEstablishment as { id: string; name: string }]
              : []
          }
          selectedEstablishmentId={selectedContactEstablishment?.id ?? undefined}
          isEditing
          initialData={{
            id: selectedContact.id,
            establishment_id: selectedContact.establishment_id ?? null,
            name: selectedContact.name,
            statuses: selectedContact.statuses,
            note: selectedContact.note ?? null,
            lat: selectedContact.lat ?? null,
            lng: selectedContact.lng ?? null,
            publisher_id: selectedContact.publisher_id ?? null,
          }}
          disableEstablishmentSelect={!!selectedContactEstablishment?.id}
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
          className={cn("border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff]", todoDetailsSheetPanelClass)}
        >
          <DrawerHeader className="bg-transparent px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center">
            <DrawerTitle className="text-center text-xl font-extrabold tracking-tight">{isContactDetail
                ? (selectedContact?.name || selectedTodoForDetails?.context_name || "Contact Details")
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
          isContactDetail
            ? (selectedContact?.name || selectedTodoForDetails?.context_name || "Contact Details")
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
            className={cn("border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff]", todoContactSheetPanelClass)}
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
                  {contactSubdrawerContact?.name || "Contact Details"}
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
          title={contactSubdrawerContact?.name || "Contact Details"}
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
            className={cn("border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff]", todoEntityEditSheetPanelClass)}
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
            className={cn("border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff]", todoEditorSheetPanelClass)}
          >
            <DrawerHeader className="bg-transparent px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center">
              <DrawerTitle className="text-center text-lg font-bold">Edit To-Do</DrawerTitle>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2">
              <TodoForm
                establishments={todoEditorContext.establishments}
                selectedEstablishmentId={todoEditorContext.selectedEstablishmentId}
                initialTodo={todoEditorContext.initialTodo}
                contactId={todoEditorContext.contactId}
                contactName={todoEditorContext.contactName}
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
            contactId={todoEditorContext.contactId}
            contactName={todoEditorContext.contactName}
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
      <div className={cn("rounded-lg border overflow-hidden", studyBibleDarkClasses.todoCard, homeTodoCardShade, className)}>
        <div className={cn("flex h-full min-h-0 flex-col", headerVariant === "bar" ? "" : "p-4")}>
          <button
            type="button"
            onClick={openTodoDrawer}
            className={cn(
              headerVariant === "bar"
                ? "flex h-10 shrink-0 items-center gap-2 border-b px-4 text-sm font-medium transition-colors"
                : "text-xs text-muted-foreground mb-4 flex items-center gap-1.5 w-full text-left hover:text-foreground transition-colors",
              headerVariant === "bar" ? cn(studyBibleDarkClasses.cardBarHeader, homeTodoCardShade) : studyBibleDarkClasses.sectionLabel
            )}
          >
            <ListTodo className="h-4 w-4 shrink-0" />
            <span>To-Do</span>
            <span className="ml-1 inline-flex items-center gap-1">
              {renderTodoHeaderBadges("h-4 rounded-full px-1.5 text-[10px] leading-none")}
            </span>
              <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-80 dark:opacity-100" />
          </button>
          <div className={cn("min-h-0 flex-1 overflow-y-auto scrollbar-hide", headerVariant === "bar" && "p-4")}>
            {filteredOpenTodos.length === 0 && filteredCompletedTodos.length === 0 ? (
              <p className={cn("text-sm py-1", studyBibleDarkClasses.todoMeta)}>{emptyText}</p>
            ) : showSplitOpenHeaderBadges ? (
              <div className="space-y-3">
                {assignedOpenCount > 0 ? (
                  <div className="space-y-2">
                    {renderCardSectionLabel("To-Do", assignedOpenCount)}
                    <ul className="space-y-2.5">
                      {cardPreviewAssignedList.map((todo, index) =>
                        renderCardTodoRow(todo, index, "assigned")
                      )}
                    </ul>
                  </div>
                ) : null}
                {unassignedOpenCount > 0 ? (
                  <div className="space-y-2">
                    {renderCardSectionLabel("Open", unassignedOpenCount)}
                    <ul className="space-y-2.5">
                      {cardPreviewUnassignedList.map((todo, index) =>
                        renderCardTodoRow(todo, index + cardPreviewAssignedList.length, "unassigned")
                      )}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <ul className="space-y-2.5">
                {displayTodos.map((todo, index) => renderCardTodoRow(todo, index))}
              </ul>
            )}
            {filteredCompletedTodos.length > 0 && (
              <>
                <div className={cn("text-xs mt-4 mb-2 font-semibold inline-flex items-center gap-1.5", studyBibleDarkClasses.sectionLabel)}>
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
                        hideContactNameBadge={!!contactId}
                        hideContactEstablishmentBadge={!!contactId}
                      />
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <FormDrawerRoot
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
            className={cn("border-[#d4c8e4] text-[#1a1820] dark:border-[#1c1921] dark:text-[#fffaff]", todoMainDrawerPanelClass)}
          >
            <DrawerHeader className="shrink-0 bg-transparent px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center">
              <DrawerTitle className="flex w-full flex-wrap items-center justify-center gap-2 text-center text-lg font-bold">
                <ListTodo className="h-4 w-4 shrink-0" />
                To-Do
                {renderTodoHeaderBadges("h-5 rounded-full px-2 text-[11px] leading-none")}
              </DrawerTitle>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4">
              {renderTodoDrawerFilters()}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2">
                {renderTodoDrawerListBody()}
              </div>
            </div>
          </DrawerWideLeftContent>
        ) : (
          <FormDrawerContent
            className={cn(
              homeListDrawerHeightClass,
              "border-[#d4c8e4] text-[#1a1820] dark:border-[#1c1921] dark:text-[#fffaff] [&_.drawer-content-inner]:flex [&_.drawer-content-inner]:flex-col [&_.drawer-content-inner]:overflow-hidden",
              todoMainDrawerPanelClass
            )}
            handleClassName="dark:bg-[#80778e] dark:shadow-[0_0_18px_rgba(128,119,142,0.45)]"
          >
            <DrawerHeader className="px-4 pt-4 pb-2 items-center shrink-0 bg-transparent">
              <DrawerTitle className="flex w-full flex-wrap items-center justify-center gap-2 text-center text-lg font-bold">
                <ListTodo className="h-4 w-4 shrink-0" />
                To-Do
                {renderTodoHeaderBadges("h-5 rounded-full px-2 text-[11px] leading-none")}
              </DrawerTitle>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col px-4">
              {renderTodoDrawerFilters()}
              <div
                className={cn(
                  "relative min-h-0 flex-1",
                  isTodoDetailsSideLayout
                    ? "overflow-hidden"
                    : cn("overflow-y-auto overscroll-contain", drawerFormScrollPadClass)
                )}
              >
                {renderTodoDrawerListBody()}
              </div>
            </div>
          </FormDrawerContent>
        )}
      </FormDrawerRoot>

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
                disabled={!todoPendingTake || !effectiveUserId || takingTodoId === todoPendingTake?.id}
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
            className={cn("border-[#d4c8e4] text-[#1a1820] dark:border-[#1c1921] dark:text-[#fffaff]", todoFilterDrawerPanelClass)}
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
        <FormDrawerRoot open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen} modal shouldScaleBackground={false}>
          <FormDrawerContent
            className={cn(
              "max-h-[85svh] border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff] [&_.drawer-content-inner]:flex [&_.drawer-content-inner]:flex-col [&_.drawer-content-inner]:overflow-hidden",
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
              <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain pt-2", drawerFormScrollPadClass)}>
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
          </FormDrawerContent>
        </FormDrawerRoot>
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
              "border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff] md:max-h-[100lvh]",
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
                          "flex shrink-0 items-center gap-2 px-3 py-2",
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
                          className="cursor-pointer text-sm font-medium text-foreground dark:text-[#fffaff]"
                        >
                          Select all
                        </Label>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto space-y-3 p-2">
                        {selectableAssignedTodos.length > 0 ? (
                          <div className="space-y-2">
                            <p className={cn("px-1 text-xs font-semibold uppercase tracking-wide", studyBibleDarkClasses.sectionLabel)}>
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
                            <p className={cn("px-1 text-xs font-semibold uppercase tracking-wide", studyBibleDarkClasses.sectionLabel)}>
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
              </div>
            </div>
          </DrawerWideRightContent>
        </Drawer>
      ) : (
        <FormModal
          open={bulkEditPromptOpen}
          onOpenChange={setBulkEditPromptOpen}
          skipFabRootInert
          title="Edit To-Dos"
          description="Select which filtered to-dos to load into bulk edit."
          headerClassName="text-center shrink-0 bg-transparent dark:bg-transparent px-4 pb-2 pt-2"
          className={cn(
            todoBulkEditPickerPanelClass,
            "border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff] max-h-[85svh] [&_.drawer-content-inner]:flex [&_.drawer-content-inner]:flex-col [&_.drawer-content-inner]:min-h-0 [&_.drawer-content-inner]:overflow-hidden"
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
                      "flex items-center gap-2 px-3 py-2 shrink-0",
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
                    <Label htmlFor="bulk-edit-select-all" className="text-sm font-medium cursor-pointer text-foreground dark:text-[#fffaff]">
                      Select all
                    </Label>
                  </div>
                  <div className="min-h-0 flex-1 max-h-[50vh] overflow-y-auto space-y-3 p-2">
                    {selectableAssignedTodos.length > 0 ? (
                      <div className="space-y-2">
                        <p className={cn("px-1 text-xs font-semibold uppercase tracking-wide", studyBibleDarkClasses.sectionLabel)}>
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
                        <p className={cn("px-1 text-xs font-semibold uppercase tracking-wide", studyBibleDarkClasses.sectionLabel)}>
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
  className = "h-5 w-5 border border-border/70 border-border dark:border-[#1c1921]",
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
  const contactStatus = todo.context_status || "for_scouting";
  const establishmentStatus = todo.context_establishment_status || "for_scouting";
  const isContact = !!todo.contact_id;
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
                  {isContact ? (
                    <span className="inline-flex items-center gap-1 min-w-0 max-w-[72%] shrink">
                      <VisitStatusBadge
                        status={contactStatus}
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
                      {isEstablishmentTodoMissingLocation(todo) ? (
                        <MissingEstablishmentLocationIcon />
                      ) : null}
                    </span>
                  )}
                  {isContact && todo.context_establishment_name ? (
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
          <p className="text-left text-base leading-snug line-clamp-2 flex-1 min-w-0 text-foreground dark:text-[#fffaff]">{todo.body}</p>
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
  hideContactNameBadge = false,
  hideContactEstablishmentBadge = false,
  headerAction,
  listTier,
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
  hideContactNameBadge?: boolean;
  hideContactEstablishmentBadge?: boolean;
  headerAction?: ReactNode;
  /** Home card preview: shows Open badge on unassigned pool rows only. */
  listTier?: "assigned" | "unassigned";
}) {
  const canNavigate = !!onTap && (!!todo.call_id || !!todo.establishment_id || !!todo.contact_id);
  const contactStatus = todo.context_status || "for_scouting";
  const establishmentStatus = todo.context_establishment_status || "for_scouting";
  const isDone = !!todo.is_done;
  const displayDate = todo.deadline_date;
  const isContact = !!todo.contact_id;
  const isEvenRow = typeof rowIndex === "number" && rowIndex % 2 === 1;
  const isMine = !currentUserId || todo.publisher_id === currentUserId || todo.partner_id === currentUserId;
  const hasOtherPublisherHighlight = highlightOtherPublishers && !isMine;
  const ageBorderClass = isDone ? "" : getTodoAgeBorderClass(displayDate, hasOtherPublisherHighlight);
  const assigneeSlots = getTodoAssigneeSlots(todo);
  const areaLabel = todo.context_area?.trim() ?? "";
  const hasNameBadge = isContact ? !hideContactNameBadge && !!todo.context_name : !!todo.context_name;
  const hasEstablishmentBadge =
    isContact && !!todo.context_establishment_name && !hideContactEstablishmentBadge;
  const hasVisibleBadges = hasNameBadge || hasEstablishmentBadge;
  const showListTierBadge = listTier === "unassigned";
  const collapseHeaderRow = !hasVisibleBadges && !headerAction && !showListTierBadge;
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
          className={cn("rounded w-5 h-5 shrink-0 border", studyBibleDarkClasses.checkboxPlaceholder)}
          aria-hidden
        />
      )}
      <div className="min-w-0 flex-1 flex flex-col gap-2.5 pr-2.5">
        {!collapseHeaderRow &&
        (showListTierBadge || todo.context_name || (showAssigneeAvatars && assigneeSlots.length > 0) || !!headerAction) ? (
          <div className="flex items-center gap-1.5 min-w-0 w-full">
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
              {showListTierBadge ? (
                <Badge
                  variant="outline"
                  className="h-4 shrink-0 rounded-full px-1.5 text-[9px] leading-none font-medium"
                >
                  Open
                </Badge>
              ) : null}
              {todo.context_name ? (
                <>
                  {isContact ? (
                    hideContactNameBadge ? null : (
                      <span className="inline-flex items-center gap-1 min-w-0 max-w-[72%] shrink">
                        <VisitStatusBadge
                          status={contactStatus}
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
                      {isEstablishmentTodoMissingLocation(todo) ? (
                        <MissingEstablishmentLocationIcon className={isDone ? "opacity-70" : undefined} />
                      ) : null}
                    </span>
                  )}
                  {isContact && todo.context_establishment_name && !hideContactEstablishmentBadge ? (
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
                <span className={cn("text-xs tabular-nums leading-snug pt-0.5", studyBibleDarkClasses.todoMeta)}>
                  {formatTodoDate(displayDate)}
                </span>
              ) : null}
              {areaLabel ? (
                <span className={cn("text-xs leading-snug", studyBibleDarkClasses.todoMeta)} title={areaLabel}>
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
    "flex items-center gap-2 text-sm group rounded-md py-2.5 pl-2 text-foreground dark:text-[#fffaff]",
    studyBibleDarkClasses.todoRow,
    isEvenRow && studyBibleDarkClasses.todoRowStripe,
    hasOtherPublisherHighlight &&
      "border border-dashed border-[#9b8fb0] dark:border-[#5a5068] px-1.5 py-2.5",
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
