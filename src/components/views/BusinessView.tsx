"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getEstablishmentsWithDetails, getEstablishmentDetails, type EstablishmentWithDetails, type VisitWithUser, type HouseholderWithDetails, type BusinessFiltersState } from "@/lib/db/business";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { EstablishmentList } from "@/components/business/EstablishmentList";
import { BusinessFilters } from "@/components/business/BusinessFilters";
import { EstablishmentDetails } from "@/components/business/EstablishmentDetails";
import { businessEventBus } from "@/lib/events/business-events";
import { SwipeableCard } from "@/components/ui/swipeable-card";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { archiveEstablishment, deleteEstablishment } from "@/lib/db/business";

interface BusinessViewProps {
  userId: string;
}

export function BusinessView({ userId }: BusinessViewProps) {
  const [establishments, setEstablishments] = useState<EstablishmentWithDetails[]>([]);
  const [selectedEstablishment, setSelectedEstablishment] = useState<EstablishmentWithDetails | null>(null);
  const [selectedEstablishmentDetails, setSelectedEstablishmentDetails] = useState<{
    establishment: EstablishmentWithDetails;
    visits: VisitWithUser[];
    householders: HouseholderWithDetails[];
  } | null>(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<BusinessFiltersState>({
    search: "",
    statuses: [] as string[],
    areas: [] as string[],
    myEstablishments: false
  });

  // Load business data
  useEffect(() => {
    loadBusinessData();
  }, []);

  const loadBusinessData = useCallback(async () => {
    try {
      const establishments = await getEstablishmentsWithDetails();
      setEstablishments(establishments);

      // Set up business event listeners
      businessEventBus.subscribe('establishment-added', addNewEstablishment);
      businessEventBus.subscribe('householder-added', addNewHouseholder);
      businessEventBus.subscribe('visit-added', addNewVisit);

      return () => {
        businessEventBus.unsubscribe('establishment-added', addNewEstablishment);
        businessEventBus.unsubscribe('householder-added', addNewHouseholder);
        businessEventBus.unsubscribe('visit-added', addNewVisit);
      };
    } catch (error) {
      console.error('Failed to load business data:', error);
    }
  }, []);

  const loadEstablishmentDetails = useCallback(async (establishmentId: string) => {
    console.log('Loading establishment details for:', establishmentId);
    try {
      const details = await getEstablishmentDetails(establishmentId);
      console.log('Loaded establishment details:', details);
      setSelectedEstablishmentDetails(details);
    } catch (error) {
      console.error('Failed to load establishment details:', error);
    }
  }, []);

  const addNewEstablishment = useCallback((establishment: EstablishmentWithDetails) => {
    setEstablishments(prev => {
      // Check if establishment already exists to prevent duplicates
      const establishmentExists = prev.some(existingEstablishment => existingEstablishment.id === establishment.id);
      if (establishmentExists) {
        return prev;
      }
      
      return [establishment, ...prev];
    });
  }, []);

  const addNewHouseholder = useCallback((householder: HouseholderWithDetails) => {
    setSelectedEstablishmentDetails(prev => {
      if (!prev) return prev;
      
      return {
        ...prev,
        householders: [householder, ...prev.householders]
      };
    });
  }, []);

  const addNewVisit = useCallback((visit: VisitWithUser) => {
    setSelectedEstablishmentDetails(prev => {
      if (!prev) return prev;
      
      // Check if visit already exists to prevent duplicates
      const visitExists = prev.visits.some(existingVisit => existingVisit.id === visit.id);
      if (visitExists) {
        return prev;
      }
      
      return {
        ...prev,
        visits: [visit, ...prev.visits]
      };
    });
  }, []);

  const handleDeleteEstablishment = useCallback(async (establishment: EstablishmentWithDetails) => {
    try {
      const success = await deleteEstablishment(establishment.id!);
      
      if (success) {
        toast.success(`${establishment.name} deleted successfully`);
        
        // Remove from local state
        setEstablishments(prev => prev.filter(e => e.id !== establishment.id));
        
        // If this was the selected establishment, clear selection
        if (selectedEstablishment?.id === establishment.id) {
          setSelectedEstablishment(null);
          setSelectedEstablishmentDetails(null);
        }
      } else {
        toast.error('Failed to delete establishment');
      }
    } catch (error) {
      console.error('Failed to delete establishment:', error);
      toast.error('Failed to delete establishment');
    }
  }, [selectedEstablishment]);

  const handleArchiveEstablishment = useCallback(async (establishment: EstablishmentWithDetails) => {
    try {
      const success = await archiveEstablishment(establishment.id!);
      
      if (success) {
        toast.success(`${establishment.name} archived successfully`);
        
        // Remove from local state
        setEstablishments(prev => prev.filter(e => e.id !== establishment.id));
        
        // If this was the selected establishment, clear selection
        if (selectedEstablishment?.id === establishment.id) {
          setSelectedEstablishment(null);
          setSelectedEstablishmentDetails(null);
        }
      } else {
        toast.error('Failed to archive establishment');
      }
    } catch (error) {
      console.error('Failed to archive establishment:', error);
      toast.error('Failed to archive establishment');
    }
  }, [selectedEstablishment]);

  // Add filtering logic
  const filteredEstablishments = useMemo(() => {
    return establishments.filter(establishment => {
      // Search filter
      if (filters.search && !establishment.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }

      // Status filter
      if (filters.statuses.length > 0 && !establishment.statuses?.some(status => filters.statuses.includes(status))) {
        return false;
      }

      // Area filter
      if (filters.areas.length > 0 && establishment.area && !filters.areas.includes(establishment.area)) {
        return false;
      }

      // My Establishments filter (if user has visited)
      if (filters.myEstablishments) {
        // This would need to check if the current user has visited this establishment
        // For now, we'll skip this filter until we have the user data
        return true;
      }

      return true;
    });
  }, [establishments, filters]);

  // Get unique areas for filter options
  const areaOptions = useMemo(() => {
    const areas = establishments
      .map(e => e.area)
      .filter(area => area && typeof area === 'string' && area.trim() !== "")
      .filter((area, index, arr) => arr.indexOf(area) === index) // Remove duplicates
      .sort();
    
    return areas.map(area => ({
      value: area || '',
      label: area || ''
    }));
  }, [establishments]);

  return (
    <motion.div
      key="business"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 pb-32" // Added pb-32 for bottom padding
    >
      {/* Remove the empty div that was adding unwanted space */}
      
      {/* Only show BusinessFilters when not viewing establishment details */}
      {!selectedEstablishment && (
        <BusinessFilters
          filters={filters}
          onFiltersChange={setFilters}
          onClearFilters={() => setFilters({
            search: "",
            statuses: [],
            areas: [],
            myEstablishments: false
          })}
          hasActiveFilters={filters.search !== "" || filters.statuses.length > 0 || filters.areas.length > 0 || filters.myEstablishments}
          statusOptions={[
            { value: "for_scouting", label: "For Scouting" },
            { value: "for_follow_up", label: "For Follow Up" },
            { value: "for_replenishment", label: "For Replenishment" },
            { value: "accepted_rack", label: "Accepted Rack" },
            { value: "declined_rack", label: "Declined Rack" },
            { value: "has_bible_studies", label: "Has Bible Studies" }
          ]}
          areaOptions={areaOptions}
        />
      )}

      <div className="w-full">
        <AnimatePresence mode="wait">
          {!selectedEstablishment ? (
            <motion.div
              key="establishment-list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <EstablishmentList
                establishments={filteredEstablishments}
                onEstablishmentClick={(establishment) => {
                  console.log('Establishment clicked:', establishment);
                  setSelectedEstablishment(establishment);
                  if (establishment.id) {
                    loadEstablishmentDetails(establishment.id);
                  }
                }}
                onEstablishmentDelete={handleDeleteEstablishment}
                onEstablishmentArchive={handleArchiveEstablishment}
              />
            </motion.div>
          ) : (
            <motion.div
              key="establishment-details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="w-full"
            >
              <EstablishmentDetails
                establishment={selectedEstablishment}
                visits={selectedEstablishmentDetails?.visits || []}
                householders={selectedEstablishmentDetails?.householders || []}
                onBackClick={() => {
                  setSelectedEstablishment(null);
                  setSelectedEstablishmentDetails(null);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}