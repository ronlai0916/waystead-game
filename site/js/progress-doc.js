// A signed-in player's Spellbright progress, as one saved value: the account
// key "progress" (game "spellbright"), cached on the device as
// "sb.progress:<player id>". Signed out, store.js keeps today's keys
// (sb.progress, sb.tricky) exactly as they were. Pure: no DOM, no storage.
//
//   { v: 1, resetAt,                       ms; "Clear my progress" (0: never)
//     chapters: { [id]: { studiedAt, practisedAt } },
//     results:  [{ id, c: chapter, s: score, t: out of, at }],   one per test
//               (an imported total instead: { id, c, n, best, passed, at })
//     folded:   { [chapter]: { n, best, passed, through } },     old tests, folded
//     tricky:   { [word]: { n, c: chapter, at } } }              n 0: removed
//
// MERGE (two devices, or a 409 from the account):
//   · test results: the union by id; attempts, best and passed are counted
//     from them (and the fold), never added from the two copies;
//   · studied / practised: the later time of each;
//   · a tricky word: the copy changed last wins (its count is not added);
//     a removed word stays removed until it is missed again;
//   · resetAt: the later one; anything before it goes.
// SIZE: a value may be at most 64 KB. Past 48 KB the oldest test results are
// folded into their chapter (count, best, passed kept) until it is under 40 KB,
// and removed tricky words older than 90 days are dropped first.
import { mergeLog, foldOldest } from './account/merge.js';

export const DOC_KEY = 'progress';
export const TRIM_AT = 48 * 1024;
export const TRIM_TO = 40 * 1024;
const DAY = 86400000;

export const emptyDoc = () => ({ v: 1, resetAt: 0, chapters: {}, results: [], folded: {}, tricky: {} });
export const sizeOf = (d) => new TextEncoder().encode(JSON.stringify(d)).length;

const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

// Whatever arrives (an old device, the account): the shape above, or empty.
export function normalise(d) {
  if (!isObj(d) || d.v !== 1) return emptyDoc();
  const out = emptyDoc();
  out.resetAt = num(d.resetAt);
  for (const [id, c] of Object.entries(isObj(d.chapters) ? d.chapters : {})) {
    if (isObj(c)) out.chapters[id] = { ...(c.studiedAt ? { studiedAt: num(c.studiedAt) } : {}), ...(c.practisedAt ? { practisedAt: num(c.practisedAt) } : {}) };
  }
  out.results = (Array.isArray(d.results) ? d.results : []).filter((r) => isObj(r) && typeof r.id === 'string' && typeof r.c === 'string' && num(r.at));
  for (const [id, f] of Object.entries(isObj(d.folded) ? d.folded : {})) {
    if (isObj(f)) out.folded[id] = { n: num(f.n), best: num(f.best), passed: !!f.passed, through: num(f.through) };
  }
  for (const [w, t] of Object.entries(isObj(d.tricky) ? d.tricky : {})) {
    if (isObj(t)) out.tricky[w] = { n: num(t.n), c: typeof t.c === 'string' ? t.c : '', at: num(t.at) };
  }
  return out;
}

// ---- reading -------------------------------------------------------------------
const bestOf = (r) => (typeof r.best === 'number' ? r.best : num(r.s));
const passedOf = (r) => (typeof r.passed === 'boolean' ? r.passed : num(r.t) > 0 && r.s === r.t);
const live = (d, at) => at > d.resetAt;

export function chapterProgress(d, id) {
  const ch = d.chapters[id] || {};
  const rs = d.results.filter((r) => r.c === id);
  const f = d.folded[id];
  const attempts = rs.reduce((n, r) => n + (r.n || 1), 0) + (f ? f.n : 0);
  const best = Math.max(0, ...rs.map(bestOf), f ? f.best : 0);
  const passed = rs.some(passedOf) || !!(f && f.passed);
  const last = Math.max(0, ...rs.map((r) => r.at), f ? f.through : 0);
  return {
    studied: live(d, num(ch.studiedAt)), practised: live(d, num(ch.practisedAt)), passed, attempts, best,
    ...(last ? { lastAt: new Date(last).toISOString() } : {}),
  };
}

export function trickyWords(d) {
  return Object.entries(d.tricky)
    .filter(([, t]) => t.n > 0 && live(d, t.at))
    .map(([word, t]) => ({ word, count: t.n, chapterId: t.c, last: new Date(t.at).toISOString() }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word));
}

