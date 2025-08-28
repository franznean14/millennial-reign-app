const CACHE = "mr-app-v2";
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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Ignore non-http(s) schemes (e.g., chrome-extension://) and let the network handle them
  try {
    const url = new URL(req.url);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return; // do not intercept
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
