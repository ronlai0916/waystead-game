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
import { cachedPlayer, cachePlayer, playerFromMe } from './player.js';

export function createSession({ api, storage, origin }) {
  let player = cachedPlayer(storage);
  let checked = false;
  const listeners = new Set();
  const emit = (e) => listeners.forEach((fn) => fn(e));

  async function refresh() {
    const r = await api.me();
    if (!r.ok || !r.data) return { offline: true, player };
    checked = true;
    const next = playerFromMe(r.data, origin);
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
    refresh,
    expired,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  };
}
