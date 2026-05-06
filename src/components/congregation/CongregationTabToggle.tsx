"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BookOpen, Briefcase, Settings, ChevronLeft, Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStatusTitleColor } from "@/lib/utils/status-hierarchy";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "motion/react";
import { studyBibleDarkClasses } from "@/lib/theme/study-bible-dark";

interface CongregationTabToggleProps {
  value: 'meetings' | 'ministry' | 'admin';
  onValueChange: (value: 'meetings' | 'ministry' | 'admin') => void;
  className?: string;
  isElder?: boolean;
  isDetailsView?: boolean;
  detailsName?: string;
  /** Householder status; used to color-code the title */
  detailsStatus?: string;
  onBackClick?: () => void;
  onEditClick?: () => void;
}

export function CongregationTabToggle({
  value,
  onValueChange,
  className,
  isElder = false,
  isDetailsView = false,
  detailsName = "",
  detailsStatus,
  onBackClick,
  onEditClick
}: CongregationTabToggleProps) {
  const titleColorClass = detailsStatus ? getStatusTitleColor(detailsStatus) : "text-foreground";
  return (
    <div className={cn("bg-background/95 backdrop-blur-sm border p-0.1 rounded-lg shadow-lg w-full relative overflow-hidden", studyBibleDarkClasses.card, className)}>
      <AnimatePresence mode="wait">
        {isDetailsView ? (
          <motion.div
            key="details-view"
            initial={{ opacity: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-1 w-full h-full"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackClick}
              className="flex-shrink-0 px-3 py-6 h-full flex items-center justify-center transition-colors hover:bg-muted dark:hover:bg-[#3b3348]"
            >
              <ChevronLeft className="h-4 w-4 flex-shrink-0" />
            </Button>
            <div className="flex-[2] min-w-0 px-3 py-6 flex items-center justify-center bg-transparent border-none">
              <span className={cn("text-lg font-bold truncate w-full text-center pointer-events-none", titleColorClass)}>
                {detailsName}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEditClick}
              className="flex-shrink-0 px-3 py-6 h-full flex items-center justify-center transition-colors hover:bg-muted dark:hover:bg-[#3b3348]"
            >
              <Edit className="h-4 w-4 flex-shrink-0" />
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="normal-view"
            initial={{ opacity: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.2 }}
            className="w-full h-full"
          >
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(newValue) => {
        if (newValue) {
            onValueChange(newValue as 'meetings' | 'ministry' | 'admin');
        }
      }}
        className="w-full h-full"
    >
      <ToggleGroupItem 
        value="meetings" 
          className="data-[state=on]:!bg-primary data-[state=on]:!text-primary-foreground data-[state=on]:shadow-sm flex-1 px-3 py-6 min-w-0 w-full flex flex-col items-center justify-center gap-1 transition-colors dark:text-[#ded6e7] dark:hover:bg-[#3b3348] dark:data-[state=on]:!bg-[#80778e] dark:data-[state=on]:!text-white"
      >
        <BookOpen className="h-4 w-4 flex-shrink-0" />
          <span className="text-[10px] font-medium text-center">Meetings</span>
      </ToggleGroupItem>
      <ToggleGroupItem 
        value="ministry" 
          className="data-[state=on]:!bg-primary data-[state=on]:!text-primary-foreground data-[state=on]:shadow-sm flex-1 px-3 py-6 min-w-0 w-full flex flex-col items-center justify-center gap-1 transition-colors dark:text-[#ded6e7] dark:hover:bg-[#3b3348] dark:data-[state=on]:!bg-[#80778e] dark:data-[state=on]:!text-white"
      >
        <Briefcase className="h-4 w-4 flex-shrink-0" />
          <span className="text-[10px] font-medium text-center">Ministry</span>
        </ToggleGroupItem>
        {isElder && (
          <ToggleGroupItem 
            value="admin" 
            className="data-[state=on]:!bg-primary data-[state=on]:!text-primary-foreground data-[state=on]:shadow-sm flex-1 px-3 py-6 min-w-0 w-full flex flex-col items-center justify-center gap-1 transition-colors dark:text-[#ded6e7] dark:hover:bg-[#3b3348] dark:data-[state=on]:!bg-[#80778e] dark:data-[state=on]:!text-white"
          >
            <Settings className="h-4 w-4 flex-shrink-0" />
            <span className="text-[10px] font-medium text-center">Admin</span>
      </ToggleGroupItem>
        )}
    </ToggleGroup>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
