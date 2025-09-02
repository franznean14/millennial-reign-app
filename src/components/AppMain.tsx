"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { AppClient } from "./AppClient";
import { LoginView } from "./views/LoginView";
import { AnimatePresence } from "motion/react";
import { Label } from "@/components/ui/label";

interface AppMainProps {
  currentSection: string;
}

export function AppMain({ currentSection }: AppMainProps) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoadingUser, setIsLoadingUser] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id || null);
      setIsLoadingUser(false);
    };

    fetchUser();
  }, []);

  // Show login view if not authenticated
  if (!userId) {
    return <LoginView />;
  }

  // Show loading while user data is loading
  if (isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Render AppClient which manages all the business logic and state
  return (
    <div className="flex-1 overflow-auto">
      <AnimatePresence mode="wait">
        <AppClient currentSection={currentSection} />
      </AnimatePresence>
    </div>
  );
}
