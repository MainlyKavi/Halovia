import type { LatLng } from "./geo.ts";

/**
 * Ride data source. Halovia has no partnership or API access with any ride
 * app, so the only implementation here is `MockRideProvider`. A real
 * integration (deep link callback, partner API, or Android notification
 * parsing with user consent) would implement this same interface and the rest
 * of the app would not change.
 */
export type RideBrand = "rapido" | "ola" | "uber";

export interface RidePlace {
  label: string;
  address: string;
  location: LatLng;
}

export interface RideDriver {
  name: string;
  rating: number;
  /** Masked or proxy number, as ride apps provide. Demo values are not real. */
  phone: string;
  /** Optional photo URL from the provider. The mock leaves it empty and the UI draws an illustrated portrait. */
  photoUrl?: string;
  trips: number;
}

export interface RideVehicle {
  model: string;
  colour: string;
  plate: string;
  category: "cab" | "auto" | "bike";
}

export interface RideDetails {
  id: string;
  brand: RideBrand;
  driver: RideDriver;
  vehicle: RideVehicle;
  pickup: RidePlace;
  drop: RidePlace;
  /** Minutes until the driver reaches the pickup point. */
  pickupEtaMinutes: number;
  /** Estimated trip duration once on board. */
  tripMinutes: number;
  fareInr: number;
  otp: string;
  bookedAt: string;
  isSimulated: boolean;
}

export interface RideProvider {
  readonly brand: RideBrand;
  readonly label: string;
  /** True when the data comes from a real partner integration. */
  readonly isLive: boolean;
  getActiveRide(): Promise<RideDetails | null>;
}

export const RIDE_BRANDS: ReadonlyArray<{ brand: RideBrand; label: string }> = [
  { brand: "rapido", label: "Rapido" },
  { brand: "ola", label: "Ola" },
  { brand: "uber", label: "Uber" },
];

export function brandLabel(brand: RideBrand): string {
  return RIDE_BRANDS.find((item) => item.brand === brand)?.label ?? brand;
}

// Echelon Institute of Technology: OpenStreetMap node 4211294504 (Nominatim
// reverse geocode: Chirsi, Faridabad, Haryana 121101).
export const DEMO_PICKUP: RidePlace = {
  label: "Echelon Institute of Technology",
  address: "Kabulpur, Road Naharpar, Manjhawali, Faridabad, Haryana 121101",
  location: { lat: 28.3872703, lng: 77.4440745 },
};

// Town Park, Sector 12: OpenStreetMap way 761709949 (Nominatim).
export const DEMO_DROP: RidePlace = {
  label: "Town Park",
  address: "Sector 12, Faridabad, Haryana 121001",
  location: { lat: 28.4399036, lng: 77.316528 },
};

const demoVehicles: Record<RideBrand, { vehicle: RideVehicle; fareInr: number }> = {
  rapido: { vehicle: { model: "Maruti Suzuki Dzire", colour: "White", plate: "HR 51 BK 4821", category: "cab" }, fareInr: 312 },
  ola: { vehicle: { model: "Hyundai Aura", colour: "Silver", plate: "HR 51 AT 7316", category: "cab" }, fareInr: 338 },
  uber: { vehicle: { model: "Toyota Etios", colour: "White", plate: "HR 29 AC 2954", category: "cab" }, fareInr: 356 },
};

export function createMockRide(brand: RideBrand, now = Date.now()): RideDetails {
  const { vehicle, fareInr } = demoVehicles[brand];
  return {
    id: `mock-${brand}-${now.toString(36)}`,
    brand,
    driver: { name: "Ramesh Kumar", rating: 4.8, phone: "+91 00000 00000", trips: 2_317 },
    vehicle,
    pickup: DEMO_PICKUP,
    drop: DEMO_DROP,
    pickupEtaMinutes: 2,
    tripMinutes: 24,
    fareInr,
    otp: "4721",
    bookedAt: new Date(now).toISOString(),
    isSimulated: true,
  };
}

export class MockRideProvider implements RideProvider {
  readonly isLive = false;
  readonly brand: RideBrand;
  private readonly now: () => number;

  constructor(brand: RideBrand, now: () => number = Date.now) {
    this.brand = brand;
    this.now = now;
  }

  get label(): string {
    return brandLabel(this.brand);
  }

  async getActiveRide(): Promise<RideDetails | null> {
    return createMockRide(this.brand, this.now());
  }
}
