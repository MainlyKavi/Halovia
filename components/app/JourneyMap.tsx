"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type GeoJSONSource, type LngLatBounds, type Map as MapLibreMap, type Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Focus, LoaderCircle, LocateFixed, MapPin, RefreshCw, Route as RouteIcon, WifiOff } from "lucide-react";
import { useApp } from "@/components/app/AppProvider";
import { haversineMetres } from "@/lib/backend/validation";
import { LOCATION_POLICY } from "@/lib/config";
import { buildRouteUrl, logOpenMapDevelopmentError, OPEN_MAP_STYLES } from "@/lib/open-map";
import { shouldReuseRoute } from "@/lib/map-policy";
import type { DeviceCoordinate } from "@/lib/api-types";
import type { TravelType } from "@/lib/types";

interface Coordinate { latitude: number; longitude: number }
interface RouteMetrics { routeEta: string; remainingDistanceMetres: number; durationMinutes: number }
interface RouteResponse {
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][]; type: "LineString" };
  }>;
}

interface JourneyMapProps {
  origin: Coordinate;
  destination: Coordinate;
  latest: DeviceCoordinate | null;
  travelType: TravelType;
  compact?: boolean;
  stale?: boolean;
  onRouteMetrics?: (metrics: RouteMetrics) => void;
}

const labels: Record<TravelType, string> = {
  cab: "CAB",
  autoRickshaw: "AUTO",
  motorcycle: "BIKE",
  walking: "WALK",
  publicTransport: "TRANSIT",
  other: "TRIP",
};

function markerContent(className: string, label?: string): HTMLElement {
  const element = document.createElement("div");
  element.className = className;
  element.setAttribute("aria-hidden", "true");
  const inner = document.createElement("span");
  if (label) inner.textContent = label;
  element.append(inner);
  return element;
}

function emptyRoute(): GeoJSON.Feature<GeoJSON.LineString> {
  return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } };
}

