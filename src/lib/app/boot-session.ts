/** Session flag: user has completed initial app boot (skip fullscreen loader on PWA resume). */
export const APP_BOOT_SESSION_KEY = "mr:app-boot-complete";

export function hasCompletedAppBootSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(APP_BOOT_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

export function markAppBootSessionComplete(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(APP_BOOT_SESSION_KEY, "1");
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearAppBootSession(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(APP_BOOT_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
