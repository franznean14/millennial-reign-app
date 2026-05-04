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
  override: HomeTodoDetailsFabOverride | null;
  setHomeTodoDetailsFabOverride: (next: HomeTodoDetailsFabOverride | null) => void;
};

const HomeTodoDetailsFabContext = createContext<CtxValue | null>(null);

export function HomeTodoDetailsFabProvider({ children }: { children: ReactNode }) {
  const [override, setHomeTodoDetailsFabOverride] = useState<HomeTodoDetailsFabOverride | null>(null);
  const value = useMemo(
    () => ({ override, setHomeTodoDetailsFabOverride }),
    [override, setHomeTodoDetailsFabOverride]
  );
  return <HomeTodoDetailsFabContext.Provider value={value}>{children}</HomeTodoDetailsFabContext.Provider>;
}

export function useHomeTodoDetailsFabOptional(): CtxValue | null {
  return useContext(HomeTodoDetailsFabContext);
}
