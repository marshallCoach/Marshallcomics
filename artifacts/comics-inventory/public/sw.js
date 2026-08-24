// Marshall Comics — offline service worker.
// Caches the app shell + cover images so the site works with no connection
// (e.g. on a plane). Covers auto-cache as you view them; a bulk "Save covers
// offline" action pre-caches every cover before you go offline.
const APP = "mc-app-v3";
const IMG = "mc-covers-v3";
const IMG_HOSTS = ["comicvine.gamespot.com", "static.wikia.nocookie.net"];
const startUrl = () => self.registration.scope + "index.html";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  // drop old cache versions
  for (const k of await caches.keys()) if (![APP, IMG].includes(k)) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Cover images (cross-origin CDNs) — cache-first, opaque no-cors is fine for <img>.
  if (IMG_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => {
      const c = await caches.open(IMG);
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req, { mode: "no-cors" }); c.put(req, res.clone()); return res; }
      catch { return hit || Response.error(); }
    })());
    return;
  }

  // App navigations — network first, fall back to cached index.html (offline SPA).
  if (req.mode === "navigate") {
    e.respondWith((async () => {
      try { return await fetch(req); }
      catch { return (await caches.match(startUrl())) || (await caches.match(req)) || Response.error(); }
    })());
    return;
  }

  // Same-origin assets (JS/CSS/covers.json/data) — stale-while-revalidate.
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const c = await caches.open(APP);
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await net) || fetch(req);
    })());
  }
});

// Bulk pre-cache: the page sends every cover URL; we fetch+store any missing ones
// and report progress so the user can prepare for offline use.
self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "PRECACHE_COVERS") {
    e.waitUntil((async () => {
      const c = await caches.open(IMG);
      const urls = d.urls || [];
      let done = 0, added = 0;
      const post = (type) => e.source && e.source.postMessage({ type, done, added, total: urls.length });
      for (const u of urls) {
        try {
          if (!(await c.match(u))) { const r = await fetch(u, { mode: "no-cors" }); await c.put(u, r.clone()); added++; }
        } catch { /* skip dead/unreachable */ }
        done++;
        if (done % 40 === 0) post("PRECACHE_PROGRESS");
      }
      post("PRECACHE_DONE");
    })());
  }
});
