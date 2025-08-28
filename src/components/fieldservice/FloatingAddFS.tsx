"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FieldServiceModal } from "./FieldServiceModal";

export function FloatingAddFS() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    // Prefer local session; avoid network when offline
    supabase.auth
      .getSession()
      .then(({ data }) => setUserId(data.session?.user?.id ?? null))
      .catch(() => {});
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setUserId(session?.user?.id ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!userId) return null;
  return <FieldServiceModal userId={userId} />;
}
