"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CongregationTabToggle } from "./CongregationTabToggle";

interface PortaledCongregationControlsProps {
  congregationTab: 'meetings' | 'ministry' | 'admin';
  onCongregationTabChange: (tab: 'meetings' | 'ministry' | 'admin') => void;
  isVisible: boolean;
  isElder?: boolean;
}

export function PortaledCongregationControls({
  congregationTab,
  onCongregationTabChange,
  isVisible,
  isElder = false
}: PortaledCongregationControlsProps) {
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
        <CongregationTabToggle
          value={congregationTab}
          onValueChange={onCongregationTabChange}
          className="w-full h-full"
          isElder={isElder}
        />
      </div>
    </div>,
    document.body
  );
}
