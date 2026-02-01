"use client";

import { showHeaderToast, dismissHeaderToast } from "@/lib/header-toast-store";
import type { HeaderToastVariant } from "@/lib/header-toast-store";

const DEFAULT_DURATION = 3000;

function getDuration(options?: { duration?: number }): number {
  if (options?.duration === undefined) return DEFAULT_DURATION;
  if (options.duration === Infinity) return 8000;
  return Math.max(0, options.duration);
}

function headerToast(message: string, variant: HeaderToastVariant, options?: { duration?: number }) {
  showHeaderToast(message, variant, getDuration(options));
}

const toast = (message: string, options?: { duration?: number; description?: string }) => {
  const text = options?.description ? `${message} ${options.description}` : message;
  headerToast(text, "default", options);
};

toast.success = (message: string, options?: { duration?: number; description?: string }) => {
  const text = options?.description ? `${message} ${options.description}` : message;
  headerToast(text, "success", options);
};

toast.error = (message: string, options?: { duration?: number; description?: string }) => {
  const text = options?.description ? `${message} ${options.description}` : message;
  headerToast(text, "error", options);
};

toast.info = (message: string, options?: { duration?: number; description?: string }) => {
  const text = options?.description ? `${message} ${options.description}` : message;
  headerToast(text, "info", options);
};

toast.warning = (message: string, options?: { duration?: number; description?: string }) => {
  const text = options?.description ? `${message} ${options.description}` : message;
  headerToast(text, "warning", options);
};

toast.message = (title: string, options?: { duration?: number; description?: string }) => {
  const text = options?.description ? `${title} ${options.description}` : title;
  headerToast(text, "default", options);
};

toast.promise = <T,>(
  promise: Promise<T>,
  messages: { loading: string; success: string | ((data: T) => string); error: string | ((err: unknown) => string) }
) => {
  headerToast(messages.loading, "default", { duration: Infinity });
  promise
    .then((data) => {
      const msg = typeof messages.success === "function" ? messages.success(data) : messages.success;
      headerToast(msg, "success");
    })
    .catch((err) => {
      const msg = typeof messages.error === "function" ? messages.error(err) : messages.error;
      headerToast(msg, "error");
    });
  return promise;
};

toast.dismiss = () => {
  dismissHeaderToast();
};

/** No-op Toaster: toasts are shown in the header via UnifiedPortaledControls */
export function Toaster() {
  return null;
}

export { toast };
