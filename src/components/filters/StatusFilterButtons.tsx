"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getFadedStatusColor, getSelectedStatusColor } from "@/lib/utils/status-filter-styles";

export interface StatusFilterOption {
  value: string;
  label: string;
}

interface StatusFilterButtonsProps {
  options: StatusFilterOption[];
  selected: string[];
  excluded?: string[];
  onCycle: (value: string) => void;
  className?: string;
}

export function StatusFilterButtons({
  options,
  selected,
  excluded = [],
  onCycle,
  className
}: StatusFilterButtonsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        const isExcluded = excluded.includes(option.value);
        return (
          <Button
            key={option.value}
            variant={isSelected ? "default" : "outline"}
            size="sm"
            onClick={() => onCycle(option.value)}
            className={cn(
              "h-8 border rounded-full relative overflow-hidden",
              isSelected
                ? getSelectedStatusColor(option.value)
                : getFadedStatusColor(option.value)
            )}
          >
            {option.label}
            {isExcluded && (
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 z-10"
              >
                <span className="absolute left-[-12%] right-[-12%] top-1/2 h-[2px] -translate-y-1/2 rotate-[17deg] bg-current/80" />
                <span className="absolute left-[-12%] right-[-12%] top-1/2 h-[2px] -translate-y-1/2 -rotate-[17deg] bg-current/80" />
              </span>
            )}
          </Button>
        );
      })}
    </div>
  );
}
