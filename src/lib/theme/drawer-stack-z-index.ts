/** Phone bottom-sheet tiers (see globals.css `[data-stack-above-*]`). */
export const DRAWER_BASE_Z = 9999;
export const DRAWER_STACK_ABOVE_PARENT_Z = 10001;
export const DRAWER_STACK_ABOVE_STACKED_Z = 10003;

/** FAB menu + main button — always above details drawers and nested form tiers. */
export const FAB_CHROME_Z = 100010;
export const FAB_CHROME_Z_CLASS = "z-[100010]" as const;
