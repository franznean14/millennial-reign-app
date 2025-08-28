"use client";

import { useEffect, useState } from "react";
import { ProfileForm } from "@/components/user/ProfileForm";
// import { MonthlyRecordForm } from "@/components/user/MonthlyRecordForm";
// import { MonthlyRecordsList } from "@/components/user/MonthlyRecordsList";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ProfileView } from "@/components/user/ProfileView";
import { getProfile } from "@/lib/db/profiles";
import type { Profile } from "@/lib/db/types";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { EditAccountDialog } from "@/components/account/EditAccountDialog";
import { PasswordDialog } from "@/components/account/PasswordDialog";
import { BiometricToggle } from "@/components/account/BiometricToggle";

export function AccountClient({ userId, initialEmail }: { userId?: string; initialEmail?: string | null }) {
  const [uid, setUid] = useState<string | null>(userId ?? null);
  const [email, setEmail] = useState<string | null | undefined>(initialEmail);
  const [refreshKey, setRefreshKey] = useState(0);
  const [authReady, setAuthReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState<boolean>(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setAuthReady(true);
      if (!uid) setUid(data.session?.user?.id ?? null);
      if (!email) setEmail(data.session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setAuthReady(true);
      setUid(session?.user?.id ?? null);
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!uid) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    let mounted = true;
    setProfileLoading(true);
    (async () => {
      try {
        const p = await getProfile(uid);
        if (mounted) setProfile(p);
        // Detect if user has a password identity.
        const supabase = createSupabaseBrowserClient();
        const { data: sess } = await supabase.auth.getSession();
        const u: any = sess.session?.user;
        if (!u) {
          if (mounted) setHasPassword(false);
        } else {
          // First: derive from identities/providers immediately
          const identities = Array.isArray(u.identities) ? u.identities : [];
          const providers = Array.isArray(u.app_metadata?.providers) ? u.app_metadata.providers : [];
          const hasEmailProvider = identities.some((i: any) => (i?.provider || "") === "email") || providers.includes("email") || (u.app_metadata?.provider === "email");
          if (hasEmailProvider) {
            if (mounted) setHasPassword(true);
          } else {
            // Online: confirm via RPCs; Offline: rely on local flag
            let hasPwd = localStorage.getItem("has_password") === "1";
            if (navigator.onLine) {
              try {
                const { data: direct } = await supabase.rpc("has_encrypted_password");
                if (direct === true) hasPwd = true; else {
                  const { data: byIdent } = await supabase.rpc("has_password_auth");
                  hasPwd = !!byIdent;
                }
              } catch {}
            }
            if (mounted) setHasPassword(hasPwd);
          }
        }
      } finally {
        if (mounted) setProfileLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [authReady, uid, refreshKey]);

  if (!authReady) {
    return <div className="text-sm opacity-70">Preparing your session…</div>;
  }

  return (
    <div className="space-y-6">
      <ProfileView userId={uid ?? undefined} email={email ?? undefined} onEdit={() => setEditing(true)} profile={profile} />

      {/* Account overview (labels only) */}
      <section className="rounded-md border p-4 space-y-3">
        <h2 className="text-base font-medium">Account</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-0.5 text-sm">
            <span className="opacity-70">Email</span>
            <span className="font-medium break-all">{email || "Not set"}</span>
          </div>
          <div className="grid gap-0.5 text-sm">
            <span className="opacity-70">Username</span>
            <span className="font-medium">{(profile as any)?.username || "Not set"}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {!!uid && (
            <button className="rounded-md border px-3 py-2 text-sm hover:bg-muted" onClick={() => setEditAccountOpen(true)}>
              Edit account
            </button>
          )}
          {!!uid && (
            <button className="rounded-md border px-3 py-2 text-sm hover:bg-muted" onClick={() => setPasswordOpen(true)}>
              {hasPassword ? "Update password" : "Add password"}
            </button>
          )}
        </div>
        <div className="pt-2 border-t">
          <h3 className="text-sm font-medium mb-2">Biometrics</h3>
          <BiometricToggle />
        </div>
      </section>

      <Dialog.Root open={editing && !!uid} onOpenChange={setEditing}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-[min(92vw,640px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-4 shadow-xl max-h-[85dvh] overflow-y-auto overscroll-contain touch-pan-y data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-lg font-semibold">Edit Profile</Dialog.Title>
              <Dialog.Close asChild>
                <button className="rounded-md p-1 hover:bg-muted" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
            <div className="mt-4">
              <ProfileForm
                userId={uid!}
                initialEmail={email}
                initialProfile={profile}
                onSaved={(p) => {
                  setEditing(false);
                  setProfile(p);
                  setRefreshKey((k) => k + 1);
                }}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Edit Account (email + username) */}
      {!!uid && (
        <EditAccountDialog
          open={editAccountOpen}
          onOpenChange={(o) => {
            setEditAccountOpen(o);
            if (!o) setRefreshKey((k) => k + 1);
          }}
          userId={uid}
          initialEmail={email}
          initialUsername={(profile as any)?.username}
          currentProfile={profile}
        />
      )}

      {/* Password dialog */}
      <PasswordDialog
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        email={email}
        hasPassword={hasPassword}
        onUpdated={() => {
          try {
            localStorage.setItem("has_password", "1");
          } catch {}
          setHasPassword(true);
        }}
      />

      {/* Monthly records removed per request; keep account info only */}
    </div>
  );
}
