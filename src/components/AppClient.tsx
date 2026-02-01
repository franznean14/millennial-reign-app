"use client";

import { useState, useEffect, useCallback, useMemo, type ComponentType } from "react";
import dynamic from "next/dynamic";
// Lazy-load Supabase client to keep initial bundle small
let getSupabaseClientOnce: (() => Promise<import("@supabase/supabase-js").SupabaseClient>) | null = null;
const getSupabaseClient = async () => {
  if (!getSupabaseClientOnce) {
    getSupabaseClientOnce = async () => {
      const { createSupabaseBrowserClient } = await import("@/lib/supabase/client");
      return createSupabaseBrowserClient();
    };
  }
  return getSupabaseClientOnce();
};
import { motion } from "motion/react";
import { toast } from "@/components/ui/sonner";
import { LoginView } from "@/components/views/LoginView";
import { LoadingView } from "@/components/views/LoadingView";
import { UnifiedPortaledControls } from "@/components/UnifiedPortaledControls";
import { useSPA } from "@/components/SPAProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Import all the data and business logic functions
import { getDailyRecord, listDailyByMonth, upsertDailyRecord, isDailyEmpty, deleteDailyRecord } from "@/lib/db/dailyRecords";
import { getEstablishmentsWithDetails, getEstablishmentDetails, getHouseholderDetails, listHouseholders, deleteHouseholder, archiveHouseholder, calculateDistance, type EstablishmentWithDetails, type VisitWithUser, type HouseholderWithDetails, type BusinessFiltersState } from "@/lib/db/business";
import { useBusinessFilteredLists } from "@/lib/hooks/use-business-filtered-lists";
import { useBusinessFilterOptions } from "@/lib/hooks/use-business-filter-options";
import { useAccountState } from "@/lib/hooks/use-account-state";
import { getMyCongregation, saveCongregation, isAdmin, type Congregation } from "@/lib/db/congregations";
import { getProfile } from "@/lib/db/profiles";
import { archiveEstablishment, deleteEstablishment } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";
import { formatStatusText } from "@/lib/utils/formatters";
import { applyDeviceSafeAreaTop } from "@/lib/utils/device-safe-area";

// Lazy-load heavy UI components to reduce initial bundle
import { HomeSection } from "@/components/sections/HomeSection";
import { BusinessSection, type BusinessSectionProps } from "@/components/sections/BusinessSection";
import { CongregationSection, type CongregationSectionProps } from "@/components/sections/CongregationSection";
import { AccountSection } from "@/components/sections/AccountSection";
import { UnifiedFab } from "@/components/shared/UnifiedFab";
const HomeSummary = dynamic(() => import("@/components/home/HomeSummary").then(m => m.HomeSummary), { ssr: false });
const VisitHistory = dynamic(() => import("@/components/home/VisitHistory").then(m => m.VisitHistory), { ssr: false });
// FAB handled by UnifiedFab


