"use client";

import { cn } from "@/lib/utils";
import { getStatusTextColor } from "@/lib/utils/status-hierarchy";

interface VisitStatusBadgeProps {
  status: string;
  label: string;
  className?: string;
}

export function VisitStatusBadge({ status, label, className }: VisitStatusBadgeProps) {
  return (
    <span
      className={cn("text-xs px-2 py-0.5 rounded-full border", getStatusTextColor(status), className)}
      title={`Status: ${status}`}
    >
      {label}
    </span>
  );
}
