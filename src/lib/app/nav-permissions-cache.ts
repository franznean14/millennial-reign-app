export type NavPermissions = {
  showCongregation: boolean;
  showBusiness: boolean;
};

export type CachedNavPermissions = NavPermissions & {
  userId: string;
};

const STORAGE_KEY = "mr:nav-permissions";

export function deriveNavPermissions(profile: {
  role?: string | null;
  privileges?: string[] | null;
  congregation_id?: string | null;
} | null | undefined): NavPermissions {
  if (!profile) {
    return { showCongregation: false, showBusiness: false };
  }

  const isElder = Array.isArray(profile.privileges) && profile.privileges.includes("Elder");
  const isSuperadmin = profile.role === "superadmin";
  const assigned = !!profile.congregation_id;
  const admin = profile.role === "admin";

  return {
    showCongregation: true,
    showBusiness: assigned || isSuperadmin || (admin && isElder),
  };
}

export function readCachedNavPermissions(expectedUserId?: string | null): NavPermissions | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedNavPermissions>;
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.showCongregation !== "boolean" ||
      typeof parsed.showBusiness !== "boolean"
    ) {
      return null;
    }
    if (expectedUserId && parsed.userId !== expectedUserId) {
      return null;
    }
    return {
      showCongregation: parsed.showCongregation,
      showBusiness: parsed.showBusiness,
    };
  } catch {
    return null;
  }
}

export function writeCachedNavPermissions(userId: string, permissions: NavPermissions): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedNavPermissions = { userId, ...permissions };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearCachedNavPermissions(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
