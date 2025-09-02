"use client";

import { motion } from "motion/react";
import { AppClient } from "@/components/AppClient";

export function AccountView() {
  return (
    <motion.div
      key="account"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <AppClient currentSection="account" />
    </motion.div>
  );
}
