"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDateHuman } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Calendar, ChevronRight } from "lucide-react";
import { cacheGet, cacheSet } from "@/lib/offline/store";

interface VisitRecord {
  id: string;
  visit_date: string;
  establishment_name?: string;
  householder_name?: string;
  visit_type: 'establishment' | 'householder';
  establishment_id?: string;
  householder_id?: string;
  notes?: string;
  created_at: string;
}

interface BWIVisitHistoryProps {
  userId: string;
  onVisitClick?: (visit: VisitRecord) => void;
}

export function BWIVisitHistory({ userId, onVisitClick }: BWIVisitHistoryProps) {
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDrawer, setShowDrawer] = useState(false);
  const [allVisits, setAllVisits] = useState<VisitRecord[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

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

  // Load initial visits (last 5)
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
        
        // Get establishment visits (only those without householder_id)
        const { data: establishmentVisits, error: estError } = await supabase
          .from('business_visits')
          .select(`
            id,
            visit_date,
            note,
            created_at,
            establishment_id,
            business_establishments(name)
          `)
          .eq('publisher_id', userId)
          .is('householder_id', null)
          .not('establishment_id', 'is', null)
          .order('visit_date', { ascending: false })
          .limit(5);

        if (estError) throw estError;

        // Get householder visits (prioritize householder visits)
        const { data: householderVisits, error: hhError } = await supabase
          .from('business_visits')
          .select(`
            id,
            visit_date,
            note,
            created_at,
            householder_id,
            business_householders(name, establishment_id),
            business_establishments(name)
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
            visit_type: 'establishment' as const,
            establishment_id: v.establishment_id,
            notes: v.note,
            created_at: v.created_at
          })),
          ...(householderVisits || []).map(v => ({
            id: `hh-${v.id}`,
            visit_date: v.visit_date,
            householder_name: (v.business_householders as any)?.name,
            establishment_name: (v.business_establishments as any)?.name,
            visit_type: 'householder' as const,
            householder_id: v.householder_id,
            notes: v.note,
            created_at: v.created_at
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
        setAllVisits(cachedData.visits || []);
        setLoadingMore(false);
        return;
      }
    }
    
    // If offline, don't attempt network request
    if (isOffline) {
      setLoadingMore(false);
      return;
    }
    
    try {
      const supabase = createSupabaseBrowserClient();
      
        // Get establishment visits (only those without householder_id)
        const { data: establishmentVisits, error: estError } = await supabase
          .from('business_visits')
          .select(`
            id,
            visit_date,
            note,
            created_at,
            establishment_id,
            business_establishments(name)
          `)
          .eq('publisher_id', userId)
          .is('householder_id', null)
          .not('establishment_id', 'is', null)
          .order('visit_date', { ascending: false })
          .range(offset, offset + 19);

      if (estError) throw estError;

      // Get householder visits (prioritize householder visits)
      const { data: householderVisits, error: hhError } = await supabase
        .from('business_visits')
        .select(`
          id,
          visit_date,
          note,
          created_at,
          householder_id,
          business_householders(name, establishment_id),
          business_establishments(name)
        `)
        .eq('publisher_id', userId)
        .not('householder_id', 'is', null)
        .order('visit_date', { ascending: false })
        .range(offset, offset + 19);

      if (hhError) throw hhError;

      // Combine and format visits
      const combinedVisits: VisitRecord[] = [
        ...(establishmentVisits || []).map(v => ({
          id: `est-${v.id}`,
          visit_date: v.visit_date,
          establishment_name: (v.business_establishments as any)?.name,
          visit_type: 'establishment' as const,
          establishment_id: v.establishment_id,
          notes: v.note,
          created_at: v.created_at
        })),
        ...(householderVisits || []).map(v => ({
          id: `hh-${v.id}`,
          visit_date: v.visit_date,
          householder_name: (v.business_householders as any)?.name,
          establishment_name: (v.business_establishments as any)?.name,
          visit_type: 'householder' as const,
          householder_id: v.householder_id,
          notes: v.note,
          created_at: v.created_at
        }))
      ];

      // Remove duplicates and sort by visit date (newest first)
      const uniqueVisits = combinedVisits.filter((visit, index, self) => 
        index === self.findIndex(v => v.id === visit.id)
      );
      
      const sortedVisits = uniqueVisits
        .sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());

      if (offset === 0) {
        setAllVisits(sortedVisits);
        
        // Cache the initial data
        const dataToCache = {
          visits: sortedVisits,
          timestamp: new Date().toISOString()
        };
        await cacheSet(`bwi-all-visits-${userId}-0`, dataToCache);
      } else {
        setAllVisits(prev => [...prev, ...sortedVisits]);
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
    if (allVisits.length === 0) {
      loadAllVisits(0);
    }
  };

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
        <div className="text-sm font-medium mb-2">BWI Visit History</div>
        <div className="text-sm opacity-70">Loading...</div>
      </div>
    );
  }

  if (visits.length === 0) {
    return (
      <div className="rounded-lg border p-4">
        <div className="text-sm font-medium mb-2">BWI Visit History</div>
        <div className="text-sm opacity-70">No visits recorded yet.</div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <button 
            onClick={handleSeeMore}
            className="flex items-center gap-2 text-sm font-bold hover:opacity-80 transition-opacity"
          >
            BWI Visit History
            <ChevronRight className="h-4 w-4" />
          </button>
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-gray-600">Establishment</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-gray-600">Householder</span>
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
                    <span className="text-sm font-medium text-white">
                      {visit.householder_name || visit.establishment_name}
                    </span>
                    {visit.visit_type === 'householder' && visit.establishment_name && (
                      <span className="text-xs bg-gray-600/50 text-gray-300 px-2 py-0.5 rounded-full">
                        {visit.establishment_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-200">
                    <Calendar className="h-3 w-3" />
                    {formatVisitDate(visit.visit_date)}
                  </div>
                  {visit.notes && (
                    <div className="text-xs text-gray-300 mt-1 line-clamp-1">
                      {visit.notes}
                    </div>
                  )}
                </button>
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
        <div className="relative max-h-[70vh] overflow-y-auto">
          <div className="space-y-6">
            {allVisits.map((visit, index) => (
              <div key={visit.id} className="flex items-start gap-3 relative pb-4">
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
                    <span className="text-sm font-medium text-white">
                      {visit.householder_name || visit.establishment_name}
                    </span>
                    {visit.visit_type === 'householder' && visit.establishment_name && (
                      <span className="text-xs bg-gray-600/50 text-gray-300 px-2 py-0.5 rounded-full">
                        {visit.establishment_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-200 mb-2">
                    <Calendar className="h-3 w-3" />
                    {formatVisitDate(visit.visit_date)}
                  </div>
                  {visit.notes && (
                    <div className="text-xs text-gray-300 leading-relaxed">
                      {visit.notes}
                    </div>
                  )}
                </button>
              </div>
            ))}
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
