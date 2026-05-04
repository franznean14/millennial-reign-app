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
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    overlayClassName?: string;
  }
>(({ className, overlayClassName, children, ...props }, ref) => {
  const visualViewport = useVisualViewport();
  
  // Check if this is a nested drawer (time picker) that needs to be taller
  const isNestedDrawer = className?.includes('!z-[60]') || className?.includes('nested-drawer');
  
  // Calculate dynamic styles based on visual viewport - only adjust height constraints
  const dynamicStyles = React.useMemo(() => {
    if (!visualViewport || typeof window === 'undefined') {
      // For nested drawers, allow taller height even without viewport
      if (isNestedDrawer) {
        return {
          marginTop: '32px',
          maxHeight: 'calc(100vh - 32px)',
        };
      }
      return {};
    }
    
    // When keyboard is open, only adjust height constraint - no positioning changes
    const isKeyboardOpen = visualViewport.height < window.innerHeight * 0.8;
    
    if (isKeyboardOpen) {
      return {
        maxHeight: `${visualViewport.height}px`,
        transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      };
    }
    
    // When keyboard closes, reset height constraint
    // For nested drawers, use a taller max height
    if (isNestedDrawer) {
      return {
        marginTop: '32px',
        maxHeight: 'calc(100vh - 32px)',
        transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      };
    }
    
    return {
      maxHeight: '100svh', // Reset to default max height
      transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    };
  }, [visualViewport, isNestedDrawer]);

  return (
    <DrawerPortal>
      <DrawerOverlay className={overlayClassName} />
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
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain mt-3 pt-1 drawer-content-inner" 
          style={{ 
            scrollPaddingTop: 12,
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

/**
 * Narrow right-edge sheet for nested pickers (e.g. call date above a filter drawer on tablet).
 * Use with `<Drawer direction="right" nested shouldScaleBackground={false}>`.
 */
export const DrawerThinRightContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    overlayClassName?: string;
  }
>(({ className, overlayClassName, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay className={cn("z-[100]", overlayClassName)} />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 right-0 z-[100] flex h-full max-h-[100dvh] w-[min(100vw,22rem)] flex-col overflow-hidden rounded-l-xl border-l bg-background shadow-lg outline-none",
        className
      )}
      {...props}
    >
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerThinRightContent.displayName = "DrawerThinRightContent";

/**
 * Wider right sheet for read-only detail panels (establishment/contact from a to-do).
 * Same stacking as thin variant; more width for cards + nested lists.
 */
export const DrawerWideRightContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    overlayClassName?: string;
  }
>(({ className, overlayClassName, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay className={cn("z-[100]", overlayClassName)} />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 right-0 z-[100] flex h-full max-h-[100dvh] w-[min(100vw,36rem)] flex-col overflow-hidden rounded-l-xl border-l bg-background shadow-lg outline-none",
        className
      )}
      {...props}
    >
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerWideRightContent.displayName = "DrawerWideRightContent";

/**
 * Wide left sheet for companion panels (e.g. calls / to-dos / forms beside a right-side detail drawer on tablet).
 * Stacks above {@link DrawerWideRightContent} (z-[100]) so it can open on top while details stay underneath.
 */
export const DrawerWideLeftContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    overlayClassName?: string;
  }
>(({ className, overlayClassName, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay className={cn("z-[102]", overlayClassName)} />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 left-0 z-[102] flex h-full max-h-[100dvh] w-[min(100vw,36rem)] flex-col overflow-hidden rounded-r-xl border-r bg-background shadow-lg outline-none",
        className
      )}
      {...props}
    >
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerWideLeftContent.displayName = "DrawerWideLeftContent";

/**
 * Same as {@link DrawerWideLeftContent} but with a higher z-index for modals that must sit above
 * other left/right sheets (e.g. edit forms opened while to-do list + details drawers are open).
 */
export const DrawerWideLeftContentTop = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    overlayClassName?: string;
  }
>(({ className, overlayClassName, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay className={cn("z-[130]", overlayClassName)} />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        "fixed inset-y-0 left-0 z-[130] flex h-full max-h-[100dvh] w-[min(100vw,36rem)] flex-col overflow-hidden rounded-r-xl border-r bg-background shadow-lg outline-none",
        className
      )}
      {...props}
    >
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerWideLeftContentTop.displayName = "DrawerWideLeftContentTop";

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

