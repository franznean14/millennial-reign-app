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
  filtersEstablishments: BusinessFiltersState;
  filtersHouseholders: BusinessFiltersState;
  userVisitedEstablishments: Set<string>;
  userVisitedHouseholders: Set<string>;
  userId?: string | null;
}

export function useBusinessFilteredLists({
  establishments,
  householders,
  filtersEstablishments,
  filtersHouseholders,
  userVisitedEstablishments,
  userVisitedHouseholders,
  userId
}: UseBusinessFilteredListsOptions) {
  const filteredEstablishments = useMemo(() => {
    const filters = filtersEstablishments;
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

    const compareDate = (a?: string | null, b?: string | null, asc: boolean = false) => {
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
        case "date_added_asc":
          sorted.sort((a, b) => compareDate(a.created_at, b.created_at, true));
          break;
        case "date_added_desc":
          sorted.sort((a, b) => compareDate(a.created_at, b.created_at, false));
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
  }, [establishments, filtersEstablishments, userVisitedEstablishments]);

  const filteredHouseholders = useMemo(() => {
    const filters = filtersHouseholders;
    const establishmentsById = new Map(establishments.map((e) => [e.id, e] as const));

    const base = householders.filter((householder) => {
      if (filters.search && !householder.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }

      if (filters.statuses.length > 0 && !filters.statuses.includes(householder.status)) {
        return false;
      }

      // Area filter for householders is derived from the parent establishment's area
      if (filters.areas.length > 0) {
        if (!householder.establishment_id) return false;
        const parent = establishmentsById.get(householder.establishment_id);
        if (!parent || !parent.area || !filters.areas.includes(parent.area)) {
          return false;
        }
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
    
    // Status priority order: BS (bible_study), RV (return_visit), Interest (interested), Potential (potential), DNC (do_not_call)
    const getStatusPriority = (status: string): number => {
      switch (status) {
        case 'bible_study':
        case 'has_bible_studies':
          return 1;
        case 'return_visit':
        case 'for_follow_up':
          return 2;
        case 'interested':
          return 3;
        case 'potential':
          return 4;
        case 'do_not_call':
        case 'declined_rack':
        case 'inappropriate':
          return 5;
        default:
          return 6;
      }
    };

    if (filters.nearMe && filters.userLocation) {
      const [userLat, userLng] = filters.userLocation;
      const distanceOf = (h: HouseholderWithDetails) => {
        const parent = h.establishment_id ? establishmentsById.get(h.establishment_id) : undefined;
        if (!parent || parent.lat == null || parent.lng == null) return Number.POSITIVE_INFINITY;
        return calculateDistance(userLat, userLng, parent.lat, parent.lng);
      };
      sorted.sort((a, b) => distanceOf(a) - distanceOf(b));
    } else {
      const compareDate = (a?: string | null, b?: string | null, asc: boolean = false) => {
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

      switch (filters.sort) {
        case "name_asc":
          sorted.sort((a, b) => a.name.localeCompare(b.name));
          break;
        case "name_desc":
          sorted.sort((a, b) => b.name.localeCompare(a.name));
          break;
        case "date_added_asc":
          sorted.sort((a, b) => compareDate(a.created_at, b.created_at, true));
          break;
        case "date_added_desc":
          sorted.sort((a, b) => compareDate(a.created_at, b.created_at, false));
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
          // Default sort: owned by user > visited by user > status priority
          sorted.sort((a, b) => {
            // First priority: owned by user (publisher_id matches userId)
            const aIsOwned = userId && a.publisher_id === userId;
            const bIsOwned = userId && b.publisher_id === userId;
            if (aIsOwned && !bIsOwned) return -1;
            if (!aIsOwned && bIsOwned) return 1;
            
            // Second priority: visited by user
            if (aIsOwned === bIsOwned) {
              const aIsVisited = a.id ? userVisitedHouseholders.has(a.id) : false;
              const bIsVisited = b.id ? userVisitedHouseholders.has(b.id) : false;
              if (aIsVisited && !bIsVisited) return -1;
              if (!aIsVisited && bIsVisited) return 1;
              
              // Third priority: status priority
              if (aIsVisited === bIsVisited) {
                const aPriority = getStatusPriority(a.status);
                const bPriority = getStatusPriority(b.status);
                if (aPriority !== bPriority) {
                  return aPriority - bPriority;
                }
                // If same status priority, sort by last visit (descending)
                if (!a.last_visit_at && !b.last_visit_at) return 0;
                if (!a.last_visit_at) return 1;
                if (!b.last_visit_at) return -1;
                return b.last_visit_at.localeCompare(a.last_visit_at);
              }
            }
            
            // Fallback to last visit descending
            if (!a.last_visit_at && !b.last_visit_at) return 0;
            if (!a.last_visit_at) return 1;
            if (!b.last_visit_at) return -1;
            return b.last_visit_at.localeCompare(a.last_visit_at);
          });
          break;
      }
    }

    return sorted;
  }, [establishments, householders, filtersHouseholders, userVisitedHouseholders, userId]);

  return { filteredEstablishments, filteredHouseholders };
}
