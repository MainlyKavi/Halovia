import { Bike, BusFront, CarTaxiFront, CircleGauge, Footprints, Route } from "lucide-react";
import type { TravelType } from "@/lib/types";

export const selectableTravelTypes: TravelType[] = [
  "cab",
  "autoRickshaw",
  "motorcycle",
  "walking",
  "publicTransport",
  "other",
];

const icons = {
  cab: CarTaxiFront,
  autoRickshaw: CircleGauge,
  motorcycle: Bike,
  walking: Footprints,
  publicTransport: BusFront,
  other: Route,
} satisfies Record<TravelType, typeof Route>;

export function TransportIcon({ type, size = 20, className }: { type: TravelType; size?: number; className?: string }) {
  const Icon = icons[type] ?? Route;
  return <Icon size={size} className={className} aria-hidden="true" />;
}
