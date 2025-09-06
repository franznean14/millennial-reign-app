"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";

function Drawer({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root {...props} />;
}

const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerPortal = DrawerPrimitive.Portal;

const DrawerOverlay = React.forwardRef<
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

const KeyboardAwareContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(function KeyboardAwareContent({ children, ...props }, forwardRef) {
  const localRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = (localRef.current || (forwardRef as any)?.current) as HTMLElement | null;
    if (!el || !window.visualViewport) return;

    const vv = window.visualViewport;

    const update = () => {
      const keyboard = Math.max(0, window.innerHeight - vv.height);
      el.style.setProperty("--kb-safe", `${Math.round(keyboard)}px`);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return (
    <DrawerPrimitive.Content
      ref={(node) => {
        if (typeof forwardRef === 'function') forwardRef(node as any);
        else if (forwardRef && 'current' in (forwardRef as any)) (forwardRef as any).current = node;
        localRef.current = node as HTMLDivElement | null;
      }}
      {...props}
    >
      {children}
    </DrawerPrimitive.Content>
  );
});

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <KeyboardAwareContent
      ref={ref as any}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex h-auto max-h-[100svh] flex-col overflow-hidden rounded-t-[10px] border bg-background pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+var(--kb-safe,0px))]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        className
      )}
      {...props}
    >
      <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
      <div className="min-h-0 flex-1 overflow-y-auto ios-touch" style={{ scrollPaddingBottom: 24 }}>
        {/* Prevent scroll chaining to outside when focusing inputs on mobile */}
        <div className="overscroll-contain no-scrollbar">
          {children}
        </div>
      </div>
    </KeyboardAwareContent>
  </DrawerPortal>
));
DrawerContent.displayName = DrawerPrimitive.Content.displayName;

function DrawerHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)} {...props} />
  );
}

function DrawerFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
  );
}

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title ref={ref} className={cn("text-base font-semibold", className)} {...props} />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Drawer,
  DrawerTrigger,
  DrawerPortal,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
