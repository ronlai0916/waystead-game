import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { CODE, rungsFor, middleCode, unitsOf, gapsAt, traySpec, partOf, startCode, newWordRun, afterTry, replay } from '../site/js/ladder-doc.js';
import { fillableOf, tilesFor, seedOf } from '../site/js/tiles-doc.js';
import { RULES } from '../site/js/sbs-rules.js';

const e = (word, tricky) => ({ word, chunks: [word], ...(tricky ? { tricky } : {}) });
const WORDS = ['a', 'I', 'at', 'cat', 'knee', 'write', 'night', 'Monday', 'friend', 'because', 'beautiful', 'necessary', 'accommodate', 'extraordinary', 'unnecessarily'];

test('RULES is frozen', () => { assert.throws(() => { 'use strict'; RULES.rungs.maxMissing = 9; }); });

const ALL = CODE.ALL;
test('rungs: strict, one more letter each, up to letters - 1, then the whole word (D18, D20, D21)', () => {
  assert.deepEqual(rungsFor(e('a')), [0, 1, ALL]);
  assert.deepEqual(rungsFor(e('at')), [0, 1, 2, ALL]);
  assert.deepEqual(rungsFor(e('cat')), [0, 1, 2, 3, ALL]);
  assert.deepEqual(rungsFor(e('night')), [0, 1, 2, 3, 4, 5, ALL]);
  assert.deepEqual(rungsFor(e('because')), [0, 1, 2, 3, 4, 5, 6, 7, ALL]);
  assert.deepEqual(rungsFor(e('accommodate')), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, ALL]);
  for (let n = 1; n <= 16; n += 1) {
    const w = 'abcdefghijklmnop'.slice(0, n);
    const r = rungsFor(e(w));
    assert.equal(r.length, 2 + (n - 1) + 1, 'len ' + n);
    assert.equal(r[r.length - 1], ALL);
  }
  assert.equal(rungsFor.length, 1, 'no focus option');
});

test('ALL is 31, above every partial code; our word lists have no word over 30 letters', () => {
  assert.equal(CODE.ALL, 31);
  for (let n = 1; n <= 30; n += 1) {
    const r = rungsFor(e('abcdefghijklmnopqrstuvwxyzabcd'.slice(0, n)));
    assert.ok(r[r.length - 2] < CODE.ALL);
    assert.equal(r[r.length - 2], n === 1 ? 1 : n);
  }
  const words = [];
  const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (typeof o.word === 'string') words.push(o.word); Object.values(o).forEach(walk); } };
  walk(JSON.parse(readFileSync(new URL('../site/data/curriculum.json', import.meta.url), 'utf8')));
  assert.ok(words.length > 100);
  assert.ok(Math.max(...words.map((w) => [...w].length)) <= 30);
});

test('gap sets: nested, grow by exactly one letter, rung k hides k', () => {
  for (const w of WORDS) {
    const en = e(w);
    const rungs = rungsFor(en);
    let prev = [];
    for (const c of rungs.filter((x) => x >= 2 && x < ALL)) {
      const g = gapsAt(en, c, { day: '2026-11-24' });
      assert.equal(g.length, c - 1, `${w} rung ${c}`);
      assert.ok(prev.every((i) => g.includes(i)), `${w} nested`);
      prev = g;
    }
    const F = fillableOf(w);
    assert.deepEqual(gapsAt(en, 1), F);
    assert.deepEqual(gapsAt(en, ALL), F);
    assert.deepEqual(gapsAt(en, 0), []);
    if (F.length > 1) assert.ok(prev.length < F.length, 'last partial rung leaves a letter');
  }
});

test('hide order: sounded first, tricky one by one late, index 0 last', () => {
  const en = e('night'); // igh tricky: i g h at 1..3, n 0, t 4
  const order = unitsOf(en, { day: 'd' }).map((u) => u[0]);
  assert.equal(order[0], 4);                 // final consonant first
  assert.deepEqual(order.slice(1), [1, 2, 3, 0]); // then the tricky letters one by one, 0 last
  assert.ok(unitsOf(en, { day: 'd' }).every((u) => u.length === 1));
  const k = unitsOf(e('knee'), { day: 'd' }).map((u) => u[0]);
  assert.equal(k[k.length - 1], 0);           // silent k is index 0, last
  assert.equal(k[k.length - 2], 1);           // n, the rest of kn, just before
});

test('entry tricky overrides; capitals never hidden', () => {
  const en = e('friend', 'ie');
  const order = unitsOf(en, { day: 'x' }).map((u) => u[0]);
  assert.equal(order[order.length - 1], 0);
  assert.deepEqual(order.slice(-3, -1).sort(), [2, 3].sort());
  const mon = e('Monday');
  for (const c of [1, 2, 3, 4, 5, ALL]) assert.ok(c === 1 || c === ALL || !gapsAt(mon, c, { day: 'd' }).includes(0), 'M stays');
  assert.deepEqual(fillableOf('Monday'), [1, 2, 3, 4, 5]);
});

