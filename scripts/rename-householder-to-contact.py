#!/usr/bin/env python3
"""Rename Householder -> Contact in src/ only. Preserves Supabase table/column/RPC identifiers."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"

# Order: longest identifiers first
REPLACEMENTS = [
    # Types / components
    ("HouseholderWithDetails", "ContactWithDetails"),
    ("HouseholderDetailsSnapshot", "ContactDetailsSnapshot"),
    ("HouseholderSummaryFieldsProps", "ContactSummaryFieldsProps"),
    ("HouseholderSummaryFields", "ContactSummaryFields"),
    ("HouseholderTableSortTh", "ContactTableSortTh"),
    ("HouseholderDetailsProps", "ContactDetailsProps"),
    ("HouseholderListProps", "ContactListProps"),
    ("HouseholderFormProps", "ContactFormProps"),
    ("CallsHouseholderSnapshot", "CallsContactSnapshot"),
    ("HouseholderVisitRow", "ContactVisitRow"),
    ("HouseholderStatus", "ContactStatus"),
    ("HouseholderDetails", "ContactDetails"),
    ("HouseholderList", "ContactList"),
    ("HouseholderForm", "ContactForm"),
    # Functions
    ("getPersonalContactHouseholders", "getPersonalContacts"),
    ("getSharedEstablishmentsAndHouseholders", "getSharedEstablishmentsAndContacts"),
    ("computeEstablishmentIdsFromTodoHouseholders", "computeEstablishmentIdsFromTodoContacts"),
    ("filterHouseholdersWithMyOpenTodos", "filterContactsWithMyOpenTodos"),
    ("getHouseholderCompletedCallTodos", "getContactCompletedCallTodos"),
    ("getHouseholderOpenCallTodos", "getContactOpenCallTodos"),
    ("resolveHouseholderDetailsSnapshot", "resolveContactDetailsSnapshot"),
    ("warmHouseholderDetailsInMemory", "warmContactDetailsInMemory"),
    ("householderDetailsCacheKey", "contactDetailsCacheKey"),
    ("loadHouseholderDetailsSwr", "loadContactDetailsSwr"),
    ("loadHouseholderDetails", "loadContactDetails"),
    ("loadCongregationHouseholderDetails", "loadCongregationContactDetails"),
    ("getHouseholderVisitsWithUsers", "getContactVisitsWithUsers"),
    ("formatHouseholderWriteError", "formatContactWriteError"),
    ("formatHouseholderStatusCompactText", "formatContactStatusCompactText"),
    ("getHouseholderStatusBadgeClass", "getContactStatusBadgeClass"),
    ("getHouseholderStatusColorClass", "getContactStatusColorClass"),
    ("getHouseholderCardColor", "getContactCardColor"),
    ("truncateHouseholderName", "truncateContactName"),
    ("getHouseholderCallTotal", "getContactCallTotal"),
    ("sortedHouseholdersForTable", "sortedContactsForTable"),
    ("householdersForSlice", "contactsForSlice"),
    ("visibleHouseholders", "visibleContacts"),
    ("uniqueHouseholders", "uniqueContacts"),
    ("previewHouseholders", "previewContacts"),
    ("filteredHouseholders", "filteredContacts"),
    ("visibleEstablishmentHouseholders", "visibleEstablishmentContacts"),
    ("handleSelectHouseholder", "handleSelectContact"),
    ("handleHouseholderEditSaved", "handleContactEditSaved"),
    ("closeHouseholderSideDetails", "closeContactSideDetails"),
    ("renderHouseholderDetails", "renderContactDetails"),
    ("businessHouseholderDetailShade", "businessContactDetailShade"),
    ("addNewHouseholder", "addNewContact"),
    ("handleDeleteHouseholder", "handleDeleteContact"),
    ("handleArchiveHouseholder", "handleArchiveContact"),
    ("listHouseholders", "listContacts"),
    ("upsertHouseholder", "upsertContact"),
    ("deleteHouseholder", "deleteContact"),
    ("archiveHouseholder", "archiveContact"),
    ("getHouseholderDetails", "getContactDetails"),
    ("onHouseholderClick", "onContactClick"),
    ("onHouseholderDelete", "onContactDelete"),
    ("onHouseholderArchive", "onContactArchive"),
    ("onMyHouseholdersChange", "onMyContactsChange"),
    ("myHouseholdersOnly", "myContactsOnly"),
    ("onHouseholderActivate", "onContactActivate"),
    ("onHouseholderClear", "onContactClear"),
    ("householderActive", "contactActive"),
    ("householderLabel", "contactLabel"),
    ("householderOnly", "contactOnly"),
    ("householderName", "contactName"),
    ("householderStatus", "contactStatus"),
    ("householderEstablishmentId", "contactEstablishmentId"),
    ("householderById", "contactById"),
    ("householdersById", "contactsById"),
    ("sortedHouseholders", "sortedContacts"),
    ("householderKeys", "contactKeys"),
    ("householderIds", "contactIds"),
    ("householderId", "contactId"),
    ("householderDetails", "contactDetails"),
    ("householderDetailsLoading", "contactDetailsLoading"),
    ("householderDetailsCacheRef", "contactDetailsCacheRef"),
    ("householderDetailsCacheKey", "contactDetailsCacheKey"),
    ("householderSurfaceClass", "contactSurfaceClass"),
    ("householderNote", "contactNote"),
    ("householderEstablishment", "contactEstablishment"),
    ("householderNamesCache", "contactNamesCache"),
    ("isHouseholderDetail", "isContactDetail"),
    ("isHouseholderVisit", "isContactVisit"),
    ("isHouseholderContext", "isContactContext"),
    ("isHouseholderTodo", "isContactTodo"),
    ("hideHouseholderNameBadge", "hideContactNameBadge"),
    ("hideHouseholderEstablishmentBadge", "hideContactEstablishmentBadge"),
    ("selectedHouseholderDetails", "selectedContactDetails"),
    ("selectedHouseholder", "selectedContact"),
    ("congregationSelectedHouseholderDetails", "congregationSelectedContactDetails"),
    ("congregationSelectedHouseholder", "congregationSelectedContact"),
    ("congregationHouseholderDetailsLoading", "congregationContactDetailsLoading"),
    ("selectedHouseholderRef", "selectedContactRef"),
    ("selectedHouseholderDetailsRef", "selectedContactDetailsRef"),
    ("onSelectHouseholder", "onSelectContact"),
    ("onSelectHouseholderDetails", "onSelectContactDetails"),
    ("onClearSelectedHouseholder", "onClearSelectedContact"),
    ("onSelectHouseholderRef", "onSelectContactRef"),
    ("onSelectHouseholderDetailsRef", "onSelectContactDetailsRef"),
    ("handleHouseholderUpdated", "handleContactUpdated"),
    ("handleHouseholderAdded", "handleContactAdded"),
    ("handleHouseholderDeleted", "handleContactDeleted"),
    ("fabHouseholderId", "fabContactId"),
    ("fabHouseholderName", "fabContactName"),
    ("fabHouseholderStatus", "fabContactStatus"),
    ("showHouseholderForm", "showContactForm"),
    ("businessEditSheet", "businessEditSheet"),  # noop
    ("establishmentIdsFromTodoHouseholders", "establishmentIdsFromTodoContacts"),
    ("userVisitedHouseholders", "userVisitedContacts"),
    ("filtersHouseholders", "filtersContacts"),
    ("bwiHouseholders", "bwiContacts"),
    ("filteredByAreaHouseholders", "filteredByAreaContacts"),
    ("callsHouseholderCacheRef", "callsContactCacheRef"),
    ("selectedCallsHouseholderDetails", "selectedCallsContactDetails"),
    ("openCallsContactSubdrawer", "openCallsContactSubdrawer"),
    ("openContactDetailsSubdrawer", "openContactDetailsSubdrawer"),
    ("contactSubdrawerHouseholder", "contactSubdrawerContact"),
    ("selectedDetailHouseholders", "selectedDetailContacts"),
    ("callsHouseholderSnapshot", "callsContactSnapshot"),
    ("isCongregationHouseholder", "isCongregationContact"),
    ("targetHouseholderId", "targetContactId"),
    ("resolvedHouseholderId", "resolvedContactId"),
    ("cachedHouseholderId", "cachedContactId"),
    ("visitHouseholderIdCache", "visitContactIdCache"),
    ("newHouseholder", "newContact"),
    ("updatedHouseholder", "updatedContact"),
    ("allHouseholders", "allContacts"),
    ("allHouseholderStatuses", "allContactStatuses"),
    ("orderedHouseholderStatuses", "orderedContactStatuses"),
    ("HH_TABLE_SORT_KEYS", "CONTACT_TABLE_SORT_KEYS"),
    ("HhTableSortKey", "ContactTableSortKey"),
    ("householderTableSort", "contactTableSort"),
    ("toggleHouseholderTableSort", "toggleContactTableSort"),
    ("detailedStatusColumns", "detailedStatusColumns"),
    ("columnHouseholders", "columnContacts"),
    ("householder_count", "householder_count"),  # DB column noop
    # Events & routes
    ("'householder-archived'", "'contact-archived'"),
    ('"householder-archived"', '"contact-archived"'),
    ("'householder-deleted'", "'contact-deleted'"),
    ('"householder-deleted"', '"contact-deleted"'),
    ("'householder-updated'", "'contact-updated'"),
    ('"householder-updated"', '"contact-updated"'),
    ("'householder-added'", "'contact-added'"),
    ('"householder-added"', '"contact-added"'),
    ("'business-householders'", "'business-contacts'"),
    ('"business-householders"', '"business-contacts"'),
    ("'business-householder'", "'business-contact'"),
    ('"business-householder"', '"business-contact"'),
    ("'congregation-householder'", "'congregation-contact'"),
    ('"congregation-householder"', '"congregation-contact"'),
    ("business-householders", "business-contacts"),
    ("business-householder", "business-contact"),
    ("congregation-householder", "congregation-contact"),
    # Tab / filter storage (not DB table)
    ("'householders'", "'contacts'"),
    ('"householders"', '"contacts"'),
    ("business:filters:householders", "business:filters:contacts"),
    ("householders:list:v2", "contacts:list:v3"),
    ("householder:details:v3", "contact:details:v4"),
    ("householders:personal:", "contacts:personal:"),
    ("householder-view-mode", "contact-view-mode"),
    ("bwi-householder-table-sort", "bwi-contact-table-sort"),
    ("filter-toolbar-householder", "filter-toolbar-contact"),
    ("householder-list", "contact-list"),
    ("householder-details", "contact-details"),
    # Scope keys (app cache, not DB column)
    ("`householder:", "`contact:"),
    ("'householder:", "'contact:"),
    ('"householder:', '"contact:'),
    ("startsWith(\"householder:\")", 'startsWith("contact:")'),
    ("startsWith('householder:')", "startsWith('contact:')"),
    ("replace(\"householder:\", \"\")", 'replace("contact:", "")'),
    ("replace('householder:', '')", "replace('contact:', '')"),
    # Interface singular (after compounds)
    ("interface Householder ", "interface Contact "),
    ("export interface Householder", "export interface Contact"),
    # Plural variables (word boundary)
    ("householders", "contacts"),
    # Singular variable (word boundary) — after protecting householder_id
]

# Protect Supabase / DB identifiers
PROTECTED = [
    "householder_id",
    "delete_householder",
    "householder_status_t",
    "householder_status",
    "calls_householder_id",
    "p_householder_id",
    "!calls_householder_id",
    "householders!",  # graphql alias
    "householder?",  # graphql optional
    '"householder"',  # visit_type enum value in DB
    "'householder'",
    ".from('householders')",
    '.from("householders")',
    "from('householders')",
    'from("householders")',
    "householders:calls_householder_id_fkey",
    "calls_householder_id_fkey",
    "householders:calls_",
    "table: \"householders\"",
    "table: 'householders'",
]

PLACEHOLDER_PREFIX = "__PRESERVE_HH__"


def protect(text: str) -> tuple[str, list[str]]:
    saved: list[str] = []
    for i, pat in enumerate(PROTECTED):
        token = f"{PLACEHOLDER_PREFIX}{i}__"
        while pat in text:
            text = text.replace(pat, token, 1)
            saved.append((token, pat))
    return text, saved


def restore(text: str, saved: list[str]) -> str:
    for token, pat in saved:
        text = text.replace(token, pat)
    return text


def process_file(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    text, saved = protect(original)
    for old, new in REPLACEMENTS:
        if old == new:
            continue
        text = text.replace(old, new)
    text = restore(text, saved)
    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = 0
    for path in sorted(ROOT.rglob("*")):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        if process_file(path):
            changed += 1
            print(path.relative_to(ROOT.parent))
    print(f"Updated {changed} files")


if __name__ == "__main__":
    main()
