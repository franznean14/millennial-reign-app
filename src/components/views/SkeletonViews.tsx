"use client";

import { motion } from "motion/react";
import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonHomeView() {
  return (
    <motion.div
      key="skeleton-home"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <Skeleton className="h-8 w-32" />
      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function SkeletonBusinessView() {
  return (
    <motion.div
      key="skeleton-business"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-9 w-20" />
      </div>
      
      <div className="grid gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-1/2" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded-full" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export function SkeletonCongregationView() {
  return (
    <motion.div
      key="skeleton-congregation"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <Skeleton className="h-8 w-36" />
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    </motion.div>
  );
}

export function SkeletonAccountView() {
  return (
    <motion.div
      key="skeleton-account"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-9 w-20" />
      </div>
      
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
