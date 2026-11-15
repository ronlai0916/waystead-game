import test from 'node:test';
import assert from 'node:assert/strict';
import * as A from '../site/js/assess-doc.js';

const KEYS = {
  quiz: ['words', 'replays', 'sentence', 'peeks', 'hints', 'level', 'pass', 'feedback'],
  test: ['words', 'replays', 'sentence', 'hints', 'level', 'pass', 'feedback'],
  exam: ['words', 'replays', 'sentence', 'hints', 'level', 'pass', 'feedback'],
};
const CHILD_BAD = /\b(wrong|fail\w*|incorrect|mistake|late|lost|error)\b/i;
const ADULT_BAD = /\b(SEN|profile|mode|level [1-5]|doc|sync|toggle|scaffold|input method|OCR|AI model)\b/i;
const BRIT = /color|gray|practicing|favorite|center|\w+ize\b/i;

function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

test('all nine kind x help cells have every key', () => {
  for (const kind of A.KINDS) for (const pf of A.PROFILES) {
    const r = A.rulesFor(kind, pf);
    assert.ok(r, kind + pf);
    for (const k of KEYS[kind]) assert.ok(k in r, kind + ' ' + pf + ' ' + k);
  }
  for (const pf of A.PROFILES) for (const k of ['sentence', 'glowAfter', 'quickBar']) assert.ok(k in A.RULES.practice[pf]);
});

test('levelFor', () => {
  assert.equal(A.levelFor('exam', 'normal', 2), 4);
  assert.equal(A.levelFor('exam', 'top', 2), 5);
  assert.equal(A.levelFor('exam', 'sen', 2), 2);
  assert.equal(A.levelFor('quiz', 'normal', 3), 3);
  assert.equal(A.levelFor('test', 'top', 1), 5);
  assert.equal(A.levelFor('exam', 'normal', 5), 5);
});

test('quizLength', () => {
  assert.equal(A.quizLength('sen', 4), 3);
  assert.equal(A.quizLength('normal', 1), 3);
  assert.equal(A.quizLength('top', 1), 3);
  assert.equal(A.quizLength('normal', 3), 5);
});

test('partsOf', () => {
  const sen = A.RULES.test.sen, ex = A.RULES.exam.sen, plain = A.RULES.test.normal;
  for (const n of [1, 5, 6, 7, 10, 11, 14, 20]) {
    for (const r of [sen, ex, plain]) assert.equal(A.partsOf(n, r).reduce((a, b) => a + b, 0), n);
  }
  assert.deepEqual(A.partsOf(1, sen), [1]);
  assert.deepEqual(A.partsOf(5, sen), [5]);
  assert.deepEqual(A.partsOf(6, sen), [6]);
  assert.deepEqual(A.partsOf(7, sen), [4, 3]);
  assert.deepEqual(A.partsOf(10, sen), [5, 5]);
  assert.deepEqual(A.partsOf(11, sen), [6, 5]);
  assert.deepEqual(A.partsOf(14, sen), [5, 5, 4]);
  assert.deepEqual(A.partsOf(20, sen), [5, 5, 5, 5]);
  assert.deepEqual(A.partsOf(10, ex), [5, 5]);
  assert.deepEqual(A.partsOf(1, ex), [1]);
  assert.deepEqual(A.partsOf(20, plain), [20]);
});

test('passMark and passes', () => {
  assert.equal(A.passMark('sen', 10), 7);
  assert.equal(A.passMark('sen', 11), 8);
  for (let n = 1; n <= 30; n++) { assert.equal(A.passMark('normal', n), n); assert.equal(A.passMark('top', n), n); }
  assert.ok(A.passes('sen', 7, 10));
  assert.ok(!A.passes('sen', 6, 10));
  assert.ok(!A.passes('normal', 9, 10));
});

test('examWords', () => {
  const pools = [
    { src: 'c3', words: ['apple', 'bread', 'chair', 'dream', 'earth', 'fresh', 'giant'], at: 300 },
    { src: 'c1', words: ['Apple', 'happy', 'jelly', 'knife', 'lemon', 'mouse'], at: 100 },
    { src: 'c2', words: ['night', 'ocean', 'piano', 'queen', 'river', 'storm', 'tiger', 'uncle'], at: 200 },
    { src: 'c4', words: ['voice', 'water', 'yacht', 'zebra', 'angle', 'beach', 'camel', 'daisy'], at: 400 },
  ];
  for (const pf of A.PROFILES) {
    const a = A.examWords(pools, pf, seeded(7));
    const b = A.examWords(pools, pf, seeded(7));
    assert.deepEqual(a, b);
    assert.equal(a.length, A.RULES.exam[pf].words);
    assert.equal(new Set(a.map((w) => w.toLowerCase())).size, a.length);
  }
  const top = A.examWords(pools, 'top', seeded(3));
  const older = new Set([...pools[1].words, ...pools[2].words].map((w) => w.toLowerCase()));
  assert.ok(top.filter((w) => older.has(w.toLowerCase())).length >= 10);
  assert.equal(A.examWords([{ src: 'x', words: ['one', 'two', 'three'], at: 1 }], 'normal', seeded(1)).length, 3);
  assert.deepEqual(A.examWords([], 'normal', seeded(1)), []);
  // input order does not matter
  assert.deepEqual(A.examWords(pools.slice().reverse(), 'normal', seeded(5)), A.examWords(pools, 'normal', seeded(5)));
  // spread: every pool is used in a 10-word exam
  const sen = A.examWords(pools, 'sen', seeded(9));
  for (const p of pools) assert.ok(sen.some((w) => p.words.map((x) => x.toLowerCase()).includes(w.toLowerCase())));
});

