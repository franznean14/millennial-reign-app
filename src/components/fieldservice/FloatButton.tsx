"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Plus, Users, Building2, FilePlus2, X, UserPlus } from "lucide-react";
import { AddUserToCongregationForm } from "@/components/congregation/AddUserToCongregationForm";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isBusinessEnabled, isBusinessParticipant } from "@/lib/db/business";

function FloatButtonContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);
  const [congregationId, setCongregationId] = useState<string | null>(null);
  const [canEditCongregation, setCanEditCongregation] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Business states
  const [businessEnabled, setBusinessEnabled] = useState(false);
  const [businessParticipant, setBusinessParticipant] = useState(false);
  const [businessExpanded, setBusinessExpanded] = useState(false);

  // URL-derived selections (business view helpers)
  const selectedArea = pathname === "/business" ? searchParams.get('area') || undefined : undefined;
  const selectedEstablishmentId = pathname === "/business" ? searchParams.get('establishment') || undefined : undefined;

  // Get user ID and congregation info
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth
      .getSession()
      .then(({ data }) => setUserId(data.session?.user?.id ?? null))
      .catch(() => {});
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user?.id ?? null));

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
        } catch {}
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
      };
      checkBusinessStatus();
    }
  }, [pathname]);

  const triggerCongregationRefresh = () => {
    window.dispatchEvent(new CustomEvent('congregation-refresh'));
  };

  // Business floating actions
  if (pathname === "/business" && businessEnabled && businessParticipant) {
    return (
      <>
        <Button
          onClick={() => setBusinessExpanded(!businessExpanded)}
          className={`fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px] ${
            businessExpanded ? 'rotate-45' : ''
          }`}
          size="lg"
        >
          {businessExpanded ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
        </Button>

        <div className={`fixed right-4 z-40 flex flex-col gap-2 transition-all duration-300 ease-out items-end bottom-[calc(max(env(safe-area-inset-bottom),0px)+144px)] md:right-6 md:bottom-[168px] ${
          businessExpanded 
            ? 'opacity-100 translate-y-0 pointer-events-auto' 
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}>
          <Button
            variant="outline"
            className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => { window.dispatchEvent(new CustomEvent('drawer:est:open')); setBusinessExpanded(false); }}
          >
            <Building2 className="h-4 w-4 mr-2"/>
            Establishment
          </Button>
          <Button
            variant="outline"
            className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => { window.dispatchEvent(new CustomEvent('drawer:hh:open')); setBusinessExpanded(false); }}
          >
            <UserPlus className="h-4 w-4 mr-2"/>
            Householder
          </Button>
          <Button
            variant="default"
            className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => { window.dispatchEvent(new CustomEvent('drawer:visit:open')); setBusinessExpanded(false); }}
          >
            <FilePlus2 className="h-4 w-4 mr-2"/>
            Visit
          </Button>
        </div>
      </>
    );
  }

  // Congregation FAB
  if (pathname === "/congregation" && canEditCongregation && congregationId) {
    return (
      <>
        <Button
          onClick={() => setSearchDrawerOpen(true)}
          className="fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px]"
          size="lg"
        >
          <Users className="h-6 w-6" />
        </Button>

        <ResponsiveModal
          open={searchDrawerOpen}
          onOpenChange={setSearchDrawerOpen}
          title="Add User to Congregation"
          description="Search for users by username or email"
        >
          <AddUserToCongregationForm
            congregationId={congregationId}
            onUserAdded={() => {
              triggerCongregationRefresh();
              setSearchDrawerOpen(false);
            }}
            onClose={() => setSearchDrawerOpen(false)}
          />
        </ResponsiveModal>
      </>
    );
  }

  // Home and other views FAB
  if (userId) {
    return (
      <>
        <Button
          onClick={() => { window.dispatchEvent(new CustomEvent('drawer:home:open')); }}
          className="fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px]"
          size="lg"
        >
          <FilePlus2 className="h-6 w-6" />
        </Button>
      </>
    );
  }

  return null;
}

export function FloatButton() {
  return (
    <Suspense fallback={null}>
      <FloatButtonContent />
    </Suspense>
  );
}


