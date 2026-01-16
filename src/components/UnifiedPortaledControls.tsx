"use client";

import { PortaledBusinessControls } from "@/components/business/PortaledBusinessControls";
import { PortaledCongregationControls } from "@/components/congregation/PortaledCongregationControls";
import type { BusinessFiltersState, EstablishmentWithDetails, HouseholderWithDetails } from "@/lib/db/business";

interface UnifiedPortaledControlsProps {
  currentSection: string;
  // Business props
  businessTab?: 'establishments' | 'householders' | 'map';
  onBusinessTabChange?: (tab: 'establishments' | 'householders' | 'map') => void;
  filters?: BusinessFiltersState;
  onFiltersChange?: (filters: BusinessFiltersState) => void;
  onOpenFilters?: () => void;
  viewMode?: 'detailed' | 'compact' | 'table';
  onCycleViewMode?: () => void;
  onClearSearch?: () => void;
  onRemoveStatus?: (status: string) => void;
  onRemoveArea?: (area: string) => void;
  onRemoveFloor?: (floor: string) => void;
  onClearMyEstablishments?: () => void;
  onClearAllFilters?: () => void;
  onToggleNearMe?: () => void;
  formatStatusLabel?: (status: string) => string;
  selectedEstablishment?: EstablishmentWithDetails | null;
  selectedHouseholder?: HouseholderWithDetails | null;
  onBackClick?: () => void;
  onEditClick?: () => void;
  // Congregation props
  congregationTab?: 'meetings' | 'ministry';
  onCongregationTabChange?: (tab: 'meetings' | 'ministry') => void;
}

export function UnifiedPortaledControls(props: UnifiedPortaledControlsProps) {
  const { currentSection } = props;
  const showBusinessControls = currentSection === 'business' || currentSection.startsWith('business-');
  const showCongregationControls = currentSection === 'congregation';

  if (showBusinessControls && props.businessTab !== undefined) {
    return (
      <PortaledBusinessControls
        businessTab={props.businessTab}
        onBusinessTabChange={props.onBusinessTabChange!}
        filters={props.filters!}
        onFiltersChange={props.onFiltersChange!}
        onOpenFilters={props.onOpenFilters!}
        viewMode={props.viewMode!}
        onCycleViewMode={props.onCycleViewMode!}
        isVisible={!props.selectedEstablishment && !props.selectedHouseholder}
        onClearSearch={props.onClearSearch!}
        onRemoveStatus={props.onRemoveStatus!}
        onRemoveArea={props.onRemoveArea!}
        onRemoveFloor={props.onRemoveFloor!}
        onClearMyEstablishments={props.onClearMyEstablishments!}
        onClearAllFilters={props.onClearAllFilters!}
        onToggleNearMe={props.onToggleNearMe!}
        formatStatusLabel={props.formatStatusLabel!}
        selectedEstablishment={props.selectedEstablishment}
        selectedHouseholder={props.selectedHouseholder}
        onBackClick={props.onBackClick!}
        onEditClick={props.onEditClick!}
      />
    );
  }

  if (showCongregationControls && props.congregationTab !== undefined) {
    return (
      <PortaledCongregationControls
        congregationTab={props.congregationTab}
        onCongregationTabChange={props.onCongregationTabChange!}
        isVisible={true}
      />
    );
  }

  return null;
}
