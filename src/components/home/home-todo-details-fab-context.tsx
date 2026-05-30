"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type HomeTodoDetailsFabOverride = {
  showNewContact: boolean;
  establishments: Array<{ id: string; name: string }>;
  selectedEstablishmentId: string;
  contactId?: string;
  contactName?: string;
  contactStatus?: string;
  onAfterSave: () => void | Promise<void>;
  /** Left-sheet forms from UnifiedFab must stack above the nested contact pane (tablet). */
  stackLeftFormAboveNestedDetails?: boolean;
};

/** Published by home {@link HomeTodoCard} (main widget) for list drawer + bulk-edit picker FAB. */
export type HomeTodoListFabBridge = {
  todoListDrawerOpen: boolean;
  bulkEditPickerOpen: boolean;
  canBulkEditTodos: boolean;
  selectedBulkEditCount: number;
};

export type HomeTodoListFabBridgeSlot = "belowXl" | "xlAndUp";

/** Home sheets that should sit above the FAB (everything except the main To-Do list drawer). */
export type HomeFabBlockingDrawerSlot =
  | "calls-list"
  | "calls-area"
  | "calls-filters"
  | "calls-details"
  | "calls-contact-sub"
  | "calls-entity-edit"
  | "todo-filter"
  | "todo-details"
  | "todo-contact-sub"
  | "todo-entity-edit";

type CtxValue = {
  todoDetailsFabOverride: HomeTodoDetailsFabOverride | null;
  callsHistoryFabOverride: HomeTodoDetailsFabOverride | null;
  homeTodoListFabBridge: HomeTodoListFabBridge | null;
  homeBlockingDrawerOpen: boolean;
  hideHomeFab: boolean;
  setTodoDetailsFabOverride: (next: HomeTodoDetailsFabOverride | null) => void;
  setCallsHistoryFabOverride: (next: HomeTodoDetailsFabOverride | null) => void;
  setHomeTodoListFabBridgeSlot: (
    slot: HomeTodoListFabBridgeSlot,
    next: HomeTodoListFabBridge | null
  ) => void;
  setHomeFabBlockingDrawer: (slot: HomeFabBlockingDrawerSlot, open: boolean) => void;
  setHideHomeFab: (next: boolean) => void;
};

const HomeTodoDetailsFabContext = createContext<CtxValue | null>(null);

export function HomeTodoDetailsFabProvider({ children }: { children: ReactNode }) {
  const [todoDetailsFabOverride, setTodoDetailsFabOverride] =
    useState<HomeTodoDetailsFabOverride | null>(null);
  const [callsHistoryFabOverride, setCallsHistoryFabOverride] =
    useState<HomeTodoDetailsFabOverride | null>(null);
  const [homeTodoListFabBridgeSlots, setHomeTodoListFabBridgeSlots] = useState<
    Partial<Record<HomeTodoListFabBridgeSlot, HomeTodoListFabBridge>>
  >({});
  const [hideHomeFab, setHideHomeFab] = useState(false);
  const [homeFabBlockingDrawers, setHomeFabBlockingDrawers] = useState<
    Partial<Record<HomeFabBlockingDrawerSlot, boolean>>
  >({});

  const setHomeFabBlockingDrawer = useCallback((slot: HomeFabBlockingDrawerSlot, open: boolean) => {
    setHomeFabBlockingDrawers((prev) => {
      if (!open) {
        const { [slot]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [slot]: true };
    });
  }, []);

  const homeBlockingDrawerOpen = useMemo(
    () => Object.values(homeFabBlockingDrawers).some(Boolean),
    [homeFabBlockingDrawers]
  );

  const setHomeTodoListFabBridgeSlot = useCallback(
    (slot: HomeTodoListFabBridgeSlot, next: HomeTodoListFabBridge | null) => {
      setHomeTodoListFabBridgeSlots((prev) => {
        if (!next) {
          const { [slot]: _removed, ...rest } = prev;
          return rest;
        }
        return { ...prev, [slot]: next };
      });
    },
    []
  );

  const homeTodoListFabBridge = useMemo((): HomeTodoListFabBridge | null => {
    const entries = Object.values(homeTodoListFabBridgeSlots);
    if (entries.length === 0) return null;
    return {
      todoListDrawerOpen: entries.some((entry) => entry.todoListDrawerOpen),
      bulkEditPickerOpen: entries.some((entry) => entry.bulkEditPickerOpen),
      canBulkEditTodos: entries.some((entry) => entry.canBulkEditTodos),
      selectedBulkEditCount: Math.max(0, ...entries.map((entry) => entry.selectedBulkEditCount)),
    };
  }, [homeTodoListFabBridgeSlots]);

  const value = useMemo(
    () => ({
      todoDetailsFabOverride,
      callsHistoryFabOverride,
      homeTodoListFabBridge,
      homeBlockingDrawerOpen,
      hideHomeFab,
      setTodoDetailsFabOverride,
      setCallsHistoryFabOverride,
      setHomeTodoListFabBridgeSlot,
      setHomeFabBlockingDrawer,
      setHideHomeFab,
    }),
    [
      todoDetailsFabOverride,
      callsHistoryFabOverride,
      homeTodoListFabBridge,
      homeBlockingDrawerOpen,
      hideHomeFab,
      setHomeTodoListFabBridgeSlot,
      setHomeFabBlockingDrawer,
    ]
  );
  return <HomeTodoDetailsFabContext.Provider value={value}>{children}</HomeTodoDetailsFabContext.Provider>;
}

export function useHomeTodoDetailsFabOptional(): CtxValue | null {
  return useContext(HomeTodoDetailsFabContext);
}
