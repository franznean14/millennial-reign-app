"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { List, LayoutGrid, Table as TableIcon, Filter, User, UserCheck, X, Building2, ChevronUp, ChevronDown } from "lucide-react";
import { type ContactWithDetails, type BusinessFiltersState } from "@/lib/db/business";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { useListViewMode } from "@/lib/hooks/use-list-view-mode";
import { useInfiniteList } from "@/lib/hooks/use-infinite-list";
import {
  usePersistedTableSort,
  type TableSortDir,
} from "@/lib/hooks/use-persisted-table-sort";
import { CONTACT_STATUS_DISPLAY_ORDER } from "@/lib/utils/contact-status-tabs";
import { formatContactStatusCompactText, formatStatusText } from "@/lib/utils/formatters";
import { getStudyBibleDarkCardFade, getStudyBibleDarkCardShade, studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";
import { getContactPrimaryStatus, getContactSecondaryStatuses, getStatusTitleColor, resolveContactStatuses } from "@/lib/utils/status-hierarchy";

interface ContactListProps {
  contacts: ContactWithDetails[];
  onContactClick: (contact: ContactWithDetails) => void;
  onContactDelete?: (contact: ContactWithDetails) => void;
  onContactArchive?: (contact: ContactWithDetails) => void;
  myContactsOnly?: boolean;
  onMyContactsChange?: (checked: boolean) => void;
  onOpenFilters?: () => void;
  filters?: BusinessFiltersState;
  onClearAllFilters?: () => void;
  onClearSearch?: () => void;
  onRemoveStatus?: (status: string) => void;
  onRemoveArea?: (area: string) => void;
  onRemoveFloor?: (floor: string) => void;
  viewMode?: 'detailed' | 'compact' | 'table';
  onViewModeChange?: (viewMode: 'detailed' | 'compact' | 'table') => void;
}

type ViewMode = 'detailed' | 'compact' | 'table';

type ContactTableSortKey = "name" | "status" | "establishment" | "last_call" | "calls";

const CONTACT_TABLE_SORT_KEYS: readonly ContactTableSortKey[] = [
  "name",
  "status",
  "establishment",
  "last_call",
  "calls",
];

const HH_TABLE_DEFAULT_DIRS: Record<ContactTableSortKey, TableSortDir> = {
  name: "asc",
  status: "asc",
  establishment: "asc",
  last_call: "desc",
  calls: "desc",
};

function NameWithAvatarsCell({
  name,
  visitors
}: {
  name: string;
  visitors?: Array<{ user_id?: string; avatar_url?: string; first_name?: string; last_name?: string }>;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="truncate flex-1 min-w-0" title={name}>
        {name}
      </div>
      {visitors && visitors.length > 0 && (
        <div className="flex items-center flex-shrink-0">
          {visitors.slice(0, 3).map((visitor, i) => (
            <Avatar key={visitor.user_id || i} className={`h-5 w-5 ring-1 ring-background ${i > 0 ? '-ml-2' : ''}`}>
              <AvatarImage src={visitor.avatar_url} />
              <AvatarFallback className="text-xs">
                {`${visitor.first_name ?? ''} ${visitor.last_name ?? ''}`.trim().charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
          ))}
          {visitors.length > 3 && (
            <span className="text-xs text-muted-foreground ml-2">+{visitors.length - 3}</span>
          )}
        </div>
      )}
    </div>
  );
}

function EstablishmentNameCell({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-1 min-w-0 w-full">
      <Building2 className="h-3 w-3 flex-shrink-0" />
      <div className="truncate flex-1 min-w-0" title={name}>
        {name}
      </div>
    </div>
  );
}

function formatTableDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

function ContactTableSortTh({
  label,
  sortKey,
  sort,
  onToggle,
  className,
}: {
  label: string;
  sortKey: ContactTableSortKey;
  sort: { column: ContactTableSortKey; dir: TableSortDir };
  onToggle: (k: ContactTableSortKey) => void;
  className?: string;
}) {
  const active = sort.column === sortKey;
  return (
    <th
      scope="col"
      className={className}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle(sortKey);
        }}
        className={cn(
          "inline-flex min-h-11 w-full min-w-0 touch-manipulation items-center gap-0.5 rounded-md py-3 pl-3 pr-1 text-left font-medium",
          studyBibleDarkClasses.tableHeaderSortButton,
          active && studyBibleDarkClasses.tableHeaderSortButtonActive
        )}
      >
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="flex shrink-0 flex-col leading-none" aria-hidden="true">
          <ChevronUp
            className={cn(
              "h-2.5 w-2.5",
              active && sort.dir === "asc"
                ? studyBibleDarkClasses.tableHeaderSortChevronActive
                : "opacity-30"
            )}
          />
          <ChevronDown
            className={cn(
              "-mt-0.5 h-2.5 w-2.5",
              active && sort.dir === "desc"
                ? studyBibleDarkClasses.tableHeaderSortChevronActive
                : "opacity-30"
            )}
          />
        </span>
      </button>
    </th>
  );
}

