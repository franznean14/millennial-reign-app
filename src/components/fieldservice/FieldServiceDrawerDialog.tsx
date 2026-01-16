"use client";

import * as React from "react";
import { FabMenu } from "@/components/shared/FabMenu";
import { FormModal } from "@/components/shared/FormModal";
import { FilePlus2 } from "lucide-react";
import FieldServiceForm from "@/components/fieldservice/FieldServiceForm";

interface FieldServiceDrawerDialogProps {
  userId: string;
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function FieldServiceDrawerDialog({ userId, triggerLabel = "Field Service", open: controlledOpen, onOpenChange, showTrigger = true }: FieldServiceDrawerDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;

  return (
    <>
      {showTrigger && (
        <FabMenu
          label={triggerLabel}
          mainIcon={<FilePlus2 className="h-6 w-6" />}
          mainIconOpen={<FilePlus2 className="h-6 w-6" />}
          mainClassName="bg-primary text-primary-foreground lg:h-16 lg:w-16 lg:right-8 lg:bottom-8"
          actions={[
            {
              label: "Field Service",
              icon: <FilePlus2 className="h-4 w-4" />,
              onClick: () => setOpen(true)
            }
          ]}
        />
      )}
      <FormModal
        open={open}
        onOpenChange={setOpen}
        title="Field Service"
        description="Record your daily activity."
        headerClassName="text-center"
      >
        <FieldServiceForm userId={userId} onClose={() => setOpen(false)} />
      </FormModal>
    </>
  );
}
