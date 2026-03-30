"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BarChart3, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className={cn("bg-background/95 backdrop-blur-sm border p-0.1 rounded-lg shadow-lg w-full relative overflow-hidden", className)}>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(newValue) => {
          if (newValue) {
            onValueChange(newValue as 'summary' | 'events');
          }
        }}
        className="w-full h-full"
      >
        <ToggleGroupItem 
          value="summary" 
          className="data-[state=on]:!bg-primary data-[state=on]:!text-primary-foreground data-[state=on]:shadow-sm flex-1 px-3 py-6 min-w-0 w-full flex flex-col items-center justify-center gap-1 transition-colors"
        >
          <BarChart3 className="h-4 w-4 flex-shrink-0" />
          <span className="text-[10px] font-medium text-center">Summary</span>
        </ToggleGroupItem>
        <ToggleGroupItem 
          value="events" 
          className="data-[state=on]:!bg-primary data-[state=on]:!text-primary-foreground data-[state=on]:shadow-sm flex-1 px-3 py-6 min-w-0 w-full flex flex-col items-center justify-center gap-1 transition-colors"
        >
          <Calendar className="h-4 w-4 flex-shrink-0" />
          <span className="text-[10px] font-medium text-center">Events</span>
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
