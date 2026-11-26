// SB6 WP-2 (TRS TR-14, TR-91 part 1): I-old-device. A frozen copy of the SB5 (23b, git ddd433d) words-doc.js and setup-doc.js
// (tests/fixtures/sb5/) opens SB6 data and saves it again, the way an un-updated device does; then an SB6 device merges.
// This shows which fields SURVIVE an old device and which are LOST and come back on the next SB6 sync (self-heal).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as W6 from '../site/js/words-doc.js';
import * as S6 from '../site/js/setup-doc.js';
import * as W5 from './fixtures/sb5/words-doc.js';
import * as S5 from './fixtures/sb5/setup-doc.js';

const DAY = '2026-11-24';
const TEST_DAY = '2026-12-01';
const WORDS = ['night', 'light', 'fight', 'sight'];
let n = 0;
const T = (d, o) => { n += 1; return W6.addTry(d, { id: 'o' + String(n).padStart(5, '0'), group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, day: DAY, now: 5000 + n, source: 'g', ...o }); };

/** An SB6 child's value: setup with way/sbs/peek, a focus week, ladder tries, notes, sitting and rows marks, and fields from a future release. */
function sb6Value() {
  let d = W6.createGroup(W6.emptyDoc(), { id: 'g1', name: 'Week', test: TEST_DAY, words: WORDS, today: DAY, now: 1000 }).doc;
  let su = S6.setPeek(S6.setSbs(S6.setWay({}, 'sbs', 1100, 'Mum').setup, { min: 15, big: 1, after: '16:00' }, 1200), 5, 1300);
  su = { ...su, zz: { at: 1400, future: true } };
  d = W6.withSetup(d, su);
  d = { ...d, groups: { g1: { ...d.groups.g1, zz: { future: 1 }, focus: ['night', 'light'] } }, zz: { at: 9, future: 'top' } };
  d = T(d, { word: 'night', r: 1, lv: 1, j: 'f', ss: 'k3x9qa', day: '2026-11-23' });
  d = T(d, { word: 'night', r: 4, lv: 3, j: 'f', ss: 'k3x9qa', day: '2026-11-23', tries: 1, sl: [3, 5] });
  d.results[d.results.length - 1].pk = 1; // a field from an earlier build (D22: tolerated, never acted on)
  d = T(d, { word: 'night', r: W6.ALL_RUNG, j: 'f', ss: 'k3x9qa', day: DAY, rw: 3 });
  d = T(d, { word: 'light', r: 6, lv: 3, j: 'w', ss: 'p0p0p0', day: DAY, rw: 2, peeks: 1, clean: true });
  d = W6.addNote(d, { id: 'n1', group: 'g1', word: 'night', text: 'The night is long.', day: DAY, now: 6000, bl: 3, hp: 1 });
  const g = W6.groupById(d, 'g1');
  for (const k of ['se:k3x9qa', 'rw:2', 'rw:2:0', 'practice']) d = W6.markStep(d, g, k, DAY, 7000);
  return W6.normalise(d); // the form a device saves
}
const json = (x) => JSON.stringify(x);
const SB6_ONLY_SETUP = ['way', 'sbs', 'peek', 'zz'];

test('the SB5 fixture is the 23b release and the SB6 files are not it', () => {
  assert.equal(typeof W5.normalise, 'function');
  assert.equal(W5.ladderFacts, undefined, 'SB5 has no ladderFacts');
  assert.equal(W5.focusOf, undefined);
  assert.equal(S5.wayOf, undefined);
  assert.equal(typeof W6.ladderFacts, 'function');
});

