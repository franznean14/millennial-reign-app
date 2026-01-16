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
  onToggle: (value: string) => void;
  className?: string;
}

export function StatusFilterButtons({
  options,
  selected,
  onToggle,
  className
}: StatusFilterButtonsProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <Button
            key={option.value}
            variant="outline"
            size="sm"
            onClick={() => onToggle(option.value)}
            className={cn(
              "h-8 border rounded-full",
              isSelected
                ? getSelectedStatusColor(option.value)
                : getFadedStatusColor(option.value)
            )}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}
