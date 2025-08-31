"use client";

import { useState, useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { HomeView } from "./views/HomeView";
import { BusinessView } from "./views/BusinessView";
import { CongregationView } from "./views/CongregationView";
import { AccountView } from "./views/AccountView";
import { LoginView } from "./views/LoginView";
import { 
  SkeletonHomeView, 
  SkeletonBusinessView, 
  SkeletonCongregationView, 
  SkeletonAccountView 
} from "./views/SkeletonViews";
import { AnimatePresence } from "motion/react";

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

  const renderCurrentSection = () => {
    // Show login view if not authenticated
    if (!userId) {
      return <LoginView />;
    }

    // Show skeleton loading while user data is loading
    if (isLoadingUser) {
      switch (currentSection) {
        case 'home':
          return <SkeletonHomeView />;
        case 'business':
          return <SkeletonBusinessView />;
        case 'congregation':
          return <SkeletonCongregationView />;
        case 'account':
          return <SkeletonAccountView />;
        default:
          return <SkeletonHomeView />;
      }
    }

    // Render actual views
    switch (currentSection) {
      case 'home':
        return (
          <HomeView 
            userId={userId}
          />
        );
      case 'business':
        return <BusinessView />;
      case 'congregation':
        return <CongregationView />;
      case 'account':
        return <AccountView />;
      default:
        return (
          <HomeView 
            userId={userId}
          />
        );
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <AnimatePresence mode="wait">
        {renderCurrentSection()}
      </AnimatePresence>
    </div>
  );
}
