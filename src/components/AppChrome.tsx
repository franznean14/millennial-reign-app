"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Home, Landmark, Briefcase, User } from "lucide-react";
import { useSPA } from "@/components/SPAProvider";
import { FullScreenLoading } from "@/components/FullScreenLoading";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { HomeTodoDetailsFabProvider } from "@/components/home/home-todo-details-fab-context";

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
  const isUtilityRoute =
    pathname === "/diag" ||
    pathname.startsWith("/diag/") ||
    pathname === "/offline" ||
    pathname.startsWith("/offline/") ||
    pathname === "/privacy" ||
    pathname.startsWith("/tools/");
  const hideChrome = pathname === "/login" || pathname.startsWith("/auth/") || isUtilityRoute || !isAuthenticated;


  const navItems = [
    { id: "home", label: "Home", icon: Home },
    ...(userPermissions.showCongregation ? [{ id: "congregation", label: "Congregation", icon: Landmark }] : []),
    ...(userPermissions.showBusiness ? [{ id: "business", label: "BWI", icon: Briefcase }] : []),
    { id: "account", label: "Account", icon: User },
  ];
  const splitIndex = Math.ceil(navItems.length / 2);
  const leftNavItems = navItems.slice(0, splitIndex);
  const rightNavItems = navItems.slice(splitIndex);

  // Utility/auth routes render without app shell and app-ready overlay.
  if (hideChrome) {
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
        <SidebarInset className="min-h-0">
          <HomeTodoDetailsFabProvider>
            <div className="flex min-h-0 flex-1 flex-col px-4 w-full overflow-x-hidden">
              {children}
            </div>
          </HomeTodoDetailsFabProvider>
        </SidebarInset>
        
        {/* Bottom Navigation (Mobile) */}
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/80 backdrop-blur md:hidden pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-screen-sm items-stretch justify-around">
            {navItems.map(({ id, label, icon: Icon }) => {
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

        {/* Bottom Navigation (Tablet / iPad Pro) */}
        <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-20 hidden md:block">
          <div className="mx-auto flex w-[min(92vw,760px)] items-center justify-center px-3">
            <div className="pointer-events-auto flex w-full items-center justify-between rounded-full border border-border/60 bg-background/90 px-4 py-2 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-background/75">
              <div className="flex min-w-0 flex-1 items-center justify-evenly gap-2">
                {leftNavItems.map(({ id, label, icon: Icon }) => {
                  const isActive = currentSection === id;
                  return (
                    <button
                      key={id}
                      onClick={() => onSectionChange(id)}
                      aria-label={label}
                      className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs transition-colors ${
                        isActive ? "text-foreground" : "text-foreground/60 hover:text-foreground/90"
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${isActive ? "" : "opacity-80"}`} />
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Center notch space for iPad FAB */}
              <div className="h-12 w-16 shrink-0" aria-hidden />

              <div className="flex min-w-0 flex-1 items-center justify-evenly gap-2">
                {rightNavItems.map(({ id, label, icon: Icon }) => {
                  const isActive = currentSection === id;
                  return (
                    <button
                      key={id}
                      onClick={() => onSectionChange(id)}
                      aria-label={label}
                      className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-full px-3 py-1.5 text-xs transition-colors ${
                        isActive ? "text-foreground" : "text-foreground/60 hover:text-foreground/90"
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${isActive ? "" : "opacity-80"}`} />
                      <span className="truncate">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </nav>
      </SidebarProvider>
    </>
  );
}
