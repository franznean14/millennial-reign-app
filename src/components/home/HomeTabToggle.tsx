"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BarChart3, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { studyBibleSectionToggle } from "@/lib/theme/study-bible-dark";

interface HomeTabToggleProps {
  value: 'summary' | 'events';
  onValueChange: (value: 'summary' | 'events') => void;
  className?: string;
}

export function HomeTabToggle({
  value,
  onValueChange,
  className
}: HomeTabToggleProps) {
  return (
    <div className={cn(studyBibleSectionToggle.shell, "h-full min-h-0", className)}>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(newValue) => {
          if (newValue) {
            onValueChange(newValue as 'summary' | 'events');
          }
        }}
        className={studyBibleSectionToggle.group}
      >
        <ToggleGroupItem
          value="summary"
          className={cn(studyBibleSectionToggle.item, studyBibleSectionToggle.itemIcon)}
        >
          <BarChart3 className="h-4 w-4 flex-shrink-0" />
          <span className="text-[10px] font-medium text-center">Summary</span>
        </ToggleGroupItem>
        <ToggleGroupItem
          value="events"
          className={cn(studyBibleSectionToggle.item, studyBibleSectionToggle.itemIcon)}
        >
          <Calendar className="h-4 w-4 flex-shrink-0" />
          <span className="text-[10px] font-medium text-center">Events</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
