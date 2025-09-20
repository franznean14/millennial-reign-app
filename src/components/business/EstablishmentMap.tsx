'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { EstablishmentWithDetails } from '@/lib/db/types';
import { getStatusColor, getStatusTextColor } from '@/lib/utils/status-hierarchy';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Building2, Users } from 'lucide-react';

// Dynamically import MapContainer to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);

const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);

const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);

interface EstablishmentMapProps {
  establishments: EstablishmentWithDetails[];
  onEstablishmentClick?: (establishment: EstablishmentWithDetails) => void;
  selectedEstablishmentId?: string;
  className?: string;
}

interface MapMarkerProps {
  establishment: EstablishmentWithDetails;
  onClick?: () => void;
  isSelected?: boolean;
}

// Custom marker component with status-based styling
function MapMarker({ establishment, onClick, isSelected }: MapMarkerProps) {
  // Get the best status from the statuses array
  const primaryStatus = establishment.statuses && establishment.statuses.length > 0 
    ? establishment.statuses[0] // Use first status for now, could implement getBestStatus logic
    : 'for_scouting';
  const statusColor = getStatusColor(primaryStatus);
  const textColor = getStatusTextColor(primaryStatus);
  
  // Create custom icon
  const createCustomIcon = () => {
    if (typeof window === 'undefined') return null;
    
    const L = require('leaflet');
    
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="marker-container ${isSelected ? 'selected' : ''}" style="
          background-color: ${statusColor};
          color: ${textColor};
          border: 2px solid ${isSelected ? '#ffffff' : statusColor};
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: bold;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          transform: translate(-50%, -50%);
          transition: all 0.2s ease;
        ">
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  const [icon, setIcon] = useState<any>(null);

  useEffect(() => {
    setIcon(createCustomIcon());
  }, [establishment.statuses, isSelected]);

  if (!icon) return null;

  return (
    <Marker
      position={[establishment.lat!, establishment.lng!]}
      icon={icon}
      eventHandlers={{
        click: onClick,
      }}
    >
      <Popup>
        <div className="p-2 min-w-[200px]">
          <div className="flex items-start gap-2">
            <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div className="flex-1">
              <h3 className="font-semibold text-sm">{establishment.name}</h3>
              {establishment.area && (
                <p className="text-xs text-muted-foreground">{establishment.area}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <Badge 
                  variant="secondary" 
                  className="text-xs"
                  style={{ 
                    backgroundColor: statusColor + '20',
                    color: statusColor,
                    border: `1px solid ${statusColor}40`
                  }}
                >
                  {primaryStatus.replace(/_/g, ' ')}
                </Badge>
              </div>
              {establishment.householders && establishment.householders.length > 0 && (
                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" />
                  {establishment.householders.length} householder{establishment.householders.length !== 1 ? 's' : ''}
                </div>
              )}
              {onClick && (
                <Button 
                  size="sm" 
                  className="mt-2 w-full"
                  onClick={onClick}
                >
                  View Details
                </Button>
              )}
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export function EstablishmentMap({ 
  establishments, 
  onEstablishmentClick, 
  selectedEstablishmentId,
  className = ""
}: EstablishmentMapProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Filter establishments with valid coordinates
  const establishmentsWithCoords = establishments.filter(
    (est) => est.lat && est.lng
  );

  // Calculate map center from establishments or use default
  const getMapCenter = () => {
    if (establishmentsWithCoords.length === 0) {
      return [14.5995, 120.9842]; // Default to Manila, Philippines
    }
    
    const avgLat = establishmentsWithCoords.reduce((sum, est) => sum + est.lat!, 0) / establishmentsWithCoords.length;
    const avgLng = establishmentsWithCoords.reduce((sum, est) => sum + est.lng!, 0) / establishmentsWithCoords.length;
    
    return [avgLat, avgLng];
  };

  if (!isClient) {
    return (
      <div className={`w-full h-96 bg-muted rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center">
          <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  if (establishmentsWithCoords.length === 0) {
    return (
      <div className={`w-full h-96 bg-muted rounded-lg flex items-center justify-center ${className}`}>
        <div className="text-center">
          <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No establishments with coordinates found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className || 'h-96'} rounded-lg overflow-hidden border`}>
      <MapContainer
        center={getMapCenter() as [number, number]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {establishmentsWithCoords.map((establishment) => (
          <MapMarker
            key={establishment.id}
            establishment={establishment}
            onClick={() => onEstablishmentClick?.(establishment)}
            isSelected={establishment.id === selectedEstablishmentId}
          />
        ))}
      </MapContainer>
    </div>
  );
}
