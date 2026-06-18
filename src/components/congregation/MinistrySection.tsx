"use client";

import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { Calendar, BookOpen, Users, Clock, MapPin, ChevronRight, Map as MapIcon, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Congregation } from "@/lib/db/congregations";
import { listEventSchedules, readCachedEventSchedules, type EventSchedule } from "@/lib/db/eventSchedules";
import { formatEventLocationSummaryForDisplay } from "@/lib/utils/event-location-display";
import { listContacts, type ContactWithDetails } from "@/lib/db/business";
import { formatTimeLabel, isEventOccurringToday } from "@/lib/utils/recurrence";
import {
  CONTACTS_ALL_TAB,
  buildContactStatusTabValues,
  collectPresentContactStatuses,
  contactMatchesStatusTab,
  formatContactStatusLabel,
  formatContactStatusTabLabel,
} from "@/lib/utils/contact-status-tabs";
import { getBestContactStatus, getContactPrimaryStatus, getStatusTextColor, resolveContactStatuses, resolveDetailsDrawerTitle } from "@/lib/utils/status-hierarchy";
import { CONG_BWI_BADGE_CLASS } from "@/lib/utils/congregation-member-roles";
import { cn } from "@/lib/utils";
import { FormModal } from "@/components/shared/FormModal";
import { DetailsDrawer } from "@/components/shared/DetailsDrawer";
import { EventScheduleFormSheet } from "@/components/congregation/EventScheduleFormSheet";
import { businessEventBus } from "@/lib/events/business-events";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  getStudyBibleCongregationCardShade,
  getStudyBibleDarkCardShade,
  studyBibleDarkClasses,
  studyBibleSectionToggle,
} from "@/lib/theme/study-bible-dark";
import { mobileDataTableClasses } from "@/lib/theme/mobile-data-table";
import { MobileDataTableSortTh } from "@/components/shared/MobileDataTableSortTh";
import {
  usePersistedTableSort,
  type TableSortDir,
} from "@/lib/hooks/use-persisted-table-sort";
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerWideRightContent,
} from "@/components/ui/drawer";

const ministryTodayCardShade = getStudyBibleCongregationCardShade("ministryToday");
const ministryContactsCardShade = getStudyBibleCongregationCardShade("ministryContacts");
const ministryAssignmentsCardShade = getStudyBibleCongregationCardShade("ministryAssignments");
const ministrySchedulesPanelShade = getStudyBibleDarkCardShade("cong-ministry-schedules:v1");
const ministryContactsPanelShade = getStudyBibleDarkCardShade("cong-ministry-contacts:v1");

const MINISTRY_CONTACT_H2H_BADGE_CLASS =
  "border-sky-600/45 bg-sky-500/15 text-sky-900 dark:border-sky-400/45 dark:bg-sky-500/15 dark:text-sky-100";

type MinistryContactsTableSortKey = "name" | "status";
const MINISTRY_CONTACTS_TABLE_SORT_KEYS = ["name", "status"] as const satisfies readonly MinistryContactsTableSortKey[];
const MINISTRY_CONTACTS_TABLE_DEFAULT_DIRS: Record<MinistryContactsTableSortKey, TableSortDir> = {
  name: "asc",
  status: "asc",
};

function getMinistryContactSourceKind(contact: ContactWithDetails): "bwi" | "h2h" {
  return contact.establishment_id ? "bwi" : "h2h";
}

interface MinistrySectionProps {
  congregationData: Congregation;
  userId?: string | null;
  onContactClick?: (contact: ContactWithDetails) => void;
  canEdit?: boolean;
  selectedContact?: ContactWithDetails | null;
  onClearSelectedContact?: () => void;
  contactDetailsTitle?: string;
  contactDetailsBody?: ReactNode;
}

// Helper to check if an event should appear today

