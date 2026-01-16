"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Loader2, LogOut } from "lucide-react";
import { useSPA } from "@/components/SPAProvider";

export function LogoutButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const [loading, setLoading] = useState(false);
  const { onSectionChange, refreshAuth } = useSPA();

  const handleLogout = async () => {
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      toast.success("Signed out successfully");
      
      // Refresh authentication state to hide navigation
      refreshAuth();
      
      // Navigate to login
      onSectionChange('login');
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error("Failed to sign out");
    } finally {
      setLoading(false);
    }
  };

  if (iconOnly) {
    return (
      <Button
        variant="ghost"
        onClick={handleLogout}
        disabled={loading}
        size="icon"
        aria-label={loading ? "Signing out" : "Sign out"}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      </Button>
    );
  }

  return (
    <Button variant="outline" onClick={handleLogout} disabled={loading} size="sm">
      <LogOut className="h-4 w-4 mr-2" />
      {loading ? "Signing out..." : "Sign out"}
    </Button>
  );
}
