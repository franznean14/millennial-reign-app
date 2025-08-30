"use client";

import { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter } from "lucide-react";
import { getEstablishmentsWithDetails, getEstablishmentDetails, type EstablishmentWithDetails, type EstablishmentStatus, type VisitWithUser, type HouseholderWithDetails } from "@/lib/db/business";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "motion/react";
import { EstablishmentList } from "@/components/business/EstablishmentList";
import { BusinessFilters } from "@/components/business/BusinessFilters";
import { EstablishmentDetails } from "@/components/business/EstablishmentDetails";
import { businessEventBus } from "@/lib/events/business-events";

function BusinessPageContent() {
  const [establishments, setEstablishments] = useState<EstablishmentWithDetails[]>([]);
  const [selectedEstablishment, setSelectedEstablishment] = useState<EstablishmentWithDetails | null>(null);
  const [selectedEstablishmentDetails, setSelectedEstablishmentDetails] = useState<{
    establishment: EstablishmentWithDetails;
    visits: VisitWithUser[];
    householders: HouseholderWithDetails[];
  } | null>(null);
  const [isExpanding, setIsExpanding] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: "",
    statuses: [] as string[],
    areas: [] as string[],
    myEstablishments: false
  });
  const router = useRouter();
  const searchParams = useSearchParams();

  const loadEstablishments = async () => {
    try {
      const data = await getEstablishmentsWithDetails();
      setEstablishments(data);
    } catch (error) {
      console.error('Failed to load establishments:', error);
    }
  };

  const getCurrentUser = async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.getSession();
      const { data: userRes } = await supabase.auth.getUser();
      setCurrentUserId(userRes.user?.id || null);
    } catch (error) {
      console.error('Failed to get current user:', error);
    }
  };

  const loadEstablishmentDetails = async (establishmentId: string) => {
    try {
      const details = await getEstablishmentDetails(establishmentId);
      setSelectedEstablishmentDetails(details);
    } catch (error) {
      console.error('Failed to load establishment details:', error);
    }
  };

  // Function to add new establishment with animation
  const addNewEstablishment = useCallback((newEstablishment: any) => {
    setEstablishments(prev => [newEstablishment, ...prev]);
    
    // If this establishment is currently selected, update the details
    if (selectedEstablishment?.id === newEstablishment.id) {
      loadEstablishmentDetails(newEstablishment.id);
    }
  }, [selectedEstablishment?.id]);

  // Function to add new householder with animation
  const addNewHouseholder = useCallback((newHouseholder: any) => {
    // If we have selected establishment details, add the new householder
    if (selectedEstablishmentDetails && selectedEstablishmentDetails.establishment.id === newHouseholder.establishment_id) {
      setSelectedEstablishmentDetails(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          householders: [...prev.householders, newHouseholder]
        };
      });
    }
    
    // Update the establishment's householder count in the list
    setEstablishments(prev => prev.map(est => {
      if (est.id === newHouseholder.establishment_id) {
        return {
          ...est,
          householder_count: (est.householder_count || 0) + 1
        };
      }
      return est;
    }));
  }, [selectedEstablishmentDetails?.establishment.id]);

  // Function to add new visit with animation
  const addNewVisit = useCallback((newVisit: any) => {
    // If we have selected establishment details, add the new visit
    if (selectedEstablishmentDetails && selectedEstablishmentDetails.establishment.id === newVisit.establishment_id) {
      setSelectedEstablishmentDetails(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          visits: [newVisit, ...prev.visits]
        };
      });
    }
    
    // Update the establishment's visit count in the list
    setEstablishments(prev => prev.map(est => {
      if (est.id === newVisit.establishment_id) {
        return {
          ...est,
          visit_count: (est.visit_count || 0) + 1
        };
      }
      return est;
    }));
  }, [selectedEstablishmentDetails?.establishment.id]);

  useEffect(() => {
    loadEstablishments();
    getCurrentUser();

    // Subscribe to business events
    businessEventBus.subscribe('establishment-added', addNewEstablishment);
    businessEventBus.subscribe('householder-added', addNewHouseholder);
    businessEventBus.subscribe('visit-added', addNewVisit);

    // Cleanup subscriptions
    return () => {
      businessEventBus.unsubscribe('establishment-added', addNewEstablishment);
      businessEventBus.unsubscribe('householder-added', addNewHouseholder);
      businessEventBus.unsubscribe('visit-added', addNewVisit);
    };
  }, [addNewEstablishment, addNewHouseholder, addNewVisit]);

  // Enhanced search function that searches across all text fields
  const searchEstablishment = (establishment: EstablishmentWithDetails, searchTerm: string): boolean => {
    if (!searchTerm.trim()) return true;
    
    const searchLower = searchTerm.toLowerCase().trim();
    const searchWords = searchLower.split(/\s+/).filter(word => word.length > 0);
    
    // If no valid search words, return true
    if (searchWords.length === 0) return true;
    
    // Collect all searchable text from the establishment
    const searchableTexts: string[] = [];
    
    // Basic establishment fields
    if (establishment.name) searchableTexts.push(establishment.name.toLowerCase());
    if (establishment.description) searchableTexts.push(establishment.description.toLowerCase());
    if (establishment.area) searchableTexts.push(establishment.area.toLowerCase());
    if (establishment.floor) searchableTexts.push(establishment.floor.toLowerCase());
    if (establishment.note) searchableTexts.push(establishment.note.toLowerCase());
    
    // Status (formatted)
    if (establishment.status) {
      const statusText = establishment.status
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
        .toLowerCase();
      searchableTexts.push(statusText);
    }
    
    // Visitor names
    if (establishment.top_visitors) {
      establishment.top_visitors.forEach(visitor => {
        if (visitor.first_name) searchableTexts.push(visitor.first_name.toLowerCase());
        if (visitor.last_name) searchableTexts.push(visitor.last_name.toLowerCase());
        // Full name
        if (visitor.first_name && visitor.last_name) {
          searchableTexts.push(`${visitor.first_name} ${visitor.last_name}`.toLowerCase());
        }
      });
    }
    
    // Visit count as text (for searching "5 visits", "no visits", etc.)
    const visitCount = establishment.visit_count || 0;
    searchableTexts.push(visitCount.toString());
    searchableTexts.push(`${visitCount} visits`);
    searchableTexts.push(`${visitCount} visit`);
    if (visitCount === 0) {
      searchableTexts.push('no visits', 'zero visits', '0 visits');
    }
    
    // Householder count as text
    const householderCount = establishment.householder_count || 0;
    searchableTexts.push(householderCount.toString());
    searchableTexts.push(`${householderCount} bible studies`);
    searchableTexts.push(`${householderCount} bible study`);
    if (householderCount === 0) {
      searchableTexts.push('no bible studies', 'zero bible studies', '0 bible studies');
    }
    
    // Combine all searchable text
    const fullText = searchableTexts.join(' ');
    
    // Check if ALL search words are found in the text
    return searchWords.every(word => fullText.includes(word));
  };

  // Filter establishments based on current filters
  const filteredEstablishments = useMemo(() => {
    return establishments.filter(establishment => {
      // Enhanced search filter
      if (filters.search && !searchEstablishment(establishment, filters.search)) {
        return false;
      }

      // Status filter - if no statuses selected, show all
      if (filters.statuses.length > 0 && !filters.statuses.includes(establishment.status)) {
        return false;
      }

      // Area filter - if no areas selected, show all
      if (filters.areas.length > 0 && establishment.area && !filters.areas.includes(establishment.area)) {
        return false;
      }

      // My Establishments filter
      if (filters.myEstablishments && currentUserId) {
        const hasVisited = establishment.top_visitors?.some(visitor => visitor.user_id === currentUserId);
        if (!hasVisited) return false;
      }

      return true;
    });
  }, [establishments, filters, currentUserId]);

  // Get unique areas for filter options - ensure no empty strings
  const uniqueAreas = useMemo(() => {
    const areas = establishments
      .map(e => e.area)
      .filter(area => area && typeof area === 'string' && area.trim() !== "")
      .filter((area, index, arr) => arr.indexOf(area) === index) // Remove duplicates
      .sort();
    return areas;
  }, [establishments]);

  // Status options
  const statusOptions = [
    { value: "for_scouting", label: "For Scouting" },
    { value: "for_follow_up", label: "For Follow Up" },
    { value: "accepted_rack", label: "Accepted Rack" },
    { value: "declined_rack", label: "Declined Rack" },
    { value: "has_bible_studies", label: "Has Bible Studies" }
  ];

  // Area options - ensure no null/undefined values
  const areaOptions = uniqueAreas.map(area => ({
    value: area || '',
    label: area || ''
  })).filter(option => option.value !== '');

  const clearFilters = () => {
    setFilters({
      search: "",
      statuses: [],
      areas: [],
      myEstablishments: false
    });
  };

  const hasActiveFilters = filters.search !== "" || 
    filters.statuses.length > 0 || 
    filters.areas.length > 0 || 
    filters.myEstablishments;

  const handleEstablishmentClick = async (establishment: EstablishmentWithDetails) => {
    console.log('Card clicked:', establishment.name);
    setSelectedEstablishment(establishment);
    setIsExpanding(true);
    
    // Update URL with establishment ID
    const params = new URLSearchParams(searchParams);
    params.set('establishment', establishment.id || '');
    router.push(`/business?${params.toString()}`, { scroll: false });
    
    if (establishment.id) {
      await loadEstablishmentDetails(establishment.id);
    }
  };

  const handleBackClick = () => {
    setIsExpanding(false);
    
    // Remove establishment from URL
    const params = new URLSearchParams(searchParams);
    params.delete('establishment');
    router.push(`/business?${params.toString()}`, { scroll: false });
    
    setTimeout(() => {
      setSelectedEstablishment(null);
      setSelectedEstablishmentDetails(null);
    }, 300);
  };

  return (
    <div className="space-y-6 pb-20 w-full max-w-full">
      <AnimatePresence mode="wait">
        {selectedEstablishment && isExpanding && selectedEstablishmentDetails ? (
          // Enhanced expanded establishment view
          <motion.div
            key="expanded"
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ 
              layout: { 
                type: "spring", 
                stiffness: 300, 
                damping: 30,
                duration: 0.6
              }
            }}
            className="space-y-6 w-full max-w-full"
          >
            <EstablishmentDetails
              establishment={selectedEstablishment}
              visits={selectedEstablishmentDetails.visits}
              householders={selectedEstablishmentDetails.householders}
              onBackClick={handleBackClick}
            />
          </motion.div>
        ) : (
          // Original list view with filters
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-full"
          >
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">BWI</h1>
                <p className="text-muted-foreground">Business Witnessing</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2"
              >
                <Filter className="h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-1">
                    {(filters.search ? 1 : 0) + filters.statuses.length + filters.areas.length + (filters.myEstablishments ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </div>

            {/* Filters Section */}
            <BusinessFilters
              showFilters={showFilters}
              filters={filters}
              onFiltersChange={setFilters}
              onClearFilters={clearFilters}
              hasActiveFilters={hasActiveFilters}
              statusOptions={statusOptions}
              areaOptions={areaOptions}
            />

            {/* Results Count */}
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filteredEstablishments.length} of {establishments.length} establishments
              {hasActiveFilters && (
                <span className="ml-2">
                  (filtered)
                </span>
              )}
            </div>

            {/* Establishments List */}
            <EstablishmentList
              establishments={filteredEstablishments}
              onEstablishmentClick={handleEstablishmentClick}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function BusinessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <BusinessPageContent />
    </Suspense>
  );
}

