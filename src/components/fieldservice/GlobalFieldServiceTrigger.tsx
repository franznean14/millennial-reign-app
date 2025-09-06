"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { FilePlus2 } from "lucide-react";
import { FieldServiceDrawerDialog } from "@/components/fieldservice/FieldServiceDrawerDialog";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Global floating trigger for the Field Service Drawer/Dialog.
 * - Renders on all views
 * - Stays mounted across SPA section changes to preserve state
 */
export default function GlobalFieldServiceTrigger() {
  const [open, setOpen] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    const supabase = createSupabaseBrowserClient();

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (mounted) setUserId(session?.user?.id ?? null);
      })
      .catch(() => {});

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUserId(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      try {
        sub.subscription.unsubscribe();
      } catch {}
    };
  }, []);

  // Hide when no authenticated user
  if (!userId) return null;

  const triggerLabel = "Field Service";

  return (
    <>
      <Button
        aria-label={triggerLabel}
        title={triggerLabel}
        className="fixed right-4 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:right-6 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation"
        size="lg"
        onClick={() => setOpen(true)}
      >
        <FilePlus2 className="h-6 w-6" />
      </Button>

      <FieldServiceDrawerDialog
        userId={userId}
        open={open}
        onOpenChange={setOpen}
        showTrigger={false}
        triggerLabel={triggerLabel}
      />
    </>
  );
}


