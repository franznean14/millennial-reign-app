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
      let cachedData = null;
      try {
        const { data } = await supabase.auth.getSession();
        const id = data.session?.user?.id ?? null;
        if (!id) return setOk(false);
        
        const cacheKey = `congregation-tab-${id}`;
        
        // Try to load from cache first (both online and offline)
        cachedData = await cacheGet(cacheKey);
        if (cachedData && cachedData.showCongregation !== undefined) {
          setOk(cachedData.showCongregation);
        }
        
        // If offline, don't attempt network request
        if (isOffline) {
          // If offline and no cached data, default to true for better UX
          if (!cachedData) {
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
        
        // Cache the result
        await cacheSet(cacheKey, { showCongregation, timestamp: new Date().toISOString() });
      } catch {
        // If there's an error and no cached data, default to false
        if (!cachedData) {
          setOk(false);
        }
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
      let cachedData = null;
      try {
        const { data } = await supabase.auth.getSession();
        const id = data.session?.user?.id ?? null;
        if (!id) return setOk(false);
        
        const cacheKey = `business-tab-${id}`;
        
        // Try to load from cache first (both online and offline)
        cachedData = await cacheGet(cacheKey);
        if (cachedData && cachedData.showBusiness !== undefined) {
          setOk(cachedData.showBusiness);
        }
        
        // If offline, don't attempt network request
        if (isOffline) {
          // If offline and no cached data, default to true for better UX
          if (!cachedData) {
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
        await cacheSet(cacheKey, { showBusiness, timestamp: new Date().toISOString() });
      } catch {
        // If there's an error and no cached data, default to false
        if (!cachedData) {
          setOk(false);
        }
      }
    })();
  }, [isOffline]);
  return ok;
}

export default function DesktopNav() {
  const pathname = usePathname();
  const showCong = useShowCongregationTab();
  const showBiz = useShowBusinessTab();
  const links = [
    { href: "/", label: "Home", icon: Home },
    ...(showCong ? [{ href: "/congregation", label: "Congregation", icon: Landmark }] : []),
    ...(showBiz ? [{ href: "/business", label: "BWI", icon: Briefcase }] : []),
    { href: "/account", label: "Account", icon: User },
  ];
  return (
    <aside className="sticky top-14 hidden h-[calc(100dvh-56px)] w-60 shrink-0 border-r border-border/70 md:block">
      <nav className="p-3 grid gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition
                ${active ? "bg-muted font-medium" : "hover:bg-muted"}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
