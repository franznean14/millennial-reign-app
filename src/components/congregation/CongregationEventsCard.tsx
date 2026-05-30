"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronRight, LayoutList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormModal } from "@/components/shared/FormModal";
import { VisitList } from "@/components/visit/VisitList";
import { EventScheduleAllList } from "@/components/congregation/EventScheduleAllList";
import { EventScheduleListRow } from "@/components/congregation/EventScheduleListRow";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import {
  getStudyBibleDarkCardShade,
  studyBibleSectionToggle,
  studyBibleDarkClasses,
} from "@/lib/theme/study-bible-dark";
import type { EventSchedule } from "@/lib/db/eventSchedules";
import { getNextOccurrenceOnOrAfter } from "@/lib/utils/recurrence";
import {
  buildNonMinistryEventScheduleRows,
  getEventScheduleListPrimaryLabel,
  type EventScheduleAllRow,
} from "@/lib/utils/event-schedule-display";
import { EventScheduleDetailPanel } from "@/components/congregation/EventScheduleDetailPanel";

const PREVIEW_LIMIT = 5;

/** Right-sheet headers: keep safe-area top inset (FormModal merges this after its defaults). */
const EVENT_SHEET_HEADER_PT =
  "pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1.25rem)]";

export interface CongregationEventsCardProps {
  events: EventSchedule[];
  loading: boolean;
  /** When null, shows join-congregation empty state (home). */
  congregationId?: string | null;
  onEventPress: (event: EventSchedule) => void;
  showChevron?: boolean;
  allSheetTitle?: ReactNode;
  /** Default sheet title label when `allSheetTitle` is omitted. */
  allSheetTitleLabel?: string;
  upcomingEmptyTitle?: string;
  upcomingEmptyHint?: string;
  allEmptyText?: string;
  noCongregationMessage?: string;
  /** Optional block above the card (e.g. Congregation admin heading). */
  header?: ReactNode;
  /** When set, opens read-only detail in a right sheet on tablet (home). Omit when parent handles press (admin edit). */
  detailInteraction?: "sheet" | "none";
}

/**
 * Shared Upcoming / All events card for Home Events tab and Congregation Admin.
 */
