const CACHE = "conteo-rapido-v29";
const CORE = [
  "./",
  "./index.html",
  "./styles.css",
  "./icon.svg",
  "./js/app.js",
  "./js/config.js",
  "./js/db.js",
  "./js/lots.js",
  "./js/inventory.js",
  "./js/scanner.js",
  "./js/audio-test.js",
  "./js/excel.js",
  "./js/sync.js",
  "./manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
      const response = await fetch(request);
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    } catch (error) {
      // La página de inicio solo es una reserva para navegaciones.
      // Devolver HTML ante una petición JS/CSS hace que falle con MIME incorrecto.
      if (request.mode === "navigate") {
        const fallback = await caches.match("./index.html");
        if (fallback) return fallback;
      }
      return new Response("Recurso no disponible sin conexión.", {
        status: 503,
        statusText: "Offline",
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    }
  })());
});