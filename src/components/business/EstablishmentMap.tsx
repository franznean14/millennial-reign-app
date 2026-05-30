"use client";

import { useEffect, useLayoutEffect, useMemo, useState, useRef, useCallback, type JSX } from "react";
import type { FeatureCollection, Feature, Geometry, Point } from "geojson";
import type { MapLayerMouseEvent, StyleSpecification, GeoJSONSource } from "maplibre-gl";
import maplibregl from "maplibre-gl";
import MapGl, {
  Source,
  Layer,
  NavigationControl,
  GeolocateControl,
  Marker,
} from "@vis.gl/react-maplibre";

import type { MapRef } from "@vis.gl/react-maplibre";
import { EstablishmentWithDetails } from "@/lib/db/business";
import { STATUS_HIERARCHY, getStatusTextColor, getBestStatus } from "@/lib/utils/status-hierarchy";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin } from "lucide-react";
import {
  ensureEstablishmentLabelBackgroundImages,
  establishmentLabelBgImageId,
} from "@/lib/map/establishment-label-bg";

const PERSONAL_TERRITORY_STATUS = "personal_territory";

const CLUSTER_MAX_ZOOM = 16;
const CLUSTER_RADIUS = 56;
/** Show names only once clustering has ended (MapLibre clusters up through `clusterMaxZoom`). */
const MIN_ZOOM_ESTABLISHMENT_LABELS = CLUSTER_MAX_ZOOM + 1;

type EstGeoFeatureCollection = FeatureCollection<Point>;

type EstablishmentGeoJsonBundle = {
  status: string;
  segment: string;
  sourceId: string;
  clusterLayerId: string;
  countLayerId: string;
  unclusteredLayerId: string;
  unclusteredLabelLayerId: string;
  colorHex: string;
  geojson: EstGeoFeatureCollection;
};

/** MapLibre source / layer IDs must avoid reserved characters */
function sanitizeStatusSegment(status: string): string {
  return status.replace(/[^a-zA-Z0-9_]/g, "_");
}

function getEstablishmentPrimaryStatus(establishment: EstablishmentWithDetails): string {
  return establishment.publisher_id ? PERSONAL_TERRITORY_STATUS : getBestStatus(establishment.statuses || []);
}

function getStatusColorValue(status: string): string {
  switch (status) {
    case PERSONAL_TERRITORY_STATUS:
      return "#f472b6";
    case "inappropriate":
      return "#991b1b";
    case "declined_rack":
      return "#ef4444";
    case "for_scouting":
      return "#06b6d4";
    case "for_follow_up":
      return "#f97316";
    case "accepted_rack":
      return "#3b82f6";
    case "for_replenishment":
      return "#a855f7";
    case "has_bible_studies":
      return "#10b981";
    case "closed":
      return "#64748b";
    case "on_hold":
      return "#57534e";
    default:
      return "#6b7280";
  }
}

function getStatusDotColorClass(status: string): string {
  switch (status) {
    case "declined_rack":
      return "bg-red-500";
    case "for_scouting":
      return "bg-cyan-500";
    case "for_follow_up":
      return "bg-orange-500";
    case "accepted_rack":
      return "bg-blue-500";
    case "for_replenishment":
      return "bg-purple-500";
    case "has_bible_studies":
      return "bg-emerald-500";
    case "rack_pulled_out":
      return "bg-amber-500";
    case "closed":
      return "bg-slate-500";
    case "on_hold":
      return "bg-stone-500";
    default:
      return "bg-gray-500";
  }
}

function hexToRgbTuple(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("");
  }
  const n = parseInt(h, 16);
  if (!Number.isFinite(n) || h.length !== 6) return [107, 114, 128];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** rgba() for circle-color / stroke */
