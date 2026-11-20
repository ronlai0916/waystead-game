// After "Sign out" (account /signout, which comes back with ?signedout=1):
// this device forgets the player who signed out, so the next person on a
// shared device can't see their copy. Only then: a plain 401 (an expired
// session) keeps everything, so a player who signs in again carries on.
// THIS FILE IS A COPY: edit shared/account/ and run `node tools/sync-shared.mjs`.
//
// Removed: sb.progress:<id>, sb.words:<id>, sb.week:<id>, sb.year:<id>, wb.game:<id>, wb.setup:<id>, wb.stats:<id>,
// sb.role/roleAsk/t3/st/setTab:<id> (SB5, D47), sb.adult:<id> (S7, F-1), wa.prefs:<id>, wa.prefs.mine:<id>, wa.import:<id>:*, wa.sync:<id>:*, wa.player.
// Also, from sessionStorage when it is passed: the one-read hand-offs sb.copyList (a list's words), sb.setChapter, sb.scanWords,
// sb.planWords and sb.selection, which would otherwise survive a sign-out in the same tab.
// Kept: a game whose queue still has changes not yet sent keeps its
// wa.sync:<id>:<game> AND the values it names (e.g. wb.stats:<id>): the queue
// holds only which keys to send, so without them those changes would be lost.
// They are sent when that player signs in on this device again.
import { PLAYER_KEY } from './player.js';

export const SIGNED_OUT_PARAM = 'signedout';
const PREFIX = { spellbright: 'sb', wordbright: 'wb' };
const DATA = ['sb.progress', 'sb.words', 'sb.week', 'sb.year', 'wb.game', 'wb.setup', 'wb.stats', 'sb.role', 'sb.roleAsk', 'sb.t3', 'sb.st', 'sb.setTab', 'sb.adult'];
const HANDOFFS = ['sb.copyList', 'sb.setChapter', 'sb.scanWords', 'sb.planWords', 'sb.selection'];

function keysOf(storage) {
  if (typeof storage.keys === 'function') return storage.keys();
  const out = [];
  for (let i = 0; i < storage.length; i++) out.push(storage.key(i));
  return out;
}

export function forgetPlayer(storage, id, session = null) {
  const removed = [];
  const kept = [];
  try {
    const all = keysOf(storage);
    const keep = new Set();
    for (const game of Object.keys(PREFIX)) {
      const syncKey = 'wa.sync:' + id + ':' + game;
      let dirty = [];
      try { dirty = (JSON.parse(storage.getItem(syncKey) || 'null') || {}).dirty || []; } catch (e) { dirty = []; }
      if (Array.isArray(dirty) && dirty.length) {
        keep.add(syncKey);
        for (const k of dirty) keep.add(PREFIX[game] + '.' + k + ':' + id);
      }
    }
    const doomed = new Set([...DATA.map((b) => b + ':' + id), 'wa.prefs:' + id, 'wa.prefs.mine:' + id, PLAYER_KEY,
      ...all.filter((k) => k.startsWith('wa.import:' + id + ':') || k.startsWith('wa.sync:' + id + ':'))]);
    for (const k of doomed) {
      if (keep.has(k)) { if (storage.getItem(k) !== null) kept.push(k); continue; }
      if (storage.getItem(k) !== null) { storage.removeItem(k); removed.push(k); }
    }
  } catch (e) { /* private mode: nothing kept anyway */ }
  if (session) {
    for (const k of HANDOFFS) { try { if (session.getItem(k) !== null) { session.removeItem(k); removed.push(k); } } catch (e) { /* ignore */ } }
  }
  return { removed: removed.sort(), kept: kept.sort() };
}

// The page's URL without ?signedout=1 (the hash and other parameters kept).
export function withoutSignedOut(href) {
  const u = new URL(href);
  u.searchParams.delete(SIGNED_OUT_PARAM);
  return u.href;
}
