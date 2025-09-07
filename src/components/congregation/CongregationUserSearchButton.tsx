"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { AddUserToCongregationForm } from "./AddUserToCongregationForm";

interface CongregationUserSearchButtonProps {
  congregationId: string | null;
  canEdit: boolean;
  onRefresh: () => void;
}

export function CongregationUserSearchButton({ congregationId, canEdit, onRefresh }: CongregationUserSearchButtonProps) {
  const [searchDrawerOpen, setSearchDrawerOpen] = useState(false);

  // Only show if user has edit permissions and congregation ID
  if (!canEdit || !congregationId) {
    return null;
  }

  return (
    <>
      {/* Floating Action Button - aligned with Business FAB; larger and adjusted on lg (tablet landscape) */}
      <Button
        onClick={() => setSearchDrawerOpen(true)}
        className="fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px] lg:h-16 lg:w-16 lg:right-8 lg:bottom-8"
        size="lg"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* User Search Modal */}
      <ResponsiveModal
        open={searchDrawerOpen}
        onOpenChange={setSearchDrawerOpen}
        title="Add User to Congregation"
        description="Search for users by username or email"
      >
        <AddUserToCongregationForm
          congregationId={congregationId}
          onUserAdded={(user: any) => {
            onRefresh();
            setSearchDrawerOpen(false);
          }}
          onClose={() => setSearchDrawerOpen(false)}
        />
      </ResponsiveModal>
    </>
  );
}
