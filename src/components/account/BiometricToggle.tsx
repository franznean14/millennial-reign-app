"use client";

import { useEffect, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function BiometricToggle() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("biometric_enabled");
    setEnabled(stored === "1");
    // Detect platform authenticator availability
    // @ts-ignore
    const check = window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
      ? // @ts-ignore
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
      : Promise.resolve(false);
    check.then((v: boolean) => setAvailable(v)).catch(() => setAvailable(false));
  }, []);

  const enable = async () => {
    try {
      if (!window.isSecureContext) {
        toast.error("Biometrics require HTTPS (secure context)");
        return;
      }
      // Best-effort local verification ceremony (no server challenge) to gate offline access.
      const challenge = crypto.getRandomValues(new Uint8Array(16));
      // @ts-ignore
      const getPromise = navigator.credentials.get({
        publicKey: {
          challenge,
          timeout: 15000,
          userVerification: "required",
          // Empty allowCredentials triggers discoverable credentials if any exist.
          allowCredentials: [],
          // rpId defaults to current origin; cross-device (QR) requires a real domain, not localhost.
        },
        mediation: "required",
      });
      let res: any = null;
      try {
        res = await getPromise;
      } catch (err: any) {
        const msg = String(err?.name || err?.message || "");
        if (msg.includes("NotAllowedError")) {
          toast.error("Biometric prompt canceled or timed out");
        } else {
          toast.error("Biometric check failed");
        }
        // Guidance for cross-device QR on iPhone
        toast.message("Tip", {
          description:
            location.hostname === "localhost" || location.hostname === "127.0.0.1"
              ? "QR/passkey from another device requires a real HTTPS domain. Test biometrics on this device or deploy to a domain."
              : "If using a QR from another device, ensure the domain matches and is HTTPS.",
        });
        return;
      }
      if (res) {
        localStorage.setItem("biometric_enabled", "1");
        setEnabled(true);
        toast.success("Biometric unlock enabled for offline use");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Biometric setup error");
    }
  };

  const disable = () => {
    localStorage.removeItem("biometric_enabled");
    setEnabled(false);
    toast.success("Biometric unlock disabled");
  };

  if (available === null) return null;
  if (!available)
    return (
      <div className="text-sm opacity-70">Biometrics not available on this device/browser.</div>
    );

  return (
    <div className="flex items-center space-x-2">
      <Switch id="biometric-toggle" checked={enabled} onCheckedChange={(c) => (c ? enable() : disable())} />
      <Label htmlFor="biometric-toggle">Enable biometric unlock</Label>
    </div>
  );
}
