"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, Calendar, User2, Edit, Archive } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "@/components/ui/sonner";
import { HouseholderForm } from "@/components/business/HouseholderForm";
import { VisitForm } from "@/components/business/VisitForm";
import { useMobile } from "@/lib/hooks/use-mobile";
import { VisitUpdatesSection } from "@/components/business/VisitUpdatesSection";
import { type HouseholderWithDetails, type VisitWithUser } from "@/lib/db/business";
import { deleteHouseholder, archiveHouseholder } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";
import { cn } from "@/lib/utils";

interface HouseholderDetailsProps {
  householder: HouseholderWithDetails;
  visits: VisitWithUser[];
  establishment?: { id: string; name: string } | null;
  establishments: Array<{ id: string; name: string; area?: string | null }>;
  onBackClick: () => void;
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

export function HouseholderDetails({ householder, visits, establishment, establishments, onBackClick }: HouseholderDetailsProps) {
  
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
  const isMobile = useMobile();
  const [isEditing, setIsEditing] = useState(false);
  const [editVisit, setEditVisit] = useState<{ id: string; establishment_id?: string | null; householder_id?: string | null; note?: string | null; publisher_id?: string | null; partner_id?: string | null; visit_date?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const titleContainerRef = useRef<HTMLDivElement>(null);
  const titleContentRef = useRef<HTMLDivElement>(null);
  const [scrollDistance, setScrollDistance] = useState(0);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    const measure = () => {
      const container = titleContainerRef.current;
      const content = titleContentRef.current;
      if (!container || !content) return;
      const fadeWidthPx = 48;
      const overshootPx = 8;
      const overflow = content.scrollWidth - container.clientWidth;
      const willScroll = overflow > 4;
      setShouldScroll(willScroll);
      setScrollDistance(willScroll ? overflow + fadeWidthPx + overshootPx : 0);
    };
    measure();
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [householder.name]);

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

  return (
    <div className="space-y-6 w-full max-w-full">
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
          <Button variant="ghost" size="sm" onClick={onBackClick} className="p-2 flex-shrink-0">
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
                {householder.name}
              </motion.div>
              <div className="pointer-events-none absolute right-0 top-0 h-full w-12 bg-gradient-to-l from-background to-transparent" />
            </div>
            <motion.p layout className="text-muted-foreground truncate">
              {establishment?.name || 'No establishment specified'}
            </motion.p>
          </motion.div>
        </div>
        <div className="flex gap-2 flex-shrink-0 relative z-10 ml-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </motion.div>

      <motion.div layout className="w-full">
        <Card className={cn("w-full", getHouseholderCardColor(householder.status))}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User2 className="h-5 w-5 flex-shrink-0" />
              Householder Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant="outline" className={cn("text-xs capitalize", getHouseholderStatusColorClass(householder.status))}>{String(householder.status).replaceAll('_',' ')}</Badge>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Establishment</p>
                <p className="truncate">{establishment?.name || 'Not specified'}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Note</p>
              <p className="text-sm break-words">{householder.note || 'No notes added'}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div layout className="w-full">
        <VisitUpdatesSection visits={visits} isHouseholderContext={true} />
      </motion.div>

      {/* Edit Householder */}
      {isMobile ? (
        <Drawer open={isEditing} onOpenChange={setIsEditing}>
          <DrawerContent>
            <DrawerHeader className="text-center">
              <DrawerTitle>Edit Householder</DrawerTitle>
              <DrawerDescription>Update householder details</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              <HouseholderForm
                establishments={establishments}
                selectedEstablishmentId={householder.establishment_id}
                isEditing
                initialData={{ id: householder.id, establishment_id: householder.establishment_id || "", name: householder.name, status: householder.status as any, note: householder.note || null }}
                onSaved={onEditSaved}
                onDelete={handleDelete}
                onArchive={handleArchive}
              />
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={isEditing} onOpenChange={setIsEditing}>
          <DialogContent>
            <DialogHeader className="text-center">
              <DialogTitle>Edit Householder</DialogTitle>
              <DialogDescription>Update householder details</DialogDescription>
            </DialogHeader>
            <div className="px-4">
              <HouseholderForm
                establishments={establishments}
                selectedEstablishmentId={householder.establishment_id}
                isEditing
                initialData={{ id: householder.id, establishment_id: householder.establishment_id || "", name: householder.name, status: householder.status as any, note: householder.note || null }}
                onSaved={onEditSaved}
                onDelete={handleDelete}
                onArchive={handleArchive}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Visit */}
      {isMobile ? (
        <Drawer open={!!editVisit} onOpenChange={(o) => { if (!o) { setEditVisit(null); }}}>
          <DrawerContent>
            <DrawerHeader className="text-center">
              <DrawerTitle>Edit Visit</DrawerTitle>
              <DrawerDescription>Update visit details</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              <VisitForm
                establishments={establishments}
                selectedEstablishmentId={establishment?.id}
                initialVisit={editVisit || undefined}
                householderId={householder.id}
                onSaved={() => { setEditVisit(null); }}
              />
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={!!editVisit} onOpenChange={(o) => { if (!o) { setEditVisit(null); }}}>
          <DialogContent>
            <DialogHeader className="text-center">
              <DialogTitle>Edit Visit</DialogTitle>
              <DialogDescription>Update visit details</DialogDescription>
            </DialogHeader>
            <div className="px-4">
              <VisitForm
                establishments={establishments}
                selectedEstablishmentId={establishment?.id}
                initialVisit={editVisit || undefined}
                householderId={householder.id}
                onSaved={() => { setEditVisit(null); }}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

