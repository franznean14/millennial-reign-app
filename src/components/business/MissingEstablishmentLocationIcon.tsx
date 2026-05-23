"use client";

import { MapPinned } from "lucide-react";
import { cn } from "@/lib/utils";

interface MissingEstablishmentLocationIconProps {
  className?: string;
  size?: "sm" | "md";
}

/** Dashed-circle map pin — establishment has no lat/lng yet. */
export function MissingEstablishmentLocationIcon({
  className,
  size = "sm",
}: MissingEstablishmentLocationIconProps) {
  const shell = size === "sm" ? "h-5 w-5" : "h-8 w-8";
  const icon = size === "sm" ? "h-3 w-3" : "h-4 w-4";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/45 text-muted-foreground/85 dark:border-[#80778e]/55 dark:text-[#cfc5db]",
        shell,
        className
      )}
      aria-label="Location not set"
      title="Location not set"
    >
      <MapPinned className={icon} aria-hidden />
    </span>
  );
}
