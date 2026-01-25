"use client";

import type { Dispatch, SetStateAction } from "react";
import { SectionShell } from "@/components/shared/SectionShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { NotificationSettings } from "@/components/account/NotificationSettings";
import { BiometricToggle } from "@/components/account/BiometricToggle";
import { ProfileForm } from "@/components/account/ProfileForm";
import { EditAccountForm } from "@/components/account/EditAccountForm";
import { PasswordForm } from "@/components/account/PasswordForm";
import { FormModal } from "@/components/shared/FormModal";
import { ChevronRight, MapPin } from "lucide-react";

type AccountTab = "profile" | "account";

interface AccountSectionProps {
  userId: string;
  profile: any;
  accountTab: AccountTab;
  setAccountTab: Dispatch<SetStateAction<AccountTab>>;
  editing: boolean;
  setEditing: Dispatch<SetStateAction<boolean>>;
  editAccountOpen: boolean;
  setEditAccountOpen: Dispatch<SetStateAction<boolean>>;
  passwordOpen: boolean;
  setPasswordOpen: Dispatch<SetStateAction<boolean>>;
  privacyPolicyOpen: boolean;
  setPrivacyPolicyOpen: Dispatch<SetStateAction<boolean>>;
  hasPassword: boolean;
  setHasPassword: Dispatch<SetStateAction<boolean>>;
  bwiEnabled: boolean;
  isBwiParticipant: boolean;
  setIsBwiParticipant: Dispatch<SetStateAction<boolean>>;
  setProfile: Dispatch<SetStateAction<any>>;
  getSupabaseClient: () => Promise<any>;
}

