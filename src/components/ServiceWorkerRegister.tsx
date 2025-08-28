"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const register = async () => {
        try {
          await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        } catch (e) {
          console.warn("SW registration failed", e);
        }
      };
      register();
    }
  }, []);
  return null;
}

