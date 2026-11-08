// Comic Studio (C2): a child's comics, as one saved value (account game "compose",
// key "comics"), apart from the older `writing`. Pure: no DOM, no fetch, and the
// clock comes in as `now`.
//
//   comics  { v: 1, resetAt, comics: { [id]: comic } }
//
// A picture-story comic (kind 'task', C2-1):
//   { id, kind: 'task', task, level, at, stage: 'make' | 'done', doneAt,
//     order:  { tries, done }                 tries = checks that sent a picture back
//     wheel:  { who, where, when, miss }      indexes into the task's choices
//     panels: [4 × { op, tiles: [...], text, word, feel: { face, word, join, why }, say, miss, done }]
//     join:   { up: { plain: better }, end, done }
//     read, challenge: { text, checks, done, at, from? } | null, other? }
//   A panel's sentence is its tiles (Year 3-4) or its typed `text` (Year 5-6). `say`
//   is { i } (one of the task's lines), { who, text } (typed) or { skip: true }.
// My own story (kind 'own', C2-2):
//   { id, kind: 'own', level, at, stage, doneAt, setting, cast: [ids], castDone,
//     props: [ids], propsDone, spark: { problem, solution }, title,
//     panels: [4 × { bg, st: [{ k, x, y, s, f }], stDone, cap, say, done }] }
//   A sticker is data, never a picture: k is "<character>.<pose>" or "<object>",
//   x and y its centre in % of the panel, s its size, f flipped. cap is
//   { op, tiles } or { text }; say as above, with `who` a cast id or a name.
//
// STARS are never stored: starsOf() counts them from tries and misses.
// MERGE (two devices, or a 409): per comic, a finished copy beats an unfinished
// one, else the copy changed last. What the child typed in the other copy is never
// thrown away: if it differs it stays as `other`, for a grown-up to see.
// SIZE: past 48 KB, `other` goes first (finished comics, oldest first), then
// comics left unfinished for 60 days. A finished comic is never dropped.
export const COMICS_KEY = 'comics';
export const TRIM_AT = 48 * 1024;
export const TRIM_TO = 40 * 1024;
const STALE_MS = 60 * 86400000;
export const LEVELS = [3, 4, 5, 6];
export const MAX_STICKERS = 8;
export const LIMITS = { sentence: 160, word: 24, bubble: 80, why: 80, spark: 120, title: 50, challenge: 3000 };

const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : 0);
const str = (x) => (typeof x === 'string' ? x : '');
const strs = (x) => (Array.isArray(x) ? x.filter((s) => typeof s === 'string') : []);
export const sizeOf = (d) => new TextEncoder().encode(JSON.stringify(d)).length;
export const clampLevel = (n) => (LEVELS.includes(Number(n)) ? Number(n) : 3);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const emptyComics = () => ({ v: 1, resetAt: 0, comics: {} });
const blankTaskPanel = () => ({ tiles: [], miss: 0, done: false });
const blankOwnPanel = () => ({ bg: null, st: [], stDone: false, cap: null, say: null, done: false });

