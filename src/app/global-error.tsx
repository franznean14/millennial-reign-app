"use client";

import { AppRouteError } from "@/components/shared/AppRouteError";

export default function GlobalError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset?: () => void;
  unstable_retry?: () => void;
}) {
  return <AppRouteError error={error} reset={reset ?? unstable_retry} global />;
}
