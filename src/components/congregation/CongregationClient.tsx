"use client";

import { useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { CongregationForm } from "@/components/congregation/CongregationForm";
import { CongregationView } from "@/components/congregation/CongregationView";
import { getMyCongregation, saveCongregation, isAdmin, type Congregation } from "@/lib/db/congregations";
import { getProfile } from "@/lib/db/profiles";
import { toast } from "@/components/ui/sonner";
import { ResponsiveModal } from "@/components/ui/responsive-modal";

export function CongregationClient() {
  const [uid, setUid] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [cong, setCong] = useState<Congregation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(async ({ data }) => {
      const id = data.session?.user?.id ?? null;
      setUid(id);
      if (!id) return setLoading(false);
      const p = await getProfile(id);
      setProfile(p);
      const isAdm = await isAdmin(id);
      setAdmin(isAdm);
      const c = await getMyCongregation();
      setCong(c);
      setLoading(false);
      // Auto-open create modal if none exists and user can create (admin)
      if (!c?.id && isAdm) {
        setMode("create");
        setModalOpen(true);
      }
    });
  }, []);

  const isElder = Array.isArray((profile as any)?.privileges) && (profile as any).privileges.includes('Elder');
  const canEdit = useMemo(() => {
    if (!uid) return false;
    // Create: admin only
    if (!cong?.id) return admin;
    // Update: elders of own congregation or admins
    const myCong = (profile as any)?.congregation_id;
    return admin || (isElder && myCong && cong?.id === myCong);
  }, [uid, profile, cong, admin, isElder]);

  if (loading) return <div className="text-sm opacity-70">Loading congregation…</div>;
  if (!uid) return <div className="text-sm opacity-70">Sign in to manage your congregation.</div>;
  if (!(isElder || admin)) {
    return (
      <div className="rounded-md border p-4">
        <div className="text-base font-medium">Insufficient privilege</div>
        <div className="mt-1 text-sm opacity-70">This area is for elders. Admins can also access for setup.</div>
      </div>
    );
  }

  const initial: Congregation = cong ?? {
    name: "",
    address: "",
    lat: null,
    lng: null,
    midweek_day: 3,
    midweek_start: "19:00",
    weekend_day: 0,
    weekend_start: "10:00",
    meeting_duration_minutes: 105,
  };

  return (
    <>
      {cong?.id ? (
        <CongregationView
          data={cong}
          canEdit={canEdit}
          onEdit={() => {
            if (!canEdit) return toast.error("You don't have permission to edit");
            setMode("edit");
            setModalOpen(true);
          }}
        />
      ) : (
        <section className="rounded-md border p-4 space-y-2">
          <div className="text-base font-medium">No congregation yet</div>
          <div className="text-sm opacity-70">{admin ? "Create your congregation to get started." : "Ask an admin to create your congregation."}</div>
        </section>
      )}

      <ResponsiveModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={mode === "edit" ? "Edit Congregation" : "Create Congregation"}
        description={mode === "edit" ? "Update meeting times and details for your congregation." : "Only admins can create a new congregation."}
        className="sm:max-w-[640px]"
      >
        <CongregationForm
          initial={initial}
          canEdit={canEdit}
          busy={busy}
          onSubmit={async (payload) => {
            if (!canEdit) return toast.error("You don't have permission to save");
            setBusy(true);
            try {
              const saved = await saveCongregation({ ...payload, id: cong?.id });
              if (saved) {
                setCong(saved);
                setModalOpen(false);
              }
            } finally {
              setBusy(false);
            }
          }}
        />
      </ResponsiveModal>
    </>
  );
}
