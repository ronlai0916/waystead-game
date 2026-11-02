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
import { accountOrigin } from './config.js';
import { createApi } from './api.js';
import { createSession } from './session.js';
import { createSync } from './sync.js';
import { createPrefsSync } from './prefs.js';
import { mountChip } from './chip.js';
import { deviceId } from './player.js';
import { SIGNED_OUT_PARAM, forgetPlayer, withoutSignedOut } from './forget.js';
import { offerImport, askImport } from './importer.js';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
function storageOf(win, name) {
  try { const s = win[name]; s.getItem('wa.player'); return s; } catch (e) { return memoryStorage(); }
}

export function startAccount({ win = window, doc = document, slot = null, game = null, docs = null, usePlayer = () => {},
  redraw = () => {}, busy = () => false, applyLook = () => {}, importer = null, fetch = undefined }) {
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
    if (reason === 'expired' || (reason === 'signout' && busy() && !signedOut)) {
      // Mid-game: keep playing and saving on this device under the same
      // player; sending resumes when they sign in again. Next visit: signed out.
      if (sync) sync.stop();
      if (prefs) prefs.stop();
      return;
    }
    if (reason !== 'same') { connect(player); redraw(); }
    if (player) catchUp(player);
  });

  win.addEventListener('online', () => { if (sync) sync.flush(); if (prefs) prefs.flush(); });
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') { if (sync) sync.flush(); if (prefs) prefs.flush(); }
    else if (session.player && sync) sync.pull();
  });
  win.addEventListener('wa:look', () => { if (prefs) prefs.changed(); });

  const ready = session.refresh().then((r) => {
    if (signedOut && !r.offline) {
      if (!r.player && leaving) forgetPlayer(local, leaving.id);
      try { if (win.history && win.history.replaceState) win.history.replaceState(win.history.state, '', withoutSignedOut(win.location.href)); } catch (e) { /* keep the URL */ }
    }
    return r;
  });
  return { session, api, origin, ready, get sync() { return sync; }, get prefs() { return prefs; } };
}
