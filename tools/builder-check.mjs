#!/usr/bin/env node
// SB6 WP-3 (TR-60, TR-61, TR-62): the sentence-builder bank.
//   node tools/builder-check.mjs            check the batches in spellbright-design/sb6/content/ and the built file, print a summary
//   node tools/builder-check.mjs --build    check, then write site/data/builder.json, content/voice-report.txt and content/enumerated.txt
//   node tools/builder-check.mjs --quiet    only problems
// The batches (frames-<part of speech>.json, categories.json, words-y<N>.json) are the writer's source; site/data/builder.json
// is built from them and only a checked bank is built. Every frame is enumerated (TR-61): every combination of its cards,
// with every word it is given in `w.f`, is checked as a sentence.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { checkStatement, ALLOW_CAPS } from '../site/js/statement-rules.js';
import { gapOf } from '../site/js/info-doc.js';
import { BLOCKED } from '../site/js/tiles-doc.js';
import { loadCurriculum, makeIsKnown, contextFor } from './statements-check.mjs';
import { readAllowed } from './build-voice-names.mjs';

export const RULES_VERSION = 'builder-check v1';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CONTENT_DIR = join(ROOT, 'spellbright-design/sb6/content');
export const BANK_FILE = join(ROOT, 'site/data/builder.json');
export const GROUPS = ['noun', 'verb', 'adjective', 'adverb', 'other'];
const PREFIX = { noun: 'n', verb: 'v', adjective: 'a', adverb: 'r', other: 'o' };
export const MAX_BYTES = 80 * 1024;
export const MAX_COMBOS = 27;
export const MAX_FRAME_WORDS = { young: 8, older: 12 }; // y[0] <= 2 -> 8; else 12
export const MAX_MODEL_WORDS = { young: 10, older: 14 }; // Years 1-2 -> 10; Years 3-6 -> 14
export const F_PER_WORD = 4;

// Content-review rules (24 Nov 2026, Opus check of WP-3).
export const GENERAL_VERB_FRAMES = new Set(['v001', 'v002', 'v003', 'v004', 'v005', 'v006', 'v007', 'v008']);
/** Forms that are not the base verb: never in the general verb frames. */
export const NOT_BASE = new Set('told heard caught bought brought received referred equipped preferred transferred hopped kicked helped said says was were is are has could should would jumping walking baking referring preferring transferring'.split(' '));
/** Verbs that need an object (or a particle): "We will find soon." is not a sentence. */
export const NEEDS_OBJECT = new Set('find hold break pass squash put give fetch thank possess describe increase consider mention believe notice unlock replay reheat rewrite subtract recognise develop achieve guarantee recommend perceive conceive appreciate suggest equip accommodate occupy receive deceive embarrass harass accompany suppose touch want prefer love'.split(' '));
export const BODY_NOUNS = new Set('eye face wrist tongue muscle stomach knee shoulder heart'.split(' '));
export const BODY_FRAMES = new Set(['n007', 'n003']);
export const DARK_NOUNS = new Set('ghost cemetery sacrifice explosion collision accident bruise soldier drought prejudice deceit lightning controversy'.split(' '));
export const SPECTATOR_FRAMES = new Set(['n001', 'n004']); // "I can see the {w} from my window." / "Look at the {w} over there!"
export const FOOD_ADJ = new Set(['delicious', 'nutritious', 'edible']);
export const ANIMALS_AND_PEOPLE = new Set('dog dogs cat cats bird birds kitten kittens rabbit frog fox sheep fish animals lambs puppies boy girl friend teacher king brother cousin'.split(' '));
export const PERSON_NOUNS = new Set('painter boy friend king father brother child children babies people parents parent woman women cousin guard chemist chef secretary amateur neighbour referee soldier individual receiver'.split(' '));
/** A person is never put in a box, a shed, under a bed or watched from a bed. */
export const HIDING_LINE = /\b(in the (box|shed|bed)|under the (bed|box)|from my (bed|box)|in my (bed|box))\b/i;
export const ONE_ONLY = new Set(['n071', 'n073']); // singular number frames: only for "one"
export const PLURAL_NUMBER = new Set(['n070', 'n072', 'o060', 'o061']);

// Everyday words for a parent or teacher that are on the lists but written with a capital in the middle of a sentence (not names).
for (const w of ['Mum', 'Dad', 'Gran']) ALLOW_CAPS.add(w);

