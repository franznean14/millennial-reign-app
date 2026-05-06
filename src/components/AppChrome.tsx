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
import { studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";
import { cn } from "@/lib/utils";

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
      
      <SidebarProvider className="max-md:!fixed max-md:!inset-x-0 max-md:!top-0 max-md:!bottom-auto max-md:!h-[100lvh] max-md:!max-h-[100lvh] max-md:!overflow-hidden">
        <SidebarInset className="min-h-0">
          <HomeTodoDetailsFabProvider>
            <div className={cn("flex min-h-0 flex-1 flex-col px-4 w-full overflow-x-hidden", studyBibleDarkClasses.page)}>
              {children}
            </div>
          </HomeTodoDetailsFabProvider>
        </SidebarInset>
        
        {/* Bottom Navigation (Mobile) */}
        <nav className="absolute inset-x-0 bottom-0 z-20 border-t border-border/70 bg-background/45 backdrop-blur-[44px] backdrop-saturate-150 backdrop-brightness-110 supports-[backdrop-filter]:bg-background/35 md:hidden pb-[env(safe-area-inset-bottom)] dark:border-[#1c1921] dark:bg-[#2a2534]/50 dark:backdrop-brightness-125">
          <div className="mx-auto flex max-w-screen-sm items-stretch justify-around">
            {navItems.map(({ id, label, icon: Icon }) => {
              const isActive = currentSection === id;
              return (
                <button
                  key={id}
                  onClick={() => onSectionChange(id)}
                  aria-label={label}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 py-3 w-full text-[13px] transition-colors",
                    isActive ? "text-foreground dark:text-[#fffaff]" : "text-foreground/60 dark:text-[#ded6e7]/70"
                  )}
                >
                  <Icon className={`h-6 w-6 ${isActive ? "" : "opacity-70"}`} fill={isActive ? "currentColor" : "none"} />
                  {label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Bottom Navigation (Tablet / iPad Pro) */}
        <nav className="pointer-events-none fixed inset-x-0 z-20 hidden md:block bottom-[calc(max(env(safe-area-inset-bottom),0px)+14px)]">
          <div className="mx-auto flex w-[min(92vw,760px)] items-center justify-center px-3">
            <div className="pointer-events-auto flex w-full items-center justify-between rounded-lg border border-border/60 bg-background/45 px-4 py-2 shadow-2xl backdrop-blur-[44px] backdrop-saturate-150 backdrop-brightness-110 supports-[backdrop-filter]:bg-background/35 dark:border-[#1c1921] dark:bg-[#2a2534]/50 dark:backdrop-brightness-125 dark:shadow-[0_16px_46px_rgba(0,0,0,0.45)]">
              <div className="flex min-w-0 flex-1 items-center justify-evenly gap-2">
                {leftNavItems.map(({ id, label, icon: Icon }) => {
                  const isActive = currentSection === id;
                  return (
                    <button
                      key={id}
                      onClick={() => onSectionChange(id)}
                      aria-label={label}
                      className={cn(
                        "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-full px-3 py-1.5 text-[13px] transition-colors dark:hover:bg-[#3b3348]/60",
                        isActive ? "text-foreground dark:text-white" : "text-foreground/60 hover:text-foreground/90 dark:text-[#ded6e7]/75 dark:hover:text-[#fffaff]"
                      )}
                    >
                      <Icon className={`h-6 w-6 ${isActive ? "" : "opacity-80"}`} fill={isActive ? "currentColor" : "none"} />
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
                      className={cn(
                        "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-full px-3 py-1.5 text-[13px] transition-colors dark:hover:bg-[#3b3348]/60",
                        isActive ? "text-foreground dark:text-white" : "text-foreground/60 hover:text-foreground/90 dark:text-[#ded6e7]/75 dark:hover:text-[#fffaff]"
                      )}
                    >
                      <Icon className={`h-6 w-6 ${isActive ? "" : "opacity-80"}`} fill={isActive ? "currentColor" : "none"} />
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