function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgbTuple(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getSecondaryStatusesForDots(establishment: EstablishmentWithDetails, primaryStatus: string): string[] {
  const statuses = establishment.statuses || [];
  if (!statuses.length) return [];
  if (primaryStatus === PERSONAL_TERRITORY_STATUS) return statuses;
  return statuses.filter((s) => s !== primaryStatus);
}

function cartoTiles(isDark: boolean): string[] {
  const path = isDark ? "dark_all" : "light_all";
  return ["a", "b", "c", "d"].map((s) => `https://${s}.basemaps.cartocdn.com/${path}/{z}/{x}/{y}{r}.png`);
}

function createBaseRasterStyle(isDark: boolean): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      carto: {
        type: "raster",
        tiles: cartoTiles(isDark),
        tileSize: 256,
      },
    },
    layers: [
      {
        id: "carto-basemap",
        type: "raster",
        source: "carto",
        minzoom: 0,
        maxzoom: 22,
        paint: isDark
          ? {
              /** Dark + crisp: Carto dark is lifted badly at high brightness-min — keep mids low, cap highs, punch contrast */
              "raster-brightness-min": 0.2,
              "raster-brightness-max": 0.82,
              "raster-contrast": 0.38,
              "raster-saturation": -0.12,
              "raster-hue-rotate": 22,
            }
          : {
              "raster-brightness-min": 0,
              "raster-brightness-max": 1,
            },
      },
    ],
  };
}

/** Map pin preview card. The BWI map no longer mounts it; taps call `onEstablishmentClick` so BusinessSection opens the same drawer/details as the list. Kept exported for reuse (e.g. custom overlays). */
interface EstablishmentMapPopupContentProps {
  establishment: EstablishmentWithDetails;
  primaryStatus: string;
  secondaryStatuses: string[];
  isOtherPublisherPersonalTerritory: boolean;
  onSelect: () => void;
}

