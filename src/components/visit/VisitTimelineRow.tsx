"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface VisitTimelineRowProps {
  onClick?: () => void;
  index: number;
  total: number;
  rootClassName?: string;
  lineClassName?: string;
  lineStyle?: React.CSSProperties;
  dot: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
  avatar?: React.ReactNode;
  avatarClassName?: string;
}

export function VisitTimelineRow({
  onClick,
  index,
  total,
  rootClassName,
  lineClassName,
  lineStyle,
  dot,
  children,
  contentClassName,
  avatar,
  avatarClassName
}: VisitTimelineRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("relative flex items-start w-full text-left", rootClassName)}
    >
      {index < total - 1 && (
        <div
          className={cn("absolute w-0.5 bg-gray-500/60", lineClassName)}
          style={lineStyle}
        />
      )}
      {dot}
      <div className={cn("flex-1 min-w-0 text-left", contentClassName)}>{children}</div>
      {avatar && (
        <div className={cn("flex-shrink-0 flex items-center", avatarClassName)}>
          {avatar}
        </div>
      )}
    </button>
  );
}
