// The player's look, through /api/prefs. The device keys sb.theme and
// sb.dayStyle stay the instant copy (theme-boot reads them before the first
// paint, so there is no flash); the account copy follows the player from
// device to device.
// THIS FILE IS A COPY: edit shared/account/ and run `node tools/sync-shared.mjs`.
//
// · Signing in: if the account has a look saved by a game ({prefs: {saved: 1}}),
//   it is applied here; if it has none yet, this device's look is saved there.
// · A change here is sent after a short pause; offline, it waits (wa.prefs:<player>).
// · The account's theme is system / light / dark: "system" is no sb.theme key.
// · The voice for "Hear" (G8: sb.voice, a voice name; none = the best voice)
//   travels in the account's free-form prefs, as prefs.voice.

const THEMES = ['light', 'dark'];
const DAY_STYLES = ['garden', 'paint'];
// A small per-app extra record (SB5 TR-80: prefs.sbRole = { r, n, at }). Any app may keep one under its own
// name inside the account's free-form prefs; every device keeps what it does not know (`other` is spread
// back on each push), so an old device ignores it and Wordbright and Compose pass it through untouched.
// The account allows 4 KB for all prefs, so one extra is capped at 600 bytes of JSON; a name is 1..32 of
// [A-Za-z0-9_-] and never one of the look's own keys.
export const EXTRA_MAX_BYTES = 600;
const RESERVED = ['saved', 'voice', '__proto__', 'constructor', 'prototype'];
const goodName = (n) => typeof n === 'string' && /^[A-Za-z0-9_-]{1,32}$/.test(n) && !RESERVED.includes(n);
export function cleanExtra(value) {
  if (value === null || value === undefined) return undefined;
  try {
    const v = JSON.parse(JSON.stringify(value));
    if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
    if (new TextEncoder().encode(JSON.stringify(v)).length > EXTRA_MAX_BYTES) return undefined;
    return v;
  } catch (e) { return undefined; }
}
const cleanVoice = (v) => (typeof v === 'string' && v.length <= 100 ? v : '');

export function readLook(storage) {
  let theme = null;
  let dayStyle = null;
  let voice = null;
  try { theme = storage.getItem('sb.theme'); dayStyle = storage.getItem('sb.dayStyle'); voice = storage.getItem('sb.voice'); } catch (e) { /* private mode */ }
  return { theme: THEMES.includes(theme) ? theme : 'system', dayStyle: DAY_STYLES.includes(dayStyle) ? dayStyle : 'garden', voice: cleanVoice(voice) };
}

export function writeLook(storage, look) {
  try {
    if (THEMES.includes(look.theme)) storage.setItem('sb.theme', look.theme);
    else storage.removeItem('sb.theme');
    if (DAY_STYLES.includes(look.dayStyle)) storage.setItem('sb.dayStyle', look.dayStyle);
    if (look.voice !== undefined) {
      if (cleanVoice(look.voice)) storage.setItem('sb.voice', look.voice);
      else storage.removeItem('sb.voice');
    }
  } catch (e) { /* private mode */ }
}

