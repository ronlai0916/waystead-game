// One call per page: the player chip, the look through /api/prefs and, in a
// game, its progress through /api/game. Signed out, nothing here changes how
// the page works: the chip offers sign-in, and the game keeps today's keys.
// THIS FILE IS A COPY: edit shared/account/ and run `node tools/sync-shared.mjs`.
//
// options:
//   slot          the empty .playermenu element in the top bar
//   game, docs    'spellbright' / 'wordbright', and docs(playerId) -> the synced keys (sync.js)
//   usePlayer(p)  point the game's store at this player's keys (null: today's keys)
//   redraw()      draw the current view again (new player, or newer progress)
//   busy()        true while a game is being played: then nothing is redrawn under it
//   applyLook()   apply sb.theme / sb.dayStyle after they change
//   importer      { gameName, has(), run(playerId, deviceId) -> keys changed } for the one-time question
//   setInterval, now  for the once-a-minute check while the page is visible (tests pass their own)
//
// It answers { session, api, origin, ready, gate(path, locked), signInHref() }:
// gate() is gate.js's answer for a route; signInHref() is the account's sign-in
// with this page (without ?signedout=1) as the return URL.
//
// G6b: the session is checked again (GET /api/me) when the page gets focus or
// becomes visible, and once a minute while it is visible, so signing out in
// another tab or on the account site shows the "Sign in to play" card here
// too. Signed out or expired (a 401) mid-game: the game is already saved on
// the device, the queue keeps what is not sent yet, and the card shows; signing
// in again comes back to the same page (Wordbright resumes its saved game).
// Back from the account's /signout (?signedout=1): the card at once.
import { accountOrigin, signInUrl } from './config.js';
import { createApi } from './api.js';
import { createSession } from './session.js';
import { createSync } from './sync.js';
import { createPrefsSync } from './prefs.js';
import { mountChip } from './chip.js';
import { deviceId } from './player.js';
import { SIGNED_OUT_PARAM, forgetPlayer, withoutSignedOut } from './forget.js';
import { offerImport, askImport } from './importer.js';
import { gateFor } from './gate.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function storageOf(win, name) {
  try { const s = win[name]; s.getItem('wa.player'); return s; } catch (e) { return memoryStorage(); }
}

export function startAccount({ win = window, doc = document, slot = null, game = null, docs = null, usePlayer = () => {},
  redraw = () => {}, busy = () => false, applyLook = () => {}, importer = null, fetch = undefined,
  setInterval: every = (fn, ms) => (typeof win.setInterval === 'function' ? win.setInterval(fn, ms) : null), now = () => Date.now() }) {
  const origin = accountOrigin(win.location);
  const api = createApi(fetch ? { origin, fetch } : { origin });
  const local = storageOf(win, 'localStorage');
  const tab = storageOf(win, 'sessionStorage');
  const session = createSession({ api, storage: local, origin });
  // Back from the account's /signout: forget the player who left (forget.js),
  // once /api/me confirms nobody is signed in.
  let signedOut = false;
  try { signedOut = new URL(win.location.href).searchParams.get(SIGNED_OUT_PARAM) === '1'; } catch (e) { /* no URL */ }
  const leaving = signedOut ? session.player : null;
  let sync = null;
  let prefs = null;
  // G6b: back from /signout, nobody plays from the cached player, even before /api/me answers.
  let leftNow = signedOut;
  const expired = () => session.expired();

  function connect(player) {
    if (sync) sync.stop();
    if (prefs) prefs.stop();
    sync = null;
    prefs = null;
    usePlayer(player, (key) => { if (sync) sync.changed(key); });
    if (!player) return;
    prefs = createPrefsSync({ api, storage: local, playerId: player.id, applyLook, onExpired: expired });
    if (game && docs) sync = createSync({ api, game, storage: local, playerId: player.id, docs: docs(player.id), onExpired: expired, onUpdated: () => { if (!busy()) redraw(); } });
  }

  async function catchUp(player) {
    if (prefs) await prefs.pull();
    if (sync) await sync.pull();
    if (importer && session.player && session.player.id === player.id) {
      await offerImport({
        local, tab, player, game,
        hasDeviceProgress: importer.has,
        ask: (p) => askImport(doc, p, importer.gameName),
        stillPlayer: (id) => !!session.player && session.player.id === id,
        importNow: async (id) => {
          const keys = importer.run(id, deviceId(local));
          if (sync) { keys.forEach((k) => sync.changed(k)); await sync.flush(); }
          if (!busy()) redraw();
        },
      });
    }
  }

  // The cached player first, so the page draws their progress straight away.
  connect(session.player);
  const chip = slot ? mountChip(slot, { session, origin, win, doc }) : null;

  session.on(({ player, reason }) => {
    if (chip) chip.render();
    if (player && leftNow) { leftNow = false; if (reason === 'same') redraw(); } // the sign-out did not happen
    if (reason === 'expired' || reason === 'signout') {
      // The game is saved after every move; stop sending (the queue stays on
      // the device for the next sign-in), then draw again: the card shows.
      // The store still points at the player's keys while the old page cleans up.
      if (sync) sync.stop();
      if (prefs) prefs.stop();
      redraw();
      if (reason === 'signout') connect(null);
      return;
    }
    if (reason !== 'same') { connect(player); redraw(); }
    if (player) catchUp(player);
  });

  win.addEventListener('online', () => {
    if (sync) sync.flush();
    if (prefs) prefs.flush();
    // Back online after "You need to be online": ask again, and show the answer.
    if (session.reach !== 'online') session.refresh().then(() => { if (!busy()) redraw(); });
  });
  // G6b: signed out elsewhere? Ask again on focus, on becoming visible, and
  // once a minute while visible (a focus and a visibilitychange together ask once).
  let lastCheck = 0;
  const recheck = (minGap) => {
    const t = now();
    if (t - lastCheck < minGap || doc.visibilityState === 'hidden') return null;
    lastCheck = t;
    return session.refresh();
  };
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') { if (sync) sync.flush(); if (prefs) prefs.flush(); return; }
    recheck(2000);
    if (session.player && sync) sync.pull();
  });
  win.addEventListener('focus', () => { recheck(2000); });
  every(() => { recheck(55000); }, 60000);
  win.addEventListener('wa:look', () => { if (prefs) prefs.changed(); });

  lastCheck = now();
  const ready = session.refresh().then((r) => {
    if (leftNow && !r.offline && !r.player) leftNow = false; // confirmed: plainly signed out now
    if (signedOut && !r.offline) {
      if (!r.player && leaving) forgetPlayer(local, leaving.id);
      try { if (win.history && win.history.replaceState) win.history.replaceState(win.history.state, '', withoutSignedOut(win.location.href)); } catch (e) { /* keep the URL */ }
    }
    return r;
  });
  function gate(path, locked) {
    const nav = win.navigator;
    let reach = session.reach === 'unknown' && nav && nav.onLine === false ? 'offline' : session.reach;
    if (leftNow && reach === 'unknown') reach = 'online'; // just signed out: the card, no wait
    return gateFor({ play: locked, player: leftNow ? null : session.player, reach });
  }

  return {
    session, api, origin, ready, gate,
    signInHref: () => signInUrl(origin, withoutSignedOut(win.location.href)),
    get sync() { return sync; }, get prefs() { return prefs; },
  };
}
