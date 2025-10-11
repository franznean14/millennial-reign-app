"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
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
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter, X } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EditAccountForm } from "@/components/account/EditAccountForm";
import { PasswordDialog } from "@/components/account/PasswordDialog";
import { BiometricToggle } from "@/components/account/BiometricToggle";
import { ProfileForm } from "@/components/account/ProfileForm";
import { LogoutButton } from "@/components/account/LogoutButton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Search, Building2, Users, MapPin, User, UserCheck, Filter as FilterIcon, LayoutGrid, List, Table as TableIcon } from "lucide-react";
import { cacheSet } from "@/lib/offline/store";
import { LoginView } from "@/components/views/LoginView";
import { LoadingView } from "@/components/views/LoadingView";
import { BusinessTabToggle } from "@/components/business/BusinessTabToggle";
import { PortaledBusinessControls } from "@/components/business/PortaledBusinessControls";
import { StickySearchBar } from "@/components/business/StickySearchBar";

// Import all the data and business logic functions
import { getDailyRecord, listDailyByMonth, upsertDailyRecord, isDailyEmpty, deleteDailyRecord } from "@/lib/db/dailyRecords";
import { getEstablishmentsWithDetails, getEstablishmentDetails, getHouseholderDetails, listHouseholders, deleteHouseholder, archiveHouseholder, calculateDistance, type EstablishmentWithDetails, type VisitWithUser, type HouseholderWithDetails, type BusinessFiltersState } from "@/lib/db/business";
import { getMyCongregation, saveCongregation, isAdmin, type Congregation } from "@/lib/db/congregations";
import { getProfile } from "@/lib/db/profiles";
import { archiveEstablishment, deleteEstablishment } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";

// Lazy-load heavy UI components to reduce initial bundle
const HomeSummary = dynamic(() => import("@/components/home/HomeSummary").then(m => m.HomeSummary), { ssr: false });
const TopStudies = dynamic(() => import("@/components/home/TopStudies").then(m => m.TopStudies), { ssr: false });
const EstablishmentList = dynamic(() => import("@/components/business/EstablishmentList").then(m => m.EstablishmentList), { ssr: false });
const HouseholderList = dynamic(() => import("@/components/business/HouseholderList").then(m => m.HouseholderList), { ssr: false });
const EstablishmentDetails = dynamic(() => import("@/components/business/EstablishmentDetails").then(m => m.EstablishmentDetails), { ssr: false });
const HouseholderDetails = dynamic(() => import("@/components/business/HouseholderDetails").then(m => m.HouseholderDetails), { ssr: false });
const EstablishmentMap = dynamic(() => import("@/components/business/EstablishmentMap").then(m => m.EstablishmentMap), { ssr: false });
const BusinessDrawerDialogs = dynamic(() => import("@/components/business/BusinessDrawerDialogs").then(m => m.BusinessDrawerDialogs), { ssr: false });
const CongregationForm = dynamic(() => import("@/components/congregation/CongregationForm").then(m => m.CongregationForm), { ssr: false });
const ResponsiveModal = dynamic(() => import("@/components/ui/responsive-modal").then(m => m.ResponsiveModal), { ssr: false });
const CongregationMembers = dynamic(() => import("@/components/congregation/CongregationMembers").then(m => m.CongregationMembers), { ssr: false });
const BusinessFiltersForm = dynamic(() => import("@/components/business/BusinessFiltersForm").then(m => m.BusinessFiltersForm), { ssr: false });
const CongregationView = dynamic(() => import("@/components/views/CongregationView").then(m => m.CongregationView), { ssr: false });
const FieldServiceDrawerDialog = dynamic(() => import("@/components/fieldservice/FieldServiceDrawerDialog").then(m => m.FieldServiceDrawerDialog), { ssr: false });
const CongregationDrawerDialog = dynamic(() => import("@/components/congregation/CongregationDrawerDialog").then(m => m.CongregationDrawerDialog), { ssr: false });

interface AppClientProps {
  currentSection: string;
}

// Status hierarchy from worst to best
const STATUS_HIERARCHY = [
  'declined_rack',      // Worst
  'for_scouting',       // Bad
  'for_follow_up',      // Better
  'accepted_rack',      // Good
  'for_replenishment',  // Better
  'has_bible_studies'   // Best
] as const;

