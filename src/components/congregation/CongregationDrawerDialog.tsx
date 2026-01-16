"use client";

import * as React from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { UserPlus, Plus } from "lucide-react";
import { Portal as RadixPortal } from "@radix-ui/react-portal";
import { AddUserToCongregationForm } from "@/components/congregation/AddUserToCongregationForm";
import { HouseholderForm } from "@/components/business/HouseholderForm";

interface CongregationDrawerDialogProps {
  congregationId: string;
  onUserAdded?: (user: any) => void;
  congregationTab?: 'meetings' | 'ministry';
  userId?: string | null;
}

export function CongregationDrawerDialog({ congregationId, onUserAdded, congregationTab = 'meetings', userId }: CongregationDrawerDialogProps) {
  const [open, setOpen] = React.useState(false);
  // Consider desktop at >=1280px so medium tablets use floating FAB
  const isDesktop = useMediaQuery("(min-width: 1280px)");
  const isMinistryTab = congregationTab === 'ministry';
  const triggerLabel = isMinistryTab ? "Add householder" : "Add user to congregation";

  const handleAdded = (user: any) => {
    onUserAdded?.(user);
    try {
      window.dispatchEvent(new CustomEvent('congregation-refresh'));
    } catch {}
    setOpen(false);
  };

  const handleHouseholderSaved = () => {
    try {
      window.dispatchEvent(new CustomEvent('congregation-refresh'));
    } catch {}
    setOpen(false);
  };

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="fixed right-4 bottom-[104px] z-40 md:right-6 lg:right-8 lg:bottom-8" title={triggerLabel} aria-label={triggerLabel}>
            {isMinistryTab ? <Plus className="h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />} Add
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader className="text-center">
            <DialogTitle>{isMinistryTab ? "New Householder" : "Add Publisher"}</DialogTitle>
            <DialogDescription>{isMinistryTab ? "Add a personal householder with location" : "Add a user to this congregation."}</DialogDescription>
          </DialogHeader>
          <div className="px-4">
            {isMinistryTab ? (
              <HouseholderForm 
                establishments={[]}
                onSaved={handleHouseholderSaved}
                context="congregation"
                publisherId={userId || undefined}
              />
            ) : (
              <AddUserToCongregationForm congregationId={congregationId} onUserAdded={handleAdded} onClose={() => setOpen(false)} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <RadixPortal container={typeof document !== 'undefined' ? document.getElementById('fab-root') : undefined}>
        <DrawerTrigger asChild>
          <Button
            type="button"
            aria-label={triggerLabel}
            title={triggerLabel}
            className="fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl bg-primary text-primary-foreground hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px] lg:h-16 lg:w-16 lg:right-8 lg:bottom-8"
          >
            {isMinistryTab ? <Plus className="h-6 w-6" /> : <UserPlus className="h-6 w-6" />}
          </Button>
        </DrawerTrigger>
      </RadixPortal>
      <DrawerContent>
        <DrawerHeader className="text-center">
          <DrawerTitle>{isMinistryTab ? "New Householder" : "Add Publisher"}</DrawerTitle>
          <DrawerDescription>{isMinistryTab ? "Add a personal householder with location" : "Add a user to this congregation."}</DrawerDescription>
        </DrawerHeader>
        <div className="px-4">
          {isMinistryTab ? (
            <HouseholderForm 
              establishments={[]}
              onSaved={handleHouseholderSaved}
              context="congregation"
              publisherId={userId || undefined}
            />
          ) : (
            <AddUserToCongregationForm congregationId={congregationId} onUserAdded={handleAdded} onClose={() => setOpen(false)} />
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}


