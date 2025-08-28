"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/sonner";

export function AccountSecurity({ currentEmail }: { currentEmail?: string | null }) {
  const [email, setEmail] = useState(currentEmail ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const updateEmail = async () => {
    if (!email) return;
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      toast.success("Email update sent. Check your inbox to confirm.");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update email");
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async () => {
    if (!newPassword || newPassword !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated");
      try {
        // Offer storing credentials in browser password manager
        // @ts-ignore
        if (window.PasswordCredential) {
          const cred = new window.PasswordCredential({ id: email || (await supabase.auth.getUser()).data.user?.email || "", password: newPassword } as any);
          // @ts-ignore
          await navigator.credentials.store(cred);
        }
      } catch {}
      setNewPassword("");
      setConfirm("");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async () => {
    if (!email) {
      toast.error("Enter your email above first");
      return;
    }
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      toast.success("Password reset link sent");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-md border p-4 space-y-4">
      <h2 className="text-base font-medium">Security</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="opacity-70">Email</span>
          <input className="rounded-md border bg-background px-3 py-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <button type="button" onClick={updateEmail} disabled={loading || !email} className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
            Update email
          </button>
          <button type="button" onClick={forgotPassword} disabled={loading || !email} className="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
            Forgot password
          </button>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="opacity-70">New password</span>
          <input className="rounded-md border bg-background px-3 py-2" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="opacity-70">Confirm new password</span>
          <input className="rounded-md border bg-background px-3 py-2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
        </label>
        <div className="sm:col-span-2">
          <button type="button" onClick={updatePassword} disabled={loading || !newPassword || !confirm} className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
            Update password
          </button>
        </div>
      </div>
      <div className="pt-2 border-t">
        <h3 className="text-sm font-medium mb-2">Biometrics</h3>
        {/* Lazy import to avoid SSR issues is unnecessary here */}
        {require("react").createElement(require("@/components/account/BiometricToggle").BiometricToggle)}
      </div>
    </section>
  );
}
