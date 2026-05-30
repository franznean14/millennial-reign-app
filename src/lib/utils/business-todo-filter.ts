import type {
  EstablishmentWithDetails,
  ContactWithDetails,
  MyOpenTodoTargets,
} from "@/lib/db/business";

export function computeEstablishmentIdsFromTodoContacts(
  contacts: ContactWithDetails[],
  contactIds: Set<string>
): Set<string> {
  const out = new Set<string>();
  for (const h of contacts) {
    if (h.id && h.establishment_id && contactIds.has(h.id)) {
      out.add(h.establishment_id);
    }
  }
  return out;
}

export function establishmentMatchesMyOpenTodos(
  establishment: EstablishmentWithDetails,
  targets: MyOpenTodoTargets,
  establishmentIdsFromTodoContacts: Set<string>
): boolean {
  if (!establishment.id) return false;
  if (targets.establishmentIds.has(establishment.id)) return true;
  return establishmentIdsFromTodoContacts.has(establishment.id);
}

export function filterContactsWithMyOpenTodos(
  contacts: ContactWithDetails[],
  targets: MyOpenTodoTargets
): ContactWithDetails[] {
  return contacts.filter((h) => !!h.id && targets.contactIds.has(h.id));
}
