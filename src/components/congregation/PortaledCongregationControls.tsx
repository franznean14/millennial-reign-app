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
          className="fixed left-1/2 transform -translate-x-1/2 z-[100] space-y-3"
          style={{
            top: 64 // top-16 = 64px
          }}
        >
          {/* Tab Navigation */}
          <motion.div 
            className="flex justify-center"
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
              className="w-full max-w-sm sm:max-w-md mx-2 sm:mx-4"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
