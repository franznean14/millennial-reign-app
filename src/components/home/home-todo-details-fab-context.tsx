"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type HomeTodoDetailsFabOverride = {
  showNewContact: boolean;
  establishments: Array<{ id: string; name: string }>;
  selectedEstablishmentId: string;
  householderId?: string;
  householderName?: string;
  householderStatus?: string;
  onAfterSave: () => void | Promise<void>;
  /** Left-sheet forms from UnifiedFab must stack above the nested contact pane (tablet). */
  stackLeftFormAboveNestedDetails?: boolean;
};

type CtxValue = {
  todoDetailsFabOverride: HomeTodoDetailsFabOverride | null;
  callsHistoryFabOverride: HomeTodoDetailsFabOverride | null;
  setTodoDetailsFabOverride: (next: HomeTodoDetailsFabOverride | null) => void;
  setCallsHistoryFabOverride: (next: HomeTodoDetailsFabOverride | null) => void;
};

const HomeTodoDetailsFabContext = createContext<CtxValue | null>(null);

export function HomeTodoDetailsFabProvider({ children }: { children: ReactNode }) {
  const [todoDetailsFabOverride, setTodoDetailsFabOverride] =
    useState<HomeTodoDetailsFabOverride | null>(null);
  const [callsHistoryFabOverride, setCallsHistoryFabOverride] =
    useState<HomeTodoDetailsFabOverride | null>(null);
  const value = useMemo(
    () => ({
      todoDetailsFabOverride,
      callsHistoryFabOverride,
      setTodoDetailsFabOverride,
      setCallsHistoryFabOverride,
    }),
    [todoDetailsFabOverride, callsHistoryFabOverride]
  );
  return <HomeTodoDetailsFabContext.Provider value={value}>{children}</HomeTodoDetailsFabContext.Provider>;
}

export function useHomeTodoDetailsFabOptional(): CtxValue | null {
  return useContext(HomeTodoDetailsFabContext);
}
