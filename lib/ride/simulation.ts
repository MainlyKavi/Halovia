import { destinationPoint, pointAlongPolyline, polylineLengthMetres, type LatLng } from "./geo.ts";

/**
 * DEMO ONLY. Moves a simulated cab along the planned route so the tracking,
 * deviation and alert flows can be shown without a real vehicle. Nothing here
 * reads a real driver's location.
 */
export interface CabSimulation {
  /** Metres travelled along the planned route. */
  travelledMetres: number;
  /** Set while the cab is on a simulated wrong turn. */
  detour: { from: LatLng; bearing: number; travelledMetres: number; rejoinAtMetres: number } | null;
  arrived: boolean;
}

export const INITIAL_SIMULATION: CabSimulation = { travelledMetres: 0, detour: null, arrived: false };

/** How far the simulated wrong turn goes before the cab heads back. */
export const DETOUR_LENGTH_METRES = 900;

export interface CabPosition {
  point: LatLng;
  bearing: number;
}

export function cabPosition(route: readonly LatLng[], simulation: CabSimulation): CabPosition {
  if (simulation.detour) {
    const { from, bearing, travelledMetres } = simulation.detour;
    // Out along the wrong road, then straight back to where it turned off.
    const outward = Math.min(travelledMetres, DETOUR_LENGTH_METRES);
    const back = Math.max(0, travelledMetres - DETOUR_LENGTH_METRES);
    const offset = Math.max(0, outward - back);
    return { point: destinationPoint(from, bearing, offset), bearing: back > 0 ? (bearing + 180) % 360 : bearing };
  }
  const along = pointAlongPolyline(route, simulation.travelledMetres);
  return { point: along.point, bearing: along.bearing };
}

export function advanceSimulation(route: readonly LatLng[], simulation: CabSimulation, metres: number): CabSimulation {
  if (simulation.arrived || metres <= 0 || route.length < 2) return simulation;
  if (simulation.detour) {
    const travelledMetres = simulation.detour.travelledMetres + metres;
    if (travelledMetres >= DETOUR_LENGTH_METRES * 2) return { ...simulation, travelledMetres: simulation.detour.rejoinAtMetres, detour: null };
    return { ...simulation, detour: { ...simulation.detour, travelledMetres } };
  }
  const total = polylineLengthMetres(route);
  const travelledMetres = Math.min(total, simulation.travelledMetres + metres);
  return { ...simulation, travelledMetres, arrived: travelledMetres >= total };
}

/** Sends the cab off the planned route, roughly at a right angle to the current road. */
export function startWrongTurn(route: readonly LatLng[], simulation: CabSimulation): CabSimulation {
  if (simulation.detour || simulation.arrived || route.length < 2) return simulation;
  const here = pointAlongPolyline(route, simulation.travelledMetres);
  return {
    ...simulation,
    detour: { from: here.point, bearing: (here.bearing + 75) % 360, travelledMetres: 0, rejoinAtMetres: simulation.travelledMetres },
  };
}

export function remainingMetres(route: readonly LatLng[], simulation: CabSimulation): number {
  return Math.max(0, polylineLengthMetres(route) - simulation.travelledMetres);
}
