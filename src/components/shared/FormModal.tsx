"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  desktopQuery?: string;
}

export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  headerClassName,
  bodyClassName,
  desktopQuery = "(min-width: 1280px)"
}: FormModalProps) {
  const isDesktop = useMediaQuery(desktopQuery);

  const Body = ({ children: bodyChildren, className: bodyClassName }: { children: ReactNode; className?: string }) => {
    const bodyRef = useRef<HTMLDivElement>(null);
    const [isScrollable, setIsScrollable] = useState(false);

    useEffect(() => {
      const el = bodyRef.current;
      if (!el) return;
      const update = () => {
        const scrollable = el.scrollHeight - el.clientHeight > 4;
        setIsScrollable(scrollable);
      };
      update();
      const observer = new ResizeObserver(update);
      observer.observe(el);
      window.addEventListener("resize", update);
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", update);
      };
    }, []);

    return (
      <div
        ref={bodyRef}
        className={cn("px-4", isScrollable ? "pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]" : "", bodyClassName)}
      >
        {bodyChildren}
      </div>
    );
  };

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={className}>
          <DialogHeader className={cn(headerClassName)}>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <Body className={bodyClassName}>{children}</Body>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className={className}>
        <DrawerHeader className={cn(headerClassName)}>
          <DrawerTitle>{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <Body className={bodyClassName}>{children}</Body>
      </DrawerContent>
    </Drawer>
  );
}
