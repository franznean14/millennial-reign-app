"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, MapPinned, Calendar, BookOpen, UserPlus, Minus } from "lucide-react";
import { FormModal } from "@/components/shared/FormModal";
import { toast } from "@/components/ui/sonner";
import { deleteEstablishment, archiveEstablishment, updateEstablishmentPublisherId } from "@/lib/db/business";
import { type EstablishmentWithDetails, type VisitWithUser, type HouseholderWithDetails, type MyOpenCallTodoItem } from "@/lib/db/business";
import { cn } from "@/lib/utils";
import { formatStatusText } from "@/lib/utils/formatters";
import { getBestStatus, getStatusColor, getStatusTextColor } from "@/lib/utils/status-hierarchy";
import { getInitials } from "@/lib/utils/visit-history-ui";
import { businessEventBus } from "@/lib/events/business-events";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { EstablishmentForm } from "@/components/business/EstablishmentForm";
import { VisitForm } from "@/components/business/VisitForm";
import { TodoForm } from "@/components/business/TodoForm";
import { getBwiParticipants } from "@/lib/db/business";
import { VisitUpdatesSection } from "@/components/business/VisitUpdatesSection";
import { HomeTodoCard } from "@/components/home/HomeTodoCard";

interface EstablishmentDetailsProps {
  establishment: EstablishmentWithDetails;
  visits: VisitWithUser[];
  householders: HouseholderWithDetails[];
  onBackClick: () => void;
  onEstablishmentUpdated?: (establishment: EstablishmentWithDetails) => void;
  onHouseholderClick?: (householder: HouseholderWithDetails) => void;
  publisherId?: string | null;
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
  publisherId,
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
  const [editTodo, setEditTodo] = useState<MyOpenCallTodoItem | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showAddConfirm, setShowAddConfirm] = useState(false);
  const [showMinusButton, setShowMinusButton] = useState(false);
  const [updatingPublisher, setUpdatingPublisher] = useState(false);
  const avatarButtonRef = useRef<HTMLDivElement>(null);
  const minusActiveOnPointerDownRef = useRef(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(publisherId ?? null);

  useEffect(() => {
    if (!publisherId) {
      const getCurrentUserId = async () => {
        try {
          const supabase = createSupabaseBrowserClient();
          const { data: { session } } = await supabase.auth.getSession();
          setCurrentUserId(session?.user?.id || null);
        } catch (e) {
          console.error('Error getting current user ID:', e);
        }
      };
      getCurrentUserId();
    }
  }, [publisherId]);

  const effectivePublisherId = publisherId ?? currentUserId;

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

  const handleAddAsPersonalTerritory = async () => {
    if (!establishment?.id || !effectivePublisherId) return;
    setUpdatingPublisher(true);
    try {
      const updated = await updateEstablishmentPublisherId(establishment.id, effectivePublisherId);
      if (updated) {
        if (onEstablishmentUpdated) onEstablishmentUpdated(updated);
        businessEventBus.emit('establishment-updated', updated);
        toast.success("Taken as personal territory");
        setShowAddConfirm(false);
      } else {
        toast.error("Failed to take as personal territory");
      }
    } catch (e) {
      toast.error("Error taking as personal territory");
    } finally {
      setUpdatingPublisher(false);
    }
  };

  const handleRemoveAsPersonalTerritory = async () => {
    if (!establishment?.id) return;
    setUpdatingPublisher(true);
    try {
      const updated = await updateEstablishmentPublisherId(establishment.id, null);
      if (updated) {
        if (onEstablishmentUpdated) onEstablishmentUpdated(updated);
        businessEventBus.emit('establishment-updated', updated);
        toast.success("Removed as personal territory");
        setShowRemoveConfirm(false);
        setShowMinusButton(false);
      } else {
        toast.error("Failed to remove as personal territory");
      }
    } catch (e) {
      toast.error("Error removing as personal territory");
    } finally {
      setUpdatingPublisher(false);
    }
  };

  const isCurrentUserPublisher = effectivePublisherId && establishment.publisher_id === effectivePublisherId;
  const assignedUser = establishment.assigned_user;

  useEffect(() => {
    if (!showMinusButton) return;
    const handleClickOutside = (event: Event) => {
      if (showRemoveConfirm) return;
      if (avatarButtonRef.current && !avatarButtonRef.current.contains(event.target as Node)) {
        setShowMinusButton(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside as EventListener);
    document.addEventListener('touchstart', handleClickOutside as EventListener);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside as EventListener);
      document.removeEventListener('touchstart', handleClickOutside as EventListener);
    };
  }, [showMinusButton, showRemoveConfirm]);

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

  const handleTodoTapOpenCall = (todo: MyOpenCallTodoItem) => {
    if (!todo.call_id) {
      setEditTodo(todo);
      return;
    }
    const matchedVisit = visits.find((v) => v.id === todo.call_id);
    if (matchedVisit) {
      setEditVisit({
        id: matchedVisit.id,
        establishment_id: matchedVisit.establishment_id ?? establishment.id ?? null,
        householder_id: matchedVisit.householder_id ?? null,
        note: matchedVisit.note ?? null,
        publisher_id: matchedVisit.publisher_id ?? null,
        partner_id: matchedVisit.partner_id ?? null,
        visit_date: matchedVisit.visit_date,
      });
      return;
    }
    setEditVisit({
      id: todo.call_id,
      establishment_id: todo.establishment_id ?? establishment.id ?? null,
      householder_id: todo.householder_id ?? null,
      visit_date: todo.visit_date ?? undefined,
    });
  };

  return (
    <div className="space-y-6 w-full max-w-full -mt-2 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]">
      {/* Basic Establishment Info with Direction Button */}
      <motion.div className="w-full" layout transition={{ duration: 0.2, ease: "easeOut" }}>
        <Card
          role="button"
          tabIndex={0}
          onPointerDownCapture={() => {
            minusActiveOnPointerDownRef.current = showMinusButton;
          }}
          onClick={() => {
            const wasMinusVisibleAtTapStart = minusActiveOnPointerDownRef.current;
            minusActiveOnPointerDownRef.current = false;
            if (wasMinusVisibleAtTapStart) return;
            if (!showMinusButton) setIsEditing(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!showMinusButton) setIsEditing(true);
            }
          }}
          className={cn("w-full cursor-pointer transition-colors hover:bg-muted/30", getStatusColor(primaryStatus))}
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 flex-shrink-0" />
                Details
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {!!establishment.lat && !!establishment.lng && (
                  <a
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border hover:bg-muted"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${establishment.lat},${establishment.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Directions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MapPinned className="h-4 w-4" />
                  </a>
                )}
                {/* Personal Territory: avatar / minus / UserPlus */}
                {isLoading ? (
                  <div className="h-8 w-8 rounded-full bg-muted/60 blur-[2px] animate-pulse" />
                ) : assignedUser && isCurrentUserPublisher ? (
                  <div
                    ref={avatarButtonRef}
                    className="flex-shrink-0 cursor-pointer h-8 w-8 flex items-center justify-center"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (!showMinusButton) setShowMinusButton(true);
                    }}
                  >
                    <AnimatePresence mode="wait">
                      {showMinusButton ? (
                        <motion.div
                          key="minus"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="h-8 w-8 flex items-center justify-center"
                        >
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8 min-h-8 min-w-8 rounded-full p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setShowRemoveConfirm(true);
                            }}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="avatar"
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.8, opacity: 0 }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className="h-8 w-8 flex items-center justify-center"
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 min-h-8 min-w-8 rounded-full p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setShowMinusButton(true);
                            }}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={assignedUser.avatar_url || undefined} alt={`${assignedUser.first_name} ${assignedUser.last_name}`} />
                              <AvatarFallback className="text-xs">
                                {getInitials(`${assignedUser.first_name} ${assignedUser.last_name}`)}
                              </AvatarFallback>
                            </Avatar>
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : assignedUser ? (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={assignedUser.avatar_url || undefined} alt={`${assignedUser.first_name} ${assignedUser.last_name}`} />
                    <AvatarFallback className="text-xs">
                      {getInitials(`${assignedUser.first_name} ${assignedUser.last_name}`)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      disabled={!effectivePublisherId || updatingPublisher}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAddConfirm(true);
                      }}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Details card uses list data (establishment) so we always have it — no skeleton */}
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
          </CardContent>
        </Card>
      </motion.div>

      {/* Remove as Personal Territory - bottom drawer, 50% height (same design as contact) */}
      <Drawer
        open={showRemoveConfirm}
        onOpenChange={(open) => {
          setShowRemoveConfirm(open);
          if (!open) setShowMinusButton(false);
        }}
      >
        <DrawerContent
          className="flex flex-col"
          style={{ maxHeight: "50vh", height: "50vh" }}
        >
          <div className="flex flex-1 flex-col justify-center px-4 min-h-0">
            <DrawerHeader className="pt-6 px-4 pb-2 text-center">
              <DrawerTitle className="text-center">Remove as Personal Territory?</DrawerTitle>
            </DrawerHeader>
            <DrawerFooter className="flex flex-col gap-3 p-0 pt-4 pb-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full h-12"
                onClick={() => {
                  setShowRemoveConfirm(false);
                  setShowMinusButton(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="w-full h-12"
                disabled={updatingPublisher}
                onClick={handleRemoveAsPersonalTerritory}
              >
                {updatingPublisher ? "Removing..." : "Remove"}
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Take as Personal Territory - bottom drawer, 50% height (same design as contact) */}
      <Drawer open={showAddConfirm} onOpenChange={setShowAddConfirm}>
        <DrawerContent
          className="flex flex-col"
          style={{ maxHeight: "50vh", height: "50vh" }}
        >
          <div className="flex flex-1 flex-col justify-center px-4 min-h-0">
            <DrawerHeader className="pt-6 px-4 pb-2 text-center">
              <DrawerTitle className="text-center">Take as Personal Territory?</DrawerTitle>
            </DrawerHeader>
            <DrawerFooter className="flex flex-col gap-3 p-0 pt-4 pb-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full h-12"
                onClick={() => setShowAddConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="lg"
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-white"
                disabled={updatingPublisher || !effectivePublisherId}
                onClick={handleAddAsPersonalTerritory}
              >
                {updatingPublisher ? "Adding..." : "Add"}
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

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

      {/* To-Do scoped to this establishment only */}
      <motion.div className="w-full" layout transition={{ duration: 0.2, ease: "easeOut" }}>
        <HomeTodoCard establishmentId={establishment.id} onTodoTap={handleTodoTapOpenCall} />
      </motion.div>

      {/* Contacts Section (householders styled like congregation Contacts card) */}
      <motion.div className="w-full" layout transition={{ duration: 0.2, ease: "easeOut" }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 flex-shrink-0" />
              <span>Contacts{householders.length ? ` (${householders.length})` : ""}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {householders.length > 0 ? (
              <div className="px-4 py-2 space-y-2">
                {householders
                  .filter((householder, index, self) =>
                    // Remove duplicates based on householder ID
                    index === self.findIndex((h) => h.id === householder.id)
                  )
                  .map((householder) => {
                    const initials = householder.name
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("");

                    return (
                      <button
                        key={householder.id}
                        type="button"
                        className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors flex items-center gap-3"
                        onClick={() => onHouseholderClick && onHouseholderClick(householder)}
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={undefined} alt={householder.name} />
                          <AvatarFallback className="text-[11px] font-semibold">
                            {initials || "HH"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium truncate">{householder.name}</p>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs px-2 py-0.5 h-5 leading-none",
                                getHouseholderStatusColorClass(householder.status)
                              )}
                            >
                              {formatStatusText(householder.status)}
                            </Badge>
                          </div>
                          {householder.note && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {householder.note}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground px-4">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No contacts yet</p>
                <p className="text-sm">Contacts will appear here when calls are added</p>
              </div>
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
        title="Edit Call"
        headerClassName="text-center"
      >
              {editVisit && (
                <VisitForm
                  establishments={[{ id: establishment.id, name: establishment.name }]}
                  selectedEstablishmentId={establishment.id}
                  initialVisit={editVisit}
                  disableEstablishmentSelect
                  onSaved={() => setEditVisit(null)}
                />
              )}
      </FormModal>

      <FormModal
        open={!!editTodo}
        onOpenChange={(open) => {
          if (!open) setEditTodo(null);
        }}
        title="Edit To-Do"
        headerClassName="text-center"
      >
        <TodoForm
          establishments={[{ id: establishment.id, name: establishment.name }]}
          selectedEstablishmentId={establishment.id}
          initialTodo={editTodo}
          onSaved={() => setEditTodo(null)}
          disableEstablishmentSelect
        />
      </FormModal>
    </div>
  );
}
