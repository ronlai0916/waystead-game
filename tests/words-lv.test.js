// SB4 words value: `setup` and `own` fields, tile-help tries, honest remembered, folds with ERA/RECALL.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W from '../site/js/words-doc.js';
import * as Su from '../site/js/setup-doc.js';
import * as Ow from '../site/js/own-doc.js';

const MON = '2026-11-02';
const at = (day, h = 12) => Date.parse(day + 'T' + String(h).padStart(2, '0') + ':00:00Z');
let n = 0;
const id = () => 't' + (++n);
function made(words = ['fruit', 'earth', 'heart', 'bread', 'group'], today = MON) {
  const r = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week', test: W.addDays(today, 7), words, today, now: at(today) });
  return { d: r.doc, g: W.groupById(r.doc, 'g1') };
}
const tr = (d, g, word, day, o = {}) => W.addTry(d, { id: id(), word, day, group: g.id, kind: 'p', tries: 0, peeks: 0, clean: true, now: at(day, o.hour || 12) + n, ...o });
const setupWith = (d) => W.withOwn(W.withSetup(d, Su.setHelp(Su.setProfile({}, 'sen', 1000, 'Sam'), 2, 1000)), Ow.set({}, 'o1', { name: 'Mine', words: ['cat'], src: 'typed', to: ['k1'] }, 1000).own);
const rememberedWith = (extra) => {
  const { d, g } = made(['fruit']);
  let x = d;
  for (const day of [MON, W.addDays(MON, 3), W.addDays(MON, 7)]) x = tr(x, g, 'fruit', day, extra);
  return W.isRemembered(x, 'fruit');
};

test('setup and own survive normalise, and a doc without them is unchanged', () => {
  const { d } = made();
  const plain = W.normalise(JSON.parse(JSON.stringify(d)));
  assert.equal('setup' in plain, false);
  assert.equal('own' in plain, false);
  assert.equal(JSON.stringify(W.normalise(plain)), JSON.stringify(plain), 'byte-identical');
  assert.deepEqual(Object.keys(W.emptyDoc()), ['v', 'resetAt', 'groups', 'results', 'folded', 'steps', 'clues', 'notes', 'skips']);
  const s = setupWith(d);
  const back = W.normalise(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.setup, s.setup);
  assert.deepEqual(back.own, s.own);
  const bad = W.normalise({ ...d, setup: { help: { lv: 9, at: 1 } }, own: { x: { name: '', words: [], at: 1 } } });
  assert.equal('setup' in bad, false);
  assert.equal('own' in bad, false);
  assert.deepEqual(W.setupOf(plain), {});
  assert.deepEqual(W.ownOf(plain), {});
  assert.equal('setup' in W.withSetup(s, {}), false);
  assert.equal('own' in W.withOwn(s, {}), false);
});

test('merge keeps setup and own, both directions and against a doc without them; reset keeps them', () => {
  const { d } = made();
  const s = setupWith(d);
  for (const [a, b] of [[s, d], [d, s], [s, s]]) {
    const m = W.merge(a, b);
    assert.deepEqual(m.setup, s.setup);
    assert.deepEqual(m.own, s.own);
  }
  const newer = W.withSetup(s, Su.setHelp(s.setup, 4, 5000));
  assert.equal(W.merge(s, newer).setup.help.lv, 4);
  assert.equal(W.merge(newer, s).setup.help.lv, 4);
  assert.equal(W.merge(s, { ...d, resetAt: 99999999999999 }).setup.help.lv, 2, 'a reset time never clears it');
  const r = W.reset(at(MON), W.setWeekPick(s, false, 5));
  assert.deepEqual(r.setup, s.setup);
  assert.deepEqual(r.own, s.own);
  assert.equal(r.weekPick.on, false);
  assert.equal('setup' in W.reset(5, d), false);
});

test('an old app drops the fields; merging with a new copy gets them back', () => {
  const { d } = made();
  const s = setupWith(d);
  const old = { ...s };
  delete old.setup;
  delete old.own;
  const oldSaved = W.merge(old, old); // what an old app would send up
  assert.equal('setup' in oldSaved, false);
  const m = W.merge(oldSaved, s);
  assert.deepEqual(m.setup, s.setup);
  assert.deepEqual(m.own, s.own);
  assert.deepEqual(W.merge(s, oldSaved).setup, s.setup);
});

