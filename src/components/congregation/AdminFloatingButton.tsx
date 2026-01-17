"use client";

import { useState } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { FormModal } from "@/components/shared/FormModal";
import { FabMenu } from "@/components/shared/FabMenu";
import { Plus, X, Calendar } from "lucide-react";
import { EventScheduleForm } from "./EventScheduleForm";

interface AdminFloatingButtonProps {
  congregationId: string;
}

export function AdminFloatingButton({ congregationId }: AdminFloatingButtonProps) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1280px)");

  const handleScheduleSaved = () => {
    setOpen(false);
    try {
      window.dispatchEvent(new CustomEvent('event-schedule-refresh'));
    } catch {}
  };

  if (isDesktop) {
    return (
      <>
        <FabMenu
          label="New Schedule"
          mainIcon={<Plus className="h-6 w-6" />}
          mainIconOpen={<X className="h-6 w-6" />}
          mainClassName="lg:h-16 lg:w-16 lg:right-8 lg:bottom-8"
          actions={[
            {
              label: "New Schedule",
              icon: <Calendar className="h-4 w-4" />,
              onClick: () => setOpen(true)
            }
          ]}
        />
        <FormModal
          open={open}
          onOpenChange={setOpen}
          title="New Event Schedule"
          description="Create a new event schedule"
          headerClassName="text-center"
        >
                <EventScheduleForm 
                  congregationId={congregationId}
                  onSaved={handleScheduleSaved}
                />
        </FormModal>
      </>
    );
  }

  return (
    <>
      <FabMenu
        label="New Schedule"
        mainIcon={<Plus className="h-6 w-6" />}
        mainIconOpen={<X className="h-6 w-6" />}
        mainClassName="bg-primary text-primary-foreground"
        actions={[
          {
            label: "New Schedule",
            icon: <Calendar className="h-4 w-4" />,
            onClick: () => setOpen(true)
          }
        ]}
      />
      <FormModal
        open={open}
        onOpenChange={setOpen}
        title="New Event Schedule"
        description="Create a new event schedule"
        headerClassName="text-center"
      >
              <EventScheduleForm 
                congregationId={congregationId}
                onSaved={handleScheduleSaved}
              />
      </FormModal>
    </>
  );
}
