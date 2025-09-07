"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";

export function Drawer({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root {...props} />;
}

export const DrawerTrigger = DrawerPrimitive.Trigger;
export const DrawerPortal = DrawerPrimitive.Portal;

export const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/60", className)}
    {...props}
  />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  // Update a CSS variable with the keyboard-covered height using visualViewport
  React.useEffect(() => {
    const html = document.documentElement;
    const vv: VisualViewport | undefined = (window as any).visualViewport;
    const update = () => {
      try {
        if (!vv) return html.style.setProperty("--kb-safe", "0px");
        const covered = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
        html.style.setProperty("--kb-safe", `${Math.round(covered)}px`);
      } catch {}
    };
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      html.style.removeProperty("--kb-safe");
    };
  }, []);

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-x-0 z-[80] mt-24 flex h-auto max-h-[calc(100svh-var(--kb-safe,0px))] flex-col overflow-hidden rounded-t-[10px] border bg-background pt-[env(safe-area-inset-top)]",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className
        )}
        style={{ bottom: "var(--kb-safe, 0px)" }}
        {...props}
      >
        <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
        <div className="min-h-0 flex-1 overflow-y-auto ios-touch" style={{ scrollPaddingBottom: 24 }}>
          {children}
        </div>
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
});
DrawerContent.displayName = DrawerPrimitive.Content.displayName;

export function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)} {...props} />
  );
}

export function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
  );
}
export const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title ref={ref} className={cn("text-base font-semibold", className)} {...props} />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

export const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export const DrawerClose = DrawerPrimitive.Close;

