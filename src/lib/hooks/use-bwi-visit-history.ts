"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { VisitRecord } from "@/lib/utils/visit-history";
import { getBwiVisitsPage, getRecentBwiVisits } from "@/lib/db/visit-history";
import { formatStatusText } from "@/lib/utils/formatters";
import type { VisitFilters } from "@/components/visit/VisitFiltersForm";

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

  useEffect(() => {
    const loadInitialVisits = async () => {
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
    };
    loadInitialVisits();
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
    if (filters.search.trim()) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter((visit) => {
        const name = (visit.householder_name || visit.establishment_name || "").toLowerCase();
        const notes = (visit.notes || "").toLowerCase();
        return name.includes(searchLower) || notes.includes(searchLower);
      });
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

  return {
    visits,
    loading,
    allVisitsRawCount: allVisitsRaw.length,
    filteredVisits,
    filterOptions,
    filters,
    setFilters,
    loadAllVisits,
    loadingMore,
    hasMore
  };
}
