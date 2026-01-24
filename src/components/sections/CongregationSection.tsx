"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { SectionShell } from "@/components/shared/SectionShell";
import dynamic from "next/dynamic";
import { toast } from "@/components/ui/sonner";
import type { Congregation } from "@/lib/db/congregations";
import type { HouseholderWithDetails, VisitWithUser } from "@/lib/db/business";

const CongregationForm = dynamic(() => import("@/components/congregation/CongregationForm").then((m) => m.CongregationForm), {
  ssr: false
});
const FormModal = dynamic(() => import("@/components/shared/FormModal").then((m) => m.FormModal), {
  ssr: false
});
const CongregationView = dynamic(() => import("@/components/views/CongregationView").then((m) => m.CongregationView), {
  ssr: false
});
// FAB handled by UnifiedFab

export interface CongregationSectionProps {
  portaledControls: ReactNode;
  profileCongregationId?: string | null;
  cong: Congregation | null;
  admin: boolean;
  isElder: boolean;
  canEdit: boolean;
  congregationInitialTab: "meetings" | "ministry" | "admin" | undefined;
  congregationTab: "meetings" | "ministry" | "admin";
  setCongregationTab: Dispatch<SetStateAction<"meetings" | "ministry" | "admin">>;
  userId: string;
  selectedHouseholder: HouseholderWithDetails | null;
  selectedHouseholderDetails: {
    householder: HouseholderWithDetails;
    visits: VisitWithUser[];
    establishment?: { id: string; name: string } | null;
  } | null;
  onSelectHouseholder: (householder: HouseholderWithDetails | null) => void;
  onSelectHouseholderDetails: (details: {
    householder: HouseholderWithDetails;
    visits: VisitWithUser[];
    establishment?: { id: string; name: string } | null;
  } | null) => void;
  onClearSelectedHouseholder: () => void;
  loadHouseholderDetails: (householderId: string) => Promise<void>;
  modalOpen: boolean;
  setModalOpen: Dispatch<SetStateAction<boolean>>;
  mode: "edit" | "create";
  setMode: Dispatch<SetStateAction<"edit" | "create">>;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  initial: Congregation;
  setCong: Dispatch<SetStateAction<Congregation | null>>;
  saveCongregation: (payload: Congregation) => Promise<Congregation | null>;
}

export function CongregationSection({
  portaledControls,
  profileCongregationId,
  cong,
  admin,
  isElder,
  canEdit,
  congregationInitialTab,
  congregationTab,
  setCongregationTab,
  userId,
  selectedHouseholder,
  selectedHouseholderDetails,
  onSelectHouseholder,
  onSelectHouseholderDetails,
  onClearSelectedHouseholder,
  loadHouseholderDetails,
  modalOpen,
  setModalOpen,
  mode,
  setMode,
  busy,
  setBusy,
  initial,
  setCong,
  saveCongregation
}: CongregationSectionProps) {
  if (!profileCongregationId && !cong?.id && !admin) {
    return (
      <div className="rounded-md border p-4">
        <div className="text-base font-medium">No congregation assigned</div>
        <div className="mt-1 text-sm opacity-70">Ask an Elder in your congregation to add you.</div>
      </div>
    );
  }

  return (
    <>
      {portaledControls}
      <SectionShell motionKey="congregation" className="space-y-6 pb-20 pt-[80px]">
        {cong?.id ? (
          <CongregationView
            data={cong}
            onEdit={() => {
              if (!canEdit) return toast.error("You don't have permission to edit");
              setMode("edit");
              setModalOpen(true);
            }}
            canEdit={canEdit}
            initialTab={congregationInitialTab}
            congregationTab={congregationTab}
            onCongregationTabChange={setCongregationTab}
            userId={userId}
            selectedHouseholder={selectedHouseholder}
            selectedHouseholderDetails={selectedHouseholderDetails}
            onSelectHouseholder={onSelectHouseholder}
            onSelectHouseholderDetails={onSelectHouseholderDetails}
            onClearSelectedHouseholder={onClearSelectedHouseholder}
            loadHouseholderDetails={loadHouseholderDetails}
          />
        ) : (
          <section className="rounded-md border p-4 space-y-2">
            <div className="text-base font-medium">No congregation yet</div>
            <div className="text-sm opacity-70">
              {admin ? "The congregation form will open automatically when you visit this page." : "Ask an admin to create your congregation."}
            </div>
          </section>
        )}

        {/* FAB handled by UnifiedFab */}

        <FormModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title={mode === "edit" ? "Edit Congregation" : "Create Congregation"}
          description={
            mode === "edit" ? "Update meeting times and details for your congregation." : "Only admins can create a new congregation."
          }
        >
          <CongregationForm
            initial={initial}
            canEdit={canEdit}
            busy={busy}
            onSubmit={async (payload) => {
              if (!canEdit) {
                toast.error("You don't have permission to save");
                return;
              }
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
        </FormModal>
      </SectionShell>
    </>
  );
}
