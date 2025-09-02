"use client";

import { Label } from "@/components/ui/label";
import type { Congregation } from "@/lib/db/congregations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, MapPinned } from "lucide-react";
import { CongregationMembers } from "../congregation/CongregationMembers";

function formatDay(d: number | undefined) {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  if (d == null) return "";
  const idx = Math.max(0, Math.min(6, d));
  return names[idx];
}

interface CongregationViewProps {
  data: Congregation;
  onEdit?: () => void;
  canEdit?: boolean;
}

export function CongregationView({ data, onEdit, canEdit }: CongregationViewProps) {
  const googleMapsHref = (() => {
    if (data.lat != null && data.lng != null) {
      return `https://www.google.com/maps/dir/?api=1&destination=${data.lat},${data.lng}`;
    }
    if (data.address) {
      return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(data.address)}`;
    }
    return undefined;
  })();

  const time12 = (t?: string | null) => {
    if (!t) return "";
    const [hh, mm] = String(t).slice(0,5).split(":").map((n)=>Number(n));
    if (Number.isNaN(hh) || Number.isNaN(mm)) return String(t).slice(0,5);
    const am = hh < 12;
    const h12 = ((hh % 12) || 12);
    return `${h12}:${String(mm).padStart(2,'0')} ${am ? 'AM' : 'PM'}`;
  };

  return (
    <div className="space-y-6 pb-4"> {/* Remove pb-24 since parent handles it */}
      {/* Congregation Details Card */}
      <section className="rounded-md border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-base font-medium">{data.name}</div>
            {data?.business_witnessing_enabled ? (
              <Badge variant="outline" className="text-[10px] px-2 py-0.5 whitespace-nowrap">BWI Enabled</Badge>
            ) : null}
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <button className="rounded-md border px-3 py-2 text-sm hover:bg-muted inline-flex items-center gap-1" onClick={onEdit}>
                <Pencil className="h-4 w-4" /> Edit
              </button>
            )}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-0.5 text-sm">
            <Label className="opacity-70">Address</Label>
            <div className="font-medium break-words flex items-center gap-2">
              <span className="flex-1">{data.address || "—"}</span>
              {googleMapsHref && (
                <a className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted" href={googleMapsHref} target="_blank" rel="noreferrer">
                  <MapPinned className="h-3.5 w-3.5" />
                  Directions
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-0.5 text-sm">
            <Label className="opacity-70">Midweek</Label>
            <div className="font-medium">{formatDay(data.midweek_day)} • {time12(data.midweek_start)}</div>
          </div>
          <div className="grid gap-0.5 text-sm">
            <Label className="opacity-70">Weekend</Label>
            <div className="font-medium">{formatDay(data.weekend_day)} • {time12(data.weekend_start)}</div>
          </div>
        </div>
        {(data.lat != null && data.lng != null) && (
          <div className="grid gap-0.5 text-sm">
            <Label className="opacity-70">GPS</Label>
            <div className="font-medium">{data.lat}, {data.lng}</div>
          </div>
        )}
      </section>

      {/* Congregation Members Component */}
      <CongregationMembers 
        congregationId={data.id!} // Add ! to assert non-null
      />
    </div>
  );
}
