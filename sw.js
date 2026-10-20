const CACHE_NAME = 'zettel-cache-v3'; // Обновили версию
const ASSETS = [
  './manifest.json'
];

self.addEventListener('install', (e) => {
  self.skipWaiting(); // Активируем сразу
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  // Удаляем старые кэши
  e.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  // Если мы запрашиваем HTML-страницу (переход по ссылке или обновление), 
  // ВСЕГДА сначала идем в интернет. 
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  } else {
    // Остальные файлы (иконки и т.д.) ищем в кэше, если нет - в сети
    e.respondWith(
      caches.match(e.request).then((response) => response || fetch(e.request))
    );
  }
});