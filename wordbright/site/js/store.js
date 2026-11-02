// Everything is kept in this browser (localStorage). Signed out, nothing
// leaves the device and the keys are as they always were. Signed in (B4b), the
// saved game, the new-game choices and finished-game results are the player's:
// wb.game:<player id>, wb.setup:<player id>, wb.stats:<player id>
// (player-data.js), which account/sync.js also saves to the Waystead account.
// Allowed words and the grown-up PIN stay this device's either way.
// The theme mode ("sb.theme") and the day style ("sb.dayStyle") are shared with Spellbright; Wordbright's own keys start with "wb.".
// The look itself is set on <html> by theme-boot.js (window.wbTheme).

import { isStoredPin } from './pin.js';
import * as D from './player-data.js';

const KEYS = { theme: 'sb.theme', dayStyle: 'sb.dayStyle', game: 'wb.game', setup: 'wb.setup', allowed: 'wb.allowed', pin: 'wb.pin' };

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch (e) { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode: keep going */ }
}

// ---- whose data ------------------------------------------------------------------
let player = null; // the signed-in player's id, or null (signed out: today's keys)
let playerName = '';
let changed = null; // told the account key after each change, so it is sent
export function usePlayer(id, onChange = null, name = '') {
  player = id || null;
  changed = onChange;
  playerName = name || '';
}
export const currentPlayer = () => player;
const own = (base, id = player) => base + ':' + id;
const tell = (key) => { if (changed) changed(key); };

// The player's saved values as sync.js sends them (undefined: none yet).
export function readValue(key, id = player) {
  const v = read(own('wb.' + key, id), null);
  return v === null ? undefined : key === D.STATS ? D.normaliseStats(v) : v;
}
export const writeValue = (key, value, id = player) => write(own('wb.' + key, id), value);

// This device's signed-out game and choices, for "Save this device's progress to …?".
export const deviceData = () => ({ game: read(KEYS.game, null), setup: read(KEYS.setup, null) });
export const hasDeviceData = () => { const d = deviceData(); return !!(d.game && d.game.state) || !!d.setup; };

// One saved game at a time: the engine's state, saved after every move.
export function savedGame() {
  const g = read(player ? own(KEYS.game) : KEYS.game, null);
  return g && g.state && g.state.version === 1 && Array.isArray(g.state.players) ? g : null;
}
// G9: which game a saved state belongs to (its random id; before G9, its seed).
const gameOf = (st) => (st && st.config ? st.config.gameId || 'seed:' + st.config.seed : null);

// replace: true only when a new game starts (set-up). Otherwise a save never
// overwrites a different game: a second tab, or a computer move that finishes
// after the player has started a new game, cannot bring the old game back.
export function saveGame(state, { replace = false } = {}) {
  if (!replace) {
    const cur = savedGame();
    if (cur && state && gameOf(cur.state) && gameOf(cur.state) !== gameOf(state)) return false;
  }
  const savedAt = new Date().toISOString();
  if (!player) { write(KEYS.game, { state, savedAt }); return; }
  writeValue(D.GAME, { state, savedAt });
  tell(D.GAME);
  if (state && state.over) {
    const stats = readValue(D.STATS) || D.emptyStats();
    const next = D.recordResult(stats, state, Date.parse(savedAt), playerName);
    if (next !== stats) { writeValue(D.STATS, next); tell(D.STATS); }
  }
}
export function clearGame() {
  if (player) { writeValue(D.GAME, { state: null, savedAt: new Date().toISOString() }); tell(D.GAME); return; }
  try { localStorage.removeItem(KEYS.game); } catch (e) { /* ignore */ }
}

// Finished games, for a signed-in player: { games, wins, best } (else null).
export const playerStats = () => (player ? D.summary(readValue(D.STATS)) : null);

// The last choices on the new-game screen (each seat's word level among them).
export function lastSetup() {
  if (!player) return read(KEYS.setup, null);
  const v = readValue(D.SETUP);
  return v && v.setup ? v.setup : null;
}
export function saveSetup(setup) {
  if (!player) { write(KEYS.setup, setup); return; }
  writeValue(D.SETUP, { setup, savedAt: new Date().toISOString() });
  tell(D.SETUP);
}

// Words a grown-up has allowed on this device (children only; a sorted list).
export function allowedWords() {
  const list = read(KEYS.allowed, []);
  return Array.isArray(list) ? list.filter((w) => typeof w === 'string' && /^[a-z]{2,20}$/.test(w)) : [];
}
export function allowWords(words) {
  write(KEYS.allowed, [...new Set([...allowedWords(), ...words])].sort());
}
export function disallowWord(word) {
  write(KEYS.allowed, allowedWords().filter((w) => w !== word));
}

// The grown-up PIN, as { salt, hash } (pin.js), or null.
export const storedPin = () => {
  const p = read(KEYS.pin, null);
  return isStoredPin(p) ? p : null;
};
export const savePin = (p) => write(KEYS.pin, p);
// "Forgot PIN?": the PIN and the words it allowed go together.
export function forgetPin() {
  try {
    localStorage.removeItem(KEYS.pin);
    localStorage.removeItem(KEYS.allowed);
  } catch (e) { /* ignore */ }
}

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
  applyTheme();
  lookChanged();
}

// Day style for this device, shared with Spellbright: "garden" (Sunny garden, the default) or "paint" (Paint box).
// Night always uses the Night sky style.
export const DAY_STYLES = ['garden', 'paint'];
export function getDayStyle() {
  try {
    const s = localStorage.getItem(KEYS.dayStyle);
    return DAY_STYLES.includes(s) ? s : 'garden';
  } catch (e) { return 'garden'; }
}
export function setDayStyle(s) {
  if (!DAY_STYLES.includes(s)) return;
  try { localStorage.setItem(KEYS.dayStyle, s); } catch (e) { /* ignore */ }
  applyTheme();
  lookChanged();
}

// The player's look is also saved to their account (account/prefs.js listens).
function lookChanged() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('wa:look'));
}

// theme-boot.js has already run (it is loaded before the app).
function applyTheme() {
  if (typeof window !== 'undefined' && window.wbTheme) window.wbTheme.apply();
}