export function EstablishmentMapPopupContent({
  establishment,
  primaryStatus,
  secondaryStatuses,
  isOtherPublisherPersonalTerritory,
  onSelect,
}: EstablishmentMapPopupContentProps): JSX.Element {
  return (
    <div
      className={cn(
        "dark min-w-[280px] max-w-[320px] cursor-pointer rounded-lg border border-[#1c1921] p-4 text-[#fffaff] shadow-xl transition-shadow",
        primaryStatus === PERSONAL_TERRITORY_STATUS ? "bg-[#463b55]" : "bg-[#342a43]",
        primaryStatus === PERSONAL_TERRITORY_STATUS && isOtherPublisherPersonalTerritory && "border-dashed border-[#fbcfe8]/40"
      )}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <div className="pb-3">
        <div className="flex items-start justify-between w-full gap-2">
          <div className="flex-1 min-w-0">
            <div className="text-lg font-bold flex flex-col gap-2 w-full">
              <span className="truncate text-[#fffaff]" title={establishment.name}>
                {establishment.name}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs px-2 py-1 bg-[#272133]/80 border-[#1c1921]",
                    primaryStatus === PERSONAL_TERRITORY_STATUS
                      ? cn(
                          "text-pink-300 border-pink-400/60",
                          isOtherPublisherPersonalTerritory && "border-dashed"
                        )
                      : getStatusTextColor(primaryStatus)
                  )}
                >
                  {primaryStatus === PERSONAL_TERRITORY_STATUS
                    ? "Personal Territory"
                    : primaryStatus.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </Badge>
                {secondaryStatuses.slice(0, 3).map((status, index) => (
                  <span
                    key={`${establishment.id || establishment.name}-status-dot-${status}-${index}`}
                    className={cn("w-2 h-2 rounded-full flex-shrink-0", getStatusDotColorClass(status))}
                    title={status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  />
                ))}
              </div>
            </div>
            {establishment.area ? (
              <div className="mt-2 text-sm font-medium text-[#ded6e7]">{establishment.area}</div>
            ) : null}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-sm font-medium text-[#fffaff]">{establishment.visit_count || 0}</p>
              <p className="text-xs text-[#cfc5db]">Visits</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-[#fffaff]">{establishment.householder_count || 0}</p>
              <p className="text-xs text-[#cfc5db]">BS</p>
            </div>
          </div>
        </div>
      </div>
      <div className="pt-0">
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {primaryStatus === PERSONAL_TERRITORY_STATUS ? (
              (() => {
                const ownerVisitor =
                  establishment.publisher_id && establishment.top_visitors
                    ? establishment.top_visitors.find((visitor) => visitor.user_id === establishment.publisher_id)
                    : null;
                const ownerAvatar = establishment.assigned_user
                  ? {
                      avatar_url: establishment.assigned_user.avatar_url,
                      initials:
                        `${establishment.assigned_user.first_name} ${establishment.assigned_user.last_name}`.charAt(0) || "U",
                    }
                  : ownerVisitor
                    ? {
                        avatar_url: ownerVisitor.avatar_url,
                        initials: `${ownerVisitor.first_name} ${ownerVisitor.last_name}`.charAt(0) || "U",
                      }
                    : null;
                return ownerAvatar ? (
                  <div className="flex items-center flex-shrink-0">
                    <Avatar className="h-6 w-6 ring-2 ring-[#1c1921]">
                      <AvatarImage src={ownerAvatar.avatar_url} />
                      <AvatarFallback className="text-xs text-[#fffaff]">{ownerAvatar.initials}</AvatarFallback>
                    </Avatar>
                  </div>
                ) : null;
              })()
            ) : establishment.top_visitors && establishment.top_visitors.length > 0 ? (
              <div className="flex items-center flex-shrink-0">
                {establishment.top_visitors.slice(0, 3).map((visitor, index) => (
                  <Avatar
                    key={visitor.user_id || index}
                    className={`h-6 w-6 ring-2 ring-[#1c1921] ${index > 0 ? "-ml-2" : ""}`}
                  >
                    <AvatarImage src={visitor.avatar_url} />
                    <AvatarFallback className="text-xs text-[#fffaff]">
                      {`${visitor.first_name} ${visitor.last_name}`.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {establishment.top_visitors.length > 3 ? (
                  <span className="text-xs text-[#cfc5db] flex-shrink-0 ml-1">
                    +{establishment.top_visitors.length - 3}
                  </span>
                ) : null}
              </div>
            ) : null}
            {establishment.description ? (
              <span className="text-xs text-[#ded6e7] truncate">{establishment.description}</span>
            ) : null}
          </div>
          {establishment.floor ? (
            <span className="text-xs text-[#cfc5db] flex-shrink-0">{establishment.floor}</span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Teal ring on map pins with an unassigned open congregation to-do (home "Open" pool). */
const OPEN_POOL_TODO_MAP_STROKE = "#2dd4bf";

export interface EstablishmentMapProps {
  establishments: EstablishmentWithDetails[];
  onEstablishmentClick?: (establishment: EstablishmentWithDetails) => void;
  selectedEstablishmentId?: string;
  initialView?: { center: [number, number]; zoom: number };
  onViewChange?: (view: { center: [number, number]; zoom: number }) => void;
  className?: string;
  currentUserId?: string | null;
  /** When set, matching establishments show an open-pool to-do ring on the pin. */
  openPoolEstablishmentIds?: Set<string>;
}

export function EstablishmentMap({
  establishments,
  onEstablishmentClick,
  selectedEstablishmentId,
  initialView,
  onViewChange,
  className = "",
  openPoolEstablishmentIds,
}: EstablishmentMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const hasInitiallyFittedRef = useRef(false);
  const [isClient, setIsClient] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mapInstanceReady, setMapInstanceReady] = useState(false);

  useEffect(() => {
    setIsClient(true);

    const checkTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const establishmentsWithCoords = useMemo(
    () => establishments.filter((est) => est.lat != null && est.lng != null && !Number.isNaN(est.lat!) && !Number.isNaN(est.lng!)),
    [establishments]
  );

  const establishmentLookup = useMemo(() => {
    const m = new Map<string | null | undefined, EstablishmentWithDetails>();
    for (const e of establishmentsWithCoords) {
      m.set(e.id, e);
    }
    return m;
  }, [establishmentsWithCoords]);

  const groupedEstablishmentsByStatus = useMemo((): { status: string; items: EstablishmentWithDetails[] }[] => {
    const groups = new Map<string, EstablishmentWithDetails[]>();
    for (const establishment of establishmentsWithCoords) {
      const status = getEstablishmentPrimaryStatus(establishment);
      const bucket = groups.get(status) ?? [];
      bucket.push(establishment);
      groups.set(status, bucket);
    }
    const statusOrder = [PERSONAL_TERRITORY_STATUS, ...STATUS_HIERARCHY, "unknown"] as const;
    const statusRank = (s: string) => {
      const i = statusOrder.indexOf(s as (typeof statusOrder)[number]);
      return i === -1 ? statusOrder.length : i;
    };
    return Array.from(groups.entries())
      .sort(([sa], [sb]) => statusRank(sa) - statusRank(sb))
      .map(([status, items]) => ({ status, items }));
  }, [establishmentsWithCoords]);

  /** GeoJSON per status bucket — MapLibre clusters each layer on the GPU */
  const statusGeoJsonBundles = useMemo((): EstablishmentGeoJsonBundle[] => {
    return groupedEstablishmentsByStatus.map(({ status, items }) => {
      const seg = sanitizeStatusSegment(status);
      const sourceId = `est-src-${seg}`;
      const geojson = {
        type: "FeatureCollection" as const,
        features: items.map((est): Feature<Point> => ({
          type: "Feature" as const,
          id: est.id || undefined,
          geometry: {
            type: "Point" as const,
            coordinates: [est.lng!, est.lat!] as [number, number],
          },
          properties: {
            establishmentId: est.id,
            selected:
              selectedEstablishmentId != null && est.id != null && est.id === selectedEstablishmentId
                ? 1
                : 0,
            hasOpenPoolTodo:
              est.id && openPoolEstablishmentIds?.has(est.id) ? 1 : 0,
            ...((est.name ?? "").trim() ? { name: (est.name ?? "").trim() } : {}),
          },
        })),
      };
      const clusterLayerId = `est-cl-${seg}`;
      const countLayerId = `est-cl-count-${seg}`;
      const unclusteredLayerId = `est-pt-${seg}`;
      const colorHex = getStatusColorValue(status);
      const unclusteredLabelLayerId = `est-pt-name-${seg}`;
      return {
        status,
        segment: seg,
        sourceId,
        clusterLayerId,
        countLayerId,
        unclusteredLayerId,
        unclusteredLabelLayerId,
        colorHex,
        geojson,
      };
    });
  }, [groupedEstablishmentsByStatus, selectedEstablishmentId, openPoolEstablishmentIds]);

  const statusBundlesRef = useRef(statusGeoJsonBundles);
  statusBundlesRef.current = statusGeoJsonBundles;

  const interactiveLayerIds = useMemo(
    (): string[] =>
      statusGeoJsonBundles.flatMap(({ clusterLayerId, unclusteredLayerId, unclusteredLabelLayerId }) => [
        clusterLayerId,
        unclusteredLayerId,
        unclusteredLabelLayerId,
      ]),
    [statusGeoJsonBundles]
  );

  const selectedEstablishmentCoords = useMemo(() => {
    if (!selectedEstablishmentId) return null;
    const est = establishmentsWithCoords.find((e) => e.id === selectedEstablishmentId);
    if (!est || est.lng == null || est.lat == null) return null;
    return { lng: est.lng, lat: est.lat };
  }, [establishmentsWithCoords, selectedEstablishmentId]);

  const mapCenterLngLat = useMemo(() => {
    if (establishmentsWithCoords.length === 0) {
      return { lat: 14.5995, lng: 120.9842 };
    }
    const avgLat = establishmentsWithCoords.reduce((sum, est) => sum + est.lat!, 0) / establishmentsWithCoords.length;
    const avgLng = establishmentsWithCoords.reduce((sum, est) => sum + est.lng!, 0) / establishmentsWithCoords.length;
    return { lat: avgLat, lng: avgLng };
  }, [establishmentsWithCoords]);

  const mapStyleSpec = useMemo(() => createBaseRasterStyle(isDarkMode), [isDarkMode]);

  const defaultZoom = establishmentsWithCoords.length > 0 ? 14 : 13;
  const initialLng = initialView?.center?.[1] ?? mapCenterLngLat.lng;
  const initialLat = initialView?.center?.[0] ?? mapCenterLngLat.lat;
  const initialZoom = initialView?.zoom ?? defaultZoom;

  const fitEstablishmentsBounds = useCallback(() => {
    const mapInstance = mapRef.current?.getMap();
    if (!mapInstance || establishmentsWithCoords.length === 0) return;

    const lats = establishmentsWithCoords.map((e) => e.lat!);
    const lngs = establishmentsWithCoords.map((e) => e.lng!);
    const south = Math.min(...lats);
    const north = Math.max(...lats);
    const west = Math.min(...lngs);
    const east = Math.max(...lngs);

    const latPadding = Math.max((north - south) * 0.15, 0.001);
    const lngPadding = Math.max((east - west) * 0.15, 0.001);

    mapInstance.fitBounds(
      [
        [west - lngPadding, south - latPadding],
        [east + lngPadding, north + latPadding],
      ],
      { padding: { top: 24, bottom: 80, left: 16, right: 16 }, maxZoom: 18, duration: 0 }
    );
  }, [establishmentsWithCoords]);

  const handleMapLoad = useCallback(() => {
    const m = mapRef.current?.getMap() ?? null;
    if (m) {
      ensureEstablishmentLabelBackgroundImages(
        m,
        statusBundlesRef.current.map((b) => ({
          segment: b.segment,
          fillCss: withAlpha(b.colorHex, 0.88),
          strokeCss: withAlpha("#1c1921", 0.92),
        }))
      );
    }
    setMapInstanceReady(!!m);
    if (m && !initialView && establishmentsWithCoords.length > 0 && !hasInitiallyFittedRef.current) {
      hasInitiallyFittedRef.current = true;
      fitEstablishmentsBounds();
    }
  }, [initialView, establishmentsWithCoords.length, fitEstablishmentsBounds]);

  const handleClusterClick = useCallback(
    async (sourceId: string, geography: Geometry, clusterId: number) => {
      const rawMap = mapRef.current?.getMap();
      const src = rawMap?.getSource(sourceId) as GeoJSONSource | undefined;
      if (!src || geography.type !== "Point") return;
      try {
        const zoom = await src.getClusterExpansionZoom(clusterId);
        const coords = geography.coordinates as [number, number];
        rawMap?.easeTo({ center: coords, zoom: Math.min(zoom + 0.5, 21) });
      } catch {
        /* ignore malformed cluster payloads */
      }
    },
    []
  );

  const handleMapClick = useCallback(
    async (evt: MapLayerMouseEvent) => {
      const features = evt.features;
      const top = features && features.length > 0 ? features[0] : undefined;
      if (!top || !top.properties) {
        return;
      }

      const layerId = String(top.layer?.id ?? "");
      const bundle = statusGeoJsonBundles.find(
        ({ clusterLayerId, unclusteredLayerId, unclusteredLabelLayerId }) =>
          layerId === clusterLayerId || layerId === unclusteredLayerId || layerId === unclusteredLabelLayerId
      );

      const pointCount = top.properties.point_count;
      const hasClusterAgg = pointCount != null && bundle && top.geometry?.type === "Point";

      if (hasClusterAgg) {
        const rawCid = top.properties.cluster_id;
        const clusterIdNum = typeof rawCid === "number" ? rawCid : Number(rawCid);
        if (Number.isFinite(clusterIdNum)) {
          await handleClusterClick(bundle.sourceId, top.geometry, clusterIdNum);
        }
        return;
      }

      const estIdRaw = top.properties.establishmentId;
      const establishmentId = typeof estIdRaw === "string" ? estIdRaw : estIdRaw != null ? String(estIdRaw) : "";
      if (!establishmentId) return;

      const establishment = establishmentLookup.get(establishmentId);
      if (!establishment) return;

      onEstablishmentClick?.(establishment);
    },
    [establishmentLookup, handleClusterClick, onEstablishmentClick, statusGeoJsonBundles]
  );

  const handleMoveZoomEnd = useCallback(() => {
    if (!onViewChange) return;
    const raw = mapRef.current?.getMap();
    if (!raw) return;
    const c = raw.getCenter();
    onViewChange({ center: [c.lat, c.lng], zoom: raw.getZoom() });
  }, [onViewChange]);

  useEffect(() => {
    const rawMap = mapRef.current?.getMap();
    if (!rawMap || !onViewChange || !mapInstanceReady) return;
    handleMoveZoomEnd();
    rawMap.on("moveend", handleMoveZoomEnd);
    rawMap.on("zoomend", handleMoveZoomEnd);
    return () => {
      rawMap.off("moveend", handleMoveZoomEnd);
      rawMap.off("zoomend", handleMoveZoomEnd);
    };
  }, [handleMoveZoomEnd, onViewChange, mapInstanceReady]);

  useLayoutEffect(() => {
    if (!isClient || !mapInstanceReady) {
      return;
    }
    const map = mapRef.current?.getMap();
    if (!map) {
      return;
    }
    ensureEstablishmentLabelBackgroundImages(
      map,
      statusGeoJsonBundles.map((b) => ({
        segment: b.segment,
        fillCss: withAlpha(b.colorHex, 0.88),
        strokeCss: withAlpha("#1c1921", 0.92),
      }))
    );
  }, [isClient, mapInstanceReady, statusGeoJsonBundles]);

  if (!isClient) {
    return (
      <div className={`w-full h-full bg-muted flex items-center justify-center ${className}`}>
        <div className="text-center">
          <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading map…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(`w-full h-full ${className || "min-h-[24rem]"}`)} style={{ height: "100%", width: "100%" }}>
      <MapGl
        ref={mapRef}
        mapLib={maplibregl}
        reuseMaps={false}
        mapStyle={mapStyleSpec}
        initialViewState={{
          longitude: initialLng,
          latitude: initialLat,
          zoom: initialZoom,
        }}
        maxZoom={22}
        attributionControl={false}
        interactiveLayerIds={interactiveLayerIds}
        onClick={handleMapClick}
        onLoad={handleMapLoad}
        style={{ height: "100%", width: "100%" }}
        cursor="grab"
      >
        <NavigationControl visualizePitch={false} showZoom showCompass={false} position="bottom-right" />
        <GeolocateControl position="bottom-right" trackUserLocation />

        {statusGeoJsonBundles.map(
          ({
            sourceId,
            clusterLayerId,
            countLayerId,
            unclusteredLayerId,
            unclusteredLabelLayerId,
            geojson,
            colorHex,
            segment,
          }) => {
          const stroke = withAlpha(colorHex, 0.92);
          const fill = withAlpha(colorHex, 0.82);
          return (
            <Source key={sourceId} id={sourceId} type="geojson" data={geojson} cluster clusterMaxZoom={CLUSTER_MAX_ZOOM} clusterRadius={CLUSTER_RADIUS}>
              <Layer
                id={clusterLayerId}
                type="circle"
                source={sourceId}
                filter={["has", "point_count"]}
                paint={{
                  "circle-color": fill,
                  "circle-stroke-color": stroke,
                  "circle-stroke-width": 2,
                  "circle-radius": [
                    "step",
                    ["get", "point_count"],
                    22,
                    10,
                    26,
                    50,
                    32,
                    200,
                    38,
                  ],
                }}
              />
              <Layer
                id={countLayerId}
                type="symbol"
                source={sourceId}
                filter={["has", "point_count"]}
                layout={{
                  "text-field": "{point_count_abbreviated}",
                  "text-size": 15,
                  /** Must match glyphs on `demotiles.maplibre.org` (e.g. `Open Sans Semibold`, not `SemiBold`) */
                  "text-font": ["Open Sans Semibold"],
                }}
                paint={{
                  "text-color": isDarkMode ? "#fffaff" : "#0f172a",
                }}
              />
              <Layer
                id={unclusteredLayerId}
                type="circle"
                source={sourceId}
                filter={["!", ["has", "point_count"]]}
                paint={{
                  "circle-radius": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    10,
                    6,
                    16,
                    10,
                  ],
                  "circle-color": fill,
                  "circle-stroke-color": [
                    "case",
                    ["==", ["coalesce", ["get", "selected"], 0], 1],
                    "#fffaff",
                    ["==", ["coalesce", ["get", "hasOpenPoolTodo"], 0], 1],
                    OPEN_POOL_TODO_MAP_STROKE,
                    stroke,
                  ],
                  "circle-stroke-width": [
                    "case",
                    ["==", ["coalesce", ["get", "selected"], 0], 1],
                    3.25,
                    ["==", ["coalesce", ["get", "hasOpenPoolTodo"], 0], 1],
                    3.5,
                    2,
                  ],
                  "circle-opacity": 1,
                }}
              />
              <Layer
                id={unclusteredLabelLayerId}
                type="symbol"
                source={sourceId}
                minzoom={MIN_ZOOM_ESTABLISHMENT_LABELS}
                filter={["all", ["!", ["has", "point_count"]], ["has", "name"]]}
                layout={{
                  "icon-image": establishmentLabelBgImageId(segment),
                  "icon-text-fit": "both",
                  "icon-text-fit-padding": [2, 5, 2, 5],
                  "icon-allow-overlap": false,
                  "icon-ignore-placement": false,
                  "icon-anchor": "top",
                  "icon-offset": [0, 0],
                  "text-field": ["get", "name"],
                  "text-size": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    MIN_ZOOM_ESTABLISHMENT_LABELS,
                    [
                      "case",
                      ["==", ["coalesce", ["get", "selected"], 0], 1],
                      15.5,
                      13.5,
                    ],
                    20,
                    [
                      "case",
                      ["==", ["coalesce", ["get", "selected"], 0], 1],
                      19.25,
                      17,
                    ],
                  ],
                  "text-font": ["Open Sans Semibold"],
                  "text-anchor": "center",
                  "text-offset": [0, 1.5],
                  "text-max-width": 16,
                  "text-line-height": 1.08,
                  "text-letter-spacing": 0.02,
                  "text-padding": 1,
                  "text-allow-overlap": false,
                  "text-ignore-placement": false,
                  "text-optional": true,
                }}
                paint={{
                  "text-color": [
                    "case",
                    ["==", ["coalesce", ["get", "selected"], 0], 1],
                    "#fffaff",
                    isDarkMode ? "#fffaff" : "#0f172a",
                  ],
                  "text-halo-width": 0,
                  "text-halo-blur": 0,
                }}
              />
            </Source>
          );
        })}

        {selectedEstablishmentCoords ? (
          <Marker longitude={selectedEstablishmentCoords.lng} latitude={selectedEstablishmentCoords.lat} anchor="center">
            <div
              className="relative h-6 w-6 rounded-full border-[3px] border-background shadow-lg ring-[3px] ring-white/95"
              style={{ borderColor: "var(--foreground, #fafafa)", boxSizing: "content-box", pointerEvents: "none" }}
              aria-hidden
            />
          </Marker>
        ) : null}
      </MapGl>
    </div>
  );
}
