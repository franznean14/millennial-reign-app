/** Phone bottom-sheet tiers (see globals.css `[data-stack-above-*]`). */
export const DRAWER_BASE_Z = 9999;
export const DRAWER_STACK_ABOVE_PARENT_Z = 10001;
export const DRAWER_STACK_ABOVE_STACKED_Z = 10003;

/**
 * Tablet right-edge picker opened from a left/right form sheet
 * ({@link DrawerThinRightContent} `stackAboveFormSheet`).
 * Beats {@link DrawerWideLeftContentTop} and stacked left sheets (~160).
 */
export const RIGHT_SHEET_STACK_ABOVE_FORM_SHEET_Z = 170;

/**
 * Radix Select / Popover / DropdownMenu (portaled to `document.body`).
 * Must sit above {@link DRAWER_STACK_ABOVE_STACKED_Z} and tablet left sheets (inline ~160).
 * Keep below {@link FAB_CHROME_Z}.
 */
export const FORM_PORTAL_CONTENT_Z = 10005;
export const FORM_PORTAL_CONTENT_Z_CLASS = "z-[10005]" as const;

/** FAB menu + main button — always above details drawers and nested form tiers. */
export const FAB_CHROME_Z = 100010;
export const FAB_CHROME_Z_CLASS = "z-[100010]" as const;
