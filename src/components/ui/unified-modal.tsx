"use client";

import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { useMobile } from "@/lib/hooks/use-mobile";

interface UnifiedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}

export function UnifiedModal({ 
  open, 
  onOpenChange, 
  title, 
  description, 
  children, 
  className 
}: UnifiedModalProps) {
  const isMobile = useMobile();

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      className={isMobile ? "p-0 w-full" : className || "w-[min(96vw,720px)]"}
    >
      {children}
    </ResponsiveModal>
  );
}
