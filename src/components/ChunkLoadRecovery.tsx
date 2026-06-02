"use client";

import { useEffect } from "react";

const RELOAD_FLAG = "mr-chunk-reload-once";

function isChunkLoadFailure(reason: unknown): boolean {
  const message =
    reason instanceof Error
      ? `${reason.name} ${reason.message}`
      : typeof reason === "string"
        ? reason
        : "";
  const lower = message.toLowerCase();
  return (
    lower.includes("chunkloaderror") ||
    lower.includes("loading chunk") ||
    lower.includes("failed to fetch dynamically imported module") ||
    lower.includes("importing a module script failed")
  );
}

/**
 * After deploys, a stale service-worker cache can reference missing `_next` chunks.
 * Recover once per session instead of leaving users on the Next global-error screen.
 */
export default function ChunkLoadRecovery() {
  useEffect(() => {
    const tryRecover = (reason: unknown) => {
      if (!isChunkLoadFailure(reason)) return;
      if (typeof window === "undefined") return;
      if (sessionStorage.getItem(RELOAD_FLAG) === "1") return;
      sessionStorage.setItem(RELOAD_FLAG, "1");
      window.location.reload();
    };

    const onError = (event: ErrorEvent) => {
      tryRecover(event.error ?? event.message);
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      tryRecover(event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
