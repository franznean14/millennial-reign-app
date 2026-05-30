"use client";

import { useState, useEffect, useCallback, useMemo, useRef, type ComponentType } from "react";
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
import { MfaPasskeyGate } from "@/components/auth/MfaPasskeyGate";
import { UnifiedPortaledControls } from "@/components/UnifiedPortaledControls";
import { useSPA } from "@/components/SPAProvider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Import all the data and business logic functions
import { getDailyRecord, listDailyByMonth, upsertDailyRecord, isDailyEmpty, deleteDailyRecord } from "@/lib/db/dailyRecords";
import { getEstablishmentDetails, getContactDetails, deleteContact, archiveContact, calculateDistance, type EstablishmentWithDetails, type VisitWithUser, type ContactWithDetails, type BusinessFiltersState } from "@/lib/db/business";
import { useBusinessFilteredLists } from "@/lib/hooks/use-business-filtered-lists";
import { useBusinessFilterOptions } from "@/lib/hooks/use-business-filter-options";
import { useMyOpenTodoTargets } from "@/lib/hooks/use-my-open-todo-targets";
import { useAccountState } from "@/lib/hooks/use-account-state";
import { getMyCongregation, saveCongregation, isAdmin, type Congregation } from "@/lib/db/congregations";
import { getProfile } from "@/lib/db/profiles";
import { cacheDelete, cacheGet } from "@/lib/offline/store";
import {
  establishmentDetailsCacheKey,
  contactDetailsCacheKey,
} from "@/lib/db/entity-details-cache";
import { archiveEstablishment, deleteEstablishment } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";
import { getSharedEstablishmentsAndContacts } from "@/lib/business/bwi-lists-coordinator";
import { formatStatusText } from "@/lib/utils/formatters";
import { applyDeviceSafeAreaInsets } from "@/lib/utils/device-safe-area";
import { hasCompletedAppBootSession, markAppBootSessionComplete } from "@/lib/app/boot-session";
import { deriveNavPermissions, writeCachedNavPermissions } from "@/lib/app/nav-permissions-cache";
import { useEstablishmentPushDeepLink } from "@/lib/hooks/use-establishment-push-deep-link";

// Lazy-load heavy UI components to reduce initial bundle
import { HomeSection } from "@/components/sections/HomeSection";
import { BusinessSection, type BusinessSectionProps } from "@/components/sections/BusinessSection";
import { CongregationSection, type CongregationSectionProps } from "@/components/sections/CongregationSection";
import { AccountSection } from "@/components/sections/AccountSection";
import { UnifiedFab } from "@/components/shared/UnifiedFab";
const HomeSummary = dynamic(() => import("@/components/home/HomeSummary").then(m => m.HomeSummary), { ssr: false });
// FAB handled by UnifiedFab

type ContactDetailsSnapshot = {
  contact: ContactWithDetails;
  visits: VisitWithUser[];
  establishment?: { id: string; name: string; area?: string | null; statuses?: string[] | null } | null;
};

/** Stale-while-revalidate loader shared by BWI and congregation contact detail views. */
async function loadContactDetailsSwr(
  contactId: string,
  options: {
    hasInMemory: boolean;
    setLoading: (loading: boolean) => void;
    setDetails: (details: ContactDetailsSnapshot | null) => void;
    setContact: (contact: ContactWithDetails | null) => void;
    logLabel?: string;
  }
): Promise<void> {
  const { hasInMemory, setLoading, setDetails, setContact, logLabel = "contact" } = options;
  const cacheKey = contactDetailsCacheKey(contactId);

  if (!hasInMemory) {
    setDetails(null);
    setLoading(true);
  } else {
    setLoading(false);
  }

  try {
    const cached = hasInMemory
      ? null
      : await cacheGet<ContactDetailsSnapshot>(cacheKey);

    if (!hasInMemory && cached) {
      setDetails(cached);
      setContact(cached.contact);
      setLoading(false);
    }

    const details = await getContactDetails(contactId);
    if (details) {
      setDetails(details);
      setContact(details.contact);
    } else {
      setDetails(null);
      setContact(null);
      toast.info("Contact was deleted.");
    }
  } catch (error) {
    console.error(`Failed to load ${logLabel} details:`, error);
    // Keep IndexedDB snapshot for offline/transient failures.
  } finally {
    setLoading(false);
  }
}


