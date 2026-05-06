"use client";

import { useCallback, useEffect, useState } from "react";

export type TableSortDir = "asc" | "desc";

export function usePersistedTableSort<T extends string>({
  storageKey,
  allowedColumns,
  defaultColumn,
  defaultDirs,
}: {
  storageKey: string;
  allowedColumns: readonly T[];
  defaultColumn: T;
  defaultDirs: Record<T, TableSortDir>;
}) {
  const defaultDirForColumn = useCallback(
    (column: T) => defaultDirs[column] ?? "asc",
    [defaultDirs]
  );

  const canonicalDefault = useCallback(
    (): { column: T; dir: TableSortDir } => ({
      column: defaultColumn,
      dir: defaultDirForColumn(defaultColumn),
    }),
    [defaultColumn, defaultDirForColumn]
  );

  /** `null` = use in-memory default until first client read of localStorage finishes. */
  const [hydratedSort, setHydratedSort] = useState<{
    column: T;
    dir: TableSortDir;
  } | null>(null);
  const [persistReady, setPersistReady] = useState(false);

  const sort = hydratedSort ?? canonicalDefault();

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setHydratedSort(null);
        return;
      }
      const parsed = JSON.parse(raw) as { column?: unknown; dir?: unknown };
      const col =
        typeof parsed.column === "string" && allowedColumns.includes(parsed.column as T)
          ? (parsed.column as T)
          : defaultColumn;
      const dir =
        parsed.dir === "asc" || parsed.dir === "desc"
          ? parsed.dir
          : defaultDirForColumn(col);
      setHydratedSort({ column: col, dir });
    } catch {
      setHydratedSort(null);
    } finally {
      setPersistReady(true);
    }
  }, [allowedColumns, defaultColumn, defaultDirForColumn, storageKey]);

  useEffect(() => {
    if (!persistReady) return;
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ column: sort.column, dir: sort.dir })
      );
    } catch {
      // ignore quota / private mode
    }
  }, [persistReady, sort.column, sort.dir, storageKey]);

  const toggleColumn = useCallback(
    (column: T) => {
      setHydratedSort((prev) => {
        const base = prev ?? canonicalDefault();
        if (base.column === column) {
          return {
            column,
            dir: base.dir === "asc" ? "desc" : "asc",
          };
        }
        return { column, dir: defaultDirForColumn(column) };
      });
    },
    [canonicalDefault, defaultDirForColumn]
  );

  return { sort, toggleColumn };
}