export function AppClient() {
  // Global app state
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [admin, setAdmin] = useState(false);
  
  // Get SPA context for loading state
  const { setContentLoading, onSectionChange, popNavigation, setCurrentSection, pushNavigation, currentSection } = useSPA();

  // App-wide scroll lock: body/html should never scroll; sections provide their own scroll containers
  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    html.classList.add("app-scroll-locked");
    document.body.classList.add("app-scroll-locked");
    return () => {
      html.classList.remove("app-scroll-locked");
      document.body.classList.remove("app-scroll-locked");
    };
  }, []);

  // Home/Field Service state
  const [dateRanges, setDateRanges] = useState({
    monthStart: "",
    nextMonthStart: "",
    serviceYearStart: "",
    serviceYearEnd: "",
  });

  // Business state
  const [establishments, setEstablishments] = useState<EstablishmentWithDetails[]>([]);
  const [householders, setHouseholders] = useState<HouseholderWithDetails[]>([]);
  const [businessTab, setBusinessTab] = useState<'establishments' | 'householders' | 'map'>('establishments');
  
  // Update business tab based on current section
  useEffect(() => {
    if (currentSection === 'business-establishments') {
      setBusinessTab('establishments');
    } else if (currentSection === 'business-householders') {
      setBusinessTab('householders');
    } else if (currentSection === 'business-map') {
      setBusinessTab('map');
    }
  }, [currentSection]);
  const [viewMode, setViewMode] = useState<'detailed' | 'compact' | 'table'>(() => {
    // Load view mode preference from localStorage on initialization
    if (typeof window !== 'undefined') {
      try {
        const savedViewMode = localStorage.getItem('business-view-mode') as 'detailed' | 'compact' | 'table';
        if (savedViewMode && (savedViewMode === 'detailed' || savedViewMode === 'compact' || savedViewMode === 'table')) {
          return savedViewMode;
        }
      } catch {}
    }
    return 'detailed';
  });

  // Save view mode preference to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('business-view-mode', viewMode);
    } catch {}
  }, [viewMode]);

  // View mode cycling function
  const cycleViewMode = () => {
    const next: 'detailed' | 'compact' | 'table' = 
      viewMode === 'detailed' ? 'compact' : 
      viewMode === 'compact' ? 'table' : 'detailed';
    setViewMode(next);
  };
  
  // Debug tab changes
  useEffect(() => {
  }, [businessTab]);

  // Track if map view is active for hiding top bar
  const isMapViewActive = currentSection === 'business' && businessTab === 'map';

  // Add/remove CSS class to body for map view
  useEffect(() => {
    if (isMapViewActive) {
      document.body.classList.add('map-view-active');
    } else {
      document.body.classList.remove('map-view-active');
    }

    // Cleanup on unmount
    return () => {
      document.body.classList.remove('map-view-active');
    };
  }, [isMapViewActive]);
  const [selectedEstablishment, setSelectedEstablishment] = useState<EstablishmentWithDetails | null>(null);
  const [selectedEstablishmentDetails, setSelectedEstablishmentDetails] = useState<{
    establishment: EstablishmentWithDetails;
    visits: VisitWithUser[];
    householders: HouseholderWithDetails[];
  } | null>(null);
  const [selectedHouseholder, setSelectedHouseholder] = useState<HouseholderWithDetails | null>(null);
  const [selectedHouseholderDetails, setSelectedHouseholderDetails] = useState<{
    householder: HouseholderWithDetails;
    visits: VisitWithUser[];
    establishment?: { id: string; name: string } | null;
  } | null>(null);
  const defaultFilters: BusinessFiltersState = {
    search: "",
    statuses: [],
    areas: [],
    floors: [],
    myEstablishments: false,
    nearMe: false,
    userLocation: null,
    sort: "last_visit_desc",
  };

  const [filtersEstablishments, setFiltersEstablishments] = useState<BusinessFiltersState>(defaultFilters);
  const [filtersHouseholders, setFiltersHouseholders] = useState<BusinessFiltersState>(defaultFilters);
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);

  // Current tab's filters (establishments tab + map use establishment filters; householders tab uses householder filters).
  const filters = businessTab === "householders" ? filtersHouseholders : filtersEstablishments;

  const setFilters = useCallback(
    (updater: React.SetStateAction<BusinessFiltersState>) => {
      if (businessTab === "householders") {
        setFiltersHouseholders(updater);
      } else {
        setFiltersEstablishments(updater);
      }
    },
    [businessTab]
  );

  // Load persisted business filters from localStorage on mount (separate per establishment vs householder list).
  // Persisted: statuses, areas, floors, sort, search, myEstablishments, nearMe, userLocation for each list.
  useEffect(() => {
    let isMounted = true;
    try {
      if (typeof window === "undefined") return;
      const rawEst = window.localStorage.getItem("business:filters:establishments");
      const rawHh = window.localStorage.getItem("business:filters:householders");
      const merge = (raw: string | null, prev: BusinessFiltersState): BusinessFiltersState => {
        if (!raw) return prev;
        try {
          const saved = JSON.parse(raw) as Partial<BusinessFiltersState>;
          if (!saved) return prev;
          return {
            search: typeof saved.search === "string" ? saved.search : prev.search,
            statuses: Array.isArray(saved.statuses) ? saved.statuses : prev.statuses,
            areas: Array.isArray(saved.areas) ? saved.areas : prev.areas,
            floors: Array.isArray(saved.floors) ? saved.floors : prev.floors,
            myEstablishments: typeof saved.myEstablishments === "boolean" ? saved.myEstablishments : prev.myEstablishments,
            nearMe: typeof saved.nearMe === "boolean" ? saved.nearMe : prev.nearMe,
            userLocation: saved.userLocation != null ? saved.userLocation : prev.userLocation,
            sort: saved.sort ?? prev.sort ?? "last_visit_desc",
          };
        } catch {
          return prev;
        }
      };
      if (isMounted) {
        setFiltersEstablishments((prev) => merge(rawEst, prev));
        setFiltersHouseholders((prev) => merge(rawHh, prev));
      }
    } catch {
      // Ignore
    }
    if (isMounted) setFiltersHydrated(true);
    return () => { isMounted = false; };
  }, []);

  // Persist establishment and householder filters separately so switching tabs doesn't reset either.
  useEffect(() => {
    if (!filtersHydrated) return;
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem("business:filters:establishments", JSON.stringify(filtersEstablishments));
      window.localStorage.setItem("business:filters:householders", JSON.stringify(filtersHouseholders));
    } catch {}
  }, [filtersEstablishments, filtersHouseholders, filtersHydrated]);

  // Congregation state
  const [cong, setCong] = useState<Congregation | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [busy, setBusy] = useState(false);
  const [congregationInitialTab, setCongregationInitialTab] = useState<'meetings' | 'ministry' | 'admin' | undefined>(undefined);
  const [congregationTab, setCongregationTab] = useState<'meetings' | 'ministry' | 'admin'>('meetings');
  const [congregationSelectedHouseholder, setCongregationSelectedHouseholder] = useState<HouseholderWithDetails | null>(null);
  const [congregationSelectedHouseholderDetails, setCongregationSelectedHouseholderDetails] = useState<{
    householder: HouseholderWithDetails;
    visits: VisitWithUser[];
    establishment?: { id: string; name: string } | null;
  } | null>(null);
  
  // Update congregation tab when initialTab changes
  useEffect(() => {
    if (congregationInitialTab) {
      setCongregationTab(congregationInitialTab);
    }
  }, [congregationInitialTab]);

  // Home tab state
  const [homeTab, setHomeTab] = useState<'summary' | 'events'>('summary');

  // Account state
  const {
    editing,
    setEditing,
    editAccountOpen,
    setEditAccountOpen,
    passwordOpen,
    setPasswordOpen,
    hasPassword,
    setHasPassword,
    privacyPolicyOpen,
    setPrivacyPolicyOpen,
    accountTab,
    setAccountTab
  } = useAccountState({ userId, getSupabaseClient });

  // BWI state (global to prevent layout shifts)
  const [bwiEnabled, setBwiEnabled] = useState(false);
  const [isBwiParticipant, setIsBwiParticipant] = useState(false);

  // Add this state to track user's visited establishments
  const [userVisitedEstablishments, setUserVisitedEstablishments] = useState<Set<string>>(new Set());
  
  // Add this state to track user's visited householders
  const [userVisitedHouseholders, setUserVisitedHouseholders] = useState<Set<string>>(new Set());

  // Set content loading to false immediately when component mounts
  useEffect(() => {
    setContentLoading(false);
  }, [setContentLoading]);

  useEffect(() => {
    const handleSafeArea = () => applyDeviceSafeAreaTop();
    handleSafeArea();
    window.addEventListener("resize", handleSafeArea);
    window.addEventListener("orientationchange", handleSafeArea);
    return () => {
      window.removeEventListener("resize", handleSafeArea);
      window.removeEventListener("orientationchange", handleSafeArea);
    };
  }, []);

  // Load initial app data
  useEffect(() => {
    const loadAppData = async () => {
      setContentLoading(true);
      const supabase = await getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      const id = session?.user?.id || null;
      setUserId(id);
      
      if (id) {
        const [profileData, adminStatus, congregationData, { data: { user } }, bwiEnabledData, bwiParticipantData] = await Promise.all([
          getProfile(id),
          isAdmin(id),
          getMyCongregation(),
          supabase.auth.getUser(),
          supabase.rpc('is_business_enabled'),
          supabase.rpc('is_business_participant')
        ]);
        
        // Add email from auth to profile data
        const profileWithEmail = profileData ? { ...profileData, email: user?.email } : null;
        setProfile(profileWithEmail);
        setAdmin(adminStatus);
        setCong(congregationData);
        setBwiEnabled(!!bwiEnabledData.data);
        setIsBwiParticipant(!!bwiParticipantData.data);
        
        // Auto-open create modal if no congregation exists and user can create
        if (!congregationData?.id && adminStatus) {
          setMode("create");
          setModalOpen(true);
        }
      }
      
      setIsLoading(false);
      setContentLoading(false);
    };

    loadAppData();
  }, [setContentLoading]);

  // Calculate date ranges for home view
  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    
    const ymd = (yy: number, mmIndex: number, dd: number) => {
      const mm = String(mmIndex + 1).padStart(2, "0");
      const ddStr = String(dd).padStart(2, "0");
      return `${yy}-${mm}-${ddStr}`;
    };
    
    const monthStart = ymd(y, m, 1);
    const nextMonthStart = m === 11 ? ymd(y + 1, 0, 1) : ymd(y, m + 1, 1);
    const serviceYearStart = m >= 8 ? ymd(y, 8, 1) : ymd(y - 1, 8, 1);
    const serviceYearEnd = m >= 8 ? ymd(y + 1, 8, 1) : ymd(y, 8, 1);
    
    setDateRanges({
      monthStart,
      nextMonthStart,
      serviceYearStart,
      serviceYearEnd,
    });
  }, []);

  // Load business data when on business section
  useEffect(() => {
    if (currentSection === 'business') {
      loadBusinessData();
    }
  }, [currentSection]);

  // Cleanup location tracking when leaving business section or component unmounts
  useEffect(() => {
    return () => {
      if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
        setLocationWatchId(null);
      }
    };
  }, [locationWatchId]);

  // Stop location tracking only when leaving the business area entirely (not when switching establishment/householder/map tabs).
  const isBusinessArea = currentSection === "business" || currentSection.startsWith("business-");
  useEffect(() => {
    if (!isBusinessArea && locationWatchId !== null) {
      navigator.geolocation.clearWatch(locationWatchId);
      setLocationWatchId(null);
      setFiltersEstablishments((prev) => ({ ...prev, nearMe: false, userLocation: null }));
      setFiltersHouseholders((prev) => ({ ...prev, nearMe: false, userLocation: null }));
    }
  }, [isBusinessArea, locationWatchId]);


  // Add this effect to load user's visited establishments
  useEffect(() => {
    if (currentSection === 'business' && userId) {
      const loadUserVisits = async () => {
        try {
          const supabase = await getSupabaseClient();
          const { data: visits } = await supabase
            .from('calls')
            .select('establishment_id, householder_id')
            .eq('publisher_id', userId);
          
          if (visits) {
            const visitedEstablishmentIds = new Set(visits.map(v => v.establishment_id).filter(Boolean));
            setUserVisitedEstablishments(visitedEstablishmentIds);
            
            const visitedHouseholderIds = new Set(visits.map(v => v.householder_id).filter(Boolean));
            setUserVisitedHouseholders(visitedHouseholderIds);
          }
        } catch (error) {
          console.error('Failed to load user visits:', error);
        }
      };
      
      loadUserVisits();
    }
  }, [currentSection, userId]);

  // Auto-open congregation form for admins without congregation (with proper timing)
  const [hasTriedAutoOpen, setHasTriedAutoOpen] = useState(false);
  useEffect(() => {
    if (currentSection === 'congregation' && admin && !(profile as any)?.congregation_id && !cong?.id && !modalOpen && !hasTriedAutoOpen) {
      setMode("create");
      setModalOpen(true);
      setHasTriedAutoOpen(true);
    }
  }, [currentSection, admin, (profile as any)?.congregation_id, cong?.id, modalOpen, hasTriedAutoOpen]);

  // Reset auto-open flag when leaving congregation section
  useEffect(() => {
    if (currentSection !== 'congregation') {
      setHasTriedAutoOpen(false);
      // Reset initial tab when leaving congregation section
      setCongregationInitialTab(undefined);
    }
  }, [currentSection]);

  // Business functions
  const loadBusinessData = useCallback(async () => {
    try {
      // Check if offline and load from cache if needed
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      
      const [establishmentsData, householdersData] = await Promise.all([
        getEstablishmentsWithDetails(),
        listHouseholders()
      ]);
      setEstablishments(establishmentsData);
      setHouseholders(householdersData.filter((householder) => !!householder.establishment_id));

      // Set up business event listeners
      businessEventBus.subscribe('establishment-added', addNewEstablishment);
      businessEventBus.subscribe('establishment-updated', updateEstablishment);
      businessEventBus.subscribe('householder-added', addNewHouseholder);
      businessEventBus.subscribe('visit-added', addNewVisit);
      businessEventBus.subscribe('visit-updated', (v: any) => {
        setSelectedEstablishmentDetails(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            visits: prev.visits.map((existing) => existing.id === v.id ? {
              ...existing,
              note: v.note ?? existing.note,
              visit_date: v.visit_date ?? existing.visit_date,
              publisher_id: v.publisher_id ?? existing.publisher_id,
              partner_id: v.partner_id ?? existing.partner_id,
              publisher: v.publisher ?? existing.publisher,
              partner: v.partner ?? existing.partner,
            } : existing)
          };
        });
        setSelectedHouseholderDetails(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            visits: prev.visits.map((existing) => existing.id === v.id ? {
              ...existing,
              note: v.note ?? existing.note,
              visit_date: v.visit_date ?? existing.visit_date,
              publisher_id: v.publisher_id ?? existing.publisher_id,
              partner_id: v.partner_id ?? existing.partner_id,
              publisher: v.publisher ?? existing.publisher,
              partner: v.partner ?? existing.partner,
            } : existing)
          };
        });
      });
      businessEventBus.subscribe('visit-deleted', (v: any) => {
        setSelectedEstablishmentDetails(prev => {
          if (!prev) return prev;
          return { ...prev, visits: prev.visits.filter(ex => ex.id !== v.id) };
        });
        setSelectedHouseholderDetails(prev => {
          if (!prev) return prev;
          return { ...prev, visits: prev.visits.filter(ex => ex.id !== v.id) };
        });
      });
      businessEventBus.subscribe('householder-updated', (hh: any) => {
        // Update main householders list
        setHouseholders(prev => prev.map(h => h.id === hh.id ? { ...h, ...hh } : h));
        
        setSelectedEstablishmentDetails(prev => {
          if (!prev) return prev;
          // Create new arrays to ensure React detects the changes
          const updatedHouseholders = prev.householders.map(h => h.id === hh.id ? { ...h, ...hh } : h);
          const updatedVisits = prev.visits.map(visit => {
            if (visit.householder && visit.householder.id === hh.id) {
              return { 
                ...visit, 
                householder: { ...visit.householder, ...hh }
              };
            }
            return visit;
          });
          
          return { 
            ...prev, 
            householders: updatedHouseholders,
            visits: updatedVisits
          };
        });
        setSelectedHouseholder(prev => prev && prev.id === hh.id ? { ...prev, ...hh } : prev);
        setSelectedHouseholderDetails(prev => prev && prev.householder.id === hh.id ? { ...prev, householder: { ...prev.householder, ...hh } } : prev);
      });
      businessEventBus.subscribe('householder-deleted', (hh: any) => {
        setSelectedEstablishmentDetails(prev => {
          if (!prev) return prev;
          return { ...prev, householders: prev.householders.filter(h => h.id !== hh.id) };
        });
        setSelectedHouseholder(null);
        setSelectedHouseholderDetails(null);
      });

      return () => {
        businessEventBus.unsubscribe('establishment-added', addNewEstablishment);
        businessEventBus.unsubscribe('establishment-updated', updateEstablishment);
        businessEventBus.unsubscribe('householder-added', addNewHouseholder);
        businessEventBus.unsubscribe('visit-added', addNewVisit);
        // Note: inline callbacks cannot be unsubscribed reliably; in a real setup, keep named refs
      };
    } catch (error) {
      console.error('Failed to load business data:', error);
    }
  }, []);

  const loadEstablishmentDetails = useCallback(async (establishmentId: string) => {
    try {
      // Check if offline and load from cache if needed
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      
      const details = await getEstablishmentDetails(establishmentId);
      setSelectedEstablishmentDetails(details);
    } catch (error) {
      console.error('Failed to load establishment details:', error);
    }
  }, []);

  // Reset scroll position when navigating to establishment details
  useEffect(() => {
    if (selectedEstablishment) {
      // Reset scroll position immediately when establishment is selected
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      });
    }
  }, [selectedEstablishment]);

  // Reset scroll position when navigating to householder details
  useEffect(() => {
    if (selectedHouseholder) {
      // Reset scroll position immediately when householder is selected
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      });
    }
  }, [selectedHouseholder]);

  const loadHouseholderDetails = useCallback(async (householderId: string) => {
    try {
      // Check if offline and load from cache if needed
      const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
      
      const details = await getHouseholderDetails(householderId);
      setSelectedHouseholderDetails(details);
    } catch (error) {
      console.error('Failed to load householder details:', error);
    }
  }, []);

  const loadCongregationHouseholderDetails = useCallback(async (householderId: string) => {
    try {
      const details = await getHouseholderDetails(householderId);
      if (details) {
        setCongregationSelectedHouseholderDetails(details);
        // Also update selectedHouseholder with the full details (including lat/lng)
        setCongregationSelectedHouseholder(details.householder);
      } else {
        setCongregationSelectedHouseholderDetails(null);
      }
    } catch (error) {
      console.error("Failed to load congregation householder details:", error);
      setCongregationSelectedHouseholderDetails(null);
    }
  }, []);


  const addNewEstablishment = useCallback((establishment: EstablishmentWithDetails) => {
    setEstablishments(prev => {
      const establishmentExists = prev.some(existingEstablishment => existingEstablishment.id === establishment.id);
      if (establishmentExists) return prev;
      return [establishment, ...prev];
    });
  }, []);
  // Live update an establishment in list and details
  const updateEstablishment = useCallback((updated: Partial<EstablishmentWithDetails> & { id: string }) => {
    const merge = (target: EstablishmentWithDetails | null) => {
      if (!target || target.id !== updated.id) return target;
      const fields: Partial<EstablishmentWithDetails> = {
        name: updated.name as any,
        description: updated.description as any,
        area: updated.area as any,
        lat: updated.lat as any,
        lng: updated.lng as any,
        floor: updated.floor as any,
        statuses: (updated as any).statuses as any,
        note: updated.note as any,
        updated_at: (updated as any).updated_at as any,
      };
      const merged = { ...target, ...Object.fromEntries(Object.entries(fields).filter(([_, v]) => v !== undefined)) } as EstablishmentWithDetails;
      return merged;
    };

    setEstablishments(prev => prev.map(e => e.id === updated.id ? (merge(e) as EstablishmentWithDetails) : e));
    setSelectedEstablishment(prev => merge(prev));
    setSelectedEstablishmentDetails(prev => prev ? ({ ...prev, establishment: merge(prev.establishment)! }) : prev);
  }, []);

  const addNewHouseholder = useCallback((householder: HouseholderWithDetails) => {
    setSelectedEstablishmentDetails(prev => {
      if (!prev) return prev;
      return { ...prev, householders: [householder, ...prev.householders] };
    });
  }, []);

  const addNewVisit = useCallback((visit: VisitWithUser) => {
    setSelectedEstablishmentDetails(prev => {
      if (!prev) return prev;
      const visitExists = prev.visits.some(existingVisit => existingVisit.id === visit.id);
      if (visitExists) return prev;
      return { ...prev, visits: [visit, ...prev.visits] };
    });
    setSelectedHouseholderDetails(prev => {
      if (!prev) return prev;
      const visitExists = prev.visits.some(existingVisit => existingVisit.id === visit.id);
      if (visitExists) return prev;
      return { ...prev, visits: [visit, ...prev.visits] };
    });
  }, []);

  const handleDeleteEstablishment = useCallback(async (establishment: EstablishmentWithDetails) => {
    try {
      const success = await deleteEstablishment(establishment.id!);
      if (success) {
        toast.success(`${establishment.name} deleted successfully`);
        setEstablishments(prev => prev.filter(e => e.id !== establishment.id));
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
        setEstablishments(prev => prev.filter(e => e.id !== establishment.id));
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

  const handleDeleteHouseholder = useCallback(async (householder: HouseholderWithDetails) => {
    try {
      const success = await deleteHouseholder(householder.id);
      if (success) {
        toast.success(`${householder.name} deleted successfully`);
        setHouseholders(prev => prev.filter(h => h.id !== householder.id));
        if (selectedHouseholder?.id === householder.id) {
          setSelectedHouseholder(null);
          setSelectedHouseholderDetails(null);
        }
      } else {
        toast.error('Failed to delete householder');
      }
    } catch (error) {
      console.error('Failed to delete householder:', error);
      toast.error('Failed to delete householder');
    }
  }, [selectedHouseholder]);

  const handleArchiveHouseholder = useCallback(async (householder: HouseholderWithDetails) => {
    try {
      const success = await archiveHouseholder(householder.id);
      if (success) {
        toast.success(`${householder.name} archived successfully`);
        setHouseholders(prev => prev.filter(h => h.id !== householder.id));
        if (selectedHouseholder?.id === householder.id) {
          setSelectedHouseholder(null);
          setSelectedHouseholderDetails(null);
        }
      } else {
        toast.error('Failed to archive householder');
      }
    } catch (error) {
      console.error('Failed to archive householder:', error);
      toast.error('Failed to archive householder');
    }
  }, [selectedHouseholder]);

  const { filteredEstablishments, filteredHouseholders } = useBusinessFilteredLists({
    establishments,
    householders,
    filtersEstablishments,
    filtersHouseholders,
    userVisitedEstablishments,
    userVisitedHouseholders,
    userId
  });

  const handleRemoveStatus = (status: string) => {
    setFilters((prev) => ({ ...prev, statuses: prev.statuses.filter((s) => s !== status) }));
  };

  const handleRemoveArea = (area: string) => {
    setFilters((prev) => ({ ...prev, areas: prev.areas.filter((a) => a !== area) }));
  };

  const handleRemoveFloor = (floor: string) => {
    setFilters((prev) => ({ ...prev, floors: prev.floors.filter((f) => f !== floor) }));
  };

  const handleClearSearch = () => {
    setFilters((prev) => ({ ...prev, search: "" }));
  };

  const onNavigateToBusinessWithStatus = useCallback(
    (tab: "establishments" | "householders", status: string) => {
      setBusinessTab(tab);
      if (tab === "establishments") {
        setFiltersEstablishments((prev) => ({ ...prev, statuses: [status] }));
      } else {
        setFiltersHouseholders((prev) => ({ ...prev, statuses: [status] }));
      }
      pushNavigation(currentSection);
      onSectionChange("business");
    },
    [currentSection, onSectionChange, pushNavigation]
  );

  const handleClearMyEstablishments = () => {
    setFilters((prev) => ({ ...prev, myEstablishments: false }));
  };

  const handleClearAllFilters = () => {
    setFilters((prev) => ({
      search: "",
      statuses: [],
      areas: [],
      floors: [],
      myEstablishments: false,
      nearMe: false,
      userLocation: null,
      sort: prev.sort || 'last_visit_desc',
    }));
  };

  const handleToggleNearMe = useCallback(async () => {
    if (filters.nearMe) {
      // Turn off near me filter - stop location tracking
      if (locationWatchId !== null) {
        navigator.geolocation.clearWatch(locationWatchId);
        setLocationWatchId(null);
      }
      setFilters(prev => ({ ...prev, nearMe: false, userLocation: null }));
    } else {
      // Turn on near me filter - start continuous location tracking
      setLocationLoading(true);
      try {
        if (!navigator.geolocation) {
          toast.error('Geolocation is not supported by this browser');
          return;
        }

        // First get current position immediately
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setFilters(prev => ({ 
              ...prev, 
              nearMe: true, 
              userLocation: [latitude, longitude] 
            }));
            setLocationLoading(false);
            toast.success('Location found! Showing places within 150m (sorted by distance)');
          },
          (error) => {
            console.error('Error getting initial location:', error);
            setLocationLoading(false);
            toast.error('Unable to get your location. Please check location permissions.');
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
          }
        );

        // Start watching position for continuous updates
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setFilters(prev => ({ 
              ...prev, 
              userLocation: [latitude, longitude] 
            }));
            // Don't show toast for every update, just update silently
          },
          (error) => {
            console.error('Error watching location:', error);
            // Don't show error toast for watch failures, just log
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 30000 // Update every 30 seconds
          }
        );
        
        setLocationWatchId(watchId);
      } catch (error) {
        console.error('Error accessing geolocation:', error);
        setLocationLoading(false);
        toast.error('Unable to access location services');
      }
    }
  }, [filters.nearMe, locationWatchId]);

  const { dynamicStatusOptions, dynamicAreaOptions, dynamicFloorOptions } = useBusinessFilterOptions({
    establishments,
    householders,
    filters,
    userVisitedEstablishments,
    businessTab
  });

  // Congregation functions
  const isElder = Array.isArray((profile as any)?.privileges) && (profile as any).privileges.includes('Elder');
  const canEdit = useMemo(() => {
    if (!userId) return false;
    if (!cong?.id) return admin;
    const myCong = (profile as any)?.congregation_id;
    return admin || (isElder && myCong && cong?.id === myCong);
  }, [userId, profile, cong, admin, isElder]);

  const initial: Congregation = cong ?? {
    name: "",
    address: "",
    lat: null,
    lng: null,
    midweek_day: 3,
    midweek_start: "19:00",
    weekend_day: 0,
    weekend_start: "10:00",
    meeting_duration_minutes: 105,
    business_witnessing_enabled: false,
  };


  // Render different sections based on currentSection
  if (isLoading) {
    return <LoadingView />;
  }

  if (!userId) {
    return <LoginView />;
  }

  // Unified Portaled Controls - Same element for all sections
  const portaledControls = (
    <UnifiedPortaledControls
      currentSection={currentSection}
      businessTab={businessTab}
      onBusinessTabChange={setBusinessTab}
      filters={filters}
      onFiltersChange={setFilters}
      onOpenFilters={() => setFiltersModalOpen(true)}
      viewMode={viewMode}
      onCycleViewMode={cycleViewMode}
      onClearSearch={handleClearSearch}
      onRemoveStatus={handleRemoveStatus}
      onRemoveArea={handleRemoveArea}
      onRemoveFloor={handleRemoveFloor}
      onClearMyEstablishments={handleClearMyEstablishments}
      onClearAllFilters={handleClearAllFilters}
      onToggleNearMe={handleToggleNearMe}
      formatStatusLabel={formatStatusText}
      selectedEstablishment={selectedEstablishment}
      selectedHouseholder={selectedHouseholder}
      onBackClick={() => {
        // When both are set we're on householder details (opened from establishment); handle householder first
        if (selectedHouseholder) {
          setSelectedHouseholder(null);
          setSelectedHouseholderDetails(null);
          if (selectedEstablishment) {
            // Came from establishment details → stay there (view will show establishment details)
            return;
          }
          const previousSection = popNavigation();
          if (previousSection) {
            const targetSection = previousSection.startsWith('business-') ? previousSection : 'business-householders';
            setCurrentSection(targetSection);
            const url = new URL(window.location.href);
            url.pathname = targetSection === 'home' ? '/' : '/business';
            window.history.pushState({}, '', url.toString());
          } else {
            setCurrentSection('business-householders');
            const url = new URL(window.location.href);
            url.pathname = '/business';
            window.history.pushState({}, '', url.toString());
          }
        } else if (selectedEstablishment) {
          setSelectedEstablishment(null);
          setSelectedEstablishmentDetails(null);
          const previousSection = popNavigation();
          if (previousSection) {
            const targetSection = previousSection.startsWith('business-') ? previousSection : 'business-establishments';
            setCurrentSection(targetSection);
            const url = new URL(window.location.href);
            url.pathname = targetSection === 'home' ? '/' : '/business';
            window.history.pushState({}, '', url.toString());
          } else {
            setCurrentSection('business-establishments');
            const url = new URL(window.location.href);
            url.pathname = '/business';
            window.history.pushState({}, '', url.toString());
          }
        }
      }}
      onEditClick={() => {
        if (selectedEstablishment || selectedHouseholder) {
          window.dispatchEvent(new CustomEvent('trigger-edit-details'));
        }
      }}
      congregationTab={congregationTab}
      onCongregationTabChange={setCongregationTab}
      congregationSelectedHouseholder={congregationSelectedHouseholder}
      onCongregationBackClick={() => {
        setCongregationSelectedHouseholder(null);
        setCongregationSelectedHouseholderDetails(null);
      }}
      onCongregationEditClick={() => {
        if (congregationSelectedHouseholder) {
          window.dispatchEvent(new CustomEvent("trigger-edit-details"));
        }
      }}
      isElder={isElder}
      homeTab={homeTab}
      onHomeTabChange={setHomeTab}
      accountTab={accountTab}
      onAccountTabChange={setAccountTab}
    />
  );

  const unifiedFab = (
    <UnifiedFab
      currentSection={currentSection}
      userId={userId}
      establishments={establishments}
      selectedEstablishment={selectedEstablishment}
      selectedHouseholder={selectedHouseholder}
      selectedArea={filters.areas[0]}
      businessTab={businessTab}
      congregationId={cong?.id ?? null}
      congregationTab={congregationTab}
      isElder={isElder}
      isAdmin={admin}
      congregationSelectedHouseholder={congregationSelectedHouseholder}
    />
  );

  const BusinessSectionView: ComponentType<BusinessSectionProps> = BusinessSection;
  const CongregationSectionView: ComponentType<CongregationSectionProps> = CongregationSection;

  // Render based on current section
  switch (currentSection) {
    case 'home':
      return (
        <>
        <HomeSection
          portaledControls={portaledControls}
          userId={userId}
          homeTab={homeTab}
          onNavigateToCongregation={() => {
            setCongregationInitialTab('ministry');
            onSectionChange('congregation');
          }}
          onNavigateToBusinessWithStatus={onNavigateToBusinessWithStatus}
          onSectionChange={onSectionChange}
          currentSection={currentSection}
          pushNavigation={pushNavigation}
          setBusinessTab={setBusinessTab}
          setSelectedEstablishment={setSelectedEstablishment}
          setSelectedHouseholder={setSelectedHouseholder}
          loadEstablishmentDetails={loadEstablishmentDetails}
          loadHouseholderDetails={loadHouseholderDetails}
        />
          {unifiedFab}
        </>
      );

    case 'business':
      return (
        <>
        <BusinessSectionView
          portaledControls={portaledControls}
          currentSection={currentSection}
          businessTab={businessTab}
          filters={filters}
          setFilters={setFilters}
          filtersModalOpen={filtersModalOpen}
          setFiltersModalOpen={setFiltersModalOpen}
          viewMode={viewMode}
          setViewMode={setViewMode}
          filteredEstablishments={filteredEstablishments}
          filteredHouseholders={filteredHouseholders}
          establishments={establishments}
          selectedEstablishment={selectedEstablishment}
          setSelectedEstablishment={setSelectedEstablishment}
          selectedEstablishmentDetails={selectedEstablishmentDetails}
          setSelectedEstablishmentDetails={setSelectedEstablishmentDetails}
          selectedHouseholder={selectedHouseholder}
          setSelectedHouseholder={setSelectedHouseholder}
          selectedHouseholderDetails={selectedHouseholderDetails}
          setSelectedHouseholderDetails={setSelectedHouseholderDetails}
          loadEstablishmentDetails={loadEstablishmentDetails}
          loadHouseholderDetails={loadHouseholderDetails}
          handleDeleteEstablishment={handleDeleteEstablishment}
          handleArchiveEstablishment={handleArchiveEstablishment}
          handleDeleteHouseholder={handleDeleteHouseholder}
          handleArchiveHouseholder={handleArchiveHouseholder}
          handleClearAllFilters={handleClearAllFilters}
          handleClearSearch={handleClearSearch}
          handleRemoveStatus={handleRemoveStatus}
          handleRemoveArea={handleRemoveArea}
          handleRemoveFloor={handleRemoveFloor}
          dynamicStatusOptions={dynamicStatusOptions}
          dynamicAreaOptions={dynamicAreaOptions}
          dynamicFloorOptions={dynamicFloorOptions}
          popNavigation={popNavigation}
          pushNavigation={pushNavigation}
          setCurrentSection={setCurrentSection}
          updateEstablishment={updateEstablishment}
        />
          {unifiedFab}
        </>
      );

    case 'congregation':
      return (
        <>
        <CongregationSectionView
          portaledControls={portaledControls}
          profileCongregationId={(profile as any)?.congregation_id}
          cong={cong}
          admin={admin}
          isElder={isElder}
          canEdit={canEdit}
          congregationInitialTab={congregationInitialTab}
          congregationTab={congregationTab}
          setCongregationTab={setCongregationTab}
          userId={userId}
            selectedHouseholder={congregationSelectedHouseholder}
            selectedHouseholderDetails={congregationSelectedHouseholderDetails}
            onSelectHouseholder={setCongregationSelectedHouseholder}
            onSelectHouseholderDetails={setCongregationSelectedHouseholderDetails}
            onClearSelectedHouseholder={() => {
              setCongregationSelectedHouseholder(null);
              setCongregationSelectedHouseholderDetails(null);
            }}
            loadHouseholderDetails={loadCongregationHouseholderDetails}
          modalOpen={modalOpen}
          setModalOpen={setModalOpen}
          mode={mode}
          setMode={setMode}
          busy={busy}
          setBusy={setBusy}
          initial={initial}
          setCong={setCong}
          saveCongregation={saveCongregation}
        />
          {unifiedFab}
        </>
      );

    case 'account':
      return (
        <>
          {portaledControls}
          {unifiedFab}
          <AccountSection
            userId={userId}
            profile={profile}
            accountTab={accountTab}
            setAccountTab={setAccountTab}
            editing={editing}
            setEditing={setEditing}
            editAccountOpen={editAccountOpen}
            setEditAccountOpen={setEditAccountOpen}
            passwordOpen={passwordOpen}
            setPasswordOpen={setPasswordOpen}
            privacyPolicyOpen={privacyPolicyOpen}
            setPrivacyPolicyOpen={setPrivacyPolicyOpen}
            hasPassword={hasPassword}
            setHasPassword={setHasPassword}
            bwiEnabled={bwiEnabled}
            isBwiParticipant={isBwiParticipant}
            setIsBwiParticipant={setIsBwiParticipant}
            setProfile={setProfile}
            getSupabaseClient={getSupabaseClient}
          />
        </>
      );

    default:
      return (
        <motion.div
          key="home"
          initial={{ opacity: 0, filter: "blur(6px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: 0.3 }}
          className="space-y-6 pb-20" // Add bottom padding for navbar
        >
          <HomeSummary
            userId={userId}
            monthStart={dateRanges.monthStart}
            nextMonthStart={dateRanges.nextMonthStart}
            serviceYearStart={dateRanges.serviceYearStart}
            serviceYearEnd={dateRanges.serviceYearEnd}
          />
          {unifiedFab}
        </motion.div>
      );
  }
}
