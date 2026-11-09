// A child's writing, as saved values (account game "compose"). Pure: the clock
// comes in as `now`.
//
//   writing   { v: 1, resetAt, pieces: { [id]: piece } }, the child's own
//   marks     { v: 1, marks: { [pieceId]: { ideas, order, words, sentences, spelling, comment, at } } }
//   settings  { v: 1, aiFeedback, at }
// marks and settings are written only by a parent, through /api/children: the
// account refuses them on the child's own routes.
//
//   piece: { id, task, level, at, stage, plan: [4], parts: [...], ticks: [...],
//            first, checks, feedback, revised, final, finalAt, other? }
//   stage: 'write' while being written · 'feedback' submitted · 'better' the one
//   revision · 'final'. `first` is the text as submitted; `final` as finished.
//
// MERGE (two devices, or a 409): a piece: a finished copy beats an unfinished
// one, else the copy changed last. The other copy's words are never thrown away:
// if they differ they stay as `other`, for a grown-up to see. Nothing is summed.
// SIZE: past 48 KB, what a finished piece no longer needs goes first (the first
// draft, `other`), oldest first; then pieces left unfinished for 60 days. A
// final is never dropped.
export const DOC_KEY = 'writing';
export const MARKS_KEY = 'marks';
export const SETTINGS_KEY = 'settings';
export const TRIM_AT = 48 * 1024;
export const TRIM_TO = 40 * 1024;
export const MAX_TEXT = 3000; // what can go for feedback; the account's limit too
const STALE_MS = 60 * 86400000;
export const RUBRIC = [['ideas', 'Ideas'], ['order', 'Order'], ['words', 'Words'], ['sentences', 'Sentences'], ['spelling', 'Spelling and punctuation']];

export const emptyDoc = () => ({ v: 1, resetAt: 0, pieces: {} });
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
const strs = (x) => (Array.isArray(x) ? x.map((s) => (typeof s === 'string' ? s : '')) : []);
export const sizeOf = (d) => new TextEncoder().encode(JSON.stringify(d)).length;

export function normalise(d) {
  if (!isObj(d) || d.v !== 1) return emptyDoc();
  const out = emptyDoc();
  out.resetAt = num(d.resetAt);
  for (const [id, p] of Object.entries(isObj(d.pieces) ? d.pieces : {})) {
    if (!isObj(p) || typeof p.task !== 'string') continue;
    out.pieces[id] = { ...p, id, at: num(p.at), plan: strs(p.plan), parts: strs(p.parts) };
  }
  return out;
}

/** The whole text of the parts, one paragraph each. */
export const textOf = (parts) => parts.map((s) => s.trim()).filter(Boolean).join('\n\n');
export const isFinal = (p) => p.stage === 'final';
/** Everything finished, newest first. */
export const finals = (d) => Object.values(d.pieces).filter(isFinal).sort((a, b) => num(b.finalAt) - num(a.finalAt));
/** The piece of this task still being worked on, or null. */
export const openPiece = (d, taskId) => Object.values(d.pieces).find((p) => p.task === taskId && !isFinal(p)) || null;
export const partsFor = (level) => (level === 3 ? ['', '', '', ''] : ['']);

export function startPiece(d, task, { id, now }) {
  const p = { id, task: task.id, level: task.level, at: now, stage: 'write', plan: ['', '', '', ''], parts: partsFor(task.level), ticks: [] };
  return { ...d, pieces: { ...d.pieces, [id]: p } };
}
export const change = (d, id, fields, now) => ({ ...d, pieces: { ...d.pieces, [id]: { ...d.pieces[id], ...fields, at: now } } });
/** Handed in: the text as it stands now, its checks and any feedback. */
export const submit = (d, id, { checks, feedback }, now) => change(d, id, { stage: 'feedback', first: textOf(d.pieces[id].parts), checks, feedback: feedback || null }, now);
/** The one revision. A piece can be made better only once. */
export function startRevision(d, id, now) {
  const p = d.pieces[id];
  return p.stage === 'feedback' && !p.revised ? change(d, id, { stage: 'better', revised: true }, now) : d;
}
export const finish = (d, id, now) => change(d, id, { stage: 'final', final: textOf(d.pieces[id].parts), finalAt: now }, now);

