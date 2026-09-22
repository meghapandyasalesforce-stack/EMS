function isUnreachableIconUrl(url) {
  if (!url || typeof url !== 'string') return true;
  return (
    /^http:\/\//i.test(url) ||
    /localhost|127\.0\.0\.1/i.test(url)
  );
}

self.addEventListener('push', (event) => {
  let data = {};

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = {
        title: 'Paarsiv',
        body: event.data.text() || 'You have a new notification',
      };
    }
  } else {
    data = {
      title: 'Paarsiv',
      body: 'You have a new notification',
    };
  }

  const origin = self.location.origin;
  const defaultIcon = `${origin}/logo192.png`;
  const title = data.title && data.title !== 'Notification' ? data.title : 'Paarsiv';
  const body = data.body || 'You have a new notification';
  const tag = data.tag || `notification-${Date.now()}`;
  const notificationData = {
    ...(data.data || {}),
    url: data.data?.url || data.url || '/notifications',
  };

  // Prefer same-origin icons — unreachable localhost icons break Android display
  const icon = isUnreachableIconUrl(data.icon) ? defaultIcon : data.icon;
  const badge = isUnreachableIconUrl(data.badge) ? defaultIcon : data.badge;

  event.waitUntil(
    (async () => {
      // Try full options first, then progressively simpler — Android is picky
      const attempts = [
        {
          body,
          icon,
          badge,
          tag,
          renotify: data.renotify !== false,
          data: notificationData,
          requireInteraction: false,
          vibrate: Array.isArray(data.vibrate) ? data.vibrate : [200, 100, 200],
          timestamp: Date.now(),
        },
        {
          body,
          icon: defaultIcon,
          tag,
          data: notificationData,
          renotify: true,
        },
        {
          body,
          tag,
          data: notificationData,
        },
      ];

      let lastError;
      for (const options of attempts) {
        try {
          await self.registration.showNotification(title, options);
          return;
        } catch (err) {
          lastError = err;
        }
      }
      // Last resort — empty options still surface a tray entry on most Androids
      try {
        await self.registration.showNotification(title || 'Paarsiv', { body, tag });
      } catch (err) {
        console.error('Push showNotification failed', lastError || err);
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawUrl = event.notification.data?.url || '/notifications';
  let fullUrl;
  try {
    // Always resolve on current origin so leave/task/etc. open the right page
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
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client && client.url.startsWith(self.location.origin)) {
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