// Helper function to get the best status from an array
const getBestStatus = (statuses: string[]): string => {
  if (!statuses || statuses.length === 0) return 'for_scouting';
  
  let bestStatus = statuses[0];
  let bestIndex = STATUS_HIERARCHY.indexOf(bestStatus as any);
  
  for (const status of statuses) {
    const index = STATUS_HIERARCHY.indexOf(status as any);
    if (index > bestIndex) {
      bestIndex = index;
      bestStatus = status;
    }
  }
  
  return bestStatus;
};

// Helper function to get status color based on hierarchy
const getStatusColor = (status: string) => {
  switch (status) {
    case 'declined_rack':
      return 'border-red-500/50 bg-red-500/5';
    case 'for_scouting':
      return 'border-gray-500/50 bg-gray-500/5';
    case 'for_follow_up':
      return 'border-orange-500/50 bg-orange-500/5';
    case 'accepted_rack':
      return 'border-blue-500/50 bg-blue-500/5';
    case 'for_replenishment':
      return 'border-purple-500/50 bg-purple-500/5';
    case 'has_bible_studies':
      return 'border-emerald-500/50 bg-emerald-500/10';
    default:
      return 'border-gray-500/50 bg-gray-500/5';
  }
};

const getStatusTextColor = (status: string) => {
  switch (status) {
    case 'declined_rack':
      return 'text-red-500 border-red-500/50';
    case 'for_scouting':
      return 'text-gray-500 border-gray-500/50';
    case 'for_follow_up':
      return 'text-orange-500 border-orange-500/50';
    case 'accepted_rack':
      return 'text-blue-500 border-blue-500/50';
    case 'for_replenishment':
      return 'text-purple-500 border-purple-500/50';
    case 'has_bible_studies':
      return 'text-emerald-500 border-emerald-500/50';
    default:
      return 'text-gray-500 border-gray-500/50';
  }
};

