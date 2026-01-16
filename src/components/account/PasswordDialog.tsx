"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FormModal } from "@/components/shared/FormModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";

interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string | null;
  hasPassword: boolean;
  onUpdated?: () => void;
}

export function PasswordDialog({ open, onOpenChange, email, hasPassword, onUpdated }: PasswordDialogProps) {
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
        if (window.PasswordCredential) {
          const cred = new window.PasswordCredential({ id: email || "", password: next } as any);
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
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={hasPassword ? "Change Password" : "Add Password"}
      description={hasPassword ? "Change your account password" : "Add a password to your account"}
    >
      <div className="grid gap-3">
        {hasPassword && (
          <div className="grid gap-1 text-sm">
            <label className="opacity-70">Current password</label>
            <Input 
              type="password" 
              value={current} 
              onChange={(e) => setCurrent(e.target.value)} 
              autoComplete="current-password" 
            />
          </div>
        )}
        <div className="grid gap-1 text-sm">
          <label className="opacity-70">New password</label>
          <Input 
            type="password" 
            value={next} 
            onChange={(e) => setNext(e.target.value)} 
            autoComplete="new-password" 
          />
        </div>
        <div className="grid gap-1 text-sm">
          <label className="opacity-70">Confirm new password</label>
          <Input 
            type="password" 
            value={confirm} 
            onChange={(e) => setConfirm(e.target.value)} 
            autoComplete="new-password" 
          />
        </div>
        <div className="text-xs opacity-70">
          <button type="button" onClick={forgot} className="underline hover:opacity-100">
            Forgot password?
          </button>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button 
          onClick={submit} 
          disabled={saving || !next || !confirm}
        >
          {saving ? "Saving…" : hasPassword ? "Change Password" : "Add Password"}
        </Button>
      </div>
    </FormModal>
  );
}
