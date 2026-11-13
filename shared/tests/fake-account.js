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
    children: () => [], // adult id -> [{ id, nickname, year, avatar }]
    // SB4 /api/scan/*: `missing` (the default) = the real endpoint does not exist yet, so every route is a 404.
    // `reply(bytes, type)` may answer { status, body } in place of the usual words (a string body is sent as text).
    scan: { missing: true, on: false, limit: 20, left: 20, hourLeft: 5, paused: false, consent: null, version: 'v1', vendor: 'Test vendor', reply: null },
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
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  const firstOfNextMonth = () => {
    const d = new Date();
    const y = d.getUTCMonth() === 11 ? d.getUTCFullYear() + 1 : d.getUTCFullYear();
    return y + '-' + String((d.getUTCMonth() + 1) % 12 + 1).padStart(2, '0') + '-01';
  };
  const bytes = (v) => new TextEncoder().encode(JSON.stringify(v)).length;

  const scanRoute = (u, method, init, rawBytes, rawType) => {
    const sc = acct.scan;
    if (sc.missing) return json(404, { error: 'not-found' });
    const me = acct.who;
    if (!me || !me.signedIn) return json(401, { signedIn: false });
    const isChild = me.kind === 'child' || !!me.playingAs;
    if (u.pathname === '/api/scan/allowance' && method === 'GET') {
      return json(200, { on: sc.on, left: sc.left, limit: sc.limit, hourLeft: sc.hourLeft, resetsOn: firstOfNextMonth(), paused: sc.paused, consent: sc.consent, consentVersion: sc.version, vendor: sc.vendor });
    }
    if (u.pathname === '/api/scan/consent' && method === 'POST') {
      const b = init.body ? JSON.parse(init.body) : {};
      sc.consent = { at: new Date().toISOString(), version: b.version };
      return json(200, { consent: sc.consent });
    }
    if (u.pathname === '/api/scan/words' && method === 'POST') {
      if (isChild) return json(403, { error: 'adult-session-required' });
      if (!sc.on) return json(404, { error: 'not-found' });
      if (sc.paused) return json(503, { error: 'scan-paused' });
      if (!sc.consent || sc.consent.version !== sc.version) return json(412, { error: 'consent-required', version: sc.version });
      if (rawType !== 'image/jpeg') return json(415, { error: 'bad-image' });
      if (rawBytes.length > 2097152) return json(413, { error: 'image-too-large' });
      if (sc.hourLeft === 0) return json(429, { error: 'hourly-limit' }, { 'Retry-After': '3600' });
      if (sc.left === 0) return json(429, { error: 'monthly-limit', resetsOn: firstOfNextMonth() });
      sc.left -= 1;
      sc.hourLeft -= 1;
      if (sc.reply) { const r = sc.reply(rawBytes, rawType); return json(r.status, r.body); }
      return json(200, { words: ['friend', 'because', 'island'], left: sc.left, resetsOn: firstOfNextMonth() });
    }
    return json(404, { error: 'not-found' });
  };

  acct.fetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method || 'GET';
    const isScan = u.pathname.startsWith('/api/scan/');
    // A scanned picture is never kept: only its size and type are recorded.
    const rawBytes = isScan && u.pathname === '/api/scan/words' && init.body != null ? Buffer.from(init.body) : null;
    const rawType = rawBytes ? ((init.headers && (init.headers['Content-Type'] || init.headers['content-type'])) || '') : '';
    acct.calls.push(rawBytes
      ? { method, path: u.pathname, credentials: init.credentials, bytes: rawBytes.length, type: rawType }
      : { method, path: u.pathname, credentials: init.credentials, body: init.body });
    if (init.credentials !== 'include') throw new Error('every call must send credentials: include');
    if (acct.offline) throw new TypeError('Failed to fetch');
    if (u.pathname === '/api/me') return acct.meStatus ? json(acct.meStatus, { error: 'forced' }) : json(200, acct.who || { signedIn: false });
    if (isScan) return scanRoute(u, method, init, rawBytes, rawType);
    if (acct.failNext && acct.failNext.times > 0) {
      acct.failNext.times -= 1;
      return json(acct.failNext.status, { error: 'forced' });
    }
    const pid = profile();
    if (!pid) return json(401, { signedIn: false });
    const body = init.body ? JSON.parse(init.body) : undefined;
    // /api/children (waystead-account src/lib/data-api.ts): an adult playing as themselves, their own children only.
    const kids = /^\/api\/children(?:\/([^/]+)\/game\/(spellbright|wordbright|compose)(?:\/([A-Za-z0-9._:-]{1,64}))?)?$/.exec(u.pathname);
    if (kids) {
      const me = acct.who;
      if (me.kind !== 'parent' || me.playingAs) return json(403, { error: 'adult-session-required' });
      const mine = acct.children(me.id);
      const [, cid, game, key] = kids;
      if (!cid) return json(200, { children: mine });
      if (!mine.some((c) => c.id === cid)) return json(404, { error: 'no-such-child' });
      if (!acct.data.has(cid)) acct.data.set(cid, new Map());
      const rows = acct.data.get(cid);
      if (!key && method === 'GET') {
        const items = {};
        for (const [k, v] of rows) if (k.startsWith(game + '/')) items[k.slice(game.length + 1)] = v;
        return json(200, { game, items });
      }
      if (method !== 'PUT') return json(405, { error: 'method' });
      if (bytes(body.value) > 65536) return json(413, { error: 'value-too-large' });
      const id = game + '/' + key;
      const cur = rows.get(id);
      if ((cur ? cur.version : 0) !== body.version) return json(409, { error: 'version-conflict', value: cur ? cur.value : null, version: cur ? cur.version : 0 });
      const next = { value: JSON.parse(JSON.stringify(body.value)), version: (cur ? cur.version : 0) + 1, updatedAt: new Date().toISOString() };
      rows.set(id, next);
      return json(200, { version: next.version, updatedAt: next.updatedAt });
    }
    if (u.pathname === '/api/prefs') {
      const cur = acct.prefs.get(pid) || { theme: 'system', dayStyle: 'garden', prefs: {} };
      if (method === 'GET') return json(200, cur);
      if (bytes(body.prefs || {}) > 4096) return json(413, { error: 'prefs-too-large' });
      const next = { ...cur, ...body };
      acct.prefs.set(pid, next);
      return json(200, next);
    }
    const m = /^\/api\/game\/(spellbright|wordbright|compose)(?:\/([A-Za-z0-9._:-]{1,64}))?$/.exec(u.pathname);
    if (!m) return json(404, { error: 'unknown-game' });
    const [, game, key] = m;
    // A parent's values: only through /api/children (waystead-account src/lib/data-api.ts).
    if (game === 'compose' && ['settings', 'marks'].includes(key) && method !== 'GET') return json(403, { error: 'parent-only-key' });
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
