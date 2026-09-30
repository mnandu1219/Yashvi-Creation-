const CACHE = "gst-billing-v56";
const ASSETS = [
  "./index.html","./manifest.json","./icon-yc-192.png","./icon-yc-512.png","./apple-touch-icon-yc.png",
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
  // A server error page (e.g. 503) is never shown instead of the saved copy, and on a weak signal the
  // saved copy opens after 3 seconds (the new one is still saved for the next open).
  if (e.request.mode === "navigate" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/")) {
    const netP = fetch(e.request, { cache: "no-store" });
    e.waitUntil(netP.then((res) => {
      if (res && res.ok && !res.redirected) { const clone = res.clone(); return caches.open(CACHE).then((c) => c.put("./index.html", clone)); }
    }).catch(() => {}));
    const saved = () => caches.match("./index.html", { ignoreSearch: true });
    e.respondWith((async () => {
      try {
        // a host redirect (e.g. /index.html -> /) goes back to the browser to follow
        const good = netP.then((res) => (res && (res.ok || res.type === "opaqueredirect")) ? res : Promise.reject(res));
        const r = await Promise.race([good, new Promise((ok) => setTimeout(ok, 3000, "slow"))]);
        if (r !== "slow") return r;
        return (await saved()) || (await netP);
      } catch (bad) {
        const c = await saved();
        if (c) return c;
        if (bad instanceof Response) return bad;   // nothing saved yet: show what the server sent
        throw bad;
      }
    })());
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
