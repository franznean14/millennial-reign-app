"use client";

import { useEffect, useState } from "react";

export default function OfflineIndicator({ variant = "fixed" }: { variant?: "fixed" | "inline" }) {
  // Ensure identical HTML on server and first client paint
  const [hydrated, setHydrated] = useState(false);
  const [online, setOnline] = useState<boolean>(true);
  const [backendReachable, setBackendReachable] = useState<boolean>(true);
  const [originReachable, setOriginReachable] = useState<boolean>(true);

  useEffect(() => {
    setHydrated(true);
    // Initialize from browser
    setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    const onReachable = (e: any) => {
      const d = e?.detail || {};
      if (typeof d.backendReachable === "boolean") setBackendReachable(d.backendReachable);
      if (typeof d.originReachable === "boolean") setOriginReachable(d.originReachable);
    };
    window.addEventListener("app-net-reachable", onReachable as any);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("app-net-reachable", onReachable as any);
    };
  }, []);

  // Render a stable placeholder until hydrated to avoid hydration mismatch
  if (!hydrated) return <span data-offline-indicator-placeholder />;
  const serverDown = online && (!backendReachable || !originReachable);
  if (online && !serverDown) return null;
  const label = !online ? "Offline" : "Server unreachable";
  if (variant === "inline") {
    return <span className={`rounded-full px-2 py-0.5 text-[11px] ${!online ? "border border-destructive/30 bg-destructive/10 text-destructive" : "border border-amber-400/40 bg-amber-400/10 text-amber-600"}`}>{label}</span>;
  }
  return <div className="pointer-events-none fixed right-3 top-16 z-[2147483000] rounded-full border bg-destructive/90 px-2 py-0.5 text-[11px] text-destructive-foreground shadow-md">{label}</div>;
}
