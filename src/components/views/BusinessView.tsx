"use client";

import { motion } from "motion/react";
import { AppClient } from "@/components/AppClient";
import { BusinessTabToggle } from "@/components/business/BusinessTabToggle";

export function BusinessView() {
  return (
    <motion.div
      key="business"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 pb-20 overflow-x-hidden" // Add bottom padding for navbar
    >
      <BusinessTabToggle 
        value="establishments" 
        onValueChange={() => {}} 
        onClearStatusFilters={() => {}} 
      />
      <AppClient />
    </motion.div>
  );
}