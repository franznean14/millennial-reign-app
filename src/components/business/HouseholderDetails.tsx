"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Calendar, MapPinned, Archive, FilePlus2, UserPlus, Minus } from "lucide-react";
import { FormModal } from "@/components/shared/FormModal";
import { toast } from "@/components/ui/sonner";
import { HouseholderForm } from "@/components/business/HouseholderForm";
import {
  HouseholderSummaryFields,
  HouseholderSummaryFieldsSkeleton,
} from "@/components/business/HouseholderSummaryFields";
import { CallForm } from "@/components/business/CallForm";
import { TodoForm } from "@/components/business/TodoForm";
import { CallSection } from "@/components/business/CallSection";
import { type HouseholderWithDetails, type VisitWithUser, type MyOpenCallTodoItem, upsertHouseholder, type HouseholderStatus } from "@/lib/db/business";
import { deleteHouseholder, archiveHouseholder } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";
import { cn } from "@/lib/utils";
import { formatStatusText } from "@/lib/utils/formatters";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerWideLeftContentTop,
} from "@/components/ui/drawer";
import { getInitials } from "@/lib/utils/visit-history-ui";
import { getProfile } from "@/lib/db/profiles";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cacheDelete } from "@/lib/offline/store";
import { HomeTodoCard } from "@/components/home/HomeTodoCard";
import { getStudyBibleDarkCardShade, studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";
import { useMediaQuery } from "@/hooks/use-media-query";
import {
  getBestStatus,
  getPersonalTerritoryDetailsCardClass,
  getStatusTextColor,
} from "@/lib/utils/status-hierarchy";

interface HouseholderDetailsProps {
  householder: HouseholderWithDetails;
  visits: VisitWithUser[];
  establishment?: {
    id: string;
    name: string;
    area?: string | null;
    statuses?: string[] | null;
    status?: string | null;
  } | null;
  establishments: Array<{
    id: string;
    name: string;
    area?: string | null;
    statuses?: string[] | null;
    status?: string | null;
  }>;
  onBackClick: () => void;
  context?: "bwi" | "congregation";
  showEstablishment?: boolean;
  publisherId?: string | null;
  isLoading?: boolean;
  /** When set, summary edit opens the parent left sheet instead of FormModal. */
  onRequestSummaryEdit?: () => void;
  /** Tablet+: visit list / edit to-do use left sheets when nested in a right details drawer. */
  preferLeftDetailPanel?: boolean;
  /** When this householder pane is stacked above the establishment sheet (contact drill-in). */
  insideStackedContactPane?: boolean;
}

type TodoEditorItem = MyOpenCallTodoItem & {
  call_note?: string | null;
  call_visit_date?: string | null;
  call_publishers?: string[];
};

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
    case 'moved_branch':
    case 'resigned':
      return 'text-stone-600 border-stone-200 bg-stone-50 dark:text-stone-400 dark:border-stone-700 dark:bg-stone-950';
    default:
      return 'text-gray-600 border-gray-200 bg-gray-50 dark:text-gray-400 dark:border-gray-800 dark:bg-gray-950';
  }
};

// Helper function for householder card background color
const getHouseholderCardColor = (status: string) => {
  switch (status) {
    case 'potential':
      return 'border-cyan-500/50 bg-cyan-500/5';
    case 'do_not_call':
      return 'border-red-500/50 bg-red-500/5';
    case 'interested':
      return 'border-blue-500/50 bg-blue-500/5';
    case 'return_visit':
      return 'border-orange-500/50 bg-orange-500/5';
    case 'bible_study':
      return 'border-emerald-500/50 bg-emerald-500/5';
    case 'moved_branch':
    case 'resigned':
      return 'border-stone-600/40 bg-stone-800/10';
    default:
      return 'border-gray-500/50 bg-gray-500/5';
  }
};

