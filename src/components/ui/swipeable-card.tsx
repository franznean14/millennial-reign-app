"use client";

import { useState, useRef, useEffect } from "react";
import { motion, PanInfo, useMotionValue, useTransform } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trash2, Archive, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeableCardProps {
  children: React.ReactNode;
  onDelete?: () => void;
  onArchive?: () => void;
  className?: string;
}

export function SwipeableCard({ children, onDelete, onArchive, className }: SwipeableCardProps) {
  const [actionTriggered, setActionTriggered] = useState<'delete' | 'archive' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasSwiped, setHasSwiped] = useState(false);
  const x = useMotionValue(0);
  
  // Simplified transforms for better performance
  const rotate = useTransform(x, [-100, 100], [-3, 3]);
  const scale = useTransform(x, [-100, 0, 100], [0.98, 1, 0.98]);
  const opacity = useTransform(x, [-100, 0, 100], [0.9, 1, 0.9]);

  const deleteThreshold = -80;
  const archiveThreshold = 80;

  const handleDragStart = () => {
    setIsDragging(true);
  };

  const handleDrag = () => {
    // Track if we've moved enough to consider it a swipe
    const currentX = x.get();
    if (Math.abs(currentX) > 20) {
      setHasSwiped(true);
    }
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    setIsDragging(false);
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    // Determine action based on drag distance and velocity
    if (offset < deleteThreshold || velocity < -500) {
      setActionTriggered('delete');
      setHasSwiped(true);
      if (onDelete) {
        onDelete();
      }
    } else if (offset > archiveThreshold || velocity > 500) {
      setActionTriggered('archive');
      setHasSwiped(true);
      if (onArchive) {
        onArchive();
      }
    }

    // Smooth reset to original position
    x.set(0);
  };

  // Reset action triggered state after animation
  useEffect(() => {
    if (actionTriggered) {
      const timer = setTimeout(() => {
        setActionTriggered(null);
        setHasSwiped(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [actionTriggered]);

  // Handle tap/click - prevent if we've swiped
  const handleTap = (e: React.MouseEvent) => {
    if (hasSwiped || actionTriggered) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };

  return (
    <div className="relative w-full">
      {/* Background actions */}
      <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
        {/* Delete action (left side) */}
        <motion.div
          className="flex items-center justify-center w-20 h-full bg-red-500 rounded-l-lg"
          style={{
            opacity: useTransform(x, [deleteThreshold, 0], [1, 0]),
            scale: useTransform(x, [deleteThreshold, 0], [1, 0.8])
          }}
        >
          <Trash2 className="h-6 w-6 text-white" />
        </motion.div>

        {/* Archive action (right side) */}
        <motion.div
          className="flex items-center justify-center w-20 h-full bg-blue-500 rounded-r-lg ml-auto"
          style={{
            opacity: useTransform(x, [0, archiveThreshold], [0, 1]),
            scale: useTransform(x, [0, archiveThreshold], [0.8, 1])
          }}
        >
          <Archive className="h-6 w-6 text-white" />
        </motion.div>
      </div>

      {/* Main card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 100 }}
        dragElastic={0.2}
        dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        style={{ x, rotate, scale, opacity }}
        className={cn("w-full", className)}
        whileTap={{ scale: 0.98 }}
        transition={{ 
          type: "spring", 
          stiffness: 300, 
          damping: 30,
          mass: 0.8
        }}
      >
        <Card className="w-full">
          <div onClick={handleTap}>
            {children}
          </div>
        </Card>
      </motion.div>

      {/* Action feedback overlay */}
      {actionTriggered && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg"
        >
          <div className="flex items-center gap-2 text-lg font-medium">
            {actionTriggered === 'delete' ? (
              <>
                <Trash2 className="h-5 w-5 text-red-500" />
                Deleted
              </>
            ) : (
              <>
                <Archive className="h-5 w-5 text-blue-500" />
                Archived
              </>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
