"use client";

import { useEffect, useRef, useState } from "react";
import { Moon, Sun, Palette, Laptop } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function applyTone(tone: string) {
  const r = document.documentElement;
  const s = r.style as CSSStyleDeclaration & { setProperty: (k:string,v:string)=>void };
  // Reset overrides first
  s.removeProperty("--primary");
  s.removeProperty("--accent");
  s.removeProperty("--secondary");
  s.removeProperty("--muted");
  s.removeProperty("--border");
  s.removeProperty("--input");
  if (tone === "default") return;
  // Very conservative neutral presets (OKLCH)
  if (tone === "gray") {
    s.setProperty("--primary", "oklch(0.28 0 0)");
    s.setProperty("--accent", "oklch(0.95 0 0)");
    s.setProperty("--secondary", "oklch(0.92 0 0)");
    s.setProperty("--muted", "oklch(0.94 0 0)");
    s.setProperty("--border", "oklch(0.9 0 0)");
    s.setProperty("--input", "oklch(0.9 0 0)");
  }
  if (tone === "zinc") {
    s.setProperty("--primary", "oklch(0.32 0 0)");
    s.setProperty("--accent", "oklch(0.93 0 0)");
    s.setProperty("--secondary", "oklch(0.9 0 0)");
    s.setProperty("--muted", "oklch(0.92 0 0)");
    s.setProperty("--border", "oklch(0.88 0 0)");
    s.setProperty("--input", "oklch(0.88 0 0)");
  }
}

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [open, setOpen] = useState(false);
  const longTimer = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("theme:dark");
    const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = saved ? saved === "true" : prefers;
    document.documentElement.classList.toggle("dark", isDark);
    setDark(isDark);
    const tone = localStorage.getItem("theme:tone") || "default";
    applyTone(tone);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme:dark", String(next));
  };

  const scheduleOpen = () => {
    if (longTimer.current) window.clearTimeout(longTimer.current);
    longTimer.current = window.setTimeout(() => setOpen(true), 500);
  };
  const cancelOpen = () => {
    if (longTimer.current) window.clearTimeout(longTimer.current);
    longTimer.current = null;
  };

  const setTone = (t: string) => {
    applyTone(t);
    localStorage.setItem("theme:tone", t);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          onClick={toggle}
          onPointerDown={scheduleOpen}
          onPointerUp={cancelOpen}
          onPointerLeave={cancelOpen}
          aria-label="Toggle theme"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm bg-white/80 dark:bg-black/30 backdrop-blur border-black/10 dark:border-white/20"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          <span className="hidden sm:inline">{dark ? "Light" : "Dark"}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuLabel className="flex items-center gap-2"><Palette className="h-4 w-4"/>Theme</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => { localStorage.removeItem("theme:dark"); setDark(window.matchMedia("(prefers-color-scheme: dark)").matches); document.documentElement.classList.toggle("dark", window.matchMedia("(prefers-color-scheme: dark)").matches); }}>
          <Laptop className="h-4 w-4"/> System
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setDark(false); document.documentElement.classList.remove("dark"); localStorage.setItem("theme:dark","false"); }}>Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setDark(true); document.documentElement.classList.add("dark"); localStorage.setItem("theme:dark","true"); }}>Dark</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Neutral tone</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTone("default")}>Default</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTone("gray")}>Gray</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTone("zinc")}>Zinc</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
