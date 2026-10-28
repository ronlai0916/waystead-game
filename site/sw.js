// Offline support. The app shell and word list are cached on install; pictures
// and audio are cached the first time they're used (and, if the asset list
// names them, fetched in the background after install).
// Bump VERSION on every deploy so phones pick up the new files.
const VERSION = 'spellbright-2026-10-28a';

const SHELL = [
  './',
  'index.html',
  'css/app.css',
  'js/theme-boot.js',
  'js/app.js',
  'js/data.js',
  'js/store.js',
  'js/speech.js',
  'js/ui.js',
  'js/flower.js',
  'js/play.js',
  'js/views.js',
  'data/curriculum.json',
  'data/assets.json',
  'manifest.webmanifest',
  'assets/fonts/sora-latin-var.woff2',
  'assets/fonts/manrope-latin-var.woff2',
  'assets/icons/favicon.svg',
  'assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    self.skipWaiting();
    // Media in the background: a failure here never blocks the install.
    try {
      const res = await cache.match('data/assets.json');
      const a = res ? await res.json() : {};
      const media = [
        ...(a.audioWords || []).map((w) => 'assets/audio/words/' + w + '.mp3'),
        ...(a.audioLetters || []).map((L) => 'assets/audio/letters/' + L + '.mp3'),
        ...(a.images || []).map((f) => 'assets/images/' + f),
      ];
      for (const url of media) {
        try { await cache.add(url); } catch (e) { /* next visit fills it */ }
      }
    } catch (e) { /* ignore */ }
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('spellbright-') && k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Pages: network first so a new deploy shows straight away; cache when offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('index.html')));
    return;
  }
  // Everything else: cache first, then network (and keep a copy).
  event.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic' && !req.headers.has('range')) {
      const cache = await caches.open(VERSION);
      cache.put(req, res.clone());
    }
    return res;
  })());
});
