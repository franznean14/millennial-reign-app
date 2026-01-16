"use client";

import { getBestStatus } from "@/lib/utils/status-hierarchy";

export interface VisitRecord {
  id: string;
  visit_date: string;
  establishment_name?: string;
  householder_name?: string;
  visit_type: "establishment" | "householder";
  establishment_id?: string;
  householder_id?: string;
  establishment_status?: string;
  establishment_area?: string;
  notes?: string;
  created_at: string;
  publisher_id?: string;
  publisher?: {
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
  partner?: {
    first_name: string;
    last_name: string;
    avatar_url?: string;
  };
}

export function buildVisitRecords(establishmentVisits: any[] = [], householderVisits: any[] = []): VisitRecord[] {
  const establishmentRecords = establishmentVisits.map((v) => ({
    id: `est-${v.id}`,
    visit_date: v.visit_date,
    establishment_name: (v.business_establishments as any)?.name,
    establishment_status: getBestStatus((v.business_establishments as any)?.statuses || []),
    establishment_area: (v.business_establishments as any)?.area || null,
    visit_type: "establishment" as const,
    establishment_id: v.establishment_id,
    notes: v.note,
    created_at: v.created_at,
    publisher_id: (v as any).publisher_id,
    publisher: (v.publisher as any) || undefined,
    partner: (v.partner as any) || undefined
  }));

  const householderRecords = householderVisits.map((v) => {
    const establishmentData =
      (v.business_establishments as any) ||
      (v.householders as any)?.business_establishments ||
      null;

    return {
    id: `hh-${v.id}`,
    visit_date: v.visit_date,
    householder_name: (v.householders as any)?.name,
    establishment_name: establishmentData?.name,
    establishment_status: getBestStatus(establishmentData?.statuses || []),
    establishment_area: establishmentData?.area || null,
    visit_type: "householder" as const,
    householder_id: v.householder_id,
    notes: v.note,
    created_at: v.created_at,
    publisher_id: (v as any).publisher_id,
    publisher: (v.publisher as any) || undefined,
    partner: (v.partner as any) || undefined
    };
  });

  return [...establishmentRecords, ...householderRecords];
}

export function dedupeAndSortVisits(visits: VisitRecord[]): VisitRecord[] {
  const uniqueVisits = visits.filter((visit, index, self) => index === self.findIndex((v) => v.id === visit.id));
  return uniqueVisits.sort((a, b) => new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime());
}

export function takeTopVisits(visits: VisitRecord[], limit: number): VisitRecord[] {
  return dedupeAndSortVisits(visits).slice(0, limit);
}