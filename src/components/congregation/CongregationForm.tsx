"use client";

import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { Congregation } from "@/lib/db/congregations";

const weekdays = [
  { v: 1, label: "Monday" },
  { v: 2, label: "Tuesday" },
  { v: 3, label: "Wednesday" },
  { v: 4, label: "Thursday" },
  { v: 5, label: "Friday" },
];
const weekendDays = [
  { v: 6, label: "Saturday" },
  { v: 0, label: "Sunday" },
];

export function CongregationForm({
  initial,
  canEdit,
  onSubmit,
  busy,
}: {
  initial: Congregation;
  canEdit: boolean;
  busy?: boolean;
  onSubmit: (c: Congregation) => Promise<void> | void;
}) {
  const defaults: Congregation = {
    name: "",
    address: "",
    lat: null,
    lng: null,
    midweek_day: 3,
    midweek_start: "19:00",
    weekend_day: 0,
    weekend_start: "10:00",
    meeting_duration_minutes: 105,
    business_witnessing_enabled: false,
  };
  const [form, setForm] = useState<Congregation>({ ...defaults, ...initial });
  const [gps, setGps] = useState<string>("");
  useEffect(() => {
    const next = { ...defaults, ...initial };
    setForm(next);
    // Seed GPS text from lat/lng when available
    if (next.lat != null && next.lng != null) setGps(`${next.lat}, ${next.lng}`);
    else setGps("");
  }, [initial?.id]);

  const disable = busy || !canEdit;
  const midweekLabel = useMemo(() => weekdays.find((d) => d.v === form.midweek_day)?.label ?? "", [form.midweek_day]);
  const weekendLabel = useMemo(() => weekendDays.find((d) => d.v === form.weekend_day)?.label ?? "", [form.weekend_day]);

  const parseGps = (input: string): { lat: number; lng: number } | null => {
    const nums = (input || "").trim().replace(/,/g, " ").split(/\s+/).filter(Boolean).map((s) => Number(s));
    if (nums.length < 2 || nums.some((n) => Number.isNaN(n))) return null;
    const a = nums[0];
    const b = nums[1];
    const inLat = (v: number) => v >= -90 && v <= 90;
    const inLng = (v: number) => v >= -180 && v <= 180;
    // Prefer a as lat when valid
    if (inLat(a) && inLng(b)) return { lat: a, lng: b };
    // If a can't be lat but can be lng, and b can be lat -> reversed
    if (!inLat(a) && inLng(a) && inLat(b)) return { lat: b, lng: a };
    // If both could be lat (ambiguous), assume a=lat, b=lng
    if (inLat(a) && inLat(b)) return { lat: a, lng: b };
    return null;
  };

  return (
    <form
      className="grid gap-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ ...form });
      }}
    >
      <div className="grid gap-1">
        <Label htmlFor="c-name">Name</Label>
        <Input
          id="c-name"
          className="rounded-md border bg-background px-3 py-2"
          placeholder="Congregation name"
          value={form.name ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
          disabled={disable}
        />
      </div>

      <div className="grid gap-1">
        <Label htmlFor="c-address">Address</Label>
        <Input
          id="c-address"
          className="rounded-md border bg-background px-3 py-2"
          placeholder="Street, City"
          value={form.address ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          disabled={disable}
        />
      </div>

      <div className="grid gap-3 grid-cols-2">
        <div className="grid gap-1">
          <Label>Midweek</Label>
          <Select
            value={String(form.midweek_day ?? 3)}
            onValueChange={(v) => setForm((f) => ({ ...f, midweek_day: Number(v) }))}
            disabled={disable}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="Select day" defaultValue={String(form.midweek_day)}>{midweekLabel}</SelectValue></SelectTrigger>
            <SelectContent>
              {weekdays.map((d) => (
                <SelectItem key={d.v} value={String(d.v)}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="c-midweek-time">Time</Label>
          <Input
            id="c-midweek-time"
            type="time"
            className="rounded-md border bg-background px-3 py-2 appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
            value={(form.midweek_start ?? "").slice(0, 5)}
            onChange={(e) => setForm((f) => ({ ...f, midweek_start: e.target.value }))}
            disabled={disable}
          />
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2">
        <div className="grid gap-1">
          <Label>Weekend</Label>
          <Select
            value={String(form.weekend_day ?? 0)}
            onValueChange={(v) => setForm((f) => ({ ...f, weekend_day: Number(v) }))}
            disabled={disable}
          >
            <SelectTrigger className="w-full"><SelectValue placeholder="Select day" defaultValue={String(form.weekend_day)}>{weekendLabel}</SelectValue></SelectTrigger>
            <SelectContent>
              {weekendDays.map((d) => (
                <SelectItem key={d.v} value={String(d.v)}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="c-weekend-time">Time</Label>
          <Input
            id="c-weekend-time"
            type="time"
            className="rounded-md border bg-background px-3 py-2 appearance-none [&::-webkit-calendar-picker-indicator]:hidden"
            value={(form.weekend_start ?? "").slice(0, 5)}
            onChange={(e) => setForm((f) => ({ ...f, weekend_start: e.target.value }))}
            disabled={disable}
          />
        </div>
      </div>

      <div className="grid gap-1">
        <Label htmlFor="c-gps">GPS</Label>
        <Input
          id="c-gps"
          className="rounded-md border bg-background px-3 py-2"
          placeholder="lat, lng or 'lat lng' or 'lng lat'"
          value={gps}
          onChange={(e) => {
            const v = e.target.value;
            setGps(v);
            const parsed = parseGps(v);
            if (!v.trim()) {
              setForm((f) => ({ ...f, lat: null, lng: null }));
            } else if (parsed) {
              setForm((f) => ({ ...f, lat: parsed.lat, lng: parsed.lng }));
            }
          }}
          disabled={disable}
        />
      </div>

      <div className="grid gap-1">
        <Label>Business Witnessing</Label>
        <div className="flex items-center justify-between rounded-md border px-3 py-2">
          <div className="text-sm opacity-80">Enable for this congregation</div>
          <Switch checked={!!form.business_witnessing_enabled} onCheckedChange={(v)=> setForm((f)=> ({...f, business_witnessing_enabled: v}))} disabled={disable} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" disabled={disable}>
          {initial?.id ? "Save changes" : "Create congregation"}
        </Button>
      </div>
    </form>
  );
}
