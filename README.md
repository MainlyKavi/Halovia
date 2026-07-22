# Halovia real-world MVP

Halovia is a mobile-first journey-sharing web MVP. An authenticated owner starts a journey with a genuine browser geolocation reading, confirms a map destination and safety ETA, creates an expiring viewer link, and shares it manually. A trusted contact can open that capability link on another device to see the latest saved position, route information, transport and vehicle details, safety state, and event timeline.

Halovia is not an emergency service. It does not automatically send SMS, calls, invitations, push notifications, or emergency-service requests. Foreground web/PWA location may stop when a tab closes, a browser is suspended, a screen locks, or an operating system restricts background work.

## Architecture

- Vinext, React 19, TypeScript, Vite, and Cloudflare Workers-compatible output
- MapLibre, OpenFreeMap, Photon, and OSRM for the production map, destination search, route line, ETA, and distance without a billing account or browser key
- Dispatch-owned Sign in with ChatGPT identity headers for journey owners
- Cloudflare D1 as the authoritative store for profiles, contacts, journeys, locations, events, safety checks, viewer sessions, feedback, and rate limits
- Cloudflare R2 private object storage for optional vehicle images
- Cryptographically random viewer tokens; only SHA-256 token hashes are stored
- Controlled five-second viewer polling because this Sites build has no Durable Object/WebSocket binding
- Genuine `getCurrentPosition` during setup and one central `watchPosition` lifecycle during active sharing
- A bounded temporary browser queue that keeps at most five readings and sends only the newest relevant coordinate after reconnection

Browser storage is not authoritative for journeys. It contains only theme, language, locale, country, date format, reduced-motion choice, and the temporary location queue.

## Core policies

| Policy | Value |
| --- | ---: |
| Minimum client/server location interval | 10 seconds |
| Significant movement threshold | 15 metres |
| Maximum accepted accuracy | 120 metres |
| “Accuracy limited” threshold | 60 metres |
| Stale-location threshold | 45 seconds |
| Route recalculation deviation | 100 metres |
| Location retries | 4, bounded exponential backoff |
| Offline queue | 5 readings; newest relevant reading preferred |
| Viewer polling fallback | 5 seconds |
| Viewer link default expiry | 24 hours |
| Viewer link maximum expiry | 72 hours |
| Vehicle image limit | 4 MB in the UI; 8 MB absolute server limit |
| Vehicle image formats | JPEG, PNG, WebP |
| Stored route history cap | 500 recent coordinates per active journey |
| Safety-check response | Owner-selectable 30, 45, or 60 seconds |
| Safety extension | One extension of exactly 2 minutes |
| Journey retention | 7 or 30 days |

## Required configuration

Copy `.env.example` to `.env.local` for local development.

```text
HALOVIA_LOCAL_USER_EMAIL=developer@example.com
```

`HALOVIA_LOCAL_USER_EMAIL` is accepted only on `localhost`/`127.0.0.1`. Never set it in hosted production. Hosted identity must arrive in the `oai-authenticated-user-email` header from the Sites Sign in with ChatGPT flow.

### Open map stack

No map environment variables are required. OpenFreeMap provides the MapLibre styles, Photon provides destination suggestions, and community OSRM endpoints provide walking or driving routes. Public-transport ETA is an approximate driving route in this MVP because the community router does not provide transit schedules.

These public services are suitable for the five-user preview but have no paid uptime guarantee. Halovia keeps the last known location visible and shows a retry state when a provider is unavailable. See [`docs/maps-and-billing.md`](docs/maps-and-billing.md) for providers, responsible-use limits, attribution, and the production upgrade path.

### D1 and R2

The logical bindings are declared in `.openai/hosting.json`:

```json
{
  "project_id": "appgprj_6a5b9e20dad881919ce5a6fd91e0fddb",
  "d1": "DB",
  "r2": "VEHICLE_IMAGES"
}
```

Apply `drizzle/0001_halovia_mvp.sql` to the D1 database. The Worker can initialise missing tables in local/preview environments, but the checked-in migration is the production deployment record.

The migration creates:

- `users`
- `trusted_contacts`
- `journeys`
- `journey_contacts`
- `journey_locations`
- `journey_events`
- `safety_checks`
- `viewer_sessions`
- `feedback`
- `rate_limits`

The R2 bucket must be private. Vehicle images are returned only after owner authentication or validation of an active, unexpired, unrevoked viewer token.

### Retention schedule

The Worker exports a scheduled retention cleanup that deletes expired completed journeys and their R2 objects without touching active journeys. Configure a daily Worker cron such as `0 3 * * *`. The current Sites metadata format stores only project/D1/R2 bindings, so the cron must be enabled in the hosting dashboard if the publisher does not provision it automatically.

## Local development

Use Node 22.x, matching `package.json`.

```bash
npm install
npm run dev
```

Local authenticated owner routes require `HALOVIA_LOCAL_USER_EMAIL`. Real device geolocation generally requires HTTPS or localhost. The map and destination search need an internet connection but no API key.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

The automated suite covers the default pink theme, preferences and locale independence, RTL/script catalogues, dynamic ETA bounds, launch routing, journey transitions, duplicate check-ins, safety extension, history retention, image validation, service-worker navigation rules, coordinate validation, location throttling, freshness, share expiry bounds, and image policy.

Before a real-world pilot, test at least two physical devices and browsers:

1. Sign in as the owner and complete onboarding.
2. Grant location only when prompted and confirm a genuine coordinate/accuracy.
3. Search for a real destination, choose transport, add optional vehicle data, and start the journey.
4. Create a viewer link; verify the UI says the link was created, not sent.
5. Open it on a second device/network and confirm the viewer does not depend on owner browser storage.
6. Move the owner device and verify fresh, stale, offline, and recovered states.
7. Run safe, help, extension, timeout, revoke, and end-journey transitions on both devices.
8. Confirm revocation and completion stop viewer access and location writes.
9. Test Arabic and Urdu RTL plus Hindi, Spanish, French, Russian, Bengali, Tamil, and narrow 320–390 px layouts.
10. Install the PWA, test `/launch`, offline navigation, and new-deployment cache replacement.

## Security and production limitations

Implemented MVP controls include authenticated owner mutations, ownership checks, origin checks, strict coordinate/file/state validation, rate limits, idempotency windows, expiring/revocable hashed viewer tokens, private image access, noindex/no-store viewer responses, security headers, bounded logs/data, and cleanup of watchers/subscriptions.

A public safety-service launch still requires an independent security audit, abuse testing, verified alert-delivery integrations, account recovery and device management, monitoring and incident response, jurisdiction-specific legal/regulatory review, privacy/data-processing agreements, and operational redundancy. Dependable background location requires native Android and iOS applications with platform location permissions and background services; a PWA cannot guarantee it.

## Cost notes

The current public map stack has no metered billing, while Cloudflare Workers/D1/R2 and any future identity or messaging services may be usage-priced. Before expanding beyond the small pilot, use contracted or self-hosted search/routing and review current hosting prices. The present architecture reduces load through 10-second/15-metre location gating, 100-metre route recalculation, 5-second viewer polling only for active views, 500-coordinate caps, private image limits, and retention cleanup.
