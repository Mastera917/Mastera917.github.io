const CACHE_NAME = 'mma-timer-v1';
const urlsToCache = [
  './index.html',
  './manifest.json',
  './icono-192.png',
  './icono-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Devuelve el archivo de la memoria si existe, si no, lo busca en la red
        return response || fetch(event.request);
      })
  );
});