const BUILD_ID = '__BUILD_ID__';
const BUILD_ASSETS = /*__BUILD_ASSETS__*/ [];
const CACHE_NAME = `goonsquad-app-${BUILD_ID}`;
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/goonsquad-logo-v3.png',
  '/goonsquad-crest-v3.png',
  '/goonsquad-icon-v3-192.png',
  '/goonsquad-icon-v3-512.png',
  '/goonsquad-icon-maskable-v3-512.png',
  '/goonsquad-apple-touch-icon-v3.png',
  '/goonsquad-favicon-v3-64.png',
  '/goonsquad-social-v3.jpeg',
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
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const previousAppCaches = keys.filter((key) => (
      key.startsWith('goonsquad-app-') && key !== CACHE_NAME
    ));
    await Promise.all(previousAppCaches.map((key) => caches.delete(key)));
    await self.clients.claim();

    if (previousAppCaches.length > 0) {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      windows.forEach((client) => {
        const releaseUrl = new URL(client.url);
        releaseUrl.searchParams.set('__release', BUILD_ID);
        client.navigate(releaseUrl.href).catch(() => {
          // A later focus or navigation will load the active release.
        });
      });
    }
  })());
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

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data?.json() || {};
  } catch {
    payload = { body: event.data?.text() || 'Coach sent an attendance reminder.' };
  }

  const options = {
    body: payload.body || 'Coach is checking the lineup. Tap to answer.',
    icon: '/goonsquad-icon-v3-192.png',
    badge: '/goonsquad-favicon-v3-64.png',
    tag: payload.tag || 'goonsquad-attendance',
    renotify: true,
    requireInteraction: true,
    actions: Array.isArray(payload.actions) ? payload.actions.slice(0, 2) : [],
    data: {
      actionUrls: payload.actionUrls || {},
      url: payload.url || '/?content=home',
    },
  };

  event.waitUntil(self.registration.showNotification(
    payload.title || 'Goonsquad attendance',
    options,
  ));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const requestedUrl = data.actionUrls?.[event.action] || data.url || '/?content=home';
  const destination = new URL(requestedUrl, self.location.origin).toString();

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const sameOriginWindow = windows.find((client) => {
      try {
        return new URL(client.url).origin === self.location.origin;
      } catch {
        return false;
      }
    });
    if (sameOriginWindow) {
      await sameOriginWindow.navigate(destination);
      return sameOriginWindow.focus();
    }
    return self.clients.openWindow(destination);
  })());
});
