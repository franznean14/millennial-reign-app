"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EditAccountDialog } from "@/components/account/EditAccountDialog";
import { PasswordDialog } from "@/components/account/PasswordDialog";
import { BiometricToggle } from "@/components/account/BiometricToggle";
import { ProfileForm } from "@/components/account/ProfileForm";
import { LogoutButton } from "@/components/account/LogoutButton";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

// Import all the data and business logic functions
import { getDailyRecord, listDailyByMonth, upsertDailyRecord, isDailyEmpty, deleteDailyRecord } from "@/lib/db/dailyRecords";
import { getEstablishmentsWithDetails, getEstablishmentDetails, type EstablishmentWithDetails, type VisitWithUser, type HouseholderWithDetails, type BusinessFiltersState } from "@/lib/db/business";
import { getMyCongregation, saveCongregation, isAdmin, type Congregation } from "@/lib/db/congregations";
import { getProfile } from "@/lib/db/profiles";
import { archiveEstablishment, deleteEstablishment } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";

// Import UI components
import { HomeSummary } from "@/components/home/HomeSummary";
import { TopStudies } from "@/components/home/TopStudies";
import { EstablishmentList } from "@/components/business/EstablishmentList";
import { EstablishmentDetails } from "@/components/business/EstablishmentDetails";
import { CongregationForm } from "@/components/congregation/CongregationForm";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { SwipeableCard } from "@/components/ui/swipeable-card";
import { CongregationMembers } from "@/components/congregation/CongregationMembers";
import { BusinessFiltersForm } from "@/components/business/BusinessFiltersForm";
import { CongregationView } from "@/components/views/CongregationView";

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
  const [selectedEstablishment, setSelectedEstablishment] = useState<EstablishmentWithDetails | null>(null);
  const [selectedEstablishmentDetails, setSelectedEstablishmentDetails] = useState<{
    establishment: EstablishmentWithDetails;
    visits: VisitWithUser[];
    householders: HouseholderWithDetails[];
  } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<BusinessFiltersState>({
    search: "",
    statuses: [],
    areas: [],
    myEstablishments: false
  });
  const [filtersModalOpen, setFiltersModalOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

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

  // Add this state to track user's visited establishments
  const [userVisitedEstablishments, setUserVisitedEstablishments] = useState<Set<string>>(new Set());

  // Load initial app data
  useEffect(() => {
    const loadAppData = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      const id = session?.user?.id || null;
      setUserId(id);
      
      if (id) {
        const [profileData, adminStatus, congregationData] = await Promise.all([
          getProfile(id),
          isAdmin(id),
          getMyCongregation()
        ]);
        
        setProfile(profileData);
        setAdmin(adminStatus);
        setCong(congregationData);
        
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
      const supabase = createSupabaseBrowserClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          try {
            localStorage.setItem("has_password", user.app_metadata?.provider === "email" ? "1" : "0");
            setHasPassword(user.app_metadata?.provider === "email");
          } catch {}
        }
      });
    }
  }, [userId]);

  // Add this effect to load user's visited establishments
  useEffect(() => {
    if (currentSection === 'business' && userId) {
      const loadUserVisits = async () => {
        try {
          const supabase = createSupabaseBrowserClient();
          const { data: visits } = await supabase
            .from('business_visits')
            .select('establishment_id')
            .eq('publisher_id', userId);
          
          if (visits) {
            const visitedIds = new Set(visits.map(v => v.establishment_id).filter(Boolean));
            setUserVisitedEstablishments(visitedIds);
          }
        } catch (error) {
          console.error('Failed to load user visits:', error);
        }
      };
      
      loadUserVisits();
    }
  }, [currentSection, userId]);

  // Business functions
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
    try {
      const details = await getEstablishmentDetails(establishmentId);
      setSelectedEstablishmentDetails(details);
    } catch (error) {
      console.error('Failed to load establishment details:', error);
    }
  }, []);

  const addNewEstablishment = useCallback((establishment: EstablishmentWithDetails) => {
    setEstablishments(prev => {
      const establishmentExists = prev.some(existingEstablishment => existingEstablishment.id === establishment.id);
      if (establishmentExists) return prev;
      return [establishment, ...prev];
    });
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

  // Business filtering logic
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
      
      // My Establishments filter
      if (filters.myEstablishments) {
        // Show establishments where:
        // 1. User created the establishment, OR
        // 2. User has visited the establishment (check if user is in top_visitors)
        const isCreator = establishment.created_by === userId;
        
        // Check if current user is in the top_visitors array
        const hasVisited = establishment.top_visitors && 
          establishment.top_visitors.some(visitor => visitor.user_id === userId);
        
        if (!isCreator && !hasVisited) {
          return false;
        }
      }
      
      return true;
    });
  }, [establishments, filters, userId]);

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
    return <div className="text-sm opacity-70">Loading...</div>;
  }

  if (!userId) {
    return <div className="text-sm opacity-70">Please sign in.</div>;
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

    case 'business':
      const hasActiveFilters = filters.search !== "" || filters.statuses.length > 0 || filters.areas.length > 0 || filters.myEstablishments;
      
      return (
        <motion.div
          key="business"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.3 }}
          className="space-y-6 pb-24" // Add bottom padding for navbar
          layout // Add layout animation to the entire business view
        >
          {!selectedEstablishment && (
            <motion.div 
              className="flex items-center justify-between overflow-hidden"
              layout
              animate={{ 
                height: filtersModalOpen ? 0 : "auto",
                opacity: filtersModalOpen ? 0 : 1
              }}
              transition={{ 
                duration: 0.4, 
                ease: "easeOut",
                height: { duration: 0.3, ease: "easeOut" }
              }}
            >
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search establishments..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  onClick={() => setFiltersModalOpen(true)}
                  className="pl-10 cursor-pointer"
                  readOnly
                />
                {hasActiveFilters && (
                  <Badge variant="secondary" className="absolute -top-2 -right-2 text-xs">
                    {Object.values(filters).filter(Boolean).length}
                  </Badge>
                )}
              </div>
              
              {/* Remove the My Establishments toggle section entirely */}
            </motion.div>
          )}

          <motion.div 
            className="w-full"
            layout // Add layout animation to the content container
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <AnimatePresence mode="wait">
              {!selectedEstablishment ? (
                <motion.div
                  key="establishment-list"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="w-full"
                  layout // Add layout animation to the list
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
                    myEstablishmentsOnly={filters.myEstablishments} // Add this prop
                    onMyEstablishmentsChange={(checked) => setFilters(prev => ({ ...prev, myEstablishments: checked }))} // Add this prop
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
                  layout // Add layout animation to the details
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
          </motion.div>

          {/* Business Filters Modal */}
          <ResponsiveModal
            open={filtersModalOpen}
            onOpenChange={setFiltersModalOpen}
            title="Business Filters"
            description="Filter establishments by search, status, area, and more"
          >
            <BusinessFiltersForm
              filters={filters}
              onFiltersChange={setFilters}
              onClearFilters={() => setFilters({
                search: "",
                statuses: [],
                areas: [],
                myEstablishments: false
              })}
              hasActiveFilters={hasActiveFilters}
              statusOptions={[
                { value: "for_scouting", label: "For Scouting" },
                { value: "for_follow_up", label: "For Follow Up" },
                { value: "for_replenishment", label: "For Replenishment" },
                { value: "accepted_rack", label: "Accepted Rack" },
                { value: "declined_rack", label: "Declined Rack" },
                { value: "has_bible_studies", label: "Has Bible Studies" }
              ]}
              areaOptions={areaOptions}
              onClose={() => setFiltersModalOpen(false)}
            />
          </ResponsiveModal>
        </motion.div>
      );

    case 'congregation':
      if (!(profile as any)?.congregation_id && !cong?.id) {
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
              <div className="text-sm opacity-70">{admin ? "Create your congregation to get started." : "Ask an admin to create your congregation."}</div>
            </section>
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
                onSaved={(p) => {
                  setEditing(false);
                  setProfile(p);
                  setRefreshKey((k) => k + 1);
                }}
              />
            </ResponsiveModal>

            {!!userId && (
              <EditAccountDialog
                open={editAccountOpen}
                onOpenChange={(o) => {
                  setEditAccountOpen(o);
                  if (!o) setRefreshKey((k) => k + 1);
                }}
                userId={userId}
                initialEmail={profile?.email}
                initialUsername={(profile as any)?.username}
                currentProfile={profile}
              />
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
