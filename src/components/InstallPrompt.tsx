"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

interface InstallPromptProps {
  className?: string;
  compact?: boolean;
}

export default function InstallPrompt({ className, compact = false }: InstallPromptProps) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const inStandalone =
      (typeof window !== "undefined" &&
        window.matchMedia &&
        window.matchMedia("(display-mode: standalone)").matches) ||
      (typeof window !== "undefined" &&
        typeof (window.navigator as Navigator & { standalone?: boolean }).standalone === "boolean" &&
        !!(window.navigator as Navigator & { standalone?: boolean }).standalone);
    if (inStandalone) {
      setInstalled(true);
      return;
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const evt = e as BeforeInstallPromptEvent;
      setDeferred(evt);
      setVisible(true);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setDeferred(null);
    };
    // Handle the event only once per page lifecycle to avoid repeated
    // console messages about preventDefault() and duplicate prompts.
    window.addEventListener(
      "beforeinstallprompt",
      onBeforeInstallPrompt as EventListener,
      { once: true }
    );
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  if (installed || !visible || !deferred) return null;

  const install = async () => {
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome !== "accepted") {
      // Keep button available to retry later
      return;
    }
    setVisible(false);
    setDeferred(null);
  };

  return (
    <button
      onClick={install}
      className={cn(
        compact
          ? "flex flex-col items-center justify-center gap-1 px-2 py-6 h-full rounded-md hover:bg-muted transition-colors"
          : "px-3 py-1.5 rounded-md border text-sm bg-white/80 dark:bg-black/30 backdrop-blur border-black/10 dark:border-white/20",
        className
      )}
      aria-label="Install app"
    >
      {compact ? (
        <>
          <Download className="h-4 w-4 flex-shrink-0" />
          <span className="text-[10px] font-medium text-center">Install</span>
        </>
      ) : (
        "Install app"
      )}
    </button>
  );
}
