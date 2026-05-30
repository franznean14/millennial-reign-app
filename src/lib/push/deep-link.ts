export const PUSH_NAVIGATE_MESSAGE = "PUSH_NAVIGATE" as const;

export const PENDING_ESTABLISHMENT_PUSH_KEY = "push:pending-establishment-id";

/** Relative path used in push payload `data.url` (service worker resolves to absolute). */
export function buildEstablishmentPushDeepLinkPath(establishmentId: string): string {
  return `/business?establishmentId=${encodeURIComponent(establishmentId)}`;
}

export function readEstablishmentIdFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const id = new URLSearchParams(window.location.search).get("establishmentId");
    return id?.trim() || null;
  } catch {
    return null;
  }
}

export function clearEstablishmentIdFromLocation(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("establishmentId")) return;
    url.searchParams.delete("establishmentId");
    const qs = url.searchParams.toString();
    window.history.replaceState({}, "", url.pathname + (qs ? `?${qs}` : ""));
  } catch {
    /* ignore */
  }
}

export function stashPendingEstablishmentPush(establishmentId: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PENDING_ESTABLISHMENT_PUSH_KEY, establishmentId);
  } catch {
    /* ignore */
  }
}

export function takePendingEstablishmentPush(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const id = sessionStorage.getItem(PENDING_ESTABLISHMENT_PUSH_KEY);
    if (id) sessionStorage.removeItem(PENDING_ESTABLISHMENT_PUSH_KEY);
    return id?.trim() || null;
  } catch {
    return null;
  }
}
