"use client";

import { useCallback, useEffect, useState } from "react";
import { getMyOpenTodoTargets, type MyOpenTodoTargets } from "@/lib/db/business";

const EMPTY_TARGETS: MyOpenTodoTargets = {
  establishmentIds: new Set(),
  householderIds: new Set(),
  openPoolEstablishmentIds: new Set(),
};

export function useMyOpenTodoTargets(userId: string | null | undefined) {
  const [targets, setTargets] = useState<MyOpenTodoTargets>(EMPTY_TARGETS);

  const refresh = useCallback(async () => {
    if (!userId) {
      setTargets(EMPTY_TARGETS);
      return;
    }
    const next = await getMyOpenTodoTargets(userId);
    setTargets(next);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onSync = () => void refresh();
    window.addEventListener("offline-sync-flushed", onSync);
    return () => window.removeEventListener("offline-sync-flushed", onSync);
  }, [refresh]);

  return { targets, refresh };
}