test('kindName', () => {
  for (const pf of A.PROFILES) {
    for (let y = 0; y <= 6; y++) {
      assert.equal(A.kindName('quiz', pf, y), 'Quiz');
      assert.equal(A.kindName('test', pf, y), 'Test');
      assert.equal(A.kindName('exam', pf, y), y <= 4 || pf === 'sen' ? 'Big test' : 'Exam');
    }
    assert.equal(A.kindName('exam', pf, undefined), 'Big test');
  }
});

test('endLines rows', () => {
  const e = A.endLines;
  assert.deepEqual(e('test', 'normal', { right: 10, of: 10, toPractise: 0 }), { head: 'You passed!', lines: ['10 words spelled.'], celebrate: true });
  assert.deepEqual(e('test', 'sen', { right: 8, of: 10, toPractise: 2 }), { head: 'You passed!', lines: ['You spelled 8 words.'], celebrate: true });
  assert.deepEqual(e('test', 'sen', { right: 10, of: 10, toPractise: 0 }).lines, ['10 words spelled.']);
  assert.deepEqual(e('test', 'normal', { right: 8, of: 10, toPractise: 2 }), { head: 'Not yet.', lines: ['You spelled 8 of 10.', 'Let\'s practise 2.'], celebrate: false });
  assert.deepEqual(e('test', 'top', { right: 9, of: 10, toPractise: 1 }).head, 'Not yet.');
  assert.deepEqual(e('test', 'sen', { right: 5, of: 10, toPractise: 5 }), { head: 'Not this time.', lines: ['You spelled 5 words.', 'Practise these 5. Try again any time.'], celebrate: false });
  assert.deepEqual(e('test', 'normal', { right: 10, of: 10, toPractise: 0 }, { weekly: true }), { head: 'Test done.', lines: ['You spelled all 10!'], celebrate: true });
  assert.deepEqual(e('test', 'normal', { right: 8, of: 10, toPractise: 2 }, { weekly: true }), { head: 'Test done.', lines: ['You spelled 8 of 10.', '2 words will come back to practise.'], celebrate: false });
  assert.equal(e('test', 'top', { right: 9, of: 10, toPractise: 1 }, { weekly: true }).lines[1], '1 word will come back to practise.');
  assert.deepEqual(e('test', 'sen', { right: 8, of: 10, toPractise: 2 }, { weekly: true }).lines, ['You spelled 8 words.', 'Some words will come back to practise.']);
  assert.deepEqual(e('quiz', 'normal', { right: 5, of: 5, toPractise: 0 }), { head: 'Quiz done.', lines: ['You spelled all 5!'], celebrate: false });
  assert.deepEqual(e('quiz', 'normal', { right: 4, of: 5, toPractise: 1 }).lines, ['You spelled 4 of 5.']);
  assert.deepEqual(e('quiz', 'sen', { right: 2, of: 3, toPractise: 1 }).lines, ['You spelled 2 words.']);
  assert.deepEqual(e('exam', 'normal', { right: 20, of: 20, toPractise: 0 }), { head: 'All done.', lines: ['You spelled 20 of 20.'], celebrate: false });
  assert.deepEqual(e('exam', 'normal', { right: 17, of: 20, toPractise: 3 }).lines, ['You spelled 17 of 20.', 'Let\'s practise these.']);
  assert.deepEqual(e('exam', 'sen', { right: 7, of: 10, toPractise: 3 }).lines, ['You spelled 7 words.', 'Let\'s practise these.']);
});

test('ready, progress, heard and fixed lines', () => {
  assert.deepEqual(A.readyLines('test', 'normal', 10), { lines: ['10 words. Hear each one as often as you like.', 'Start when you\'re ready.'], button: 'Start' });
  assert.equal(A.readyLines('exam', 'normal', 20).lines[0], '20 words. You can hear each word again 3 times.');
  assert.equal(A.readyLines('exam', 'top', 20).lines[0], '20 words. You can hear each word again once.');
  assert.equal(A.progressLine(4, 10), 'Word 4 of 10');
  assert.equal(A.heardLine(3), 'You\'ve heard it 3 times.');
  assert.equal(A.examHomeLine('Big test'), 'Your big test is ready.');
  assert.equal(A.examHomeLine('Exam'), 'Your exam is ready.');
  assert.equal(A.examLater('Big test', 'Fri 27 Nov'), 'Your big test opens on Fri 27 Nov.');
  assert.equal(A.REST.head, 'Have a rest.');
  assert.equal(A.suggestFor(2).lv, 3);
  assert.equal(A.suggestFor(0).lv, 5);
  assert.equal(A.suggestFor(1).p, 'normal');
});

