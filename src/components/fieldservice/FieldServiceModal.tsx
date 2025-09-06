"use client";

import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { FieldServiceForm } from "@/components/fieldservice/FieldServiceForm";

interface FieldServiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

export function FieldServiceModal({ open, onOpenChange, userId }: FieldServiceModalProps) {
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange} title="Field Service">
      <FieldServiceForm userId={userId} onClose={() => onOpenChange(false)} />
    </ResponsiveModal>
  );
}
