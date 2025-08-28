"use client";

import { useEffect, useState } from "react";
import { getProfile } from "@/lib/db/profiles";
import type { Profile, Privilege } from "@/lib/db/types";
import { Calendar, Pencil } from "lucide-react";
import { privilegeChipClass } from "@/lib/ui/privileges";
import { formatDateHuman } from "@/lib/utils";

function Age({ dob }: { dob?: string | null }) {
  if (!dob) return null;
  const years = Math.max(0, Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)));
  return <span className="opacity-70">Age: {years}</span>;
}

export function ProfileView({ userId, email, onEdit, profile: initialProfile }: { userId?: string; email?: string | null; onEdit: () => void; profile?: Profile | null }) {
  const [profile, setProfile] = useState<Profile | null>(initialProfile ?? null);
  const [loading, setLoading] = useState(!initialProfile);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialProfile) {
      setProfile(initialProfile);
      setLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        if (!userId) {
          // No user context; show cached-less state
          setProfile(null);
          return;
        }
        const p = await getProfile(userId);
        if (mounted) setProfile(p);
      } catch (e: any) {
        if (mounted) setError(e.message ?? "Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userId, initialProfile]);

  if (loading) return <div className="text-sm opacity-70">Loading profile…</div>;
  if (error) return <div className="text-sm text-red-500">{error}</div>;
  if (!profile) return <div className="text-sm opacity-70">{userId ? "No profile yet. Tap Edit to create." : "You’re offline or not signed in. Sign in to edit your profile."}</div>;

  const fullName = [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ");

  return (
    <section className="rounded-md border p-4">
      <div className="flex items-start gap-4">
        <img
          src={profile.avatar_url ?? "/vercel.svg"}
          alt="Profile"
          className="h-20 w-20 rounded-full object-cover border bg-muted"
        />
        <div className="flex-1 min-w-0">
          <div className="mt-1 flex items-center gap-2 min-w-0">
            <h2 className="text-xl font-semibold truncate">{fullName || "Unnamed"}</h2>
            {!!userId && (
              <button onClick={onEdit} className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition-colors">
                <Pencil className="h-4 w-4" />
                Edit
              </button>
            )}
          </div>
          {profile.privileges?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.privileges.map((p: Privilege) => (
                <span key={p} className={privilegeChipClass(p)}>
                  {p}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex items-center gap-3 text-sm opacity-80 whitespace-nowrap">
            <Calendar className="h-4 w-4 shrink-0" />
            <span className="shrink-0">Baptism date: {formatDateHuman(profile.date_of_baptism, profile.time_zone || undefined)}</span>
            <span className="shrink-0">•</span>
            <span className="shrink-0"><Age dob={profile.date_of_birth} /></span>
          </div>
        </div>
      </div>
    </section>
  );
}
