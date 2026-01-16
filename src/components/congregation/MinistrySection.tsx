"use client";

import { useState, useEffect } from "react";
import { Calendar, BookOpen, Users, Clock, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Congregation } from "@/lib/db/congregations";
import { listEventSchedules, type EventSchedule } from "@/lib/db/eventSchedules";
import { formatTimeLabel, isEventOccurringToday } from "@/lib/utils/recurrence";

interface MinistrySectionProps {
  congregationData: Congregation;
}

// Helper to check if an event should appear today

export function MinistrySection({ congregationData }: MinistrySectionProps) {
  const [todayEvents, setTodayEvents] = useState<EventSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadTodayEvents() {
      if (!congregationData.id) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const allEvents = await listEventSchedules(congregationData.id);
        const today = new Date();
        const filtered = allEvents.filter(event => isEventOccurringToday(event, today));
        setTodayEvents(filtered);
      } catch (error) {
        console.error('Error loading today events:', error);
        setTodayEvents([]);
      } finally {
        setLoading(false);
      }
    }
    
    loadTodayEvents();
  }, [congregationData.id]);
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Today
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">Loading...</p>
            </div>
          ) : todayEvents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">No ministry events scheduled for today</p>
            </div>
          ) : (
            <div className="divide-y">
              {todayEvents.map((event) => (
                <div key={event.id} className="px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">{event.title}</h4>
                        {event.ministry_type && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 leading-none">
                            {event.ministry_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        )}
                        {event.recurrence_pattern !== 'none' && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 leading-none">
                            Recurring
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {!event.is_all_day && event.start_time && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {formatTimeLabel(event.start_time)}
                              {event.end_time && ` → ${formatTimeLabel(event.end_time)}`}
                            </span>
                          </div>
                        )}
                        {event.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}
                      </div>
                      
                      {event.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{event.description}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Bible Studies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No active Bible studies</p>
            <p className="text-sm">Bible studies will appear here when added</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ministry Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No assignments available</p>
            <p className="text-sm">Ministry assignments will appear here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
