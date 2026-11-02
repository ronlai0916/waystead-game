// Progress lives in this browser (localStorage). Signed out, nothing leaves the
// device and the keys are as they always were: sb.progress, sb.tricky.
// Signed in (B4b), the player's progress is one value, "sb.progress:<player id>"
// (progress-doc.js), which account/sync.js also saves to the Waystead account.
// sb.unlockAll ("Open all chapters") stays this device's setting either way.
import * as P from './progress-doc.js';

const KEYS = { progress: 'sb.progress', tricky: 'sb.tricky', unlockAll: 'sb.unlockAll', theme: 'sb.theme', dayStyle: 'sb.dayStyle' };

// ---- whose progress -------------------------------------------------------------
let player = null; // the signed-in player's id, or null (signed out: today's keys)
let changed = null; // told the account key after each change, so it is sent
export function usePlayer(id, onChange = null) {
  player = id || null;
  changed = onChange;
}
export const currentPlayer = () => player;
const docKey = (id = player) => KEYS.progress + ':' + id;
export const readDoc = (id = player) => P.normalise(read(docKey(id), null));
export const hasDoc = (id = player) => read(docKey(id), null) !== null;
export const writeDoc = (d, id = player) => write(docKey(id), d);
function update(fn) {
  writeDoc(fn(readDoc()));
  if (changed) changed(P.DOC_KEY);
}
const newId = () => 'r' + [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, '0')).join('');

// This device's signed-out progress, for "Save this device's progress to …?".
export const deviceProgress = () => ({ progress: read(KEYS.progress, {}), tricky: read(KEYS.tricky, {}) });
export function hasDeviceProgress() {
  const d = deviceProgress();
  return Object.keys(d.progress).length > 0 || Object.keys(d.tricky).length > 0;
}

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch (e) { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode: keep going */ }
}

export function chapterProgress(id) {
  if (player) return P.chapterProgress(readDoc(), id);
  const all = read(KEYS.progress, {});
  return { studied: false, practised: false, passed: false, attempts: 0, best: 0, ...(all[id] || {}) };
}
function patch(id, changes) {
  const all = read(KEYS.progress, {});
  all[id] = { ...chapterProgress(id), ...changes };
  write(KEYS.progress, all);
}
export const markStudied = (id) => (player ? update((d) => P.mark(d, id, 'studiedAt', Date.now())) : patch(id, { studied: true }));
export const markPractised = (id) => (player ? update((d) => P.mark(d, id, 'practisedAt', Date.now())) : patch(id, { practised: true }));
export function recordTest(id, score, total) {
  if (player) { update((d) => P.recordTest(d, id, score, total, Date.now(), newId())); return; }
  const p = chapterProgress(id);
  patch(id, {
    attempts: p.attempts + 1,
    best: Math.max(p.best, score),
    passed: p.passed || score === total,
    lastAt: new Date().toISOString(),
  });
}
export function anyProgress() {
  if (player) return P.anyProgress(readDoc());
  return Object.keys(read(KEYS.progress, {})).length > 0;
}

export function trickyWords() {
  if (player) return P.trickyWords(readDoc());
  const t = read(KEYS.tricky, {});
  return Object.entries(t)
    .map(([word, v]) => ({ word, ...v }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}
export function noteMissed(word, chapterId) {
  if (player) { update((d) => P.noteMissed(d, word, chapterId, Date.now())); return; }
  const t = read(KEYS.tricky, {});
  const cur = t[word] || { count: 0, chapterId };
  t[word] = { ...cur, count: cur.count + 1, last: new Date().toISOString() };
  write(KEYS.tricky, t);
}
export function noteCorrect(word) {
  if (player) { update((d) => P.noteCorrect(d, word, Date.now())); return; }
  const t = read(KEYS.tricky, {});
  if (!t[word]) return;
  t[word].count -= 1;
  if (t[word].count <= 0) delete t[word];
  write(KEYS.tricky, t);
}
export function removeTricky(word) {
  if (player) { update((d) => P.removeTricky(d, word, Date.now())); return; }
  const t = read(KEYS.tricky, {});
  delete t[word];
  write(KEYS.tricky, t);
}

export const unlockAll = () => read(KEYS.unlockAll, false) === true;
export const setUnlockAll = (on) => write(KEYS.unlockAll, !!on);

// Signed in: the player's progress is cleared on every device (a reset time
// that every copy obeys). Either way "Open all chapters" goes back to off here.
export function resetAll() {
  if (player) {
    update(() => P.reset(Date.now()));
    try { localStorage.removeItem(KEYS.unlockAll); } catch (e) { /* ignore */ }
    return;
  }
  try {
    localStorage.removeItem(KEYS.progress);
    localStorage.removeItem(KEYS.tricky);
    localStorage.removeItem(KEYS.unlockAll);
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
  lookChanged();
}

// The player's look is also saved to their account (account/prefs.js listens).
function lookChanged() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') window.dispatchEvent(new CustomEvent('wa:look'));
}

// theme-boot.js has already run (it is loaded before the app).
function applyTheme() {
  if (typeof window !== 'undefined' && window.sbTheme) window.sbTheme.apply();
}

// A chosen word list handed from "Pick words" to the game screen.
export function setSelection(words) {
  try { sessionStorage.setItem('sb.selection', JSON.stringify(words)); } catch (e) { /* ignore */ }
}
export function getSelection() {
  try { return JSON.parse(sessionStorage.getItem('sb.selection') || '[]'); } catch (e) { return []; }
}
