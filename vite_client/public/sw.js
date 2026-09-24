// Service Worker for Push Notifications
const CACHE_NAME = 'paarsiv-sw-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/icon-192x192.png',
  '/badge-72x72.png'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        // Silently fail if cache fails
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
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
  return self.clients.claim();
});

// Push event - handle incoming push notifications (mobile-safe icons / fallbacks)
self.addEventListener('push', (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'Paarsiv',
        body: event.data.text() || 'You have a new notification'
      };
    }
  } else {
    data = {
      title: 'Paarsiv',
      body: 'You have a new notification'
    };
  }

  const origin = self.location.origin;
  const defaultIcon = `${origin}/logo192.png`;
  const badIcon = (url) =>
    !url || /^http:\/\//i.test(url) || /localhost|127\.0\.0\.1/i.test(url);
  const title = data.title && data.title !== 'Notification' ? data.title : 'Paarsiv';
  const body = data.body || 'You have a new notification';
  const tag = data.tag || `notification-${Date.now()}`;
  const notificationData = {
    ...(data.data || {}),
    url: data.data?.url || data.url || '/notifications',
  };
  const icon = badIcon(data.icon) ? defaultIcon : data.icon;

  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(title, {
          body,
          icon,
          badge: defaultIcon,
          tag,
          data: notificationData,
          requireInteraction: false,
          renotify: true,
        });
      } catch (err) {
        await self.registration.showNotification(title, {
          body,
          tag,
          data: notificationData,
        });
      }
    })()
  );
});

// Notification click event - open the app when notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url || '/notifications';
  let fullUrl;
  try {
    let path = rawUrl;
    if (/^https?:\/\//i.test(rawUrl)) {
      const parsed = new URL(rawUrl);
      path = `${parsed.pathname}${parsed.search}` || '/notifications';
    } else if (!path.startsWith('/')) {
      path = `/${path}`;
    }
    fullUrl = new URL(path, self.location.origin).href;
  } catch {
    fullUrl = `${self.location.origin}/notifications`;
  }

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.focus();
          if (client.navigate) {
            return client.navigate(fullUrl);
          }
          return client;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(fullUrl);
      }
    })
  );
});

// Background sync (optional - for offline support)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(
      // Handle background sync if needed
      Promise.resolve()
    );
  }
});

// Message event - handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

