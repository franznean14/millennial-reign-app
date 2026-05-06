"use client";

import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { FormModal } from "@/components/shared/FormModal";
import { type VisitWithUser } from "@/lib/db/business";
import { CallForm } from "./CallForm";
import { formatVisitDateShort } from "@/lib/utils/visit-history-ui";
import { getStatusDotColor, getTimelineDotSize, getTimelineLineClassWithPosition } from "@/lib/utils/visit-timeline";
import { VisitTimelineRow } from "@/components/visit/VisitTimelineRow";
import { VisitList } from "@/components/visit/VisitList";
import { VisitAvatars } from "@/components/visit/VisitAvatars";
import { VisitRowContent } from "@/components/visit/VisitRowContent";
import { VisitStatusBadge } from "@/components/visit/VisitStatusBadge";
import {
  Drawer,
  DrawerHeader,
  DrawerTitle,
  DrawerWideLeftContent,
  DrawerWideLeftContentTop,
} from "@/components/ui/drawer";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

interface CallSectionProps {
  visits: VisitWithUser[];
  isHouseholderContext?: boolean;
  establishments?: Array<{ id?: string; name: string }>;
  selectedEstablishmentId?: string;
  householderId?: string;
  householderName?: string;
  householderStatus?: string;
  onVisitUpdated?: () => void;
  isLoading?: boolean;
  /** On tablet+, open full calls list in a left sheet (single column) instead of centered dialog / bottom sheet. */
  preferLeftDetailPanel?: boolean;
  /**
   * When true, this section renders inside the stacked contact pane (z-150). Left sheets must use the same
   * elevated stacking as Edit Call so they appear above the contact drawer.
   */
  insideStackedContactPane?: boolean;
}