export function AppClient({ currentSection }: AppClientProps) {
  // Global app state
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [admin, setAdmin] = useState(false);

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
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<BusinessFiltersState>({
    search: "",
    statuses: [],
    areas: [],
    myEstablishments: false,
    nearMe: false,
    userLocation: null,
    sort: 'last_visit_desc'
  });
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  // Persist business filters globally for form auto-population
  useEffect(() => {
    try {
      cacheSet("business:filters", filters);
    } catch {}
  }, [filters]);

  // Congregation state
  const [cong, setCong] = useState<Congregation | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [busy, setBusy] = useState(false);

  // Account state
  const [editing, setEditing] = useState(false);
  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasPassword, setHasPassword] = useState<boolean>(false);

  // BWI state (global to prevent layout shifts)
  const [bwiEnabled, setBwiEnabled] = useState(false);
  const [isBwiParticipant, setIsBwiParticipant] = useState(false);

  // Add this state to track user's visited establishments
  const [userVisitedEstablishments, setUserVisitedEstablishments] = useState<Set<string>>(new Set());
  
  // Add this state to track user's visited householders
  const [userVisitedHouseholders, setUserVisitedHouseholders] = useState<Set<string>>(new Set());

  // Load initial app data
  useEffect(() => {
    const loadAppData = async () => {
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
    };

    loadAppData();
  }, []);

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

  // Load account data
  useEffect(() => {
    if (userId) {
      const loadAccountData = async () => {
        const supabase = await getSupabaseClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          try {
            localStorage.setItem("has_password", user.app_metadata?.provider === "email" ? "1" : "0");
            setHasPassword(user.app_metadata?.provider === "email");
          } catch {}
        }
      });
      };
      loadAccountData();
    }
  }, [userId]);

  // Add this effect to load user's visited establishments
  useEffect(() => {
    if (currentSection === 'business' && userId) {
      const loadUserVisits = async () => {
        try {
          const supabase = await getSupabaseClient();
          const { data: visits } = await supabase
            .from('business_visits')
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
    }
  }, [currentSection]);

  // Business functions
  const loadBusinessData = useCallback(async () => {
    try {
      const [establishmentsData, householdersData] = await Promise.all([
        getEstablishmentsWithDetails(),
        listHouseholders()
      ]);
      setEstablishments(establishmentsData);
      setHouseholders(householdersData);

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
      const details = await getHouseholderDetails(householderId);
      setSelectedHouseholderDetails(details);
    } catch (error) {
      console.error('Failed to load householder details:', error);
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

  // Business filtering logic
  const filteredEstablishments = useMemo(() => {
    const base = establishments.filter(establishment => {
      // Search filter - only show establishments that match the search term
      if (filters.search && filters.search.trim() !== '') {
        const searchTerm = filters.search.toLowerCase().trim();
        const establishmentName = establishment.name?.toLowerCase() || '';
        if (!establishmentName.includes(searchTerm)) {
          return false;
        }
      }
      
      // Status filter
      if (filters.statuses.length > 0 && !establishment.statuses?.some(status => filters.statuses.includes(status))) {
        return false;
      }
      
      // Area filter
      if (filters.areas.length > 0 && establishment.area && !filters.areas.includes(establishment.area)) {
        return false;
      }
      
      // My Establishments filter: show only establishments the user has visited
      if (filters.myEstablishments) {
        const visitedByUser = establishment.id ? userVisitedEstablishments.has(establishment.id) : false;
        if (!visitedByUser) return false;
      }
      
      // Near Me filter: show only establishments within 5km of user location
      if (filters.nearMe && filters.userLocation && establishment.lat && establishment.lng) {
        const distance = calculateDistance(
          filters.userLocation[0], 
          filters.userLocation[1], 
          establishment.lat, 
          establishment.lng
        );
        if (distance > 5) return false; // Filter out establishments more than 5km away
      }
      
      return true;
    });
    
    // Remove duplicates based on establishment ID
    const uniqueEstablishments = base.filter((establishment, index, self) => 
      index === self.findIndex(e => e.id === establishment.id)
    );
    
    // Sorting
    const sorted = [...uniqueEstablishments];
    const compareLastVisit = (a?: string | null, b?: string | null, asc: boolean = false) => {
      const ahas = !!a;
      const bhas = !!b;
      if (ahas && !bhas) return -1; // visited first
      if (!ahas && bhas) return 1;  // never-visited last
      if (!ahas && !bhas) return 0;
      // When both have dates, sort by date string (YYYY-MM-DD)
      if (asc) {
        return (a! < b! ? -1 : a! > b! ? 1 : 0);
      } else {
        return (a! > b! ? -1 : a! < b! ? 1 : 0);
      }
    };

    switch (filters.sort) {
      case 'name_asc':
        sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        break;
      case 'name_desc':
        sorted.sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        break;
      case 'area_asc':
        sorted.sort((a, b) => (a.area || '').localeCompare(b.area || ''));
        break;
      case 'area_desc':
        sorted.sort((a, b) => (b.area || '').localeCompare(a.area || ''));
        break;
      case 'last_visit_asc':
        sorted.sort((a, b) => compareLastVisit(a.last_visit_at, b.last_visit_at, true));
        break;
      case 'last_visit_desc':
      default:
        sorted.sort((a, b) => compareLastVisit(a.last_visit_at, b.last_visit_at, false));
        break;
    }
    return sorted;
  }, [establishments, filters, userId, userVisitedEstablishments]);

  // Business filtering logic for householders
  const filteredHouseholders = useMemo(() => {
    const base = householders.filter(householder => {
      // Search filter
      if (filters.search && !householder.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      
      // Status filter (for householder statuses)
      if (filters.statuses.length > 0 && !filters.statuses.includes(householder.status)) {
        return false;
      }
      
      // Area filter (based on establishment area)
      if (filters.areas.length > 0 && householder.establishment_name) {
        // We need to check if the establishment area matches
        // For now, we'll skip area filtering for householders since we don't have establishment area in the householder data
        // This could be enhanced by joining with establishment data
      }
      
      // My Householders filter: show only householders the user has visited
      if (filters.myEstablishments) {
        const visitedByUser = householder.id ? userVisitedHouseholders.has(householder.id) : false;
        if (!visitedByUser) return false;
      }
      
      return true;
    });
    
    // Sorting
    const sorted = [...base];
    switch (filters.sort) {
      case 'name_asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'area_asc':
        sorted.sort((a, b) => (a.establishment_name || '').localeCompare(b.establishment_name || ''));
        break;
      case 'area_desc':
        sorted.sort((a, b) => (b.establishment_name || '').localeCompare(a.establishment_name || ''));
        break;
      case 'last_visit_asc':
      case 'last_visit_desc':
      default:
        // For householders, we don't have last_visit_at, so sort by name
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return sorted;
    }, [householders, filters, userId, establishments, userVisitedHouseholders]);

  // Helpers for displaying active filter badges
  const formatStatusLabel = (status: string) =>
    status
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  const handleRemoveStatus = (status: string) => {
    setFilters((prev) => ({ ...prev, statuses: prev.statuses.filter((s) => s !== status) }));
  };

  const handleRemoveArea = (area: string) => {
    setFilters((prev) => ({ ...prev, areas: prev.areas.filter((a) => a !== area) }));
  };

  const handleClearSearch = () => {
    setFilters((prev) => ({ ...prev, search: "" }));
  };

  const handleClearMyEstablishments = () => {
    setFilters((prev) => ({ ...prev, myEstablishments: false }));
  };

  const handleClearAllFilters = () => {
    setFilters((prev) => ({
      search: "",
      statuses: [],
      areas: [],
      myEstablishments: false,
      nearMe: false,
      userLocation: null,
      sort: prev.sort || 'last_visit_desc',
    }));
  };

  const handleToggleNearMe = useCallback(async () => {
    if (filters.nearMe) {
      // Turn off near me filter
      setFilters(prev => ({ ...prev, nearMe: false, userLocation: null }));
    } else {
      // Turn on near me filter - get user location
      setLocationLoading(true);
      try {
        if (!navigator.geolocation) {
          toast.error('Geolocation is not supported by this browser');
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            setFilters(prev => ({ 
              ...prev, 
              nearMe: true, 
              userLocation: [latitude, longitude] 
            }));
            setLocationLoading(false);
            toast.success('Location found! Showing establishments within 5km');
          },
          (error) => {
            console.error('Error getting location:', error);
            setLocationLoading(false);
            toast.error('Unable to get your location. Please check location permissions.');
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
          }
        );
      } catch (error) {
        console.error('Error accessing geolocation:', error);
        setLocationLoading(false);
        toast.error('Unable to access location services');
      }
    }
  }, [filters.nearMe]);

  const areaOptions = useMemo(() => {
    const areas = establishments
      .map(e => e.area)
      .filter(area => area && typeof area === 'string' && area.trim() !== "")
      .filter((area, index, arr) => arr.indexOf(area) === index)
      .sort();
    
    return areas.map(area => ({
      value: area || '',
      label: area || ''
    }));
  }, [establishments]);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Render different sections based on currentSection
  if (isLoading) {
    return <LoadingView />;
  }

  if (!userId) {
    return <LoginView />;
  }

  // Render based on current section
  switch (currentSection) {
    case 'home':
      return (
        <motion.div
          key="home"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6 pb-24 w-full max-w-full overflow-x-hidden" // Ensure mobile width is respected
        >
          <HomeSummary
            userId={userId}
            monthStart={dateRanges.monthStart}
            nextMonthStart={dateRanges.nextMonthStart}
            serviceYearStart={dateRanges.serviceYearStart}
            serviceYearEnd={dateRanges.serviceYearEnd}
          />
          {/* Home: Field Service drawer trigger */}
          <div className="px-4">
            <FieldServiceDrawerDialog userId={userId} triggerLabel="Field Service" />
          </div>
        </motion.div>
      );

    case 'business':
      const hasActiveFilters = filters.search !== "" || filters.statuses.length > 0 || filters.areas.length > 0 || filters.myEstablishments || !!filters.sort;
      
      return (
        <motion.div
          key="business"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
          className={businessTab === 'map' ? "fixed inset-0 z-10" : selectedEstablishment || selectedHouseholder ? "space-y-6 pb-24" : "space-y-6 pb-24 pt-20"} // Full screen for map, normal for details, with top padding for lists
        >
          {/* Portaled Business Controls - Always visible, truly sticky */}
          <PortaledBusinessControls
            businessTab={businessTab}
            onBusinessTabChange={setBusinessTab}
            filters={filters}
            onFiltersChange={setFilters}
            onOpenFilters={() => setFiltersModalOpen(true)}
            viewMode={viewMode}
            onCycleViewMode={cycleViewMode}
            isVisible={!selectedEstablishment && !selectedHouseholder}
            onClearSearch={handleClearSearch}
            onRemoveStatus={handleRemoveStatus}
            onRemoveArea={handleRemoveArea}
            onClearMyEstablishments={handleClearMyEstablishments}
            onClearAllFilters={handleClearAllFilters}
            onToggleNearMe={handleToggleNearMe}
            formatStatusLabel={formatStatusLabel}
          />

          {/* Sticky Search Bar - Above bottom navigation */}
          <StickySearchBar
            filters={filters}
            onFiltersChange={setFilters}
            onClearSearch={handleClearSearch}
            isVisible={!selectedEstablishment && !selectedHouseholder}
            businessTab={businessTab}
          />


          <motion.div 
            className={businessTab === 'map' ? "w-full h-full" : "w-full"}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <AnimatePresence>
              {!selectedEstablishment && !selectedHouseholder ? (
                businessTab === 'establishments' ? (
                <motion.div
                  key="establishment-list"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="w-full"
                >
                  <EstablishmentList
                    establishments={filteredEstablishments}
                    onEstablishmentClick={(establishment) => {
                      setSelectedEstablishment(establishment);
                      if (establishment.id) {
                        loadEstablishmentDetails(establishment.id);
                      }
                    }}
                    onEstablishmentDelete={handleDeleteEstablishment}
                    onEstablishmentArchive={handleArchiveEstablishment}
                    myEstablishmentsOnly={filters.myEstablishments}
                    onMyEstablishmentsChange={(checked) => setFilters(prev => ({ ...prev, myEstablishments: checked }))}
                    onOpenFilters={() => setFiltersModalOpen(true)}
                    filters={filters}
                    onClearAllFilters={handleClearAllFilters}
                    onClearSearch={handleClearSearch}
                    onRemoveStatus={handleRemoveStatus}
                    onRemoveArea={handleRemoveArea}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                  />
                </motion.div>
                ) : businessTab === 'householders' ? (
                  <motion.div
                    key="householder-list"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="w-full"
                  >
                    <HouseholderList
                      householders={filteredHouseholders}
                      onHouseholderClick={(householder) => {
                        setSelectedHouseholder(householder);
                        if (householder.id) {
                          loadHouseholderDetails(householder.id);
                        }
                      }}
                      onHouseholderDelete={handleDeleteHouseholder}
                      onHouseholderArchive={handleArchiveHouseholder}
                      myHouseholdersOnly={filters.myEstablishments}
                      onMyHouseholdersChange={(checked) => setFilters(prev => ({ ...prev, myEstablishments: checked }))}
                      onOpenFilters={() => setFiltersModalOpen(true)}
                      filters={filters}
                      onClearAllFilters={handleClearAllFilters}
                      onClearSearch={handleClearSearch}
                      onRemoveStatus={handleRemoveStatus}
                      onRemoveArea={handleRemoveArea}
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="establishment-map"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="w-full h-full"
                    style={{ height: '100%' }}
                  >
                    <EstablishmentMap
                      establishments={filteredEstablishments}
                      onEstablishmentClick={(establishment) => {
                        setSelectedEstablishment(establishment);
                        if (establishment.id) {
                          loadEstablishmentDetails(establishment.id);
                        }
                      }}
                      selectedEstablishmentId={undefined}
                      className="h-full"
                    />
                  </motion.div>
                )
              ) : selectedHouseholder ? (
                <motion.div
                  key="householder-details"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="w-full"
                  layout
                >
                  <div className={businessTab === 'map' ? "space-y-6 pb-24 px-4 py-6" : ""}>
                  <HouseholderDetails
                    householder={selectedHouseholder}
                    visits={selectedHouseholderDetails?.visits || []}
                    establishment={selectedHouseholderDetails?.establishment || null}
                    establishments={selectedHouseholderDetails?.establishment ? [selectedHouseholderDetails.establishment] : []}
                    onBackClick={() => {
                      setSelectedHouseholder(null);
                      setSelectedHouseholderDetails(null);
                    }}
                  />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="establishment-details"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                  className="w-full"
                  layout // Add layout animation to the details
                >
                  {selectedEstablishment && (
                    <div className={businessTab === 'map' ? "space-y-6 pb-24 px-4 py-6" : ""}>
                  <EstablishmentDetails
                    establishment={selectedEstablishment}
                    visits={selectedEstablishmentDetails?.visits || []}
                    householders={selectedEstablishmentDetails?.householders || []}
                    onBackClick={() => {
                      setSelectedEstablishment(null);
                      setSelectedEstablishmentDetails(null);
                    }}
                    onEstablishmentUpdated={(est) => est?.id && updateEstablishment({ id: est.id!, ...est })}
                    onHouseholderClick={(hh) => {
                      setSelectedHouseholder(hh);
                      if (hh.id) loadHouseholderDetails(hh.id);
                    }}
                  />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Business Filters Modal */}
          <ResponsiveModal
            open={filtersModalOpen}
            onOpenChange={setFiltersModalOpen}
            title="Sort and Filter"
          >
            <BusinessFiltersForm
              filters={filters}
              onFiltersChange={setFilters}
              onClearFilters={() => setFilters({
                search: "",
                statuses: [],
                areas: [],
                myEstablishments: false,
                nearMe: false,
                userLocation: null,
                sort: 'last_visit_desc'
              })}
              hasActiveFilters={hasActiveFilters}
              statusOptions={businessTab === 'establishments' || businessTab === 'map' ? [
                { value: "for_scouting", label: "For Scouting" },
                { value: "for_follow_up", label: "For Follow Up" },
                { value: "for_replenishment", label: "For Replenishment" },
                { value: "accepted_rack", label: "Accepted Rack" },
                { value: "declined_rack", label: "Declined Rack" },
                { value: "has_bible_studies", label: "Has Bible Studies" }
              ] : [
                { value: "interested", label: "Interested" },
                { value: "return_visit", label: "Return Visit" },
                { value: "bible_study", label: "Bible Study" },
                { value: "do_not_call", label: "Do Not Call" }
              ]}
              areaOptions={areaOptions}
              onClose={() => setFiltersModalOpen(false)}
              isMapView={businessTab === 'map'}
            />
          </ResponsiveModal>

          {/* Expandable Business FAB + Drawers */}
          <BusinessDrawerDialogs
            establishments={establishments}
            selectedEstablishmentId={selectedEstablishment?.id}
            selectedArea={filters.areas[0]}
            businessTab={businessTab}
            selectedEstablishment={selectedEstablishment}
            selectedHouseholder={selectedHouseholder}
          />
        </motion.div>
      );

    case 'congregation':
      if (!(profile as any)?.congregation_id && !cong?.id && !admin) {
        return (
          <div className="rounded-md border p-4">
            <div className="text-base font-medium">No congregation assigned</div>
            <div className="mt-1 text-sm opacity-70">Ask an Elder in your congregation to add you.</div>
          </div>
        );
      }
      
      if (!(isElder || admin)) {
        return (
          <div className="rounded-md border p-4">
            <div className="text-base font-medium">Insufficient privilege</div>
            <div className="mt-1 text-sm opacity-70">This area is for elders. Admins can also access for setup.</div>
          </div>
        );
      }



      return (
        <motion.div
          key="congregation"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6 pb-24"
        >
          {cong?.id ? (
            <CongregationView
              data={cong}
              onEdit={() => {
                if (!canEdit) return toast.error("You don't have permission to edit");
                setMode("edit");
                setModalOpen(true);
              }}
              canEdit={canEdit}
            />
          ) : (
            <section className="rounded-md border p-4 space-y-2">
              <div className="text-base font-medium">No congregation yet</div>
              <div className="text-sm opacity-70">{admin ? "The congregation form will open automatically when you visit this page." : "Ask an admin to create your congregation."}</div>
            </section>
          )}

          {cong?.id && (isElder || admin) && (
            <div className="px-4">
              <CongregationDrawerDialog congregationId={cong.id} />
            </div>
          )}

          <ResponsiveModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            title={mode === "edit" ? "Edit Congregation" : "Create Congregation"}
            description={mode === "edit" ? "Update meeting times and details for your congregation." : "Only admins can create a new congregation."}
          >
            <CongregationForm
              initial={initial}
              canEdit={canEdit}
              busy={busy}
              onSubmit={async (payload) => {
                if (!canEdit) {
                  toast.error("You don't have permission to save");
                  return;
                }
                setBusy(true);
                try {
                  const saved = await saveCongregation({ ...payload, id: cong?.id });
                  if (saved) {
                    setCong(saved);
                    setModalOpen(false);
                  }
                } finally {
                  setBusy(false);
                }
              }}
            />
          </ResponsiveModal>
        </motion.div>
      );

    case 'account':
      const fullName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "User";
      const initials = profile ? `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase() : "U";
      
      return (
        <motion.div
          key="account"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6 pb-24" // Add bottom padding for navbar
        >
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-semibold">Account</h1>
            <LogoutButton />
          </div>

          <div className="space-y-6 p-4">
            {/* Profile Header */}
            <section className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={profile?.avatar_url || undefined} alt={fullName} />
                  <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h1 className="text-xl font-semibold">{fullName}</h1>
                    {!!userId && (
                      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                        Edit Profile
                      </Button>
                    )}
                  </div>
                  {profile?.username && (
                    <p className="text-sm text-muted-foreground">@{profile.username}</p>
                  )}
                  {/* Group name and privileges badges */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {profile?.group_name && (
                      <Badge variant="outline" className="text-xs">
                        {profile.group_name}
                      </Badge>
                    )}
                    {profile?.privileges && profile.privileges.length > 0 && (
                      profile.privileges.map((privilege: string) => (
                        <Badge key={privilege} variant="secondary" className="text-xs">
                          {privilege}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Profile Details */}
              <div className="grid gap-3 text-sm">
                {profile?.date_of_birth && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date of Birth:</span>
                    <span>{formatDate(profile.date_of_birth)}</span>
                  </div>
                )}
                {profile?.date_of_baptism && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date of Baptism:</span>
                    <span>{formatDate(profile.date_of_baptism)}</span>
                  </div>
                )}
                {profile?.gender && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gender:</span>
                    <span className="capitalize">{profile.gender}</span>
                  </div>
                )}
              </div>
            </section>

            <Separator />

            {/* Account Settings */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Account Settings</h2>
              
              {/* Basic Account Info */}
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span>{profile?.email || "Not set"}</span>
                </div>
                {profile?.username && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Username:</span>
                    <span>@{profile.username}</span>
                  </div>
                )}
                {profile?.time_zone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Time Zone:</span>
                    <span>{profile.time_zone}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2">
                {!!userId && (
                  <Button variant="outline" onClick={() => setEditAccountOpen(true)}>
                    Edit Account
                  </Button>
                )}
                {!!userId && (
                  <Button variant="outline" onClick={() => setPasswordOpen(true)}>
                    {hasPassword ? "Change Password" : "Add Password"}
                  </Button>
                )}
              </div>
            </section>

            <Separator />

            {/* Biometrics */}
            <section className="space-y-4">
              <h3 className="text-lg font-semibold">Security</h3>
              <BiometricToggle />
            </section>

            <ResponsiveModal
              open={editing && !!userId}
              onOpenChange={setEditing}
              title="Edit Profile"
              description="Edit your profile details and preferences"
            >
              <ProfileForm
                userId={userId!}
                initialEmail={profile?.email}
                initialProfile={profile}
                bwiEnabled={bwiEnabled}
                isBwiParticipant={isBwiParticipant}
                onBwiToggle={async () => {
                  const supabase = await getSupabaseClient();
                  try {
                    const { data, error } = await supabase.rpc('toggle_user_business_participation', { target_user_id: userId });
                    if (error) throw error;
                    setIsBwiParticipant(!!data);
                    return !!data;
                  } catch (error) {
                    throw error;
                  }
                }}
                onSaved={(p) => {
                  setEditing(false);
                  // Preserve email when updating profile
                  setProfile((prev: any) => ({ ...p, email: prev?.email }));
                  setRefreshKey((k) => k + 1);
                }}
              />
            </ResponsiveModal>

            {!!userId && (
              <ResponsiveModal
                open={editAccountOpen}
                onOpenChange={(o) => {
                  setEditAccountOpen(o);
                  if (!o) setRefreshKey((k) => k + 1);
                }}
                title="Edit Account"
                description="Update your email, username, and timezone"
              >
                <EditAccountForm
                  userId={userId}
                  initialEmail={profile?.email}
                  initialUsername={(profile as any)?.username}
                  currentProfile={profile}
                  onSaved={() => setEditAccountOpen(false)}
                />
              </ResponsiveModal>
            )}

            <PasswordDialog
              open={passwordOpen}
              onOpenChange={setPasswordOpen}
              email={profile?.email}
              hasPassword={hasPassword}
              onUpdated={() => {
                try {
                  localStorage.setItem("has_password", "1");
                } catch {}
                setHasPassword(true);
              }}
            />
          </div>
        </motion.div>
      );

    default:
      return (
        <motion.div
          key="home"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6 pb-24" // Add bottom padding for navbar
        >
          <HomeSummary
            userId={userId}
            monthStart={dateRanges.monthStart}
            nextMonthStart={dateRanges.nextMonthStart}
            serviceYearStart={dateRanges.serviceYearStart}
            serviceYearEnd={dateRanges.serviceYearEnd}
          />
        </motion.div>
      );
  }
}
