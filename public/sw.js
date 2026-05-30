const CACHE = "mr-app-v3"; // Updated cache version to force refresh
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(["/", OFFLINE_URL]))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: data.actions || [],
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Millennial Reign', options)
  );
});

// Handle notification clicks — open business + establishment details via query / postMessage
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const establishmentId = data.establishmentId ? String(data.establishmentId) : '';
  let urlToOpen = data.url || '/business';

  try {
    const target = new URL(urlToOpen, self.location.origin);
    if (establishmentId) {
      target.searchParams.set('establishmentId', establishmentId);
    }
    urlToOpen = target.href;
  } catch {
    urlToOpen = self.location.origin + (urlToOpen.startsWith('/') ? urlToOpen : '/' + urlToOpen);
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const sameOrigin = clientList.filter((client) => {
        try {
          return new URL(client.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });

      if (sameOrigin.length > 0) {
        const client = sameOrigin[0];
        return client.focus().then(() => {
          client.postMessage({
            type: 'PUSH_NAVIGATE',
            establishmentId: establishmentId || null,
            url: urlToOpen,
          });
        });
      }

      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAR_PUSH_SUBSCRIPTION') {
    event.waitUntil(
      self.registration.pushManager.getSubscription()
        .then(subscription => {
          if (subscription) {
            return subscription.unsubscribe();
          }
        })
        .then(() => {
          // Send confirmation back to main thread
          event.ports[0].postMessage({ success: true });
        })
        .catch(error => {
          event.ports[0].postMessage({ success: false, error: error.message });
        })
    );
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Ignore non-http(s) schemes (e.g., chrome-extension://) and let the network handle them
  try {
    const url = new URL(req.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return; // do not intercept
    }
    // Do not intercept cross-origin requests (e.g., Supabase APIs)
    if (url.origin !== self.location.origin) {
      return;
    }
  } catch {
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Only cache successful same-origin GET responses
        try {
          const url = new URL(req.url);
          if ((url.origin === self.location.origin) && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
          }
        } catch {}
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        // Fallback to offline page for navigations
        if (req.mode === "navigate") return caches.match(OFFLINE_URL);
        throw new Error("Network error and no cache");
      })
  );
});
