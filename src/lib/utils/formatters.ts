"use client";

export function formatStatusText(status: string): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatHouseholderStatusCompactText(status: string): string {
  switch (status) {
    case "return_visit":
      return "RV";
    case "bible_study":
      return "BS";
    case "do_not_call":
      return "DNC";
    case "interested":
      return "Int";
    default:
      return formatStatusText(status);
  }
}

export function formatEstablishmentStatusCompactText(status: string): string {
  switch (status) {
    case "for_follow_up":
      return "Follow Up";
    case "for_replenishment":
      return "Replenish";
    case "accepted_rack":
      return "Accepted";
    case "declined_rack":
      return "Declined";
    case "rack_pulled_out":
      return "Rack Out";
    case "for_scouting":
      return "Scouting";
    case "has_bible_studies":
      return "BS";
    case "closed":
      return "Closed";
    default:
      return formatStatusText(status);
  }
}
