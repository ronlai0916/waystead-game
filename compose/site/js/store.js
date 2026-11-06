// A player's writing on this device: "cp.writing:<player id>", which account/sync.js
// also saves to the Waystead account. Marks and settings come from a parent and
// are only ever read here. The look is shared with the other games (sb.theme,
// sb.dayStyle, sb.voice).
import * as W from './writing-doc.js';

let player = null;
let changed = null;
export function usePlayer(id, onChange = null) { player = id || null; changed = onChange; }
export const currentPlayer = () => player;

function read(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch (e) { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode: keep going */ }
}
const keyOf = (name, id) => 'cp.' + name + ':' + id;
export const has = (name, id = player) => read(keyOf(name, id), null) !== null;
export const readWriting = (id = player) => W.normalise(read(keyOf('writing', id), null));
export const writeWriting = (d, id = player) => write(keyOf('writing', id), d);
export function updateWriting(fn) {
  writeWriting(fn(readWriting()));
  if (changed) changed(W.DOC_KEY);
}
export const readMarks = (id = player) => W.normaliseMarks(read(keyOf('marks', id), null));
export const writeMarks = (d, id = player) => write(keyOf('marks', id), d);
export const readSettings = (id = player) => W.normaliseSettings(read(keyOf('settings', id), null));
export const writeSettings = (d, id = player) => write(keyOf('settings', id), d);
export const newId = () => 'w' + [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, '0')).join('');

const applyTheme = () => { if (typeof window !== 'undefined' && window.sbTheme) window.sbTheme.apply(); };
const lookChanged = () => { if (typeof window !== 'undefined' && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('wa:look')); };
export function getTheme() {
  try { const t = localStorage.getItem('sb.theme'); return t === 'light' || t === 'dark' ? t : 'system'; } catch (e) { return 'system'; }
}
export function setTheme(t) {
  try { if (t === 'light' || t === 'dark') localStorage.setItem('sb.theme', t); else localStorage.removeItem('sb.theme'); } catch (e) { /* ignore */ }
  applyTheme();
  lookChanged();
}
export const DAY_STYLES = ['garden', 'paint'];
export function getDayStyle() {
  try { const s = localStorage.getItem('sb.dayStyle'); return DAY_STYLES.includes(s) ? s : 'garden'; } catch (e) { return 'garden'; }
}
export function setDayStyle(s) {
  if (!DAY_STYLES.includes(s)) return;
  try { localStorage.setItem('sb.dayStyle', s); } catch (e) { /* ignore */ }
  applyTheme();
  lookChanged();
}
