// Who is playing, from GET /api/me, and the one thing kept about them on this
// device: `wa.player` = { id, name, avatar } (the avatar is a picture URL).
// Nothing else about the account is stored.
// THIS FILE IS A COPY: edit shared/account/ and run `node tools/sync-shared.mjs`.
//
// A player is { id, name, avatar, kind, canSwitch }:
//   · a child signed in with their slip or a device code: that child;
//   · an adult playing as one of their children (/play): that child;
//   · an adult playing as themselves: the adult (no picture: the chip shows an initial).
// A child's player also carries `year` (1..6) when the account says so (SB4):
// the property is left out otherwise. `year` is never cached in `wa.player`.

export const PLAYER_KEY = 'wa.player';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AVATAR_ID = /^[a-z][a-z-]{0,31}$/;
const AVATAR_URL = /^https?:\/\/[a-z0-9.:-]+\/avatars\/[a-z][a-z-]{0,31}-128\.webp$/;

export const avatarUrl = (origin, id) => (typeof id === 'string' && AVATAR_ID.test(id) ? origin + '/avatars/' + id + '-128.webp' : null);
const cleanName = (s, fallback) => (typeof s === 'string' && s.trim() ? s.trim().slice(0, 40) : fallback);

const yearOf = (y) => (Number.isInteger(y) && y >= 1 && y <= 6 ? { year: y } : {});

export function playerFromMe(me, origin) {
  if (!me || me.signedIn !== true) return null;
  if (me.kind === 'child' && UUID.test(me.id)) {
    return { id: me.id, name: cleanName(me.nickname, 'Player'), avatar: avatarUrl(origin, me.avatar), kind: 'child', canSwitch: false, ...yearOf(me.year) };
  }
  if (me.kind === 'parent' && UUID.test(me.id)) {
    const k = me.playingAs;
    if (k && UUID.test(k.id)) {
      return { id: k.id, name: cleanName(k.nickname, 'Player'), avatar: avatarUrl(origin, k.avatar), kind: 'child', canSwitch: true, ...yearOf(k.year) };
    }
    return { id: me.id, name: cleanName(me.displayName, 'Grown-up'), avatar: null, kind: 'adult', canSwitch: true };
  }
  return null;
}

export function cachedPlayer(storage) {
  try {
    const p = JSON.parse(storage.getItem(PLAYER_KEY) || 'null');
    if (!p || !UUID.test(p.id) || typeof p.name !== 'string') return null;
    return { id: p.id, name: cleanName(p.name, 'Player'), avatar: typeof p.avatar === 'string' && AVATAR_URL.test(p.avatar) ? p.avatar : null };
  } catch (e) { return null; }
}

export function cachePlayer(storage, p) {
  try {
    if (p) storage.setItem(PLAYER_KEY, JSON.stringify({ id: p.id, name: p.name, avatar: p.avatar || null }));
    else storage.removeItem(PLAYER_KEY);
  } catch (e) { /* private mode: keep going */ }
}

// A device key for this player: signed out, today's key unchanged.
export const playerKey = (base, playerId) => (playerId ? base + ':' + playerId : base);

// A random id for this device (wa.device), so a device's progress imported
// into a player twice is recognised and never counted twice.
export function deviceId(storage) {
  try {
    let id = storage.getItem('wa.device');
    if (!/^[0-9a-f]{16}$/.test(id || '')) {
      id = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, '0')).join('');
      storage.setItem('wa.device', id);
    }
    return id;
  } catch (e) { return 'unknown'; }
}
