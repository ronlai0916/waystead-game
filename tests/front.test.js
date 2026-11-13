// SB3-F: the front pages' pure rules (front-doc.js): the seven jobs, a chapter's stone, the one button, the three steps and the test rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as F from '../site/js/front-doc.js';

const P = (o = {}) => ({ studied: false, practised: false, passed: false, attempts: 0, best: 0, ...o });
const chs = (n = 10) => Array.from({ length: n }, (_, i) => ({ id: 'c' + (i + 1), slug: 'ch' + String(i + 1).padStart(2, '0'), words: ['a', 'b', 'c'] }));
const view = (prog, open = (c, i) => true) => F.yearView(chs(), (c) => P(prog[c.id]), (c) => open(c, Number(c.id.slice(1)) - 1));
const gate = (prog) => (c) => { const i = Number(c.id.slice(1)); return i === 1 || !!(prog['c' + (i - 1)] || {}).passed; };

test('the seven jobs, in order, each with a short helper', () => {
  assert.deepEqual(F.JOBS.map((j) => j.name), ['Hello words', 'Fix it in', 'Game day', 'Story day', 'Practice day', 'Test', 'Mend and keep']);
  for (const j of F.JOBS) assert.ok(j.help.split(' ').length <= 5, j.help);
});

test('signed-out copy is the agreed wording', () => {
  assert.equal(F.SIGNED_OUT.button, 'Sign in to start');
  assert.equal(F.SIGNED_OUT.create, 'New here? Create a free account');
  assert.equal(F.SIGNED_OUT.kids, 'Children: ask a grown-up to sign in.');
  assert.equal(F.SIGNED_OUT.headline.join(' '), 'A spelling week. One short job a day.');
});

test('stone state: passed, studying (anything begun), to do', () => {
  assert.equal(F.stoneState(P()), 'todo');
  assert.equal(F.stoneState(P({ studied: true })), 'studying');
  assert.equal(F.stoneState(P({ practised: true })), 'studying');
  assert.equal(F.stoneState(P({ attempts: 1 })), 'studying');
  assert.equal(F.stoneState(P({ attempts: 2, passed: true })), 'passed');
});

test('the one button: Start when nothing is begun, Carry on at the first open chapter not passed, done when all are', () => {
  const none = F.yearView(chs(), () => P(), gate({}));
  assert.equal(none.mode, 'start');
  assert.equal(F.carryLabel(none), 'Start: Chapter 1');
  assert.equal(none.target.step, 'learn');
  const prog = { c1: P({ passed: true }), c2: P({ passed: true }), c3: P({ studied: true }) };
  const v = F.yearView(chs(), (c) => prog[c.id] || P(), gate(prog));
  assert.equal(v.mode, 'carry');
  assert.equal(F.carryLabel(v), 'Carry on: Chapter 3');
  assert.equal(v.target.label, 'Practise');
  assert.deepEqual(v.stones.map((s) => s.state).slice(0, 5), ['passed', 'passed', 'studying', 'todo', 'todo']);
  assert.deepEqual(v.stones.filter((s) => s.next).map((s) => s.n), [3]);
  assert.deepEqual(v.stones.map((s) => s.open).slice(0, 5), [true, true, true, false, false]);
  const all = Object.fromEntries(chs().map((c) => [c.id, P({ passed: true })]));
  const d = F.yearView(chs(), (c) => all[c.id], gate(all));
  assert.equal(d.mode, 'done');
  assert.equal(d.target, null);
  assert.ok(d.stones.every((s) => !s.next));
  // one passed and nothing else begun is "Carry on", not "Start"
  const one = { c1: P({ passed: true }) };
  assert.equal(F.yearView(chs(), (c) => one[c.id] || P(), gate(one)).mode, 'carry');
});

test('a chapter passed out of order: the button goes to the first open one not passed', () => {
  const prog = { c2: P({ passed: true }) };
  const v = F.yearView(chs(), (c) => prog[c.id] || P(), () => true); // open every chapter
  assert.equal(v.target.n, 1);
});

