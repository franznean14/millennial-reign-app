"use client";

import { useState } from "react";

type Item = [string, number];

export function TopStudies({ items }: { items: Item[] }) {
  const [showAll, setShowAll] = useState(false);
  const visible = items.slice(0, showAll ? 5 : 3);

  if (!items.length) return <div className="text-sm opacity-70">No studies recorded yet.</div>;

  return (
    <div className="space-y-2">
      <ul className="text-sm space-y-1">
        {visible.map(([name, count]) => (
          <li key={name} className="flex items-center justify-between">
            <span className="truncate pr-2">{name}</span>
            <span className="rounded-full border px-2 py-0.5 text-xs">{count}</span>
          </li>
        ))}
      </ul>
      {items.length > 3 && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className="text-xs opacity-70 hover:underline"
        >
          {showAll ? "Show top 3" : `Show top ${Math.min(5, items.length)}`}
        </button>
      )}
    </div>
  );
}

