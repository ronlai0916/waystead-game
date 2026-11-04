// Offline support for Wordbright (scope /wordbright/). The app shell, the word
// graph, the game data, the character pictures and the style sheets of all
// three styles (garden, paint, night) are cached on install. Fonts, the win
// videos and the word-meaning shards (data/meanings/) are cached the first
// time they are used, so a device only keeps the fonts of the styles it shows.
// The meanings index is cached on install, so the index and the shards it
// lists always belong to one VERSION (the old version's cache is deleted on
// activate); meanings.js checks each shard's stamp against the index anyway.
// A new version takes over at once (skipWaiting, clients.claim) and the page
// reloads itself then (app.js), so a release reaches a device in one load.
// Without a font the game still works offline, in the device's own font.
// Bump VERSION on every release so devices pick up the new files. Only caches
// named "wordbright-…" are ever touched (Spellbright keeps "spellbright-…").
const VERSION = 'wordbright-2026-11-04b';

const CHARACTERS = ['pip', 'ottie', 'bramble', 'fizz'].flatMap((name) =>
  ['portrait', 'thinking', 'happy', 'surprised'].flatMap((mood) =>
    [256, 128].map((size) => `assets/characters/${name}-${mood}-${size}.webp`)));

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'css/styles/garden.css',
  'css/styles/paint.css',
  'css/styles/night.css',
  'js/ai/characters.js',
  'js/ai/client.js',
  'js/ai/computer.js',
  'js/ai/hint.js',
  'js/ai/leave.js',
  'js/ai/worker.js',
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
  'js/app.js',
  'js/brand.js',
  'js/data.js',
  'js/meanings.js',
  'js/engine/bag.js',
  'js/engine/board.js',
  'js/engine/game.js',
  'js/engine/levels.js',
  'js/engine/movegen.js',
  'js/engine/rules.js',
  'js/engine/score.js',
  'js/engine/words.js',
  'js/gate.js',
  'js/nav/nav.js',
  'js/pin.js',
  'js/player-data.js',
  'js/store.js',
  'js/theme-boot.js',
  'js/ui/board.js',
  'js/ui/celebrate.js',
  'js/ui/daystyle.js',
  'js/ui/dom.js',
  'js/ui/drag.js',
  'js/ui/moves.js',
  'js/ui/results.js',
  'js/ui/speak.js',
  'js/ui/thememenu.js',
  'js/views/end.js',
  'js/views/home.js',
  'js/views/pages.js',
  'js/views/play.js',
  'js/views/setup.js',
  'data/words_all.dawg',
  'data/board_junior.json',
  'data/board_standard.json',
  'data/board_large.json',
  'data/tiles.json',
  'data/star_words.json',
  'data/leaves.json',
  'data/meanings/index.json',
  'assets/icons/favicon.svg',
  'assets/icons/apple-touch-icon.png',
  ...CHARACTERS,
];

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
    await Promise.all(keys.filter((k) => k.startsWith('wordbright-') && k !== VERSION).map((k) => caches.delete(k)));
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
  if (url.origin !== location.origin || url.pathname.startsWith('/api/') || !url.pathname.startsWith(new URL('./', location).pathname)) return;

  // A ?fresh= request (meanings.js, when a cached index and shard do not
  // match) goes straight to the server and is never kept.
  if (url.searchParams.has('fresh')) return;
  // The voice server's allow-list (G9b) is for the account service, not the game: never kept.
  if (url.pathname.endsWith('/data/voice-allow.txt')) return;

  // Pages: network first so a new release shows straight away; cache when offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(async () => (await caches.open(VERSION)).match('index.html')));
    return;
  }
  if (/\.(webm|mp4)$/.test(url.pathname)) {
    event.respondWith(video(req, url));
    return;
  }
  // Everything else: this version's cache first, then the network (keeping a copy).
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok && res.type === 'basic' && !req.headers.has('range')) cache.put(req, res.clone());
    return res;
  })());
});

// Videos: fetch the whole file once and keep it, then answer the player's
// byte-range requests from the copy (browsers ask for videos in pieces).
async function video(req, url) {
  const cache = await caches.open(VERSION);
  const key = url.origin + url.pathname;
  let full = await cache.match(key);
  if (!full) {
    try {
      const res = await fetch(key);
      if (res.status !== 200) return res;
      await cache.put(key, res.clone());
      full = res;
    } catch (e) {
      return Response.error();
    }
  }
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') || '');
  if (!range) return full;
  const body = await full.arrayBuffer();
  const size = body.byteLength;
  let start = range[1] === '' ? size - Number(range[2]) : Number(range[1]);
  let end = range[1] === '' || range[2] === '' ? size - 1 : Math.min(Number(range[2]), size - 1);
  start = Math.max(0, start);
  if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': full.headers.get('Content-Type') || 'video/mp4',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
