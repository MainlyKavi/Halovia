import maplibregl, { type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import { LocateFixed, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { polylineLengthMetres, slicePolyline, type LatLng } from "@/lib/ride/geo";
import type { NearestSafetyPlaces } from "@/lib/ride/places";
import type { CabPosition } from "@/lib/ride/simulation";
import { OPEN_MAP_STYLES } from "@/lib/open-map";

interface LiveMapProps {
  route: readonly LatLng[];
  travelledMetres: number;
  cab: CabPosition | null;
  user: LatLng | null;
  places: NearestSafetyPlaces;
  deviated: boolean;
  dark: boolean;
  labels: { you: string; recenter: string; offline: string };
  /** Floating chip in the top-right corner, e.g. distance left. */
  chip?: string | null;
  className?: string;
}

// Used when OpenFreeMap tiles cannot load (offline, blocked network). The
// route, cab and places still draw on a plain background.
function fallbackStyle(dark: boolean): StyleSpecification {
  return { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": dark ? "#24242b" : "#f8e9ee" } }] };
}

const toLngLat = (point: LatLng): [number, number] => [point.lng, point.lat];
const line = (points: readonly LatLng[]) => ({ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: points.map(toLngLat) } });
const reducedMotion = () => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
const FIT_PADDING = { top: 64, bottom: 72, left: 40, right: 40 };
const easeOut = (t: number) => 1 - (1 - t) ** 3;

function markerElement(className: string, html: string, label?: string): HTMLElement {
  const element = document.createElement("div");
  element.className = className;
  element.innerHTML = html;
  if (label) { element.setAttribute("role", "img"); element.setAttribute("aria-label", label); }
  return element;
}

// Top-down taxi: yellow body, dark windscreen and roof light.
const CAB_SVG = '<svg viewBox="0 0 24 40" width="18" height="30" aria-hidden="true"><rect x="2" y="2" width="20" height="36" rx="7" fill="#f6c32b" stroke="#1f1f24" stroke-width="2"/><rect x="5" y="9" width="14" height="7" rx="2" fill="#2b2b33"/><rect x="5" y="27" width="14" height="5" rx="2" fill="#2b2b33"/><rect x="9" y="18" width="6" height="4" rx="1" fill="#1f1f24"/></svg>';
const POLICE_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/></svg>';
const HOSPITAL_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z"/></svg>';

export function LiveMap({ route, travelledMetres, cab, user, places, deviated, dark, labels, chip, className = "" }: LiveMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<{ cab?: maplibregl.Marker; user?: maplibregl.Marker; police?: maplibregl.Marker; hospital?: maplibregl.Marker }>({});
  const latest = useRef({ route, travelledMetres });
  const [offline, setOffline] = useState(false);
  const [ready, setReady] = useState(false);
  const drawnFor = useRef("");
  const drawing = useRef<number | null>(null);
  const cabShown = useRef<LatLng | null>(null);
  const cabFrame = useRef<number | null>(null);

  useEffect(() => { latest.current = { route, travelledMetres }; }, [route, travelledMetres]);

  // Create the map once; swap styles when the theme changes.
  useEffect(() => {
    if (!container.current) return;
    let styleLoaded = false;
    let usingFallback = false;
    const start = latest.current.route[0] ?? { lat: 12.95, lng: 77.62 };
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: container.current,
        style: OPEN_MAP_STYLES[dark ? "dark" : "light"],
        center: toLngLat(start),
        zoom: 13,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
      });
    } catch {
      // No WebGL: show the offline note rather than crashing the screen.
      queueMicrotask(() => setOffline(true));
      return;
    }
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    mapRef.current = map;

    const switchToFallback = () => {
      if (usingFallback) return;
      usingFallback = true;
      setOffline(true);
      map.setStyle(fallbackStyle(dark));
    };
    const timer = window.setTimeout(() => { if (!styleLoaded) switchToFallback(); }, 8_000);

    const addLayers = () => {
      styleLoaded = true;
      if (map.getSource("planned")) return;
      const { route: points, travelledMetres: travelled } = latest.current;
      // The draw-in animation fills "planned" once the route is known.
      map.addSource("planned", { type: "geojson", data: line(drawnFor.current ? points : []) });
      map.addSource("travelled", { type: "geojson", data: line(slicePolyline(points, travelled)) });
      map.addLayer({ id: "planned-glow", type: "line", source: "planned", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ec6d92", "line-width": 14, "line-opacity": 0.18, "line-blur": 4 } });
      map.addLayer({ id: "planned-casing", type: "line", source: "planned", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 8, "line-opacity": dark ? 0.2 : 0.95 } });
      map.addLayer({ id: "planned-line", type: "line", source: "planned", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ff2f6d", "line-width": 4.5 } });
      map.addLayer({ id: "travelled-line", type: "line", source: "travelled", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": dark ? "#8b8895" : "#c8aab4", "line-width": 4.5 } });
      setReady(true);
    };
    map.on("style.load", addLayers);
    // Re-fit when the card changes size (rotation, layout settling after mount).
    const resize = new ResizeObserver(() => {
      map.resize();
      const points = latest.current.route;
      if (points.length && !userMoved) {
        const bounds = new maplibregl.LngLatBounds();
        points.forEach((point) => bounds.extend(toLngLat(point)));
        map.fitBounds(bounds, { padding: FIT_PADDING, duration: 0 });
      }
    });
    resize.observe(container.current);
    let userMoved = false;
    map.on("dragstart", () => { userMoved = true; });
    map.on("zoomstart", (event) => { if ((event as { originalEvent?: unknown }).originalEvent) userMoved = true; });
    // Before the style loads, any error means the style itself failed. Later
    // errors are single tiles; keep the real map and let those cells stay blank.
    map.on("error", () => { if (!styleLoaded) switchToFallback(); });

    return () => {
      window.clearTimeout(timer);
      resize.disconnect();
      if (drawing.current !== null) cancelAnimationFrame(drawing.current);
      if (cabFrame.current !== null) cancelAnimationFrame(cabFrame.current);
      Object.values(markers.current).forEach((marker) => marker?.remove());
      markers.current = {};
      cabShown.current = null;
      map.remove();
      mapRef.current = null;
      drawnFor.current = "";
      setReady(false);
    };
  }, [dark]);

  // Route geometry: fit and draw in once per route, then keep the travelled part current.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !route.length) return;
    (map.getSource("travelled") as GeoJSONSource | undefined)?.setData(line(slicePolyline(route, travelledMetres)));
    const key = `${route[0].lat},${route[0].lng},${route.length}`;
    if (drawnFor.current === key) return;
    drawnFor.current = key;
    const bounds = new maplibregl.LngLatBounds();
    route.forEach((point) => bounds.extend(toLngLat(point)));
    map.fitBounds(bounds, { padding: FIT_PADDING, duration: 0 });
    const planned = map.getSource("planned") as GeoJSONSource | undefined;
    if (!planned) return;
    if (drawing.current !== null) cancelAnimationFrame(drawing.current);
    if (reducedMotion()) { planned.setData(line(route)); return; }
    const total = polylineLengthMetres(route);
    const started = performance.now();
    const step = (time: number) => {
      const t = Math.min(1, (time - started) / 1_200);
      planned.setData(line(t >= 1 ? route : slicePolyline(route, total * easeOut(t))));
      drawing.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    drawing.current = requestAnimationFrame(step);
  }, [ready, route, travelledMetres]);

  // Cab marker glides between simulation ticks instead of jumping.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!cab) {
      markers.current.cab?.remove();
      markers.current.cab = undefined;
      cabShown.current = null;
      return;
    }
    if (!markers.current.cab) {
      markers.current.cab = new maplibregl.Marker({ element: markerElement("map-cab", CAB_SVG), rotationAlignment: "map" }).setLngLat(toLngLat(cab.point)).addTo(map);
      cabShown.current = cab.point;
    }
    const marker = markers.current.cab;
    marker.setRotation(cab.bearing);
    marker.getElement().classList.toggle("map-cab-alert", deviated);
    const from = cabShown.current ?? cab.point;
    const to = cab.point;
    if (cabFrame.current !== null) cancelAnimationFrame(cabFrame.current);
    if (reducedMotion()) { marker.setLngLat(toLngLat(to)); cabShown.current = to; return; }
    const started = performance.now();
    const step = (time: number) => {
      const t = Math.min(1, (time - started) / 420);
      const point = { lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t };
      marker.setLngLat(toLngLat(point));
      cabShown.current = point;
      cabFrame.current = t < 1 ? requestAnimationFrame(step) : null;
    };
    cabFrame.current = requestAnimationFrame(step);
  }, [cab, deviated, ready]);

  // User location and safety place markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const place = (key: "user" | "police" | "hospital", point: LatLng | null, create: () => maplibregl.Marker) => {
      if (!point) { markers.current[key]?.remove(); markers.current[key] = undefined; return; }
      if (!markers.current[key]) markers.current[key] = create().setLngLat(toLngLat(point)).addTo(map);
      else markers.current[key]?.setLngLat(toLngLat(point));
    };
    place("user", user, () => new maplibregl.Marker({ element: markerElement("map-user", "<i></i><span></span>", labels.you) }));
    place("police", places.police?.location ?? null, () => new maplibregl.Marker({ element: markerElement("map-place map-place-police", POLICE_SVG) }));
    place("hospital", places.hospital?.location ?? null, () => new maplibregl.Marker({ element: markerElement("map-place map-place-hospital", HOSPITAL_SVG) }));
  }, [labels.you, places.hospital?.location, places.police?.location, ready, user]);

  // Keep the cab in view while it moves.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !cab) return;
    const bounds = map.getBounds();
    const inset = 0.15;
    const lngSpan = bounds.getEast() - bounds.getWest();
    const latSpan = bounds.getNorth() - bounds.getSouth();
    const inside = cab.point.lng > bounds.getWest() + lngSpan * inset && cab.point.lng < bounds.getEast() - lngSpan * inset
      && cab.point.lat > bounds.getSouth() + latSpan * inset && cab.point.lat < bounds.getNorth() - latSpan * inset;
    if (!inside) map.easeTo({ center: toLngLat(cab.point), duration: reducedMotion() ? 0 : 600 });
  }, [cab, ready]);

  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    const target = user ?? cab?.point ?? null;
    if (target) map.easeTo({ center: toLngLat(target), zoom: 15, duration: 500 });
    else if (route.length) {
      const bounds = new maplibregl.LngLatBounds();
      route.forEach((point) => bounds.extend(toLngLat(point)));
      map.fitBounds(bounds, { padding: 48, duration: 500 });
    }
  };

  return (
    <div className={`live-map ${dark ? "" : "live-map-tinted"} ${className}`}>
      <div ref={container} className="live-map-canvas" />
      {!ready && !offline && <div className="live-map-loading" aria-hidden="true"><span /></div>}
      {chip && <span className="live-map-chip m-glass"><MapPin size={15} />{chip}</span>}
      {offline && <p className="live-map-note m-glass">{labels.offline}</p>}
      <button type="button" className="live-map-recenter m-glass" onClick={recenter} aria-label={labels.recenter}><LocateFixed size={19} /></button>
    </div>
  );
}
