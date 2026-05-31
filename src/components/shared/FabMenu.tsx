"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Portal as RadixPortal } from "@radix-ui/react-portal";
import { ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloatingActionButton } from "@/components/shared/FloatingActionButton";
import { useMediaQuery } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import {
  resolveFabMenuActionSurface,
  studyBibleDarkClasses,
} from "@/lib/theme/study-bible-dark";
import { FAB_CHROME_Z, FAB_CHROME_Z_CLASS } from "@/lib/theme/drawer-stack-z-index";

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
  /** Bulk to-do sheet open: dock FAB and use {@link tabletDockedActions} when expanded. */
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
  /** Phone bottom sheet vs tablet right sheet positioning for bulk docked FAB. */
  bulkTodoSheetDockedLayout?: "tablet" | "mobile";
}

const FAB_LABELED_STEP_PX = 56;
const FAB_STACK_GAP_ABOVE_MAIN_PX = 10;
const FAB_MAIN_HEIGHT_MOBILE = "3.5rem";
const FAB_MAIN_HEIGHT_TABLET_DOCK = "4.75rem";
const FAB_MOBILE_BOTTOM_CSS = "calc(max(env(safe-area-inset-bottom),0px) + 80px)";
const FAB_TABLET_DOCK_BOTTOM_CSS = "calc(max(env(safe-area-inset-bottom),0px) + 28px)";
/** iPad / tablet: center main FAB in bottom nav notch (matches UnifiedFab). */
const FAB_TABLET_BOTTOM_NAV_MAIN = cn(
  "md:h-[4.75rem] md:w-[4.75rem] md:[&_svg]:h-8 md:[&_svg]:w-8",
  "md:!bottom-[calc(max(env(safe-area-inset-bottom),0px)+28px)]",
  "md:transition-[left,transform] md:duration-300 md:ease-[cubic-bezier(0.34,1.2,0.64,1)]",
  "md:!left-1/2 md:!-translate-x-1/2 md:!z-40 md:!right-auto"
);
const FAB_TABLET_BOTTOM_NAV_ACTIONS =
  "md:!left-1/2 md:!right-auto md:[--fab-action-x:-50%] md:[--fab-action-offset-step:0px] md:[--fab-action-closed-y:72px]";

function FabActionLabel({ action }: { action: FabAction }) {
  return (
    <span className="flex w-full items-center justify-end gap-2.5">
      {action.icon ? <span className="shrink-0 [&_svg]:size-5">{action.icon}</span> : null}
      <span className="truncate text-left">{action.label}</span>
    </span>
  );
}

