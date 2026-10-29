import maplibregl, { type GeoJSONSource, type StyleSpecification } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import type { LivePoint } from "@/lib/ride/live-sos";
import { OPEN_MAP_STYLES } from "@/lib/open-map";

// The sender's live position on the receiving phone: one pulsing marker that
// glides to each new fix, and the trail behind it. Kept separate from
// LiveMap, which is built around a planned route and a simulated cab.

const toLngLat = (point: { lat: number; lng: number }): [number, number] => [point.lng, point.lat];
const fallbackStyle = (dark: boolean): StyleSpecification => ({ version: 8, sources: {}, layers: [{ id: "background", type: "background", paint: { "background-color": dark ? "#24242b" : "#f8e9ee" } }] });
const trailFeature = (trail: readonly LivePoint[]) => ({ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: trail.map(toLngLat) } });

export function SosMap({ location, trail, name, dark, offlineLabel }: { location: LivePoint | null; trail: readonly LivePoint[]; name: string; dark: boolean; offlineLabel: string }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const shown = useRef<{ lat: number; lng: number } | null>(null);
  const frame = useRef<number | null>(null);
  const latest = useRef({ location, trail });
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  useEffect(() => { latest.current = { location, trail }; }, [location, trail]);

  useEffect(() => {
    if (!container.current) return;
    let styleLoaded = false;
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({ container: container.current, style: OPEN_MAP_STYLES[dark ? "dark" : "light"], center: toLngLat(latest.current.location ?? { lat: 28.41, lng: 77.36 }), zoom: 15, attributionControl: false, dragRotate: false, pitchWithRotate: false });
    } catch {
      queueMicrotask(() => setOffline(true));
      return;
    }
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-left");
    mapRef.current = map;
    const toFallback = () => { setOffline(true); map.setStyle(fallbackStyle(dark)); };
    const timer = window.setTimeout(() => { if (!styleLoaded) toFallback(); }, 8_000);
    map.on("error", () => { if (!styleLoaded) toFallback(); });
    map.on("style.load", () => {
      styleLoaded = true;
      if (!map.getSource("sos-trail")) {
        map.addSource("sos-trail", { type: "geojson", data: trailFeature(latest.current.trail) });
        map.addLayer({ id: "sos-trail", type: "line", source: "sos-trail", layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": "#d7263d", "line-width": 4, "line-opacity": 0.75 } });
      }
      setReady(true);
    });
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container.current);
    return () => {
      window.clearTimeout(timer);
      resize.disconnect();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      marker.current?.remove();
      marker.current = null;
      shown.current = null;
      map.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [dark]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    (map.getSource("sos-trail") as GeoJSONSource | undefined)?.setData(trailFeature(trail));
    if (!location) return;
    if (!marker.current) {
      const element = document.createElement("div");
      element.className = "map-sos-person";
      element.innerHTML = "<i></i><span></span>";
      element.setAttribute("role", "img");
      element.setAttribute("aria-label", name);
      marker.current = new maplibregl.Marker({ element }).setLngLat(toLngLat(location)).addTo(map);
      shown.current = location;
      map.jumpTo({ center: toLngLat(location), zoom: 16 });
      return;
    }
    const from = shown.current ?? location;
    const started = performance.now();
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    const step = (time: number) => {
      const progress = Math.min(1, (time - started) / 900);
      const point = { lat: from.lat + (location.lat - from.lat) * progress, lng: from.lng + (location.lng - from.lng) * progress };
      marker.current?.setLngLat(toLngLat(point));
      shown.current = point;
      frame.current = progress < 1 ? requestAnimationFrame(step) : null;
    };
    frame.current = requestAnimationFrame(step);
    // Follow the person unless they are comfortably inside the view.
    const bounds = map.getBounds();
    const inset = 0.2;
    const lngSpan = bounds.getEast() - bounds.getWest();
    const latSpan = bounds.getNorth() - bounds.getSouth();
    const inside = location.lng > bounds.getWest() + lngSpan * inset && location.lng < bounds.getEast() - lngSpan * inset && location.lat > bounds.getSouth() + latSpan * inset && location.lat < bounds.getNorth() - latSpan * inset;
    if (!inside) map.easeTo({ center: toLngLat(location), duration: 700 });
  }, [location, name, ready, trail]);

  return (
    <div className="live-map m-sos-map">
      <div ref={container} className="live-map-canvas" />
      {offline && <p className="live-map-note m-glass">{offlineLabel}</p>}
    </div>
  );
}
