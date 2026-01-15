"use client";

import { useEffect, useState, useMemo } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDateHuman } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Calendar, ChevronRight, User, UserCheck, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { cacheGet, cacheSet } from "@/lib/offline/store";
import { getStatusTextColor, getBestStatus, getStatusColor } from "@/lib/utils/status-hierarchy";

interface VisitRecord {
  id: string;
  visit_date: string;
  establishment_name?: string;
  householder_name?: string;
  visit_type: 'establishment' | 'householder';
  establishment_id?: string;
  householder_id?: string;
  establishment_status?: string;
  notes?: string;
  created_at: string;
  publisher_id?: string;
  publisher?: {
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  partner?: {
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
}

interface BWIVisitHistoryProps {
  userId: string;
  onVisitClick?: (visit: VisitRecord) => void;
}

export function BWIVisitHistory({ userId, onVisitClick }: BWIVisitHistoryProps) {
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [allVisitsRaw, setAllVisitsRaw] = useState<VisitRecord[]>([]); // Store all visits without filtering
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [myUpdatesOnly, setMyUpdatesOnly] = useState(false);
  
  // Filter visits based on myUpdatesOnly toggle
  const allVisits = useMemo(() => {
    if (!myUpdatesOnly) {
      return allVisitsRaw; // Show all visits
    }
    // Filter to show only visits by current user
    return allVisitsRaw.filter(visit => visit.publisher_id === userId);
  }, [allVisitsRaw, myUpdatesOnly, userId]);

  // Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    
    // Set initial state
    setIsOffline(!navigator.onLine);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load initial visits (last 5) - always show user's visits only
  useEffect(() => {
    const loadInitialVisits = async () => {
      if (!userId) return;
      
      setLoading(true);
      
      const cacheKey = `bwi-visits-${userId}`;
      
      // Try to load from cache first
      const cachedData = await cacheGet(cacheKey);
      if (cachedData) {
        setVisits(cachedData.visits || []);
        setLoading(false);
      }
      
      // If offline, don't attempt network request
      if (isOffline) {
        setLoading(false);
        return;
      }
      
      try {
        const supabase = createSupabaseBrowserClient();
        
        // Get establishment visits (only those without householder_id) - always user's visits
        const { data: establishmentVisits, error: estError } = await supabase
          .from('business_visits')
          .select(`
            id,
            visit_date,
            note,
            created_at,
            establishment_id,
            business_establishments(name, statuses),
            publisher:profiles!business_visits_publisher_id_fkey(first_name, last_name, avatar_url),
            partner:profiles!business_visits_partner_id_fkey(first_name, last_name, avatar_url)
          `)
          .eq('publisher_id', userId)
          .is('householder_id', null)
          .not('establishment_id', 'is', null)
          .order('visit_date', { ascending: false })
          .limit(5);

        if (estError) throw estError;

        // Get householder visits - always user's visits
        const { data: householderVisits, error: hhError } = await supabase
          .from('business_visits')
          .select(`
            id,
            visit_date,
            note,
            created_at,
            householder_id,
            business_householders(name, establishment_id),
            business_establishments(name, statuses),
            publisher:profiles!business_visits_publisher_id_fkey(first_name, last_name, avatar_url),
            partner:profiles!business_visits_partner_id_fkey(first_name, last_name, avatar_url)
          `)
          .eq('publisher_id', userId)
          .not('householder_id', 'is', null)
          .order('visit_date', { ascending: false })
          .limit(5);

        if (hhError) throw hhError;

        // Combine and format visits
        const combinedVisits: VisitRecord[] = [
          ...(establishmentVisits || []).map(v => ({
            id: `est-${v.id}`,
            visit_date: v.visit_date,
            establishment_name: (v.business_establishments as any)?.name,
            establishment_status: getBestStatus((v.business_establishments as any)?.statuses || []),
            visit_type: 'establishment' as const,
            establishment_id: v.establishment_id,
            notes: v.note,
            created_at: v.created_at,
            publisher: (v.publisher as any) || undefined,
            partner: (v.partner as any) || undefined
          })),
          ...(householderVisits || []).map(v => ({
            id: `hh-${v.id}`,
            visit_date: v.visit_date,
            householder_name: (v.business_householders as any)?.name,
            establishment_name: (v.business_establishments as any)?.name,
            establishment_status: getBestStatus((v.business_establishments as any)?.statuses || []),
            visit_type: 'householder' as const,
            householder_id: v.householder_id,
            notes: v.note,
            created_at: v.created_at,
            publisher: (v.publisher as any) || undefined,
            partner: (v.partner as any) || undefined
          }))
        ];

        // Remove duplicates and sort by visit date (newest first) and take top 5
        const uniqueVisits = combinedVisits.filter((visit, index, self) => 
          index === self.findIndex(v => v.id === visit.id)
        );
        
        const sortedVisits = uniqueVisits
          .sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime())
          .slice(0, 5);

        setVisits(sortedVisits);
        
        // Cache the data
        const dataToCache = {
          visits: sortedVisits,
          timestamp: new Date().toISOString()
        };
        await cacheSet(cacheKey, dataToCache);
        
      } catch (error) {
        console.error('Error loading visit history:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialVisits();
  }, [userId]);

  // Load all visits for drawer
  const loadAllVisits = async (offset = 0) => {
    if (!userId) return;
    
    setLoadingMore(true);
    
    const cacheKey = `bwi-all-visits-${userId}-${offset}`;
    
    // Try to load from cache first (only for initial load)
    if (offset === 0) {
      const cachedData = await cacheGet(`bwi-all-visits-${userId}-0`);
      if (cachedData) {
        // Clear the cache to force fresh data fetch with correct status information
        await cacheSet(`bwi-all-visits-${userId}-0`, null);
      }
    }
    
    // If offline, don't attempt network request
    if (isOffline) {
      setLoadingMore(false);
      return;
    }
    
    try {
      const supabase = createSupabaseBrowserClient();
      
      // Build query for establishment visits - always load all, filter client-side
      let establishmentQuery = supabase
        .from('business_visits')
        .select(`
          id,
          visit_date,
          note,
          created_at,
          establishment_id,
          publisher_id,
          business_establishments(name, statuses),
          publisher:profiles!business_visits_publisher_id_fkey(first_name, last_name, avatar_url),
          partner:profiles!business_visits_partner_id_fkey(first_name, last_name, avatar_url)
        `)
        .is('householder_id', null)
        .not('establishment_id', 'is', null);
      
      const { data: establishmentVisits, error: estError } = await establishmentQuery
        .order('visit_date', { ascending: false })
        .range(offset, offset + 19);

      if (estError) throw estError;

      // Build query for householder visits - always load all, filter client-side
      let householderQuery = supabase
        .from('business_visits')
        .select(`
          id,
          visit_date,
          note,
          created_at,
          householder_id,
          publisher_id,
          business_householders(name, establishment_id),
          business_establishments(name, statuses),
          publisher:profiles!business_visits_publisher_id_fkey(first_name, last_name, avatar_url),
          partner:profiles!business_visits_partner_id_fkey(first_name, last_name, avatar_url)
        `)
        .not('householder_id', 'is', null);
      
      const { data: householderVisits, error: hhError } = await householderQuery
        .order('visit_date', { ascending: false })
        .range(offset, offset + 19);

      if (hhError) throw hhError;

      // Combine and format visits
      const combinedVisits: VisitRecord[] = [
        ...(establishmentVisits || []).map(v => ({
          id: `est-${v.id}`,
          visit_date: v.visit_date,
          establishment_name: (v.business_establishments as any)?.name,
          establishment_status: getBestStatus((v.business_establishments as any)?.statuses || []),
          visit_type: 'establishment' as const,
          establishment_id: v.establishment_id,
          notes: v.note,
          created_at: v.created_at,
          publisher_id: (v as any).publisher_id,
          publisher: (v.publisher as any) || undefined,
          partner: (v.partner as any) || undefined
        })),
        ...(householderVisits || []).map(v => ({
          id: `hh-${v.id}`,
          visit_date: v.visit_date,
          householder_name: (v.business_householders as any)?.name,
          establishment_name: (v.business_establishments as any)?.name,
          establishment_status: getBestStatus((v.business_establishments as any)?.statuses || []),
          visit_type: 'householder' as const,
          householder_id: v.householder_id,
          notes: v.note,
          created_at: v.created_at,
          publisher_id: (v as any).publisher_id,
          publisher: (v.publisher as any) || undefined,
          partner: (v.partner as any) || undefined
        }))
      ];

      // Remove duplicates and sort by visit date (newest first)
      const uniqueVisits = combinedVisits.filter((visit, index, self) => 
        index === self.findIndex(v => v.id === visit.id)
      );
      
      const sortedVisits = uniqueVisits
        .sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());

      if (offset === 0) {
        setAllVisitsRaw(sortedVisits);
        
        // Cache the initial data (always cache without filter)
        const dataToCache = {
          visits: sortedVisits,
          timestamp: new Date().toISOString()
        };
        await cacheSet(`bwi-all-visits-${userId}-0`, dataToCache);
      } else {
        setAllVisitsRaw(prev => [...prev, ...sortedVisits]);
      }

      setHasMore(sortedVisits.length === 40); // 20 from each query
    } catch (error) {
      console.error('Error loading more visits:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSeeMore = () => {
    setShowDrawer(true);
    // Always load data when drawer opens
    loadAllVisits(0);
  };

  // Load data when drawer opens (only once, not when filter changes)
  useEffect(() => {
    if (showDrawer && allVisitsRaw.length === 0) {
      loadAllVisits(0);
    }
  }, [showDrawer]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadAllVisits(allVisits.length);
    }
  };

  const formatVisitDate = (dateString: string) => {
    const date = new Date(dateString);
    return formatDateHuman(dateString);
  };

  const getVisitTypeColor = (type: 'establishment' | 'householder') => {
    return type === 'establishment' ? 'bg-blue-500' : 'bg-green-500';
  };

  const handleVisitClick = (visit: VisitRecord) => {
    if (onVisitClick) {
      onVisitClick(visit);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border p-4">
        <div className="text-sm font-medium mb-2 text-foreground">BWI Visit History</div>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (visits.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <div className="text-sm font-medium mb-2 text-foreground">BWI Visit History</div>
        <div className="text-sm text-muted-foreground">No visits recorded yet.</div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <button 
            onClick={handleSeeMore}
            className="flex items-center gap-2 text-sm font-bold text-foreground hover:opacity-80 transition-opacity"
          >
            BWI Visit History
            <ChevronRight className="h-4 w-4" />
          </button>
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-muted-foreground">Establishment</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-muted-foreground">Householder</span>
            </div>
          </div>
        </div>
        
        <div className="relative">
          <div className="space-y-6">
            {visits.map((visit, index) => (
              <div key={visit.id} className="flex items-start gap-3 relative">
                {/* Timeline line segment - only show if not the last item */}
                {index < visits.length - 1 && (
                  <div 
                    className="absolute w-0.5 bg-gray-500/60" 
                    style={{ 
                      left: '6px', 
                      top: '12px', 
                      height: 'calc(100% + 1rem)' 
                    }} 
                  />
                )}
                
                {/* Timeline dot */}
                <div className={`w-3 h-3 rounded-full ${getVisitTypeColor(visit.visit_type)} relative z-10 flex-shrink-0`} />
                
                {/* Visit details - clickable */}
                <button 
                  onClick={() => handleVisitClick(visit)}
                  className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground">
                      {visit.householder_name || visit.establishment_name}
                    </span>
                    {visit.visit_type === 'householder' && visit.establishment_name && (
                      <span 
                        className={`text-xs px-2 py-0.5 rounded-full border ${getStatusTextColor(visit.establishment_status || 'for_scouting')}`}
                        title={`Status: ${visit.establishment_status || 'for_scouting'}`}
                      >
                        {visit.establishment_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {formatVisitDate(visit.visit_date)}
                  </div>
                  {visit.notes && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {visit.notes}
                    </div>
                  )}
                </button>
                
                {/* Avatars - Publisher and Partner */}
                {visit.publisher && (
                  <div className="flex-shrink-0 flex items-center ml-4">
                    {visit.publisher.avatar_url ? (
                      <Image
                        src={visit.publisher.avatar_url}
                        alt={`${visit.publisher.first_name} ${visit.publisher.last_name}`}
                        width={24}
                        height={24}
                        className="rounded-full object-cover ring-2 ring-background w-6 h-6"
                      />
                    ) : (
                      <div className="rounded-full bg-gray-600 flex items-center justify-center text-white text-[10px] ring-2 ring-background w-6 h-6">
                        {visit.publisher.first_name?.charAt(0) || '?'}
                      </div>
                    )}
                    {visit.partner && (
                      <Image
                        src={visit.partner.avatar_url || ''}
                        alt={`${visit.partner.first_name} ${visit.partner.last_name}`}
                        width={24}
                        height={24}
                        className="rounded-full object-cover ring-2 ring-background -ml-2 w-6 h-6"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Drawer for all visits */}
      <ResponsiveModal
        open={showDrawer}
        onOpenChange={setShowDrawer}
        title="BWI Visit History"
        description="Complete visit history with infinite scroll"
      >
        {/* My Updates Toggle Button */}
        <div className="mb-4 flex justify-end">
          <AnimatePresence mode="wait">
            {myUpdatesOnly ? (
              <motion.div
                key="my-updates-expanded"
                initial={{ width: 36, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 36, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-1"
              >
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-9 rounded-full px-3 flex items-center gap-2"
                  onClick={() => setMyUpdatesOnly(false)}
                  aria-label="My updates"
                >
                  <UserCheck className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm whitespace-nowrap">My Updates</span>
                  <X className="h-4 w-4 flex-shrink-0" />
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="my-updates-icon"
                initial={{ width: "auto", opacity: 0 }}
                animate={{ width: 36, opacity: 1 }}
                exit={{ width: "auto", opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 rounded-full flex-shrink-0"
                  onClick={() => setMyUpdatesOnly(true)}
                  aria-pressed={false}
                  aria-label="My updates"
                  title="My updates"
                >
                  <User className="h-4 w-4" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="relative max-h-[70vh] overflow-y-auto">
          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {allVisits.map((visit, index) => (
                <motion.div
                  key={visit.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-3 relative pb-4"
                >
                {/* Timeline line segment - only show if not the last item */}
                {index < allVisits.length - 1 && (
                  <div 
                    className="absolute w-0.5 bg-gray-500/60" 
                    style={{ 
                      left: '6px', 
                      top: '12px', 
                      height: 'calc(100% + 1.5rem)' 
                    }} 
                  />
                )}
                
                {/* Timeline dot */}
                <div className={`w-3 h-3 rounded-full ${getVisitTypeColor(visit.visit_type)} relative z-10 flex-shrink-0`} />
                
                {/* Visit details - clickable */}
                <button 
                  onClick={() => handleVisitClick(visit)}
                  className="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground">
                      {visit.householder_name || visit.establishment_name}
                    </span>
                    {visit.visit_type === 'householder' && visit.establishment_name && (
                      <span 
                        className={`text-xs px-2 py-0.5 rounded-full border ${getStatusTextColor(visit.establishment_status || 'for_scouting')}`}
                        title={`Status: ${visit.establishment_status || 'for_scouting'}`}
                      >
                        {visit.establishment_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                    <Calendar className="h-3 w-3" />
                    {formatVisitDate(visit.visit_date)}
                  </div>
                  {visit.notes && (
                    <div className="text-xs text-muted-foreground leading-relaxed">
                      {visit.notes}
                    </div>
                  )}
                </button>
                
                {/* Avatars - Publisher and Partner */}
                {visit.publisher && (
                  <div className="flex-shrink-0 flex items-center ml-4">
                    {visit.publisher.avatar_url ? (
                      <Image
                        src={visit.publisher.avatar_url}
                        alt={`${visit.publisher.first_name} ${visit.publisher.last_name}`}
                        width={24}
                        height={24}
                        className="rounded-full object-cover ring-2 ring-background w-6 h-6"
                      />
                    ) : (
                      <div className="rounded-full bg-gray-600 flex items-center justify-center text-white text-[10px] ring-2 ring-background w-6 h-6">
                        {visit.publisher.first_name?.charAt(0) || '?'}
                      </div>
                    )}
                    {visit.partner && (
                      <Image
                        src={visit.partner.avatar_url || ''}
                        alt={`${visit.partner.first_name} ${visit.partner.last_name}`}
                        width={24}
                        height={24}
                        className="rounded-full object-cover ring-2 ring-background -ml-2 w-6 h-6"
                      />
                    )}
                  </div>
                )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          
          {loadingMore && (
            <div className="text-center py-4">
              <div className="text-sm opacity-70">Loading more visits...</div>
            </div>
          )}
          
          {hasMore && !loadingMore && (
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={handleLoadMore}
            >
              Load More
            </Button>
          )}
          
          {!hasMore && allVisits.length > 0 && (
            <div className="text-center py-4">
              <div className="text-sm opacity-70">No more visits to load</div>
            </div>
          )}
        </div>
      </ResponsiveModal>
    </>
  );
}
