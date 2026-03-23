"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "@/components/ui/sonner";
import { ChevronDown, ChevronUp, Plus, Search, Trash2, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { addStandaloneTodo, getBwiParticipants, updateTodoForBulkEdit, type EstablishmentWithDetails, type HouseholderWithDetails } from "@/lib/db/business";
import { getInitialsFromName } from "@/lib/utils/visit-history-ui";
import { getBestStatus } from "@/lib/utils/status-hierarchy";
import { formatStatusText } from "@/lib/utils/formatters";
import { VisitStatusBadge } from "@/components/visit/VisitStatusBadge";
import { useMobile } from "@/lib/hooks/use-mobile";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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

const DRAFT_STORAGE_KEY = "business:bulk-todos:draft:v1";

const createDraftRow = (): BulkTodoDraftRow => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  targetKey: "none",
  body: "",
  slots: [],
  dueDate: null,
});

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
    case "closed":
      return 8;
    case "declined_rack":
    case "do_not_call":
      return 9;
    case "inappropriate":
      return 10;
    default:
      return 11;
  }
};

export function BulkTodoForm({
  establishments,
  householders,
  onSaved,
  onDraftKindChange,
}: BulkTodoFormProps) {
  const isMobile = useMobile();
  const [rows, setRows] = useState<BulkTodoDraftRow[]>([createDraftRow()]);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [participants, setParticipants] = useState<
    Array<{ id: string; first_name: string; last_name: string; avatar_url?: string }>
  >([]);
  const [latestVisitorsByEstablishment, setLatestVisitorsByEstablishment] = useState<Record<string, PersonAvatar[]>>({});
  const [collapsedByRow, setCollapsedByRow] = useState<Record<string, boolean>>({});
  const [targetPickerOpenByRow, setTargetPickerOpenByRow] = useState<Record<string, boolean>>({});
  const [targetSearchByRow, setTargetSearchByRow] = useState<Record<string, string>>({});
  const [assigneeDrawerOpenByRow, setAssigneeDrawerOpenByRow] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadParticipants = async () => {
      try {
        const list = await getBwiParticipants();
        setParticipants(list);
      } catch (error) {
        console.error("[BulkTodoForm] Failed to load participants:", error);
      }
    };
    loadParticipants();
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        rows?: Array<Partial<BulkTodoDraftRow> & Record<string, unknown>>;
        targetSearchByRow?: Record<string, string>;
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
        setRows(migratedRows.length > 0 ? migratedRows : [createDraftRow()]);
      }
      if (parsed?.targetSearchByRow && typeof parsed.targetSearchByRow === "object") {
        const nextSearchByRow: Record<string, string> = {};
        Object.entries(parsed.targetSearchByRow).forEach(([key, value]) => {
          if (typeof value === "string") nextSearchByRow[key] = value;
        });
        setTargetSearchByRow(nextSearchByRow);
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
      window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ rows, targetSearchByRow }));
    } catch (error) {
      console.error("[BulkTodoForm] Failed to persist draft:", error);
    }
  }, [rows, targetSearchByRow, draftHydrated]);

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
      setRows(normalizedRows.length > 0 ? normalizedRows : [createDraftRow()]);
      setCollapsedByRow({});
      setTargetPickerOpenByRow({});
      setTargetSearchByRow({});
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

  const targetOptions = useMemo(
    () => [
      ...sortedEstablishments
        .filter(
          (establishment): establishment is EstablishmentWithDetails & { id: string } =>
            !!establishment.id && !establishment.publisher_id
        )
        .map((establishment) => ({
          key: `establishment:${establishment.id}`,
          label: establishment.name,
          typeLabel: "Establishment",
          subtitle: establishment.area || "",
          status: establishment.publisher_id ? "personal_territory" : getBestStatus(establishment.statuses || []),
          avatars:
            latestVisitorsByEstablishment[establishment.id] && latestVisitorsByEstablishment[establishment.id].length > 0
              ? latestVisitorsByEstablishment[establishment.id]
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
          typeLabel: "Contact",
          subtitle: parentName,
          status: householder.status,
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
    [sortedEstablishments, sortedHouseholders, latestVisitorsByEstablishment]
  );

  useEffect(() => {
    const establishmentIds = sortedEstablishments
      .filter((establishment): establishment is EstablishmentWithDetails & { id: string } => !!establishment.id)
      .map((establishment) => establishment.id);
    if (establishmentIds.length === 0) {
      setLatestVisitorsByEstablishment({});
      return;
    }

    let cancelled = false;
    const loadLatestVisitors = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        await supabase.auth.getSession().catch(() => {});
        const { data, error } = await supabase
          .from("calls")
          .select(
            "establishment_id, visit_date, created_at, publisher:profiles!calls_publisher_id_fkey(id, first_name, last_name, avatar_url), partner:profiles!calls_partner_id_fkey(id, first_name, last_name, avatar_url)"
          )
          .in("establishment_id", establishmentIds)
          .order("visit_date", { ascending: false })
          .order("created_at", { ascending: false });
        if (error) throw error;

        const map: Record<string, PersonAvatar[]> = {};
        const seenEstablishments = new Set<string>();

        (data || []).forEach((row: any) => {
          const establishmentId = row.establishment_id as string | null;
          if (!establishmentId || seenEstablishments.has(establishmentId)) return;

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

          const publisher = normalizePerson(row.publisher);
          const partner = normalizePerson(row.partner);
          const visitors = [publisher, partner].filter((value): value is PersonAvatar => !!value);

          if (visitors.length > 0) {
            map[establishmentId] = visitors;
          }
          seenEstablishments.add(establishmentId);
        });

        if (!cancelled) {
          setLatestVisitorsByEstablishment(map);
        }
      } catch (error) {
        console.error("[BulkTodoForm] Failed to load latest establishment visitors:", error);
      }
    };

    loadLatestVisitors();
    return () => {
      cancelled = true;
    };
  }, [sortedEstablishments]);

  const updateRow = (id: string, updates: Partial<BulkTodoDraftRow>) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, createDraftRow()]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => {
      const next = prev.filter((row) => row.id !== id);
      return next.length > 0 ? next : [createDraftRow()];
    });
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
    setAssigneeDrawerOpenByRow((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
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

      const firstInvalidChangedEditIndex = rows.findIndex((row) => !!row.sourceTodoId && hasRowChanged(row) && !isRowComplete(row));
      if (firstInvalidChangedEditIndex >= 0) {
        toast.error(`Please complete required fields for to-do ${firstInvalidChangedEditIndex + 1}.`);
        return;
      }
      const firstInvalidNewIndex = rows.findIndex((row) => !row.sourceTodoId && !isRowBlank(row) && !isRowComplete(row));
      if (firstInvalidNewIndex >= 0) {
        toast.error(`Please complete required fields for to-do ${firstInvalidNewIndex + 1}.`);
        return;
      }

      const invalidTargetChangeOnCallRow = changedEditRows.find(
        (row) => !!row.sourceCallId && !!row.original && row.targetKey !== row.original.targetKey
      );
      if (invalidTargetChangeOnCallRow) {
        toast.error("Target cannot be changed for call-linked to-dos.");
        return;
      }

      const changedCompleteEditRows = changedEditRows.filter(isRowComplete);
      const completeNewRows = newCandidateRows.filter(isRowComplete);

      type OpResult = { kind: "edit" | "new"; row: BulkTodoDraftRow; ok: boolean };
      const updateTasks = changedCompleteEditRows.map(async (row): Promise<OpResult> => {
        const [targetType, targetId] = row.targetKey.split(":");
        const selectedHouseholder = targetType === "householder" ? householdersById.get(targetId) : undefined;
        const publisherId = row.slots[0] ?? null;
        const partnerId = row.slots[1] ?? null;
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
        });
        return { kind: "edit", row, ok };
      });

      const createTasks = completeNewRows.map(async (row): Promise<OpResult> => {
        const [targetType, targetId] = row.targetKey.split(":");
        const selectedHouseholder = targetType === "householder" ? householdersById.get(targetId) : undefined;
        const publisherId = row.slots[0] ?? null;
        const partnerId = row.slots[1] ?? null;
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
        });
        return { kind: "new", row, ok: !!created };
      });

      const settled = await Promise.allSettled([...updateTasks, ...createTasks]);
      const operationResults: OpResult[] = settled.map((result, index) => {
        if (result.status === "fulfilled") return result.value;
        const opList = [...changedCompleteEditRows, ...completeNewRows];
        const row = opList[index];
        const kind: "edit" | "new" = index < changedCompleteEditRows.length ? "edit" : "new";
        return { kind, row, ok: false };
      });

      const successCount = operationResults.filter((item) => item.ok).length;
      const totalOps = operationResults.length;
      if (successCount === totalOps) {
        const editCount = changedCompleteEditRows.length;
        const newCount = completeNewRows.length;
        if (editCount > 0 && newCount > 0) {
          toast.success(`Updated ${editCount} and added ${newCount} to-dos.`);
        } else if (editCount > 0) {
          toast.success(`Updated ${editCount} to-do${editCount > 1 ? "s" : ""}.`);
        } else {
          toast.success(`Added ${newCount} to-do${newCount > 1 ? "s" : ""}.`);
        }
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
        setRows([createDraftRow()]);
        onSaved();
        return;
      }

      const successRowIds = new Set(operationResults.filter((item) => item.ok).map((item) => item.row.id));
      setRows((prev) =>
        prev
          .filter((row) => {
            if (successRowIds.has(row.id) && !row.sourceTodoId) return false;
            return true;
          })
          .map((row) => {
            if (!successRowIds.has(row.id) || !row.sourceTodoId) return row;
            const normalized = normalizeRowForCompare(row);
            return {
              ...row,
              original: {
                targetKey: normalized.targetKey,
                body: normalized.body,
                slots: normalized.slots,
                dueDate: normalized.dueDate,
              },
            };
          })
      );

      const failedCount = totalOps - successCount;
      toast.error(`${failedCount} to-do${failedCount > 1 ? "s" : ""} failed. Keeping failed items in draft.`);
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

  const removeSlot = (rowId: string, slotIndex: number) => {
    setRows((prev) =>
      prev.map((row) => (row.id === rowId ? { ...row, slots: row.slots.filter((_, index) => index !== slotIndex) } : row))
    );
  };

  const getParticipantById = (id: string) => participants.find((participant) => participant.id === id);
  const submittableNewCount = rows.filter((row) => !row.sourceTodoId && !isRowBlank(row) && isRowComplete(row)).length;
  const submittableEditCount = rows.filter((row) => !!row.sourceTodoId && hasRowChanged(row) && isRowComplete(row)).length;
  const submitCount = submittableNewCount + submittableEditCount;
  const canSubmit = !saving && submitCount > 0;

  return (
    <form className="space-y-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]" onSubmit={handleSubmit}>
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
              <p className="text-sm font-medium truncate">
                {(() => {
                  if (row.targetKey === "none") return `To-Do ${index + 1}`;
                  const [targetType, targetId] = row.targetKey.split(":");
                  if (targetType === "establishment") {
                    return establishmentById.get(targetId)?.name || `To-Do ${index + 1}`;
                  }
                  const householder = householdersById.get(targetId);
                  return householder?.name || `To-Do ${index + 1}`;
                })()}
              </p>
              <p className="text-[11px] text-muted-foreground">
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
                aria-label={`Remove to-do ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
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
                    row.slots.map((participantId, slotIndex) => {
                      const selected = getParticipantById(participantId);
                      const fullName = selected ? `${selected.first_name} ${selected.last_name}` : "Publisher";
                      return (
                        <Avatar key={`${row.id}-summary-avatar-${participantId}`} className={`h-6 w-6 ring-1 ring-background ${slotIndex > 0 ? "-ml-2" : ""}`}>
                          {selected?.avatar_url ? <AvatarImage src={selected.avatar_url} alt={fullName} /> : null}
                          <AvatarFallback className="text-xs">{getInitialsFromName(fullName)}</AvatarFallback>
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
                <Label>Establishment / Contact</Label>
                {row.sourceTodoId ? (
                  <Button type="button" variant="outline" className="justify-start font-normal" disabled>
                    {(() => {
                      if (row.targetKey === "none") return "No target";
                      const [targetType, targetId] = row.targetKey.split(":");
                      if (targetType === "establishment") {
                        return establishmentById.get(targetId)?.name || "Selected establishment";
                      }
                      const hh = householdersById.get(targetId);
                      return hh ? `${hh.name}${hh.establishment_name ? ` - ${hh.establishment_name}` : ""}` : "Selected contact";
                    })()}
                  </Button>
                ) : isMobile ? (
                  <Drawer
                    open={!!targetPickerOpenByRow[row.id]}
                    onOpenChange={(open) => {
                      setTargetPickerOpenByRow((prev) => ({ ...prev, [row.id]: open }));
                    }}
                  >
                    <DrawerTrigger asChild>
                      <Button type="button" variant="outline" className="justify-start font-normal">
                        {(() => {
                          if (row.targetKey === "none") return "Select establishment or contact";
                          const [targetType, targetId] = row.targetKey.split(":");
                          if (targetType === "establishment") {
                            return establishmentById.get(targetId)?.name || "Selected establishment";
                          }
                          const hh = householdersById.get(targetId);
                          return hh ? `${hh.name}${hh.establishment_name ? ` - ${hh.establishment_name}` : ""}` : "Selected contact";
                        })()}
                      </Button>
                    </DrawerTrigger>
                    <DrawerContent className="max-h-[70vh]">
                      <DrawerHeader className="text-center">
                        <DrawerTitle>Select establishment or contact</DrawerTitle>
                      </DrawerHeader>
                      <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] space-y-2 overflow-y-auto">
                        <div className="flex items-center gap-2 border rounded-md px-2 py-1">
                          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                          <Input
                            value={targetSearchByRow[row.id] || ""}
                            onChange={(e) => setTargetSearchByRow((prev) => ({ ...prev, [row.id]: e.target.value }))}
                            placeholder="Search establishment or contact..."
                            className="border-0 bg-transparent dark:bg-transparent focus-visible:ring-0 focus-visible:border-transparent px-0 h-8 shadow-none"
                          />
                        </div>
                        <div className="max-h-[42vh] overflow-y-auto space-y-1" style={{ overscrollBehavior: "contain", touchAction: "pan-y", WebkitOverflowScrolling: "touch" as any }}>
                          {targetOptions
                            .filter((option) => {
                              const term = (targetSearchByRow[row.id] || "").trim().toLowerCase();
                              if (!term) return true;
                              return option.searchText.includes(term);
                            })
                            .map((option) => (
                              <Button
                                key={option.key}
                                type="button"
                                variant={row.targetKey === option.key ? "secondary" : "ghost"}
                                className="w-full justify-start h-auto py-2 px-2"
                                onClick={() => {
                                  updateRow(row.id, { targetKey: option.key });
                                  setTargetPickerOpenByRow((prev) => ({ ...prev, [row.id]: false }));
                                }}
                              >
                                <div className="text-left min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-sm truncate min-w-0">{option.label}</div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {"avatars" in option && Array.isArray(option.avatars) && option.avatars.length > 0 ? (
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
                                      {"status" in option && option.status ? (
                                        <VisitStatusBadge
                                          status={option.status}
                                          label={formatStatusText(option.status)}
                                          className="shrink-0"
                                        />
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground truncate min-w-0 mt-0.5">
                                    {option.typeLabel}
                                    {"subtitle" in option && option.subtitle ? ` - ${option.subtitle}` : ""}
                                  </div>
                                </div>
                              </Button>
                            ))}
                        </div>
                      </div>
                    </DrawerContent>
                  </Drawer>
                ) : (
                  <Popover
                    open={!!targetPickerOpenByRow[row.id]}
                    onOpenChange={(open) => {
                      setTargetPickerOpenByRow((prev) => ({ ...prev, [row.id]: open }));
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button type="button" variant="outline" className="justify-start font-normal">
                        {(() => {
                          if (row.targetKey === "none") return "Select establishment or contact";
                          const [targetType, targetId] = row.targetKey.split(":");
                          if (targetType === "establishment") {
                            return establishmentById.get(targetId)?.name || "Selected establishment";
                          }
                          const hh = householdersById.get(targetId);
                          return hh ? `${hh.name}${hh.establishment_name ? ` - ${hh.establishment_name}` : ""}` : "Selected contact";
                        })()}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="center" className="w-[min(92vw,420px)] p-2">
                      <div className="flex items-center gap-2 border rounded-md px-2 py-1 mb-2">
                        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Input
                          value={targetSearchByRow[row.id] || ""}
                          onChange={(e) => setTargetSearchByRow((prev) => ({ ...prev, [row.id]: e.target.value }))}
                          placeholder="Search establishment or contact..."
                          className="border-0 bg-transparent dark:bg-transparent focus-visible:ring-0 focus-visible:border-transparent px-0 h-8 shadow-none"
                        />
                      </div>
                      <div className="max-h-[280px] overflow-y-auto space-y-1" style={{ overscrollBehavior: "contain", touchAction: "pan-y", WebkitOverflowScrolling: "touch" as any }}>
                        {targetOptions
                          .filter((option) => {
                            const term = (targetSearchByRow[row.id] || "").trim().toLowerCase();
                            if (!term) return true;
                            return option.searchText.includes(term);
                          })
                          .map((option) => (
                            <Button
                              key={option.key}
                              type="button"
                              variant={row.targetKey === option.key ? "secondary" : "ghost"}
                              className="w-full justify-start h-auto py-2 px-2"
                              onClick={() => {
                                updateRow(row.id, { targetKey: option.key });
                                setTargetPickerOpenByRow((prev) => ({ ...prev, [row.id]: false }));
                              }}
                            >
                              <div className="text-left min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-sm truncate min-w-0">{option.label}</div>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {"avatars" in option && Array.isArray(option.avatars) && option.avatars.length > 0 ? (
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
                                    {"status" in option && option.status ? (
                                      <VisitStatusBadge
                                        status={option.status}
                                        label={formatStatusText(option.status)}
                                        className="shrink-0"
                                      />
                                    ) : null}
                                  </div>
                                </div>
                                <div className="text-xs text-muted-foreground truncate min-w-0 mt-0.5">
                                  {option.typeLabel}
                                  {"subtitle" in option && option.subtitle ? ` - ${option.subtitle}` : ""}
                                </div>
                              </div>
                            </Button>
                          ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>

              <div className="grid gap-1">
                <Label>To-Do</Label>
                <Input
                  value={row.body}
                  onChange={(e) => updateRow(row.id, { body: e.target.value })}
                  placeholder="What needs to be done?"
                />
              </div>

              <div className="grid gap-1">
                <Label>Publishers</Label>
                <div className="flex flex-wrap items-center gap-2">
                  {row.slots.map((participantId, slotIndex) => {
                    const selected = getParticipantById(participantId);
                    const fullName = selected ? `${selected.first_name} ${selected.last_name}` : "Publisher";
                    return (
                      <div key={`${row.id}-slot-${participantId}`} className="flex items-center gap-2 bg-muted px-2 py-1.5 rounded-md">
                        <Avatar className="h-6 w-6 shrink-0">
                          {selected?.avatar_url ? <AvatarImage src={selected.avatar_url} alt={fullName} /> : null}
                          <AvatarFallback className="text-xs">{getInitialsFromName(fullName)}</AvatarFallback>
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
                      onOpenChange={(open) => setAssigneeDrawerOpenByRow((prev) => ({ ...prev, [row.id]: open }))}
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
                          <DrawerTitle>Select publisher</DrawerTitle>
                        </DrawerHeader>
                        <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+24px)]">
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
                        </div>
                      </DrawerContent>
                    </Drawer>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  First selected is Publisher, second is Partner.
                </p>
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
            </>
          )}
        </div>
      ))}

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={addRow}>
          <Plus className="h-4 w-4 mr-1" />
          Add Another To-Do
        </Button>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={!canSubmit}>
          {saving
            ? "Submitting..."
            : (() => {
                const parts: string[] = [];
                if (submittableEditCount > 0) parts.push(`${submittableEditCount} Edit`);
                if (submittableNewCount > 0) parts.push(`${submittableNewCount} New`);
                const detail = parts.length > 0 ? `(${parts.join(", ")})` : "";
                return `Submit ${submitCount} To-Do${submitCount > 1 ? "s" : ""} ${detail}`.trim();
              })()}
        </Button>
      </div>
    </form>
  );
}

