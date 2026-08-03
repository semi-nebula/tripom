const CACHE_NAME = 'pomoharbor-v12';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/todo.html',
  '/manifest.json',
  '/icons/pomo-192.png',
  '/icons/pomo-512.png',
  '/icons/pomo-maskable-192.png',
  '/icons/pomo-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32x32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Same-origin HTML pages: try network first, fall back to cache.
  if (url.origin === self.location.origin && (url.pathname === '/' || url.pathname.endsWith('.html'))) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Same-origin static assets: cache first.
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
    return;
  }

  // External requests (CDNs, Firebase, fonts): network only.
});
