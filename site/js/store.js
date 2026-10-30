// Progress lives in this browser only (localStorage). Nothing leaves the device.

const KEYS = { progress: 'sb.progress', tricky: 'sb.tricky', unlockAll: 'sb.unlockAll', theme: 'sb.theme', dayStyle: 'sb.dayStyle' };

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
  const all = read(KEYS.progress, {});
  return { studied: false, practised: false, passed: false, attempts: 0, best: 0, ...(all[id] || {}) };
}
function patch(id, changes) {
  const all = read(KEYS.progress, {});
  all[id] = { ...chapterProgress(id), ...changes };
  write(KEYS.progress, all);
}
export const markStudied = (id) => patch(id, { studied: true });
export const markPractised = (id) => patch(id, { practised: true });
export function recordTest(id, score, total) {
  const p = chapterProgress(id);
  patch(id, {
    attempts: p.attempts + 1,
    best: Math.max(p.best, score),
    passed: p.passed || score === total,
    lastAt: new Date().toISOString(),
  });
}
export function anyProgress() {
  return Object.keys(read(KEYS.progress, {})).length > 0;
}

export function trickyWords() {
  const t = read(KEYS.tricky, {});
  return Object.entries(t)
    .map(([word, v]) => ({ word, ...v }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}
export function noteMissed(word, chapterId) {
  const t = read(KEYS.tricky, {});
  const cur = t[word] || { count: 0, chapterId };
  t[word] = { ...cur, count: cur.count + 1, last: new Date().toISOString() };
  write(KEYS.tricky, t);
}
export function noteCorrect(word) {
  const t = read(KEYS.tricky, {});
  if (!t[word]) return;
  t[word].count -= 1;
  if (t[word].count <= 0) delete t[word];
  write(KEYS.tricky, t);
}
export function removeTricky(word) {
  const t = read(KEYS.tricky, {});
  delete t[word];
  write(KEYS.tricky, t);
}

export const unlockAll = () => read(KEYS.unlockAll, false) === true;
export const setUnlockAll = (on) => write(KEYS.unlockAll, !!on);

export function resetAll() {
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
  if (typeof window !== 'undefined' && window.sbTheme) window.sbTheme.apply();
}

// A chosen word list handed from "Pick words" to the game screen.
export function setSelection(words) {
  try { sessionStorage.setItem('sb.selection', JSON.stringify(words)); } catch (e) { /* ignore */ }
}
export function getSelection() {
  try { return JSON.parse(sessionStorage.getItem('sb.selection') || '[]'); } catch (e) { return []; }
}
