import type { EventType } from "@/lib/db/eventSchedules";

/** Border + fill + readable label text for event-type badges (light + dark). */
export function getEventTypeAccentClass(eventType: EventType): string {
  switch (eventType) {
    case "meeting":
      return "border-sky-500 bg-sky-500/15 text-sky-900 dark:text-sky-200";
    case "memorial":
      return "border-violet-500 bg-violet-500/15 text-violet-900 dark:text-violet-200";
    case "circuit_overseer":
      return "border-amber-500 bg-amber-500/15 text-amber-900 dark:text-amber-200";
    case "cabr":
      return "border-emerald-500 bg-emerald-500/15 text-emerald-900 dark:text-emerald-200";
    case "caco":
      return "border-cyan-500 bg-cyan-500/15 text-cyan-900 dark:text-cyan-200";
    case "regional_convention":
      return "border-fuchsia-500 bg-fuchsia-500/15 text-fuchsia-900 dark:text-fuchsia-200";
    case "annual_pioneers_meeting":
      return "border-indigo-500 bg-indigo-500/15 text-indigo-900 dark:text-indigo-200";
    default:
      return "border-muted-foreground/50 bg-muted/40 text-muted-foreground";
  }
}
