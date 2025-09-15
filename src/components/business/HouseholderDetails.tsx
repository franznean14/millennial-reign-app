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
import { type HouseholderWithDetails, type VisitWithUser } from "@/lib/db/business";
import { deleteHouseholder, archiveHouseholder } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";

interface HouseholderDetailsProps {
  householder: HouseholderWithDetails;
  visits: VisitWithUser[];
  establishment?: { id: string; name: string } | null;
  establishments: Array<{ id: string; name: string; area?: string | null }>;
  onBackClick: () => void;
}

export function HouseholderDetails({ householder, visits, establishment, establishments, onBackClick }: HouseholderDetailsProps) {
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
          <motion.div layout className="min-w-0 flex-1 relative z-0 max-w-[calc(100%-112px)]">
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
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleArchive}
            disabled={archiving}
            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:text-orange-300 dark:hover:bg-orange-950"
          >
            <Archive className="h-4 w-4 mr-2" />
            {archiving ? 'Archiving...' : 'Archive'}
          </Button>
        </div>
      </motion.div>

      <motion.div layout className="w-full">
        <Card>
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
                <Badge variant="outline" className="text-xs capitalize">{String(householder.status).replaceAll('_',' ')}</Badge>
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
                {visits.map((visit) => (
                  <button
                    key={visit.id}
                    onClick={() => setEditVisit({ id: visit.id, note: visit.note || null, visit_date: visit.visit_date, establishment_id: establishment?.id, householder_id: householder.id, publisher_id: (visit as any).publisher_id ?? visit.publisher?.id ?? null, partner_id: (visit as any).partner_id ?? visit.partner?.id ?? null })}
                    className="flex items-start justify-between gap-3 p-3 border rounded-lg w-full text-left hover:bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{formatDate(visit.visit_date)}</span>
                      </div>
                      {visit.note && (
                        <p className="text-sm text-muted-foreground">{visit.note}</p>
                      )}
                    </div>
                    <div className="flex items-center flex-shrink-0">
                      {visit.publisher ? (
                        <Avatar className="h-8 w-8 ring-2 ring-background">
                          <AvatarImage src={visit.publisher.avatar_url} alt={`${visit.publisher.first_name} ${visit.publisher.last_name}`} />
                          <AvatarFallback className="text-xs">
                            {(visit.publisher.first_name && visit.publisher.last_name ? `${visit.publisher.first_name} ${visit.publisher.last_name}` : 'U').charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="text-xs text-muted-foreground">No publisher</div>
                      )}
                      {visit.partner ? (
                        <Avatar className="h-8 w-8 -ml-2 ring-2 ring-background">
                          <AvatarImage src={visit.partner.avatar_url} alt={`${visit.partner.first_name} ${visit.partner.last_name}`} />
                          <AvatarFallback className="text-xs">
                            {(visit.partner.first_name && visit.partner.last_name ? `${visit.partner.first_name} ${visit.partner.last_name}` : 'U').charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No visits recorded yet</p>
            )}
          </CardContent>
        </Card>
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
                initialData={{ id: householder.id, establishment_id: householder.establishment_id || establishments[0]?.id, name: householder.name, status: householder.status as any, note: householder.note || null }}
                onSaved={onEditSaved}
                onDelete={handleDelete}
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
                initialData={{ id: householder.id, establishment_id: householder.establishment_id || establishments[0]?.id, name: householder.name, status: householder.status as any, note: householder.note || null }}
                onSaved={onEditSaved}
                onDelete={handleDelete}
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

