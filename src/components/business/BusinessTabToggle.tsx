"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Building2, Users, MapPin, ChevronLeft, Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "motion/react";

interface BusinessTabToggleProps {
  value: 'establishments' | 'householders' | 'map';
  onValueChange: (value: 'establishments' | 'householders' | 'map') => void;
  onClearStatusFilters: () => void;
  className?: string;
  isDetailsView?: boolean;
  detailsName?: string;
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
  onBackClick,
  onEditClick
}: BusinessTabToggleProps) {
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
            {/* Back Button - Left */}
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackClick}
              className="flex-shrink-0 px-3 py-6 h-full flex items-center justify-center transition-colors hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4 flex-shrink-0" />
            </Button>
            
            {/* Name - Middle (wider, plain text, no button feel) */}
            <div className="flex-[2] min-w-0 px-3 py-6 flex items-center justify-center bg-transparent border-none">
              <span className="text-sm font-semibold text-foreground truncate w-full text-center pointer-events-none">
                {detailsName}
              </span>
            </div>
            
            {/* Edit Button - Right */}
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
                  onValueChange(newValue as 'establishments' | 'householders' | 'map');
                }
              }}
              className="w-full h-full"
            >
              <ToggleGroupItem 
                value="establishments" 
                className="data-[state=on]:!bg-primary data-[state=on]:!text-primary-foreground data-[state=on]:shadow-sm flex-1 px-3 py-6 min-w-0 w-full flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <Building2 className="h-4 w-4 flex-shrink-0" />
                <span className="text-[10px] font-medium text-center">Establishments</span>
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="householders" 
                className="data-[state=on]:!bg-primary data-[state=on]:!text-primary-foreground data-[state=on]:shadow-sm flex-1 px-3 py-6 min-w-0 w-full flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <Users className="h-4 w-4 flex-shrink-0" />
                <span className="text-[10px] font-medium text-center">Householders</span>
              </ToggleGroupItem>
              <ToggleGroupItem 
                value="map" 
                className="data-[state=on]:!bg-primary data-[state=on]:!text-primary-foreground data-[state=on]:shadow-sm flex-1 px-3 py-6 min-w-0 w-full flex flex-col items-center justify-center gap-1 transition-colors"
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
