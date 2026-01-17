"use client";

import React, { useState } from 'react';
import { ChevronRight, Calendar } from 'lucide-react';
import { FormModal } from '@/components/shared/FormModal';
import { type VisitWithUser } from '@/lib/db/business';
import { VisitForm } from './VisitForm';
import { formatVisitDateShort, getPublisherName } from '@/lib/utils/visit-history-ui';
import { getStatusDotColor, getTimelineDotSize, getTimelineLineClassWithPosition } from '@/lib/utils/visit-timeline';
import { VisitTimelineRow } from '@/components/visit/VisitTimelineRow';
import { VisitList } from '@/components/visit/VisitList';
import { VisitAvatars } from '@/components/visit/VisitAvatars';
import { VisitRowContent } from '@/components/visit/VisitRowContent';
import { VisitStatusBadge } from '@/components/visit/VisitStatusBadge';

interface VisitUpdatesSectionProps {
  visits: VisitWithUser[];
  isHouseholderContext?: boolean;
  establishments?: any[];
  selectedEstablishmentId?: string;
  householderId?: string;
  householderName?: string;
  householderStatus?: string;
  onVisitUpdated?: () => void;
}

export function VisitUpdatesSection({ 
  visits, 
  isHouseholderContext = false, 
  establishments = [], 
  selectedEstablishmentId, 
  householderId, 
  householderName,
  householderStatus,
  onVisitUpdated 
}: VisitUpdatesSectionProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editVisit, setEditVisit] = useState<VisitWithUser | null>(null);

  // Show only first 3 visits in main view
  const mainVisits = visits.slice(0, 3);

  const renderVisitEntry = (visit: VisitWithUser, index: number, isDrawer: boolean, total: number) => {
    const publisherName = getPublisherName(visit.publisher || null);

    const lineLengthClass = getTimelineLineClassWithPosition(isDrawer);
    const dotSizeClass = getTimelineDotSize();
    const avatarSizeClass = 'w-8 h-8'; // 10% smaller than w-9 h-9 (36px -> 32px)

    return (
      <VisitTimelineRow
        onClick={() => setEditVisit(visit)}
        index={index}
        total={total}
        rootClassName="hover:bg-muted/50 rounded-lg transition-colors"
        lineClassName={lineLengthClass}
        dot={
          <div
            className={`relative ${dotSizeClass} rounded-full flex-shrink-0 border-2 ${
              visit.householder_id
                ? getStatusDotColor(visit.householder?.status || "potential")
                : getStatusDotColor(visit.establishment?.status || "for_scouting")
            }`}
            style={{ zIndex: 1 }}
          />
        }
        contentClassName="ml-4"
        avatarClassName="ml-4"
        avatar={
          <VisitAvatars
            publisher={visit.publisher ?? null}
            partner={visit.partner ?? null}
            sizeClassName={avatarSizeClass}
            textClassName="text-xs"
          />
        }
      >
        <VisitRowContent
          title={formatVisitDateShort(visit.visit_date)}
          titleBadge={
            visit.householder_id && visit.householder?.name && !isHouseholderContext ? (
              <VisitStatusBadge
                status={visit.householder.status || "potential"}
                label={visit.householder.name}
              />
            ) : visit.establishment_id && visit.establishment?.name && isHouseholderContext ? (
              <VisitStatusBadge
                status={visit.establishment.status || "for_scouting"}
                label={visit.establishment.name}
              />
            ) : undefined
          }
          metaIcon={<Calendar className="h-3 w-3" />}
          metaText={publisherName}
          metaClassName="mb-2"
          notes={visit.note}
          notesClassName={!isDrawer ? "leading-relaxed line-clamp-1" : "leading-relaxed"}
        />
      </VisitTimelineRow>
    );
  };

  return (
    <div className="bg-card p-4 rounded-lg shadow-md border">
      <button
        onClick={() => setDrawerOpen(true)}
        className="flex items-center gap-2 text-base font-bold text-foreground hover:opacity-80 transition-opacity mb-4"
      >
        Visit Updates
        <ChevronRight className="h-4 w-4" />
      </button>

      <VisitList
        items={mainVisits}
        getKey={(visit) => visit.id}
        renderItem={(visit, index, total) => renderVisitEntry(visit, index, false, total)}
        emptyText="No visit updates found."
      />

      <FormModal
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="All Visit Updates"
      >
        <div className="flex-1 overflow-y-auto p-4 pb-20">
          <VisitList
            items={visits}
            getKey={(visit) => visit.id}
            renderItem={(visit, index, total) => renderVisitEntry(visit, index, true, total)}
            emptyText="No visit updates found."
          />
        </div>
      </FormModal>

      <FormModal
        open={!!editVisit}
        onOpenChange={(open) => {
          if (!open) {
                    setEditVisit(null);
          }
        }}
        title="Edit Visit"
        description="Update visit details"
        headerClassName="text-center"
      >
              {editVisit && (
                <VisitForm
                  establishments={establishments}
                  selectedEstablishmentId={selectedEstablishmentId}
                  initialVisit={editVisit}
                  householderId={householderId}
                  householderName={householderName}
                  householderStatus={householderStatus}
                  onSaved={() => {
                    setEditVisit(null);
                    onVisitUpdated?.();
                  }}
                />
              )}
      </FormModal>
    </div>
  );
}
