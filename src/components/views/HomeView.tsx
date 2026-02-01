"use client";

import { HomeSummary } from "@/components/home/HomeSummary";
import { DesktopHomeSummary } from "@/components/home/DesktopHomeSummary";
import { VisitHistory } from "@/components/home/VisitHistory";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { useEffect, useState } from "react";

interface HomeViewProps {
  userId: string;
  onVisitClick?: (visit: any) => Promise<void>;
  onNavigateToCongregation?: () => void;
  onNavigateToBusinessWithStatus?: (
    tab: "establishments" | "householders",
    status: string,
    area?: string
  ) => void;
  homeTab?: 'summary' | 'events';
}

export function HomeView({ userId, onVisitClick, onNavigateToCongregation, onNavigateToBusinessWithStatus, homeTab = 'summary' }: HomeViewProps) {
  const [dateRanges, setDateRanges] = useState({
    monthStart: "",
    nextMonthStart: "",
    serviceYearStart: "",
    serviceYearEnd: "",
  });

  useEffect(() => {
    // Calculate date ranges based on current date
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    
    const ymd = (yy: number, mmIndex: number, dd: number) => {
      const mm = String(mmIndex + 1).padStart(2, "0");
      const ddStr = String(dd).padStart(2, "0");
      return `${yy}-${mm}-${ddStr}`;
    };
    
    const monthStart = ymd(y, m, 1);
    const nextMonthStart = m === 11 ? ymd(y + 1, 0, 1) : ymd(y, m + 1, 1);
    const serviceYearStart = m >= 8 ? ymd(y, 8, 1) : ymd(y - 1, 8, 1);
    const serviceYearEnd = m >= 8 ? ymd(y + 1, 8, 1) : ymd(y, 8, 1);
    
    setDateRanges({
      monthStart,
      nextMonthStart,
      serviceYearStart,
      serviceYearEnd,
    });
  }, []);

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      {homeTab === 'summary' ? (
        <>
          {/* Mobile: Simple Home Summary */}
          <div className="lg:hidden">
            <HomeSummary
              userId={userId}
              monthStart={dateRanges.monthStart}
              nextMonthStart={dateRanges.nextMonthStart}
              serviceYearStart={dateRanges.serviceYearStart}
              serviceYearEnd={dateRanges.serviceYearEnd}
              onNavigateToCongregation={onNavigateToCongregation}
            />
            
            {/* Gap between cards */}
            <div className="h-6" />
            
            <VisitHistory 
              userId={userId} 
              onVisitClick={onVisitClick}
              onNavigateToBusinessWithStatus={onNavigateToBusinessWithStatus}
            />
            
          </div>

          {/* Desktop: Desktop Home Summary with Calendar and Form */}
          <div className="hidden lg:block">
            <DesktopHomeSummary
              userId={userId}
              monthStart={dateRanges.monthStart}
              nextMonthStart={dateRanges.nextMonthStart}
              serviceYearStart={dateRanges.serviceYearStart}
              serviceYearEnd={dateRanges.serviceYearEnd}
              onNavigateToCongregation={onNavigateToCongregation}
            />
          </div>
        </>
      ) : (
        <div className="px-4">
          <UpcomingEvents />
        </div>
      )}
      {/* FAB handled by UnifiedFab */}
    </div>
  );
}