const wordsOf = (p) => (isFinal(p) ? p.final || '' : textOf(p.parts));
function pick(a, b) {
  if (isFinal(a) !== isFinal(b)) return isFinal(a) ? [a, b] : [b, a];
  return b.at > a.at || (b.at === a.at && JSON.stringify(b) > JSON.stringify(a)) ? [b, a] : [a, b];
}
export function merge(a, b) {
  const x = normalise(a);
  const y = normalise(b);
  const out = emptyDoc();
  out.resetAt = Math.max(x.resetAt, y.resetAt);
  for (const id of new Set([...Object.keys(x.pieces), ...Object.keys(y.pieces)])) {
    const p = x.pieces[id];
    const q = y.pieces[id];
    let piece = p && q ? null : p || q;
    if (!piece) {
      const [win, lose] = pick(p, q);
      const lost = wordsOf(lose);
      piece = lost && lost !== wordsOf(win) && lost !== (win.other || {}).text ? { ...win, other: { text: lost, at: lose.at } } : win;
    }
    if (piece.at > out.resetAt) out.pieces[id] = piece;
  }
  return out;
}
export function trim(d, now) {
  if (sizeOf(d) <= TRIM_AT) return d;
  const pieces = { ...d.pieces };
  const small = () => sizeOf({ ...d, pieces }) <= TRIM_TO;
  for (const p of Object.values(pieces).filter(isFinal).sort((a, b) => num(a.finalAt) - num(b.finalAt))) {
    if (small()) break;
    const { first, other, parts, plan, ...keep } = p;
    pieces[p.id] = { ...keep, parts: [], plan };
  }
  for (const p of Object.values(pieces).filter((x) => !isFinal(x) && now - x.at > STALE_MS).sort((a, b) => a.at - b.at)) {
    if (small()) break;
    delete pieces[p.id];
  }
  return { ...d, pieces };
}
export const reset = (now) => ({ ...emptyDoc(), resetAt: now });

// ---- marks and settings -----------------------------------------------------------
export const emptyMarks = () => ({ v: 1, marks: {} });
export function normaliseMarks(d) {
  const out = emptyMarks();
  if (!isObj(d) || d.v !== 1 || !isObj(d.marks)) return out;
  for (const [id, m] of Object.entries(d.marks)) if (isObj(m)) out.marks[id] = m;
  return out;
}
export function mergeMarks(a, b) {
  const x = normaliseMarks(a);
  const y = normaliseMarks(b);
  const out = emptyMarks();
  for (const id of new Set([...Object.keys(x.marks), ...Object.keys(y.marks)])) {
    const p = x.marks[id];
    const q = y.marks[id];
    out.marks[id] = !p ? q : !q ? p : num(q.at) > num(p.at) ? q : p;
  }
  return out;
}
const score = (n) => { const v = Number(n); return Number.isInteger(v) && v >= 1 && v <= 5 ? v : 0; };
/** A mark needs all five scores, each 1 to 5. Answers { doc } or { error }. */
export function setMark(d, pieceId, fields, now) {
  const m = { comment: String(fields.comment || '').trim().slice(0, 500), at: now };
  for (const [k] of RUBRIC) {
    m[k] = score(fields[k]);
    if (!m[k]) return { error: 'Please give each part a score from 1 to 5.' };
  }
  return { doc: { ...d, marks: { ...d.marks, [pieceId]: m } } };
}
export const normaliseSettings = (d) => ({ v: 1, aiFeedback: isObj(d) && d.aiFeedback === true, storyAdventure: isObj(d) && d.storyAdventure === true, at: isObj(d) ? num(d.at) : 0 });
export const mergeSettings = (a, b) => { const x = normaliseSettings(a); const y = normaliseSettings(b); return y.at > x.at ? y : x; };
