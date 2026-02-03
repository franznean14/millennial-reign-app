"use client";

import { useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { EstablishmentWithDetails, HouseholderWithDetails } from "@/lib/db/business";
import type { VisitRecord } from "@/lib/utils/visit-history";
import { HomeView } from "@/components/views/HomeView";
import { SectionShell } from "@/components/shared/SectionShell";

type BusinessTab = "establishments" | "householders" | "map";
type HomeTab = "summary" | "events";

interface HomeSectionProps {
  portaledControls: React.ReactNode;
  userId: string;
  homeTab: HomeTab;
  bwiAreaFilter: "all" | string;
  onBwiAreaChange: (area: "all" | string) => void;
  onNavigateToCongregation: () => void;
  onNavigateToBusinessWithStatus?: (
    tab: "establishments" | "householders",
    status: string,
    area?: string
  ) => void;
  onSectionChange: (section: string) => void;
  currentSection: string;
  pushNavigation: (section: string) => void;
  setBusinessTab: (tab: BusinessTab) => void;
  setSelectedEstablishment: (establishment: EstablishmentWithDetails | null) => void;
  setSelectedHouseholder: (householder: HouseholderWithDetails | null) => void;
  loadEstablishmentDetails: (establishmentId: string) => void;
  loadHouseholderDetails: (householderId: string) => void;
}

export function HomeSection({
  portaledControls,
  userId,
  homeTab,
  bwiAreaFilter,
  onBwiAreaChange,
  onNavigateToCongregation,
  onNavigateToBusinessWithStatus,
  onSectionChange,
  currentSection,
  pushNavigation,
  setBusinessTab,
  setSelectedEstablishment,
  setSelectedHouseholder,
  loadEstablishmentDetails,
  loadHouseholderDetails
}: HomeSectionProps) {
  const handleVisitClick = useCallback(
    async (visit: VisitRecord) => {
      if (visit.visit_type === "establishment" && visit.establishment_id) {
        try {
          const supabase = createSupabaseBrowserClient();
          const { data: establishment, error } = await supabase
            .from("business_establishments")
            .select("*")
            .eq("id", visit.establishment_id)
            .maybeSingle();

          if (establishment && !error) {
            setSelectedEstablishment(establishment);
            setBusinessTab("establishments");
            pushNavigation(currentSection);
            loadEstablishmentDetails(establishment.id);
            setTimeout(() => {
              onSectionChange("business");
            }, 100);
          } else if (error) {
            console.error("Error loading establishment:", error);
          } else {
            alert("Establishment not found. It may have been deleted.");
            return;
          }
        } catch (error) {
          console.error("Error loading establishment:", error);
        }
      } else if (visit.visit_type === "householder" && visit.householder_id) {
        try {
          const supabase = createSupabaseBrowserClient();
          const { data: householder, error } = await supabase
            .from("householders")
            .select("*")
            .eq("id", visit.householder_id)
            .maybeSingle();

          if (householder && !error) {
            // Allow navigation to householder details regardless of establishment_id
            // Personal contacts (householders with publisher_id) may not have an establishment_id
            setSelectedHouseholder(householder);
            setBusinessTab("householders");
            pushNavigation(currentSection);
            loadHouseholderDetails(householder.id);
            setTimeout(() => {
              onSectionChange("business");
            }, 100);
          } else if (error) {
            console.error("Error loading householder:", error);
          } else {
            alert("Householder not found. It may have been deleted.");
            return;
          }
        } catch (error) {
          console.error("Error loading householder:", error);
        }
      }
    },
    [
      currentSection,
      loadEstablishmentDetails,
      loadHouseholderDetails,
      onSectionChange,
      pushNavigation,
      setBusinessTab,
      setSelectedEstablishment,
      setSelectedHouseholder
    ]
  );

  return (
    <>
      {portaledControls}
      <SectionShell
        motionKey="home"
        className="relative h-[calc(100vh-80px)] overflow-y-auto overscroll-none pb-4 pt-[80px] w-full max-w-full overflow-x-hidden"
      >
      <HomeView
        userId={userId}
        onVisitClick={handleVisitClick}
        onNavigateToCongregation={onNavigateToCongregation}
        onNavigateToBusinessWithStatus={onNavigateToBusinessWithStatus}
        homeTab={homeTab}
        bwiAreaFilter={bwiAreaFilter}
        onBwiAreaChange={onBwiAreaChange}
      />
      </SectionShell>
    </>
  );
}
