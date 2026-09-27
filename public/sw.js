/* ============================================
   SacraDigit — service worker (installable app)

   What it caches: the site's own pages, scripts,
   styles and images, plus Tailwind and Google Fonts,
   so pages you've opened before load offline.
   What it never caches: parish data and sign-in
   (AppSync, Cognito, S3) — those always go to the
   network, so nobody ever sees stale or someone
   else's records.

   Pages: network first (always the latest), cache
   as a fallback, then offline.html.
   Vite's hashed files (/assets/…): cache first —
   their names change whenever their content does.
   Everything else: serve from cache, refresh in
   the background.

   Bump VERSION to drop every old cache on update.
   ============================================ */

const VERSION = 'v1';
const CACHE = `sacradigit-${VERSION}`;
const BASE = new URL(self.registration.scope).pathname; // e.g. /CAPSTONE_SACRADIGIT/
const OFFLINE_URL = `${BASE}offline.html`;
const PRECACHE = [OFFLINE_URL, `${BASE}icons/icon-192.png`, `${BASE}manifest.webmanifest`];

// Third-party files the pages need to render (styles and fonts).
const CACHEABLE_HOSTS = new Set(['cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com']);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('sacradigit-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameSite = url.origin === self.location.origin && url.pathname.startsWith(BASE);

  if (req.mode === 'navigate' && sameSite) {
    event.respondWith(networkFirst(req));
  } else if (sameSite && url.pathname.startsWith(`${BASE}assets/`)) {
    event.respondWith(cacheFirst(req));
  } else if (sameSite || CACHEABLE_HOSTS.has(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req, event));
  }
  // Anything else (parish data, sign-in, uploads) isn't touched.
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match(OFFLINE_URL));
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  const refresh = fetch(req)
    .then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; })
    .catch(() => hit || Response.error());
  if (hit) { event.waitUntil(refresh); return hit; }
  return refresh;
}
