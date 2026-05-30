import type { FocusEvent } from "react";

/** iOS input accessory bar + a little breathing room above the focused field. */
const FOCUS_SCROLL_TOP_SLACK_PX = 56;

function isFormFieldElement(el: EventTarget | null): el is HTMLElement {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement
  );
}

function getFormDrawerScrollParent(el: HTMLElement): HTMLElement | null {
  return (
    el.closest<HTMLElement>("[data-form-modal-drawer] .drawer-content-inner") ??
    el.closest<HTMLElement>(".form-modal-body") ??
    el.closest<HTMLElement>(".drawer-content-inner")
  );
}

/**
 * Keep focused fields visible inside phone form drawers when the software keyboard opens.
 * Pair with visual-viewport top anchoring in globals.css (see ios-viewport-safe-area.mdc).
 */
export function scrollFormFieldIntoViewOnFocus(target: HTMLElement) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const scrollParent = getFormDrawerScrollParent(target);
      if (scrollParent) {
        const parentRect = scrollParent.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const nextTop =
          scrollParent.scrollTop +
          (targetRect.top - parentRect.top) -
          FOCUS_SCROLL_TOP_SLACK_PX;
        scrollParent.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
        return;
      }
      target.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  });
}

export function handleFormDrawerFocusCapture(e: FocusEvent<HTMLElement>) {
  if (!isFormFieldElement(e.target)) return;
  if (typeof window === "undefined") return;
  if (!e.target.closest("[data-form-modal-drawer]")) return;
  scrollFormFieldIntoViewOnFocus(e.target);
}
