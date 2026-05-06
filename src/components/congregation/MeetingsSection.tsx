"use client";

import { Calendar, Clock, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Congregation } from "@/lib/db/congregations";
import { cn } from "@/lib/utils";
import { studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";

interface MeetingsSectionProps {
  congregationData: Congregation;
}

export function MeetingsSection({ congregationData }: MeetingsSectionProps) {
  const formatDay = (d: number) => {
    const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return names[Math.max(0, Math.min(6, d))];
  };

  const time12 = (t?: string | null) => {
    if (!t) return "";
    const [hh, mm] = String(t).slice(0,5).split(":").map((n)=>Number(n));
    if (Number.isNaN(hh) || Number.isNaN(mm)) return String(t).slice(0,5);
    const am = hh < 12;
    const h12 = ((hh % 12) || 12);
    return `${h12}:${String(mm).padStart(2,'0')} ${am ? 'AM' : 'PM'}`;
  };

  return (
    <div className="min-w-0">
      <Card
        className={cn(
          "gap-0 overflow-hidden rounded-xl border py-0 shadow-md",
          studyBibleDarkClasses.bwiCard
        )}
      >
        <CardHeader className="rounded-t-xl border-b px-4 pt-3 !pb-3 dark:border-[#1c1921] dark:bg-[#2a2534]">
          <CardTitle className="flex items-center gap-2 text-base font-bold leading-tight dark:text-[#fffaff]">
            <Calendar className="h-5 w-5 shrink-0 opacity-90" />
            Meeting Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-6 pt-4 sm:px-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground dark:text-[#ded6e7]/85" />
                <span className="font-semibold dark:text-[#fffaff]">Midweek Meeting</span>
              </div>
              <div className="pl-6">
                <div className="text-sm text-muted-foreground dark:text-[#ded6e7]/80">
                  {formatDay(congregationData.midweek_day)} • {time12(congregationData.midweek_start)}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground dark:text-[#ded6e7]/85" />
                <span className="font-semibold dark:text-[#fffaff]">Weekend Meeting</span>
              </div>
              <div className="pl-6">
                <div className="text-sm text-muted-foreground dark:text-[#ded6e7]/80">
                  {formatDay(congregationData.weekend_day)} • {time12(congregationData.weekend_start)}
                </div>
              </div>
            </div>
          </div>

          {congregationData.address && (
            <div className="flex items-start gap-2 border-t pt-4 dark:border-[#1c1921]">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground dark:text-[#80778e]" />
              <span className="text-sm leading-relaxed text-muted-foreground dark:text-[#ded6e7]/85">
                {congregationData.address}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