test('index 0 hidden only at R-all and the Copy rung (except as the lone last)', () => {
  for (const w of ['cat', 'because', 'beautiful', 'night']) {
    const en = e(w);
    const rungs = rungsFor(en);
    for (const c of rungs.filter((x) => x >= 2 && x < ALL)) assert.ok(!gapsAt(en, c, { day: 'd' }).includes(0), `${w} ${c}`);
  }
});

test('same word, same day, same gaps; another day may differ', () => {
  const en = e('beautiful');
  assert.deepEqual(gapsAt(en, 4, { day: '2026-11-24' }), gapsAt(en, 4, { day: '2026-11-24' }));
  const days = new Set();
  for (let d = 1; d <= 20; d += 1) days.add(gapsAt(en, 6, { day: '2026-11-' + String(d).padStart(2, '0') }).join());
  assert.ok(days.size > 1);
});

test('a usual slip spot is hidden exactly one rung earlier, never tricky or index 0', () => {
  const en = e('beautiful');
  const base = unitsOf(en, { day: 'd' }).map((u) => u[0]);
  const spot = base[3];
  const moved = unitsOf(en, { day: 'd' , usual: [spot] }).map((u) => u[0]);
  assert.equal(moved.indexOf(spot), base.indexOf(spot) - 1);
  // tricky and first letter do not move
  const n = e('night');
  const b2 = unitsOf(n, { day: 'd' }).map((u) => u[0]);
  assert.deepEqual(unitsOf(n, { day: 'd', usual: [2, 0] }).map((u) => u[0]), b2);
  // still strict
  for (const c of [2, 3, 4, 5]) assert.equal(gapsAt(en, c, { day: 'd', usual: [spot] }).length, c - 1);
});

test('middle rung', () => {
  assert.equal(middleCode(e('a')), ALL);
  assert.equal(middleCode(e('at')), 2);
  assert.equal(middleCode(e('cat')), 3);
  assert.equal(middleCode(e('night')), 4);
  assert.equal(middleCode(e('accommodate')), 7);
});

test('partOf', () => {
  assert.equal(partOf(e('night'), 2), 'igh');
  assert.equal(partOf(e('night'), 0), 'n');
  assert.equal(partOf(e('knee'), 1), 'kn');
});

test('tray per rung: model, glowAfter, distractor caps, no mirror letters', () => {
  const en = e('beautiful');
  const copy = traySpec(en, 1, { day: 'd' });
  assert.equal(copy.model, true);
  assert.equal(copy.tiles.length, copy.gaps.length);
  assert.equal(copy.glowAfter, 1);
  const low = traySpec(en, 3, { day: 'd' });
  assert.equal(low.glowAfter, 1);
  assert.ok(low.tiles.length - low.gaps.length <= 2);
  assert.equal(low.model, false);
  const mid = traySpec(en, middleCode(en), { day: 'd' });
  assert.equal(mid.glowAfter, 2);
  assert.ok(mid.tiles.length - mid.gaps.length <= 4);
  const all = traySpec(en, ALL, { day: 'd' });
  assert.equal(all.level, 4);
  assert.equal(all.glowAfter, 2);
  assert.equal(traySpec(en, 0, { day: 'd' }), null);
  const word = 'beautiful';
  for (const c of [1, 2, 3, 5, ALL]) {
    const sp = traySpec(en, c, { day: 'd2' });
    const own = new Set(word);
    for (const t of sp.tiles) {
      if ('bdpqnumw'.includes(t.ch)) {
        // a mirror letter may only be one the word itself needs
        assert.ok(own.has(t.ch) || sp.gaps.some((g) => sp.letters[g].ch === t.ch), 'mirror ' + t.ch);
      }
    }
  }
});

test('alts option: off skips sound-alike distractors', () => {
  const en = e('cinema');
  let on = 0; let off = 0;
  for (let s = 0; s < 200; s += 1) {
    const a = tilesFor(en, 3, s, { profile: 'sen', gaps: [0 + 1], extra: 3 });
    const b = tilesFor(en, 3, s, { profile: 'sen', gaps: [1], extra: 3, alts: false });
    const cnt = (sp) => sp.tiles.filter((t) => 'ey'.includes(t.ch)).length;
    on += cnt(a); off += cnt(b);
    assert.equal(a.tiles.length, 4); assert.equal(b.tiles.length, 4);
  }
  assert.ok(on > off);
});

test('extra: 0 and homophone/blocked guards still apply', () => {
  const sp = tilesFor(e('write'), 4, seedOf('write', 'd'), { profile: 'sen', extra: 0, lexicon: new Set(['right', 'write']) });
  assert.equal(sp.tiles.length, 5);
  const one = tilesFor(e('a'), 4, 1, { profile: 'sen', extra: 2 });
  assert.equal(one.tiles.length, 3);
});

