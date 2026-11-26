// assess-doc.js: the rules for quizzes, tests and exams, and the words around them (SB4, WP3b).
// Pure: no DOM, no storage, no Date, no Math.random. A clock or a seed always comes in as an argument.
//
// Data first: every rule a grown-up might change is an entry in RULES (kind x help).
//   kinds    quiz (practice), test (a chapter or a week), exam (a big test)
//   helps    'sen' (shown to grown-ups as Extra support), 'normal' (Standard), 'top' (Stretch)
// Rule keys: words (count, or 'all'), replays (Infinity = as often as you like), sentence
// ('auto' | 'button' | 'counts' | 'none'), hints, peeks, level ('child' | 'min4' | 5), pass (fraction
// or null), feedback ('each' | 'end'); optional partMax, parts, oldHalf, ready.
// Child copy is exact strings in this file; the runner uses only these.

export const KINDS = ['quiz', 'test', 'exam'];
export const PROFILES = ['sen', 'normal', 'top'];
export const PROFILE_NAME = { sen: 'Extra support', normal: 'Standard', top: 'Stretch' };
export const PROFILE_HELP = {
  sen: 'Shorter parts with a rest, the word in a sentence, one first-letter hint.',
  normal: 'The usual test.',
  top: 'Keyboard only, fewer hears, every word right to pass.',
};
export const LEVEL_NAME = { 1: 'A few letters', 2: 'Some letters', 3: 'Most letters', 4: 'All the letters', 5: 'Keyboard' };

export const RULES = {
  practice: {
    sen: { sentence: 'auto', glowAfter: 1, quickBar: false },
    normal: { sentence: 'off', glowAfter: 2, quickBar: true },
    top: { sentence: 'off', glowAfter: 2, quickBar: true },
  },
  quiz: {
    sen: { words: 3, replays: Infinity, sentence: 'auto', peeks: 1, hints: 0, level: 'child', pass: null, feedback: 'each' },
    normal: { words: 5, replays: Infinity, sentence: 'button', peeks: 1, hints: 0, level: 'child', pass: null, feedback: 'each' },
    top: { words: 5, replays: Infinity, sentence: 'button', peeks: 1, hints: 0, level: 5, pass: null, feedback: 'each' }, // SB6 (TR-41): Stretch has one Peek too
  },
  test: {
    sen: { words: 'all', partMax: 6, replays: Infinity, sentence: 'auto', hints: 1, level: 'child', pass: 0.7, feedback: 'end', ready: true },
    normal: { words: 'all', replays: Infinity, sentence: 'button', hints: 0, level: 'child', pass: 1, feedback: 'end' },
    top: { words: 'all', replays: 2, sentence: 'counts', hints: 0, level: 5, pass: 1, feedback: 'end' },
  },
  exam: {
    sen: { words: 10, parts: 2, replays: Infinity, sentence: 'auto', hints: 1, level: 'child', pass: null, feedback: 'end', ready: true },
    normal: { words: 20, replays: 3, sentence: 'button', hints: 0, level: 'min4', pass: null, feedback: 'end', ready: true },
    top: { words: 20, oldHalf: true, replays: 1, sentence: 'none', hints: 0, level: 5, pass: null, feedback: 'end', ready: true },
  },
};

// The suggested tile level by school year. The suggested help is always 'normal'.
export const SUGGEST = { 1: { lv: 2 }, 2: { lv: 3 }, 3: { lv: 5 }, 4: { lv: 5 }, 5: { lv: 5 }, 6: { lv: 5 } };
export const suggestFor = (year) => ({ lv: (SUGGEST[year] || { lv: 5 }).lv, p: 'normal' });

const okPf = (pf) => (PROFILES.includes(pf) ? pf : 'normal');

/**
 * The rule for a kind and a help. SB6 (TR-42): `{ way: 'sbs' }` on the weekly TEST gives the Step by step rule, which adds one Peek a word
 * (`peeks: 1`, `peeksPerWord: 1`). Every other call answers the same object as before (so the Usual way's rules are the ones U-test6 pins).
 */
export function rulesFor(kind, pf, { way = 'usual' } = {}) {
  const k = RULES[kind];
  if (!k) return null;
  const rule = k[okPf(pf)];
  if (kind === 'test' && way === 'sbs') return { ...rule, peeks: 1, peeksPerWord: 1 };
  return rule;
}

export function levelFor(kind, pf, childLv) {
  const rule = rulesFor(kind, pf);
  if (!rule) return 5;
  const c = Number.isInteger(childLv) && childLv >= 1 && childLv <= 5 ? childLv : 5;
  if (rule.level === 'child') return c;
  if (rule.level === 'min4') return Math.max(4, c);
  return 5;
}

export function quizLength(pf, year) {
  if (pf === 'sen') return 3;
  if (year === 1) return 3;
  return 5;
}

