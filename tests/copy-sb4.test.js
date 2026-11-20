// SB4-WP5: the words a child reads. The string literals of the child's screens never use a failure word, a cross or an
// American spelling, and an instruction is short. Identifiers and comments do not count; only what is in quotes.
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as A from '../site/js/assess-doc.js';

const file = (p) => fileURLToPath(new URL('../site/js/' + p, import.meta.url));

/** The text of every string literal (and the text parts of a template literal) in a JS source. */
export function literalsOf(src) {
  const out = [];
  const n = src.length;
  let i = 0;
  let prev = ''; // the last significant character outside a literal or comment
  const stack = []; // template literals being read: the brace depth at which each ${ opened
  let depth = 0;
  const regexOk = () => prev === '' || '(,=:[!&|?{};+-*%<>~^'.includes(prev) || prev === '\n';
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i += 1; continue; }
    if (c === '/' && d === '*') { i = src.indexOf('*/', i + 2); i = i < 0 ? n : i + 2; continue; }
    if (c === '\'' || c === '"') {
      let s = '';
      i += 1;
      while (i < n && src[i] !== c) { if (src[i] === '\\') { s += src[i + 1] === 'n' ? ' ' : src[i + 1]; i += 2; } else { s += src[i]; i += 1; } }
      i += 1;
      out.push(s);
      prev = 'x';
      continue;
    }
    if (c === '`' || (c === '}' && stack.length && stack[stack.length - 1] === depth)) {
      if (c === '}') { stack.pop(); depth -= 1; }
      let s = '';
      i += 1;
      while (i < n && src[i] !== '`' && !(src[i] === '$' && src[i + 1] === '{')) { if (src[i] === '\\') { s += src[i + 1]; i += 2; } else { s += src[i]; i += 1; } }
      out.push(s);
      if (src[i] === '$') { stack.push(depth + 1); depth += 1; i += 2; prev = '{'; } else { i += 1; prev = 'x'; }
      continue;
    }
    if (c === '/' && regexOk()) { // a regular expression literal
      i += 1;
      let cls = false;
      while (i < n && (src[i] !== '/' || cls)) { if (src[i] === '\\') i += 1; else if (src[i] === '[') cls = true; else if (src[i] === ']') cls = false; i += 1; }
      i += 1;
      while (/[a-z]/.test(src[i] || '')) i += 1;
      prev = 'x';
      continue;
    }
    if (c === '{') depth += 1;
    if (c === '}') depth -= 1;
    if (!/\s/.test(c)) prev = c;
    i += 1;
  }
  return out;
}

const lits = (f) => literalsOf(readFileSync(file(f), 'utf8'));
// A one-word literal is a class, an attribute or a key, never a sentence; markup is checked without its tags.
const text = (s) => s.replace(/<[^>]*>/g, ' ');
const sentences = (f) => lits(f).map(text).filter((s) => /\s/.test(s.trim()) || /^[A-Z]/.test(s.trim()));

// Older text in files this package may not change, reported to the director rather than hidden: the About page for grown-ups
// ("for each wrong guess", "a wrong answer there"), My word numbers ("wrong letter") and the word-group form's remove chip (a cross).
const KNOWN = {
  'views.js': ['for each wrong guess', 'a wrong answer there'],
  'words-views.js': ['wrong letter', ' ×</button>'],
};
const known = (f, s) => (KNOWN[f] || []).some((k) => s.includes(k));

const ALL = ['assess-doc.js', 'assess-views.js', 'tray.js', 'tiles-doc.js', 'child-doc.js', 'play.js', 'views.js', 'study-views.js', 'games-views.js', 'words-views.js', 'scan-doc.js', 'scan-views.js', 'teach-doc.js', 'role-doc.js', 'info-doc.js', 'set-doc.js', 'practice-doc.js', 'own-views.js', 'results-views.js', 'lists-doc.js', 'set-views.js', 'child-views.js', 'front-views.js', 'grownups-views.js']; // R4: child-views, front-views; own, results, lists: SB5 WP-E; set-views: SB5 WP-D; scan-*: SB4-WP8, teach-*: SB4-WP11, role, info, set, practice: SB5 WP-A2
const STRICT = ['assess-views.js', 'tray.js', 'assess-doc.js', 'scan-doc.js', 'scan-views.js'];

