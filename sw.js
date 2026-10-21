const CACHE_NAME = 'mai-cache-v17'; // БАМП!
const ASSETS = [
  './', './index.html', './manifest.json',
  './js/state.js', './js/utils.js', './js/storage.js',
  './js/render.js', './js/logic.js', './js/app.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.map((name) => name !== CACHE_NAME ? caches.delete(name) : undefined)
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request, { ignoreSearch: true }).then(c => c || caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then(c => c || fetch(event.request)));
});