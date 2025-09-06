"use client";

import * as React from "react";
import { useMemo } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Users } from "lucide-react";
import { AddUserToCongregationForm } from "@/components/congregation/AddUserToCongregationForm";

interface AddUserToCongregationDrawerDialogProps {
  congregationId: string;
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
  positionOffset?: number;
  onUserAdded?: (user: any) => void;
}

export function AddUserToCongregationDrawerDialog({
  congregationId,
  triggerLabel = "Add User",
  open: controlledOpen,
  onOpenChange,
  showTrigger = true,
  positionOffset = 0,
  onUserAdded,
}: AddUserToCongregationDrawerDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const bottomCalc = useMemo(() => `calc(max(env(safe-area-inset-bottom),0px)+${80 + positionOffset * 64}px)`, [positionOffset]);

  const handleClose = () => setOpen(false);

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {showTrigger && (
          <DialogTrigger asChild>
            <Button
              aria-label={triggerLabel}
              title={triggerLabel}
              className="fixed right-4 md:right-6 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation"
              size="lg"
              style={{ bottom: bottomCalc }}
            >
              <Users className="h-6 w-6" />
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="flex max-h-[85vh] flex-col p-0">
          <DialogHeader className="text-center flex-shrink-0">
            <DialogTitle>Add User to Congregation</DialogTitle>
            <DialogDescription>Search by username or email</DialogDescription>
          </DialogHeader>
          <div className="p-4 pt-0 flex-1 min-h-0 overflow-y-auto ios-touch">
            <AddUserToCongregationForm
              congregationId={congregationId}
              onUserAdded={(u) => {
                onUserAdded?.(u);
                handleClose();
              }}
              onClose={handleClose}
            />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      {showTrigger && (
        <DrawerTrigger asChild>
          <Button
            aria-label={triggerLabel}
            title={triggerLabel}
            className="fixed right-4 md:right-6 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation"
            size="lg"
            style={{ bottom: bottomCalc }}
          >
            <Users className="h-6 w-6" />
          </Button>
        </DrawerTrigger>
      )}
      <DrawerContent>
        <DrawerHeader className="text-center flex-shrink-0">
          <DrawerTitle>Add User to Congregation</DrawerTitle>
          <DrawerDescription>Search for users by username or email</DrawerDescription>
        </DrawerHeader>
        <div className="p-4 pt-0 flex-1 min-h-0 overflow-y-auto ios-touch">
          <AddUserToCongregationForm
            congregationId={congregationId}
            onUserAdded={(u) => {
              onUserAdded?.(u);
              handleClose();
            }}
            onClose={handleClose}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

