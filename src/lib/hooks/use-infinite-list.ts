"use client";

import { useEffect, useRef, useState } from "react";

type ViewMode = "detailed" | "compact" | "table";

interface UseInfiniteListOptions {
  itemsLength: number;
  viewMode: ViewMode;
  initialCounts?: Partial<Record<ViewMode, number>>;
  stepCounts?: Partial<Record<ViewMode, number>>;
  rootMargin?: string;
}

const DEFAULT_INITIAL_COUNTS = { detailed: 7, compact: 10, table: 20 };
const DEFAULT_STEP_COUNTS = { detailed: 5, compact: 10, table: 20 };

export function useInfiniteList({
  itemsLength,
  viewMode,
  initialCounts = DEFAULT_INITIAL_COUNTS,
  stepCounts = DEFAULT_STEP_COUNTS,
  rootMargin = "200px"
}: UseInfiniteListOptions) {
  const [visibleCount, setVisibleCount] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const initializedRef = useRef<{ viewMode: ViewMode; itemsLength: number } | null>(null);
  const initialCountsRef = useRef(initialCounts);
  const stepCountsRef = useRef(stepCounts);

  // Update refs when props change
  useEffect(() => {
    initialCountsRef.current = initialCounts;
  }, [initialCounts]);

  useEffect(() => {
    stepCountsRef.current = stepCounts;
  }, [stepCounts]);

  // Initialize visible count only when viewMode or itemsLength changes
  useEffect(() => {
    const key = `${viewMode}-${itemsLength}`;
    const lastKey = initializedRef.current 
      ? `${initializedRef.current.viewMode}-${initializedRef.current.itemsLength}` 
      : null;
    
    // Only initialize if viewMode or itemsLength actually changed
    if (key !== lastKey) {
      const initial = initialCountsRef.current[viewMode] ?? 7;
    setVisibleCount(Math.min(initial, itemsLength));
      initializedRef.current = { viewMode, itemsLength };
    }
  }, [viewMode, itemsLength]);

  // Set up IntersectionObserver
  useEffect(() => {
    const setupObserver = (el: HTMLDivElement) => {
      // Clean up previous observer
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      const step = stepCountsRef.current[viewMode] ?? 5;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setVisibleCount((prev) => {
                if (prev >= itemsLength) return prev;
                const newCount = Math.min(prev + step, itemsLength);
                return newCount;
              });
            }
          });
        },
        {
          root: null,
          rootMargin: rootMargin,
          threshold: 0.1,
        }
      );

      observer.observe(el);
      observerRef.current = observer;

      // Manual check if sentinel is already in view (IntersectionObserver sometimes doesn't fire immediately)
      const checkIfInView = () => {
        const rect = el.getBoundingClientRect();
        const marginValue = parseInt(rootMargin) || 200;
        const isInView = rect.top < window.innerHeight + marginValue && rect.bottom > -marginValue;
        
        if (isInView) {
          setVisibleCount((prev) => {
            if (prev >= itemsLength) return prev;
            const step = stepCountsRef.current[viewMode] ?? 5;
            return Math.min(prev + step, itemsLength);
          });
        }
      };

      // Check immediately and after a short delay
      checkIfInView();
      setTimeout(checkIfInView, 200);
    };

    const el = sentinelRef.current;
    if (!el) {
      // Retry after a short delay if element isn't ready
      const timeout = setTimeout(() => {
        const retryEl = sentinelRef.current;
        if (retryEl) {
          setupObserver(retryEl);
      }
      }, 100);
      return () => clearTimeout(timeout);
    }

    setupObserver(el);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [viewMode, itemsLength, rootMargin]);

  return { visibleCount, sentinelRef };
}
