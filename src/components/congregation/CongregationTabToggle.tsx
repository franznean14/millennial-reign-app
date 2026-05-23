"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BookOpen, Briefcase, Settings, ChevronLeft, Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStatusTitleColor } from "@/lib/utils/status-hierarchy";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "motion/react";
import { studyBibleSectionToggle } from "@/lib/theme/study-bible-dark";

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
    <div className={cn(studyBibleSectionToggle.shell, "h-full min-h-0", className)}>
      <AnimatePresence mode="wait">
        {isDetailsView ? (
          <motion.div
            key="details-view"
            initial={{ opacity: 0, filter: "blur(6px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(6px)" }}
            transition={{ duration: 0.2 }}
            className="flex h-full min-h-0 w-full items-center gap-1"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackClick}
              className={studyBibleSectionToggle.ghostSideButton}
            >
              <ChevronLeft className="h-4 w-4 flex-shrink-0" />
            </Button>
            <div className="flex h-full min-h-0 flex-[2] min-w-0 items-center justify-center bg-transparent px-3">
              <span className={cn("text-lg font-bold truncate w-full text-center pointer-events-none", titleColorClass)}>
                {detailsName}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEditClick}
              className={studyBibleSectionToggle.ghostSideButton}
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
            className="h-full min-h-0 w-full"
          >
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(newValue) => {
        if (newValue) {
            onValueChange(newValue as 'meetings' | 'ministry' | 'admin');
        }
      }}
        className={studyBibleSectionToggle.group}
    >
      <ToggleGroupItem
        value="meetings"
        className={cn(studyBibleSectionToggle.item, studyBibleSectionToggle.itemIcon)}
      >
        <BookOpen className="h-4 w-4 flex-shrink-0" />
          <span className="text-[10px] font-medium text-center">Meetings</span>
      </ToggleGroupItem>
      <ToggleGroupItem
        value="ministry"
        className={cn(studyBibleSectionToggle.item, studyBibleSectionToggle.itemIcon)}
      >
        <Briefcase className="h-4 w-4 flex-shrink-0" />
          <span className="text-[10px] font-medium text-center">Ministry</span>
        </ToggleGroupItem>
        {isElder && (
          <ToggleGroupItem
            value="admin"
            className={cn(studyBibleSectionToggle.item, studyBibleSectionToggle.itemIcon)}
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
