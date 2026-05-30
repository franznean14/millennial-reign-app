"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { Congregation } from "@/lib/db/congregations";
import type { ContactWithDetails, VisitWithUser } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";
import { MeetingsSection } from "../congregation/MeetingsSection";
import { MinistrySection } from "../congregation/MinistrySection";
import { CongregationAdminEventsCard } from "../congregation/CongregationAdminEventsCard";

// Dynamic import to avoid circular dependencies
type CongregationMembersCardProps = {
  congregationId: string;
  currentUserId: string | null;
  canManageCongregationUsers: boolean;
};
const CongregationMembers = dynamic<CongregationMembersCardProps>(
  () => import("../congregation/CongregationMembers").then((m) => m.CongregationMembers),
  { ssr: false }
);
const ContactDetails = dynamic(() => import("../business/ContactDetails").then(m => m.ContactDetails), { ssr: false });

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
  /** Elders and platform admins may edit other members; others get read-only Manage User. */
  canManageCongregationUsers?: boolean;
  initialTab?: 'meetings' | 'ministry' | 'admin';
  congregationTab?: 'meetings' | 'ministry' | 'admin';
  onCongregationTabChange?: (tab: 'meetings' | 'ministry' | 'admin') => void;
  userId?: string | null;
  isElder?: boolean;
  selectedContact: ContactWithDetails | null;
  selectedContactDetails: {
    contact: ContactWithDetails;
    visits: VisitWithUser[];
    establishment?: { id: string; name: string } | null;
  } | null;
  contactDetailsLoading: boolean;
  onSelectContact: (contact: ContactWithDetails | null) => void;
  onSelectContactDetails: (details: {
    contact: ContactWithDetails;
    visits: VisitWithUser[];
    establishment?: { id: string; name: string } | null;
  } | null) => void;
  onClearSelectedContact: () => void;
  loadContactDetails: (contactId: string) => Promise<void>;
}

export function CongregationView({ data, onEdit, canEdit, canManageCongregationUsers = false, initialTab = 'meetings', congregationTab: externalCongregationTab, onCongregationTabChange: externalOnCongregationTabChange, userId, isElder = false, selectedContact, selectedContactDetails, contactDetailsLoading, onSelectContact, onSelectContactDetails, onClearSelectedContact, loadContactDetails }: CongregationViewProps) {
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
      onClearSelectedContact();
    }
  }, [congregationTab, onClearSelectedContact]);

  const selectedContactRef = useRef<ContactWithDetails | null>(null);
  const selectedContactDetailsRef = useRef<{
    contact: ContactWithDetails;
    visits: VisitWithUser[];
    establishment?: { id: string; name: string } | null;
  } | null>(null);
  const onSelectContactRef = useRef(onSelectContact);
  const onSelectContactDetailsRef = useRef(onSelectContactDetails);

  useEffect(() => {
    selectedContactRef.current = selectedContact;
  }, [selectedContact]);

  useEffect(() => {
    selectedContactDetailsRef.current = selectedContactDetails;
  }, [selectedContactDetails]);

  useEffect(() => {
    onSelectContactRef.current = onSelectContact;
  }, [onSelectContact]);

  useEffect(() => {
    onSelectContactDetailsRef.current = onSelectContactDetails;
  }, [onSelectContactDetails]);

  useEffect(() => {
    const handleContactUpdated = (updated: Partial<ContactWithDetails> & { id?: string }) => {
      if (!updated?.id) return;
      const currentContact = selectedContactRef.current;
      if (currentContact?.id === updated.id) {
        onSelectContactRef.current({ ...currentContact, ...updated });
      }
      const currentDetails = selectedContactDetailsRef.current;
      if (currentDetails?.contact?.id === updated.id) {
        onSelectContactDetailsRef.current({
          ...currentDetails,
          contact: { ...currentDetails.contact, ...updated }
        });
      }
    };

    const handleVisitAdded = (visit: any) => {
      const currentDetails = selectedContactDetailsRef.current;
      if (!currentDetails?.contact?.id || currentDetails.contact.id !== visit.contact_id) return;
      const existing = currentDetails.visits.find((v) => v.id === visit.id);
      if (existing) return;
      onSelectContactDetailsRef.current({
        ...currentDetails,
        visits: [visit, ...currentDetails.visits]
      });
    };

    const handleVisitUpdated = (visit: any) => {
      const currentDetails = selectedContactDetailsRef.current;
      if (!currentDetails?.contact?.id || currentDetails.contact.id !== visit.contact_id) return;
      onSelectContactDetailsRef.current({
        ...currentDetails,
        visits: currentDetails.visits.map((v) => (v.id === visit.id ? { ...v, ...visit } : v))
      });
    };

    businessEventBus.subscribe("contact-updated", handleContactUpdated);
    businessEventBus.subscribe("visit-added", handleVisitAdded);
    businessEventBus.subscribe("visit-updated", handleVisitUpdated);
    return () => {
      businessEventBus.unsubscribe("contact-updated", handleContactUpdated);
      businessEventBus.unsubscribe("visit-added", handleVisitAdded);
      businessEventBus.unsubscribe("visit-updated", handleVisitUpdated);
    };
  }, []);

  const handleContactOpen = useCallback(async (contact: ContactWithDetails) => {
    if (!contact?.id) return;
    onSelectContact(contact);
    try {
      await loadContactDetails(contact.id);
    } catch (error) {
      console.error("Failed to load contact details:", error);
    }
  }, [loadContactDetails, onSelectContact]);

  const ministryContactDetailsTitle =
    selectedContactDetails?.contact?.name ?? selectedContact?.name ?? "Contact Details";

  const ministryContactDetailsBody =
    selectedContact ? (
      <ContactDetails
        contact={selectedContactDetails?.contact || selectedContact}
        visits={selectedContactDetails?.visits || []}
        establishment={selectedContactDetails?.establishment || null}
        establishments={
          selectedContactDetails?.establishment ? [selectedContactDetails.establishment] : []
        }
        context="congregation"
        showEstablishment={false}
        publisherId={(selectedContactDetails?.contact || selectedContact).publisher_id ?? null}
        isLoading={contactDetailsLoading}
        preferLeftDetailPanel
        onBackClick={() => onClearSelectedContact()}
      />
    ) : null;

  return (
    <>
      <div className="space-y-6">
      
      {/* Meetings tab: keep mounted but hidden so member list state + cache path feel instant when switching tabs */}
      <div
        className={
          congregationTab === "meetings"
            ? "grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start md:gap-6"
            : "hidden"
        }
        aria-hidden={congregationTab !== "meetings"}
      >
        <MeetingsSection congregationData={data} />
        <CongregationMembers
          congregationId={data.id!}
          currentUserId={userId ?? null}
          canManageCongregationUsers={canManageCongregationUsers}
        />
      </div>

      {congregationTab === "ministry" && (
        <MinistrySection
          congregationData={data}
          userId={userId}
          onContactClick={handleContactOpen}
          canEdit={canEdit}
          selectedContact={selectedContact}
          onClearSelectedContact={onClearSelectedContact}
          contactDetailsTitle={ministryContactDetailsTitle}
          contactDetailsBody={ministryContactDetailsBody}
        />
      )}
      
      {congregationTab === "admin" && isElder && data.id ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:items-start md:gap-6">
          <div className="min-w-0">
            <CongregationAdminEventsCard congregationId={data.id} canEdit={!!canEdit} />
          </div>
        </div>
      ) : null}
      </div>
    </>
  );
}
