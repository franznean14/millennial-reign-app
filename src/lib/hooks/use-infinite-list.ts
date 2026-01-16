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

export function useInfiniteList({
  itemsLength,
  viewMode,
  initialCounts = { detailed: 7, compact: 10, table: 20 },
  stepCounts = { detailed: 5, compact: 10, table: 20 },
  rootMargin = "200px"
}: UseInfiniteListOptions) {
  const [visibleCount, setVisibleCount] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const initial = initialCounts[viewMode] ?? 7;
    setVisibleCount(Math.min(initial, itemsLength));
  }, [viewMode, itemsLength, initialCounts]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const step = stepCounts[viewMode] ?? 5;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + step, itemsLength));
        }
      }
    }, { root: null, rootMargin, threshold: 0 });

    observer.observe(el);
    return () => observer.disconnect();
  }, [viewMode, itemsLength, stepCounts, rootMargin]);

  return { visibleCount, sentinelRef };
}
