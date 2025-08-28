"use client";

import { useEffect, useMemo, useState } from "react";
import { getProfile, upsertProfile } from "@/lib/db/profiles";
import { DatePicker } from "@/components/ui/DatePicker";
import { toast } from "@/components/ui/sonner";
import type { Privilege, Profile, Role } from "@/lib/db/types";
import { Check } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PRIVILEGE_OPTIONS: Privilege[] = [
  "Elder",
  "Ministerial Servant",
  "Regular Pioneer",
  "Auxiliary Pioneer",
];

export function ProfileForm({ userId, initialEmail, initialProfile, onSaved }: { userId: string; initialEmail?: string | null; initialProfile?: Profile | null; onSaved?: (p: Profile) => void }) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile ?? null);
  const [loading, setLoading] = useState(!initialProfile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeZones, setTimeZones] = useState<string[]>([]);
  const [initialSnap, setInitialSnap] = useState<any>(null);
  const [dirty, setDirty] = useState(false);

  const snapshot = (p: Profile) => ({
    first_name: p.first_name?.trim() || "",
    last_name: p.last_name?.trim() || "",
    middle_name: (p.middle_name ?? "").trim(),
    date_of_birth: p.date_of_birth || null,
    date_of_baptism: p.date_of_baptism || null,
    privileges: Array.isArray(p.privileges) ? [...p.privileges].sort() : [],
    avatar_url: p.avatar_url || null,
    time_zone: (p as any).time_zone || null,
    username: (p as any).username || null,
  });

  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
      setInitialSnap(snapshot(initialProfile));
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        const p = await getProfile(userId);
        if (mounted)
          setProfile(
            p ?? {
              id: userId,
              first_name: "",
              last_name: "",
              middle_name: "",
              date_of_birth: null,
              date_of_baptism: null,
              privileges: [],
              avatar_url: null,
              role: "user",
            }
          );
        if (mounted && p) setInitialSnap(snapshot(p));
      } catch (e: any) {
        if (mounted) setError("Failed to load profile. You can still edit and save to create it.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    // Load time zones list (best-effort)
    try {
      // @ts-ignore
      const tzs = typeof Intl !== "undefined" && (Intl as any).supportedValuesOf ? (Intl as any).supportedValuesOf("timeZone") : [];
      setTimeZones(tzs && tzs.length ? tzs : [
        "UTC",
        "America/New_York",
        "America/Chicago",
        "America/Denver",
        "America/Los_Angeles",
        "Europe/London",
        "Europe/Paris",
        "Asia/Dubai",
        "Asia/Singapore",
        "Asia/Tokyo",
        "Australia/Sydney",
      ]);
    } catch {}
    return () => {
      mounted = false;
    };
  }, [userId, initialProfile]);

  useEffect(() => {
    if (!profile || !initialSnap) return setDirty(false);
    const cur = snapshot(profile);
    setDirty(JSON.stringify(cur) !== JSON.stringify(initialSnap));
  }, [profile, initialSnap]);

  const onTogglePrivilege = (p: Privilege) => {
    if (!profile) return;
    const has = profile.privileges.includes(p);
    setProfile({ ...profile, privileges: has ? profile.privileges.filter((x) => x !== p) : [...profile.privileges, p] });
  };

  const canSave = useMemo(() => {
    if (!profile) return false;
    return profile.first_name.trim().length > 0 && profile.last_name.trim().length > 0;
  }, [profile]);

  const onSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const payload: Profile = { ...profile };
      // basic normalization
      payload.first_name = payload.first_name.trim();
      payload.last_name = payload.last_name.trim();
      if (payload.middle_name !== undefined && payload.middle_name !== null) {
        const t = String(payload.middle_name).trim();
        payload.middle_name = t.length ? t : null;
      }
      if (payload.date_of_baptism) {
        // Expect YYYY-MM-DD
        const d = payload.date_of_baptism;
        payload.date_of_baptism = d ? d : null;
      }
      if (payload.date_of_birth) {
        const d = payload.date_of_birth;
        payload.date_of_birth = d ? d : null;
      }
      const saved = await upsertProfile(payload);
      setProfile(saved);
      setInitialSnap(snapshot(saved));
      toast.success("Profile updated");
      if (onSaved) onSaved(saved);
    } catch (e: any) {
      setError(e.message ?? "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm opacity-70">Loading profile…</div>;
  if (!profile) return <div className="text-sm text-red-500">Could not load profile.</div>;

  return (
    <div className="space-y-4">
      {error ? <div className="text-sm text-red-500">{error}</div> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm sm:col-span-2">
          <span className="opacity-70">Username (optional)</span>
          <input
            className="rounded-md border bg-background px-3 py-2"
            value={(profile as any).username ?? ""}
            onChange={(e) => {
              const v = e.target.value.replace(/[^a-zA-Z0-9_.-]/g, "");
              setProfile({ ...(profile as any), username: v });
            }}
            placeholder="yourname"
          />
          <span className="text-[11px] opacity-60">3–32 chars, letters, numbers, dot, underscore, hyphen. Unique.</span>
        </label>
        <div className="grid gap-1 text-sm sm:col-span-2">
          <span className="opacity-70">Time Zone</span>
          <Select value={profile.time_zone ?? "auto"} onValueChange={(v) => setProfile({ ...profile, time_zone: v === "auto" ? null : v })}>
            <SelectTrigger>
              <SelectValue placeholder={`Auto (${Intl.DateTimeFormat().resolvedOptions().timeZone})`} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Suggested</SelectLabel>
                <SelectItem value="auto">Auto ({Intl.DateTimeFormat().resolvedOptions().timeZone})</SelectItem>
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>All Time Zones</SelectLabel>
                {timeZones.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="opacity-70">First Name</span>
          <input
            className="rounded-md border bg-background px-3 py-2"
            value={profile.first_name}
            onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
            placeholder="John"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="opacity-70">Last Name</span>
          <input
            className="rounded-md border bg-background px-3 py-2"
            value={profile.last_name}
            onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
            placeholder="Doe"
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="opacity-70">Middle Name (optional)</span>
          <input
            className="rounded-md border bg-background px-3 py-2"
            value={profile.middle_name ?? ""}
            onChange={(e) => setProfile({ ...profile, middle_name: e.target.value })}
            placeholder="A."
          />
        </label>
        <DatePicker
          label="Date of Birth"
          value={profile.date_of_birth}
          onChange={(val) => setProfile({ ...profile, date_of_birth: val })}
          mode="dialog"
        />
        <DatePicker
          label="Date of Baptism"
          value={profile.date_of_baptism}
          onChange={(val) => setProfile({ ...profile, date_of_baptism: val })}
          mode="dialog"
        />
      </div>
      {null}
      {/* Avatar is managed by auth provider; omitted in edit form */}
      {(profile.role === "admin" || profile.role === "superadmin") && (
        <div className="grid gap-2">
          <div className="flex items-center gap-2 text-sm opacity-70">
            <span>Privileges</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRIVILEGE_OPTIONS.map((p) => {
              const active = profile.privileges.includes(p);
              return (
                <button
                  type="button"
                  key={p}
                  onClick={() => onTogglePrivilege(p)}
                  className={`rounded-full border px-3 py-1 text-sm ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  aria-pressed={active}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>
      )}
      
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onSave}
          disabled={!canSave || saving || !dirty}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50 transition-opacity"
        >
          <Check className="h-4 w-4" />
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
