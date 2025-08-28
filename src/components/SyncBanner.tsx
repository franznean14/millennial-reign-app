"use client";

import { useEffect } from "react";
import { toast } from "@/components/ui/sonner";

export default function SyncBanner() {
  useEffect(() => {
    const onFlushed = () => {
      toast.success("Changes synced", {
        duration: 1600,
        className: "py-1 text-xs",
      });
    };
    window.addEventListener("offline-sync-flushed", onFlushed as any);
    return () => window.removeEventListener("offline-sync-flushed", onFlushed as any);
  }, []);
  return null;
}
