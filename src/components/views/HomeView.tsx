"use client";

import { HomeSummary } from "@/components/home/HomeSummary";
import { DesktopHomeSummary } from "@/components/home/DesktopHomeSummary";
import { VisitHistory } from "@/components/home/VisitHistory";
import { HomeTodoCard } from "@/components/home/HomeTodoCard";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { useSPA } from "@/components/SPAProvider";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface HomeViewProps {
  userId: string;
  onVisitClick?: (visit: any) => Promise<void>;
  onNavigateToCongregation?: () => void;
  onNavigateToBusinessWithStatus?: (
    tab: "establishments" | "householders",
    status: string,
    areas?: string | string[]
  ) => void;
  onNavigateToBusiness?: () => void;
  onNavigateToTodoCall?: (params: { establishmentId?: string; householderId?: string }) => void;
  homeTab?: 'summary' | 'events';
  bwiAreaFilter: string[];
  onBwiAreaChange: (areas: string[]) => void;
}

export function HomeView({
  userId,
  onVisitClick,
  onNavigateToCongregation,
  onNavigateToBusinessWithStatus,
  onNavigateToTodoCall,
  homeTab = 'summary',
  bwiAreaFilter,
  onBwiAreaChange,
}: HomeViewProps) {
  const { userPermissions } = useSPA();
  const showBwi = userPermissions.showBusiness;

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
    <div className="space-y-4 md:space-y-5 w-full max-w-full overflow-x-hidden">
      {/* Keep both panels mounted so Events does not remount/refetch on Summary ↔ Events; hide inactive tab */}
      <div
        className={homeTab === "summary" ? "block" : "hidden"}
        aria-hidden={homeTab !== "summary"}
      >
        {/* Below xl: stack on phones; lg+ iPad-style row — same instances as mobile, wider breakpoints only change layout. */}
        <div
          className={cn(
            "xl:hidden flex flex-col gap-6",
            showBwi ? "md:grid md:grid-cols-3 md:items-start md:gap-4" : "md:grid md:grid-cols-2 md:items-start md:gap-4"
          )}
        >
          <div className="min-w-0">
            <HomeSummary
              userId={userId}
              monthStart={dateRanges.monthStart}
              nextMonthStart={dateRanges.nextMonthStart}
              serviceYearStart={dateRanges.serviceYearStart}
              serviceYearEnd={dateRanges.serviceYearEnd}
              onNavigateToCongregation={onNavigateToCongregation}
            />
          </div>
          {showBwi ? (
            <div className="min-w-0">
              <VisitHistory
                userId={userId}
                onVisitClick={onVisitClick}
                onNavigateToBusinessWithStatus={onNavigateToBusinessWithStatus}
                bwiAreaFilter={bwiAreaFilter}
                onBwiAreaChange={onBwiAreaChange}
              />
            </div>
          ) : null}
          <div className="min-w-0">
            <HomeTodoCard
              userId={userId}
              fabBridgeLayout="belowXl"
              onNavigateToTodoCall={onNavigateToTodoCall}
            />
          </div>
        </div>

        {/* xl+: same three-card row as tablet — DesktopHomeSummary is full-width inside its grid column (not w-1/3 of the page). */}
        <div
          className={cn(
            "hidden xl:grid xl:items-start xl:gap-4",
            showBwi ? "xl:grid-cols-3" : "xl:grid-cols-2"
          )}
        >
          <div className="min-w-0">
            <DesktopHomeSummary
              userId={userId}
              monthStart={dateRanges.monthStart}
              nextMonthStart={dateRanges.nextMonthStart}
              serviceYearStart={dateRanges.serviceYearStart}
              serviceYearEnd={dateRanges.serviceYearEnd}
              onNavigateToCongregation={onNavigateToCongregation}
            />
          </div>
          {showBwi ? (
            <div className="min-w-0">
              <VisitHistory
                userId={userId}
                onVisitClick={onVisitClick}
                onNavigateToBusinessWithStatus={onNavigateToBusinessWithStatus}
                bwiAreaFilter={bwiAreaFilter}
                onBwiAreaChange={onBwiAreaChange}
              />
            </div>
          ) : null}
          <div className="min-w-0">
            <HomeTodoCard
              userId={userId}
              fabBridgeLayout="xlAndUp"
              onNavigateToTodoCall={onNavigateToTodoCall}
            />
          </div>
        </div>
      </div>

      <div
        className={homeTab === "events" ? "block px-4" : "hidden"}
        aria-hidden={homeTab !== "events"}
      >
        <UpcomingEvents userId={userId} />
      </div>
      {/* FAB handled by UnifiedFab */}
    </div>
  );
}