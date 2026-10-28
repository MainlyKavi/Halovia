export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_METRES = 6_371_008.8;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

export function haversineMetres(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingDegrees(from: LatLng, to: LatLng): number {
  const phi1 = toRadians(from.lat);
  const phi2 = toRadians(to.lat);
  const dLng = toRadians(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/** Moves `distanceMetres` from `origin` along `bearing` (degrees clockwise from north). */
export function destinationPoint(origin: LatLng, bearing: number, distanceMetres: number): LatLng {
  const delta = distanceMetres / EARTH_RADIUS_METRES;
  const theta = toRadians(bearing);
  const phi1 = toRadians(origin.lat);
  const lambda1 = toRadians(origin.lng);
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
  const lambda2 = lambda1 + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));
  return { lat: toDegrees(phi2), lng: ((toDegrees(lambda2) + 540) % 360) - 180 };
}

export interface PolylineProjection {
  /** Shortest distance from the point to the polyline, in metres. */
  distanceMetres: number;
  /** Closest point on the polyline. */
  closest: LatLng;
  /** Index of the segment (points[i] -> points[i + 1]) holding the closest point. */
  segmentIndex: number;
  /** Distance along the polyline from its start to the closest point, in metres. */
  alongMetres: number;
}

/**
 * Point-to-polyline distance. Each segment is projected onto a local
 * equirectangular plane centred on the query point, which is accurate to well
 * under a metre at city scale (segments of a few kilometres or less).
 */
export function projectOntoPolyline(point: LatLng, polyline: readonly LatLng[]): PolylineProjection {
  if (polyline.length === 0) throw new Error("projectOntoPolyline needs at least one point");
  if (polyline.length === 1) {
    return { distanceMetres: haversineMetres(point, polyline[0]), closest: polyline[0], segmentIndex: 0, alongMetres: 0 };
  }
  const cosLat = Math.cos(toRadians(point.lat));
  const toLocal = (p: LatLng) => ({
    x: toRadians(p.lng - point.lng) * cosLat * EARTH_RADIUS_METRES,
    y: toRadians(p.lat - point.lat) * EARTH_RADIUS_METRES,
  });
  let best: PolylineProjection | null = null;
  let travelled = 0;
  for (let index = 0; index < polyline.length - 1; index += 1) {
    const a = polyline[index];
    const b = polyline[index + 1];
    const la = toLocal(a);
    const lb = toLocal(b);
    const dx = lb.x - la.x;
    const dy = lb.y - la.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(la.x * dx + la.y * dy) / lengthSquared));
    const px = la.x + t * dx;
    const py = la.y + t * dy;
    const distance = Math.hypot(px, py);
    const segmentLength = haversineMetres(a, b);
    if (!best || distance < best.distanceMetres) {
      best = {
        distanceMetres: distance,
        closest: { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) },
        segmentIndex: index,
        alongMetres: travelled + t * segmentLength,
      };
    }
    travelled += segmentLength;
  }
  return best as PolylineProjection;
}

export function distanceToPolylineMetres(point: LatLng, polyline: readonly LatLng[]): number {
  return projectOntoPolyline(point, polyline).distanceMetres;
}

export function polylineLengthMetres(polyline: readonly LatLng[]): number {
  let total = 0;
  for (let index = 1; index < polyline.length; index += 1) total += haversineMetres(polyline[index - 1], polyline[index]);
  return total;
}

export interface PointAlong {
  point: LatLng;
  bearing: number;
  segmentIndex: number;
}

/** Position reached after travelling `distanceMetres` from the start of the polyline (clamped to its ends). */
export function pointAlongPolyline(polyline: readonly LatLng[], distanceMetres: number): PointAlong {
  if (polyline.length === 0) throw new Error("pointAlongPolyline needs at least one point");
  if (polyline.length === 1) return { point: polyline[0], bearing: 0, segmentIndex: 0 };
  let remaining = Math.max(0, distanceMetres);
  for (let index = 0; index < polyline.length - 1; index += 1) {
    const a = polyline[index];
    const b = polyline[index + 1];
    const segment = haversineMetres(a, b);
    if (remaining <= segment || index === polyline.length - 2) {
      const t = segment === 0 ? 0 : Math.min(1, remaining / segment);
      return { point: { lat: a.lat + t * (b.lat - a.lat), lng: a.lng + t * (b.lng - a.lng) }, bearing: bearingDegrees(a, b), segmentIndex: index };
    }
    remaining -= segment;
  }
  const last = polyline.length - 1;
  return { point: polyline[last], bearing: bearingDegrees(polyline[last - 1], polyline[last]), segmentIndex: last - 1 };
}

/** The part of the polyline from its start up to `distanceMetres`, ending exactly at that point. */
export function slicePolyline(polyline: readonly LatLng[], distanceMetres: number): LatLng[] {
  if (polyline.length < 2) return [...polyline];
  const { point, segmentIndex } = pointAlongPolyline(polyline, distanceMetres);
  return [...polyline.slice(0, segmentIndex + 1), point];
}
