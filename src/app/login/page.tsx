import { LoginForm } from "@/components/auth/LoginForm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  // Offline-first: avoid network. Redirect if Supabase auth cookie is present.
  const cookieStore = await cookies();
  const all = (cookieStore as any).getAll ? (cookieStore as any).getAll() : [];
  const hasAccess = Boolean(
    cookieStore.get("sb-access-token")?.value ||
      cookieStore.get("sb-refresh-token")?.value ||
      all.some((c: any) => typeof c?.name === "string" && /\bsb-.*-auth-token\b/.test(c.name) && !!c.value)
  );
  if (hasAccess) redirect("/");
  return (
    <div className="mx-auto max-w-sm w-full py-8">
      <h1 className="text-2xl font-semibold mb-4">Welcome</h1>
      <LoginForm />
    </div>
  );
}