export function HouseholderDetails({
  householder,
  visits,
  establishment,
  establishments,
  onBackClick,
  context = "bwi",
  showEstablishment = true,
  publisherId,
  isLoading = false,
  onRequestSummaryEdit,
  preferLeftDetailPanel = false,
  insideStackedContactPane = false,
}: HouseholderDetailsProps) {
  
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
  const [editTodo, setEditTodo] = useState<TodoEditorItem | null>(null);
  const [newVisitOpen, setNewVisitOpen] = useState(false);
  const isMdUp = useMediaQuery("(min-width: 768px)");
  const useLeftDetailPanels = Boolean(preferLeftDetailPanel && isMdUp);
  const bwiHhEditFormShade = useMemo(
    () => getStudyBibleDarkCardShade(`bwi-hh-detail-edit:${householder.id}`),
    [householder.id]
  );
  const bwiHhEditTodoShade = useMemo(
    () => getStudyBibleDarkCardShade(`bwi-hh-detail-edit-todo:${householder.id}`),
    [householder.id]
  );
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [showAddConfirm, setShowAddConfirm] = useState(false);
  const [showMinusButton, setShowMinusButton] = useState(false);
  const [updatingPublisher, setUpdatingPublisher] = useState(false);
  const avatarButtonRef = useRef<HTMLDivElement>(null);
  const minusActiveOnPointerDownRef = useRef(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(publisherId || null);

  // Get current user ID if not provided
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

  // Use publisherId prop if provided, otherwise use currentUserId from state
  const effectivePublisherId = publisherId || currentUserId;

  const openSummaryEditor = useCallback(() => {
    if (onRequestSummaryEdit) onRequestSummaryEdit();
    else setIsEditing(true);
  }, [onRequestSummaryEdit]);

  // Listen for edit trigger from header
  useEffect(() => {
    const handleEditTrigger = () => {
      openSummaryEditor();
    };
    window.addEventListener('trigger-edit-details', handleEditTrigger);
    return () => {
      window.removeEventListener('trigger-edit-details', handleEditTrigger);
    };
  }, [openSummaryEditor]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const onEditSaved = (updated: any) => {
    setIsEditing(false);
    if (updated) {
      businessEventBus.emit('householder-updated', updated);
    }
  };

  const handleDelete = async () => {
    if (!householder?.id) return;
    setDeleting(true);
    try {
      const ok = await deleteHouseholder(householder.id);
      if (ok) {
        toast.success("Householder deleted successfully");
        businessEventBus.emit('householder-deleted', { id: householder.id });
        onBackClick();
      } else {
        toast.error("Failed to delete householder");
      }
    } catch (e) {
      toast.error("Error deleting householder");
    } finally {
      setDeleting(false);
    }
  };

  const handleArchive = async () => {
    if (!householder?.id) return;
    setArchiving(true);
    try {
      const ok = await archiveHouseholder(householder.id);
      if (ok) {
        toast.success("Householder archived successfully");
        businessEventBus.emit('householder-archived', { id: householder.id });
        onBackClick();
      } else {
        toast.error("Failed to archive householder");
      }
    } catch (e) {
      toast.error("Error archiving householder");
    } finally {
      setArchiving(false);
    }
  };

  const handleAddAsPersonalContact = async () => {
    if (!householder?.id || !effectivePublisherId) return;
    setUpdatingPublisher(true);
    try {
      const updated = await upsertHouseholder({
        ...householder,
        id: householder.id,
        publisher_id: effectivePublisherId
      });
      if (updated && updated.id) {
        // Fetch the publisher profile to include in the update
        const profile = await getProfile(effectivePublisherId);
        const updatedWithUser: HouseholderWithDetails = {
          id: updated.id,
          name: updated.name,
          status: updated.status,
          note: updated.note ?? null,
          establishment_id: updated.establishment_id ?? null,
          establishment_name: householder.establishment_name ?? null,
          publisher_id: updated.publisher_id ?? null,
          lat: updated.lat ?? null,
          lng: updated.lng ?? null,
          assigned_user: profile ? {
            id: profile.id,
            first_name: profile.first_name,
            last_name: profile.last_name,
            avatar_url: profile.avatar_url || undefined
          } : null
        };
        // Clear cache to force fresh fetch on next load
        if (updated.id) {
          await cacheDelete(`householder:details:v3:${updated.id}`);
        }
        toast.success("Added as personal contact");
        businessEventBus.emit('householder-updated', updatedWithUser);
        setShowAddConfirm(false);
      } else {
        toast.error("Failed to add as personal contact");
      }
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Error adding as personal contact");
    } finally {
      setUpdatingPublisher(false);
    }
  };

  const handleRemoveAsPersonalContact = async () => {
    if (!householder?.id) return;
    setUpdatingPublisher(true);
    try {
      const updated = await upsertHouseholder({
        ...householder,
        id: householder.id,
        publisher_id: null
      });
      if (updated && updated.id) {
        const updatedWithUser: HouseholderWithDetails = {
          id: updated.id,
          name: updated.name,
          status: updated.status,
          note: updated.note ?? null,
          establishment_id: updated.establishment_id ?? null,
          establishment_name: householder.establishment_name ?? null,
          publisher_id: null,
          lat: updated.lat ?? null,
          lng: updated.lng ?? null,
          assigned_user: null
        };
        // Clear cache to force fresh fetch on next load
        if (updated.id) {
          await cacheDelete(`householder:details:v3:${updated.id}`);
        }
        toast.success("Removed as personal contact");
        businessEventBus.emit('householder-updated', updatedWithUser);
        setShowRemoveConfirm(false);
        setShowMinusButton(false);
      } else {
        toast.error("Failed to remove as personal contact");
      }
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Error removing as personal contact");
    } finally {
      setUpdatingPublisher(false);
    }
  };

  const isCurrentUserPublisher = effectivePublisherId && householder.publisher_id === effectivePublisherId;
  const assignedUser = householder.assigned_user;
  const detailsCardSurfaceClass = householder.publisher_id
    ? getPersonalTerritoryDetailsCardClass(!!isCurrentUserPublisher)
    : getHouseholderCardColor(householder.status);

  const hasCoordinates = householder.lat != null && householder.lng != null;
  /** BWI: directions only after "Take as personal contact"; congregation unchanged. */
  const showDirections =
    context !== "bwi" || !!isCurrentUserPublisher;

  const linkedEstablishment = useMemo(
    () => establishments.find((e) => e.id === householder.establishment_id),
    [establishments, householder.establishment_id]
  );
  const areaFromEstablishment =
    establishment?.area?.trim() || linkedEstablishment?.area?.trim();
  const householderNote = householder.note?.trim() ?? "";
  const establishmentDisplayName =
    (establishment?.name?.trim() || householder.establishment_name?.trim() || "") || "";
  const visitLinkedEstablishmentStatus =
    visits.find((visit) => visit.establishment_id === householder.establishment_id)?.establishment?.status ?? null;
  const resolvedEstablishmentStatuses =
    establishment?.statuses?.length
      ? establishment.statuses
      : linkedEstablishment?.statuses?.length
        ? linkedEstablishment.statuses
        : establishment?.status
          ? [establishment.status]
          : linkedEstablishment?.status
            ? [linkedEstablishment.status]
            : visitLinkedEstablishmentStatus
              ? [visitLinkedEstablishmentStatus]
              : [];
  const establishmentBadgeStatus = getBestStatus(
    resolvedEstablishmentStatuses
  );

  // Handle click outside to restore avatar when minus button is shown (don't close when remove-confirm popover is open)
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

  const detailTransition = { duration: 0.2, ease: "easeOut" } as const;

  const handleTodoTapOpenCall = (todo: MyOpenCallTodoItem) => {
    if (!todo.call_id) {
      setEditTodo(todo);
      return;
    }
    const matchedVisit = visits.find((v) => v.id === todo.call_id);
    const callPublishers = [matchedVisit?.publisher, matchedVisit?.partner]
      .filter((person): person is NonNullable<typeof person> => !!person)
      .map((person) => `${person.first_name} ${person.last_name}`.trim())
      .filter(Boolean);
    if (matchedVisit?.publisher_guest_name?.trim()) callPublishers.push(matchedVisit.publisher_guest_name.trim());
    if (matchedVisit?.partner_guest_name?.trim()) callPublishers.push(matchedVisit.partner_guest_name.trim());

    setEditTodo({
      ...todo,
      call_note: matchedVisit?.note ?? null,
      call_visit_date: matchedVisit?.visit_date ?? todo.visit_date ?? null,
      call_publishers: Array.from(new Set(callPublishers)),
    });
  };

  return (
    <div className="space-y-6 w-full max-w-full -mt-2 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]">
      <motion.div className="w-full" layout transition={detailTransition}>
        <Card
          role="button"
          tabIndex={0}
          onPointerDownCapture={() => {
            // Guard against tap timing: if tap starts while minus is visible,
            // do not open edit drawer on the ensuing click.
            minusActiveOnPointerDownRef.current = showMinusButton;
          }}
          onClick={() => {
            const wasMinusVisibleAtTapStart = minusActiveOnPointerDownRef.current;
            minusActiveOnPointerDownRef.current = false;
            if (wasMinusVisibleAtTapStart) return;
            if (!showMinusButton) openSummaryEditor();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!showMinusButton) openSummaryEditor();
            }
          }}
          className={cn("w-full cursor-pointer transition-colors hover:bg-muted/30", detailsCardSurfaceClass)}
        >
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div className="flex w-full min-w-0 flex-1 flex-wrap items-center gap-2 pr-1">
              {isLoading ? (
                <div className="h-6 w-28 rounded-full bg-muted/60 blur-[1px] animate-pulse" />
              ) : (
                <>
                  {householder.status?.trim() ? (
                    <Badge
                      variant="outline"
                      className={cn("flex-shrink-0 capitalize", getHouseholderStatusColorClass(householder.status))}
                    >
                      {formatStatusText(householder.status)}
                    </Badge>
                  ) : null}
                  {showEstablishment && establishmentDisplayName ? (
                    <Badge
                      variant="outline"
                      className={cn("flex-shrink-0", getStatusTextColor(establishmentBadgeStatus))}
                    >
                      {establishmentDisplayName}
                    </Badge>
                  ) : null}
                </>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              {isLoading ? (
                <>
                  {showDirections ? (
                    <div className="h-8 w-8 rounded-full bg-muted/60 blur-[2px] animate-pulse" />
                  ) : null}
                  <div className="h-8 w-8 rounded-full bg-muted/60 blur-[2px] animate-pulse" />
                </>
              ) : (
                <>
                  {showDirections ? (
                    hasCoordinates ? (
                      <a
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-primary/60 bg-primary/10 text-primary shadow-sm transition-all hover:bg-primary/20 hover:border-primary hover:scale-[1.03] active:scale-100"
                        href={`https://www.google.com/maps/dir/?api=1&destination=${householder.lat},${householder.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open directions"
                        title="Open directions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MapPinned className="h-4 w-4" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-muted-foreground/45 text-muted-foreground/85 hover:bg-muted/30"
                        aria-label="Set location"
                        onClick={(e) => {
                          e.stopPropagation();
                          openSummaryEditor();
                        }}
                      >
                        <MapPinned className="h-4 w-4" />
                      </button>
                    )
                  ) : null}
                  {assignedUser && isCurrentUserPublisher ? (
                    <div
                      ref={avatarButtonRef}
                      className="flex h-8 w-8 flex-shrink-0 cursor-pointer items-center justify-center"
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
                            className="flex h-8 w-8 items-center justify-center"
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
                            className="flex h-8 w-8 items-center justify-center"
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
                                <AvatarImage
                                  src={assignedUser.avatar_url || undefined}
                                  alt={`${assignedUser.first_name} ${assignedUser.last_name}`}
                                />
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
                      <AvatarImage
                        src={assignedUser.avatar_url || undefined}
                        alt={`${assignedUser.first_name} ${assignedUser.last_name}`}
                      />
                      <AvatarFallback className="text-xs">
                        {getInitials(`${assignedUser.first_name} ${assignedUser.last_name}`)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full border border-dashed border-muted-foreground/45 text-muted-foreground/85 hover:bg-muted/30"
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
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <HouseholderSummaryFieldsSkeleton showArea={showEstablishment} />
            ) : (
              <HouseholderSummaryFields
                area={areaFromEstablishment}
                note={householderNote}
                showArea={showEstablishment}
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Remove as Personal Contact - bottom drawer, 50% height */}
      <Drawer
        open={showRemoveConfirm}
        onOpenChange={(open) => {
          setShowRemoveConfirm(open);
          if (!open) setShowMinusButton(false);
        }}
      >
        <DrawerContent
          className={cn("flex flex-col", studyBibleDarkClasses.popoverPanel)}
          handleClassName="dark:bg-[#80778e] dark:shadow-[0_0_18px_rgba(128,119,142,0.45)]"
          style={{ maxHeight: "50vh", height: "50vh" }}
        >
          <div className="flex flex-1 flex-col justify-center px-4 min-h-0">
            <DrawerHeader className="bg-transparent pt-6 px-4 pb-2 text-center">
              <DrawerTitle className="text-center">Remove as Personal Contact?</DrawerTitle>
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
                onClick={handleRemoveAsPersonalContact}
              >
                {updatingPublisher ? "Removing..." : "Remove"}
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Take as Personal Contact - bottom drawer, 50% height */}
      <Drawer open={showAddConfirm} onOpenChange={setShowAddConfirm}>
        <DrawerContent
          className={cn("flex flex-col", studyBibleDarkClasses.popoverPanel)}
          handleClassName="dark:bg-[#80778e] dark:shadow-[0_0_18px_rgba(128,119,142,0.45)]"
          style={{ maxHeight: "50vh", height: "50vh" }}
        >
          <div className="flex flex-1 flex-col justify-center px-4 min-h-0">
            <DrawerHeader className="bg-transparent pt-6 px-4 pb-2 text-center">
              <DrawerTitle className="text-center">Take as Personal Contact?</DrawerTitle>
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
                onClick={handleAddAsPersonalContact}
              >
                {updatingPublisher ? "Adding..." : "Add"}
              </Button>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>

      {/* To-Do scoped to this householder only */}
      <motion.div className="w-full" layout transition={detailTransition}>
        <HomeTodoCard householderId={householder.id} onTodoTap={handleTodoTapOpenCall} />
      </motion.div>

      <motion.div className="w-full" layout transition={detailTransition}>
        <CallSection 
          visits={visits} 
          isHouseholderContext={true}
          establishments={establishments}
          selectedEstablishmentId={establishment?.id}
          householderId={householder.id}
          householderName={householder.name}
          householderStatus={householder.status}
          isLoading={isLoading}
          preferLeftDetailPanel={preferLeftDetailPanel}
          insideStackedContactPane={insideStackedContactPane}
          onVisitUpdated={() => {
            // Visit updates will be handled by the parent component's data refresh
          }}
        />
      </motion.div>

      <FormModal
        open={newVisitOpen}
        onOpenChange={setNewVisitOpen}
        title="New Call"
        headerClassName="text-center"
      >
        <CallForm
                establishments={establishments}
          selectedEstablishmentId={context === "congregation" ? "none" : (establishment?.id || "none")}
          disableEstablishmentSelect={context === "congregation"}
          householderId={householder.id}
          householderName={householder.name}
          householderStatus={householder.status}
          onSaved={() => {
            setNewVisitOpen(false);
          }}
              />
      </FormModal>

      {onRequestSummaryEdit ? null : useLeftDetailPanels ? (
        <Drawer
          open={isEditing}
          onOpenChange={setIsEditing}
          direction="left"
          modal
          nested
          shouldScaleBackground={false}
        >
          <DrawerWideLeftContentTop
            stackAboveStackedRightSheet
            className={cn("border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff]", bwiHhEditFormShade)}
          >
            <DrawerHeader className="bg-transparent px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center sm:text-center">
              <DrawerTitle className="text-center text-lg font-bold">Edit Householder</DrawerTitle>
              <DrawerDescription className="sr-only">Update householder details</DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2">
              <HouseholderForm
                establishments={establishments}
                selectedEstablishmentId={householder.establishment_id ?? undefined}
                isEditing
                context={context}
                publisherId={publisherId ?? householder.publisher_id ?? undefined}
                initialData={{
                  id: householder.id,
                  establishment_id: householder.establishment_id || "",
                  name: householder.name,
                  status: householder.status as HouseholderStatus,
                  note: householder.note || null,
                  lat: householder.lat ?? null,
                  lng: householder.lng ?? null,
                  publisher_id: householder.publisher_id ?? null,
                }}
                onSaved={onEditSaved}
                onDelete={handleDelete}
                onArchive={handleArchive}
              />
            </div>
          </DrawerWideLeftContentTop>
        </Drawer>
      ) : (
        <FormModal
          open={isEditing}
          onOpenChange={setIsEditing}
          title="Edit Householder"
          description="Update householder details"
          headerClassName="text-center"
        >
          <HouseholderForm
            establishments={establishments}
            selectedEstablishmentId={householder.establishment_id ?? undefined}
            isEditing
            context={context}
            publisherId={publisherId ?? householder.publisher_id ?? undefined}
            initialData={{
              id: householder.id,
              establishment_id: householder.establishment_id || "",
              name: householder.name,
              status: householder.status as HouseholderStatus,
              note: householder.note || null,
              lat: householder.lat ?? null,
              lng: householder.lng ?? null,
              publisher_id: householder.publisher_id ?? null,
            }}
            onSaved={onEditSaved}
            onDelete={handleDelete}
            onArchive={handleArchive}
          />
        </FormModal>
      )}

      {editTodo ? (
        useLeftDetailPanels ? (
          <Drawer
            open={!!editTodo}
            onOpenChange={(open) => {
              if (!open) setEditTodo(null);
            }}
            direction="left"
            modal
            nested
            shouldScaleBackground={false}
          >
            <DrawerWideLeftContentTop
              stackAboveStackedRightSheet
              className={cn("border-border dark:border-[#1c1921] text-foreground dark:text-[#fffaff]", bwiHhEditTodoShade)}
            >
              <DrawerHeader className="bg-transparent px-4 pb-3 pt-[calc(max(env(safe-area-inset-top),var(--device-safe-top,0px))+1rem)] text-center">
                <DrawerTitle className="text-center text-lg font-bold">Edit To-Do</DrawerTitle>
              </DrawerHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)] pt-2">
                <TodoForm
                  establishments={establishments}
                  selectedEstablishmentId={context === "congregation" ? "none" : (establishment?.id || "none")}
                  initialTodo={editTodo}
                  disableEstablishmentSelect
                  householderId={householder.id}
                  householderName={householder.name}
                  onSaved={() => setEditTodo(null)}
                />
              </div>
            </DrawerWideLeftContentTop>
          </Drawer>
        ) : (
          <FormModal
            open={!!editTodo}
            onOpenChange={(open) => {
              if (!open) setEditTodo(null);
            }}
            title="Edit To-Do"
            headerClassName="text-center"
          >
            <TodoForm
              establishments={establishments}
              selectedEstablishmentId={context === "congregation" ? "none" : (establishment?.id || "none")}
              initialTodo={editTodo}
              disableEstablishmentSelect
              householderId={householder.id}
              householderName={householder.name}
              onSaved={() => setEditTodo(null)}
            />
          </FormModal>
        )
      ) : null}
    </div>
  );
}

