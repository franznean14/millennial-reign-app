"use client";

import { useMobile } from "@/lib/hooks/use-mobile";
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ReactNode } from "react";

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className
}: ResponsiveModalProps) {
  const isMobile = useMobile();
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    if (!isMobile || typeof window === "undefined" || !(window as any).visualViewport) return;
    const vv: VisualViewport = (window as any).visualViewport;
    const handler = () => {
      try {
        const gap = Math.max(0, window.innerHeight - (vv.height + (vv as any).offsetTop || 0));
        setKeyboardInset(gap);
      } catch {}
    };
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
    handler();
    return () => {
      vv.removeEventListener("resize", handler);
      vv.removeEventListener("scroll", handler);
    };
  }, [isMobile]);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={`${className || ""}`}>
          <DrawerHeader className="flex-shrink-0">
            <DrawerTitle>{title}</DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div
            className="p-4 pt-0 overscroll-contain no-scrollbar"
            style={{ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + max(env(keyboard-inset-height, 0px), ${Math.max(12, Math.min(240, keyboardInset))}px))` }}
          >
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="p-4 pt-0 no-scrollbar">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}



