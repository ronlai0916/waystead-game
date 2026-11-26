// SB6 WP-2 (TRS TR-16, U-size6, a hard gate): the worst case for the size of a child's words value.
// 10 words of 12 letters, a child who always slips, 3 sittings of 15 minutes every day for 7 days (about 950 tries), every row size 2 .. 10,
// two older weeks, sentences, meanings, a test with Peeks. The value is saved (and trimmed past 48 KB) after EVERY try.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../site/js/words-doc.js';
import * as Su from '../site/js/setup-doc.js';

const START = '2026-11-17';
const TEST = W.addDays(START, 7);
const WORDS = ['strawberry1', 'wheelbarrow', 'neighbouring', 'unfortunate', 'photography', 'imagination', 'exhaustingly', 'temperatures', 'considerable', 'extraordinary']
  .map((w, i) => (w.replace(/\d/g, '') + 'abcdefghijkl').slice(0, 12).replace(/(.)$/, String.fromCharCode(97 + i)));
const GID = 'r0123456789ab.1a2b3c';
const OLD = ['r0123456789aa.0a0a0a', 'r0123456789ac.2b2b2b'];
const pad = (n, w) => String(n).padStart(w, '0');
let seq = 0;
const tid = () => { seq += 1; return 'r' + pad(seq.toString(36), 12, '0').slice(-12); };
const JOBS = ['h', 'f', 'f', 'w', 'k', 'b', 'm', 'q'];

