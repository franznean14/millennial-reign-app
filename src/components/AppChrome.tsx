"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppTopbar } from "@/components/AppTopbar";
import { Home, Landmark, Briefcase, User } from "lucide-react";
import { useSPA } from "@/components/SPAProvider";

// Defer non-critical chrome to reduce initial JS
const OfflineInit = dynamic(() => import("@/components/OfflineInit"), { ssr: false });
const ServiceWorkerRegister = dynamic(() => import("@/components/ServiceWorkerRegister"), { ssr: false });
const SyncBanner = dynamic(() => import("@/components/SyncBanner"), { ssr: false });
const OnlineBanner = dynamic(() => import("@/components/OnlineBanner"), { ssr: false });
const BiometricGate = dynamic(() => import("@/components/BiometricGate"), { ssr: false });
const FloatButton = dynamic(() => import("@/components/fieldservice/FloatButton").then(m => m.FloatButton), { ssr: false });
import { Drawer } from "@/components/ui/drawer";
import { DrawerContent } from "@/components/ui/drawer";

interface AppChromeProps {
  children: React.ReactNode;
}

export function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();
  const { currentSection, userPermissions, onSectionChange, isLoading, isAuthenticated } = useSPA();
  const hideChrome = pathname === "/login" || pathname.startsWith("/auth/") || !isAuthenticated;
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Hide bottom nav + lock background when any drawer is open
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dialog-open", drawerOpen);
    root.classList.toggle("overscroll-none", drawerOpen);
    root.classList.toggle("touch-none", drawerOpen);
  }, [drawerOpen]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

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
      
      <div className="mx-auto flex max-w-screen-lg w-full overflow-x-hidden min-h-[100svh]">
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
        
        <main className="flex-1 min-h-0 px-4 py-6 w-full overflow-x-hidden overflow-y-auto">{children}</main>
      </div>
      
      {/* Bottom Navigation (Mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/80 backdrop-blur lg:hidden dialog-open:hidden pb-[max(env(safe-area-inset-bottom),0.5rem)]">
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
      
      <FloatButton />

      {/* Global drawer mounted once; control with local state */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <div className="p-4 pt-0">
            {/* TODO: render desired content here (e.g., EstablishmentForm wrapper) */}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
