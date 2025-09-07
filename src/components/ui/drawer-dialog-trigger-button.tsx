"use client";

import * as React from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Portal as RadixPortal } from "@radix-ui/react-portal";
import { useSPA } from "@/components/SPAProvider";
import { DrawerDialog } from "@/components/ui/drawer-dialog";
import { FilePlus2, Plus, X, Building2, UserPlus } from "lucide-react";
import { FieldServiceForm } from "@/components/fieldservice/FieldServiceForm";
import { EstablishmentForm } from "@/components/business/EstablishmentForm";
import { HouseholderForm } from "@/components/business/HouseholderForm";
import { VisitForm } from "@/components/business/VisitForm";
import { isBusinessEnabled, isBusinessParticipant, listEstablishments } from "@/lib/db/business";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export interface DrawerDialogTriggerButtonProps extends React.ComponentProps<typeof Button> {
  label?: string;
  icon?: React.ReactNode;
  /**
   * When true, the trigger button will render. Useful to disable on some screens.
   */
  show?: boolean;
  /** Optional override for mode; otherwise inferred from SPA section */
  mode?: "home" | "business" | "hidden";
  selectedArea?: string;
  selectedEstablishmentId?: string;
}

export function DrawerDialogTriggerButton({
  label = "Open",
  icon,
  show = true,
  className,
  size = "lg",
  mode,
  selectedArea,
  selectedEstablishmentId,
  ...buttonProps
}: DrawerDialogTriggerButtonProps) {
  const { currentSection } = useSPA();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const effectiveMode = mode ?? (currentSection === "business" ? "business" : currentSection === "home" ? "home" : "hidden");
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const [userId, setUserId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (effectiveMode !== "home") return;
    (async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { session } } = await supabase.auth.getSession();
        setUserId(session?.user?.id ?? null);
      } catch {}
    })();
  }, [effectiveMode]);

  // Business capabilities
  const [enabled, setEnabled] = React.useState(false);
  const [participant, setParticipant] = React.useState(false);
  const [establishments, setEstablishments] = React.useState<any[]>([]);
  React.useEffect(() => {
    if (effectiveMode !== "business") return;
    (async () => {
      setEnabled(await isBusinessEnabled());
      setParticipant(await isBusinessParticipant());
      setEstablishments(await listEstablishments());
    })();
  }, [effectiveMode]);

  if (!show || effectiveMode === "hidden" || !mounted) return null;

  return (
    <RadixPortal container={document.body}>
      {effectiveMode === "home" ? (
        <HomeTrigger
          label={label}
          icon={icon ?? <FilePlus2 className="h-6 w-6" />}
          className={className}
          size={size}
          userId={userId}
        />
      ) : (
        <BusinessTrigger
          canUse={enabled && participant}
          className={className}
          size={size}
          establishments={establishments}
          selectedArea={selectedArea}
          selectedEstablishmentId={selectedEstablishmentId}
        />
      )}
    </RadixPortal>
  );
}

function HomeTrigger({ label, icon, className, size, userId }: { label: string; icon: React.ReactNode; className?: string; size?: any; userId: string | null }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button
        aria-label={label}
        title={label}
        className={`fixed right-4 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] md:right-6 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation ${className || ""}`}
        size={size}
        onClick={() => setOpen(true)}
      >
        {icon}
      </Button>
      <DrawerDialog
        title="Field Service"
        description="Record your ministry activity."
        showTrigger={false}
        open={open}
        onOpenChange={setOpen}
      >
        <div className="p-4 pt-0 flex-1 min-h-0 overflow-y-auto ios-touch">
          {userId && <FieldServiceForm userId={userId} />}
        </div>
      </DrawerDialog>
    </>
  );
}

function BusinessTrigger({ canUse, className, size, establishments, selectedArea, selectedEstablishmentId }: {
  canUse: boolean;
  className?: string;
  size?: any;
  establishments: any[];
  selectedArea?: string;
  selectedEstablishmentId?: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const [open, setOpen] = React.useState<null | "est" | "hh" | "visit">(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (event: PointerEvent) => {
      const root = containerRef.current;
      if (!root) return;
      const target = event.target as Node | null;
      if (target && !root.contains(target)) setExpanded(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", handlePointerDown, { capture: true } as any);
  }, [expanded]);

  if (!canUse) return null;

  return (
    <div ref={containerRef}>
      <Button
        onClick={() => setExpanded(!expanded)}
        className={`fixed right-4 z-40 h-14 w-14 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation md:right-6 bottom-[calc(max(env(safe-area-inset-bottom),0px)+80px)] ${expanded ? "rotate-90" : ""}`}
        size={size}
      >
        {expanded ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </Button>
      <div className={`fixed right-4 z-40 flex flex-col gap-2 transition-all duration-300 ease-out items-end bottom-[calc(max(env(safe-area-inset-bottom),0px)+144px)] md:right-6 ${expanded ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        <Button variant="outline" className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95" onClick={() => setOpen("est")}>
          <Building2 className="h-4 w-4 mr-2" />
          Establishment
        </Button>
        <Button variant="outline" className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95" onClick={() => setOpen("hh")}>
          <UserPlus className="h-4 w-4 mr-2" />
          Householder
        </Button>
        <Button variant="default" className="rounded-full shadow-lg transition-all duration-200 hover:scale-105 active:scale-95" onClick={() => setOpen("visit")}>
          <FilePlus2 className="h-4 w-4 mr-2" />
          Visit
        </Button>
      </div>

      {/* Drawers */}
      <DrawerDialog
        title="New Establishment"
        description="Add a business establishment"
        showTrigger={false}
        open={open === "est"}
        onOpenChange={(o) => setOpen(o ? "est" : null)}
      >
        <div className="p-4 pt-0">
          <EstablishmentForm
            selectedArea={selectedArea}
            onSaved={() => setOpen(null)}
          />
        </div>
      </DrawerDialog>
      <DrawerDialog
        title="New Householder"
        description="Add a householder for an establishment"
        showTrigger={false}
        open={open === "hh"}
        onOpenChange={(o) => setOpen(o ? "hh" : null)}
      >
        <div className="p-4 pt-0">
          <HouseholderForm establishments={establishments} selectedEstablishmentId={selectedEstablishmentId} onSaved={() => setOpen(null)} />
        </div>
      </DrawerDialog>
      <DrawerDialog
        title="Visit Update"
        description="Record a visit note"
        showTrigger={false}
        open={open === "visit"}
        onOpenChange={(o) => setOpen(o ? "visit" : null)}
      >
        <div className="p-4 pt-0">
          <VisitForm establishments={establishments} selectedEstablishmentId={selectedEstablishmentId} onSaved={() => setOpen(null)} />
        </div>
      </DrawerDialog>
    </div>
  );
}

export default DrawerDialogTriggerButton;


