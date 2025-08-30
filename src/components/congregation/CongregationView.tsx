"use client";

import { Label } from "@/components/ui/label";
import type { Congregation } from "@/lib/db/congregations";
import { Button } from "@/components/ui/button";

function formatDay(d: number | undefined) {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  if (d == null) return "";
  const idx = Math.max(0, Math.min(6, d));
  return names[idx];
}

export function CongregationView({ data, onEdit, canEdit }: { data: Congregation; onEdit?: () => void; canEdit?: boolean }) {
  const googleMapsHref = (() => {
    if (data.lat != null && data.lng != null) {
      return `https://www.google.com/maps/dir/?api=1&destination=${data.lat},${data.lng}`;
    }
    if (data.address) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(data.address)}`;
    }
    return undefined;
  })();

  const time = (t?: string | null) => (t ? String(t).slice(0, 5) : "");

  return (
    <section className="rounded-md border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-base font-medium">Congregation</div>
        <div className="flex gap-2">
          {googleMapsHref && (
            <a className="rounded-md border px-3 py-2 text-sm hover:bg-muted" href={googleMapsHref} target="_blank" rel="noreferrer">
              Get directions
            </a>
          )}
          {canEdit && (
            <button className="rounded-md border px-3 py-2 text-sm hover:bg-muted" onClick={onEdit}>Edit</button>
          )}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-0.5 text-sm">
          <Label className="opacity-70">Name</Label>
          <div className="font-medium">{data.name}</div>
        </div>
        <div className="grid gap-0.5 text-sm">
          <Label className="opacity-70">Address</Label>
          <div className="font-medium break-words">{data.address || "—"}</div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-0.5 text-sm">
          <Label className="opacity-70">Midweek</Label>
          <div className="font-medium">{formatDay(data.midweek_day)} • {time(data.midweek_start)}</div>
        </div>
        <div className="grid gap-0.5 text-sm">
          <Label className="opacity-70">Weekend</Label>
          <div className="font-medium">{formatDay(data.weekend_day)} • {time(data.weekend_start)}</div>
        </div>
      </div>
      {(data.lat != null && data.lng != null) && (
        <div className="grid gap-0.5 text-sm">
          <Label className="opacity-70">GPS</Label>
          <div className="font-medium">{data.lat}, {data.lng}</div>
        </div>
      )}
    </section>
  );
}

