import type { ContactStatus, ContactWithDetails } from "@/lib/db/business";
import { formatStatusText } from "@/lib/utils/formatters";
import { resolveContactStatuses } from "@/lib/utils/status-hierarchy";

/** Status order for business contact lists and filter chips (see ContactList detailed columns). */
export const CONTACT_STATUS_DISPLAY_ORDER: ContactStatus[] = [
  "bible_study",
  "return_visit",
  "interested",
  "potential",
  "do_not_call",
  "moved_branch",
  "resigned",
];

/** Pipeline statuses — one toggle each; never combined with each other. */
export const CONTACT_SOLO_STATUSES: ContactStatus[] = [
  "bible_study",
  "return_visit",
  "interested",
  "potential",
  "do_not_call",
];

/** Only moved + resigned share a single toggle (congregation contacts drawer). */
export const CONTACT_MOVED_RESIGNED_STATUSES: ContactStatus[] = ["moved_branch", "resigned"];

export const CONTACTS_ALL_TAB = "All";
export const CONTACTS_MOVED_RESIGNED_TAB = "moved_resigned";

export function normalizeContactStatus(status?: string | null): string {
  return status || "potential";
}

export function formatContactStatusLabel(status: string): string {
  if (status === "bible_study") return "Bible Student";
  return formatStatusText(status);
}

export function formatContactStatusTabLabel(tab: string): string {
  if (tab === CONTACTS_ALL_TAB) return "All";
  if (tab === CONTACTS_MOVED_RESIGNED_TAB) return "Moved / Resigned";
  return formatContactStatusLabel(tab);
}

export function contactMatchesStatusTab(
  contact: Pick<ContactWithDetails, "status" | "statuses">,
  tab: string
): boolean {
  const present = resolveContactStatuses(contact);
  if (tab === CONTACTS_MOVED_RESIGNED_TAB) {
    return CONTACT_MOVED_RESIGNED_STATUSES.some((status) => present.includes(status));
  }
  return present.includes(tab);
}

export function collectPresentContactStatuses(
  contacts: Pick<ContactWithDetails, "status" | "statuses">[]
): Set<string> {
  const set = new Set<string>();
  contacts.forEach((contact) => {
    resolveContactStatuses(contact).forEach((status) => {
      set.add(normalizeContactStatus(status));
    });
  });
  return set;
}

/** Toggle values: All, each solo pipeline status, then one Moved/Resigned tab if needed. */
export function buildContactStatusTabValues(presentStatuses: Set<string>): string[] {
  const tabs: string[] = [CONTACTS_ALL_TAB];

  for (const status of CONTACT_STATUS_DISPLAY_ORDER) {
    if (CONTACT_SOLO_STATUSES.includes(status) && presentStatuses.has(status)) {
      tabs.push(status);
    }
  }

  if (CONTACT_MOVED_RESIGNED_STATUSES.some((status) => presentStatuses.has(status))) {
    tabs.push(CONTACTS_MOVED_RESIGNED_TAB);
  }

  for (const status of presentStatuses) {
    if (
      CONTACT_SOLO_STATUSES.includes(status as ContactStatus) ||
      CONTACT_MOVED_RESIGNED_STATUSES.includes(status as ContactStatus)
    ) {
      continue;
    }
    tabs.push(status);
  }

  return tabs;
}
