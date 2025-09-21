"use client";

import { useState, useEffect, useRef } from "react";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scrollDistance, setScrollDistance] = useState(0);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const content = contentRef.current;
      if (!container || !content) return;
      const fadeWidthPx = 40; // width of gradient fade
      const overshootPx = 6; // ensure text clears fade fully
      const overflow = content.scrollWidth - container.clientWidth;
      const willScroll = overflow > 4;
      setShouldScroll(willScroll);
      setScrollDistance(willScroll ? overflow + fadeWidthPx + overshootPx : 0);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [name]);

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative flex-1 min-w-0">
        <div ref={containerRef} className="relative w-full overflow-hidden">
          <motion.div
            ref={contentRef}
            className="whitespace-nowrap pr-10"
            animate={shouldScroll ? { x: [0, -scrollDistance, 0] } : undefined}
            transition={shouldScroll ? { duration: Math.max(scrollDistance / 40, 10), times: [0, 0.6, 1], repeat: Infinity, ease: "linear", repeatDelay: 0.8 } : undefined}
            title={name}
          >
            {name}
          </motion.div>
          <div className="pointer-events-none absolute right-0 top-0 h-full w-10 bg-gradient-to-l from-background to-transparent" />
        </div>
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
  onRemoveArea
}: EstablishmentListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('detailed');
  const [visibleCount, setVisibleCount] = useState<number>(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Load view mode preference from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('establishment-view-mode') as ViewMode;
    if (savedViewMode && (savedViewMode === 'detailed' || savedViewMode === 'compact' || savedViewMode === 'table')) {
      setViewMode(savedViewMode);
    }
  }, []);

  // Reset initial visible count whenever the view or data changes
  useEffect(() => {
    const initial = viewMode === 'detailed' ? 7 : viewMode === 'compact' ? 10 : 20;
    setVisibleCount(Math.min(initial, establishments.length));
  }, [viewMode, establishments.length]);

  // Observe sentinel to progressively render more items as the user scrolls
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const step = viewMode === 'detailed' ? 5 : viewMode === 'compact' ? 10 : 20;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + step, establishments.length));
        }
      }
    }, { root: null, rootMargin: '200px', threshold: 0 });

    observer.observe(el);
    return () => observer.disconnect();
  }, [viewMode, establishments.length]);

  // Save view mode preference to localStorage
  const handleViewModeChange = (newViewMode: ViewMode) => {
    setViewMode(newViewMode);
    try { localStorage.setItem('establishment-view-mode', newViewMode); } catch {}
  };

  const cycleViewMode = () => {
    const next: ViewMode = viewMode === 'detailed' ? 'compact' : viewMode === 'compact' ? 'table' : 'detailed';
    handleViewModeChange(next);
  };

  const hasActiveFilters = !!filters && (
    !!filters.search || (filters.statuses?.length ?? 0) > 0 || (filters.areas?.length ?? 0) > 0 || !!filters.myEstablishments
  );

  const formatStatusText = (status: string) => {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatStatusCompactText = (status: string) => {
    // Make long statuses friendlier and shorter for tight spaces
    switch (status) {
      case 'for_follow_up':
        return 'Follow Up';
      case 'for_replenishment':
        return 'Replenish';
      case 'accepted_rack':
        return 'Accepted';
      case 'declined_rack':
        return 'Declined';
      case 'for_scouting':
        return 'Scouting';
      case 'has_bible_studies':
        return 'BS';
      default:
        return formatStatusText(status);
    }
  };

  const truncateEstablishmentName = (name: string, maxLength: number = 20) => {
    return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
  };

  const getStatusDotColorClass = (status: string) => {
    switch (status) {
      case 'declined_rack':
        return 'bg-red-500';
      case 'for_scouting':
        return 'bg-gray-500';
      case 'for_follow_up':
        return 'bg-orange-500';
      case 'accepted_rack':
        return 'bg-blue-500';
      case 'for_replenishment':
        return 'bg-purple-500';
      case 'has_bible_studies':
        return 'bg-emerald-500';
      default:
        return 'bg-gray-500';
    }
  };

  const renderDetailedView = (establishment: EstablishmentWithDetails, index: number) => (
    <motion.div
      key={establishment.id}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        delay: index * 0.05,
        layout: { 
          type: "spring", 
          stiffness: 300, 
          damping: 30 
        }
      }}
      className="w-full"
    >
      <Card
        className="cursor-pointer hover:shadow-md transition-all duration-300 hover:scale-[1.02]"
        onClick={() => onEstablishmentClick(establishment)}
      >
        <CardHeader>
          <div className="flex items-start justify-between w-full gap-2">
            <div className="flex-1 min-w-0">
              <motion.div layout className="w-full">
                <CardTitle className="text-2xl sm:text-3xl font-black flex flex-col sm:flex-row sm:items-center gap-2 w-full">
                  <span className="truncate" title={establishment.name}>{truncateEstablishmentName(establishment.name)}</span>
                  
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
                                dotColor = 'bg-gray-500';
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
              </motion.div>
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
                <span className="text-xs text-muted-foreground truncate">{establishment.description}</span>
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
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        delay: index * 0.05,
        layout: { 
          type: "spring", 
          stiffness: 300, 
          damping: 30 
        }
      }}
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
                              dotColor = 'bg-gray-500';
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
    <div className="w-full overflow-x-auto no-scrollbar">
      <table className="w-full text-sm table-fixed">
        <thead>
          <tr className="border-b">
            <th className="text-left p-3 w-[50%]">Name</th>
            <th className="text-left p-3 w-[23%]">Status</th>
            <th className="text-left p-3 w-[27%]">Area</th>
          </tr>
        </thead>
        <tbody>
          {establishments.slice(0, visibleCount).map((establishment, index) => (
            <tr key={establishment.id || index} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => onEstablishmentClick(establishment)}>
              <td className="p-3 min-w-0">
                <NameWithAvatarsCell name={establishment.name} visitors={establishment.top_visitors} />
              </td>
              <td className="p-3">
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
              <td className="p-3 truncate">{establishment.area || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="w-full">
      {/* Controls Row: Left = Clear + scrollable badges, Right = buttons */}
      <div className="flex items-center justify-between gap-2 mb-4">
        {/* Left: Clear + badges */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {hasActiveFilters && (
            <Badge
              variant="outline"
              className="px-2 py-1 text-xs inline-flex items-center gap-1 cursor-pointer flex-shrink-0"
              onClick={onClearAllFilters}
            >
              <span>Clear</span>
              <X className="h-3 w-3" />
            </Badge>
          )}
          <div className="relative flex-1 min-w-0">
            <div className="overflow-x-auto whitespace-nowrap pr-6 no-scrollbar">
              {filters?.search && (
                <Badge variant="secondary" className="mr-2 px-2 py-1 text-xs inline-flex items-center gap-1 align-middle">
                  <span>Search: {filters.search}</span>
                  <button type="button" onClick={onClearSearch} aria-label="Clear search" className="ml-1 rounded hover:bg-muted p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
              {(filters?.statuses || []).map((s) => (
                <Badge key={s} variant="secondary" className="mr-2 px-2 py-1 text-xs inline-flex items-center gap-1 align-middle">
                  <span>{formatStatusText(s)}</span>
                  <button type="button" onClick={() => onRemoveStatus && onRemoveStatus(s)} aria-label={`Remove ${formatStatusText(s)}`} className="ml-1 rounded hover:bg-muted p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {(filters?.areas || []).map((a) => (
                <Badge key={a} variant="secondary" className="mr-2 px-2 py-1 text-xs inline-flex items-center gap-1 align-middle">
                  <span>{a}</span>
                  <button type="button" onClick={() => onRemoveArea && onRemoveArea(a)} aria-label={`Remove ${a}`} className="ml-1 rounded hover:bg-muted p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {filters?.myEstablishments && (
                <Badge variant="secondary" className="mr-2 px-2 py-1 text-xs inline-flex items-center gap-1 align-middle">
                  <span>My Establishments</span>
                  <button type="button" onClick={() => onMyEstablishmentsChange && onMyEstablishmentsChange(false)} aria-label="Remove My Establishments" className="ml-1 rounded hover:bg-muted p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
            {/* Right fade to hint overflow */}
            <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-background to-transparent" />
          </div>
        </div>

      </div>

      {/* Establishments */}
      {viewMode === 'table' ? (
        <div className="mt-6 w-full">{renderTableView()}</div>
      ) : (
        <div className="grid gap-4 mt-6 w-full">
          {establishments.slice(0, visibleCount).map((establishment, index) => 
            viewMode === 'detailed' 
              ? renderDetailedView(establishment, index)
              : renderCompactView(establishment, index)
          )}
        </div>
      )}

      {visibleCount < establishments.length && (
        <div ref={sentinelRef} className="h-10" />
      )}
    </div>
  );
}
