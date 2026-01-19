"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";

interface FullScreenLoadingProps {
  isVisible: boolean;
  onComplete?: () => void;
}

export function FullScreenLoading({ isVisible, onComplete }: FullScreenLoadingProps) {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setShowContent(true);
    } else {
      // Delay hiding content to allow for smooth exit animation
      const timer = setTimeout(() => {
        setShowContent(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!showContent) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isVisible ? 1 : 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[99999] bg-background flex items-center justify-center"
      style={{
        // Ensure it covers everything including safe areas
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100dvh', // Use dynamic viewport height for mobile
      }}
    >
      <div className="text-center space-y-6 px-4">
        {/* Logo/Brand */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Millennial Reign
          </h1>
          <p className="text-sm text-muted-foreground mt-2">Kingdom Ministry App</p>
        </motion.div>

        {/* Loading Spinner */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="flex justify-center"
        >
          <div className="relative">
            <div className="w-8 h-8 border-2 border-primary/20 rounded-full"></div>
            <div className="absolute top-0 left-0 w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        </motion.div>

        {/* Loading Text */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="text-sm text-muted-foreground"
        >
          Loading...
        </motion.div>
      </div>
    </motion.div>
  );
}
