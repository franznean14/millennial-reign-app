"use client";

import { useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { EstablishmentWithDetails, ContactWithDetails } from "@/lib/db/business";
import type { VisitRecord } from "@/lib/utils/visit-history";
import { HomeView } from "@/components/views/HomeView";
import { SectionShell } from "@/components/shared/SectionShell";
import { studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";
import { cn } from "@/lib/utils";
import { isContactVisitType } from "@/lib/db/contact-supabase";

type BusinessTab = "establishments" | "contacts" | "map";
type HomeTab = "summary" | "events";

interface HomeSectionProps {
  portaledControls: React.ReactNode;
  userId: string;
  homeTab: HomeTab;
  bwiAreaFilter: string[];
  onBwiAreaChange: (areas: string[]) => void;
  onNavigateToCongregation: () => void;
  onNavigateToBusinessWithStatus?: (
    tab: "establishments" | "contacts",
    status: string,
    areas?: string | string[]
  ) => void;
  /** Simple navigate to BWI (business) section — e.g. for home Quick actions. */
  onNavigateToBusiness?: () => void;
  onSectionChange: (section: string) => void;
  currentSection: string;
  pushNavigation: (section: string) => void;
  setBusinessTab: (tab: BusinessTab) => void;
  setSelectedEstablishment: (establishment: EstablishmentWithDetails | null) => void;
  setSelectedContact: (contact: ContactWithDetails | null) => void;
  loadEstablishmentDetails: (establishmentId: string) => void;
  loadContactDetails: (contactId: string) => void;
}

export function HomeSection({
  portaledControls,
  userId,
  homeTab,
  bwiAreaFilter,
  onBwiAreaChange,
  onNavigateToCongregation,
  onNavigateToBusinessWithStatus,
  onNavigateToBusiness,
  onSectionChange,
  currentSection,
  pushNavigation,
  setBusinessTab,
  setSelectedEstablishment,
  setSelectedContact,
  loadEstablishmentDetails,
  loadContactDetails
}: HomeSectionProps) {
  const handleNavigateToTodoCall = useCallback(
    async (params: { establishmentId?: string; contactId?: string }) => {
      if (params.establishmentId) {
        setBusinessTab("establishments");
        pushNavigation(currentSection);
        await loadEstablishmentDetails(params.establishmentId);
        onSectionChange("business");
      } else if (params.contactId) {
        setBusinessTab("contacts");
        pushNavigation(currentSection);
        await loadContactDetails(params.contactId);
        onSectionChange("business");
      }
    },
    [
      currentSection,
      loadEstablishmentDetails,
      loadContactDetails,
      onSectionChange,
      pushNavigation,
      setBusinessTab,
    ]
  );

  const handleVisitClick = useCallback(
    async (visit: VisitRecord) => {
      if (visit.visit_type === "establishment" && visit.establishment_id) {
        try {
          const supabase = createSupabaseBrowserClient();
          const { data: establishment, error } = await supabase
            .from("business_establishments")
            .select(
              "id, name, area, statuses, lat, lng, floor, description, note, publisher_id, congregation_id"
            )
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
      } else if (isContactVisitType(visit.visit_type) && visit.contact_id) {
        try {
          const supabase = createSupabaseBrowserClient();
          const { data: contact, error } = await supabase
            .from("householders")
            .select(
              "id, name, statuses, note, establishment_id, publisher_id, lat, lng, created_at"
            )
            .eq("id", visit.contact_id)
            .maybeSingle();

          if (contact && !error) {
            // Allow navigation to contact details regardless of establishment_id
            // Personal contacts (contacts with publisher_id) may not have an establishment_id
            setSelectedContact(contact);
            setBusinessTab("contacts");
            pushNavigation(currentSection);
            loadContactDetails(contact.id);
            setTimeout(() => {
              onSectionChange("business");
            }, 100);
          } else if (error) {
            console.error("Error loading contact:", error);
          } else {
            alert("Contact not found. It may have been deleted.");
            return;
          }
        } catch (error) {
          console.error("Error loading contact:", error);
        }
      }
    },
    [
      currentSection,
      loadEstablishmentDetails,
      loadContactDetails,
      onSectionChange,
      pushNavigation,
      setBusinessTab,
      setSelectedEstablishment,
      setSelectedContact
    ]
  );

  return (
    <>
      {portaledControls}
      <SectionShell
        motionKey="home"
        className={cn(
          "relative flex-1 min-h-0 overflow-y-auto overscroll-none scrollbar-hide pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+64px)] md:pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+86px)] w-full max-w-full overflow-x-hidden pb-[calc(max(env(safe-area-inset-bottom),0px)+88px)]",
          studyBibleDarkClasses.page
        )}
      >
      <HomeView
        userId={userId}
        onVisitClick={handleVisitClick}
        onNavigateToCongregation={onNavigateToCongregation}
        onNavigateToBusinessWithStatus={onNavigateToBusinessWithStatus}
        onNavigateToBusiness={onNavigateToBusiness}
        onNavigateToTodoCall={handleNavigateToTodoCall}
        homeTab={homeTab}
        bwiAreaFilter={bwiAreaFilter}
        onBwiAreaChange={onBwiAreaChange}
      />
      </SectionShell>
    </>
  );
}
