"use client";

import { useEffect, useState } from "react";
import { listMonthlyRecords } from "@/lib/db/monthlyRecords";
import type { MonthlyRecord } from "@/lib/db/types";
import { formatDateHuman } from "@/lib/utils";

export function MonthlyRecordsList({ userId, refreshKey }: { userId: string; refreshKey?: any }) {
  const [records, setRecords] = useState<MonthlyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await listMonthlyRecords(userId);
        if (mounted) setRecords(data);
      } catch (e: any) {
        if (mounted) setError(e.message ?? "Failed to load records");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userId, refreshKey]);

  if (loading) return <div className="text-sm opacity-70">Loading monthly records…</div>;
  if (error) return <div className="text-sm text-red-500">{error}</div>;
  if (!records.length) return <div className="text-sm opacity-70">No records yet.</div>;

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="grid grid-cols-6 bg-muted px-3 py-2 text-sm font-medium">
        <div className="col-span-2">Month</div>
        <div>Hours</div>
        <div>Studies</div>
        <div className="col-span-2">Note</div>
      </div>
      <ul className="divide-y">
        {records.map((r) => (
          <li key={r.id} className="grid grid-cols-6 px-3 py-2 text-sm">
            <div className="col-span-2 font-medium">{formatDateHuman(r.month)}</div>
            <div>{r.hours}</div>
            <div>{r.bible_studies}</div>
            <div className="col-span-2 truncate" title={r.note ?? undefined}>
              {r.note}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
