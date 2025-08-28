import { HomeSummary } from "@/components/home/HomeSummary";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

function sumHours(records: { hours: number }[]) {
  return records.reduce((acc, r) => acc + (Number(r.hours) || 0), 0);
}

function topStudies(records: { bible_studies: string[] | null }[], limit = 5) {
  const counts = new Map<string, number>();
  for (const r of records) {
    for (const name of r.bible_studies ?? []) {
      const key = name.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

export default async function Home() {
  // Auth gate without network: check Supabase auth cookies
  const cookieStore = await cookies();
  const all = (cookieStore as any).getAll ? (cookieStore as any).getAll() : [];
  const hasAccess = Boolean(
    cookieStore.get("sb-access-token")?.value ||
      cookieStore.get("sb-refresh-token")?.value ||
      all.some((c: any) => typeof c?.name === "string" && /\bsb-.*-auth-token\b/.test(c.name) && !!c.value)
  );
  if (!hasAccess) redirect("/login");

  // Avoid network calls here for offline-first; compute dates without profile TZ
  const timeZone: string | undefined = undefined;

  // Dates (build YYYY-MM-DD based on user's time zone if available)
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timeZone || undefined, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value || now.getFullYear());
  const m = Number(parts.find((p) => p.type === "month")?.value || now.getMonth() + 1) - 1; // 0-based
  const ymd = (yy: number, mmIndex: number, dd: number) => {
    const mm = String(mmIndex + 1).padStart(2, "0");
    const ddStr = String(dd).padStart(2, "0");
    return `${yy}-${mm}-${ddStr}`;
  };
  const monthStart = ymd(y, m, 1);
  const nextMonthStart = m === 11 ? ymd(y + 1, 0, 1) : ymd(y, m + 1, 1);

  // Service year: Sep 1 -> next Sep 1
  const serviceYearStart = m >= 8 ? ymd(y, 8, 1) : ymd(y - 1, 8, 1);
  const serviceYearEnd = m >= 8 ? ymd(y + 1, 8, 1) : ymd(y, 8, 1);

  // Offline-first SSR: do not query daily records here.
  let monthRecords: any[] = [];
  let serviceYearRecords: any[] = [];
  const isRegularPioneer = false;

  const monthHours = sumHours(monthRecords);
  const syHours = sumHours(serviceYearRecords);
  const studies = topStudies(monthRecords, 5);

  return (
    <div className="space-y-6">
      <HomeSummary
        userId={undefined as any}
        monthStart={monthStart}
        nextMonthStart={nextMonthStart}
        serviceYearStart={serviceYearStart}
        serviceYearEnd={serviceYearEnd}
        initialMonthHours={monthHours}
        initialSyHours={syHours}
        initialStudies={studies}
        isRegularPioneer={isRegularPioneer}
        timeZone={timeZone}
      />
    </div>
  );
}
