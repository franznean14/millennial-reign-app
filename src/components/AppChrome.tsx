"use client";

import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import ThemeToggle from "@/components/ThemeToggle";
import InstallPrompt from "@/components/InstallPrompt";
import { AuthButtons } from "@/components/auth/AuthButtons";
import MobileNav from "@/components/nav/MobileNav";
import DesktopNav from "@/components/nav/DesktopNav";
import BottomNav from "@/components/nav/BottomNav";
import { FloatingBridge } from "@/components/fieldservice/FloatingBridge";
import { usePathname } from "next/navigation";
import OfflineInit from "@/components/OfflineInit";
import SyncBanner from "@/components/SyncBanner";
import OfflineIndicator from "@/components/OfflineIndicator";
import OnlineBanner from "@/components/OnlineBanner";
import BiometricGate from "@/components/BiometricGate";

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideChrome = pathname === "/login" || pathname.startsWith("/auth/");

  return (
    <>
      <OfflineInit />
      <ServiceWorkerRegister />
      <SyncBanner />
      <OnlineBanner />
      <BiometricGate />
      {!hideChrome && (
        <header className="sticky top-0 z-20 w-full border-b border-border/80 bg-background/70 backdrop-blur">
          <div className="mx-auto max-w-screen-lg px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MobileNav />
              <div className="font-mono text-sm opacity-70">Millennial Reign</div>
            </div>
            <div className="flex items-center gap-2">
              <OfflineIndicator variant="inline" />
              <InstallPrompt />
              <ThemeToggle />
              <AuthButtons />
            </div>
          </div>
        </header>
      )}
      <div className="mx-auto flex max-w-screen-lg">
        {!hideChrome && <DesktopNav />}
        <main className="min-h-[calc(100dvh-56px)] flex-1 px-4 py-6">{children}</main>
      </div>
      {!hideChrome && <BottomNav />}
      {!hideChrome && <FloatingBridge />}
    </>
  );
}