test('trim of a 60 KB doc keeps setup and own, and trims their old deleted entries', () => {
  const { d, g } = made();
  let x = setupWith(d);
  const now = at(MON) + 200 * 86400000;
  x = W.withSetup(x, Su.dropOwnCopy(Su.setOwnCopy(x.setup, 'old', { name: 'Old', words: ['cat'], src: 'typed' }, 5).setup, 'old', 10));
  x = W.withOwn(x, Ow.drop(Ow.set(x.own, 'oldm', { name: 'Old', words: ['cat'], src: 'typed', to: [] }, 5).own, 'oldm', 10));
  for (let i = 0; i < 700; i += 1) x = tr(x, g, g.words[i % 5], W.addDays(MON, i % 6), { hour: (i % 20) + 1 });
  assert.ok(W.sizeOf(x) > 60 * 1024, 'size ' + W.sizeOf(x));
  const t = W.trim(x, now);
  assert.ok(W.sizeOf(t) <= W.TRIM_TO + 2048);
  assert.equal(t.setup.help.lv, 2);
  assert.ok('o1' in t.own);
  assert.equal('old' in (t.setup.own || {}), false, 'the old deleted copy went');
  assert.equal('oldm' in t.own, false);
  assert.deepEqual(t.setup.profile, x.setup.profile);
  assert.equal('setup' in W.trim(made().d, now), false);
});

test('try fields: lv, h, hn, hr, pf are kept, never undefined or 0', () => {
  const { d, g } = made();
  const plain = tr(d, g, 'fruit', MON).results[0];
  for (const k of ['lv', 'h', 'hn', 'hr', 'pf']) assert.equal(k in plain, false);
  const zero = W.addTry(d, { id: 'z', word: 'fruit', day: MON, group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, now: at(MON), lv: undefined, h: 0, hn: 0, hr: 0, pf: undefined }).results[0];
  assert.deepEqual(Object.keys(zero).sort(), Object.keys(plain).sort());
  const full = W.addTry(d, { id: 'f', word: 'fruit', day: MON, group: 'g1', kind: 't', tries: 0, peeks: 0, clean: true, now: at(MON), lv: 3, h: 1, hn: 2, hr: 4, pf: 'sen' }).results[0];
  assert.deepEqual([full.lv, full.h, full.hn, full.hr, full.pf], [3, 1, 2, 4, 'sen']);
  assert.equal(W.addTry(d, { id: 'p', word: 'fruit', day: MON, group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, now: at(MON), pf: 'top' }).results[0].pf, undefined, 'pf is for tests only');
  const kept = W.normalise(JSON.parse(JSON.stringify(W.addTry(d, { id: 'f', word: 'fruit', day: MON, group: 'g1', kind: 't', tries: 0, peeks: 0, clean: true, now: at(MON), lv: 3, h: 1, hn: 2, hr: 4, pf: 'top' }))));
  assert.equal(kept.results[0].lv, 3);
  assert.equal(kept.results[0].pf, 'top');
  assert.equal(W.merge(kept, kept).results[0].hr, 4);
});

test('tile level 1 to 3 never makes remembered; 4 and absent do; h and hn are assisted', () => {
  assert.equal(rememberedWith({}), true, 'absent');
  assert.equal(rememberedWith({ lv: 4 }), true);
  for (const lv of [1, 2, 3]) assert.equal(rememberedWith({ lv }), false, 'level ' + lv);
  assert.equal(rememberedWith({ h: 1 }), false);
  assert.equal(rememberedWith({ hn: 1 }), false);
  assert.equal(rememberedWith({ hr: 3 }), true, 'hears are not help');
  assert.equal(W.assisted({}), false);
  assert.equal(W.assisted({ lv: 4 }), false);
  assert.equal(W.assisted({ lv: 1 }), true);
  assert.equal(W.assisted({ h: 1 }), true);
  assert.equal(W.assisted({ hn: 2 }), true);
  assert.equal(W.recall({ c: 1, t: 0, p: 0, lv: 2 }), false);
  assert.equal(W.recall({ c: 1, t: 0, p: 0 }), true);
});

test('a right test answer counts towards remembered only when unassisted', () => {
  const run = (extra) => {
    const { d, g } = made(['fruit']);
    let x = d;
    x = tr(x, g, 'fruit', MON, { kind: 'p', clean: false, tries: 1 });
    x = tr(x, g, 'fruit', W.addDays(MON, 3), { kind: 'p', clean: false, tries: 1 });
    x = tr(x, g, 'fruit', W.addDays(MON, 7), { kind: 't', ...extra });
    return W.isRemembered(x, 'fruit');
  };
  // only the test day is good; 3 good days are needed, so check the day map instead
  const days = (extra) => {
    const { d, g } = made(['fruit']);
    return W.goodDays(tr(d, g, 'fruit', W.addDays(MON, 7), { kind: 't', ...extra }), 'fruit');
  };
  assert.equal(run({}), false);
  assert.equal(days({}).length, 1);
  assert.equal(days({ lv: 2 }).length, 0);
  assert.equal(days({ hn: 1 }).length, 0);
  assert.equal(days({ lv: 4 }).length, 1);
});

