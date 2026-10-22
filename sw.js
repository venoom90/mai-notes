// sw.js — MAi Notes V1.11.6
// История изменений:
//  V1.11.6 (22.10.2026): Кэш v54. Обновление из-за правок в index.html (Hotfix UI Safe Areas).
//  V1.11.5 (22.10.2026): Кэш v53. Обновление из-за правок в ai.js, logic.js, state.js.
//  V1.11.4 (22.10.2026): Кэш v52. Добавлены vendor/ и js/dialog.js.
const CACHE_NAME = 'mai-cache-v54';
const ASSETS = [
  './', './index.html', './manifest.json', './icon.svg',
  './js/state.js', './js/utils.js', './js/storage.js',
  './js/render.js', './js/logic.js', './js/app.js', './js/fs.js', './js/ai.js',
  './js/dialog.js',
  './vendor/tailwind.js',
  './vendor/lucide.js',
  './vendor/marked.min.js',
  './vendor/purify.min.js',
  './vendor/jszip.min.js'
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