test('what an SB5 device KEEPS when it re-saves an SB6 value: every try field, notes, steps keys, folded days (TR-12)', () => {
  const v6 = sb6Value();
  const v5 = W5.normalise(JSON.parse(json(v6)));
  assert.equal(json(v5.results), json(v6.results), 'every try, every SB6 field on it (r, j, ss, sl, rw), untouched');
  assert.ok(v5.results.some((r) => r.r === 4 && r.j === 'f' && r.ss === 'k3x9qa' && r.sl.join() === '3,5' && r.pk === 1) && v5.results.some((r) => r.rw === 2));
  assert.equal(json(v5.notes), json(v6.notes));
  assert.deepEqual(v5.notes[0].bl, 3);
  assert.equal(json(v5.steps), json(v6.steps), 'the se:, rw: and practice marks stay');
  // the grown-up's profile is a field SB5 knows: kept
  assert.equal(json(v5.setup.profile), json(v6.setup.profile));
});
test('what an SB5 device LOSES: way, sbs, peek (setup), focus and unknown fields (group, setup, top level) (E-TRS-1)', () => {
  const v6 = sb6Value();
  const v5 = W5.normalise(JSON.parse(json(v6)));
  for (const f of SB6_ONLY_SETUP) assert.ok(!(f in v5.setup), f + ' is dropped by SB5');
  assert.ok(!('focus' in v5.groups.g1));
  assert.ok(!('zz' in v5.groups.g1));
  assert.ok(!('zz' in v5));
  assert.deepEqual(v5.groups.g1.words, WORDS, 'the week itself is intact');
  assert.equal(v5.groups.g1.at, v6.groups.g1.at, 'SB5 does not change the group\'s at when it only re-saves');
  // the SB5 setup module on its own
  const s5 = S5.normalise(v6.setup);
  assert.deepEqual(Object.keys(s5).sort(), ['by', 'profile'].filter((k) => k in v6.setup).sort());
  assert.deepEqual(s5.profile, v6.setup.profile);
});
test('SELF-HEAL: the first SB6 device that syncs puts every field back (the pull merges the device copy with the account copy) (TR-14)', () => {
  const v6 = sb6Value();
  const accountCopy = W5.normalise(JSON.parse(json(v6))); // what an SB5 device wrote to the account
  for (const [a, b] of [[v6, accountCopy], [accountCopy, v6]]) {
    const m = W6.merge(a, b);
    assert.equal(json(m.setup), json(v6.setup), 'way, sbs, peek and the unknown setup field are back');
    assert.deepEqual(m.groups.g1.focus, ['night', 'light'], 'a `focus` field of an earlier build is just an unknown group field: kept and healed');
    assert.deepEqual(m.groups.g1.zz, { future: 1 });
    assert.deepEqual(m.zz, { at: 9, future: 'top' });
    assert.equal(json(m.results), json(v6.results));
    assert.equal(json(m.notes), json(v6.notes));
    assert.equal(json(m.steps), json(v6.steps));
    assert.equal(json(W6.normalise(m)), json(m), 'and it is stable');
  }
  // sync.pull marks the key dirty when the merge differs from the account copy, so the healed value is pushed back
  assert.notEqual(json(W6.merge(v6, accountCopy)), json(accountCopy));
  // once healed, an SB5 device that re-saves again loses them again, and the next SB6 sync restores them again: no state is ever lost for good
  assert.equal(json(W6.merge(v6, W5.normalise(JSON.parse(json(W6.merge(v6, accountCopy)))))), json(W6.merge(v6, accountCopy)));
});
test('an SB5 merge of two SB6 copies keeps the tries of both (by id) and the steps; the settings follow the SB6 rules (TR-14)', () => {
  const a = sb6Value();
  let b = JSON.parse(json(a));
  b = T(b, { word: 'sight', r: 2, lv: 2, j: 'f', ss: 'zzzzzz' });
  const m5 = W5.merge(a, b);
  assert.equal(m5.results.length, a.results.length + 1);
  assert.ok(m5.results.every((r) => r.id));
  assert.equal(json(m5.results.find((r) => r.ss === 'zzzzzz')), json(b.results.at(-1)));
  assert.equal(json(m5.steps), json(a.steps));
});
test('an SB5 device that EDITS the week wins with its newer copy: unknown group fields are gone (D21: nothing acts on focus)', () => {
  const v6 = sb6Value();
  const edited5 = W5.editGroup(W5.normalise(JSON.parse(json(v6))), 'g1', { name: 'Renamed' }, DAY, 99999).doc;
  const m = W6.merge(v6, edited5);
  assert.equal(m.groups.g1.name, 'Renamed');
  assert.ok(!('focus' in m.groups.g1));
  assert.equal(W6.focusOf, undefined, 'D21: no focus words');
  assert.equal(json(m.setup), json(v6.setup), 'but the setup still heals (it is merged field by field)');
});
test('an SB5 trim keeps the SB6 step marks and tries; an SB5 fold of SB6 tries reads on SB6 by what the fold holds (TR-12, R-4)', () => {
  let d = sb6Value();
  // pad the value past 48 KB with older ladder tries so SB5 folds
  for (let i = 0; i < 420; i += 1) d = T(d, { word: WORDS[i % 4], day: '2026-11-' + String(10 + (i % 12)), r: 2 + (i % 6), lv: 2, j: 'w', ss: 'abcdef', sl: [i % 9], rw: 3, tries: 1 });
  assert.ok(W5.sizeOf(d) > W5.TRIM_AT);
  const t5 = W5.trim(JSON.parse(json(d)), 9e12);
  assert.ok(t5.results.length < d.results.length, 'SB5 folded');
  assert.deepEqual(Object.keys(t5.steps).sort(), Object.keys(d.steps).sort(), 'every sitting, rows and practice mark survives an SB5 trim');
  assert.deepEqual(t5.notes, d.notes);
  assert.deepEqual(Object.keys(t5.folded).filter((k) => k.startsWith('g1|')).length > 0, true);
  // a fold made by SB5 and one made by SB6 join (OR) without losing the SB6 bits
  const t6 = W6.trim(JSON.parse(json(d)), 9e12);
  const merged = W6.merge(t5, t6);
  for (const w of WORDS) assert.ok(W6.ladderFacts(merged, w, DAY).best >= W6.ladderFacts(t6, w, DAY).best, w);
  assert.equal(json(Object.keys(merged.steps).sort()), json(Object.keys(d.steps).sort()));
});
test('the days an SB5 device folds have no rung bits: SB6 reads them by the old flags, one rung lower, never higher (TR-12, R-4)', () => {
  let d = W6.createGroup(W6.emptyDoc(), { id: 'g1', test: TEST_DAY, words: ['night', 'light'], today: DAY, now: 1 }).doc;
  d = T(d, { word: 'night', r: 1, lv: 1, j: 'f', ss: 'abcdef', day: '2026-11-10' });
  d = T(d, { word: 'night', r: 4, lv: 3, j: 'f', ss: 'abcdef', day: '2026-11-10' });
  d = T(d, { word: 'night', r: 5, lv: 3, j: 'f', ss: 'abcdef', day: '2026-11-12' });
  d = T(d, { word: 'night', r: W6.ALL_RUNG, j: 'f', ss: 'abcdef', day: '2026-11-13' }); // R-all, first go: RECALL
  for (let i = 0; i < 600; i += 1) d = T(d, { word: 'light', r: 3, lv: 2, j: 'w', ss: 'abcdef', day: '2026-11-2' + (i % 4), tries: 1, sl: [1] });
  const t5 = W5.trim(JSON.parse(json(d)), 9e12);
  const t6 = W6.trim(JSON.parse(json(d)), 9e12);
  assert.ok(!t5.results.some((r) => r.w === 'night') && !t6.results.some((r) => r.w === 'night'), 'night is folded on both');
  const bits = (t, day) => t.folded['g1|night'].days[day];
  assert.equal(bits(t5, '2026-11-10') >> 16, 0, 'the SB5 fold has no rung bits');
  assert.ok(bits(t6, '2026-11-10') >> 16 > 0, 'the SB6 fold has them');
  const only = (day) => ({ ...t5, folded: { 'g1|night': { ...t5.folded['g1|night'], days: { [day]: t5.folded['g1|night'].days[day] } } } });
  assert.equal(W6.ladderFacts(only('2026-11-10'), 'night', DAY).best, 1, 'SB6 knew rung 4; the SB5 fold reads rung 1');
  assert.equal(W6.ladderFacts({ ...t6, folded: { 'g1|night': { ...t6.folded['g1|night'], days: { '2026-11-10': bits(t6, '2026-11-10') } } } }, 'night', DAY).best, 4);
  assert.equal(W6.ladderFacts(only('2026-11-12'), 'night', DAY).best, 1);
  assert.equal(W6.ladderFacts(only('2026-11-13'), 'night', DAY).best, W6.ALL_RUNG, 'a recall day is still R-all');
  assert.deepEqual(W6.ladderFacts(t5, 'night', DAY).allDays, ['2026-11-13'], 'Got it keeps what RECALL says');
  // joined with an SB6 fold of the same days, the SB6 bits win (the fold days are OR-ed)
  assert.equal(W6.ladderFacts(W6.merge(t5, t6), 'night', DAY).best, W6.ALL_RUNG);
  assert.equal(W6.ladderFacts({ ...W6.merge(t5, t6), folded: { 'g1|night': { ...W6.merge(t5, t6).folded['g1|night'], days: { '2026-11-10': W6.merge(t5, t6).folded['g1|night'].days['2026-11-10'] } } } }, 'night', DAY).best, 4);
});
test('an SB5 device opening a Step by step week computes the same jobFor and hidden words before the rows stone, and the documented difference after it (R-3)', () => {
  let d = sb6Value();
  d = JSON.parse(json(d));
  // everything but practice done the Normal way: hello, fix, games, story marks
  const g6 = W6.groupById(d, 'g1');
  const withoutPractice = { ...d, steps: Object.fromEntries(Object.entries(d.steps).filter(([k]) => !k.endsWith('|practice'))) };
  for (const s of ['hello', 'fix', 'games', 'story']) { const x = W6.markStep(withoutPractice, g6, s, DAY, 8000); withoutPractice.steps = x.steps; }
  const g5 = W5.groupById(W5.normalise(withoutPractice), 'g1');
  const d5 = W5.normalise(withoutPractice);
  for (const day of ['2026-11-25', '2026-11-30', TEST_DAY, '2026-12-03']) {
    assert.equal(W5.jobFor(d5, g5, day), W6.jobFor(withoutPractice, W6.groupById(withoutPractice, 'g1'), day), 'jobFor ' + day);
  }
  assert.equal(W5.jobFor(d5, g5, TEST_DAY), 'practise', 'practice not done: the test is not due yet');
  // the rows stone has written the practice step: SB6 sees it done, SB5 does not (documented, R-3)
  const done = W6.markStep(withoutPractice, g6, 'practice', DAY, 9000);
  assert.equal(W6.studyJobDay(done, W6.groupById(done, 'g1'), 'practice'), DAY);
  assert.equal(W6.jobFor(done, W6.groupById(done, 'g1'), TEST_DAY), 'test');
  assert.equal(W5.studyJobDay(W5.normalise(done), W5.groupById(W5.normalise(done), 'g1'), 'practice'), '');
  assert.equal(W5.jobFor(W5.normalise(done), W5.groupById(W5.normalise(done), 'g1'), TEST_DAY), 'practise', 'an SB5 device still shows practice: the one documented difference');
  // every other job and the hidden-words rule read the same
  for (const s of ['hello', 'fix', 'games', 'story']) assert.equal(W5.studyJobDay(W5.normalise(done), W5.groupById(W5.normalise(done), 'g1'), s), W6.studyJobDay(done, W6.groupById(done, 'g1'), s), s);
});
test('a test word spelled after a Peek is a wrong word on SB5 as well: out of the pass mark, in the fix-ups (TR-13)', () => {
  let d = W6.createGroup(W6.emptyDoc(), { id: 'g1', test: TEST_DAY, words: ['night', 'light'], today: DAY, now: 1 }).doc;
  d = T(d, { word: 'night', kind: 't', day: TEST_DAY, pr: 1, peeks: 1, clean: false });
  d = T(d, { word: 'light', kind: 't', day: TEST_DAY });
  const d5 = W5.normalise(JSON.parse(json(d)));
  const g5 = W5.groupById(d5, 'g1');
  assert.deepEqual(W5.slipped(d5, g5), ['night']);
  assert.deepEqual(W5.fixups(d5, g5), ['night']);
  assert.equal(d5.results[0].pr, 1, 'and SB5 keeps the pr field');
  assert.deepEqual(W6.slipped(d, W6.groupById(d, 'g1')), ['night']);
});
test('an SB6 device reads an SB5 value as it always did: no new fields appear, the tries are the same (rollback, C-rollback)', () => {
  let d = W5.createGroup(W5.emptyDoc(), { id: 'g1', name: 'Old', test: TEST_DAY, words: WORDS, today: DAY, now: 1 }).doc;
  d = W5.addTry(d, { id: 'x1', word: 'night', day: DAY, group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, now: 2, lv: 2, source: 'g' });
  const n6 = W6.normalise(JSON.parse(json(d)));
  assert.equal(json(n6), json(W5.normalise(JSON.parse(json(d)))), 'byte for byte the same value');
  assert.ok(!('focus' in n6.groups.g1));
  assert.equal(S6.wayOf(n6.setup), 'usual');
});

test('D25: an SB5 device drops `aside` on a re-save (the word is just not set aside there); the SB6 merge puts it back', () => {
  const v6 = W6.normalise(W6.setAside(sb6Value(), 'g1', 'night', DAY, 9000));
  assert.equal(W6.isSetAside(v6, 'g1', 'night', DAY), true);
  const v5 = W5.normalise(JSON.parse(json(v6)));
  assert.ok(!('aside' in v5));
  assert.equal(json(W6.merge(v6, v5).aside), json(v6.aside));
  assert.equal(json(W6.merge(v5, v6).aside), json(v6.aside));
});