export function AppClient() {
  // Global app state
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  /** Session/profile bootstrap complete — avoids LoginView flash before getSession. */
  const [sessionHydrated, setSessionHydrated] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [isElderByServer, setIsElderByServer] = useState(false);
  
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
  const establishmentsRef = useRef<EstablishmentWithDetails[]>([]);
  useEffect(() => {
    establishmentsRef.current = establishments;
  }, [establishments]);
  const [contacts, setContacts] = useState<ContactWithDetails[]>([]);
  const [businessTab, setBusinessTab] = useState<'establishments' | 'contacts' | 'map'>('establishments');
  
  // Update business tab based on current section
  useEffect(() => {
    if (currentSection === 'business-establishments') {
      setBusinessTab('establishments');
    } else if (currentSection === 'business-contacts') {
      setBusinessTab('contacts');
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
    contacts: ContactWithDetails[];
  } | null>(null);
  /** Explicit fetch lifecycle — do not infer loading from `!selectedEstablishmentDetails` or failed loads stick on skeleton forever */
  const [establishmentDetailsLoading, setEstablishmentDetailsLoading] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ContactWithDetails | null>(null);
  const [selectedContactDetails, setSelectedContactDetails] = useState<ContactDetailsSnapshot | null>(null);
  /** Explicit fetch lifecycle — same pattern as establishment details (stale-while-revalidate). */
  const [contactDetailsLoading, setContactDetailsLoading] = useState(false);
  const defaultFilters: BusinessFiltersState = {
    search: "",
    statuses: [],
    excludedStatuses: [],
    areas: [],
    floors: [],
    myEstablishments: false,
    myTodosOnly: false,
    nearMe: false,
    userLocation: null,
    sort: "last_visit_desc",
  };

  const [filtersEstablishments, setFiltersEstablishments] = useState<BusinessFiltersState>(defaultFilters);
  const [filtersContacts, setFiltersContacts] = useState<BusinessFiltersState>(defaultFilters);
  const [filtersHydrated, setFiltersHydrated] = useState(false);
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationWatchId, setLocationWatchId] = useState<number | null>(null);

  // Current tab's filters (establishments tab + map use establishment filters; contacts tab uses contact filters).
  const filters = businessTab === "contacts" ? filtersContacts : filtersEstablishments;

  const setFilters = useCallback(
    (updater: React.SetStateAction<BusinessFiltersState>) => {
      if (businessTab === "contacts") {
        setFiltersContacts(updater);
      } else {
        setFiltersEstablishments(updater);
      }
    },
    [businessTab]
  );

  // Load persisted business filters from localStorage on mount (separate per establishment vs contact list).
  // Persisted: statuses, areas, floors, sort, search, myEstablishments, nearMe, userLocation for each list.
  useEffect(() => {
    let isMounted = true;
    try {
      if (typeof window === "undefined") return;
      const rawEst = window.localStorage.getItem("business:filters:establishments");
      const rawHh =
        window.localStorage.getItem("business:filters:contacts") ??
        window.localStorage.getItem("business:filters:householders");
      const merge = (raw: string | null, prev: BusinessFiltersState): BusinessFiltersState => {
        if (!raw) return prev;
        try {
          const saved = JSON.parse(raw) as Partial<BusinessFiltersState>;
          if (!saved) return prev;
          const migratedExcludedStatuses = Array.isArray(saved.excludedStatuses)
            ? saved.excludedStatuses
            : (saved as { excludePersonalTerritory?: boolean }).excludePersonalTerritory
              ? ["personal_territory"]
              : (prev.excludedStatuses ?? []);
          return {
            search: typeof saved.search === "string" ? saved.search : prev.search,
            statuses: Array.isArray(saved.statuses) ? saved.statuses : prev.statuses,
            excludedStatuses: migratedExcludedStatuses,
            areas: Array.isArray(saved.areas) ? saved.areas : prev.areas,
            floors: Array.isArray(saved.floors) ? saved.floors : prev.floors,
            myEstablishments: typeof saved.myEstablishments === "boolean" ? saved.myEstablishments : prev.myEstablishments,
            myTodosOnly: typeof saved.myTodosOnly === "boolean" ? saved.myTodosOnly : prev.myTodosOnly ?? false,
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
        setFiltersContacts((prev) => merge(rawHh, prev));
      }
    } catch {
      // Ignore
    }
    if (isMounted) setFiltersHydrated(true);
    return () => { isMounted = false; };
  }, []);

  // Persist establishment and contact filters separately so switching tabs doesn't reset either.
  useEffect(() => {
    if (!filtersHydrated) return;
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem("business:filters:establishments", JSON.stringify(filtersEstablishments));
      window.localStorage.setItem("business:filters:contacts", JSON.stringify(filtersContacts));
    } catch {}
  }, [filtersEstablishments, filtersContacts, filtersHydrated]);

  // Congregation state
  const [cong, setCong] = useState<Congregation | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [busy, setBusy] = useState(false);
  const [congregationInitialTab, setCongregationInitialTab] = useState<'meetings' | 'ministry' | 'admin' | undefined>(undefined);
  const [congregationTab, setCongregationTab] = useState<'meetings' | 'ministry' | 'admin'>('meetings');
  const [congregationSelectedContact, setCongregationSelectedContact] = useState<ContactWithDetails | null>(null);
  const [congregationSelectedContactDetails, setCongregationSelectedContactDetails] =
    useState<ContactDetailsSnapshot | null>(null);
  const [congregationContactDetailsLoading, setCongregationContactDetailsLoading] = useState(false);
  
  // Update congregation tab when initialTab changes
  useEffect(() => {
    if (congregationInitialTab) {
      setCongregationTab(congregationInitialTab);
    }
  }, [congregationInitialTab]);

  // Home tab state
  const [homeTab, setHomeTab] = useState<'summary' | 'events'>('summary');
  const [bwiAreaFilter, setBwiAreaFilter] = useState<string[]>([]);

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
  
  // Add this state to track user's visited contacts
  const [userVisitedContacts, setUserVisitedContacts] = useState<Set<string>>(new Set());
  const businessSubscriptionsInitializedRef = useRef(false);
  const businessRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const businessRefetchInFlightRef = useRef(false);
  const businessRefetchQueuedRef = useRef(false);

  useEffect(() => {
    const handleSafeArea = () => applyDeviceSafeAreaInsets();
    handleSafeArea();
    window.addEventListener("resize", handleSafeArea);
    window.addEventListener("orientationchange", handleSafeArea);
    return () => {
      window.removeEventListener("resize", handleSafeArea);
      window.removeEventListener("orientationchange", handleSafeArea);
    };
  }, []);

  // Load initial app data (blocking loader only on true cold start)
  useEffect(() => {
    const loadAppData = async () => {
      const resumedSession = hasCompletedAppBootSession();
      if (!resumedSession) {
        setContentLoading(true);
      }
      try {
        const supabase = await getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        const id = session?.user?.id || null;
        setUserId(id);

        if (id) {
          const [profileData, adminStatus, congregationData, { data: { user } }, bwiEnabledData, bwiParticipantData, elderStatus] = await Promise.all([
            getProfile(id),
            isAdmin(id),
            getMyCongregation(),
            supabase.auth.getUser(),
            supabase.rpc('is_business_enabled'),
            supabase.rpc('is_business_participant'),
            supabase.rpc('is_elder', { uid: id }),
          ]);

          const profileWithEmail = profileData
            ? { ...profileData, email: user?.email, __isElderServer: !!elderStatus.data }
            : null;
          setProfile(profileWithEmail);
          setAdmin(adminStatus);
          setIsElderByServer(!!elderStatus.data);
          setCong(congregationData);
          setBwiEnabled(!!bwiEnabledData.data);
          setIsBwiParticipant(!!bwiParticipantData.data);
          if (profileData) {
            writeCachedNavPermissions(id, deriveNavPermissions(profileData));
          }

          if (!congregationData?.id && adminStatus) {
            setMode("create");
            setModalOpen(true);
          }
        } else {
          setIsElderByServer(false);
        }
      } finally {
        setContentLoading(false);
        setSessionHydrated(true);
        markAppBootSessionComplete();
      }
    };

    loadAppData();
  }, [setContentLoading]);

  // Keep elder capability aligned with server truth (prevents stale cache from showing elder-only UI).
  useEffect(() => {
    const refreshIsElder = async () => {
      if (!userId) {
        setIsElderByServer(false);
        setProfile((prev: any) => (prev ? { ...prev, __isElderServer: false } : prev));
        return;
      }
      try {
        const supabase = await getSupabaseClient();
        const { data } = await supabase.rpc("is_elder", { uid: userId });
        const next = !!data;
        setIsElderByServer(next);
        setProfile((prev: any) => (prev ? { ...prev, __isElderServer: next } : prev));
      } catch {
        // Keep previous state when network is unavailable.
      }
    };
    refreshIsElder();
  }, [userId, (profile as any)?.privileges]);

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

  // Stop location tracking only when leaving the business area entirely (not when switching establishment/contact/map tabs).
  const isBusinessArea = currentSection === "business" || currentSection.startsWith("business-");
  useEffect(() => {
    if (!isBusinessArea && locationWatchId !== null) {
      navigator.geolocation.clearWatch(locationWatchId);
      setLocationWatchId(null);
      setFiltersEstablishments((prev) => ({ ...prev, nearMe: false, userLocation: null }));
      setFiltersContacts((prev) => ({ ...prev, nearMe: false, userLocation: null }));
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
            .select(`establishment_id, contact_id:householder_id`)
            .or(`publisher_id.eq.${userId},partner_id.eq.${userId}`);
          
          if (visits) {
            const visitedEstablishmentIds = new Set(visits.map(v => v.establishment_id).filter(Boolean));
            setUserVisitedEstablishments(visitedEstablishmentIds);
            
            const visitedContactIds = new Set(visits.map(v => v.contact_id).filter(Boolean));
            setUserVisitedContacts(visitedContactIds);
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
      // Hydrate from IndexedDB cache first for instant render.
      const [cachedEstablishments, cachedContactsRaw] = await Promise.all([
        cacheGet<EstablishmentWithDetails[]>("establishments:with-details"),
        cacheGet<ContactWithDetails[]>("contacts:list:v3"),
      ]);
      const cachedContacts =
        cachedContactsRaw?.length
          ? cachedContactsRaw
          : await cacheGet<ContactWithDetails[]>("householders:list:v3");
      if (cachedEstablishments?.length) {
        setEstablishments(cachedEstablishments);
      }
      if (cachedContacts?.length) {
        setContacts(cachedContacts.filter((contact) => !!contact.establishment_id));
      }

      const [establishmentsData, contactsData] = await getSharedEstablishmentsAndContacts();
      setEstablishments(establishmentsData);
      setContacts(contactsData.filter((contact) => !!contact.establishment_id));

      if (!businessSubscriptionsInitializedRef.current) {
        // Set up business event listeners once to avoid duplicate subscriptions.
        businessEventBus.subscribe('establishment-added', addNewEstablishment);
        businessEventBus.subscribe('establishment-updated', updateEstablishment);
        businessEventBus.subscribe('contact-added', addNewContact);
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
          setSelectedContactDetails(prev => {
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
          setSelectedContactDetails(prev => {
            if (!prev) return prev;
            return { ...prev, visits: prev.visits.filter(ex => ex.id !== v.id) };
          });
        });
        businessEventBus.subscribe('contact-updated', (hh: any) => {
          // Update main contacts list
          setContacts(prev => prev.map(h => h.id === hh.id ? { ...h, ...hh } : h));
          
          setSelectedEstablishmentDetails(prev => {
            if (!prev) return prev;
            // Create new arrays to ensure React detects the changes
            const updatedContacts = prev.contacts.map(h => h.id === hh.id ? { ...h, ...hh } : h);
            const updatedVisits = prev.visits.map(visit => {
              if (visit.contact && visit.contact.id === hh.id) {
                return { 
                  ...visit, 
                  contact: { ...visit.contact, ...hh }
                };
              }
              return visit;
            });
            
            return { 
              ...prev, 
              contacts: updatedContacts,
              visits: updatedVisits
            };
          });
          setSelectedContact(prev => prev && prev.id === hh.id ? { ...prev, ...hh } : prev);
          setSelectedContactDetails(prev => prev && prev.contact.id === hh.id ? { ...prev, contact: { ...prev.contact, ...hh } } : prev);
        });
        businessEventBus.subscribe('contact-deleted', (hh: any) => {
          setSelectedEstablishmentDetails(prev => {
            if (!prev) return prev;
            return { ...prev, contacts: prev.contacts.filter(h => h.id !== hh.id) };
          });
          setSelectedContact(null);
          setSelectedContactDetails(null);
        });
        businessSubscriptionsInitializedRef.current = true;
      }
    } catch (error) {
      console.error('Failed to load business data:', error);
    }
  }, []);

  // Refs so Realtime refetch can refresh open detail views without stale closures
  const selectedEstablishmentIdRef = useRef<string | null>(null);
  const selectedEstablishmentDetailsRef = useRef(selectedEstablishmentDetails);
  const selectedContactDetailsRef = useRef(selectedContactDetails);
  const congregationSelectedContactDetailsRef = useRef(congregationSelectedContactDetails);
  const selectedContactIdRef = useRef<string | null>(null);
  const congregationSelectedContactIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedEstablishmentIdRef.current = selectedEstablishment?.id ?? null;
    selectedEstablishmentDetailsRef.current = selectedEstablishmentDetails;
    selectedContactIdRef.current = selectedContact?.id ?? null;
    selectedContactDetailsRef.current = selectedContactDetails;
    congregationSelectedContactIdRef.current = congregationSelectedContact?.id ?? null;
    congregationSelectedContactDetailsRef.current = congregationSelectedContactDetails;
  }, [
    selectedEstablishment?.id,
    selectedEstablishmentDetails,
    selectedContact?.id,
    selectedContactDetails,
    congregationSelectedContact?.id,
    congregationSelectedContactDetails,
  ]);

  // Refetch-only (no event bus). Used when Supabase Realtime detects changes so views re-render with latest data.
  const refetchBusinessData = useCallback(async () => {
    if (businessRefetchInFlightRef.current) {
      businessRefetchQueuedRef.current = true;
      return;
    }
    businessRefetchInFlightRef.current = true;
    try {
      const estId = selectedEstablishmentIdRef.current;
      const hhId = selectedContactIdRef.current;
      const congHhId = congregationSelectedContactIdRef.current;
      // Invalidate detail caches first so detail fetches never see stale cache (list and details both get fresh data)
      await Promise.all([
        estId ? cacheDelete(establishmentDetailsCacheKey(estId)) : Promise.resolve(),
        hhId ? cacheDelete(contactDetailsCacheKey(hhId)) : Promise.resolve(),
        congHhId ? cacheDelete(contactDetailsCacheKey(congHhId)) : Promise.resolve(),
      ]);
      const [establishmentsData, contactsData] = await getSharedEstablishmentsAndContacts();
      setEstablishments(establishmentsData);
      setContacts(contactsData.filter((contact) => !!contact.establishment_id));
      const [estDetails, hhDetails, congHhDetails] = await Promise.all([
        estId ? getEstablishmentDetails(estId) : Promise.resolve(null),
        hhId ? getContactDetails(hhId) : Promise.resolve(null),
        congHhId ? getContactDetails(congHhId) : Promise.resolve(null),
      ]);
      if (estDetails) {
        setSelectedEstablishmentDetails(estDetails);
        // Keep selected establishment (name, status, note, area, floor) in sync so details view updates live
        setSelectedEstablishment((prev) =>
          prev?.id === estDetails.establishment.id ? { ...prev, ...estDetails.establishment } : prev
        );
      } else if (estId) {
        const stillInFreshList = establishmentsData.some((e) => e.id === estId);
        if (!stillInFreshList) {
          // Gone from shared list fetch — soft-deleted/archived or removed from congregation view
          setSelectedEstablishmentDetails(null);
          setSelectedEstablishment(null);
          toast.info("Establishment was deleted.");
        }
        // Still listed but details missing: transient/network/query issue — keep selection and avoid false “deleted” toast
      }
      if (hhDetails) {
        setSelectedContactDetails(hhDetails);
        // Keep selected contact (name, status, note, etc.) in sync so details view updates on property changes
        setSelectedContact((prev) =>
          prev?.id === hhDetails.contact.id ? { ...prev, ...hhDetails.contact } : prev
        );
      } else if (hhId) {
        // Open contact was soft-deleted (getContactDetails returned null) — clear detail view
        setSelectedContactDetails(null);
        setSelectedContact(null);
        toast.info("Contact was deleted.");
      }
      if (congHhDetails) {
        setCongregationSelectedContactDetails(congHhDetails);
        setCongregationSelectedContact(congHhDetails.contact);
      } else if (congHhId) {
        // Open congregation contact was soft-deleted — clear detail view
        setCongregationSelectedContactDetails(null);
        setCongregationSelectedContact(null);
        toast.info("Contact was deleted.");
      }
    } catch (error) {
      console.error('Failed to refetch business data:', error);
    } finally {
      businessRefetchInFlightRef.current = false;
      if (businessRefetchQueuedRef.current) {
        businessRefetchQueuedRef.current = false;
        if (businessRefetchTimerRef.current) {
          clearTimeout(businessRefetchTimerRef.current);
        }
        businessRefetchTimerRef.current = setTimeout(() => {
          void refetchBusinessData();
        }, 400);
      }
    }
  }, []);

  const scheduleBusinessRefetch = useCallback(() => {
    if (businessRefetchTimerRef.current) {
      clearTimeout(businessRefetchTimerRef.current);
    }
    businessRefetchTimerRef.current = setTimeout(() => {
      void refetchBusinessData();
    }, 700);
  }, [refetchBusinessData]);

  useEffect(() => {
    const onAppBusinessRefresh = () => scheduleBusinessRefetch();
    window.addEventListener("app-business-refresh", onAppBusinessRefresh);
    return () => window.removeEventListener("app-business-refresh", onAppBusinessRefresh);
  }, [scheduleBusinessRefetch]);

  // Realtime: Supabase postgres_changes → refetch → setState → React re-renders; no manual refresh needed
  const congregationId = (profile as any)?.congregation_id;
  useEffect(() => {
    if (!userId || !congregationId || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("business-data-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "business_establishments", filter: `congregation_id=eq.${congregationId}` },
        () => { scheduleBusinessRefetch(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "householders", filter: `congregation_id=eq.${congregationId}` },
        () => { scheduleBusinessRefetch(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calls", filter: `congregation_id=eq.${congregationId}` },
        () => { scheduleBusinessRefetch(); }
      )
      .subscribe();
    return () => {
      if (businessRefetchTimerRef.current) {
        clearTimeout(businessRefetchTimerRef.current);
        businessRefetchTimerRef.current = null;
      }
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [userId, congregationId, scheduleBusinessRefetch]);

  // When current user soft-deletes a contact, refetch establishment details so contacts list and establishment fields stay in sync
  useEffect(() => {
    const handler = () => {
      const estId = selectedEstablishmentIdRef.current;
      if (!estId) return;
      cacheDelete(establishmentDetailsCacheKey(estId)).then(() =>
        getEstablishmentDetails(estId).then((d) => {
          if (d) {
            setSelectedEstablishmentDetails(d);
            setSelectedEstablishment((prev) =>
              prev?.id === d.establishment.id ? { ...prev, ...d.establishment } : prev
            );
          }
        })
      );
    };
    businessEventBus.subscribe("contact-deleted", handler);
    return () => businessEventBus.unsubscribe("contact-deleted", handler);
  }, []);

  const loadEstablishmentDetails = useCallback(async (establishmentId: string) => {
    const cacheKey = establishmentDetailsCacheKey(establishmentId);
    const hasInMemory =
      selectedEstablishmentDetailsRef.current?.establishment?.id === establishmentId;

    if (!hasInMemory) {
      // Drop stale snapshot when navigating to a different establishment (avoid showing wrong visits/contacts)
      setSelectedEstablishmentDetails(null);
      setEstablishmentDetailsLoading(true);
    } else {
      setEstablishmentDetailsLoading(false);
    }

    try {
      // Stale-while-revalidate: IndexedDB snapshot renders immediately; network refresh updates in place.
      const cached = hasInMemory
        ? null
        : await cacheGet<{
            establishment: EstablishmentWithDetails;
            visits: VisitWithUser[];
            contacts: ContactWithDetails[];
          }>(cacheKey);

      if (!hasInMemory && cached) {
        setSelectedEstablishmentDetails(cached);
        setSelectedEstablishment(cached.establishment);
        setEstablishmentDetailsLoading(false);
      }

      const details = await getEstablishmentDetails(establishmentId);
      if (details) {
        setSelectedEstablishmentDetails(details);
        setSelectedEstablishment(details.establishment);
      } else {
        const listed = establishmentsRef.current;
        const stillListed =
          listed.length > 0 && listed.some((e) => e.id === establishmentId);
        if (!stillListed && listed.length > 0) {
          setSelectedEstablishmentDetails(null);
          setSelectedEstablishment(null);
          toast.info("Establishment was deleted.");
        } else {
          const row = listed.find((e) => e.id === establishmentId);
          if (row) {
            // Server returned no row/error but shared list still has it — show shell so Calls/Contacts don’t skeleton forever
            setSelectedEstablishmentDetails({
              establishment: row,
              visits: [],
              contacts: [],
            });
          }
        }
      }
    } catch (error) {
      console.error('Failed to load establishment details:', error);
      // Keep IndexedDB snapshot for offline/transient failures; wiping cache caused false “deleted” flows after realtime refetch invalidated keys.
    } finally {
      setEstablishmentDetailsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedEstablishment) {
      setEstablishmentDetailsLoading(false);
    }
  }, [selectedEstablishment]);

  const clearBusinessContactSelection = useCallback(() => {
    setSelectedContact(null);
    setSelectedContactDetails(null);
  }, []);

  useEstablishmentPushDeepLink({
    sessionReady: sessionHydrated && !!userId,
    userId,
    currentSection,
    pushNavigation,
    onSectionChange,
    setBusinessTab,
    setSelectedEstablishment,
    clearSelectedContact: clearBusinessContactSelection,
    loadEstablishmentDetails,
  });

  useEffect(() => {
    if (!selectedContact) {
      setContactDetailsLoading(false);
    }
  }, [selectedContact]);

  useEffect(() => {
    if (!congregationSelectedContact) {
      setCongregationContactDetailsLoading(false);
    }
  }, [congregationSelectedContact]);

  const loadContactDetails = useCallback(async (contactId: string) => {
    const hasInMemory =
      selectedContactDetailsRef.current?.contact?.id === contactId;
    await loadContactDetailsSwr(contactId, {
      hasInMemory,
      setLoading: setContactDetailsLoading,
      setDetails: setSelectedContactDetails,
      setContact: setSelectedContact,
    });
  }, []);

  const loadCongregationContactDetails = useCallback(async (contactId: string) => {
    const hasInMemory =
      congregationSelectedContactDetailsRef.current?.contact?.id === contactId;
    await loadContactDetailsSwr(contactId, {
      hasInMemory,
      setLoading: setCongregationContactDetailsLoading,
      setDetails: setCongregationSelectedContactDetails,
      setContact: setCongregationSelectedContact,
      logLabel: "congregation contact",
    });
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
        publisher_id: (updated as any).publisher_id as any,
        assigned_user: (updated as any).assigned_user as any,
      };
      const merged = { ...target, ...Object.fromEntries(Object.entries(fields).filter(([_, v]) => v !== undefined)) } as EstablishmentWithDetails;
      return merged;
    };

    setEstablishments(prev => prev.map(e => e.id === updated.id ? (merge(e) as EstablishmentWithDetails) : e));
    setSelectedEstablishment(prev => merge(prev));
    setSelectedEstablishmentDetails(prev => prev ? ({ ...prev, establishment: merge(prev.establishment)! }) : prev);
  }, []);

  const addNewContact = useCallback((contact: ContactWithDetails) => {
    setSelectedEstablishmentDetails(prev => {
      if (!prev) return prev;
      return { ...prev, contacts: [contact, ...prev.contacts] };
    });
  }, []);

  const addNewVisit = useCallback((visit: VisitWithUser) => {
    setSelectedEstablishmentDetails(prev => {
      if (!prev) return prev;
      const visitExists = prev.visits.some(existingVisit => existingVisit.id === visit.id);
      if (visitExists) return prev;
      return { ...prev, visits: [visit, ...prev.visits] };
    });
    setSelectedContactDetails(prev => {
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

  const handleDeleteContact = useCallback(async (contact: ContactWithDetails) => {
    try {
      const success = await deleteContact(contact.id);
      if (success) {
        toast.success(`${contact.name} deleted successfully`);
        setContacts(prev => prev.filter(h => h.id !== contact.id));
        if (selectedContact?.id === contact.id) {
          setSelectedContact(null);
          setSelectedContactDetails(null);
        }
      } else {
        toast.error('Failed to delete contact');
      }
    } catch (error) {
      console.error('Failed to delete contact:', error);
      toast.error('Failed to delete contact');
    }
  }, [selectedContact]);

  const handleArchiveContact = useCallback(async (contact: ContactWithDetails) => {
    try {
      const success = await archiveContact(contact.id);
      if (success) {
        toast.success(`${contact.name} archived successfully`);
        setContacts(prev => prev.filter(h => h.id !== contact.id));
        if (selectedContact?.id === contact.id) {
          setSelectedContact(null);
          setSelectedContactDetails(null);
        }
      } else {
        toast.error('Failed to archive contact');
      }
    } catch (error) {
      console.error('Failed to archive contact:', error);
      toast.error('Failed to archive contact');
    }
  }, [selectedContact]);

  const { targets: myOpenTodoTargets } = useMyOpenTodoTargets(userId);

  const { filteredEstablishments, filteredContacts } = useBusinessFilteredLists({
    establishments,
    contacts,
    filtersEstablishments,
    filtersContacts,
    userVisitedEstablishments,
    userVisitedContacts,
    userId,
    myOpenTodoTargets,
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
    (tab: "establishments" | "contacts", status: string, areas?: string | string[]) => {
      const nextAreas = Array.isArray(areas)
        ? Array.from(new Set(areas.map((area) => area.trim()).filter(Boolean)))
        : (areas?.trim() ? [areas.trim()] : []);
      setBusinessTab(tab);
      if (tab === "establishments") {
        setFiltersEstablishments((prev) => ({
          ...prev,
          statuses: [status],
          excludedStatuses: [],
          areas: nextAreas,
        }));
      } else {
        setFiltersContacts((prev) => ({
          ...prev,
          statuses: [status],
          excludedStatuses: [],
          areas: nextAreas,
        }));
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
      excludedStatuses: [],
      areas: [],
      floors: [],
      myEstablishments: false,
      myTodosOnly: false,
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
    contacts,
    filters,
    userVisitedEstablishments,
    businessTab,
    myOpenTodoTargets,
  });

  // Congregation functions
  const isElder = isElderByServer;
  const canEditAccountPrivilegesAndBwi = admin || isElderByServer;
  const canEditPioneerPrivilegesOnly =
    !!(profile as any)?.congregation_id && !canEditAccountPrivilegesAndBwi;

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


  // FullScreenLoading (AppChrome) covers cold start; return null until session is known.
  if (!sessionHydrated) {
    return null;
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
      congregationTab={congregationTab}
      onCongregationTabChange={setCongregationTab}
      congregationSelectedContact={congregationSelectedContact}
      onCongregationBackClick={() => {
        setCongregationSelectedContact(null);
        setCongregationSelectedContactDetails(null);
      }}
      onCongregationEditClick={() => {
        if (congregationSelectedContact) {
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
      contacts={contacts}
      selectedEstablishment={selectedEstablishment}
      selectedContact={selectedContact}
      selectedArea={filters.areas[0]}
      businessTab={businessTab}
      congregationId={cong?.id ?? null}
      congregationTab={congregationTab}
      isElder={isElder}
      isAdmin={admin}
      congregationSelectedContact={congregationSelectedContact}
    />
  );

  const BusinessSectionView: ComponentType<BusinessSectionProps> = BusinessSection;
  const CongregationSectionView: ComponentType<CongregationSectionProps> = CongregationSection;

  // Render based on current section
  switch (currentSection) {
    case 'home':
      return (
        <>
        <MfaPasskeyGate />
        <HomeSection
          portaledControls={portaledControls}
          userId={userId}
          homeTab={homeTab}
          bwiAreaFilter={bwiAreaFilter}
          onBwiAreaChange={setBwiAreaFilter}
          onNavigateToCongregation={() => {
            setCongregationInitialTab('ministry');
            onSectionChange('congregation');
          }}
          onNavigateToBusinessWithStatus={onNavigateToBusinessWithStatus}
          onNavigateToBusiness={() => onSectionChange('business')}
          onSectionChange={onSectionChange}
          currentSection={currentSection}
          pushNavigation={pushNavigation}
          setBusinessTab={setBusinessTab}
          setSelectedEstablishment={setSelectedEstablishment}
          setSelectedContact={setSelectedContact}
          loadEstablishmentDetails={loadEstablishmentDetails}
          loadContactDetails={loadContactDetails}
        />
          {unifiedFab}
        </>
      );

    case 'business':
      return (
        <>
        <MfaPasskeyGate />
        <BusinessSectionView
          userId={userId}
          portaledControls={portaledControls}
          businessTab={businessTab}
          filters={filters}
          setFilters={setFilters}
          filtersModalOpen={filtersModalOpen}
          setFiltersModalOpen={setFiltersModalOpen}
          viewMode={viewMode}
          setViewMode={setViewMode}
          filteredEstablishments={filteredEstablishments}
          filteredContacts={filteredContacts}
          establishments={establishments}
          selectedEstablishment={selectedEstablishment}
          setSelectedEstablishment={setSelectedEstablishment}
          selectedEstablishmentDetails={selectedEstablishmentDetails}
          establishmentDetailsLoading={establishmentDetailsLoading}
          setSelectedEstablishmentDetails={setSelectedEstablishmentDetails}
          selectedContact={selectedContact}
          setSelectedContact={setSelectedContact}
          selectedContactDetails={selectedContactDetails}
          contactDetailsLoading={contactDetailsLoading}
          setSelectedContactDetails={setSelectedContactDetails}
          loadEstablishmentDetails={loadEstablishmentDetails}
          loadContactDetails={loadContactDetails}
          handleDeleteEstablishment={handleDeleteEstablishment}
          handleArchiveEstablishment={handleArchiveEstablishment}
          handleDeleteContact={handleDeleteContact}
          handleArchiveContact={handleArchiveContact}
          handleClearAllFilters={handleClearAllFilters}
          handleClearSearch={handleClearSearch}
          handleRemoveStatus={handleRemoveStatus}
          handleRemoveArea={handleRemoveArea}
          handleRemoveFloor={handleRemoveFloor}
          dynamicStatusOptions={dynamicStatusOptions}
          dynamicAreaOptions={dynamicAreaOptions}
          dynamicFloorOptions={dynamicFloorOptions}
          myOpenTodoTargets={myOpenTodoTargets}
          updateEstablishment={updateEstablishment}
          canManagePersonalTerritoryOwner={admin || isElder}
        />
          {unifiedFab}
        </>
      );

    case 'congregation':
      return (
        <>
        <MfaPasskeyGate />
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
            selectedContact={congregationSelectedContact}
            selectedContactDetails={congregationSelectedContactDetails}
            contactDetailsLoading={congregationContactDetailsLoading}
            onSelectContact={setCongregationSelectedContact}
            onSelectContactDetails={setCongregationSelectedContactDetails}
            onClearSelectedContact={() => {
              setCongregationSelectedContact(null);
              setCongregationSelectedContactDetails(null);
            }}
            loadContactDetails={loadCongregationContactDetails}
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
          <MfaPasskeyGate />
          {portaledControls}
          {unifiedFab}
          <AccountSection
            userId={userId}
            profile={profile}
            canEditPrivilegesAndBwi={canEditAccountPrivilegesAndBwi}
            canEditPioneerPrivilegesOnly={canEditPioneerPrivilegesOnly}
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
        <>
          <MfaPasskeyGate />
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
        </>
      );
  }
}
