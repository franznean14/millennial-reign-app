"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, Building2, MapPinned, Calendar, Users, Edit } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { useMobile } from "@/lib/hooks/use-mobile";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "@/components/ui/sonner";
import { deleteEstablishment, archiveEstablishment } from "@/lib/db/business";
import { type EstablishmentWithDetails, type VisitWithUser, type HouseholderWithDetails } from "@/lib/db/business";
import { cn } from "@/lib/utils";
import { getBestStatus, getStatusColor, getStatusTextColor } from "@/lib/utils/status-hierarchy";
import { EstablishmentForm } from "@/components/business/EstablishmentForm";
import { VisitForm } from "@/components/business/VisitForm";
import { getBwiParticipants } from "@/lib/db/business";
import { VisitUpdatesSection } from "@/components/business/VisitUpdatesSection";

interface EstablishmentDetailsProps {
  establishment: EstablishmentWithDetails;
  visits: VisitWithUser[];
  householders: HouseholderWithDetails[];
  onBackClick: () => void;
  onEstablishmentUpdated?: (establishment: EstablishmentWithDetails) => void;
  onHouseholderClick?: (householder: HouseholderWithDetails) => void;
}

// Helper function for householder status color coding
const getHouseholderStatusColorClass = (status: string) => {
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

export function EstablishmentDetails({ 
  establishment, 
  visits, 
  householders, 
  onBackClick,
  onEstablishmentUpdated,
  onHouseholderClick
}: EstablishmentDetailsProps) {
  
  // Reset scroll position to top when component mounts
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is fully rendered
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      // Also reset document element scroll position
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
  }, []);
  const [isEditing, setIsEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [editVisit, setEditVisit] = useState<{ id: string; establishment_id?: string | null; householder_id?: string | null; note?: string | null; publisher_id?: string | null; partner_id?: string | null; visit_date?: string } | null>(null);
  const titleContainerRef = useRef<HTMLDivElement>(null);
  const titleContentRef = useRef<HTMLDivElement>(null);
  const [scrollDistance, setScrollDistance] = useState(0);
  const [shouldScroll, setShouldScroll] = useState(false);
  const isMobile = useMobile();

  useEffect(() => {
    const measure = () => {
      const container = titleContainerRef.current;
      const content = titleContentRef.current;
      if (!container || !content) return;
      const fadeWidthPx = 48; // matches w-12 gradient
      const overshootPx = 8; // small overshoot so text clears the fade completely
      const overflow = content.scrollWidth - container.clientWidth;
      const willScroll = overflow > 4; // only scroll when content truly overflows
      setShouldScroll(willScroll);
      setScrollDistance(willScroll ? overflow + fadeWidthPx + overshootPx : 0);
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

  const handleDelete = async () => {
    if (!establishment?.id) return;
    setDeleting(true);
    try {
      const ok = await deleteEstablishment(establishment.id);
      if (ok) {
        toast.success("Establishment deleted successfully");
        setIsEditing(false);
        onBackClick();
      } else {
        toast.error("Failed to delete establishment");
      }
    } catch (e) {
      toast.error("Error deleting establishment");
    } finally {
      setDeleting(false);
    }
  };

  const handleArchive = async () => {
    if (!establishment?.id) return;
    setArchiving(true);
    try {
      const ok = await archiveEstablishment(establishment.id);
      if (ok) {
        toast.success("Establishment archived successfully");
        setIsEditing(false);
        onBackClick();
      } else {
        toast.error("Failed to archive establishment");
      }
    } catch (e) {
      toast.error("Error archiving establishment");
    } finally {
      setArchiving(false);
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
          <motion.div layout className="min-w-0 flex-1 relative z-0 max-w-[calc(100%-60px)]">
            <div ref={titleContainerRef} className="relative w-full overflow-hidden">
              <motion.div
                ref={titleContentRef}
                className="whitespace-nowrap pr-12 text-2xl font-bold"
                animate={shouldScroll ? { x: [0, -scrollDistance, 0] } : undefined}
                transition={shouldScroll ? { duration: Math.max(scrollDistance / 40, 10), times: [0, 0.6, 1], repeat: Infinity, ease: "linear", repeatDelay: 0.8 } : undefined}
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
            <div>
              <p className="text-sm font-medium text-muted-foreground">Note</p>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm break-words flex-1 max-w-[70%]">
                  {(() => {
                    const raw = establishment.note ? String(establishment.note) : 'No notes added';
                    return raw.length > 100 ? raw.slice(0, 100) + '…' : raw;
                  })()}
                </p>
                {(() => {
                  const hasCoords = !!establishment.lat && !!establishment.lng;
                  const common = "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs whitespace-nowrap";
                  return hasCoords ? (
                    <a
                      className={`${common} hover:bg-muted`}
                      href={`https://www.google.com/maps/dir/?api=1&destination=${establishment.lat},${establishment.lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPinned className="h-3.5 w-3.5" />
                      Directions
                    </a>
                  ) : (
                    <span className={`${common} opacity-50 pointer-events-none`}>
                      <MapPinned className="h-3.5 w-3.5" />
                      Directions
                    </span>
                  );
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Visit Updates Section */}
      <motion.div layout className="w-full">
        <VisitUpdatesSection visits={visits} />
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
                    <button onClick={() => onHouseholderClick && onHouseholderClick(householder)} key={householder.id} className="flex items-start gap-3 p-3 border rounded-lg w-full text-left hover:bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{householder.name}</span>
                          <Badge variant="outline" className={cn("text-xs", getHouseholderStatusColorClass(householder.status))}>
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
                    </button>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No householders recorded yet</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Edit Establishment Modal (consistent with BusinessDrawerDialogs) */}
      {isMobile ? (
        <Drawer open={isEditing} onOpenChange={setIsEditing}>
          <DrawerContent>
            <DrawerHeader className="text-center">
              <DrawerTitle>Edit Establishment</DrawerTitle>
              <DrawerDescription>Update establishment details</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              <EstablishmentForm 
                onSaved={handleEditSaved}
                onDelete={handleDelete}
                onArchive={handleArchive}
                selectedArea={establishment.area || undefined}
                initialData={establishment}
                isEditing={true}
              />
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent>
            <DialogHeader className="text-center">
              <DialogTitle>Edit Establishment</DialogTitle>
              <DialogDescription>Update establishment details</DialogDescription>
            </DialogHeader>
            <div className="px-4">
              <EstablishmentForm 
                onSaved={handleEditSaved}
                onDelete={handleDelete}
                onArchive={handleArchive}
                selectedArea={establishment.area || undefined}
                initialData={establishment}
                isEditing={true}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Visit Modal (consistent with BusinessDrawerDialogs) */}
      {isMobile ? (
        <Drawer open={!!editVisit} onOpenChange={(o) => setEditVisit(o ? editVisit : null)}>
          <DrawerContent>
            <DrawerHeader className="text-center">
              <DrawerTitle>Edit Visit</DrawerTitle>
              <DrawerDescription>Update visit details</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              {editVisit && (
                <VisitForm
                  establishments={[{ id: establishment.id, name: establishment.name }]}
                  selectedEstablishmentId={establishment.id}
                  initialVisit={editVisit}
                  onSaved={() => setEditVisit(null)}
                />
              )}
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={!!editVisit} onOpenChange={(o) => setEditVisit(o ? editVisit : null)}>
          <DialogContent>
            <DialogHeader className="text-center">
              <DialogTitle>Edit Visit</DialogTitle>
              <DialogDescription>Update visit details</DialogDescription>
            </DialogHeader>
            <div className="px-4">
              {editVisit && (
                <VisitForm
                  establishments={[{ id: establishment.id, name: establishment.name }]}
                  selectedEstablishmentId={establishment.id}
                  initialVisit={editVisit}
                  onSaved={() => setEditVisit(null)}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