test('the literal scanner reads quotes, templates and skips comments and regular expressions', () => {
  assert.deepEqual(literalsOf("const a = 'one'; // 'no'\nconst b = \"two\"; /* 'no' */ const c = `x${'in'}y`; const r = /['\"]/g;"), ['one', 'two', 'x', 'in', 'y']);
});

for (const f of ALL) {
  test(f + ': no wrong, fail or incorrect in a string', () => {
    for (const s of sentences(f)) if (!known(f, s)) assert.doesNotMatch(s, /\b(wrong|fail\w*|incorrect)\b/i, f + ': ' + s);
  });
  test(f + ': no cross', () => {
    for (const s of lits(f)) if (!known(f, s)) assert.ok(!s.includes('×') && !/&times;|&#215;/.test(s), f + ': ' + s);
  });
  test(f + ': British spellings', () => {
    for (const s of sentences(f)) {
      assert.doesNotMatch(s, /(?<![-_.#\w])(color|gray|practicing|favorite|center)(?![-_\w])/i, f + ': ' + s);
      assert.doesNotMatch(s, /\b(?!(?:size|prize|seize|maize|autocapitalize)\b)\w+ize\b/, f + ': ' + s);
    }
  });
}
for (const f of STRICT) {
  test(f + ': no mistake, late, lost or error in a string', () => {
    for (const s of sentences(f)) assert.doesNotMatch(s, /\b(mistake|late|lost|error)\b/i, f + ': ' + s);
  });
}

// ---- the child's instructions are short: at most 8 words to a sentence (lists excepted) ----
const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
const parts = (s) => s.split(/(?<=[.!?])\s+/).filter(Boolean);
// assess-doc.js's exact child strings, with a count filled in wherever a number goes
const FROM_DOC = () => {
  const out = [];
  for (const kind of A.KINDS) for (const pf of A.PROFILES) {
    out.push(...A.readyLines(kind, pf, 10).lines, A.readyLines(kind, pf, 10).button);
    for (const weekly of [false, true]) for (const right of [0, 3, 7, 10]) out.push(...[A.endLines(kind, pf, { right, of: 10, toPractise: 10 - right }, { weekly })].flatMap((e) => [e.head, ...e.lines]));
  }
  for (const k of [1, 2, 3]) out.push(A.heardLine(k));
  out.push(A.progressLine(3, 10), A.REST.head, A.REST.line, A.REST.button, A.RIGHT, A.NEARLY_QUIZ, A.FINISH.hint, A.FINISH.button, A.WAIT.line, A.WAIT.button,
    A.SENTENCE_BUTTON, A.HINT_BUTTON, A.examHomeLine('Big test'), A.examLater('Exam', 'Tue 10 Nov'), A.EXAM_DONE);
  return [...new Set(out)];
};

test('every child sentence in assess-doc.js is at most 8 words', () => {
  const long = [];
  for (const s of FROM_DOC()) for (const p of parts(s)) if (words(p) > 8) long.push(words(p) + ': ' + p);
  assert.deepEqual(long, []);
});
test('the runner\'s own words are few and short', () => {
  const own = lits('assess-views.js').map(text).filter((s) => /^[A-Z][a-z]+( [a-z]+)*\.?$/.test(s.trim()) && !/^(Hear|Spell)/.test(s.trim()) || /^(Hear again|Hear the word|Spell the word)$/.test(s.trim()));
  assert.ok(own.length >= 5, 'found the runner\'s button words: ' + own.join(' | '));
  for (const s of own) assert.ok(words(s) <= 8, s);
});
