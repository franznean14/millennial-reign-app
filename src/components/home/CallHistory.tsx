"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatVisitDateCompact, visitDayKey } from "@/lib/utils/visit-history-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ChevronLeft, ChevronRight, DoorOpen, ListTodo, UserRound } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getTimelineLineStyle } from "@/lib/utils/visit-timeline";
import type { VisitRecord } from "@/lib/utils/visit-history";
import { useBwiVisitHistory } from "@/lib/hooks/use-bwi-visit-history";
import { VisitTimelineRow } from "@/components/visit/VisitTimelineRow";
import { FilterControls } from "@/components/shared/FilterControls";
import { VisitFiltersForm } from "@/components/visit/VisitFiltersForm";
import { VisitAvatars } from "@/components/visit/VisitAvatars";
import { VisitList } from "@/components/visit/VisitList";
import { VisitRowContent } from "@/components/visit/VisitRowContent";
import { VisitStatusBadge } from "@/components/visit/VisitStatusBadge";
import { cn } from "@/lib/utils";
import { getVisitSearchText } from "@/lib/utils/visit-history-ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getEstablishmentDetails,
  getEstablishmentsWithDetails,
  getHouseholderDetails,
  getMyCompletedCallTodos,
  listHouseholders,
  type EstablishmentWithDetails,
  type HouseholderWithDetails,
  type HouseholderStatus,
  type MyOpenCallTodoItem,
  type VisitWithUser,
} from "@/lib/db/business";
import { getStatusTextColor } from "@/lib/utils/status-hierarchy";
import { getSelectedStatusColor } from "@/lib/utils/status-filter-styles";
import NumberFlow from "@number-flow/react";
import { cacheGet, cacheSet, cacheDelete } from "@/lib/offline/store";
import { businessEventBus, type BusinessEventType } from "@/lib/events/business-events";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerWideLeftContentTop, DrawerWideRightContent } from "@/components/ui/drawer";
import { EstablishmentForm } from "@/components/business/EstablishmentForm";
import { HouseholderForm } from "@/components/business/HouseholderForm";
import { EstablishmentDetails } from "@/components/business/EstablishmentDetails";
import { HouseholderDetails } from "@/components/business/HouseholderDetails";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useHomeTodoDetailsFabOptional } from "@/components/home/home-todo-details-fab-context";
import { studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";

interface CallHistoryProps {
  userId: string;
  onVisitClick?: (visit: VisitRecord) => void;
  onNavigateToBusinessWithStatus?: (
    tab: "establishments" | "householders",
    status: string,
    areas?: string | string[]
  ) => void;
  bwiAreaFilter: string[];
  onBwiAreaChange: (areas: string[]) => void;
  /** Match sibling HomeTodoCard so UnifiedFab bridges to this card at the same viewport. */
  fabBridgeLayout?: "belowXl" | "xlAndUp";
  presentation?: "tabs" | "summary" | "calls";
  className?: string;
}

type CallsStreamItem =
  | { kind: "visit"; key: string; dayKey: string; timeMs: number; visit: VisitRecord }
  | { kind: "todo"; key: string; dayKey: string; timeMs: number; todo: MyOpenCallTodoItem };

type CallsEstablishmentSnapshot = {
  establishment: EstablishmentWithDetails;
  visits: VisitWithUser[];
  householders: HouseholderWithDetails[];
};

type CallsHouseholderSnapshot = {
  householder: HouseholderWithDetails;
  visits: VisitWithUser[];
  establishment?: { id: string; name: string; area?: string | null; statuses?: string[] | null } | null;
};

function callsStreamItemIsEstablishmentColumn(item: CallsStreamItem): boolean {
  if (item.kind === "visit") return item.visit.visit_type === "establishment";
  if (item.kind === "todo") {
    if (item.todo.householder_id) return false;
    return Boolean(item.todo.establishment_id);
  }
  return false;
}

function callsStreamItemIsContactColumn(item: CallsStreamItem): boolean {
  if (item.kind === "visit") return item.visit.visit_type === "householder";
  if (item.kind === "todo") {
    if (item.todo.householder_id) return true;
    return !item.todo.establishment_id;
  }
  return false;
}

function KnockingDoorIcon() {
  return (
    <span className="inline-flex items-center gap-0.5 shrink-0" aria-hidden>
      <UserRound className="h-3.5 w-3.5" />
      <DoorOpen className="h-3.5 w-3.5" />
    </span>
  );
}

/** Match visit row id to bus event id (raw UUID vs est-/hh- prefixed list ids). */
function callsDetailsVisitKeysMatch(rowId: string, eventId: string): boolean {
  if (rowId === eventId) return true;
  const strip = (id: string) => id.replace(/^(est|hh)-/, "");
  return strip(rowId) === strip(eventId);
}

function filterCallsDetailsVisitsDeleted(visits: VisitWithUser[], deletedId: string): VisitWithUser[] {
  return visits.filter((v) => !callsDetailsVisitKeysMatch(v.id, deletedId));
}

type VisitUpdatedPayload = {
  id: string;
  note?: string | null;
  visit_date?: string;
  publisher_id?: string | null;
  partner_id?: string | null;
  publisher_guest_name?: string | null;
  partner_guest_name?: string | null;
  publisher?: VisitWithUser["publisher"];
  partner?: VisitWithUser["partner"];
};

function mergeVisitUpdatedIntoList(visits: VisitWithUser[], payload: VisitUpdatedPayload): VisitWithUser[] {
  return visits.map((v) => {
    if (!callsDetailsVisitKeysMatch(v.id, payload.id)) return v;
    return {
      ...v,
      note: payload.note !== undefined ? payload.note : v.note,
      visit_date: payload.visit_date ?? v.visit_date,
      publisher_id: payload.publisher_id !== undefined ? payload.publisher_id : v.publisher_id,
      partner_id: payload.partner_id !== undefined ? payload.partner_id : v.partner_id,
      publisher_guest_name:
        payload.publisher_guest_name !== undefined ? payload.publisher_guest_name : v.publisher_guest_name,
      partner_guest_name:
        payload.partner_guest_name !== undefined ? payload.partner_guest_name : v.partner_guest_name,
      publisher: payload.publisher !== undefined ? payload.publisher : v.publisher,
      partner: payload.partner !== undefined ? payload.partner : v.partner,
    };
  });
}

function BwiStatusCell({
  onClick,
  children,
  className,
}: {
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn("w-full text-left cursor-pointer hover:opacity-80 transition-opacity", className)}
      >
        {children}
      </button>
    );
  }
  return <div className={className}>{children}</div>;
}

