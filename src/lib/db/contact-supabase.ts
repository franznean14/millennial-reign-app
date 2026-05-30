/**
 * Supabase boundary for contacts.
 * Table/column/RPC names remain `householders` / `householder_id` in Postgres (non-destructive).
 * App code uses `contact_id`, `CONTACTS_TABLE`, etc.
 */

/** PostgREST table for BWI/H2H contacts (legacy DB name). */
export const CONTACTS_TABLE = "householders" as const;

/** FK on calls and call_todos (legacy DB column). */
export const CONTACT_FK_COLUMN = "householder_id" as const;

export const DELETE_CONTACT_RPC = "delete_contact" as const;

/** @deprecated Use DELETE_CONTACT_RPC; kept for older deployed DBs. */
export const DELETE_CONTACT_RPC_LEGACY = "delete_householder" as const;

export type ContactFkDbRow = {
  householder_id?: string | null;
  contact_id?: string | null;
};

export function readContactIdFromDb(
  row: ContactFkDbRow | null | undefined
): string | null | undefined {
  return row?.contact_id ?? row?.householder_id ?? null;
}

/** PostgREST filter fragment, e.g. realtime `householder_id=eq.<uuid>`. */
export function contactIdEqFilter(contactId: string): string {
  return `${CONTACT_FK_COLUMN}=eq.${contactId}`;
}

/** Write payload for calls / todos (maps app contact_id → DB column). */
export function contactFkWritePayload(
  contactId: string | null | undefined
): { householder_id: string | null } {
  return { [CONTACT_FK_COLUMN]: contactId ?? null };
}

export function mapContactFkRow<T extends ContactFkDbRow>(
  row: T
): Omit<T, "householder_id"> & { contact_id: string | null } {
  const { householder_id, ...rest } = row;
  return { ...rest, contact_id: householder_id ?? null };
}

/** Visit stream discriminator (legacy value `householder` still accepted). */
export type ContactVisitType = "contact";

export type LegacyContactVisitType = "householder";

export function isContactVisitType(
  visitType: string | null | undefined
): boolean {
  return visitType === "contact" || visitType === "householder";
}

export function normalizeContactVisitType(
  visitType: string | null | undefined
): ContactVisitType | "establishment" {
  if (isContactVisitType(visitType)) return "contact";
  return "establishment";
}
