"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cacheSet } from "@/lib/offline/store";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Initialize theme state
    const updateTheme = () => {
      const dark = document.documentElement.classList.contains("dark");
      setIsDark(dark);
    };

    updateTheme();

    // Listen for theme changes
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  const toggleTheme = async () => {
    const newDark = !isDark;
    document.documentElement.classList.toggle("dark", newDark);
    localStorage.setItem("theme:dark", newDark.toString());
    setIsDark(newDark);

    // Cache the new theme
    try {
      await cacheSet("theme:dark", newDark);
    } catch (error) {
      console.error("Failed to cache theme:", error);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      className="h-9 w-9"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
