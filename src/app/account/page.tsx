import { AccountClient } from "@/components/account/AccountClient";

export default async function AccountPage() {
  // Do not query Supabase on the server to support true offline rendering.
  // Client will hydrate session from local storage and load cached profile.
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Account</h1>
      <AccountClient />
    </div>
  );
}
