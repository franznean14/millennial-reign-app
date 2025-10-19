"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Calendar, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface CongregationTabToggleProps {
  value: 'meetings' | 'ministry';
  onValueChange: (value: 'meetings' | 'ministry') => void;
  className?: string;
}

export function CongregationTabToggle({
  value,
  onValueChange,
  className
}: CongregationTabToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(newValue) => {
        if (newValue) {
          onValueChange(newValue as 'meetings' | 'ministry');
        }
      }}
      className={cn("bg-background/95 backdrop-blur-sm border p-1 rounded-lg shadow-lg", className)}
    >
      <ToggleGroupItem 
        value="meetings" 
        className="data-[state=on]:bg-background data-[state=on]:shadow-sm flex-1 px-3 py-2 min-w-0"
      >
        <Calendar className="h-4 w-4 mr-1 flex-shrink-0" />
        <span className="truncate">Meetings</span>
      </ToggleGroupItem>
      <ToggleGroupItem 
        value="ministry" 
        className="data-[state=on]:bg-background data-[state=on]:shadow-sm flex-1 px-3 py-2 min-w-0"
      >
        <Users className="h-4 w-4 mr-1 flex-shrink-0" />
        <span className="truncate">Ministry</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
