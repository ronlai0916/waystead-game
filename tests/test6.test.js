// SB6 WP-5b: U-test6 (the weekly test in Step by step, TR-13, TR-42, D7), U-copy6 (no paper, TR-40) and the study dispatch's pure parts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as A from '../site/js/assess-doc.js';
import * as St from '../site/js/study-doc.js';
import * as C from '../site/js/child-doc.js';
import * as F from '../site/js/front-doc.js';
import * as P from '../site/js/peek-doc.js';
import { literalsOf } from './copy-sb4.test.js';

const read = (f) => readFileSync(fileURLToPath(new URL('../site/js/' + f, import.meta.url)), 'utf8');

// What the Normal rules were before SB6 (23b): the test and exam cells and the quiz cells but Stretch's Peek.
const TODAY = {
  test: {
    sen: { words: 'all', partMax: 6, replays: Infinity, sentence: 'auto', hints: 1, level: 'child', pass: 0.7, feedback: 'end', ready: true },
    normal: { words: 'all', replays: Infinity, sentence: 'button', hints: 0, level: 'child', pass: 1, feedback: 'end' },
    top: { words: 'all', replays: 2, sentence: 'counts', hints: 0, level: 5, pass: 1, feedback: 'end' },
  },
};

test('U-test6: the Normal weekly test rules are the ones of today, with or without a way', () => {
  for (const pf of A.PROFILES) {
    assert.deepEqual(A.rulesFor('test', pf), TODAY.test[pf], pf);
    assert.deepEqual(A.rulesFor('test', pf, { way: 'usual' }), TODAY.test[pf], pf + ' usual');
    assert.equal(A.rulesFor('test', pf).peeks, undefined, 'no Peek in the Usual way test');
  }
});

test('U-test6: Step by step gives the weekly test one Peek a word, and nothing else changes', () => {
  for (const pf of A.PROFILES) {
    const r = A.rulesFor('test', pf, { way: 'sbs' });
    assert.equal(r.peeks, 1);
    assert.equal(r.peeksPerWord, 1);
    const { peeks, peeksPerWord, ...rest } = r;
    assert.deepEqual(rest, TODAY.test[pf]);
  }
  assert.equal(A.rulesFor('exam', 'normal', { way: 'sbs' }), A.rulesFor('exam', 'normal'), 'an exam is the same in both ways');
  assert.equal(A.RULES.test.normal.peeks, undefined, 'the shared table is not changed');
  assert.equal(P.peekRule('test', { way: 'sbs' }).allowed, 1);
  assert.equal(P.peekRule('test', { way: 'usual' }).allowed, 0);
  assert.equal(P.peekRule('chapterTest', { way: 'sbs' }).allowed, 0);
});

test('U-test6: Stretch quiz has one Peek (TR-41); the others keep theirs', () => {
  assert.equal(A.rulesFor('quiz', 'top').peeks, 1);
  assert.equal(A.rulesFor('quiz', 'normal').peeks, 1);
  assert.equal(A.rulesFor('quiz', 'sen').peeks, 1);
  assert.equal(P.peekRule('quiz').allowed, 1);
});

test('U-test6: a peeked test word is recorded as spelled with a peek (c 0, p 1, pr), never clean', () => {
  assert.deepEqual(A.testTry({ ok: 1, pk: 0 }), { tries: 0, peeks: 0, clean: true });
  assert.deepEqual(A.testTry({ ok: 0, pk: 0 }), { tries: 1, peeks: 0, clean: false });
  assert.deepEqual(A.testTry({ ok: 1, pk: 1 }), { tries: 0, peeks: 1, clean: false, pr: 1 });
  assert.deepEqual(A.testTry({ ok: 0, pk: 1 }), { tries: 1, peeks: 1, clean: false, pr: 0 });
});

test('U-test6: the end of a Step by step test lists words, with no count and no pass word', () => {
  const e = A.sbsTestEnd(['one', 'Two', 'three'], ['two']);
  assert.deepEqual(e.spelled, ['one', 'three']);
  assert.deepEqual(e.keep, ['Two']);
  const all = [e.head, ...e.lines, A.SBS_TEST_END.spelled, A.SBS_TEST_END.keep].join(' | ');
  assert.doesNotMatch(all, /\d|\bpass(ed)?\b|\bscore\b|\bof\b|\bfail|\bwrong|\bnot yet\b|\bnot this time\b/i);
  assert.equal(A.sbsTestEnd(['a'], []).keep.length, 0);
  assert.equal(A.sbsTestEnd(['a'], undefined).spelled.length, 1);
});

test('U-copy6: no child line sends a child to paper, and Fix it in is on the screen', () => {
  const lines = [...Object.values(C.JOB_SENTENCE), ...Object.values(St.STEP_TEXT).flatMap((s) => [s.title, s.line]), ...F.JOBS.flatMap((j) => [j.name, j.help]),
    C.jobSentence('story', { sentences: 3 }), C.jobSentence('story', { sentences: 1 })];
  for (const l of lines) assert.doesNotMatch(l, /\bpaper\b|\bpencils?\b|\bpens?\b|write it|\bwritten\b|\bwrite\b/i, l);
  assert.equal(St.STEP_TEXT.fix.line, 'Look, say, hide, spell and check each word, then spell it 3 times in a row.');
  assert.equal(C.JOB_SENTENCE.fix, 'Look, say, hide and spell each word.');
  assert.equal(F.JOBS.find((j) => j.id === 'fix').help, 'Look, say, hide, spell');
  assert.equal(C.JOB_SENTENCE.story, 'Read about your words. Make sentences.');
  assert.equal(C.jobSentence('story', { sentences: 3 }), 'Read about your words. Make 3 sentences.');
  assert.equal(F.JOBS.find((j) => j.id === 'story').help, 'Read, then make sentences');
});

test('U-copy6: the study and test pages have no paper line, no "I\'ve written it" button and no data-written hook', () => {
  for (const f of ['study-views.js', 'assess-views.js', 'assess-doc.js', 'study-doc.js', 'child-doc.js', 'front-doc.js']) {
    const src = read(f);
    assert.doesNotMatch(src, /data-written|I.ve written it|Write it on paper|Hide and write/, f);
    for (const l of literalsOf(src)) assert.doesNotMatch(l.replace(/<[^>]*>/g, ' '), /\bon paper\b|\bwrite it\b|\bwritten it\b|\bpencils?\b/i, f + ': ' + l);
  }
  assert.match(read('study-views.js'), /Hide and spell/);
});
