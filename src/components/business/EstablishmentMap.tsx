'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { EstablishmentWithDetails } from '@/lib/db/business';
import { getStatusColor, getStatusTextColor, getBestStatus } from '@/lib/utils/status-hierarchy';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, Building2, Users, Crosshair } from 'lucide-react';

// Dynamically import MapContainer to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);

const MarkerClusterGroup = dynamic(
  () => import('react-leaflet-markercluster').then((mod) => mod.default),
  { ssr: false }
) as any;

// Custom locate control component
const LocateControl = () => {
  useEffect(() => {
    const handleLocate = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            // Find the map instance using Leaflet's global registry
            const mapContainers = document.querySelectorAll('.leaflet-container');
            if (mapContainers.length > 0) {
              const mapContainer = mapContainers[mapContainers.length - 1];
              const map = (mapContainer as any)._leaflet;
              if (map && map.setView) {
                map.setView([latitude, longitude], 15);
              }
            }
          },
          (error) => {
            console.error('Error getting location:', error);
          }
        );
      }
    };

    // Add the locate button to the DOM
    const locateButton = document.createElement('div');
    locateButton.className = 'leaflet-control-locate';
    locateButton.innerHTML = '<a href="#" title="Locate me"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg></a>';
    
    const link = locateButton.querySelector('a');
    if (link) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        handleLocate();
      });
    }

    document.body.appendChild(locateButton);

    return () => {
      // Cleanup
      if (document.body.contains(locateButton)) {
        document.body.removeChild(locateButton);
      }
    };
  }, []);

  return null;
};


const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);

const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
);



// Component to disable geolocation and other unwanted features
function MapInitializer() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Disable any geolocation requests
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition = () => 0;
      navigator.geolocation.watchPosition = () => 0;
    }
    
    // Remove any existing geolocation markers
    const waitForMap = () => {
      const mapElement = document.querySelector('.leaflet-container');
      if (!mapElement) {
        setTimeout(waitForMap, 100);
        return;
      }
      
      const map = (mapElement as any)._leaflet_map;
      if (!map) {
        setTimeout(waitForMap, 100);
        return;
      }
      
      // Remove any geolocation layers
      setTimeout(() => {
        map.eachLayer((layer: any) => {
          if (layer.options && layer.options.icon && 
              (layer.options.icon.options.className === 'leaflet-control-locate-location-marker' ||
               layer.options.icon.options.className === 'leaflet-control-locate-location-marker-active')) {
            map.removeLayer(layer);
          }
        });
      }, 1000);
    };
    
    waitForMap();
    
  }, []);
  
  return null;
}

