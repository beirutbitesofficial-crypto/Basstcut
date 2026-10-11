/* BASST CUT service worker — makes the site installable and fast offline-first for static assets.
 * Never caches the booking API or the admin panel: those must always be live. */
const VERSION = "basst-v2";
const SHELL = ["/booking/", "/icons/icon-192.png", "/brand/basst-cut-logo-640.webp"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin")) return; // always network

  // Hashed build assets, fonts, images: cache first
  if (/^\/(_next\/static|brand|icons)\//.test(url.pathname) || /\.(woff2|svg|png|webp|jpg)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Pages: network first, fall back to the cached copy when offline
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("/booking/")))
    );
  }
});

// ---------- Push notifications (new booking requests for the barber) ----------
self.addEventListener("push", (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { body: e.data ? e.data.text() : "" };
  }
  e.waitUntil(
    Promise.all([
      self.registration.showNotification(d.title || "BASST CUT", {
        body: d.body || "",
        icon: "/icons/icon-192.png",
        tag: d.tag || "basst",
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: { url: d.url || "/admin/" },
      }),
      // If the admin app is open, refresh it right away.
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((list) => list.forEach((c) => c.postMessage({ type: "basst:new-booking" }))),
    ])
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "/admin/", self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin + "/admin") && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
