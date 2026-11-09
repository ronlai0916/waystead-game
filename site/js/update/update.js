// One-load updates (G4b, fixed in C2-3 Part 0), the same for Spellbright,
// Wordbright and Composition.
// THIS FILE IS A COPY: edit shared/update/ and run `node tools/sync-shared.mjs`.
//
// A new release's worker installs and takes over (sw.js: skipWaiting,
// clients.claim), then this page loads itself again: at once, or at the next
// safe moment when a game, a test or a comic move is in progress.
//
// What used to go wrong (Safari kept compose-2026-11-08a until every tab was
// closed and site data cleared):
//   1. A page only looked for a new version when it was loaded. The games route
//      by #hash, so a tab left open never checked again; Safari does not check
//      on focus either. Now: on load, whenever the tab comes back into view, and
//      every 30 minutes.
//   2. The update waited until the child LEFT a play page. A whole comic (and a
//      whole own story) is one page, so the moment never came. Now Composition
//      says when a move is finished (safePoint()) and the page reloads then,
//      with everything saved.
//   3. A page opened with no worker (a first visit, a hard reload) ignored every
//      later takeover: "had a worker" was decided once, at load. Now only the
//      first takeover of such a page is ignored (it is already current).
//   4. Nothing helped a new worker stuck "waiting" (WebKit has not always
//      honoured skipWaiting() during install): the old one keeps serving until
//      every tab is closed. Now the page tells a waiting worker to take over
//      (sw.js listens for {type: 'skip-waiting'}).
//   And the worker is registered with updateViaCache: 'none', so neither sw.js
//   nor anything it imports is ever answered from the HTTP cache.
//
// A broken release can't spin the page: never two immediate reloads within 10 s
// (one that comes too soon is tried again when the 10 s are up). A reload at
// the end of a comic move isn't held back: it can't loop.
//
// The worker takes a few seconds to install (longer on a phone), and until then
// the old app is all there is. settled() says when that wait is over, so a page
// the old app doesn't know can wait instead of saying it isn't there.

export const UPDATE_WAIT_MS = 10000;
export const CHECK_EVERY_MS = 30 * 60 * 1000;
export const RELOAD_GUARD_MS = 10000;
export const GUARD_KEY = 'sb.updateReload';
export const SAFE_EVENT = 'sb:safe';

/**
 * navigator.serviceWorker where the site may use one: https, or localhost when
 * `sb.swTest` is set (the smoke tests); else null.
 */
export function workerContainer(nav = globalThis.navigator, loc = globalThis.location, storage = globalThis.localStorage) {
  if (!nav || !('serviceWorker' in nav) || !loc) return null;
  if (loc.protocol === 'https:') return nav.serviceWorker;
  try {
    if (loc.hostname === 'localhost' && storage && storage.getItem('sb.swTest') === '1') return nav.serviceWorker;
  } catch (e) { /* storage blocked */ }
  return null;
}

/** A move is finished and saved: an update waiting for one can load now (Composition's comics). */
export function safePoint(target = globalThis) {
  if (target && typeof target.dispatchEvent === 'function' && typeof Event === 'function') target.dispatchEvent(new Event(SAFE_EVENT));
}

// sw: navigator.serviceWorker (workerContainer()), or null where there is none.
// isBusy(): a game, test or comic is in progress. reload(): load the page again.
// onLeave(fn): fn whenever the player moves to another page.
// onSafe(fn): fn whenever a move is finished (default: the sb:safe event).
// onVisible(fn): fn whenever the tab comes back into view (default: visibilitychange).
// Call this before anything else that waits: a worker can take over early.
export function watchForUpdate({
  sw, isBusy = () => false, reload, onLeave = () => {},
  onSafe = (fn) => { if (typeof globalThis.addEventListener === 'function') globalThis.addEventListener(SAFE_EVENT, fn); },
  onVisible = defaultOnVisible,
  wait = UPDATE_WAIT_MS, setTimer = setTimeout, every = (fn, ms) => setInterval(fn, ms),
  storage = safeStorage(), now = () => Date.now(),
}) {
  if (!sw) return { register() {}, settled: () => Promise.resolve(), check: () => Promise.resolve(null) };
  let controlled = !!sw.controller;
  let queued = false;
  let ready = Promise.resolve(null);

  function tooSoon() {
    try {
      const since = now() - (Number(storage && storage.getItem(GUARD_KEY)) || 0);
      return since >= 0 ? Math.max(0, RELOAD_GUARD_MS - since) : 0; // a clock put back: no wait
    } catch (e) { return 0; } // storage blocked
  }
  // guarded: an immediate reload waits out the 10 s (and is tried again then).
  // A finished move isn't guarded: it can't loop, the child must finish another.
  function reloadOnce({ guarded = true } = {}) {
    const left = guarded ? tooSoon() : 0;
    if (left > 0) { queued = false; setTimer(apply, left + 50); return; }
    try { if (storage) storage.setItem(GUARD_KEY, String(now())); } catch (e) { /* blocked */ }
    reload();
  }
  function apply() {
    if (!isBusy()) { reloadOnce(); return; }
    if (queued) return;
    queued = true;
    onLeave(() => { if (!isBusy()) reloadOnce(); }); // not on the next word: when the game is left
    onSafe(() => reloadOnce({ guarded: false })); // or when a comic move is finished and saved
  }
  sw.addEventListener('controllerchange', () => {
    if (!controlled) { controlled = true; return; } // this page's first worker: it is already current
    apply();
  });

  // Look for a new version; tell one that is waiting to take over.
  async function check() {
    const reg = await ready;
    if (!reg) return null;
    try { await reg.update(); } catch (e) { /* offline: only what is here */ }
    const nudge = () => { if (reg.waiting && controlled) reg.waiting.postMessage({ type: 'skip-waiting' }); };
    nudge();
    if (reg.installing) {
      const w = reg.installing;
      w.addEventListener('statechange', () => { if (w.state === 'installed') nudge(); });
    }
    return reg;
  }

  // Is a new worker on its way? Stays pending while one is, as the reload ends
  // the wait; resolves when there is none, or it failed.
  async function coming() {
    if (!controlled) return;
    const reg = await check();
    if (!reg) return;
    const w = reg.installing || reg.waiting;
    if (!w) return;
    await new Promise((resolve) => w.addEventListener('statechange', () => { if (w.state === 'redundant') resolve(); }));
  }

  return {
    register() {
      ready = sw.register('sw.js', { updateViaCache: 'none' }).catch(() => null);
      ready.then((reg) => { if (reg) check(); });
      onVisible(() => { check(); });
      every(() => { check(); }, CHECK_EVERY_MS);
    },
    check,
    settled: () => Promise.race([coming(), new Promise((resolve) => { setTimer(resolve, wait); })]),
  };
}

function defaultOnVisible(fn) {
  const d = globalThis.document;
  if (!d || typeof d.addEventListener !== 'function') return;
  d.addEventListener('visibilitychange', () => { if (d.visibilityState === 'visible') fn(); });
}
function safeStorage() {
  try { return globalThis.sessionStorage || null; } catch (e) { return null; }
}
