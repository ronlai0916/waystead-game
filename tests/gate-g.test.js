// SB3-G: only a grown-up deletes a week; a grown-up's switch for the child's week choice.
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as W from '../site/js/words-doc.js';
import * as C from '../site/js/child-doc.js';
import * as P from '../site/js/grownups-doc.js';

const MON = '2026-11-02';
const at = (day, h = 12) => Date.parse(day + 'T' + String(h).padStart(2, '0') + ':00:00Z');
function two() {
  let d = W.createGroup(W.emptyDoc(), { id: 'ga', name: 'Autumn', test: W.addDays(MON, 5), words: ['fruit', 'earth'], today: MON, now: at(MON) }).doc;
  d = W.createGroup(d, { id: 'gb', name: 'Winter', test: W.addDays(MON, 12), words: ['guard', 'heart'], today: MON, now: at(MON, 13) }).doc;
  return d;
}
const src = (f) => readFileSync(new URL('../site/js/' + f, import.meta.url), 'utf8');

test('only an adult may delete a week', () => {
  assert.equal(W.mayDeleteWeek('adult'), true);
  for (const k of ['child', 'unknown', '', undefined, null]) assert.equal(W.mayDeleteWeek(k), false);
});

test('the words page never offers a child a delete link; an adult keeps it', () => {
  const d = two();
  const g = W.groupById(d, 'ga');
  assert.equal(W.editLinkLabel(d, g, MON, 'child'), 'Change this group');
  // from the test date the child's own rules allow no change: no link at all
  assert.equal(W.editLinkLabel(d, g, g.test, 'child'), '');
  assert.equal(W.editLinkLabel(d, g, g.test, 'adult'), 'Rename or delete');
  assert.equal(W.editLinkLabel(d, g, MON, 'adult'), 'Change this group');
  for (const day of [MON, g.test]) assert.doesNotMatch(W.editLinkLabel(d, g, day, 'child'), /delete/i);
});

