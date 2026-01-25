"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { Congregation } from "@/lib/db/congregations";
import type { HouseholderWithDetails, VisitWithUser } from "@/lib/db/business";
import { Settings } from "lucide-react";
import { businessEventBus } from "@/lib/events/business-events";
import { MeetingsSection } from "../congregation/MeetingsSection";
import { MinistrySection } from "../congregation/MinistrySection";

// Dynamic import to avoid circular dependencies
type CongregationMembersCardProps = { congregationId: string; currentUserId: string | null };
const CongregationMembers = dynamic<CongregationMembersCardProps>(
  () => import("../congregation/CongregationMembers").then((m) => m.CongregationMembers),
  { ssr: false }
);
const HouseholderDetails = dynamic(() => import("../business/HouseholderDetails").then(m => m.HouseholderDetails), { ssr: false });

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
  initialTab?: 'meetings' | 'ministry' | 'admin';
  congregationTab?: 'meetings' | 'ministry' | 'admin';
  onCongregationTabChange?: (tab: 'meetings' | 'ministry' | 'admin') => void;
  userId?: string | null;
  isElder?: boolean;
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
}

export function CongregationView({ data, onEdit, canEdit, initialTab = 'meetings', congregationTab: externalCongregationTab, onCongregationTabChange: externalOnCongregationTabChange, userId, isElder = false, selectedHouseholder, selectedHouseholderDetails, onSelectHouseholder, onSelectHouseholderDetails, onClearSelectedHouseholder, loadHouseholderDetails }: CongregationViewProps) {
  const [internalCongregationTab, setInternalCongregationTab] = useState<'meetings' | 'ministry' | 'admin'>(initialTab);
  
  // Use external state if provided, otherwise use internal state
  const congregationTab = externalCongregationTab ?? internalCongregationTab;
  const setCongregationTab = externalOnCongregationTabChange ?? setInternalCongregationTab;
  
  // Update tab when initialTab prop changes
  useEffect(() => {
    if (initialTab) {
      if (externalOnCongregationTabChange) {
        externalOnCongregationTabChange(initialTab);
      } else {
        setInternalCongregationTab(initialTab);
      }
    }
  }, [initialTab, externalOnCongregationTabChange]);

  useEffect(() => {
    if (congregationTab !== "ministry") {
      onClearSelectedHouseholder();
    }
  }, [congregationTab, onClearSelectedHouseholder]);

  const selectedHouseholderRef = useRef<HouseholderWithDetails | null>(null);
  const selectedHouseholderDetailsRef = useRef<{
    householder: HouseholderWithDetails;
    visits: VisitWithUser[];
    establishment?: { id: string; name: string } | null;
  } | null>(null);
  const onSelectHouseholderRef = useRef(onSelectHouseholder);
  const onSelectHouseholderDetailsRef = useRef(onSelectHouseholderDetails);

  useEffect(() => {
    selectedHouseholderRef.current = selectedHouseholder;
  }, [selectedHouseholder]);

  useEffect(() => {
    selectedHouseholderDetailsRef.current = selectedHouseholderDetails;
  }, [selectedHouseholderDetails]);

  useEffect(() => {
    onSelectHouseholderRef.current = onSelectHouseholder;
  }, [onSelectHouseholder]);

  useEffect(() => {
    onSelectHouseholderDetailsRef.current = onSelectHouseholderDetails;
  }, [onSelectHouseholderDetails]);

  useEffect(() => {
    const handleHouseholderUpdated = (updated: Partial<HouseholderWithDetails> & { id?: string }) => {
      if (!updated?.id) return;
      const currentHouseholder = selectedHouseholderRef.current;
      if (currentHouseholder?.id === updated.id) {
        onSelectHouseholderRef.current({ ...currentHouseholder, ...updated });
      }
      const currentDetails = selectedHouseholderDetailsRef.current;
      if (currentDetails?.householder?.id === updated.id) {
        onSelectHouseholderDetailsRef.current({
          ...currentDetails,
          householder: { ...currentDetails.householder, ...updated }
        });
      }
    };

    const handleVisitAdded = (visit: any) => {
      const currentDetails = selectedHouseholderDetailsRef.current;
      if (!currentDetails?.householder?.id || currentDetails.householder.id !== visit.householder_id) return;
      const existing = currentDetails.visits.find((v) => v.id === visit.id);
      if (existing) return;
      onSelectHouseholderDetailsRef.current({
        ...currentDetails,
        visits: [visit, ...currentDetails.visits]
      });
    };

    const handleVisitUpdated = (visit: any) => {
      const currentDetails = selectedHouseholderDetailsRef.current;
      if (!currentDetails?.householder?.id || currentDetails.householder.id !== visit.householder_id) return;
      onSelectHouseholderDetailsRef.current({
        ...currentDetails,
        visits: currentDetails.visits.map((v) => (v.id === visit.id ? { ...v, ...visit } : v))
      });
    };

    businessEventBus.subscribe("householder-updated", handleHouseholderUpdated);
    businessEventBus.subscribe("visit-added", handleVisitAdded);
    businessEventBus.subscribe("visit-updated", handleVisitUpdated);
    return () => {
      businessEventBus.unsubscribe("householder-updated", handleHouseholderUpdated);
      businessEventBus.unsubscribe("visit-added", handleVisitAdded);
      businessEventBus.unsubscribe("visit-updated", handleVisitUpdated);
    };
  }, []);

  const handleContactOpen = useCallback(async (householder: HouseholderWithDetails) => {
    if (!householder?.id) return;
    onSelectHouseholder(householder);
    try {
      await loadHouseholderDetails(householder.id);
    } catch (error) {
      console.error("Failed to load householder details:", error);
    }
  }, [loadHouseholderDetails, onSelectHouseholder]);
  return (
    <>
      <div className="space-y-6">
      
      {/* Tab Content */}
      {congregationTab === 'meetings' && (
        <>
          <MeetingsSection congregationData={data} />
          <CongregationMembers 
            congregationId={data.id!} // Add ! to assert non-null
            currentUserId={userId ?? null}
          />
        </>
      )}
      
      {congregationTab === 'ministry' && (
        selectedHouseholder ? (
          <HouseholderDetails
            householder={selectedHouseholderDetails?.householder || selectedHouseholder}
            visits={selectedHouseholderDetails?.visits || []}
            establishment={selectedHouseholderDetails?.establishment || null}
            establishments={selectedHouseholderDetails?.establishment ? [selectedHouseholderDetails.establishment] : []}
            context="congregation"
            showEstablishment={false}
            publisherId={(selectedHouseholderDetails?.householder || selectedHouseholder).publisher_id ?? null}
            onBackClick={() => {
              onClearSelectedHouseholder();
            }}
          />
        ) : (
          <MinistrySection congregationData={data} userId={userId} onContactClick={handleContactOpen} canEdit={canEdit} />
        )
      )}
      
      {congregationTab === 'admin' && isElder && (
        <div className="space-y-4">
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Admin Section</p>
            <p className="text-sm">Admin features will appear here</p>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
