"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import { FormModal } from "@/components/shared/FormModal";
import { FabMenu } from "@/components/shared/FabMenu";
import { EstablishmentForm } from "@/components/business/EstablishmentForm";
import { HouseholderForm } from "@/components/business/HouseholderForm";
import { CallForm } from "@/components/business/CallForm";
import { TodoForm } from "@/components/business/TodoForm";
import { BulkTodoForm } from "@/components/business/BulkTodoForm";
import FieldServiceForm from "@/components/fieldservice/FieldServiceForm";
import { EventScheduleFormSheet } from "@/components/congregation/EventScheduleFormSheet";
import { AddUserToCongregationForm } from "@/components/congregation/AddUserToCongregationForm";
import { Plus, X, UserPlus, FilePlus2, Building2, Calendar, ListTodo, Send, Eraser, Trash2 } from "lucide-react";
import type { EstablishmentWithDetails, HouseholderWithDetails } from "@/lib/db/business";
import { useHomeTodoDetailsFabOptional } from "@/components/home/home-todo-details-fab-context";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

type BusinessTab = "establishments" | "householders" | "map";
type CongregationTab = "meetings" | "ministry" | "admin";

type BulkTabletDockedFabAction = {
  label: string;
  icon: ReactElement;
  onClick: () => void;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link";
  className?: string;
};

interface UnifiedFabProps {
  currentSection: string;
  userId: string;
  // business
  establishments: EstablishmentWithDetails[];
  householders: HouseholderWithDetails[];
  selectedEstablishment: EstablishmentWithDetails | null;
  selectedHouseholder: HouseholderWithDetails | null;
  selectedArea?: string;
  businessTab: BusinessTab;
  // congregation
  congregationId?: string | null;
  congregationTab: CongregationTab;
  isElder: boolean;
  isAdmin: boolean;
  congregationSelectedHouseholder: HouseholderWithDetails | null;
}

type FabActionKey =
  | "business-establishment"
  | "business-householder"
  | "business-visit"
  | "business-todo"
  | "business-bulk-todos"
  | "congregation-householder"
  | "congregation-user"
  | "congregation-visit"
  | "congregation-schedule"
  | "field-service"
  | null;

