// Service Worker: Offline-Cache. Bei jedem Release VERSION erhöhen!
const VERSION = 'v1';
const CACHE = `dart-counter-${VERSION}`;

const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './js/core/board.js',
  './js/core/rules.js',
  './js/core/match.js',
  './js/core/rng.js',
  './js/core/checkout.js',
  './js/core/checkout-table.js',
  './js/core/quick.js',
  './js/bot/throw-model.js',
  './js/bot/strategy.js',
  './js/bot/simulate.js',
  './js/bot/calibration-table.js',
  './js/bot/bot-player.js',
  './js/stats/stats.js',
  './js/stats/csv.js',
  './js/data/db.js',
  './js/data/repo.js',
  './js/ui/app.js',
  './js/ui/dom.js',
  './js/ui/chart.js',
  './js/ui/views/home.js',
  './js/ui/views/setup.js',
  './js/ui/views/game.js',
  './js/ui/views/players.js',
  './js/ui/views/stats.js',
  './js/ui/views/history.js',
  './js/ui/views/backup.js',
  './js/ui/views/dev.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('dart-counter-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

// Cache-first; Navigationsanfragen (auch mit ?dev=1) liefern index.html aus dem Cache.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      const hit = await cache.match('./index.html');
      if (hit) return hit;
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(req);
    } catch {
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});
