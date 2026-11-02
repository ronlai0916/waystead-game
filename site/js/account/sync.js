// Write-through sync of one game's saved values for one player, through
// /api/game/:game/:key (each value has a version; a stale one answers 409).
// THIS FILE IS A COPY: edit shared/account/ and run `node tools/sync-shared.mjs`.
//
// `docs` names each synced key and how to handle it:
//   { read(): value | undefined, write(value), merge(local, remote): value,
//     prepare?(value): value  (trims old history before the size cap) }
//
// · A local change calls changed(key): it is queued at once and sent after a
//   short pause (debounce), so a burst of moves is one request.
// · The queue lives on the device (wa.sync:<player>:<game>: the versions last
//   seen and the keys not yet sent), so changes made offline, or in a tab that
//   closed, are sent later: on 'online', when the page is hidden, and on the
//   next pull.
// · 409: the stored copy is newer. It is merged with ours (the game's rule),
//   saved here, and sent again with the new version.
// · 401: the session ended. onExpired() is told; the queue stays for when the
//   same player signs in again.
// · 413 (too large or profile full): that key stays on this device only.

export const MAX_VALUE_BYTES = 64 * 1024;
export const bytesOf = (v) => new TextEncoder().encode(JSON.stringify(v)).length;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function createSync({ api, game, storage, playerId, docs, onExpired = () => {}, onUpdated = () => {}, debounceMs = 1500,
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (t) => clearTimeout(t), maxTries = 4 }) {
  const KEY = 'wa.sync:' + playerId + ':' + game;
  let state = load();
  let timer = null;
  let running = null;
  let again = false;
  let stopped = false;

  function load() {
    try {
      const s = JSON.parse(storage.getItem(KEY) || 'null');
      if (s && typeof s.ver === 'object' && Array.isArray(s.dirty)) return { ver: s.ver, dirty: s.dirty, local: s.local || {} };
    } catch (e) { /* start afresh */ }
    return { ver: {}, dirty: [], local: {} };
  }
  function save() {
    try { storage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }
  const markDirty = (key) => { if (!state.dirty.includes(key)) state.dirty.push(key); };
  const clean = (key) => { state.dirty = state.dirty.filter((k) => k !== key); };

  function changed(key) {
    if (!docs[key] || state.local[key]) return;
    markDirty(key);
    save();
    if (stopped) return;
    if (timer) clearTimer(timer);
    timer = setTimer(() => { timer = null; return flush(); }, debounceMs);
  }

  async function pull() {
    if (stopped) return 'stopped';
    const r = await api.getGame(game);
    if (r.status === 401) { stop(); onExpired(); return 'expired'; }
    if (!r.ok || !r.data || typeof r.data.items !== 'object') return 'later';
    const updated = [];
    for (const key of Object.keys(docs)) {
      const item = r.data.items[key];
      const doc = docs[key];
      const local = doc.read();
      if (!item) {
        if (local !== undefined && !state.local[key]) markDirty(key);
        continue;
      }
      state.ver[key] = item.version;
      const merged = local === undefined ? item.value : doc.merge(local, item.value);
      if (!same(merged, local)) { doc.write(merged); updated.push(key); }
      if (!same(merged, item.value) && !state.local[key]) markDirty(key);
    }
    save();
    if (updated.length) onUpdated(updated);
    await flush();
    return 'pulled';
  }

  async function flush() {
    if (stopped) return;
    if (timer) { clearTimer(timer); timer = null; }
    if (running) { again = true; return running; }
    running = (async () => {
      do {
        again = false;
        for (const key of [...state.dirty]) {
          const out = await pushOne(key);
          if (out === 'expired' || out === 'later') return;
        }
      } while (again);
    })();
    try { await running; } finally { running = null; }
  }

  async function pushOne(key) {
    const doc = docs[key];
    if (!doc) { clean(key); save(); return 'skipped'; }
    for (let tries = 0; tries < maxTries; tries++) {
      let value = doc.read();
      if (value === undefined) { clean(key); save(); return 'skipped'; }
      if (doc.prepare) {
        const trimmed = doc.prepare(value);
        if (!same(trimmed, value)) { doc.write(trimmed); value = trimmed; }
      }
      if (bytesOf(value) > MAX_VALUE_BYTES) return keepLocal(key);
      const r = await api.putItem(game, key, value, state.ver[key] || 0);
      if (r.ok && r.data) {
        state.ver[key] = r.data.version;
        if (same(doc.read(), value)) clean(key); // changed again meanwhile: send that too
        save();
        if (!state.dirty.includes(key)) return 'saved';
        continue;
      }
      if (r.status === 409 && r.data) {
        state.ver[key] = r.data.version;
        const merged = doc.merge(doc.read(), r.data.value);
        if (!same(merged, doc.read())) { doc.write(merged); onUpdated([key]); }
        save();
        continue;
      }
      if (r.status === 401) { stop(); onExpired(); return 'expired'; }
      if (r.status === 413) return keepLocal(key);
      if (r.offline || r.status === 429 || r.status >= 500) return 'later';
      return 'later'; // 400/403/404: keep it queued; a later release can send it
    }
    return 'later';
  }

  function keepLocal(key) {
    state.local[key] = true;
    clean(key);
    save();
    return 'local';
  }

  function stop() {
    stopped = true;
    if (timer) { clearTimer(timer); timer = null; }
  }

  return {
    changed,
    pull,
    flush,
    stop,
    get pending() { return [...state.dirty]; },
    get versions() { return { ...state.ver }; },
    get localOnly() { return Object.keys(state.local); },
  };
}
