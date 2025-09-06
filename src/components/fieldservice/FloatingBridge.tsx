"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Users, Building2, FilePlus2, X, UserPlus } from "lucide-react";
import { AddUserToCongregationForm } from "@/components/congregation/AddUserToCongregationForm";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { toast } from "@/components/ui/sonner";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isBusinessEnabled, isBusinessParticipant, listEstablishments } from "@/lib/db/business";
import { EstablishmentForm } from "@/components/business/EstablishmentForm";
import { HouseholderForm } from "@/components/business/HouseholderForm";
import { VisitForm } from "@/components/business/VisitForm";
// FieldService FAB is now rendered in AppClient (home section)

function FloatingBridgeContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);
  const [fsModalOpen, setFsModalOpen] = useState(false);
  const [congregationId, setCongregationId] = useState<string | null>(null);
  const [canEditCongregation, setCanEditCongregation] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Business states
  const [businessEnabled, setBusinessEnabled] = useState(false);
  const [businessParticipant, setBusinessParticipant] = useState(false);
  const [establishments, setEstablishments] = useState<any[]>([]);
  const [businessModalOpen, setBusinessModalOpen] = useState<null | 'est' | 'hh' | 'visit'>(null);
  const [businessExpanded, setBusinessExpanded] = useState(false);
  
  // Get selected area from URL for business page
  const selectedArea = pathname === "/business" ? searchParams.get('area') || undefined : undefined;
  const selectedEstablishmentId = pathname === "/business" ? searchParams.get('establishment') || undefined : undefined;

  // Get user ID and congregation info
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    
    // Get user ID
    supabase.auth
      .getSession()
      .then(({ data }) => setUserId(data.session?.user?.id ?? null))
      .catch(() => {});
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user?.id ?? null));
    
    // Get congregation info when on congregation page
    if (pathname === "/congregation") {
      const getCongregationInfo = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data: profile } = await supabase
            .from('profiles')
            .select('congregation_id, privileges, role')
            .eq('id', user.id)
            .single();

          if (profile?.congregation_id) {
            setCongregationId(profile.congregation_id);
            
            const isAdmin = profile.role === 'admin';
            const isElder = Array.isArray(profile.privileges) && profile.privileges.includes('Elder');
            setCanEditCongregation(isAdmin || isElder);
          }
        } catch (error) {
          console.error('Error getting congregation info:', error);
        }
      };
      getCongregationInfo();
    }
    
    return () => sub.subscription.unsubscribe();
  }, [pathname]);

  // Check business status when on business page
  useEffect(() => {
    if (pathname === "/business") {
      const checkBusinessStatus = async () => {
        setBusinessEnabled(await isBusinessEnabled());
        setBusinessParticipant(await isBusinessParticipant());
        setEstablishments(await listEstablishments());
      };
      checkBusinessStatus();
    }
  }, [pathname]);

  // Global refresh trigger for congregation members
  const triggerCongregationRefresh = () => {
    window.dispatchEvent(new CustomEvent('congregation-refresh'));
  };

  // For business view, show the expandable business floating button
  if (pathname === "/business" && businessEnabled && businessParticipant) {
    return (
      <>
        {/* Main floating button - same positioning as other floating buttons */}
        <Button
          onClick={() => setBusinessExpanded(!businessExpanded)}
          className={`fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] ${
            businessExpanded ? 'rotate-45' : ''
          }`}
          size="lg"
        >
          {businessExpanded ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>

        {/* Expandable buttons - positioned above main button */}
        <div className={`fixed right-4 z-40 flex flex-col gap-2 transition-all duration-300 ease-out items-end bottom-[calc(max(env(safe-area-inset-bottom),0px)+144px)] md:right-6 ${
          businessExpanded 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}>
          <Button
            variant="outline"
            className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => setBusinessModalOpen('est')}
          >
            <Building2 className="h-4 w-4 mr-2"/>
            Establishment
          </Button>
          <Button
            variant="outline"
            className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => setBusinessModalOpen('hh')}
          >
            <UserPlus className="h-4 w-4 mr-2"/>
            Householder
          </Button>
          <Button
            variant="default"
            className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => setBusinessModalOpen('visit')}
          >
            <FilePlus2 className="h-4 w-4 mr-2"/>
            Visit
          </Button>
        </div>

        {/* Business Modals */}
        <ResponsiveModal open={businessModalOpen==='est'} onOpenChange={(o)=> setBusinessModalOpen(o? 'est': null)} title="New Establishment" description="Add a business establishment" className="sm:max-w-[560px]">
          <EstablishmentForm 
            onSaved={async () => { 
              setBusinessModalOpen(null); 
              setEstablishments(await listEstablishments());
            }} 
            selectedArea={selectedArea}
          />
        </ResponsiveModal>
        <ResponsiveModal open={businessModalOpen==='hh'} onOpenChange={(o)=> setBusinessModalOpen(o? 'hh': null)} title="New Householder" description="Add a householder for an establishment" className="sm:max-w-[560px]">
          <HouseholderForm 
            establishments={establishments} 
            selectedEstablishmentId={selectedEstablishmentId}
            onSaved={() => {
              setBusinessModalOpen(null);
            }} 
          />
        </ResponsiveModal>
        <ResponsiveModal open={businessModalOpen==='visit'} onOpenChange={(o)=> setBusinessModalOpen(o? 'visit': null)} title="Visit Update" description="Record a visit note" className="sm:max-w-[560px]">
          <VisitForm 
            establishments={establishments} 
            selectedEstablishmentId={selectedEstablishmentId}
            onSaved={() => {
              setBusinessModalOpen(null);
            }} 
          />
        </ResponsiveModal>
      </>
    );
  }
  
  // For congregation view, show user search button
  if (pathname === "/congregation" && canEditCongregation && congregationId) {
    return (
      <>
        {/* Floating Action Button - same positioning as BusinessFloatingButton */}
        <Button
          onClick={() => setSearchDrawerOpen(true)}
          className="fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)]"
          size="lg"
        >
          <Users className="h-6 w-6" />
        </Button>

        {/* User Search Modal */}
        <ResponsiveModal
          open={searchDrawerOpen}
          onOpenChange={setSearchDrawerOpen}
          title="Add User to Congregation"
          description="Search for users by username or email"
        >
          <AddUserToCongregationForm
            congregationId={congregationId}
            onUserAdded={(user) => {
              triggerCongregationRefresh();
              setSearchDrawerOpen(false);
            }}
            onClose={() => setSearchDrawerOpen(false)}
          />
        </ResponsiveModal>
      </>
    );
  }
  
  // For other views (home, account, etc.), render the button directly like congregation view
  if (userId) {
    return null;
  }
  
  return null;
}

export function FloatingBridge() {
  return (
    <Suspense fallback={null}>
      <FloatingBridgeContent />
    </Suspense>
  );
}