export function FabMenu({
  label,
  actions,
  mainIcon,
  mainIconOpen,
  mainClassName,
  actionClassName,
  actionOffsetStart = 112,
  actionOffsetStep = 56,
  portalContainerId = "fab-root",
  tabletDockedToBulkTodoSheet = false,
  tabletDockedActions,
  tabletDockedSheetMaxWidthRem = 72,
  bulkTodoSheetDockedLayout = "tablet",
}: FabMenuProps) {
  const isPhone = useMediaQuery("(max-width: 767px)");
  const [expanded, setExpanded] = useState(false);
  const [renderActions, setRenderActions] = useState(false);
  const [actionPositions, setActionPositions] = useState<Array<{ x: number; y: number }>>([]);
  const actionButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openFrameRef = useRef<number | null>(null);
  const menuId = useId();

  const isMobileBulkDock =
    tabletDockedToBulkTodoSheet && bulkTodoSheetDockedLayout === "mobile";
  const useStackedLabeledActions =
    isMobileBulkDock || tabletDockedToBulkTodoSheet || (!tabletDockedToBulkTodoSheet && isPhone);
  const stackedActions = tabletDockedToBulkTodoSheet ? (tabletDockedActions ?? []) : actions;

  const dockedActionLabelsKey = (tabletDockedActions ?? []).map((a) => a.label).join("|");
  const actionLabelsKey = `${actions.map((action) => action.label).join("|")}|${tabletDockedToBulkTodoSheet ? dockedActionLabelsKey : ""}|${useStackedLabeledActions ? "stack" : "arc"}`;

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
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [closeMenu, expanded, menuId]);

  useEffect(() => clearPendingAnimation, [clearPendingAnimation]);

  useEffect(() => {
    closeMenu();
  }, [tabletDockedToBulkTodoSheet, closeMenu]);

  useLayoutEffect(() => {
    if (!renderActions || useStackedLabeledActions) return;

    const buttonGap = 20;
    const widths = actions.map((_, index) => {
      return actionButtonRefs.current[index]?.offsetWidth ?? 160;
    });
    const totalWidth = widths.reduce((total, width) => total + width, 0) + buttonGap * Math.max(0, widths.length - 1);
    let cursor = -totalWidth / 2;

    setActionPositions(
      widths.map((width) => {
        const x = cursor + width / 2;
        cursor += width + buttonGap;
        return { x, y: 0 };
      })
    );
  }, [actionLabelsKey, actions, renderActions, useStackedLabeledActions]);

  const hasDockedBulkActions =
    tabletDockedToBulkTodoSheet && (tabletDockedActions?.length ?? 0) > 0;
  const hasStandardActions = actions.length > 0;
  if (!hasStandardActions && !hasDockedBulkActions) return null;

  /** Bulk sheet dock (tablet right edge) keeps legacy side FAB; everything else centers on md+. */
  const useTabletBottomNavCenter = !tabletDockedToBulkTodoSheet;

  const sheetRem = tabletDockedSheetMaxWidthRem;
  const dockFabRightExpr = `min(100vw, ${sheetRem}rem) + max(12px,env(safe-area-inset-right,0px))`;
  const DOCK_ICON_CENTER_NUDGE_CSS = `(4.75rem - 3rem) / 2`;

  const dockedMainFabHeightCss = isMobileBulkDock ? FAB_MAIN_HEIGHT_MOBILE : FAB_MAIN_HEIGHT_TABLET_DOCK;

  const dockedMainFabStyle: CSSProperties | undefined = tabletDockedToBulkTodoSheet
    ? isMobileBulkDock
      ? { zIndex: FAB_CHROME_Z }
      : {
          left: "auto",
          right: `calc(${dockFabRightExpr})`,
          bottom: FAB_TABLET_DOCK_BOTTOM_CSS,
          zIndex: FAB_CHROME_Z,
        }
    : undefined;

  const stackedActionsRightCss = tabletDockedToBulkTodoSheet
    ? isMobileBulkDock
      ? "max(1rem, env(safe-area-inset-right, 0px))"
      : `calc(${dockFabRightExpr} + ${DOCK_ICON_CENTER_NUDGE_CSS})`
    : "max(1rem, env(safe-area-inset-right, 0px))";

  const stackedActionsBottomBaseCss = tabletDockedToBulkTodoSheet
    ? isMobileBulkDock
      ? FAB_MOBILE_BOTTOM_CSS
      : FAB_TABLET_DOCK_BOTTOM_CSS
    : FAB_MOBILE_BOTTOM_CSS;

  const stackedMainFabHeightCss = tabletDockedToBulkTodoSheet
    ? dockedMainFabHeightCss
    : FAB_MAIN_HEIGHT_MOBILE;

  const renderStackedLabeledAction = (action: FabAction, index: number, keyPrefix: string) => {
    const motionStyle: CSSProperties = {
      left: "auto",
      right: stackedActionsRightCss,
      bottom: `calc(${stackedActionsBottomBaseCss} + ${stackedMainFabHeightCss} + ${FAB_STACK_GAP_ABOVE_MAIN_PX}px + ${index * FAB_LABELED_STEP_PX}px)`,
      opacity: expanded ? 1 : 0,
      transform: expanded ? "translate3d(0, 0, 0) scale(1)" : "translate3d(0, 14px, 0) scale(0.88)",
      transition: "transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 180ms ease",
      transitionDelay: `${index * 22}ms`,
      willChange: "transform, opacity",
      pointerEvents: expanded ? "auto" : "none",
    };

    return (
      <RadixPortal
        key={`${keyPrefix}-${action.label}`}
        container={typeof document !== "undefined" ? document.getElementById(portalContainerId) : undefined}
      >
        <Button
          type="button"
          variant="outline"
          className={cn(
            "pointer-events-auto fixed max-w-[min(calc(100vw-2rem),19rem)]",
            FAB_CHROME_Z_CLASS,
            studyBibleDarkClasses.fabMenuActionShell,
            resolveFabMenuActionSurface(action)
          )}
          style={motionStyle}
          onClick={() => {
            action.onClick();
            closeMenu();
          }}
          data-fab-menu={menuId}
          {...(tabletDockedToBulkTodoSheet ? { "data-bulk-todo-sheet-fab": "" as const } : {})}
        >
          <FabActionLabel action={action} />
        </Button>
      </RadixPortal>
    );
  };

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
          omitDefaultHorizontalAnchor={tabletDockedToBulkTodoSheet && !isMobileBulkDock}
          style={dockedMainFabStyle}
          className={cn(
            studyBibleDarkClasses.fabMenuMain,
            useTabletBottomNavCenter && FAB_TABLET_BOTTOM_NAV_MAIN,
            mainClassName
          )}
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

      {renderActions && useStackedLabeledActions
        ? stackedActions.map((action, index) =>
            renderStackedLabeledAction(action, index, "stack")
          )
        : null}

      {renderActions && !useStackedLabeledActions
        ? actions.map((action, index) => {
            const fallbackSpacing = 200;
            const fallbackX = (index - (actions.length - 1) / 2) * fallbackSpacing;
            const position = actionPositions[index] ?? { x: fallbackX, y: 0 };

            return (
              <RadixPortal
                key={action.label}
                container={
                  typeof document !== "undefined"
                    ? document.getElementById(portalContainerId)
                    : undefined
                }
              >
                <Button
                  ref={(node) => {
                    actionButtonRefs.current[index] = node;
                  }}
                  type="button"
                  variant="outline"
                  className={cn(
                    "pointer-events-auto fixed right-4 shadow-lg md:right-6 md:[--fab-action-effective-row-x:var(--fab-action-row-x)] md:[--fab-action-effective-arc-y:var(--fab-action-arc-y)]",
                    FAB_CHROME_Z_CLASS,
                    studyBibleDarkClasses.fabMenuActionShell,
                    resolveFabMenuActionSurface(action),
                    useTabletBottomNavCenter && FAB_TABLET_BOTTOM_NAV_ACTIONS,
                    actionClassName
                  )}
                  style={{
                    ["--fab-action-row-x" as string]: `${position.x}px`,
                    ["--fab-action-arc-y" as string]: `${position.y}px`,
                    bottom: `calc(max(env(safe-area-inset-bottom),0px) + var(--fab-action-offset-start, ${actionOffsetStart}px) + var(--fab-action-offset-step, ${actionOffsetStep * index}px))`,
                    opacity: expanded ? 1 : 0,
                    transform: expanded
                      ? "translate3d(calc(var(--fab-action-x, -50%) + var(--fab-action-effective-row-x, 0px)), calc(var(--fab-action-open-y, 0px) + var(--fab-action-effective-arc-y, 0px)), 0px) scale(1)"
                      : "translate3d(var(--fab-action-x, -50%), var(--fab-action-closed-y, 8px), 0px) scale(0.92)",
                    transition: "transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 180ms ease",
                    transitionDelay: `${index * 50}ms`,
                    willChange: "transform, opacity",
                    pointerEvents: expanded ? "auto" : "none",
                  }}
                  onClick={() => {
                    action.onClick();
                    closeMenu();
                  }}
                  data-fab-menu={menuId}
                >
                  <FabActionLabel action={action} />
                </Button>
              </RadixPortal>
            );
          })
        : null}
    </>
  );
}
