"use client";

import { useMemo } from "react";
import {
  calculateDistance,
  type BusinessFiltersState,
  type EstablishmentWithDetails,
  type HouseholderWithDetails
} from "@/lib/db/business";

interface UseBusinessFilteredListsOptions {
  establishments: EstablishmentWithDetails[];
  householders: HouseholderWithDetails[];
  filters: BusinessFiltersState;
  userVisitedEstablishments: Set<string>;
  userVisitedHouseholders: Set<string>;
}

export function useBusinessFilteredLists({
  establishments,
  householders,
  filters,
  userVisitedEstablishments,
  userVisitedHouseholders
}: UseBusinessFilteredListsOptions) {
  const filteredEstablishments = useMemo(() => {
    const base = establishments.filter((establishment) => {
      if (filters.search && filters.search.trim() !== "") {
        const searchTerm = filters.search.toLowerCase().trim();
        const establishmentName = establishment.name?.toLowerCase() || "";
        if (!establishmentName.includes(searchTerm)) {
          return false;
        }
      }

      if (filters.statuses.length > 0 && !establishment.statuses?.some((status) => filters.statuses.includes(status))) {
        return false;
      }

      if (filters.areas.length > 0 && establishment.area && !filters.areas.includes(establishment.area)) {
        return false;
      }

      if (filters.floors.length > 0) {
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

    const uniqueEstablishments = base.filter(
      (establishment, index, self) => index === self.findIndex((e) => e.id === establishment.id)
    );

    const sorted = [...uniqueEstablishments];
    const compareLastVisit = (a?: string | null, b?: string | null, asc: boolean = false) => {
      const ahas = !!a;
      const bhas = !!b;
      if (ahas && !bhas) return -1;
      if (!ahas && bhas) return 1;
      if (!ahas && !bhas) return 0;
      if (asc) {
        return a! < b! ? -1 : a! > b! ? 1 : 0;
      }
      return a! > b! ? -1 : a! < b! ? 1 : 0;
    };

    if (filters.nearMe && filters.userLocation) {
      const [userLat, userLng] = filters.userLocation;
      const distanceOf = (e: EstablishmentWithDetails) => {
        if (e.lat == null || e.lng == null) return Number.POSITIVE_INFINITY;
        return calculateDistance(userLat, userLng, e.lat, e.lng);
      };
      sorted.sort((a, b) => distanceOf(a) - distanceOf(b));
    } else {
      switch (filters.sort) {
        case "name_asc":
          sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
          break;
        case "name_desc":
          sorted.sort((a, b) => (b.name || "").localeCompare(a.name || ""));
          break;
        case "area_asc":
          sorted.sort((a, b) => (a.area || "").localeCompare(b.area || ""));
          break;
        case "area_desc":
          sorted.sort((a, b) => (b.area || "").localeCompare(a.area || ""));
          break;
        case "last_visit_asc":
          sorted.sort((a, b) => compareLastVisit(a.last_visit_at, b.last_visit_at, true));
          break;
        case "last_visit_desc":
        default:
          sorted.sort((a, b) => compareLastVisit(a.last_visit_at, b.last_visit_at, false));
          break;
      }
    }

    return sorted;
  }, [establishments, filters, userVisitedEstablishments]);

  const filteredHouseholders = useMemo(() => {
    const establishmentsById = new Map(establishments.map((e) => [e.id, e] as const));

    const base = householders.filter((householder) => {
      if (filters.search && !householder.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }

      if (filters.statuses.length > 0 && !filters.statuses.includes(householder.status)) {
        return false;
      }

      if (filters.myEstablishments) {
        const visitedByUser = householder.id ? userVisitedHouseholders.has(householder.id) : false;
        if (!visitedByUser) return false;
      }

      if (filters.nearMe) {
        if (!filters.userLocation) return false;
        const parent = householder.establishment_id ? establishmentsById.get(householder.establishment_id) : undefined;
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

    const sorted = [...base];
    if (filters.nearMe && filters.userLocation) {
      const [userLat, userLng] = filters.userLocation;
      const distanceOf = (h: HouseholderWithDetails) => {
        const parent = h.establishment_id ? establishmentsById.get(h.establishment_id) : undefined;
        if (!parent || parent.lat == null || parent.lng == null) return Number.POSITIVE_INFINITY;
        return calculateDistance(userLat, userLng, parent.lat, parent.lng);
      };
      sorted.sort((a, b) => distanceOf(a) - distanceOf(b));
    } else {
      switch (filters.sort) {
        case "name_asc":
          sorted.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case "name_desc":
          sorted.sort((a, b) => b.name.localeCompare(a.name));
          break;
        case "last_visit_asc":
          sorted.sort((a, b) => {
            if (!a.last_visit_at && !b.last_visit_at) return 0;
            if (!a.last_visit_at) return 1;
            if (!b.last_visit_at) return -1;
            return a.last_visit_at.localeCompare(b.last_visit_at);
          });
          break;
        case "last_visit_desc":
        default:
          sorted.sort((a, b) => {
            if (!a.last_visit_at && !b.last_visit_at) return 0;
            if (!a.last_visit_at) return 1;
            if (!b.last_visit_at) return -1;
            return b.last_visit_at.localeCompare(a.last_visit_at);
          });
          break;
      }
    }

    return sorted;
  }, [establishments, householders, filters, userVisitedHouseholders]);

  return { filteredEstablishments, filteredHouseholders };
}