function simulate() {
  seq = 0;
  let d = W.createGroup(W.emptyDoc(), { id: GID, name: 'Words for 24 Nov', test: TEST, words: WORDS, today: START, now: 1 }).doc;
  d = W.withSetup(d, Su.setPeek(Su.setSbs(Su.setWay({}, 'sbs', 5, 'Mum').setup, { min: 15, big: 1, after: '16:00' }, 6), 5, 7));
  // two older weeks that were practised before (their tries are the first to fold)
  for (const [k, id] of OLD.entries()) {
    d = { ...d, groups: { ...d.groups, [id]: { name: 'Older ' + k, start: W.addDays(START, -14 - 7 * k), test: W.addDays(START, -7 - 7 * k), words: WORDS.slice(0, 8).map((w) => w.slice(0, 11) + 'z'), back: [], at: 2 } } };
    for (let i = 0; i < 150; i += 1) {
      d = W.addTry(d, { id: tid(), word: d.groups[id].words[i % 8], day: W.addDays(d.groups[id].start, i % 7), group: id, kind: 'p', tries: i % 3, peeks: 0, clean: true, source: 'g', lv: 2, now: 10 + i + 1000 * k });
    }
  }
  const full = { ...d, results: [...d.results] }; // the same history, never trimmed
  const log = { maxBefore: 0, maxAfter: 0, trims: 0, tries: 0, steps: 0, folded: [] };
  const states = [];
  const g = () => W.groupById(d, GID);
  const apply = (fn) => { // one change, then one save: trim past 48 KB; the same change on the untrimmed copy
    const id = tid(); // one id for both copies
    d = fn(d, id);
    Object.assign(full, fn(full, id));
    const before = W.sizeOf(d);
    log.maxBefore = Math.max(log.maxBefore, before);
    if (before > W.TRIM_AT) {
      const kept = W.trim(d, now);
      d = kept;
      log.trims += 1;
      log.maxAfter = Math.max(log.maxAfter, W.sizeOf(kept));
      states.push({ day: curDay, now, size: W.sizeOf(kept), results: kept.results.length });
      // today's tries and the sitting being played stay unfolded after every trim
      const have = new Set(kept.results.map((r) => r.id));
      for (const r of full.results) if ((r.d === curDay || r.ss === curSs) && r.at <= now && !have.has(r.id) && r.g === GID) log.folded.push(r.id + ' ' + r.d + ' ' + r.ss);
    }
  };
  let now = 0;
  let curDay = START;
  let curSs = '';
  const marks = [];
  const mark = (k, day) => apply((x) => W.markStep(x, W.groupById(x, GID), k, day, now));
  let ssN = 0;
  for (let day = 0; day < 8; day += 1) {
    curDay = W.addDays(START, day);
    if (day === 7) { // the test, with one Peek on a few words
      for (const [i, w] of WORDS.entries()) {
        now = Date.parse(curDay + 'T09:00:00Z') + i * 20000;
        const peek = i % 3 === 0;
        apply((x, id) => W.addTry(x, { id, word: w, day: curDay, group: GID, kind: 't', tries: peek ? 1 : 2, peeks: peek ? 1 : 0, clean: !peek && i % 2 === 0, pr: peek ? 0 : undefined, pf: 'sen', now }));
      }
      break;
    }
    for (let s = 0; s < 3; s += 1) {
      ssN += 1;
      const ss = 'ss' + pad(ssN, 4);
      curSs = ss;
      const t0 = Date.parse(curDay + 'T' + pad(8 + s * 4, 2) + ':00:00Z');
      const n = 45;
      for (let i = 0; i < n; i += 1) {
        now = t0 + i * 20000;
        const w = WORDS[(i * 3 + s + day) % 10];
        const r = 1 + ((i + s) % 8) === 8 ? W.ALL_RUNG : 1 + ((i + s) % 8);
        const slips = [(i * 5) % 12, (i * 7 + 3) % 12];
        const rw = JOBS[i % JOBS.length] === 'w' ? 2 + (i % 9) : undefined;
        apply((x, id) => W.addTry(x, { id, word: w, day: curDay, group: GID, kind: 'p', tries: 2, peeks: i % 4 === 0 ? 1 : 0, clean: true, source: 'g', now, lv: r === W.ALL_RUNG ? 4 : r < 4 ? 2 : 3, r, j: JOBS[i % JOBS.length], ss, sl: slips, rw }));
        log.tries += 1;
      }
      now = t0 + n * 20000 + 1000;
      mark('se:' + ss, curDay);
    }
    // the week's stones, spread over the days: rows of every size 2 .. 10 (marks only)
    if (day === 0) mark('hello', curDay);
    if (day === 1) mark('fix', curDay);
    if (day === 2) { mark('games', curDay); }
    if (day === 3) {
      mark('story', curDay);
      for (const [i, w] of WORDS.entries()) apply((x, id) => W.addNote(x, { id, group: GID, word: w, text: 'A sentence for ' + w + ' that is about as long as a child would write.', day: curDay, now: now + i, bl: 1 + (i % 3) * 1, hp: i % 2 }));
      for (let i = 0; i < 30; i += 1) apply((x, id) => W.addTry(x, { id, word: WORDS[i % 10], day: curDay, group: GID, kind: 'p', tries: 0, peeks: 0, clean: true, source: 'm', now: now + 100 + i }));
    }
    const sizes = [[2, 3], [4, 5], [6, 7], [8, 9, 10]][Math.min(3, Math.max(0, day - 3))];
    if (day >= 3) for (const k of sizes) {
      for (let i = 0; i < Math.ceil(10 / k); i += 1) mark('rw:' + k + ':' + i, curDay);
      mark('rw:' + k, curDay);
    }
    if (day === 6) mark('practice', curDay);
    states.push({ day: curDay, check: true });
  }
  return { d, full, log, states, g: g(), marks };
}

