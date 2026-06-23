"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";
import { RIGHT_SHEET_STACK_ABOVE_FORM_SHEET_Z } from "@/lib/theme/drawer-stack-z-index";
import { useVisualViewport } from "@/lib/hooks/use-visual-viewport";
import {
  isPhoneLikeDeviceByScreen,
  isVisualViewportObscuredByLikelySoftwareKeyboard,
} from "@/lib/utils/visual-viewport-keyboard";

const FAB_ROOT_SELECTOR = "#fab-root";

type DrawerContentPointerDownOutside = NonNullable<
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>["onPointerDownOutside"]
>;

/** FAB portals to `#fab-root`; without this, modal drawers treat FAB taps as outside-dismiss. */
function mergePointerDownOutsideForFabRoot(
  userHandler: DrawerContentPointerDownOutside | undefined
): DrawerContentPointerDownOutside {
  return (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest?.(FAB_ROOT_SELECTOR)) {
      event.preventDefault();
    }
    /** Bulk to-do tablet FAB + expanded menu (portaled outside `#fab-root`); keep sheet open on tap. */
    if (target?.closest?.("[data-bulk-todo-sheet-fab]")) {
      event.preventDefault();
    }
    userHandler?.(event);
  };
}

/** Phone-sized screen: Vaul may reposition for software keyboard. iPad (short edge ≥ ~744) must stay false — see isPhoneLikeDeviceByScreen. `max-width: 767px` wrongly included iPad mini. */
function useDefaultDrawerRepositionInputs(explicit: boolean | undefined) {
  const [phoneLike, setPhoneLike] = React.useState(() =>
    typeof window === "undefined" ? true : isPhoneLikeDeviceByScreen()
  );
  React.useEffect(() => {
    const sync = () => setPhoneLike(isPhoneLikeDeviceByScreen());
    window.addEventListener("orientationchange", sync);
    window.screen.orientation?.addEventListener?.("change", sync);
    return () => {
      window.removeEventListener("orientationchange", sync);
      window.screen.orientation?.removeEventListener?.("change", sync);
    };
  }, []);
  return explicit !== undefined ? explicit : phoneLike;
}

export function Drawer({
  repositionInputs: repositionInputsProp,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  const repositionInputs = useDefaultDrawerRepositionInputs(repositionInputsProp);
  return <DrawerPrimitive.Root repositionInputs={repositionInputs} {...props} />;
}

export const DrawerTrigger = DrawerPrimitive.Trigger;
export const DrawerPortal = DrawerPrimitive.Portal;

export const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, style, ...props }, ref) => {
  const visualViewport = useVisualViewport();
  
  // Calculate dynamic styles for overlay based on visual viewport
  const overlayStyles = React.useMemo(() => {
    if (!visualViewport || typeof window === 'undefined') return {};
    
    // Tablets: avoid clamping overlay to visual viewport — accessory bar triggers false positives.
    const isKeyboardOpen =
      typeof window !== "undefined" &&
      isPhoneLikeDeviceByScreen() &&
      isVisualViewportObscuredByLikelySoftwareKeyboard(window.innerHeight, visualViewport.height);
    
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

  const mergedStyle = React.useMemo(
    () => ({
      ...overlayStyles,
      ...(style && typeof style === "object" ? style : {}),
    }),
    [overlayStyles, style]
  );

  return (
    <DrawerPrimitive.Overlay
      ref={ref}
      className={cn("fixed inset-0 z-50 bg-black/60", className)}
      {...props}
      style={mergedStyle}
    />
  );
});
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

export const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    overlayClassName?: string;
    handleClassName?: string;
    /** Stack above another open bottom sheet (must beat global `[data-vaul-drawer]` z-index). */
    stackAboveParentSheet?: boolean;
    /** Stack above a sheet that already uses {@link stackAboveParentSheet} (e.g. contact deets over establishment deets). */
    stackAboveStackedParentSheet?: boolean;
  }
