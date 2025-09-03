"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { List, Grid3X3 } from "lucide-react";
import { type EstablishmentWithDetails } from "@/lib/db/business";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { Switch } from "@/components/ui/switch";
import { getStatusColor, getStatusTextColor, getBestStatus } from "@/lib/utils/status-hierarchy";

interface EstablishmentListProps {
  establishments: EstablishmentWithDetails[];
  onEstablishmentClick: (establishment: EstablishmentWithDetails) => void;
  onEstablishmentDelete?: (establishment: EstablishmentWithDetails) => void;
  onEstablishmentArchive?: (establishment: EstablishmentWithDetails) => void;
  myEstablishmentsOnly?: boolean;
  onMyEstablishmentsChange?: (checked: boolean) => void;
}

type ViewMode = 'detailed' | 'compact';

export function EstablishmentList({ 
  establishments, 
  onEstablishmentClick,
  onEstablishmentDelete,
  onEstablishmentArchive,
  myEstablishmentsOnly,
  onMyEstablishmentsChange
}: EstablishmentListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('detailed');

  // Load view mode preference from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('establishment-view-mode') as ViewMode;
    if (savedViewMode && (savedViewMode === 'detailed' || savedViewMode === 'compact')) {
      setViewMode(savedViewMode);
    }
  }, []);

  // Save view mode preference to localStorage
  const handleViewModeChange = (newViewMode: ViewMode) => {
    setViewMode(newViewMode);
    localStorage.setItem('establishment-view-mode', newViewMode);
  };

  const formatStatusText = (status: string) => {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const truncateEstablishmentName = (name: string, maxLength: number = 20) => {
    return name.length > maxLength ? name.substring(0, maxLength) + '...' : name;
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
                  <div className="mt-2">
                    <span className="text-sm text-muted-foreground">Area: </span>
                    <span className="text-sm font-medium">{establishment.area}</span>
                  </div>
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

  return (
    <div className="w-full">
      {/* Controls Row - Toggle and Results Count on same line */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="myEstablishments"
            checked={myEstablishmentsOnly || false}
            onCheckedChange={onMyEstablishmentsChange || (() => {})}
          />
          <label htmlFor="myEstablishments" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
            My Establishments
          </label>
        </div>
        
        {/* View Toggle - Toggle switch with smooth layout animation */}
        <button
          className="toggle-container"
          style={{
            width: 70,
            height: 36,
            backgroundColor: "#171717",
            borderRadius: 36,
            cursor: "pointer",
            display: "flex",
            padding: 4,
            justifyContent: viewMode === 'detailed' ? "flex-start" : "flex-end",
            position: "relative",
          }}
          onClick={() => handleViewModeChange(viewMode === 'detailed' ? 'compact' : 'detailed')}
        >
          {/* Icon on the left side (Compact view) */}
          <div 
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 1,
            }}
          >
            <Grid3X3 
              className="h-4 w-4" 
              style={{ 
                color: viewMode === 'compact' ? "rgb(104,104,104)" : "rgb(10, 10, 10)" 
              }} 
            />
          </div>

          {/* Icon on the right side (Detailed view) */}
          <div 
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 1,
            }}
          >
            <List 
              className="h-4 w-4" 
              style={{ 
                color: viewMode === 'detailed' ? "rgb(104,104,104)" : "rgb(10, 10, 10)"
              }} 
            />
          </div>

          <motion.div
            className="toggle-handle"
            style={{
              width: 28,
              height: 28,
              backgroundColor: "rgb(10, 10, 10)",
              borderRadius: "50%",
            }}
            layout
            transition={{
              type: "spring",
              visualDuration: 0.2,
              bounce: 0.2,
            }}
          />
        </button>
      </div>

      {/* Establishment List */}
      <div className="grid gap-4 mt-6 w-full">
        {establishments.map((establishment, index) => 
          viewMode === 'detailed' 
            ? renderDetailedView(establishment, index)
            : renderCompactView(establishment, index)
        )}
      </div>
    </div>
  );
}
