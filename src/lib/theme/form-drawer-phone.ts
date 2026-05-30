import { cn } from "@/lib/utils";

/**
 * Phone bottom-sheet forms: iOS keyboard-safe drawer chrome.
 * See `.cursor/rules/ios-viewport-safe-area.mdc` — Drawer form sheets.
 */
export const FORM_DRAWER_PHONE_ATTR = { "data-form-modal-drawer": "" } as const;

/** Home To-Do / Calls list drawers: lvh + !important beats DrawerContent inline 100svh (iOS standalone). */
export const homeListDrawerHeightClass =
  "!h-[95lvh] !max-h-[95lvh] md:!h-[98lvh] md:!max-h-[98lvh]";

/** Tablet three-column body inside home list drawers. */
export const homeListDrawerTabletColumnsClass =
  "md:h-[calc(92lvh-10rem)]";

/** Scroll padding when keyboard closed — cleared via globals when `html.visual-keyboard-open`. */
export const drawerFormScrollPadClass =
  "drawer-form-scroll pb-[calc(max(env(safe-area-inset-bottom),0px)+80px)]";

/** Home Calls / FAB-heavy list drawers (keyboard-safe; same `.drawer-form-scroll` hook). */
export const drawerFormScrollPad112Class =
  "drawer-form-scroll pb-[calc(max(env(safe-area-inset-bottom),0px)+112px)]";

/** Nested pickers / compact sheets inside a form drawer. */
export const drawerFormScrollPadTightClass =
  "drawer-form-scroll pb-[calc(max(env(safe-area-inset-bottom),0px)+24px)]";

/** Default inner scroll on phone form drawers (FormModal + FormDrawerContent). */
export const formDrawerPhoneInnerClass =
  "[&_.drawer-content-inner]:min-h-0 [&_.drawer-content-inner]:overflow-y-auto [&_.drawer-content-inner]:!pb-0 [&_.drawer-content-inner]:[scroll-padding-bottom:calc(max(env(safe-area-inset-bottom),0px)+80px)]";

/** Short forms (Field Service): content-height shell when keyboard is closed. */
export const formDrawerPhoneFitContentClass =
  "h-auto max-h-[92svh] [&_.drawer-content-inner]:flex-none";

export function getFormDrawerPhoneClassName(options?: {
  fitContent?: boolean;
  extra?: string;
}) {
  return cn(
    formDrawerPhoneInnerClass,
    options?.fitContent && formDrawerPhoneFitContentClass,
    options?.extra
  );
}
