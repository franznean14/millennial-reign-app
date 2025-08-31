"use client";

import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SwipeableCard } from "@/components/ui/swipeable-card";
import { type EstablishmentWithDetails } from "@/lib/db/business";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

interface EstablishmentListProps {
  establishments: EstablishmentWithDetails[];
  onEstablishmentClick: (establishment: EstablishmentWithDetails) => void;
  onEstablishmentDelete?: (establishment: EstablishmentWithDetails) => void;
  onEstablishmentArchive?: (establishment: EstablishmentWithDetails) => void;
}

export function EstablishmentList({ 
  establishments, 
  onEstablishmentClick,
  onEstablishmentDelete,
  onEstablishmentArchive
}: EstablishmentListProps) {
  const formatStatusText = (status: string) => {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
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

  const getStatusTextColor = (status: string) => {
    switch (status) {
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

  const handleDelete = (establishment: EstablishmentWithDetails) => {
    if (onEstablishmentDelete) {
      onEstablishmentDelete(establishment);
    } else {
      toast.error("Delete functionality not implemented");
    }
  };

  const handleArchive = (establishment: EstablishmentWithDetails) => {
    if (onEstablishmentArchive) {
      onEstablishmentArchive(establishment);
    } else {
      toast.error("Archive functionality not implemented");
    }
  };

  return (
    <div className="grid gap-4 mt-6 w-full">
      {establishments.map((establishment, index) => (
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
          <SwipeableCard
            className={cn(
              "cursor-pointer hover:shadow-md transition-all duration-300 hover:scale-[1.02]",
              getStatusColor(establishment.status)
            )}
            onDelete={() => handleDelete(establishment)}
            onArchive={() => handleArchive(establishment)}
          >
            <div onClick={() => onEstablishmentClick(establishment)}>
              <CardHeader>
                <div className="flex items-start justify-between w-full gap-2">
                  <div className="flex-1 min-w-0">
                    <motion.div layout className="w-full">
                      <CardTitle className="text-2xl sm:text-3xl font-black flex flex-col sm:flex-row sm:items-center gap-2 w-full">
                        <span className="truncate">{establishment.name}</span>
                        <Badge 
                          variant="outline" 
                          className={cn("flex-shrink-0", getStatusTextColor(establishment.status))}
                        >
                          {formatStatusText(establishment.status || '')}
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
                    {/* Overlapping avatars for top visitors - up to 3 */}
                    <div className="flex items-center flex-shrink-0">
                      {establishment.top_visitors?.slice(0, 3).map((visitor, index) => (
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
                    {establishment.top_visitors && establishment.top_visitors.length > 3 && (
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        +{establishment.top_visitors.length - 3} more
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
            </div>
          </SwipeableCard>
        </motion.div>
      ))}
    </div>
  );
}