/** The copy rules (CLAUDE.md): never in a card, a frame or a model sentence. */
export const BANNED_COPY = /\b(wrong|fail|failed|incorrect|mistake|late|lost|error)\b/i;
/** Composition's unkind list (compose/site/js/safe-text.js UNKIND) and the tiles BLOCKED list, plus words never wanted in a child's sentence. */
export const UNKIND = new Set(('stupid idiot idiots idiotic dumb dummy dummies ugly loser losers hate hates hated hating kill kills killed killing killer dead die dies died dying murder blood bloody gun guns knife knives weapon ' +
  'fat fatty smelly shutup moron morons fool fools pathetic useless worthless').split(' '));
const US_SPELLING = /\b(color|colors|gray|favorite|favorites|center|centers|neighbor|neighbors|practicing|mom|realize|recognize|organize|apologize|criticize|theater|meter|honor|humor|flavor|harbor|defense|offense|license|jewelry|aluminum|cozy|pajamas|sidewalk|vacation|candy|cookie|fall)\b/i;

const norm = (s) => String(s).replace(/’/g, "'");
export const wordsIn = (s) => norm(s).match(/[A-Za-z]+(?:['-][A-Za-z]+)*/g) || [];
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const groupOfPos = (pos) => (['noun', 'verb', 'adjective', 'adverb'].includes(pos) ? pos : 'other');

// ---------------------------------------------------------------- sources and build

/** The writer's batches: { frames: { group: [frame] }, categories, words: { word: [spec, model] }, years: { word: year } } */
export function loadSources(dir = CONTENT_DIR) {
  const frames = {};
  for (const g of GROUPS) {
    const f = join(dir, 'frames-' + g + '.json');
    frames[g] = existsSync(f) ? read(f).frames : [];
  }
  const categories = read(join(dir, 'categories.json'));
  const words = {};
  const years = {};
  const order = [];
  for (const file of readdirSync(dir).filter((n) => /^words-y\d\.json$/.test(n)).sort()) {
    const b = read(join(dir, file));
    for (const [w, spec] of Object.entries(b.w)) {
      if (words[w]) throw new Error('word in two batches: ' + w);
      words[w] = spec;
      years[w] = b.year;
      order.push(w);
    }
  }
  return { frames, categories, words, years, order };
}

/** What the checks need: the curriculum, the word lists, the statements, the voice allow-list. */
export function makeContext(root = ROOT) {
  const curr = loadCurriculum(root);
  const isKnown = makeIsKnown(curr, root);
  const statements = read(join(root, 'site/data/statements.json')).w || {};
  const allowed = readAllowed();
  const namesFile = join(root, 'wordbright/site/data/voice-names.txt');
  const names = new Set(existsSync(namesFile) ? readFileSync(namesFile, 'utf8').split('\n').filter((l) => l && !l.startsWith('sha256:')) : []);
  return { curr, isKnown, statements, allowed, names };
}

export const slotsOf = (t) => [...new Set([...String(t).matchAll(/\{([a-z])\}/g)].map((m) => m[1]))];
export const isIdToken = (t) => /^[nvaro]\d{3}$/.test(t);

/** Every sentence a frame can make for `word` (cards combined, target in {w}). { text, picks } */
export function enumerate(frame, word) {
  const keys = Object.keys(frame.s || {}).sort();
  let combos = [{}];
  for (const k of keys) combos = combos.flatMap((c) => frame.s[k].map((card) => ({ ...c, [k]: card })));
  return combos.map((picks) => ({ picks, text: sentenceOf(frame, word, picks) }));
}
export function sentenceOf(frame, word, picks) {
  let t = frame.t.replace('{w}', word);
  for (const [k, v] of Object.entries(picks)) t = t.replace('{' + k + '}', v);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Does `word` clash with a card of the frame (the same word or another form of it)? Such a frame is not given to the word. */
export function collides(frame, word) {
  const w = word.toLowerCase();
  const forms = new Set([w, w + 's', w + 'es', w.replace(/s$/, ''), w.replace(/es$/, ''), w.replace(/ies$/, 'y')]);
  for (const cards of Object.values(frame.s || {})) {
    for (const card of cards) for (const p of wordsIn(card)) if (forms.has(p.toLowerCase())) return true;
  }
  return forms.has('') ? false : wordsIn(frame.t.replace(/\{[a-z]\}/g, ' ')).some((p) => p.toLowerCase() !== 'a' && forms.has(p.toLowerCase()));
}

/** Rules for one sentence made from a frame or written as a model. Returns a list of strings (empty = good). */
export function checkText(text, ctx, { word, year = null, model = false } = {}) {
  const probs = [];
  const t = norm(text);
  if (!/^[A-Za-z ,.!?'-]+$/.test(t)) probs.push('has a character outside letters, spaces and , . ! ? \' -');
  if (/\d/.test(t) || /www|http|\.com|\.uk/i.test(t)) probs.push('digit or web address');
  if (!/^[A-Z]/.test(t)) probs.push('no capital at the start');
  if (!/[.!?]$/.test(t)) probs.push('no full stop, ! or ? at the end');
  if (/[.!?]/.test(t.slice(0, -1))) probs.push('more than one sentence');
  if (/\s{2}|^\s|\s$| ,|\.\.|,,/.test(t)) probs.push('spacing or doubled punctuation');
  if (BANNED_COPY.test(t)) probs.push('banned copy word: ' + (BANNED_COPY.exec(t) || [])[0]);
  if (US_SPELLING.test(t)) probs.push('American spelling: ' + (US_SPELLING.exec(t) || [])[0]);
  for (const w of wordsIn(t)) {
    const l = w.toLowerCase();
    if (UNKIND.has(l) || (BLOCKED.has(l) && l !== (word || '').toLowerCase())) probs.push('unkind or blocked word: ' + w);
  }
  // The statements rules (1 once, 2 clean, 4 word lists, names, banned topics, 5 not the example), minus 3/7 (length is the bank's own, no chapter) and 4b (frames only).
  const r = checkStatement(text, { word, year, meaning: '', example: '', otherWords: [], isKnown: ctx.isKnown });
  if (model && ctx.example && norm(ctx.example).trim().toLowerCase() === t.trim().toLowerCase()) probs.push('rule 5: the model is the curriculum example');
  for (const f of r.fails) {
    if (f.rule === 3 || f.rule === 7) continue;
    if (!model && f.rule === 4 && /^a sentence for /.test(f.why)) continue;
    probs.push('rule ' + f.rule + ': ' + f.why);
  }
  return probs;
}

/** Frames given to `word` (from `spec` = "CAT,CAT,v001"): ids kept in order, collisions and failures skipped, at most F_PER_WORD. */
export function framesFor(word, spec, index, src, group, ctx, { explicitProblems } = {}) {
  const byId = new Map(src.frames[group].map((f) => [f.id, f]));
  const out = [];
  const exact = String(spec).startsWith('=');
  const tokens = String(spec).replace(/^=/, '').split(',').map((s) => s.trim()).filter(Boolean);
  const excluded = new Set(tokens.filter((t) => t.startsWith('-')).map((t) => t.slice(1)));
  const good = (id) => {
    const f = byId.get(id);
    if (!f) return false;
    if (collides(f, word)) return false;
    const model = {};
    return enumerate(f, word).every((e) => !checkText(e.text, ctx, { word, model: false }).length) || model.x;
  };
  for (const tok of tokens) {
    if (isIdToken(tok)) {
      if (!byId.has(tok)) { (explicitProblems || []).push(word + ': frame ' + tok + ' is not in the ' + group + ' frames'); continue; }
      if (!good(tok)) { (explicitProblems || []).push(word + ': frame ' + tok + ' does not suit the word (a clash or a failed check)'); continue; }
      if (!out.includes(tok)) out.push(tok);
    }
  }
  if (exact) return out;
  for (const tok of tokens) {
    if (isIdToken(tok) || tok.startsWith('-')) continue;
    const list = src.categories[tok];
    if (!list) { (explicitProblems || []).push(word + ': unknown category ' + tok); continue; }
    for (let k = 0; k < list.length; k += 1) {
      const id = list[(index + k) % list.length];
      if (!out.includes(id) && !excluded.has(id) && good(id)) out.push(id);
    }
  }
  return out.slice(0, F_PER_WORD);
}

/** The bank in builder.json shape, built from the batches (not yet checked as a whole). */
export function buildBank(src, ctx, meta = {}) {
  const problems = [];
  const frames = {};
  for (const g of GROUPS) frames[g] = src.frames[g].map((f) => ({ id: f.id, t: f.t, s: f.s, y: f.y, ...(f.sp ? { sp: 1 } : {}) }));
  const w = {};
  src.order.forEach((word, i) => {
    const [spec, model] = src.words[word];
    const e = ctx.curr.entries.get(word);
    const group = e ? groupOfPos(e.partOfSpeech) : 'other';
    const f = framesFor(word, spec, i, src, group, ctx, { explicitProblems: problems });
    w[word] = { f, m: model };
  });
  const bank = {
    _meta: { v: 1, bank: meta.bank || '2026-11-24.1', frames: GROUPS.reduce((n, g) => n + frames[g].length, 0), rules: RULES_VERSION, writer: 'sonnet', checker: 'opus', reader: 'haiku', spotCheck: 'pending (Ron)' },
    frames,
    w,
  };
  return { bank, problems };
}

// ---------------------------------------------------------------- the whole-bank check (TR-61)

export const wordCount = (s) => s.trim().split(/\s+/).length;

/** Checks a bank (builder.json shape). Returns { problems: [], thin: [], stats }. */
export function checkBank(bank, ctx) {
  const problems = [];
  const thin = [];
  const seen = new Set();
  const frameById = new Map();
  const stats = { frames: {}, models: {}, perYear: {}, combos: 0, sentences: 0 };
  if (!bank || typeof bank !== 'object' || !bank.frames || !bank.w) return { problems: ['not a bank: needs frames and w'], thin, stats };
  for (const g of GROUPS) {
    const list = bank.frames[g];
    if (!Array.isArray(list)) { problems.push('frames.' + g + ' is missing'); continue; }
    stats.frames[g] = list.length;
    for (const f of list) {
      const where = g + ' ' + f.id;
      if (!new RegExp('^' + PREFIX[g] + '\\d{3}$').test(f.id || '')) problems.push(where + ': id must be ' + PREFIX[g] + 'NNN');
      if (seen.has(f.id)) problems.push(where + ': id used twice');
      seen.add(f.id);
      frameById.set(f.id, { ...f, group: g });
      if (typeof f.t !== 'string' || f.t.split('{w}').length !== 2) { problems.push(where + ': t needs exactly one {w}'); continue; }
      const used = slotsOf(f.t).filter((k) => k !== 'w');
      const keys = Object.keys(f.s || {});
      if (used.slice().sort().join() !== keys.slice().sort().join()) problems.push(where + ': slots in t (' + used.join('') + ') and in s (' + keys.join('') + ') differ');
      if (!keys.length) problems.push(where + ': needs at least one other slot (level 1 needs gaps)');
      let combos = 1;
      for (const k of keys) {
        const cards = f.s[k];
        if (!Array.isArray(cards) || cards.length !== 3) { problems.push(where + ': slot ' + k + ' needs exactly 3 cards'); combos = 0; continue; }
        if (new Set(cards.map((c) => c.toLowerCase())).size !== 3) problems.push(where + ': slot ' + k + ' has a repeated card');
        for (const c of cards) if (typeof c !== 'string' || !c.trim() || c !== c.trim() || wordsIn(c).length > 3) problems.push(where + ': odd card "' + c + '"');
        combos *= 3;
      }
      if (combos > MAX_COMBOS) problems.push(where + ': ' + combos + ' combinations (max ' + MAX_COMBOS + ')');
      if (!Array.isArray(f.y) || f.y.length !== 2 || !f.y.every((n) => Number.isInteger(n) && n >= 1 && n <= 6) || f.y[0] > f.y[1]) problems.push(where + ': y must be [from, to] within 1-6');
    }
  }
  // Generic frames: made with a sample word of the part of speech; word frames: with each word that is given them.
  const SAMPLE = { noun: ['cat', 'tree'], verb: ['jump', 'help'], adjective: ['happy', 'tall'], adverb: ['slowly', 'kindly'], other: ['and', 'with'] };
  const givenTo = new Map();
  for (const [word, entry] of Object.entries(bank.w)) for (const id of entry.f || []) { if (!givenTo.has(id)) givenTo.set(id, []); givenTo.get(id).push(word); }
  const checkFrame = (f, targets) => {
    if (typeof f.t !== 'string' || f.t.split('{w}').length !== 2 || !f.s) return;
    const limit = f.y && f.y[0] <= 2 ? MAX_FRAME_WORDS.young : MAX_FRAME_WORDS.older;
    for (const word of targets) {
      for (const e of enumerate(f, word)) {
        stats.sentences += 1;
        const n = wordCount(e.text);
        if (n > limit) problems.push(f.id + ' (' + word + '): "' + e.text + '" has ' + n + ' words (max ' + limit + ' for y ' + f.y.join('-') + ')');
        if (n < 4) problems.push(f.id + ' (' + word + '): "' + e.text + '" has fewer than 4 words');
        for (const p of checkText(e.text, ctx, { word })) problems.push(f.id + ' (' + word + '): "' + e.text + '": ' + p);
      }
    }
  };
  for (const f of frameById.values()) {
    if (!f.sp) checkFrame(f, SAMPLE[f.group]);
    checkFrame(f, [...new Set(givenTo.get(f.id) || [])]);
    stats.combos += Object.keys(f.s || {}).reduce((n, k) => n * (f.s[k] || []).length, 1);
  }
  // Words: every one has frames of its own part of speech and a model sentence.
  const curriculum = ctx.curr.entries;
  for (const [word, e] of curriculum) {
    const entry = bank.w[word];
    const year = e.year;
    if (!entry) { problems.push(word + ': no entry in w'); continue; }
    const group = groupOfPos(e.partOfSpeech);
    const f = entry.f || [];
    if (!f.length) problems.push(word + ': no frame');
    if (new Set(f).size !== f.length) problems.push(word + ': a frame twice');
    for (const id of f) {
      const fr = frameById.get(id);
      if (!fr) problems.push(word + ': frame ' + id + ' does not exist');
      else if (fr.group !== group) problems.push(word + ': frame ' + id + ' is a ' + fr.group + ' frame but the word is a ' + e.partOfSpeech);
      else if (collides(fr, word)) problems.push(word + ': frame ' + id + ' holds the word itself or a form of it as a card');
      else if (fr.y && (year < fr.y[0] || year > fr.y[1])) problems.push(word + ': frame ' + id + ' suits Years ' + fr.y.join('-') + ', the word is Year ' + year);
    }
    // The review rules.
    for (const id of f) {
      if (GENERAL_VERB_FRAMES.has(id) && (NOT_BASE.has(word) || NEEDS_OBJECT.has(word))) problems.push(word + ': ' + id + ' is a general verb frame; the word is a past or -ing form or needs an object');
      if (ONE_ONLY.has(id) && word !== 'one') problems.push(word + ': ' + id + ' is only for "one" (number agreement)');
      if (PLURAL_NUMBER.has(id) && word === 'one') problems.push(word + ': ' + id + ' is plural');
      if (BODY_NOUNS.has(word) && !BODY_FRAMES.has(id)) problems.push(word + ': a body-part noun may only have ' + [...BODY_FRAMES].join(' or ') + ', not ' + id);
      if (DARK_NOUNS.has(word) && SPECTATOR_FRAMES.has(id)) problems.push(word + ': a dark noun is never in ' + id + ' (spectator frame)');
      const frm = frameById.get(id);
      if (PERSON_NOUNS.has(word) && frm && enumerate(frm, word).some((e) => HIDING_LINE.test(e.text))) problems.push(word + ': a person is put in a box, shed or bed in ' + id);
      if (FOOD_ADJ.has(word) && frm && enumerate(frm, word).some((e) => wordsIn(e.text).some((x) => ANIMALS_AND_PEOPLE.has(x.toLowerCase())))) problems.push(word + ': a food adjective sits on an animal or person card in ' + id);
    }
    if (f.length < 3) thin.push(word + ' (' + f.length + ' frame' + (f.length === 1 ? '' : 's') + ')');
    const m = entry.m;
    if (typeof m !== 'string' || !m) { problems.push(word + ': no model sentence'); continue; }
    const n = wordCount(m);
    const max = year <= 2 ? MAX_MODEL_WORDS.young : MAX_MODEL_WORDS.older;
    if (n > max) problems.push(word + ': model has ' + n + ' words (max ' + max + ' for Year ' + year + ')');
    if (n < 4) problems.push(word + ': model has fewer than 4 words');
    if (!gapOf(m, word)) problems.push(word + ': model does not hold the word once as a whole word');
    const c = contextFor(word, ctx.curr, ctx.isKnown);
    for (const p of checkText(m, { ...c, isKnown: ctx.isKnown }, { word, year, model: true })) problems.push(word + ': model "' + m + '": ' + p);
    const st = (ctx.statements[word] || []).map((s) => s.toLowerCase());
    if (st.includes(m.toLowerCase())) problems.push(word + ': model is the same as a statement of the bank');
    stats.perYear[year] = (stats.perYear[year] || 0) + 1;
  }
  for (const word of Object.keys(bank.w)) if (!curriculum.has(word)) problems.push(word + ': not a curriculum word');
  stats.models = Object.keys(bank.w).length;
  const bytes = Buffer.byteLength(JSON.stringify(bank));
  stats.bytes = bytes;
  if (bytes > MAX_BYTES) problems.push('bank is ' + bytes + ' bytes (max ' + MAX_BYTES + ')');
  return { problems, thin, stats };
}

// ---------------------------------------------------------------- voice report (BR-17 AC4)

const NEGATIVES = new Set(["can't", "won't", "shan't"]);
const ENDINGS = new Set(['s', 're', 'm', 'll', 've', 'd']);
/** The account's sentence rule in brief (see compose/tests/voice-lines.test.js): every word on the allow-list (or the names list). */
export function unvoiced(text, allowed, names) {
  const known = (w) => w === 'a' || w === 'i' || allowed.has(w) || names.has(w);
  const out = [];
  for (const w of norm(text).toLowerCase().match(/[a-z]+(?:'[a-z]+)*/g) || []) {
    if (!w.includes("'")) { if (!known(w)) out.push(w); continue; }
    if (NEGATIVES.has(w)) continue;
    const m = /^([a-z]+)'([a-z]+)$/.exec(w);
    if (!m) { out.push(w); continue; }
    if (m[2] === 't') { if (!(m[1].length > 1 && m[1].endsWith('n') && known(m[1].slice(0, -1)))) out.push(w); continue; }
    if (!(ENDINGS.has(m[2]) && known(m[1]))) out.push(w);
  }
  return out;
}

/** Which frames may use the Waystead voice: every fixed word and every card on the allow-list (the target is judged per word). */
export function voiceReport(bank, ctx) {
  const { allowed, names } = ctx;
  const frames = [];
  const missing = new Map();
  const note = (w, where) => { if (!missing.has(w)) missing.set(w, new Set()); missing.get(w).add(where); };
  for (const g of GROUPS) {
    for (const f of bank.frames[g]) {
      const fixed = f.t.replace(/\{[a-z]\}/g, ' ');
      const bad = [...unvoiced(fixed, allowed, names)];
      for (const cards of Object.values(f.s)) for (const c of cards) bad.push(...unvoiced(c, allowed, names));
      for (const w of bad) note(w, f.id);
      frames.push({ id: f.id, group: g, ok: !bad.length, bad: [...new Set(bad)] });
    }
  }
  const words = [];
  for (const [word, e] of Object.entries(bank.w)) {
    const tbad = unvoiced(word, allowed, names);
    const mbad = unvoiced(e.m, allowed, names);
    for (const w of tbad) note(w, 'target word ' + word);
    for (const w of mbad) note(w, 'model of ' + word);
    const okFrames = (e.f || []).filter((id) => frames.find((x) => x.id === id).ok);
    words.push({ word, targetOk: !tbad.length, modelOk: !mbad.length, voiceFrames: okFrames.length, frames: (e.f || []).length });
  }
  return { frames, words, missing };
}

export function voiceText(bank, rep) {
  const L = [];
  const okFrames = rep.frames.filter((f) => f.ok);
  L.push('SB6 builder bank: voice report (' + RULES_VERSION + ')');
  L.push('A cards-only sentence may use the Waystead voice only when every word is on wordbright/site/data/voice-allow.txt (or voice-names.txt).');
  L.push('');
  L.push('Frames whose fixed words and cards are all on the list: ' + okFrames.length + ' of ' + rep.frames.length);
  for (const g of GROUPS) {
    const fr = rep.frames.filter((f) => f.group === g);
    L.push('  ' + g + ': ' + fr.filter((f) => f.ok).length + ' of ' + fr.length);
  }
  L.push('');
  L.push('Frames that must use the device voice (word not on the list):');
  for (const f of rep.frames.filter((f) => !f.ok)) L.push('  ' + f.id + ' : ' + f.bad.join(', '));
  if (!rep.frames.some((f) => !f.ok)) L.push('  none');
  L.push('');
  L.push('Model sentences all of whose words are on the list: ' + rep.words.filter((w) => w.modelOk).length + ' of ' + rep.words.length);
  L.push('Target words not on the list (their sentences use the device voice): ' + (rep.words.filter((w) => !w.targetOk).map((w) => w.word).join(', ') || 'none'));
  L.push('Models with a word not on the list:');
  for (const w of rep.words.filter((w) => !w.modelOk)) L.push('  ' + w.word + ' : ' + unvoicedList(bank.w[w.word].m, rep));
  if (!rep.words.some((w) => !w.modelOk)) L.push('  none');
  L.push('');
  L.push('Words missing from the allow-list (the list is not edited here):');
  for (const [w, where] of [...rep.missing.entries()].sort()) L.push('  ' + w + '  (' + [...where].slice(0, 6).join(', ') + (where.size > 6 ? ', ...' : '') + ')');
  if (!rep.missing.size) L.push('  none');
  return L.join('\n') + '\n';
}
function unvoicedList(text, rep) { return [...rep.missing.entries()].filter(([, where]) => [...where].some((x) => text)).length ? text : text; }

/** EVERY word x frame x card combination, one block per word, for the Opus checker and the child-reader; then the frames no word uses. */
export function enumeratedText(bank) {
  const L = ['SB6 builder bank: EVERY word x frame line, every card combination (' + RULES_VERSION + ')', 'One block per word: its frames, then every sentence of each frame with the word in {w}; then the model.', ''];
  const byId = new Map();
  for (const g of GROUPS) for (const f of bank.frames[g]) byId.set(f.id, f);
  for (const [word, e] of Object.entries(bank.w)) {
    L.push('## ' + word + '   [' + e.f.join(' ') + ']');
    for (const id of e.f) {
      const f = byId.get(id);
      L.push(' ' + id + ' ' + f.t);
      for (const x of enumerate(f, word)) L.push('    ' + x.text);
    }
    L.push(' model: ' + e.m);
    L.push('');
  }
  L.push('=== Frames given to no word (read with a sample word) ===');
  const used = new Set(Object.values(bank.w).flatMap((e) => e.f));
  for (const [id, f] of byId) if (!used.has(id)) { L.push(' ' + id + ' ' + f.t); for (const x of enumerate(f, 'cat')) L.push('    ' + x.text); }
  return L.join('\n') + '\n';
}

// ---------------------------------------------------------------- command line

function main() {
  const args = process.argv.slice(2);
  const build = args.includes('--build');
  const quiet = args.includes('--quiet');
  const ctx = makeContext();
  const src = loadSources();
  const { bank, problems: bp } = buildBank(src, ctx);
  const res = checkBank(bank, ctx);
  const problems = [...bp, ...res.problems];
  const rep = voiceReport(bank, ctx);
  if (!quiet) {
    console.log(RULES_VERSION + ': ' + bank._meta.frames + ' frames (' + GROUPS.map((g) => g + ' ' + res.stats.frames[g]).join(', ') + '), ' + res.stats.models + ' words, ' + res.stats.sentences + ' sentences checked, ' + res.stats.bytes + ' bytes');
    console.log('  per year: ' + Object.entries(res.stats.perYear).map(([y, n]) => 'Y' + y + ' ' + n).join(', '));
    console.log('  thin cards (under 3 frames): ' + (res.thin.length ? res.thin.length + ': ' + res.thin.join(', ') : 'none'));
    console.log('  voice: ' + rep.frames.filter((f) => f.ok).length + ' of ' + rep.frames.length + ' frames, ' + rep.words.filter((w) => w.modelOk).length + ' of ' + rep.words.length + ' models all on the allow-list; ' + rep.missing.size + ' word(s) missing from it');
  }
  if (problems.length) {
    console.log(problems.length + ' problem(s):');
    for (const p of problems.slice(0, 200)) console.log('  - ' + p);
    process.exitCode = 1;
    return;
  }
  if (build) {
    writeFileSync(BANK_FILE, JSON.stringify(bank) + '\n');
    writeFileSync(join(CONTENT_DIR, 'voice-report.txt'), voiceText(bank, rep));
    writeFileSync(join(CONTENT_DIR, 'enumerated.txt'), enumeratedText(bank));
    console.log('wrote site/data/builder.json, content/voice-report.txt, content/enumerated.txt');
  } else if (!quiet) {
    const built = existsSync(BANK_FILE) ? readFileSync(BANK_FILE, 'utf8') : '';
    console.log(built === JSON.stringify(bank) + '\n' ? '  site/data/builder.json is current' : '  site/data/builder.json is NOT current: run with --build');
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
