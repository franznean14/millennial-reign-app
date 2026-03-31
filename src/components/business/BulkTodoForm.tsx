"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "@/components/ui/sonner";
import { ChevronDown, ChevronUp, Plus, Search, Trash2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import {
  addStandaloneTodo,
  deleteCallTodo,
  getBwiParticipants,
  getDistinctCallGuestNames,
  updateCallTodo,
  updateTodoForBulkEdit,
  type EstablishmentWithDetails,
  type HouseholderWithDetails,
} from "@/lib/db/business";
import { getInitialsFromName } from "@/lib/utils/visit-history-ui";
import { getBestStatus, getStatusTitleColor } from "@/lib/utils/status-hierarchy";
import { formatStatusText } from "@/lib/utils/formatters";
import { VisitStatusBadge } from "@/components/visit/VisitStatusBadge";
import { FilterControls, type FilterBadge } from "@/components/shared/FilterControls";
import { VisitFiltersForm, type VisitFilters, type VisitFilterOption } from "@/components/visit/VisitFiltersForm";
import { buildFilterBadges } from "@/lib/utils/filter-badges";
import { useMobile } from "@/lib/hooks/use-mobile";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

type BulkTodoDraftRow = {
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

interface BulkTodoFormProps {
  establishments: EstablishmentWithDetails[];
  householders: HouseholderWithDetails[];
  onSaved: () => void;
  onDraftKindChange?: (kind: "new" | "edit" | "mixed") => void;
}

type PersonAvatar = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
};

type TargetLatestInsight = {
  atMs: number;
  text: string;
  avatars: PersonAvatar[];
  householderName?: string | null;
  householderStatus?: string | null;
  dateValue?: string | null;
  source: "call" | "todo";
};

type PendingTodoDisplay = {
  id: string;
  body: string;
  deadlineDate: string | null;
  createdAtMs: number;
  publisherId: string | null;
  partnerId: string | null;
  householderName?: string | null;
  householderStatus?: string | null;
};

type TargetOption = {
  key: string;
  label: string;
  typeLabel: "Establishment" | "Contact";
  subtitle: string;
  status?: string;
  avatars: PersonAvatar[];
  searchText: string;
};

type DuplicateAddPromptState = {
  sourceRowId: string;
  requestedTargetKeys: string[];
  duplicateTargetKeys: string[];
};

const DRAFT_STORAGE_KEY = "business:bulk-todos:draft:v1";
const PARTICIPANTS_CACHE_KEY = "business:participants:local:v1";
const GUEST_NAMES_CACHE_KEY = "business:guest-names:local:v1";
const TARGET_INSIGHTS_CACHE_KEY = "business:bulk-todos:target-insights:v1";
const TARGET_INSIGHTS_CACHE_MAX_AGE_MS = 15 * 60 * 1000;
const NEW_TODO_PICKER_ROW_ID = "__new-todo-picker__";
const GUEST_SLOT_PREFIX = "guest::";
const DEFAULT_TARGET_PICKER_FILTERS: VisitFilters = {
  search: "",
  statuses: [],
  areas: [],
  assigneeIds: [],
  myUpdatesOnly: false,
  bwiOnly: false,
  householderOnly: false,
};

const createDraftRow = (): BulkTodoDraftRow => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  targetKey: "none",
  body: "",
  slots: [],
  dueDate: null,
});

const toGuestSlotToken = (name: string): string => `${GUEST_SLOT_PREFIX}${name.trim()}`;
const isGuestSlotToken = (slot: string): boolean => slot.startsWith(GUEST_SLOT_PREFIX);
const getGuestNameFromSlot = (slot: string): string => (isGuestSlotToken(slot) ? slot.slice(GUEST_SLOT_PREFIX.length).trim() : "");

const parseDateString = (value: string | null): Date | undefined => {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
};

const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTodoDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const month = d.toLocaleDateString("en-US", { month: "short" });
  const day = d.getDate();
  const yearShort = String(d.getFullYear()).slice(-2);
  return `${month} ${day}, '${yearShort}`;
};

const getDateAgeColorClass = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "text-muted-foreground";
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return "text-muted-foreground";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dateStart = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
  const daysSince = (todayStart - dateStart) / (24 * 60 * 60 * 1000);

  if (daysSince <= 7) return "text-emerald-400 dark:text-emerald-300";
  if (daysSince <= 14) return "text-yellow-400 dark:text-yellow-300";
  if (daysSince <= 21) return "text-orange-400 dark:text-orange-300";
  return "text-red-400 dark:text-red-300";
};

const getStatusPriority = (status: string | null | undefined): number => {
  switch (status) {
    case "has_bible_studies":
    case "bible_study":
      return 1;
    case "personal_territory":
      return 2;
    case "for_replenishment":
      return 3;
    case "accepted_rack":
    case "interested":
      return 4;
    case "for_follow_up":
    case "return_visit":
      return 5;
    case "for_scouting":
    case "potential":
      return 6;
    case "rack_pulled_out":
      return 7;
    case "on_hold":
      return 8;
    case "closed":
      return 9;
    case "declined_rack":
    case "do_not_call":
      return 10;
    case "inappropriate":
      return 11;
    case "moved_branch":
      return 12;
    case "resigned":
      return 13;
    default:
      return 14;
  }
};

const getStatusDotColorClass = (status: string): string => {
  switch (status) {
    case "has_bible_studies":
    case "bible_study":
      return "bg-emerald-500";
    case "personal_territory":
      return "bg-pink-500";
    case "for_replenishment":
      return "bg-purple-500";
    case "accepted_rack":
    case "interested":
      return "bg-blue-500";
    case "for_follow_up":
    case "return_visit":
      return "bg-orange-500";
    case "for_scouting":
    case "potential":
      return "bg-cyan-500";
    case "rack_pulled_out":
      return "bg-amber-500";
    case "on_hold":
      return "bg-stone-500";
    case "closed":
      return "bg-slate-500";
    case "declined_rack":
    case "do_not_call":
      return "bg-red-500";
    case "inappropriate":
      return "bg-red-700";
    case "moved_branch":
    case "resigned":
      return "bg-stone-500";
    default:
      return "bg-gray-500";
  }
};

const getHouseholderStatusBadgeClass = (status: string) => {
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
};