>(({ className, overlayClassName, handleClassName, stackAboveParentSheet = false, stackAboveStackedParentSheet = false, children, onPointerDownOutside, style, ...props }, ref) => {
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
    
    const isKeyboardOpen =
      typeof window !== "undefined" &&
      isPhoneLikeDeviceByScreen() &&
      isVisualViewportObscuredByLikelySoftwareKeyboard(window.innerHeight, visualViewport.height);
    
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

  const mergedContentStyle = React.useMemo(
    () => ({
      ...dynamicStyles,
      ...(style && typeof style === "object" ? style : {}),
    }),
    [dynamicStyles, style]
  );

  const stackAboveParentAttrs = stackAboveStackedParentSheet
    ? ({ "data-stack-above-stacked-parent-sheet": "" } as const)
    : stackAboveParentSheet
      ? ({ "data-stack-above-parent-sheet": "" } as const)
      : undefined;

  return (
    <DrawerPortal>
      <DrawerOverlay className={overlayClassName} {...stackAboveParentAttrs} />
      <DrawerPrimitive.Content
        ref={ref}
        aria-describedby={undefined}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto max-h-[100svh] flex-col overflow-hidden rounded-t-[10px] border bg-background",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          className
        )}
        style={mergedContentStyle}
        {...stackAboveParentAttrs}
        {...props}
        onPointerDownOutside={mergePointerDownOutsideForFabRoot(onPointerDownOutside)}
      >
        <div className={cn("mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted", handleClassName)} />
        <div 
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain mt-3 pt-1 drawer-content-inner" 
          style={{ 
            scrollPaddingTop: 12,
            scrollPaddingBottom: 24,
            paddingBottom:
              visualViewport && typeof window !== "undefined"
                ? isPhoneLikeDeviceByScreen() &&
                  isVisualViewportObscuredByLikelySoftwareKeyboard(
                    window.innerHeight,
                    visualViewport.height
                  )
                  ? "max(env(safe-area-inset-bottom, 0px), 12px)"
                  : "max(env(safe-area-inset-bottom, 0px), 16px)"
                : "max(env(safe-area-inset-bottom, 0px), 16px)",
          }}
        >
          {children}
        </div>
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
});
DrawerContent.displayName = DrawerPrimitive.Content.displayName;

/** Inline z-index for a second right sheet above {@link DrawerWideRightContent} (z-100) and left companion (z-102). */
const RIGHT_SHEET_STACK_ABOVE_Z = 150;

/**
 * Narrow right-edge sheet for nested pickers (e.g. call date above a filter drawer on tablet).
 * Use with `<Drawer direction="right" nested shouldScaleBackground={false}>`.
 */
export const DrawerThinRightContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    overlayClassName?: string;
    /**
     * When true, overlay + panel use {@link RIGHT_SHEET_STACK_ABOVE_Z} so this sheet sits above another
     * z-100 right sheet (e.g. assignee picker opened from bulk to-dos on tablet).
     */
    stackAboveDetailsSheet?: boolean;
    /**
     * When true, overlay + panel use {@link RIGHT_SHEET_STACK_ABOVE_FORM_SHEET_Z} so this sheet sits above
     * left/right form sheets (e.g. date or publisher picker opened from a form modal on tablet).
     */
    stackAboveFormSheet?: boolean;
  }
