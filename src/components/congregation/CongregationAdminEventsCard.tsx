"use client";

import { useCallback, useEffect, useState } from "react";
import { CongregationEventsCard } from "@/components/congregation/CongregationEventsCard";
import { EventScheduleFormSheet } from "@/components/congregation/EventScheduleFormSheet";
import { listEventSchedules, readCachedEventSchedules, type EventSchedule } from "@/lib/db/eventSchedules";

interface CongregationAdminEventsCardProps {
  congregationId: string;
  canEdit: boolean;
}

export function CongregationAdminEventsCard({ congregationId, canEdit }: CongregationAdminEventsCardProps) {
  const [events, setEvents] = useState<EventSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editEvent, setEditEvent] = useState<EventSchedule | null>(null);

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

  return (
    <>
      <CongregationEventsCard
        events={events}
        loading={loading}
        congregationId={congregationId}
        onEventPress={(event) => {
          if (canEdit) setEditEvent(event);
        }}
        showChevron={canEdit}
        detailInteraction={canEdit ? "none" : "sheet"}
        upcomingEmptyTitle="No upcoming non-ministry events."
        allEmptyText="No congregation events yet."
        allSheetTitleLabel="Congregation events"
        header={
          <h2 className="text-lg font-semibold pb-4">Congregation events</h2>
        }
      />

      {canEdit ? (
        <EventScheduleFormSheet
          open={editEvent != null}
          onOpenChange={(open) => {
            if (!open) setEditEvent(null);
          }}
          congregationId={congregationId}
          initialData={editEvent}
          desktopPresentation="right-sheet"
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
    </>
  );
}
