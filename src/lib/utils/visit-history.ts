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
  householder_publisher_id?: string;
  establishment_status?: string;
  establishment_area?: string;
  notes?: string;
  created_at: string;
  updated_at?: string | null;
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
    updated_at: (v as any).updated_at ?? v.created_at,
    publisher_id: (v as any).publisher_id,
    publisher: (v.publisher as any) || undefined,
    partner: (v.partner as any) || undefined
  }));

  const householderRecords = householderVisits.map((v) => {
    const establishmentData =
      (v.business_establishments as any) ||
      (v.householders as any)?.business_establishments ||
      null;

    // Get establishment_id from visit, or from householder, or from establishment data
    const establishmentId = 
      (v as any).establishment_id || 
      (v.householders as any)?.establishment_id || 
      establishmentData?.id || 
      null;

    return {
    id: `hh-${v.id}`,
    visit_date: v.visit_date,
    householder_name: (v.householders as any)?.name,
    establishment_name: establishmentData?.name,
    establishment_status: getBestStatus(establishmentData?.statuses || []),
    establishment_area: establishmentData?.area || null,
    visit_type: "householder" as const,
    establishment_id: establishmentId,
    householder_id: v.householder_id,
    householder_publisher_id: (v.householders as any)?.publisher_id || undefined,
    notes: v.note,
    created_at: v.created_at,
    updated_at: (v as any).updated_at ?? v.created_at,
    publisher_id: (v as any).publisher_id,
    publisher: (v.publisher as any) || undefined,
    partner: (v.partner as any) || undefined
    };
  });

  return [...establishmentRecords, ...householderRecords];
}

export function dedupeAndSortVisits(visits: VisitRecord[]): VisitRecord[] {
  const uniqueVisits = visits.filter((visit, index, self) => index === self.findIndex((v) => v.id === visit.id));
  const getTime = (value?: string | null) => {
    if (!value) return 0;
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  return uniqueVisits.sort((a, b) => {
    // 1) Primary: visit_date (newest first)
    const dateDiff = getTime(b.visit_date) - getTime(a.visit_date);
    if (dateDiff !== 0) return dateDiff;

    // 2) Secondary: updated_at (newest first)
    const updatedDiff = getTime(b.updated_at ?? undefined) - getTime(a.updated_at ?? undefined);
    if (updatedDiff !== 0) return updatedDiff;

    // 3) Tertiary: created_at (newest first)
    const createdDiff = getTime(b.created_at) - getTime(a.created_at);
    if (createdDiff !== 0) return createdDiff;

    // 4) Stable fallback: id
    return b.id.localeCompare(a.id);
  });
}

export function takeTopVisits(visits: VisitRecord[], limit: number): VisitRecord[] {
  return dedupeAndSortVisits(visits).slice(0, limit);
}