test('one-letter words and capitals', () => {
  assert.deepEqual(rungsFor(e('I')), [0, 1, ALL]);
  assert.deepEqual(gapsAt(e('a'), ALL), [0]);
  const t = traySpec(e('accommodate'), 7, { day: 'd' });
  assert.equal(t.gaps.length, 6);
  const long = e('extraordinary');
  const t13 = traySpec(long, 13, { day: 'd' });
  assert.equal(t13.gaps.length, 12);
  assert.equal(t13.letters.filter((l) => !l.shown).length, 12);
});

// ---- state machine (D19)
const facts = (o = {}) => ({ best: 0, secure: false, metOn: '', days: [], lastSitting: null, ...o });
const go = (run, en, rungs, tries = 0, peeks = 0) => afterTry(run, { tries, peeks, entry: en }, rungs);

test('startCode (facts hold rung codes)', () => {
  const en = e('beautiful');
  assert.equal(startCode(null, en, {}), 0);
  assert.equal(startCode(facts(), en, {}), 0);
  assert.equal(startCode(facts({ best: 6, days: ['d'] }), en, {}), 5);
  assert.equal(startCode(facts({ best: 1, days: ['d'] }), en, {}), 1);
  assert.equal(startCode(facts({ best: ALL, secure: true, days: ['d'] }), en, {}), ALL);
  assert.equal(startCode(facts({ best: ALL, days: ['d'] }), en, {}), 9);
  assert.equal(startCode(facts({ best: 6, days: ['d'], lastSitting: { peekedEvery: true } }), en, {}), 4);
  assert.equal(startCode(facts({ best: 6, days: ['d'] }), en, { inRow: true }), 5);
  assert.equal(startCode(facts({ best: 3, days: ['d'] }), e('cat'), {}), 2);
});

test('clean tries climb every rung, nothing skipped, for lengths 1..16', () => {
  for (let n = 1; n <= 16; n += 1) {
    const en = e('abcdefghijklmnop'.slice(0, n));
    const rungs = rungsFor(en);
    let run = newWordRun(en, 1);
    const seen = [];
    while (!run.done) { seen.push(run.code); const r = go(run, en, rungs); assert.notEqual(r.next, 'skip'); run = r.run; }
    assert.deepEqual(seen, rungs.filter((r) => r >= 1));
    assert.equal(run.endedClean, true);
  }
});

test('a first go with one slip repeats once with the line; a clean repeat goes up', () => {
  const en = e('cat'); const rungs = rungsFor(en);
  let r = go(newWordRun(en, 2), en, rungs, 1);
  assert.deepEqual([r.next, r.line, r.run.code], ['repeat', 'Once more, then the next step.', 2]);
  r = go(r.run, en, rungs);
  assert.deepEqual([r.next, r.run.code], ['up', 3]);
  assert.deepEqual(r.run.passed, [2]);
});

test('a Peek alone on a first go repeats with no line and is not a slip', () => {
  const en = e('cat'); const rungs = rungsFor(en);
  const r = go(newWordRun(en, 2), en, rungs, 0, 1);
  assert.deepEqual([r.next, r.line, r.run.code, r.run.slipRungs], ['repeat', '', 2, []]);
});

test('D22: a repeat that is not clean goes back one rung EVERY time; there is no park', () => {
  const en = e('beautiful'); const rungs = rungsFor(en);
  let r = go(newWordRun(en, 6), en, rungs, 1);     // first go slip -> repeat
  assert.equal(r.next, 'repeat');
  r = go(r.run, en, rungs, 1);                      // repeat slip -> back
  assert.deepEqual([r.next, r.run.code, r.line], ['back', 5, "Let's warm up with this one."]);
  assert.equal(r.park, undefined);
  r = go(r.run, en, rungs, 0, 1);                   // fresh first go at 5: Peek alone -> repeat
  assert.equal(r.next, 'repeat');
  r = go(r.run, en, rungs, 0, 1);                   // Peek on the repeat -> back again
  assert.deepEqual([r.next, r.run.code], ['back', 4]);
  for (let i = 0; i < 40; i += 1) assert.notEqual((r = go(r.run, en, rungs, 1)).next, 'park');
  assert.ok(r.run.code >= 1 && !r.run.done);
});

test('at Copy a try that is not clean repeats Copy; a clean Copy climbs again', () => {
  const en = e('cat'); const rungs = rungsFor(en);
  let r = go(newWordRun(en, 1), en, rungs, 1);
  assert.deepEqual([r.next, r.run.code], ['repeat', 1]);
  r = go(r.run, en, rungs, 2);
  assert.deepEqual([r.next, r.run.code], ['repeat', 1]);
  r = go(r.run, en, rungs, 0, 1);
  assert.deepEqual([r.next, r.run.code], ['repeat', 1]);
  r = go(r.run, en, rungs);
  assert.deepEqual([r.next, r.run.code], ['up', 2]);
});

