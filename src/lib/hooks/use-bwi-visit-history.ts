"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { VisitRecord } from "@/lib/utils/visit-history";
import { dedupeAndSortVisits } from "@/lib/utils/visit-history";
import { getBwiVisitsPage, getRecentBwiVisits } from "@/lib/db/visit-history";
import { formatStatusText } from "@/lib/utils/formatters";
import { getVisitSearchText, visitDayKey } from "@/lib/utils/visit-history-ui";
import { buildFilterBadges, type FilterBadge } from "@/lib/utils/filter-badges";
import type { VisitAssigneeFilterOption, VisitFilters } from "@/components/visit/VisitFiltersForm";
import { businessEventBus } from "@/lib/events/business-events";
import { cacheDelete } from "@/lib/offline/store";
import { format } from "date-fns";

function formatYmdLabel(ymd: string): string {
  const parts = ymd.split("-").map((n) => Number.parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return ymd;
  const [y, m, d] = parts;
  return format(new Date(y, m - 1, d), "MMM d, yyyy");
}

interface UseBwiVisitHistoryOptions {
  userId: string;
  recentLimit?: number;
  pageSize?: number;
  enabled?: boolean;
}

interface VisitAddedBusPayload {
  id: string | number;
  visit_date?: string;
  establishment_id?: string;
  householder_id?: string | null;
  note?: string;
  publisher_id?: string;
  establishment?: { name?: string; status?: string };
  householder?: { name?: string; status?: string };
  publisher?: { first_name?: string; last_name?: string; avatar_url?: string | null };
  partner?: { first_name?: string; last_name?: string; avatar_url?: string | null };
}

export function useBwiVisitHistory({
  userId,
  recentLimit = 5,
  pageSize = 20,
  enabled = true
}: UseBwiVisitHistoryOptions) {
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [allVisitsRaw, setAllVisitsRaw] = useState<VisitRecord[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState<VisitFilters>({
    search: "",
    statuses: [],
    areas: [],
    assigneeIds: [],
    callDateFrom: null,
    callDateTo: null,
    myUpdatesOnly: false,
    bwiOnly: false,
    householderOnly: false
  });

  const loadInitialVisits = useCallback(
    async (forceRefresh = false, options?: { suppressLoading?: boolean }) => {
      if (!enabled || !userId) {
        setLoading(false);
        return;
      }
      const suppressLoading = options?.suppressLoading ?? false;
      if (!suppressLoading) setLoading(true);
      try {
        const sortedVisits = await getRecentBwiVisits(recentLimit, forceRefresh);
        setVisits(sortedVisits);
        // Seed full-list state so Calls drawer opens with immediate rows.
        setAllVisitsRaw((prev) =>
          prev.length > 0 ? prev : dedupeAndSortVisits(sortedVisits)
        );
      } catch (error) {
        console.error("Error loading visit history:", error);
      } finally {
        if (!suppressLoading) setLoading(false);
      }
    },
    [enabled, userId, recentLimit]
  );

  const loadAllVisits = useCallback(
    async (
      offset = 0,
      forceRefresh = false,
      options?: { initialLoad?: boolean }
    ) => {
      if (!enabled || !userId) return;
      const initialLoad = options?.initialLoad ?? false;
      if (!initialLoad) setLoadingMore(true);
      try {
        const sortedVisits = await getBwiVisitsPage({ userId, offset, pageSize, forceRefresh });
        if (offset === 0) {
          const next = dedupeAndSortVisits(sortedVisits);
          // Only update if data actually changed to avoid unnecessary re-renders
          setAllVisitsRaw((prev) => {
            // Check if data is the same (same IDs in same order)
            if (
              prev.length === next.length &&
              prev.every((v, i) => v.id === next[i]?.id)
            ) {
              return prev; // No change, return previous to avoid re-render
            }
            return next;
          });
          // Keep hook `visits` aligned for optimistic event handlers + any future consumers
          setVisits(next.slice(0, recentLimit));
        } else {
          // Dedupe after append: concurrent loadMore or overlapping fetches can duplicate rows;
          // merged sort also keeps global order correct across dual-stream pages.
          setAllVisitsRaw((prev) => dedupeAndSortVisits([...prev, ...sortedVisits]));
        }
        setHasMore(sortedVisits.length === pageSize * 2);
      } catch (error) {
        console.error("Error loading more visits:", error);
      } finally {
        if (!initialLoad) setLoadingMore(false);
      }
    },
    [enabled, userId, pageSize, recentLimit]
  );

  // Online: same first-page fetch + merge as the Calls drawer (forced), so the Home card matches.
  // Offline: cache-backed recent list only (getBwiVisitsPage falls back to IndexedDB).
  useEffect(() => {
    if (!enabled || !userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        if (typeof navigator !== "undefined" && navigator.onLine) {
          await loadAllVisits(0, true, { initialLoad: true });
        } else {
          await loadInitialVisits(false, { suppressLoading: true });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, userId, loadAllVisits, loadInitialVisits]);

  // Listen for visit updates to refresh the list
  useEffect(() => {
    if (!enabled) return;
    const handleVisitAdded = async (raw: unknown) => {
      // Clear cache first to ensure fresh data
      await cacheDelete("bwi-visits-all-v2");
      // Clear all paginated cache entries
      for (let i = 0; i < 10; i++) {
        await cacheDelete(`bwi-all-visits-v2-${userId ?? "all"}-${i * 20}`);
      }
      
      // Optimistically add the new visit if we have the data
      if (raw && typeof raw === "object" && "visit_date" in raw) {
        const visitData = raw as VisitAddedBusPayload;
        if (visitData.visit_date) {
          const idStr = String(visitData.id);
          const newVisitRecord: VisitRecord = {
            id: visitData.householder_id ? `hh-${idStr}` : `est-${idStr}`,
            visit_date: visitData.visit_date,
            establishment_name: visitData.establishment?.name,
            householder_name: visitData.householder?.name,
            householder_status: visitData.householder?.status,
            visit_type: visitData.householder_id ? "householder" : "establishment",
            establishment_id: visitData.establishment_id,
            householder_id: visitData.householder_id ?? undefined,
            establishment_status: visitData.establishment?.status,
            notes: visitData.note,
            created_at: new Date().toISOString(),
            publisher_id: visitData.publisher_id,
            publisher: visitData.publisher ? {
              first_name: visitData.publisher.first_name ?? "",
              last_name: visitData.publisher.last_name ?? "",
              avatar_url: visitData.publisher.avatar_url ?? undefined
            } : undefined,
            partner: visitData.partner ? {
              first_name: visitData.partner.first_name ?? "",
              last_name: visitData.partner.last_name ?? "",
              avatar_url: visitData.partner.avatar_url ?? undefined
            } : undefined
          };
        
        // Optimistically update the lists
        setVisits((prev) => {
          const combined = dedupeAndSortVisits([newVisitRecord, ...prev]);
          return combined.slice(0, recentLimit);
        });
        
        setAllVisitsRaw((prev) => {
          const combined = dedupeAndSortVisits([newVisitRecord, ...prev]);
          return combined;
        });
        }
      }

      loadInitialVisits(true, { suppressLoading: true });
      // If full list is already loaded, refresh it too
      if (allVisitsRaw.length > 0) {
        loadAllVisits(0, true);
      }
    };

    const handleVisitUpdated = async () => {
      // Clear cache to force fresh fetch
      await cacheDelete("bwi-visits-all-v2");
      // Clear all paginated cache entries
      for (let i = 0; i < 10; i++) {
        await cacheDelete(`bwi-all-visits-v2-${userId ?? "all"}-${i * 20}`);
      }
      // Refresh recent visits preview
      loadInitialVisits(true, { suppressLoading: true });
      // If full list is already loaded, refresh it too
      if (allVisitsRaw.length > 0) {
        loadAllVisits(0, true);
      }
    };

    /** Establishment/householder status (and names) on list rows are denormalized at fetch time; refetch visits when those entities change. */
    const handleEstablishmentOrHouseholderUpdated = async () => {
      await cacheDelete("bwi-visits-all-v2");
      for (let i = 0; i < 10; i++) {
        await cacheDelete(`bwi-all-visits-v2-${userId ?? "all"}-${i * 20}`);
      }
      loadInitialVisits(true, { suppressLoading: true });
      if (allVisitsRaw.length > 0) {
        loadAllVisits(0, true);
      }
    };

    const handleVisitDeleted = async (deletedVisit: { id: string }) => {
      const visitId = deletedVisit?.id;
      if (!visitId) return;

      // Clear cache first to ensure fresh data
      await cacheDelete("bwi-visits-all-v2");
      // Clear all paginated cache entries
      for (let i = 0; i < 10; i++) {
        await cacheDelete(`bwi-all-visits-v2-${userId ?? "all"}-${i * 20}`);
      }

      // Optimistically remove the visit from the lists
      setVisits((prev) => {
        return prev.filter(v => {
          // Visit IDs in the list can be either "hh-{visitId}" or "est-{visitId}"
          return v.id !== `hh-${visitId}` && v.id !== `est-${visitId}`;
        });
      });

      setAllVisitsRaw((prev) => {
        return prev.filter(v => {
          // Visit IDs in the list can be either "hh-{visitId}" or "est-{visitId}"
          return v.id !== `hh-${visitId}` && v.id !== `est-${visitId}`;
        });
      });

      // Then refresh from server to ensure consistency
      loadInitialVisits(true, { suppressLoading: true });
      // If full list is already loaded, refresh it too
      if (allVisitsRaw.length > 0) {
        loadAllVisits(0, true);
      }
    };

    businessEventBus.subscribe('visit-added', handleVisitAdded);
    businessEventBus.subscribe('visit-updated', handleVisitUpdated);
    businessEventBus.subscribe('visit-deleted', handleVisitDeleted);
    businessEventBus.subscribe('establishment-updated', handleEstablishmentOrHouseholderUpdated);
    businessEventBus.subscribe('householder-updated', handleEstablishmentOrHouseholderUpdated);

    return () => {
      businessEventBus.unsubscribe('visit-added', handleVisitAdded);
      businessEventBus.unsubscribe('visit-updated', handleVisitUpdated);
      businessEventBus.unsubscribe('visit-deleted', handleVisitDeleted);
      businessEventBus.unsubscribe('establishment-updated', handleEstablishmentOrHouseholderUpdated);
      businessEventBus.unsubscribe('householder-updated', handleEstablishmentOrHouseholderUpdated);
    };
  }, [enabled, loadInitialVisits, loadAllVisits, allVisitsRaw.length, userId, recentLimit]);

  const filterOptions = useMemo(() => {
    const statusSet = new Set<string>();
    const areaSet = new Set<string>();
    allVisitsRaw.forEach((visit) => {
      if (visit.establishment_status) {
        statusSet.add(visit.establishment_status);
      }
      if (visit.establishment_area) {
        areaSet.add(visit.establishment_area);
      }
    });
    return {
      statuses: Array.from(statusSet).map((status) => ({
        value: status,
        label: formatStatusText(status)
      })),
      areas: Array.from(areaSet).map((area) => ({
        value: area,
        label: area
      }))
    };
  }, [allVisitsRaw]);

  /** Publishers/partners that appear on loaded calls — same pattern as home to-do assignee filters. */
  const assigneeFilterOptions: VisitAssigneeFilterOption[] = useMemo(() => {
    const byId = new Map<string, VisitAssigneeFilterOption>();
    const upsert = (id: string | undefined, p: VisitRecord["publisher"] | VisitRecord["partner"]) => {
      if (!id) return;
      const cur = byId.get(id);
      const first = p?.first_name ?? cur?.first_name ?? "";
      const last = p?.last_name ?? cur?.last_name ?? "";
      const avatar_url = p?.avatar_url ?? cur?.avatar_url;
      byId.set(id, { id, first_name: first, last_name: last, avatar_url });
    };
    allVisitsRaw.forEach((v) => {
      upsert(v.publisher_id, v.publisher);
      upsert(v.partner_id, v.partner);
    });
    return Array.from(byId.values()).sort((a, b) => {
      const na = `${a.first_name} ${a.last_name}`.trim() || a.id;
      const nb = `${b.first_name} ${b.last_name}`.trim() || b.id;
      return na.localeCompare(nb, undefined, { sensitivity: "base" });
    });
  }, [allVisitsRaw]);

  useEffect(() => {
    const valid = new Set(assigneeFilterOptions.map((o) => o.id));
    setFilters((prev) => {
      const next = prev.assigneeIds.filter((id) => valid.has(id));
      if (next.length === prev.assigneeIds.length) return prev;
      return { ...prev, assigneeIds: next };
    });
  }, [assigneeFilterOptions]);

  const filteredVisits = useMemo(() => {
    let filtered = [...allVisitsRaw];
    if (filters.myUpdatesOnly) {
      filtered = filtered.filter(
        (visit) => visit.publisher_id === userId || visit.partner_id === userId
      );
    }
    if (filters.bwiOnly) {
      filtered = filtered.filter((visit) => visit.establishment_id != null);
    }
    if (filters.householderOnly) {
      // Personal contacts: householders that have a publisher_id (assigned to a publisher)
      // This includes householders even if they also have an establishment_id
      filtered = filtered.filter((visit) => {
        // Only householder visits can be personal contacts
        if (visit.visit_type !== "householder") return false;
        // Check if the householder has a publisher_id (is a personal contact)
        // Must be a truthy string value (not null, undefined, or empty string)
        return Boolean(visit.householder_publisher_id);
      });
    }
    const searchLower = filters.search.trim().toLowerCase();
    if (searchLower) {
      filtered = filtered.filter((visit) => getVisitSearchText(visit).includes(searchLower));
    }
    if (filters.statuses.length > 0) {
      filtered = filtered.filter(
        (visit) => visit.establishment_status && filters.statuses.includes(visit.establishment_status)
      );
    }
    if (filters.areas.length > 0) {
      filtered = filtered.filter(
        (visit) => visit.establishment_area && filters.areas.includes(visit.establishment_area)
      );
    }
    if (filters.assigneeIds.length > 0) {
      filtered = filtered.filter((visit) => {
        const pub = visit.publisher_id;
        const part = visit.partner_id;
        return (
          (pub != null && filters.assigneeIds.includes(pub)) ||
          (part != null && filters.assigneeIds.includes(part))
        );
      });
    }
    if (filters.callDateFrom) {
      filtered = filtered.filter(
        (visit) => visitDayKey(visit.visit_date) >= filters.callDateFrom!
      );
    }
    if (filters.callDateTo) {
      filtered = filtered.filter(
        (visit) => visitDayKey(visit.visit_date) <= filters.callDateTo!
      );
    }
    return filtered;
  }, [allVisitsRaw, filters, userId]);

  const assigneeById = useMemo(() => {
    const m = new Map<string, VisitAssigneeFilterOption>();
    assigneeFilterOptions.forEach((o) => m.set(o.id, o));
    return m;
  }, [assigneeFilterOptions]);

  const filterBadges: FilterBadge[] = useMemo(() => {
    const base = buildFilterBadges({
      statuses: filters.statuses,
      areas: filters.areas,
      formatStatusLabel: formatStatusText
    });
    const assigneeBadges: FilterBadge[] = filters.assigneeIds.map((id) => {
      const p = assigneeById.get(id);
      const label = p ? `${p.first_name} ${p.last_name}`.trim() || "Publisher" : "Publisher";
      return {
        type: "assignee" as const,
        value: id,
        label,
        avatarUrl: p?.avatar_url
      };
    });
    const callDateBadges: FilterBadge[] = (() => {
      const from = filters.callDateFrom;
      const to = filters.callDateTo;
      if (!from && !to) return [];
      let label: string;
      if (from && to) {
        label =
          from === to
            ? formatYmdLabel(from)
            : `${formatYmdLabel(from)} – ${formatYmdLabel(to)}`;
      } else if (from) {
        label = `From ${formatYmdLabel(from)}`;
      } else {
        label = `Until ${formatYmdLabel(to!)}`;
      }
      return [{ type: "call_date" as const, value: "range", label }];
    })();
    return [...base, ...assigneeBadges, ...callDateBadges];
  }, [filters.statuses, filters.areas, filters.assigneeIds, filters.callDateFrom, filters.callDateTo, assigneeById]);

  const clearFilters = useCallback(() => {
    setFilters((prev) => ({
      ...prev,
      statuses: [],
      areas: [],
      assigneeIds: [],
      callDateFrom: null,
      callDateTo: null
    }));
  }, []);

  const clearSearch = useCallback(() => {
    setFilters((prev) => ({ ...prev, search: "" }));
  }, []);

  const loadMore = useCallback(() => {
    if (enabled && !loadingMore && hasMore) {
      loadAllVisits(allVisitsRaw.length);
    }
  }, [enabled, loadingMore, hasMore, loadAllVisits, allVisitsRaw.length]);

  return {
    visits,
    loading,
    allVisitsRawCount: allVisitsRaw.length,
    filteredVisits,
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
  };
}
