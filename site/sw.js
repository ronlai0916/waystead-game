// Offline support. The app shell and word list are cached on install; pictures
// and audio are cached the first time they're used, and fetched in the
// background once the new version is active.
// Bump VERSION on every deploy so phones pick up the new files. A new version
// takes over at once and the page reloads itself then (update/update.js).
// Account calls (account.waystead.co.uk) are never cached, apart from the
// Waystead voice's MP3s (G8c, the "voice" cache): see the fetch handler.
// Fonts are not in the shell: each style's fonts are cached the first time
// that style is used (cache-first below).
const VERSION = 'spellbright-2026-11-13e';

const SHELL = [
  './',
  'index.html',
  'css/app.css',
  'css/styles/garden.css',
  'css/styles/paint.css',
  'css/styles/night.css',
  'css/child.css',
  'css/grownups.css',
  'css/adult.css',
  'css/front.css',
  'js/theme-boot.js',
  'js/app.js',
  'js/data.js',
  'js/store.js',
  'js/daystyle.js',
  'js/thememenu.js',
  'js/celebrate.js',
  'js/speech.js',
  'js/ui.js',
  'js/flower.js',
  'js/play.js',
  'js/views.js',
  'js/front-views.js',
  'js/front-doc.js',
  'js/words-views.js',
  'js/words-doc.js',
  'js/study-doc.js',
  'js/test-guard.js',
  'js/study-views.js',
  'js/room.js',
  'js/child-doc.js',
  'js/child-views.js',
  'js/week-choice.js',
  'js/who.js',
  'js/word-info.js',
  'js/games-doc.js',
  'js/games-views.js',
  'js/stories.js',
  'js/story-views.js',
  'js/grownups-data.js',
  'js/grownups-doc.js',
  'js/grownups-views.js',
  'js/adult-doc.js',
  'js/adult-chrome.js',
  'js/spell-run.js',
  'js/wordcheck.js',
  'js/progress-doc.js',
  'js/gate.js',
  'js/update/update.js',
  'js/nav/nav.js',
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
  'js/voice/menu.js',
  'js/voice/server.js',
  'js/voice/voice.js',
  'data/curriculum.json',
  'data/assets.json',
  'data/patterns.json',
  'data/stories.json',
  'manifest.webmanifest',
  'assets/icons/favicon.svg',
  'assets/icons/apple-touch-icon.png',
  'assets/characters/pip-portrait-256.webp',
  'assets/characters/pip-thinking-256.webp',
  'assets/characters/pip-happy-256.webp',
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

// A page that finds this worker waiting asks it to take over (update/update.js):
// WebKit has not always honoured skipWaiting() during install.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'skip-waiting') self.skipWaiting();
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
