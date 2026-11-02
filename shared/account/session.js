// The signed-in player for this page. It starts from the device's cache
// (wa.player), so the chip and the player's own progress show at once, even
// offline; GET /api/me then confirms, updates or clears it.
// THIS FILE IS A COPY: edit shared/account/ and run `node tools/sync-shared.mjs`.
//
// Listeners hear { player, prev, reason }:
//   'same'     the same player (their name or picture may have changed);
//   'signin'   someone signed in (the cache was empty);
//   'switch'   a different player now (e.g. "Switch player" on /play);
//   'signout'  /api/me says nobody is signed in;
//   'expired'  a data call answered 401 part-way through.
// The page decides what to redraw; nothing saved on the device is deleted.
//
// `reach` says whether the account answered: 'unknown' (not asked yet),
// 'online' (it answered /api/me), 'offline' (no network, or the service is
// down: a network error or a 5xx). A 401 from /api/me is an answer: signed out.
import { cachedPlayer, cachePlayer, playerFromMe } from './player.js';

export function createSession({ api, storage, origin }) {
  let player = cachedPlayer(storage);
  let checked = false;
  let reach = 'unknown';
  const listeners = new Set();
  const emit = (e) => listeners.forEach((fn) => fn(e));

  async function refresh() {
    const r = await api.me();
    const signedOut = r.status === 401;
    if (!signedOut && (!r.ok || !r.data)) { reach = 'offline'; return { offline: true, player }; }
    checked = true;
    reach = 'online';
    const next = signedOut ? null : playerFromMe(r.data, origin);
    const prev = player;
    player = next;
    cachePlayer(storage, next);
    const was = prev ? prev.id : null;
    const now = next ? next.id : null;
    const reason = was === now ? 'same' : was && now ? 'switch' : now ? 'signin' : 'signout';
    if (reason !== 'same' || next) emit({ player, prev, reason }); // 'same' when signed in: the name or picture may be new
    return { player, reason };
  }

  function expired() {
    if (!player) return;
    const prev = player;
    player = null;
    cachePlayer(storage, null);
    emit({ player: null, prev, reason: 'expired' });
  }

  return {
    get player() { return player; },
    get checked() { return checked; },
    get reach() { return reach; },
    refresh,
    expired,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