export function CallSection({
  visits,
  isHouseholderContext = false,
  establishments = [],
  selectedEstablishmentId,
  householderId,
  householderName,
  householderStatus,
  onVisitUpdated,
  isLoading = false,
  preferLeftDetailPanel = false,
  insideStackedContactPane = false,
}: CallSectionProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editVisit, setEditVisit] = useState<VisitWithUser | null>(null);
  const isMdUp = useMediaQuery("(min-width: 768px)");
  const useLeftPanel = Boolean(preferLeftDetailPanel && isMdUp);
  const elevatedLeftPanels = Boolean(useLeftPanel && insideStackedContactPane);

  // Show only first 3 visits in main view
  const mainVisits = visits.slice(0, 3);

  const renderVisitEntry = (visit: VisitWithUser, index: number, isDrawer: boolean, total: number) => {
    const lineLengthClass = getTimelineLineClassWithPosition(isDrawer);
    const dotSizeClass = getTimelineDotSize();
    const avatarSizeClass = "h-5 w-5"; // Match home to-do assignee avatars

    return (
      <VisitTimelineRow
        onClick={() => setEditVisit(visit)}
        index={index}
        total={total}
        rootClassName={cn(
          "rounded-lg transition-colors",
          isDrawer
            ? "hover:bg-muted/50 dark:hover:bg-[#2a2534]/85"
            : "hover:bg-muted/50"
        )}
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
            publisherGuestName={visit.publisher_guest_name ?? null}
            partnerGuestName={visit.partner_guest_name ?? null}
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
            ) : undefined
          }
          notes={visit.note}
          notesClassName={cn(
            !isDrawer ? "leading-relaxed line-clamp-1" : "leading-relaxed",
            isDrawer && "dark:text-[#ded6e7]/90"
          )}
        />
      </VisitTimelineRow>
    );
  };

  const callsListExpandedBody = (forDrawer: boolean) => (
    <div
      className={
        forDrawer
          ? "min-h-0 flex-1 overflow-y-auto overscroll-contain bg-background px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2 dark:bg-[#181714]"
          : "flex-1 overflow-y-auto p-4 pb-20"
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="relative flex items-start w-full">
              {i < 5 && (
                <div
                  className={cn(
                    "absolute left-[5px] top-[12px] z-0 h-[calc(100%+1.5rem)] w-0.5",
                    forDrawer ? "bg-[#5a5068]/45 dark:bg-[#5a5068]/40" : "bg-gray-500/60"
                  )}
                />
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
                <div className="h-5 w-5 bg-muted/60 rounded-full blur-[2px] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <VisitList
          items={visits}
          getKey={(visit) => visit.id}
          renderItem={(visit, index, total) => renderVisitEntry(visit, index, true, total)}
          emptyText="No calls found."
        />
      )}
    </div>
  );

  const visitForm =
    editVisit ? (
      <CallForm
        establishments={establishments}
        selectedEstablishmentId={selectedEstablishmentId}
        initialVisit={editVisit}
        householderId={householderId}
        householderName={householderName}
        householderStatus={householderStatus}
        disableEstablishmentSelect={!!selectedEstablishmentId || !!householderId}
        onSaved={() => {
          setEditVisit(null);
          onVisitUpdated?.();
        }}
      />
    ) : null;

  return (
    <div className="bg-card p-4 rounded-lg shadow-md border dark:border-[#1c1921] dark:bg-[#30283c] dark:text-[#fffaff]">
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="flex items-center gap-2 text-base font-bold text-foreground hover:opacity-80 transition-opacity mb-4"
      >
        Calls
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
                <div className="h-5 w-5 bg-muted/60 rounded-full blur-[2px] animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <VisitList
          items={mainVisits}
          getKey={(visit) => visit.id}
          renderItem={(visit, index, total) => renderVisitEntry(visit, index, false, total)}
          emptyText="No calls found."
        />
      )}

      {useLeftPanel ? (
        <Drawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          direction="left"
          modal
          nested
          shouldScaleBackground={false}
        >
          {elevatedLeftPanels ? (
            <DrawerWideLeftContentTop
              stackAboveStackedRightSheet
              className="dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff] md:max-h-[100lvh]"
            >
              <DrawerHeader className="border-b border-border px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center sm:text-center dark:border-[#1c1921] dark:bg-[#181714]">
                <DrawerTitle className="text-center text-lg font-bold">Calls</DrawerTitle>
              </DrawerHeader>
              {callsListExpandedBody(true)}
            </DrawerWideLeftContentTop>
          ) : (
            <DrawerWideLeftContent className="dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff] md:max-h-[100lvh]">
              <DrawerHeader className="border-b border-border px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center sm:text-center dark:border-[#1c1921] dark:bg-[#181714]">
                <DrawerTitle className="text-center text-lg font-bold">Calls</DrawerTitle>
              </DrawerHeader>
              {callsListExpandedBody(true)}
            </DrawerWideLeftContent>
          )}
        </Drawer>
      ) : (
        <FormModal open={drawerOpen} onOpenChange={setDrawerOpen} title="Calls">
          {callsListExpandedBody(false)}
        </FormModal>
      )}

      {useLeftPanel ? (
        <Drawer
          open={!!editVisit}
          onOpenChange={(open) => {
            if (!open) setEditVisit(null);
          }}
          direction="left"
          modal
          nested
          shouldScaleBackground={false}
        >
          <DrawerWideLeftContentTop stackAboveStackedRightSheet className="dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff]">
            <DrawerHeader className="border-b border-border px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center dark:border-[#1c1921] dark:bg-[#181714]">
              <DrawerTitle className="text-center text-lg font-bold">Edit Call</DrawerTitle>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2">
              {visitForm}
            </div>
          </DrawerWideLeftContentTop>
        </Drawer>
      ) : (
        <FormModal
          open={!!editVisit}
          onOpenChange={(open) => {
            if (!open) {
              setEditVisit(null);
            }
          }}
          title="Edit Call"
          headerClassName="text-center"
        >
          {visitForm}
        </FormModal>
      )}
    </div>
  );
}
