"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import type { BusinessFiltersState } from "@/lib/db/business";

interface StickySearchBarProps {
  filters: BusinessFiltersState;
  onFiltersChange: (filters: BusinessFiltersState) => void;
  onClearSearch: () => void;
  isVisible: boolean;
  businessTab: 'establishments' | 'householders' | 'map';
}

export function StickySearchBar({
  filters,
  onFiltersChange,
  onClearSearch,
  isVisible,
  businessTab
}: StickySearchBarProps) {
  const [mounted, setMounted] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const hasSearchText = filters.search && filters.search.trim() !== '';
  const shouldExpand = isFocused || hasSearchText;
  
  // Calculate dynamic width based on content
  const getDynamicWidth = () => {
    if (isFocused) {
      // When focused, expand to maximum width
      return 280;
    }
    
    if (!shouldExpand) {
      // When idle, show "Search" placeholder - calculate width for "Search" text
      const placeholderText = "Search";
      const baseWidth = 32; // Base width for padding (px-4 = 16px each side)
      const charWidth = 8; // Approximate character width
      const textWidth = placeholderText.length * charWidth;
      return baseWidth + textWidth; // Should be around 72px
    }
    
    // When unfocused but has text, wrap around the text content
    const text = filters.search || '';
    const baseWidth = 48; // Base width for padding and clear button (px-4 + pr-10)
    const charWidth = 8; // Approximate character width
    const textWidth = text.length * charWidth;
    const totalWidth = baseWidth + textWidth;
    
    return Math.min(Math.max(totalWidth, 80), 280); // Min 80px, Max 280px
  };

  return createPortal(
    <AnimatePresence>
        {isVisible && businessTab !== 'map' && (
          <motion.div
            className="fixed bottom-20 left-0 right-0 z-[90] flex justify-center px-4 pb-safe"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
            style={{
              bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))'
            }}
          >
          <motion.div
            className="relative"
            animate={{
              width: getDynamicWidth()
            }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 30
            }}
          >
            <div className="relative">
              <Input
                placeholder={shouldExpand ? "Search establishments..." : "Search"}
                value={filters.search}
                onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur(); // Remove focus to close keyboard
                  }
                }}
                className={`bg-background/95 backdrop-blur-sm border shadow-lg transition-all duration-300 h-10 rounded-full w-full text-center ${
                  shouldExpand ? 'px-4 pr-10' : 'px-4'
                }`}
              />
              {hasSearchText && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 hover:bg-muted/50 rounded-full"
                  onClick={onClearSearch}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
