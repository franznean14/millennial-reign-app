"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const isDev = process.env.NODE_ENV !== "production";

    const register = async () => {
      try {
        // In local/dev runs, service worker caching causes stale UI mismatches
        // across devices (especially iPad standalone/PWA). Keep dev uncached.
        if (isDev) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((reg) => reg.unregister()));
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));
          }
          return;
        }

        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (e) {
        console.warn("SW registration failed", e);
      }
    };

    void register();
  }, []);
  return null;
}

