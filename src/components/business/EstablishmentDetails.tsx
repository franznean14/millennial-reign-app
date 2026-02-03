"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, MapPinned, Calendar, Users } from "lucide-react";
import { FormModal } from "@/components/shared/FormModal";
import { toast } from "@/components/ui/sonner";
import { deleteEstablishment, archiveEstablishment } from "@/lib/db/business";
import { type EstablishmentWithDetails, type VisitWithUser, type HouseholderWithDetails } from "@/lib/db/business";
import { cn } from "@/lib/utils";
import { formatStatusText } from "@/lib/utils/formatters";
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
  isLoading?: boolean;
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
  onHouseholderClick,
  isLoading = false
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

  // Listen for edit trigger from header
  useEffect(() => {
    const handleEditTrigger = () => {
      setIsEditing(true);
    };
    window.addEventListener('trigger-edit-details', handleEditTrigger);
    return () => {
      window.removeEventListener('trigger-edit-details', handleEditTrigger);
    };
  }, []);

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
    <div className="space-y-6 w-full max-w-full -mt-2">
      {/* Basic Establishment Info with Direction Button */}
      <motion.div className="w-full" layout transition={{ duration: 0.2, ease: "easeOut" }}>
        <Card
          role="button"
          tabIndex={0}
          onClick={() => setIsEditing(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setIsEditing(true);
            }
          }}
          className={cn("w-full cursor-pointer transition-colors hover:bg-muted/30", getStatusColor(primaryStatus))}
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 flex-shrink-0" />
              Details
            </CardTitle>
            {!!establishment.lat && !!establishment.lng && (
              <a
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs whitespace-nowrap hover:bg-muted"
                href={`https://www.google.com/maps/dir/?api=1&destination=${establishment.lat},${establishment.lng}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                <MapPinned className="h-3.5 w-3.5" />
                Directions
              </a>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="h-3 bg-muted/60 rounded w-16 mb-2 animate-pulse" />
                    <div className="flex items-center gap-2">
                      <div className="h-6 bg-muted/60 rounded w-20 animate-pulse" />
                      <div className="w-2 h-2 bg-muted/60 rounded-full animate-pulse" />
                    </div>
                  </div>
                  <div>
                    <div className="h-3 bg-muted/60 rounded w-16 mb-2 animate-pulse" />
                    <div className="h-4 bg-muted/60 rounded w-24 animate-pulse" />
                  </div>
                </div>
                <div>
                  <div className="h-3 bg-muted/60 rounded w-20 mb-2 animate-pulse" />
                  <div className="h-4 bg-muted/60 rounded w-full max-w-[200px] animate-pulse" />
                </div>
                <div>
                  <div className="h-3 bg-muted/60 rounded w-16 mb-2 animate-pulse" />
                  <div className="h-4 bg-muted/60 rounded w-full max-w-[300px] animate-pulse" />
                  <div className="h-4 bg-muted/60 rounded w-full max-w-[250px] mt-2 animate-pulse" />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {/* Row 1: Status | Area */}
                  {establishment.statuses && establishment.statuses.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant="outline" 
                          className={cn("flex-shrink-0", getStatusTextColor(primaryStatus))}
                        >
                          {formatStatusText(primaryStatus)}
                        </Badge>
                        {establishment.statuses.length > 1 && (
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
                                  case 'closed':
                                    dotColor = 'bg-slate-500';
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
                  )}
                  {establishment.area?.trim() && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Area</p>
                      <p>{establishment.area.trim()}</p>
                    </div>
                  )}
                  {/* Row 2: Description or Note (left) | Floor (right) when both exist; otherwise full-width or single cell */}
                  {establishment.description?.trim() && (
                    <div className={establishment.floor?.trim() ? undefined : "col-span-2"}>
                      <p className="text-sm font-medium text-muted-foreground">Description</p>
                      <p className="break-words">{establishment.description.trim()}</p>
                    </div>
                  )}
                  {establishment.description?.trim() && establishment.floor?.trim() && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Floor</p>
                      <p>{establishment.floor.trim()}</p>
                    </div>
                  )}
                  {!establishment.description?.trim() && establishment.note?.trim() && (
                    <div className={establishment.floor?.trim() ? undefined : "col-span-2"}>
                      <p className="text-sm font-medium text-muted-foreground">Note</p>
                      <p className="text-sm break-words">
                        {establishment.note.trim().length > 100
                          ? establishment.note.trim().slice(0, 100) + '…'
                          : establishment.note.trim()}
                      </p>
                    </div>
                  )}
                  {!establishment.description?.trim() && establishment.note?.trim() && establishment.floor?.trim() && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Floor</p>
                      <p>{establishment.floor.trim()}</p>
                    </div>
                  )}
                  {/* Row 3 when both Description and Note exist: Note only (Floor is already on row 2 with Description) */}
                  {establishment.description?.trim() && establishment.note?.trim() && (
                    <div className="col-span-2">
                      <p className="text-sm font-medium text-muted-foreground">Note</p>
                      <p className="text-sm break-words">
                        {establishment.note.trim().length > 100
                          ? establishment.note.trim().slice(0, 100) + '…'
                          : establishment.note.trim()}
                      </p>
                    </div>
                  )}
                  {/* No description and no note: Floor alone on row 2 (left column) */}
                  {!establishment.description?.trim() && !establishment.note?.trim() && establishment.floor?.trim() && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Floor</p>
                      <p>{establishment.floor.trim()}</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Visit Updates Section */}
      <motion.div className="w-full" layout transition={{ duration: 0.2, ease: "easeOut" }}>
        <VisitUpdatesSection 
          visits={visits} 
          isHouseholderContext={false}
          establishments={[{ id: establishment.id, name: establishment.name }]}
          selectedEstablishmentId={establishment.id}
          isLoading={isLoading}
          onVisitUpdated={() => {
            // Visit updates will be handled by the parent component's data refresh
          }}
        />
      </motion.div>

      {/* Householders Section */}
      <motion.div className="w-full" layout transition={{ duration: 0.2, ease: "easeOut" }}>
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
                            {formatStatusText(householder.status)}
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

      <FormModal
        open={isEditing}
        onOpenChange={setIsEditing}
        title="Edit Establishment"
        description="Update establishment details"
        headerClassName="text-center"
      >
              <EstablishmentForm 
                onSaved={handleEditSaved}
                onDelete={handleDelete}
                onArchive={handleArchive}
                selectedArea={establishment.area || undefined}
                initialData={establishment}
                isEditing={true}
              />
      </FormModal>

      <FormModal
        open={!!editVisit}
        onOpenChange={(open) => {
          if (!open) {
            setEditVisit(null);
          }
        }}
        title="Edit Visit"
        description="Update visit details"
        headerClassName="text-center"
      >
              {editVisit && (
                <VisitForm
                  establishments={[{ id: establishment.id, name: establishment.name }]}
                  selectedEstablishmentId={establishment.id}
                  initialVisit={editVisit}
                  onSaved={() => setEditVisit(null)}
                />
              )}
      </FormModal>
    </div>
  );
}
