const CACHE = "gst-billing-v29";
const ASSETS = [
  "./index.html","./manifest.json","./icon-192.png","./icon-512.png","./apple-touch-icon.png",
];
self.addEventListener("install", (e) => {
  // cache:"reload" skips the browser's HTTP cache so a new release never caches the old page.
  e.waitUntil(caches.open(CACHE).then((c) =>
    Promise.all(ASSETS.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})))
  ));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  // The app page: always try the network first so updates show up on the next open; fall back to the
  // cached copy when offline.
  if (e.request.mode === "navigate" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/")) {
    e.respondWith(
      fetch(e.request, { cache: "no-store" })
        .then((res) => {
          if (res && res.status === 200) { const clone = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", clone)); }
          return res;
        })
        .catch(() => caches.match("./index.html", { ignoreSearch: true }))
    );
    return;
  }
  // Icons / manifest: cache first, refresh in the background.
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cached) => {
      const network = fetch(e.request).then((res) => {
        if (res && res.status === 200) { const clone = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, clone)); }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
