"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronRight, LayoutList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormModal } from "@/components/shared/FormModal";
import { EventScheduleFormSheet } from "@/components/congregation/EventScheduleFormSheet";
import { EventScheduleListRow } from "@/components/congregation/EventScheduleListRow";
import { VisitList } from "@/components/visit/VisitList";
import { cn } from "@/lib/utils";
import { studyBibleSectionToggle, studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";
import { getEventTypeAccentClass } from "@/lib/utils/event-type-accent";
import {
  formatEventTypeLabel,
  listEventSchedules,
  readCachedEventSchedules,
  type EventSchedule,
} from "@/lib/db/eventSchedules";
import { formatTimeLabel, getNextOccurrenceOnOrAfter } from "@/lib/utils/recurrence";
import {
  formatEventDetailPrimaryDate,
  getEventScheduleListPrimaryLabel,
  isCalendarDateRange,
} from "@/lib/utils/event-schedule-display";
import { eventTypeImpliesKingdomHall } from "@/lib/utils/event-location-display";
import { EventScheduleLocationBlock } from "@/components/congregation/EventScheduleLocationBlock";

const PREVIEW_LIMIT = 5;

interface AdminRow {
  event: EventSchedule;
  displayYmd: string;
  hasNext: boolean;
}

interface CongregationAdminEventsCardProps {
  congregationId: string;
  canEdit: boolean;
}

export function CongregationAdminEventsCard({ congregationId, canEdit }: CongregationAdminEventsCardProps) {
  const [events, setEvents] = useState<EventSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"soon" | "all">("soon");
  const [showDrawer, setShowDrawer] = useState(false);
  const [detailEvent, setDetailEvent] = useState<EventSchedule | null>(null);
  const [editEvent, setEditEvent] = useState<EventSchedule | null>(null);
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

  /** All non-ministry schedules (includes past one-offs) for the full list. */
  const allRows = useMemo(() => {
    const now = new Date();
    const rows: AdminRow[] = [];
    for (const ev of events) {
      if (ev.event_type === "ministry") continue;
      if (ev.status !== "active") continue;
      const next = getNextOccurrenceOnOrAfter(ev, now);
      rows.push({
        event: ev,
        displayYmd: next ?? ev.start_date,
        hasNext: !!next,
      });
    }
    rows.sort(
      (a, b) =>
        a.displayYmd.localeCompare(b.displayYmd) || a.event.title.localeCompare(b.event.title)
    );
    return rows;
  }, [events]);

  const load = useCallback(async () => {
    if (!congregationId) {
      setLoading(false);
      setEvents([]);
      return;
    }
    setLoading(true);
    try {
      const fromIdb = await readCachedEventSchedules(congregationId);
      if (fromIdb && fromIdb.length > 0) {
        setEvents(fromIdb);
      }
      const list = await listEventSchedules(congregationId);
      setEvents(list);
    } catch (e) {
      console.error("CongregationAdminEventsCard: load failed", e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [congregationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load();
    window.addEventListener("event-schedule-refresh", onRefresh);
    return () => window.removeEventListener("event-schedule-refresh", onRefresh);
  }, [load]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value as "soon" | "all");
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

  const handleRowActivate = (event: EventSchedule) => {
    if (canEdit) {
      setEditEvent(event);
    } else {
      setDetailEvent(event);
    }
  };

  const eventListClassName = cn("divide-y", studyBibleDarkClasses.divider);

  const renderRowUpcoming = (row: { event: EventSchedule; nextDate: string }) => (
    <EventScheduleListRow
      event={row.event}
      displayYmd={row.nextDate}
      onClick={() => handleRowActivate(row.event)}
      showChevron={canEdit}
    />
  );

  const renderRowAll = (row: AdminRow) => (
    <EventScheduleListRow
      event={row.event}
      displayYmd={row.displayYmd}
      onClick={() => handleRowActivate(row.event)}
      statusHint={row.hasNext ? undefined : "past"}
      showChevron={canEdit}
    />
  );

  const previewRows = upcomingRows.slice(0, PREVIEW_LIMIT);

  const detailNext = detailEvent && getNextOccurrenceOnOrAfter(detailEvent, new Date());

  return (
    <section className="space-y-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+8px)]">
      <h2 className="text-lg font-semibold">Congregation events</h2>
      <p className="text-sm text-muted-foreground">
        Non-ministry schedules. {canEdit ? "Tap an event to edit." : "Tap for details."}
      </p>

      <div className={cn("rounded-lg border overflow-hidden", studyBibleDarkClasses.bwiCard)}>
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
            ) : previewRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No upcoming non-ministry events.</p>
              </div>
            ) : (
              <VisitList
                items={previewRows}
                getKey={(r) => r.event.id ?? `${r.nextDate}-${r.event.title}`}
                renderItem={(row) => renderRowUpcoming(row)}
                className={eventListClassName}
                emptyText=""
              />
            )}
          </TabsContent>

          <TabsContent
            value="all"
            className={cn(studyBibleSectionToggle.cardTabContent, "max-h-[min(70vh,520px)] overflow-y-auto scrollbar-hide")}
          >
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <VisitList
                items={allRows}
                getKey={(r) => r.event.id ?? `${r.displayYmd}-${r.event.title}`}
                renderItem={(row) => renderRowAll(row)}
                isEmpty={allRows.length === 0}
                emptyText="No congregation events yet."
                className={eventListClassName}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>

      <FormModal
        open={showDrawer}
        onOpenChange={setShowDrawer}
        title={
          <span className="flex w-full flex-wrap items-center justify-center gap-2 text-center text-lg font-bold">
            <Calendar className="h-5 w-5" />
            Congregation events
            {allRows.length > 0 ? (
              <Badge variant="secondary" className="font-normal tabular-nums text-xs">
                {allRows.length} {allRows.length === 1 ? "event" : "events"}
              </Badge>
            ) : null}
          </span>
        }
        headerClassName="px-4 pt-4 pb-2 items-center text-center"
      >
        <div className="relative max-h-[70vh] overflow-y-auto pb-[calc(max(env(safe-area-inset-bottom),0px)+40px)]">
          {allRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No events.</p>
          ) : (
            <VisitList
              items={allRows}
              getKey={(r) => r.event.id ?? `${r.displayYmd}-${r.event.title}`}
              renderItem={(row) => renderRowAll(row)}
              className={eventListClassName}
              emptyText=""
            />
          )}
        </div>
      </FormModal>

      {canEdit ? (
        <EventScheduleFormSheet
          open={editEvent != null}
          onOpenChange={(open) => {
            if (!open) setEditEvent(null);
          }}
          congregationId={congregationId}
          initialData={editEvent}
          onSaved={async (saved) => {
            if (saved) {
              setEditEvent(null);
              await load();
              try {
                window.dispatchEvent(new CustomEvent("event-schedule-refresh"));
              } catch {
                /* ignore */
              }
            }
          }}
        />
      ) : null}

      {!canEdit && (
        <FormModal
          open={detailEvent != null}
          onOpenChange={(open) => {
            if (!open) setDetailEvent(null);
          }}
          title={detailEvent ? getEventScheduleListPrimaryLabel(detailEvent) : "Event"}
          headerClassName="text-center"
        >
          {detailEvent ? (
            <div className="space-y-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+24px)]">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={cn(getEventTypeAccentClass(detailEvent.event_type))}>
                  {formatEventTypeLabel(detailEvent.event_type)}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  {isCalendarDateRange(detailEvent) ? "Dates" : "Date"}
                </p>
                <p className="text-sm font-medium">
                  {formatEventDetailPrimaryDate(detailEvent, detailNext)}
                </p>
              </div>
              {!detailEvent.is_all_day && detailEvent.start_time ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Time</p>
                  <p className="text-sm">
                    {formatTimeLabel(detailEvent.start_time)}
                    {detailEvent.end_time ? (
                      <>
                        {" "}
                        <span className="text-muted-foreground">to</span>{" "}
                        {formatTimeLabel(detailEvent.end_time)}
                      </>
                    ) : null}
                  </p>
                </div>
              ) : detailEvent.is_all_day ? (
                <p className="text-sm text-muted-foreground">All day</p>
              ) : null}
              {!eventTypeImpliesKingdomHall(detailEvent.event_type) ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Location</p>
                  <EventScheduleLocationBlock event={detailEvent} />
                </div>
              ) : null}
              {detailEvent.description?.trim() ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{detailEvent.description.trim()}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </FormModal>
      )}
    </section>
  );
}
