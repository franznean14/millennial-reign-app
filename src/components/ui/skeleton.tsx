"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
}

export function Skeleton({ className, width, height }: SkeletonProps) {
  return (
    <motion.div
      className={cn(
        "bg-muted rounded-md",
        className
      )}
      style={{ width, height }}
      animate={{
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function SkeletonEstablishmentCard() {
  return (
    <div className="p-4 border rounded-lg space-y-3">
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
  );
}

export function SkeletonHomeView() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/4" />
        <div className="grid gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
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