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
  
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const id = data.session?.user?.id ?? null;
        if (!id) return setOk(false);
        
        const profileCacheKey = `user-profile-${id}`;
        const tabCacheKey = `congregation-tab-${id}`;
        
        // Try to load from cache first (both online and offline)
        const cachedProfile = await cacheGet(profileCacheKey);
        const cachedTabData = await cacheGet(tabCacheKey);
        
        if (cachedProfile) {
          // Use cached profile data to determine tab visibility
          const isElder = Array.isArray(cachedProfile.privileges) && cachedProfile.privileges.includes('Elder');
          const isSuperadmin = cachedProfile.role === "superadmin";
          const assigned = !!cachedProfile.congregation_id;
          const showCongregation = assigned || isSuperadmin || (cachedProfile.isAdmin && isElder);
          setOk(showCongregation);
        } else if (cachedTabData && cachedTabData.showCongregation !== undefined) {
          setOk(cachedTabData.showCongregation);
        }
        
        // If offline, don't attempt network request
        if (isOffline) {
          // If offline and no cached data, default to true for better UX
          if (!cachedProfile && !cachedTabData) {
            setOk(true);
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
        setOk(false);
      }
    })();
  }, [isOffline]);
  return ok;
}

function useShowBusinessTab() {
  const [ok, setOk] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  
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
  
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const id = data.session?.user?.id ?? null;
        if (!id) return setOk(false);
        
        const businessCacheKey = `business-tab-${id}`;
        
        // Try to load from cache first (both online and offline)
        const cachedBusinessData = await cacheGet(businessCacheKey);
        if (cachedBusinessData && cachedBusinessData.showBusiness !== undefined) {
          setOk(cachedBusinessData.showBusiness);
        }
        
        // If offline, don't attempt network request
        if (isOffline) {
          // If offline and no cached data, default to true for better UX
          if (!cachedBusinessData) {
            setOk(true);
          }
          return;
        }
        
        // Fetch fresh data if online
        const { data: enabled } = await supabase.rpc('is_business_enabled');
        const { data: participant } = await supabase.rpc('is_business_participant');
        const showBusiness = !!enabled && !!participant;
        setOk(showBusiness);
        
        // Cache the result
        await cacheSet(businessCacheKey, { showBusiness, timestamp: new Date().toISOString() });
      } catch {
        // If there's an error and no cached data, default to false
        setOk(false);
      }
    })();
  }, [isOffline]);
  return ok;
}

export default function BottomNav() {
  const pathname = usePathname();
  const showCong = useShowCongregationTab();
  const showBiz = useShowBusinessTab();
  
  const tabs = [
    { href: "/", label: "Home", icon: Home },
    ...(showCong ? [{ href: "/congregation", label: "Congregation", icon: Landmark }] : []),
    ...(showBiz ? [{ href: "/business", label: "Business", icon: Briefcase }] : []),
    { href: "/account", label: "Account", icon: User },
  ];
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