// Sizes of the parts of a run of n words: partMax splits evenly (11 -> [6,5]), parts: 2 halves, else one part.
export function partsOf(n, rule) {
  n = Math.max(0, Math.floor(n) || 0);
  if (!n) return [];
  let k = 1;
  if (rule && rule.partMax) k = Math.ceil(n / rule.partMax);
  else if (rule && rule.parts) k = Math.min(rule.parts, n);
  const base = Math.floor(n / k);
  const extra = n % k;
  const out = [];
  for (let i = 0; i < k; i++) out.push(base + (i < extra ? 1 : 0));
  return out;
}

export function passMark(pf, n) {
  const pass = RULES.test[okPf(pf)].pass;
  return Math.ceil(Math.round(pass * n * 1e6) / 1e6);
}
export const passes = (pf, right, n) => right >= passMark(pf, n);

// pools = [{ src, words, at }]; rand = seeded () => [0,1). Same inputs, same list.
export function examWords(pools, pf, rand) {
  const rule = RULES.exam[okPf(pf)];
  const list = (pools || [])
    .map((p, i) => ({ src: String(p.src), at: Number(p.at) || 0, words: Array.isArray(p.words) ? p.words : [], i }))
    .sort((a, b) => a.at - b.at || (a.src < b.src ? -1 : a.src > b.src ? 1 : a.i - b.i));
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.floor(rand() * (i + 1)));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const queues = list.map((p) => ({ q: shuffle(p.words), at: 0 }));
  const seen = new Set();
  const picked = [];
  // all distinct words available
  const avail = new Set();
  for (const p of list) for (const w of p.words) avail.add(String(w).toLowerCase());
  const want = Math.min(rule.words, avail.size);
  const nextFrom = (qq) => {
    while (qq.at < qq.q.length) {
      const w = qq.q[qq.at++];
      const key = String(w).toLowerCase();
      if (!seen.has(key)) { seen.add(key); return w; }
    }
    return null;
  };
  const round = (idx, need) => {
    let got = 0;
    let progress = true;
    while (got < need && progress) {
      progress = false;
      for (const i of idx) {
        if (got >= need) break;
        const w = nextFrom(queues[i]);
        if (w !== null) { picked.push(w); got++; progress = true; }
      }
    }
    return got;
  };
  const all = list.map((_, i) => i);
  if (rule.oldHalf && list.length) {
    const older = all.slice(0, Math.ceil(list.length / 2));
    round(older, Math.ceil(want / 2));
  }
  round(all, want - picked.length);
  return shuffle(picked);
}

export function kindName(kind, pf, year) {
  if (kind === 'quiz') return 'Quiz';
  if (kind === 'test') return 'Test';
  const known = typeof year === 'number' && Number.isFinite(year);
  return !known || year <= 4 || pf === 'sen' ? 'Big test' : 'Exam';
}

// ---- Child copy (exact strings) ----
const wordsN = (n) => n + (n === 1 ? ' word' : ' words');

/** F5: what the Step by step weekly test allows, said to the child (never "no peeking"): two short sentences. */
export const SBS_TEST_ALLOWS = ['Hear each word as often as you like.', 'You can peek once on each word.'];
/** F5/S2: the two lines of what the Step by step weekly test allows THIS child: the Hear line reads the replays of the rule (Stretch help: 2), the Peek line the peeks per word. */
export function sbsTestAllows(pf) {
  const r = rulesFor('test', pf, { way: 'sbs' });
  const rep = r ? r.replays : Infinity;
  const hear = Number.isFinite(rep) ? 'Hear each word again ' + (rep === 1 ? 'once' : 'up to ' + rep + ' times') + '.' : SBS_TEST_ALLOWS[0];
  const pk = r && r.peeksPerWord === 1 ? 'You can peek once on each word.' : SBS_TEST_ALLOWS[1];
  return [hear, pk];
}
export function readyLines(kind, pf, n, { sbs = false } = {}) {
  // F5/F9: the Step by step weekly test says what it allows, in short lines: how often to hear, one Peek (never "no peeking")
  if (sbs && kind === 'test') return { lines: [wordsN(n) + '.', ...sbsTestAllows(pf), 'Start when you\'re ready.'], button: 'Start' };
  const r = rulesFor(kind, pf);
  const rep = r ? r.replays : Infinity;
  let first;
  if (Number.isFinite(rep)) first = n + ' words. You can hear each word again ' + (rep === 1 ? 'once' : rep + ' times') + '.';
  else first = n + ' words. Hear each one as often as you like.';
  return { lines: [first, 'Start when you\'re ready.'], button: 'Start' };
}
export const progressLine = (i, n) => 'Word ' + i + ' of ' + n;
export const heardLine = (n) => 'You\'ve heard it ' + (n === 1 ? 'once' : n + ' times') + '.';
export const REST = { head: 'Have a rest.', line: 'Carry on when you\'re ready.', button: 'Carry on' };
export const RIGHT = 'You spelled it!';
export const NEARLY_QUIZ = 'Nearly! Here\'s how it goes.';
export const FINISH = { hint: 'You can check your answers first.', button: 'Finish' };
export const WAIT = { line: 'All done. Ready to see how you did?', button: 'Show me' };
export const SENTENCE_BUTTON = 'In a sentence';

