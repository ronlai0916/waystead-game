// Offline support for Composition (scope /compose/). The app shell, the tasks and the
// comic data are cached on install; pictures, stickers and fonts the first time they're used. A new version
// takes over at once and the page reloads itself then (update.js). Bump VERSION on
// every release. Only "compose-…" caches are ever deleted. Account calls are never
// cached, apart from the Waystead voice's MP3s (the shared "voice" cache).
const VERSION = 'compose-2026-11-08b';

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'css/styles/garden.css',
  'css/styles/paint.css',
  'css/styles/night.css',
  'data/tasks.json',
  'data/comic.json',
  'data/stickers.json',
  'assets/icons/favicon.svg',
  'assets/icons/apple-touch-icon.png',
  'js/account/api.js',
  'js/account/boot.js',
  'js/account/chip.js',
  'js/account/config.js',
  'js/account/forget.js',
  'js/account/gate.js',
  'js/account/importer.js',
  'js/account/merge.js',
  'js/account/player.js',
  'js/account/prefs.js',
  'js/account/session.js',
  'js/account/sync.js',
  'js/app.js',
  'js/celebrate.js',
  'js/checks.js',
  'js/comic-doc.js',
  'js/comic-render.js',
  'js/comic-views.js',
  'js/daystyle.js',
  'js/feedback.js',
  'js/gate.js',
  'js/grownups-data.js',
  'js/grownups-views.js',
  'js/nav/nav.js',
  'js/own-views.js',
  'js/safe-text.js',
  'js/speech.js',
  'js/store.js',
  'js/tasks.js',
  'js/theme-boot.js',
  'js/thememenu.js',
  'js/ui.js',
  'js/update.js',
  'js/views.js',
  'js/voice/menu.js',
  'js/voice/server.js',
  'js/voice/voice.js',
  'js/who.js',
  'js/wordcheck.js',
  'js/writing-doc.js',
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
    await Promise.all(keys.filter((k) => k.startsWith('compose-') && k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// G8c: the Waystead voice's recordings (GET <account>/api/voice/<voiceId>/<word>,
// MP3): their own runtime cache, "voice", shared by both games, cache-first,
// at most 1,500 files (the oldest go first). Only a 200 audio answer is kept;
// a 401, 404, 429 or 503 never is. Never in the shell, and kept across
// VERSION changes (only "<game>-…" caches are deleted). Every other account
// call goes to the network and is never cached.
const VOICE_CACHE = 'voice';
const VOICE_MAX = 1500;
const VOICE_ORIGINS = ['https://account.waystead.co.uk', 'http://localhost:3000'];
const VOICE_PATH = /^\/api\/voice\/en-GB-[A-Za-z0-9-]{1,40}\/[a-z]{2,20}$/;
const isVoiceRequest = (url) => VOICE_ORIGINS.includes(url.origin) && VOICE_PATH.test(url.pathname);

async function voiceRecording(req) {
  const cache = await caches.open(VOICE_CACHE);
  const hit = await cache.match(req.url);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.status === 200 && /^audio\//.test(res.headers.get('content-type') || '')) {
    await cache.put(req.url, res.clone());
    const keys = await cache.keys(); // oldest first
    for (let i = 0; i < keys.length - VOICE_MAX; i++) await cache.delete(keys[i]);
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // G8c: a Waystead voice recording: the "voice" cache (above).
  if (isVoiceRequest(url)) { event.respondWith(voiceRecording(req)); return; }
  // Otherwise never the Waystead account (its API, its avatars): those go to the network,
  // and only the browser's own cache may keep a picture. Nor any /api path here.
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

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
