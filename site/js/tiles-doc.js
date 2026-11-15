// Letter tiles: which letters of a word are gaps, which tiles go in the tray, and
// the tray's own state. Pure: no page, no storage, no clock, no Math.random. The
// word, the level and a seed come in; the same ones always give the same tray.
// (SB4-WP2.) A later package wires it to the screens.

/** FNV-1a of word + '|' + day: one number for a word on a day. */
export function seedOf(word, day) {
  const s = String(word).toLowerCase() + '|' + day;
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** mulberry32: a function that gives numbers in [0, 1), the same ones for the same seed. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (list, r) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ---- Tables -----------------------------------------------------------------------------
/** Sound-alike swaps for a letter in a gap. */
export const ALT = { a: 'eu o'.replace(' ', ''), e: 'ai', i: 'ey', o: 'au', u: 'oa', y: 'i', c: 'ks', k: 'c', s: 'cz', f: 'v', v: 'f', g: 'j', j: 'g', m: 'n', n: 'm' };
ALT.a = 'euo';
const COMMON = 'earstnoil';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';
const MIRROR = { b: 'd', d: 'b', p: 'q', q: 'p', n: 'u', u: 'n', m: 'w', w: 'm' };

/** Words that sound the same: a tray must never let one be built from the other. */
export const HOMOPHONES = [
  ['hear', 'here'], ['there', 'their'], ['which', 'witch'], ['weather', 'whether'], ['see', 'sea'],
  ['to', 'too', 'two'], ['new', 'knew'], ['right', 'write'], ['no', 'know'], ['one', 'won'],
  ['be', 'bee'], ['by', 'buy'], ['hour', 'our'], ['whole', 'hole'], ['for', 'four'],
  ['son', 'sun'], ['meet', 'meat'], ['peace', 'piece'], ['plain', 'plane'],
];
/** A lower-case Set of the given words plus every word in the homophone table. */
export function lexiconOf(words = []) {
  const set = new Set();
  for (const w of words) set.add(String(w).toLowerCase());
  for (const group of HOMOPHONES) for (const w of group) set.add(w);
  return set;
}

/** Words that must never be made from a tray (12 letters or fewer). Includes Composition's UNKIND words. */
export const BLOCKED = new Set(`
stupid idiot idiots idiotic dumb dummy dummies ugly loser losers hate hates hated hating
kill kills killed killing killer dead die dies died dying murder blood bloody gun guns knife knives weapon
fat fatty smelly shutup moron morons fool fools pathetic useless worthless
shit fuck arse piss crap cock dick cunt twat wank slut whore bitch bastard bollocks turd bum bugger tosser prick
`.split(/\s+/).filter(Boolean));

// words of a list, by length (cached per list)
const byLength = new WeakMap();
function bucketsOf(set) {
  let b = byLength.get(set);
  if (!b) {
    b = new Map();
    for (const w of set) {
      const k = String(w).toLowerCase();
      if (!b.has(k.length)) b.set(k.length, []);
      b.get(k.length).push(k);
    }
    byLength.set(set, b);
  }
  return b;
}
const counts = (letters) => {
  const m = {};
  for (const ch of letters) m[ch] = (m[ch] || 0) + 1;
  return m;
};

// ---- Gaps and tiles ---------------------------------------------------------------------
const isUpper = (ch) => ch !== ch.toLowerCase() && ch === ch.toUpperCase();
const LEVEL_SALT = [0, 0x9E3779B1, 0x85EBCA6B, 0xC2B2AE35, 0x27D4EB2F];
const levelRng = (seed, level) => rng((seed + LEVEL_SALT[level]) >>> 0);

function fillableOf(word) {
  const chars = [...word];
  if (chars.length === 1) return /\p{L}/u.test(chars[0]) ? [0] : [];
  return chars.map((ch, i) => i).filter((i) => /\p{L}/u.test(chars[i]) && !isUpper(chars[i]));
}
const trickyAt = (word, tricky) => {
  if (!tricky) return [];
  const at = word.toLowerCase().indexOf(String(tricky).toLowerCase());
  return at < 0 ? [] : Array.from({ length: String(tricky).length }, (_, i) => at + i);
};
const pickSeeded = (pool, k, r) => shuffle(pool, r).slice(0, Math.max(0, k));
const sameList = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

function level1Gaps(word, F, tricky, seed) {
  const n = F.length;
  const r = levelRng(seed, 1);
  const t = trickyAt(word, tricky).filter((i) => F.includes(i));
  let useT = t.length === trickyAt(word, tricky).length ? t : [];
  if (n > 2) useT = useT.filter((i) => i !== 0);
  if (useT.length >= 1 && useT.length <= 3) return useT;
  const pool = n > 2 ? F.filter((i) => i !== 0) : F;
  return pickSeeded(pool, n <= 5 ? 1 : 2, r);
}
function level2Gaps(word, F, tricky, seed) {
  const n = F.length;
  const g = Math.max(1, Math.round(n / 3));
  const r = levelRng(seed, 2);
  const first = trickyAt(word, tricky).filter((i) => F.includes(i)).slice(0, g);
  const rest = pickSeeded(F.filter((i) => !first.includes(i)), g - first.length, r);
  return [...first, ...rest];
}
function gapsFor(word, F, level, tricky, seed) {
  const n = F.length;
  if (n <= 2) return [...F];
  if (level === 1) {
    const one = level1Gaps(word, F, tricky, seed).sort((a, b) => a - b);
    const two = level2Gaps(word, F, tricky, seed).sort((a, b) => a - b);
    let out = one;
    while (out.length > 1 && sameList(out, two)) out = out.slice(0, -1);
    return out;
  }
  if (level === 2) return level2Gaps(word, F, tricky, seed);
  if (level === 3) {
    return pickSeeded(F.filter((i) => i !== 0), Math.round((2 * n) / 3), levelRng(seed, 3));
  }
  return n > 12 ? F.slice(n - 12) : [...F];
}
function tileTotal(level, n, gaps) {
  if (n <= 2) return Math.max(3, gaps);
  if (level === 1) return Math.max(4, gaps);
  if (level === 2) return gaps >= 6 ? Math.min(gaps + 1, 12) : 6;
  if (level === 3) return Math.min(gaps + 3, 12);
  return Math.min(n + 3, 12);
}

const partnerOf = (ch) => MIRROR[ch.toLowerCase()] || '';
const barredAll = (level, profile) => level <= 2 || profile === 'sen';

/** Distractor letters, drawn in preference order (sound-alikes, the word's own letters, common ones). */
function drawDistractors(d, word, gapLetters, level, profile, r) {
  if (d <= 0) return [];
  const lower = word.toLowerCase();
  const inWord = new Set([...lower]);
  const allBarred = barredAll(level, profile);
  const okLetter = (x) => !(x in MIRROR) || (!allBarred && inWord.has(MIRROR[x]));
  const t1 = [];
  for (const g of shuffle(gapLetters.map((c) => c.toLowerCase()), r)) for (const x of shuffle([...(ALT[g] || '')], r)) t1.push(x);
  const t2 = shuffle([...inWord].filter((c) => /[a-z]/.test(c)), r);
  const t3 = shuffle([...COMMON], r);
  const pool = [...new Set([...t1, ...t2, ...t3, ...shuffle([...ALPHABET], r)])].filter(okLetter);
  const out = [];
  let mirrors = 0;
  for (const x of pool) {
    if (out.length === d) break;
    if (x in MIRROR) { if (mirrors >= 1) continue; mirrors += 1; }
    out.push(x);
  }
  return out;
}

/** Could another word of `list` be made from this tray? (levels 1 to 3: it must fit the shown letters; level 4: any word of the same length.) */
function buildsOther(list, spec, level, gapSet, tileChars) {
  const target = spec.word.toLowerCase();
  const letters = spec.letters.map((l) => l.ch.toLowerCase());
  const bucket = bucketsOf(list).get(letters.length);
  if (!bucket) return false;
  const tileCounts = counts(tileChars);
  if (level === 4) {
    const all = counts([...letters.filter((_, i) => !gapSet.has(i)), ...tileChars]);
    return bucket.some((w) => {
      if (w === target) return false;
      const c = counts([...w]);
      return Object.keys(c).every((k) => (all[k] || 0) >= c[k]);
    });
  }
  return bucket.some((w) => {
    if (w === target) return false;
    const need = {};
    for (let i = 0; i < w.length; i += 1) {
      if (gapSet.has(i)) need[w[i]] = (need[w[i]] || 0) + 1;
      else if (w[i] !== letters[i]) return false;
    }
    return Object.keys(need).every((k) => (tileCounts[k] || 0) >= need[k]);
  });
}

/**
 * The gaps and tiles for one word at one level. `entry` is { word, chunks, tricky? }; `seed` is
 * from seedOf. Returns null at level 5 (no tiles). `gaps` lets the caller choose the gap positions.
 */
export function tilesFor(entry, level, seed, { profile = 'normal', lexicon = new Set(), gaps = null } = {}) {
  if (![1, 2, 3, 4].includes(level)) return null;
  const word = entry.word;
  const chars = [...word];
  const F = fillableOf(word);
  const n = F.length;
  const single = chars.length === 1 && isUpper(chars[0]);
  let gapList = gaps ? [...new Set(gaps)].filter((i) => F.includes(i)).sort((a, b) => a - b) : gapsFor(word, F, level, entry.tricky, seed).sort((a, b) => a - b);
  if (gapList.length > 12) gapList = gapList.slice(gapList.length - 12);
  const gapSet = new Set(gapList);
  const gapLetters = gapList.map((i) => chars[i]);
  const total = Math.min(12, tileTotal(level, n, gapList.length));
  const want = Math.max(0, total - gapList.length);
  const spec0 = { word, level, letters: chars.map((ch, i) => ({ ch, shown: !gapSet.has(i) })), gaps: gapList };
  const r = rng((seed ^ 0x5bd1e995) >>> 0);
  const tileLetters = (extra) => [...gapLetters, ...(single ? extra.map((x) => x.toUpperCase()) : extra)];
  const bad = (extra) => {
    const t = tileLetters(extra).map((c) => c.toLowerCase());
    return buildsOther(lexicon, spec0, level, gapSet, t) || buildsOther(BLOCKED, spec0, level, gapSet, t);
  };
  let extra = [];
  let ok = false;
  for (let attempt = 0; attempt < 20 && !ok; attempt += 1) {
    extra = drawDistractors(want, word, gapLetters, level, profile, r);
    ok = !bad(extra);
  }
  while (!ok && extra.length) { extra = extra.slice(0, -1); ok = !bad(extra); }
  const letters = tileLetters(extra);
  let order = shuffle(letters, r);
  for (let k = 0; k < 10 && letters.length > 2 && order.join('') === [...letters].sort().join(''); k += 1) order = shuffle(letters, r);
  const tiles = order.map((ch, i) => ({ id: 't' + i, ch }));
  return { ...spec0, tiles, rows: tiles.length <= 6 ? 1 : 2 };
}

/** The flower game's keypad: the word's distinct fillable letters plus distractors, lower case, in seeded order. */
export function keypadFor(entry, level, seed, opts = {}) {
  const spec = tilesFor(entry, level, seed, opts);
  if (!spec) return [];
  const profile = opts.profile || 'normal';
  const F = fillableOf(entry.word);
  const own = [...new Set(F.map((i) => [...entry.word][i].toLowerCase()))];
  const have = new Set(own);
  const want = Math.max(0, spec.tiles.length - spec.gaps.length);
  const r = rng((seed ^ 0x2c1b3c6d) >>> 0);
  const extra = [];
  for (const x of drawDistractors(want + own.length, entry.word, own, level, profile, r)) {
    if (extra.length === want) break;
    if (!have.has(x)) { have.add(x); extra.push(x); }
  }
  return shuffle([...own, ...extra], r);
}

// ---- The tray ---------------------------------------------------------------------------
/** A new tray for a spec. */
export const newTray = (spec) => ({ spec, placed: {}, order: [], open: null, misses: {}, helped: false });
const usedIds = (st) => new Set(Object.values(st.placed));
const emptyGaps = (st) => st.spec.gaps.filter((g) => !(g in st.placed));
const without = (obj, key) => { const c = { ...obj }; delete c[key]; return c; };

/** A tile goes to the opened gap if there is one, else the first empty gap from the left. */
export function put(st, tileId) {
  if (!st.spec.tiles.some((t) => t.id === tileId) || usedIds(st).has(tileId)) return st;
  const empty = emptyGaps(st);
  if (!empty.length) return st;
  const gap = st.open !== null && empty.includes(st.open) ? st.open : empty[0];
  return { ...st, placed: { ...st.placed, [gap]: tileId }, order: [...st.order, gap], open: null };
}
/** The last tile placed returns to the tray. */
export function back(st) {
  if (!st.order.length) return st;
  const gap = st.order[st.order.length - 1];
  return { ...st, placed: without(st.placed, gap), order: st.order.slice(0, -1), open: null };
}
/** That gap's tile returns, and the next tile goes there first. */
export function unput(st, gapIndex) {
  if (!(gapIndex in st.placed)) return st;
  return { ...st, placed: without(st.placed, gapIndex), order: st.order.filter((g) => g !== gapIndex), open: gapIndex };
}
export const full = (st) => st.spec.gaps.every((g) => g in st.placed);
const tileOf = (st, id) => st.spec.tiles.find((t) => t.id === id);
/** The word as built so far: shown letters and placed tiles; '' for an empty gap. */
export function answerOf(st) {
  return st.spec.letters.map((l, i) => (l.shown ? l.ch : (i in st.placed ? tileOf(st, st.placed[i]).ch : ''))).join('');
}
/** Check a full tray: wrong tiles go back (and the gap's misses go up), right ones stay. */
export function check(st) {
  const wrongGaps = st.spec.gaps.filter((g) => g in st.placed && tileOf(st, st.placed[g]).ch !== st.spec.letters[g].ch);
  const right = full(st) && !wrongGaps.length;
  if (!wrongGaps.length) return { right, wrongGaps, st };
  const placed = { ...st.placed };
  const misses = { ...st.misses };
  for (const g of wrongGaps) { delete placed[g]; misses[g] = (misses[g] || 0) + 1; }
  return { right: false, wrongGaps, st: { ...st, placed, misses, order: st.order.filter((g) => !wrongGaps.includes(g)), open: null } };
}
/** An unused tile with the right letter for that gap (null if there is none). */
export function glowFor(st, gapIndex) {
  const want = st.spec.letters[gapIndex] && st.spec.letters[gapIndex].ch;
  const used = usedIds(st);
  const t = st.spec.tiles.find((x) => x.ch === want && !used.has(x.id));
  return t ? t.id : null;
}
/** Place the right tile in that gap for the player, and note that help was given. */
export function autoFill(st, gapIndex) {
  if (!st.spec.gaps.includes(gapIndex)) return st;
  const want = st.spec.letters[gapIndex].ch;
  let cur = gapIndex in st.placed && tileOf(st, st.placed[gapIndex]).ch === want ? st : null;
  if (cur) return { ...st, helped: true };
  cur = gapIndex in st.placed ? { ...st, placed: without(st.placed, gapIndex), order: st.order.filter((g) => g !== gapIndex) } : st;
  let id = glowFor(cur, gapIndex);
  if (id === null) {
    // every tile of that letter is placed in a gap that does not want it: take one back
    const stray = Object.keys(cur.placed).map(Number).find((g) => tileOf(cur, cur.placed[g]).ch === want && cur.spec.letters[g].ch !== want);
    if (stray === undefined) return st;
    id = cur.placed[stray];
    cur = { ...cur, placed: without(cur.placed, stray), order: cur.order.filter((g) => g !== stray) };
  }
  return { ...cur, placed: { ...cur.placed, [gapIndex]: id }, order: [...cur.order, gapIndex], open: cur.open === gapIndex ? null : cur.open, helped: true };
}
