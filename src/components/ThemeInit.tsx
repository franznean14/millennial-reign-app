"use client";

import { useEffect } from "react";
import { cacheGet, cacheSet } from "@/lib/offline/store";

// Synchronous theme initialization
function initializeTheme() {
  try {
    const saved = localStorage.getItem("theme:dark");
    const prefers = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "true" : !!prefers;
    document.documentElement.classList.toggle("dark", isDark);
  } catch {}
}

// Cache the current theme
async function cacheTheme() {
  try {
    const isDark = document.documentElement.classList.contains("dark");
    await cacheSet("theme:dark", isDark);
    // Always keep localStorage in sync for immediate access
    localStorage.setItem("theme:dark", isDark.toString());
  } catch (error) {
    console.error("Failed to cache theme:", error);
  }
}

// Restore theme from cache
async function restoreThemeFromCache() {
  try {
    const cachedTheme = await cacheGet<boolean>("theme:dark");
    if (cachedTheme !== null) {
      document.documentElement.classList.toggle("dark", cachedTheme);
      // Also update localStorage to keep them in sync
      localStorage.setItem("theme:dark", cachedTheme.toString());
    }
  } catch (error) {
    console.error("Failed to restore theme from cache:", error);
  }
}

export default function ThemeInit() {
  useEffect(() => {
    // Initialize theme immediately on mount
    initializeTheme();

    // Then try to restore from cache (for future sessions)
    restoreThemeFromCache();

    // Cache theme whenever it changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          cacheTheme();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);
  
  return null;
}

// Export the function for immediate use
export { initializeTheme, cacheTheme, restoreThemeFromCache };

