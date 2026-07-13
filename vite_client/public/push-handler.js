self.addEventListener('push', (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = {
        title: 'New Notification',
        body: event.data.text() || 'You have a new notification',
      };
    }
  } else {
    data = {
      title: 'New Notification',
      body: 'You have a new notification',
    };
  }

  const origin = self.location.origin;
  const defaultIcon = `${origin}/logo192.png`;

  const options = {
    body: data.body || 'You have a new notification',
    icon: data.icon || defaultIcon,
    badge: data.badge || defaultIcon,
    tag: data.tag || `notification-${Date.now()}`,
    renotify: data.renotify !== false,
    data: data.data || { url: '/' },
    // Keep false on Android — requireInteraction often suppresses/hides banners
    requireInteraction: false,
    vibrate: data.vibrate || [200, 100, 200],
    timestamp: Date.now(),
  };

  event.waitUntil(
    (async () => {
      try {
        await self.registration.showNotification(
          data.title || 'New Notification',
          options
        );
      } catch (err) {
        // Fallback without icon if Android rejects icon URL
        await self.registration.showNotification(data.title || 'New Notification', {
          body: options.body,
          tag: options.tag,
          data: options.data,
          renotify: true,
        });
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';
  let fullUrl;
  try {
    fullUrl = new URL(urlToOpen, self.location.origin).href;
    // Never open localhost links from a production PWA
    if (/localhost|127\.0\.0\.1/i.test(fullUrl) && !/localhost|127\.0\.0\.1/i.test(self.location.origin)) {
      fullUrl = `${self.location.origin}/notifications`;
    }
  } catch {
    fullUrl = `${self.location.origin}/notifications`;
  }

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            if (client.url === fullUrl || client.url.startsWith(self.location.origin)) {
              client.focus();
              if (client.navigate) {
                return client.navigate(fullUrl);
              }
              return client;
            }
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(fullUrl);
        }
      })
  );
});