export function createPrefsSync({ api, storage, playerId, applyLook = () => {}, onExpired = () => {}, onRead = () => {}, onRefused = () => {}, debounceMs = 800,
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (t) => clearTimeout(t) }) {
  const KEY = 'wa.prefs:' + playerId;
  const MINE_KEY = 'wa.prefs.mine:' + playerId; // extras waiting to be sent, so a closed tab or a reload keeps them (SB5 M3)
  let other = {}; // the account's other prefs, kept as they are
  let loaded = false; // true only once the account's prefs have been READ: until then a push could wipe other apps' settings
  const mine = {}; // extras set here and not yet sent (null = removed): they win over a pulled copy
  try {
    const saved = JSON.parse(storage.getItem(MINE_KEY) || 'null');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      for (const k of Object.keys(saved)) {
        if (!goodName(k)) continue;
        if (saved[k] === null) mine[k] = null;
        else { const v = cleanExtra(saved[k]); if (v !== undefined) mine[k] = v; }
      }
    }
  } catch (e) { /* private mode or a bad value: nothing waits */ }
  const saveMine = () => {
    try { if (Object.keys(mine).length) storage.setItem(MINE_KEY, JSON.stringify(mine)); else storage.removeItem(MINE_KEY); } catch (e) { /* ignore */ }
  };
  const waiting = () => Object.keys(mine).length > 0;
  let timer = null;
  let stopped = false;
  let refused = false; // S7 (m-4): the account answered 413 (prefs too large): saving stops for this load and one message is shown
  const dirty = () => { try { return storage.getItem(KEY) === 'dirty'; } catch (e) { return false; } };
  const setDirty = (on) => { try { if (on) storage.setItem(KEY, 'dirty'); else storage.removeItem(KEY); } catch (e) { /* ignore */ } };

  async function pull() {
    if (stopped) return 'stopped';
    const wasDirty = dirty() || waiting();
    const r = await api.getPrefs();
    if (r.status === 401) { stop(); onExpired(); return 'expired'; }
    // A failed read is never followed by a save: `other` was not read, so the save would drop every other app's settings.
    if (!r.ok || !r.data) return 'later';
    loaded = true;
    // Read first even when a change waits, so the push carries the account's other prefs (and extras).
    other = r.data.prefs && typeof r.data.prefs === 'object' ? { ...r.data.prefs } : {};
    for (const k of Object.keys(mine)) { if (mine[k] === null) delete other[k]; else other[k] = mine[k]; }
    try { onRead(); } catch (e) { /* a listener must never break the sync (S7: it now runs after the extras are read, so it sees the account's role) */ }
    if (wasDirty) return push();
    if (other.saved === 1) {
      const here = readLook(storage);
      // A look saved before G8 has no voice: this device's choice is kept, and sent.
      const hasVoice = typeof other.voice === 'string';
      const there = { theme: r.data.theme, dayStyle: r.data.dayStyle, voice: hasVoice ? cleanVoice(other.voice) : here.voice };
      if (there.theme !== here.theme || there.dayStyle !== here.dayStyle || there.voice !== here.voice) {
        writeLook(storage, there);
        applyLook();
      }
      if (!hasVoice && here.voice) return push();
      return 'applied';
    }
    return push();
  }

  function changed() {
    if (refused) return; // never retried on every change
    setDirty(true);
    if (stopped) return;
    if (timer) clearTimer(timer);
    timer = setTimer(() => { timer = null; return push(); }, debounceMs);
  }

  async function push() {
    if (stopped) return 'stopped';
    if (!loaded) return pull(); // read the account's prefs first (pull pushes when a change waits)
    const look = readLook(storage);
    const sending = { ...mine };
    const r = await api.putPrefs({ theme: look.theme, dayStyle: look.dayStyle, prefs: { ...other, saved: 1, voice: look.voice } });
    if (r.ok) {
      // keep an extra changed while this save was in flight
      for (const k of Object.keys(sending)) { if (JSON.stringify(mine[k]) === JSON.stringify(sending[k])) delete mine[k]; }
      saveMine();
      setDirty(waiting());
      return 'saved';
    }
    if (r.status === 401) { setDirty(true); stop(); onExpired(); return 'expired'; }
    if (r.status === 413) { // too large: a retry cannot help. The device keeps its copy; nothing waits to be sent.
      refused = true;
      for (const k of Object.keys(mine)) delete mine[k];
      saveMine();
      setDirty(false);
      if (timer) { clearTimer(timer); timer = null; }
      try { onRefused(); } catch (e) { /* a listener must never break the sync */ }
      return 'refused';
    }
    setDirty(true);
    return 'later';
  }

  function stop() {
    stopped = true;
    if (timer) { clearTimer(timer); timer = null; }
  }

  // extra(name): this app's small record, or undefined. setExtra(name, value): value is cleaned (a plain
  // object, <= EXTRA_MAX_BYTES); null removes it; a bad name or value changes nothing and returns false.
  function extra(name) {
    if (!goodName(name) || !Object.prototype.hasOwnProperty.call(other, name)) return undefined;
    const v = other[name];
    return v && typeof v === 'object' && !Array.isArray(v) ? JSON.parse(JSON.stringify(v)) : undefined;
  }
  function setExtra(name, value) {
    if (!goodName(name)) return false;
    if (value === null) { delete other[name]; mine[name] = null; }
    else {
      const v = cleanExtra(value);
      if (v === undefined) return false;
      other[name] = v; mine[name] = v;
    }
    saveMine();
    changed();
    return true;
  }

  return { get refused() { return refused; }, pull, changed, extra, setExtra, push, get loaded() { return loaded; }, flush: () => (dirty() ? push() : Promise.resolve('clean')), stop, get pending() { return dirty(); } };
}
