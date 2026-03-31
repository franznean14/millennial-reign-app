"use client";

import { useCallback, useMemo } from "react";
import {
  calculateDistance,
  type BusinessFiltersState,
  type EstablishmentWithDetails,
  type HouseholderWithDetails
} from "@/lib/db/business";

interface UseBusinessFilterOptionsProps {
  establishments: EstablishmentWithDetails[];
  householders: HouseholderWithDetails[];
  filters: BusinessFiltersState;
  userVisitedEstablishments: Set<string>;
  businessTab: "establishments" | "householders" | "map";
}

export function useBusinessFilterOptions({
  establishments,
  householders,
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
          !(
            establishment.statuses?.some((status) => filters.statuses.includes(status)) ||
            (filters.statuses.includes("personal_territory") && !!establishment.publisher_id)
          )
        ) {
          return false;
        }

        if (excludeType !== "statuses" && (filters.excludedStatuses?.length ?? 0) > 0) {
          const excludedStatuses = filters.excludedStatuses ?? [];
          const excludePersonalTerritory = excludedStatuses.includes("personal_territory");
          const excludedRegularStatuses = excludedStatuses.filter((status) => status !== "personal_territory");
          if (excludePersonalTerritory && establishment.publisher_id) {
            return false;
          }
          if (excludedRegularStatuses.length > 0 && establishment.statuses?.some((status) => excludedRegularStatuses.includes(status))) {
            return false;
          }
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
    if (businessTab === "establishments" || businessTab === "map") {
      const filtered = getFilteredEstablishmentsExcluding("statuses");
      const allStatuses = new Set<string>();

      // Always include currently selected/excluded statuses so chips don't disappear
      filters.statuses.forEach((status) => allStatuses.add(status));
      (filters.excludedStatuses ?? []).forEach((status) => allStatuses.add(status));

      filtered.forEach((establishment) => {
        establishment.statuses?.forEach((status) => {
          allStatuses.add(status);
        });
      });

      // Positive-to-negative order for filters
      const orderedStatuses: string[] = [
        "personal_territory",
        "has_bible_studies",
        "for_replenishment",
        "accepted_rack",
        "for_follow_up",
        "for_scouting",
        "closed",
        "on_hold",
        "rack_pulled_out",
        "inappropriate",
        "declined_rack",
      ];

      const statusMap: Record<string, string> = {
        for_scouting: "For Scouting",
        for_follow_up: "For Follow Up",
        accepted_rack: "Rack Accepted",
        for_replenishment: "For Replenishment",
        has_bible_studies: "Has Bible Studies",
        declined_rack: "Rack Declined",
        rack_pulled_out: "Rack Pulled Out",
        closed: "Closed",
        on_hold: "On Hold",
        inappropriate: "Inappropriate"
      };

      // Filter to statuses that actually exist in data, then map in desired order
      const available = new Set(allStatuses);
      return orderedStatuses
        .filter((s) => s === "personal_territory" || available.has(s))
        .map((s) => ({
          value: s,
          label: s === "personal_territory" ? "Personal Territory" : statusMap[s],
        }));
    }

    // Householder tab – build options from householder statuses
    const allHouseholderStatuses = new Set<string>();

    // Preserve any active filters
    filters.statuses.forEach((status) => allHouseholderStatuses.add(status));
    (filters.excludedStatuses ?? []).forEach((status) => allHouseholderStatuses.add(status));

    // Collect statuses from the visible data set
    householders.forEach((householder) => {
      if (householder.status) {
        allHouseholderStatuses.add(householder.status);
      }
    });

    const statusMap: Record<string, string> = {
      potential: "Potential",
      interested: "Interested",
      return_visit: "Return Visit",
      bible_study: "Bible Study",
      do_not_call: "Do Not Call",
      moved_branch: "Moved",
      resigned: "Resigned"
    };

    const orderedHouseholderStatuses = [
      "bible_study",
      "return_visit",
      "interested",
      "potential",
      "do_not_call",
      "moved_branch",
      "resigned",
    ];

    const availableStatuses = new Set(allHouseholderStatuses);
    return orderedHouseholderStatuses
      .filter((status) => availableStatuses.has(status))
      .map((status) => ({ value: status, label: statusMap[status] }));
  }, [getFilteredEstablishmentsExcluding, businessTab, filters.statuses, filters.excludedStatuses, householders]);

  const dynamicAreaOptions = useMemo(() => {
    const areaSet = new Set<string>();

    // Always keep currently selected areas so chips never disappear
    filters.areas.forEach((area) => {
      if (area && area.trim() !== "") {
        areaSet.add(area);
      }
    });

    if (businessTab === "householders") {
      // For householders, derive areas from householders that match the
      // current filters EXCEPT the area filter itself.
      const establishmentsById = new Map(establishments.map((e) => [e.id, e] as const));

      const filteredHouseholders = householders.filter((householder) => {
        // Apply text search
        if (filters.search && filters.search.trim() !== "") {
          const searchTerm = filters.search.toLowerCase().trim();
          if (!householder.name.toLowerCase().includes(searchTerm)) {
            return false;
          }
        }

        // Apply status filter
        if (filters.statuses.length > 0 && !filters.statuses.includes(householder.status)) {
          return false;
        }

        if ((filters.excludedStatuses?.length ?? 0) > 0 && (filters.excludedStatuses ?? []).includes(householder.status)) {
          return false;
        }

        // Apply near-me filter based on parent establishment location
        if (filters.nearMe) {
          if (!filters.userLocation) return false;
          if (!householder.establishment_id) return false;
          const parent = establishmentsById.get(householder.establishment_id);
          if (!parent || parent.lat == null || parent.lng == null) return false;
          const distanceKm = calculateDistance(
            filters.userLocation[0],
            filters.userLocation[1],
            parent.lat,
            parent.lng
          );
          if (distanceKm > 0.15) return false;
        }

        return true;
      });

      filteredHouseholders.forEach((householder) => {
        if (!householder.establishment_id) return;
        const parent = establishmentsById.get(householder.establishment_id);
        if (parent && typeof parent.area === "string" && parent.area.trim() !== "") {
          areaSet.add(parent.area);
        }
      });
    } else {
      // For establishments/map, use filtered establishments (excluding area filter itself)
      const filtered = getFilteredEstablishmentsExcluding("areas");
      filtered.forEach((e) => {
        if (e.area && typeof e.area === "string" && e.area.trim() !== "") {
          areaSet.add(e.area);
        }
      });
    }

    return Array.from(areaSet)
      .sort()
      .map((area) => ({ value: area || "", label: area || "" }));
  }, [businessTab, establishments, householders, getFilteredEstablishmentsExcluding, filters.areas, filters.excludedStatuses, filters.statuses]);

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
