"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { List, LayoutGrid, Table as TableIcon, Filter, User, UserCheck, X, Building2 } from "lucide-react";
import { type HouseholderWithDetails, type BusinessFiltersState } from "@/lib/db/business";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";

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
  onRemoveArea
}: HouseholderListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('detailed');
  const [visibleCount, setVisibleCount] = useState<number>(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Load view mode preference from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('householder-view-mode') as ViewMode;
    if (savedViewMode && (savedViewMode === 'detailed' || savedViewMode === 'compact' || savedViewMode === 'table')) {
      setViewMode(savedViewMode);
    }
  }, []);

  // Reset initial visible count whenever the view or data changes
  useEffect(() => {
    const initial = viewMode === 'detailed' ? 7 : viewMode === 'compact' ? 10 : 20;
    setVisibleCount(Math.min(initial, householders.length));
  }, [viewMode, householders.length]);

  // Observe sentinel to progressively render more items as the user scrolls
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const step = viewMode === 'detailed' ? 5 : viewMode === 'compact' ? 10 : 20;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + step, householders.length));
        }
      }
    }, { root: null, rootMargin: '200px', threshold: 0 });

    observer.observe(el);
    return () => observer.disconnect();
  }, [viewMode, householders.length]);

  // Save view mode preference to localStorage
  const handleViewModeChange = (newViewMode: ViewMode) => {
    setViewMode(newViewMode);
    try { localStorage.setItem('householder-view-mode', newViewMode); } catch {}
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
      case 'return_visit':
        return 'RV';
      case 'bible_study':
        return 'BS';
      case 'do_not_call':
        return 'DNC';
      case 'interested':
        return 'Int';
      default:
        return formatStatusText(status);
    }
  };

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
        onClick={() => onHouseholderClick(householder)}
      >
        <CardHeader>
          <div className="flex items-start justify-between w-full gap-2">
            <div className="flex-1 min-w-0">
              <motion.div layout className="w-full">
                <CardTitle className="text-2xl sm:text-3xl font-black flex flex-col sm:flex-row sm:items-center gap-2 w-full">
                  <span className="truncate" title={householder.name}>{truncateHouseholderName(householder.name)}</span>
                  
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
              </motion.div>
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
                <span className="text-xs text-muted-foreground truncate">{householder.note}</span>
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
    <div className="w-full overflow-x-auto no-scrollbar">
      <table className="w-full text-sm table-fixed">
        <thead>
          <tr className="border-b">
            <th className="text-left p-3 w-[40%]">Name</th>
            <th className="text-left p-3 w-[20%]">Status</th>
            <th className="text-left p-3 w-[40%]">Establishment</th>
          </tr>
        </thead>
        <tbody>
          {householders.slice(0, visibleCount).map((householder, index) => (
            <tr key={householder.id || index} className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => onHouseholderClick(householder)}>
              <td className="p-3 min-w-0">
                <NameWithAvatarsCell name={householder.name} visitors={householder.top_visitors} />
              </td>
              <td className="p-3">
                <div className="flex items-center gap-1 min-w-0">
                  <Badge 
                    variant="outline" 
                    className={cn("text-[10px] leading-4 px-1.5 py-0.5 rounded-sm", getStatusTextColorClass(householder.status))}
                  >
                    {formatStatusCompactText(householder.status)}
                  </Badge>
                </div>
              </td>
              <td className="p-3 truncate flex items-center gap-1">
                {householder.establishment_name ? (
                  <>
                    <Building2 className="h-3 w-3 flex-shrink-0" />
                    {householder.establishment_name}
                  </>
                ) : '-'}
              </td>
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
                  <span>My Householders</span>
                  <button type="button" onClick={() => onMyHouseholdersChange && onMyHouseholdersChange(false)} aria-label="Remove My Householders" className="ml-1 rounded hover:bg-muted p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
            {/* Right fade to hint overflow */}
            <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-background to-transparent" />
          </div>
        </div>

        {/* Right: Buttons cluster */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            type="button"
            variant={myHouseholdersOnly ? "default" : "outline"}
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => (onMyHouseholdersChange ? onMyHouseholdersChange(!myHouseholdersOnly) : undefined)}
            aria-pressed={!!myHouseholdersOnly}
            aria-label="My householders"
            title="My householders"
          >
            {myHouseholdersOnly ? <UserCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => (onOpenFilters ? onOpenFilters() : undefined)}
            title="Filters"
          >
            <Filter className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={cycleViewMode}
            title={`View: ${viewMode}`}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={viewMode}
                initial={{ opacity: 0, scale: 0.8, rotate: -90 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8, rotate: 90 }}
                transition={{ duration: 0.18 }}
                className="inline-flex"
              >
                {viewMode === 'detailed' && <LayoutGrid className="h-4 w-4" />}
                {viewMode === 'compact' && <List className="h-4 w-4" />}
                {viewMode === 'table' && <TableIcon className="h-4 w-4" />}
              </motion.span>
            </AnimatePresence>
          </Button>
        </div>
      </div>

      {/* Householders */}
      {viewMode === 'table' ? (
        <div className="mt-6 w-full">{renderTableView()}</div>
      ) : (
        <div className="grid gap-4 mt-6 w-full">
          {householders.slice(0, visibleCount).map((householder, index) => 
            viewMode === 'detailed' 
              ? renderDetailedView(householder, index)
              : renderCompactView(householder, index)
          )}
        </div>
      )}

      {visibleCount < householders.length && (
        <div ref={sentinelRef} className="h-10" />
      )}
    </div>
  );
}
