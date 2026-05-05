/**
 * iPadOS shows a thin input accessory bar (A, arrows, mic) when a field is focused even with a
 * hardware keyboard. That shrinks `visualViewport` by ~40–120px. We must not treat that like a
 * full software keyboard or drawers jump, max-heights animate, and dismiss targets stop lining up.
 *
 * Real on-screen keyboards typically obscure ~250px+ (often much more on phones).
 */
export const VISUAL_VIEWPORT_MIN_OBSCURED_FOR_SOFTWARE_KB_PX = 175;

export function isVisualViewportObscuredByLikelySoftwareKeyboard(
  layoutHeight: number,
  visualViewportHeight: number
): boolean {
  return layoutHeight - visualViewportHeight >= VISUAL_VIEWPORT_MIN_OBSCURED_FOR_SOFTWARE_KB_PX;
}

/**
 * Use physical screen short edge so iPads (≥ ~744px) are never classified as "phone" even when
 * `window.innerWidth` is ≤767 (mini, split view). That wrongly enabled Vaul `repositionInputs` and
 * `globals.css` `[data-vaul-drawer]` visual-viewport max-height hacks — shoving the sheet off-screen
 * when the accessory bar appears with a hardware keyboard.
 */
export const DEVICE_SCREEN_SHORT_EDGE_PHONE_MAX_PX = 600;

export function isPhoneLikeDeviceByScreen(): boolean {
  if (typeof window === "undefined") return true;
  return (
    Math.min(window.screen.width, window.screen.height) < DEVICE_SCREEN_SHORT_EDGE_PHONE_MAX_PX
  );
}
