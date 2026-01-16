"use client";

import { useCallback, useMemo } from "react";
import { calculateDistance, type BusinessFiltersState, type EstablishmentWithDetails } from "@/lib/db/business";

interface UseBusinessFilterOptionsProps {
  establishments: EstablishmentWithDetails[];
  filters: BusinessFiltersState;
  userVisitedEstablishments: Set<string>;
  businessTab: "establishments" | "householders" | "map";
}

export function useBusinessFilterOptions({
  establishments,
  filters,
  userVisitedEstablishments,
  businessTab
}: UseBusinessFilterOptionsProps) {
  const getFilteredEstablishmentsExcluding = useCallback(
    (excludeType: "statuses" | "areas" | "floors" | null) => {
      return establishments.filter((establishment) => {
        if (filters.search && filters.search.trim() !== "") {
          const searchTerm = filters.search.toLowerCase().trim();
          const establishmentName = establishment.name?.toLowerCase() || "";
          if (!establishmentName.includes(searchTerm)) {
            return false;
          }
        }

        if (
          excludeType !== "statuses" &&
          filters.statuses.length > 0 &&
          !establishment.statuses?.some((status) => filters.statuses.includes(status))
        ) {
          return false;
        }

        if (
          excludeType !== "areas" &&
          filters.areas.length > 0 &&
          establishment.area &&
          !filters.areas.includes(establishment.area)
        ) {
          return false;
        }

        if (excludeType !== "floors" && filters.floors.length > 0) {
          const establishmentFloor = establishment.floor ? String(establishment.floor).trim() : null;
          if (!establishmentFloor) {
            return false;
          }
          const normalizedFloors = filters.floors.map((f) => String(f).trim().toLowerCase());
          if (!normalizedFloors.includes(establishmentFloor.toLowerCase())) {
            return false;
          }
        }

        if (filters.myEstablishments) {
          const visitedByUser = establishment.id ? userVisitedEstablishments.has(establishment.id) : false;
          if (!visitedByUser) return false;
        }

        if (filters.nearMe) {
          if (!filters.userLocation || establishment.lat == null || establishment.lng == null) {
            return false;
          }
          const distanceKm = calculateDistance(
            filters.userLocation[0],
            filters.userLocation[1],
            establishment.lat,
            establishment.lng
          );
          if (distanceKm > 0.15) return false;
        }

        return true;
      });
    },
    [establishments, filters, userVisitedEstablishments]
  );

  const dynamicStatusOptions = useMemo(() => {
    const filtered = getFilteredEstablishmentsExcluding("statuses");
    const allStatuses = new Set<string>();

    filters.statuses.forEach((status) => allStatuses.add(status));

    filtered.forEach((establishment) => {
      establishment.statuses?.forEach((status) => {
        allStatuses.add(status);
      });
    });

    const statusList = Array.from(allStatuses).sort();

    if (businessTab === "establishments" || businessTab === "map") {
      const statusMap: Record<string, string> = {
        for_scouting: "For Scouting",
        for_follow_up: "For Follow Up",
        for_replenishment: "For Replenishment",
        accepted_rack: "Accepted Rack",
        declined_rack: "Declined Rack",
        has_bible_studies: "Has Bible Studies",
        closed: "Closed"
      };
      return statusList.filter((s) => s in statusMap).map((s) => ({ value: s, label: statusMap[s] }));
    }

    const statusMap: Record<string, string> = {
      interested: "Interested",
      return_visit: "Return Visit",
      bible_study: "Bible Study",
      do_not_call: "Do Not Call"
    };
    return statusList.filter((s) => s in statusMap).map((s) => ({ value: s, label: statusMap[s] }));
  }, [getFilteredEstablishmentsExcluding, businessTab, filters.statuses]);

  const dynamicAreaOptions = useMemo(() => {
    const filtered = getFilteredEstablishmentsExcluding("areas");
    const areaSet = new Set<string>();

    filters.areas.forEach((area) => {
      if (area && area.trim() !== "") {
        areaSet.add(area);
      }
    });

    filtered.forEach((e) => {
      if (e.area && typeof e.area === "string" && e.area.trim() !== "") {
        areaSet.add(e.area);
      }
    });

    return Array.from(areaSet)
      .sort()
      .map((area) => ({ value: area || "", label: area || "" }));
  }, [getFilteredEstablishmentsExcluding, filters.areas]);

  const dynamicFloorOptions = useMemo(() => {
    const filtered = getFilteredEstablishmentsExcluding("floors");
    const floorSet = new Set<string>();

    filters.floors.forEach((floor) => {
      if (floor && floor.trim() !== "") {
        floorSet.add(floor);
      }
    });

    filtered.forEach((e) => {
      if (e.floor && typeof e.floor === "string" && e.floor.trim() !== "") {
        floorSet.add(e.floor);
      }
    });

    return Array.from(floorSet)
      .sort()
      .map((floor) => ({ value: floor || "", label: floor || "" }));
  }, [getFilteredEstablishmentsExcluding, filters.floors]);

  return { dynamicStatusOptions, dynamicAreaOptions, dynamicFloorOptions };
}
