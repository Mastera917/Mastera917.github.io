const CACHE_NAME = 'mma-timer-v2';
const urlsToCache = [
  './index.html',
  './styles.css',   // <-- Nuevo archivo añadido
  './app.js',       // <-- Nuevo archivo añadido
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
        return response || fetch(event.request);
      })
  );
});