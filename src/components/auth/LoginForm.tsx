"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/sonner";

export function LoginForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState(""); // email or username
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    try {
      if (mode === "signin") {
        let email = identifier;
        if (!identifier.includes("@")) {
          // lookup email by username via RPC
          const { data, error: rpcError } = await supabase.rpc("get_email_by_username", { u: identifier });
          if (rpcError) throw rpcError;
          if (!data) throw new Error("User not found");
          email = data as string;
        }
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        try { localStorage.setItem("has_password", "1"); } catch {}
        try {
          // Offer storing credentials in browser password manager (best-effort)
          // @ts-ignore
          if (window.PasswordCredential) {
            const cred = new window.PasswordCredential({ id: identifier, password } as any);
            // @ts-ignore
            await navigator.credentials.store(cred);
          }
        } catch {}
        toast.success("Signed in");
        window.location.href = "/";
      } else {
        const email = identifier;
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        try { localStorage.setItem("has_password", "1"); } catch {}
        toast.success("Check your email to confirm your account");
      }
    } catch (e: any) {
      toast.error(e.message ?? "Auth error");
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  };

  const resetPassword = async () => {
    if (!identifier) {
      toast.error("Enter your email first");
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(identifier, { redirectTo });
      if (error) throw error;
      toast.success("Password reset link sent");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <label className="grid gap-1 text-sm">
          <span className="opacity-70">Email or username</span>
          <input className="rounded-md border bg-background px-3 py-2" type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="opacity-70">Password</span>
          <input className="rounded-md border bg-background px-3 py-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={loading || !identifier || !password}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Sign Up"}
        </button>
        <button type="button" onClick={google} className="rounded-md border px-4 py-2 hover:bg-muted">
          Continue with Google
        </button>
        <div className="flex items-center justify-between text-sm">
          <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="opacity-70 hover:underline">
            {mode === "signin" ? "Create an account" : "Have an account? Sign in"}
          </button>
          <button type="button" onClick={resetPassword} className="opacity-70 hover:underline">
            Forgot password?
          </button>
        </div>
      </div>
    </div>
  );
}
