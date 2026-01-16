"use client";

import { useState, useEffect } from "react";
import { Calendar, BookOpen, Users, Clock, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Congregation } from "@/lib/db/congregations";
import { listEventSchedules, type EventSchedule } from "@/lib/db/eventSchedules";

interface MinistrySectionProps {
  congregationData: Congregation;
  userId?: string | null;
}

// Helper to check if an event should appear today
function isEventToday(event: EventSchedule, today: Date): boolean {
  // Only show active events
  if (event.status !== 'active') return false;
  
  // Only show ministry events
  if (event.event_type !== 'ministry') return false;
  
  const todayStr = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  const todayDayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
  const todayDayOfMonth = today.getDate();
  const todayMonth = today.getMonth() + 1; // 1-12
  
  // Check if event has started (today >= start_date)
  if (todayStr < event.start_date) return false;
  
  // Check if recurrence has ended
  if (event.recurrence_end_date && todayStr > event.recurrence_end_date) return false;
  
  // Handle one-time events (no recurrence)
  if (event.recurrence_pattern === 'none') {
    // Check if today is within the event date range
    if (todayStr >= event.start_date) {
      if (event.end_date) {
        return todayStr <= event.end_date;
      }
      return todayStr === event.start_date;
    }
    return false;
  }
  
  // Handle weekly recurrence
  if (event.recurrence_pattern === 'weekly') {
    if (event.day_of_week === null) return false;
    // Check if today matches the day of week
    if (event.day_of_week !== todayDayOfWeek) return false;
    // Check if we're past the start date
    if (todayStr < event.start_date) return false;
    // Check if the interval matches (e.g., every 2 weeks)
    const startDate = new Date(event.start_date);
    const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const weeksDiff = Math.floor(daysDiff / 7);
    // Check if today falls on the correct week interval
    return weeksDiff % event.recurrence_interval === 0;
  }
  
  // Handle monthly recurrence
  if (event.recurrence_pattern === 'monthly') {
    if (event.day_of_month === null) return false;
    // Check if today matches the day of month
    if (event.day_of_month !== todayDayOfMonth) return false;
    // Check if we're past the start date
    if (todayStr < event.start_date) return false;
    return true;
  }
  
  // Handle yearly recurrence
  if (event.recurrence_pattern === 'yearly') {
    if (event.month_of_year === null || event.day_of_month === null) return false;
    // Check if today matches the month and day
    if (event.month_of_year !== todayMonth || event.day_of_month !== todayDayOfMonth) return false;
    // Check if we're past the start date
    if (todayStr < event.start_date) return false;
    return true;
  }
  
  return false;
}

// Format time for display
function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours, 10);
  const am = h < 12;
  const h12 = h % 12 || 12;
  return `${h12}:${minutes.padStart(2, '0')} ${am ? 'AM' : 'PM'}`;
}

export function MinistrySection({ congregationData, userId }: MinistrySectionProps) {
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
        const filtered = allEvents.filter(event => isEventToday(event, today));
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
              {todayEvents.map((event, index) => (
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
                              {formatTime(event.start_time)}
                              {event.end_time && ` → ${formatTime(event.end_time)}`}
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
