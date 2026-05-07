"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps extends ComponentProps<typeof Button> {
  label: string;
  children: ReactNode;
  /**
   * Tablet bulk sheet: omit default `right-*` / `bottom` so {@link ComponentProps}<typeof Button>[`style`]
   * can fully position the FAB (dynamic `right` is not reliably emitted by Tailwind when built from JS strings).
   */
  omitDefaultHorizontalAnchor?: boolean;
}

const baseFabAnchoredBottomRight =
  "pointer-events-auto fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px]";
/** No inset — caller supplies `style` (bulk tablet dock). */
const baseFabDockedShell =
  "pointer-events-auto fixed z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation";

export function FloatingActionButton({
  label,
  className,
  children,
  omitDefaultHorizontalAnchor = false,
  style,
  ...buttonProps
}: FloatingActionButtonProps) {
  const baseFabClassName = omitDefaultHorizontalAnchor ? baseFabDockedShell : baseFabAnchoredBottomRight;
  return (
    <Button
      {...buttonProps}
      type="button"
      aria-label={label}
      title={label}
      style={style}
      className={cn(baseFabClassName, className)}
    >
      {children}
    </Button>
  );
}
