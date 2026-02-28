"use client";

import React from "react";

interface VisitListProps<T> {
  items: T[];
  getKey: (item: T) => React.Key;
  renderItem: (item: T, index: number, total: number) => React.ReactNode;
  emptyText?: string;
  className?: string;
  emptyClassName?: string;
  isEmpty?: boolean;
}

export function VisitList<T>({
  items,
  getKey,
  renderItem,
  emptyText = "No calls recorded yet.",
  className = "space-y-4",
  emptyClassName = "text-muted-foreground",
  isEmpty
}: VisitListProps<T>) {
  if (isEmpty ?? items.length === 0) {
    return <div className={emptyClassName}>{emptyText}</div>;
  }

  return (
    <div className={className}>
      {items.map((item, index) => (
        <React.Fragment key={`${String(getKey(item) ?? "item")}-${index}`}>
          {renderItem(item, index, items.length)}
        </React.Fragment>
      ))}
    </div>
  );
}
