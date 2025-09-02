// Status hierarchy from worst to best
export const STATUS_HIERARCHY = [
  'declined_rack',      // Worst
  'for_scouting',       // Bad
  'for_follow_up',      // Better
  'accepted_rack',      // Good
  'for_replenishment',  // Better
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
    case 'declined_rack':
      return 'border-red-500/50 bg-red-500/5';
    case 'for_scouting':
      return 'border-gray-500/50 bg-gray-500/5';
    case 'for_follow_up':
      return 'border-orange-500/50 bg-orange-500/5';
    case 'accepted_rack':
      return 'border-blue-500/50 bg-blue-500/5';
    case 'for_replenishment':
      return 'border-purple-500/50 bg-purple-500/5';
    case 'has_bible_studies':
      return 'border-emerald-500/50 bg-emerald-500/10';
    default:
      return 'border-gray-500/50 bg-gray-500/5';
  }
};

export const getStatusTextColor = (status: string) => {
  switch (status) {
    case 'declined_rack':
      return 'text-red-500 border-red-500/50';
    case 'for_scouting':
      return 'text-gray-500 border-gray-500/50';
    case 'for_follow_up':
      return 'text-orange-500 border-orange-500/50';
    case 'accepted_rack':
      return 'text-blue-500 border-blue-500/50';
    case 'for_replenishment':
      return 'text-purple-500 border-purple-500/50';
    case 'has_bible_studies':
      return 'text-emerald-500 border-emerald-500/50';
    default:
      return 'text-gray-500 border-gray-500/50';
  }
};
