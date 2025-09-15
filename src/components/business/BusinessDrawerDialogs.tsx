"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Plus, X, UserPlus, FilePlus2 } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Portal as RadixPortal } from "@radix-ui/react-portal";
import { EstablishmentForm } from "@/components/business/EstablishmentForm";
import { HouseholderForm } from "@/components/business/HouseholderForm";
import { VisitForm } from "@/components/business/VisitForm";
import type { EstablishmentWithDetails } from "@/lib/db/business";

interface BusinessDrawerDialogsProps {
  establishments: EstablishmentWithDetails[];
  selectedEstablishmentId?: string;
  selectedArea?: string;
  businessTab?: 'establishments' | 'householders';
  selectedEstablishment?: EstablishmentWithDetails | null;
  selectedHouseholder?: any | null;
}

export function BusinessDrawerDialogs({ 
  establishments, 
  selectedEstablishmentId, 
  selectedArea, 
  businessTab = 'establishments',
  selectedEstablishment,
  selectedHouseholder 
}: BusinessDrawerDialogsProps) {
  const establishmentId = selectedEstablishment?.id || selectedEstablishmentId;
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [openEst, setOpenEst] = useState(false);
  const [openHh, setOpenHh] = useState(false);
  const [openVisit, setOpenVisit] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Determine which form to open based on current state
  const showEstablishmentForm = !selectedEstablishment && !selectedHouseholder && businessTab === 'establishments';
  const showHouseholderForm = !selectedEstablishment && !selectedHouseholder && businessTab === 'householders';
  const showVisitForm = selectedEstablishment || selectedHouseholder;
  const showExpandableButtons = selectedEstablishment && !selectedHouseholder; // Only for establishment details
  const showHouseholderDialog = showHouseholderForm || (showExpandableButtons && openHh); // Show when in householder list OR when opened from expandable buttons

  // Determine which form to open when main button is clicked
  const handleMainButtonClick = () => {
    if (showExpandableButtons) {
      setExpanded(!expanded);
    } else if (showEstablishmentForm) {
      setOpenEst(true);
    } else if (showHouseholderForm) {
      setOpenHh(true);
    } else if (showVisitForm) {
      setOpenVisit(true);
    }
  };

  // Collapse expanded buttons when clicking outside
  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (e: Event) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (el.closest('[data-bus-fab]') || el.closest('[data-bus-trigger]')) return;
      setTimeout(() => setExpanded(false), 0);
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [expanded]);

  const MainFab = (
    <RadixPortal container={typeof document !== 'undefined' ? document.getElementById('fab-root') : undefined}>
      <Button
        onClick={handleMainButtonClick}
        className={`fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px] ${expanded ? 'rotate-90' : ''}`}
        size="lg"
        aria-label="Business actions"
        title="Business actions"
        data-bus-fab
      >
        {expanded ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </Button>
    </RadixPortal>
  );

  if (isDesktop) {
    return (
      <>
        {MainFab}
        {showExpandableButtons && (
          <>
            <RadixPortal container={typeof document !== 'undefined' ? document.getElementById('fab-root') : undefined}>
              <Button
                variant="outline"
                className="fixed right-4 z-40 rounded-full shadow-lg md:right-6"
                style={{
                  bottom: "calc(max(env(safe-area-inset-bottom),0px) + 144px)",
                  opacity: expanded ? 1 : 0,
                  transform: expanded ? "translateY(0) scale(1)" : "translateY(8px) scale(0.95)",
                  transition: "transform 180ms ease, opacity 180ms ease",
                  transitionDelay: "0ms",
                  willChange: "transform, opacity",
                  pointerEvents: expanded ? "auto" : "none",
                }}
                onClick={() => { setOpenHh(true); setExpanded(false); }}
                data-bus-trigger
              >
                <span className="flex items-center">
                  <UserPlus className="h-4 w-4 mr-2" />
                  New Householder
                </span>
              </Button>
            </RadixPortal>
            <RadixPortal container={typeof document !== 'undefined' ? document.getElementById('fab-root') : undefined}>
              <Button
                variant="default"
                className="fixed right-4 z-40 rounded-full shadow-lg md:right-6"
                style={{
                  bottom: "calc(max(env(safe-area-inset-bottom),0px) + 196px)",
                  opacity: expanded ? 1 : 0,
                  transform: expanded ? "translateY(0) scale(1)" : "translateY(8px) scale(0.95)",
                  transition: "transform 180ms ease, opacity 180ms ease",
                  transitionDelay: "50ms",
                  willChange: "transform, opacity",
                  pointerEvents: expanded ? "auto" : "none",
                }}
                onClick={() => { setOpenVisit(true); setExpanded(false); }}
                data-bus-trigger
              >
                <span className="flex items-center">
                  <FilePlus2 className="h-4 w-4 mr-2" />
                  New Visit
                </span>
              </Button>
            </RadixPortal>
          </>
        )}
        {showEstablishmentForm && (
          <Dialog open={openEst} onOpenChange={setOpenEst}>
            <DialogContent>
              <DialogHeader className="text-center">
                <DialogTitle>New Establishment</DialogTitle>
                <DialogDescription>Add a business establishment.</DialogDescription>
              </DialogHeader>
              <div className="px-4">
                <EstablishmentForm
                  onSaved={() => setOpenEst(false)}
                  selectedArea={selectedArea}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
        {showHouseholderDialog && (
          <Dialog open={openHh} onOpenChange={setOpenHh}>
            <DialogContent>
              <DialogHeader className="text-center">
                <DialogTitle>New Householder</DialogTitle>
                <DialogDescription>Add a householder for an establishment.</DialogDescription>
              </DialogHeader>
              <div className="px-4">
                <HouseholderForm
                  establishments={establishments}
                  selectedEstablishmentId={establishmentId}
                  onSaved={() => setOpenHh(false)}
                  disableEstablishmentSelect={!!showExpandableButtons}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
        {showVisitForm && (
          <Dialog open={openVisit} onOpenChange={setOpenVisit}>
            <DialogContent>
              <DialogHeader className="text-center">
                <DialogTitle>Visit Update</DialogTitle>
                <DialogDescription>Record a visit note.</DialogDescription>
              </DialogHeader>
              <div className="px-4">
                <VisitForm
                  establishments={establishments}
                  selectedEstablishmentId={selectedEstablishment?.id}
                  householderId={selectedHouseholder?.id}
                  householderName={selectedHouseholder?.name}
                  onSaved={() => setOpenVisit(false)}
                  disableEstablishmentSelect={!!showExpandableButtons}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  return (
    <>
      {MainFab}
      {showExpandableButtons && (
        <>
          <RadixPortal container={typeof document !== 'undefined' ? document.getElementById('fab-root') : undefined}>
            <Button
              variant="outline"
              className="fixed right-4 z-40 rounded-full shadow-lg md:right-6"
              style={{
                bottom: "calc(max(env(safe-area-inset-bottom),0px) + 144px)",
                opacity: expanded ? 1 : 0,
                transform: expanded ? "translateY(0) scale(1)" : "translateY(8px) scale(0.95)",
                transition: "transform 180ms ease, opacity 180ms ease",
                transitionDelay: "0ms",
                willChange: "transform, opacity",
                pointerEvents: expanded ? "auto" : "none",
              }}
              onClick={() => { setOpenHh(true); setExpanded(false); }}
              data-bus-trigger
            >
              <span className="flex items-center">
                <UserPlus className="h-4 w-4 mr-2" />
                New Householder
              </span>
            </Button>
          </RadixPortal>
          <RadixPortal container={typeof document !== 'undefined' ? document.getElementById('fab-root') : undefined}>
            <Button
              variant="default"
              className="fixed right-4 z-40 rounded-full shadow-lg md:right-6"
              style={{
                bottom: "calc(max(env(safe-area-inset-bottom),0px) + 196px)",
                opacity: expanded ? 1 : 0,
                transform: expanded ? "translateY(0) scale(1)" : "translateY(8px) scale(0.95)",
                transition: "transform 180ms ease, opacity 180ms ease",
                transitionDelay: "50ms",
                willChange: "transform, opacity",
                pointerEvents: expanded ? "auto" : "none",
              }}
              onClick={() => { setOpenVisit(true); setExpanded(false); }}
              data-bus-trigger
            >
              <span className="flex items-center">
                <FilePlus2 className="h-4 w-4 mr-2" />
                New Visit
              </span>
            </Button>
          </RadixPortal>
        </>
      )}
      {showEstablishmentForm && (
        <Drawer open={openEst} onOpenChange={setOpenEst}>
          <DrawerContent>
            <DrawerHeader className="text-center">
              <DrawerTitle>New Establishment</DrawerTitle>
              <DrawerDescription>Add a business establishment.</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              <EstablishmentForm
                onSaved={() => setOpenEst(false)}
                selectedArea={selectedArea}
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}
      {showHouseholderDialog && (
        <Drawer open={openHh} onOpenChange={setOpenHh}>
          <DrawerContent>
            <DrawerHeader className="text-center">
              <DrawerTitle>New Householder</DrawerTitle>
              <DrawerDescription>Add a householder for an establishment.</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              <HouseholderForm
                establishments={establishments}
                selectedEstablishmentId={establishmentId}
                onSaved={() => setOpenHh(false)}
                disableEstablishmentSelect={!!showExpandableButtons}
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}
      {showVisitForm && (
        <Drawer open={openVisit} onOpenChange={setOpenVisit}>
          <DrawerContent>
            <DrawerHeader className="text-center">
              <DrawerTitle>Visit Update</DrawerTitle>
              <DrawerDescription>Record a visit note.</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              <VisitForm
                establishments={establishments}
                selectedEstablishmentId={selectedEstablishment?.id}
                householderId={selectedHouseholder?.id}
                householderName={selectedHouseholder?.name}
                onSaved={() => setOpenVisit(false)}
                disableEstablishmentSelect={!!showExpandableButtons}
              />
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </>
  );
}


