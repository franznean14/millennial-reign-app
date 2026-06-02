"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";
import { cn } from "@/lib/utils";

export interface AppRouteErrorProps {
  error: Error & { digest?: string };
  reset?: () => void;
  /** When true, render `<html>` / `<body>` for global-error.tsx. */
  global?: boolean;
}

function isChunkLoadError(error: Error): boolean {
  const message = error.message?.toLowerCase() ?? "";
  const name = error.name?.toLowerCase() ?? "";
  return (
    name.includes("chunkload") ||
    message.includes("loading chunk") ||
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("importing a module script failed")
  );
}

export function AppRouteError({ error, reset, global = false }: AppRouteErrorProps) {
  useEffect(() => {
    console.error("[AppRouteError]", error);
  }, [error]);

  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  const handleBack = () => {
    if (typeof window !== "undefined") {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.assign("/");
      }
    }
  };

  const handleRetry = () => {
    if (reset) {
      reset();
      return;
    }
    handleReload();
  };

  const chunkStale = isChunkLoadError(error);

  const content = (
    <div
      className={cn(
        "flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6 py-12 text-center",
        studyBibleDarkClasses.page
      )}
    >
      <AlertTriangle className="h-12 w-12 text-[#ded6e7]" aria-hidden />
      <div className="space-y-2 max-w-sm">
        <h1 className="text-xl font-bold text-[#fffaff]">
          {chunkStale ? "App update available" : "Something went wrong"}
        </h1>
        <p className="text-sm text-[#ded6e7]">
          {chunkStale
            ? "A newer version of the app is available. Reload to continue."
            : "Reload to try again, or go back to the previous screen."}
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3 sm:flex-row sm:justify-center">
        <Button type="button" className="w-full sm:w-auto" onClick={handleRetry}>
          Reload
        </Button>
        <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={handleBack}>
          Back
        </Button>
      </div>
    </div>
  );

  if (global) {
    return (
      <html lang="en">
        <body className="antialiased bg-[#24231f] text-[#fffaff]">{content}</body>
      </html>
    );
  }

  return content;
}