test('resultLine example and every combination', () => {
  assert.equal(
    A.resultLine({ kind: 'test', scope: 'Chapter 3', right: 8, of: 10, pf: 'sen', lv: 2, hr: 6, hn: 1, pk: 0 }),
    'Chapter 3 test · 8 of 10 · Extra support · with letter tiles (Some letters) · heard again 6 times · 1 first-letter hint');
  assert.equal(A.resultLine({ kind: 'exam', scope: 'Spring words', right: 9, of: 10, pf: 'normal' }), 'Spring words (exam) · 9 of 10 · Standard · keyboard');
  assert.equal(A.resultLine({ kind: 'quiz', scope: 'Chapter 3', right: 3, of: 5, pf: 'top', pk: 1 }), 'Quiz (practice): Chapter 3 · 3 of 5 · Stretch · keyboard · 1 peek');
  for (const kind of A.KINDS) for (const pf of A.PROFILES) for (let lv = 1; lv <= 5; lv++)
    for (const hn of [0, 1, 2]) for (const hr of [0, 1, 2]) for (const pk of [0, 1, 2]) {
      const s = A.resultLine({ kind, scope: 'Chapter 3', right: 4, of: 5, pf, lv, hr, hn, pk });
      const parts = s.split(' · ');
      assert.equal(parts[1], '4 of 5');
      assert.equal(parts[2], A.PROFILE_NAME[pf]);
      assert.equal(parts[3], lv <= 4 ? 'with letter tiles (' + A.LEVEL_NAME[lv] + ')' : 'keyboard');
      assert.equal(parts.includes(hr === 0 ? 'x' : 'heard again ' + (hr === 1 ? 'once' : '2 times')), hr > 0);
      assert.equal(parts.some((p) => /first-letter/.test(p)), hn > 0);
      if (hn) assert.ok(parts.includes(hn === 1 ? '1 first-letter hint' : '2 first-letter hints'));
      if (pk) assert.ok(parts.includes(pk === 1 ? '1 peek' : '2 peeks'));
      assert.equal(parts.length, 4 + (hr ? 1 : 0) + (hn ? 1 : 0) + (pk ? 1 : 0));
      assert.ok(!ADULT_BAD.test(s), s);
      assert.ok(!BRIT.test(s), s);
    }
  assert.equal(A.RECOMMENDED(3), 'Recommended for Year 3');
  assert.equal(A.SAVED('Sam'), 'Saved. Sam will see this next time.');
});

function childStrings() {
  const out = [];
  const add = (v) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach(add); else if (v && typeof v === 'object') Object.values(v).forEach(add); };
  add([A.REST, A.RIGHT, A.NEARLY_QUIZ, A.FINISH, A.WAIT, A.SENTENCE_BUTTON, A.HINT_BUTTON, A.EXAM_DONE]);
  add([A.progressLine(4, 10), A.heardLine(1), A.heardLine(3), A.examHomeLine('Big test'), A.examHomeLine('Exam'), A.examLater('Exam', 'Fri 27 Nov')]);
  for (const k of A.KINDS) for (const pf of A.PROFILES) {
    add(A.readyLines(k, pf, 10));
    for (const [right, of] of [[10, 10], [8, 10], [5, 10], [1, 3], [0, 3]]) for (const weekly of [false, true]) for (const n of [1, 2, 5])
      add(A.endLines(k, pf, { right, of, toPractise: n }, { weekly }));
  }
  return out;
}

test('child copy: no banned words, no cross, British', () => {
  const all = childStrings();
  assert.ok(all.length > 30);
  for (const s of all) {
    assert.ok(!CHILD_BAD.test(s), s);
    assert.ok(!s.includes('×'), s);
    assert.ok(!BRIT.test(s), s);
  }
});

test('grown-up copy: no banned words, British', () => {
  const all = [...Object.values(A.PROFILE_NAME), ...Object.values(A.PROFILE_HELP), ...Object.values(A.LEVEL_NAME), A.RECOMMENDED(4), A.SAVED('Sam')];
  for (const s of all) { assert.ok(!ADULT_BAD.test(s), s); assert.ok(!BRIT.test(s), s); }
});

test('the module is pure', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../site/js/assess-doc.js', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/\b(document|window|localStorage|Date\.|Math\.random|style=")/.test(src));
  assert.ok(!/^\s*import\b/m.test(src));
});
