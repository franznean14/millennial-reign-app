"use client";

import { motion } from "motion/react";

export function LoadingView() {
  return (
    <motion.div
      key="loading"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen flex items-center justify-center bg-background"
    >
      <div className="text-center space-y-6">
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

      </div>
    </motion.div>
  );
}
