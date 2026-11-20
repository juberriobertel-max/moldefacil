// Service Worker nativo compatible con Next.js 16 (Turbopack) para lectura offline
// de la revista, guías guardadas, vistas de comunidad y generador 2D.
const CACHE_NAME = "moldefacil-offline-v1";
const PRECACHE_URLS = [
  "/",
  "/comunidad",
  "/blog",
  "/taller",
  "/cuenta",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/auth/")) return;

  // Navegación e imágenes estáticas con network-first + respaldo offline en caché
  event.respondWith(
    fetch(req)
      .then((resp) => {
        if (resp && resp.status === 200 && resp.type === "basic") {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return resp;
      })
      .catch(() => caches.match(req))
  );
});
