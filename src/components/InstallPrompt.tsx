"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const evt = e as BeforeInstallPromptEvent;
      setDeferred(evt);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (!visible || !deferred) return null;

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
      className="px-3 py-1.5 rounded-md border text-sm bg-white/80 dark:bg-black/30 backdrop-blur border-black/10 dark:border-white/20"
    >
      Install app
    </button>
  );
}

