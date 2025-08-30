"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const signOut = async () => {
    const supabase = createSupabaseBrowserClient();
    try { await supabase.auth.signOut(); } catch {}
    try { location.href = "/"; } catch {}
  };
  return (
    <Button variant="outline" size="sm" onClick={signOut} className="gap-1">
      <LogOut className="h-4 w-4" />
      Log out
    </Button>
  );
}
