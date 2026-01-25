"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";

interface PasswordFormProps {
  email: string | null;
  hasPassword: boolean;
  onSaved?: () => void;
}

export function PasswordForm({ email, hasPassword, onSaved }: PasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Reset form when hasPassword changes
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }, [hasPassword]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    
    try {
      // If editing existing password, verify current password first
      if (hasPassword) {
        if (!email) {
          throw new Error("Email required to verify current password");
        }
        if (!currentPassword) {
          toast.error("Please enter your current password");
          setSaving(false);
          return;
        }
        const { error: signErr } = await supabase.auth.signInWithPassword({ 
          email, 
          password: currentPassword 
        });
        if (signErr) {
          throw new Error("Current password is incorrect");
        }
      }

      // Update password
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success(hasPassword ? "Password updated successfully" : "Password added successfully");
      
      // Store password indicator
      try {
        localStorage.setItem("has_password", "1");
      } catch {}
      
      // Store credentials in browser password manager
      try {
        if (window.PasswordCredential) {
          const cred = new window.PasswordCredential({ 
            id: email || "", 
            password: newPassword 
          } as any);
          await navigator.credentials.store(cred);
        }
      } catch {}

      // Reset form
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      onSaved?.();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Add your email first");
      return;
    }
    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      toast.success("Password reset link sent to your email");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to send reset email");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 pb-10">
      {hasPassword && (
        <div className="grid gap-2">
          <Label htmlFor="current-password">Current Password</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
            placeholder="Enter your current password"
            required
          />
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="new-password">
          {hasPassword ? "New Password" : "Password"}
        </Label>
        <Input
          id="new-password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
          placeholder={hasPassword ? "Enter your new password" : "Enter a password"}
          required
          minLength={6}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="confirm-password">
          {hasPassword ? "Confirm New Password" : "Confirm Password"}
        </Label>
        <Input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          placeholder={hasPassword ? "Confirm your new password" : "Confirm your password"}
          required
          minLength={6}
        />
      </div>

      {hasPassword && (
        <div className="text-sm">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-muted-foreground hover:text-foreground underline"
          >
            Forgot password?
          </button>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <Button
          type="submit"
          disabled={saving || !newPassword || !confirmPassword || (hasPassword && !currentPassword)}
        >
          {saving ? "Saving..." : hasPassword ? "Update Password" : "Add Password"}
        </Button>
      </div>
    </form>
  );
}
