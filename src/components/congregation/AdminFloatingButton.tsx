"use client";

import { useState, useEffect, useRef } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Plus, X, Calendar } from "lucide-react";
import { Portal as RadixPortal } from "@radix-ui/react-portal";
import { EventScheduleForm } from "./EventScheduleForm";

interface AdminFloatingButtonProps {
  congregationId: string;
}

export function AdminFloatingButton({ congregationId }: AdminFloatingButtonProps) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState(false);
  const fabContainerRef = useRef<HTMLDivElement>(null);
  const isDesktop = useMediaQuery("(min-width: 1280px)");

  // Collapse expanded buttons when clicking/tapping outside
  useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (event: PointerEvent) => {
      const root = fabContainerRef.current;
      if (!root) return;
      const target = event.target as Node | null;
      if (target && !root.contains(target)) {
        setExpanded(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, { capture: true });
    return () => document.removeEventListener('pointerdown', handlePointerDown, { capture: true } as any);
  }, [expanded]);

  const handleScheduleSaved = () => {
    setOpen(false);
    try {
      window.dispatchEvent(new CustomEvent('event-schedule-refresh'));
    } catch {}
  };

  if (isDesktop) {
    return (
      <>
        <div ref={fabContainerRef}>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => setExpanded(!expanded)}
                className={`fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px] lg:h-16 lg:w-16 lg:right-8 lg:bottom-8 ${expanded ? 'rotate-90' : ''}`}
                size="lg"
                data-admin-fab
              >
                {expanded ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader className="text-center">
                <DialogTitle>New Event Schedule</DialogTitle>
                <DialogDescription>Create a new event schedule</DialogDescription>
              </DialogHeader>
              <div className="px-4">
                <EventScheduleForm 
                  congregationId={congregationId}
                  onSaved={handleScheduleSaved}
                />
              </div>
            </DialogContent>
          </Dialog>

          {/* Expandable button - positioned above main button */}
          <RadixPortal container={typeof document !== 'undefined' ? document.getElementById('fab-root') : undefined}>
            <Button
              variant="default"
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
              onClick={() => { setOpen(true); setExpanded(false); }}
              data-admin-trigger
            >
              <span className="flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                New Schedule
              </span>
            </Button>
          </RadixPortal>
        </div>
      </>
    );
  }

  return (
    <>
      <div ref={fabContainerRef}>
        <Drawer open={open} onOpenChange={setOpen}>
          <RadixPortal container={typeof document !== 'undefined' ? document.getElementById('fab-root') : undefined}>
            <DrawerTrigger asChild>
              <Button
                onClick={() => setExpanded(!expanded)}
                type="button"
                aria-label="New Schedule"
                title="New Schedule"
                className={`fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl bg-primary text-primary-foreground hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px] ${expanded ? 'rotate-90' : ''}`}
                data-admin-fab
              >
                {expanded ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
              </Button>
            </DrawerTrigger>
          </RadixPortal>
          <DrawerContent>
            <DrawerHeader className="text-center">
              <DrawerTitle>New Event Schedule</DrawerTitle>
              <DrawerDescription>Create a new event schedule</DrawerDescription>
            </DrawerHeader>
            <div className="px-4">
              <EventScheduleForm 
                congregationId={congregationId}
                onSaved={handleScheduleSaved}
              />
            </div>
          </DrawerContent>
        </Drawer>

        {/* Expandable button - positioned above main button */}
        <RadixPortal container={typeof document !== 'undefined' ? document.getElementById('fab-root') : undefined}>
          <Button
            variant="default"
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
            onClick={() => { setOpen(true); setExpanded(false); }}
            data-admin-trigger
          >
            <span className="flex items-center">
              <Calendar className="h-4 w-4 mr-2" />
              New Schedule
            </span>
          </Button>
        </RadixPortal>
      </div>
    </>
  );
}
