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

export const DEMO_PICKUP: RidePlace = {
  label: "Forum Mall",
  address: "Hosur Road, Koramangala, Bengaluru",
  location: { lat: 12.934892, lng: 77.610937 },
};

export const DEMO_DROP: RidePlace = {
  label: "100 Feet Road",
  address: "HAL 2nd Stage, Indiranagar, Bengaluru",
  location: { lat: 12.971888, lng: 77.640545 },
};

const demoVehicles: Record<RideBrand, { vehicle: RideVehicle; fareInr: number }> = {
  rapido: { vehicle: { model: "Maruti Suzuki Dzire", colour: "White", plate: "KA 03 MX 4821", category: "cab" }, fareInr: 214 },
  ola: { vehicle: { model: "Hyundai Aura", colour: "Silver", plate: "KA 05 AJ 7316", category: "cab" }, fareInr: 238 },
  uber: { vehicle: { model: "Toyota Etios", colour: "White", plate: "KA 01 AH 2954", category: "cab" }, fareInr: 251 },
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
    pickupEtaMinutes: 3,
    tripMinutes: 22,
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
