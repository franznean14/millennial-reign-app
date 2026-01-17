"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface SectionShellProps {
  children: ReactNode;
  className?: string;
  motionKey: string;
}

export function SectionShell({ children, className, motionKey }: SectionShellProps) {
  return (
    <motion.div
      key={motionKey}
      initial={{ opacity: 0, filter: "blur(6px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.3 }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
