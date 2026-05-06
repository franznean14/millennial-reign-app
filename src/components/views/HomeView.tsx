"use client";

import { HomeSummary } from "@/components/home/HomeSummary";
import { DesktopHomeSummary } from "@/components/home/DesktopHomeSummary";
import { VisitHistory } from "@/components/home/VisitHistory";
import { HomeTodoCard } from "@/components/home/HomeTodoCard";
import { UpcomingEvents } from "@/components/home/UpcomingEvents";
import { useSPA } from "@/components/SPAProvider";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type { VisitRecord } from "@/lib/utils/visit-history";

function getHomeDateRanges() {
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

  return {
    monthStart,
    nextMonthStart,
    serviceYearStart,
    serviceYearEnd,
  };
}

interface HomeViewProps {
  userId: string;
  onVisitClick?: (visit: VisitRecord) => Promise<void>;
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

  const [dateRanges] = useState(getHomeDateRanges);

  return (
    <div className="space-y-4 md:space-y-5 w-full max-w-full overflow-x-hidden">
      {/* Keep both panels mounted so Events does not remount/refetch on Summary ↔ Events; hide inactive tab */}
      <div
        className={homeTab === "summary" ? "block" : "hidden"}
        aria-hidden={homeTab !== "summary"}
      >
        {/* Mobile: keep the existing stacked layout and combined BWI/Calls tabs. */}
        <div className="flex flex-col gap-6 md:hidden">
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
                fabBridgeLayout="belowXl"
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

        {/* Tablet / iPad: separate BWI summary from Calls; stack To-Do and Calls evenly on the right. */}
        <div
          className={cn(
            "hidden md:grid md:items-start md:gap-4",
            showBwi ? "md:grid-cols-3" : "md:grid-cols-2"
          )}
        >
          <div className="min-w-0 min-h-0">
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
            <div className="min-w-0 min-h-0">
              <VisitHistory
                userId={userId}
                onVisitClick={onVisitClick}
                onNavigateToBusinessWithStatus={onNavigateToBusinessWithStatus}
                bwiAreaFilter={bwiAreaFilter}
                onBwiAreaChange={onBwiAreaChange}
                presentation="summary"
              />
            </div>
          ) : null}
          <div
            className={cn(
              "grid min-w-0 min-h-0 gap-4 md:h-[calc(100lvh-max(env(safe-area-inset-top),var(--device-safe-top,0px))-224px)] md:min-h-[480px]",
              showBwi ? "grid-rows-2" : "grid-rows-1"
            )}
          >
            <HomeTodoCard
              userId={userId}
              fabBridgeLayout="xlAndUp"
              onNavigateToTodoCall={onNavigateToTodoCall}
              className="h-full min-h-0"
            />
            {showBwi ? (
              <VisitHistory
                userId={userId}
                onVisitClick={onVisitClick}
                onNavigateToBusinessWithStatus={onNavigateToBusinessWithStatus}
                bwiAreaFilter={bwiAreaFilter}
                onBwiAreaChange={onBwiAreaChange}
                fabBridgeLayout="xlAndUp"
                presentation="calls"
                className="h-full min-h-0"
              />
            ) : null}
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