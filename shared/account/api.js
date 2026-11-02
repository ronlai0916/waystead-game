// The Waystead Account API, from the browser. Every call sends the session
// cookie (credentials: 'include') and nothing else: no token, email or
// session id is ever read, stored or logged here.
// THIS FILE IS A COPY: edit shared/account/ and run `node tools/sync-shared.mjs`.
//
// Each call answers { ok, status, data, retryAfter }; a network failure (offline,
// the service down, CORS refused) answers { ok: false, status: 0, offline: true }.

export function createApi({ origin, fetch: doFetch = (...a) => globalThis.fetch(...a) }) {
  async function call(method, path, body) {
    const init = { method, credentials: 'include', mode: 'cors', cache: 'no-store', headers: {} };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await doFetch(origin + path, init);
    } catch (e) {
      return { ok: false, status: 0, offline: true, data: null, retryAfter: 0 };
    }
    let data = null;
    if (res.status !== 204) {
      try { data = await res.json(); } catch (e) { data = null; }
    }
    const retry = Number(res.headers && res.headers.get ? res.headers.get('Retry-After') : 0);
    return { ok: res.ok, status: res.status, data, retryAfter: Number.isFinite(retry) ? retry : 0 };
  }
  const part = (s) => encodeURIComponent(s);
  return {
    me: () => call('GET', '/api/me'),
    getPrefs: () => call('GET', '/api/prefs'),
    putPrefs: (prefs) => call('PUT', '/api/prefs', prefs),
    getGame: (game) => call('GET', '/api/game/' + part(game)),
    putItem: (game, key, value, version) => call('PUT', '/api/game/' + part(game) + '/' + part(key), { value, version }),
    deleteItem: (game, key) => call('DELETE', '/api/game/' + part(game) + '/' + part(key)),
  };
}
