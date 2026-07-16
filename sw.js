/*
  Radio Bar del Zorro — Service Worker
  Cachea el shell de la app (HTML, CSS, JS, imágenes) para que
  la interfaz cargue offline. El stream de audio y la API de
  metadatos obviamente necesitan internet, pero al menos la
  página no queda en blanco si la conexión falla brevemente.
*/

const CACHE_NAME = "bar-del-zorro-v2";

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/zorro-nocturno.webp",
  "/bar-zorro-fondo.webp",
  "/favicon-zorro.svg",
  "/manifest.json"
];

/* Instalar: pre-cachear el shell */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    })
  );
  self.skipWaiting();
});

/* Activar: limpiar caches viejos */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

/*
  Fetch: network-first para HTML y API, cache-first para assets.
  Nunca cachear el stream de audio ni la API de metadatos.
*/
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  /* No interceptar el stream de audio ni la API */
  if (
    url.hostname === "sonic-us.arkeo.cl" ||
    url.pathname.includes("/stream") ||
    url.pathname.includes("/get_info")
  ) {
    return;
  }

  /* Assets estáticos: cache-first */
  if (
    event.request.destination === "style" ||
    event.request.destination === "script" ||
    event.request.destination === "image" ||
    event.request.destination === "font"
  ) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  /* HTML y demás: network-first con fallback a cache */
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