export function UnifiedFab({
  currentSection,
  userId,
  establishments,
  householders,
  selectedEstablishment,
  selectedHouseholder,
  selectedArea,
  businessTab,
  congregationId,
  congregationTab,
  isElder,
  isAdmin,
  congregationSelectedHouseholder
}: UnifiedFabProps) {
  const [openKey, setOpenKey] = useState<FabActionKey>(null);
  const [bulkTodoKind, setBulkTodoKind] = useState<"new" | "edit" | "mixed">("new");
  const homeFabBridge = useHomeTodoDetailsFabOptional();
  const homeDetailsFab =
    homeFabBridge?.callsHistoryFabOverride ?? homeFabBridge?.todoDetailsFabOverride ?? null;
  const hideHomeFab = currentSection === "home" && !!homeFabBridge?.hideHomeFab;
  const useBusinessLeftSheet =
    !!homeDetailsFab || currentSection === "business" || currentSection.startsWith("business-");
  const stackBusinessLeftSheetAboveNestedDetails =
    homeDetailsFab?.stackLeftFormAboveNestedDetails ?? (!!selectedEstablishment && !!selectedHouseholder);

  const isTabletUp = useMediaQuery("(min-width: 768px)");

  const getDraftBulkTodoKind = (): "new" | "edit" | "mixed" => {
    try {
      if (typeof window === "undefined") return "new";
      const raw = window.localStorage.getItem("business:bulk-todos:draft:v1");
      if (!raw) return "new";
      const parsed = JSON.parse(raw) as { rows?: Array<{ sourceTodoId?: string | null }> };
      const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];
      const hasEdit = rows.some((row) => !!row?.sourceTodoId);
      const hasNew = rows.some((row) => !row?.sourceTodoId);
      if (hasEdit && hasNew) return "mixed";
      if (hasEdit) return "edit";
      return "new";
    } catch {
      return "new";
    }
  };

  useEffect(() => {
    const handleOpenBulkTodos = (event: Event) => {
      const detail = (event as CustomEvent<{ mode?: "create" | "edit" }>).detail;
      if (detail?.mode === "edit") {
        setBulkTodoKind("edit");
      } else {
        setBulkTodoKind(getDraftBulkTodoKind());
      }
      setOpenKey("business-bulk-todos");
    };
    window.addEventListener("open-business-bulk-todos", handleOpenBulkTodos as EventListener);
    return () => {
      window.removeEventListener("open-business-bulk-todos", handleOpenBulkTodos as EventListener);
    };
  }, []);

  const businessEstablishmentId =
    selectedHouseholder?.establishment_id || selectedEstablishment?.id || undefined;
  const isBusinessDetails = !!selectedEstablishment || !!selectedHouseholder;
  const showExpandableButtons = !!selectedEstablishment && !selectedHouseholder;
  const showEstablishmentForm = !selectedEstablishment && !selectedHouseholder && businessTab === "establishments";
  const showHouseholderForm = !selectedEstablishment && !selectedHouseholder && businessTab === "householders";
  const showCallForm = !!selectedEstablishment || !!selectedHouseholder;

  const fabEstablishmentsForForms: EstablishmentWithDetails[] | Array<{ id?: string; name: string }> =
    homeDetailsFab?.establishments ?? establishments;
  const fabSelectedEstId = homeDetailsFab?.selectedEstablishmentId ?? businessEstablishmentId;
  const fabHouseholderId = homeDetailsFab?.householderId ?? selectedHouseholder?.id;
  const fabHouseholderName = homeDetailsFab?.householderName ?? selectedHouseholder?.name;
  const fabHouseholderStatus = homeDetailsFab?.householderStatus ?? selectedHouseholder?.status;
  const fabLockEstablishment = showExpandableButtons || !!homeDetailsFab;

  const closeBusinessFabForm = () => {
    setOpenKey(null);
    void homeDetailsFab?.onAfterSave();
  };

  const canManageCongregation = isElder || isAdmin;
  const isCongregationAdminTab = congregationTab === "admin" && isElder;
  const isCongregationMinistryTab = congregationTab === "ministry";
  const isCongregationDetails = !!congregationSelectedHouseholder;

  const actions = useMemo(() => {
    const items: { key: FabActionKey; label: string; icon: ReactElement; variant?: "default" | "outline" }[] = [];

    if (currentSection === "business" || currentSection.startsWith("business-")) {
      if (showExpandableButtons) {
        items.push(
          { key: "business-visit", label: "New Call", icon: <FilePlus2 className="size-6" /> },
          { key: "business-todo", label: "New To-Do", icon: <ListTodo className="size-6" /> },
          { key: "business-householder", label: "New Contact", icon: <UserPlus className="size-6" /> }
        );
      } else if (showEstablishmentForm) {
        items.push({ key: "business-establishment", label: "New Establishment", icon: <Building2 className="size-6" /> });
        if (isElder) {
          items.push({ key: "business-bulk-todos", label: "New To-Dos", icon: <ListTodo className="size-6" /> });
        }
      } else if (showHouseholderForm) {
        items.push({ key: "business-householder", label: "New Contact", icon: <UserPlus className="size-6" />, variant: "outline" });
      } else if (showCallForm) {
        items.push(
          { key: "business-visit", label: "New Call", icon: <FilePlus2 className="size-6" /> },
          { key: "business-todo", label: "New To-Do", icon: <ListTodo className="size-6" /> }
        );
      }
    }

    if (currentSection === "congregation" && canManageCongregation) {
      if (isCongregationAdminTab) {
        items.push({ key: "congregation-schedule", label: "New Schedule", icon: <Calendar className="size-6" /> });
      } else if (isCongregationMinistryTab && isCongregationDetails) {
        items.push({ key: "congregation-visit", label: "New Call", icon: <FilePlus2 className="size-6" /> });
      } else if (isCongregationMinistryTab) {
        items.push({ key: "congregation-householder", label: "Add Householder", icon: <UserPlus className="size-6" /> });
      } else {
        items.push({ key: "congregation-user", label: "Add Publisher", icon: <UserPlus className="size-6" /> });
      }
    }

    if (currentSection === "home") {
      if (homeDetailsFab) {
        items.push(
          { key: "business-visit", label: "New Call", icon: <FilePlus2 className="size-6" /> },
          { key: "business-todo", label: "New To-Do", icon: <ListTodo className="size-6" /> }
        );
        if (homeDetailsFab.showNewContact) {
          items.push({
            key: "business-householder",
            label: "New Contact",
            icon: <UserPlus className="size-6" />,
          });
        }
      } else {
        items.push({ key: "field-service", label: "Field Service", icon: <FilePlus2 className="size-6" /> });
      }
    }

    return items;
  }, [
    businessTab,
    canManageCongregation,
    currentSection,
    homeDetailsFab,
    isElder,
    isCongregationAdminTab,
    isCongregationDetails,
    isCongregationMinistryTab,
    showEstablishmentForm,
    showExpandableButtons,
    showHouseholderForm,
    showCallForm
  ]);

  const [bulkSavedEditRowCount, setBulkSavedEditRowCount] = useState(0);

  const readBulkDraftSavedEditCount = (): number => {
    try {
      if (typeof window === "undefined") return 0;
      const raw = window.localStorage.getItem("business:bulk-todos:draft:v1");
      if (!raw) return 0;
      const parsed = JSON.parse(raw) as { rows?: Array<{ sourceTodoId?: string | null }> };
      const draftRows = Array.isArray(parsed?.rows) ? parsed.rows : [];
      return draftRows.filter(
        (row) => typeof row?.sourceTodoId === "string" && row.sourceTodoId.length > 0
      ).length;
    } catch {
      return 0;
    }
  };

  useEffect(() => {
    const sync = () => setBulkSavedEditRowCount(readBulkDraftSavedEditCount());
    sync();
    window.addEventListener("business-bulk-todos-draft-saved", sync);
    return () => window.removeEventListener("business-bulk-todos-draft-saved", sync);
  }, []);

  useEffect(() => {
    if (openKey === "business-bulk-todos") {
      setBulkSavedEditRowCount(readBulkDraftSavedEditCount());
    }
  }, [openKey]);

  const bulkFabTabletDocked =
    useBusinessLeftSheet && openKey === "business-bulk-todos" && isTabletUp;

  const bulkTabletFabDockedActions = useMemo((): BulkTabletDockedFabAction[] => {
    const items: BulkTabletDockedFabAction[] = [
      {
        label: "Add More",
        icon: <Plus className="size-6" />,
        onClick: () => {
          try {
            window.dispatchEvent(new CustomEvent("business-bulk-todos-open-target-picker"));
          } catch {
            /* ignore */
          }
        },
      },
      {
        label: "Submit Ready To-Dos",
        icon: <Send className="size-6" />,
        onClick: () => {
          try {
            window.dispatchEvent(new CustomEvent("business-bulk-todos-submit-ready"));
          } catch {
            /* ignore */
          }
        },
      },
      {
        label: "Clear",
        icon: <Eraser className="size-6" />,
        onClick: () => {
          try {
            window.dispatchEvent(new CustomEvent("business-bulk-todos-request-clear"));
          } catch {
            /* ignore */
          }
        },
        className:
          "border-0 !bg-yellow-500 !text-gray-950 shadow-md hover:!bg-yellow-600 dark:!bg-yellow-500 dark:!text-gray-950 dark:hover:!bg-yellow-400",
      },
    ];
    if (bulkSavedEditRowCount > 0) {
      items.push({
        label: "Delete All",
        variant: "destructive",
        icon: <Trash2 className="size-6" />,
        onClick: () => {
          try {
            window.dispatchEvent(new CustomEvent("business-bulk-todos-request-delete-all-saved"));
          } catch {
            /* ignore */
          }
        },
      });
    }
    return items;
  }, [bulkSavedEditRowCount]);

  if (hideHomeFab || actions.length === 0) return null;

  const mainIcon = actions.length === 1 ? actions[0].icon : <Plus className="size-6" />;
  const mainIconOpen = actions.length === 1 ? actions[0].icon : <X className="size-6" />;

  return (
    <>
      <FabMenu
        label={bulkFabTabletDocked ? "Bulk to-do actions" : "Actions"}
        tabletDockedToBulkTodoSheet={bulkFabTabletDocked}
        tabletDockedActions={bulkFabTabletDocked ? bulkTabletFabDockedActions : undefined}
        mainIcon={mainIcon}
        mainIconOpen={mainIconOpen}
        mainClassName={cn(
          "bg-primary text-primary-foreground md:h-[4.75rem] md:w-[4.75rem] md:[&_svg]:h-8 md:[&_svg]:w-8 md:!right-auto md:!bottom-[calc(max(env(safe-area-inset-bottom),0px)+28px)] dark:!bg-[#80778e] dark:!text-white dark:hover:!bg-[#8c839a]",
          "md:transition-[left,transform] md:duration-300 md:ease-[cubic-bezier(0.34,1.2,0.64,1)]",
          bulkFabTabletDocked
            ? "md:!left-[calc(100vw-min(100vw,72rem)-4.75rem)] md:!translate-x-0 md:!z-[145]"
            : "md:!left-1/2 md:!-translate-x-1/2 md:!z-40"
        )}
        actionClassName="md:!left-1/2 md:!right-auto md:[--fab-action-x:-50%] md:[--fab-action-offset-start:112px] md:[--fab-action-offset-step:0px] md:[--fab-action-closed-y:72px]"
        actions={actions.map((action) => ({
          label: action.label,
          icon: action.icon,
          variant: action.variant,
          onClick: () => {
            if (action.key === "business-bulk-todos") {
              setBulkTodoKind(getDraftBulkTodoKind());
            }
            setOpenKey(action.key);
          }
        }))}
      />

      <FormModal
        open={openKey === "business-establishment"}
        onOpenChange={(open) => setOpenKey(open ? "business-establishment" : null)}
        title="New Establishment"
        description="Add a business establishment."
        headerClassName={useBusinessLeftSheet ? undefined : "text-center"}
        desktopPresentation={useBusinessLeftSheet ? "left-sheet" : "auto"}
        leftSheetStackAboveNestedRight={stackBusinessLeftSheetAboveNestedDetails}
      >
        <EstablishmentForm
          onSaved={() => setOpenKey(null)}
          selectedArea={selectedArea}
        />
      </FormModal>

      <FormModal
        open={openKey === "business-householder"}
        onOpenChange={(open) => setOpenKey(open ? "business-householder" : null)}
        title="New Contact"
        headerClassName={useBusinessLeftSheet ? undefined : "text-center"}
        desktopPresentation={useBusinessLeftSheet ? "left-sheet" : "auto"}
        leftSheetStackAboveNestedRight={stackBusinessLeftSheetAboveNestedDetails}
      >
        <HouseholderForm
          establishments={fabEstablishmentsForForms}
          selectedEstablishmentId={fabSelectedEstId}
          onSaved={closeBusinessFabForm}
          disableEstablishmentSelect={fabLockEstablishment}
        />
      </FormModal>

      <FormModal
        open={openKey === "business-visit"}
        onOpenChange={(open) => setOpenKey(open ? "business-visit" : null)}
        title="New Call"
        headerClassName={useBusinessLeftSheet ? undefined : "text-center"}
        desktopPresentation={useBusinessLeftSheet ? "left-sheet" : "auto"}
        leftSheetStackAboveNestedRight={stackBusinessLeftSheetAboveNestedDetails}
      >
        <CallForm
          establishments={fabEstablishmentsForForms as EstablishmentWithDetails[]}
          selectedEstablishmentId={fabSelectedEstId}
          householderId={fabHouseholderId}
          householderName={fabHouseholderName}
          householderStatus={fabHouseholderStatus}
          onSaved={closeBusinessFabForm}
          disableEstablishmentSelect={fabLockEstablishment}
        />
      </FormModal>

      <FormModal
        open={openKey === "business-todo"}
        onOpenChange={(open) => setOpenKey(open ? "business-todo" : null)}
        title="New To-Do"
        headerClassName={useBusinessLeftSheet ? undefined : "text-center"}
        desktopPresentation={useBusinessLeftSheet ? "left-sheet" : "auto"}
        leftSheetStackAboveNestedRight={stackBusinessLeftSheetAboveNestedDetails}
        className="w-[min(100vw,48rem)] dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff] md:max-h-[100lvh]"
      >
        <TodoForm
          establishments={fabEstablishmentsForForms as Array<{ id?: string; name: string }>}
          selectedEstablishmentId={fabSelectedEstId}
          householderId={fabHouseholderId}
          householderName={fabHouseholderName}
          onSaved={closeBusinessFabForm}
          disableEstablishmentSelect={fabLockEstablishment}
        />
      </FormModal>

      <FormModal
        open={openKey === "business-bulk-todos"}
        onOpenChange={(open) => {
          setOpenKey(open ? "business-bulk-todos" : null);
        }}
        title={
          bulkTodoKind === "mixed"
            ? "Edit and New To-Dos"
            : bulkTodoKind === "edit"
              ? "Edit To-Dos"
              : "New To-Dos"
        }
        description={
          bulkTodoKind === "mixed"
            ? "Edit existing and create new to-dos in one submission."
            : bulkTodoKind === "edit"
              ? "Edit selected to-dos in one submission."
              : undefined
        }
        headerClassName={useBusinessLeftSheet ? undefined : "text-center"}
        desktopPresentation={useBusinessLeftSheet ? "right-sheet" : "auto"}
        className="w-[min(100vw,72rem)] dark:border-[#1c1921] dark:bg-[#181714] dark:text-[#fffaff] md:max-h-[100lvh]"
        drawerContentClassName="dark:border-[#1c1921] dark:bg-[#181714]"
        sheetBodyScrollClassName="md:overflow-hidden md:flex md:flex-col md:min-h-0"
        bodyClassName="md:flex-1 md:min-h-0 md:flex md:flex-col md:overflow-hidden md:pb-2"
        skipFabRootInert={openKey === "business-bulk-todos" && isTabletUp}
      >
        <BulkTodoForm
          establishments={establishments}
          householders={householders}
          onDraftKindChange={setBulkTodoKind}
          onSaved={() => {
            setOpenKey(null);
            setBulkTodoKind("new");
          }}
        />
      </FormModal>

      <FormModal
        open={openKey === "congregation-householder"}
        onOpenChange={(open) => setOpenKey(open ? "congregation-householder" : null)}
        title="New Householder"
        description="Add a personal householder with location"
        desktopPresentation="left-sheet"
        className="dark:border-[#1c1921] dark:bg-[#181714] md:max-h-[100lvh]"
        headerClassName="text-center"
        drawerContentClassName="!mt-10 min-h-[72dvh] max-h-[calc(100dvh-4px)]"
        bodyClassName="max-md:pb-[calc(max(env(safe-area-inset-bottom),0px)+112px)]"
      >
        <HouseholderForm
          establishments={[]}
          onSaved={() => setOpenKey(null)}
          context="congregation"
          publisherId={userId}
        />
      </FormModal>

      <FormModal
        open={openKey === "congregation-user"}
        onOpenChange={(open) => setOpenKey(open ? "congregation-user" : null)}
        title="Add Publisher"
        description="Add a user to this congregation."
        desktopPresentation="left-sheet"
        className="dark:border-[#1c1921] dark:bg-[#181714] md:max-h-[100lvh]"
        headerClassName="text-center"
        drawerContentClassName="!mt-10 min-h-[72dvh] max-h-[calc(100dvh-4px)]"
        bodyClassName="max-md:pb-[calc(max(env(safe-area-inset-bottom),0px)+112px)]"
      >
        {congregationId ? (
          <AddUserToCongregationForm
            congregationId={congregationId}
            onUserAdded={() => {
              try {
                window.dispatchEvent(new CustomEvent("congregation-refresh"));
              } catch {}
              setOpenKey(null);
            }}
            onClose={() => setOpenKey(null)}
          />
        ) : null}
      </FormModal>

      <FormModal
        open={openKey === "congregation-visit"}
        onOpenChange={(open) => setOpenKey(open ? "congregation-visit" : null)}
        title="New Call"
        headerClassName="text-center"
      >
        <CallForm
          establishments={[]}
          selectedEstablishmentId="none"
          disableEstablishmentSelect
          householderId={congregationSelectedHouseholder?.id}
          householderName={congregationSelectedHouseholder?.name}
          householderStatus={congregationSelectedHouseholder?.status}
          onSaved={() => setOpenKey(null)}
        />
      </FormModal>

      {congregationId ? (
        <EventScheduleFormSheet
          open={openKey === "congregation-schedule"}
          onOpenChange={(open) => setOpenKey(open ? "congregation-schedule" : null)}
          congregationId={congregationId}
          initialData={null}
          onSaved={() => {
            try {
              window.dispatchEvent(new CustomEvent("event-schedule-refresh"));
            } catch {}
            setOpenKey(null);
          }}
        />
      ) : null}

      <FormModal
        open={openKey === "field-service"}
        onOpenChange={(open) => setOpenKey(open ? "field-service" : null)}
        title=""
        headerClassName="sr-only"
      >
        <FieldServiceForm
          userId={userId}
          onClose={() => setOpenKey(null)}
          isOpen={openKey === "field-service"}
        />
      </FormModal>
    </>
  );
}
