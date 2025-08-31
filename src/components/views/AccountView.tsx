"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getProfile } from "@/lib/db/profiles";
import type { Profile } from "@/lib/db/types";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EditAccountDialog } from "@/components/account/EditAccountDialog";
import { PasswordDialog } from "@/components/account/PasswordDialog";
import { BiometricToggle } from "@/components/account/BiometricToggle";
import { ProfileForm } from "@/components/account/ProfileForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { LogoutButton } from "@/components/account/LogoutButton";

export function AccountView() {
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [editAccountOpen, setEditAccountOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState<boolean>(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUid(user.id);
          setEmail(user.email);
          try {
            localStorage.setItem("has_password", user.app_metadata?.provider === "email" ? "1" : "0");
            setHasPassword(user.app_metadata?.provider === "email");
          } catch {}
        }
      } catch (error) {
        console.error("Error getting user:", error);
      }
    };

    getUser();
  }, []);

  useEffect(() => {
    if (!uid) return;
    getProfile(uid).then((p) => {
      setProfile(p);
      setProfileLoading(false);
    });
  }, [uid, refreshKey]);

  if (profileLoading) {
    return (
      <motion.div
        key="account"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-muted-foreground">Loading profile...</p>
          </div>
        </div>
      </motion.div>
    );
  }

  const fullName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "User";
  const initials = profile ? `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase() : "U";

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <motion.div
      key="account"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Account</h1>
        <LogoutButton />
      </div>

      <div className="space-y-6 p-4">
        {/* Profile Header */}
        <section className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile?.avatar_url || undefined} alt={fullName} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold">{fullName}</h1>
                {!!uid && (
                  <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                    Edit Profile
                  </Button>
                )}
              </div>
              {profile?.username && (
                <p className="text-sm text-muted-foreground">@{profile.username}</p>
              )}
              {profile?.privileges && profile.privileges.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {profile.privileges.map((privilege) => (
                    <Badge key={privilege} variant="secondary" className="text-xs">
                      {privilege}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Profile Details */}
          <div className="grid gap-3 text-sm">
            {profile?.date_of_birth && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date of Birth:</span>
                <span>{formatDate(profile.date_of_birth)}</span>
              </div>
            )}
            {profile?.date_of_baptism && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date of Baptism:</span>
                <span>{formatDate(profile.date_of_baptism)}</span>
              </div>
            )}
            {profile?.gender && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gender:</span>
                <span className="capitalize">{profile.gender}</span>
              </div>
            )}
          </div>
        </section>

        <Separator />

        {/* Account Settings */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Account Settings</h2>
          
          {/* Basic Account Info */}
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email:</span>
              <span>{email || "Not set"}</span>
            </div>
            {profile?.username && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Username:</span>
                <span>@{profile.username}</span>
              </div>
            )}
            {profile?.time_zone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time Zone:</span>
                <span>{profile.time_zone}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            {!!uid && (
              <Button variant="outline" onClick={() => setEditAccountOpen(true)}>
                Edit Account
              </Button>
            )}
            {!!uid && (
              <Button variant="outline" onClick={() => setPasswordOpen(true)}>
                {hasPassword ? "Change Password" : "Add Password"}
              </Button>
            )}
          </div>
        </section>

        <Separator />

        {/* Biometrics */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold">Security</h3>
          <BiometricToggle />
        </section>

        <ResponsiveModal
          open={editing && !!uid}
          onOpenChange={setEditing}
          title="Edit Profile"
          description="Edit your profile details and preferences"
        >
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
        </ResponsiveModal>

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
      </div>
    </motion.div>
  );
}
