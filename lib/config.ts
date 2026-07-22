export const LOCATION_POLICY = {
  minimumUpdateIntervalMs: 10_000,
  significantMovementMetres: 15,
  maximumAccuracyMetres: 120,
  poorAccuracyMetres: 60,
  staleAfterMs: 45_000,
  maximumRetryAttempts: 4,
  offlineQueueLimit: 5,
  routeRecalculationMetres: 100,
  destinationSearchDebounceMs: 350,
  destinationSearchMinimumCharacters: 3,
  viewerPollIntervalMs: 5_000,
} as const;

export const SHARING_POLICY = {
  defaultLifetimeHours: 24,
  maximumLifetimeHours: 72,
} as const;

export const IMAGE_POLICY = {
  maximumBytes: 8 * 1024 * 1024,
  acceptedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
} as const;

export const SECURITY_POLICY = {
  locationWritesPerMinute: 12,
  ownerMutationsPerMinute: 60,
} as const;