function normaliseSticker(s) {
  if (!isObj(s) || typeof s.k !== 'string' || !/^[a-z-]{1,24}(\.[ab])?$/.test(s.k)) return null;
  return { k: s.k, x: Math.round(clamp(num(s.x), 0, 100)), y: Math.round(clamp(num(s.y), 0, 100)), s: Math.round(clamp(num(s.s) || 1, 0.4, 2) * 10) / 10, f: s.f ? 1 : 0 };
}
function normalisePanel(p, kind) {
  const base = kind === 'own' ? blankOwnPanel() : blankTaskPanel();
  if (!isObj(p)) return base;
  const out = { ...base, ...p, done: p.done === true, miss: num(p.miss) };
  if (kind === 'own') { out.st = (Array.isArray(p.st) ? p.st : []).map(normaliseSticker).filter(Boolean).slice(0, MAX_STICKERS); out.stDone = p.stDone === true; delete out.miss; } else out.tiles = strs(p.tiles);
  return out;
}
export function normaliseComic(c, id) {
  if (!isObj(c) || (c.kind !== 'task' && c.kind !== 'own')) return null;
  if (c.kind === 'task' && typeof c.task !== 'string') return null;
  const panels = Array.from({ length: 4 }, (_, i) => normalisePanel(Array.isArray(c.panels) ? c.panels[i] : null, c.kind));
  const out = { ...c, id, at: num(c.at), level: clampLevel(c.level), stage: c.stage === 'done' ? 'done' : 'make', panels };
  if (c.kind === 'task') {
    out.order = { tries: num(isObj(c.order) ? c.order.tries : 0), done: isObj(c.order) && c.order.done === true };
    out.wheel = isObj(c.wheel) ? { ...c.wheel, miss: num(c.wheel.miss) } : { miss: 0 };
    out.join = isObj(c.join) ? { up: isObj(c.join.up) ? c.join.up : {}, end: Number.isInteger(c.join.end) ? c.join.end : null, done: c.join.done === true } : { up: {}, end: null, done: false };
    out.read = c.read === true;
    out.challenge = isObj(c.challenge) ? { ...c.challenge, text: str(c.challenge.text) } : null;
  } else {
    out.cast = strs(c.cast).slice(0, 3);
    out.props = strs(c.props).slice(0, 3);
  }
  return out;
}
export function normaliseComics(d) {
  if (!isObj(d) || d.v !== 1) return emptyComics();
  const out = emptyComics();
  out.resetAt = num(d.resetAt);
  for (const [id, c] of Object.entries(isObj(d.comics) ? d.comics : {})) {
    const n = normaliseComic(c, id);
    if (n) out.comics[id] = n;
  }
  return out;
}

// ---- levels ---------------------------------------------------------------------------
/** What a level gives the child. Year 3 all tiles; 4 tiles and a typed word; 5-6 typed sentences. */
export function scaffold(level) {
  const n = clampLevel(level);
  const band = n >= 5 ? '5' : String(n);
  return { level: n, band, sentence: n >= 5 ? 'typed' : 'tiles', word: n === 4, typeBubble: n >= 4, why: n >= 5, typeOwn: n >= 4 };
}
export const easier = (level) => Math.max(3, clampLevel(level) - 1);
export const harder = (level) => Math.min(6, clampLevel(level) + 1);