test('dots, ROW, stars, jobs and test results are the same with and without lv', () => {
  const build = (extra) => {
    const { d, g } = made();
    let x = d;
    for (const w of g.words) for (let i = 0; i < 3; i += 1) x = tr(x, g, w, MON, extra);
    x = tr(x, g, 'fruit', W.addDays(MON, 7), { kind: 't', ...extra });
    return { x, g };
  };
  const a = build({});
  const b = build({ lv: 2, h: 1, hn: 1 });
  const snap = ({ x, g }) => JSON.stringify([
    W.allDots(x, g, MON), W.starsOn(x, g, MON), W.jobLeft(x, g, MON, 'p'), W.sessionDone(x, g, 'fruit', MON, 'p'), W.sessionCount(x, g, 'earth', MON, 'p'),
    W.readyForTest(x, g), W.roundDay(x, g, 'p'), W.testResults(x, g), W.jobFor(x, g, W.addDays(MON, 8)), W.fixups(x, g),
  ]);
  assert.equal(snap(a), snap(b));
  assert.equal(W.allDots(b.x, b.g, MON)[0].dots, 3);
  assert.equal(W.starsOn(b.x, b.g, MON), 5);
  assert.equal(W.overall(b.x).remembered, 0);
});

test('Independent % counts only recall first goes', () => {
  const { d, g } = made();
  let x = tr(d, g, 'fruit', MON);
  x = tr(x, g, 'earth', MON, { lv: 2 });
  x = tr(x, g, 'heart', MON, { hn: 1 });
  x = tr(x, g, 'bread', MON, { lv: 4 });
  const o = W.overall(x);
  assert.equal(o.firstGoes, 4);
  assert.equal(o.clean, 2);
  assert.equal(o.independent, 50);
});

function bigDoc(extra) {
  const { d, g } = made(['fruit']);
  let x = d;
  const days = [MON, W.addDays(MON, 3), W.addDays(MON, 7)];
  days.forEach((day, i) => { x = tr(x, g, 'fruit', day, i === 2 ? { kind: 't', ...extra } : extra); });
  for (let i = 0; i < 800; i += 1) x = tr(x, g, 'fruit', W.addDays(MON, i % 3), { hour: 13 + (i % 10), clean: false, tries: 1 });
  return { x, g };
}

test('folding keeps remembered: new folds carry ERA and RECALL, assisted days stay out', () => {
  for (const [extra, want] of [[{}, true], [{ lv: 4 }, true], [{ lv: 2 }, false], [{ hn: 1 }, false]]) {
    const { x } = bigDoc(extra);
    const before = W.isRemembered(x, 'fruit');
    const t = W.trim(x, at(MON) + 86400000);
    assert.ok(Object.keys(t.folded).length > 0 && t.results.length < x.results.length, 'folded');
    assert.equal(before, want, 'before ' + JSON.stringify(extra));
    assert.equal(W.isRemembered(t, 'fruit'), want, 'after folding ' + JSON.stringify(extra));
    assert.equal(W.isRemembered(W.merge(t, x), 'fruit'), want);
  }
  const { x } = bigDoc({});
  const flags = Object.values(W.trim(x, at(MON)).folded['g1|fruit'].days);
  assert.ok(flags.every((f) => f & 32768), 'ERA set on every folded day');
  assert.ok(flags.some((f) => f & 16384), 'RECALL set on a clean first day');
});