// ---- the Step by step weekly test, as the child meets its end (SB6, TR-13, D7) ----
// No count, no pass word. Words spelled on their own, then words that will keep coming back (a word spelled after a Peek is one of them).
export const SBS_TEST_END = { head: 'Test done.', spelled: 'Words you spelled', keep: 'Words we\'ll keep practising', line: 'Well done for finishing.' };
/** The end of a Step by step weekly test: { head, lines, spelled: [word], keep: [word] }. `words` are the test's words in order; `keep` the ones to practise again. */
export function sbsTestEnd(words, keep) {
  const k = new Set((keep || []).map((w) => String(w).toLowerCase()));
  return {
    head: SBS_TEST_END.head,
    lines: [SBS_TEST_END.line],
    spelled: words.filter((w) => !k.has(String(w).toLowerCase())),
    keep: words.filter((w) => k.has(String(w).toLowerCase())),
  };
}
/** A weekly test answer as the words record keeps it (TR-13): a peeked word is `peeks: 1`, never clean, `pr` = was the spelling after the Peek right. */
export function testTry(a) {
  const peeked = a.pk > 0;
  return { tries: a.ok ? 0 : 1, peeks: peeked ? a.pk : 0, clean: !!a.ok && !peeked, ...(peeked ? { pr: a.ok ? 1 : 0 } : {}) };
}
export const HINT_BUTTON = 'First letter';

export function endLines(kind, pf, { right, of, toPractise: n }, { weekly = false } = {}) {
  const sen = pf === 'sen';
  const slips = right < of;
  const spelled = sen ? 'You spelled ' + wordsN(right) + '.' : 'You spelled ' + right + ' of ' + of + '.';
  if (kind === 'test') {
    if (weekly) {
      if (!slips) return { head: 'Test done.', lines: ['You spelled all ' + of + '!'], celebrate: true };
      if (sen) return { head: 'Test done.', lines: [spelled, 'Some words will come back to practise.'], celebrate: false };
      return { head: 'Test done.', lines: [spelled, wordsN(n) + ' will come back to practise.'], celebrate: false };
    }
    if (passes(pf, right, of)) {
      return { head: 'You passed!', lines: [sen && slips ? spelled : of + ' words spelled.'], celebrate: true };
    }
    if (sen) return { head: 'Not this time.', lines: [spelled, 'Practise these ' + n + '. Try again any time.'], celebrate: false };
    return { head: 'Not yet.', lines: [spelled, 'Let\'s practise ' + n + '.'], celebrate: false };
  }
  if (kind === 'quiz') {
    return { head: 'Quiz done.', lines: [slips ? spelled : 'You spelled all ' + of + '!'], celebrate: false };
  }
  const lines = [spelled];
  if (slips) lines.push('Let\'s practise these.');
  return { head: 'All done.', lines, celebrate: false };
}

const lower1 = (s) => s.charAt(0).toLowerCase() + s.slice(1);
export const examHomeLine = (name) => 'Your ' + lower1(name) + ' is ready.';
export const examLater = (name, dayLabel) => 'Your ' + lower1(name) + ' opens on ' + dayLabel + '.';
export const EXAM_DONE = 'You have done this one. Well done.';

// ---- Grown-up copy ----
// scope is the plain label: 'Chapter 3', a week name, or an exam name.
export function resultLine({ kind, scope, right, of, pf, lv, hr, hn, pk }) {
  const parts = [];
  if (kind === 'quiz') parts.push(scope ? 'Quiz (practice): ' + scope : 'Quiz (practice)');
  else if (kind === 'exam') parts.push(scope ? scope + ' (exam)' : 'Exam');
  else parts.push(scope ? scope + ' test' : 'Test');
  parts.push(right + ' of ' + of);
  parts.push(PROFILE_NAME[okPf(pf)]);
  parts.push(Number.isInteger(lv) && lv >= 1 && lv <= 4 ? 'with letter tiles (' + LEVEL_NAME[lv] + ')' : 'keyboard');
  if (hr > 0) parts.push('heard again ' + (hr === 1 ? 'once' : hr + ' times'));
  if (hn > 0) parts.push(hn + ' first-letter hint' + (hn === 1 ? '' : 's'));
  if (pk > 0) parts.push(pk + ' peek' + (pk === 1 ? '' : 's'));
  return parts.join(' · ');
}
export const RECOMMENDED = (year) => 'Recommended for Year ' + year;
export const SAVED = (name) => 'Saved. ' + name + ' will see this next time.';
