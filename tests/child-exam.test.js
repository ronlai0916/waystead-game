// SB4-WP5: the one quiet row on a child's home for a big test or exam a grown-up set (child-doc.js examLine, pure).
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../site/js/child-doc.js';
import * as Su from '../site/js/setup-doc.js';
import * as P from '../site/js/progress-doc.js';

const DAY = 86400000;
const T0 = Date.parse('2026-11-02T09:00:00Z');
const day = (n) => new Date(T0 + n * DAY).toISOString().slice(0, 10);
const WORDS = ['build', 'earth', 'fruit'];

function setupWith(...exams) {
  let s = {};
  for (const [eid, date, name = 'Spring check'] of exams) {
    const r = Su.setExam(s, eid, { name, words: WORDS, from: ['Chapter 1'], date }, T0);
    assert.ok(r.setup, 'the exam is valid');
    s = r.setup;
  }
  return s;
}
const ran = (doc, eid, at) => P.addCheck(doc, { c: 'e:' + eid, k: 'e', s: 2, t: 3, d: day(0) }, at, 'r' + at);
const line = (setup, doc, today, year = 4, pf = 'normal') => C.examLine(setup, doc, today, year, pf);

test('later: before its date there is no row', () => {
  assert.equal(line(setupWith(['x1', day(3)]), P.emptyDoc(), day(0)), null);
  assert.equal(line(setupWith(['x1', day(3)]), P.emptyDoc(), day(2)), null);
});

test('ready: on the day, a Year 4 child sees "Your big test is ready." and the way to it', () => {
  const r = line(setupWith(['x1', day(3)]), P.emptyDoc(), day(3));
  assert.equal(r.eid, 'x1');
  assert.equal(r.line, 'Your big test is ready.');
  assert.equal(r.href, '#/words/exam/x1');
  assert.deepEqual(Object.keys(r).sort(), ['eid', 'href', 'line']);
});

test('the name follows the year and the help: an exam from Year 5 on Standard, a big test on Extra support', () => {
  const s = setupWith(['x1', day(0)]);
  assert.equal(line(s, P.emptyDoc(), day(0), 6, 'normal').line, 'Your exam is ready.');
  assert.equal(line(s, P.emptyDoc(), day(0), 5, 'top').line, 'Your exam is ready.');
  assert.equal(line(s, P.emptyDoc(), day(0), 6, 'sen').line, 'Your big test is ready.');
  assert.equal(line(s, P.emptyDoc(), day(0), 4, 'top').line, 'Your big test is ready.');
});

test('done: once it has been taken there is no row', () => {
  const s = setupWith(['x1', day(0)]);
  assert.equal(line(s, ran(P.emptyDoc(), 'x1', T0 + 5000), day(0)), null);
  assert.equal(line(s, ran(P.emptyDoc(), 'x1', T0 + 5000), day(4)), null);
});

test('reopened: after the grown-up reopens it, the row is back; once taken again it goes', () => {
  const taken = ran(P.emptyDoc(), 'x1', T0 + 5000);
  const reopened = Su.reopenExam(setupWith(['x1', day(0)]), 'x1', T0 + 9000);
  assert.equal(line(reopened, taken, day(1)).eid, 'x1');
  assert.equal(line(reopened, ran(taken, 'x1', T0 + 12000), day(1)), null);
});

test('gone: a dropped exam has no row', () => {
  const s = Su.dropExam(setupWith(['x1', day(0)]), 'x1', T0 + 1000);
  assert.equal(line(s, P.emptyDoc(), day(0)), null);
});

test('offer.exam off: no row, however ready', () => {
  const s = Su.setOffer(setupWith(['x1', day(0)]), { quiz: true, exam: false }, T0 + 1000);
  assert.equal(line(s, P.emptyDoc(), day(0)), null);
  const on = Su.setOffer(s, { quiz: false, exam: true }, T0 + 2000);
  assert.equal(line(on, P.emptyDoc(), day(0)).eid, 'x1', 'quizzes off does not hide an exam');
});

test('two exams: the earliest ready one; when it is done, the next; a later one waits', () => {
  const s = setupWith(['b', day(1), 'Second'], ['a', day(0), 'First'], ['c', day(5), 'Third']);
  assert.equal(line(s, P.emptyDoc(), day(1)).eid, 'a');
  assert.equal(line(s, ran(P.emptyDoc(), 'a', T0 + 5000), day(1)).eid, 'b');
  assert.equal(line(s, ran(ran(P.emptyDoc(), 'a', T0 + 5000), 'b', T0 + 6000), day(1)), null);
  assert.equal(line(s, ran(ran(P.emptyDoc(), 'a', T0 + 5000), 'b', T0 + 6000), day(5)).eid, 'c');
});

test('the same date: the smaller id first, and an id with odd characters is encoded in the way', () => {
  const s = setupWith(['m2', day(0)], ['m1', day(0)]);
  assert.equal(line(s, P.emptyDoc(), day(0)).eid, 'm1');
  const odd = setupWith(['a b/c', day(0)]);
  assert.equal(line(odd, P.emptyDoc(), day(0)).href, '#/words/exam/a%20b%2Fc');
});

test('no setup, no row', () => {
  assert.equal(line({}, P.emptyDoc(), day(0)), null);
  assert.equal(line(undefined, P.emptyDoc(), day(0)), null);
});