export function anyProgress(d) {
  return d.results.length > 0 || Object.keys(d.folded).length > 0
    || Object.values(d.chapters).some((c) => live(d, num(c.studiedAt)) || live(d, num(c.practisedAt)));
}

// ---- changes (each returns a new doc) ----------------------------------------
export function mark(d, id, field, now) {
  return { ...d, chapters: { ...d.chapters, [id]: { ...(d.chapters[id] || {}), [field]: now } } };
}
export function recordTest(d, id, score, total, now, resultId) {
  return { ...d, results: [...d.results, { id: resultId, c: id, s: score, t: total, at: now }] };
}
function trickyEntry(d, word) {
  const t = d.tricky[word];
  return t && t.n > 0 && live(d, t.at) ? t : null;
}
export function noteMissed(d, word, chapterId, now) {
  const t = trickyEntry(d, word);
  return { ...d, tricky: { ...d.tricky, [word]: { n: (t ? t.n : 0) + 1, c: t ? t.c : chapterId, at: now } } };
}
export function noteCorrect(d, word, now) {
  const t = trickyEntry(d, word);
  if (!t) return d;
  return { ...d, tricky: { ...d.tricky, [word]: { n: t.n - 1, c: t.c, at: now } } };
}
export function removeTricky(d, word, now) {
  const t = d.tricky[word];
  if (!t) return d;
  return { ...d, tricky: { ...d.tricky, [word]: { n: 0, c: t.c, at: now } } };
}
export const reset = (now) => ({ ...emptyDoc(), resetAt: now });

// ---- merge and trim ------------------------------------------------------------
const LOG = {
  group: (r) => r.c,
  absorb: (f, r) => ({ ...f, best: Math.max(num(f.best), bestOf(r)), passed: !!f.passed || passedOf(r) }),
  emptyFold: () => ({ n: 0, best: 0, passed: false, through: 0 }),
};

export function merge(a, b) {
  const x = normalise(a);
  const y = normalise(b);
  const log = mergeLog(x, y, LOG);
  const out = { v: 1, resetAt: log.resetAt, chapters: {}, results: log.results, folded: log.folded, tricky: {} };
  for (const id of new Set([...Object.keys(x.chapters), ...Object.keys(y.chapters)])) {
    const c = {};
    for (const f of ['studiedAt', 'practisedAt']) {
      const at = Math.max(num((x.chapters[id] || {})[f]), num((y.chapters[id] || {})[f]));
      if (at > out.resetAt) c[f] = at;
    }
    if (Object.keys(c).length) out.chapters[id] = c;
  }
  for (const w of new Set([...Object.keys(x.tricky), ...Object.keys(y.tricky)])) {
    const p = x.tricky[w];
    const q = y.tricky[w];
    const t = !p ? q : !q ? p : q.at > p.at || (q.at === p.at && q.n > p.n) ? q : p;
    if (t.at > out.resetAt) out.tricky[w] = t;
  }
  return out;
}

export function trim(d, now) {
  if (sizeOf(d) <= TRIM_AT) return d;
  const tricky = Object.fromEntries(Object.entries(d.tricky).filter(([, t]) => t.n > 0 || now - t.at < 90 * DAY));
  return foldOldest({ ...d, tricky }, { target: TRIM_TO, sizeOf, ...LOG });
}

// Today's signed-out keys, as a doc to merge into a player's ("Save this
// device's progress"). The ids carry `importId` (this device), so importing
// the same device twice can never count its tests twice.
export function fromDevice(progress, tricky, importId, now) {
  const d = emptyDoc();
  for (const [id, p] of Object.entries(isObj(progress) ? progress : {})) {
    if (!isObj(p)) continue;
    const at = Date.parse(p.lastAt) || now;
    if (p.studied) d.chapters[id] = { ...(d.chapters[id] || {}), studiedAt: now };
    if (p.practised) d.chapters[id] = { ...(d.chapters[id] || {}), practisedAt: now };
    if (num(p.attempts) > 0) d.results.push({ id: 'import-' + importId + '-' + id, c: id, n: num(p.attempts), best: num(p.best), passed: !!p.passed, at });
  }
  for (const [w, t] of Object.entries(isObj(tricky) ? tricky : {})) {
    if (isObj(t) && num(t.count) > 0) d.tricky[w] = { n: num(t.count), c: typeof t.chapterId === 'string' ? t.chapterId : '', at: Date.parse(t.last) || now };
  }
  return d;
}