>(({ className, overlayClassName, stackAboveDetailsSheet, stackAboveFormSheet, children, style, onPointerDownOutside, ...props }, ref) => {
  const stackStyle = stackAboveFormSheet
    ? ({ zIndex: RIGHT_SHEET_STACK_ABOVE_FORM_SHEET_Z } as React.CSSProperties)
    : stackAboveDetailsSheet
      ? ({ zIndex: RIGHT_SHEET_STACK_ABOVE_Z } as React.CSSProperties)
      : undefined;
  return (
    <DrawerPortal>
      <DrawerOverlay className={cn("z-[100]", overlayClassName)} style={stackStyle} />
      <DrawerPrimitive.Content
        ref={ref}
        aria-describedby={undefined}
        className={cn(
          "fixed inset-y-0 right-0 z-[100] flex h-full max-h-[100dvh] w-[min(100vw,22rem)] flex-col overflow-hidden rounded-l-xl border-l bg-background shadow-lg outline-none",
          className
        )}
        style={{ ...stackStyle, ...(style && typeof style === "object" ? style : {}) }}
        {...props}
        onPointerDownOutside={mergePointerDownOutsideForFabRoot(onPointerDownOutside)}
      >
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
});
DrawerThinRightContent.displayName = "DrawerThinRightContent";

/** Left sheet (e.g. Edit Call) above a contact detail pane using {@link RIGHT_SHEET_STACK_ABOVE_Z}. */
const LEFT_SHEET_STACK_ABOVE_STACKED_RIGHT_Z = 160;

/**
 * Wider right sheet for read-only detail panels (establishment/contact from a to-do).
 * Same stacking as thin variant; more width for cards + nested lists.
 */
export const DrawerWideRightContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    overlayClassName?: string;
    /**
     * When true, overlay + panel use inline z-index so this sheet wins over another z-100 right sheet
     * (CSS tie-break / Tailwind important quirks would otherwise leave the new modal behind).
     */
    stackAboveDetailsSheet?: boolean;
  }
>(({ className, overlayClassName, stackAboveDetailsSheet, children, style, onPointerDownOutside, ...props }, ref) => {
  const stackStyle = stackAboveDetailsSheet ? ({ zIndex: RIGHT_SHEET_STACK_ABOVE_Z } as React.CSSProperties) : undefined;
  return (
    <DrawerPortal>
      <DrawerOverlay className={cn("z-[100]", overlayClassName)} style={stackStyle} />
      <DrawerPrimitive.Content
        ref={ref}
        aria-describedby={undefined}
        className={cn(
          "fixed inset-y-0 right-0 z-[100] flex h-full max-h-[100dvh] w-[min(100vw,36rem)] flex-col overflow-hidden rounded-l-xl border-l bg-background shadow-lg outline-none",
          className
        )}
        style={{ ...stackStyle, ...(style && typeof style === "object" ? style : {}) }}
        {...props}
        onPointerDownOutside={mergePointerDownOutsideForFabRoot(onPointerDownOutside)}
      >
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
});
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
>(({ className, overlayClassName, children, onPointerDownOutside, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay className={cn("z-[102]", overlayClassName)} />
    <DrawerPrimitive.Content
      ref={ref}
      aria-describedby={undefined}
      className={cn(
        "fixed inset-y-0 left-0 z-[102] flex h-full max-h-[100dvh] w-[min(100vw,36rem)] flex-col overflow-hidden rounded-r-xl border-r bg-background shadow-lg outline-none",
        className
      )}
      {...props}
      onPointerDownOutside={mergePointerDownOutsideForFabRoot(onPointerDownOutside)}
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
    /**
     * When true, overlay + panel use inline z-index above {@link DrawerWideRightContent}
     * with `stackAboveDetailsSheet` (nested contact pane).
     */
    stackAboveStackedRightSheet?: boolean;
  }
>(({ className, overlayClassName, stackAboveStackedRightSheet, children, style, onPointerDownOutside, ...props }, ref) => {
  const stackStyle = stackAboveStackedRightSheet
    ? ({ zIndex: LEFT_SHEET_STACK_ABOVE_STACKED_RIGHT_Z } as React.CSSProperties)
    : undefined;
  return (
    <DrawerPortal>
      <DrawerOverlay className={cn("z-[130]", overlayClassName)} style={stackStyle} />
      <DrawerPrimitive.Content
        ref={ref}
        aria-describedby={undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-[130] flex h-full max-h-[100dvh] w-[min(100vw,36rem)] flex-col overflow-hidden rounded-r-xl border-r bg-background shadow-lg outline-none",
          className
        )}
        {...props}
        style={{ ...stackStyle, ...(style && typeof style === "object" ? style : {}) }}
        onPointerDownOutside={mergePointerDownOutsideForFabRoot(onPointerDownOutside)}
      >
        {children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
});
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