export function JourneyMap({ origin, destination, latest, travelType, compact = false, stale = false, onRouteMetrics }: JourneyMapProps) {
  const { t, state } = useApp();
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const ownerMarker = useRef<Marker | null>(null);
  const destinationMarker = useRef<Marker | null>(null);
  const routePath = useRef<[number, number][]>([]);
  const routeBounds = useRef<LngLatBounds | null>(null);
  const lastRouteOrigin = useRef<Coordinate | null>(null);
  const lastRouteKey = useRef("");
  const hasFramedRoute = useRef(false);
  const markerCoordinate = useRef<Coordinate | null>(null);
  const markerAnimation = useRef<number | null>(null);
  const requestSequence = useRef(0);
  const metricsCallback = useRef(onRouteMetrics);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [follow, setFollow] = useState(true);
  const [online, setOnline] = useState(true);
  const [retryNonce, setRetryNonce] = useState(0);
  const [routeRetryNonce, setRouteRetryNonce] = useState(0);
  const currentLatitude = latest?.latitude ?? origin.latitude;
  const currentLongitude = latest?.longitude ?? origin.longitude;
  const accuracyLimited = Boolean(latest && latest.accuracy > LOCATION_POLICY.poorAccuracyMetres);
  const travelLabel = t(`travel.${travelType}` as Parameters<typeof t>[0]);

  useEffect(() => {
    metricsCallback.current = onRouteMetrics;
  }, [onRouteMetrics]);

  useEffect(() => {
    const updateOnlineState = () => setOnline(navigator.onLine);
    updateOnlineState();
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    return () => {
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    let loaded = false;
    setMapReady(false);
    setMapError(false);
    const map = new maplibregl.Map({
      container: container.current,
      style: state.user.theme === "dark" ? OPEN_MAP_STYLES.dark : OPEN_MAP_STYLES.light,
      center: [origin.longitude, origin.latitude],
      zoom: 13,
      attributionControl: { compact: true },
      cooperativeGestures: true,
    });
    map.dragPan.enable();
    map.on("dragstart", () => setFollow(false));
    map.on("load", () => {
      if (cancelled) return;
      loaded = true;
      map.addSource("halovia-route", { type: "geojson", data: emptyRoute() });
      map.addLayer({
        id: "halovia-route-line",
        type: "line",
        source: "halovia-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#ce6685", "line-opacity": 0.92, "line-width": 6 },
      });
      setMapReady(true);
    });
    map.on("error", (event) => {
      logOpenMapDevelopmentError("map loading", event.error);
      if (!loaded && !cancelled) setMapError(true);
    });

    const destinationElement = markerContent("halovia-destination-marker");
    destinationMarker.current = new maplibregl.Marker({ element: destinationElement, anchor: "bottom" })
      .setLngLat([destination.longitude, destination.latitude])
      .addTo(map);
    destinationElement.title = t("active.destination");

    const ownerElement = markerContent(`halovia-vehicle-marker transport-${travelType}`, labels[travelType]);
    ownerMarker.current = new maplibregl.Marker({ element: ownerElement, anchor: "center" })
      .setLngLat([origin.longitude, origin.latitude])
      .addTo(map);
    ownerElement.title = `${travelLabel} · ${t("viewer.location")}`;

    markerCoordinate.current = { latitude: origin.latitude, longitude: origin.longitude };
    mapRef.current = map;

    return () => {
      cancelled = true;
      if (markerAnimation.current !== null) cancelAnimationFrame(markerAnimation.current);
      ownerMarker.current?.remove();
      destinationMarker.current?.remove();
      map.remove();
      ownerMarker.current = null;
      destinationMarker.current = null;
      mapRef.current = null;
      markerCoordinate.current = null;
      routePath.current = [];
      routeBounds.current = null;
      hasFramedRoute.current = false;
      setMapReady(false);
    };
  }, [destination.latitude, destination.longitude, origin.latitude, origin.longitude, retryNonce, state.user.theme, t, travelLabel, travelType]);

  useEffect(() => {
    const marker = ownerMarker.current;
    const map = mapRef.current;
    if (!marker || !map || !mapReady) return;
    const content = marker.getElement();
    content.className = `halovia-vehicle-marker transport-${travelType}${stale ? " stale" : ""}`;
    const inner = content.querySelector("span");
    if (inner) {
      inner.textContent = labels[travelType];
      inner.setAttribute("style", latest?.heading !== null && latest?.heading !== undefined && travelType !== "walking" ? `transform:rotate(${Math.round(latest.heading)}deg)` : "");
    }
    destinationMarker.current?.setLngLat([destination.longitude, destination.latitude]);

    const from = markerCoordinate.current ?? { latitude: currentLatitude, longitude: currentLongitude };
    const to = { latitude: currentLatitude, longitude: currentLongitude };
    if (markerAnimation.current !== null) cancelAnimationFrame(markerAnimation.current);
    if (state.privacy.reducedMotion || stale || accuracyLimited || haversineMetres(from, to) < 1) {
      marker.setLngLat([to.longitude, to.latitude]);
    } else {
      const started = performance.now();
      const animate = (now: number) => {
        const progress = Math.min(1, (now - started) / 650);
        const eased = 1 - Math.pow(1 - progress, 3);
        marker.setLngLat([
          from.longitude + (to.longitude - from.longitude) * eased,
          from.latitude + (to.latitude - from.latitude) * eased,
        ]);
        if (progress < 1) markerAnimation.current = requestAnimationFrame(animate);
      };
      markerAnimation.current = requestAnimationFrame(animate);
    }
    markerCoordinate.current = to;
    if (follow && latest && !stale && !accuracyLimited) map.panTo([latest.longitude, latest.latitude], { duration: state.privacy.reducedMotion ? 0 : 500 });
  }, [accuracyLimited, currentLatitude, currentLongitude, destination.latitude, destination.longitude, follow, latest, mapReady, stale, state.privacy.reducedMotion, travelType]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || stale || !online) return;
    const nextOrigin = { latitude: currentLatitude, longitude: currentLongitude };
    const nextKey = `${travelType}:${destination.latitude}:${destination.longitude}`;
    if (shouldReuseRoute(lastRouteOrigin.current, nextOrigin, lastRouteKey.current, nextKey, routePath.current.length > 0, LOCATION_POLICY.routeRecalculationMetres)) return;
    lastRouteOrigin.current = nextOrigin;
    lastRouteKey.current = nextKey;
    const sequence = ++requestSequence.current;
    const controller = new AbortController();
    setRouteError(false);

    void fetch(buildRouteUrl(travelType, nextOrigin, destination), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`route_${response.status}`);
        return response.json() as Promise<RouteResponse>;
      })
      .then((result) => {
        if (sequence !== requestSequence.current || !mapRef.current) return;
        const route = result.routes?.[0];
        if (!route?.geometry.coordinates.length) throw new Error("route_missing");
        routePath.current = route.geometry.coordinates;
        const source = mapRef.current.getSource("halovia-route") as GeoJSONSource | undefined;
        source?.setData({ type: "Feature", properties: {}, geometry: route.geometry });
        const bounds = new maplibregl.LngLatBounds();
        route.geometry.coordinates.forEach((coordinate) => bounds.extend(coordinate));
        routeBounds.current = bounds;
        setRouteError(false);
        metricsCallback.current?.({
          remainingDistanceMetres: Math.round(route.distance),
          routeEta: new Date(Date.now() + route.duration * 1_000).toISOString(),
          durationMinutes: Math.max(1, Math.round(route.duration / 60)),
        });
        if (!hasFramedRoute.current) {
          mapRef.current.fitBounds(bounds, { padding: compact ? 40 : { top: 55, right: 55, bottom: 190, left: 55 }, duration: state.privacy.reducedMotion ? 0 : 600 });
          hasFramedRoute.current = true;
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        logOpenMapDevelopmentError("route calculation", error);
        if (sequence === requestSequence.current) setRouteError(true);
      });

    return () => controller.abort();
  }, [compact, currentLatitude, currentLongitude, destination, mapReady, online, routeRetryNonce, stale, state.privacy.reducedMotion, travelType]);

  function frameRoute() {
    const map = mapRef.current;
    if (!map) return;
    const bounds = routeBounds.current ?? new maplibregl.LngLatBounds()
      .extend([currentLongitude, currentLatitude])
      .extend([destination.longitude, destination.latitude]);
    map.fitBounds(bounds, { padding: compact ? 40 : { top: 55, right: 55, bottom: 190, left: 55 }, duration: state.privacy.reducedMotion ? 0 : 500 });
    setFollow(false);
  }

  if (mapError) {
    return <div className={`production-map map-unavailable ${compact ? "compact" : ""}`}><MapPin size={28} /><strong>{t("map.unavailableTitle")}</strong><p>{t("map.missingToken")}</p><button type="button" className="button button-secondary button-sm" onClick={() => setRetryNonce((current) => current + 1)}><RefreshCw size={16} />{t("common.retry")}</button></div>;
  }

  return (
    <div className={`production-map ${compact ? "compact" : ""}`}>
      <div ref={container} className="journey-map-container" aria-label={t("map.accessibleLabel")} />
      {!mapReady && <div className="map-loading" role="status"><LoaderCircle className="spin" size={24} /><span>{t("map.loading")}</span></div>}
      {!online && <div className="map-offline" role="status"><WifiOff size={19} /><span>{t("map.offline")}</span><button type="button" onClick={() => setRetryNonce((current) => current + 1)}>{t("common.retry")}</button></div>}
      <div className="map-actions" aria-label={t("map.controlsLabel")}>
        <button type="button" aria-label={t("map.recenter")} onClick={() => { setFollow(true); mapRef.current?.easeTo({ center: [currentLongitude, currentLatitude], zoom: 15, duration: state.privacy.reducedMotion ? 0 : 500 }); }}><LocateFixed size={19} /></button>
        <button type="button" aria-label={t("map.frameRoute")} onClick={frameRoute}><Focus size={19} /></button>
      </div>
      <div className="map-text-alternative"><RouteIcon size={15} /><span>{travelLabel}</span><span aria-hidden="true">→</span><span>{t("active.destination")}</span></div>
      {routeError && <div className="map-route-error" role="status"><span>{t("map.routeUnavailable")}</span><button type="button" onClick={() => setRouteRetryNonce((current) => current + 1)}><RefreshCw size={14} />{t("common.retry")}</button></div>}
    </div>
  );
}