// Component to handle map bounds fitting
function MapBoundsFitter({ establishments }: { establishments: EstablishmentWithDetails[] }) {
  const establishmentsWithCoords = establishments.filter(est => est.lat && est.lng);
  
  useEffect(() => {
    if (typeof window === 'undefined' || establishmentsWithCoords.length === 0) return;
    
    // Wait for the map to be ready
    const waitForMap = () => {
      const mapElement = document.querySelector('.leaflet-container');
      if (!mapElement) {
        setTimeout(waitForMap, 100);
        return;
      }
      
      // Find the map instance
      const map = (mapElement as any)._leaflet_map;
      if (!map) {
        setTimeout(waitForMap, 100);
        return;
      }
      
      // Wait a bit more for the map to be fully initialized
      setTimeout(() => {
        const L = require('leaflet');
        
        // Calculate bounds
        const lats = establishmentsWithCoords.map(est => est.lat!);
        const lngs = establishmentsWithCoords.map(est => est.lng!);
        
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        
        // Add padding (smaller padding for tighter fit)
        const latPadding = Math.max((maxLat - minLat) * 0.2, 0.001);
        const lngPadding = Math.max((maxLng - minLng) * 0.2, 0.001);
        
        const bounds = L.latLngBounds(
          [minLat - latPadding, minLng - lngPadding],
          [maxLat + latPadding, maxLng + lngPadding]
        );
        
        // Fit the map to the bounds with minimal padding
        map.fitBounds(bounds, { padding: [10, 10], maxZoom: 18 });
        
        console.log('Map bounds fitted to establishments:', bounds);
      }, 500);
    };
    
    waitForMap();
    
  }, [establishmentsWithCoords]);
  
  return null;
}

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
  // Get the best status from the statuses array using the hierarchy
  const primaryStatus = getBestStatus(establishment.statuses || []);
  
  // Extract color values from the status hierarchy functions
  const getStatusColorValue = (status: string) => {
    switch (status) {
      case 'declined_rack':
        return '#ef4444'; // red-500
      case 'for_scouting':
        return '#6b7280'; // gray-500
      case 'for_follow_up':
        return '#f97316'; // orange-500
      case 'accepted_rack':
        return '#3b82f6'; // blue-500
      case 'for_replenishment':
        return '#a855f7'; // purple-500
      case 'has_bible_studies':
        return '#10b981'; // emerald-500
      default:
        return '#6b7280'; // gray-500
    }
  };
  
  const statusColor = getStatusColorValue(primaryStatus);
  const textColor = getStatusColorValue(primaryStatus);
  
  // Create custom icon
  const createCustomIcon = () => {
    if (typeof window === 'undefined') return null;
    
    const L = require('leaflet');
    
    // Get darker shade of the status color for fill
    const getDarkerShade = (color: string) => {
      switch (color) {
        case '#ef4444': return '#dc2626'; // red-600
        case '#6b7280': return '#4b5563'; // gray-600
        case '#f97316': return '#ea580c'; // orange-600
        case '#3b82f6': return '#2563eb'; // blue-600
        case '#a855f7': return '#9333ea'; // purple-600
        case '#10b981': return '#059669'; // emerald-600
        default: return '#4b5563'; // gray-600
      }
    };
    
    const darkerColor = getDarkerShade(statusColor);
    
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="marker-container ${isSelected ? 'selected' : ''}" style="
          position: relative;
          transform: translate(-50%, -50%);
          transition: all 0.2s ease;
          ${isSelected ? 'outline: 2px solid #ffffff; outline-offset: 4px;' : ''}
        ">
          <!-- Badge with establishment name - matching popup badge design -->
          <div style="
            background-color: ${darkerColor}15;
            color: ${statusColor};
            border: 1px solid ${statusColor}30;
            border-radius: 12px;
            padding: 4px 8px;
            font-size: 11px;
            font-weight: 500;
            font-family: system-ui, -apple-system, sans-serif;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            max-width: 120px;
            text-overflow: ellipsis;
            overflow: hidden;
          " title="${establishment.name}">
            ${establishment.name.length > 12 ? establishment.name.substring(0, 12) + '...' : establishment.name}
          </div>
        </div>
      `,
      iconSize: [120, 24],
      iconAnchor: [60, 12],
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
        click: (e) => {
          // Don't call onClick here, let the popup handle it
          e.target.openPopup();
        },
      }}
    >
      <Popup 
        closeButton={false}
        offset={[0, -15]}
        autoPan={false}
      >
        <div 
          className={cn("min-w-[280px] max-w-[320px] cursor-pointer hover:shadow-xl transition-shadow p-4", getStatusColor(primaryStatus))}
          onClick={(e) => {
            e.stopPropagation();
            onClick?.();
          }}
        >
          {/* Header */}
          <div className="pb-3">
            <div className="flex items-start justify-between w-full gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold flex flex-col gap-2 w-full">
                  <span className="truncate" title={establishment.name}>{establishment.name}</span>
                  
                  {/* Status Badge with Hierarchy */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge 
                      variant="outline" 
                      className={`text-xs px-2 py-1 ${getStatusTextColor(primaryStatus)}`}
                    >
                      {primaryStatus.replace(/_/g, ' ')}
                    </Badge>
                  </div>
                </div>
                
                {/* Area label below the status badge */}
                {establishment.area && (
                  <div className="mt-2 text-sm font-medium text-muted-foreground">{establishment.area}</div>
                )}
              </div>
              
              {/* Stats */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <p className="text-sm font-medium">{establishment.visit_count || 0}</p>
                  <p className="text-xs text-muted-foreground">Visits</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{establishment.householder_count || 0}</p>
                  <p className="text-xs text-muted-foreground">BS</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="pt-0">
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* Overlapping avatars for top visitors - up to 3 */}
                {establishment.top_visitors && establishment.top_visitors.length > 0 && (
                  <div className="flex items-center flex-shrink-0">
                    {establishment.top_visitors.slice(0, 3).map((visitor, index) => (
                      <Avatar 
                        key={visitor.user_id || index} 
                        className={`h-6 w-6 ring-2 ring-background ${index > 0 ? '-ml-2' : ''}`}
                      >
                        <AvatarImage src={visitor.avatar_url} />
                        <AvatarFallback className="text-xs">
                          {`${visitor.first_name} ${visitor.last_name}`.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {establishment.top_visitors.length > 3 && (
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-1">
                        +{establishment.top_visitors.length - 3}
                      </span>
                    )}
                  </div>
                )}
                {establishment.description && (
                  <span className="text-xs text-muted-foreground truncate">{establishment.description}</span>
                )}
              </div>
              {establishment.floor && (
                <span className="text-xs text-muted-foreground flex-shrink-0">{establishment.floor}</span>
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
    console.log('EstablishmentMap: Client-side rendering enabled');
  }, []);

  // Filter establishments with valid coordinates
  const establishmentsWithCoords = establishments.filter(
    (est) => est.lat && est.lng
  );

  console.log('EstablishmentMap: Total establishments:', establishments.length);
  console.log('EstablishmentMap: Establishments with coords:', establishmentsWithCoords.length);
  console.log('EstablishmentMap: isClient:', isClient);


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
      <div className={`w-full h-full bg-muted flex items-center justify-center ${className}`}>
        <div className="text-center">
          <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  if (establishmentsWithCoords.length === 0) {
    return (
      <div className={`w-full h-full bg-muted flex items-center justify-center ${className}`}>
        <div className="text-center">
          <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No establishments with coordinates found</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full ${className || 'h-96'}`} style={{ height: '100%', width: '100%' }}>
      <MapContainer
        center={getMapCenter() as [number, number]}
        zoom={establishmentsWithCoords.length > 0 ? 14 : 13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
        maxZoom={22}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          subdomains={['a', 'b', 'c', 'd']}
          maxZoom={22}
        />
        
        {/* Component to disable geolocation and unwanted features */}
        <MapInitializer />
        
        {/* Custom locate control */}
        <LocateControl />
        
        {/* Component to fit map bounds to establishments */}
        <MapBoundsFitter establishments={establishments} />
        
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={50}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
          zoomToBoundsOnClick={true}
          iconCreateFunction={(cluster: any) => {
            const count = cluster.getChildCount();
            const L = require('leaflet');
            
            // Get the most common status color from markers in this cluster
            let clusterColor = '#3b82f6'; // default blue
            const markers = cluster.getAllChildMarkers();
            if (markers.length > 0) {
              // Try to get status color from first marker
              const firstMarker = markers[0];
              const markerElement = firstMarker.getElement();
              if (markerElement) {
                const container = markerElement.querySelector('.marker-container');
                if (container) {
                  const style = window.getComputedStyle(container);
                  clusterColor = style.backgroundColor || '#3b82f6';
                }
              }
            }
            
              return L.divIcon({
                className: 'custom-cluster',
                html: `
                  <div style="
                    background: transparent;
                    color: #ffffff;
                    border: 3px solid rgba(255,255,255,0.3);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    border-radius: 50%;
                    width: 44px;
                    height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 18px;
                    font-weight: 900;
                    box-shadow: 0 6px 24px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.1);
                    transform: translate(-50%, -50%);
                    transition: all 0.2s ease;
                  ">
                    ${count}
                  </div>
                `,
                iconSize: [44, 44],
                iconAnchor: [22, 22],
              });
          }}
        >
          {establishmentsWithCoords.map((establishment) => (
            <MapMarker
              key={establishment.id}
              establishment={establishment}
              onClick={() => onEstablishmentClick?.(establishment)}
              isSelected={establishment.id === selectedEstablishmentId}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
