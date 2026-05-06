"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Portal as RadixPortal } from "@radix-ui/react-portal";
import { ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { cn } from "@/lib/utils";

interface FabAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
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
  /** Tablet bulk to-do right sheet open: dock FAB and use {@link tabletDockedActions} when expanded. */
  tabletDockedToBulkTodoSheet?: boolean;
  /**
   * When {@link tabletDockedToBulkTodoSheet} is true, expanded menu shows these actions (vertical stack)
   * instead of {@link actions}.
   */
  tabletDockedActions?: FabAction[];
}

export function FabMenu({
  label,
  actions,
  mainIcon,
  mainIconOpen,
  mainClassName,
  actionClassName,
  actionOffsetStart = 150,
  actionOffsetStep = 62,
  portalContainerId = "fab-root",
  tabletDockedToBulkTodoSheet = false,
  tabletDockedActions,
}: FabMenuProps) {
  const [expanded, setExpanded] = useState(false);
  const [renderActions, setRenderActions] = useState(false);
  const [actionPositions, setActionPositions] = useState<Array<{ x: number; y: number }>>([]);
  const actionButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openFrameRef = useRef<number | null>(null);
  const menuId = useId();
  const dockedActionLabelsKey = (tabletDockedActions ?? []).map((a) => a.label).join("|");
  const actionLabelsKey = `${actions.map((action) => action.label).join("|")}|${tabletDockedToBulkTodoSheet ? dockedActionLabelsKey : ""}`;

  const clearPendingAnimation = useCallback(() => {
    if (unmountTimerRef.current) {
      clearTimeout(unmountTimerRef.current);
      unmountTimerRef.current = null;
    }
    if (openFrameRef.current !== null) {
      cancelAnimationFrame(openFrameRef.current);
      openFrameRef.current = null;
    }
  }, []);

  const openMenu = useCallback(() => {
    clearPendingAnimation();
    setRenderActions(true);
    openFrameRef.current = requestAnimationFrame(() => {
      openFrameRef.current = null;
      setExpanded(true);
    });
  }, [clearPendingAnimation]);

  const closeMenu = useCallback(() => {
    clearPendingAnimation();
    setExpanded(false);
    unmountTimerRef.current = setTimeout(() => {
      setRenderActions(false);
      unmountTimerRef.current = null;
    }, 340);
  }, [clearPendingAnimation]);

  useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest(`[data-fab-menu="${menuId}"]`)) return;
      closeMenu();
    };
    document.addEventListener("pointerdown", handlePointerDown, { capture: true });
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [closeMenu, expanded, menuId]);

  useEffect(() => clearPendingAnimation, [clearPendingAnimation]);

  useEffect(() => {
    closeMenu();
  }, [tabletDockedToBulkTodoSheet, closeMenu]);

  useLayoutEffect(() => {
    if (!renderActions || tabletDockedToBulkTodoSheet) return;

    const buttonGap = actions.length === 3 ? 18 : 28;
    const widths = actions.map((action, index) => {
      return actionButtonRefs.current[index]?.offsetWidth ?? Math.max(150, action.label.length * 11 + 72);
    });
    const totalWidth = widths.reduce((total, width) => total + width, 0) + buttonGap * Math.max(0, widths.length - 1);
    let cursor = -totalWidth / 2;

    setActionPositions(
      widths.map((width, index) => {
        const x = cursor + width / 2;
        cursor += width + buttonGap;

        return {
          x,
          y: actions.length === 3 && index === 1 ? -22 : 0,
        };
      })
    );
  }, [actionLabelsKey, actions, renderActions, tabletDockedToBulkTodoSheet]);

  const DOCKED_STEP_PX = 52;

  const dockedBulkMenuPositionClass =
    "left-auto right-[min(100vw,72rem)] max-w-[min(22rem,calc(100vw-min(100vw,72rem)-5rem))] justify-start";

  if (actions.length === 0) return null;

  return (
    <>
      <RadixPortal
        container={typeof document !== "undefined" ? document.getElementById(portalContainerId) : undefined}
      >
        <FloatingActionButton
          onClick={() => {
            if (expanded) {
              closeMenu();
            } else {
              openMenu();
            }
          }}
          label={label}
          size="lg"
          className={`${mainClassName ?? ""}`.trim()}
          data-fab-menu={menuId}
          {...(tabletDockedToBulkTodoSheet ? { "data-bulk-todo-sheet-fab": "" as const } : {})}
        >
          {tabletDockedToBulkTodoSheet ? (
            expanded ? (
              <X className="size-6 md:h-8 md:w-8" />
            ) : (
              <ChevronUp className="size-6 md:h-8 md:w-8" strokeWidth={2.75} />
            )
          ) : expanded ? (
            mainIconOpen ?? mainIcon
          ) : (
            mainIcon
          )}
        </FloatingActionButton>
      </RadixPortal>
      {renderActions && !tabletDockedToBulkTodoSheet &&
        actions.map((action, index) => {
        const fallbackSpacing = actions.length === 3 ? 185 : 240;
        const fallbackX = (index - (actions.length - 1) / 2) * fallbackSpacing;
        const position = actionPositions[index] ?? {
          x: fallbackX,
          y: actions.length === 3 && index === 1 ? -22 : 0,
        };

        return (
        <RadixPortal
          key={action.label}
          container={typeof document !== "undefined" ? document.getElementById(portalContainerId) : undefined}
        >
          <Button
            ref={(node) => {
              actionButtonRefs.current[index] = node;
            }}
            variant={action.variant ?? "default"}
            className={cn(
              "pointer-events-auto fixed right-4 z-40 rounded-full shadow-lg md:right-6 md:z-10 text-xl font-semibold px-6 py-6 dark:border-[#1c1921] dark:bg-[#30283c] dark:text-[#fffaff] dark:hover:bg-[#3b3348] dark:data-[state=open]:bg-[#3b3348] md:[--fab-action-effective-row-x:var(--fab-action-row-x)] md:[--fab-action-effective-arc-y:var(--fab-action-arc-y)]",
              action.variant !== "outline" && "dark:!bg-[#80778e] dark:!text-white dark:hover:!bg-[#8c839a]",
              actionClassName
            )}
            style={{
              ["--fab-action-row-x" as string]: `${position.x}px`,
              ["--fab-action-arc-y" as string]: `${position.y}px`,
              bottom: `calc(max(env(safe-area-inset-bottom),0px) + var(--fab-action-offset-start, ${actionOffsetStart}px) + var(--fab-action-offset-step, ${actionOffsetStep * index}px))`,
              opacity: expanded ? 1 : 0,
              transform: expanded
                ? "translate3d(calc(var(--fab-action-x, 0px) + var(--fab-action-effective-row-x, 0px)), calc(var(--fab-action-open-y, 0px) + var(--fab-action-effective-arc-y, 0px)), 0px) scale(1)"
                : "translate3d(var(--fab-action-x, 0px), var(--fab-action-closed-y, 8px), 0px) scale(0.92)",
              transition: "transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 180ms ease",
              transitionDelay: `${index * 50}ms`,
              willChange: "transform, opacity",
              pointerEvents: expanded ? "auto" : "none"
            }}
            onClick={() => {
              action.onClick();
              closeMenu();
            }}
            data-fab-menu={menuId}
          >
            <span className="flex items-center">
              {action.icon ? <span className="mr-3 [&_svg]:h-7 [&_svg]:w-7">{action.icon}</span> : null}
              {action.label}
            </span>
          </Button>
        </RadixPortal>
        );
      })}
      {renderActions && tabletDockedToBulkTodoSheet && (tabletDockedActions?.length ?? 0) > 0
        ? (tabletDockedActions ?? []).map((action, index) => (
            <RadixPortal
              key={`docked-${action.label}`}
              container={typeof document !== "undefined" ? document.getElementById(portalContainerId) : undefined}
            >
              <Button
                variant={action.className ? "default" : (action.variant ?? "default")}
                className={cn(
                  action.className
                    ? cn(
                        "pointer-events-auto fixed z-[145] rounded-full px-5 py-3.5 text-left text-base font-semibold shadow-lg md:px-6 md:py-4 md:text-lg",
                        dockedBulkMenuPositionClass,
                        action.className
                      )
                    : cn(
                        "pointer-events-auto fixed z-[145] rounded-full px-5 py-3.5 text-left text-base font-semibold shadow-lg md:px-6 md:py-4 md:text-lg",
                        dockedBulkMenuPositionClass,
                        "dark:border-[#1c1921] dark:bg-[#30283c] dark:text-[#fffaff] dark:hover:bg-[#3b3348]",
                        (action.variant ?? "default") !== "outline" &&
                          (action.variant ?? "default") !== "destructive" &&
                          "dark:!bg-[#80778e] dark:!text-white dark:hover:!bg-[#8c839a]",
                        (action.variant ?? "default") === "outline" &&
                          "border-red-500/40 bg-transparent text-red-400 hover:bg-red-500/10 hover:text-red-300 dark:border-red-500/50 dark:bg-transparent dark:text-red-400",
                        (action.variant ?? "default") === "destructive" &&
                          "border-red-600/50 bg-red-600 text-white hover:bg-red-700 dark:bg-red-900/90 dark:text-red-50 dark:hover:bg-red-800/90"
                      )
                )}
                style={{
                  bottom: `calc(max(env(safe-area-inset-bottom),0px) + 28px + 4.75rem + 6px + ${index * DOCKED_STEP_PX}px)`,
                  opacity: expanded ? 1 : 0,
                  transform: expanded
                    ? "translate3d(0, 0, 0) scale(1)"
                    : "translate3d(0, 12px, 0) scale(0.92)",
                  transition: "transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 180ms ease",
                  transitionDelay: `${index * 28}ms`,
                  willChange: "transform, opacity",
                  pointerEvents: expanded ? "auto" : "none",
                }}
                onClick={() => {
                  action.onClick();
                  closeMenu();
                }}
                data-fab-menu={menuId}
                data-bulk-todo-sheet-fab=""
              >
                <span className="flex min-w-0 items-center">
                  {action.icon ? (
                    <span className="mr-3 shrink-0 [&_svg]:h-6 [&_svg]:w-6 md:[&_svg]:h-7 md:[&_svg]:w-7">
                      {action.icon}
                    </span>
                  ) : null}
                  <span className="min-w-0 truncate">{action.label}</span>
                </span>
              </Button>
            </RadixPortal>
          ))
        : null}
    </>
  );
}
