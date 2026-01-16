"use client";

import { HomeSummary } from "@/components/home/HomeSummary";
import { DesktopHomeSummary } from "@/components/home/DesktopHomeSummary";
import { BWIVisitHistory } from "@/components/home/BWIVisitHistory";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { FieldServiceDrawerDialog } from "@/components/fieldservice/FieldServiceDrawerDialog";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

interface HomeViewProps {
  userId: string;
  onVisitClick?: (visit: any) => Promise<void>;
  onNavigateToCongregation?: () => void;
  homeTab?: 'summary' | 'events';
}

export function HomeView({ userId, onVisitClick, onNavigateToCongregation, homeTab = 'summary' }: HomeViewProps) {
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
    <motion.div
      key="home"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 pb-20 pt-[60px] w-full max-w-full overflow-x-hidden"
    >
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
            
            <BWIVisitHistory 
              userId={userId} 
              onVisitClick={onVisitClick}
            />
            
            {/* Field Service drawer trigger - Mobile only */}
            <div className="px-4">
              <FieldServiceDrawerDialog userId={userId} triggerLabel="Field Service" />
            </div>
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
    </motion.div>
  );
}