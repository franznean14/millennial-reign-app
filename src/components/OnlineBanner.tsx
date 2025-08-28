"use client";

import { useEffect, useRef } from "react";
import { toast } from "@/components/ui/sonner";

export default function OnlineBanner() {
  const prevReachable = useRef<boolean | null>(null);

  useEffect(() => {
    const showToast = () => toast.success("Back online", { duration: 2500 });
    const onReachable = (e: any) => {
      const reachable = !!e?.detail?.reachable;
      if (prevReachable.current === false && reachable) showToast();
      prevReachable.current = reachable;
    };
    // Initialize based on current navigator
    prevReachable.current = typeof navigator !== "undefined" ? navigator.onLine : true;
    window.addEventListener("app-net-reachable", onReachable as any);
    window.addEventListener("online", () => {
      if (prevReachable.current === false) {
        showToast();
        prevReachable.current = true;
      }
    });
    return () => {
      window.removeEventListener("app-net-reachable", onReachable as any);
    };
  }, []);

  return null;
}
