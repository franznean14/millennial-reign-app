"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { FilePlus2 } from "lucide-react";
import { FieldServiceDrawerDialog } from "@/components/fieldservice/FieldServiceDrawerDialog";

export function FieldServiceFloatingButton({ userId }: { userId: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* Floating Action Button - same positioning/design as existing FABs */}
      <Button
        onClick={() => setOpen(true)}
        className="fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px]"
        size="lg"
      >
        <FilePlus2 className="h-6 w-6" />
      </Button>

      {/* Field Service Drawer */}
      <FieldServiceDrawerDialog
        userId={userId}
        open={open}
        onOpenChange={setOpen}
        showTrigger={false}
      />
    </>
  );
}


