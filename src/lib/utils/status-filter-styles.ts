"use client";

export function getFadedStatusColor(status: string) {
  switch (status) {
    case "inappropriate":
      return "text-red-800 border-red-800 bg-red-800/5";
    case "declined_rack":
      return "text-red-500 border-red-500 bg-red-500/5";
    case "rack_pulled_out":
      return "text-amber-600 border-amber-500 bg-amber-500/5";
    case "for_scouting":
      return "text-cyan-500 border-cyan-500 bg-cyan-500/5";
    case "for_follow_up":
      return "text-orange-500 border-orange-500 bg-orange-500/5";
    case "accepted_rack":
      return "text-blue-500 border-blue-500 bg-blue-500/5";
    case "for_replenishment":
      return "text-purple-500 border-purple-500 bg-purple-500/5";
    case "has_bible_studies":
      return "text-emerald-500 border-emerald-500 bg-emerald-500/10";
    case "closed":
      return "text-slate-500 border-slate-500 bg-slate-500/5";
    // Householder statuses
    case "potential":
      return "text-gray-500 border-gray-500 bg-gray-500/5";
    case "interested":
      return "text-blue-500 border-blue-500 bg-blue-500/5";
    case "return_visit":
      return "text-orange-500 border-orange-500 bg-orange-500/5";
    case "bible_study":
      return "text-emerald-500 border-emerald-500 bg-emerald-500/10";
    case "do_not_call":
      return "text-red-500 border-red-500 bg-red-500/5";
    case "exclude_personal_territory":
      return "text-pink-500 border-pink-500 bg-pink-500/5";
    default:
      return "text-gray-500 border-gray-500 bg-gray-500/5";
  }
}

export function getSelectedStatusColor(status: string) {
  switch (status) {
    case "inappropriate":
      return "text-white bg-red-800 border-red-800";
    case "declined_rack":
      return "text-white bg-red-500 border-red-500";
    case "for_scouting":
      return "text-white bg-cyan-500 border-cyan-500";
    case "for_follow_up":
      return "text-white bg-orange-500 border-orange-500";
    case "accepted_rack":
      return "text-white bg-blue-500 border-blue-500";
    case "for_replenishment":
      return "text-white bg-purple-500 border-purple-500";
    case "rack_pulled_out":
      return "text-white bg-amber-600 border-amber-600";
    case "has_bible_studies":
      return "text-white bg-emerald-600 border-emerald-600";
    case "closed":
      return "text-white bg-slate-600 border-slate-600";
    // Householder statuses
    case "potential":
      return "text-white bg-gray-500 border-gray-500";
    case "interested":
      return "text-white bg-blue-500 border-blue-500";
    case "return_visit":
      return "text-white bg-orange-500 border-orange-500";
    case "bible_study":
      return "text-white bg-emerald-600 border-emerald-600";
    case "do_not_call":
      return "text-white bg-red-600 border-red-600";
    case "exclude_personal_territory":
      return "text-white bg-pink-600 border-pink-600";
    default:
      return "text-white bg-gray-600 border-gray-600";
  }
}

/** Badge style for active filter chips (Exclude Personal Territory) - same color scheme as status filter. */
export function getExcludeFilterBadgeClass(): string {
  return "text-white bg-pink-600 border border-pink-600 rounded-full";
}
