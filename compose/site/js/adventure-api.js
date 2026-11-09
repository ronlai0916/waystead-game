// Story Adventure's calls to the Waystead account (C2-3): may this child start a
// story, draw a scene, show a picture; and, for grown-ups, the family's credits,
// a redeem code, deleting a story. Rules: waystead-account src/lib/story-adventure.ts.
// Only ids from our lists are ever sent for a picture (adventure-doc.js sceneRequest).

export function createStoryApi({ origin, fetch: doFetch = (...a) => globalThis.fetch(...a), timeoutMs = 90000 }) {
  async function call(method, path, body) {
    const init = { method, credentials: 'include', mode: 'cors', cache: 'no-store', headers: {} };
    if (body !== undefined) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(body); }
    const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    if (ctrl) init.signal = ctrl.signal;
    try {
      const res = await doFetch(origin + path, init);
      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: null };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  return {
    imageUrl: (id) => origin + '/api/story/image/' + encodeURIComponent(id),
    /** { enabled, consent, canStart } — never a number of credits — or { problem }. */
    async status() {
      const r = await call('GET', '/api/story/status');
      return r.ok && r.data ? r.data : { problem: r.status === 401 ? 'signed-out' : 'network' };
    },
    /** One picture: { kind: 'ok', imageId } | 'blocked' (attemptsLeft, failed) | 'no-credits' | 'off' | 'busy' | 'retry'. */
    async draw(req) {
      const r = await call('POST', '/api/story/scene-image', req);
      const d = r.data || {};
      if (r.ok && d.imageId) return { kind: 'ok', imageId: d.imageId, attemptsLeft: d.attemptsLeft };
      if (r.ok && d.blocked) return { kind: 'blocked', attemptsLeft: d.attemptsLeft, failed: !!d.failed };
      if (r.status === 402) return { kind: 'no-credits' };
      if (r.status === 403 && d.error === 'story-adventure-off') return { kind: 'no-consent' };
      if (r.status === 429) return { kind: 'busy' };
      if (r.status === 503) return { kind: 'off' };
      return { kind: 'retry' };
    },
    family: () => call('GET', '/api/story/family'),
    redeem: (code) => call('POST', '/api/story/redeem', { code }),
    remove: (storyId) => call('DELETE', '/api/story/' + encodeURIComponent(storyId)),
  };
}
