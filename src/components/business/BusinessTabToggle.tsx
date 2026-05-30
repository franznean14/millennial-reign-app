"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Building2, Users, MapPin, ChevronLeft, Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStatusTitleColor } from "@/lib/utils/status-hierarchy";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "motion/react";
import { studyBibleSectionToggle } from "@/lib/theme/study-bible-dark";

interface BusinessTabToggleProps {
  value: 'establishments' | 'contacts' | 'map';
  onValueChange: (value: 'establishments' | 'contacts' | 'map') => void;
  onClearStatusFilters: () => void;
  className?: string;
  isDetailsView?: boolean;
  detailsName?: string;
  /** Status for contact or establishment; used to color-code the title */
  detailsStatus?: string;
  onBackClick?: () => void;
  onEditClick?: () => void;
}

export function BusinessTabToggle({
  value,
  onValueChange,
  onClearStatusFilters,
  className,
  isDetailsView = false,
  detailsName = '',
  detailsStatus,
  onBackClick,
  onEditClick
}: BusinessTabToggleProps) {
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
            {/* Back Button - Left */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackClick}
              className={studyBibleSectionToggle.ghostSideButton}
            >
              <ChevronLeft className="h-4 w-4 flex-shrink-0" />
            </Button>
            
            {/* Name - Middle (wider, plain text, no button feel) */}
            <div className="flex h-full min-h-0 flex-[2] min-w-0 items-center justify-center bg-transparent px-3">
              <span className={cn("text-lg font-bold truncate w-full text-center pointer-events-none", titleColorClass)}>
                {detailsName}
              </span>
            </div>
            
            {/* Edit Button - Right */}
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
                  onValueChange(newValue as 'establishments' | 'contacts' | 'map');
                }
              }}
              className={studyBibleSectionToggle.group}
            >
              <ToggleGroupItem
                value="establishments"
                className={cn(studyBibleSectionToggle.item, studyBibleSectionToggle.itemIcon)}
              >
                <Building2 className="h-4 w-4 flex-shrink-0" />
                <span className="text-[10px] font-medium text-center">Establishments</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="contacts"
                className={cn(studyBibleSectionToggle.item, studyBibleSectionToggle.itemIcon)}
              >
                <Users className="h-4 w-4 flex-shrink-0" />
                <span className="text-[10px] font-medium text-center">Contacts</span>
              </ToggleGroupItem>
              <ToggleGroupItem
                value="map"
                className={cn(studyBibleSectionToggle.item, studyBibleSectionToggle.itemIcon)}
              >
                <MapPin className="h-4 w-4 flex-shrink-0" />
                <span className="text-[10px] font-medium text-center">Map</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
