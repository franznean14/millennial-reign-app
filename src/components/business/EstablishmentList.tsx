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

interface EstablishmentListProps {
  establishments: EstablishmentWithDetails[];
  onEstablishmentClick: (establishment: EstablishmentWithDetails) => void;
  onEstablishmentDelete?: (establishment: EstablishmentWithDetails) => void;
  onEstablishmentArchive?: (establishment: EstablishmentWithDetails) => void;
}

type ViewMode = 'detailed' | 'compact';

export function EstablishmentList({ 
  establishments, 
  onEstablishmentClick,
  onEstablishmentDelete,
  onEstablishmentArchive
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

  const getStatusColor = (statuses: string[]) => {
    // Use the first status for color coding
    const primaryStatus = statuses?.[0] || '';
    switch (primaryStatus) {
      case 'for_follow_up':
        return 'border-orange-500/50 bg-orange-500/5';
      case 'has_bible_studies':
        return 'border-green-500/50 bg-green-500/5';
      case 'accepted_rack':
        return 'border-blue-500/50 bg-blue-500/5';
      case 'declined_rack':
        return 'border-red-500/50 bg-red-500/5';
      default:
        return 'border-gray-500/50 bg-gray-500/5';
    }
  };

  const getStatusTextColor = (statuses: string[]) => {
    // Use the first status for color coding
    const primaryStatus = statuses?.[0] || '';
    switch (primaryStatus) {
      case 'for_follow_up':
        return 'text-orange-500 border-orange-500/50';
      case 'has_bible_studies':
        return 'text-green-500 border-green-500/50';
      case 'accepted_rack':
        return 'text-blue-500 border-blue-500/50';
      case 'declined_rack':
        return 'text-red-500 border-red-500/50';
      default:
        return 'text-gray-500 border-gray-500/50';
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
                  <span className="truncate">{establishment.name}</span>
                  <Badge 
                    variant="outline" 
                    className={cn("flex-shrink-0", getStatusTextColor(establishment.statuses))}
                  >
                    {establishment.statuses && establishment.statuses.length > 0 
                      ? formatStatusText(establishment.statuses[0]) 
                      : 'Unknown'}
                  </Badge>
                </CardTitle>
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
        className="cursor-pointer hover:shadow-md transition-all duration-300 hover:scale-[1.02]"
        onClick={() => onEstablishmentClick(establishment)}
      >
        <div className="p-3">
          <div className="flex items-center justify-between gap-3">
            {/* Left side - Name and status */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-base truncate">{establishment.name}</h3>
                <Badge 
                  variant="outline" 
                  className={cn("flex-shrink-0 text-xs", getStatusTextColor(establishment.statuses))}
                >
                  {establishment.statuses && establishment.statuses.length > 0 
                    ? formatStatusText(establishment.statuses[0]) 
                    : 'Unknown'}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {establishment.area && (
                  <span className="truncate">{establishment.area}</span>
                )}
                {establishment.floor && (
                  <span className="flex-shrink-0">{establishment.floor}</span>
                )}
              </div>
            </div>

            {/* Right side - Stats and avatars */}
            <div className="flex items-center gap-3 flex-shrink-0">
              {/* Compact stats */}
              <div className="flex items-center gap-2 text-xs">
                <div className="text-center">
                  <p className="text-sm font-medium">{establishment.visit_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Visits</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">{establishment.householder_count || 0}</p>
                  <p className="text-xs text-muted-foreground">BS</p>
                </div>
              </div>

              {/* Compact avatars */}
              <div className="flex items-center">
                {establishment.top_visitors?.slice(0, 5).map((visitor, index) => (
                  <Avatar 
                    key={visitor.user_id || index} 
                    className={`h-5 w-5 ring-1 ring-background ${index > 0 ? '-ml-1' : ''}`}
                  >
                    <AvatarImage src={visitor.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {`${visitor.first_name} ${visitor.last_name}`.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {establishment.top_visitors && establishment.top_visitors.length > 5 && (
                  <span className="text-xs text-muted-foreground ml-1">
                    +{establishment.top_visitors.length - 5}
                  </span>
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
        <div className="text-sm text-muted-foreground">
          Showing {establishments.length} establishments
        </div>
        
        {/* View Toggle - Toggle switch with smooth layout animation */}
        <button
          className="toggle-container"
          style={{
            width: 70,
            height: 36,
            backgroundColor: "rgba(66, 153, 225, 0.2)",
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
                color: viewMode === 'compact' ? "rgb(66, 153, 225)" : "rgba(66, 153, 225, 0.5)" 
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
                color: viewMode === 'detailed' ? "rgb(66, 153, 225)" : "rgba(66, 153, 225, 0.5)" 
              }} 
            />
          </div>

          <motion.div
            className="toggle-handle"
            style={{
              width: 28,
              height: 28,
              backgroundColor: "rgb(66, 153, 225)",
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
