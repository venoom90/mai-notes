// sw.js — MAi Notes V1.11.27
// История изменений:
//  V1.11.27 (24.10.2026): Кэш v70. Финальный фикс прыжков при вставке промпта.
const CACHE_NAME = 'mai-cache-v70';
const ASSETS = [
  './', './index.html', './manifest.json', './icon.svg',
  './js/state.js', './js/utils.js', './js/storage.js',
  './js/render.js', './js/logic.js', './js/app.js', './js/fs.js', './js/ai.js',
  './js/dialog.js', './js/logger.js',
  './vendor/tailwind.js',
  './vendor/lucide.js',
  './vendor/marked.min.js',
  './vendor/purify.min.js',
  './vendor/jszip.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS.map(url => 
          cache.add(url).catch(err => {
            console.warn(`[SW] Ошибка кэширования файла: ${url}. Проверьте, существует ли он.`, err);
          })
        )
      );
    })
  );
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