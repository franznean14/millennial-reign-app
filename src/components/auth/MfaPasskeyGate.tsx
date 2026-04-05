"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSPA } from "@/components/SPAProvider";
import { Loader2 } from "lucide-react";

/**
 * Blocks the app after password/OAuth sign-in until the user completes WebAuthn MFA (passkey).
 * Android (Chrome) and iOS (Safari / Home Screen) use the platform passkey UI.
 */
export function MfaPasskeyGate() {
  const { mfaPasskeyRequired, refreshAuth } = useSPA();
  const [loading, setLoading] = useState(false);
  const [signOutLoading, setSignOutLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [factors, setFactors] = useState<{ id: string; label: string }[]>([]);
  const [factorsLoaded, setFactorsLoaded] = useState(false);

  useEffect(() => {
    if (!mfaPasskeyRequired) {
      setFactors([]);
      setFactorId(null);
      setFactorsLoaded(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (error || !data) {
        setFactors([]);
        setFactorsLoaded(true);
        return;
      }
      const list = data.webauthn.map((f) => ({
        id: f.id,
        label: f.friendly_name?.trim() || "Passkey",
      }));
      setFactors(list);
      if (list.length === 1) setFactorId(list[0].id);
      setFactorsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [mfaPasskeyRequired]);

  if (!mfaPasskeyRequired) return null;

  const selected = factorId ?? factors[0]?.id ?? null;

  const continueWithPasskey = async () => {
    if (!selected) {
      toast.error("No passkey available");
      return;
    }
    if (typeof window === "undefined" || !window.isSecureContext) {
      toast.error("Passkeys require HTTPS");
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const result = await supabase.auth.mfa.webauthn.authenticate({
        factorId: selected,
        webauthn: {
          rpId: window.location.hostname,
          rpOrigins: [window.location.origin],
        },
      });
      if (result.error) {
        throw result.error;
      }
      toast.success("Signed in with passkey");
      refreshAuth();
    } catch (e: unknown) {
      const name = e && typeof e === "object" && "name" in e ? String((e as { name?: string }).name) : "";
      if (name === "NotAllowedError") {
        toast.error("Passkey sign-in was canceled or timed out");
      } else {
        toast.error(e instanceof Error ? e.message : "Passkey verification failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setSignOutLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      refreshAuth();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Sign out failed");
    } finally {
      setSignOutLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mfa-passkey-title"
    >
      <Card className="w-full max-w-md border-border bg-background shadow-xl">
        <CardHeader>
          <CardTitle id="mfa-passkey-title">Confirm with passkey</CardTitle>
          <CardDescription>
            Your account uses a passkey as a second step. Use Face ID, Touch ID, or your device&apos;s
            screen lock to finish signing in. Works in Safari on iPhone and Chrome on Android.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {factors.length > 1 && (
            <div className="grid gap-2">
              <span className="text-sm text-muted-foreground">Passkey</span>
              <Select
                value={selected ?? undefined}
                onValueChange={(v) => setFactorId(v)}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a passkey" />
                </SelectTrigger>
                <SelectContent>
                  {factors.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {factors.length === 0 && factorsLoaded && (
            <p className="text-sm text-destructive">
              No passkey factors found. Sign out and contact support, or remove MFA from the
              dashboard.
            </p>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => void signOut()}
            disabled={loading || signOutLoading}
          >
            {signOutLoading ? <Loader2 className="size-4 animate-spin" /> : null}
            Sign out
          </Button>
          <Button
            type="button"
            onClick={() => void continueWithPasskey()}
            disabled={loading || !selected || !factorsLoaded}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : null}
            Continue with passkey
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
