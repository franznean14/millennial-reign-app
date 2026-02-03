"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { List, LayoutGrid, Table as TableIcon, Filter, User, UserCheck, X } from "lucide-react";
import { type EstablishmentWithDetails, type BusinessFiltersState } from "@/lib/db/business";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { getStatusColor, getStatusTextColor, getBestStatus } from "@/lib/utils/status-hierarchy";
import { useListViewMode } from "@/lib/hooks/use-list-view-mode";
import { useInfiniteList } from "@/lib/hooks/use-infinite-list";
import { formatEstablishmentStatusCompactText, formatStatusText } from "@/lib/utils/formatters";

interface EstablishmentListProps {
  establishments: EstablishmentWithDetails[];
  onEstablishmentClick: (establishment: EstablishmentWithDetails) => void;
  onEstablishmentDelete?: (establishment: EstablishmentWithDetails) => void;
  onEstablishmentArchive?: (establishment: EstablishmentWithDetails) => void;
  myEstablishmentsOnly?: boolean;
  onMyEstablishmentsChange?: (checked: boolean) => void;
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

function MarqueeCell({
  text
}: {
  text: string;
}) {
  return (
    <div className="truncate" title={text}>
      {text}
    </div>
  );
}

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

export function EstablishmentList({ 
  establishments, 
  onEstablishmentClick,
  onEstablishmentDelete,
  onEstablishmentArchive,
  myEstablishmentsOnly,
  onMyEstablishmentsChange,
  onOpenFilters,
  filters,
  onClearAllFilters,
  onClearSearch,
  onRemoveStatus,
  onRemoveArea,
  viewMode: externalViewMode,
  onViewModeChange
}: EstablishmentListProps) {
  
  // Reset scroll position to top when component mounts
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const { viewMode } = useListViewMode<ViewMode>({
    defaultViewMode: "detailed",
    externalViewMode,
    onViewModeChange,
    storageKey: "establishment-view-mode",
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
    itemsLength: establishments.length,
    viewMode
  });
  const visibleEstablishments = useMemo(
    () => establishments.slice(0, visibleCount),
    [establishments, visibleCount]
  );

  const hasActiveFilters = !!filters && (
    !!filters.search || (filters.statuses?.length ?? 0) > 0 || (filters.areas?.length ?? 0) > 0 || !!filters.myEstablishments
  );

  const formatStatusCompactText = formatEstablishmentStatusCompactText;

  const truncateEstablishmentName = (name: string, maxLength: number = 20) => {
    return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
  };

  const getStatusDotColorClass = (status: string) => {
    switch (status) {
      case 'declined_rack':
        return 'bg-red-500';
      case 'for_scouting':
        return 'bg-cyan-500';
      case 'for_follow_up':
        return 'bg-orange-500';
      case 'accepted_rack':
        return 'bg-blue-500';
      case 'for_replenishment':
        return 'bg-purple-500';
      case 'has_bible_studies':
        return 'bg-emerald-500';
      case 'closed':
        return 'bg-slate-500';
      case 'rack_pulled_out':
        return 'bg-amber-500';
      default:
        return 'bg-gray-500';
    }
  };

  const renderDetailedView = (establishment: EstablishmentWithDetails, index: number) => (
    <motion.div
      key={establishment.id}
      initial={{ opacity: 0, filter: "blur(6px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="w-full"
    >
      <Card
        className="cursor-pointer hover:shadow-md transition-all duration-300 hover:scale-[1.02]"
        onClick={() => onEstablishmentClick(establishment)}
      >
        <CardHeader>
          <div className="flex items-start justify-between w-full gap-2">
            <div className="flex-1 min-w-0">
              <div className="w-full">
                <CardTitle className="text-2xl sm:text-3xl font-black flex flex-col sm:flex-row sm:items-center gap-2 w-full">
                  <div className="relative min-w-0 flex-1 max-w-[320px] overflow-hidden">
                    <span 
                      className={`whitespace-nowrap block pr-8 ${
                        establishment.name.length > 30 ? 'animate-marquee' : ''
                      }`}
                      title={establishment.name}
                      style={{
                        '--marquee-distance': establishment.name.length > 30 
                          ? `calc(-100% + ${Math.max(320 - (establishment.name.length * 8), 200)}px)`
                          : '-80%'
                      } as React.CSSProperties}
                    >
                      {establishment.name}
                    </span>
                    <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card via-card/50 to-transparent pointer-events-none"></div>
                  </div>
                  
                  {/* Status Badge with Hierarchy */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge 
                      variant="outline" 
                      className={cn(getStatusTextColor(getBestStatus(establishment.statuses || [])))}
                    >
                      {establishment.statuses && establishment.statuses.length > 0 
                        ? formatStatusText(getBestStatus(establishment.statuses))
                        : 'Unknown'}
                    </Badge>
                    
                    {/* Additional status dots - Fixed color logic */}
                    {establishment.statuses && establishment.statuses.length > 1 && (
                      <div className="flex gap-1">
                        {establishment.statuses
                          .filter(status => status !== getBestStatus(establishment.statuses))
                          .map((status, index) => {
                            // Get the solid color for the dot
                            let dotColor = '';
                            switch (status) {
                              case 'declined_rack':
                                dotColor = 'bg-red-500';
                                break;
                              case 'for_scouting':
                                dotColor = 'bg-cyan-500';
                                break;
                              case 'for_follow_up':
                                dotColor = 'bg-orange-500';
                                break;
                              case 'accepted_rack':
                                dotColor = 'bg-blue-500';
                                break;
                              case 'for_replenishment':
                                dotColor = 'bg-purple-500';
                                break;
                              case 'has_bible_studies':
                                dotColor = 'bg-emerald-500';
                                break;
                              default:
                                dotColor = 'bg-gray-500';
                            }
                            
                            return (
                              <div
                                key={status}
                                className={cn("w-3 h-3 rounded-full", dotColor)}
                                title={formatStatusText(status)}
                              />
                            );
                          })}
                      </div>
                    )}
                  </div>
                </CardTitle>
                
                {/* Area label below the status badge */}
                {establishment.area && (
                  <div className="mt-2 text-sm font-medium">{establishment.area}</div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="text-center">
                <p className="text-sm font-medium">{establishment.visit_count || 0}</p>
                <p className="text-xs text-muted-foreground">Visits</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">{establishment.householder_count || 0}</p>
                <p className="text-xs text-muted-foreground">BS</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">0</p>
                <p className="text-xs text-muted-foreground">RV</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between w-full gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {/* Overlapping avatars for top visitors - up to 5 */}
              <div className="flex items-center flex-shrink-0">
                {establishment.top_visitors?.slice(0, 5).map((visitor, index) => (
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
              {establishment.top_visitors && establishment.top_visitors.length > 5 && (
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  +{establishment.top_visitors.length - 5} more
                </span>
              )}
              {establishment.description && (
                <div className="relative min-w-0 flex-1 max-w-[320px] overflow-hidden">
                  <span 
                    className={`text-xs text-muted-foreground whitespace-nowrap block pr-8 ${
                      establishment.description.length > 50 ? 'animate-marquee' : ''
                    }`}
                    style={{
                      '--marquee-distance': establishment.description.length > 50 
                        ? `calc(-100% + ${Math.max(320 - (establishment.description.length * 6), 200)}px)`
                        : '-80%'
                    } as React.CSSProperties}
                  >
                    {establishment.description}
                  </span>
                  <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card via-card/50 to-transparent pointer-events-none"></div>
                </div>
              )}
            </div>
            {establishment.floor && (
              <span className="text-xs text-muted-foreground flex-shrink-0">{establishment.floor}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  const renderCompactView = (establishment: EstablishmentWithDetails, index: number) => (
    <motion.div
      key={establishment.id}
      initial={{ opacity: 0, filter: "blur(6px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="w-full"
    >
      <Card
        className="cursor-pointer hover:shadow-md transition-all duration-300 hover:scale-[1.02] overflow-hidden"
        onClick={() => onEstablishmentClick(establishment)}
      >
        <div className="py-0 px-3">
          <div className="flex items-center justify-between gap-2 min-w-0">
            {/* Left side - Name, status, area, and avatars */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap min-w-0">
                <h3 className="font-semibold text-sm truncate" title={establishment.name}>{truncateEstablishmentName(establishment.name)}</h3>
                
                {/* Status Badge with Hierarchy */}
                <div className="flex items-center gap-1">
                  <Badge 
                    variant="outline" 
                    className={cn("text-xs px-1.5 py-0.5", getStatusTextColor(getBestStatus(establishment.statuses || [])))}
                  >
                    {establishment.statuses && establishment.statuses.length > 0 
                      ? formatStatusText(getBestStatus(establishment.statuses))
                      : 'Unknown'}
                  </Badge>
                  
                  {/* Additional status dots - Fixed color logic */}
                  {establishment.statuses && establishment.statuses.length > 1 && (
                    <div className="flex gap-1">
                      {establishment.statuses
                        .filter(status => status !== getBestStatus(establishment.statuses))
                        .map((status, index) => {
                          // Get the solid color for the dot
                          let dotColor = '';
                          switch (status) {
                            case 'declined_rack':
                              dotColor = 'bg-red-500';
                              break;
                            case 'for_scouting':
                              dotColor = 'bg-cyan-500';
                              break;
                            case 'for_follow_up':
                              dotColor = 'bg-orange-500';
                              break;
                            case 'accepted_rack':
                              dotColor = 'bg-blue-500';
                              break;
                            case 'for_replenishment':
                              dotColor = 'bg-purple-500';
                              break;
                            case 'has_bible_studies':
                              dotColor = 'bg-emerald-500';
                              break;
                            case 'rack_pulled_out':
                              dotColor = 'bg-amber-500';
                              break;
                            default:
                              dotColor = 'bg-gray-500';
                          }
                          
                          return (
                            <div
                              key={status}
                              className={cn("w-3 h-3 rounded-full", dotColor)}
                              title={formatStatusText(status)}
                            />
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Area and avatars in same line */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {establishment.area && (
                  <span className="truncate">{establishment.area}</span>
                )}
                {establishment.floor && (
                  <span className="flex-shrink-0">• {establishment.floor}</span>
                )}
                
                {/* Avatars inline with area */}
                {(establishment.top_visitors && establishment.top_visitors.length > 0) && (
                  <div className="flex items-center ml-2">
                    {establishment.top_visitors.slice(0, 3).map((visitor, index) => (
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
                    {establishment.top_visitors.length > 3 && (
                      <span className="text-xs text-muted-foreground ml-1">
                        +{establishment.top_visitors.length - 3}
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
              <th className="text-left py-3 px-3 w-[50%]">Name</th>
              <th className="text-left py-3 px-3 w-[23%]">Status</th>
              <th className="text-left py-3 px-3 w-[27%]">Area</th>
            </tr>
          </thead>
        </table>
      </div>
      
      {/* Scrollable Table Body */}
      <div
        className="flex-1 overflow-y-auto no-scrollbar overscroll-none pb-[calc(max(env(safe-area-inset-bottom),0px)+175px)]"
        style={{ overscrollBehavior: "contain", touchAction: "pan-y" }}
      >
        <table className="w-full text-sm table-fixed">
          <tbody>
            {visibleEstablishments.map((establishment, index) => (
              <motion.tr
                key={establishment.id || index}
                layout
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="border-b hover:bg-muted/30 cursor-pointer"
                onClick={() => onEstablishmentClick(establishment)}
              >
                <td className="p-3 min-w-0 w-[50%]">
                  <NameWithAvatarsCell name={establishment.name} visitors={establishment.top_visitors} />
                </td>
                <td className="p-3 w-[23%]">
                  <div className="flex items-center gap-1 min-w-0">
                    <Badge 
                      variant="outline" 
                      className={cn("text-[10px] leading-4 px-1.5 py-0.5 rounded-sm", getStatusTextColor(getBestStatus(establishment.statuses || [])))}
                    >
                      {formatStatusCompactText(getBestStatus(establishment.statuses || []))}
                    </Badge>
                    {(establishment.statuses && establishment.statuses.length > 1) && (
                      <div className="flex items-center gap-0.5">
                        {establishment.statuses
                          ?.filter(s => s !== getBestStatus(establishment.statuses || []))
                          .slice(0, 3)
                          .map((status) => (
                            <div key={status} className={cn("w-1.5 h-1.5 rounded-full", getStatusDotColorClass(status))} title={formatStatusText(status)} />
                          ))}
                        {establishment.statuses.filter(s => s !== getBestStatus(establishment.statuses || [])).length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{establishment.statuses.filter(s => s !== getBestStatus(establishment.statuses || [])).length - 3}</span>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-3 min-w-0 w-[27%]">
                  <MarqueeCell text={establishment.area || '-'} />
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
        {visibleCount < establishments.length && (
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

      {/* Establishments */}
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
              {visibleEstablishments.map((establishment, index) =>
                viewMode === 'detailed'
                  ? renderDetailedView(establishment, index)
                  : renderCompactView(establishment, index)
              )}
            </div>
            {visibleCount < establishments.length && (
              <div ref={sentinelRef} className="h-20 w-full" aria-label="Load more trigger" />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
