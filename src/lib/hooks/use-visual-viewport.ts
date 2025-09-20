"use client";

import { useState, useEffect, useRef } from 'react';

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
        
        // Check if keyboard is open (viewport height significantly reduced)
        const isKeyboardOpen = newHeight < window.innerHeight * 0.8;
        
        if (isKeyboardOpen) {
          // Set CSS custom properties for keyboard open state - only height constraint
          document.documentElement.style.setProperty('--visual-viewport-height', `${newHeight}px`);
          // Don't set width or positioning properties - let keyboard push drawer up naturally
          // document.documentElement.style.setProperty('--visual-viewport-width', `${newWidth}px`);
          // document.documentElement.style.setProperty('--visual-viewport-offset-top', `${newOffsetTop}px`);
          // document.documentElement.style.setProperty('--visual-viewport-offset-left', `${newOffsetLeft}px`);
        } else {
          // Reset CSS custom properties to default values when keyboard closes
          // Use a small delay to allow smooth transition
          setTimeout(() => {
            document.documentElement.style.removeProperty('--visual-viewport-height');
            // document.documentElement.style.removeProperty('--visual-viewport-width');
            // document.documentElement.style.removeProperty('--visual-viewport-offset-top');
            // document.documentElement.style.removeProperty('--visual-viewport-offset-left');
          }, 50);
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
