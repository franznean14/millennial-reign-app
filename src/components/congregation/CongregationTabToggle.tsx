"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BookOpen, Briefcase } from "lucide-react";
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
      className={cn("bg-background/95 backdrop-blur-sm border p-0.1 rounded-lg shadow-lg w-full", className)}
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
    </ToggleGroup>
  );
}
