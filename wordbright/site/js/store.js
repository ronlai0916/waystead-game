// Everything stays in this browser (localStorage). Nothing leaves the device.
// The theme mode is shared with Spellbright ("sb.theme"); Wordbright's own keys start with "wb.".
// The look itself is set on <html> by theme-boot.js (window.wbTheme).

import { isStoredPin } from './pin.js';

const KEYS = { theme: 'sb.theme', dayStyle: 'wb.dayStyle', game: 'wb.game', setup: 'wb.setup', allowed: 'wb.allowed', pin: 'wb.pin' };

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
}

// Day style for this device: "garden" (Sunny garden, the default) or "paint" (Paint box).
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
}

// theme-boot.js has already run (it is loaded before the app).
function applyTheme() {
  if (typeof window !== 'undefined' && window.wbTheme) window.wbTheme.apply();
}