export function MinistrySection({
  congregationData,
  userId,
  onContactClick,
  canEdit = false,
  selectedContact = null,
  onClearSelectedContact,
  contactDetailsTitle = "Contact Details",
  contactDetailsBody = null,
}: MinistrySectionProps) {
  const [todayEvents, setTodayEvents] = useState<EventSchedule[]>([]);
  const [allMinistryEvents, setAllMinistryEvents] = useState<EventSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [bibleStudents, setBibleStudents] = useState<ContactWithDetails[]>([]);
  const [bibleStudentsLoading, setBibleStudentsLoading] = useState(false);
  const [contactsDrawerOpen, setContactsDrawerOpen] = useState(false);
  const [activeContactStatus, setActiveContactStatus] = useState<string>(CONTACTS_ALL_TAB);
  const [schedulesDrawerOpen, setSchedulesDrawerOpen] = useState(false);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [editScheduleOpen, setEditScheduleOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<EventSchedule | null>(null);

  const isMdUp = useMediaQuery("(min-width: 768px)");
  const contactDetailsDrawerTitle = useMemo(() => {
    if (!selectedContact) {
      return { name: contactDetailsTitle, titleStatus: undefined as string | undefined };
    }
    return resolveDetailsDrawerTitle(
      {
        kind: "contact",
        name: selectedContact.name,
        statuses: selectedContact.statuses,
        publisher_id: selectedContact.publisher_id,
      },
      userId
    );
  }, [selectedContact, userId, contactDetailsTitle]);

  const openContactDetails = useCallback(
    (contact: ContactWithDetails) => {
      onContactClick?.(contact);
    },
    [onContactClick]
  );
  
  const loadEvents = useCallback(async () => {
    if (!congregationData.id) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const fromIdb = await readCachedEventSchedules(congregationData.id);
      if (fromIdb && fromIdb.length > 0) {
        const ministryPrefill = fromIdb.filter((e) => e.event_type === "ministry" && e.status === "active");
        setAllMinistryEvents(ministryPrefill);
        const today = new Date();
        setTodayEvents(ministryPrefill.filter((event) => isEventOccurringToday(event, today)));
      }
      const allEvents = await listEventSchedules(congregationData.id);
      // Filter for ministry events only
      const ministryEvents = allEvents.filter(e => e.event_type === 'ministry' && e.status === 'active');
      setAllMinistryEvents(ministryEvents);
      const today = new Date();
      const filtered = ministryEvents.filter(event => isEventOccurringToday(event, today));
      setTodayEvents(filtered);
    } catch (error) {
      console.error('Error loading today events:', error);
      setTodayEvents([]);
      setAllMinistryEvents([]);
    } finally {
      setLoading(false);
    }
  }, [congregationData.id]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const loadBibleStudents = useCallback(async () => {
    if (!userId) {
      setBibleStudents([]);
      return;
    }

    try {
      setBibleStudentsLoading(true);
      const contacts = await listContacts();
      const owned = contacts.filter(
        (contact) => contact.publisher_id && contact.publisher_id === userId
      );
      
      // Sort by most visited (visit_count = number of calls rows)
      const sorted = owned.sort((a, b) => {
        const aVisitCount = a.visit_count ?? 0;
        const bVisitCount = b.visit_count ?? 0;
        
        // Sort by visit count (descending)
        if (bVisitCount !== aVisitCount) {
          return bVisitCount - aVisitCount;
        }
        
        // If same visit count, sort by name alphabetically
        return a.name.localeCompare(b.name);
      });
      
      setBibleStudents(sorted);
    } catch (error) {
      console.error("Error loading bible students:", error);
      setBibleStudents([]);
    } finally {
      setBibleStudentsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadBibleStudents();
  }, [loadBibleStudents]);

  // Subscribe to contact events for optimistic updates
  useEffect(() => {
    if (!userId) return;

    const handleContactAdded = (contact: ContactWithDetails) => {
      // Only add if it belongs to the current user
      if (contact.publisher_id === userId) {
        setBibleStudents((prev) => {
          // Check if already exists (avoid duplicates)
          const exists = prev.some((h) => h.id === contact.id);
          if (exists) return prev;
          // Add to the beginning of the list
          return [contact, ...prev];
        });
      }
    };

    const handleContactUpdated = (updated: Partial<ContactWithDetails> & { id?: string; publisher_id?: string | null }) => {
      if (!updated.id) return;
      
      setBibleStudents((prev) => {
        const index = prev.findIndex((h) => h.id === updated.id);
        const belongsToUser = updated.publisher_id === userId;
        
        if (index === -1) {
          // Not in list currently
          if (belongsToUser && updated.name) {
            // Belongs to user now and we have enough data, add it
            // The event should contain the full contact data
            const newContact = updated as ContactWithDetails;
            return [newContact, ...prev];
          }
          return prev;
        }
        
        // Found in list
        if (belongsToUser) {
          // Still belongs to user, update it
          const updatedList = [...prev];
          updatedList[index] = { ...updatedList[index], ...updated } as ContactWithDetails;
          return updatedList;
        } else {
          // No longer belongs to user, remove it
          return prev.filter((h) => h.id !== updated.id);
        }
      });
    };

    const handleContactDeleted = (deleted: { id?: string }) => {
      if (!deleted.id) return;
      setBibleStudents((prev) => prev.filter((h) => h.id !== deleted.id));
    };

    businessEventBus.subscribe('contact-added', handleContactAdded);
    businessEventBus.subscribe('contact-updated', handleContactUpdated);
    businessEventBus.subscribe('contact-deleted', handleContactDeleted);

    return () => {
      businessEventBus.unsubscribe('contact-added', handleContactAdded);
      businessEventBus.unsubscribe('contact-updated', handleContactUpdated);
      businessEventBus.unsubscribe('contact-deleted', handleContactDeleted);
    };
  }, [userId]);

  const statusTabValues = useMemo(
    () => buildContactStatusTabValues(collectPresentContactStatuses(bibleStudents)),
    [bibleStudents]
  );

  const filteredContacts = useMemo(() => {
    if (activeContactStatus === CONTACTS_ALL_TAB) return bibleStudents;
    return bibleStudents.filter((contact) => contactMatchesStatusTab(contact, activeContactStatus));
  }, [bibleStudents, activeContactStatus]);

  const { sort: ministryContactsTableSort, toggleColumn: toggleMinistryContactsTableSort } =
    usePersistedTableSort<MinistryContactsTableSortKey>({
      storageKey: "cong-ministry-contacts-table-sort",
      allowedColumns: MINISTRY_CONTACTS_TABLE_SORT_KEYS,
      defaultColumn: "name",
      defaultDirs: MINISTRY_CONTACTS_TABLE_DEFAULT_DIRS,
    });

  const sortedContactsForTable = useMemo(() => {
    const list = [...filteredContacts];
    const mult = ministryContactsTableSort.dir === "asc" ? 1 : -1;
    const cmpStr = (a: string, b: string) => mult * a.localeCompare(b, undefined, { sensitivity: "base" });
    list.sort((ca, cb) => {
      let cmp = 0;
      if (ministryContactsTableSort.column === "name") {
        cmp = cmpStr((ca.name || "").toLowerCase(), (cb.name || "").toLowerCase());
      } else {
        cmp = cmpStr(
          formatContactStatusLabel(getContactPrimaryStatus(ca)).toLowerCase(),
          formatContactStatusLabel(getContactPrimaryStatus(cb)).toLowerCase()
        );
      }
      if (cmp !== 0) return cmp;
      return (ca.name || "").localeCompare(cb.name || "", undefined, { sensitivity: "base" });
    });
    return list;
  }, [filteredContacts, ministryContactsTableSort.column, ministryContactsTableSort.dir]);

  useEffect(() => {
    if (!contactsDrawerOpen || activeContactStatus === CONTACTS_ALL_TAB) return;
    const hasActiveTab = bibleStudents.some((contact) =>
      contactMatchesStatusTab(contact, activeContactStatus)
    );
    if (!hasActiveTab) setActiveContactStatus(CONTACTS_ALL_TAB);
  }, [contactsDrawerOpen, activeContactStatus, bibleStudents]);

  const formatMinistryType = (ministryType?: string | null) => {
    if (!ministryType) return "";
    if (ministryType === "business_witnessing") return "BWI";
    if (ministryType === "house_to_house") return "H2H";
    return ministryType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Day names: 0=Sunday, 1=Monday, ..., 6=Saturday
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Get days with recurring weekly schedules
  const daysWithSchedules = useMemo(() => {
    const days = new Set<number>();
    allMinistryEvents.forEach(event => {
      if (event.recurrence_pattern === 'weekly' && event.day_of_week != null) {
        days.add(event.day_of_week);
      }
    });
    // Sort with Monday (1) first, then Tuesday-Sunday
    return Array.from(days).sort((a, b) => {
      // Convert to Monday-first order: 1,2,3,4,5,6,0
      const aOrder = a === 0 ? 7 : a;
      const bOrder = b === 0 ? 7 : b;
      return aOrder - bOrder;
    });
  }, [allMinistryEvents]);

  // Filter and sort events by selected day
  const filteredSchedules = useMemo(() => {
    let filtered = allMinistryEvents;
    
    if (activeDay !== null && activeDay !== 'All') {
      const dayNum = parseInt(activeDay);
      filtered = allMinistryEvents.filter(event => 
        event.recurrence_pattern === 'weekly' && event.day_of_week === dayNum
      );
    }
    
    // When showing "All", sort by day of week (Monday first)
    if (activeDay === null || activeDay === 'All') {
      return filtered.sort((a, b) => {
        // Only sort weekly recurring events by day_of_week
        if (a.recurrence_pattern === 'weekly' && b.recurrence_pattern === 'weekly') {
          const aDay = a.day_of_week ?? 7; // Put null/undefined at end
          const bDay = b.day_of_week ?? 7;
          // Convert to Monday-first order: 1,2,3,4,5,6,0,7
          const aOrder = aDay === 0 ? 7 : aDay;
          const bOrder = bDay === 0 ? 7 : bDay;
          return aOrder - bOrder;
        }
        // Non-weekly events go to the end
        if (a.recurrence_pattern === 'weekly' && b.recurrence_pattern !== 'weekly') return -1;
        if (a.recurrence_pattern !== 'weekly' && b.recurrence_pattern === 'weekly') return 1;
        return 0;
      });
    }
    
    return filtered;
  }, [allMinistryEvents, activeDay]);

  // When opening Ministry Schedules, select today's weekday tab if it exists (day_of_week matches JS getDay() 0–6).
  useEffect(() => {
    if (!schedulesDrawerOpen) return;
    const todayDow = new Date().getDay();
    if (daysWithSchedules.includes(todayDow)) {
      setActiveDay(String(todayDow));
    } else {
      setActiveDay('All');
    }
  }, [schedulesDrawerOpen, daysWithSchedules]);

  const scheduleDayToggleClass = cn(
    studyBibleSectionToggle.item,
    studyBibleSectionToggle.itemCompact
  );

  const contactStatusToggleClass = cn(
    studyBibleSectionToggle.item,
    studyBibleSectionToggle.itemCompact
  );

  const contactsDirectoryBody = (
    <>
      <div className="flex shrink-0 justify-center">
        <div className={cn("relative w-full max-w-screen-sm", studyBibleSectionToggle.shell)}>
          <div className="no-scrollbar w-full overflow-x-auto">
            <ToggleGroup
              type="single"
              value={activeContactStatus}
              onValueChange={(value) => {
                if (value) setActiveContactStatus(value);
              }}
              className={cn(studyBibleSectionToggle.group, studyBibleSectionToggle.scrollableTabGroup)}
            >
              {statusTabValues.map((tab) => {
                const label = formatContactStatusTabLabel(tab);
                return (
                  <ToggleGroupItem
                    key={tab}
                    value={tab}
                    className={cn(contactStatusToggleClass, "min-h-12 max-w-[100px] py-2")}
                    title={label}
                  >
                    <span className="w-full whitespace-normal break-words text-center text-[11px] font-medium">
                      {label}
                    </span>
                  </ToggleGroupItem>
                );
              })}
            </ToggleGroup>
          </div>
        </div>
      </div>

      <div
        className={cn(
          mobileDataTableClasses.shell,
          "min-h-0 flex-1 text-[#1a1820] dark:text-[#fffaff]"
        )}
      >
        <div className={mobileDataTableClasses.header}>
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className={mobileDataTableClasses.headerRow}>
                <MobileDataTableSortTh
                  label="Name"
                  sortKey="name"
                  sort={ministryContactsTableSort}
                  onToggle={toggleMinistryContactsTableSort}
                  className="w-[65%] p-0 align-bottom"
                />
                <MobileDataTableSortTh
                  label="Status"
                  sortKey="status"
                  sort={ministryContactsTableSort}
                  onToggle={toggleMinistryContactsTableSort}
                  className="w-[35%] p-0 align-bottom"
                />
              </tr>
            </thead>
          </table>
        </div>

        <div
          className={cn(
            mobileDataTableClasses.bodyScroll,
            "pb-[calc(max(env(safe-area-inset-bottom),0px)+28px)]"
          )}
          style={mobileDataTableClasses.bodyScrollStyle}
        >
          <table className="w-full table-fixed text-sm">
            <tbody>
              {bibleStudentsLoading ? (
                <>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr
                      key={i}
                      className={cn(
                        "border-b bg-[#fffaff] dark:border-[#3a3342] dark:bg-[#30283c]/55",
                        studyBibleDarkClasses.divider
                      )}
                    >
                      <td className="min-w-0 w-[65%] p-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="h-7 w-7 animate-pulse rounded-full bg-muted/60 blur-[2px]" />
                          <div className="h-4 w-32 animate-pulse rounded bg-muted/60 blur-[2px]" />
                        </div>
                      </td>
                      <td className="w-[35%] p-3">
                        <div className="h-5 w-20 animate-pulse rounded bg-muted/60 blur-[2px]" />
                      </td>
                    </tr>
                  ))}
                </>
              ) : bibleStudents.length === 0 ? (
                <tr>
                  <td colSpan={2} className={cn("p-8 text-center", studyBibleDarkClasses.muted)}>
                    <BookOpen className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p className="text-[#1a1820] dark:text-[#fffaff]">No Bible students yet</p>
                    <p className="text-sm">Bible students will appear here when assigned</p>
                  </td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={2} className={cn("p-6 text-center text-sm", studyBibleDarkClasses.muted)}>
                    No contacts in this status.
                  </td>
                </tr>
              ) : (
                sortedContactsForTable.map((contact) => {
                  const initials = contact.name
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join("");
                  const contactSource = getMinistryContactSourceKind(contact);
                  const primaryStatus = getBestContactStatus(resolveContactStatuses(contact));

                  return (
                    <tr
                      key={contact.id}
                      className={mobileDataTableClasses.row(String(contact.id))}
                      onClick={() => openContactDetails(contact)}
                    >
                      <td className={cn(mobileDataTableClasses.cell, "w-[65%]")}>
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-7 w-7 shrink-0 border border-[#d4c8e4] dark:border-[#5a5068]/50">
                            <AvatarFallback className="text-[10px] font-semibold text-[#1a1820] dark:bg-[#3b3348] dark:text-[#fffaff]">
                              {initials || "BS"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <span className="truncate font-medium text-[#1a1820] dark:text-[#fffaff]">
                              {contact.name}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                mobileDataTableClasses.statusBadge,
                                "shrink-0",
                                contactSource === "bwi"
                                  ? CONG_BWI_BADGE_CLASS
                                  : MINISTRY_CONTACT_H2H_BADGE_CLASS
                              )}
                              title={
                                contactSource === "bwi"
                                  ? "Business Witnessing contact"
                                  : "House-to-house contact"
                              }
                            >
                              {contactSource === "bwi" ? "BWI" : "H2H"}
                            </Badge>
                          </div>
                        </div>
                      </td>
                      <td className={cn(mobileDataTableClasses.cell, "w-[35%] align-top")}>
                        <div className="flex flex-wrap justify-end gap-1">
                          <Badge
                            variant="outline"
                            className={cn(
                              mobileDataTableClasses.statusBadge,
                              getStatusTextColor(primaryStatus)
                            )}
                          >
                            {formatContactStatusLabel(primaryStatus)}
                          </Badge>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );

  const schedulesBody = (
    <div
      className={cn(
        "flex flex-col gap-4 text-foreground dark:text-[#fffaff]",
        isMdUp ? "min-h-0 flex-1" : ""
      )}
    >
      <div className="flex shrink-0 justify-center px-1">
        <div className={cn("relative w-full max-w-screen-sm", studyBibleSectionToggle.shell)}>
          <div className="no-scrollbar w-full overflow-x-auto">
            <ToggleGroup
              type="single"
              value={activeDay ?? "All"}
              onValueChange={(v) => {
                if (v) setActiveDay(v);
              }}
              className={studyBibleSectionToggle.group}
            >
              <ToggleGroupItem value="All" className={scheduleDayToggleClass} title="All">
                <span className="w-full truncate text-center font-medium">All</span>
              </ToggleGroupItem>
              {daysWithSchedules.map((dayNum) => (
                <ToggleGroupItem
                  key={dayNum}
                  value={String(dayNum)}
                  className={scheduleDayToggleClass}
                  title={dayNames[dayNum]}
                >
                  <span className="w-full truncate text-center font-medium">{dayNames[dayNum]}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex w-full flex-col overflow-hidden overscroll-none text-[#1a1820] dark:border-[#1c1921] dark:text-[#fffaff]",
          studyBibleDarkClasses.divider,
          ministrySchedulesPanelShade,
          isMdUp ? "min-h-0 flex-1 rounded-lg border" : "h-[calc(70vh)] max-md:max-h-[70dvh]"
        )}
      >
        <div
          className={cn(
            "shrink-0 border-b",
            studyBibleDarkClasses.divider,
            studyBibleDarkClasses.cardBarHeader,
            ministrySchedulesPanelShade,
            "dark:border-[#1c1921] dark:bg-[#181714]"
          )}
        >
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className={cn("border-b", studyBibleDarkClasses.divider)}>
                <th className="w-[60%] px-3 py-3 text-left font-medium">Title</th>
                <th className="w-[40%] px-3 py-3 text-center font-medium">Time</th>
              </tr>
            </thead>
          </table>
        </div>

        <div
          className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-none"
          style={{ overscrollBehavior: "contain", touchAction: "pan-y" }}
        >
          <table className="w-full table-fixed text-sm text-foreground dark:text-[#fffaff]">
            <tbody>
              {filteredSchedules.length === 0 ? (
                <tr>
                  <td colSpan={2} className={cn("p-6 text-center text-sm", studyBibleDarkClasses.muted)}>
                    No schedules found
                  </td>
                </tr>
              ) : (
                filteredSchedules.map((event) => (
                  <tr
                    key={event.id}
                    className={cn(
                      "border-b",
                      studyBibleDarkClasses.divider,
                      canEdit && cn("cursor-pointer dark:hover:bg-[#2a2534]/85", studyBibleDarkClasses.cardHover)
                    )}
                    onClick={() => {
                      if (canEdit && event.id) {
                        setSelectedSchedule(event);
                        setEditScheduleOpen(true);
                      }
                    }}
                  >
                    <td className="min-w-0 w-[60%] p-3">
                      <div className="flex min-w-0 flex-col gap-1">
                        <span className="truncate font-medium text-foreground dark:text-[#fffaff]">{event.title}</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {event.ministry_type && (
                            <Badge
                              variant="outline"
                              className="h-4 w-fit border px-1.5 py-0 text-[10px] leading-none border-border dark:border-[#1c1921]"
                            >
                              {formatMinistryType(event.ministry_type)}
                            </Badge>
                          )}
                          {(activeDay === null || activeDay === "All") &&
                            event.recurrence_pattern === "weekly" &&
                            event.day_of_week != null && (
                              <Badge
                                variant="secondary"
                                className="h-4 w-fit border px-1.5 py-0 text-[10px] leading-none border-border dark:border-[#1c1921] dark:bg-[#30283c]"
                              >
                                {dayNames[event.day_of_week]}
                              </Badge>
                            )}
                        </div>
                      </div>
                      {event.description && (
                        <p className="mt-1 line-clamp-1 truncate text-xs text-muted-foreground dark:text-[#ded6e7]/75">
                          {event.description}
                        </p>
                      )}
                    </td>
                    <td className="w-[40%] p-3">
                      {event.is_all_day ? (
                        <div className="text-center">
                          <span className="text-xs text-muted-foreground dark:text-[#ded6e7]/80">All day</span>
                        </div>
                      ) : event.start_time ? (
                        <div className="flex flex-col items-center text-xs text-muted-foreground dark:text-[#ded6e7]/85">
                          <div>{formatTimeLabel(event.start_time)}</div>
                          {event.end_time && (
                            <>
                              <div className="text-muted-foreground dark:text-[#ded6e7]/65">to</div>
                              <div>{formatTimeLabel(event.end_time)}</div>
                            </>
                          )}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  
  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:items-start md:gap-6">
        <div className="min-w-0">
          <Card
            className={cn(
              "gap-0 overflow-hidden rounded-xl border py-0 shadow-md",
              studyBibleDarkClasses.bwiCard,
              ministryTodayCardShade
            )}
          >
            <CardHeader
              className={cn(
                "rounded-t-xl border-b px-4 pt-3 !pb-3",
                studyBibleDarkClasses.divider,
                studyBibleDarkClasses.cardBarHeader,
                ministryTodayCardShade,
                "dark:border-[#1c1921] dark:bg-[#2a2534]"
              )}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-md text-left transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80778e] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-offset-[#181714]"
                onClick={() => setSchedulesDrawerOpen(true)}
              >
                <CardTitle className="flex items-center gap-2 text-base font-bold leading-tight text-[#1a1820] dark:text-[#fffaff]">
                  <Calendar className="h-5 w-5 shrink-0 opacity-90" />
                  Today
                </CardTitle>
                <ChevronRight className={cn("h-4 w-4 shrink-0 opacity-70", studyBibleDarkClasses.muted)} />
              </button>
            </CardHeader>
            <CardContent className="p-0 pb-6 pt-2">
          {loading ? (
            <div className="px-4 py-2 space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="px-3 py-2.5 rounded-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-4 bg-muted/60 rounded w-32 blur-[2px] animate-pulse" />
                        <div className="h-4 bg-muted/60 rounded w-12 blur-[2px] animate-pulse" />
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                        <div className="h-3 bg-muted/60 rounded w-24 blur-[2px] animate-pulse" />
                        <div className="h-3 bg-muted/60 rounded w-32 blur-[2px] animate-pulse" />
                      </div>
                      
                      <div className="h-3 bg-muted/60 rounded w-full max-w-[200px] mt-2 blur-[2px] animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : todayEvents.length === 0 ? (
            <div className={cn("px-4 py-8 text-center", studyBibleDarkClasses.muted)}>
              <Calendar className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p className="text-sm">No ministry events scheduled for today</p>
            </div>
          ) : (
            <div className="space-y-2 px-4 py-2">
              {todayEvents.map((event) => {
                const locLine = formatEventLocationSummaryForDisplay(event);
                return (
                <div
                  key={event.id}
                  className={cn(
                    "rounded-lg px-3 py-2.5 transition-colors dark:hover:bg-[#2a2534]/85",
                    studyBibleDarkClasses.cardHover
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <h4 className="text-sm font-medium text-foreground dark:text-[#fffaff]">{event.title}</h4>
                        {event.ministry_type && (
                          <Badge variant="outline" className="h-4 border border-border dark:border-[#1c1921] px-1.5 py-0 text-[10px] leading-none">
                            {formatMinistryType(event.ministry_type)}
                          </Badge>
                        )}
                        {event.recurrence_pattern !== 'none' && (
                          <Badge variant="secondary" className="h-4 px-1.5 py-0 text-[10px] leading-none border-border dark:border-[#1c1921] dark:bg-[#30283c]">
                            Recurring
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground dark:text-[#ded6e7]/80">
                        {!event.is_all_day && event.start_time && (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>
                              {formatTimeLabel(event.start_time)}
                              {event.end_time && ` → ${formatTimeLabel(event.end_time)}`}
                            </span>
                          </div>
                        )}
                        {locLine ? (
                          <div className="flex min-w-0 items-center gap-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{locLine}</span>
                          </div>
                        ) : null}
                      </div>
                      
                      {event.description && (
                        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground dark:text-[#ded6e7]/70">{event.description}</p>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
        </div>

        <div className="min-w-0">
          <Card
            className={cn(
              "gap-0 overflow-hidden rounded-xl border py-0 shadow-md",
              studyBibleDarkClasses.callsCard,
              ministryContactsCardShade
            )}
          >
            <CardHeader
              className={cn(
                "rounded-t-xl border-b px-4 pt-3 !pb-3",
                studyBibleDarkClasses.divider,
                studyBibleDarkClasses.cardBarHeader,
                ministryContactsCardShade,
                "dark:border-[#1c1921] dark:bg-[#2a2534]"
              )}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 rounded-md text-left transition-colors hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80778e] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-offset-[#181714]"
                onClick={() => setContactsDrawerOpen(true)}
              >
                <CardTitle className="flex items-center gap-2 text-base font-bold leading-tight text-[#1a1820] dark:text-[#fffaff]">
                  <BookOpen className="h-5 w-5 shrink-0 opacity-90" />
                  Contacts
                </CardTitle>
                <ChevronRight className={cn("h-4 w-4 shrink-0 opacity-70", studyBibleDarkClasses.muted)} />
              </button>
            </CardHeader>
            <CardContent className="p-0 pb-6 pt-2">
          {bibleStudentsLoading ? (
            <div className="px-4 py-2 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="px-3 py-2.5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-muted/60 rounded-full blur-[2px] animate-pulse" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <div className="h-4 bg-muted/60 rounded w-24 blur-[2px] animate-pulse" />
                        <div className="h-5 bg-muted/60 rounded w-20 blur-[2px] animate-pulse" />
                      </div>
                      <div className="h-3 bg-muted/60 rounded w-32 blur-[2px] animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : bibleStudents.length === 0 ? (
            <div className={cn("px-4 py-8 text-center", studyBibleDarkClasses.muted)}>
              <BookOpen className="mx-auto mb-4 h-12 w-12 opacity-50" />
              <p className="text-[#1a1820] dark:text-[#fffaff]">No Bible students yet</p>
              <p className="text-sm">Bible students will appear here when assigned</p>
            </div>
          ) : (
            <div className="space-y-2 px-4 py-2">
              {bibleStudents.slice(0, 3).map((contact) => {
                const initials = contact.name
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("");
                const primaryStatus = getBestContactStatus(resolveContactStatuses(contact));

                return (
                  <div
                    key={contact.id}
                    className={cn(
                      "cursor-pointer rounded-lg px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80778e] focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-[#2a2534]/85 dark:focus-visible:ring-offset-[#181714]",
                      studyBibleDarkClasses.cardHover
                    )}
                    role="button"
                    tabIndex={0}
                    onClick={() => openContactDetails(contact)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openContactDetails(contact);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-border dark:border-[#5a5068]/50">
                        <AvatarFallback className="text-[11px] font-semibold dark:bg-[#30283c] text-foreground dark:text-[#fffaff]">
                          {initials || "BS"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="truncate text-sm font-medium text-foreground dark:text-[#fffaff]">{contact.name}</p>
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-5 px-2 py-0.5 text-xs leading-none",
                              getStatusTextColor(primaryStatus)
                            )}
                          >
                            {formatContactStatusLabel(primaryStatus)}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground dark:text-[#ded6e7]/75">
                          {(() => {
                            // If has establishment_id, show building icon
                            if (contact.establishment_id) {
                              return (
                                <>
                                  <Building2 className="h-3 w-3" />
                                  <span className="truncate">
                                    {contact.establishment_name || "Establishment"}
                                  </span>
                                </>
                              );
                            }
                            // If has GPS data, show map icon with Contact label
                            if (contact.lat != null && contact.lng != null) {
                              return (
                                <>
                                  <MapIcon className="h-3 w-3" />
                                  <span className="truncate">Contact</span>
                                </>
                              );
                            }
                            // If no establishment AND no GPS, don't show anything
                            return null;
                          })()}
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
        </div>

        <div className="min-w-0">
          <Card
            className={cn(
              "gap-0 overflow-hidden rounded-xl border py-0 shadow-md",
              studyBibleDarkClasses.todoCard,
              ministryAssignmentsCardShade
            )}
          >
            <CardHeader
              className={cn(
                "rounded-t-xl border-b px-4 pt-3 !pb-3",
                studyBibleDarkClasses.divider,
                studyBibleDarkClasses.cardBarHeader,
                ministryAssignmentsCardShade,
                "dark:border-[#1c1921] dark:bg-[#2a2534]"
              )}
            >
              <CardTitle className="text-base font-bold leading-tight text-[#1a1820] dark:text-[#fffaff]">
                Ministry Assignments
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-6 pt-4 sm:px-6">
              <div className={cn("py-8 text-center", studyBibleDarkClasses.muted)}>
                <Users className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p className="text-[#1a1820] dark:text-[#fffaff]">No assignments available</p>
                <p className="text-sm">Ministry assignments will appear here</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {isMdUp ? (
        <Drawer
          open={contactsDrawerOpen}
          onOpenChange={setContactsDrawerOpen}
          direction="right"
          modal
          nested
          shouldScaleBackground={false}
        >
          <DrawerWideRightContent
            className={cn(
              "flex flex-col overflow-hidden text-[#1a1820] dark:border-[#1c1921] dark:text-[#fffaff] md:max-h-[100lvh]",
              studyBibleDarkClasses.divider,
              ministryContactsPanelShade
            )}
          >
            <DrawerHeader
              className={cn(
                "shrink-0 px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center",
                ministryContactsPanelShade,
                "dark:bg-[#181714]"
              )}
            >
              <DrawerTitle className="text-center text-lg font-bold">Contacts</DrawerTitle>
              <DrawerDescription className="sr-only">
                Bible students and others you are assigned to as publisher.
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+28px)] pt-4">
              {contactsDirectoryBody}
            </div>
          </DrawerWideRightContent>
        </Drawer>
      ) : (
        <FormModal
          open={contactsDrawerOpen}
          onOpenChange={setContactsDrawerOpen}
          title="Contacts"
          skipFabRootInert={Boolean(selectedContact)}
          className={cn("dark:border-[#1c1921] dark:bg-[#181714] text-[#1a1820] dark:text-[#fffaff]", ministryContactsPanelShade)}
          headerClassName="text-center"
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !pb-0 max-xl:!pb-0"
          drawerContentClassName={cn(
            "h-[85svh] max-h-[85svh]",
            "[&_.drawer-content-inner]:flex [&_.drawer-content-inner]:min-h-0 [&_.drawer-content-inner]:flex-1 [&_.drawer-content-inner]:flex-col [&_.drawer-content-inner]:!overflow-hidden [&_.drawer-content-inner]:!pb-0 [&_.drawer-content-inner]:[scroll-padding-bottom:0]"
          )}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4">{contactsDirectoryBody}</div>
        </FormModal>
      )}

      {selectedContact && contactDetailsBody ? (
        <DetailsDrawer
          open={Boolean(selectedContact)}
          onOpenChange={(open) => {
            if (!open) onClearSelectedContact?.();
          }}
          entityName={contactDetailsDrawerTitle.name}
          titleStatus={contactDetailsDrawerTitle.titleStatus}
          stackAboveParentSheet={contactsDrawerOpen && !isMdUp}
          stackAboveDetailsSheet={contactsDrawerOpen && isMdUp}
          fitContent={!isMdUp}
          bodyClassName="space-y-3"
          description="Return visits, notes, and congregation contact actions."
          contentClassName={
            isMdUp
              ? "flex flex-col overflow-hidden border-border dark:border-[#1c1921] bg-card dark:bg-[#181714] text-foreground dark:text-[#fffaff]"
              : undefined
          }
        >
          {contactDetailsBody}
        </DetailsDrawer>
      ) : null}

      {isMdUp ? (
        <Drawer
          open={schedulesDrawerOpen}
          onOpenChange={setSchedulesDrawerOpen}
          direction="right"
          modal
          nested
          shouldScaleBackground={false}
        >
          <DrawerWideRightContent
            className={cn(
              "flex flex-col overflow-hidden text-[#1a1820] dark:border-[#1c1921] dark:text-[#fffaff] md:max-h-[100lvh]",
              studyBibleDarkClasses.divider,
              ministrySchedulesPanelShade
            )}
          >
            <DrawerHeader
              className={cn(
                "shrink-0 px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center",
                ministrySchedulesPanelShade,
                "dark:bg-[#181714]"
              )}
            >
              <DrawerTitle className="text-center text-lg font-bold">Ministry Schedules</DrawerTitle>
              <DrawerDescription className="sr-only">
                Filter and view ministry events by day of week.
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex min-h-0 flex-1 flex-col px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+28px)] pt-4">
              {schedulesBody}
            </div>
          </DrawerWideRightContent>
        </Drawer>
      ) : (
        <FormModal
          open={schedulesDrawerOpen}
          onOpenChange={setSchedulesDrawerOpen}
          title="Ministry Schedules"
          description="Filter and view ministry events by day of week."
          className={cn("dark:border-[#1c1921] dark:bg-[#181714] text-[#1a1820] dark:text-[#fffaff]", ministrySchedulesPanelShade)}
          headerClassName="text-center"
        >
          {schedulesBody}
        </FormModal>
      )}

      {canEdit && congregationData.id ? (
        <EventScheduleFormSheet
          open={editScheduleOpen && selectedSchedule != null}
          onOpenChange={(open) => {
            setEditScheduleOpen(open);
            if (!open) setSelectedSchedule(null);
          }}
          congregationId={congregationData.id}
          initialData={selectedSchedule}
          onSaved={async (savedEvent) => {
            if (savedEvent) {
              setEditScheduleOpen(false);
              setSelectedSchedule(null);
              await loadEvents();
            }
          }}
        />
      ) : null}

    </>
  );
}
