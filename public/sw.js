const BUILD_ID = '__BUILD_ID__';
const BUILD_ASSETS = /*__BUILD_ASSETS__*/ [];
const CACHE_NAME = `goonsquad-app-${BUILD_ID}`;
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/goonsquad-favicon-v2-32.png',
  '/goonsquad-favicon-v2-64.png',
  '/goonsquad-icon-v2-192.png',
  '/goonsquad-icon-v2-512.png',
  '/goonsquad-icon-v2-1024.png',
  '/goonsquad-icon-maskable-v2-512.png',
  '/goonsquad-apple-touch-icon-v2.png',
];
const PRECACHE_ASSETS = [...new Set([...APP_SHELL, ...BUILD_ASSETS])];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const contentType = response.headers.get('content-type') ?? '';
          if (response.ok && contentType.includes('text/html')) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(async () => (
          await caches.match(request)
          || await caches.match('/')
          || Response.error()
        )),
    );
    return;
  }

  if (!['script', 'style', 'image', 'font', 'manifest', 'worker'].includes(request.destination)) return;

  event.respondWith(
    caches.match(request).then(async (cached) => {
      const refresh = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
      if (cached) {
        event.waitUntil(refresh.catch(() => undefined));
        return cached;
      }
      return refresh;
    }),
  );
});
