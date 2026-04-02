"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronRight, LayoutList, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormModal } from "@/components/shared/FormModal";
import { VisitTimelineRow } from "@/components/visit/VisitTimelineRow";
import { VisitList } from "@/components/visit/VisitList";
import { getTimelineLineStyle } from "@/lib/utils/visit-timeline";
import { cn } from "@/lib/utils";
import {
  formatEventTypeLabel,
  listEventSchedules,
  type EventSchedule,
  type EventType,
} from "@/lib/db/eventSchedules";
import { formatTimeLabel, getNextOccurrenceOnOrAfter } from "@/lib/utils/recurrence";
import {
  formatEventDetailPrimaryDate,
  formatEventListDateLine,
  isCalendarDateRange,
} from "@/lib/utils/event-schedule-display";

const EventScheduleForm = dynamic(
  () => import("@/components/congregation/EventScheduleForm").then((m) => m.EventScheduleForm),
  { ssr: false }
);

const PREVIEW_LIMIT = 5;

function eventTypeAccent(eventType: EventType): string {
  switch (eventType) {
    case "meeting":
      return "border-sky-500 bg-sky-500/15 text-sky-200";
    case "memorial":
      return "border-violet-500 bg-violet-500/15 text-violet-200";
    case "circuit_overseer":
      return "border-amber-500 bg-amber-500/15 text-amber-200";
    case "cabr":
      return "border-emerald-500 bg-emerald-500/15 text-emerald-200";
    case "caco":
      return "border-cyan-500 bg-cyan-500/15 text-cyan-200";
    case "regional_convention":
      return "border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-200";
    default:
      return "border-muted-foreground/50 bg-muted/40 text-muted-foreground";
  }
}

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

  const renderRowUpcoming = (
    row: { event: EventSchedule; nextDate: string },
    index: number,
    total: number,
    isDrawer: boolean
  ) => {
    const { event, nextDate } = row;
    const accent = eventTypeAccent(event.event_type);
    return (
      <VisitTimelineRow
        onClick={() => handleRowActivate(event)}
        index={index}
        total={total}
        rootClassName={cn("transition-opacity", canEdit ? "hover:opacity-90 cursor-pointer" : "hover:opacity-90")}
        lineStyle={{
          ...getTimelineLineStyle(isDrawer),
          left: 11,
        }}
        dot={
          <div
            className={cn(
              "w-6 h-6 rounded-full border relative z-10 flex-shrink-0 flex items-center justify-center",
              accent
            )}
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden />
          </div>
        }
        contentClassName="ml-3"
      >
        <div className="min-w-0 pr-1">
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 leading-none", accent)}>
            {formatEventTypeLabel(event.event_type)}
          </Badge>
          <div className="text-sm font-medium text-foreground line-clamp-2 mt-1">{event.title}</div>
          <div
            className={cn(
              "flex items-center gap-1 text-xs text-muted-foreground mt-1",
              isDrawer && "mb-0.5"
            )}
          >
            <Calendar className="h-3 w-3 shrink-0" aria-hidden />
            <span className="min-w-0">{formatEventListDateLine(event, nextDate)}</span>
          </div>
          {event.location?.trim() ? (
            <div className="flex items-start gap-1 text-xs text-muted-foreground mt-1">
              <MapPin className="h-3 w-3 shrink-0 mt-0.5" aria-hidden />
              <span className="line-clamp-2 break-words">{event.location.trim()}</span>
            </div>
          ) : null}
        </div>
      </VisitTimelineRow>
    );
  };

  const renderRowAll = (row: AdminRow, index: number, total: number, isDrawer: boolean) => {
    const { event, displayYmd, hasNext } = row;
    const accent = eventTypeAccent(event.event_type);
    return (
      <VisitTimelineRow
        onClick={() => handleRowActivate(event)}
        index={index}
        total={total}
        rootClassName={cn("transition-opacity", canEdit ? "hover:opacity-90 cursor-pointer" : "hover:opacity-90")}
        lineStyle={{
          ...getTimelineLineStyle(isDrawer),
          left: 11,
        }}
        dot={
          <div
            className={cn(
              "w-6 h-6 rounded-full border relative z-10 flex-shrink-0 flex items-center justify-center",
              accent
            )}
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden />
          </div>
        }
        contentClassName="ml-3"
      >
        <div className="min-w-0 pr-1">
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 leading-none", accent)}>
            {formatEventTypeLabel(event.event_type)}
          </Badge>
          <div className="text-sm font-medium text-foreground line-clamp-2 mt-1">{event.title}</div>
          <div
            className={cn(
              "flex flex-wrap items-center gap-x-1 gap-y-0 text-xs text-muted-foreground mt-1",
              isDrawer && "mb-0.5"
            )}
          >
            <Calendar className="h-3 w-3 shrink-0" aria-hidden />
            <span className="min-w-0">{formatEventListDateLine(event, displayYmd)}</span>
            {!hasNext ? (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/80">(past / ended)</span>
            ) : null}
          </div>
          {event.location?.trim() ? (
            <div className="flex items-start gap-1 text-xs text-muted-foreground mt-1">
              <MapPin className="h-3 w-3 shrink-0 mt-0.5" aria-hidden />
              <span className="line-clamp-2 break-words">{event.location.trim()}</span>
            </div>
          ) : null}
        </div>
      </VisitTimelineRow>
    );
  };

  const previewRows = upcomingRows.slice(0, PREVIEW_LIMIT);

  const detailNext = detailEvent && getNextOccurrenceOnOrAfter(detailEvent, new Date());

  const locationLine = (event: EventSchedule) =>
    event.location?.trim() ? (
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
        <span>{event.location.trim()}</span>
      </div>
    ) : (
      <p className="text-sm text-muted-foreground">No location set</p>
    );

  return (
    <section className="space-y-3 pb-[calc(max(env(safe-area-inset-bottom),0px)+8px)]">
      <h2 className="text-lg font-semibold">Congregation events</h2>
      <p className="text-sm text-muted-foreground -mt-1">
        Non-ministry schedules. {canEdit ? "Tap an event to edit." : "Tap for details."}
      </p>

      <div className="rounded-lg border overflow-hidden bg-background">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-0 -mb-px p-0 h-auto bg-transparent gap-0 border-0 [&>*]:border-0 relative z-10">
            <TabsTrigger
              value="soon"
              className={cn(
                "rounded-tl-lg rounded-tr-none rounded-bl-none rounded-br-none",
                "bg-primary text-primary-foreground font-medium",
                "data-[state=active]:!bg-background data-[state=active]:!text-foreground",
                "shadow-none relative h-10 px-3 transition-colors duration-200",
                "hover:bg-primary/90 data-[state=active]:hover:!bg-background",
                "!border-0 focus-visible:ring-0 focus-visible:outline-none",
                "after:hidden"
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
                "rounded-tr-lg rounded-tl-none rounded-bl-none rounded-br-none",
                "bg-primary text-primary-foreground font-medium",
                "data-[state=active]:!bg-background data-[state=active]:!text-foreground",
                "shadow-none relative h-10 px-3 transition-colors duration-200",
                "hover:bg-primary/90 data-[state=active]:hover:!bg-background",
                "!border-0 focus-visible:ring-0 focus-visible:outline-none",
                "after:hidden"
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                <LayoutList className="h-4 w-4 shrink-0" />
                All
              </span>
              {activeTab === "all" ? <ChevronRight className="h-4 w-4 opacity-70" /> : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="soon" className="mt-0 rounded-b-lg bg-background p-4">
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
                renderItem={(row, index, total) => renderRowUpcoming(row, index, total, false)}
                className="space-y-6"
                emptyText=""
              />
            )}
          </TabsContent>

          <TabsContent
            value="all"
            className="mt-0 rounded-b-lg bg-background p-4 max-h-[min(70vh,520px)] overflow-y-auto scrollbar-hide"
          >
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <VisitList
                items={allRows}
                getKey={(r) => r.event.id ?? `${r.displayYmd}-${r.event.title}`}
                renderItem={(row, index, total) => renderRowAll(row, index, total, false)}
                isEmpty={allRows.length === 0}
                emptyText="No congregation events yet."
                className="space-y-6"
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
              renderItem={(row, index, total) => renderRowAll(row, index, total, true)}
              className="space-y-4"
              emptyText=""
            />
          )}
        </div>
      </FormModal>

      {canEdit ? (
        <FormModal
          open={editEvent != null}
          onOpenChange={(open) => {
            if (!open) setEditEvent(null);
          }}
          title="Edit Event Schedule"
          headerClassName="text-center"
        >
          {editEvent ? (
            <EventScheduleForm
              congregationId={congregationId}
              initialData={editEvent}
              isEditing
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
        </FormModal>
      ) : null}

      {!canEdit && (
        <FormModal
          open={detailEvent != null}
          onOpenChange={(open) => {
            if (!open) setDetailEvent(null);
          }}
          title={detailEvent?.title ?? "Event"}
          headerClassName="text-center"
        >
          {detailEvent ? (
            <div className="space-y-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+24px)]">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className={cn(eventTypeAccent(detailEvent.event_type))}>
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
              <div>
                <p className="text-xs text-muted-foreground mb-1">Location</p>
                {locationLine(detailEvent)}
              </div>
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
