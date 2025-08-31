"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";
import { useSPA } from "@/components/SPAProvider";
import { motion } from "motion/react";

interface LoginFormProps {
  isLoading?: boolean;
}

export function LoginForm({ isLoading = false }: LoginFormProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [identifier, setIdentifier] = useState(""); // email or username
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { refreshAuth } = useSPA(); // Use refreshAuth instead of onSectionChange

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
        // Let the auth state change handle the transition
        refreshAuth();
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
    setGoogleLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      // Use the current page as redirect to maintain SPA flow
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({ 
        provider: "google", 
        options: { 
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        } 
      });
      if (error) throw error;
      // Show loading message since we're redirecting
      toast.success("Redirecting to Google...");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to start Google sign-in");
      setGoogleLoading(false);
    }
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

  const isFormLoading = loading || googleLoading || isLoading;

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <label className="grid gap-1 text-sm">
          <span className="opacity-70">Email or username</span>
          <Input 
            type="text" 
            value={identifier} 
            onChange={(e) => setIdentifier(e.target.value)} 
            autoComplete="username"
            disabled={isFormLoading}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="opacity-70">Password</span>
          <Input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            autoComplete="current-password"
            disabled={isFormLoading}
          />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={isFormLoading || !identifier || !password}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
              />
              Please wait…
            </>
          ) : mode === "signin" ? "Sign In" : "Sign Up"}
        </button>
        <button 
          type="button" 
          onClick={google} 
          disabled={isFormLoading}
          className="rounded-md border px-4 py-2 hover:bg-muted disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {googleLoading ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-4 h-4 border-2 border-current border-t-transparent rounded-full"
              />
              Redirecting to Google...
            </>
          ) : (
            "Continue with Google"
          )}
        </button>
        <div className="flex items-center justify-between text-sm">
          <button 
            type="button" 
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")} 
            disabled={isFormLoading}
            className="opacity-70 hover:underline disabled:opacity-30"
          >
            {mode === "signin" ? "Create an account" : "Have an account? Sign in"}
          </button>
          <button 
            type="button" 
            onClick={resetPassword} 
            disabled={isFormLoading}
            className="opacity-70 hover:underline disabled:opacity-30"
          >
            Forgot password?
          </button>
        </div>
      </div>
    </div>
  );
}
