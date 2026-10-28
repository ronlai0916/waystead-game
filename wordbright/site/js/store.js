// Everything stays in this browser (localStorage). Nothing leaves the device.
// The theme is shared with Spellbright ("sb.theme"); Wordbright's own keys start with "wb.".

const KEYS = { theme: 'sb.theme', game: 'wb.game', setup: 'wb.setup' };

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch (e) { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode: keep going */ }
}

// One saved game at a time: the engine's state, saved after every move.
export function savedGame() {
  const g = read(KEYS.game, null);
  return g && g.state && g.state.version === 1 && Array.isArray(g.state.players) ? g : null;
}
export function saveGame(state) {
  write(KEYS.game, { state, savedAt: new Date().toISOString() });
}
export function clearGame() {
  try { localStorage.removeItem(KEYS.game); } catch (e) { /* ignore */ }
}

// The last choices on the new-game screen.
export const lastSetup = () => read(KEYS.setup, null);
export const saveSetup = (setup) => write(KEYS.setup, setup);

export function getTheme() {
  try {
    const t = localStorage.getItem(KEYS.theme);
    return t === 'light' || t === 'dark' ? t : 'system';
  } catch (e) { return 'system'; }
}
export function setTheme(t) {
  try {
    if (t === 'light' || t === 'dark') localStorage.setItem(KEYS.theme, t);
    else localStorage.removeItem(KEYS.theme);
  } catch (e) { /* ignore */ }
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t);
  else root.removeAttribute('data-theme');
  root.setAttribute('data-theme-mode', t === 'light' || t === 'dark' ? t : 'system');
}
