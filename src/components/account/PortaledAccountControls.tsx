"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { AccountTabToggle } from "./AccountTabToggle";

interface PortaledAccountControlsProps {
  accountTab: 'profile' | 'account';
  onAccountTabChange: (tab: 'profile' | 'account') => void;
  isVisible: boolean;
}

export function PortaledAccountControls({
  accountTab,
  onAccountTabChange,
  isVisible
}: PortaledAccountControlsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed z-[100] space-y-3 px-4 ${
        typeof window !== 'undefined' && window.innerWidth >= 1024 
          ? 'left-64 right-0' // Desktop: start after sidebar (16rem = 256px = 64 in Tailwind)
          : 'left-0 right-0' // Mobile: full width
      }`}
      style={{
        top: typeof window !== 'undefined' && window.innerWidth >= 1024 ? 100 : 10 // Lower on desktop, normal on mobile
      }}
    >
      {/* Tab Navigation */}
      <div className="w-full h-[52px]">
        <AccountTabToggle
          value={accountTab}
          onValueChange={onAccountTabChange}
          className="w-full h-full"
        />
      </div>
    </div>,
    document.body
  );
}
