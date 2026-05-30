"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
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
import { FabMenu } from "@/components/shared/FabMenu";
import { ChevronRight, MapPin, SquarePen } from "lucide-react";
import { cn } from "@/lib/utils";
import { studyBibleDarkClasses, getStudyBibleDarkCardShade } from "@/lib/theme/study-bible-dark";

type AccountTab = "profile" | "account";

function AccountDetailField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p
        className={cn(
          "text-[11px] font-semibold uppercase tracking-[0.08em]",
          studyBibleDarkClasses.muted
        )}
      >
        {label}
      </p>
      <div className="text-sm leading-relaxed text-foreground dark:text-[#fffaff]">{children}</div>
    </div>
  );
}

function AccountContentCard({
  title,
  children,
  className,
  shadeKey,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
  shadeKey: string;
}) {
  return (
    <article
      className={cn(
        "min-w-0 overflow-hidden rounded-xl border shadow-md",
        studyBibleDarkClasses.bwiCard,
        getStudyBibleDarkCardShade(shadeKey),
        className
      )}
    >
      {title ? (
        <div
          className={cn(
            "border-b px-4 py-3",
            studyBibleDarkClasses.divider,
            studyBibleDarkClasses.laneTitleBar
          )}
        >
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-foreground dark:text-[#fffaff]">
            {title}
          </h2>
        </div>
      ) : null}
      <div className="space-y-4 p-4">{children}</div>
    </article>
  );
}

interface AccountSectionProps {
  userId: string;
  profile: any;
  canEditPrivilegesAndBwi: boolean;
  canEditPioneerPrivilegesOnly: boolean;
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
  canEditPrivilegesAndBwi,
  canEditPioneerPrivilegesOnly,
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
  getSupabaseClient,
}: AccountSectionProps) {
  const fullName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "User";
  const initials = profile ? `${profile.first_name?.[0] || ""}${profile.last_name?.[0] || ""}`.toUpperCase() : "U";

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <SectionShell
      motionKey="account"
      className="space-y-6 pb-[calc(max(env(safe-area-inset-bottom),0px)+88px)] pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+80px)] md:pb-20 md:pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+80px)]"
    >
        <div className="space-y-4 md:mx-auto md:max-w-6xl md:space-y-6 md:p-4">
          {accountTab === "profile" ? (
            <div className="space-y-4 md:grid md:grid-cols-2 md:items-start md:gap-4 md:space-y-0">
              <AccountContentCard shadeKey="account:profile-card">
                <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-start md:text-left">
                  <Avatar className="h-20 w-20 shrink-0 md:h-20 md:w-20">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={fullName} />
                    <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 w-full flex-1">
                    <h1 className="text-xl font-semibold leading-tight md:text-2xl">{fullName}</h1>
                    {profile?.username ? (
                      <p className={cn("mt-1 text-sm", studyBibleDarkClasses.muted)}>@{profile.username}</p>
                    ) : null}
                    {(profile?.group_name || (profile?.privileges?.length ?? 0) > 0) ? (
                      <div className="mt-3 flex flex-wrap justify-center gap-1.5 md:justify-start">
                        {profile?.group_name ? (
                          <Badge variant="outline" className="text-xs">
                            {profile.group_name}
                          </Badge>
                        ) : null}
                        {profile?.privileges?.map((privilege: string) => (
                          <Badge key={privilege} variant="secondary" className="text-xs">
                            {privilege}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                {profile?.date_of_birth || profile?.date_of_baptism || profile?.gender ? (
                  <>
                    <Separator className={studyBibleDarkClasses.divider} />
                    <div className="grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-2">
                      {profile?.date_of_birth ? (
                        <AccountDetailField label="Date of Birth">
                          {formatDate(profile.date_of_birth)}
                        </AccountDetailField>
                      ) : null}
                      {profile?.date_of_baptism ? (
                        <AccountDetailField label="Date of Baptism">
                          {formatDate(profile.date_of_baptism)}
                        </AccountDetailField>
                      ) : null}
                      {profile?.gender ? (
                        <div className="col-span-2 md:col-span-1">
                          <AccountDetailField label="Gender">
                            <span className="capitalize">{profile.gender}</span>
                          </AccountDetailField>
                        </div>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </AccountContentCard>

              <AccountContentCard shadeKey="account:contact" title="Contact Information">
                {profile?.phone_number || profile?.address ? (
                  <div className="grid gap-4">
                    {profile?.phone_number ? (
                      <AccountDetailField label="Phone">
                        <a
                          href={`tel:${profile.phone_number.replace(/\s/g, "")}`}
                          className="break-all hover:underline"
                        >
                          {profile.phone_number}
                        </a>
                      </AccountDetailField>
                    ) : null}
                    {profile?.address ? (
                      <AccountDetailField label="Address">
                        <p className="whitespace-pre-line leading-relaxed">
                          {profile.address.split(",").map((line: string) => line.trim()).join("\n")}
                        </p>
                      </AccountDetailField>
                    ) : null}
                    {profile?.address_latitude && profile?.address_longitude ? (
                      <Button variant="outline" size="sm" className="w-full md:w-auto" asChild>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${profile.address_latitude},${profile.address_longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <MapPin className="h-4 w-4 shrink-0" />
                          Get Directions
                        </a>
                      </Button>
                    ) : null}
                  </div>
                ) : (
                  <p className={cn("text-sm leading-relaxed", studyBibleDarkClasses.muted)}>
                    No contact information yet. Use Edit Profile to add a phone number and address.
                  </p>
                )}
              </AccountContentCard>
            </div>
          ) : (
            <div className="space-y-4 md:grid md:grid-cols-3 md:items-start md:gap-4 md:space-y-0">
              <AccountContentCard shadeKey="account:settings" title="Account Settings">
                <div className="grid gap-4">
                  <AccountDetailField label="Email">{profile?.email || "Not set"}</AccountDetailField>
                  {profile?.username ? (
                    <AccountDetailField label="Username">@{profile.username}</AccountDetailField>
                  ) : null}
                  {profile?.time_zone ? (
                    <AccountDetailField label="Time Zone">{profile.time_zone}</AccountDetailField>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:flex-wrap">
                  {!!userId ? (
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEditAccountOpen(true)}>
                      Edit Account
                    </Button>
                  ) : null}
                  {!!userId ? (
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => setPasswordOpen(true)}>
                      {hasPassword ? "Edit Password" : "Add Password"}
                    </Button>
                  ) : null}
                </div>
              </AccountContentCard>

              <AccountContentCard shadeKey="account:notifications" title="Notifications">
                <NotificationSettings />
              </AccountContentCard>

              <AccountContentCard shadeKey="account:security" title="Security & Legal" className="md:col-span-1">
                <div className="space-y-5">
                  <div className="space-y-3">
                    <p
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-[0.08em]",
                        studyBibleDarkClasses.muted
                      )}
                    >
                      Security
                    </p>
                    <BiometricToggle />
                  </div>
                  <Separator className={studyBibleDarkClasses.divider} />
                  <div className="space-y-2">
                    <p
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-[0.08em]",
                        studyBibleDarkClasses.muted
                      )}
                    >
                      Legal
                    </p>
                    <button
                      type="button"
                      onClick={() => setPrivacyPolicyOpen(true)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                        studyBibleDarkClasses.rowActionButton
                      )}
                    >
                      <span>Privacy Policy</span>
                      <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
                    </button>
                    <p className={cn("text-xs leading-relaxed", studyBibleDarkClasses.subtle)}>
                      Learn how we collect, use, and protect your information.
                    </p>
                  </div>
                </div>
              </AccountContentCard>
            </div>
          )}
        </div>

        <FormModal
          open={editing && !!userId}
          onOpenChange={setEditing}
          title="Edit Profile"
          description="Edit your profile details and preferences"
          desktopPresentation="left-sheet"
          className="md:max-h-[100lvh]"
          drawerDescriptionClassName="text-center"
          skipFabRootInert
        >
          <ProfileForm
            userId={userId!}
            initialEmail={profile?.email}
            initialProfile={profile}
            canEditPrivilegesAndBwi={canEditPrivilegesAndBwi}
            canEditPioneerPrivilegesOnly={canEditPioneerPrivilegesOnly}
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

        {accountTab === "profile" && !!userId && !editing ? (
          <FabMenu
            label="Profile actions"
            actions={[
              {
                label: "Edit Profile",
                icon: <SquarePen className="size-6" />,
                onClick: () => setEditing(true),
              },
            ]}
            mainIcon={<SquarePen className="size-6" />}
          />
        ) : null}
      </SectionShell>
  );
}
