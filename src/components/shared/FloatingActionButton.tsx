"use client";

import type { ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps extends ButtonProps {
  label: string;
  children: ReactNode;
}

const baseFabClassName =
  "fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px]";

export function FloatingActionButton({ label, className, children, ...buttonProps }: FloatingActionButtonProps) {
  return (
    <Button
      {...buttonProps}
      type="button"
      aria-label={label}
      title={label}
      className={cn(baseFabClassName, className)}
    >
      {children}
    </Button>
  );
}
