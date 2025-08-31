"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { getEstablishmentsWithDetails, getEstablishmentDetails, type EstablishmentWithDetails, type VisitWithUser, type HouseholderWithDetails } from "@/lib/db/business";
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
  const [filters, setFilters] = useState({
    search: "",
    statuses: [],
    areas: [],
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

  return (
    <motion.div
      key="business"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Business</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {filters.statuses.length > 0 || filters.areas.length > 0 || filters.search && (
            <Badge variant="secondary" className="ml-1">
              {filters.statuses.length + filters.areas.length + (filters.search ? 1 : 0)}
            </Badge>
          )}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <BusinessFilters
              filters={filters}
              onFiltersChange={setFilters}
            />
          </motion.div>
        )}
      </AnimatePresence>

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
                establishments={establishments}
                onEstablishmentClick={(establishment) => {
                  console.log('Establishment clicked:', establishment);
                  setSelectedEstablishment(establishment);
                  loadEstablishmentDetails(establishment.id);
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