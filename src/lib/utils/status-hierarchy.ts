import { cn } from "@/lib/utils";

// Status hierarchy from worst to best
export const STATUS_HIERARCHY = [
  'inappropriate',      // Worst
  'declined_rack',      // Bad
  'rack_pulled_out',    // Neutral / slightly negative - rack removed
  'closed',             // Neutral - establishment closed
  'for_scouting',       // Better
  'for_follow_up',      // Good
  'accepted_rack',      // Better
  'has_bible_studies'   // Best
] as const;

// Helper function to get the best status from an array
export const getBestStatus = (statuses: string[]): string => {
  if (!statuses || statuses.length === 0) return 'for_scouting';
  
  let bestStatus = statuses[0];
  let bestIndex = STATUS_HIERARCHY.indexOf(bestStatus as any);
  
  for (const status of statuses) {
    const index = STATUS_HIERARCHY.indexOf(status as any);
    if (index > bestIndex) {
      bestIndex = index;
      bestStatus = status;
    }
  }
  
  return bestStatus;
};

// Helper function to get status color based on hierarchy
export const getStatusColor = (status: string) => {
  switch (status) {
    case 'inappropriate':
      return 'border-red-800/50 bg-red-800/5';
    case 'declined_rack':
      return 'border-red-500/50 bg-red-500/5';
    case 'rack_pulled_out':
      return 'border-amber-500/50 bg-amber-500/5';
    case 'for_scouting':
      return 'border-cyan-500/50 bg-cyan-500/5';
    case 'for_follow_up':
      return 'border-orange-500/50 bg-orange-500/5';
    case 'accepted_rack':
      return 'border-blue-500/50 bg-blue-500/5';
    case 'for_replenishment':
      return 'border-purple-500/50 bg-purple-500/5';
    case 'has_bible_studies':
      return 'border-emerald-500/50 bg-emerald-500/10';
    case 'closed':
      return 'border-slate-500/50 bg-slate-500/5';
    case 'personal_territory':
      return 'border-pink-500/50 bg-pink-500/5';
    default:
      return 'border-gray-500/50 bg-gray-500/5';
  }
};

/** Text color only for header/title use (no border/bg) */
export const getStatusTitleColor = (status: string): string => {
  switch (status) {
    case 'inappropriate':
      return 'text-white';
    case 'declined_rack':
    case 'do_not_call':
      return 'text-red-500';
    case 'for_scouting':
    case 'potential':
      return 'text-cyan-500';
    case 'for_follow_up':
    case 'return_visit':
      return 'text-orange-500';
    case 'accepted_rack':
    case 'interested':
      return 'text-blue-500';
    case 'for_replenishment':
      return 'text-purple-500';
    case 'rack_pulled_out':
      return 'text-amber-600';
    case 'has_bible_studies':
    case 'bible_study':
      return 'text-emerald-500';
    case 'closed':
      return 'text-slate-500';
    case 'personal_territory':
      return 'text-pink-500';
    /** Header title when establishment/contact is another publisher's personal territory */
    case 'personal_territory_other':
      return 'text-pink-400';
    default:
      return 'text-foreground';
  }
};

/**
 * Status token for {@link getStatusTitleColor} in business/section headers when viewing details.
 * Personal territory (publisher_id) overrides establishment status or householder status for the title color.
 */
export function getBusinessDetailsHeaderTitleStatus(
  selectedHouseholder: { publisher_id?: string | null; status: string } | null | undefined,
  selectedEstablishment: { publisher_id?: string | null; statuses?: string[] | null } | null | undefined,
  currentUserId: string | null | undefined
): string | undefined {
  if (selectedHouseholder) {
    if (selectedHouseholder.publisher_id) {
      const owned = !!(currentUserId && selectedHouseholder.publisher_id === currentUserId);
      return owned ? "personal_territory" : "personal_territory_other";
    }
    return selectedHouseholder.status;
  }
  if (selectedEstablishment) {
    if (selectedEstablishment.publisher_id) {
      const owned = !!(currentUserId && selectedEstablishment.publisher_id === currentUserId);
      return owned ? "personal_territory" : "personal_territory_other";
    }
    return getBestStatus(selectedEstablishment.statuses || []);
  }
  return undefined;
}

export const getStatusTextColor = (status: string) => {
  switch (status) {
    // Establishment statuses
    case 'inappropriate':
      return 'text-white border-red-800/50 bg-red-800';
    case 'declined_rack':
      return 'text-red-500 border-red-500/50';
    case 'for_scouting':
      return 'text-cyan-500 border-cyan-500/50';
    case 'for_follow_up':
      return 'text-orange-500 border-orange-500/50';
    case 'accepted_rack':
      return 'text-blue-500 border-blue-500/50';
    case 'for_replenishment':
      return 'text-purple-500 border-purple-500/50';
    case 'rack_pulled_out':
      return 'text-amber-600 border-amber-500/60';
    case 'has_bible_studies':
      return 'text-emerald-500 border-emerald-500/50';
    case 'closed':
      return 'text-slate-500 border-slate-500/50';
    case 'personal_territory':
      return 'text-pink-500 border-pink-500/50';
    // Householder statuses
    case 'potential':
      return 'text-cyan-500 border-cyan-500/50';
    case 'interested':
      return 'text-blue-500 border-blue-500/50';
    case 'return_visit':
      return 'text-orange-500 border-orange-500/50';
    case 'bible_study':
      return 'text-emerald-500 border-emerald-500/50';
    case 'do_not_call':
      return 'text-red-500 border-red-500/50';
    default:
      return 'text-gray-500 border-gray-500/50';
  }
};

/**
 * Details card surface when a record is personal territory / personal contact (publisher_id set).
 * Pink tint from {@link getStatusColor}("personal_territory"); dashed border when assigned to someone other than the viewer.
 */
export function getPersonalTerritoryDetailsCardClass(ownedByViewer: boolean): string {
  const base = getStatusColor("personal_territory");
  if (ownedByViewer) return base;
  return cn(base, "border-dashed border-pink-400/60");
}