// ---- a seeded shuffle (the same comic always shows the same order) ------------------------
function hash(s) {
  let h = 2166136261;
  for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function shuffle(list, seed) {
  const out = [...list];
  let x = hash(seed) || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    const j = x % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---- starting, finding, changing -------------------------------------------------------
/** A new picture-story comic. An old unfinished draft of the same task (the classic Write page) starts the challenge box. */
export function startComic(d, task, { id, now, level, draft = null }) {
  const text = draft ? (draft.parts || []).map((s) => String(s).trim()).filter(Boolean).join('\n\n') : '';
  const c = {
    id, kind: 'task', task: task.id, level: clampLevel(level || task.level), at: now, stage: 'make',
    order: { tries: 0, done: false }, wheel: { miss: 0 }, panels: Array.from({ length: 4 }, blankTaskPanel),
    join: { up: {}, end: null, done: false }, read: false, challenge: text ? { text, done: false, from: draft.id, at: now } : null,
  };
  return { ...d, comics: { ...d.comics, [id]: c } };
}
export function startOwn(d, { id, now, level }) {
  const c = { id, kind: 'own', level: clampLevel(level), at: now, stage: 'make', setting: null, cast: [], castDone: false, props: [], propsDone: false, spark: null, title: null, panels: Array.from({ length: 4 }, blankOwnPanel) };
  return { ...d, comics: { ...d.comics, [id]: c } };
}
export const isDone = (c) => c.stage === 'done';
export const openComic = (d, taskId) => Object.values(d.comics).find((c) => c.kind === 'task' && c.task === taskId && !isDone(c)) || null;
export const openOwn = (d) => Object.values(d.comics).filter((c) => c.kind === 'own' && !isDone(c)).sort((a, b) => b.at - a.at);
/** Finished comics, newest first. */
export const finished = (d) => Object.values(d.comics).filter(isDone).sort((a, b) => num(b.doneAt) - num(a.doneAt));
export const change = (d, id, fields, now) => ({ ...d, comics: { ...d.comics, [id]: { ...d.comics[id], ...fields, at: now } } });
export function changePanel(d, id, i, fields, now) {
  const panels = d.comics[id].panels.map((p, k) => (k === i ? { ...p, ...fields } : p));
  return change(d, id, { panels }, now);
}
export const finish = (d, id, now) => change(d, id, { stage: 'done', doneAt: now }, now);
export const setLevel = (d, id, level, now) => change(d, id, { level: clampLevel(level) }, now);

// ---- the moves of a picture story --------------------------------------------------------
export const wheelDone = (c) => Number.isInteger(c.wheel.who) && Number.isInteger(c.wheel.where) && Number.isInteger(c.wheel.when);
/** The next thing to do: 'order', 'wheel', 'panel', 'join', 'read', 'finish' or 'done'; `panel` says which. */
export function nextMove(c) {
  if (isDone(c)) return { move: 'done' };
  if (c.kind === 'own') return nextOwn(c);
  if (!c.order.done) return { move: 'order' };
  if (!wheelDone(c)) return { move: 'wheel' };
  const i = c.panels.findIndex((p) => !p.done);
  if (i >= 0) return { move: 'panel', panel: i };
  if (!c.join.done) return { move: 'join' };
  if (!c.read) return { move: 'read' };
  return { move: 'finish' };
}
/** The pictures as the child first sees them: shuffled, never already in order. */
export function orderStart(id) {
  const s = shuffle([0, 1, 2, 3], 'order:' + id);
  return s.every((v, i) => v === i) ? [1, 2, 3, 0] : s;
}
/** Which boxes hold the wrong picture: placed[box] = picture index. */
export const wrongBoxes = (placed) => placed.map((p, i) => (p === i ? -1 : i)).filter((i) => i >= 0);

// ---- the story wheel ---------------------------------------------------------------------
export const WHEEL = ['who', 'where', 'when'];
export const wheelNext = (c) => WHEEL.find((k) => !Number.isInteger(c.wheel[k])) || null;
/** The opening caption: "One windy afternoon, Maya and her little brother Sam were at the park." */
export function opening(task, wheel) {
  const s = task.comic;
  const who = s.who[wheel.who];
  const where = s.where[wheel.where];
  const when = s.when[wheel.when];
  if (!who || !where || !when) return '';
  return when.text + ', ' + who.text + ' ' + (who.be || 'was') + ' ' + where.text + '.';
}

// ---- sentence tiles ----------------------------------------------------------------------
export const pathsOf = (spec) => spec.paths.map((p) => p.split('|'));
/** The tiles offered for slot k: every phrase any path has there, and that slot's wrong ones. */
export function tileChoices(spec, k, seed = '') {
  const set = new Set(pathsOf(spec).map((p) => p[k]).filter(Boolean));
  for (const w of (spec.wrong && spec.wrong[k]) || []) set.add(w);
  return shuffle([...set], seed + ':' + k);
}
/** Can this tile go next? Only if the sentence so far, with it, starts one of the right sentences. */
export function canPlace(spec, chosen, tile) {
  return pathsOf(spec).some((p) => chosen.every((c, i) => p[i] === c) && p[chosen.length] === tile);
}
/** Is this a whole right sentence? Every path counts. */
export const isSentence = (spec, tiles) => pathsOf(spec).some((p) => p.length === tiles.length && p.every((x, i) => x === tiles[i]));
export const hasSentence = (p, spec) => !!str(p.text).trim() || isSentence(spec, p.tiles);

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const endStop = (s) => (/[.!?]["'”’]?$/.test(s) ? s : s + '.');
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A describing word before the noun: "her kite" → "her bright kite"; a → an before a vowel. */
export function addWord(sentence, noun, word) {
  const w = str(word).trim();
  if (!w || !noun) return sentence;
  const re = new RegExp('(^|[^A-Za-z])(?:(a|A) )?(' + escRe(noun) + ')(?![A-Za-z])');
  return sentence.replace(re, (all, pre, art, n) => pre + (art ? (/^[aeiou]/i.test(w) ? art + 'n ' : art + ' ') : '') + w + ' ' + n);
}
/** Stronger words: { plain: better }, whole words only, keeping a capital. */
export function applyUpgrades(sentence, up = {}) {
  let out = sentence;
  for (const [plain, better] of Object.entries(up)) {
    if (!better || better === plain) continue;
    out = out.replace(new RegExp('(^|[^A-Za-z])(' + escRe(plain) + ')(?![A-Za-z])', 'gi'), (all, pre, w) => pre + (/^[A-Z]/.test(w) ? cap(better) : better));
  }
  return out;
}
/** The panel's sentence as the child built or typed it, before any upgrade. */
export function plainSentence(p, spec) {
  if (str(p.text).trim()) return endStop(cap(p.text.trim()));
  if (!p.tiles.length) return '';
  let s = [p.op, ...p.tiles].filter(Boolean).join(' ');
  if (spec && spec.describe) s = addWord(s, spec.describe.noun, p.word);
  return endStop(cap(s));
}
export const panelSentence = (c, i, task) => applyUpgrades(plainSentence(c.panels[i], task.comic.panels[i]), c.join.up);
export function feelSentence(p, spec) {
  const f = p.feel;
  if (!f || !f.word) return '';
  const why = str(f.why).trim().replace(/[.!?]+$/, '');
  return cap(spec.feel.who) + ' felt ' + f.word + (why ? ' ' + (f.join || 'because') + ' ' + why : '') + '.';
}
/** { who, says } or null. */
export function speechOf(p, spec) {
  const s = p.say;
  if (!s || s.skip) return null;
  if (Number.isInteger(s.i) && spec.speech[s.i]) return spec.speech[s.i];
  if (str(s.text).trim()) return { who: str(s.who) || spec.speech[0].who, says: s.text.trim() };
  return null;
}
export const sayLine = (sp) => '"' + endStop(sp.says) + '" said ' + sp.who + '.';
export const speakers = (spec) => [...new Set(spec.speech.map((s) => s.who))];

/** The step inside a panel: 'opener', 'sentence' or 'type', 'word', 'feel', 'why', 'say', 'done'. */
export function panelStep(p, spec, sc) {
  if (p.done) return 'done';
  if (!p.op) return 'opener';
  if (!hasSentence(p, spec)) return sc.sentence === 'tiles' ? 'sentence' : 'type';
  if (sc.word && !str(p.text).trim() && p.word === undefined) return 'word';
  if (!p.feel || !p.feel.word) return 'feel';
  if (sc.why && p.feel.why === undefined) return 'why';
  if (!p.say) return 'say';
  return 'done';
}
/** "Tap to fix": the panel starts again (its opener stays), and the comic must be read again. */
export function fixPanel(d, id, i, now) {
  const c = d.comics[id];
  const p = c.panels[i];
  const panels = c.panels.map((x, k) => (k === i ? { ...blankTaskPanel(), op: p.op, miss: p.miss } : x));
  return change(d, id, { panels, read: false }, now);
}

// ---- joining up ---------------------------------------------------------------------------
/** Plain words the child used that have a stronger one (at most 3, in story order). */
export function upgradeSpots(c, task) {
  const up = task.comic.upgrades || {};
  const out = [];
  c.panels.forEach((p, i) => {
    const s = plainSentence(p, task.comic.panels[i]);
    for (const w of Object.keys(up)) if (!out.some((o) => o.word === w) && new RegExp('(^|[^A-Za-z])' + escRe(w) + '(?![A-Za-z])', 'i').test(s)) out.push({ word: w, panel: i, better: up[w] });
  });
  return out.slice(0, 3);
}
export const joinNext = (c, task) => upgradeSpots(c, task).find((s) => !(s.word in c.join.up)) || null;
export const endingOf = (c, task) => (Number.isInteger(c.join.end) ? task.comic.endings[c.join.end] || '' : '');

// ---- reading it aloud ----------------------------------------------------------------------
/** Every line of the comic in order: { panel, kind, text }. The opening goes with panel 0, the ending with panel 3. */
export function readText(c, task) {
  const out = [];
  const open = opening(task, c.wheel);
  if (open) out.push({ panel: 0, kind: 'caption', text: open });
  c.panels.forEach((p, i) => {
    const spec = task.comic.panels[i];
    const s = panelSentence(c, i, task);
    if (s) out.push({ panel: i, kind: 'caption', text: s });
    const f = feelSentence(p, spec);
    if (f) out.push({ panel: i, kind: 'caption', text: f });
    const sp = speechOf(p, spec);
    if (sp) out.push({ panel: i, kind: 'speech', text: sayLine(sp), says: sp.says, who: sp.who });
  });
  const end = endingOf(c, task);
  if (end) out.push({ panel: 3, kind: 'caption', text: end });
  return out;
}
/** The comic as one piece of prose, a paragraph a panel (for Grown-ups and printing). */
export function comicText(lines) {
  return [0, 1, 2, 3].map((i) => lines.filter((l) => l.panel === i).map((l) => l.text).join(' ')).filter(Boolean).join('\n\n');
}

// ---- stars ------------------------------------------------------------------------------------
const starFor = (misses) => Math.max(1, 3 - misses);
/** Stars per move (1 to 3 once done, 0 before), and a bonus of up to 3 for the typed challenge. Never stored. */
export function starsOf(c) {
  if (c.kind !== 'task') return { moves: {}, bonus: 0, total: 0, max: 0 };
  const moves = {
    order: c.order.done ? starFor(c.order.tries) : 0,
    wheel: wheelDone(c) ? starFor(c.wheel.miss) : 0,
  };
  c.panels.forEach((p, i) => { moves['panel' + (i + 1)] = p.done ? starFor(p.miss) : 0; });
  moves.join = c.join.done ? 3 : 0;
  moves.read = c.read ? 3 : 0;
  let bonus = 0;
  const ch = c.challenge;
  if (ch && ch.done && Array.isArray(ch.checks) && ch.checks.length) {
    const share = ch.checks.filter((x) => x.ok).length / ch.checks.length;
    bonus = 1 + (share >= 0.5 ? 1 : 0) + (share === 1 ? 1 : 0);
  }
  const total = Object.values(moves).reduce((a, b) => a + b, 0) + bonus;
  return { moves, bonus, total, max: Object.keys(moves).length * 3 };
}

// ---- My own story ------------------------------------------------------------------------------
function nextOwn(c) {
  if (!c.setting) return { move: 'setting' };
  if (!c.castDone) return { move: 'cast' };
  if (!c.propsDone) return { move: 'props' };
  if (!c.spark || !c.spark.problem) return { move: 'problem' };
  if (!c.spark.solution) return { move: 'solution' };
  const i = c.panels.findIndex((p) => !p.done);
  if (i >= 0) return { move: 'panel', panel: i };
  if (!c.title) return { move: 'title' };
  return { move: 'finish' };
}
/** The step inside an own-story panel: 'stickers', 'caption', 'say', 'done'. */
export function ownPanelStep(p) {
  if (p.done) return 'done';
  if (!p.stDone) return 'stickers';
  if (!p.cap) return 'caption';
  if (!p.say) return 'say';
  return 'done';
}
/** One step back in My own story: the last thing done is open again (nothing typed is thrown away but that step's choice). */
export function ownBack(d, id, now) {
  const c = d.comics[id];
  const m = nextOwn(c);
  if (m.move === 'panel') {
    const p = c.panels[m.panel];
    if (p.cap) return changePanel(d, id, m.panel, { cap: null, say: null }, now);
    if (p.stDone) return changePanel(d, id, m.panel, { stDone: false }, now);
    if (m.panel > 0) return changePanel(d, id, m.panel - 1, { done: false, say: null }, now);
    return change(d, id, { spark: { ...c.spark, solution: null } }, now);
  }
  if (m.move === 'title' || m.move === 'finish') return changePanel(d, id, 3, { done: false, say: null }, now);
  if (m.move === 'solution') return change(d, id, { spark: null }, now);
  if (m.move === 'problem') return change(d, id, { propsDone: false }, now);
  if (m.move === 'props') return change(d, id, { castDone: false }, now);
  if (m.move === 'cast') return change(d, id, { setting: null }, now);
  return d;
}
/** Fill a spark card: "{who} lost {thing}." with the first character and object. */
export function sparkText(template, { who = 'Someone', thing = 'something' } = {}) {
  const out = template.replace(/\{who\}/g, who).replace(/\{thing\}/g, thing);
  return cap(out);
}
/** Own-story caption: { op, tiles } built from tiles, or { text } typed. */
export function ownCaption(capt) {
  if (!capt) return '';
  if (str(capt.text).trim()) return endStop(cap(capt.text.trim()));
  const s = [capt.op, ...strs(capt.tiles)].filter(Boolean).join(' ');
  return s ? endStop(cap(s)) : '';
}
export function ownSpeech(p, nameOf = (x) => x) {
  const s = p.say;
  if (!s || s.skip || !str(s.text).trim()) return null;
  return { who: nameOf(str(s.who)) || 'Someone', says: s.text.trim() };
}
export function ownReadText(c, nameOf = (x) => x) {
  const out = [];
  c.panels.forEach((p, i) => {
    const t = ownCaption(p.cap);
    if (t) out.push({ panel: i, kind: 'caption', text: t });
    const sp = ownSpeech(p, nameOf);
    if (sp) out.push({ panel: i, kind: 'speech', text: sayLine(sp), says: sp.says, who: sp.who });
  });
  return out;
}

// ---- stickers (positions are data) -----------------------------------------------------------------
export function placeSticker(list, k, x = 50, y = 60) {
  if (list.length >= MAX_STICKERS) return list;
  const s = normaliseSticker({ k, x, y, s: 1, f: 0 });
  return s ? [...list, s] : list;
}
export const moveSticker = (list, i, x, y) => list.map((s, k) => (k === i ? normaliseSticker({ ...s, x, y }) : s));
export const nudgeSticker = (list, i, dx, dy) => list.map((s, k) => (k === i ? normaliseSticker({ ...s, x: s.x + dx, y: s.y + dy }) : s));
export const resizeSticker = (list, i, by) => list.map((s, k) => (k === i ? normaliseSticker({ ...s, s: s.s + by }) : s));
export const flipSticker = (list, i) => list.map((s, k) => (k === i ? { ...s, f: s.f ? 0 : 1 } : s));
export const removeSticker = (list, i) => list.filter((_, k) => k !== i);
export const toFront = (list, i) => [...list.filter((_, k) => k !== i), list[i]];

// ---- merge and trim -----------------------------------------------------------------------------------
/** Everything the child typed in a comic, to compare two copies. */
export function typedOf(c) {
  const bits = [];
  for (const p of c.panels || []) {
    bits.push(str(p.text), str(p.word), str(p.feel && p.feel.why), str(p.say && p.say.text), str(p.cap && p.cap.text));
  }
  if (c.challenge) bits.push(str(c.challenge.text));
  if (c.spark) bits.push(str(c.spark.problem), str(c.spark.solution));
  bits.push(str(c.title));
  return bits.filter((s) => s.trim()).join('\n');
}
function pick(a, b) {
  if (isDone(a) !== isDone(b)) return isDone(a) ? [a, b] : [b, a];
  return b.at > a.at || (b.at === a.at && JSON.stringify(b) > JSON.stringify(a)) ? [b, a] : [a, b];
}
export function mergeComics(a, b) {
  const x = normaliseComics(a);
  const y = normaliseComics(b);
  const out = emptyComics();
  out.resetAt = Math.max(x.resetAt, y.resetAt);
  for (const id of new Set([...Object.keys(x.comics), ...Object.keys(y.comics)])) {
    const p = x.comics[id];
    const q = y.comics[id];
    let c = p && q ? null : p || q;
    if (!c) {
      const [win, lose] = pick(p, q);
      const lost = typedOf(lose);
      c = lost && lost !== typedOf(win) && lost !== (win.other || {}).text ? { ...win, other: { text: lost, at: lose.at } } : win;
    }
    if (c.at > out.resetAt) out.comics[id] = c;
  }
  return out;
}
export function trimComics(d, now) {
  if (sizeOf(d) <= TRIM_AT) return d;
  const comics = { ...d.comics };
  const small = () => sizeOf({ ...d, comics }) <= TRIM_TO;
  for (const c of Object.values(comics).filter((x) => x.other).sort((a, b) => num(a.doneAt || a.at) - num(b.doneAt || b.at))) {
    if (small()) break;
    const { other, ...keep } = c;
    comics[c.id] = keep;
  }
  for (const c of Object.values(comics).filter((x) => !isDone(x) && now - x.at > STALE_MS).sort((a, b) => a.at - b.at)) {
    if (small()) break;
    delete comics[c.id];
  }
  return { ...d, comics };
}
export const resetComics = (now) => ({ ...emptyComics(), resetAt: now });
