const CACHE_VERSION = "halovia-v4";
const PAGE_CACHE = `${CACHE_VERSION}-pages`;
const ASSET_CACHE = `${CACHE_VERSION}-assets`;
const CORE_PAGES = ["/", "/offline", "/manifest.webmanifest"];
const CORE_ASSETS = [
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(Promise.all([
    caches.open(PAGE_CACHE).then((cache) => cache.addAll(CORE_PAGES)),
    caches.open(ASSET_CACHE).then((cache) => cache.addAll(CORE_ASSETS)),
  ]).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(
    keys.filter((key) => !key.startsWith(CACHE_VERSION)).map((key) => caches.delete(key)),
  )).then(() => self.clients.claim()));
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_URLS" || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter((url) => {
    try { return new URL(url).origin === self.location.origin; } catch { return false; }
  });
  event.waitUntil(caches.open(ASSET_CACHE).then((cache) => Promise.all(urls.map((url) => cache.add(url).catch(() => undefined)))));
});

async function navigationResponse(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(PAGE_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (await caches.match(request)) || (await caches.match("/offline")) || new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

async function assetResponse(request) {
  const cached = await caches.match(request);
  if (cached) {
    fetch(request).then(async (response) => {
      if (response.ok) await (await caches.open(ASSET_CACHE)).put(request, response);
    }).catch(() => undefined);
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.ok) await (await caches.open(ASSET_CACHE)).put(request, response.clone());
    return response;
  } catch {
    return new Response("Asset unavailable while offline", { status: 503, headers: { "Content-Type": "text/plain" } });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(request));
    return;
  }
  if (["script", "style", "font", "image"].includes(request.destination)) {
    event.respondWith(assetResponse(request));
    return;
  }
  event.respondWith(fetch(request).catch(async () => (await caches.match(request)) || new Response("Unavailable while offline", { status: 503 })));
});
