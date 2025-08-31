"use client";

import { motion } from "motion/react";
import { CongregationClient } from "@/components/congregation/CongregationClient";

export function CongregationView() {
  return (
    <motion.div
      key="congregation"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Congregation</h1>
      </div>
      <CongregationClient />
    </motion.div>
  );
}
