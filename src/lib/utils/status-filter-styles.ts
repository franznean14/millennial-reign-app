"use client";

export function getFadedStatusColor(status: string) {
  switch (status) {
    case "inappropriate":
      return "text-red-800/50 border-red-800/30";
    case "declined_rack":
      return "text-red-500/50 border-red-500/30";
    case "for_scouting":
      return "text-cyan-500/50 border-cyan-500/30";
    case "for_follow_up":
      return "text-orange-500/50 border-orange-500/30";
    case "accepted_rack":
      return "text-blue-500/50 border-blue-500/30";
    case "for_replenishment":
      return "text-purple-500/50 border-purple-500/30";
    case "has_bible_studies":
      return "text-emerald-500/50 border-emerald-500/30";
    case "closed":
      return "text-slate-500/50 border-slate-500/30";
    // Householder statuses
    case "potential":
      return "text-gray-500/50 border-gray-500/30";
    case "interested":
      return "text-blue-500/50 border-blue-500/30";
    case "return_visit":
      return "text-orange-500/50 border-orange-500/30";
    case "bible_study":
      return "text-emerald-500/50 border-emerald-500/30";
    case "do_not_call":
      return "text-red-500/50 border-red-500/30";
    default:
      return "text-gray-500/50 border-gray-500/30";
  }
}

export function getSelectedStatusColor(status: string) {
  switch (status) {
    case "inappropriate":
      return "text-red-800 border-red-800 bg-red-800/5";
    case "declined_rack":
      return "text-red-500 border-red-500 bg-red-500/5";
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
    default:
      return "text-gray-500 border-gray-500 bg-gray-500/5";
  }
}
