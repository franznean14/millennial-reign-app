"use client";

import { useState } from "react";
import { upsertMonthlyRecord } from "@/lib/db/monthlyRecords";

export function MonthlyRecordForm({ userId, onSaved }: { userId: string; onSaved?: () => void }) {
  const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [hours, setHours] = useState<number | "">("");
  const [bibleStudies, setBibleStudies] = useState<number | "">("");
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = month && hours !== "" && bibleStudies !== "";

  const onSubmit = async () => {
    setSaving(true);
    setError(null);
    try {
      await upsertMonthlyRecord({
        user_id: userId,
        month,
        hours: Number(hours),
        bible_studies: Number(bibleStudies),
        note: note.trim() || null,
      });
      if (onSaved) onSaved();
    } catch (e: any) {
      setError(e.message ?? "Failed to save record");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="font-medium">Add/Update Monthly Record</h3>
      {error ? <div className="text-sm text-red-500">{error}</div> : null}
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="grid gap-1 text-sm">
          <span className="opacity-70">Month</span>
          <input className="rounded-md border bg-background px-3 py-2" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="opacity-70">Hours</span>
          <input
            className="rounded-md border bg-background px-3 py-2"
            type="number"
            min={0}
            value={hours}
            onChange={(e) => setHours(e.target.value === "" ? "" : Number(e.target.value))}
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="opacity-70">Bible Studies</span>
          <input
            className="rounded-md border bg-background px-3 py-2"
            type="number"
            min={0}
            value={bibleStudies}
            onChange={(e) => setBibleStudies(e.target.value === "" ? "" : Number(e.target.value))}
          />
        </label>
        <label className="grid gap-1 text-sm sm:col-span-4">
          <span className="opacity-70">Note</span>
          <textarea className="rounded-md border bg-background px-3 py-2" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <button
        type="button"
        disabled={!canSave || saving}
        onClick={onSubmit}
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Monthly Record"}
      </button>
    </div>
  );
}