test('2 slips on a first go go back every time (never below Copy)', () => {
  const en = e('beautiful'); const rungs = rungsFor(en);
  let r = go(newWordRun(en, 5), en, rungs, 2);
  assert.deepEqual([r.next, r.run.code], ['back', 4]);
  r = go(r.run, en, rungs, 2);
  assert.deepEqual([r.next, r.run.code], ['back', 3]);
});

test('a secure word that slips at the whole word drops to the middle rung', () => {
  const en = e('beautiful'); const rungs = rungsFor(en);
  const r = go(newWordRun(en, ALL), en, rungs, 1);
  assert.deepEqual([r.next, r.run.code], ['back', middleCode(en)]);
});

test('whole word: never done unless clean; a repeat that is not clean goes back', () => {
  const en = e('cat'); const rungs = rungsFor(en);
  let r = go(newWordRun(en, 3), en, rungs);
  assert.deepEqual([r.next, r.run.code], ['up', ALL]);
  const clean = go(r.run, en, rungs);
  assert.equal(clean.next, 'done');
  assert.ok(clean.run.passed.includes(ALL));
  const s = go(r.run, en, rungs, 1);
  assert.equal(s.next, 'repeat');
  const d = go(s.run, en, rungs, 1);
  assert.deepEqual([d.next, d.run.code, d.run.done], ['back', 3, false]);
});

test('startCode resumes a word in progress at its exact step', () => {
  const en = e('beautiful');
  assert.equal(startCode(facts({ best: 8, days: ['d'] }), en, { resumeAt: 4 }), 4);
  assert.equal(startCode(null, en, { resumeAt: 1 }), 1);
  assert.equal(startCode(facts({ best: 6, days: ['d'], lastSitting: { parkedAt: 5 } }), en, {}), 5); // parkedAt is ignored
});

test('replay rebuilds the run', () => {
  const en = e('cat'); const rungs = rungsFor(en);
  const run = replay([{ t: 0, p: 0 }, { t: 1, p: 0 }], en, rungs, 1);
  assert.equal(run.code, 2); assert.equal(run.repeat, true);
  assert.ok(replay([{ t: 0 }, { t: 0 }, { t: 0 }, { t: 0 }], en, rungs, 1).done);
});

test('RULES keys WP-1b reads', () => {
  assert.equal(RULES.session.closeTries, 2);
  assert.equal(RULES.session.mendExtra, 2);
  assert.equal(RULES.session.noYearWords, 3);
  assert.equal(RULES.est.fixedMeanings, 1);
  assert.equal(RULES.est.sentencesPerSitting, 2);
  assert.ok(Object.isFrozen(RULES.session) && Object.isFrozen(RULES.est));
});

test('D25: stuck is flagged on the try of the 3rd step-back in a sitting, and only then', () => {
  assert.deepEqual(RULES.stuck, { backs: 3 });
  assert.ok(Object.isFrozen(RULES.stuck));
  const en = e('beautiful'); const rungs = rungsFor(en);
  let r = go(newWordRun(en, 8), en, rungs, 2);
  assert.deepEqual([r.next, r.stuck], ['back', undefined]);
  r = go(r.run, en, rungs, 2);
  assert.deepEqual([r.next, r.stuck, r.run.backs], ['back', undefined, 2]);
  r = go(r.run, en, rungs, 2);
  assert.deepEqual([r.next, r.stuck, r.run.backs], ['back', true, 3]);
  r = go(r.run, en, rungs, 2);
  assert.equal(r.stuck, undefined); // flagged once
  assert.equal(go(newWordRun(en, 3), en, rungs).stuck, undefined);
});

test('RULES keys for the session and the estimate (D25)', () => {
  assert.equal(RULES.session.maxItems, 200);
  assert.equal(RULES.lines.stuck, 'This word is tricky today. Ask your grown-up.');
  assert.equal(RULES.lines.endCalm, "That's all for today. See you next time.");
  assert.equal(RULES.est.rowTriesLow, 2);
  assert.equal(RULES.est.rowTriesHigh, 1.2);
  assert.equal(RULES.session.stuckBacks, undefined);
  assert.equal(RULES.rows.parkPass, undefined);
  assert.ok(Object.isFrozen(RULES.lines) && Object.isFrozen(RULES.rows));
});

test('no parking key in the break offer', () => {
  assert.equal(RULES.session.breakOffer.afterPark, undefined);
  assert.deepEqual(RULES.session.breakOffer, { everyWords: 2, afterMs: 480000 });
});
