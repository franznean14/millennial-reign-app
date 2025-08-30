"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    // Ensure any recovery session in URL is processed
    supabase.auth.getSession().then(() => setReady(true));
  }, []);

  const submit = async () => {
    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated");
      window.location.href = "/";
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update password");
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return <div className="text-sm opacity-70">Preparing…</div>;

  return (
    <div className="mx-auto max-w-sm w-full py-8">
      <h1 className="text-xl font-semibold mb-4">Reset Password</h1>
      <label className="grid gap-1 text-sm">
        <span className="opacity-70">New password</span>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </label>
      <div className="mt-4">
        <button disabled={!password || saving} onClick={submit} className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
          {saving ? "Updating…" : "Update Password"}
        </button>
      </div>
    </div>
  );
}
