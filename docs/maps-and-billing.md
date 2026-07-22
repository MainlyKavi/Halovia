# Maps and routing

Halovia uses an open, no-key map stack for its small MVP pilot. No Google Cloud project, billing account, API key, or map ID is required.

## Services

- **MapLibre GL JS** renders the interactive map in the browser.
- **OpenFreeMap** supplies OpenStreetMap-based vector tiles and light/dark map styles. Its public instance requires no registration or API key and MapLibre displays the required attribution.
- **Photon** supplies destination suggestions through Halovia's same-origin backend proxy. Halovia waits until at least three characters are entered, debounces requests by 350 ms, cancels stale requests, rate-limits the backend, and shows at most five results.
- **FOSSGIS OSRM** supplies best-effort driving and walking routes, distance, and duration. Halovia recalculates only after at least 100 metres of movement, a destination or travel-type change, or an explicit retry.

## Cost and limits

The current integration has no metered billing configuration and costs $0 to operate at the provider layer. These are community/public services without a paid service-level agreement. They may rate-limit, change policy, or become temporarily unavailable. Halovia keeps the last known location visible and shows calm retry states when search or routing fails.

This setup is appropriate for the five-user MVP preview. Before a larger or paid public launch, replace public search and routing with a contracted provider or self-hosted services, add server-side throttling and caching, and complete privacy/legal review.

## Attribution and responsible use

- Keep MapLibre/OpenFreeMap/OpenStreetMap attribution visible on every map.
- Do not hide, cover, or remove provider attribution controls.
- Do not bulk-download map data, scrape geocoding results, or run load tests against public services.
- Search is restricted to interactive user queries and routing to active journeys.
- Exact locations must not be written to logs.

## Testing

- Unit and build tests do not call public map services.
- Manual tests should use a small number of normal searches and routes.
- Test map, search, and routing failure independently so the journey UI retains its last useful state.
- Verify both light and dark styles, mobile gestures, attribution, RTL layouts, and reconnect/retry behavior.
