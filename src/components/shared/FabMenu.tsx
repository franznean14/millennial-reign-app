"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import { Portal as RadixPortal } from "@radix-ui/react-portal";
import { ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  /**
   * Matches bulk tablet sheet width `min(100vw, N rem)` so FAB and dock actions align with the drawer edge.
   */
  tabletDockedSheetMaxWidthRem?: number;
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
  tabletDockedSheetMaxWidthRem = 72,
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

  /** Icon actions stack upward from anchor; matches ~h-11 + gap. */
  const DOCKED_ICON_STEP_PX = 54;

  if (actions.length === 0) return null;

  /** Match drawer width from viewport right; FAB sits slightly left of the sheet (outside its left edge). */
  const sheetRem = tabletDockedSheetMaxWidthRem;
  const dockFabRightExpr = `min(100vw, ${sheetRem}rem) + max(12px,env(safe-area-inset-right,0px))`;

  /** FAB uses md:w-[4.75rem]; dock icons md:size-12 (3rem). Same `right` pins right edges; add to `right` so vertical stack centers match the wider FAB. */
  const DOCK_ICON_CENTER_NUDGE_CSS = `(4.75rem - 3rem) / 2`;

  const dockedMainFabStyle: CSSProperties | undefined = tabletDockedToBulkTodoSheet
    ? {
        left: "auto",
        right: `calc(${dockFabRightExpr})`,
        bottom: `calc(max(env(safe-area-inset-bottom),0px) + 28px)`,
        zIndex: 145,
      }
    : undefined;

  /** Horizontally aligns stack with FAB (narrower squares vs wide circle). */
  const dockedIconActionsRightCss = tabletDockedToBulkTodoSheet
    ? `calc(${dockFabRightExpr} + ${DOCK_ICON_CENTER_NUDGE_CSS})`
    : "";

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
          omitDefaultHorizontalAnchor={tabletDockedToBulkTodoSheet}
          style={dockedMainFabStyle}
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
        const actionVariant = action.variant ?? "default";
        const isOutlineAction = actionVariant === "outline";

        return (
        <RadixPortal
          key={action.label}
          container={typeof document !== "undefined" ? document.getElementById(portalContainerId) : undefined}
        >
          <Button
            ref={(node) => {
              actionButtonRefs.current[index] = node;
            }}
            variant={actionVariant}
            className={cn(
              "pointer-events-auto fixed right-4 z-40 rounded-full shadow-lg md:right-6 md:z-10 text-xl font-semibold px-6 py-6 md:[--fab-action-effective-row-x:var(--fab-action-row-x)] md:[--fab-action-effective-arc-y:var(--fab-action-arc-y)]",
              isOutlineAction
                ? "border border-border bg-background text-foreground hover:bg-accent dark:border-[#1c1921] dark:bg-[#30283c] dark:text-[#fffaff] dark:hover:bg-[#3b3348]"
                : "!border-0 !bg-primary !text-primary-foreground hover:!bg-primary/90 [&_svg]:text-primary-foreground dark:!bg-[#80778e] dark:!text-white dark:hover:!bg-[#8c839a] dark:[&_svg]:text-white",
              action.className,
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
        ? (tabletDockedActions ?? []).map((action, index) => {
            const variantResolved =
              action.variant === "destructive" || action.label === "Delete All" ? "destructive" : "outline";

            return (
            <RadixPortal
              key={`docked-${action.label}`}
              container={typeof document !== "undefined" ? document.getElementById(portalContainerId) : undefined}
            >
              <Tooltip delayDuration={400}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant={variantResolved}
                    size="icon"
                    aria-label={action.label}
                    className={cn(
                      "pointer-events-auto fixed z-[145] size-11 rounded-xl shadow-lg md:size-12",
                      "touch-manipulation border md:rounded-[0.875rem]",
                      action.className
                        ? cn(
                            "border-border dark:border-[#1c1921]",
                            action.className
                          )
                        : variantResolved === "destructive"
                          ? "dark:border-red-900/70"
                          : cn(
                              "border-[#e2dde8] bg-[#ffffff] text-[#1a1820] hover:bg-[#ece8f2]",
                              "dark:border-[#2e2933] dark:bg-[#332d39] dark:text-[#fffaff] dark:hover:bg-[#403948]"
                            )
                    )}
                    style={{
                      left: "auto",
                      right: dockedIconActionsRightCss,
                      bottom: `calc(max(env(safe-area-inset-bottom),0px) + 28px + 4.75rem + 10px + ${index * DOCKED_ICON_STEP_PX}px)`,
                      opacity: expanded ? 1 : 0,
                      transform: expanded
                        ? "translate3d(0, 0, 0) scale(1)"
                        : "translate3d(0, 14px, 0) scale(0.88)",
                      transition: "transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 180ms ease",
                      transitionDelay: `${index * 22}ms`,
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
                    {action.icon ? (
                      <span className="[&_svg]:size-[1.15rem] md:[&_svg]:size-[1.35rem]">{action.icon}</span>
                    ) : null}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10} align="center" className="text-xs border-border dark:border-[#1c1921] dark:bg-[#fdf8f4] dark:text-[#231f29]">
                  {action.label}
                </TooltipContent>
              </Tooltip>
            </RadixPortal>
            );
          })
        : null}
    </>
  );
}
