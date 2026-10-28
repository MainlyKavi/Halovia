import maplibregl, { type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import { LocateFixed } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { slicePolyline, type LatLng } from "@/lib/ride/geo";
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
  className?: string;
}

// Used when OpenFreeMap tiles cannot load (offline, blocked network). The
// route, cab and places still draw on a plain background.
function fallbackStyle(dark: boolean): StyleSpecification {
  return { version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": dark ? "#24242b" : "#f4eef0" } }] };
}

const toLngLat = (point: LatLng): [number, number] => [point.lng, point.lat];
const line = (points: readonly LatLng[]) => ({ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: points.map(toLngLat) } });

function markerElement(className: string, html: string): HTMLElement {
  const element = document.createElement("div");
  element.className = className;
  element.innerHTML = html;
  return element;
}

const CAR_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2.5 18 20l-6-3.2L6 20z"/></svg>';
const POLICE_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/></svg>';
const HOSPITAL_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z"/></svg>';

export function LiveMap({ route, travelledMetres, cab, user, places, deviated, dark, labels, className = "" }: LiveMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<{ cab?: maplibregl.Marker; user?: maplibregl.Marker; police?: maplibregl.Marker; hospital?: maplibregl.Marker }>({});
  const latest = useRef({ route, travelledMetres });
  const [offline, setOffline] = useState(false);
  const [ready, setReady] = useState(false);
  const fittedFor = useRef<string>("");

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
        attributionControl: { compact: true },
        pitchWithRotate: false,
        dragRotate: false,
      });
    } catch {
      // No WebGL: show the offline note rather than crashing the screen.
      queueMicrotask(() => setOffline(true));
      return;
    }
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
      map.addSource("planned", { type: "geojson", data: line(points) });
      map.addSource("travelled", { type: "geojson", data: line(slicePolyline(points, travelled)) });
      map.addLayer({ id: "planned-casing", type: "line", source: "planned", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": dark ? 0.25 : 0.9 } });
      map.addLayer({ id: "planned-line", type: "line", source: "planned", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#ce6685", "line-width": 5 } });
      map.addLayer({ id: "travelled-line", type: "line", source: "travelled", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": dark ? "#8b8895" : "#b9a6ad", "line-width": 5 } });
      setReady(true);
    };
    map.on("style.load", addLayers);
    // Before the style loads, any error means the style itself failed. Later
    // errors are single tiles; keep the real map and let those cells stay blank.
    map.on("error", () => { if (!styleLoaded) switchToFallback(); });

    return () => {
      window.clearTimeout(timer);
      Object.values(markers.current).forEach((marker) => marker?.remove());
      markers.current = {};
      map.remove();
      mapRef.current = null;
      fittedFor.current = "";
      setReady(false);
    };
  }, [dark]);

  // Route geometry and travelled part.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("planned") as GeoJSONSource | undefined)?.setData(line(route));
    (map.getSource("travelled") as GeoJSONSource | undefined)?.setData(line(slicePolyline(route, travelledMetres)));
    const key = route.length ? `${route[0].lat},${route[0].lng},${route.length}` : "";
    if (key && fittedFor.current !== key) {
      fittedFor.current = key;
      const bounds = new maplibregl.LngLatBounds();
      route.forEach((point) => bounds.extend(toLngLat(point)));
      map.fitBounds(bounds, { padding: { top: 56, bottom: 56, left: 36, right: 36 }, duration: 0 });
    }
  }, [ready, route, travelledMetres]);

  // Cab, user and safety place markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const place = (key: "cab" | "user" | "police" | "hospital", point: LatLng | null, create: () => maplibregl.Marker) => {
      if (!point) { markers.current[key]?.remove(); markers.current[key] = undefined; return; }
      if (!markers.current[key]) markers.current[key] = create().setLngLat(toLngLat(point)).addTo(map);
      else markers.current[key]?.setLngLat(toLngLat(point));
    };
    place("cab", cab?.point ?? null, () => new maplibregl.Marker({ element: markerElement("map-cab", CAR_SVG), rotationAlignment: "map" }));
    markers.current.cab?.setRotation(cab?.bearing ?? 0);
    markers.current.cab?.getElement().classList.toggle("map-cab-alert", deviated);
    place("user", user, () => new maplibregl.Marker({ element: markerElement("map-user", `<span></span><small>${labels.you}</small>`) }));
    place("police", places.police?.location ?? null, () => new maplibregl.Marker({ element: markerElement("map-place map-place-police", POLICE_SVG) }));
    place("hospital", places.hospital?.location ?? null, () => new maplibregl.Marker({ element: markerElement("map-place map-place-hospital", HOSPITAL_SVG) }));
  }, [cab, deviated, labels.you, places.hospital?.location, places.police?.location, ready, user]);

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
    if (!inside) map.easeTo({ center: toLngLat(cab.point), duration: 600 });
  }, [cab, ready]);

  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    if (cab) map.easeTo({ center: toLngLat(cab.point), zoom: 15, duration: 500 });
    else if (route.length) {
      const bounds = new maplibregl.LngLatBounds();
      route.forEach((point) => bounds.extend(toLngLat(point)));
      map.fitBounds(bounds, { padding: 48, duration: 500 });
    }
  };

  return (
    <div className={`live-map ${className}`}>
      <div ref={container} className="live-map-canvas" />
      {!ready && !offline && <div className="live-map-loading" aria-hidden="true"><span /></div>}
      {offline && <p className="live-map-note">{labels.offline}</p>}
      <button type="button" className="live-map-recenter" onClick={recenter} aria-label={labels.recenter}><LocateFixed size={18} /></button>
    </div>
  );
}
