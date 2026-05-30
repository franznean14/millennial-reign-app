#!/usr/bin/env python3
"""Rename app-level householder_id / visit_type householder to contact_* (keep DB literals in contact-supabase.ts)."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"

SKIP_FILES = {
    "contact-supabase.ts",
}

# TS property / type names (not SQL column strings inside .eq('householder_id'))
REPLACEMENTS = [
    (r"\bhouseholder_id\b", "contact_id"),
    (r"\bhouseholder_count\b", "contact_count"),
    (r"\bhouseholderRows\b", "contactRows"),
    (r"\bhouseholderStatusesColumnAvailable\b", "contactStatusesColumnAvailable"),
    (r"\bisMissingHouseholderStatusesColumn\b", "isMissingContactStatusesColumn"),
    (r"\bHOUSEHOLDER_LIST_SELECT\b", "CONTACT_LIST_SELECT"),
    (r"\bHOUSEHOLDER_DETAIL_SELECT\b", "CONTACT_DETAIL_SELECT"),
    (r'visit_type === "householder"', 'isContactVisitType(visit.visit_type)'),
    (r'visit_type === \'householder\'', "isContactVisitType(visit.visit_type)"),
    (r'visit_type: "householder"', 'visit_type: "contact"'),
    (r"visit_type: 'householder'", "visit_type: 'contact'"),
    (r'visit_type !== "householder"', '!isContactVisitType(visit.visit_type)'),
    (r"item.visit.visit_type === \"householder\"", "isContactVisitType(item.visit.visit_type)"),
    (r'legacyTargetType === "householder"', 'legacyTargetType === "contact" || legacyTargetType === "householder"'),
    (r'"establishment" \| "householder"', '"establishment" | "contact" | "householder"'),
    (r"householder_publisher_id", "contact_publisher_id"),
    (r"householder_name", "contact_name"),
    (r"householder_status", "contact_status"),
    (r"householderArea", "contactArea"),
    (r"householderPrefill", "contactPrefill"),
    (r"householderVisits", "contactVisits"),
    (r"const householder_id =", "const contact_id ="),
    (r"let householder_id =", "let contact_id ="),
]

IMPORT_LINE = 'import { isContactVisitType, CONTACT_FK_COLUMN, CONTACTS_TABLE, contactFkWritePayload, contactIdEqFilter, DELETE_CONTACT_RPC, DELETE_CONTACT_RPC_LEGACY } from "@/lib/db/contact-supabase";\n'


def needs_contact_supabase_import(text: str) -> bool:
    return "isContactVisitType" in text or "CONTACTS_TABLE" in text or "CONTACT_FK_COLUMN" in text


def add_import(text: str) -> str:
    if "from \"@/lib/db/contact-supabase\"" in text or "from '@/lib/db/contact-supabase'" in text:
        return text
    if not needs_contact_supabase_import(text):
        return text
    # After last import from @/
    m = list(re.finditer(r'^import .+;\n', text, re.M))
    if not m:
        return IMPORT_LINE + text
    pos = m[-1].end()
    return text[:pos] + IMPORT_LINE + text[pos:]


def fix_broken_visit_comparisons(text: str) -> str:
    # visit.visit_type was doubled by replacement
    text = text.replace("isContactVisitType(visit.visit_type)(visit.visit_type)", "isContactVisitType(visit.visit_type)")
    text = text.replace('isContactVisitType(visit.visit_type) && visit.contact_id', 'isContactVisitType(visit.visit_type) && visit.contact_id')
    return text


def process_file(path: Path) -> bool:
    if path.name in SKIP_FILES:
        return False
    original = path.read_text(encoding="utf-8")
    text = original
    for pat, repl in REPLACEMENTS:
        text = re.sub(pat, repl, text)
    text = fix_broken_visit_comparisons(text)
    text = add_import(text)
    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = []
    for path in sorted(SRC.rglob("*.ts")) + sorted(SRC.rglob("*.tsx")):
        if process_file(path):
            changed.append(path.relative_to(ROOT))
    print(f"Updated {len(changed)} files")
    for p in changed[:40]:
        print(f"  {p}")
    if len(changed) > 40:
        print(f"  ... and {len(changed) - 40} more")


if __name__ == "__main__":
    main()
