import type {
  EstablishmentWithDetails,
  HouseholderWithDetails,
  MyOpenTodoTargets,
} from "@/lib/db/business";

export function computeEstablishmentIdsFromTodoHouseholders(
  householders: HouseholderWithDetails[],
  householderIds: Set<string>
): Set<string> {
  const out = new Set<string>();
  for (const h of householders) {
    if (h.id && h.establishment_id && householderIds.has(h.id)) {
      out.add(h.establishment_id);
    }
  }
  return out;
}

export function establishmentMatchesMyOpenTodos(
  establishment: EstablishmentWithDetails,
  targets: MyOpenTodoTargets,
  establishmentIdsFromTodoHouseholders: Set<string>
): boolean {
  if (!establishment.id) return false;
  if (targets.establishmentIds.has(establishment.id)) return true;
  return establishmentIdsFromTodoHouseholders.has(establishment.id);
}

export function filterHouseholdersWithMyOpenTodos(
  householders: HouseholderWithDetails[],
  targets: MyOpenTodoTargets
): HouseholderWithDetails[] {
  return householders.filter((h) => !!h.id && targets.householderIds.has(h.id));
}
