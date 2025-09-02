"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FieldServiceModal } from "./FieldServiceModal";
import { Button } from "@/components/ui/button";
import { FilePlus2 } from "lucide-react";

export function FloatingAddFS() {
  const [userId, setUserId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
  
  return (
    <>
      {/* Floating Action Button - same positioning as other floating buttons */}
      <Button
        onClick={() => setModalOpen(true)}
        className="fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px]"
        size="lg"
      >
        <FilePlus2 className="h-6 w-6" />
      </Button>

      {/* Field Service Modal - unchanged from your existing design */}
      <FieldServiceModal userId={userId} />
    </>
  );
}
