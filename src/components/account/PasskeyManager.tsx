"use client";

import { useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSPA } from "@/components/SPAProvider";
import { Loader2, Trash2 } from "lucide-react";

type WebauthnFactor = {
  id: string;
  friendly_name?: string | null;
  status: string;
};

export function PasskeyManager() {
  const { refreshAuth } = useSPA();
  const [factors, setFactors] = useState<WebauthnFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [friendlyName, setFriendlyName] = useState("");

  const load = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setFactors([]);
      return;
    }
    setFactors(
      (data?.all ?? []).filter((f) => f.factor_type === "webauthn") as WebauthnFactor[]
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const addPasskey = async () => {
    const name = friendlyName.trim() || "Passkey";
    if (typeof window === "undefined" || !window.isSecureContext) {
      toast.error("Passkeys require HTTPS (secure context)");
      return;
    }
    setAdding(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const result = await supabase.auth.mfa.webauthn.register({
        friendlyName: name,
        rpId: window.location.hostname,
        rpOrigins: [window.location.origin],
      });
      if (result.error) {
        throw result.error;
      }
      toast.success("Passkey registered");
      setFriendlyName("");
      await load();
      refreshAuth();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not register passkey");
    } finally {
      setAdding(false);
    }
  };

  const removePasskey = async (factorId: string) => {
    setRemovingId(factorId);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast.success("Passkey removed");
      await load();
      refreshAuth();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not remove passkey");
    } finally {
      setRemovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading passkeys…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Passkeys add a second sign-in step after your password (Face ID, Touch ID, or device PIN).
        Enable WebAuthn MFA in the Supabase project if registration fails.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="grid flex-1 gap-1 text-sm">
          <span className="opacity-70">Name for this device</span>
          <Input
            value={friendlyName}
            onChange={(e) => setFriendlyName(e.target.value)}
            placeholder="e.g. iPhone, Pixel, YubiKey"
            disabled={adding}
            autoComplete="off"
          />
        </label>
        <Button type="button" onClick={() => void addPasskey()} disabled={adding}>
          {adding ? <Loader2 className="size-4 animate-spin" /> : null}
          Add passkey
        </Button>
      </div>
      {factors.length > 0 && (
        <ul className="divide-y rounded-md border">
          {factors.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <div>
                <div className="font-medium">{f.friendly_name?.trim() || "Passkey"}</div>
                <div className="text-xs text-muted-foreground capitalize">{f.status}</div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                disabled={removingId === f.id}
                onClick={() => void removePasskey(f.id)}
                aria-label="Remove passkey"
              >
                {removingId === f.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