test('U-size6: the worst week stays under 40 KB after every trim, and never over 64 KB before one', (t) => {
  const { d, full, log } = simulate();
  t.diagnostic(`tries this week ${log.tries}, results kept ${d.results.length} of ${full.results.length}, trims ${log.trims}, ` +
    `largest before a trim ${log.maxBefore} B, largest after ${log.maxAfter} B, final ${W.sizeOf(d)} B, untrimmed ${W.sizeOf(full)} B`);
  assert.ok(log.tries >= 940 && log.tries <= 960, 'about 950 tries: ' + log.tries);
  assert.ok(log.trims > 0, 'it did have to fold');
  assert.ok(log.maxBefore <= 64 * 1024, 'never over 64 KB before trim runs: ' + log.maxBefore);
  assert.ok(log.maxAfter <= W.TRIM_TO, 'after every trim at most 40 KB: ' + log.maxAfter);
  assert.ok(W.sizeOf(d) <= W.TRIM_AT, 'and the final value is under the trim line');
});
test('U-size6: today\'s tries and the last sitting\'s tries are never folded (checked after every trim)', () => {
  const { d, full, log } = simulate();
  assert.deepEqual(log.folded, [], 'a try of the day being played was folded');
  const testDay = full.results.filter((r) => r.k === 't').at(-1).d;
  const kept = new Set(d.results.map((r) => r.id));
  for (const r of full.results.filter((x) => x.d === testDay || x.ss === 'ss0021')) assert.ok(kept.has(r.id), 'unfolded: ' + r.id + ' ' + r.d);
  assert.ok(d.results.length < full.results.length, 'older days were folded');
});
test('U-size6: ladderFacts, the study jobs, jobFor and the rows marks are the same before and after folding the older days', () => {
  const { d, full } = simulate();
  const g = W.groupById(d, GID);
  const gf = W.groupById(full, GID);
  for (const today of [W.addDays(START, 6), TEST, W.addDays(TEST, 1)]) {
    for (const w of WORDS) assert.deepEqual(W.ladderFacts(d, w, today), W.ladderFacts(full, w, today), w + ' ' + today);
  }
  for (const w of WORDS) {
    const f = W.ladderFacts(d, w, TEST);
    assert.ok(f.best >= 0 && f.days.length > 0 && f.lastSitting, 'facts are real for ' + w);
  }
  for (const day of [START, W.addDays(START, 4), W.addDays(TEST, -1), TEST, W.addDays(TEST, 1), W.addDays(TEST, 3)]) assert.equal(W.jobFor(d, g, day), W.jobFor(full, gf, day), 'jobFor ' + day);
  for (const s of W.STUDY_JOBS) assert.equal(W.studyJobDay(d, g, s), W.studyJobDay(full, gf, s), s);
  assert.equal(W.studyDone(d, g), true);
  assert.deepEqual(Object.keys(d.steps).sort(), Object.keys(full.steps).sort(), 'every step mark stays: sittings, rows, jobs');
  assert.equal(Object.keys(d.steps).filter((k) => k.includes('|rw:')).length, 9 + [2, 3, 4, 5, 6, 7, 8, 9, 10].reduce((a, k) => a + Math.ceil(10 / k), 0), 'rows marks for every size 2 .. 10');
  assert.deepEqual(W.testResults(d, g).map((x) => x.result && x.result.right), W.testResults(full, gf).map((x) => x.result && x.result.right));
  assert.deepEqual(W.fixups(d, g), W.fixups(full, gf));
  assert.equal(d.notes.length, 10, 'the week\'s sentences stay');
  assert.deepEqual(d.setup, full.setup);
});
test('U-size6: what each new field costs (TR-16)', (t) => {
  const setup = Su.setPeek(Su.setSbs(Su.setWay({}, 'sbs', 5, 'Mum').setup, { min: 15, big: 1, after: '16:00' }, 6, 'Mum'), 5, 7, 'Mum');
  const added = JSON.stringify({ way: setup.way, sbs: setup.sbs, peek: setup.peek }).length;
  assert.ok(added <= 200, 'setup fields ' + added + ' B (budget 200)');
  const eg = { id: 'r1a2b3c4d5e6f', w: 'night', d: '2026-11-24', g: 'r0123456789ab.1a2b3c', k: 'p', t: 0, p: 0, c: 1, s: 'g', lv: 2, r: 3, j: 'h', ss: 'k3x9qa', at: 1763900000000 };
  const withDoc = W.addTry(W.emptyDoc(), { id: eg.id, word: eg.w, day: eg.d, group: eg.g, kind: 'p', tries: 0, peeks: 0, clean: true, source: 'g', now: eg.at, lv: 2, r: 3, j: 'h', ss: 'k3x9qa' }).results[0];
  assert.deepEqual(withDoc, eg);
  t.diagnostic('a ladder try ' + JSON.stringify(eg).length + ' B; a slipping try with sl and rw ' + JSON.stringify({ ...eg, t: 2, sl: [3, 9], rw: 4 }).length + ' B; setup fields ' + added + ' B');
  assert.ok(JSON.stringify(eg).length <= 170, 'a ladder try ' + JSON.stringify(eg).length + ' B');
});
