// A fake Waystead Account API for the tests, as a `fetch`: the rules of
// waystead-account src/lib/data-api.ts and src/lib/api-me.ts that the games
// depend on. /api/me answers 200 {signedIn:false} when signed out; the data
// routes answer 401. Every PUT names the version it last read (0: never seen);
// a stale one answers 409 with the stored value and version. Prefs at most
// 4 KB, a value at most 64 KB. `offline = true` makes every call fail as a
// network error. No cookie or token exists here: `who` is the session.
export function fakeAccount() {
  const acct = {
    who: null, // null, or a /api/me answer
    offline: false,
    calls: [],
    prefs: new Map(), // profile id -> {theme, dayStyle, prefs}
    data: new Map(), // profile id -> Map(game/key -> {value, version, updatedAt})
    failNext: null, // { status, times } for the next data calls
    meStatus: 0, // e.g. 503 (the service down) or 401: what /api/me answers instead
  };
  const profile = () => {
    const me = acct.who;
    if (!me || !me.signedIn) return null;
    if (me.kind === 'child') return me.id;
    return me.playingAs ? me.playingAs.id : me.id;
  };
  const json = (status, body, headers = {}) => ({
    ok: status >= 200 && status < 300, status,
    headers: { get: (k) => headers[k] ?? null },
    json: async () => body,
  });
  const bytes = (v) => new TextEncoder().encode(JSON.stringify(v)).length;

  acct.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method || 'GET';
    acct.calls.push({ method, path: u.pathname, credentials: init.credentials, body: init.body });
    if (init.credentials !== 'include') throw new Error('every call must send credentials: include');
    if (acct.offline) throw new TypeError('Failed to fetch');
    if (u.pathname === '/api/me') return acct.meStatus ? json(acct.meStatus, { error: 'forced' }) : json(200, acct.who || { signedIn: false });
    if (acct.failNext && acct.failNext.times > 0) {
      acct.failNext.times -= 1;
      return json(acct.failNext.status, { error: 'forced' });
    }
    const pid = profile();
    if (!pid) return json(401, { signedIn: false });
    const body = init.body ? JSON.parse(init.body) : undefined;
    if (u.pathname === '/api/prefs') {
      const cur = acct.prefs.get(pid) || { theme: 'system', dayStyle: 'garden', prefs: {} };
      if (method === 'GET') return json(200, cur);
      if (bytes(body.prefs || {}) > 4096) return json(413, { error: 'prefs-too-large' });
      const next = { ...cur, ...body };
      acct.prefs.set(pid, next);
      return json(200, next);
    }
    const m = /^\/api\/game\/(spellbright|wordbright)(?:\/([A-Za-z0-9._:-]{1,64}))?$/.exec(u.pathname);
    if (!m) return json(404, { error: 'unknown-game' });
    const [, game, key] = m;
    if (!acct.data.has(pid)) acct.data.set(pid, new Map());
    const rows = acct.data.get(pid);
    if (!key && method === 'GET') {
      const items = {};
      for (const [k, v] of rows) if (k.startsWith(game + '/')) items[k.slice(game.length + 1)] = v;
      return json(200, { game, items });
    }
    const id = game + '/' + key;
    if (method === 'DELETE') { rows.delete(id); return { ok: true, status: 204, headers: { get: () => null }, json: async () => null }; }
    if (method === 'PUT') {
      if (bytes(body.value) > 65536) return json(413, { error: 'value-too-large' });
      const cur = rows.get(id);
      if ((cur ? cur.version : 0) !== body.version) return json(409, { error: 'version-conflict', value: cur ? cur.value : null, version: cur ? cur.version : 0 });
      const next = { value: JSON.parse(JSON.stringify(body.value)), version: (cur ? cur.version : 0) + 1, updatedAt: new Date().toISOString() };
      rows.set(id, next);
      return json(200, { version: next.version, updatedAt: next.updatedAt });
    }
    return json(405, { error: 'method' });
  };

  // Write a value as another device would (bumping the version).
  acct.put = (pid, game, key, value) => {
    if (!acct.data.has(pid)) acct.data.set(pid, new Map());
    const rows = acct.data.get(pid);
    const cur = rows.get(game + '/' + key);
    rows.set(game + '/' + key, { value, version: (cur ? cur.version : 0) + 1, updatedAt: new Date().toISOString() });
  };
  acct.get = (pid, game, key) => {
    const r = acct.data.get(pid) && acct.data.get(pid).get(game + '/' + key);
    return r ? r.value : undefined;
  };
  return acct;
}

export function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    clear: () => m.clear(),
    keys: () => [...m.keys()],
    get size() { return m.size; },
  };
}

// Timers the test runs by hand (debounce).
export function manualTimers() {
  let next = 1;
  const due = new Map();
  return {
    setTimer: (fn) => { const id = next++; due.set(id, fn); return id; },
    clearTimer: (id) => due.delete(id),
    run: async () => { const fns = [...due.values()]; due.clear(); for (const fn of fns) await fn(); },
    get pending() { return due.size; },
  };
}

export const ADULT = { signedIn: true, kind: 'parent', id: '11111111-1111-4111-8111-111111111111', displayName: 'Alex Green', role: 'parent', playingAs: null };
export const KID_A = { id: '22222222-2222-4222-8222-222222222222', nickname: 'Sam', year: 4, avatar: 'ottie' };
export const KID_B = { id: '33333333-3333-4333-8333-333333333333', nickname: 'Robin', year: 6, avatar: 'fizz' };
export const CHILD_A = { signedIn: true, kind: 'child', id: KID_A.id, nickname: KID_A.nickname, year: 4, avatar: 'ottie', parentId: ADULT.id };
export const playingAs = (kid) => ({ ...ADULT, playingAs: kid });
