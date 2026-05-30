"use client";

import { useCallback, useEffect, useState } from "react";
import { CongregationEventsCard } from "@/components/congregation/CongregationEventsCard";
import { getProfile } from "@/lib/db/profiles";
import { listEventSchedules, type EventSchedule } from "@/lib/db/eventSchedules";
import { cacheGet, cacheSet } from "@/lib/offline/store";

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

  return (
    <CongregationEventsCard
      events={events}
      loading={loading}
      congregationId={congregationId}
      onEventPress={() => {}}
      detailInteraction="sheet"
      upcomingEmptyHint="Non-ministry congregation schedules will appear here."
    />
  );
}
