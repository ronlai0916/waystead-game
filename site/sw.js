// Offline support. The app shell and word list are cached on install; pictures
// and audio are cached the first time they're used, and fetched in the
// background once the new version is active.
// Bump VERSION on every deploy so phones pick up the new files.
const VERSION = 'spellbright-2026-10-28i';

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

// Install the app shell only, so a new version takes over within seconds.
// Pictures and audio are fetched afterwards, in the background (below).
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('spellbright-') && k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
  // Media for offline use, after the switch-over. A failure here only means
  // that file is fetched the first time it's used instead.
  prefetchMedia();
});

async function prefetchMedia() {
  try {
    const cache = await caches.open(VERSION);
    const res = await cache.match('data/assets.json');
    const a = res ? await res.json() : {};
    const v = a.audioVersion ? '?v=' + a.audioVersion : '';
    const media = [
      ...(a.audioWords || []).map((w) => 'assets/audio/words/' + w + '.mp3' + v),
      ...(a.audioLetters || []).map((L) => 'assets/audio/letters/' + L + '.mp3' + v),
      ...(a.images || []).map((f) => 'assets/images/' + f),
    ];
    for (const url of media) {
      if (await cache.match(url)) continue;
      try { await cache.add(url); } catch (e) { /* next visit fills it */ }
    }
  } catch (e) { /* ignore */ }
}

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
    // Only this version's cache: an older one may still hold old files.
    const hit = await (await caches.open(VERSION)).match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic' && !req.headers.has('range')) {
      const cache = await caches.open(VERSION);
      cache.put(req, res.clone());
    }
    return res;
  })());
});