export function BulkTodoForm({
  establishments,
  householders,
  onSaved,
  onDraftKindChange,
}: BulkTodoFormProps) {
  const isMobile = useMobile();
  const [rows, setRows] = useState<BulkTodoDraftRow[]>([]);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [participants, setParticipants] = useState<
    Array<{ id: string; first_name: string; last_name: string; avatar_url?: string }>
  >([]);
  const [latestInsightByTarget, setLatestInsightByTarget] = useState<Record<string, TargetLatestInsight>>({});
  const [pendingTodosByTarget, setPendingTodosByTarget] = useState<Record<string, PendingTodoDisplay[]>>({});
  const [collapsedByRow, setCollapsedByRow] = useState<Record<string, boolean>>({});
  const [targetPickerOpenByRow, setTargetPickerOpenByRow] = useState<Record<string, boolean>>({});
  const [targetSearchByRow, setTargetSearchByRow] = useState<Record<string, string>>({});
  const [targetSearchActiveByRow, setTargetSearchActiveByRow] = useState<Record<string, boolean>>({});
  const [targetFiltersPanelOpenByRow, setTargetFiltersPanelOpenByRow] = useState<Record<string, boolean>>({});
  const [targetFiltersByRow, setTargetFiltersByRow] = useState<Record<string, VisitFilters>>({});
  const [targetBulkAddModeByRow, setTargetBulkAddModeByRow] = useState<Record<string, boolean>>({});
  const [targetBulkSelectedKeysByRow, setTargetBulkSelectedKeysByRow] = useState<Record<string, string[]>>({});
  const [assigneeDrawerOpenByRow, setAssigneeDrawerOpenByRow] = useState<Record<string, boolean>>({});
  const [existingGuestNames, setExistingGuestNames] = useState<string[]>([]);
  const [newGuestNameByRow, setNewGuestNameByRow] = useState<Record<string, string>>({});
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [duplicateAddPrompt, setDuplicateAddPrompt] = useState<DuplicateAddPromptState | null>(null);
  const [insightRefreshKey, setInsightRefreshKey] = useState(0);
  const [deletingSourceTodoRowId, setDeletingSourceTodoRowId] = useState<string | null>(null);

  useEffect(() => {
    const loadParticipants = async () => {
      try {
        const cachedRaw = window.localStorage.getItem(PARTICIPANTS_CACHE_KEY);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as {
            items?: Array<{ id: string; first_name: string; last_name: string; avatar_url?: string }>;
          };
          if (Array.isArray(cached?.items) && cached.items.length > 0) {
            setParticipants(
              cached.items.filter(
                (item): item is { id: string; first_name: string; last_name: string; avatar_url?: string } =>
                  typeof item?.id === "string"
              )
            );
          }
        }
      } catch (error) {
        console.error("[BulkTodoForm] Failed to restore participants cache:", error);
      }

      try {
        const list = await getBwiParticipants();
        setParticipants(list);
        window.localStorage.setItem(PARTICIPANTS_CACHE_KEY, JSON.stringify({ items: list }));
      } catch (error) {
        console.error("[BulkTodoForm] Failed to load participants:", error);
      }
    };
    loadParticipants();
  }, []);

  useEffect(() => {
    const loadCachedGuestNames = () => {
      try {
        const raw = window.localStorage.getItem(GUEST_NAMES_CACHE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as { names?: string[] };
        if (!Array.isArray(parsed?.names)) return;
        const names = Array.from(
          new Set(
            parsed.names
              .map((value) => (typeof value === "string" ? value.trim() : ""))
              .filter((value) => value.length > 0)
          )
        );
        if (names.length > 0) {
          setExistingGuestNames(names);
        }
      } catch (error) {
        console.error("[BulkTodoForm] Failed to restore guest names cache:", error);
      }
    };
    loadCachedGuestNames();
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        rows?: Array<Partial<BulkTodoDraftRow> & Record<string, unknown>>;
        targetSearchByRow?: Record<string, string>;
        targetFiltersByRow?: Record<string, VisitFilters>;
      };
      if (Array.isArray(parsed?.rows) && parsed.rows.length > 0) {
        // Support migration from initial v1 structure.
        const migratedRows: BulkTodoDraftRow[] = parsed.rows.map((rawRow) => {
          const legacyTargetType = rawRow.targetType as "establishment" | "householder" | undefined;
          const legacyEstablishmentId = typeof rawRow.establishmentId === "string" ? rawRow.establishmentId : "none";
          const legacyHouseholderId = typeof rawRow.householderId === "string" ? rawRow.householderId : "none";
          const targetKey =
            typeof rawRow.targetKey === "string"
              ? rawRow.targetKey
              : legacyTargetType === "householder" && legacyHouseholderId !== "none"
                ? `householder:${legacyHouseholderId}`
                : legacyEstablishmentId !== "none"
                  ? `establishment:${legacyEstablishmentId}`
                  : "none";
          const slots = Array.isArray(rawRow.slots)
            ? rawRow.slots.filter((value): value is string => typeof value === "string").slice(0, 2)
            : [
                typeof rawRow.publisherId === "string" && rawRow.publisherId !== "none" ? rawRow.publisherId : null,
                typeof rawRow.partnerId === "string" && rawRow.partnerId !== "none" ? rawRow.partnerId : null,
              ].filter((value): value is string => !!value);

          return {
            id: typeof rawRow.id === "string" ? rawRow.id : createDraftRow().id,
            targetKey,
            body: typeof rawRow.body === "string" ? rawRow.body : "",
            slots,
            dueDate: typeof rawRow.dueDate === "string" ? rawRow.dueDate : null,
            sourceTodoId: typeof rawRow.sourceTodoId === "string" ? rawRow.sourceTodoId : null,
            sourceCallId: typeof rawRow.sourceCallId === "string" ? rawRow.sourceCallId : null,
            original:
              rawRow.original && typeof rawRow.original === "object"
                ? {
                    targetKey:
                      typeof (rawRow.original as Record<string, unknown>).targetKey === "string"
                        ? ((rawRow.original as Record<string, unknown>).targetKey as string)
                        : targetKey,
                    body:
                      typeof (rawRow.original as Record<string, unknown>).body === "string"
                        ? ((rawRow.original as Record<string, unknown>).body as string)
                        : (typeof rawRow.body === "string" ? rawRow.body : ""),
                    slots: Array.isArray((rawRow.original as Record<string, unknown>).slots)
                      ? ((rawRow.original as Record<string, unknown>).slots as unknown[])
                          .filter((value): value is string => typeof value === "string")
                          .slice(0, 2)
                      : slots,
                    dueDate:
                      typeof (rawRow.original as Record<string, unknown>).dueDate === "string"
                        ? ((rawRow.original as Record<string, unknown>).dueDate as string)
                        : (typeof rawRow.dueDate === "string" ? rawRow.dueDate : null),
                  }
                : undefined,
          };
        });
        setRows(migratedRows);
      }
      if (parsed?.targetSearchByRow && typeof parsed.targetSearchByRow === "object") {
        const nextSearchByRow: Record<string, string> = {};
        Object.entries(parsed.targetSearchByRow).forEach(([key, value]) => {
          if (typeof value === "string") nextSearchByRow[key] = value;
        });
        setTargetSearchByRow(nextSearchByRow);
      }
      if (parsed?.targetFiltersByRow && typeof parsed.targetFiltersByRow === "object") {
        const nextFiltersByRow: Record<string, VisitFilters> = {};
        Object.entries(parsed.targetFiltersByRow).forEach(([key, value]) => {
          if (!value || typeof value !== "object") return;
          const rawFilters = value as Partial<VisitFilters>;
          nextFiltersByRow[key] = {
            search: typeof rawFilters.search === "string" ? rawFilters.search : "",
            statuses: Array.isArray(rawFilters.statuses)
              ? rawFilters.statuses.filter((item): item is string => typeof item === "string")
              : [],
            areas: Array.isArray(rawFilters.areas)
              ? rawFilters.areas.filter((item): item is string => typeof item === "string")
              : [],
            assigneeIds: Array.isArray(rawFilters.assigneeIds)
              ? rawFilters.assigneeIds.filter((item): item is string => typeof item === "string")
              : [],
            myUpdatesOnly: false,
            bwiOnly: !!rawFilters.bwiOnly,
            householderOnly: !!rawFilters.householderOnly,
          };
        });
        setTargetFiltersByRow(nextFiltersByRow);
      }
    } catch (error) {
      console.error("[BulkTodoForm] Failed to restore draft:", error);
    } finally {
      setDraftHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;
    try {
      window.localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          rows,
          targetSearchByRow,
          targetFiltersByRow,
        })
      );
    } catch (error) {
      console.error("[BulkTodoForm] Failed to persist draft:", error);
    }
  }, [rows, targetSearchByRow, targetFiltersByRow, draftHydrated]);

  useEffect(() => {
    const handlePrefill = (event: Event) => {
      const custom = event as CustomEvent<{ rows?: Array<Partial<BulkTodoDraftRow>> }>;
      const incomingRows = Array.isArray(custom.detail?.rows) ? custom.detail.rows : [];
      if (incomingRows.length === 0) return;
      const normalizedRows: BulkTodoDraftRow[] = incomingRows.map((row, index) => ({
        id: typeof row.id === "string" && row.id ? row.id : `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        targetKey: typeof row.targetKey === "string" ? row.targetKey : "none",
        body: typeof row.body === "string" ? row.body : "",
        slots: Array.isArray(row.slots) ? row.slots.filter((value): value is string => typeof value === "string").slice(0, 2) : [],
        dueDate: typeof row.dueDate === "string" ? row.dueDate : null,
        sourceTodoId: typeof row.sourceTodoId === "string" ? row.sourceTodoId : null,
        sourceCallId: typeof row.sourceCallId === "string" ? row.sourceCallId : null,
        original:
          row.original && typeof row.original === "object"
            ? {
                targetKey:
                  typeof (row.original as Record<string, unknown>).targetKey === "string"
                    ? ((row.original as Record<string, unknown>).targetKey as string)
                    : (typeof row.targetKey === "string" ? row.targetKey : "none"),
                body:
                  typeof (row.original as Record<string, unknown>).body === "string"
                    ? ((row.original as Record<string, unknown>).body as string)
                    : (typeof row.body === "string" ? row.body : ""),
                slots: Array.isArray((row.original as Record<string, unknown>).slots)
                  ? ((row.original as Record<string, unknown>).slots as unknown[])
                      .filter((value): value is string => typeof value === "string")
                      .slice(0, 2)
                  : (Array.isArray(row.slots) ? row.slots.filter((value): value is string => typeof value === "string").slice(0, 2) : []),
                dueDate:
                  typeof (row.original as Record<string, unknown>).dueDate === "string"
                    ? ((row.original as Record<string, unknown>).dueDate as string)
                    : (typeof row.dueDate === "string" ? row.dueDate : null),
              }
            : undefined,
      }));
      setRows(normalizedRows);
      setCollapsedByRow({});
      setTargetPickerOpenByRow({});
      setTargetSearchByRow({});
      setTargetSearchActiveByRow({});
      setTargetFiltersPanelOpenByRow({});
      setTargetFiltersByRow({});
      setTargetBulkAddModeByRow({});
      setTargetBulkSelectedKeysByRow({});
      setAssigneeDrawerOpenByRow({});
    };

    window.addEventListener("business-bulk-todos-prefill", handlePrefill as EventListener);
    return () => {
      window.removeEventListener("business-bulk-todos-prefill", handlePrefill as EventListener);
    };
  }, []);

  const householdersById = useMemo(() => {
    const map = new Map<string, HouseholderWithDetails>();
    householders.forEach((hh) => {
      if (hh.id) map.set(hh.id, hh);
    });
    return map;
  }, [householders]);

  const sortedEstablishments = useMemo(
    () => [...establishments].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [establishments]
  );
  const sortedHouseholders = useMemo(
    () => [...householders].sort((a, b) => (a.name || "").localeCompare(b.name || "")),
    [householders]
  );
  const establishmentById = useMemo(() => {
    const map = new Map<string, EstablishmentWithDetails>();
    establishments.forEach((establishment) => {
      if (establishment.id) map.set(establishment.id, establishment);
    });
    return map;
  }, [establishments]);

  const participantsById = useMemo(() => {
    const map = new Map<string, PersonAvatar>();
    participants.forEach((participant) => {
      map.set(participant.id, {
        id: participant.id,
        first_name: participant.first_name,
        last_name: participant.last_name,
        avatar_url: participant.avatar_url,
      });
    });
    return map;
  }, [participants]);

  const targetOptions = useMemo<TargetOption[]>(
    () => [
      ...sortedEstablishments
        .filter(
          (establishment): establishment is EstablishmentWithDetails & { id: string } =>
            !!establishment.id && !establishment.publisher_id
        )
        .map((establishment) => ({
          key: `establishment:${establishment.id}`,
          label: establishment.name,
          typeLabel: "Establishment" as const,
          subtitle: establishment.area || "",
          status: establishment.publisher_id ? "personal_territory" : getBestStatus(establishment.statuses || []),
          avatars: latestInsightByTarget[`establishment:${establishment.id}`]?.avatars?.length
            ? latestInsightByTarget[`establishment:${establishment.id}`]?.avatars
            : (establishment.top_visitors || []).slice(0, 2).map((visitor) => ({
                id: visitor.user_id,
                first_name: visitor.first_name,
                last_name: visitor.last_name,
                avatar_url: visitor.avatar_url,
              })),
          searchText: `${establishment.name} establishment ${establishment.area || ""}`.toLowerCase(),
        })),
      ...sortedHouseholders.map((householder) => {
        const parentName = householder.establishment_name || "";
        return {
          key: `householder:${householder.id}`,
          label: householder.name,
          typeLabel: "Contact" as const,
          subtitle: parentName,
          status: householder.status || undefined,
          avatars: latestInsightByTarget[`householder:${householder.id}`]?.avatars?.length
            ? latestInsightByTarget[`householder:${householder.id}`]?.avatars
            : (householder.top_visitors || []).slice(0, 2).map((visitor) => ({
                id: visitor.user_id,
                first_name: visitor.first_name,
                last_name: visitor.last_name,
                avatar_url: visitor.avatar_url,
              })),
          searchText: `${householder.name} ${parentName} householder contact`.toLowerCase(),
        };
      }),
    ].sort((a, b) => {
      const typeRank = (value: { key: string }) => (value.key.startsWith("establishment:") ? 0 : 1);
      const byType = typeRank(a) - typeRank(b);
      if (byType !== 0) return byType;
      const byStatus = getStatusPriority((a as { status?: string }).status) - getStatusPriority((b as { status?: string }).status);
      if (byStatus !== 0) return byStatus;
      return a.label.localeCompare(b.label);
    }),
    [sortedEstablishments, sortedHouseholders, latestInsightByTarget]
  );

  const targetStatusOptions = useMemo<VisitFilterOption[]>(
    () =>
      Array.from(
        new Set(targetOptions.map((option) => option.status).filter((status): status is string => !!status))
      )
        .sort((a, b) => formatStatusText(a).localeCompare(formatStatusText(b)))
        .map((status) => ({ value: status, label: formatStatusText(status) })),
    [targetOptions]
  );

  const targetAreaOptions = useMemo<VisitFilterOption[]>(
    () =>
      Array.from(
        new Set(
          targetOptions
            .filter((option) => option.key.startsWith("establishment:"))
            .map((option) => option.subtitle.trim())
            .filter((area) => area.length > 0)
        )
      )
        .sort((a, b) => a.localeCompare(b))
        .map((area) => ({ value: area, label: area })),
    [targetOptions]
  );

  const insightTargetKeys = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((row) => row.targetKey)
            .filter((targetKey): targetKey is string => !!targetKey && targetKey !== "none")
        )
      ),
    [rows]
  );

  useEffect(() => {
    const establishmentIds = insightTargetKeys
      .filter((key) => key.startsWith("establishment:"))
      .map((key) => key.slice("establishment:".length))
      .filter((id) => id.length > 0);
    const householderIds = insightTargetKeys
      .filter((key) => key.startsWith("householder:"))
      .map((key) => key.slice("householder:".length))
      .filter((id) => id.length > 0);

    if (establishmentIds.length === 0 && householderIds.length === 0) {
      setLatestInsightByTarget({});
      setPendingTodosByTarget({});
      return;
    }

    let cancelled = false;
    const toMs = (value?: string | null): number => {
      if (!value) return 0;
      const ms = new Date(value).getTime();
      return Number.isFinite(ms) ? ms : 0;
    };
    const normalizePerson = (value: any): PersonAvatar | null => {
      const person = Array.isArray(value) ? value[0] : value;
      if (!person?.id) return null;
      return {
        id: person.id,
        first_name: person.first_name || "",
        last_name: person.last_name || "",
        avatar_url: person.avatar_url || undefined,
      };
    };

    const loadLatestInsights = async () => {
      try {
        try {
          const cachedRaw = window.localStorage.getItem(TARGET_INSIGHTS_CACHE_KEY);
          if (cachedRaw) {
            const cached = JSON.parse(cachedRaw) as {
              savedAt?: number;
              insights?: Record<string, TargetLatestInsight>;
            };
            const savedAt = typeof cached?.savedAt === "number" ? cached.savedAt : 0;
            if (
              cached?.insights &&
              typeof cached.insights === "object" &&
              Date.now() - savedAt <= TARGET_INSIGHTS_CACHE_MAX_AGE_MS
            ) {
              setLatestInsightByTarget(cached.insights);
            }
          }
        } catch (error) {
          console.error("[BulkTodoForm] Failed to restore target insights cache:", error);
        }

        const supabase = createSupabaseBrowserClient();
        await supabase.auth.getSession().catch(() => {});

        const callByEstablishmentPromise = establishmentIds.length
          ? supabase
              .from("calls")
              .select(
                "id, establishment_id, householder_id, note, visit_date, created_at, publisher:profiles!calls_publisher_id_fkey(id, first_name, last_name, avatar_url), partner:profiles!calls_partner_id_fkey(id, first_name, last_name, avatar_url)"
              )
              .in("establishment_id", establishmentIds)
          : Promise.resolve({ data: [], error: null } as any);
        const callByHouseholderPromise = householderIds.length
          ? supabase
              .from("calls")
              .select(
                "id, establishment_id, householder_id, note, visit_date, created_at, publisher:profiles!calls_publisher_id_fkey(id, first_name, last_name, avatar_url), partner:profiles!calls_partner_id_fkey(id, first_name, last_name, avatar_url)"
              )
              .in("householder_id", householderIds)
          : Promise.resolve({ data: [], error: null } as any);
        const doneTodoByEstablishmentPromise = establishmentIds.length
          ? supabase
              .from("call_todos")
              .select(
                "id, call_id, establishment_id, householder_id, body, created_at, publisher_id, partner_id, call:calls!call_todos_call_id_fkey(establishment_id, householder_id, publisher_id, partner_id)"
              )
              .eq("is_done", true)
              .in("establishment_id", establishmentIds)
          : Promise.resolve({ data: [], error: null } as any);
        const doneTodoByHouseholderPromise = householderIds.length
          ? supabase
              .from("call_todos")
              .select(
                "id, call_id, establishment_id, householder_id, body, created_at, publisher_id, partner_id, call:calls!call_todos_call_id_fkey(establishment_id, householder_id, publisher_id, partner_id)"
              )
              .eq("is_done", true)
              .in("householder_id", householderIds)
          : Promise.resolve({ data: [], error: null } as any);
        const openTodoByEstablishmentPromise = establishmentIds.length
          ? supabase
              .from("call_todos")
              .select(
                "id, call_id, establishment_id, householder_id, body, created_at, deadline_date, publisher_id, partner_id, call:calls!call_todos_call_id_fkey(establishment_id, householder_id, publisher_id, partner_id)"
              )
              .eq("is_done", false)
              .in("establishment_id", establishmentIds)
          : Promise.resolve({ data: [], error: null } as any);
        const openTodoByHouseholderPromise = householderIds.length
          ? supabase
              .from("call_todos")
              .select(
                "id, call_id, establishment_id, householder_id, body, created_at, deadline_date, publisher_id, partner_id, call:calls!call_todos_call_id_fkey(establishment_id, householder_id, publisher_id, partner_id)"
              )
              .eq("is_done", false)
              .in("householder_id", householderIds)
          : Promise.resolve({ data: [], error: null } as any);

        const [
          { data: callByEstablishment, error: callByEstablishmentError },
          { data: callByHouseholder, error: callByHouseholderError },
          { data: doneTodoByEstablishment, error: doneTodoByEstablishmentError },
          { data: doneTodoByHouseholder, error: doneTodoByHouseholderError },
          { data: openTodoByEstablishment, error: openTodoByEstablishmentError },
          { data: openTodoByHouseholder, error: openTodoByHouseholderError },
        ] = await Promise.all([
          callByEstablishmentPromise,
          callByHouseholderPromise,
          doneTodoByEstablishmentPromise,
          doneTodoByHouseholderPromise,
          openTodoByEstablishmentPromise,
          openTodoByHouseholderPromise,
        ]);
        if (callByEstablishmentError) {
          console.warn("[BulkTodoForm] callByEstablishment query failed:", callByEstablishmentError);
        }
        if (callByHouseholderError) {
          console.warn("[BulkTodoForm] callByHouseholder query failed:", callByHouseholderError);
        }
        if (doneTodoByEstablishmentError) {
          console.warn("[BulkTodoForm] doneTodoByEstablishment query failed:", doneTodoByEstablishmentError);
        }
        if (doneTodoByHouseholderError) {
          console.warn("[BulkTodoForm] doneTodoByHouseholder query failed:", doneTodoByHouseholderError);
        }
        if (openTodoByEstablishmentError) {
          console.warn("[BulkTodoForm] openTodoByEstablishment query failed:", openTodoByEstablishmentError);
        }
        if (openTodoByHouseholderError) {
          console.warn("[BulkTodoForm] openTodoByHouseholder query failed:", openTodoByHouseholderError);
        }

        const callIds = Array.from(
          new Set(
            [...(callByEstablishment || []), ...(callByHouseholder || [])]
              .map((row: any) => row?.id)
              .filter((id: unknown): id is string => typeof id === "string" && id.length > 0)
          )
        );
        const doneTodoByCallPromise = callIds.length
          ? supabase
              .from("call_todos")
              .select(
                "id, call_id, establishment_id, householder_id, body, created_at, publisher_id, partner_id, call:calls!call_todos_call_id_fkey(establishment_id, householder_id, publisher_id, partner_id)"
              )
              .eq("is_done", true)
              .in("call_id", callIds)
          : Promise.resolve({ data: [], error: null } as any);
        const openTodoByCallPromise = callIds.length
          ? supabase
              .from("call_todos")
              .select(
                "id, call_id, establishment_id, householder_id, body, created_at, deadline_date, publisher_id, partner_id, call:calls!call_todos_call_id_fkey(establishment_id, householder_id, publisher_id, partner_id)"
              )
              .eq("is_done", false)
              .in("call_id", callIds)
          : Promise.resolve({ data: [], error: null } as any);
        const [doneTodoByCallResult, openTodoByCallResult] = await Promise.all([
          doneTodoByCallPromise,
          openTodoByCallPromise,
        ]);
        if (doneTodoByCallResult.error) {
          console.warn("[BulkTodoForm] doneTodoByCall query failed:", doneTodoByCallResult.error);
        }
        if (openTodoByCallResult.error) {
          console.warn("[BulkTodoForm] openTodoByCall query failed:", openTodoByCallResult.error);
        }

        const insights: Record<string, TargetLatestInsight> = {};
        const upsertInsight = (targetKey: string, insight: TargetLatestInsight) => {
          const current = insights[targetKey];
          if (!current || insight.atMs > current.atMs) {
            insights[targetKey] = insight;
          }
        };

        const callsById = new Map<string, any>();
        [...(callByEstablishment || []), ...(callByHouseholder || [])].forEach((row: any) => {
          if (row?.id) callsById.set(row.id, row);
        });
        Array.from(callsById.values()).forEach((row: any) => {
          const atMs = Math.max(toMs(row.visit_date), toMs(row.created_at));
          const publisher = normalizePerson(row.publisher);
          const partner = normalizePerson(row.partner);
          const avatars = [publisher, partner].filter((value): value is PersonAvatar => !!value).slice(0, 2);
          const noteText = typeof row.note === "string" && row.note.trim() ? row.note.trim() : "Visit update";
          const householderName =
            row.householder_id && householdersById.get(row.householder_id)?.name
              ? householdersById.get(row.householder_id)?.name
              : null;
          const householderStatus =
            row.householder_id && householdersById.get(row.householder_id)?.status
              ? householdersById.get(row.householder_id)?.status
              : null;
          const dateValue = row.visit_date || row.created_at || null;
          if (row.establishment_id) {
            upsertInsight(`establishment:${row.establishment_id}`, { atMs, text: noteText, avatars, householderName, householderStatus, dateValue, source: "call" });
          }
          if (row.householder_id) {
            upsertInsight(`householder:${row.householder_id}`, { atMs, text: noteText, avatars, householderName, householderStatus, dateValue, source: "call" });
          }
        });

        const doneTodosById = new Map<string, any>();
        [...(doneTodoByEstablishment || []), ...(doneTodoByHouseholder || []), ...((doneTodoByCallResult.data || []) as any[])].forEach((row: any) => {
          if (row?.id) doneTodosById.set(row.id, row);
        });
        Array.from(doneTodosById.values()).forEach((row: any) => {
          const callMeta = Array.isArray(row.call) ? row.call[0] : row.call;
          const effectiveEstablishmentId = row.establishment_id || callMeta?.establishment_id || null;
          const effectiveHouseholderId = row.householder_id || callMeta?.householder_id || null;
          const atMs = toMs(row.created_at);
          const text = typeof row.body === "string" && row.body.trim() ? row.body.trim() : "Completed to-do";
          const avatars = [row.publisher_id || callMeta?.publisher_id, row.partner_id || callMeta?.partner_id]
            .map((id: string | null | undefined) => (id ? participantsById.get(id) : undefined))
            .filter((value): value is PersonAvatar => !!value)
            .slice(0, 2);
          const householderName =
            effectiveHouseholderId && householdersById.get(effectiveHouseholderId)?.name
              ? householdersById.get(effectiveHouseholderId)?.name
              : null;
          const householderStatus =
            effectiveHouseholderId && householdersById.get(effectiveHouseholderId)?.status
              ? householdersById.get(effectiveHouseholderId)?.status
              : null;
          const dateValue = row.deadline_date || row.created_at || null;
          if (effectiveEstablishmentId) {
            upsertInsight(`establishment:${effectiveEstablishmentId}`, { atMs, text, avatars, householderName, householderStatus, dateValue, source: "todo" });
          }
          if (effectiveHouseholderId) {
            upsertInsight(`householder:${effectiveHouseholderId}`, { atMs, text, avatars, householderName, householderStatus, dateValue, source: "todo" });
          }
        });

        const pendingByTargetMap = new Map<string, Map<string, PendingTodoDisplay>>();
        const pushPending = (targetKey: string, item: PendingTodoDisplay) => {
          const current = pendingByTargetMap.get(targetKey) ?? new Map<string, PendingTodoDisplay>();
          current.set(item.id, item);
          pendingByTargetMap.set(targetKey, current);
        };

        const openTodosById = new Map<string, any>();
        [...(openTodoByEstablishment || []), ...(openTodoByHouseholder || []), ...((openTodoByCallResult.data || []) as any[])].forEach((row: any) => {
          if (row?.id) openTodosById.set(row.id, row);
        });
        Array.from(openTodosById.values()).forEach((row: any) => {
          const callMeta = Array.isArray(row.call) ? row.call[0] : row.call;
          const effectiveEstablishmentId = row.establishment_id || callMeta?.establishment_id || null;
          const effectiveHouseholderId = row.householder_id || callMeta?.householder_id || null;
          const atMs = toMs(row.created_at);
          const pendingItem: PendingTodoDisplay = {
            id: row.id,
            body: typeof row.body === "string" ? row.body.trim() : "",
            deadlineDate: typeof row.deadline_date === "string" ? row.deadline_date : null,
            createdAtMs: atMs,
            publisherId: row.publisher_id || callMeta?.publisher_id || null,
            partnerId: row.partner_id || callMeta?.partner_id || null,
            householderName:
              effectiveHouseholderId && householdersById.get(effectiveHouseholderId)?.name
                ? householdersById.get(effectiveHouseholderId)?.name
                : null,
            householderStatus:
              effectiveHouseholderId && householdersById.get(effectiveHouseholderId)?.status
                ? householdersById.get(effectiveHouseholderId)?.status
                : null,
          };
          if (effectiveEstablishmentId) {
            pushPending(`establishment:${effectiveEstablishmentId}`, pendingItem);
          }
          if (effectiveHouseholderId) {
            pushPending(`householder:${effectiveHouseholderId}`, pendingItem);
          }
        });

        const pendingByTarget: Record<string, PendingTodoDisplay[]> = {};
        pendingByTargetMap.forEach((byTodoId, targetKey) => {
          pendingByTarget[targetKey] = Array.from(byTodoId.values()).sort((a, b) => {
            const aDeadline = a.deadlineDate ? new Date(`${a.deadlineDate}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
            const bDeadline = b.deadlineDate ? new Date(`${b.deadlineDate}T00:00:00`).getTime() : Number.POSITIVE_INFINITY;
            if (aDeadline !== bDeadline) return aDeadline - bDeadline;
            return a.createdAtMs - b.createdAtMs;
          });
        });

        if (!cancelled) {
          setLatestInsightByTarget(insights);
          setPendingTodosByTarget(pendingByTarget);
          window.localStorage.setItem(
            TARGET_INSIGHTS_CACHE_KEY,
            JSON.stringify({
              savedAt: Date.now(),
              insights,
            })
          );
        }
      } catch (error) {
        console.error("[BulkTodoForm] Failed to load latest target insights:", error);
      }
    };

    loadLatestInsights();
    return () => {
      cancelled = true;
    };
  }, [insightTargetKeys, participantsById, householdersById, insightRefreshKey]);

  const updateRow = (id: string, updates: Partial<BulkTodoDraftRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };

  const getAutoAssignedSlotsFromOption = (option: {
    avatars?: Array<{ id: string }>;
  }): string[] => {
    if (!Array.isArray(option.avatars) || option.avatars.length === 0) return [];
    return option.avatars
      .map((avatar) => avatar.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
      .slice(0, 2);
  };

  const getSuggestedTodoBodyFromTargetOption = (option: { key: string; status?: string }): string => {
    if (!option.key.startsWith("establishment:")) return "";
    switch (option.status) {
      case "for_replenishment":
        return "Replenish";
      case "for_follow_up":
        return "Follow up";
      case "for_scouting":
        return "Propose rack";
      default:
        return "";
    }
  };

  const findDuplicateTargetKeys = (targetKeys: string[]): string[] => {
    if (targetKeys.length === 0) return [];
    const existingKeys = new Set(
      rows
        .map((row) => row.targetKey)
        .filter((targetKey): targetKey is string => !!targetKey && targetKey !== "none")
    );
    return Array.from(new Set(targetKeys.filter((targetKey) => existingKeys.has(targetKey))));
  };

  const resetTargetPickerAddState = (rowId: string) => {
    setTargetBulkAddModeByRow((prev) => ({ ...prev, [rowId]: false }));
    setTargetBulkSelectedKeysByRow((prev) => ({ ...prev, [rowId]: [] }));
    setTargetPickerOpenByRow((prev) => ({ ...prev, [rowId]: false }));
  };

  const handleTargetOptionSelect = (
    rowId: string,
    option: {
      key: string;
      avatars?: Array<{ id: string }>;
    }
  ) => {
    if (rowId === NEW_TODO_PICKER_ROW_ID) {
      const duplicateTargetKeys = findDuplicateTargetKeys([option.key]);
      if (duplicateTargetKeys.length > 0) {
        setDuplicateAddPrompt({
          sourceRowId: rowId,
          requestedTargetKeys: [option.key],
          duplicateTargetKeys,
        });
        return;
      }
      addRowsFromTargetKeys([option.key], { skipDuplicateTargets: false });
      resetTargetPickerAddState(rowId);
      return;
    }
    const autoSlots = getAutoAssignedSlotsFromOption(option);
    const suggestedBody = getSuggestedTodoBodyFromTargetOption(option);
    const today = toLocalDateString(new Date());
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId
          ? {
              ...row,
              targetKey: option.key,
              body: row.body.trim() ? row.body : suggestedBody,
              slots: autoSlots.length > 0 ? autoSlots : row.slots,
              dueDate: row.dueDate ?? today,
            }
          : row
      )
    );
    setTargetPickerOpenByRow((prev) => ({ ...prev, [rowId]: false }));
  };

  const addRowsFromTargetKeys = (
    targetKeys: string[],
    options?: {
      skipDuplicateTargets?: boolean;
    }
  ) => {
    if (targetKeys.length === 0) return 0;
    const today = toLocalDateString(new Date());
    const optionsByKey = new Map(targetOptions.map((option) => [option.key, option]));
    const shouldSkipDuplicates = options?.skipDuplicateTargets === true;
    const existingKeys = shouldSkipDuplicates
      ? new Set(
          rows
            .map((row) => row.targetKey)
            .filter((targetKey): targetKey is string => !!targetKey && targetKey !== "none")
        )
      : null;
    const rowsToAdd = targetKeys.reduce<BulkTodoDraftRow[]>((acc, targetKey) => {
      if (shouldSkipDuplicates && existingKeys?.has(targetKey)) return acc;
      const option = optionsByKey.get(targetKey);
      if (!option) return acc;
      const autoSlots = getAutoAssignedSlotsFromOption(option);
      const suggestedBody = getSuggestedTodoBodyFromTargetOption(option);
      acc.push({
        ...createDraftRow(),
        targetKey: option.key,
        body: suggestedBody,
        slots: autoSlots,
        dueDate: today,
      });
      if (shouldSkipDuplicates) {
        existingKeys?.add(targetKey);
      }
      return acc;
    }, []);

    if (rowsToAdd.length === 0) return 0;
    setRows((prev) => [...prev, ...rowsToAdd]);
    return rowsToAdd.length;
  };

  const resolveDuplicateAddPrompt = (mode: "ignore-duplicates" | "add-anyway") => {
    const prompt = duplicateAddPrompt;
    if (!prompt) return;
    const addedCount = addRowsFromTargetKeys(prompt.requestedTargetKeys, {
      skipDuplicateTargets: mode === "ignore-duplicates",
    });
    const ignoredCount =
      mode === "ignore-duplicates"
        ? prompt.requestedTargetKeys.length - addedCount
        : 0;

    if (mode === "ignore-duplicates") {
      if (addedCount > 0) {
        toast.success(
          `Added ${addedCount} to-do${addedCount > 1 ? "s" : ""}${ignoredCount > 0 ? ` and ignored ${ignoredCount} duplicate${ignoredCount > 1 ? "s" : ""}` : ""}.`
        );
      } else {
        toast.message("No new to-dos were added. Duplicates were ignored.");
      }
    }

    if (mode === "add-anyway" || addedCount > 0) {
      resetTargetPickerAddState(prompt.sourceRowId);
    }
    setDuplicateAddPrompt(null);
  };

  const updateTargetPickerFilters = (
    rowId: string,
    updater: (prev: VisitFilters) => VisitFilters
  ) => {
    setTargetFiltersByRow((prev) => {
      const current = prev[rowId] ?? DEFAULT_TARGET_PICKER_FILTERS;
      return { ...prev, [rowId]: updater(current) };
    });
  };

  const getTargetFilterBadgesForRow = (rowId: string): FilterBadge[] => {
    const filters = targetFiltersByRow[rowId] ?? DEFAULT_TARGET_PICKER_FILTERS;
    return buildFilterBadges({
      statuses: filters.statuses,
      areas: filters.areas,
      formatStatusLabel: formatStatusText,
    });
  };

  const getFilteredTargetOptionsForRow = (rowId: string): TargetOption[] => {
    const filters = targetFiltersByRow[rowId] ?? DEFAULT_TARGET_PICKER_FILTERS;
    const term = (targetSearchByRow[rowId] || "").trim().toLowerCase();

    return targetOptions.filter((option) => {
      if (filters.bwiOnly && !option.key.startsWith("establishment:")) return false;
      if (filters.householderOnly && !option.key.startsWith("householder:")) return false;

      if (filters.statuses.length > 0) {
        if (!option.status || !filters.statuses.includes(option.status)) return false;
      }

      if (filters.areas.length > 0) {
        if (!option.key.startsWith("establishment:")) return false;
        const optionArea = option.subtitle.trim();
        if (!optionArea || !filters.areas.includes(optionArea)) return false;
      }

      if (term && !option.searchText.includes(term)) return false;

      return true;
    });
  };

  const getRowTargetLabel = (row: BulkTodoDraftRow, fallback: string) => {
    if (row.targetKey === "none") return fallback;
    const [targetType, targetId] = row.targetKey.split(":");
    if (targetType === "establishment") {
      return establishmentById.get(targetId)?.name || fallback;
    }
    const householder = householdersById.get(targetId);
    return householder?.name || fallback;
  };

  const getRowHeaderStatuses = (row: BulkTodoDraftRow): string[] => {
    if (row.targetKey === "none") return [];
    const [targetType, targetId] = row.targetKey.split(":");
    if (targetType === "establishment") {
      const establishment = establishmentById.get(targetId);
      if (!establishment) return [];
      const statuses = establishment.publisher_id
        ? ["personal_territory", ...(establishment.statuses || [])]
        : establishment.statuses || [];
      return Array.from(new Set(statuses.filter((status): status is string => !!status))).sort(
        (a, b) => getStatusPriority(a) - getStatusPriority(b)
      );
    }
    const householder = householdersById.get(targetId);
    if (!householder?.status) return [];
    return [householder.status];
  };

  const isBulkAddModeActive = (rowId: string) => !!targetBulkAddModeByRow[rowId];
  const getBulkSelectedKeys = (rowId: string) => targetBulkSelectedKeysByRow[rowId] ?? [];

  const toggleBulkAddMode = (rowId: string) => {
    const active = isBulkAddModeActive(rowId);
    if (!active) {
      setTargetBulkAddModeByRow((prev) => ({ ...prev, [rowId]: true }));
      setTargetBulkSelectedKeysByRow((prev) => ({ ...prev, [rowId]: [] }));
      return;
    }

    const selectedKeys = getBulkSelectedKeys(rowId);
    if (selectedKeys.length === 0) {
      toast.error("Select at least one establishment or contact.");
      return;
    }

    const duplicateTargetKeys = findDuplicateTargetKeys(selectedKeys);
    if (duplicateTargetKeys.length > 0) {
      setDuplicateAddPrompt({
        sourceRowId: rowId,
        requestedTargetKeys: selectedKeys,
        duplicateTargetKeys,
      });
      return;
    }

    addRowsFromTargetKeys(selectedKeys);
    resetTargetPickerAddState(rowId);
  };

  const cancelBulkAddMode = (rowId: string) => {
    setTargetBulkAddModeByRow((prev) => ({ ...prev, [rowId]: false }));
    setTargetBulkSelectedKeysByRow((prev) => ({ ...prev, [rowId]: [] }));
  };

  const toggleBulkTargetSelection = (rowId: string, targetKey: string) => {
    setTargetBulkSelectedKeysByRow((prev) => {
      const current = prev[rowId] ?? [];
      const exists = current.includes(targetKey);
      return {
        ...prev,
        [rowId]: exists ? current.filter((key) => key !== targetKey) : [...current, targetKey],
      };
    });
  };

  const toggleBulkSelectAllVisibleTargets = (rowId: string, visibleTargetKeys: string[]) => {
    setTargetBulkSelectedKeysByRow((prev) => {
      const current = prev[rowId] ?? [];
      const allVisibleSelected =
        visibleTargetKeys.length > 0 && visibleTargetKeys.every((targetKey) => current.includes(targetKey));
      if (allVisibleSelected) {
        return {
          ...prev,
          [rowId]: current.filter((targetKey) => !visibleTargetKeys.includes(targetKey)),
        };
      }
      return {
        ...prev,
        [rowId]: Array.from(new Set([...current, ...visibleTargetKeys])),
      };
    });
  };

  const renderTargetPickerControls = (row: BulkTodoDraftRow) => {
    const bulkAddActive = isBulkAddModeActive(row.id);
    const filteredTargetKeys = getFilteredTargetOptionsForRow(row.id).map((option) => option.key);
    const selectedTargetKeys = getBulkSelectedKeys(row.id);
    const allVisibleSelected =
      filteredTargetKeys.length > 0 && filteredTargetKeys.every((targetKey) => selectedTargetKeys.includes(targetKey));
    const someVisibleSelected =
      !allVisibleSelected && filteredTargetKeys.some((targetKey) => selectedTargetKeys.includes(targetKey));

    return (
    <>
      <div className="w-full overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="w-max min-w-full flex justify-center">
          <FilterControls
            isSearchActive={!!targetSearchActiveByRow[row.id]}
            searchValue={targetSearchByRow[row.id] || ""}
            onSearchActivate={() => {
              setTargetSearchActiveByRow((prev) => ({ ...prev, [row.id]: true }));
              setTargetFiltersPanelOpenByRow((prev) => ({ ...prev, [row.id]: false }));
            }}
            onSearchChange={(value) => {
              setTargetSearchByRow((prev) => ({ ...prev, [row.id]: value }));
              updateTargetPickerFilters(row.id, (prev) => ({ ...prev, search: value }));
            }}
            onSearchClear={() => {
              setTargetSearchByRow((prev) => ({ ...prev, [row.id]: "" }));
              setTargetSearchActiveByRow((prev) => ({ ...prev, [row.id]: false }));
              updateTargetPickerFilters(row.id, (prev) => ({ ...prev, search: "" }));
            }}
            onSearchBlur={() => {
              if (!(targetSearchByRow[row.id] || "").trim()) {
                setTargetSearchActiveByRow((prev) => ({ ...prev, [row.id]: false }));
              }
            }}
            showMyFilter={false}
            bwiActive={!!(targetFiltersByRow[row.id] ?? DEFAULT_TARGET_PICKER_FILTERS).bwiOnly}
            bwiLabel="Establishments Only"
            onBwiActivate={() =>
              updateTargetPickerFilters(row.id, (prev) => ({
                ...prev,
                bwiOnly: true,
                householderOnly: false,
              }))
            }
            onBwiClear={() =>
              updateTargetPickerFilters(row.id, (prev) => ({ ...prev, bwiOnly: false }))
            }
            householderActive={!!(targetFiltersByRow[row.id] ?? DEFAULT_TARGET_PICKER_FILTERS).householderOnly}
            householderLabel="Contacts Only"
            onHouseholderActivate={() =>
              updateTargetPickerFilters(row.id, (prev) => ({
                ...prev,
                householderOnly: true,
                bwiOnly: false,
              }))
            }
            onHouseholderClear={() =>
              updateTargetPickerFilters(row.id, (prev) => ({ ...prev, householderOnly: false }))
            }
            filterBadges={getTargetFilterBadgesForRow(row.id)}
            onOpenFilters={() => {
              setTargetFiltersPanelOpenByRow((prev) => ({ ...prev, [row.id]: true }));
              setTargetSearchActiveByRow((prev) => ({ ...prev, [row.id]: false }));
            }}
            onClearFilters={() =>
              updateTargetPickerFilters(row.id, (prev) => ({
                ...prev,
                statuses: [],
                areas: [],
                assigneeIds: [],
              }))
            }
            onRemoveBadge={(badge) =>
              updateTargetPickerFilters(row.id, (prev) => {
                if (badge.type === "area") {
                  return { ...prev, areas: prev.areas.filter((area) => area !== badge.value) };
                }
                if (badge.type === "assignee") {
                  return {
                    ...prev,
                    assigneeIds: prev.assigneeIds.filter((id) => id !== badge.value),
                  };
                }
                return { ...prev, statuses: prev.statuses.filter((status) => status !== badge.value) };
              })
            }
            preserveActionButtonsWhenTogglesActive
            containerClassName={!!targetSearchActiveByRow[row.id] ? "w-full !max-w-none !px-0" : "whitespace-nowrap"}
            maxWidthClassName="mx-0"
            trailingActions={
              row.id === NEW_TODO_PICKER_ROW_ID ? (
                <div className="flex items-center gap-1">
                  <motion.div
                    layout
                    transition={{ type: "spring", stiffness: 360, damping: 28, mass: 0.5 }}
                  >
                    <Button
                      type="button"
                      variant={isBulkAddModeActive(row.id) ? "default" : "outline"}
                      size={isBulkAddModeActive(row.id) ? "sm" : "icon"}
                      className={isBulkAddModeActive(row.id) ? "h-9 rounded-full px-3" : "h-9 w-9 rounded-full"}
                      onClick={() => toggleBulkAddMode(row.id)}
                      aria-label={isBulkAddModeActive(row.id) ? `Add (${getBulkSelectedKeys(row.id).length})` : "Bulk add"}
                      title={isBulkAddModeActive(row.id) ? `Add (${getBulkSelectedKeys(row.id).length})` : "Bulk add"}
                    >
                      <Plus className="h-4 w-4" />
                      <AnimatePresence initial={false}>
                        {isBulkAddModeActive(row.id) ? (
                          <motion.span
                            key="add-count"
                            initial={{ opacity: 0, width: 0, marginLeft: 0 }}
                            animate={{ opacity: 1, width: "auto", marginLeft: 4 }}
                            exit={{ opacity: 0, width: 0, marginLeft: 0 }}
                            className="text-sm whitespace-nowrap overflow-hidden"
                          >
                            Add ({getBulkSelectedKeys(row.id).length})
                          </motion.span>
                        ) : null}
                      </AnimatePresence>
                    </Button>
                  </motion.div>
                  <AnimatePresence initial={false}>
                    {isBulkAddModeActive(row.id) ? (
                      <motion.div
                        key="bulk-cancel"
                        initial={{ opacity: 0, scale: 0.92, x: -4 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.92, x: -4 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                      >
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-full"
                          onClick={() => cancelBulkAddMode(row.id)}
                          aria-label="Cancel bulk add"
                          title="Cancel bulk add"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              ) : null
            }
          />
        </div>
      </div>
      <AnimatePresence initial={false}>
        {bulkAddActive ? (
          <motion.div
            key={`bulk-select-all-${row.id}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="flex items-center justify-between rounded-md border bg-muted/25 px-3 py-2"
          >
            <div className="text-sm text-muted-foreground">
              Select all visible
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {selectedTargetKeys.filter((targetKey) => filteredTargetKeys.includes(targetKey)).length}/{filteredTargetKeys.length}
              </span>
              <Checkbox
                checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                onCheckedChange={() => toggleBulkSelectAllVisibleTargets(row.id, filteredTargetKeys)}
                aria-label="Select all visible options"
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <Drawer
        open={!!targetFiltersPanelOpenByRow[row.id]}
        onOpenChange={(open) => {
          setTargetFiltersPanelOpenByRow((prev) => ({ ...prev, [row.id]: open }));
        }}
      >
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader className="text-center">
            <DrawerTitle>Filter establishment/contact</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+24px)]">
            <VisitFiltersForm
              filters={targetFiltersByRow[row.id] ?? DEFAULT_TARGET_PICKER_FILTERS}
              statusOptions={targetStatusOptions}
              areaOptions={targetAreaOptions}
              onFiltersChange={(filters) =>
                updateTargetPickerFilters(row.id, (prev) => ({
                  ...prev,
                  statuses: filters.statuses,
                  areas: filters.areas,
                  assigneeIds: filters.assigneeIds,
                }))
              }
              onClearFilters={() =>
                updateTargetPickerFilters(row.id, (prev) => ({
                  ...prev,
                  statuses: [],
                  areas: [],
                  assigneeIds: [],
                }))
              }
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
    );
  };

  const renderTargetPickerList = (row: BulkTodoDraftRow, listClassName: string) => (
    <div
      className={listClassName}
      style={{ overscrollBehavior: "contain", touchAction: "pan-y", WebkitOverflowScrolling: "touch" as any }}
    >
      {getFilteredTargetOptionsForRow(row.id).map((option) => {
        const bulkAddActive = isBulkAddModeActive(row.id);
        const bulkSelected = getBulkSelectedKeys(row.id).includes(option.key);
        return (
          <div
            key={option.key}
            role="button"
            tabIndex={0}
            className={
              "w-full text-left rounded-md py-2 px-2 transition-colors cursor-pointer " +
              (bulkAddActive
                ? bulkSelected
                  ? "bg-secondary text-secondary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
                : row.targetKey === option.key
                  ? "bg-secondary text-secondary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground")
            }
            onClick={() => {
              if (bulkAddActive) {
                toggleBulkTargetSelection(row.id, option.key);
                return;
              }
              handleTargetOptionSelect(row.id, option);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (bulkAddActive) {
                  toggleBulkTargetSelection(row.id, option.key);
                  return;
                }
                handleTargetOptionSelect(row.id, option);
              }
            }}
            aria-label={`Select ${option.label}`}
          >
            <div className="text-left min-w-0 w-full">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="text-sm truncate min-w-0">{option.label}</div>
                  {Array.isArray(option.avatars) && option.avatars.length > 0 ? (
                    <div className="flex items-center">
                      {option.avatars.slice(0, 2).map((visitor, visitorIndex) => (
                        <Avatar
                          key={`${option.key}-avatar-${visitor.id}`}
                          className={`h-5 w-5 ring-1 ring-background ${visitorIndex > 0 ? "-ml-1.5" : ""}`}
                        >
                          <AvatarImage src={visitor.avatar_url} alt={`${visitor.first_name} ${visitor.last_name}`} />
                          <AvatarFallback className="text-[10px]">
                            {getInitialsFromName(`${visitor.first_name} ${visitor.last_name}`)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  ) : null}
                  {option.status ? (
                    <VisitStatusBadge
                      status={option.status}
                      label={formatStatusText(option.status)}
                      className="shrink-0"
                    />
                  ) : null}
                </div>
                <AnimatePresence initial={false}>
                  {bulkAddActive ? (
                    <motion.div
                      key={`checkbox-${option.key}`}
                      initial={{ opacity: 0, scale: 0.9, x: 4 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9, x: 4 }}
                      transition={{ duration: 0.14, ease: "easeOut" }}
                      className="flex items-center justify-center shrink-0"
                    >
                      <Checkbox
                        checked={bulkSelected}
                        onCheckedChange={() => toggleBulkTargetSelection(row.id, option.key)}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0"
                        aria-label={`Select ${option.label}`}
                      />
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
              <div className="text-xs text-muted-foreground truncate min-w-0 mt-0.5">
                {option.typeLabel}
                {option.subtitle ? ` - ${option.subtitle}` : ""}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const openTargetPickerForRow = (rowId: string) => {
    setTargetPickerOpenByRow((prev) => ({ ...prev, [rowId]: true }));
    if (rowId !== NEW_TODO_PICKER_ROW_ID) {
      setCollapsedByRow((prev) => ({ ...prev, [rowId]: false }));
    }
    setTargetSearchActiveByRow((prev) => ({ ...prev, [rowId]: false }));
    setTargetFiltersPanelOpenByRow((prev) => ({ ...prev, [rowId]: false }));
    if (rowId === NEW_TODO_PICKER_ROW_ID) {
      setTargetBulkAddModeByRow((prev) => ({ ...prev, [rowId]: false }));
      setTargetBulkSelectedKeysByRow((prev) => ({ ...prev, [rowId]: [] }));
    }
  };

  const addRow = () => {
    openTargetPickerForRow(NEW_TODO_PICKER_ROW_ID);
  };

  const clearAllRows = () => {
    setRows([]);
    setCollapsedByRow({});
    setAssigneeDrawerOpenByRow({});
    setNewGuestNameByRow({});
    setTargetPickerOpenByRow((prev) => ({ ...prev, [NEW_TODO_PICKER_ROW_ID]: false }));
    setTargetBulkAddModeByRow((prev) => ({ ...prev, [NEW_TODO_PICKER_ROW_ID]: false }));
    setTargetBulkSelectedKeysByRow((prev) => ({ ...prev, [NEW_TODO_PICKER_ROW_ID]: [] }));
    setClearConfirmOpen(false);
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
    setCollapsedByRow((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTargetPickerOpenByRow((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTargetSearchByRow((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTargetSearchActiveByRow((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTargetFiltersPanelOpenByRow((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTargetFiltersByRow((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTargetBulkAddModeByRow((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setTargetBulkSelectedKeysByRow((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setAssigneeDrawerOpenByRow((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setNewGuestNameByRow((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleDeleteSourceTodoRow = async (row: BulkTodoDraftRow) => {
    if (!row.sourceTodoId) return;
    if (
      !window.confirm(
        "Delete this to-do permanently? It will be removed from the database and cannot be undone."
      )
    ) {
      return;
    }
    setDeletingSourceTodoRowId(row.id);
    try {
      const ok = await deleteCallTodo(row.sourceTodoId);
      if (!ok) {
        toast.error("Could not delete this to-do.");
        return;
      }
      toast.success("To-do deleted.");
      removeRow(row.id);
      setInsightRefreshKey((k) => k + 1);
      onSaved();
    } finally {
      setDeletingSourceTodoRowId(null);
    }
  };

  const isRowBlank = (row: BulkTodoDraftRow) =>
    row.targetKey === "none" &&
    !row.body.trim() &&
    row.slots.length === 0 &&
    !row.dueDate;

  const isRowComplete = (row: BulkTodoDraftRow) =>
    row.targetKey !== "none" &&
    !!row.body.trim() &&
    row.slots.length >= 1;

  const normalizeRowForCompare = (row: BulkTodoDraftRow) => ({
    targetKey: row.targetKey,
    body: row.body.trim(),
    slots: row.slots.slice(0, 2),
    dueDate: row.dueDate ?? null,
  });

  const hasRowChanged = (row: BulkTodoDraftRow) => {
    if (!row.sourceTodoId || !row.original) return false;
    const current = normalizeRowForCompare(row);
    const originalBody = row.original.body.trim();
    const originalDueDate = row.original.dueDate ?? null;
    const originalSlots = row.original.slots.slice(0, 2);
    return (
      current.targetKey !== row.original.targetKey ||
      current.body !== originalBody ||
      current.dueDate !== originalDueDate ||
      current.slots.length !== originalSlots.length ||
      current.slots.some((slot, index) => slot !== originalSlots[index])
    );
  };

  const newRowsCount = rows.filter((row) => !row.sourceTodoId).length;
  const editRowsCount = rows.filter((row) => !!row.sourceTodoId).length;
  const draftKind: "new" | "edit" | "mixed" =
    newRowsCount > 0 && editRowsCount > 0
      ? "mixed"
      : editRowsCount > 0
        ? "edit"
        : "new";

  useEffect(() => {
    onDraftKindChange?.(draftKind);
  }, [draftKind, onDraftKindChange]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      const changedEditRows = rows.filter((row) => !!row.sourceTodoId && hasRowChanged(row));
      const newCandidateRows = rows.filter((row) => !row.sourceTodoId && !isRowBlank(row));
      if (changedEditRows.length === 0 && newCandidateRows.length === 0) {
        toast.error("No changes to submit.");
        return;
      }

      const changedCompleteEditRows = changedEditRows.filter(isRowComplete);
      const completeNewRows = newCandidateRows.filter(isRowComplete);

      if (changedCompleteEditRows.length === 0 && completeNewRows.length === 0) {
        toast.error("No ready to-dos to submit.");
        return;
      }

      const invalidTargetChangeOnCallRow = changedCompleteEditRows.find(
        (row) => !!row.sourceCallId && !!row.original && row.targetKey !== row.original.targetKey
      );
      if (invalidTargetChangeOnCallRow) {
        toast.error("Target cannot be changed for call-linked to-dos.");
        return;
      }

      type OpResult = { kind: "edit" | "new"; row: BulkTodoDraftRow; ok: boolean };
      const operationQueue: Array<{ kind: "edit" | "new"; row: BulkTodoDraftRow; run: () => Promise<OpResult> }> = [
        ...changedCompleteEditRows.map((row) => ({
          kind: "edit" as const,
          row,
          run: async (): Promise<OpResult> => {
            const [targetType, targetId] = row.targetKey.split(":");
            const selectedHouseholder = targetType === "householder" ? householdersById.get(targetId) : undefined;
            const slot0 = row.slots[0] ?? "";
            const slot1 = row.slots[1] ?? "";
            const publisherId = slot0 && !isGuestSlotToken(slot0) ? slot0 : null;
            const partnerId = slot1 && !isGuestSlotToken(slot1) ? slot1 : null;
            const publisherGuestName = slot0 && isGuestSlotToken(slot0) ? getGuestNameFromSlot(slot0) : null;
            const partnerGuestName = slot1 && isGuestSlotToken(slot1) ? getGuestNameFromSlot(slot1) : null;
            const ok = await updateTodoForBulkEdit(row.sourceTodoId as string, {
              establishment_id:
                targetType === "establishment"
                  ? targetId || null
                  : selectedHouseholder?.establishment_id ?? null,
              householder_id:
                targetType === "householder" ? targetId || null : null,
              body: row.body.trim(),
              deadline_date: row.dueDate ?? null,
              publisher_id: publisherId,
              partner_id: partnerId,
              publisher_guest_name: publisherGuestName,
              partner_guest_name: partnerGuestName,
            });
            return { kind: "edit", row, ok };
          },
        })),
        ...completeNewRows.map((row) => ({
          kind: "new" as const,
          row,
          run: async (): Promise<OpResult> => {
            const [targetType, targetId] = row.targetKey.split(":");
            const selectedHouseholder = targetType === "householder" ? householdersById.get(targetId) : undefined;
            const slot0 = row.slots[0] ?? "";
            const slot1 = row.slots[1] ?? "";
            const publisherId = slot0 && !isGuestSlotToken(slot0) ? slot0 : null;
            const partnerId = slot1 && !isGuestSlotToken(slot1) ? slot1 : null;
            const publisherGuestName = slot0 && isGuestSlotToken(slot0) ? getGuestNameFromSlot(slot0) : null;
            const partnerGuestName = slot1 && isGuestSlotToken(slot1) ? getGuestNameFromSlot(slot1) : null;
            const created = await addStandaloneTodo({
              establishment_id:
                targetType === "establishment"
                  ? targetId || null
                  : selectedHouseholder?.establishment_id ?? null,
              householder_id:
                targetType === "householder" ? targetId || null : null,
              body: row.body.trim(),
              deadline_date: row.dueDate ?? null,
              publisher_id: publisherId,
              partner_id: partnerId,
              publisher_guest_name: publisherGuestName,
              partner_guest_name: partnerGuestName,
            });
            return { kind: "new", row, ok: !!created };
          },
        })),
      ];

      const BATCH_SIZE = 8;
      const operationResults: OpResult[] = [];
      for (let i = 0; i < operationQueue.length; i += BATCH_SIZE) {
        const batch = operationQueue.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (op): Promise<OpResult> => {
            try {
              return await op.run();
            } catch {
              return { kind: op.kind, row: op.row, ok: false };
            }
          })
        );
        operationResults.push(...batchResults);
      }

      const successCount = operationResults.filter((item) => item.ok).length;
      const totalOps = operationResults.length;
      const successRowIds = new Set(operationResults.filter((item) => item.ok).map((item) => item.row.id));
      const failedCount = totalOps - successCount;
      const ignoredCount = rows.length - totalOps;
      const successfulEditCount = operationResults.filter((item) => item.ok && item.kind === "edit").length;
      const successfulNewCount = operationResults.filter((item) => item.ok && item.kind === "new").length;

      const remainingRows = rows.filter((row) => !successRowIds.has(row.id));
      setRows(remainingRows);

      const pruneRemovedRowState = (removedIds: Set<string>) => {
        if (removedIds.size === 0) return;
        setCollapsedByRow((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !removedIds.has(id))));
        setTargetPickerOpenByRow((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !removedIds.has(id))));
        setTargetSearchByRow((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !removedIds.has(id))));
        setTargetSearchActiveByRow((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !removedIds.has(id))));
        setTargetFiltersPanelOpenByRow((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !removedIds.has(id))));
        setTargetFiltersByRow((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !removedIds.has(id))));
        setTargetBulkAddModeByRow((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !removedIds.has(id))));
        setTargetBulkSelectedKeysByRow((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !removedIds.has(id))));
        setAssigneeDrawerOpenByRow((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !removedIds.has(id))));
      };
      pruneRemovedRowState(successRowIds);

      if (failedCount === 0) {
        if (successfulEditCount > 0 && successfulNewCount > 0) {
          toast.success(
            ignoredCount > 0
              ? `Updated ${successfulEditCount} and added ${successfulNewCount}. Kept ${ignoredCount} ignored item${ignoredCount > 1 ? "s" : ""}.`
              : `Updated ${successfulEditCount} and added ${successfulNewCount} to-dos.`
          );
        } else if (successfulEditCount > 0) {
          toast.success(
            ignoredCount > 0
              ? `Updated ${successfulEditCount} to-do${successfulEditCount > 1 ? "s" : ""}. Kept ${ignoredCount} ignored item${ignoredCount > 1 ? "s" : ""}.`
              : `Updated ${successfulEditCount} to-do${successfulEditCount > 1 ? "s" : ""}.`
          );
        } else {
          toast.success(
            ignoredCount > 0
              ? `Added ${successfulNewCount} to-do${successfulNewCount > 1 ? "s" : ""}. Kept ${ignoredCount} ignored item${ignoredCount > 1 ? "s" : ""}.`
              : `Added ${successfulNewCount} to-do${successfulNewCount > 1 ? "s" : ""}.`
          );
        }
      } else {
        toast.error(`${failedCount} ready to-do${failedCount > 1 ? "s" : ""} failed. Failed and ignored items are kept.`);
      }

      if (remainingRows.length === 0) {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleSlot = (rowId: string, participantId: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        const exists = row.slots.includes(participantId);
        if (exists) return { ...row, slots: row.slots.filter((id) => id !== participantId) };
        if (row.slots.length >= 2) return row;
        return { ...row, slots: [...row.slots, participantId] };
      })
    );
  };

  const addGuestSlot = (rowId: string, guestName: string) => {
    const normalized = guestName.trim();
    if (!normalized) return;
    const token = toGuestSlotToken(normalized);
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        if (row.slots.length >= 2) return row;
        if (
          row.slots.some((slot) => {
            if (!isGuestSlotToken(slot)) return false;
            return getGuestNameFromSlot(slot).toLowerCase() === normalized.toLowerCase();
          })
        ) {
          return row;
        }
        return { ...row, slots: [...row.slots, token] };
      })
    );
    setExistingGuestNames((prev) => {
      const next = Array.from(new Set([...prev, normalized]));
      try {
        window.localStorage.setItem(GUEST_NAMES_CACHE_KEY, JSON.stringify({ names: next }));
      } catch {}
      return next;
    });
    setAssigneeDrawerOpenByRow((prev) => ({ ...prev, [rowId]: false }));
    setNewGuestNameByRow((prev) => ({ ...prev, [rowId]: "" }));
  };

  const loadGuestNamesForAssignees = async () => {
    try {
      const list = await getDistinctCallGuestNames();
      const names = Array.from(
        new Set(
          list
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter((value) => value.length > 0)
        )
      );
      setExistingGuestNames(names);
      window.localStorage.setItem(GUEST_NAMES_CACHE_KEY, JSON.stringify({ names }));
    } catch (error) {
      console.error("[BulkTodoForm] Failed to load guest names:", error);
    }
  };

  const removeSlot = (rowId: string, slotIndex: number) => {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, slots: row.slots.filter((_, index) => index !== slotIndex) } : row))
    );
  };

  const handlePendingTodoDoneChange = async (todoId: string, checked: boolean) => {
    if (!checked) return;
    const previous = pendingTodosByTarget;
    setPendingTodosByTarget((prev) => {
      const next: Record<string, PendingTodoDisplay[]> = {};
      Object.entries(prev).forEach(([key, items]) => {
        next[key] = items.filter((item) => item.id !== todoId);
      });
      return next;
    });

    const ok = await updateCallTodo(todoId, { is_done: true });
    if (!ok) {
      toast.error("Failed to mark pending to-do as done.");
      setPendingTodosByTarget(previous);
      return;
    }
    setInsightRefreshKey((prev) => prev + 1);
  };

  const getParticipantById = (id: string) => participants.find((participant) => participant.id === id);
  const submittableNewCount = rows.filter((row) => !row.sourceTodoId && !isRowBlank(row) && isRowComplete(row)).length;
  const submittableEditCount = rows.filter((row) => !!row.sourceTodoId && hasRowChanged(row) && isRowComplete(row)).length;
  const submitCount = submittableNewCount + submittableEditCount;
  const canSubmit = !saving && submitCount > 0;

  const resizeTodoBodyField = (element: HTMLTextAreaElement) => {
    element.style.height = "auto";
    const computedStyle = window.getComputedStyle(element);
    const lineHeight = Number.parseFloat(computedStyle.lineHeight || "20") || 20;
    const paddingTop = Number.parseFloat(computedStyle.paddingTop || "0") || 0;
    const paddingBottom = Number.parseFloat(computedStyle.paddingBottom || "0") || 0;
    const borderTop = Number.parseFloat(computedStyle.borderTopWidth || "0") || 0;
    const borderBottom = Number.parseFloat(computedStyle.borderBottomWidth || "0") || 0;
    const maxHeight = lineHeight * 2 + paddingTop + paddingBottom + borderTop + borderBottom;
    const nextHeight = Math.min(element.scrollHeight, maxHeight);
    element.style.height = `${nextHeight}px`;
    element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
  };

  return (
    <form className="space-y-4 pt-2 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]" onSubmit={handleSubmit}>
      {rows.map((row, index) => (
        <div
          key={row.id}
          className={
            "rounded-lg border p-3 space-y-3 " +
            (
              (row.sourceTodoId && hasRowChanged(row) && isRowComplete(row)) ||
              (!row.sourceTodoId && !isRowBlank(row) && isRowComplete(row))
                ? "border-emerald-400/70 bg-emerald-500/10 shadow-[0_0_0_1px_rgba(16,185,129,0.25),0_8px_22px_-16px_rgba(16,185,129,0.65)]"
                : ""
            )
          }
        >
          <div
            className="flex items-center justify-between cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() =>
              setCollapsedByRow((prev) => ({ ...prev, [row.id]: !prev[row.id] }))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setCollapsedByRow((prev) => ({ ...prev, [row.id]: !prev[row.id] }));
              }
            }}
            aria-label={collapsedByRow[row.id] ? "Expand to-do card" : "Collapse to-do card"}
          >
            <div className="min-w-0 pr-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-sm font-medium truncate min-w-0">
                  {getRowTargetLabel(row, "Select establishment or contact")}
                </p>
                {getRowHeaderStatuses(row).length > 0 ? (
                  <div className="flex items-center gap-1 shrink-0">
                    {getRowHeaderStatuses(row).map((status) => (
                      <span
                        key={`${row.id}-status-dot-${status}`}
                        className={`h-1.5 w-1.5 rounded-full ${getStatusDotColorClass(status)}`}
                        title={formatStatusText(status)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              <p
                className={`text-[11px] ${
                  row.sourceTodoId ? getStatusTitleColor("return_visit") : getStatusTitleColor("bible_study")
                }`}
              >
                {row.sourceTodoId ? "(edit)" : "(new)"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  setCollapsedByRow((prev) => ({ ...prev, [row.id]: !prev[row.id] }));
                }}
                aria-label={collapsedByRow[row.id] ? "Expand to-do card" : "Collapse to-do card"}
              >
                {collapsedByRow[row.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  removeRow(row.id);
                }}
                aria-label={`Remove to-do ${index + 1} from form`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {collapsedByRow[row.id] ? (
            <div className="space-y-2 text-sm">
              {(() => {
                const [targetType, targetId] = row.targetKey.split(":");
                const establishment = targetType === "establishment" ? establishmentById.get(targetId) : null;
                const householder = targetType === "householder" ? householdersById.get(targetId) : null;
                const status = establishment
                  ? (establishment.publisher_id ? "personal_territory" : getBestStatus(establishment.statuses || []))
                  : householder?.status || "";
                const targetName = establishment
                  ? establishment.name
                  : householder
                    ? `${householder.name}${householder.establishment_name ? ` - ${householder.establishment_name}` : ""}`
                    : "No target selected";
                return (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate">{targetName}</p>
                      {status ? <VisitStatusBadge status={status} label={formatStatusText(status)} /> : null}
                    </div>
                    <p className="text-muted-foreground break-words">
                      {row.body.trim() || "No to-do text yet"}
                    </p>
                  </>
                );
              })()}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center">
                  {row.slots.length > 0 ? (
                    row.slots.map((slotValue, slotIndex) => {
                      const isGuest = isGuestSlotToken(slotValue);
                      const guestName = getGuestNameFromSlot(slotValue);
                      const selected = !isGuest ? getParticipantById(slotValue) : undefined;
                      const fullName = isGuest
                        ? guestName || "Guest"
                        : selected
                          ? `${selected.first_name} ${selected.last_name}`
                          : "Publisher";
                      return (
                        <Avatar key={`${row.id}-summary-avatar-${slotValue}-${slotIndex}`} className={`h-6 w-6 ring-1 ring-background ${slotIndex > 0 ? "-ml-2" : ""}`}>
                          {!isGuest && selected?.avatar_url ? <AvatarImage src={selected.avatar_url} alt={fullName} /> : null}
                          <AvatarFallback
                            className={isGuest ? "text-xs bg-amber-500/25 text-amber-800 dark:bg-amber-500/30 dark:text-amber-200 ring-1 ring-amber-500/50 dark:ring-amber-400/40" : "text-xs"}
                          >
                            {getInitialsFromName(fullName)}
                          </AvatarFallback>
                        </Avatar>
                      );
                    })
                  ) : (
                    <span className="text-xs text-muted-foreground">No assignees</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {row.dueDate ? `Due ${new Date(`${row.dueDate}T00:00:00`).toLocaleDateString()}` : "No due date"}
                </span>
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-1">
                <Label>To-Do</Label>
                <Textarea
                  value={row.body}
                  onChange={(e) => updateRow(row.id, { body: e.target.value })}
                  onInput={(e) => resizeTodoBodyField(e.currentTarget)}
                  ref={(element) => {
                    if (element) {
                      resizeTodoBodyField(element);
                    }
                  }}
                  placeholder="What needs to be done?"
                  rows={1}
                  className="min-h-10 h-10 resize-none leading-5"
                />
              </div>

              <div className="grid gap-1">
                <Label>Publishers</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {row.slots.map((slotValue, slotIndex) => {
                    const isGuest = isGuestSlotToken(slotValue);
                    const guestName = getGuestNameFromSlot(slotValue);
                    const selected = !isGuest ? getParticipantById(slotValue) : undefined;
                    const fullName = isGuest
                      ? guestName || "Guest"
                      : selected
                        ? `${selected.first_name} ${selected.last_name}`
                        : "Publisher";
                    return (
                      <div key={`${row.id}-slot-${slotValue}-${slotIndex}`} className="flex items-center gap-2 bg-muted px-2 py-1.5 rounded-md">
                        <Avatar className="h-6 w-6 shrink-0">
                          {!isGuest && selected?.avatar_url ? <AvatarImage src={selected.avatar_url} alt={fullName} /> : null}
                          <AvatarFallback
                            className={isGuest ? "text-xs bg-amber-500/25 text-amber-800 dark:bg-amber-500/30 dark:text-amber-200 ring-1 ring-amber-500/50 dark:ring-amber-400/40" : "text-xs"}
                          >
                            {getInitialsFromName(fullName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{fullName}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 shrink-0"
                          onClick={() => removeSlot(row.id, slotIndex)}
                          aria-label="Remove"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })}
                  {row.slots.length < 2 && (
                    <Drawer
                      open={!!assigneeDrawerOpenByRow[row.id]}
                      onOpenChange={(open) => {
                        setAssigneeDrawerOpenByRow((prev) => ({ ...prev, [row.id]: open }));
                        if (open) {
                          void loadGuestNamesForAssignees();
                        } else {
                          setNewGuestNameByRow((prev) => ({ ...prev, [row.id]: "" }));
                        }
                      }}
                    >
                      <DrawerTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-full shrink-0"
                          aria-label="Add publisher"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DrawerTrigger>
                      <DrawerContent className="max-h-[70vh]">
                        <DrawerHeader className="text-center">
                          <DrawerTitle>Select publisher or guest</DrawerTitle>
                        </DrawerHeader>
                        <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] space-y-6">
                          <section>
                            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                              Publishers
                            </h3>
                            {participants.length > 0 ? (
                              <ul className="space-y-1">
                                {participants
                                  .filter((participant) => !row.slots.includes(participant.id))
                                  .map((participant) => (
                                    <li key={participant.id}>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        className="w-full justify-start gap-2 h-12 px-3"
                                        onClick={() => {
                                          toggleSlot(row.id, participant.id);
                                          setAssigneeDrawerOpenByRow((prev) => ({ ...prev, [row.id]: false }));
                                        }}
                                      >
                                        <Avatar className="h-8 w-8">
                                          <AvatarImage src={participant.avatar_url} />
                                          <AvatarFallback className="text-xs">
                                            {getInitialsFromName(`${participant.first_name} ${participant.last_name}`)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <span>
                                          {participant.first_name} {participant.last_name}
                                        </span>
                                      </Button>
                                    </li>
                                  ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted-foreground py-2">No publishers available</p>
                            )}
                          </section>

                          <section>
                            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                              Guest
                            </h3>
                            <div className="space-y-2">
                              {existingGuestNames
                                .filter((name) => {
                                  const token = toGuestSlotToken(name);
                                  return !row.slots.includes(token);
                                })
                                .map((name) => (
                                  <Button
                                    key={`${row.id}-guest-${name}`}
                                    type="button"
                                    variant="ghost"
                                    className="w-full justify-start gap-2 h-12 px-3"
                                    onClick={() => addGuestSlot(row.id, name)}
                                  >
                                    <Avatar className="h-8 w-8 shrink-0">
                                      <AvatarFallback className="text-xs bg-amber-500/25 text-amber-800 dark:bg-amber-500/30 dark:text-amber-200 ring-1 ring-amber-500/50 dark:ring-amber-400/40">
                                        {getInitialsFromName(name)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span>{name}</span>
                                  </Button>
                                ))}
                              <div className="flex gap-2 pt-1">
                                <Input
                                  placeholder="New guest name"
                                  value={newGuestNameByRow[row.id] || ""}
                                  onChange={(e) =>
                                    setNewGuestNameByRow((prev) => ({ ...prev, [row.id]: e.target.value }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      addGuestSlot(row.id, newGuestNameByRow[row.id] || "");
                                    }
                                  }}
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => addGuestSlot(row.id, newGuestNameByRow[row.id] || "")}
                                  disabled={!(newGuestNameByRow[row.id] || "").trim()}
                                >
                                  Add
                                </Button>
                              </div>
                            </div>
                          </section>
                        </div>
                      </DrawerContent>
                    </Drawer>
                  )}
                </div>
              </div>

              <div className="grid gap-1">
                <Label>Due Date</Label>
                <DatePicker
                  date={parseDateString(row.dueDate)}
                  onSelect={(date) => updateRow(row.id, { dueDate: date ? toLocalDateString(date) : null })}
                  placeholder="Deadline date"
                  mobileShowActions
                  mobileAllowClear
                  defaultToTodayOnOpen
                />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                {(() => {
                  if (row.targetKey === "none") return <span>Last Update: No target selected yet.</span>;
                  const insight = latestInsightByTarget[row.targetKey];
                  if (!insight) return <span>Last Update: No recent update.</span>;
                  const label = insight.source === "todo" ? "Last To-Do" : "Last Call";
                  return (
                    <>
                      <span>{label}</span>
                      {row.targetKey.startsWith("establishment:") && insight.householderName ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-5 px-1.5 text-[10px] capitalize",
                            getHouseholderStatusBadgeClass(insight.householderStatus || "")
                          )}
                        >
                          {insight.householderName}
                        </Badge>
                      ) : null}
                      <span>{insight.text}</span>
                      {insight.dateValue ? (
                        <span className={cn("font-medium", getDateAgeColorClass(insight.dateValue))}>
                          {formatTodoDate(insight.dateValue)}
                        </span>
                      ) : null}
                    </>
                  );
                })()}
              </div>

              {row.targetKey !== "none" && (pendingTodosByTarget[row.targetKey]?.length ?? 0) > 0 ? (
                <div className="mt-2 space-y-1.5">
                  <p className="text-xs text-muted-foreground">Pending To-Dos</p>
                  <ul className="space-y-1">
                    {(pendingTodosByTarget[row.targetKey] || []).map((pendingTodo) => {
                      const assigneeIds = [pendingTodo.publisherId, pendingTodo.partnerId]
                        .filter((value): value is string => !!value)
                        .filter((value, idx, arr) => arr.indexOf(value) === idx)
                        .slice(0, 2);
                      const showContactBadgeOnEstablishment =
                        row.targetKey.startsWith("establishment:") && !!pendingTodo.householderName;
                      return (
                        <li key={`${row.id}-pending-${pendingTodo.id}`} className="rounded-md px-1 py-1 text-xs">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <Checkbox
                              checked={false}
                              onCheckedChange={(checked) => handlePendingTodoDoneChange(pendingTodo.id, checked === true)}
                              className="shrink-0"
                              aria-label="Mark pending to-do as done"
                            />
                            {assigneeIds.length > 0 ? (
                              <div className="inline-flex items-center gap-1 shrink-0">
                                {assigneeIds.map((id) => {
                                  const profile = participantsById.get(id);
                                  const fullName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Assigned";
                                  return (
                                    <Avatar key={`${pendingTodo.id}-${id}`} className="h-5 w-5 border border-border/70">
                                      {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt={fullName} /> : null}
                                      <AvatarFallback className="text-[10px]">{getInitialsFromName(fullName || "A")}</AvatarFallback>
                                    </Avatar>
                                  );
                                })}
                              </div>
                            ) : null}
                            <div className="min-w-0 flex-1 flex items-center gap-1">
                              {showContactBadgeOnEstablishment ? (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "h-5 px-1.5 text-[10px] capitalize shrink-0",
                                    getHouseholderStatusBadgeClass(pendingTodo.householderStatus || "")
                                  )}
                                >
                                  {pendingTodo.householderName}
                                </Badge>
                              ) : null}
                              <span className="line-clamp-2 text-foreground/90 break-words">{pendingTodo.body || "No to-do text."}</span>
                            </div>
                            {pendingTodo.deadlineDate ? (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {formatTodoDate(pendingTodo.deadlineDate)}
                              </span>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              {row.sourceTodoId ? (
                <div className="mt-3 flex justify-end border-t border-border/60 pt-2">
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={deletingSourceTodoRowId === row.id}
                    aria-label={
                      deletingSourceTodoRowId === row.id ? "Deleting to-do" : "Delete to-do permanently"
                    }
                    title="Delete to-do"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDeleteSourceTodoRow(row);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2">
        {isMobile ? (
          <Drawer
            open={!!targetPickerOpenByRow[NEW_TODO_PICKER_ROW_ID]}
            onOpenChange={(open) => {
              setTargetPickerOpenByRow((prev) => ({ ...prev, [NEW_TODO_PICKER_ROW_ID]: open }));
            }}
          >
            <DrawerTrigger asChild>
              <Button type="button" variant="outline" onClick={addRow}>
                <Plus className="h-4 w-4 mr-1" />
                Add Another To-Do
              </Button>
            </DrawerTrigger>
            <DrawerContent className="max-h-[70vh]">
              <DrawerHeader className="text-center">
                <DrawerTitle>Select establishment or contact</DrawerTitle>
              </DrawerHeader>
              <div className="px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+24px)] space-y-2 overflow-y-auto">
                {renderTargetPickerControls({
                  id: NEW_TODO_PICKER_ROW_ID,
                  targetKey: "none",
                  body: "",
                  slots: [],
                  dueDate: null,
                })}
                {renderTargetPickerList(
                  {
                    id: NEW_TODO_PICKER_ROW_ID,
                    targetKey: "none",
                    body: "",
                    slots: [],
                    dueDate: null,
                  },
                  "max-h-[42vh] overflow-y-auto space-y-1"
                )}
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <Popover
            open={!!targetPickerOpenByRow[NEW_TODO_PICKER_ROW_ID]}
            onOpenChange={(open) => {
              setTargetPickerOpenByRow((prev) => ({ ...prev, [NEW_TODO_PICKER_ROW_ID]: open }));
            }}
          >
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" onClick={addRow}>
                <Plus className="h-4 w-4 mr-1" />
                Add Another To-Do
              </Button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-[min(92vw,420px)] p-2">
              <div className="space-y-2">
                {renderTargetPickerControls({
                  id: NEW_TODO_PICKER_ROW_ID,
                  targetKey: "none",
                  body: "",
                  slots: [],
                  dueDate: null,
                })}
                {renderTargetPickerList(
                  {
                    id: NEW_TODO_PICKER_ROW_ID,
                    targetKey: "none",
                    body: "",
                    slots: [],
                    dueDate: null,
                  },
                  "max-h-[280px] overflow-y-auto space-y-1"
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
        {rows.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="text-red-400 border-red-500/40 hover:text-red-300 hover:border-red-400/60"
            onClick={() => setClearConfirmOpen(true)}
          >
            Clear
          </Button>
        ) : null}
      </div>

      <Drawer open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <DrawerContent
          className="flex flex-col"
          style={{ maxHeight: "50vh", height: "50vh" }}
        >
          <div className="flex flex-1 flex-col justify-center px-4 pt-2 min-h-0">
            <DrawerHeader className="pt-6 px-4 pb-2 text-center">
              <DrawerTitle className="text-center">Clear all to-dos?</DrawerTitle>
            </DrawerHeader>
            <DrawerFooter className="flex flex-col gap-3 p-0 pt-4 pb-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full h-12"
                onClick={() => setClearConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="w-full h-12"
                onClick={clearAllRows}
              >
                Clear All
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer
        open={!!duplicateAddPrompt}
        onOpenChange={(open) => {
          if (!open) setDuplicateAddPrompt(null);
        }}
      >
        <DrawerContent className="max-h-[55vh]">
          <DrawerHeader className="text-center">
            <DrawerTitle>Duplicate target detected</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Some selected establishment/contact already exists in this form.
            </p>
            {duplicateAddPrompt?.duplicateTargetKeys?.length ? (
              <div className="rounded-md border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-medium text-foreground/90 mb-2">
                  Duplicates ({duplicateAddPrompt.duplicateTargetKeys.length})
                </p>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {duplicateAddPrompt.duplicateTargetKeys.slice(0, 4).map((targetKey) => {
                    const option = targetOptions.find((item) => item.key === targetKey);
                    return <li key={`dup-${targetKey}`}>{option?.label || targetKey}</li>;
                  })}
                  {duplicateAddPrompt.duplicateTargetKeys.length > 4 ? (
                    <li>+{duplicateAddPrompt.duplicateTargetKeys.length - 4} more</li>
                  ) : null}
                </ul>
              </div>
            ) : null}
            <DrawerFooter className="p-0 pt-1">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full h-12"
                onClick={() => resolveDuplicateAddPrompt("ignore-duplicates")}
              >
                Ignore Duplicates
              </Button>
              <Button
                type="button"
                size="lg"
                className="w-full h-12"
                onClick={() => resolveDuplicateAddPrompt("add-anyway")}
              >
                Add Anyway
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      <div className="flex justify-end">
        <Button type="submit" disabled={!canSubmit}>
          {saving
            ? "Submitting..."
            : (() => {
                const parts: string[] = [];
                if (submittableEditCount > 0) parts.push(`${submittableEditCount} Edit`);
                if (submittableNewCount > 0) parts.push(`${submittableNewCount} New`);
                const detail = parts.length > 0 ? `(${parts.join(", ")})` : "";
                return `Submit Ready To-Do${submitCount > 1 ? "s" : ""} ${detail}`.trim();
              })()}
        </Button>
      </div>
    </form>
  );
}

