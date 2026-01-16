"use client";

export function getTimelineLineHeight(isDrawer: boolean) {
  return isDrawer ? "calc(100% + 1.5rem)" : "calc(100% + 1rem)";
}

export function getTimelineLineClass(isDrawer: boolean) {
  return isDrawer ? "h-[calc(100%+1.5rem)]" : "h-[calc(100%+1rem)]";
}

export function getTimelineLineStyle(isDrawer: boolean) {
  return {
    left: 6,
    top: 12,
    height: getTimelineLineHeight(isDrawer),
    zIndex: 0
  } as const;
}

export function getTimelineLineClassWithPosition(isDrawer: boolean) {
  return `left-[5px] top-[12px] ${getTimelineLineClass(isDrawer)} z-0`;
}

export function getTimelineDotSize() {
  return "w-3 h-3";
}

export function getVisitTypeDotColor(type: "establishment" | "householder") {
  return type === "establishment" ? "bg-blue-500" : "bg-green-500";
}

export function getStatusDotColor(status: string) {
  switch (status) {
    case "inappropriate":
    case "declined_rack":
    case "do_not_call":
      return "border-red-500";
    case "for_scouting":
    case "accepted_rack":
    case "interested":
      return "border-blue-500";
    case "for_follow_up":
    case "return_visit":
      return "border-orange-500";
    case "for_replenishment":
      return "border-purple-500";
    case "has_bible_studies":
    case "bible_study":
      return "border-emerald-500";
    case "potential":
      return "border-cyan-500";
    case "closed":
      return "border-slate-500";
    default:
      return "border-gray-500";
  }
}