export function AccountSection({
  userId,
  profile,
  accountTab,
  setAccountTab,
  editing,
  setEditing,
  editAccountOpen,
  setEditAccountOpen,
  passwordOpen,
  setPasswordOpen,
  privacyPolicyOpen,
  setPrivacyPolicyOpen,
  hasPassword,
  setHasPassword,
  bwiEnabled,
  isBwiParticipant,
  setIsBwiParticipant,
  setProfile,
  getSupabaseClient
}: AccountSectionProps) {
  const fullName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "User";
  const initials = profile ? `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase() : "U";

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <SectionShell motionKey="account" className="space-y-6 pb-20 pt-[60px]">
        <div className="space-y-6 p-4">
          {accountTab === "profile" ? (
            <>
              <section className="space-y-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={fullName} />
                    <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h1 className="text-xl font-semibold">{fullName}</h1>
                      {!!userId && (
                        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                          Edit Profile
                        </Button>
                      )}
                    </div>
                    {profile?.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {profile?.group_name && (
                        <Badge variant="outline" className="text-xs">
                          {profile.group_name}
                        </Badge>
                      )}
                      {profile?.privileges?.length > 0 &&
                        profile.privileges.map((privilege: string) => (
                          <Badge key={privilege} variant="secondary" className="text-xs">
                            {privilege}
                          </Badge>
                        ))}
                    </div>
                  </div>
                </div>

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

              <section className="space-y-4">
                <h2 className="text-lg font-semibold">Contact Information</h2>
                <div className="grid gap-3 text-sm">
                  {profile?.phone_number && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone:</span>
                      <span>{profile.phone_number}</span>
                    </div>
                  )}
                  {profile?.address && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Address:</span>
                      <div className="text-right text-sm leading-relaxed">
                        {profile.address.split(",").map((line: string, index: number) => (
                          <div key={index} className={index > 0 ? "text-muted-foreground" : ""}>
                            {line.trim()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile?.address_latitude && profile?.address_longitude && (
                    <div className="flex justify-end">
                      <a
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs whitespace-nowrap hover:bg-muted"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${profile.address_latitude},${profile.address_longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        Get Directions
                      </a>
                    </div>
                  )}
                  {!profile?.phone_number && !profile?.address && (
                    <div className="text-sm text-muted-foreground">
                      No contact information available. Edit your profile to add phone number and address.
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : (
            <>
              <section className="space-y-4">
                <h2 className="text-lg font-semibold">Account Settings</h2>
                <div className="grid gap-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email:</span>
                    <span>{profile?.email || "Not set"}</span>
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

                <div className="flex flex-wrap gap-2">
                  {!!userId && (
                    <Button variant="outline" onClick={() => setEditAccountOpen(true)}>
                      Edit Account
                    </Button>
                  )}
                  {!!userId && (
                    <Button variant="outline" onClick={() => setPasswordOpen(true)}>
                      {hasPassword ? "Edit Password" : "Add Password"}
                    </Button>
                  )}
                </div>
              </section>

              <Separator />

              <section className="space-y-4">
                <h3 className="text-lg font-semibold">Notifications</h3>
                <NotificationSettings />
              </section>

              <Separator />

              <section className="space-y-4">
                <h3 className="text-lg font-semibold">Security</h3>
                <BiometricToggle />
              </section>

              <Separator />

              <section className="space-y-4">
                <h3 className="text-lg font-semibold">Legal</h3>
                <div className="text-sm text-muted-foreground">
                  <button
                    onClick={() => setPrivacyPolicyOpen(true)}
                    className="flex items-center gap-2 text-primary hover:underline hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 -my-1 transition-colors"
                  >
                    <span>Learn more</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <p className="mt-1">Learn how we collect, use, and protect your information.</p>
                </div>
              </section>
            </>
          )}
        </div>

        <FormModal
          open={editing && !!userId}
          onOpenChange={setEditing}
          title="Edit Profile"
          description="Edit your profile details and preferences"
        >
          <ProfileForm
            userId={userId!}
            initialEmail={profile?.email}
            initialProfile={profile}
            bwiEnabled={bwiEnabled}
            isBwiParticipant={isBwiParticipant}
            onBwiToggle={async () => {
              const supabase = await getSupabaseClient();
              const { data, error } = await supabase.rpc("toggle_user_business_participation", { target_user_id: userId });
              if (error) throw error;
              setIsBwiParticipant(!!data);
              return !!data;
            }}
            onSaved={(p) => {
              setEditing(false);
              setProfile((prev: any) => ({ ...p, email: prev?.email }));
            }}
          />
        </FormModal>

        {!!userId && (
          <FormModal
            open={editAccountOpen}
            onOpenChange={(o) => {
              setEditAccountOpen(o);
            }}
            title="Edit Account"
            description="Update your email, username, and timezone"
          >
            <EditAccountForm
              userId={userId}
              initialEmail={profile?.email}
              initialUsername={(profile as any)?.username}
              currentProfile={profile}
              onSaved={() => setEditAccountOpen(false)}
            />
          </FormModal>
        )}

        <FormModal
          open={passwordOpen}
          onOpenChange={(open) => {
            setPasswordOpen(open);
            // Refresh password status when opening the modal
            if (open && userId) {
              const checkPasswordStatus = async () => {
                try {
                  const supabase = await getSupabaseClient();
                  const { data: hasPasswordAuth } = await supabase.rpc("has_password_auth");
                  if (hasPasswordAuth === true) {
                    localStorage.setItem("has_password", "1");
                    setHasPassword(true);
                  } else {
                    const stored = localStorage.getItem("has_password");
                    setHasPassword(stored === "1");
                  }
                } catch (error) {
                  console.error("Error refreshing password status:", error);
                }
              };
              checkPasswordStatus();
            }
          }}
          title={hasPassword ? "Edit Password" : "Add Password"}
          description={hasPassword ? "Update your account password" : "Add a password to secure your account"}
        >
          <PasswordForm
            email={profile?.email}
            hasPassword={hasPassword}
            onSaved={() => {
              setPasswordOpen(false);
              try {
                localStorage.setItem("has_password", "1");
              } catch {}
              setHasPassword(true);
            }}
          />
        </FormModal>

        <FormModal
          open={privacyPolicyOpen}
          onOpenChange={setPrivacyPolicyOpen}
          title="Privacy Policy"
          description="Learn how we collect, use, and protect your information"
        >
          <div className="space-y-6 max-h-[70vh] overflow-y-auto pb-20">
            <div className="text-sm text-muted-foreground mb-4">Last updated: January 18, 2025</div>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">1. Introduction</h2>
              <p className="text-sm leading-relaxed">
                Welcome to Millennial Reign App. We are committed to protecting your privacy. This Privacy Policy
                explains how we collect, use, disclose, and safeguard your information when you use our mobile
                application (the "App").
              </p>
              <p className="text-sm leading-relaxed">
                Please read this Privacy Policy carefully. If you do not agree with the terms of this Privacy Policy,
                please do not access the App.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">2. Information We Collect</h2>
              <h3 className="text-base font-medium">2.1 Personal Data</h3>
              <p className="text-sm leading-relaxed">
                We collect personal data that you voluntarily provide to us when you register with the App, express an
                interest in obtaining information about us or our products and services, when you participate in
                activities on the App, or otherwise when you contact us.
              </p>
              <ul className="text-sm leading-relaxed space-y-1 ml-4">
                <li>
                  • <strong>Profile Data:</strong> First name, last name, middle name, date of birth, date of baptism,
                  gender, privileges, avatar URL, username, time zone, congregation ID, group name.
                </li>
                <li>
                  • <strong>Contact Information:</strong> Phone number, address, address latitude, address longitude (for
                  emergency contact purposes, visible to congregation elders).
                </li>
                <li>
                  • <strong>Authentication Data:</strong> Email address, password (hashed and never stored in plain text).
                </li>
              </ul>

              <h3 className="text-base font-medium">2.2 Usage Data</h3>
              <p className="text-sm leading-relaxed">
                We automatically collect certain information when you access the App, such as your IP address, browser
                type, operating system, access times, and the pages you have viewed directly before and after accessing
                the App.
              </p>

              <h3 className="text-base font-medium">2.3 Geolocation Data</h3>
              <p className="text-sm leading-relaxed">
                With your explicit permission, we may collect precise location data from your mobile device. This is
                used for features like the "Nearby" filter for establishments and for saving coordinates for your
                address.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">3. How We Use Your Information</h2>
              <p className="text-sm leading-relaxed">
                We use information collected about you via the App for various purposes, including to:
              </p>
              <ul className="text-sm leading-relaxed space-y-1 ml-4">
                <li>• Create and manage your account</li>
                <li>• Provide and maintain the functionality of the App</li>
                <li>• Personalize your experience with the App</li>
                <li>• Enable location-based features (e.g., "Nearby" establishments)</li>
                <li>• Send you push notifications for important updates and assignments</li>
                <li>• Facilitate communication among congregation members and elders</li>
                <li>• Improve our App and services</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">4. Security of Your Information</h2>
              <p className="text-sm leading-relaxed">
                We use administrative, technical, and physical security measures to help protect your personal
                information. While we have taken reasonable steps to secure the personal information you provide to us,
                please be aware that despite our efforts, no security measures are perfect or impenetrable.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">5. Your Rights</h2>
              <p className="text-sm leading-relaxed">
                You have the right to access, update, or delete your personal information at any time through your
                account settings or by contacting us directly.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-lg font-semibold">6. Contact Us</h2>
              <p className="text-sm leading-relaxed">
                If you have questions or comments about this Privacy Policy, please contact us through the app or your
                congregation administrators.
              </p>
            </section>
          </div>
        </FormModal>
      </SectionShell>
  );
}
