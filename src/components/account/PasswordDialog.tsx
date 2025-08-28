"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/sonner";

export function PasswordDialog({ open, onOpenChange, email, hasPassword, onUpdated }: { open: boolean; onOpenChange: (o: boolean) => void; email?: string | null; hasPassword: boolean; onUpdated?: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setCurrent("");
      setNext("");
      setConfirm("");
    }
  }, [open]);

  const submit = async () => {
    if (!next || next !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    try {
      if (hasPassword) {
        // Re-verify current password
        if (!email) throw new Error("Email required to verify current password");
        const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: current });
        if (signErr) throw new Error("Current password is incorrect");
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      toast.success("Password updated");
      try {
        localStorage.setItem("has_password", "1");
      } catch {}
      try {
        // Offer storing credentials in password manager
        // @ts-ignore
        if (window.PasswordCredential) {
          const cred = new window.PasswordCredential({ id: email || "", password: next } as any);
          // @ts-ignore
          await navigator.credentials.store(cred);
        }
      } catch {}
      onOpenChange(false);
      try { onUpdated?.(); } catch {}
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  const forgot = async () => {
    if (!email) {
      toast.error("Add your email first");
      return;
    }
    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      toast.success("Reset link sent");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send reset email");
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-4 shadow-xl max-h-[85dvh] overflow-y-auto overscroll-contain touch-pan-y data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">{hasPassword ? "Change password" : "Add password"}</Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-md p-1 hover:bg-muted" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="mt-4 grid gap-3">
            {hasPassword && (
              <label className="grid gap-1 text-sm">
                <span className="opacity-70">Current password</span>
                <input className="rounded-md border bg-background px-3 py-2" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
              </label>
            )}
            <label className="grid gap-1 text-sm">
              <span className="opacity-70">New password</span>
              <input className="rounded-md border bg-background px-3 py-2" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="opacity-70">Confirm new password</span>
              <input className="rounded-md border bg-background px-3 py-2" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </label>
            <div className="text-xs opacity-70">
              <button type="button" onClick={forgot} className="underline hover:opacity-100">Forgot password?</button>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button className="rounded-md border px-3 py-2 text-sm">Cancel</button>
            </Dialog.Close>
            <button onClick={submit} disabled={saving || !next || !confirm} className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
              {saving ? "Saving…" : hasPassword ? "Update password" : "Add password"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
