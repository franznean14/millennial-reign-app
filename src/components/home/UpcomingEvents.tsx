"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronRight, LayoutList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormModal } from "@/components/shared/FormModal";
import { VisitList } from "@/components/visit/VisitList";
import { EventScheduleListRow } from "@/components/congregation/EventScheduleListRow";
import { cn } from "@/lib/utils";
import { studyBibleSectionToggle, studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";
import { getEventTypeAccentClass } from "@/lib/utils/event-type-accent";
import { getProfile } from "@/lib/db/profiles";
import {
  formatEventTypeLabel,
  listEventSchedules,
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
import { cacheGet, cacheSet } from "@/lib/offline/store";

const PREVIEW_LIMIT = 5;

const UPCOMING_EVENTS_CACHE_PREFIX = "home:upcoming-events:v1:";

type UpcomingEventsCachePayload = {
  congregationId: string | null;
  events: EventSchedule[];
  updatedAt: number;
};

interface UpcomingEventsProps {
  userId: string;
}

export function UpcomingEvents({ userId }: UpcomingEventsProps) {
  const [events, setEvents] = useState<EventSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [congregationId, setCongregationId] = useState<string | null>(null);
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

  const load = useCallback(async (opts?: { force?: boolean }) => {
    if (!userId) {
      setLoading(false);
      setEvents([]);
      setCongregationId(null);
      return;
    }
    const force = opts?.force ?? false;
    const cacheKey = `${UPCOMING_EVENTS_CACHE_PREFIX}${userId}`;
    let hydratedFromCache = false;

    if (!force) {
      try {
        const cached = await cacheGet<UpcomingEventsCachePayload>(cacheKey);
        if (cached && Array.isArray(cached.events)) {
          setEvents(cached.events);
          setCongregationId(cached.congregationId ?? null);
          setLoading(false);
          hydratedFromCache = true;
        }
      } catch {
        /* ignore bad cache */
      }
    }

    if (!hydratedFromCache && !force) {
      setLoading(true);
    }

    try {
      const profile = await getProfile(userId);
      const cid = profile?.congregation_id ?? null;
      setCongregationId(cid);
      if (!cid) {
        setEvents([]);
        try {
          await cacheSet(cacheKey, {
            congregationId: null,
            events: [],
            updatedAt: Date.now(),
          } satisfies UpcomingEventsCachePayload);
        } catch {
          /* ignore */
        }
        return;
      }
      const list = await listEventSchedules(cid);
      setEvents(list);
      try {
        await cacheSet(cacheKey, {
          congregationId: cid,
          events: list,
          updatedAt: Date.now(),
        } satisfies UpcomingEventsCachePayload);
      } catch {
        /* ignore */
      }
    } catch (e) {
      console.error("UpcomingEvents: load failed", e);
      if (!hydratedFromCache && !force) {
        setEvents([]);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onRefresh = () => void load({ force: true });
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

  const renderRow = (row: { event: EventSchedule; nextDate: string }) => (
    <EventScheduleListRow
      event={row.event}
      displayYmd={row.nextDate}
      onClick={() => setDetailEvent(row.event)}
    />
  );

  const previewRows = upcomingRows.slice(0, PREVIEW_LIMIT);
  const eventListClassName = cn("divide-y", studyBibleDarkClasses.divider);

  const detailNext =
    detailEvent &&
    getNextOccurrenceOnOrAfter(detailEvent, new Date());

  return (
    <section>
      <div className={cn("mt-3 rounded-lg border overflow-hidden", studyBibleDarkClasses.bwiCard)}>
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
            ) : !congregationId ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Join a congregation to see upcoming events.
              </p>
            ) : previewRows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No upcoming events scheduled.</p>
                <p className="text-sm mt-1">Non-ministry congregation schedules will appear here.</p>
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

          <TabsContent value="all" className={cn(studyBibleSectionToggle.cardTabContent, "max-h-[min(70vh,520px)] overflow-y-auto scrollbar-hide")}>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : !congregationId ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Join a congregation to see upcoming events.
              </p>
            ) : (
              <VisitList
                items={upcomingRows}
                getKey={(r) => r.event.id ?? `${r.nextDate}-${r.event.title}`}
                renderItem={(row) => renderRow(row)}
                isEmpty={upcomingRows.length === 0}
                emptyText="No upcoming events scheduled."
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
            Events
            {upcomingRows.length > 0 ? (
              <Badge variant="secondary" className="font-normal tabular-nums text-xs">
                {upcomingRows.length} {upcomingRows.length === 1 ? "event" : "events"}
              </Badge>
            ) : null}
          </span>
        }
        headerClassName="px-4 pt-4 pb-2 items-center text-center"
      >
        <div
          className="relative max-h-[70vh] overflow-y-auto pb-[calc(max(env(safe-area-inset-bottom),0px)+40px)]"
        >
          {upcomingRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No upcoming events scheduled.</p>
          ) : (
            <VisitList
              items={upcomingRows}
              getKey={(r) => r.event.id ?? `${r.nextDate}-${r.event.title}`}
              renderItem={(row) => renderRow(row)}
              className={eventListClassName}
              emptyText=""
            />
          )}
        </div>
      </FormModal>

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
                {detailEvent && isCalendarDateRange(detailEvent) ? "Dates" : "Date"}
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
                      <span className="text-muted-foreground">to</span> {formatTimeLabel(detailEvent.end_time)}
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
    </section>
  );
}
