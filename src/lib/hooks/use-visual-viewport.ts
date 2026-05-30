"use client";

import { useState, useEffect, useRef } from "react";
import {
  isPhoneLikeDeviceByScreen,
  isVisualViewportObscuredByLikelySoftwareKeyboard,
} from "@/lib/utils/visual-viewport-keyboard";

export function useVisualViewport() {
  const [visualViewport, setVisualViewport] = useState<{
    height: number;
    width: number;
    offsetTop: number;
    offsetLeft: number;
    scale: number;
  } | null>(null);
  
  const lastHeightRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateViewport = () => {
      if (window.visualViewport) {
        const newHeight = window.visualViewport.height;
        const newWidth = window.visualViewport.width;
        const newOffsetTop = window.visualViewport.offsetTop;
        const newOffsetLeft = window.visualViewport.offsetLeft;
        
        const isKeyboardOpen = isVisualViewportObscuredByLikelySoftwareKeyboard(
          window.innerHeight,
          newHeight
        );
        
        // Never drive --visual-viewport-height on tablets: globals + drawers use it to clamp sheets.
        if (isKeyboardOpen && isPhoneLikeDeviceByScreen()) {
          document.documentElement.classList.add("visual-keyboard-open");
          document.documentElement.style.setProperty("--visual-viewport-height", `${newHeight}px`);
          document.documentElement.style.setProperty(
            "--visual-viewport-offset-top",
            `${newOffsetTop}px`
          );
        } else {
          document.documentElement.classList.remove("visual-keyboard-open");
          // Reset immediately — delayed removal races iOS PWA keyboard dismiss and leaves
          // `[data-vaul-drawer]` / overlays clamped to a stale height (gray band over bottom nav).
          document.documentElement.style.removeProperty("--visual-viewport-height");
          document.documentElement.style.removeProperty("--visual-viewport-offset-top");
          requestAnimationFrame(() => {
            document.documentElement.style.removeProperty("--visual-viewport-height");
          });
        }
        
        // Only update state if height actually changed to prevent unnecessary re-renders
        if (Math.abs(newHeight - lastHeightRef.current) > 10) {
          lastHeightRef.current = newHeight;
          setVisualViewport({
            height: newHeight,
            width: newWidth,
            offsetTop: newOffsetTop,
            offsetLeft: newOffsetLeft,
            scale: window.visualViewport.scale,
          });
        }
      } else {
        // Fallback for browsers without visual viewport API
        const newHeight = window.innerHeight;
        const newWidth = window.innerWidth;
        
        // For fallback, always reset CSS properties since we can't detect keyboard state
        document.documentElement.style.removeProperty('--visual-viewport-height');
        // document.documentElement.style.removeProperty('--visual-viewport-width');
        // document.documentElement.style.removeProperty('--visual-viewport-offset-top');
        // document.documentElement.style.removeProperty('--visual-viewport-offset-left');
        
        if (Math.abs(newHeight - lastHeightRef.current) > 10) {
          lastHeightRef.current = newHeight;
          setVisualViewport({
            height: newHeight,
            width: newWidth,
            offsetTop: 0,
            offsetLeft: 0,
            scale: 1,
          });
        }
      }
    };

    // Set initial viewport
    updateViewport();

    // Listen for viewport changes (keyboard open/close)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewport);
      window.visualViewport.addEventListener('scroll', updateViewport);
    } else {
      // Fallback: listen to window resize events
      window.addEventListener('resize', updateViewport);
    }

    // Also listen to orientation change for immediate response
    window.addEventListener('orientationchange', () => {
      // Small delay to let orientation change complete
      setTimeout(updateViewport, 100);
    });

    return () => {
      document.documentElement.classList.remove("visual-keyboard-open");
      document.documentElement.style.removeProperty("--visual-viewport-height");
      document.documentElement.style.removeProperty("--visual-viewport-offset-top");
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewport);
        window.visualViewport.removeEventListener('scroll', updateViewport);
      } else {
        window.removeEventListener('resize', updateViewport);
      }
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  return visualViewport;
}
