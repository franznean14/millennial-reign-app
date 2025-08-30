"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AuthButtons() {
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback`;
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    setLoading(false);
  };

    // Sign-out moved to Account page header; hide it in top bar

  if (signedIn === null) return null;

  return (
    <div className="flex items-center gap-2">
      {signedIn ? null : (
        <button
          className="px-3 py-1.5 rounded-md bg-black text-white dark:bg-white dark:text-black text-sm"
          onClick={signInWithGoogle}
          disabled={loading}
        >
          {loading ? "Redirecting..." : "Sign in with Google"}
        </button>
      )}
    </div>
  );
}
