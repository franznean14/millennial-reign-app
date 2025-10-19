"use client";

import { Calendar, Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Congregation } from "@/lib/db/congregations";

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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Meeting Schedule
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Midweek Meeting</span>
              </div>
              <div className="pl-6">
                <div className="text-sm text-muted-foreground">
                  {formatDay(congregationData.midweek_day)} • {time12(congregationData.midweek_start)}
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Weekend Meeting</span>
              </div>
              <div className="pl-6">
                <div className="text-sm text-muted-foreground">
                  {formatDay(congregationData.weekend_day)} • {time12(congregationData.weekend_start)}
                </div>
              </div>
            </div>
          </div>
          
          {congregationData.address && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{congregationData.address}</span>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
