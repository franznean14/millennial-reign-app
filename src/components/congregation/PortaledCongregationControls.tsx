"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { CongregationTabToggle } from "./CongregationTabToggle";

interface PortaledCongregationControlsProps {
  congregationTab: 'meetings' | 'ministry';
  onCongregationTabChange: (tab: 'meetings' | 'ministry') => void;
  isVisible: boolean;
}

export function PortaledCongregationControls({
  congregationTab,
  onCongregationTabChange,
  isVisible
}: PortaledCongregationControlsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
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
          <motion.div 
            className="w-full h-[52px]"
            layout
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30
            }}
          >
            <CongregationTabToggle
              value={congregationTab}
              onValueChange={onCongregationTabChange}
              className="w-full"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
