"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { UserSearchDrawer } from "./UserSearchDrawer";

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
      {/* Floating Action Button - same positioning as BusinessFloatingButton */}
      <Button
        onClick={() => setSearchDrawerOpen(true)}
        className="fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:bottom-[104px]"
        size="lg"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* User Search Drawer */}
      <UserSearchDrawer
        isOpen={searchDrawerOpen}
        onClose={() => setSearchDrawerOpen(false)}
        onUserAdded={(user) => {
          // Trigger refresh of the members list
          onRefresh();
          // The drawer will stay open, user can close it manually
        }}
        currentCongregationId={congregationId}
      />
    </>
  );
}
