/**
 * Header toast store: toasts show in the header bar instead of floating.
 * Subscribers re-render when toast state changes; toast auto-clears after duration.
 */

export type HeaderToastVariant = "success" | "error" | "info" | "warning" | "default";

export interface HeaderToastState {
  message: string | null;
  variant: HeaderToastVariant;
}

const DEFAULT_DURATION_MS = 3000;

let state: HeaderToastState = { message: null, variant: "default" };
const listeners = new Set<() => void>();
let clearTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  listeners.forEach((fn) => fn());
}

export function getHeaderToastState(): HeaderToastState {
  return state;
}

export function subscribeHeaderToast(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function showHeaderToast(
  message: string,
  variant: HeaderToastVariant = "default",
  durationMs: number = DEFAULT_DURATION_MS
): void {
  if (clearTimer) clearTimeout(clearTimer);
  state = { message, variant };
  emit();
  clearTimer = setTimeout(() => {
    clearTimer = null;
    state = { message: null, variant: "default" };
    emit();
  }, durationMs);
}

export function dismissHeaderToast(): void {
  if (clearTimer) {
    clearTimeout(clearTimer);
    clearTimer = null;
  }
  state = { message: null, variant: "default" };
  emit();
}
