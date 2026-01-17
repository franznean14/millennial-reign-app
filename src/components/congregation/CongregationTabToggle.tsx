"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BookOpen, Briefcase, Settings, ChevronLeft, Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "motion/react";

interface CongregationTabToggleProps {
  value: 'meetings' | 'ministry' | 'admin';
  onValueChange: (value: 'meetings' | 'ministry' | 'admin') => void;
  className?: string;
  isElder?: boolean;
  isDetailsView?: boolean;
  detailsName?: string;
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
  onBackClick,
  onEditClick
}: CongregationTabToggleProps) {
  return (
    <div className={cn("bg-background/95 backdrop-blur-sm border p-0.1 rounded-lg shadow-lg w-full relative overflow-hidden", className)}>
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
              className="flex-shrink-0 px-3 py-6 h-full flex items-center justify-center transition-colors hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4 flex-shrink-0" />
            </Button>
            <div className="flex-[2] min-w-0 px-3 py-6 flex items-center justify-center bg-transparent border-none">
              <span className="text-sm font-semibold text-foreground truncate w-full text-center pointer-events-none">
                {detailsName}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onEditClick}
              className="flex-shrink-0 px-3 py-6 h-full flex items-center justify-center transition-colors hover:bg-muted"
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
                className="data-[state=on]:!bg-primary data-[state=on]:!text-primary-foreground data-[state=on]:shadow-sm flex-1 px-3 py-6 min-w-0 w-full flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <BookOpen className="h-4 w-4 flex-shrink-0" />
                <span className="text-[10px] font-medium text-center">Meetings</span>
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="ministry" 
                className="data-[state=on]:!bg-primary data-[state=on]:!text-primary-foreground data-[state=on]:shadow-sm flex-1 px-3 py-6 min-w-0 w-full flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <Briefcase className="h-4 w-4 flex-shrink-0" />
                <span className="text-[10px] font-medium text-center">Ministry</span>
              </ToggleGroupItem>
              {isElder && (
                <ToggleGroupItem 
                  value="admin" 
                  className="data-[state=on]:!bg-primary data-[state=on]:!text-primary-foreground data-[state=on]:shadow-sm flex-1 px-3 py-6 min-w-0 w-full flex flex-col items-center justify-center gap-1 transition-colors"
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
