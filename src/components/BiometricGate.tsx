"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/ui/sonner";

export default function BiometricGate() {
  const [prompting, setPrompting] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const enabled = localStorage.getItem("biometric_enabled") === "1";
    if (!enabled) return;

    const tryUnlock = async () => {
      if (sessionStorage.getItem("biometric_unlocked") === "1") return;
      if (navigator.onLine) return; // Only gate when offline
      if (!window.isSecureContext) return;
      // Prompt once on load
      setPrompting(true);
      try {
        const challenge = crypto.getRandomValues(new Uint8Array(16));
        // @ts-ignore
        await navigator.credentials.get({
          publicKey: {
            challenge,
            timeout: 12000,
            userVerification: "required",
            allowCredentials: [],
          },
          mediation: "required",
        });
        sessionStorage.setItem("biometric_unlocked", "1");
        toast.success("Unlocked offline access", { duration: 1500 });
      } catch (err: any) {
        // Show a gentle overlay to retry or proceed
        setVisible(true);
      } finally {
        setPrompting(false);
      }
    };

    // Kick immediately and when going offline during the session
    tryUnlock();
    const onOffline = () => tryUnlock();
    const onOnline = () => {
      setVisible(false);
      sessionStorage.setItem("biometric_unlocked", "1");
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[2147483600] bg-black/40 backdrop-blur-sm">
      <div className="absolute left-1/2 top-1/2 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-4 shadow-xl">
        <div className="text-base font-medium">Unlock offline access</div>
        <div className="mt-2 text-sm opacity-80">Use your device biometrics to unlock cached data while offline.</div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => setVisible(false)}
            disabled={prompting}
          >
            Not now
          </button>
          <button
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground text-sm disabled:opacity-50"
            onClick={async () => {
              try {
                const challenge = crypto.getRandomValues(new Uint8Array(16));
                // @ts-ignore
                await navigator.credentials.get({
                  publicKey: { challenge, timeout: 12000, userVerification: "required", allowCredentials: [] },
                  mediation: "required",
                });
                sessionStorage.setItem("biometric_unlocked", "1");
                setVisible(false);
                toast.success("Unlocked offline access", { duration: 1500 });
              } catch {}
            }}
            disabled={prompting}
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}

