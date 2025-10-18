"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, User, Landmark, Briefcase } from "lucide-react";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getProfile } from "@/lib/db/profiles";
import { cacheGet, cacheSet } from "@/lib/offline/store";
function useShowCongregationTab() {
  const [ok, setOk] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  
  useEffect(() => {
    const handleOnline = () => {
      console.log('Congregation Tab: Network Online');
      setIsOffline(false);
    };
    const handleOffline = () => {
      console.log('Congregation Tab: Network Offline');
      setIsOffline(true);
    };
    
    // Set initial state
    const initialOffline = !navigator.onLine;
    console.log('Congregation Tab: Initial offline state:', initialOffline, 'navigator.onLine:', navigator.onLine);
    setIsOffline(initialOffline);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      let cachedData = null;
      try {
        console.log('Congregation Tab: Effect running, isOffline:', isOffline);
        const { data } = await supabase.auth.getSession();
        const id = data.session?.user?.id ?? null;
        if (!id) {
          console.log('Congregation Tab: No user ID found');
          return setOk(false);
        }
        console.log('Congregation Tab: User ID:', id);
        
        const profileCacheKey = `user-profile-${id}`;
        const tabCacheKey = `congregation-tab-${id}`;
        
        // Try to load from cache first (both online and offline)
        const cachedProfile = await cacheGet(profileCacheKey);
        const cachedTabData = await cacheGet(tabCacheKey);
        console.log('Congregation Tab: Cached data:', { 
          cachedProfile: !!cachedProfile, 
          cachedTabData: !!cachedTabData,
          isOffline,
          cachedProfileData: cachedProfile ? { 
            role: cachedProfile.role, 
            privileges: cachedProfile.privileges, 
            congregation_id: cachedProfile.congregation_id,
            isAdmin: cachedProfile.isAdmin 
          } : null,
          cachedTabDataValue: cachedTabData?.showCongregation
        });
        
        if (cachedProfile) {
          // Use cached profile data to determine tab visibility
          const isElder = Array.isArray(cachedProfile.privileges) && cachedProfile.privileges.includes('Elder');
          const isSuperadmin = cachedProfile.role === "superadmin";
          const assigned = !!cachedProfile.congregation_id;
          const showCongregation = assigned || isSuperadmin || (cachedProfile.isAdmin && isElder);
          console.log('Congregation Tab: Using cached profile:', { 
            isElder, 
            isSuperadmin, 
            assigned, 
            isAdmin: cachedProfile.isAdmin, 
            showCongregation 
          });
          setOk(showCongregation);
        } else if (cachedTabData && cachedTabData.showCongregation !== undefined) {
          console.log('Congregation Tab: Using cached tab data:', cachedTabData.showCongregation);
          setOk(cachedTabData.showCongregation);
        }
        
        // If offline, don't attempt network request
        if (isOffline) {
          console.log('Congregation Tab: Offline detected, checking cached data...');
          // If offline and no cached data, default to true for better UX
          if (!cachedProfile && !cachedTabData) {
            console.log('Offline: No cached data, defaulting to show congregation tab');
            setOk(true);
          } else {
            const showCongregation = cachedProfile ? (assigned || isSuperadmin || (cachedProfile.isAdmin && isElder)) : cachedTabData?.showCongregation;
            console.log('Offline: Using cached data for congregation tab:', {
              cachedProfile: !!cachedProfile,
              cachedTabData: !!cachedTabData,
              showCongregation,
              assigned,
              isSuperadmin,
              isElder,
              isAdmin: cachedProfile?.isAdmin
            });
            setOk(showCongregation);
          }
          return;
        }
        
        // Fetch fresh data if online
        const p = await getProfile(id);
        const isElder = Array.isArray((p as any)?.privileges) && (p as any).privileges.includes('Elder');
        const isSuperadmin = (p as any)?.role === "superadmin";
        const assigned = !!(p as any)?.congregation_id;
        let admin = false;
        try {
          const { data: isAdm } = await supabase.rpc("is_admin", { uid: id });
          admin = !!isAdm;
        } catch {}
        
        const showCongregation = assigned || isSuperadmin || (admin && isElder);
        console.log('Congregation Tab: Setting visibility:', { 
          assigned, 
          isSuperadmin, 
          admin, 
          isElder, 
          showCongregation 
        });
        setOk(showCongregation);
        
        // Cache both profile data and tab result
        await cacheSet(profileCacheKey, { 
          ...p, 
          isAdmin: admin, 
          timestamp: new Date().toISOString() 
        });
        await cacheSet(tabCacheKey, { showCongregation, timestamp: new Date().toISOString() });
      } catch {
        // If there's an error and no cached data, default to false
        if (!cachedData) {
          setOk(false);
        }
      }
    })();
  }, [isOffline]);
  console.log('Congregation Tab: Final state:', ok);
  return ok;
}

