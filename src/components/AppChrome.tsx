"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { AppTopbar } from "@/components/AppTopbar";
import { Home, Landmark, Briefcase, User } from "lucide-react";
import { useSPA } from "@/components/SPAProvider";
import { FullScreenLoading } from "@/components/FullScreenLoading";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";

// Component to show floating trigger when sidebar is closed
function FloatingSidebarTrigger() {
  const { open } = useSidebar();
  
  if (open) return null;
  
  return (
    <div className="fixed left-4 top-4 z-30 hidden lg:block">
      <SidebarTrigger />
    </div>
  );
}

// Defer non-critical chrome to reduce initial JS
const OfflineInit = dynamic(() => import("@/components/OfflineInit"), { ssr: false });
const ServiceWorkerRegister = dynamic(() => import("@/components/ServiceWorkerRegister"), { ssr: false });
const SyncBanner = dynamic(() => import("@/components/SyncBanner"), { ssr: false });
const OnlineBanner = dynamic(() => import("@/components/OnlineBanner"), { ssr: false });
const BiometricGate = dynamic(() => import("@/components/BiometricGate"), { ssr: false });

interface AppChromeProps {
  children: React.ReactNode;
}

export function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();
  const { currentSection, userPermissions, onSectionChange, isAuthenticated, isAppReady } = useSPA();
  const hideChrome = pathname === "/login" || pathname.startsWith("/auth/") || !isAuthenticated;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateAppViewport = () => {
      const height = window.visualViewport?.height ?? window.innerHeight;
      const width = window.visualViewport?.width ?? window.innerWidth;
      document.documentElement.style.setProperty("--app-height", `${Math.round(height)}px`);
      document.documentElement.style.setProperty("--app-width", `${Math.round(width)}px`);
    };

    updateAppViewport();
    const rafOne = requestAnimationFrame(updateAppViewport);
    const rafTwo = requestAnimationFrame(updateAppViewport);
    const timeoutId = window.setTimeout(updateAppViewport, 300);

    const handleOrientationChange = () => {
      window.setTimeout(updateAppViewport, 100);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateAppViewport();
      }
    };

    window.addEventListener("resize", updateAppViewport);
    window.addEventListener("orientationchange", handleOrientationChange);
    window.addEventListener("pageshow", updateAppViewport);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", updateAppViewport);
      window.visualViewport.addEventListener("scroll", updateAppViewport);
    }

    return () => {
      cancelAnimationFrame(rafOne);
      cancelAnimationFrame(rafTwo);
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", updateAppViewport);
      window.removeEventListener("orientationchange", handleOrientationChange);
      window.removeEventListener("pageshow", updateAppViewport);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", updateAppViewport);
        window.visualViewport.removeEventListener("scroll", updateAppViewport);
      }
    };
  }, []);


  // If not authenticated, just show the children (login view)
  if (!isAuthenticated) {
    return (
      <>
        <OfflineInit />
        <ServiceWorkerRegister />
        <SyncBanner />
        <OnlineBanner />
        <BiometricGate />
        {children}
      </>
    );
  }

  return (
    <>
      <FullScreenLoading isVisible={!isAppReady} />
      
      <OfflineInit />
      <ServiceWorkerRegister />
      <SyncBanner />
      <OnlineBanner />
      <BiometricGate />
      
      <SidebarProvider>
        <AppSidebar />
        <FloatingSidebarTrigger />
        <SidebarInset>
          <AppTopbar 
            currentSection={currentSection}
            onSectionChange={onSectionChange}
            userPermissions={userPermissions}
            className="hidden lg:block"
          />
          
          <main className="min-h-[calc(100dvh-56px)] flex-1 px-4 w-full overflow-x-hidden lg:!mt-4">
            {children}
          </main>
        </SidebarInset>
        
        {/* Bottom Navigation (Mobile) */}
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/80 backdrop-blur lg:hidden pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-screen-sm items-stretch justify-around">
            {[
              { id: 'home', label: "Home", icon: Home },
              ...(userPermissions.showCongregation ? [{ id: 'congregation', label: "Congregation", icon: Landmark }] : []),
              ...(userPermissions.showBusiness ? [{ id: 'business', label: "BWI", icon: Briefcase }] : []),
              { id: 'account', label: "Account", icon: User },
            ].map(({ id, label, icon: Icon }) => {
              const isActive = currentSection === id;
              return (
                <button
                  key={id}
                  onClick={() => onSectionChange(id)}
                  aria-label={label}
                  className={`flex flex-col items-center justify-center gap-1 py-3 w-full text-xs
                    ${isActive ? "text-foreground" : "text-foreground/60"}`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? "" : "opacity-70"}`} />
                  {label}
                </button>
              );
            })}
          </div>
        </nav>
      </SidebarProvider>
    </>
  );
}
