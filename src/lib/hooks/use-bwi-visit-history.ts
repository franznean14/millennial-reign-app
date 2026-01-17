"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { VisitRecord } from "@/lib/utils/visit-history";
import { getBwiVisitsPage, getRecentBwiVisits } from "@/lib/db/visit-history";
import { formatStatusText } from "@/lib/utils/formatters";
import { getVisitSearchText } from "@/lib/utils/visit-history-ui";
import { buildFilterBadges, type FilterBadge } from "@/lib/utils/filter-badges";
import type { VisitFilters } from "@/components/visit/VisitFiltersForm";
import { businessEventBus } from "@/lib/events/business-events";
import { cacheDelete } from "@/lib/offline/store";

interface UseBwiVisitHistoryOptions {
  userId: string;
  recentLimit?: number;
  pageSize?: number;
}

export function useBwiVisitHistory({
  userId,
  recentLimit = 5,
  pageSize = 20
}: UseBwiVisitHistoryOptions) {
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [allVisitsRaw, setAllVisitsRaw] = useState<VisitRecord[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState<VisitFilters>({
    search: "",
    statuses: [],
    areas: [],
    myUpdatesOnly: false
  });

  const loadInitialVisits = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const sortedVisits = await getRecentBwiVisits(recentLimit);
      setVisits(sortedVisits);
    } catch (error) {
      console.error("Error loading visit history:", error);
    } finally {
      setLoading(false);
    }
  }, [userId, recentLimit]);

  const loadAllVisits = useCallback(
    async (offset = 0) => {
      if (!userId) return;
      setLoadingMore(true);
      try {
        const sortedVisits = await getBwiVisitsPage({ userId, offset, pageSize });
        if (offset === 0) {
          setAllVisitsRaw(sortedVisits);
        } else {
          setAllVisitsRaw((prev) => [...prev, ...sortedVisits]);
        }
        setHasMore(sortedVisits.length === pageSize * 2);
      } catch (error) {
        console.error("Error loading more visits:", error);
      } finally {
        setLoadingMore(false);
      }
    },
    [userId, pageSize]
  );

  useEffect(() => {
    loadInitialVisits();
  }, [loadInitialVisits]);

  // Listen for visit updates to refresh the list
  useEffect(() => {
    const handleVisitAdded = async () => {
      // Clear cache to force fresh fetch
      await cacheDelete("bwi-visits-all-v2");
      // Clear all paginated cache entries
      for (let i = 0; i < 10; i++) {
        await cacheDelete(`bwi-all-visits-v2-${userId ?? "all"}-${i * 20}`);
      }
      // Refresh recent visits preview
      loadInitialVisits();
      // If full list is already loaded, refresh it too
      if (allVisitsRaw.length > 0) {
        loadAllVisits(0);
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
      loadInitialVisits();
      // If full list is already loaded, refresh it too
      if (allVisitsRaw.length > 0) {
        loadAllVisits(0);
      }
    };

    businessEventBus.subscribe('visit-added', handleVisitAdded);
    businessEventBus.subscribe('visit-updated', handleVisitUpdated);

    return () => {
      businessEventBus.unsubscribe('visit-added', handleVisitAdded);
      businessEventBus.unsubscribe('visit-updated', handleVisitUpdated);
    };
  }, [loadInitialVisits, loadAllVisits, allVisitsRaw.length, userId]);

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

  const filteredVisits = useMemo(() => {
    let filtered = [...allVisitsRaw];
    if (filters.myUpdatesOnly) {
      filtered = filtered.filter((visit) => visit.publisher_id === userId);
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
    return filtered;
  }, [allVisitsRaw, filters, userId]);

  const filterBadges: FilterBadge[] = useMemo(
    () =>
      buildFilterBadges({
        statuses: filters.statuses,
        areas: filters.areas,
        formatStatusLabel: formatStatusText
      }),
    [filters.statuses, filters.areas]
  );

  const clearFilters = useCallback(() => {
    setFilters((prev) => ({ ...prev, statuses: [], areas: [] }));
  }, []);

  const clearSearch = useCallback(() => {
    setFilters((prev) => ({ ...prev, search: "" }));
  }, []);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadAllVisits(allVisitsRaw.length);
    }
  }, [loadingMore, hasMore, loadAllVisits, allVisitsRaw.length]);

  return {
    visits,
    loading,
    allVisitsRawCount: allVisitsRaw.length,
    filteredVisits,
    filterOptions,
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