export function ContactList({ 
  contacts, 
  onContactClick,
  onContactDelete,
  onContactArchive,
  myContactsOnly,
  onMyContactsChange,
  onOpenFilters,
  filters,
  onClearAllFilters,
  onClearSearch,
  onRemoveStatus,
  onRemoveArea,
  viewMode: externalViewMode,
  onViewModeChange
}: ContactListProps) {
  
  // Reset scroll position to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const { viewMode } = useListViewMode<ViewMode>({
    defaultViewMode: "detailed",
    externalViewMode,
    onViewModeChange,
    storageKey: "contact-view-mode",
    allowedModes: ["detailed", "compact", "table"],
    cycleOrder: ["detailed", "compact", "table"],
  });

  const { sort: contactTableSort, toggleColumn: toggleContactTableSort } =
    usePersistedTableSort<ContactTableSortKey>({
      storageKey: "bwi-contact-table-sort",
      allowedColumns: CONTACT_TABLE_SORT_KEYS,
      defaultColumn: "name",
      defaultDirs: HH_TABLE_DEFAULT_DIRS,
    });

  const tableBodyScrollRef = useRef<HTMLDivElement>(null);

  // Prevent page scrolling when in table view
  useEffect(() => {
    if (viewMode === 'table') {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [viewMode]);

  const hasActiveFilters = !!filters && (
    !!filters.search || (filters.statuses?.length ?? 0) > 0 || (filters.areas?.length ?? 0) > 0 || !!filters.myEstablishments
  );

  const formatStatusCompactText = formatContactStatusCompactText;

  const truncateContactName = (name: string, maxLength: number = 20) => {
    return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
  };

  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'potential':
        return 'bg-cyan-500';
      case 'do_not_call':
        return 'bg-red-500';
      case 'interested':
        return 'bg-blue-500';
      case 'return_visit':
        return 'bg-orange-500';
      case 'bible_study':
        return 'bg-emerald-500';
      case 'moved_branch':
      case 'resigned':
        return 'bg-stone-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusTextColorClass = (status: string) => {
    switch (status) {
      case 'potential':
        return 'text-cyan-600 border-cyan-200 bg-cyan-50 dark:text-cyan-400 dark:border-cyan-800 dark:bg-cyan-950';
      case 'do_not_call':
        return 'text-red-600 border-red-200 bg-red-50 dark:text-red-400 dark:border-red-800 dark:bg-red-950';
      case 'interested':
        return 'text-blue-600 border-blue-200 bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:bg-blue-950';
      case 'return_visit':
        return 'text-orange-600 border-orange-200 bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:bg-orange-950';
      case 'bible_study':
        return 'text-emerald-600 border-emerald-200 bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950';
      case 'moved_branch':
      case 'resigned':
        return 'text-stone-600 border-stone-200 bg-stone-50 dark:text-stone-400 dark:border-stone-700 dark:bg-stone-950';
      default:
        return 'text-gray-600 border-gray-200 bg-gray-50 dark:text-gray-400 dark:border-gray-800 dark:bg-gray-950';
    }
  };

  const getContactCallTotal = (contact: ContactWithDetails) =>
    contact.visit_count ?? 0;

  const renderContactStatusCell = (
    contact: ContactWithDetails,
    options?: { compact?: boolean; table?: boolean }
  ) => {
    const primary = getContactPrimaryStatus(contact);
    const secondary = getContactSecondaryStatuses(contact);
    const label = options?.table || options?.compact
      ? formatStatusCompactText(primary)
      : formatStatusText(primary);
    const badgeClass = options?.table
      ? "text-[10px] leading-4 px-1.5 py-0.5 rounded-sm"
      : options?.compact
        ? "text-xs px-1.5 py-0.5"
        : undefined;

    return (
      <div className="flex items-center gap-1 min-w-0">
        <Badge
          variant="outline"
          className={cn(getStatusTextColorClass(primary), badgeClass)}
        >
          {label}
        </Badge>
        {secondary.length > 0 ? (
          <div className="flex items-center gap-0.5">
            {secondary.slice(0, 3).map((status) => (
              <div
                key={status}
                className={cn("w-1.5 h-1.5 rounded-full shrink-0", getStatusColorClass(status))}
                title={formatStatusText(status)}
              />
            ))}
            {secondary.length > 3 ? (
              <span className="text-[10px] text-muted-foreground">+{secondary.length - 3}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const sortedContactsForTable = useMemo(() => {
    if (viewMode !== "table") return contacts;
    const { column, dir } = contactTableSort;
    const mult = dir === "asc" ? 1 : -1;
    const list = [...contacts];

    const cmpStr = (a: string, b: string) =>
      mult * a.localeCompare(b, undefined, { sensitivity: "base" });
    const cmpNum = (a: number, b: number) =>
      mult * (a === b ? 0 : a < b ? -1 : 1);

    const cmpVisitDateStr = (
      a: string | null | undefined,
      b: string | null | undefined
    ) => {
      const av = (a ?? "").trim();
      const bv = (b ?? "").trim();
      if (!av && !bv) return 0;
      if (!av) return 1;
      if (!bv) return -1;
      return mult * av.localeCompare(bv);
    };

    list.sort((ha, hb) => {
      let cmp = 0;
      switch (column) {
        case "name":
          cmp = cmpStr((ha.name || "").toLowerCase(), (hb.name || "").toLowerCase());
          break;
        case "status":
          cmp = cmpStr(
            formatStatusCompactText(getContactPrimaryStatus(ha)).toLowerCase(),
            formatStatusCompactText(getContactPrimaryStatus(hb)).toLowerCase()
          );
          break;
        case "establishment":
          cmp = cmpStr(
            (ha.establishment_name || "").toLowerCase(),
            (hb.establishment_name || "").toLowerCase()
          );
          break;
        case "last_call":
          cmp = cmpVisitDateStr(ha.last_visit_at, hb.last_visit_at);
          break;
        case "calls":
          cmp = cmpNum(getContactCallTotal(ha), getContactCallTotal(hb));
          break;
        default:
          cmp = 0;
      }
      if (cmp !== 0) return cmp;
      return (ha.name || "").localeCompare(hb.name || "", undefined, {
        sensitivity: "base",
      });
    });
    return list;
  }, [viewMode, contacts, contactTableSort, formatStatusCompactText]);

  const contactsForSlice = sortedContactsForTable;

  const { visibleCount, sentinelRef } = useInfiniteList({
    itemsLength: contactsForSlice.length,
    viewMode,
    initialCounts: { detailed: 7, compact: 10, table: 40 },
    stepCounts: { detailed: 5, compact: 10, table: 40 },
  });

  const visibleContacts = useMemo(
    () => contactsForSlice.slice(0, visibleCount),
    [contactsForSlice, visibleCount]
  );

  useEffect(() => {
    if (viewMode !== "table") return;
    tableBodyScrollRef.current?.scrollTo({ top: 0 });
  }, [viewMode, contactTableSort.column, contactTableSort.dir]);

  const detailedStatusColumns = useMemo(() => {
    const statuses = Array.from(
      new Set(contacts.flatMap((contact) => resolveContactStatuses(contact)))
    );
    statuses.sort((a, b) => {
      const aIndex = CONTACT_STATUS_DISPLAY_ORDER.indexOf(a as (typeof CONTACT_STATUS_DISPLAY_ORDER)[number]);
      const bIndex = CONTACT_STATUS_DISPLAY_ORDER.indexOf(b as (typeof CONTACT_STATUS_DISPLAY_ORDER)[number]);
      const normalizedA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
      const normalizedB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
      return normalizedA - normalizedB || a.localeCompare(b);
    });
    return statuses;
  }, [contacts]);

  const renderDetailedView = (contact: ContactWithDetails, index: number) => (
    <motion.div
      key={contact.id}
      initial={{ opacity: 0, filter: "blur(6px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="w-full max-w-full min-w-0 overflow-hidden md:max-w-none md:overflow-visible"
    >
      <Card
        className={cn(
          "w-full max-w-full cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-md hover:scale-[1.02] md:max-w-none md:overflow-visible",
          studyBibleDarkClasses.bwiCard,
          getStudyBibleDarkCardShade(contact.id || contact.name),
          studyBibleDarkClasses.cardHover
        )}
        onClick={() => onContactClick(contact)}
      >
        <CardHeader>
          <div className="flex items-start justify-between w-full min-w-0 gap-2 md:min-w-[auto]">
            <div className="flex-1 min-w-0">
              <div className="w-full min-w-0 md:min-w-[auto]">
                <CardTitle className="text-2xl sm:text-3xl font-black flex flex-col sm:flex-row sm:items-center gap-2 w-full min-w-0 md:min-w-[auto]">
                  <div className="relative min-w-0 flex-1 max-w-[320px] overflow-hidden">
                    <span 
                      className={`whitespace-nowrap block pr-8 ${
                        contact.name.length > 35 ? 'animate-marquee' : ''
                      }`}
                      title={contact.name}
                      style={{
                        '--marquee-distance': contact.name.length > 35 
                          ? `calc(-100% + ${Math.max(320 - (contact.name.length * 8), 200)}px)`
                          : '-80%'
                      } as React.CSSProperties}
                    >
                      {contact.name}
                    </span>
                    <div className={cn("absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card via-card/50 to-transparent pointer-events-none", getStudyBibleDarkCardFade(contact.id || contact.name))}></div>
                  </div>
                </CardTitle>
                
                {/* Establishment name */}
                {contact.establishment_name && (
                  <div className="mt-2 flex min-w-0 items-center gap-1 text-sm font-medium">
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate md:whitespace-normal">{contact.establishment_name}</span>
                  </div>
                )}
                {/* Status Badge */}
                <div className="mt-2">
                  {renderContactStatusCell(contact)}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="text-center">
                <p className="text-sm font-medium">{contact.top_visitors?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Visitors</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between w-full min-w-0 gap-2 md:min-w-[auto]">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Overlapping avatars for top visitors - up to 5 */}
              <div className="flex items-center flex-shrink-0">
                {contact.top_visitors?.slice(0, 5).map((visitor, index) => (
                  <Avatar 
                    key={visitor.user_id || index} 
                    className={`h-6 w-6 ring-2 ring-background ${index > 0 ? '-ml-2' : ''}`}
                  >
                    <AvatarImage src={visitor.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {`${visitor.first_name} ${visitor.last_name}`.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              {contact.top_visitors && contact.top_visitors.length > 5 && (
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  +{contact.top_visitors.length - 5} more
                </span>
              )}
              {contact.note && (
                <div className="relative min-w-0 flex-1 max-w-[320px] overflow-hidden">
                  <span 
                    className={`text-xs text-muted-foreground whitespace-nowrap block pr-8 ${
                      contact.note.length > 55 ? 'animate-marquee' : ''
                    }`}
                    style={{
                      '--marquee-distance': contact.note.length > 55 
                        ? `calc(-100% + ${Math.max(320 - (contact.note.length * 6), 200)}px)`
                        : '-80%'
                    } as React.CSSProperties}
                  >
                    {contact.note}
                  </span>
                  <div className={cn("absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card via-card/50 to-transparent pointer-events-none", getStudyBibleDarkCardFade(contact.id || contact.name))}></div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const renderCompactView = (contact: ContactWithDetails, index: number) => (
    <motion.div
      key={contact.id}
      initial={{ opacity: 0, filter: "blur(6px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="w-full"
    >
      <Card
        className={cn(
          "cursor-pointer hover:shadow-md transition-all duration-300 hover:scale-[1.02] overflow-hidden",
          studyBibleDarkClasses.bwiCard,
          getStudyBibleDarkCardShade(contact.id || contact.name),
          studyBibleDarkClasses.cardHover
        )}
        onClick={() => onContactClick(contact)}
      >
        <div className="py-0 px-3">
          <div className="flex items-center justify-between gap-2 min-w-0">
            {/* Left side - Name, status, establishment, and avatars */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap min-w-0">
                <h3 className="font-semibold text-sm truncate" title={contact.name}>{truncateContactName(contact.name)}</h3>
                
                {/* Status Badge */}
                {renderContactStatusCell(contact, { compact: true })}
              </div>
              
              {/* Establishment and avatars in same line */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {contact.establishment_name && (
                  <span className="truncate flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {contact.establishment_name}
                  </span>
                )}
                
                {/* Avatars inline with establishment */}
                {(contact.top_visitors && contact.top_visitors.length > 0) && (
                  <div className="flex items-center ml-2">
                    {contact.top_visitors.slice(0, 3).map((visitor, index) => (
                      <Avatar 
                        key={visitor.user_id || index} 
                        className={`h-4 w-4 ring-1 ring-background ${index > 0 ? '-ml-1' : ''}`}
                      >
                        <AvatarImage src={visitor.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {`${visitor.first_name} ${visitor.last_name}`.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {contact.top_visitors.length > 3 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        +{contact.top_visitors.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </motion.div>
  );

  const renderTableView = () => (
    <div className={cn("w-full h-full flex flex-col overscroll-none overflow-hidden rounded-xl border border-border/70 dark:border-[#3a3342]", studyBibleDarkClasses.card)} style={{ overscrollBehavior: 'none' }}>
      {/* Fixed Table Header */}
      <div className={cn("flex-shrink-0 border-b", studyBibleDarkClasses.tableHeader)}>
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className={studyBibleDarkClasses.tableHeaderRow}>
              <ContactTableSortTh
                label="Name"
                sortKey="name"
                sort={contactTableSort}
                onToggle={toggleContactTableSort}
                className="w-[40%] md:w-[30%] p-0 align-bottom"
              />
              <ContactTableSortTh
                label="Status"
                sortKey="status"
                sort={contactTableSort}
                onToggle={toggleContactTableSort}
                className="w-[20%] md:w-[16%] p-0 align-bottom"
              />
              <ContactTableSortTh
                label="Establishment"
                sortKey="establishment"
                sort={contactTableSort}
                onToggle={toggleContactTableSort}
                className="w-[40%] md:w-[30%] p-0 align-bottom"
              />
              <ContactTableSortTh
                label="Last call"
                sortKey="last_call"
                sort={contactTableSort}
                onToggle={toggleContactTableSort}
                className="hidden md:table-cell w-[14%] p-0 align-bottom"
              />
              <ContactTableSortTh
                label="Calls"
                sortKey="calls"
                sort={contactTableSort}
                onToggle={toggleContactTableSort}
                className="hidden md:table-cell w-[10%] p-0 align-bottom"
              />
            </tr>
          </thead>
        </table>
      </div>
      
      {/* Scrollable Table Body */}
      <div
        ref={tableBodyScrollRef}
        className="flex-1 overflow-y-auto no-scrollbar overscroll-none pb-[calc(max(env(safe-area-inset-bottom),0px)+255px)] md:pb-[max(env(safe-area-inset-bottom),0px)+16px)] bg-background dark:bg-[#24231f]"
        style={{ overscrollBehavior: "contain", touchAction: "pan-y" }}
      >
        <table className="w-full text-sm table-fixed">
          <tbody>
            {visibleContacts.map((contact, index) => (
              <tr
                key={contact.id || index}
                className={cn(
                  "cursor-pointer border-b transition-colors",
                  "dark:border-[#3a3342]",
                  getStudyBibleDarkCardShade(String(contact.id ?? contact.name ?? index)),
                  "hover:bg-muted/30",
                  studyBibleDarkClasses.cardHover
                )}
                onClick={() => onContactClick(contact)}
              >
                <td className="p-3 min-w-0 w-[40%] md:w-[30%]">
                  <NameWithAvatarsCell name={contact.name} visitors={contact.top_visitors} />
                </td>
                <td className="p-3 w-[20%] md:w-[16%]">
                  {renderContactStatusCell(contact, { table: true })}
                </td>
                <td className="p-3 min-w-0 w-[40%] md:w-[30%]">
                  {contact.establishment_name ? (
                    <EstablishmentNameCell name={contact.establishment_name} />
                  ) : null}
                </td>
                <td className="hidden md:table-cell p-3 min-w-0 md:w-[14%] text-muted-foreground dark:text-[#ded6e7]">
                  {formatTableDate(contact.last_visit_at)}
                </td>
                <td className="hidden md:table-cell p-3 md:w-[10%]">
                  {getContactCallTotal(contact)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleCount < contactsForSlice.length && (
          <div ref={sentinelRef} className="h-16 w-full" aria-label="Load more trigger" />
        )}
      </div>
    </div>
  );

  return (
    <div
      className={
        viewMode === 'table'
          ? "w-full overflow-hidden flex flex-col overscroll-none mt-10"
          : "w-full"
      }
      style={
        viewMode === "table"
          ? {
              overscrollBehavior: "none",
              // Use the large viewport on tablet+ so iPad paints through the bottom safe area.
              height: "100lvh"
            }
          : undefined
      }
    >

      {/* Contacts */}
      <AnimatePresence mode="wait" initial={false}>
        {viewMode === 'table' ? (
          <motion.div
            key="table"
            className="w-full h-full flex-1 min-h-0"
            layout
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {renderTableView()}
          </motion.div>
        ) : (
          <motion.div
            key="cards"
            initial={{ opacity: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          >
            {viewMode === "detailed" ? (
              <>
                <div className="grid gap-4 mt-10 w-full md:hidden">
                  {visibleContacts.map((contact, index) =>
                    renderDetailedView(contact, index)
                  )}
                </div>
                <div
                  className="no-scrollbar mt-10 hidden h-[calc(100lvh-max(env(safe-area-inset-top),var(--device-safe-top,0px))-128px)] min-h-[420px] w-full overflow-x-auto overscroll-x-contain md:grid md:grid-flow-col md:gap-4"
                  style={{
                    gridAutoColumns: "32%",
                  }}
                >
                  {detailedStatusColumns.map((status) => {
                    const columnContacts = contacts.filter((contact) =>
                      resolveContactStatuses(contact).includes(status)
                    );
                    return (
                      <section
                        key={status}
                        className="flex min-h-0 min-w-0 flex-col rounded-lg border border-transparent bg-transparent"
                        aria-label={`${formatStatusText(status)} contacts`}
                      >
                        <div className={cn("mb-3 rounded-lg border px-3 py-2 text-xs font-bold uppercase tracking-wide border-border dark:border-[#1c1921] dark:bg-[#30283c]", getStatusTitleColor(status))}>
                          {formatStatusText(status)}
                        </div>
                        <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pb-[calc(max(env(safe-area-inset-bottom),0px)+132px)] md:pb-[max(env(safe-area-inset-bottom),0px)+12px)] pr-1">
                          {columnContacts.map((contact, index) =>
                            renderDetailedView(contact, index)
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="grid gap-4 mt-10 w-full">
                {visibleContacts.map((contact, index) =>
                  renderCompactView(contact, index)
                )}
              </div>
            )}
            {visibleCount < contactsForSlice.length && (
              <div
                ref={sentinelRef}
                className={cn("h-20 w-full", viewMode === "detailed" && "md:hidden")}
                aria-label="Load more trigger"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
