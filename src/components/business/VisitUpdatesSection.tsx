"use client";

import React, { useState, useRef } from 'react';
import { ChevronRight, Calendar } from 'lucide-react';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import Image from 'next/image';
import { type VisitWithUser } from '@/lib/db/business';
import { getStatusTextColor, getBestStatus } from '@/lib/utils/status-hierarchy';
import { VisitForm } from './VisitForm';
import { useMobile } from '@/lib/hooks/use-mobile';
import { formatVisitDateShort, getPublisherName, getInitials } from '@/lib/utils/visit-history-ui';
import { VisitTimelineRow } from '@/components/visit/VisitTimelineRow';

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
  const drawerRef = useRef<HTMLDivElement>(null);
  const isMobile = useMobile();

  // Show only first 3 visits in main view
  const mainVisits = visits.slice(0, 3);

  const renderVisitEntry = (visit: VisitWithUser, index: number, isDrawer: boolean, total: number) => {
    const publisherName = getPublisherName(visit.publisher || null);
    const avatarUrl = visit.publisher?.avatar_url;

    const lineLengthClass = 'h-[calc(100%+1rem)]';
    const dotSizeClass = 'w-3 h-3';
    const avatarSizeClass = 'w-8 h-8'; // 10% smaller than w-9 h-9 (36px -> 32px)

    return (
      <VisitTimelineRow
        onClick={() => setEditVisit(visit)}
        index={index}
        total={total}
        rootClassName="hover:bg-muted/50 rounded-lg transition-colors"
        lineClassName={`left-[5px] top-[12px] ${lineLengthClass} z-0`}
        dot={
          <div
            className={`relative ${dotSizeClass} rounded-full flex-shrink-0 border-2 ${
              visit.householder_id
                ? getStatusTextColor(visit.householder?.status || 'potential')
                : getStatusTextColor(visit.establishment?.status || 'for_scouting')
            }`}
            style={{ zIndex: 1 }}
          />
        }
        contentClassName="ml-4"
        avatarClassName="ml-4"
        avatar={
          <>
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={publisherName}
                width={32}
                height={32}
                className={`rounded-full object-cover ring-2 ring-background ${avatarSizeClass}`}
              />
            ) : (
              <div className={`rounded-full bg-gray-600 flex items-center justify-center text-white text-xs ring-2 ring-background ${avatarSizeClass}`}>
                {getInitials(publisherName)}
              </div>
            )}
            {visit.partner && (
              <Image
                src={visit.partner.avatar_url || ''}
                alt={`${visit.partner.first_name} ${visit.partner.last_name}`}
                width={32}
                height={32}
                className={`rounded-full object-cover ring-2 ring-background -ml-2 ${avatarSizeClass}`}
              />
            )}
          </>
        }
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-foreground">
            {formatVisitDateShort(visit.visit_date)}
          </span>
          {visit.householder_id && visit.householder?.name && !isHouseholderContext && (
            <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusTextColor(visit.householder.status || 'potential')}`}>
              {visit.householder.name}
            </span>
          )}
          {visit.establishment_id && visit.establishment?.name && isHouseholderContext && (
            <span className={`text-xs px-2 py-0.5 rounded-full border ${getStatusTextColor(visit.establishment.status || 'for_scouting')}`}>
              {visit.establishment.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <Calendar className="h-3 w-3" />
          <span className="text-xs text-muted-foreground">
            {publisherName}
          </span>
        </div>
        {visit.note && (
          <div className={`text-xs text-muted-foreground leading-relaxed ${!isDrawer ? 'line-clamp-1' : ''}`}>
            {visit.note}
          </div>
        )}
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

      {visits.length === 0 ? (
        <div className="text-muted-foreground">No visit updates found.</div>
      ) : (
        <div className="space-y-4">
          {mainVisits.map((visit, index) => (
            <React.Fragment key={visit.id}>
              {renderVisitEntry(visit, index, false, mainVisits.length)}
            </React.Fragment>
          ))}
        </div>
      )}

      <ResponsiveModal
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="All Visit Updates"
      >
        <div ref={drawerRef} className="flex-1 overflow-y-auto p-4 pb-20">
          {visits.length === 0 ? (
            <div className="text-muted-foreground">No visit updates found.</div>
          ) : (
            <div className="space-y-4">
              {visits.map((visit, index) => (
                <React.Fragment key={visit.id}>
                  {renderVisitEntry(visit, index, true, visits.length)}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </ResponsiveModal>

      {/* Edit Visit Modal/Drawer */}
      {isMobile ? (
        <Drawer open={!!editVisit} onOpenChange={(o) => setEditVisit(o ? editVisit : null)}>
          <DrawerContent>
            <DrawerHeader className="text-center">
              <DrawerTitle>Edit Visit</DrawerTitle>
              <DrawerDescription>Update visit details</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
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
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={!!editVisit} onOpenChange={(o) => setEditVisit(o ? editVisit : null)}>
          <DialogContent>
            <DialogHeader className="text-center">
              <DialogTitle>Edit Visit</DialogTitle>
              <DialogDescription>Update visit details</DialogDescription>
            </DialogHeader>
            <div className="px-4">
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
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
