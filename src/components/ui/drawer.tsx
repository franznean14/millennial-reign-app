"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";

/** Root passthrough */
function Drawer(props: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root {...props} />;
}

const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerPortal = DrawerPrimitive.Portal;

/** Overlay (keep high z, avoid heavy blur on iOS) */
const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-[60] bg-black/60", className)}
    {...props}
  />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

/** Keyboard-aware Content wrapper */
const KeyboardAwareContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(function KeyboardAwareContent({ children, ...props }, forwardedRef) {
  const localRef = React.useRef<HTMLDivElement | null>(null);

  // Track keyboard height with visualViewport and expose as CSS var --kb-safe
  React.useEffect(() => {
    const el =
      (localRef.current ||
        (forwardedRef as any)?.current) as HTMLElement | null;
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!el || !vv) return;

    const update = () => {
      const kb = Math.max(0, window.innerHeight - vv.height); // keyboard height approx
      el.style.setProperty("--kb-safe", `${Math.round(kb)}px`);
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update); // iOS moves vv when keyboard shows
    update();

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      el.style.removeProperty("--kb-safe");
    };
  }, []);

  return (
    <DrawerPrimitive.Content
      ref={(node) => {
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef && "current" in (forwardedRef as any))
          (forwardedRef as any).current = node;
        localRef.current = node as HTMLDivElement | null;
      }}
      {...props}
    >
      {children}
    </DrawerPrimitive.Content>
  );
});

/** Content: stable shell height + inner scroller */
const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <KeyboardAwareContent
      ref={ref as any}
      className={cn(
        // Shell does NOT shrink with keyboard: use 100svh, not dvh/vh
        "fixed inset-x-0 bottom-0 z-[70] flex h-auto max-h-[100svh] flex-col overflow-hidden rounded-t-[10px] border bg-background",
        // Safe areas + dynamic keyboard padding
        "pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+var(--kb-safe,0px))]",
        // Animations
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        className
      )}
      {...props}
    >
      <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
      {/* Only inner area scrolls; give it momentum + scroll padding for focus */}
      <div
        className="min-h-0 flex-1 overflow-y-auto ios-touch"
        style={{ scrollPaddingBottom: 24 }}
      >
        <div className="overscroll-contain no-scrollbar">{children}</div>
      </div>
    </KeyboardAwareContent>
  </DrawerPortal>
));
DrawerContent.displayName = DrawerPrimitive.Content.displayName;

function DrawerHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("grid gap-1.5 p-4 text-center sm:text-left", className)}
      {...props}
    />
  );
}

function DrawerFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
  );
}

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold", className)}
    {...props}
  />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
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