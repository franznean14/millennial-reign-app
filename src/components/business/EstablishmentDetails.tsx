"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, MapPin, Building2, MapPinned, Calendar, Users, Edit } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { type EstablishmentWithDetails, type VisitWithUser, type HouseholderWithDetails } from "@/lib/db/business";
import { cn } from "@/lib/utils";
import { getBestStatus, getStatusColor, getStatusTextColor } from "@/lib/utils/status-hierarchy";
import { EstablishmentForm } from "@/components/business/EstablishmentForm";

interface EstablishmentDetailsProps {
  establishment: EstablishmentWithDetails;
  visits: VisitWithUser[];
  householders: HouseholderWithDetails[];
  onBackClick: () => void;
  onEstablishmentUpdated?: (establishment: EstablishmentWithDetails) => void;
}

export function EstablishmentDetails({ 
  establishment, 
  visits, 
  householders, 
  onBackClick,
  onEstablishmentUpdated
}: EstablishmentDetailsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const titleContainerRef = useRef<HTMLDivElement>(null);
  const titleContentRef = useRef<HTMLDivElement>(null);
  const [scrollDistance, setScrollDistance] = useState(0);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    const measure = () => {
      const container = titleContainerRef.current;
      const content = titleContentRef.current;
      if (!container || !content) return;
      const distance = Math.max(content.scrollWidth - container.clientWidth, 0);
      setScrollDistance(distance);
      setShouldScroll(distance > 4); // small buffer to avoid micro scroll
    };
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [establishment.name]);

  const formatStatusText = (status: string) => {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Primary status by hierarchy for consistent coloring
  const primaryStatus = getBestStatus(establishment.statuses || []);

  const handleEditSaved = (updatedEstablishment: any) => {
    setIsEditing(false);
    if (onEstablishmentUpdated) {
      onEstablishmentUpdated(updatedEstablishment);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Header with back button and edit button */}
      <motion.div 
        layout
        className="flex items-center justify-between gap-4 w-full"
        transition={{ 
          layout: { 
            type: "spring", 
            stiffness: 300, 
            damping: 30 
          }
        }}
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBackClick}
            className="p-2 flex-shrink-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <motion.div layout className="min-w-0 flex-1 relative z-0 max-w-[calc(100%-112px)]">
            <div ref={titleContainerRef} className="relative w-full overflow-hidden">
              <motion.div
                ref={titleContentRef}
                className="whitespace-nowrap pr-12 text-2xl font-bold"
                animate={shouldScroll ? { x: [0, -scrollDistance, 0] } : undefined}
                transition={shouldScroll ? { duration: Math.max(scrollDistance / 60, 8), times: [0, 0.5, 1], repeat: Infinity, ease: "linear", repeatDelay: 1 } : undefined}
              >
                {establishment.name}
              </motion.div>
              <div className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-background to-transparent" />
            </div>
            <motion.p 
              layout 
              className="text-muted-foreground truncate"
              transition={{ 
                layout: { 
                  type: "spring", 
                  stiffness: 300, 
                  damping: 30 
                }
              }}
            >
              {establishment.area || 'No area specified'}
            </motion.p>
          </motion.div>
        </div>
        
        {/* Edit Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditing(true)}
          className="flex-shrink-0 relative z-10 ml-2"
        >
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </motion.div>

      {/* Basic Establishment Info with Direction Button */}
      <motion.div layout className="w-full">
        <Card className={cn("w-full", getStatusColor(primaryStatus))}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 flex-shrink-0" />
              Establishment Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={cn("flex-shrink-0", getStatusTextColor(primaryStatus))}
                  >
                    {formatStatusText(primaryStatus)}
                  </Badge>
                  {establishment.statuses && establishment.statuses.length > 1 && (
                    <div className="flex gap-1">
                      {establishment.statuses
                        .filter((s) => s !== primaryStatus)
                        .map((status) => {
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
                            <div key={status} className={cn("w-2 h-2 rounded-full", dotColor)} title={formatStatusText(status)} />
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Floor</p>
                <p>{establishment.floor || 'Not specified'}</p>
              </div>
            </div>
            {establishment.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Description</p>
                <p className="break-words">{establishment.description}</p>
              </div>
            )}
            {establishment.lat && establishment.lng && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Location</p>
                <div className="flex items-center justify-between">
                  <p className="flex items-center gap-1 text-sm">
                    <MapPin className="h-3 w-3 flex-shrink-0" />
                    <span className="break-all">{establishment.lat.toFixed(6)}, {establishment.lng.toFixed(6)}</span>
                  </p>
                  <a 
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted" 
                    href={`https://www.google.com/maps/dir/?api=1&destination=${establishment.lat},${establishment.lng}`}
                    target="_blank" 
                    rel="noreferrer"
                  >
                    <MapPinned className="h-3.5 w-3.5" />
                    Directions
                  </a>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Visit Updates Section */}
      <motion.div layout className="w-full">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 flex-shrink-0" />
              Visit Updates ({visits.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {visits.length > 0 ? (
              <div className="space-y-3">
                {visits
                  .filter((visit, index, self) => 
                    // Remove duplicates based on visit ID
                    index === self.findIndex(v => v.id === visit.id)
                  )
                  .map((visit) => {
                    console.log('Visit data:', visit); // Debug log
                    console.log('Publisher:', visit.publisher); // Debug publisher
                    console.log('Partner:', visit.partner); // Debug partner
                    return (
                      <div key={visit.id} className="flex items-start justify-between gap-3 p-3 border rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{formatDate(visit.visit_date)}</span>
                          </div>
                          {visit.note && (
                            <p className="text-sm text-muted-foreground">{visit.note}</p>
                          )}
                        </div>
                        
                        {/* Publisher avatars on the right - overlapping style */}
                        <div className="flex items-center flex-shrink-0">
                          {visit.publisher ? (
                            <Avatar className="h-8 w-8 ring-2 ring-background">
                              <AvatarImage src={visit.publisher.avatar_url} alt={`${visit.publisher.first_name} ${visit.publisher.last_name}`} />
                              <AvatarFallback className="text-xs">
                                {visit.publisher.first_name && visit.publisher.last_name ? 
                                  `${visit.publisher.first_name} ${visit.publisher.last_name}`.charAt(0) : 
                                  'U'
                                }
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="text-xs text-muted-foreground">No publisher</div>
                          )}
                          {visit.partner ? (
                            <Avatar className="h-8 w-8 -ml-2 ring-2 ring-background">
                              <AvatarImage src={visit.partner.avatar_url} alt={`${visit.partner.first_name} ${visit.partner.last_name}`} />
                              <AvatarFallback className="text-xs">
                                {visit.partner.first_name && visit.partner.last_name ? 
                                  `${visit.partner.first_name} ${visit.partner.last_name}`.charAt(0) : 
                                  'U'
                                }
                              </AvatarFallback>
                            </Avatar>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No visits recorded yet</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Householders Section */}
      <motion.div layout className="w-full">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 flex-shrink-0" />
              Householders ({householders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {householders.length > 0 ? (
              <div className="space-y-3">
                {householders
                  .filter((householder, index, self) => 
                    // Remove duplicates based on householder ID
                    index === self.findIndex(h => h.id === householder.id)
                  )
                  .map((householder) => (
                    <div key={householder.id} className="flex items-start gap-3 p-3 border rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{householder.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {householder.status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                          </Badge>
                          {householder.assigned_user && (
                            <div className="flex items-center gap-1">
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={householder.assigned_user.avatar_url} />
                                <AvatarFallback className="text-xs">
                                  {`${householder.assigned_user.first_name} ${householder.assigned_user.last_name}`.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-muted-foreground">
                                {householder.assigned_user.first_name} {householder.assigned_user.last_name}
                              </span>
                            </div>
                          )}
                        </div>
                        {householder.note && (
                          <p className="text-sm text-muted-foreground">{householder.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No householders recorded yet</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Edit Establishment Modal */}
      <ResponsiveModal 
        open={isEditing} 
        onOpenChange={setIsEditing} 
        title="Edit Establishment" 
        description="Update establishment details" 
        className="sm:max-w-[560px]"
      >
        <EstablishmentForm 
          onSaved={handleEditSaved}
          selectedArea={establishment.area || undefined}
          initialData={establishment}
          isEditing={true}
        />
      </ResponsiveModal>
    </div>
  );
}
