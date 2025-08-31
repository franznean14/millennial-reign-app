"use client";

import { AppMain } from "@/components/AppMain";
import { useSPA } from "@/components/SPAProvider";
import ThemeInit, { initializeTheme } from "@/components/ThemeInit";

// Initialize theme immediately when this module loads
if (typeof window !== 'undefined') {
  initializeTheme();
}

export default function Home() {
  const { currentSection, isAuthenticated } = useSPA();

  return (
    <>
      <ThemeInit />
      <AppMain currentSection={!isAuthenticated ? 'login' : currentSection} />
    </>
  );
}
