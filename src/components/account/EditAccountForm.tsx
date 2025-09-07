"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import type { Profile } from "@/lib/db/types";
import { PasswordDialog } from "@/components/account/PasswordDialog";

interface EditAccountFormProps {
  userId: string;
  initialEmail: string | null;
  initialUsername: string | null;
  currentProfile: Profile | null;
  onSaved?: (data: { email?: string | null; username?: string | null; time_zone?: string | null }) => void;
}

export function EditAccountForm({ userId, initialEmail, initialUsername, currentProfile, onSaved }: EditAccountFormProps) {
  const [email, setEmail] = useState(initialEmail || "");
  const [username, setUsername] = useState(initialUsername || "");
  const [timeZone, setTimeZone] = useState(currentProfile?.time_zone || "");
  const [saving, setSaving] = useState(false);
  const [hasPassword, setHasPassword] = useState<boolean>(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState<boolean>(false);

  useEffect(() => {
    setEmail(initialEmail || "");
    setUsername(initialUsername || "");
    setTimeZone(currentProfile?.time_zone || "");
  }, [initialEmail, initialUsername, currentProfile?.time_zone]);

  // Detect if the account has an encrypted password (offline-first)
  useEffect(() => {
    try {
      const cached = localStorage.getItem("has_password");
      if (cached === "1") setHasPassword(true);
    } catch {}

    const supabase = createSupabaseBrowserClient();
    // Prefer has_encrypted_password(); fallback to has_password_auth()
    const check = async () => {
      try {
        const { data, error } = await supabase.rpc("has_encrypted_password");
        if (error) throw error;
        const value = Boolean(data);
        setHasPassword(value);
        try { localStorage.setItem("has_password", value ? "1" : "0"); } catch {}
      } catch {
        try {
          const { data, error } = await supabase.rpc("has_password_auth");
          if (error) return;
          const value = Boolean(data);
          setHasPassword(value);
          try { localStorage.setItem("has_password", value ? "1" : "0"); } catch {}
        } catch {}
      }
    };
    check();
  }, []);

  const submit = async () => {
    setSaving(true);
    const supabase = createSupabaseBrowserClient();
    try {
      // Update email if changed
      if (email !== (initialEmail || "")) {
        const { error } = await supabase.auth.updateUser({ email });
        if (error) throw error;
        toast.success("Email update initiated. Check your email to confirm.");
      }

      // Update profile with new username and timezone
      const updates: any = {};
      if (username !== (initialUsername || "")) {
        updates.username = username || null;
      }
      if (timeZone !== (currentProfile?.time_zone || "")) {
        updates.time_zone = timeZone || null;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", userId);
        if (error) throw error;
        toast.success("Account updated successfully");
      }

      onSaved?.({ email, username, time_zone: timeZone });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update account");
    } finally {
      setSaving(false);
    }
  };

  const timeZones = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Anchorage",
    "Pacific/Honolulu",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Tokyo",
    "Asia/Shanghai",
    "Australia/Sydney",
  ];

  return (
    <div className="grid gap-4 pb-10">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
        />
      </div>
      <div className="grid gap-2">
        <Label>Password</Label>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm opacity-75">
            {hasPassword ? "Password set" : "No password set"}
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setPasswordDialogOpen(true)}
          >
            {hasPassword ? "Change Password" : "Add Password"}
          </Button>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="username"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="timezone">Time Zone</Label>
        <Select value={timeZone} onValueChange={setTimeZone}>
          <SelectTrigger>
            <SelectValue placeholder="Select timezone" />
          </SelectTrigger>
          <SelectContent>
            {timeZones.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => submit()} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <PasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        email={email || initialEmail || null}
        hasPassword={hasPassword}
        onUpdated={() => {
          setHasPassword(true);
          try { localStorage.setItem("has_password", "1"); } catch {}
        }}
      />
    </div>
  );
}


