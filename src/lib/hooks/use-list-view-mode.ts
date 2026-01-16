"use client";

import { useEffect, useMemo, useState } from "react";

interface UseListViewModeOptions<T extends string> {
  defaultViewMode: T;
  externalViewMode?: T;
  onViewModeChange?: (viewMode: T) => void;
  storageKey?: string;
  allowedModes: T[];
  cycleOrder?: T[];
}

export function useListViewMode<T extends string>({
  defaultViewMode,
  externalViewMode,
  onViewModeChange,
  storageKey,
  allowedModes,
  cycleOrder
}: UseListViewModeOptions<T>) {
  const order = useMemo(() => cycleOrder ?? allowedModes, [cycleOrder, allowedModes]);
  const [viewMode, setViewModeState] = useState<T>(externalViewMode ?? defaultViewMode);

  useEffect(() => {
    if (externalViewMode) {
      setViewModeState(externalViewMode);
    }
  }, [externalViewMode]);

  useEffect(() => {
    if (externalViewMode || !storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey) as T | null;
      if (saved && allowedModes.includes(saved)) {
        setViewModeState(saved);
      }
    } catch {}
  }, [externalViewMode, storageKey, allowedModes]);

  const setViewMode = (next: T) => {
    setViewModeState(next);
    onViewModeChange?.(next);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, next);
      } catch {}
    }
  };

  const cycleViewMode = () => {
    const currentIndex = order.indexOf(viewMode);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % order.length;
    setViewMode(order[nextIndex]);
  };

  return { viewMode, setViewMode, cycleViewMode };
}
