"use client";

import { useEffect, useMemo, useState, type ReactElement } from "react";
import { FormModal } from "@/components/shared/FormModal";
import { FabMenu } from "@/components/shared/FabMenu";
import { EstablishmentForm } from "@/components/business/EstablishmentForm";
import { HouseholderForm } from "@/components/business/HouseholderForm";
import { VisitForm } from "@/components/business/VisitForm";
import { TodoForm } from "@/components/business/TodoForm";
import { BulkTodoForm } from "@/components/business/BulkTodoForm";
import FieldServiceForm from "@/components/fieldservice/FieldServiceForm";
import { EventScheduleForm } from "@/components/congregation/EventScheduleForm";
import { AddUserToCongregationForm } from "@/components/congregation/AddUserToCongregationForm";
import { Plus, X, UserPlus, FilePlus2, Building2, Calendar, ListTodo } from "lucide-react";
import type { EstablishmentWithDetails, HouseholderWithDetails } from "@/lib/db/business";
import { useHomeTodoDetailsFabOptional } from "@/components/home/home-todo-details-fab-context";

type BusinessTab = "establishments" | "householders" | "map";
type CongregationTab = "meetings" | "ministry" | "admin";

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
  const showVisitForm = !!selectedEstablishment || !!selectedHouseholder;

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
      } else if (showVisitForm) {
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
    showVisitForm
  ]);

  if (actions.length === 0) return null;

  const mainIcon = actions.length === 1 ? actions[0].icon : <Plus className="size-6" />;
  const mainIconOpen = actions.length === 1 ? actions[0].icon : <X className="size-6" />;

  return (
    <>
      <FabMenu
        label="Actions"
        mainIcon={mainIcon}
        mainIconOpen={mainIconOpen}
        mainClassName="bg-primary text-primary-foreground md:h-[4.75rem] md:w-[4.75rem] md:[&_svg]:h-8 md:[&_svg]:w-8 md:!left-1/2 md:!right-auto md:!-translate-x-1/2 md:!bottom-[calc(max(env(safe-area-inset-bottom),0px)+28px)] dark:!bg-[#80778e] dark:!text-white dark:hover:!bg-[#8c839a]"
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
        headerClassName="text-center"
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
        description="Add a contact for an establishment."
        headerClassName={homeDetailsFab ? undefined : "text-center"}
        desktopPresentation={homeDetailsFab ? "left-sheet" : "auto"}
        leftSheetStackAboveNestedRight={homeDetailsFab?.stackLeftFormAboveNestedDetails ?? false}
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
        headerClassName={homeDetailsFab ? undefined : "text-center"}
        desktopPresentation={homeDetailsFab ? "left-sheet" : "auto"}
        leftSheetStackAboveNestedRight={homeDetailsFab?.stackLeftFormAboveNestedDetails ?? false}
      >
        <VisitForm
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
        headerClassName={homeDetailsFab ? undefined : "text-center"}
        desktopPresentation={homeDetailsFab ? "left-sheet" : "auto"}
        leftSheetStackAboveNestedRight={homeDetailsFab?.stackLeftFormAboveNestedDetails ?? false}
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
              : "Create multiple to-dos in one submission."
        }
        headerClassName="text-center"
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
        headerClassName="text-center"
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
        headerClassName="text-center"
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
        <VisitForm
          establishments={[]}
          selectedEstablishmentId="none"
          disableEstablishmentSelect
          householderId={congregationSelectedHouseholder?.id}
          householderName={congregationSelectedHouseholder?.name}
          householderStatus={congregationSelectedHouseholder?.status}
          onSaved={() => setOpenKey(null)}
        />
      </FormModal>

      <FormModal
        open={openKey === "congregation-schedule"}
        onOpenChange={(open) => setOpenKey(open ? "congregation-schedule" : null)}
        title="New Event Schedule"
        description="Create a new event schedule"
        headerClassName="text-center"
      >
        {congregationId ? (
          <EventScheduleForm
            congregationId={congregationId}
            onSaved={() => {
              try {
                window.dispatchEvent(new CustomEvent("event-schedule-refresh"));
              } catch {}
              setOpenKey(null);
            }}
          />
        ) : null}
      </FormModal>

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
