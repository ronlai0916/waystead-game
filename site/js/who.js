// Who is at the keyboard, as far as the pages need to know. Set by app.js from
// the account session. An adult playing as themselves is the only 'adult';
// someone playing as a child, or a device still waiting for /api/me (the cached
// player has no kind), is never treated as one.
let read = () => null;
let ask = () => Promise.resolve();
// S7 (FAT F-1): `reach` says whether the account answered ('unknown' | 'online' | 'offline'); `adultMark(id)` is true when a live /api/me once said
// this player is a grown-up on this device (sb.adult:<id>, written by app.js, forgotten at sign-out). Only both together make a cached player an adult.
let reachOf = () => 'unknown';
let marked = () => false;
export function useWho(fn, recheck = ask, extra = {}) {
  read = fn; ask = recheck;
  reachOf = typeof extra.reach === 'function' ? extra.reach : () => 'unknown';
  marked = typeof extra.adultMark === 'function' ? extra.adultMark : () => false;
}
export const reach = () => { try { return reachOf(); } catch (e) { return 'unknown'; } };
const markedAdult = (id) => { try { return marked(id) === true; } catch (e) { return false; } };
export const ADULT_KEY = 'sb.adult:';
/** The rule (agents/S7-coder.md): a cached player (no kind) is an adult only while the account cannot be reached AND this device last heard
 *  /api/me say this very player is a grown-up. A child, a visitor, a player nobody has confirmed: never. */
const cachedAdult = (p) => !!p && p.id && reach() === 'offline' && markedAdult(p.id);
/** Ask the account again: a route has said something the page didn't know. */
export const recheckWho = () => ask();
const player = () => read();
export const playerName = () => (player() ? player().name : '');
/** 'adult', 'child', or 'unknown' before the account has answered. */
export function kind() {
  const p = player();
  if (!p) return 'none';
  if (p.kind === 'adult' || p.kind === 'child') return p.kind;
  return cachedAdult(p) ? 'adult' : 'unknown';
}
export const WHO_WAIT_MS = 8000;
const offlineHtml = (v) => (v === 'st'
  ? '<section class="wrap st-page"><div class="st-card" data-offline-who><h1 class="st-h1">You are offline</h1><p class="st-help">Sign in again when you are back online. Nothing is lost: what you saved on this phone is still here.</p><button type="button" class="btn btn--primary" data-who-retry>Try again</button></div></section>'
  : '<section class="wrap page"><div class="card empty" data-offline-who><h1>You are offline</h1><p class="muted">Sign in again when you are back online. Nothing is lost: what you saved on this phone is still here.</p><button type="button" class="btn btn--primary" data-who-retry>Try again</button></div></section>');
const waitHtml = (v) => (v === 'st'
  ? '<section class="wrap st-page"><div class="st-card" data-who-wait><h1 class="st-h1">Just a moment</h1><p class="st-help">Checking who is here…</p></div></section>'
  : '<section class="wrap page"><div class="card empty" data-who-wait><h1>Just a moment</h1><p class="muted">Checking who is here…</p></div></section>');
function wireRetry(main) {
  const b = main.querySelector && main.querySelector('[data-who-retry]');
  if (b) b.addEventListener('click', () => { Promise.resolve(ask()).catch(() => {}).then(() => { try { window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (e) { /* no window */ } }); });
}
/** A grown-up page while who is here is not known: a short wait, never an endless one. The account cannot be reached (or has not answered
 *  in 8 s): the offline page with Try again, and no data. `v` is the page's look: 'gu' (cards) or 'st' (Set a week). */
export function unknownCard(main, v = 'gu') {
  if (reach() === 'offline') { main.innerHTML = offlineHtml(v); wireRetry(main); return; }
  main.innerHTML = waitHtml(v);
  const el = main.querySelector ? main.querySelector('[data-who-wait]') : null;
  const t = setTimeout(() => {
    if (!el || !main.contains || !main.contains(el) || kind() !== 'unknown') return; // the page moved on, or the answer came
    main.innerHTML = offlineHtml(v);
    wireRetry(main);
  }, WHO_WAIT_MS);
  if (t && t.unref) t.unref();
}
export const isAdult = () => kind() === 'adult';
/** An adult playing as one of their children (a child's own session can't switch). */
export const playingAsChild = () => { const p = player(); return !!p && p.kind === 'child' && p.canSwitch === true; };
/** The child's top bar and pages (SB3-C1) need the kind to be known: only 'child'. 'unknown' keeps today's full top bar. */
export const isKnownChild = () => kind() === 'child';
/** A child's screens (SB3-C1): a signed-in child, or a device still waiting for /api/me. */
export const isChild = () => kind() === 'child' || kind() === 'unknown';

const YEAR_KEY = 'sb.year:';
const asYear = (v) => (Number.isInteger(v) && v >= 1 && v <= 6 ? v : 0);
/**
 * The signed-in child's school year, 1..6, else 0 (SB4). The live player carries `year`
 * once /api/me has answered; it is remembered as `sb.year:<player id>` so a cached player
 * (before /api/me answers, or offline) still has it. An adult not playing as a child, and a
 * signed-out visitor, have none.
 */
export function childYear() {
  const p = player();
  if (!p || !isChild()) return 0;
  const live = asYear(p.year);
  try {
    const ls = globalThis.localStorage;
    if (live) { ls.setItem(YEAR_KEY + p.id, String(live)); return live; }
    return asYear(Number(ls.getItem(YEAR_KEY + p.id)));
  } catch (e) { return live; }
}
