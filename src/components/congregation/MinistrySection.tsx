"use client";

import { useState, useEffect } from "react";
import { Calendar, BookOpen, Users, Clock, MapPin, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { Congregation } from "@/lib/db/congregations";
import { listEventSchedules, type EventSchedule } from "@/lib/db/eventSchedules";
import { listHouseholders, type HouseholderWithDetails } from "@/lib/db/business";
import { formatTimeLabel, isEventOccurringToday } from "@/lib/utils/recurrence";
import { formatStatusText } from "@/lib/utils/formatters";
import { FormModal } from "@/components/shared/FormModal";

interface MinistrySectionProps {
  congregationData: Congregation;
  userId?: string | null;
  onContactClick?: (householder: HouseholderWithDetails) => void;
}

// Helper to check if an event should appear today

export function MinistrySection({ congregationData, userId, onContactClick }: MinistrySectionProps) {
  const [todayEvents, setTodayEvents] = useState<EventSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [bibleStudents, setBibleStudents] = useState<HouseholderWithDetails[]>([]);
  const [bibleStudentsLoading, setBibleStudentsLoading] = useState(false);
  const [contactsDrawerOpen, setContactsDrawerOpen] = useState(false);
  
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

  useEffect(() => {
    let active = true;

    async function loadBibleStudents() {
      if (!userId) {
        setBibleStudents([]);
        return;
      }

      try {
        setBibleStudentsLoading(true);
        const householders = await listHouseholders();
        if (!active) return;
        const owned = householders.filter(
          (householder) => householder.publisher_id && householder.publisher_id === userId
        );
        setBibleStudents(owned);
      } catch (error) {
        console.error("Error loading bible students:", error);
        if (active) setBibleStudents([]);
      } finally {
        if (active) setBibleStudentsLoading(false);
      }
    }

    loadBibleStudents();
    return () => {
      active = false;
    };
  }, [userId]);

  const formatBibleStudentStatus = (status?: string | null) => {
    if (!status) return "";
    if (status === "bible_study") return "Bible Student";
    return formatStatusText(status);
  };
  
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
          <button
            type="button"
            className="w-full flex items-center justify-between gap-3 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setContactsDrawerOpen(true)}
          >
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Contacts
            </CardTitle>
            <ChevronRight className="h-4 w-4 opacity-70" />
          </button>
        </CardHeader>
        <CardContent className="p-0">
          {bibleStudentsLoading ? (
            <div className="text-center py-6 text-muted-foreground px-4">
              <p className="text-sm">Loading...</p>
            </div>
          ) : bibleStudents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground px-4">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No Bible students yet</p>
              <p className="text-sm">Bible students will appear here when assigned</p>
            </div>
          ) : (
            <div className="divide-y">
              {bibleStudents.slice(0, 3).map((householder) => {
                const initials = householder.name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("");

                return (
                  <div
                    key={householder.id}
                    className="px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    role="button"
                    tabIndex={0}
                    onClick={() => setContactsDrawerOpen(true)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setContactsDrawerOpen(true);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-[11px] font-semibold">
                          {initials || "BS"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium truncate">{householder.name}</p>
                          {householder.status && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 leading-none">
                              {formatBibleStudentStatus(householder.status)}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">
                            {householder.establishment_name || "Householder"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
          )}
        </CardContent>
      </Card>

      <FormModal
        open={contactsDrawerOpen}
        onOpenChange={setContactsDrawerOpen}
        title="Contacts"
      >
        <div className="w-full h-[calc(70vh)] overflow-hidden flex flex-col overscroll-none">
          {/* Fixed Table Header */}
          <div className="flex-shrink-0 border-b bg-background">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-3 w-[65%]">Name</th>
                  <th className="text-left py-3 px-3 w-[35%]">Status</th>
                </tr>
              </thead>
            </table>
          </div>

          {/* Scrollable Table Body */}
          <div className="flex-1 overflow-y-auto no-scrollbar overscroll-none" style={{ overscrollBehavior: "contain", touchAction: "pan-y" }}>
            <table className="w-full text-sm table-fixed">
              <tbody>
                {bibleStudents.map((householder) => {
                  const initials = householder.name
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join("");

                  return (
                    <tr
                      key={householder.id}
                      className="border-b hover:bg-muted/30 cursor-pointer"
                      onClick={() => {
                        setContactsDrawerOpen(false);
                        onContactClick?.(householder);
                      }}
                    >
                      <td className="p-3 min-w-0 w-[65%]">
                        <div className="flex items-center gap-3 min-w-0">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="text-[10px] font-semibold">{initials || "BS"}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{householder.name}</span>
                        </div>
                      </td>
                      <td className="p-3 w-[35%]">
                        {householder.status ? (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 leading-none">
                            {formatBibleStudentStatus(householder.status)}
                          </Badge>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </FormModal>

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