test('summary line', () => {
  assert.equal(F.summaryLine({ words: 109, total: 10, passed: 2 }), '109 words in 10 chapters · 2 tests passed');
  assert.equal(F.summaryLine({ words: 109, total: 10, passed: 1 }), '109 words in 10 chapters · 1 test passed');
  assert.equal(F.summaryLine({ words: 109, total: 10, passed: 0 }), '109 words in 10 chapters · no tests passed yet');
  assert.deepEqual(F.yearSummary(chs(3), (c) => P({ passed: c.id === 'c1' })), { words: 9, total: 3, passed: 1 });
});

test('which year opens: the remembered one, else where the player is working', () => {
  const V = (mode) => ({ mode });
  const live = ['y3', 'y4', 'y5', 'y6'];
  const all = (m) => Object.fromEntries(live.map((y) => [y, V(m[y] || 'start')]));
  assert.equal(F.pickYear('y6', all({ y3: 'carry' }), 0, live), 'y6');
  assert.equal(F.pickYear('', all({ y3: 'carry' }), 0, live), 'y3');
  assert.equal(F.pickYear('', all({ y3: 'done', y4: 'carry' }), 0, live), 'y4');
  assert.equal(F.pickYear('', all({ y3: 'start', y5: 'carry' }), 0, live), 'y5');
  assert.equal(F.pickYear('nonsense', all({}), 0, live), 'y3');
  assert.equal(F.pickYear('', all({ y3: 'carry' }), 5, live), 'y5', 'the child\'s own year comes before progress');
});

test('chapter steps: learn, then practise, then the test is the one next step', () => {
  let s = F.chapterSteps(P());
  assert.deepEqual([s.learn, s.practise, s.test, s.next], ['next', 'later', 'later', 'learn']);
  s = F.chapterSteps(P({ studied: true }));
  assert.deepEqual([s.learn, s.practise, s.test, s.next], ['done', 'next', 'later', 'practise']);
  s = F.chapterSteps(P({ studied: true, practised: true }));
  assert.deepEqual([s.learn, s.practise, s.test, s.next], ['done', 'done', 'next', 'test']);
  s = F.chapterSteps(P({ studied: true, practised: true, passed: true, attempts: 1 }));
  assert.deepEqual([s.learn, s.practise, s.test, s.next], ['done', 'done', 'done', '']);
});

test('the test rule: gated before practice, never taken away once it could be opened, an adult may always', () => {
  const before = F.chapterSteps(P({ studied: true }));
  assert.equal(before.testOpen, false);
  assert.equal(before.testAnyway, false);
  assert.equal(F.chapterSteps(P({ studied: true }), true).testAnyway, true);
  assert.equal(F.chapterSteps(P({ studied: true }), true).testOpen, false);
  // attempted before (not passed, not practised on this record): still openable, never the "anyway" link
  const tried = F.chapterSteps(P({ attempts: 2 }), true);
  assert.equal(tried.testOpen, true);
  assert.equal(tried.testAnyway, false);
  assert.equal(F.chapterSteps(P({ passed: true })).testOpen, true);
  assert.equal(F.chapterSteps(P({ practised: true })).testOpen, true);
  // practised but never studied: Learn stays the primary, the test is a quiet open row
  const odd = F.chapterSteps(P({ practised: true }));
  assert.deepEqual([odd.next, odd.test, odd.testOpen], ['learn', 'later', true]);
});

import { readFileSync } from 'node:fs';
test('constraints: no inline style or script in the front pages, files in the worker\'s shell, no "Start game"', () => {
  const read = (f) => readFileSync(new URL('../site/' + f, import.meta.url), 'utf8');
  const views = read('js/front-views.js');
  assert.doesNotMatch(views, /style="|\.style\.cssText|<script/);
  const sw = read('sw.js');
  for (const f of ['css/front.css', 'js/front-views.js', 'js/front-doc.js']) assert.ok(sw.includes("'" + f + "'"), f + ' in the shell');
  assert.match(read('index.html'), /css\/front\.css/);
  for (const f of ['js/front-views.js', 'js/front-doc.js', 'js/views.js', 'css/front.css']) assert.doesNotMatch(read(f), /Start game/, f);
});
