/**
 * Compact role labels + Tailwind classes for congregation member lists (dark-theme friendly).
 */
export type CongregationRoleTone =
  | "elder"
  | "ms"
  | "secretary"
  | "coordinator"
  | "go"
  | "ga"
  | "rp"
  | "ap";

export type PrimaryRoleDisplay = {
  label: string;
  tone: CongregationRoleTone;
};

/** Border + background + text for role pills on dark UI */
export const CONG_ROLE_BADGE_CLASSES: Record<CongregationRoleTone, string> = {
  elder: "border-amber-500/45 bg-amber-500/15 text-amber-100",
  ms: "border-blue-500/45 bg-blue-500/15 text-blue-100",
  secretary: "border-violet-500/45 bg-violet-500/15 text-violet-100",
  coordinator: "border-indigo-500/45 bg-indigo-500/15 text-indigo-100",
  go: "border-yellow-500/45 bg-yellow-500/15 text-yellow-100",
  ga: "border-sky-500/45 bg-sky-500/15 text-sky-100",
  rp: "border-emerald-500/45 bg-emerald-500/15 text-emerald-100",
  ap: "border-teal-500/45 bg-teal-500/15 text-teal-100",
};

/** BWI participant — distinct from privilege roles */
export const CONG_BWI_BADGE_CLASS =
  "border-fuchsia-500/45 bg-fuchsia-500/15 text-fuchsia-100";

/**
 * Single primary badge for list cells (priority: ordained → appointed offices → pioneers).
 */
export function getPrimaryRoleDisplay(privileges: string[] | null | undefined): PrimaryRoleDisplay | null {
  const p = privileges ?? [];
  if (p.includes("Elder")) return { label: "Elder", tone: "elder" };
  if (p.includes("Ministerial Servant")) return { label: "MS", tone: "ms" };
  if (p.includes("Secretary")) return { label: "Sec", tone: "secretary" };
  if (p.includes("Coordinator")) return { label: "Coord", tone: "coordinator" };
  if (p.includes("Group Overseer")) return { label: "GO", tone: "go" };
  if (p.includes("Group Assistant")) return { label: "GA", tone: "ga" };
  if (p.includes("Regular Pioneer")) return { label: "RP", tone: "rp" };
  if (p.includes("Auxiliary Pioneer")) return { label: "AP", tone: "ap" };
  return null;
}