test('words-views: the delete button and handler are behind mayDeleteWeek, the child route is guarded', () => {
  const v = src('words-views.js');
  assert.match(v, /const mayDelete = !!existing && W\.mayDeleteWeek\(roleNow\(\)\)/);
  assert.match(v, /\(mayDelete \? '<button type="button" class="btn btn--ghost" data-delete>/);
  assert.match(v, /if \(del && mayDelete\)/);
  assert.match(v, /if \(!W\.mayDeleteWeek\(roleNow\(\)\)\) return;/);
  assert.match(v, /roleNow\(\) !== 'adult' && !W\.canEditAsChild/);
  assert.doesNotMatch(v, /Rename or delete'/); // the wording lives in words-doc's editLinkLabel only
});

test('weekPick: absent = on, old docs are unchanged, normalise keeps a good field and drops a bad one', () => {
  const d = two();
  assert.equal(W.weekPickOn(d), true);
  assert.equal('weekPick' in W.normalise(d), false);
  assert.deepEqual(W.normalise(d), d);
  assert.equal(W.weekPickOn(W.normalise({ ...d, weekPick: { on: false, at: 5 } })), false);
  assert.deepEqual(W.normalise({ ...d, weekPick: { on: false, at: 5 } }).weekPick, { on: false, at: 5 });
  for (const bad of [null, 'off', { on: 'no', at: 5 }, { on: false }, { on: false, at: 'x' }, []]) assert.equal('weekPick' in W.normalise({ ...d, weekPick: bad }), false);
});

test('weekPick: setWeekPick always moves `at` forward; merge is last-writer-wins', () => {
  let d = two();
  d = W.setWeekPick(d, false, 1000);
  assert.deepEqual(d.weekPick, { on: false, at: 1000 });
  const same = W.setWeekPick(d, true, 500); // a slow clock still wins
  assert.deepEqual(same.weekPick, { on: true, at: 1001 });
  const off = W.setWeekPick(two(), false, 2000);
  const on = W.setWeekPick(two(), true, 3000);
  assert.equal(W.weekPickOn(W.merge(off, on)), true);
  assert.equal(W.weekPickOn(W.merge(on, off)), true);
  const on2 = W.setWeekPick(two(), true, 1000);
  const off2 = W.setWeekPick(two(), false, 4000);
  assert.equal(W.weekPickOn(W.merge(on2, off2)), false);
  assert.equal(W.weekPickOn(W.merge(off2, on2)), false);
  // present beats absent, either way round; absent both = still absent
  assert.equal(W.weekPickOn(W.merge(two(), off2)), false);
  assert.equal(W.weekPickOn(W.merge(off2, two())), false);
  assert.equal('weekPick' in W.merge(two(), two()), false);
  // a tie is settled the same way in both orders
  const a = { ...two(), weekPick: { on: true, at: 7 } };
  const b = { ...two(), weekPick: { on: false, at: 7 } };
  assert.deepEqual(W.merge(a, b).weekPick, W.merge(b, a).weekPick);
});

test('weekPick survives trim, a later resetAt, and Clear my progress', () => {
  const off = W.setWeekPick(two(), false, 5000);
  assert.equal(W.weekPickOn(W.trim(off, 6000)), false);
  assert.equal(W.weekPickOn(W.merge(off, W.reset(9000))), false);
  const cleared = W.reset(9000, off);
  assert.equal(cleared.resetAt, 9000);
  assert.deepEqual(cleared.weekPick, off.weekPick);
  assert.equal('weekPick' in W.reset(9000), false);
  assert.equal('weekPick' in W.reset(9000, two()), false);
});

test('week choice: off hides the switcher and ignores the saved choice; on restores it', () => {
  const d = two();
  const on = C.weekChoice(d, MON, 'gb');
  assert.equal(on.canSwitch, true);
  assert.equal(on.chosen, true);
  assert.equal(on.group.id, 'gb');
  const dOff = W.setWeekPick(d, false, 2000);
  const off = C.weekChoice(dOff, MON, 'gb');
  assert.equal(off.canSwitch, false);
  assert.equal(off.chosen, false);
  assert.equal(off.stale, false); // the device's choice is kept, not cleared
  assert.equal(off.next, null);
  assert.equal(off.group.id, C.weekChoice(d, MON, '').group.id); // the app's own pick
  const again = C.weekChoice(W.setWeekPick(dOff, true, 3000), MON, 'gb');
  assert.equal(again.canSwitch, true);
  assert.equal(again.group.id, 'gb');
});

test('week choice: an old doc with no field behaves as before', () => {
  const p = C.weekChoice(two(), MON, '');
  assert.equal(p.canSwitch, true);
  assert.equal(p.allowed, true);
});

test('grown-up copy and the child views follow the switch', () => {
  assert.equal(P.weekPickLabel(true), 'Your child can choose which week to study: On');
  assert.equal(P.weekPickLabel(false), 'Your child can choose which week to study: Off');
  const gv = src('grownups-views.js');
  assert.match(gv, /data-weekpick-toggle aria-pressed="' \+ pickOn/);
  assert.match(gv, /W\.setWeekPick\(doc, on, Date\.now\(\)\)/);
  assert.match(src('words-views.js'), /child && W\.weekPickOn\(d\)/);
  assert.match(src('store.js'), /W\.reset\(Date\.now\(\), d\)/);
  const css = readFileSync(new URL('../site/css/grownups.css', import.meta.url), 'utf8');
  assert.match(css, /\.gu-weekpick__btn \{[^}]*min-height: 48px/);
});

test('review fixes: unknown is treated like a child; only an adult clears progress; the toggle has a fixed name', () => {
  const d = two();
  const g = W.groupById(d, 'ga');
  assert.equal(W.editLinkLabel(d, g, g.test, 'unknown'), '');
  assert.equal(W.editLinkLabel(d, g, g.test, undefined), '');
  assert.equal(W.editLinkLabel(d, g, MON, 'unknown'), 'Change this group');
  assert.equal(W.mayClearProgress('adult'), true);
  for (const k of ['child', 'unknown', '', undefined]) assert.equal(W.mayClearProgress(k), false);
  const v = src('views.js');
  assert.match(v, /is-adult'\) \? '<div class="card setting" data-startagain>/);
  assert.match(v, /W\.mayClearProgress\(/);
  const wv = src('words-views.js');
  assert.match(wv, /roleNow\(\) !== 'adult' && !W\.canEditAsChild/);
  assert.match(wv, /if \(child && !W\.weekPickOn\(d\)\) others = \[\]/);
  assert.match(wv, /others = \[\]/);
  const gv = src('grownups-views.js');
  assert.match(gv, /<span>' \+ esc\(P\.WEEKPICK_NAME\) \+ '<\/span><span class="gu-weekpick__state" aria-hidden="true"/);
  assert.equal(P.WEEKPICK_NAME, 'Your child can choose which week to study');
});

test('weekGuard: the one decision for every words/g/:gid page when the switch is off', async () => {
  const St = await import('../site/js/study-doc.js');
  const d = two();
  const off = W.setWeekPick(d, false, 5000);
  const pick = St.studyGroup(off, MON).id;
  const other = pick === 'ga' ? 'gb' : 'ga';
  assert.equal(C.weekGuard(off, MON, other, 'child'), pick, 'child: another week goes to the pick');
  assert.equal(C.weekGuard(off, MON, other, 'unknown'), pick, 'unknown is treated like a child');
  assert.equal(C.weekGuard(off, MON, pick, 'child'), null, 'the pick itself: no loop');
  assert.equal(C.weekGuard(off, MON, other, 'adult'), null, 'an adult is unaffected');
  assert.equal(C.weekGuard(d, MON, other, 'child'), null, 'switch on: nothing');
  assert.equal(C.weekGuard(off, MON, 'nope', 'child'), null, 'an unknown week is left to the page');
  // the pick's destination is never itself redirected (no loops), for either week
  assert.equal(C.weekGuard(off, MON, C.weekGuard(off, MON, other, 'child'), 'child'), null);
  // a week whose test is due stays reachable
  const gB = W.groupById(off, 'gb');
  const dueDay = gB.test;
  let dueDoc = off;
  for (const s of St.BEFORE_TEST) dueDoc = W.markStep(dueDoc, gB, s, W.addDays(MON, 1), at(MON, 15));
  for (const w of gB.words) for (const h of [9, 10, 11]) dueDoc = W.addTry(dueDoc, { id: 'x' + w + h, word: w, day: W.addDays(MON, 1), group: 'gb', kind: 'p', tries: 0, peeks: 0, clean: true, now: at(W.addDays(MON, 1), h) });
  if (St.dueGroups(dueDoc, dueDay).some((x) => x.id === 'gb')) {
    const p2 = C.weekChoice(dueDoc, dueDay, '').group.id;
    assert.equal(C.weekGuard(dueDoc, dueDay, 'gb', 'child'), null, 'the due-test week stays reachable' + p2);
  }
  const r = src('app.js');
  assert.match(r, /found\.pattern\.startsWith\('words\/g\/:gid'\)/);
  assert.match(r, /weekGuard\(S\.readWords\(\)/);
  assert.match(src('words-views.js'), /roleNow\(\) !== 'adult' && !W\.weekPickOn\(d\) && !\(g && St\.dueGroups/);
});