export function CallHistory({
  userId,
  onVisitClick,
  onNavigateToBusinessWithStatus,
  bwiAreaFilter,
  onBwiAreaChange,
  fabBridgeLayout,
  presentation = "tabs",
  className,
}: CallHistoryProps) {
  const needsCallsData = presentation !== "summary";
  const needsBwiSummaryData = presentation !== "calls";
  const [showDrawer, setShowDrawer] = useState(false);
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [showAreaDrawer, setShowAreaDrawer] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [localSearchValue, setLocalSearchValue] = useState("");
  /** Expanded search UI: explicit activate or non-empty query (avoids setState in effects). */
  const isSearchExpanded = isSearchActive || localSearchValue.trim().length > 0;
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<"bwi" | "visit-history">("bwi");
  const activeTabRef = useRef<"bwi" | "visit-history">("bwi");
  const visitHistoryPointerDownTabRef = useRef<"bwi" | "visit-history">("bwi");
  const bwiPointerDownTabRef = useRef<"bwi" | "visit-history">("bwi");
  const [bwiLabelFlash, setBwiLabelFlash] = useState(true);
  const [bwiEstablishments, setBwiEstablishments] = useState<EstablishmentWithDetails[]>([]);
  const [bwiHouseholders, setBwiHouseholders] = useState<HouseholderWithDetails[]>([]);
  const [callTodos, setCallTodos] = useState<MyOpenCallTodoItem[]>([]);
  const [callsDetailsDrawerOpen, setCallsDetailsDrawerOpen] = useState(false);
  const [selectedCallsEstablishmentDetails, setSelectedCallsEstablishmentDetails] =
    useState<CallsEstablishmentSnapshot | null>(null);
  const [selectedCallsHouseholderDetails, setSelectedCallsHouseholderDetails] =
    useState<CallsHouseholderSnapshot | null>(null);
  const [isLoadingCallsDetails, setIsLoadingCallsDetails] = useState(false);
  const [callsContactSubdrawerOpen, setCallsContactSubdrawerOpen] = useState(false);
  const [selectedCallsContactDetails, setSelectedCallsContactDetails] =
    useState<CallsHouseholderSnapshot | null>(null);
  const [isLoadingCallsContactDetails, setIsLoadingCallsContactDetails] = useState(false);
  const [callsDetailsEntityEditOpen, setCallsDetailsEntityEditOpen] = useState(false);
  const [callsContactSubdrawerEntityEditOpen, setCallsContactSubdrawerEntityEditOpen] =
    useState(false);
  const callsEstablishmentCacheRef = useRef(new Map<string, CallsEstablishmentSnapshot>());
  const callsHouseholderCacheRef = useRef(new Map<string, CallsHouseholderSnapshot>());
  const selectedCallsHouseholderDetailsRef = useRef<CallsHouseholderSnapshot | null>(null);
  const selectedCallsEstablishmentDetailsRef = useRef<CallsEstablishmentSnapshot | null>(null);
  const selectedCallsContactDetailsRef = useRef<CallsHouseholderSnapshot | null>(null);
  const callsContactSubdrawerOpenRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hasFocusedRef = useRef(false);
  const searchDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  const {
    visits,
    loading,
    allVisitsRawCount,
    filteredVisits: hookFilteredVisits,
    filterOptions,
    assigneeFilterOptions,
    filterBadges,
    filters,
    setFilters,
    clearFilters,
    clearSearch,
    loadAllVisits,
    loadMore,
    loadingMore,
    hasMore
  } = useBwiVisitHistory({ userId, enabled: needsCallsData });

  useEffect(() => {
    if (!needsCallsData || !userId) return;
    let cancelled = false;
    const cacheKey = `home-calls-done-todos:${userId}`;
    const loadTodos = async () => {
      try {
        const cached = await cacheGet<{ todos?: MyOpenCallTodoItem[] }>(cacheKey);
        if (!cancelled && Array.isArray(cached?.todos)) {
          setCallTodos(cached.todos);
        }
      } catch {
        // cache read best-effort
      }
      try {
        const latest = await getMyCompletedCallTodos(userId, 200);
        if (cancelled) return;
        setCallTodos(latest);
        await cacheSet(cacheKey, { todos: latest, timestamp: new Date().toISOString() });
      } catch {
        // network best-effort
      }
    };
    loadTodos();
    return () => {
      cancelled = true;
    };
  }, [needsCallsData, userId]);

  // Client-side search filtering - filters locally without updating hook state
  // This prevents all items from unmounting/remounting, only items that don't match will exit
  // Keep filters.search empty so hookFilteredVisits doesn't include search filtering
  // Then apply localSearchValue locally for instant, fluid filtering
  const filteredVisits = useMemo(() => {
    const baseFiltered = hookFilteredVisits;
    if (!localSearchValue.trim()) {
      return baseFiltered;
    }
    const searchLower = localSearchValue.trim().toLowerCase();
    return baseFiltered.filter((visit) => getVisitSearchText(visit).includes(searchLower));
  }, [hookFilteredVisits, localSearchValue]);

  const hasVisitFiltersApplied = useMemo(
    () =>
      filterBadges.length > 0 ||
      filters.myUpdatesOnly ||
      filters.bwiOnly ||
      filters.householderOnly ||
      filters.callDateFrom != null ||
      filters.callDateTo != null ||
      localSearchValue.trim().length > 0,
    [
      filterBadges,
      filters.myUpdatesOnly,
      filters.bwiOnly,
      filters.householderOnly,
      filters.callDateFrom,
      filters.callDateTo,
      localSearchValue,
    ]
  );

  // Apply all filters to visits (handled by hook)

  const handleSeeMore = () => {
    setShowDrawer(true);
    // Cache-first open for instant drawer rows, then revalidate in background.
    if (allVisitsRawCount === 0) {
      loadAllVisits(0, false);
      setTimeout(() => {
        loadAllVisits(0, true);
      }, 0);
    }
  };

  // Fetch every paginated batch while the Calls drawer is open so client-side filters and the
  // header count use the full list, not only rows from "Load More" so far.
  useEffect(() => {
    if (!showDrawer || !hasMore || loadingMore) return;
    loadMore();
  }, [showDrawer, hasMore, loadingMore, loadMore]);

  // Keep ref in sync with state
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  // Flash "BWI" on load, then show "All"
  useEffect(() => {
    if (activeTab !== "bwi") return;
    const t = setTimeout(() => setBwiLabelFlash(false), 2000);
    return () => clearTimeout(t);
  }, [activeTab]);

  // Available areas from establishments (unique, sorted), for BWI area cycle
  const bwiAreasSorted = useMemo(() => {
    const set = new Set<string>();
    bwiEstablishments.forEach((est) => {
      const a = est.area?.trim();
      if (a) set.add(a);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [bwiEstablishments]);

  // Filter BWI data by selected areas (establishments by area; householders by their establishment's area)
  // Compare trimmed areas so "Tresmavica Building" matches "Tresmavica Building " from DB.
  const { filteredByAreaEstablishments, filteredByAreaHouseholders } = useMemo(() => {
    if (bwiAreaFilter.length === 0) {
      return { filteredByAreaEstablishments: bwiEstablishments, filteredByAreaHouseholders: bwiHouseholders };
    }
    const selectedAreas = new Set(bwiAreaFilter.map((area) => area.trim()).filter(Boolean));
    const inArea = (e: EstablishmentWithDetails) => selectedAreas.has((e.area?.trim() ?? ""));
    const estIdsInArea = new Set(bwiEstablishments.filter(inArea).map((e) => e.id));
    return {
      filteredByAreaEstablishments: bwiEstablishments.filter(inArea),
      filteredByAreaHouseholders: bwiHouseholders.filter((hh) =>
        hh.establishment_id ? estIdsInArea.has(hh.establishment_id) : false
      ),
    };
  }, [bwiEstablishments, bwiHouseholders, bwiAreaFilter]);

  const handleBwiPointerDown = () => {
    bwiPointerDownTabRef.current = activeTabRef.current;
  };

  const handleBwiTabClick = (e: React.MouseEvent) => {
    if (bwiPointerDownTabRef.current !== "bwi") return;
    e.preventDefault();
    e.stopPropagation();
    // When BWI tab is already active, open area picker instead of cycling.
    setShowAreaDrawer(true);
  };

  const bwiAreaLabel =
    bwiAreaFilter.length === 0
      ? "All"
      : bwiAreaFilter.length === 1
        ? bwiAreaFilter[0]
        : `${bwiAreaFilter.length} Areas`;

  // BWI summary (establishment + householder counts) must not be tied to the "All" / "Calls" tab.
  // Previously, switching to "Calls" before the fetch finished aborted the in-flight request (cleanup set
  // isMounted=false), so counts and hh-derived stats stayed at zero until something triggered a refetch.
  useEffect(() => {
    if (!needsBwiSummaryData || !userId) return;

    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const loadBwiData = async (options?: { forceRefresh?: boolean }) => {
      const forceRefresh = options?.forceRefresh ?? false;
      const cacheKey = "bwi-summary-data";
      const cached = await cacheGet<{
        establishments?: EstablishmentWithDetails[];
        householders?: HouseholderWithDetails[];
      }>(cacheKey);

      if (cached?.establishments || cached?.householders) {
        if (!cancelled) {
          setBwiEstablishments(cached.establishments || []);
          setBwiHouseholders((cached.householders || []).filter((hh) => !!hh.establishment_id));
        }
        if (!forceRefresh) return;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return;
      }

      try {
        const [establishments, householders] = await Promise.all([
          getEstablishmentsWithDetails(),
          listHouseholders(),
        ]);
        if (cancelled) return;
        setBwiEstablishments(establishments);
        setBwiHouseholders(householders.filter((hh) => !!hh.establishment_id));
        await cacheSet(cacheKey, { establishments, householders });
      } catch (error) {
        console.error("Error loading BWI summary data:", error);
      }
    };

    const scheduleRefetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!cancelled) void loadBwiData({ forceRefresh: true });
      }, 400);
    };

    void loadBwiData();

    const refetchEvents: BusinessEventType[] = [
      "establishment-added",
      "establishment-updated",
      "householder-added",
      "householder-updated",
      "householder-deleted",
      "householder-archived",
      "visit-added",
      "visit-updated",
      "visit-deleted",
    ];
    refetchEvents.forEach((ev) => businessEventBus.subscribe(ev, scheduleRefetch));

    const onOnline = () => {
      if (!cancelled) void loadBwiData({ forceRefresh: true });
    };
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      refetchEvents.forEach((ev) => businessEventBus.unsubscribe(ev, scheduleRefetch));
      window.removeEventListener("online", onOnline);
    };
  }, [needsBwiSummaryData, userId]);

  const establishmentStatusCounts = useMemo(() => {
    const counts = {
      for_replenishment: 0,
      accepted_rack: 0,
      for_follow_up: 0,
      for_scouting: 0
    };
    filteredByAreaEstablishments.forEach((est) => {
      const statuses = est.statuses ?? [];
      if (statuses.includes("for_replenishment")) counts.for_replenishment += 1;
      if (statuses.includes("accepted_rack")) counts.accepted_rack += 1;
      if (statuses.includes("for_follow_up")) counts.for_follow_up += 1;
      if (statuses.includes("for_scouting")) counts.for_scouting += 1;
    });
    return counts;
  }, [filteredByAreaEstablishments]);

  const householderStatusCounts = useMemo(() => {
    const counts = {
      bible_study: 0,
      return_visit: 0,
      interested: 0,
      potential: 0
    };
    filteredByAreaHouseholders.forEach((hh) => {
      switch (hh.status) {
        case "bible_study":
          counts.bible_study += 1;
          break;
        case "return_visit":
          counts.return_visit += 1;
          break;
        case "interested":
          counts.interested += 1;
          break;
        case "potential":
          counts.potential += 1;
          break;
        default:
          break;
      }
    });
    return counts;
  }, [filteredByAreaHouseholders]);

  // Helper to extract just the text color class
  const getStatusTextColorClass = (status: string) => {
    const colorString = getStatusTextColor(status);
    return colorString.split(" ")[0]; // Extract just the text color class
  };

  const handleTabChange = (value: string) => {
    const currentActiveTab = activeTabRef.current;
    if (value !== currentActiveTab) {
      setActiveTab(value as "bwi" | "visit-history");
    }
  };

  const handleCallHistoryPointerDown = () => {
    visitHistoryPointerDownTabRef.current = activeTabRef.current;
  };

  const handleCallHistoryTabClick = (e: React.MouseEvent) => {
    // Use the tab that was active at pointer-down time
    const tabAtPointerDown = visitHistoryPointerDownTabRef.current;
    if (tabAtPointerDown === "visit-history") {
      e.preventDefault();
      e.stopPropagation();
      handleSeeMore();
    }
  };


  const navigateWithBwiArea = (tab: "establishments" | "householders", status: string) => {
    if (!onNavigateToBusinessWithStatus) return;
    const selectedAreas = bwiAreaFilter.map((area) => area.trim()).filter(Boolean);
    onNavigateToBusinessWithStatus(tab, status, selectedAreas.length > 0 ? selectedAreas : undefined);
  };

  const filterForm = (
    <VisitFiltersForm
      filters={filters}
      statusOptions={filterOptions.statuses}
      areaOptions={filterOptions.areas}
      assigneeOptions={assigneeFilterOptions}
      assigneeHelpText="Show calls where this publisher or partner participated."
      showCallDateFilter
      compactTabletLayout
      onFiltersChange={setFilters}
      onClearFilters={clearFilters}
    />
  );
  const assigneeById = useMemo(() => {
    const map = new Map<string, (typeof assigneeFilterOptions)[number]>();
    assigneeFilterOptions.forEach((option) => map.set(option.id, option));
    return map;
  }, [assigneeFilterOptions]);

  const getSortMs = (dateValue?: string | null, fallbackValue?: string | null): number => {
    const primary = dateValue ? new Date(dateValue).getTime() : Number.NaN;
    if (!Number.isNaN(primary)) return primary;
    const fallback = fallbackValue ? new Date(fallbackValue).getTime() : Number.NaN;
    if (!Number.isNaN(fallback)) return fallback;
    return 0;
  };
  const getTodoDisplayDate = (todo: MyOpenCallTodoItem): string => {
    return (
      todo.visit_date ||
      todo.deadline_date ||
      todo.call_created_at ||
      todo.created_at ||
      ""
    );
  };
  const filteredCallTodos = useMemo(() => {
    const searchLower = localSearchValue.trim().toLowerCase();
    return callTodos.filter((todo) => {
      if (searchLower) {
        const haystack = `${todo.body ?? ""} ${todo.context_name ?? ""} ${todo.context_establishment_name ?? ""}`.toLowerCase();
        if (!haystack.includes(searchLower)) return false;
      }
      if (filters.statuses.length > 0) {
        const status = todo.context_status ?? null;
        if (!status || !filters.statuses.includes(status)) return false;
      }
      if (filters.areas.length > 0) {
        const area = todo.context_area?.trim() ?? "";
        if (!area || !filters.areas.includes(area)) return false;
      }
      if (filters.assigneeIds.length > 0) {
        const pub = todo.publisher_id ?? null;
        const part = todo.partner_id ?? null;
        const matches =
          (pub && filters.assigneeIds.includes(pub)) ||
          (part && filters.assigneeIds.includes(part));
        if (!matches) return false;
      }
      if (filters.callDateFrom || filters.callDateTo) {
        const day = visitDayKey(getTodoDisplayDate(todo));
        if (!day) return false;
        if (filters.callDateFrom && day < filters.callDateFrom) return false;
        if (filters.callDateTo && day > filters.callDateTo) return false;
      }
      if (filters.myUpdatesOnly) {
        const isMine = todo.publisher_id === userId || todo.partner_id === userId;
        if (!isMine) return false;
      }
      if (filters.bwiOnly && !todo.establishment_id) return false;
      if (filters.householderOnly && !todo.householder_id) return false;
      return true;
    });
  }, [callTodos, filters, localSearchValue, userId]);
  const buildCallsStreamItems = useMemo(() => {
    const dayKeyMs = (dayKey: string): number => {
      if (!dayKey) return 0;
      const ms = new Date(`${dayKey}T00:00:00`).getTime();
      return Number.isNaN(ms) ? 0 : ms;
    };
    const toItems = (callItems: VisitRecord[]): CallsStreamItem[] => {
      const callRows: CallsStreamItem[] = callItems.map((visit) => ({
        kind: "visit",
        key: `visit:${visit.id}`,
        dayKey: visitDayKey(visit.visit_date),
        timeMs: getSortMs(visit.updated_at ?? visit.created_at, visit.visit_date),
        visit,
      }));
      const callDays = new Set(callRows.map((row) => row.dayKey).filter(Boolean));
      const todoRows: CallsStreamItem[] = filteredCallTodos
        .map((todo) => {
          const displayDate = getTodoDisplayDate(todo);
          return {
            kind: "todo" as const,
            key: `todo:${todo.id}`,
            dayKey: visitDayKey(displayDate),
            timeMs: getSortMs(todo.call_created_at ?? todo.created_at, displayDate),
            todo,
          };
        })
        .filter((row) => row.dayKey && !callDays.has(row.dayKey));
      return [...callRows, ...todoRows].sort((a, b) => {
        const byDay = dayKeyMs(b.dayKey) - dayKeyMs(a.dayKey);
        if (byDay !== 0) return byDay;
        if (a.timeMs !== b.timeMs) return b.timeMs - a.timeMs;
        return b.key.localeCompare(a.key);
      });
    };
    return {
      preview: toItems(visits).slice(0, 5),
      drawer: toItems(filteredVisits),
    };
  }, [visits, filteredVisits, filteredCallTodos]);

  const callsDrawerTabletLayout = useMediaQuery("(min-width: 768px)");
  const isXlViewport = useMediaQuery("(min-width: 1280px)");
  const callsDrawerEstablishmentItems = useMemo(
    () => buildCallsStreamItems.drawer.filter(callsStreamItemIsEstablishmentColumn),
    [buildCallsStreamItems.drawer]
  );
  const callsDrawerContactItems = useMemo(
    () => buildCallsStreamItems.drawer.filter(callsStreamItemIsContactColumn),
    [buildCallsStreamItems.drawer]
  );
  const callsDetailsSheetTitle = useMemo(() => {
    const hh = selectedCallsHouseholderDetails?.householder?.name?.trim();
    if (hh) return hh;
    const est = selectedCallsEstablishmentDetails?.establishment?.name?.trim();
    if (est) return est;
    return "Details";
  }, [
    selectedCallsHouseholderDetails?.householder?.name,
    selectedCallsEstablishmentDetails?.establishment?.name,
  ]);

  function openCallsDetailsDrawer(
    target:
      | {
          kind: "visit";
          visit: VisitRecord;
        }
      | {
          kind: "todo";
          todo: MyOpenCallTodoItem;
        }
  ) {
    const householderId =
      target.kind === "visit" ? target.visit.householder_id : target.todo.householder_id;
    const establishmentId =
      target.kind === "visit" ? target.visit.establishment_id : target.todo.establishment_id;

    if (householderId) {
      const cached = callsHouseholderCacheRef.current.get(householderId);
      if (cached) {
        setSelectedCallsHouseholderDetails(cached);
      } else {
        const fallbackName =
          target.kind === "visit"
            ? target.visit.householder_name ?? "Contact"
            : target.todo.context_name ?? "Contact";
        const fallbackStatus =
          target.kind === "visit"
            ? (target.visit.householder_status as HouseholderWithDetails["status"] | undefined) ?? "potential"
            : (target.todo.context_status as HouseholderWithDetails["status"] | undefined) ?? "potential";
        const fallbackEstablishmentName =
          target.kind === "visit"
            ? target.visit.establishment_name ?? null
            : target.todo.context_establishment_name ?? null;
        const fallbackEstablishmentStatus =
          target.kind === "visit"
            ? target.visit.establishment_status ?? null
            : target.todo.context_establishment_status ?? null;
        setSelectedCallsHouseholderDetails({
          householder: {
            id: householderId,
            name: fallbackName,
            status: fallbackStatus,
            note: null,
            establishment_id: establishmentId ?? null,
            establishment_name: fallbackEstablishmentName,
            publisher_id: null,
            lat: null,
            lng: null,
          },
          visits: [],
          establishment: establishmentId
            ? {
                id: establishmentId,
                name: fallbackEstablishmentName ?? "",
                area: null,
                statuses: fallbackEstablishmentStatus ? [fallbackEstablishmentStatus] : null,
              }
            : null,
        });
      }
      setSelectedCallsEstablishmentDetails(null);
      setCallsDetailsDrawerOpen(true);
      setIsLoadingCallsDetails(!cached);
      getHouseholderDetails(householderId)
        .then((details) => {
          if (!details) return;
          const nextSnapshot: CallsHouseholderSnapshot = {
            householder: details.householder,
            visits: details.visits,
            establishment: details.establishment,
          };
          callsHouseholderCacheRef.current.set(householderId, nextSnapshot);
          setSelectedCallsHouseholderDetails(nextSnapshot);
        })
        .finally(() => setIsLoadingCallsDetails(false));
      return;
    }

    if (establishmentId) {
      const cached = callsEstablishmentCacheRef.current.get(establishmentId);
      if (cached) {
        setSelectedCallsEstablishmentDetails(cached);
      } else {
        const fallbackName =
          target.kind === "visit"
            ? target.visit.establishment_name ?? "Establishment"
            : target.todo.context_name ?? "Establishment";
        const fallbackStatus =
          target.kind === "visit"
            ? target.visit.establishment_status ?? "for_scouting"
            : target.todo.context_establishment_status ||
              target.todo.context_status ||
              "for_scouting";
        const fallbackArea =
          target.kind === "visit"
            ? target.visit.establishment_area ?? null
            : target.todo.context_area ?? null;
        setSelectedCallsEstablishmentDetails({
          establishment: {
            id: establishmentId,
            name: fallbackName,
            area: fallbackArea,
            description: null,
            floor: null,
            note: null,
            statuses: [fallbackStatus],
            lat: null,
            lng: null,
          },
          visits: [],
          householders: [],
        });
      }
      setSelectedCallsHouseholderDetails(null);
      setCallsDetailsDrawerOpen(true);
      setIsLoadingCallsDetails(!cached);
      getEstablishmentDetails(establishmentId)
        .then((details) => {
          if (!details) return;
          const nextSnapshot: CallsEstablishmentSnapshot = {
            establishment: details.establishment,
            visits: details.visits,
            householders: details.householders,
          };
          callsEstablishmentCacheRef.current.set(establishmentId, nextSnapshot);
          setSelectedCallsEstablishmentDetails(nextSnapshot);
        })
        .finally(() => setIsLoadingCallsDetails(false));
      return;
    }

    if (target.kind === "visit" && onVisitClick) {
      onVisitClick(target.visit);
    }
  }

  function openCallsContactSubdrawer(householder: HouseholderWithDetails) {
    const householderId = householder.id;
    if (!householderId) return;
    const cached = callsHouseholderCacheRef.current.get(householderId);

    if (cached) {
      setSelectedCallsContactDetails(cached);
    } else {
      const establishment =
        selectedCallsEstablishmentDetails?.establishment &&
        selectedCallsEstablishmentDetails.establishment.id === householder.establishment_id
          ? selectedCallsEstablishmentDetails.establishment
          : null;
      const fallbackEstablishmentName =
        establishment?.name ?? householder.establishment_name ?? null;
      const fallbackStatuses =
        establishment?.statuses && establishment.statuses.length > 0
          ? establishment.statuses
          : null;
      setSelectedCallsContactDetails({
        householder,
        visits: [],
        establishment: householder.establishment_id
          ? {
              id: householder.establishment_id,
              name: fallbackEstablishmentName ?? "",
              area: establishment?.area ?? null,
              statuses: fallbackStatuses,
            }
          : null,
      });
    }

    setCallsContactSubdrawerOpen(true);
    setIsLoadingCallsContactDetails(!cached);
    getHouseholderDetails(householderId)
      .then((details) => {
        if (!details) return;
        const nextSnapshot: CallsHouseholderSnapshot = {
          householder: details.householder,
          visits: details.visits,
          establishment: details.establishment,
        };
        callsHouseholderCacheRef.current.set(householderId, nextSnapshot);
        setSelectedCallsContactDetails(nextSnapshot);
      })
      .finally(() => setIsLoadingCallsContactDetails(false));
  }

  const closeCallsContactSubdrawer = useCallback(() => {
    setCallsContactSubdrawerOpen(false);
    setSelectedCallsContactDetails(null);
    setCallsContactSubdrawerEntityEditOpen(false);
  }, []);

  useLayoutEffect(() => {
    selectedCallsHouseholderDetailsRef.current = selectedCallsHouseholderDetails;
    selectedCallsEstablishmentDetailsRef.current = selectedCallsEstablishmentDetails;
    selectedCallsContactDetailsRef.current = selectedCallsContactDetails;
    callsContactSubdrawerOpenRef.current = callsContactSubdrawerOpen;
  }, [
    selectedCallsHouseholderDetails,
    selectedCallsEstablishmentDetails,
    selectedCallsContactDetails,
    callsContactSubdrawerOpen,
  ]);

  const broadcastCallsBusinessRefresh = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent("business-todos-mutated"));
      window.dispatchEvent(new CustomEvent("app-business-refresh"));
    } catch {
      /* ignore */
    }
  }, []);

  async function refreshCallsMainDetailAfterSave() {
    const hhId = selectedCallsHouseholderDetailsRef.current?.householder.id;
    const estId = selectedCallsEstablishmentDetailsRef.current?.establishment.id;
    if (hhId) {
      await cacheDelete(`householder:details:v3:${hhId}`);
      const result = await getHouseholderDetails(hhId);
      if (result) {
        const snap: CallsHouseholderSnapshot = {
          householder: result.householder,
          visits: result.visits,
          establishment: result.establishment,
        };
        callsHouseholderCacheRef.current.set(hhId, snap);
        setSelectedCallsHouseholderDetails(snap);
      }
    } else if (estId) {
      await cacheDelete(`establishment:details:${estId}`);
      const result = await getEstablishmentDetails(estId);
      if (result) {
        const snap: CallsEstablishmentSnapshot = {
          establishment: result.establishment,
          visits: result.visits,
          householders: result.householders,
        };
        callsEstablishmentCacheRef.current.set(estId, snap);
        setSelectedCallsEstablishmentDetails(snap);
      }
    }
    broadcastCallsBusinessRefresh();
  }

  async function refreshCallsContactSubdrawerAfterSave() {
    const hhId = selectedCallsContactDetailsRef.current?.householder.id;
    const parentEstId = selectedCallsEstablishmentDetailsRef.current?.establishment.id;
    if (hhId) {
      await cacheDelete(`householder:details:v3:${hhId}`);
      const result = await getHouseholderDetails(hhId);
      if (result) {
        const snap: CallsHouseholderSnapshot = {
          householder: result.householder,
          visits: result.visits,
          establishment: result.establishment,
        };
        callsHouseholderCacheRef.current.set(hhId, snap);
        setSelectedCallsContactDetails(snap);
      }
    }
    if (parentEstId) {
      await cacheDelete(`establishment:details:${parentEstId}`);
      const estResult = await getEstablishmentDetails(parentEstId);
      if (estResult) {
        const snap: CallsEstablishmentSnapshot = {
          establishment: estResult.establishment,
          visits: estResult.visits,
          householders: estResult.householders,
        };
        callsEstablishmentCacheRef.current.set(parentEstId, snap);
        setSelectedCallsEstablishmentDetails(snap);
      }
    }
    broadcastCallsBusinessRefresh();
  }

  const openCallsMainSummaryEditor = useCallback(() => {
    setCallsContactSubdrawerEntityEditOpen(false);
    setCallsDetailsEntityEditOpen(true);
  }, []);

  const openCallsContactSummaryEditor = useCallback(() => {
    setCallsDetailsEntityEditOpen(false);
    setCallsContactSubdrawerEntityEditOpen(true);
  }, []);

  const callsDetailsFabSurface = useMemo<"estMain" | "hhMain" | "contactSub" | null>(() => {
    if (callsContactSubdrawerOpen) return "contactSub";
    if (!callsDetailsDrawerOpen) return null;
    if (selectedCallsEstablishmentDetails) return "estMain";
    if (selectedCallsHouseholderDetails) return "hhMain";
    return null;
  }, [
    callsContactSubdrawerOpen,
    callsDetailsDrawerOpen,
    selectedCallsEstablishmentDetails,
    selectedCallsHouseholderDetails,
  ]);

  const callsDetailsFabFormConfig = useMemo(() => {
    if (!callsDetailsFabSurface) return null;
    if (callsDetailsFabSurface === "estMain") {
      const e = selectedCallsEstablishmentDetails?.establishment;
      if (!e?.id) return null;
      return {
        establishments: [{ id: e.id, name: e.name }],
        selectedEstablishmentId: e.id as string,
      };
    }
    if (callsDetailsFabSurface === "hhMain") {
      const hh = selectedCallsHouseholderDetails?.householder;
      const est = selectedCallsHouseholderDetails?.establishment;
      if (!hh?.id || !est?.id || !est.name?.trim()) return null;
      return {
        establishments: [{ id: est.id, name: est.name }],
        selectedEstablishmentId: est.id,
        householderId: hh.id,
        householderName: hh.name,
        householderStatus: hh.status,
      };
    }
    const hh = selectedCallsContactDetails?.householder;
    const estFromContact = selectedCallsContactDetails?.establishment;
    const est =
      estFromContact?.id && estFromContact.name
        ? { id: estFromContact.id, name: estFromContact.name }
        : selectedCallsEstablishmentDetails
          ? {
              id: selectedCallsEstablishmentDetails.establishment.id,
              name: selectedCallsEstablishmentDetails.establishment.name,
            }
          : null;
    if (!hh?.id || !est?.id || !est.name?.trim()) return null;
    return {
      establishments: [{ id: est.id, name: est.name }],
      selectedEstablishmentId: est.id,
      householderId: hh.id,
      householderName: hh.name,
      householderStatus: hh.status,
    };
  }, [
    callsDetailsFabSurface,
    selectedCallsEstablishmentDetails,
    selectedCallsHouseholderDetails,
    selectedCallsContactDetails,
  ]);

  const homeDetailsFabCtx = useHomeTodoDetailsFabOptional();
  const setCallsHistoryFabOverride = homeDetailsFabCtx?.setCallsHistoryFabOverride;

  const fabBridgeActiveForCallHistory =
    fabBridgeLayout != null &&
    ((fabBridgeLayout === "belowXl" && !isXlViewport) || (fabBridgeLayout === "xlAndUp" && isXlViewport));

  const shouldPublishCallsDetailsFab =
    callsDetailsFabFormConfig != null &&
    !callsDetailsEntityEditOpen &&
    !callsContactSubdrawerEntityEditOpen;

  /* eslint-disable react-hooks/exhaustive-deps -- refresh helpers read refs; omitting avoids effect churn */
  useEffect(() => {
    if (!setCallsHistoryFabOverride || !fabBridgeActiveForCallHistory) return;

    if (shouldPublishCallsDetailsFab && callsDetailsFabFormConfig) {
      setCallsHistoryFabOverride({
        showNewContact: callsDetailsFabSurface === "estMain",
        establishments: callsDetailsFabFormConfig.establishments.map((e) => ({
          id: (e.id ?? callsDetailsFabFormConfig.selectedEstablishmentId) as string,
          name: e.name,
        })),
        selectedEstablishmentId: callsDetailsFabFormConfig.selectedEstablishmentId,
        householderId: callsDetailsFabFormConfig.householderId,
        householderName: callsDetailsFabFormConfig.householderName,
        householderStatus: callsDetailsFabFormConfig.householderStatus,
        onAfterSave: async () => {
          if (
            callsContactSubdrawerOpenRef.current &&
            selectedCallsContactDetailsRef.current?.householder.id
          ) {
            await refreshCallsContactSubdrawerAfterSave();
          } else {
            await refreshCallsMainDetailAfterSave();
          }
        },
        stackLeftFormAboveNestedDetails: callsContactSubdrawerOpen && callsDrawerTabletLayout,
      });
    } else {
      setCallsHistoryFabOverride(null);
    }

    return () => {
      setCallsHistoryFabOverride(null);
    };
  }, [
    fabBridgeActiveForCallHistory,
    setCallsHistoryFabOverride,
    callsDetailsFabFormConfig,
    callsDetailsFabSurface,
    shouldPublishCallsDetailsFab,
    callsContactSubdrawerOpen,
    callsDrawerTabletLayout,
  ]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const renderCallsMainDetailsBody = () => {
    if (selectedCallsHouseholderDetails) {
      return (
        <HouseholderDetails
          householder={selectedCallsHouseholderDetails.householder}
          visits={selectedCallsHouseholderDetails.visits}
          establishment={selectedCallsHouseholderDetails.establishment ?? null}
          establishments={
            selectedCallsHouseholderDetails.establishment
              ? [selectedCallsHouseholderDetails.establishment]
              : []
          }
          isLoading={isLoadingCallsDetails}
          onBackClick={() => setCallsDetailsDrawerOpen(false)}
          onRequestSummaryEdit={
            callsDrawerTabletLayout ? openCallsMainSummaryEditor : undefined
          }
          preferLeftDetailPanel={callsDrawerTabletLayout}
        />
      );
    }
    if (selectedCallsEstablishmentDetails) {
      return (
        <EstablishmentDetails
          establishment={selectedCallsEstablishmentDetails.establishment}
          visits={selectedCallsEstablishmentDetails.visits}
          householders={selectedCallsEstablishmentDetails.householders}
          isLoading={isLoadingCallsDetails}
          onBackClick={() => setCallsDetailsDrawerOpen(false)}
          onHouseholderClick={openCallsContactSubdrawer}
          onRequestSummaryEdit={
            callsDrawerTabletLayout ? openCallsMainSummaryEditor : undefined
          }
          preferLeftDetailPanel={callsDrawerTabletLayout}
        />
      );
    }
    return null;
  };

  const renderCallsContactSubdrawerBody = () => {
    if (!selectedCallsContactDetails) return null;
    return (
      <HouseholderDetails
        householder={selectedCallsContactDetails.householder}
        visits={selectedCallsContactDetails.visits}
        establishment={selectedCallsContactDetails.establishment ?? null}
        establishments={
          selectedCallsContactDetails.establishment
            ? [selectedCallsContactDetails.establishment]
            : []
        }
        isLoading={isLoadingCallsContactDetails}
        onBackClick={closeCallsContactSubdrawer}
        onRequestSummaryEdit={
          callsDrawerTabletLayout ? openCallsContactSummaryEditor : undefined
        }
        preferLeftDetailPanel={callsDrawerTabletLayout}
        insideStackedContactPane={callsDrawerTabletLayout}
      />
    );
  };

  const renderVisitRow = (item: CallsStreamItem, index: number, total: number, isDrawer: boolean) => {
    if (item.kind === "todo") {
      const todo = item.todo;
      const isHouseholderTodo = !!todo.householder_id;
      const primaryLabel =
        todo.context_name ||
        (isHouseholderTodo ? "Contact To-Do" : "Establishment To-Do");
      const primaryStatus = isHouseholderTodo
        ? todo.context_status || "potential"
        : todo.context_establishment_status || todo.context_status || "for_scouting";
      const hasEstablishmentBadge =
        isHouseholderTodo && Boolean(todo.context_establishment_name);
      const areaLabel = todo.context_area?.trim() ?? "";
      const displayDate = getTodoDisplayDate(todo);
      const publisherOption = todo.publisher_id ? assigneeById.get(todo.publisher_id) : undefined;
      const partnerOption = todo.partner_id ? assigneeById.get(todo.partner_id) : undefined;

      return (
        <VisitTimelineRow
          onClick={() => openCallsDetailsDrawer({ kind: "todo", todo })}
          index={index}
          total={total}
          rootClassName="rounded-md dark:bg-transparent hover:opacity-80 transition-opacity"
          lineStyle={{
            ...getTimelineLineStyle(isDrawer),
            left: 11,
          }}
          dot={
            <div
              className={cn(
                "w-6 h-6 rounded-full border relative z-0 flex-shrink-0 flex items-center justify-center",
                getSelectedStatusColor(primaryStatus)
              )}
            >
              <ListTodo className="h-3.5 w-3.5" aria-hidden />
            </div>
          }
          contentClassName="ml-3"
          avatarClassName="ml-4"
          avatar={
            <VisitAvatars
              publisher={
                publisherOption
                  ? {
                      first_name: publisherOption.first_name,
                      last_name: publisherOption.last_name,
                      avatar_url: publisherOption.avatar_url,
                    }
                  : null
              }
              partner={
                partnerOption
                  ? {
                      first_name: partnerOption.first_name,
                      last_name: partnerOption.last_name,
                      avatar_url: partnerOption.avatar_url,
                    }
                  : null
              }
              publisherGuestName={todo.publisher_guest_name ?? null}
              partnerGuestName={todo.partner_guest_name ?? null}
              sizeClassName="h-5 w-5"
              textClassName="text-[10px]"
            />
          }
          avatarFooter={
            <div className="flex flex-col items-end gap-1 text-right max-w-[10rem]">
              {displayDate ? (
                <span className={cn("text-xs text-muted-foreground tabular-nums leading-tight", studyBibleDarkClasses.callsMuted)}>
                  {formatVisitDateCompact(displayDate)}
                </span>
              ) : null}
              {areaLabel ? (
                <span
                  className={cn("text-xs text-muted-foreground leading-snug break-words", studyBibleDarkClasses.callsMuted)}
                  title={areaLabel}
                >
                  {areaLabel}
                </span>
              ) : null}
            </div>
          }
        >
          <VisitRowContent
            title={
              <span
                className={cn(
                  "inline-flex min-w-0 items-center",
                  hasEstablishmentBadge ? "max-w-[50%] min-w-0 shrink" : "min-w-0 flex-1"
                )}
              >
                <VisitStatusBadge
                  status={primaryStatus}
                  label={primaryLabel}
                  className="truncate max-w-full min-w-0 whitespace-nowrap"
                />
              </span>
            }
            titleBadge={
              hasEstablishmentBadge ? (
                <span className="min-w-0 flex-1 overflow-hidden">
                  <VisitStatusBadge
                    status={todo.context_establishment_status || "for_scouting"}
                    label={todo.context_establishment_name!}
                    className="w-fit max-w-full min-w-0 truncate whitespace-nowrap"
                  />
                </span>
              ) : undefined
            }
            notes={todo.body}
            notesClassName={
              cn(
                isDrawer ? "leading-relaxed line-clamp-4" : "mt-0 line-clamp-2",
                "dark:font-medium",
                studyBibleDarkClasses.callsText
              )
            }
          />
        </VisitTimelineRow>
      );
    }
    const visit = item.visit;
    const isHouseholderVisit = visit.visit_type === "householder";
    const primaryLabel = (isHouseholderVisit ? visit.householder_name : visit.establishment_name) || "Unknown";
    const primaryStatus = isHouseholderVisit
      ? visit.householder_status || "potential"
      : visit.establishment_status || "for_scouting";

    const hasEstablishmentBadge =
      visit.visit_type === "householder" && Boolean(visit.establishment_name);
    const areaLabel = visit.establishment_area?.trim() ?? "";

    return (
      <VisitTimelineRow
        onClick={() => openCallsDetailsDrawer({ kind: "visit", visit })}
        index={index}
        total={total}
        rootClassName="rounded-md dark:bg-transparent hover:opacity-80 transition-opacity"
        lineStyle={{
          ...getTimelineLineStyle(isDrawer),
          // Center the vertical timeline line with the 24px icon marker.
          left: 11,
        }}
        dot={
          <div
            className={cn(
              "w-6 h-6 rounded-full border relative z-0 flex-shrink-0 flex items-center justify-center",
              getSelectedStatusColor(primaryStatus)
            )}
          >
            {isHouseholderVisit ? (
              <UserRound className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Building2 className="h-3.5 w-3.5" aria-hidden />
            )}
          </div>
        }
        contentClassName="ml-3"
        avatarClassName="ml-4"
        avatar={
          <VisitAvatars
            publisher={visit.publisher ?? null}
            partner={visit.partner ?? null}
            publisherGuestName={visit.publisher_guest_name ?? null}
            partnerGuestName={visit.partner_guest_name ?? null}
            sizeClassName="h-5 w-5"
            textClassName="text-[10px]"
          />
        }
        avatarFooter={
          <div className="flex flex-col items-end gap-1 text-right max-w-[10rem]">
            <span className={cn("text-xs text-muted-foreground tabular-nums leading-tight", studyBibleDarkClasses.callsMuted)}>
              {formatVisitDateCompact(visit.visit_date)}
            </span>
            {areaLabel ? (
              <span
                className={cn("text-xs text-muted-foreground leading-snug break-words", studyBibleDarkClasses.callsMuted)}
                title={areaLabel}
              >
                {areaLabel}
              </span>
            ) : null}
          </div>
        }
      >
        <VisitRowContent
          title={
            <span
              className={cn(
                "inline-flex min-w-0 items-center",
                hasEstablishmentBadge ? "max-w-[50%] min-w-0 shrink" : "min-w-0 flex-1"
              )}
            >
              <VisitStatusBadge
                status={primaryStatus}
                label={primaryLabel}
                className="truncate max-w-full min-w-0 whitespace-nowrap"
              />
            </span>
          }
          titleBadge={
            hasEstablishmentBadge ? (
              <span className="min-w-0 flex-1 overflow-hidden">
                <VisitStatusBadge
                  status={visit.establishment_status || "for_scouting"}
                  label={visit.establishment_name!}
                  className="w-fit max-w-full min-w-0 truncate whitespace-nowrap border-muted bg-muted/50"
                />
              </span>
            ) : undefined
          }
          notes={visit.notes}
          notesClassName={
            cn(
              isDrawer ? "leading-relaxed line-clamp-4" : "mt-0 line-clamp-2",
              "dark:font-medium",
              studyBibleDarkClasses.callsText
            )
          }
        />
      </VisitTimelineRow>
    );
  };

  const renderAnimatedCallsList = (items: CallsStreamItem[]) => (
    <motion.div
      className="space-y-4"
      layout={!isTyping}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {items.map((item, index) => (
          <motion.div
            key={item.key}
            layout={!isTyping}
            initial={false}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{
              duration: 0.3,
              ease: [0.4, 0, 0.2, 1],
              layout: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
            }}
          >
            {renderVisitRow(item, index, items.length, true)}
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );

  // Auto-focus search input when search becomes active (only once, and only if not already focused)
  // This effect should NOT run when user is typing to prevent focus disruption
  useEffect(() => {
    // Don't run if user is actively typing
    if (isTypingRef.current) {
      return;
    }
    
    if (isSearchExpanded && searchInputRef.current && !hasFocusedRef.current) {
      // Only focus if the input is not already focused
      const timer = setTimeout(() => {
        // Double-check that user is not typing and input is not already focused
        if (!isTypingRef.current && 
            searchInputRef.current && 
            document.activeElement !== searchInputRef.current &&
            !searchInputRef.current.matches(':focus-within')) {
          searchInputRef.current.focus();
          hasFocusedRef.current = true;
        }
      }, 200);
      return () => clearTimeout(timer);
    }
    if (!isSearchExpanded) {
      hasFocusedRef.current = false;
    }
  }, [isSearchExpanded]);

  // Keep filters.search empty so hook doesn't filter by search (client-side only).
  useEffect(() => {
    if (
      filters.search &&
      filters.search.trim() !== "" &&
      (!localSearchValue || localSearchValue.trim() === "")
    ) {
      clearSearch();
    }
  }, [filters.search, localSearchValue, clearSearch]);

  // Prevent drawer from receiving focus during typing
  // Use a more targeted approach that doesn't interfere with normal focus behavior
  useEffect(() => {
    if (!isTypingRef.current) return;
    
    const input = searchInputRef.current;
    if (!input) return;
    
    // Only intervene if focus has moved away from input to drawer/body
    const checkFocus = () => {
      if (!isTypingRef.current || !input) return;
      
      const activeElement = document.activeElement;
      // If focus moved to body or drawer container, restore to input
      if (activeElement !== input && 
          (activeElement === document.body || 
           activeElement?.tagName === 'DIV' && 
           activeElement?.closest('[role="dialog"]'))) {
        // Restore focus to input
        const selectionStart = input.selectionStart;
        const selectionEnd = input.selectionEnd;
        input.focus();
        if (selectionStart !== null && selectionEnd !== null) {
          try {
            input.setSelectionRange(selectionStart, selectionEnd);
          } catch {
            // Ignore errors
          }
        }
      }
    };
    
    // Check focus after a short delay to catch focus shifts
    const timeoutId = setTimeout(checkFocus, 0);
    return () => clearTimeout(timeoutId);
  }, [localSearchValue]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    const timerBox = searchDebounceTimerRef;
    return () => {
      const pending = timerBox.current;
      if (pending) clearTimeout(pending);
    };
  }, []);

  useEffect(() => {
    const onVisitDeleted = (data: { id?: string }) => {
      const deletedId = data?.id;
      if (!deletedId) return;

      const applyFilter = (visits: VisitWithUser[]) => filterCallsDetailsVisitsDeleted(visits, deletedId);

      setSelectedCallsEstablishmentDetails((prev) => {
        if (!prev) return prev;
        const nextVisits = applyFilter(prev.visits);
        return nextVisits.length === prev.visits.length ? prev : { ...prev, visits: nextVisits };
      });
      setSelectedCallsHouseholderDetails((prev) => {
        if (!prev) return prev;
        const nextVisits = applyFilter(prev.visits);
        return nextVisits.length === prev.visits.length ? prev : { ...prev, visits: nextVisits };
      });
      setSelectedCallsContactDetails((prev) => {
        if (!prev) return prev;
        const nextVisits = applyFilter(prev.visits);
        return nextVisits.length === prev.visits.length ? prev : { ...prev, visits: nextVisits };
      });

      callsEstablishmentCacheRef.current.forEach((snap, key) => {
        const nextVisits = applyFilter(snap.visits);
        if (nextVisits.length !== snap.visits.length) {
          callsEstablishmentCacheRef.current.set(key, { ...snap, visits: nextVisits });
        }
      });
      callsHouseholderCacheRef.current.forEach((snap, key) => {
        const nextVisits = applyFilter(snap.visits);
        if (nextVisits.length !== snap.visits.length) {
          callsHouseholderCacheRef.current.set(key, { ...snap, visits: nextVisits });
        }
      });
    };

    const onVisitUpdated = (payload: VisitUpdatedPayload) => {
      if (!payload?.id) return;
      const merge = (visits: VisitWithUser[]) => mergeVisitUpdatedIntoList(visits, payload);

      setSelectedCallsEstablishmentDetails((prev) =>
        prev ? { ...prev, visits: merge(prev.visits) } : prev
      );
      setSelectedCallsHouseholderDetails((prev) =>
        prev ? { ...prev, visits: merge(prev.visits) } : prev
      );
      setSelectedCallsContactDetails((prev) =>
        prev ? { ...prev, visits: merge(prev.visits) } : prev
      );

      callsEstablishmentCacheRef.current.forEach((snap, key) => {
        callsEstablishmentCacheRef.current.set(key, { ...snap, visits: merge(snap.visits) });
      });
      callsHouseholderCacheRef.current.forEach((snap, key) => {
        callsHouseholderCacheRef.current.set(key, { ...snap, visits: merge(snap.visits) });
      });
    };

    businessEventBus.subscribe("visit-deleted", onVisitDeleted);
    businessEventBus.subscribe("visit-updated", onVisitUpdated);
    return () => {
      businessEventBus.unsubscribe("visit-deleted", onVisitDeleted);
      businessEventBus.unsubscribe("visit-updated", onVisitUpdated);
    };
  }, []);

  const renderBwiSummaryContent = () => (
    <div className="space-y-6">
      {/* Establishment Status Section */}
      <div>
        <div className={cn("grid grid-cols-2 gap-4", presentation === "summary" ? "items-center text-center" : "items-end")}>
          <BwiStatusCell
            onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("establishments", "for_replenishment") : undefined}
            className={presentation === "summary" ? "text-center" : undefined}
          >
            <div
              className={cn(
                "leading-tight",
                presentation === "summary" ? "text-6xl font-bold" : "text-5xl font-semibold",
                getStatusTextColorClass("for_replenishment")
              )}
            >
              <NumberFlow value={establishmentStatusCounts.for_replenishment} locales="en-US" format={{ useGrouping: false }} />
            </div>
            <div className={cn("mt-1 text-sm opacity-80 dark:opacity-100", studyBibleDarkClasses.muted)}>For Replenishment</div>
          </BwiStatusCell>
          <BwiStatusCell
            onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("establishments", "accepted_rack") : undefined}
            className={presentation === "summary" ? "text-center" : undefined}
          >
            <div className={cn(presentation === "summary" ? "text-5xl font-bold leading-tight" : "text-2xl font-semibold", getStatusTextColorClass("accepted_rack"))}>
              <NumberFlow value={establishmentStatusCounts.accepted_rack} locales="en-US" format={{ useGrouping: false }} />
            </div>
            <div className={cn("text-sm opacity-80 mt-0.5 dark:opacity-100", studyBibleDarkClasses.muted)}>Rack Accepted</div>
          </BwiStatusCell>

          <BwiStatusCell
            onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("establishments", "for_follow_up") : undefined}
            className={presentation === "summary" ? "text-center" : undefined}
          >
            <div className={cn(presentation === "summary" ? "text-5xl font-bold leading-tight" : "text-2xl font-semibold", getStatusTextColorClass("for_follow_up"))}>
              <NumberFlow value={establishmentStatusCounts.for_follow_up} locales="en-US" format={{ useGrouping: false }} />
            </div>
            <div className={cn("text-sm opacity-80 mt-0.5 dark:opacity-100", studyBibleDarkClasses.muted)}>For Follow Up</div>
          </BwiStatusCell>
          <BwiStatusCell
            onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("establishments", "for_scouting") : undefined}
            className={presentation === "summary" ? "text-center" : undefined}
          >
            <div className={cn(presentation === "summary" ? "text-5xl font-bold leading-tight" : "text-2xl font-semibold", getStatusTextColorClass("for_scouting"))}>
              <NumberFlow value={establishmentStatusCounts.for_scouting} locales="en-US" format={{ useGrouping: false }} />
            </div>
            <div className={cn("text-sm opacity-80 mt-0.5 dark:opacity-100", studyBibleDarkClasses.muted)}>For Scouting</div>
          </BwiStatusCell>
        </div>
      </div>

      {/* Householder Status Section */}
      <div className={cn("pt-4 border-t pb-0", studyBibleDarkClasses.divider)}>
        <div className={cn("text-xs text-muted-foreground mb-4", presentation === "summary" && "text-center", studyBibleDarkClasses.muted)}>Householder</div>

        <div className={cn("grid grid-cols-2 gap-4", presentation === "summary" ? "items-center text-center" : "items-end")}>
          <BwiStatusCell
            onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("householders", "bible_study") : undefined}
            className={presentation === "summary" ? "text-center" : undefined}
          >
            <div className={cn(presentation === "summary" ? "text-5xl font-bold leading-tight" : "text-5xl font-semibold leading-tight", getStatusTextColorClass("bible_study"))}>
              <NumberFlow value={householderStatusCounts.bible_study} locales="en-US" format={{ useGrouping: false }} />
            </div>
            <div className={cn("mt-1 text-sm opacity-80 dark:opacity-100", studyBibleDarkClasses.muted)}>Bible Study</div>
          </BwiStatusCell>
          <BwiStatusCell
            onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("householders", "return_visit") : undefined}
            className={presentation === "summary" ? "text-center" : undefined}
          >
            <div className={cn(presentation === "summary" ? "text-5xl font-bold leading-tight" : "text-2xl font-semibold", getStatusTextColorClass("return_visit"))}>
              <NumberFlow value={householderStatusCounts.return_visit} locales="en-US" format={{ useGrouping: false }} />
            </div>
            <div className={cn("text-sm opacity-80 mt-0.5 dark:opacity-100", studyBibleDarkClasses.muted)}>Return Visit</div>
          </BwiStatusCell>
          <BwiStatusCell
            onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("householders", "interested") : undefined}
            className={presentation === "summary" ? "text-center" : undefined}
          >
            <div className={cn(presentation === "summary" ? "text-5xl font-bold leading-tight" : "text-2xl font-semibold", getStatusTextColorClass("interested"))}>
              <NumberFlow value={householderStatusCounts.interested} locales="en-US" format={{ useGrouping: false }} />
            </div>
            <div className={cn("text-sm opacity-80 mt-0.5 dark:opacity-100", studyBibleDarkClasses.muted)}>Interested</div>
          </BwiStatusCell>
          <BwiStatusCell
            onClick={onNavigateToBusinessWithStatus ? () => navigateWithBwiArea("householders", "potential") : undefined}
            className={presentation === "summary" ? "text-center" : undefined}
          >
            <div className={cn(presentation === "summary" ? "text-5xl font-bold leading-tight" : "text-2xl font-semibold", getStatusTextColorClass("potential"))}>
              <NumberFlow value={householderStatusCounts.potential} locales="en-US" format={{ useGrouping: false }} />
            </div>
            <div className={cn("text-sm opacity-80 mt-0.5 dark:opacity-100", studyBibleDarkClasses.muted)}>Potential</div>
          </BwiStatusCell>
        </div>
      </div>
    </div>
  );

  const renderCallsPreviewContent = () => (
    loading ? (
      <div className="text-sm text-muted-foreground">Loading…</div>
    ) : (
      <div className="relative">
        <VisitList
          items={buildCallsStreamItems.preview}
          getKey={(item) => item.key}
          renderItem={(item, index, total) => renderVisitRow(item, index, total, false)}
          className="space-y-6"
          isEmpty={buildCallsStreamItems.preview.length === 0}
          emptyText="No calls or to-dos recorded yet."
                  emptyClassName={cn("text-sm text-muted-foreground", studyBibleDarkClasses.callsMuted)}
        />
      </div>
    )
  );

  return (
    <>
      <div
        className={cn(
          "rounded-lg border overflow-hidden bg-background",
          presentation === "calls" ? studyBibleDarkClasses.callsCard : studyBibleDarkClasses.bwiCard,
          className
        )}
      >
        {presentation === "summary" ? (
          <div className="flex h-full min-h-0 flex-col">
            <button
              type="button"
              onClick={() => setShowAreaDrawer(true)}
              className={cn(
                "flex h-10 shrink-0 items-center justify-center gap-2 border-b px-4 text-sm font-medium hover:bg-muted/50",
                studyBibleDarkClasses.header
              )}
            >
              <Building2 className="h-4 w-4 shrink-0" />
              <span>{bwiAreaLabel}</span>
              <ChevronRight className="h-4 w-4 opacity-70" />
            </button>
            <div className="min-h-0 overflow-y-auto p-4 scrollbar-hide">
              {renderBwiSummaryContent()}
            </div>
          </div>
        ) : presentation === "calls" ? (
          <div className="flex h-full min-h-0 flex-col">
            <button
              type="button"
              onClick={() => setShowDrawer(true)}
              className={cn(
                "flex h-10 shrink-0 items-center gap-2 border-b px-4 text-sm font-medium hover:bg-muted/50",
                studyBibleDarkClasses.callsHeader
              )}
            >
              <KnockingDoorIcon />
              <span>Calls</span>
              <ChevronRight className="ml-auto h-4 w-4 opacity-70" />
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-hide">
              {renderCallsPreviewContent()}
            </div>
          </div>
        ) : (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-0 -mb-px p-0 h-auto bg-transparent gap-0 border-0 [&>*]:border-0 relative z-10">
            <TabsTrigger 
              value="bwi"
              onPointerDown={handleBwiPointerDown}
              onClick={handleBwiTabClick}
              className={cn(
                "rounded-tl-lg rounded-tr-none rounded-bl-none rounded-br-none",
                "bg-primary text-primary-foreground dark:text-primary-foreground font-medium",
                "data-[state=active]:!bg-background data-[state=active]:!text-foreground",
                "dark:bg-[#2a2534] dark:text-[#ded6e7] dark:data-[state=active]:!bg-[#30283c] dark:data-[state=active]:!text-white",
                "shadow-none",
                "relative h-10 px-4",
                "transition-all duration-200",
                "hover:bg-primary/90 data-[state=active]:hover:!bg-background",
                "dark:hover:bg-[#342a43] dark:data-[state=active]:hover:!bg-[#30283c]",
                "!border-0 focus-visible:ring-0 focus-visible:outline-none",
                "[&>svg]:text-primary-foreground data-[state=active]:[&>svg]:text-foreground",
                "dark:[&>svg]:text-[#ded6e7] dark:data-[state=active]:[&>svg]:text-white",
                "after:hidden"
              )}
            >
              <motion.div
                layout="position"
                transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
                className="inline-flex items-center gap-1.5 shrink-0 grow-0"
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <span>
                  {bwiLabelFlash ? "BWI" : bwiAreaLabel}
                </span>
              </motion.div>
            </TabsTrigger>
            <TabsTrigger 
              value="visit-history"
              onPointerDown={handleCallHistoryPointerDown}
              onClick={handleCallHistoryTabClick}
              className={cn(
                "rounded-tr-lg rounded-tl-none rounded-bl-none rounded-br-none",
                "bg-primary text-primary-foreground dark:text-primary-foreground font-medium",
                "data-[state=active]:!bg-background data-[state=active]:!text-foreground",
                "dark:bg-[#2a2534] dark:text-[#ded6e7] dark:data-[state=active]:!bg-[#30283c] dark:data-[state=active]:!text-white",
                "shadow-none",
                "relative h-10 px-4",
                "transition-all duration-200",
                "hover:bg-primary/90 data-[state=active]:hover:!bg-background",
                "dark:hover:bg-[#342a43] dark:data-[state=active]:hover:!bg-[#30283c]",
                "!border-0 focus-visible:ring-0 focus-visible:outline-none",
                "[&>svg]:text-primary-foreground data-[state=active]:[&>svg]:text-foreground",
                "dark:[&>svg]:text-[#ded6e7] dark:data-[state=active]:[&>svg]:text-white",
                "after:hidden"
              )}
            >
              <KnockingDoorIcon />
              <span>Calls</span>
              {activeTab === "visit-history" ? (
                <ChevronRight className="h-4 w-4 opacity-70" />
              ) : null}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent
            value="bwi"
            className={cn(
              "mt-0 rounded-b-lg bg-background p-4 overflow-y-auto scrollbar-hide",
              studyBibleDarkClasses.bwiCard
            )}
          >
            {renderBwiSummaryContent()}
          </TabsContent>
          
          <TabsContent
            value="visit-history"
            className={cn(
              "mt-0 rounded-b-lg bg-background p-4",
              studyBibleDarkClasses.bwiCard
            )}
          >
            {renderCallsPreviewContent()}
          </TabsContent>
        </Tabs>
        )}
      </div>

      {/* Drawer: full calls list (matches To-Do drawer on tablet; two columns on md+) */}
      <Drawer
        open={showDrawer}
        onOpenChange={(open) => {
          setShowDrawer(open);
          if (!open) setShowFiltersDrawer(false);
        }}
      >
        <DrawerContent
          className="h-[85svh] max-h-[85svh] md:h-[92dvh] md:max-h-[92dvh] dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff] [&_.drawer-content-inner]:flex [&_.drawer-content-inner]:flex-col [&_.drawer-content-inner]:overflow-hidden"
          handleClassName="dark:bg-[#80778e] dark:shadow-[0_0_18px_rgba(128,119,142,0.45)]"
        >
          <DrawerHeader className="px-4 pt-4 pb-2 items-center shrink-0 dark:bg-[#181714]">
            <DrawerTitle className="flex w-full flex-wrap items-center justify-center gap-2 text-center text-lg font-bold">
              <KnockingDoorIcon />
              Calls
              {hasVisitFiltersApplied ? (
                <Badge variant="secondary" className="font-normal tabular-nums text-xs">
                  {buildCallsStreamItems.drawer.length}{" "}
                  {buildCallsStreamItems.drawer.length === 1 ? "item" : "items"}
                </Badge>
              ) : null}
            </DrawerTitle>
          </DrawerHeader>

          <div className="flex min-h-0 flex-1 flex-col px-4 dark:bg-[#181714]">
            <div
              className={cn(
                "mb-4 w-full flex shrink-0",
                isSearchExpanded ? "justify-start" : "justify-center"
              )}
            >
              <FilterControls
                isSearchActive={isSearchExpanded}
                searchValue={localSearchValue}
                searchInputRef={searchInputRef}
                onSearchActivate={() => {
                  setIsSearchActive(true);
                  hasFocusedRef.current = false;
                }}
                onSearchChange={(value) => {
                  isTypingRef.current = true;
                  setLocalSearchValue(value);
                  setTimeout(() => {
                    isTypingRef.current = false;
                  }, 500);
                }}
                onSearchClear={() => {
                  setLocalSearchValue("");
                  clearSearch();
                  setIsSearchActive(false);
                  hasFocusedRef.current = false;
                  isTypingRef.current = false;
                }}
                onSearchBlur={() => {
                  isTypingRef.current = false;
                  setIsTyping(false);
                  if (!localSearchValue || localSearchValue.trim() === "") {
                    setIsSearchActive(false);
                    hasFocusedRef.current = false;
                  }
                }}
                myActive={filters.myUpdatesOnly}
                myLabel="My Visits"
                onMyActivate={() => setFilters((prev) => ({ ...prev, myUpdatesOnly: true }))}
                onMyClear={() => setFilters((prev) => ({ ...prev, myUpdatesOnly: false }))}
                bwiActive={filters.bwiOnly}
                bwiLabel="BWI Only"
                onBwiActivate={() =>
                  setFilters((prev) => ({ ...prev, bwiOnly: true, householderOnly: false }))
                }
                onBwiClear={() => setFilters((prev) => ({ ...prev, bwiOnly: false }))}
                householderActive={filters.householderOnly}
                householderLabel="Personal Contacts Only"
                onHouseholderActivate={() =>
                  setFilters((prev) => ({ ...prev, householderOnly: true, bwiOnly: false }))
                }
                onHouseholderClear={() => setFilters((prev) => ({ ...prev, householderOnly: false }))}
                filterBadges={filterBadges}
                onOpenFilters={() => setShowFiltersDrawer(true)}
                onClearFilters={clearFilters}
                onRemoveBadge={(badge) => {
                  if (badge.type === "status") {
                    setFilters((prev) => ({
                      ...prev,
                      statuses: prev.statuses.filter((s) => s !== badge.value),
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
                  } else if (badge.type === "call_date") {
                    setFilters((prev) => ({ ...prev, callDateFrom: null, callDateTo: null }));
                  }
                }}
                containerClassName={isSearchExpanded ? "w-full !max-w-none !px-0" : "justify-center"}
                maxWidthClassName={isSearchExpanded ? "" : "mx-4"}
              />
            </div>

            <div
              className={cn(
                "relative min-h-0 flex-1",
                callsDrawerTabletLayout
                  ? "overflow-hidden"
                  : "overflow-y-auto overscroll-contain pb-[calc(max(env(safe-area-inset-bottom),0px)+112px)]"
              )}
              tabIndex={-1}
              onFocus={(e) => {
                if (isTypingRef.current && searchInputRef.current && e.target === e.currentTarget) {
                  e.preventDefault();
                  e.stopPropagation();
                  setTimeout(() => {
                    if (searchInputRef.current && isTypingRef.current) {
                      const input = searchInputRef.current;
                      const selectionStart = input.selectionStart;
                      const selectionEnd = input.selectionEnd;
                      input.focus();
                      if (selectionStart !== null && selectionEnd !== null) {
                        try {
                          input.setSelectionRange(selectionStart, selectionEnd);
                        } catch {
                          // Ignore
                        }
                      }
                    }
                  }, 0);
                }
              }}
            >
              {callsDrawerTabletLayout ? (
                <div className="grid h-full min-h-0 gap-3 pb-2 md:grid-cols-2 md:items-stretch md:gap-3">
                  <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-muted/15 dark:border-[#1c1921] dark:bg-[#2a2534]">
                    <div className={cn("shrink-0 border-b border-border px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground dark:border-[#1c1921] dark:bg-[#30283c]", studyBibleDarkClasses.muted)}>
                      Establishments ({callsDrawerEstablishmentItems.length})
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-3 pb-[calc(max(env(safe-area-inset-bottom),0px)+88px)] dark:bg-[#2a2534]">
                      {callsDrawerEstablishmentItems.length === 0 ? (
                        <p className={cn("py-6 text-center text-sm text-muted-foreground", studyBibleDarkClasses.muted)}>
                          No establishment calls yet.
                        </p>
                      ) : (
                        renderAnimatedCallsList(callsDrawerEstablishmentItems)
                      )}
                    </div>
                  </div>
                  <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-muted/15 dark:border-[#1c1921] dark:bg-[#2a2534]">
                    <div className={cn("shrink-0 border-b border-border px-3 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground dark:border-[#1c1921] dark:bg-[#30283c]", studyBibleDarkClasses.muted)}>
                      Contacts ({callsDrawerContactItems.length})
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-3 pb-[calc(max(env(safe-area-inset-bottom),0px)+88px)] dark:bg-[#2a2534]">
                      {callsDrawerContactItems.length === 0 ? (
                        <p className={cn("py-6 text-center text-sm text-muted-foreground", studyBibleDarkClasses.muted)}>
                          No contact calls yet.
                        </p>
                      ) : (
                        renderAnimatedCallsList(callsDrawerContactItems)
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <motion.div
                  className="space-y-4"
                  layout={!isTyping}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                >
                  <AnimatePresence mode="popLayout" initial={false}>
                    {buildCallsStreamItems.drawer.map((item, index) => (
                      <motion.div
                        key={item.key}
                        layout={!isTyping}
                        initial={false}
                        animate={{ opacity: 1, height: "auto", y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -10 }}
                        transition={{
                          duration: 0.3,
                          ease: [0.4, 0, 0.2, 1],
                          layout: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
                        }}
                      >
                        {renderVisitRow(item, index, buildCallsStreamItems.drawer.length, true)}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}

              {loadingMore && (
                <div className="py-4 text-center">
                  <div className={cn("text-sm opacity-90", studyBibleDarkClasses.muted)}>Loading more visits...</div>
                </div>
              )}

              {hasMore && !loadingMore && (
                <Button variant="outline" size="sm" className="mt-2 w-full" onClick={loadMore}>
                  Load More
                </Button>
              )}

              {!callsDrawerTabletLayout && !hasMore && buildCallsStreamItems.drawer.length > 0 && (
                <div className="py-4 text-center">
                  <div className={cn("text-sm opacity-90", studyBibleDarkClasses.muted)}>
                    No more visits to load
                  </div>
                </div>
              )}

            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {callsDrawerTabletLayout ? (
        <Drawer
          open={callsDetailsDrawerOpen}
          onOpenChange={(open) => {
            setCallsDetailsDrawerOpen(open);
            if (!open) {
              setSelectedCallsEstablishmentDetails(null);
              setSelectedCallsHouseholderDetails(null);
              setCallsContactSubdrawerOpen(false);
              setSelectedCallsContactDetails(null);
              setCallsDetailsEntityEditOpen(false);
              setCallsContactSubdrawerEntityEditOpen(false);
            }
          }}
          direction="right"
          modal
          nested
          shouldScaleBackground={false}
        >
          <DrawerWideRightContent className="dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff]">
            <DrawerHeader className="border-b border-border px-4 pb-3 pt-4 text-left dark:border-[#1c1921] dark:bg-[#181714]">
              <DrawerTitle className="text-xl font-extrabold tracking-tight">{callsDetailsSheetTitle}</DrawerTitle>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2 space-y-3 dark:bg-[#181714]">
              {renderCallsMainDetailsBody()}
            </div>
          </DrawerWideRightContent>
        </Drawer>
      ) : (
        <Drawer
          open={callsDetailsDrawerOpen}
          onOpenChange={(open) => {
            setCallsDetailsDrawerOpen(open);
            if (!open) {
              setSelectedCallsEstablishmentDetails(null);
              setSelectedCallsHouseholderDetails(null);
              setCallsContactSubdrawerOpen(false);
              setSelectedCallsContactDetails(null);
              setCallsDetailsEntityEditOpen(false);
              setCallsContactSubdrawerEntityEditOpen(false);
            }
          }}
        >
          <DrawerContent
            className="max-h-[90vh] dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff]"
            handleClassName="dark:bg-[#80778e] dark:shadow-[0_0_18px_rgba(128,119,142,0.45)]"
          >
            <DrawerHeader className="sr-only">
              <DrawerTitle>Call details</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-3 dark:bg-[#181714]">
              {renderCallsMainDetailsBody()}
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {callsDrawerTabletLayout ? (
        <Drawer
          open={callsContactSubdrawerOpen && callsDetailsDrawerOpen}
          onOpenChange={(open) => {
            setCallsContactSubdrawerOpen(open);
            if (!open) {
              setSelectedCallsContactDetails(null);
              setCallsContactSubdrawerEntityEditOpen(false);
            }
          }}
          direction="right"
          modal
          shouldScaleBackground={false}
        >
          <DrawerWideRightContent
            stackAboveDetailsSheet
            className="dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff]"
          >
            <DrawerHeader className="border-b border-border px-2 pb-3 pt-4 text-left sm:px-4 dark:border-[#1c1921] dark:bg-[#181714]">
              <div className="flex items-center gap-1 pr-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={closeCallsContactSubdrawer}
                  aria-label="Back to establishment"
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <DrawerTitle className="text-xl font-extrabold tracking-tight">
                  {selectedCallsContactDetails?.householder.name ?? "Contact Details"}
                </DrawerTitle>
              </div>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2 space-y-3 dark:bg-[#181714]">
              {renderCallsContactSubdrawerBody()}
            </div>
          </DrawerWideRightContent>
        </Drawer>
      ) : (
        <Drawer
          open={callsContactSubdrawerOpen}
          onOpenChange={(open) => {
            setCallsContactSubdrawerOpen(open);
            if (!open) {
              setSelectedCallsContactDetails(null);
              setCallsContactSubdrawerEntityEditOpen(false);
            }
          }}
        >
          <DrawerContent
            className="max-h-[90vh] dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff]"
            handleClassName="dark:bg-[#80778e] dark:shadow-[0_0_18px_rgba(128,119,142,0.45)]"
          >
            <DrawerHeader className="sr-only">
              <DrawerTitle>Contact details</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-3 dark:bg-[#181714]">
              {renderCallsContactSubdrawerBody()}
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {callsDrawerTabletLayout ? (
        <Drawer
          open={callsDetailsEntityEditOpen || callsContactSubdrawerEntityEditOpen}
          onOpenChange={(open) => {
            if (!open) {
              setCallsDetailsEntityEditOpen(false);
              setCallsContactSubdrawerEntityEditOpen(false);
            }
          }}
          direction="left"
          modal
          shouldScaleBackground={false}
        >
          <DrawerWideLeftContentTop
            stackAboveStackedRightSheet={callsContactSubdrawerOpen && callsDrawerTabletLayout}
            className="dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff]"
          >
            <DrawerHeader className="border-b border-border px-4 pb-3 pt-4 text-left dark:border-[#1c1921] dark:bg-[#181714]">
              <DrawerTitle className="text-lg font-bold">
                {callsContactSubdrawerEntityEditOpen
                  ? "Edit Contact"
                  : selectedCallsHouseholderDetails
                    ? "Edit Contact"
                    : "Edit Establishment"}
              </DrawerTitle>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2 dark:bg-[#181714]">
              {callsContactSubdrawerEntityEditOpen && selectedCallsContactDetails?.householder.id ? (
                <HouseholderForm
                  key={selectedCallsContactDetails.householder.id}
                  establishments={
                    selectedCallsContactDetails.establishment?.id
                      ? [selectedCallsContactDetails.establishment as { id: string; name: string }]
                      : []
                  }
                  selectedEstablishmentId={selectedCallsContactDetails.establishment?.id ?? undefined}
                  isEditing
                  initialData={{
                    id: selectedCallsContactDetails.householder.id,
                    establishment_id: selectedCallsContactDetails.householder.establishment_id ?? null,
                    name: selectedCallsContactDetails.householder.name,
                    status:
                      (selectedCallsContactDetails.householder.status as HouseholderStatus) ?? "potential",
                    note: selectedCallsContactDetails.householder.note ?? null,
                    lat: selectedCallsContactDetails.householder.lat ?? null,
                    lng: selectedCallsContactDetails.householder.lng ?? null,
                    publisher_id: selectedCallsContactDetails.householder.publisher_id ?? null,
                  }}
                  disableEstablishmentSelect={!!selectedCallsContactDetails.establishment?.id}
                  onSaved={() => {
                    setCallsContactSubdrawerEntityEditOpen(false);
                    void refreshCallsContactSubdrawerAfterSave();
                  }}
                />
              ) : selectedCallsHouseholderDetails?.householder.id ? (
                <HouseholderForm
                  key={selectedCallsHouseholderDetails.householder.id}
                  establishments={
                    selectedCallsHouseholderDetails.establishment?.id
                      ? [selectedCallsHouseholderDetails.establishment as { id: string; name: string }]
                      : []
                  }
                  selectedEstablishmentId={selectedCallsHouseholderDetails.establishment?.id ?? undefined}
                  isEditing
                  initialData={{
                    id: selectedCallsHouseholderDetails.householder.id,
                    establishment_id: selectedCallsHouseholderDetails.householder.establishment_id ?? null,
                    name: selectedCallsHouseholderDetails.householder.name,
                    status:
                      (selectedCallsHouseholderDetails.householder.status as HouseholderStatus) ?? "potential",
                    note: selectedCallsHouseholderDetails.householder.note ?? null,
                    lat: selectedCallsHouseholderDetails.householder.lat ?? null,
                    lng: selectedCallsHouseholderDetails.householder.lng ?? null,
                    publisher_id: selectedCallsHouseholderDetails.householder.publisher_id ?? null,
                  }}
                  disableEstablishmentSelect={!!selectedCallsHouseholderDetails.establishment?.id}
                  onSaved={() => {
                    setCallsDetailsEntityEditOpen(false);
                    void refreshCallsMainDetailAfterSave();
                  }}
                />
              ) : selectedCallsEstablishmentDetails?.establishment.id ? (
                <EstablishmentForm
                  key={selectedCallsEstablishmentDetails.establishment.id}
                  isEditing
                  initialData={selectedCallsEstablishmentDetails.establishment}
                  selectedArea={selectedCallsEstablishmentDetails.establishment.area ?? undefined}
                  onSaved={() => {
                    setCallsDetailsEntityEditOpen(false);
                    void refreshCallsMainDetailAfterSave();
                  }}
                />
              ) : null}
            </div>
          </DrawerWideLeftContentTop>
        </Drawer>
      ) : null}

      {/* Calls filter drawer (matches Filter To-Dos sheet) */}
      <Drawer open={showFiltersDrawer} onOpenChange={setShowFiltersDrawer}>
        <DrawerContent
          className="max-h-[80vh] dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff]"
          handleClassName="dark:bg-[#80778e] dark:shadow-[0_0_18px_rgba(128,119,142,0.45)]"
        >
          <DrawerHeader className="px-4 pt-4 pb-2 items-center dark:bg-[#181714]">
            <DrawerTitle className="flex w-full items-center justify-center gap-2 text-center text-lg font-bold">
              <KnockingDoorIcon />
              Filter Calls
            </DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] dark:bg-[#181714]">
            {filterForm}
            <div className="flex justify-end pt-4">
              <Button type="button" variant="outline" onClick={() => setShowFiltersDrawer(false)}>
                Done
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Area picker drawer for BWI tab header */}
      <Drawer open={showAreaDrawer} onOpenChange={setShowAreaDrawer}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader className="px-4 pt-4 pb-2 items-center">
            <DrawerTitle className="flex w-full items-center justify-center gap-2 text-center text-lg font-bold">
              <Building2 className="h-5 w-5" />
              Select Area
            </DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 overflow-y-auto px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={bwiAreaFilter.length === 0 ? "default" : "outline"}
              size="sm"
              onClick={() => {
                onBwiAreaChange([]);
              }}
              className="h-8"
            >
              All
            </Button>
            {bwiAreasSorted.map((area) => (
              <Button
                key={area}
                type="button"
                variant={bwiAreaFilter.includes(area) ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  onBwiAreaChange(
                    bwiAreaFilter.includes(area)
                      ? bwiAreaFilter.filter((value) => value !== area)
                      : [...bwiAreaFilter, area]
                  );
                }}
                className="h-8"
              >
                {area}
              </Button>
            ))}
          </div>
          {bwiAreasSorted.length === 0 ? (
            <div className="text-sm text-muted-foreground">No areas available.</div>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onBwiAreaChange([])}
            >
              Clear
            </Button>
            <Button
              type="button"
              onClick={() => setShowAreaDrawer(false)}
            >
              Done
            </Button>
          </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