export function CongregationEventsCard({
  events,
  loading,
  congregationId = null,
  onEventPress,
  showChevron = false,
  allSheetTitle,
  allSheetTitleLabel = "Events",
  upcomingEmptyTitle = "No upcoming events scheduled.",
  upcomingEmptyHint,
  allEmptyText = "No events scheduled.",
  noCongregationMessage = "Join a congregation to see upcoming events.",
  header,
  detailInteraction = "none",
}: CongregationEventsCardProps) {
  const isMdUp = useMediaQuery("(min-width: 768px)");
  const [activeTab, setActiveTab] = useState<"soon" | "all">("soon");
  const [showDrawer, setShowDrawer] = useState(false);
  const [detailEvent, setDetailEvent] = useState<EventSchedule | null>(null);
  const activeTabRef = useRef<"soon" | "all">("soon");
  const allTabPointerDownRef = useRef<"soon" | "all">("soon");

  const upcomingRows = useMemo(() => {
    const now = new Date();
    const rows: { event: EventSchedule; nextDate: string }[] = [];
    for (const ev of events) {
      if (ev.event_type === "ministry") continue;
      if (ev.status !== "active") continue;
      const next = getNextOccurrenceOnOrAfter(ev, now);
      if (next) rows.push({ event: ev, nextDate: next });
    }
    rows.sort((a, b) => a.nextDate.localeCompare(b.nextDate) || a.event.title.localeCompare(b.event.title));
    return rows;
  }, [events]);

  const allRows = useMemo(() => buildNonMinistryEventScheduleRows(events), [events]);
  const previewRows = upcomingRows.slice(0, PREVIEW_LIMIT);
  const eventListClassName = cn("divide-y", studyBibleDarkClasses.divider);
  const eventsAllSheetShade = getStudyBibleDarkCardShade("cong-events-all-list-sheet:v1");

  const sheetTitle =
    allSheetTitle ?? (
      <span className="flex w-full flex-wrap items-center justify-center gap-2 text-center text-lg font-bold">
        <Calendar className="h-5 w-5" />
        {allSheetTitleLabel}
        {allRows.length > 0 ? (
          <Badge variant="secondary" className="font-normal tabular-nums text-xs">
            {allRows.length} {allRows.length === 1 ? "event" : "events"}
          </Badge>
        ) : null}
      </span>
    );

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "all" && isMdUp) {
      setShowDrawer(true);
    }
  }, [activeTab, isMdUp]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as "soon" | "all");
    if (value !== "all") {
      setShowDrawer(false);
    }
  };

  const handleAllTabPointerDown = () => {
    allTabPointerDownRef.current = activeTabRef.current;
  };

  const handleAllTabClick = (e: React.MouseEvent) => {
    if (allTabPointerDownRef.current === "all") {
      e.preventDefault();
      e.stopPropagation();
      setShowDrawer(true);
    }
  };

  const handlePress = (event: EventSchedule) => {
    if (detailInteraction === "sheet") {
      setDetailEvent(event);
    } else {
      onEventPress(event);
    }
  };

  const renderRow = (row: { event: EventSchedule; nextDate: string }) => (
    <EventScheduleListRow
      event={row.event}
      displayYmd={row.nextDate}
      onClick={() => handlePress(row.event)}
      showChevron={showChevron}
    />
  );

  const renderRowAll = (row: EventScheduleAllRow, { isOccurringToday }: { isOccurringToday: boolean }) => (
    <EventScheduleListRow
      event={row.event}
      displayYmd={row.displayYmd}
      onClick={() => handlePress(row.event)}
      statusHint={row.hasNext ? undefined : "past"}
      showChevron={showChevron}
      isToday={isOccurringToday}
    />
  );

  const showInlineAllList = !isMdUp;

  return (
    <section>
      {header}
      <div className={cn("mt-3 md:mt-0 rounded-lg border overflow-hidden", studyBibleDarkClasses.bwiCard)}>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className={cn("grid-cols-2", studyBibleSectionToggle.cardTabList)}>
            <TabsTrigger
              value="soon"
              className={cn(
                studyBibleSectionToggle.cardTabTrigger,
                studyBibleSectionToggle.cardTabTriggerLeft,
                "px-3 transition-colors duration-200"
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-4 w-4 shrink-0" />
                Upcoming
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="all"
              onPointerDown={handleAllTabPointerDown}
              onClick={handleAllTabClick}
              className={cn(
                studyBibleSectionToggle.cardTabTrigger,
                studyBibleSectionToggle.cardTabTriggerRight,
                "px-3 transition-colors duration-200"
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <LayoutList className="h-4 w-4 shrink-0" />
                All
              </span>
              {activeTab === "all" ? <ChevronRight className="h-4 w-4 opacity-70" /> : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="soon" className={studyBibleSectionToggle.cardTabContent}>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : congregationId === null && noCongregationMessage ? (
              <p className="text-sm text-muted-foreground text-center py-6">{noCongregationMessage}</p>
            ) : previewRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{upcomingEmptyTitle}</p>
                {upcomingEmptyHint ? <p className="text-sm mt-1">{upcomingEmptyHint}</p> : null}
              </div>
            ) : (
              <VisitList
                items={previewRows}
                getKey={(r) => r.event.id ?? `${r.nextDate}-${r.event.title}`}
                renderItem={(row) => renderRow(row)}
                className={eventListClassName}
                emptyText=""
              />
            )}
          </TabsContent>

          <TabsContent
            value="all"
            className={cn(
              studyBibleSectionToggle.cardTabContent,
              showInlineAllList && "max-h-[min(70vh,520px)] overflow-y-auto scrollbar-hide"
            )}
          >
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : congregationId === null && noCongregationMessage ? (
              <p className="text-sm text-muted-foreground text-center py-6">{noCongregationMessage}</p>
            ) : showInlineAllList ? (
              <EventScheduleAllList
                rows={allRows}
                renderRow={renderRowAll}
                isEmpty={allRows.length === 0}
                emptyText={allEmptyText}
                className={eventListClassName}
              />
            ) : (
              <div className="py-6 px-4 text-center">
                <p className={cn("text-sm", studyBibleDarkClasses.muted)}>
                  {allRows.length === 0 ? allEmptyText : `${allRows.length} events — open the panel →`}
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <FormModal
        open={showDrawer}
        onOpenChange={setShowDrawer}
        desktopPresentation="right-sheet"
        className={eventsAllSheetShade}
        drawerContentClassName={eventsAllSheetShade}
        description="All congregation event schedules."
        title={sheetTitle}
        headerClassName={cn("px-4 pb-3", EVENT_SHEET_HEADER_PT, "items-center text-center")}
        bodyClassName="md:pb-6"
      >
        <div className="relative max-h-[70vh] overflow-y-auto pb-[calc(max(env(safe-area-inset-bottom),0px)+40px)] md:max-h-none md:overflow-visible md:pb-0">
          {allRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{allEmptyText}</p>
          ) : (
            <EventScheduleAllList
              rows={allRows}
              renderRow={renderRowAll}
              className={eventListClassName}
              emptyText=""
            />
          )}
        </div>
      </FormModal>

      {detailInteraction === "sheet" ? (
        <FormModal
          open={detailEvent != null}
          onOpenChange={(open) => {
            if (!open) setDetailEvent(null);
          }}
          desktopPresentation="right-sheet"
          className={eventsAllSheetShade}
          drawerContentClassName={eventsAllSheetShade}
          title={detailEvent ? getEventScheduleListPrimaryLabel(detailEvent) : "Event"}
          titleClassName="text-center md:text-left"
          headerClassName={cn(
            "px-4 pb-3 items-center md:items-start",
            EVENT_SHEET_HEADER_PT,
            "text-center md:text-left"
          )}
          bodyClassName="md:pb-6"
        >
          {detailEvent ? (
            <EventScheduleDetailPanel
              event={detailEvent}
              className="pb-[calc(max(env(safe-area-inset-bottom),0px)+24px)] md:pb-0"
            />
          ) : null}
        </FormModal>
      ) : null}
    </section>
  );
}
