"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Home, Landmark, Briefcase, User } from "lucide-react";
import { useSPA } from "@/components/SPAProvider";
import { FullScreenLoading } from "@/components/FullScreenLoading";
import { hasCompletedAppBootSession, markAppBootSessionComplete } from "@/lib/app/boot-session";
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
const ChunkLoadRecovery = dynamic(() => import("@/components/ChunkLoadRecovery"), { ssr: false });
const SyncBanner = dynamic(() => import("@/components/SyncBanner"), { ssr: false });
const OnlineBanner = dynamic(() => import("@/components/OnlineBanner"), { ssr: false });
const BiometricGate = dynamic(() => import("@/components/BiometricGate"), { ssr: false });

interface AppChromeProps {
  children: React.ReactNode;
}

export function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname();
  const { currentSection, userPermissions, onSectionChange, isAuthenticated, isAppReady } = useSPA();
  const [suppressBootLoader, setSuppressBootLoader] = useState(false);

  useEffect(() => {
    if (hasCompletedAppBootSession()) {
      setSuppressBootLoader(true);
    }
  }, []);

  useEffect(() => {
    if (isAppReady) {
      markAppBootSessionComplete();
      setSuppressBootLoader(true);
    }
  }, [isAppReady]);
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
        <ChunkLoadRecovery />
        <SyncBanner />
        <OnlineBanner />
        <BiometricGate />
        {children}
      </>
    );
  }

  return (
    <>
      <FullScreenLoading isVisible={!isAppReady && !suppressBootLoader} />
      
      <OfflineInit />
      <ServiceWorkerRegister />
      <ChunkLoadRecovery />
      <SyncBanner />
      <OnlineBanner />
      <BiometricGate />
      
      {/*
        Mobile: pin shell with inset-0 (fill viewport edge-to-edge). top-0 + bottom-auto + h-[100lvh]
        leaves an unpainted strip above the home indicator on some iOS standalone builds (same class of
        bug as the top black strip — layout box shorter than visible viewport).
      */}
      <SidebarProvider className="max-md:!fixed max-md:!inset-0 max-md:!min-h-0 max-md:!h-auto max-md:!max-h-none max-md:!overflow-hidden max-md:bg-background">
        <SidebarInset className="min-h-0">
          <HomeTodoDetailsFabProvider>
            <div className={cn("flex min-h-0 flex-1 flex-col px-4 w-full overflow-x-hidden", studyBibleDarkClasses.page)}>
              {children}
            </div>
          </HomeTodoDetailsFabProvider>
        </SidebarInset>
        
        {/* Bottom nav: flush to viewport bottom on phones — scroll regions keep pb-[...+80px] for clearance */}
        <nav
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 border-t pb-0 md:hidden",
            studyBibleDarkClasses.navBar
          )}
          aria-label="Primary navigation"
        >
          <div className="mx-auto flex min-h-[68px] max-w-screen-sm items-stretch justify-around">
            {navItems.map(({ id, label, icon: Icon }) => {
              const isActive = currentSection === id;
              return (
                <button
                  key={id}
                  onClick={() => onSectionChange(id)}
                  aria-label={label}
                  className={cn(
                    "flex h-full min-h-0 flex-1 flex-col items-center justify-start gap-0.5 pt-2 pb-1 text-[11px] leading-tight transition-colors",
                    isActive
                      ? "text-white dark:text-[#fffaff]"
                      : "text-white/70 dark:text-[#ded6e7]/70"
                  )}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${isActive ? "" : "opacity-70"}`} fill={isActive ? "currentColor" : "none"} />
                  <span className="max-w-full truncate px-0.5 text-center">{label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Bottom Navigation (Tablet / iPad Pro) */}
        <nav className="pointer-events-none fixed inset-x-0 z-20 hidden md:block bottom-[calc(max(env(safe-area-inset-bottom),0px)+14px)]">
          <div className="mx-auto flex w-[min(92vw,760px)] items-center justify-center px-3">
            <div className="pointer-events-auto flex w-full items-center justify-between rounded-lg border border-border/60 bg-background/80 px-4 py-2 shadow-2xl backdrop-blur-[44px] backdrop-saturate-150 supports-[backdrop-filter]:bg-background/70 dark:border-[#1c1921] dark:bg-[#2a2534]/50 dark:backdrop-brightness-125 dark:shadow-[0_16px_46px_rgba(0,0,0,0.45)]">
              <div className="flex min-w-0 flex-1 items-center justify-evenly gap-2">
                {leftNavItems.map(({ id, label, icon: Icon }) => {
                  const isActive = currentSection === id;
                  return (
                    <button
                      key={id}
                      onClick={() => onSectionChange(id)}
                      aria-label={label}
                      className={cn(
                        "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-full px-3 py-1.5 text-[13px] transition-colors hover:bg-muted/40 dark:hover:bg-[#3b3348]/60",
                        isActive
                          ? "text-primary dark:text-white"
                          : "text-muted-foreground hover:text-foreground dark:text-[#ded6e7]/75 dark:hover:text-[#fffaff]"
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
                        "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-full px-3 py-1.5 text-[13px] transition-colors hover:bg-muted/40 dark:hover:bg-[#3b3348]/60",
                        isActive
                          ? "text-primary dark:text-white"
                          : "text-muted-foreground hover:text-foreground dark:text-[#ded6e7]/75 dark:hover:text-[#fffaff]"
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
