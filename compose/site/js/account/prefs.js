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

export function createPrefsSync({ api, storage, playerId, applyLook = () => {}, onExpired = () => {}, debounceMs = 800,
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = (t) => clearTimeout(t) }) {
  const KEY = 'wa.prefs:' + playerId;
  let other = {}; // the account's other prefs, kept as they are
  let timer = null;
  let stopped = false;
  const dirty = () => { try { return storage.getItem(KEY) === 'dirty'; } catch (e) { return false; } };
  const setDirty = (on) => { try { if (on) storage.setItem(KEY, 'dirty'); else storage.removeItem(KEY); } catch (e) { /* ignore */ } };

  async function pull() {
    if (stopped) return 'stopped';
    if (dirty()) return push();
    const r = await api.getPrefs();
    if (r.status === 401) { stop(); onExpired(); return 'expired'; }
    if (!r.ok || !r.data) return 'later';
    other = r.data.prefs && typeof r.data.prefs === 'object' ? r.data.prefs : {};
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
    setDirty(true);
    if (stopped) return;
    if (timer) clearTimer(timer);
    timer = setTimer(() => { timer = null; return push(); }, debounceMs);
  }

  async function push() {
    if (stopped) return 'stopped';
    const look = readLook(storage);
    const r = await api.putPrefs({ theme: look.theme, dayStyle: look.dayStyle, prefs: { ...other, saved: 1, voice: look.voice } });
    if (r.ok) { setDirty(false); return 'saved'; }
    if (r.status === 401) { setDirty(true); stop(); onExpired(); return 'expired'; }
    setDirty(true);
    return 'later';
  }

  function stop() {
    stopped = true;
    if (timer) { clearTimer(timer); timer = null; }
  }

  return { pull, changed, push, flush: () => (dirty() ? push() : Promise.resolve('clean')), stop, get pending() { return dirty(); } };
}
