"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Building2, Users, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface BusinessTabToggleProps {
  value: 'establishments' | 'householders' | 'map';
  onValueChange: (value: 'establishments' | 'householders' | 'map') => void;
  onClearStatusFilters: () => void;
  className?: string;
}

export function BusinessTabToggle({
  value,
  onValueChange,
  onClearStatusFilters,
  className
}: BusinessTabToggleProps) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(newValue) => {
        if (newValue) {
          onValueChange(newValue as 'establishments' | 'householders' | 'map');
          onClearStatusFilters();
        }
      }}
      className={cn("bg-background/95 backdrop-blur-sm border p-1 rounded-lg shadow-lg", className)}
    >
      <ToggleGroupItem 
        value="establishments" 
        className="data-[state=on]:bg-background data-[state=on]:shadow-sm flex-1 px-3 py-2"
      >
        <Building2 className="h-4 w-4 mr-1" />
        Establishments
      </ToggleGroupItem>
      <ToggleGroupItem 
        value="householders" 
        className="data-[state=on]:bg-background data-[state=on]:shadow-sm flex-1 px-3 py-2"
      >
        <Users className="h-4 w-4 mr-1" />
        Householders
      </ToggleGroupItem>
      <ToggleGroupItem 
        value="map" 
        className="data-[state=on]:bg-background data-[state=on]:shadow-sm flex-1 px-3 py-2"
      >
        <MapPin className="h-4 w-4 mr-1" />
        Map
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