function useShowBusinessTab() {
  const [ok, setOk] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  
  useEffect(() => {
    const handleOnline = () => {
      console.log('Business Tab: Network Online');
      setIsOffline(false);
    };
    const handleOffline = () => {
      console.log('Business Tab: Network Offline');
      setIsOffline(true);
    };
    
    // Set initial state
    const initialOffline = !navigator.onLine;
    console.log('Business Tab: Initial offline state:', initialOffline, 'navigator.onLine:', navigator.onLine);
    setIsOffline(initialOffline);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      let cachedData = null;
      try {
        console.log('Business Tab: Effect running, isOffline:', isOffline);
        const { data } = await supabase.auth.getSession();
        const id = data.session?.user?.id ?? null;
        if (!id) {
          console.log('Business Tab: No user ID found');
          return setOk(false);
        }
        console.log('Business Tab: User ID:', id);
        
        const businessCacheKey = `business-tab-${id}`;
        
        // Try to load from cache first (both online and offline)
        const cachedBusinessData = await cacheGet(businessCacheKey);
        console.log('Business Tab: Cached data:', { 
          cachedBusinessData: !!cachedBusinessData,
          isOffline,
          cachedBusinessDataValue: cachedBusinessData?.showBusiness
        });
        if (cachedBusinessData && cachedBusinessData.showBusiness !== undefined) {
          console.log('Business Tab: Using cached business data:', cachedBusinessData.showBusiness);
          setOk(cachedBusinessData.showBusiness);
        }
        
        // If offline, don't attempt network request
        if (isOffline) {
          console.log('Business Tab: Offline detected, checking cached data...');
          // If offline and no cached data, default to true for better UX
          if (!cachedBusinessData) {
            console.log('Offline: No cached business data, defaulting to show business tab');
            setOk(true);
          } else {
            console.log('Offline: Using cached business data:', {
              cachedBusinessData,
              showBusiness: cachedBusinessData.showBusiness
            });
            setOk(cachedBusinessData.showBusiness);
          }
          return;
        }
        
        // Fetch fresh data if online
        const { data: enabled } = await supabase.rpc('is_business_enabled');
        const { data: participant } = await supabase.rpc('is_business_participant');
        const showBusiness = !!enabled && !!participant;
        console.log('Business Tab: Setting visibility:', { 
          enabled, 
          participant, 
          showBusiness 
        });
        setOk(showBusiness);
        
        // Cache the result
        await cacheSet(businessCacheKey, { showBusiness, timestamp: new Date().toISOString() });
      } catch {
        // If there's an error and no cached data, default to false
        if (!cachedData) {
          setOk(false);
        }
      }
    })();
  }, [isOffline]);
  console.log('Business Tab: Final state:', ok);
  return ok;
}

export default function BottomNav() {
  const pathname = usePathname();
  const showCong = useShowCongregationTab();
  const showBiz = useShowBusinessTab();
  
  console.log('BottomNav: Tab states:', { showCong, showBiz });
  const tabs = [
    { href: "/", label: "Home", icon: Home },
    ...(showCong ? [{ href: "/congregation", label: "Congregation", icon: Landmark }] : []),
    ...(showBiz ? [{ href: "/business", label: "Business", icon: Briefcase }] : []),
    { href: "/account", label: "Account", icon: User },
  ];
  
  console.log('BottomNav: Rendered tabs:', tabs.map(t => t.label));
  return (
    <nav 
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/80 backdrop-blur md:hidden"
    >
      <div className="mx-auto flex max-w-screen-sm items-stretch justify-around">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={`flex flex-col items-center justify-center w-full text-xs min-h-[60px]
                ${active ? "text-foreground" : "text-foreground/60"}`}
            >
              <Icon className={`h-5 w-5 flex-shrink-0 ${active ? "" : "opacity-70"}`} />
              <span className="text-xs text-center">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
