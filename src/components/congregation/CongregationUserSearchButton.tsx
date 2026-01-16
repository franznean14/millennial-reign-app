"use client";

import { useState } from "react";
import { FabMenu } from "@/components/shared/FabMenu";
import { Plus } from "lucide-react";
import { FormModal } from "@/components/shared/FormModal";
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
      <FabMenu
        label="Add user to congregation"
        mainIcon={<Plus className="h-6 w-6" />}
        mainIconOpen={<Plus className="h-6 w-6" />}
        mainClassName="lg:h-16 lg:w-16 lg:right-8 lg:bottom-8"
        actions={[
          {
            label: "Add User",
            icon: <Plus className="h-4 w-4" />,
            onClick: () => setSearchDrawerOpen(true)
          }
        ]}
      />

      {/* User Search Modal */}
      <FormModal
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
      </FormModal>
    </>
  );
}
