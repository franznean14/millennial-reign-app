import { AccountClient } from "@/components/account/AccountClient";
import LogoutButton from "@/components/account/LogoutButton";

export default async function AccountPage() {
  // Do not query Supabase on the server to support true offline rendering.
  // Client will hydrate session from local storage and load cached profile.
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Account</h1>
        <LogoutButton />
      </div>
      <AccountClient />
    </div>
  );
}
