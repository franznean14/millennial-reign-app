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
  isLoading?: boolean;
}

export function VisitUpdatesSection({ 
  visits, 
  isHouseholderContext = false, 
  establishments = [], 
  selectedEstablishmentId, 
  householderId, 
  householderName,
  householderStatus,
  onVisitUpdated,
  isLoading = false
}: VisitUpdatesSectionProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editVisit, setEditVisit] = useState<VisitWithUser | null>(null);

  // Show only first 3 visits in main view
  const mainVisits = visits.slice(0, 3);

  const renderVisitEntry = (visit: VisitWithUser, index: number, isDrawer: boolean, total: number) => {
    const publisherName = getPublisherName(visit.publisher || null);

    const lineLengthClass = getTimelineLineClassWithPosition(isDrawer);
    const dotSizeClass = getTimelineDotSize();
    const avatarSizeClass = 'w-6 h-6'; // Match BWI visit history avatar size

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
            textClassName="text-[10px]"
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

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="relative flex items-start w-full">
              {i < 3 && (
                <div className="absolute left-[5px] top-[12px] w-0.5 h-[calc(100%+1rem)] bg-gray-500/60 z-0" />
              )}
              <div className="relative flex-shrink-0 z-10">
                <div className="w-3 h-3 bg-muted/60 rounded-full border-2 border-muted/60 blur-[2px] animate-pulse" />
              </div>
              <div className="flex-1 min-w-0 ml-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-4 bg-muted/60 rounded w-24 blur-[2px] animate-pulse" />
                  <div className="h-4 bg-muted/60 rounded w-16 blur-[2px] animate-pulse" />
                </div>
                <div className="flex items-center gap-1 mb-2">
                  <div className="h-3 w-3 bg-muted/60 rounded blur-[2px] animate-pulse" />
                  <div className="h-3 bg-muted/60 rounded w-32 blur-[2px] animate-pulse" />
                </div>
                <div className="h-3 bg-muted/60 rounded w-full max-w-[200px] blur-[2px] animate-pulse" />
              </div>
              <div className="flex-shrink-0 ml-4">
                <div className="w-6 h-6 bg-muted/60 rounded-full blur-[2px] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <VisitList
          items={mainVisits}
          getKey={(visit) => visit.id}
          renderItem={(visit, index, total) => renderVisitEntry(visit, index, false, total)}
          emptyText="No visit updates found."
        />
      )}

      <FormModal
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="All Visit Updates"
      >
        <div className="flex-1 overflow-y-auto p-4 pb-20">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="relative flex items-start w-full">
                  {i < 5 && (
                    <div className="absolute left-[5px] top-[12px] w-0.5 h-[calc(100%+1.5rem)] bg-gray-500/60 z-0" />
                  )}
                  <div className="relative flex-shrink-0 z-10">
                    <div className="w-3 h-3 bg-muted/60 rounded-full border-2 border-muted/60 blur-[2px] animate-pulse" />
                  </div>
                  <div className="flex-1 min-w-0 ml-4">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-4 bg-muted/60 rounded w-24 blur-[2px] animate-pulse" />
                      <div className="h-4 bg-muted/60 rounded w-16 blur-[2px] animate-pulse" />
                    </div>
                    <div className="flex items-center gap-1 mb-2">
                      <div className="h-3 w-3 bg-muted/60 rounded blur-[2px] animate-pulse" />
                      <div className="h-3 bg-muted/60 rounded w-32 blur-[2px] animate-pulse" />
                    </div>
                    <div className="h-3 bg-muted/60 rounded w-full max-w-[250px] blur-[2px] animate-pulse" />
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    <div className="w-6 h-6 bg-muted/60 rounded-full blur-[2px] animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <VisitList
              items={visits}
              getKey={(visit) => visit.id}
              renderItem={(visit, index, total) => renderVisitEntry(visit, index, true, total)}
              emptyText="No visit updates found."
            />
          )}
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