test('a fold written before this release counts exactly as before', () => {
  const { d } = made(['fruit']);
  const day = (i) => W.addDays(MON, i);
  const old = { ...d, folded: { 'g1|fruit': { n: 9, t: 0, p: 0, through: at(day(7)), days: { [day(0)]: 1 | 2 | 1024, [day(3)]: 1 | 2 | 1024, [day(7)]: 2 | 4 | 1024 } } } };
  assert.equal(W.isRemembered(old, 'fruit'), true, 'FIRST, FIRST, TEST_RIGHT');
  const wrong = { ...d, folded: { 'g1|fruit': { n: 9, t: 0, p: 0, through: at(day(7)), days: { [day(0)]: 2 | 1024, [day(3)]: 1 | 2 | 1024, [day(7)]: 2 | 1024 } } } };
  assert.equal(W.isRemembered(wrong, 'fruit'), false);
  const era = { ...d, folded: { 'g1|fruit': { n: 9, t: 0, p: 0, through: at(day(7)), days: { [day(0)]: 32768 | 1 | 2 | 1024, [day(3)]: 32768 | 1 | 2 | 1024, [day(7)]: 32768 | 1 | 2 | 1024 } } } };
  assert.equal(W.isRemembered(era, 'fruit'), false, 'an ERA day without RECALL does not count');
  assert.equal(W.isRemembered({ ...era, folded: { 'g1|fruit': { ...era.folded['g1|fruit'], days: Object.fromEntries(Object.entries(era.folded['g1|fruit'].days).map(([k, v]) => [k, v | 16384])) } } }, 'fruit'), true);
  // a new clean try on a day an old fold already held keeps that day counting
  const g = W.groupById(old, 'g1');
  const more = tr(old, g, 'fruit', day(0));
  assert.equal(W.isRemembered(more, 'fruit'), true);
  // trim keeps the new bits as it keeps ROW_BITS
  const t = W.trim(bigDoc({}).x, at(MON));
  assert.ok(Object.values(t.folded['g1|fruit'].days).some((f) => f & 16384));
});

test('helpOf', () => {
  const { d, g } = made(['fruit', 'earth']);
  let x = tr(d, g, 'fruit', MON);
  assert.deepEqual(W.helpOf(x, g, 'fruit'), { minLv: 5, helped: 0, hints: 0, hears: 0 });
  x = tr(x, g, 'fruit', MON, { lv: 3, h: 1, hn: 2, hr: 1 });
  x = tr(x, g, 'fruit', MON, { lv: 1, hn: 1, hr: 4 });
  x = tr(x, g, 'earth', MON, { lv: 1 });
  assert.deepEqual(W.helpOf(x, g, 'fruit'), { minLv: 1, helped: 1, hints: 3, hears: 5 });
  assert.equal(W.helpOf(x, g, 'earth').minLv, 1);
  assert.deepEqual(W.helpOf(d, g, 'earth'), { minLv: 5, helped: 0, hints: 0, hears: 0 });
});

test('levelReady at 79% and 80%', () => {
  const words = Array.from({ length: 100 }, (_, i) => 'w' + String.fromCharCode(97 + (i % 26)) + String.fromCharCode(97 + Math.floor(i / 26)));
  const g = { id: 'g1', words };
  const build = (count, lv, extra = {}) => {
    let x = W.emptyDoc();
    for (const w of words.slice(0, count)) for (let i = 0; i < 3; i += 1) x = tr(x, g, w, MON, { lv, ...extra });
    return x;
  };
  assert.equal(W.levelReady(build(79, 2), g, 2), false);
  assert.equal(W.levelReady(build(80, 2), g, 2), true);
  assert.equal(W.levelReady(build(80, 2), g, 3), false, 'a different level');
  assert.equal(W.levelReady(build(80, 2, { peeks: 1 }), g, 2), false, 'peeks are not unaided');
  assert.equal(W.levelReady(build(80, undefined), g, 5), true, 'absent counts as 5');
  // 2 in a row then a different level breaks the run
  let x = W.emptyDoc();
  for (const w of words) { x = tr(x, g, w, MON, { lv: 2 }); x = tr(x, g, w, MON, { lv: 2 }); x = tr(x, g, w, MON, { lv: 3 }); }
  assert.equal(W.levelReady(x, g, 2), false);
  assert.equal(W.levelReady(W.emptyDoc(), { id: 'g1', words: [] }, 2), false);
});

test('merging an old fold with a newer fold or a late try keeps what the old day counted', () => {
  const { d, g } = made(['fruit']);
  const day = (i) => W.addDays(MON, i);
  const oldFold = { 'g1|fruit': { n: 9, t: 0, p: 0, through: at(day(7), 23), days: { [day(0)]: 1 | 2 | 1024, [day(3)]: 1 | 2 | 1024, [day(7)]: 2 | 4 | 1024 } } };
  const old = { ...d, folded: oldFold };
  const late = tr(d, g, 'fruit', day(3), { lv: 2, hour: 9 }); // inside the fold's time: absorbed
  const m = W.merge(old, late);
  assert.equal(m.results.length, 0, 'absorbed into the fold');
  assert.equal(W.isRemembered(m, 'fruit'), true);
  const newFold = { 'g1|fruit': { n: 2, t: 0, p: 0, through: at(day(8)), days: { [day(0)]: 32768 | 1024 | 2, [day(3)]: 32768 | 1024 | 2 } } };
  const m2 = W.merge(old, { ...d, folded: newFold });
  assert.equal(W.isRemembered(m2, 'fruit'), true, 'the old days still count after meeting a newer fold');
});
