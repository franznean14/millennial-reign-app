'use client';

import { useEffect, useState, useRef } from 'react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import dynamic from 'next/dynamic';
import { useMap } from 'react-leaflet';
import { EstablishmentWithDetails } from '@/lib/db/business';
import { getStatusColor, getStatusTextColor, getBestStatus } from '@/lib/utils/status-hierarchy';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MapPin, Building2, Users, Crosshair } from 'lucide-react';

// Locate control plugin is loaded via CDN in head.tsx

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

// User location marker component
const UserLocationMarker = ({ isTracking, onDisableTracking, userLocation, setUserLocation, setWatchId, watchId }: { 
  isTracking: boolean; 
  onDisableTracking: () => void;
  userLocation: [number, number] | null;
  setUserLocation: (location: [number, number] | null) => void;
  setWatchId: (id: number | null) => void;
  watchId: number | null;
}) => {
  const map = useMap();
  const [icon, setIcon] = useState<any>(null);

  // Create custom user location icon
  const createUserLocationIcon = () => {
    if (typeof window === 'undefined') return null;
    
    const L = require('leaflet');
    
    return L.divIcon({
      className: 'user-location-marker',
      html: `
        <div style="
          position: relative;
          transform: translate(-50%, -50%);
        ">
          <!-- Outer pulsing ring -->
          <div style="
            position: absolute;
            width: 40px;
            height: 40px;
            background: rgba(59, 130, 246, 0.3);
            border: 2px solid rgba(59, 130, 246, 0.6);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            animation: pulse 2s infinite;
          "></div>
          <!-- Inner dot -->
          <div style="
            position: absolute;
            width: 12px;
            height: 12px;
            background: #3b82f6;
            border: 3px solid white;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          "></div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });
  };

  // Initialize icon
  useEffect(() => {
    setIcon(createUserLocationIcon());
  }, []);

  // Disable tracking when user manually moves the map
  useEffect(() => {
    if (!map) return;

    const handleMapMove = () => {
      // Disable tracking if user manually moved the map
      if (isTracking) {
        onDisableTracking();
      }
    };

    map.on('moveend', handleMapMove);

    return () => {
      map.off('moveend', handleMapMove);
    };
  }, [map, isTracking]);


  // Don't render if no location or icon
  if (!userLocation || !icon) return null;

  return (
    <Marker
      position={userLocation}
      icon={icon}
      zIndexOffset={1000} // Ensure it's above other markers
    />
  );
};

// Locate control component that uses useMap hook
const LocateControl = ({ onToggleTracking, isTracking, setUserLocation, setWatchId, watchId }: { 
  onToggleTracking: (tracking: boolean) => void; 
  isTracking: boolean;
  setUserLocation: (location: [number, number] | null) => void;
  setWatchId: (id: number | null) => void;
  watchId: number | null;
}) => {
  const map = useMap();
  
  const handleLocate = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported');
      return;
    }

    if (isTracking) {
      // If currently tracking, just stop tracking
      onToggleTracking(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        if (map && typeof map.setView === 'function') {
          map.setView([latitude, longitude], 18); // Increased zoom level for better detail
          
          // Enable tracking mode after centering
          onToggleTracking(true);
        } else {
          console.error('Map instance not available');
        }
      },
      (error) => {
        console.error('Error getting location:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  };

  useEffect(() => {
    if (!map) return;

    // Create the locate button and add it to the map
    const locateButton = document.createElement('button');
    const iconContainer = document.createElement('div');
    const root = createRoot(iconContainer);
    
    const updateButtonAppearance = () => {
      // Toggle colors based on tracking state
      if (isTracking) {
        locateButton.style.backgroundColor = '#3b82f6'; // Blue when tracking
        locateButton.style.color = 'white';
        locateButton.title = 'Stop tracking location';
      } else {
        locateButton.style.backgroundColor = 'white'; // White when not tracking
        locateButton.style.color = 'black';
        locateButton.title = 'Locate me';
      }
      
      // Render Crosshair icon using React
      root.render(createElement(Crosshair, { 
        size: 16, 
        strokeWidth: 2,
        style: { color: 'currentColor' }
      }));
    };
    
    updateButtonAppearance();
    
    locateButton.className = 'fixed bottom-[180px] right-5 z-[90] w-12 h-12 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform';
    locateButton.style.position = 'fixed';
    locateButton.style.bottom = '180px';
    locateButton.style.right = '20px';
    locateButton.style.zIndex = '90';
    locateButton.style.width = '48px';
    locateButton.style.height = '48px';
    locateButton.style.borderRadius = '50%';
    locateButton.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)';
    locateButton.style.display = 'flex';
    locateButton.style.alignItems = 'center';
    locateButton.style.justifyContent = 'center';
    locateButton.style.border = 'none';
    locateButton.style.cursor = 'pointer';
    locateButton.style.transition = 'all 0.2s ease';
    
    // Add icon container to button
    locateButton.appendChild(iconContainer);
    
    locateButton.addEventListener('click', handleLocate);
    locateButton.addEventListener('mouseenter', () => {
      locateButton.style.transform = 'scale(1.05)';
    });
    locateButton.addEventListener('mouseleave', () => {
      locateButton.style.transform = 'scale(1)';
    });

    document.body.appendChild(locateButton);

    // Store reference to update function for later use
    (locateButton as any).updateAppearance = updateButtonAppearance;

    // Cleanup function
    return () => {
      // Use setTimeout to avoid synchronous unmounting during render
      setTimeout(() => {
        root.unmount();
        if (document.body.contains(locateButton)) {
          document.body.removeChild(locateButton);
        }
      }, 0);
    };
  }, [map]);

  // Update button appearance when tracking state changes
  useEffect(() => {
    const locateButton = document.querySelector('.fixed.bottom-\\[180px\\].right-5') as any;
    if (locateButton && locateButton.updateAppearance) {
      locateButton.updateAppearance();
    }
  }, [isTracking]);

  // Start/stop location tracking when isTracking changes
  useEffect(() => {
    if (!map) return;

    let currentWatchId: number | null = null;

    const startLocationTracking = () => {
      if (!navigator.geolocation) {
        console.error('Geolocation is not supported');
        return;
      }

      // Get initial position
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
        },
        (error) => {
          console.error('Error getting initial location:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      );

      // Watch for position changes
      currentWatchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([latitude, longitude]);
          
          // Auto-center map on user if tracking is enabled
          if (isTracking && map && typeof map.setView === 'function') {
            map.setView([latitude, longitude], map.getZoom());
          }
        },
        (error) => {
          console.error('Error watching location:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 1000 // Update more frequently
        }
      );

      setWatchId(currentWatchId);
    };

    if (isTracking) {
      startLocationTracking();
    } else {
      // Stop tracking
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        setWatchId(null);
      }
    }

    // Cleanup
    return () => {
      if (currentWatchId) {
        navigator.geolocation.clearWatch(currentWatchId);
      }
    };
  }, [isTracking, map]);

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



// Component to initialize map features
function MapInitializer() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Map initialization is now handled by individual components
  }, []);
  
  return null;
}

// Component to handle map bounds fitting - only on initial load
function MapBoundsFitter({ 
  establishments, 
  isInitialLoad, 
  onFitted 
}: { 
  establishments: EstablishmentWithDetails[], 
  isInitialLoad: boolean,
  onFitted: () => void 
}) {
  const establishmentsWithCoords = establishments.filter(est => est.lat && est.lng);
  
  useEffect(() => {
    // Only fit bounds on initial load, not on every filter change
    if (typeof window === 'undefined' || establishmentsWithCoords.length === 0 || !isInitialLoad) return;
    
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
        
        // Notify that bounds have been fitted
        onFitted();
        
      }, 500);
    };
    
    waitForMap();
    
  }, [establishmentsWithCoords, isInitialLoad, onFitted]);
  
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
  index?: number;
}


// Custom marker component with status-based styling
function MapMarker({ establishment, onClick, isSelected, index = 0 }: MapMarkerProps) {
  // Get the best status from the statuses array using the hierarchy
  const primaryStatus = getBestStatus(establishment.statuses || []);
  
  // Extract color values from the status hierarchy functions
  const getStatusColorValue = (status: string) => {
    switch (status) {
      case 'inappropriate':
        return '#991b1b'; // red-800 (dark red)
      case 'declined_rack':
        return '#ef4444'; // red-500
      case 'for_scouting':
        return '#06b6d4'; // cyan-500
      case 'for_follow_up':
        return '#f97316'; // orange-500
      case 'accepted_rack':
        return '#3b82f6'; // blue-500
      case 'for_replenishment':
        return '#a855f7'; // purple-500
      case 'has_bible_studies':
        return '#10b981'; // emerald-500
      case 'closed':
        return '#64748b'; // slate-500
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
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: markerAppear 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 0.1}s both;
          ${isSelected ? 'outline: 2px solid #ffffff; outline-offset: 4px;' : ''}
        ">
          <!-- Badge with establishment name - matching popup badge design -->
          <div style="
            background-color: ${darkerColor}15;
            color: ${statusColor};
            border: 1px solid ${statusColor}30;
            border-radius: 12px;
            padding: 4px 8px;
            font-size: 10px;
            font-weight: 500;
            font-family: system-ui, -apple-system, sans-serif;
            text-align: center;
            white-space: nowrap;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            min-width: 60px;
            width: fit-content;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 4px;
          " title="${establishment.name}">
            ${establishment.name.length > 18 ? establishment.name.substring(0, 18) + '...' : establishment.name}
          </div>
          
          <!-- Pin icon indicating exact location -->
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="${statusColor}" 
            stroke-width="2" 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            style="
              filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
            "
          >
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      `,
      iconSize: [Math.max(establishment.name.length * 6 + 16, 60), 40],
      iconAnchor: [Math.max(establishment.name.length * 3 + 8, 30), 32],
    });
  };

  const [icon, setIcon] = useState<any>(() => createCustomIcon());

  useEffect(() => {
    setIcon(createCustomIcon());
  }, [establishment.statuses, isSelected]);

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
                      {primaryStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
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
  const [isTracking, setIsTracking] = useState(false);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const [hasInitiallyFitted, setHasInitiallyFitted] = useState(false);
  const clusterGroupRef = useRef<any>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Filter establishments with valid coordinates
  const establishmentsWithCoords = establishments.filter(
    (est) => est.lat && est.lng
  );

  // Force cluster group to clear and re-render when establishments change
  useEffect(() => {
    if (clusterGroupRef.current) {
      // Clear all markers from the cluster group
      clusterGroupRef.current.clearLayers();
    }
  }, [establishmentsWithCoords]);



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

  // Always show the map, even if no establishments with coordinates
  // This allows users to see the map area and add new establishments

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
        
        {/* Locate control */}
        <LocateControl 
          onToggleTracking={setIsTracking} 
          isTracking={isTracking}
          setUserLocation={setUserLocation}
          setWatchId={setWatchId}
          watchId={watchId}
        />
        
        {/* User location marker */}
        <UserLocationMarker 
          isTracking={isTracking} 
          onDisableTracking={() => setIsTracking(false)}
          userLocation={userLocation}
          setUserLocation={setUserLocation}
          setWatchId={setWatchId}
          watchId={watchId}
        />
        
        {/* Component to fit map bounds to establishments */}
        <MapBoundsFitter 
          establishments={establishmentsWithCoords} 
          isInitialLoad={!hasInitiallyFitted}
          onFitted={() => setHasInitiallyFitted(true)}
        />
        
        <MarkerClusterGroup
          ref={clusterGroupRef}
          key={`markers-${establishmentsWithCoords.length}-${establishmentsWithCoords.map(e => e.id).join(',')}`}
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
          {establishmentsWithCoords.map((establishment, index) => (
            <MapMarker
              key={`${establishment.id}-${establishment.statuses?.join(',') || 'no-status'}`}
              establishment={establishment}
              onClick={() => onEstablishmentClick?.(establishment)}
              isSelected={establishment.id === selectedEstablishmentId}
              index={index}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
