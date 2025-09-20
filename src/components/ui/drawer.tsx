"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";
import { useVisualViewport } from "@/lib/hooks/use-visual-viewport";

export function Drawer({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root {...props} />;
}

export const DrawerTrigger = DrawerPrimitive.Trigger;
export const DrawerPortal = DrawerPrimitive.Portal;

export const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  const visualViewport = useVisualViewport();
  
  // Calculate dynamic styles for overlay based on visual viewport
  const overlayStyles = React.useMemo(() => {
    if (!visualViewport || typeof window === 'undefined') return {};
    
    // When keyboard is open, only adjust height constraint - no positioning changes
    const isKeyboardOpen = visualViewport.height < window.innerHeight * 0.8;
    
    if (isKeyboardOpen) {
      return {
        // Only set max-height constraint, don't force positioning
        maxHeight: `${visualViewport.height}px`,
        transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      };
    }
    
    // When keyboard closes, reset height constraint
    return {
      maxHeight: '100vh', // Reset to full viewport height
      transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    };
  }, [visualViewport]);

  return (
    <DrawerPrimitive.Overlay
      ref={ref}
      className={cn("fixed inset-0 z-50 bg-black/60", className)}
      style={overlayStyles}
      {...props}
    />
  );
});
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const visualViewport = useVisualViewport();
  
  // Calculate dynamic styles based on visual viewport - only adjust height constraints
  const dynamicStyles = React.useMemo(() => {
    if (!visualViewport || typeof window === 'undefined') return {};
    
    // When keyboard is open, only adjust height constraint - no positioning changes
    const isKeyboardOpen = visualViewport.height < window.innerHeight * 0.8;
    
    if (isKeyboardOpen) {
      return {
        maxHeight: `${visualViewport.height}px`,
        transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      };
    }
    
    // When keyboard closes, reset height constraint only
    return {
      maxHeight: '100svh', // Reset to default max height
      transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    };
  }, [visualViewport]);

  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        ref={ref}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto max-h-[100svh] flex-col overflow-hidden rounded-t-[10px] border bg-background",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className
        )}
        style={dynamicStyles}
        {...props}
      >
        <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
        <div 
          className="min-h-0 flex-1 overflow-y-auto drawer-content-inner" 
          style={{ 
            scrollPaddingBottom: 24,
            paddingBottom: visualViewport && typeof window !== 'undefined' && visualViewport.height < window.innerHeight * 0.8 ? 'env(safe-area-inset-bottom, 0px)' : '0px'
          }}
        >
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

