"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { upsertProfile, getProfile } from "@/lib/db/profiles";
import type { Profile } from "@/lib/db/types";
import { toast } from "@/components/ui/sonner";

export function EditAccountDialog({ open, onOpenChange, userId, initialEmail, initialUsername, currentProfile }: { open: boolean; onOpenChange: (o: boolean) => void; userId: string; initialEmail?: string | null; initialUsername?: string | null | undefined; currentProfile?: Profile | null }) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [username, setUsername] = useState(initialUsername ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEmail(initialEmail ?? "");
    setUsername(initialUsername ?? "");
  }, [initialEmail, initialUsername, open]);

  const save = async () => {
    setSaving(true);
    try {
      const supabase = createSupabaseBrowserClient();
      // Update email if changed
      if (email && email !== initialEmail) {
        const { error } = await supabase.auth.updateUser({ email });
        if (error) throw error;
        toast.success("Email update sent. Confirm via email.");
      }
      // Update username via profile upsert — preserve existing profile fields
      let base = currentProfile as Profile | null | undefined;
      if (!base) {
        base = await getProfile(userId);
      }
      const payload: any = {
        id: userId,
        first_name: base?.first_name ?? "",
        last_name: base?.last_name ?? "",
        middle_name: base?.middle_name ?? null,
        date_of_birth: base?.date_of_birth ?? null,
        date_of_baptism: base?.date_of_baptism ?? null,
        privileges: base?.privileges ?? [],
        avatar_url: base?.avatar_url ?? null,
        time_zone: (base as any)?.time_zone ?? null,
        username: username ?? null,
      };
      await upsertProfile(payload);
      toast.success("Account updated");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update account");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-4 shadow-xl max-h-[85dvh] overflow-y-auto overscroll-contain touch-pan-y data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">Edit Account</Dialog.Title>
            <Dialog.Close asChild>
              <button className="rounded-md p-1 hover:bg-muted" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>
          <div className="mt-4 grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="opacity-70">Email address</span>
              <input className="rounded-md border bg-background px-3 py-2" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="opacity-70">Username</span>
              <input
                className="rounded-md border bg-background px-3 py-2"
                value={username ?? ""}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_.-]/g, ""))}
                placeholder="Not set"
              />
              <span className="text-[11px] opacity-60">Letters, numbers, dot, underscore, hyphen</span>
            </label>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button className="rounded-md border px-3 py-2 text-sm">Cancel</button>
            </Dialog.Close>
            <button onClick={save} disabled={saving} className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
