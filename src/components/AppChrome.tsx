"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { AppTopbar } from "@/components/AppTopbar";
import { Home, Landmark, Briefcase, User } from "lucide-react";
import { useSPA } from "@/components/SPAProvider";
import { useLoadingManager } from "@/components/LoadingManager";
import { FullScreenLoading } from "@/components/FullScreenLoading";

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
  const { currentSection, userPermissions, onSectionChange, isAuthenticated } = useSPA();
  const { isAppReady, setLoadingState } = useLoadingManager();
  const hideChrome = pathname === "/login" || pathname.startsWith("/auth/") || !isAuthenticated;

  // Track navigation loading
  useEffect(() => {
    if (isAuthenticated) {
      setLoadingState('navigation', false);
    }
  }, [isAuthenticated, setLoadingState]);

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
      
      <AppTopbar 
        currentSection={currentSection}
        onSectionChange={onSectionChange}
        userPermissions={userPermissions}
      />
      
      <div className="mx-auto flex max-w-screen-lg w-full overflow-x-hidden">
        {/* Desktop Sidebar Navigation */}
        <nav className="hidden lg:flex flex-col w-64 border-r border-border/50 bg-background/50 backdrop-blur">
          <div className="p-4 border-b border-border/50">
            <div className="font-mono text-sm opacity-70">Millennial Reign</div>
          </div>
          <div className="flex-1 p-2">
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
                  className={`w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors
                    ${isActive ? "bg-muted font-medium" : "hover:bg-muted/50"}`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </nav>
        
        <main className="min-h-[calc(100dvh-56px)] flex-1 px-4 py-6 w-full overflow-x-hidden">{children}</main>
      </div>
      
      {/* Bottom Navigation (Mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/80 backdrop-blur lg:hidden pb-[max(env(safe-area-inset-bottom),0.5rem)]">
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
      
      {/* FloatingBridge removed - handled per-view */}
    </>
  );
}
