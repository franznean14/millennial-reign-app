"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { List, LayoutGrid, Table as TableIcon, Filter, User, UserCheck, X, Building2 } from "lucide-react";
import { type HouseholderWithDetails, type BusinessFiltersState } from "@/lib/db/business";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { useListViewMode } from "@/lib/hooks/use-list-view-mode";
import { useInfiniteList } from "@/lib/hooks/use-infinite-list";
import { formatHouseholderStatusCompactText, formatStatusText } from "@/lib/utils/formatters";

interface HouseholderListProps {
  householders: HouseholderWithDetails[];
  onHouseholderClick: (householder: HouseholderWithDetails) => void;
  onHouseholderDelete?: (householder: HouseholderWithDetails) => void;
  onHouseholderArchive?: (householder: HouseholderWithDetails) => void;
  myHouseholdersOnly?: boolean;
  onMyHouseholdersChange?: (checked: boolean) => void;
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

export function HouseholderList({ 
  householders, 
  onHouseholderClick,
  onHouseholderDelete,
  onHouseholderArchive,
  myHouseholdersOnly,
  onMyHouseholdersChange,
  onOpenFilters,
  filters,
  onClearAllFilters,
  onClearSearch,
  onRemoveStatus,
  onRemoveArea,
  viewMode: externalViewMode,
  onViewModeChange
}: HouseholderListProps) {
  
  // Reset scroll position to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const { viewMode } = useListViewMode<ViewMode>({
    defaultViewMode: "detailed",
    externalViewMode,
    onViewModeChange,
    storageKey: "householder-view-mode",
    allowedModes: ["detailed", "compact", "table"],
    cycleOrder: ["detailed", "compact", "table"]
  });

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
  const { visibleCount, sentinelRef } = useInfiniteList({
    itemsLength: householders.length,
    viewMode,
    initialCounts: { detailed: 7, compact: 10, table: 40 },
    stepCounts: { detailed: 5, compact: 10, table: 40 },
  });
  const visibleHouseholders = useMemo(
    () => householders.slice(0, visibleCount),
    [householders, visibleCount]
  );

  const hasActiveFilters = !!filters && (
    !!filters.search || (filters.statuses?.length ?? 0) > 0 || (filters.areas?.length ?? 0) > 0 || !!filters.myEstablishments
  );

  const formatStatusCompactText = formatHouseholderStatusCompactText;

  const truncateHouseholderName = (name: string, maxLength: number = 20) => {
    return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
  };

  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'do_not_call':
        return 'bg-red-500';
      case 'interested':
        return 'bg-blue-500';
      case 'return_visit':
        return 'bg-orange-500';
      case 'bible_study':
        return 'bg-emerald-500';
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
      default:
        return 'text-gray-600 border-gray-200 bg-gray-50 dark:text-gray-400 dark:border-gray-800 dark:bg-gray-950';
    }
  };

  const renderDetailedView = (householder: HouseholderWithDetails, index: number) => (
    <motion.div
      key={householder.id}
      initial={{ opacity: 0, filter: "blur(6px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="w-full"
    >
      <Card
        className="cursor-pointer hover:shadow-md transition-all duration-300 hover:scale-[1.02]"
        onClick={() => onHouseholderClick(householder)}
      >
        <CardHeader>
          <div className="flex items-start justify-between w-full gap-2">
            <div className="flex-1 min-w-0">
              <div className="w-full">
                <CardTitle className="text-2xl sm:text-3xl font-black flex flex-col sm:flex-row sm:items-center gap-2 w-full">
                  <div className="relative min-w-0 flex-1 max-w-[280px] overflow-hidden">
                    <span 
                      className={`whitespace-nowrap block pr-8 ${
                        householder.name.length > 35 ? 'animate-marquee' : ''
                      }`}
                      title={householder.name}
                      style={{
                        '--marquee-distance': householder.name.length > 35 
                          ? `calc(-100% + ${Math.max(280 - (householder.name.length * 8), 200)}px)`
                          : '-80%'
                      } as React.CSSProperties}
                    >
                      {householder.name}
                    </span>
                    <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card via-card/50 to-transparent pointer-events-none"></div>
                  </div>
                  
                  {/* Status Badge */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge 
                      variant="outline" 
                      className={cn(getStatusTextColorClass(householder.status))}
                    >
                      {formatStatusText(householder.status)}
                    </Badge>
                  </div>
                </CardTitle>
                
                {/* Establishment name below the status badge */}
                {householder.establishment_name && (
                  <div className="mt-2 text-sm font-medium flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {householder.establishment_name}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="text-center">
                <p className="text-sm font-medium">{householder.top_visitors?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Visitors</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between w-full gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Overlapping avatars for top visitors - up to 5 */}
              <div className="flex items-center flex-shrink-0">
                {householder.top_visitors?.slice(0, 5).map((visitor, index) => (
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
              {householder.top_visitors && householder.top_visitors.length > 5 && (
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  +{householder.top_visitors.length - 5} more
                </span>
              )}
              {householder.note && (
                <div className="relative min-w-0 flex-1 max-w-[320px] overflow-hidden">
                  <span 
                    className={`text-xs text-muted-foreground whitespace-nowrap block pr-8 ${
                      householder.note.length > 55 ? 'animate-marquee' : ''
                    }`}
                    style={{
                      '--marquee-distance': householder.note.length > 55 
                        ? `calc(-100% + ${Math.max(320 - (householder.note.length * 6), 200)}px)`
                        : '-80%'
                    } as React.CSSProperties}
                  >
                    {householder.note}
                  </span>
                  <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card via-card/50 to-transparent pointer-events-none"></div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const renderCompactView = (householder: HouseholderWithDetails, index: number) => (
    <motion.div
      key={householder.id}
      initial={{ opacity: 0, filter: "blur(6px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="w-full"
    >
      <Card
        className="cursor-pointer hover:shadow-md transition-all duration-300 hover:scale-[1.02] overflow-hidden"
        onClick={() => onHouseholderClick(householder)}
      >
        <div className="py-0 px-3">
          <div className="flex items-center justify-between gap-2 min-w-0">
            {/* Left side - Name, status, establishment, and avatars */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap min-w-0">
                <h3 className="font-semibold text-sm truncate" title={householder.name}>{truncateHouseholderName(householder.name)}</h3>
                
                {/* Status Badge */}
                <div className="flex items-center gap-1">
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs px-1.5 py-0.5", getStatusTextColorClass(householder.status))}
                  >
                    {formatStatusText(householder.status)}
                  </Badge>
                </div>
              </div>
              
              {/* Establishment and avatars in same line */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {householder.establishment_name && (
                  <span className="truncate flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {householder.establishment_name}
                  </span>
                )}
                
                {/* Avatars inline with establishment */}
                {(householder.top_visitors && householder.top_visitors.length > 0) && (
                  <div className="flex items-center ml-2">
                    {householder.top_visitors.slice(0, 3).map((visitor, index) => (
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
                    {householder.top_visitors.length > 3 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        +{householder.top_visitors.length - 3}
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
    <div className="w-full h-full flex flex-col overscroll-none" style={{ overscrollBehavior: 'none' }}>
      {/* Fixed Table Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="border-b">
              <th className="text-left py-3 px-3 w-[40%]">Name</th>
              <th className="text-left py-3 px-3 w-[20%]">Status</th>
              <th className="text-left py-3 px-3 w-[40%]">Establishment</th>
            </tr>
          </thead>
        </table>
      </div>
      
      {/* Scrollable Table Body */}
      <div
        className="flex-1 overflow-y-auto no-scrollbar overscroll-none pb-[calc(max(env(safe-area-inset-bottom),0px)+5px)]"
        style={{ overscrollBehavior: "contain", touchAction: "pan-y" }}
      >
        <table className="w-full text-sm table-fixed">
          <tbody>
            {visibleHouseholders.map((householder, index) => (
              <tr
                key={householder.id || index}
                className="border-b hover:bg-muted/30 cursor-pointer"
                onClick={() => onHouseholderClick(householder)}
              >
                <td className="p-3 min-w-0 w-[40%]">
                  <NameWithAvatarsCell name={householder.name} visitors={householder.top_visitors} />
                </td>
                <td className="p-3 w-[20%]">
                  <div className="flex items-center gap-1 min-w-0">
                    <Badge 
                      variant="outline" 
                      className={cn("text-[10px] leading-4 px-1.5 py-0.5 rounded-sm", getStatusTextColorClass(householder.status))}
                    >
                      {formatStatusCompactText(householder.status)}
                    </Badge>
                  </div>
                </td>
                <td className="p-3 min-w-0 w-[40%]">
                  {householder.establishment_name ? (
                    <EstablishmentNameCell name={householder.establishment_name} />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visibleCount < householders.length && (
          <div ref={sentinelRef} className="h-16 w-full" aria-label="Load more trigger" />
        )}
      </div>
    </div>
  );

  return (
    <div
      className={
        viewMode === 'table'
          ? "w-full overflow-hidden flex flex-col overscroll-none mt-6"
          : "w-full"
      }
      style={
        viewMode === "table"
          ? {
              overscrollBehavior: "none",
              // Full dynamic viewport height minus bottom nav height (80px)
              height: "calc(100dvh - 80px)"
            }
          : undefined
      }
    >

      {/* Householders */}
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
            <div className="grid gap-4 mt-10 w-full">
              {visibleHouseholders.map((householder, index) =>
                viewMode === 'detailed'
                  ? renderDetailedView(householder, index)
                  : renderCompactView(householder, index)
              )}
            </div>
            {visibleCount < householders.length && (
              <div ref={sentinelRef} className="h-20 w-full" aria-label="Load more trigger" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
