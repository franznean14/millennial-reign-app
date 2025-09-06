"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Filter, User, UserCheck, LayoutGrid, List, Table as TableIcon } from "lucide-react";
import type { BusinessFiltersState } from "@/lib/db/business";
import { businessEventBus } from "@/lib/events/business-events";

interface BusinessControlsBarProps {
  filters: BusinessFiltersState;
  onFiltersChange: (filters: BusinessFiltersState) => void;
  onOpenFilters: () => void;
  viewMode: 'detailed' | 'compact' | 'table';
  onCycleViewMode: () => void;
}

export function BusinessControlsBar({ filters, viewMode }: BusinessControlsBarProps) {
  const [myOnly, setMyOnly] = useState<boolean>(!!filters.myEstablishments);
  const [mode, setMode] = useState<'detailed' | 'compact' | 'table'>(viewMode);

  // Keep in sync with AppClient state
  useEffect(() => {
    const handleState = (payload: any) => {
      if (payload && typeof payload === 'object') {
        if (typeof payload.myEstablishments === 'boolean') setMyOnly(!!payload.myEstablishments);
        if (payload.viewMode) setMode(payload.viewMode);
      }
    };
    businessEventBus.subscribe('business_controls_state', handleState as any);
    return () => businessEventBus.unsubscribe('business_controls_state', handleState as any);
  }, []);

  return (
    <div className="sticky z-10 w-full bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/50 pt-2 pb-0">
      <div className="mx-auto max-w-screen-lg h-12 px-4 flex items-center justify-end gap-2">
        <Button
          type="button"
          variant={myOnly ? "default" : "outline"}
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={() => businessEventBus.emit('business_controls_action', { action: 'toggle_my' })}
          aria-pressed={!!myOnly}
          aria-label="My establishments"
          title="My establishments"
        >
          {myOnly ? <UserCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={() => businessEventBus.emit('business_controls_action', { action: 'open_filters' })}
          title="Filters"
        >
          <Filter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={() => businessEventBus.emit('business_controls_action', { action: 'cycle_view' })}
          title={`View: ${mode}`}
        >
          {mode === 'detailed' && <LayoutGrid className="h-4 w-4" />}
          {mode === 'compact' && <List className="h-4 w-4" />}
          {mode === 'table' && <TableIcon className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}


