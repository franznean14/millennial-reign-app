"use client";

import { useEffect } from "react";

export default function ThemeInit() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme:dark");
      const prefers = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      const isDark = saved ? saved === "true" : !!prefers;
      document.documentElement.classList.toggle("dark", isDark);
    } catch {}
  }, []);
  return null;
}

