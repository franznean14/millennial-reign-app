"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Portal as RadixPortal } from "@radix-ui/react-portal";
import { Button, type ButtonProps } from "@/components/ui/button";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";

interface FabAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: ButtonProps["variant"];
}

interface FabMenuProps {
  label: string;
  actions: FabAction[];
  mainIcon: ReactNode;
  mainIconOpen?: ReactNode;
  mainClassName?: string;
  actionClassName?: string;
  actionOffsetStart?: number;
  actionOffsetStep?: number;
  portalContainerId?: string;
}

export function FabMenu({
  label,
  actions,
  mainIcon,
  mainIconOpen,
  mainClassName,
  actionClassName,
  actionOffsetStart = 144,
  actionOffsetStep = 52,
  portalContainerId = "fab-root"
}: FabMenuProps) {
  const [expanded, setExpanded] = useState(false);
  const menuId = useId();

  useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(`[data-fab-menu="${menuId}"]`)) return;
      setExpanded(false);
    };
    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", handlePointerDown, { capture: true } as any);
  }, [expanded, menuId]);

  if (actions.length === 0) return null;

  return (
    <>
      <RadixPortal
        container={typeof document !== "undefined" ? document.getElementById(portalContainerId) : undefined}
      >
        <FloatingActionButton
          onClick={() => setExpanded((prev) => !prev)}
          label={label}
          size="lg"
          className={`${expanded ? "rotate-90" : ""} ${mainClassName ?? ""}`.trim()}
          data-fab-menu={menuId}
        >
          {expanded ? mainIconOpen ?? mainIcon : mainIcon}
        </FloatingActionButton>
      </RadixPortal>
      {actions.map((action, index) => (
        <RadixPortal
          key={action.label}
          container={typeof document !== "undefined" ? document.getElementById(portalContainerId) : undefined}
        >
          <Button
            variant={action.variant ?? "default"}
            className={`fixed right-4 z-40 rounded-full shadow-lg md:right-6 ${actionClassName ?? ""}`.trim()}
            style={{
              bottom: `calc(max(env(safe-area-inset-bottom),0px) + ${actionOffsetStart + actionOffsetStep * index}px)`,
              opacity: expanded ? 1 : 0,
              transform: expanded ? "translateY(0) scale(1)" : "translateY(8px) scale(0.95)",
              transition: "transform 180ms ease, opacity 180ms ease",
              transitionDelay: `${index * 50}ms`,
              willChange: "transform, opacity",
              pointerEvents: expanded ? "auto" : "none"
            }}
            onClick={() => {
              action.onClick();
              setExpanded(false);
            }}
            data-fab-menu={menuId}
          >
            <span className="flex items-center">
              {action.icon ? <span className="mr-2">{action.icon}</span> : null}
              {action.label}
            </span>
          </Button>
        </RadixPortal>
      ))}
    </>
  );
}
