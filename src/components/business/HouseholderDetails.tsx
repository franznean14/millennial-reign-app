"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, User2, Archive, FilePlus2, UserPlus, Minus } from "lucide-react";
import { FormModal } from "@/components/shared/FormModal";
import { toast } from "@/components/ui/sonner";
import { HouseholderForm } from "@/components/business/HouseholderForm";
import { VisitForm } from "@/components/business/VisitForm";
import { VisitUpdatesSection } from "@/components/business/VisitUpdatesSection";
import { type HouseholderWithDetails, type VisitWithUser, upsertHouseholder } from "@/lib/db/business";
import { deleteHouseholder, archiveHouseholder } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";
import { cn } from "@/lib/utils";
import { formatStatusText } from "@/lib/utils/formatters";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { getInitials } from "@/lib/utils/visit-history-ui";
import { getProfile } from "@/lib/db/profiles";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cacheDelete } from "@/lib/offline/store";

interface HouseholderDetailsProps {
  householder: HouseholderWithDetails;
  visits: VisitWithUser[];
  establishment?: { id: string; name: string } | null;
  establishments: Array<{ id: string; name: string; area?: string | null }>;
  onBackClick: () => void;
  context?: "bwi" | "congregation";
  showEstablishment?: boolean;
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
  isLoading = false
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
  const [editVisit, setEditVisit] = useState<{ id: string; establishment_id?: string | null; householder_id?: string | null; note?: string | null; publisher_id?: string | null; partner_id?: string | null; visit_date?: string } | null>(null);
  const [newVisitOpen, setNewVisitOpen] = useState(false);
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
          await cacheDelete(`householder:details:${updated.id}`);
        }
        toast.success("Added as personal contact");
        businessEventBus.emit('householder-updated', updatedWithUser);
        setShowAddConfirm(false);
      } else {
        toast.error("Failed to add as personal contact");
      }
    } catch (e) {
      toast.error("Error adding as personal contact");
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
          await cacheDelete(`householder:details:${updated.id}`);
        }
        toast.success("Removed as personal contact");
        businessEventBus.emit('householder-updated', updatedWithUser);
        setShowRemoveConfirm(false);
        setShowMinusButton(false);
      } else {
        toast.error("Failed to remove as personal contact");
      }
    } catch (e) {
      toast.error("Error removing as personal contact");
    } finally {
      setUpdatingPublisher(false);
    }
  };

  const isCurrentUserPublisher = effectivePublisherId && householder.publisher_id === effectivePublisherId;
  const assignedUser = householder.assigned_user;

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
  const itemVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.05, ...detailTransition },
    }),
  };

  return (
    <div className="space-y-6 w-full max-w-full -mt-2">
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
            if (!showMinusButton) setIsEditing(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!showMinusButton) setIsEditing(true);
            }
          }}
          className={cn("w-full cursor-pointer transition-colors hover:bg-muted/30", getHouseholderCardColor(householder.status))}
        >
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <User2 className="h-5 w-5 flex-shrink-0" />
                Details
              </div>
              {/* User+ button or Avatar on the same row */}
              <div className="flex-shrink-0">
                {isLoading ? (
                  // Skeleton loading for user+ button/avatar
                  <div className="h-8 w-8 rounded-full bg-muted/60 blur-[2px] animate-pulse" />
                ) : assignedUser && isCurrentUserPublisher ? (
                // Show avatar that animates to minus button on tap; tap outside animates back; minus opens remove confirmation
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
                // Show avatar if someone else is the publisher (not clickable)
                <Avatar className="h-8 w-8">
                  <AvatarImage src={assignedUser.avatar_url || undefined} alt={`${assignedUser.first_name} ${assignedUser.last_name}`} />
                  <AvatarFallback className="text-xs">
                    {getInitials(`${assignedUser.first_name} ${assignedUser.last_name}`)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                // Show user+ button if no publisher
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
            {isLoading ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="h-3 bg-muted/60 rounded w-16 mb-2 animate-pulse" />
                    <div className="h-6 bg-muted/60 rounded w-20 animate-pulse" />
                  </div>
                  {showEstablishment && (
                    <div>
                      <div className="h-3 bg-muted/60 rounded w-24 mb-2 animate-pulse" />
                      <div className="h-4 bg-muted/60 rounded w-32 animate-pulse" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="h-3 bg-muted/60 rounded w-16 mb-2 animate-pulse" />
                  <div className="h-4 bg-muted/60 rounded w-full max-w-[300px] animate-pulse" />
                  <div className="h-4 bg-muted/60 rounded w-full max-w-[200px] mt-2 animate-pulse" />
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {householder.status?.trim() && (
                    <motion.div
                      custom={0}
                      initial="hidden"
                      animate="visible"
                      variants={itemVariants}
                    >
                      <p className="text-sm font-medium text-muted-foreground">Status</p>
                      <Badge variant="outline" className={cn("text-xs capitalize", getHouseholderStatusColorClass(householder.status))}>
                        {formatStatusText(householder.status)}
                      </Badge>
                    </motion.div>
                  )}
                  {showEstablishment && establishment?.name?.trim() && (
                    <motion.div
                      custom={1}
                      initial="hidden"
                      animate="visible"
                      variants={itemVariants}
                    >
                      <p className="text-sm font-medium text-muted-foreground">Establishment</p>
                      <p className="truncate">{establishment.name.trim()}</p>
                    </motion.div>
                  )}
                </div>
                {householder.note?.trim() && (
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={itemVariants}
                    custom={2}
                  >
                    <p className="text-sm font-medium text-muted-foreground">Note</p>
                    <p className="text-sm break-words">{householder.note.trim()}</p>
                  </motion.div>
                )}
              </>
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
          className="flex flex-col"
          style={{ maxHeight: "50vh", height: "50vh" }}
        >
          <div className="flex flex-1 flex-col justify-center px-4 min-h-0">
            <DrawerHeader className="pt-6 px-4 pb-2 text-center">
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
          className="flex flex-col"
          style={{ maxHeight: "50vh", height: "50vh" }}
        >
          <div className="flex flex-1 flex-col justify-center px-4 min-h-0">
            <DrawerHeader className="pt-6 px-4 pb-2 text-center">
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

      <motion.div className="w-full" layout transition={detailTransition}>
        <VisitUpdatesSection 
          visits={visits} 
          isHouseholderContext={true}
          establishments={establishments}
          selectedEstablishmentId={establishment?.id}
          householderId={householder.id}
          householderName={householder.name}
          householderStatus={householder.status}
          isLoading={isLoading}
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
        <VisitForm
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
            status: householder.status as any,
            note: householder.note || null,
            lat: householder.lat ?? null,
            lng: householder.lng ?? null,
            publisher_id: householder.publisher_id ?? null
          }}
                onSaved={onEditSaved}
                onDelete={handleDelete}
                onArchive={handleArchive}
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
              <VisitForm
                establishments={establishments}
                selectedEstablishmentId={establishment?.id}
                initialVisit={editVisit || undefined}
                householderId={householder.id}
                householderName={householder.name}
                householderStatus={householder.status}
          onSaved={() => {
            setEditVisit(null);
          }}
        />
      </FormModal>
    </div>
  );
}

