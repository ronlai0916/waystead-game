// SB6 (TRS TR-73, WP-10): the copy test for every SB6 string source.
// Scope: every string literal in the files the SB6 work packages own (child and grown-up). A file that does not exist yet (a skeleton a later WP creates) is skipped,
// so the test goes live for it the moment it lands; `scope lists` below says which files were scanned.
// Banned words come from TR-73 and the physician's list (reviews/EXPERT-PANEL-input.md section 3). Spelling word data (curriculum.json, builder.json) is not UI copy and is not scanned.
// Today's offenders (code that an SB6 WP rewrites) are in KNOWN with the WP that fixes them; a KNOWN entry that no longer matches anything fails ("remove it").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { literalsOf } from './copy-sb4.test.js';

const path = (f) => fileURLToPath(new URL('../site/js/' + f, import.meta.url));
const lits = (f) => literalsOf(readFileSync(path(f), 'utf8'));
// A one-word literal is a class, an attribute or a key, never a sentence; markup is checked without its tags (as copy-sb4.test.js).
const text = (s) => s.replace(/<[^>]*>/g, ' ');
const sentences = (f) => lits(f).map(text).filter((s) => /\s/.test(s.trim()) || /^[A-Z]/.test(s.trim()));

// ---- scope lists (TRS section 8: the files each WP owns, JavaScript only) ----
/** What a child reads (Step by step screens, Peek, builder, child chrome, the games and the test). */
export const CHILD_FILES = ['sbs-views.js', 'tray.js', 'child-views.js', 'child-doc.js', 'peek.js', 'games-views.js', 'play.js', 'study-views.js', 'assess-views.js', 'assess-doc.js', 'builder-views.js', 'sentence-doc.js', 'pictures-views.js'];
/** The Step by step child's own screens: also bans "special", a count of tries, "Try harder" and a year group. */
export const SBS_CHILD_FILES = ['sbs-views.js', 'sbs-rules.js', 'ladder-doc.js', 'peek.js', 'builder-views.js', 'sentence-doc.js'];
/** What a grown-up reads. */
export const ADULT_FILES = ['setup-views.js', 'set-views.js', 'set-doc.js', 'grownups-views.js', 'grownups-doc.js', 'role-doc.js', 'sbs-report-doc.js', 'sbs-week-doc.js', 'pictures-doc.js', 'own-views.js'];
/** Both or neither (rules and data files with text in them). */
export const OTHER_FILES = ['sbs-rules.js', 'ladder-doc.js', 'peek-doc.js', 'rows-doc.js', 'session-doc.js', 'words-views.js', 'study-doc.js', 'front-doc.js', 'words-doc.js', 'setup-doc.js', 'grownups-data.js', 'pictures-data.js', 'own-data.js', 'ui.js'];
export const SCOPE = [...new Set([...CHILD_FILES, ...SBS_CHILD_FILES, ...ADULT_FILES, ...OTHER_FILES])].filter((f) => existsSync(path(f)));

// ---- the banned lists ----
// TR-73 "wrong, fail, failed, incorrect, mistake, late, lost, error" (whole words, case-insensitive)
const BAD_WORDS = /\b(wrong|fail(?:s|ed|ing|ure)?|incorrect|mistakes?|late|lost|errors?)\b/i;
// The no-claim list (TR-73, the physician): therapy ... "helps focus". "treat"/"treats" whole words only, so "street" and "retreat" pass.
const CLAIM_WORDS = /\b(therapy|therapeutic|treatment|treat|treats|intervention|clinical|clinically|proven|evidence-based|diagnose|diagnosed|diagnosis|dyslexia|ADHD|autism|ASD|SEN|cure|improves|calms|calming|brain training|rewires|healthy screen time|eye-safe|sleep-friendly|sleep mode|blue light|helps focus)\b/i;
// The child must never meet a label: these are checked case-sensitively as well as above (so "sen" inside a name never trips them).
const LABELS = /\b(ASD|ADHD|SEN|SENCo|autism|autistic|dyslexia|diagnosis|diagnosed|disorder)\b/;
const SPECIAL = /\bspecial\b/i;
const TRIES = /\b\d+\s+(tries|goes|attempts|slips|wrong)\b|\btries so far\b|\bnumber of tries\b|\bTry harder\b|\bNot good enough\b/i;
const YEAR_N = /\bYear\s*[1-6]\b/;
const PEEP = /\bpeep(s|ing|ed)?\b/i;
const DESCRIPTION = /find spelling hard/i;

// ---- KNOWN: today's offenders, each with the reason and the WP that clears it ----
// Format: file -> [{ has: substring of the literal, why }]. One entry covers every literal that contains `has`.
// A KNOWN entry nothing matches fails the test, so the list shrinks as the WPs land.
const KNOWN = {
};
const knownFor = (f, s) => (KNOWN[f] || []).find((k) => s.includes(k.has));
const hits = new Map(); // f + has -> true
function offenders(f, re, list = sentences(f)) {
  const out = [];
  for (const s of list) {
    if (!re.test(s)) continue;
    const k = knownFor(f, s);
    if (k) { hits.set(f + '|' + k.has, true); continue; }
    out.push(s);
  }
  return out;
}

test('scope lists: which SB6 source files exist and are scanned', () => {
  assert.ok(SCOPE.length >= 15, 'scanned: ' + SCOPE.join(', '));
  console.log('# copy-sb6 scans ' + SCOPE.length + ' files: ' + SCOPE.join(' '));
});

test('the literal scanner finds the strings of a file (a self-check on a real file)', () => {
  assert.ok(sentences('child-views.js').length > 20);
});

for (const f of SCOPE) {
  test(f + ': no wrong, fail, incorrect, mistake, late, lost or error (whole words)', () => {
    // play.js: "lost" is a CSS state name, not copy (exempted by name, TR-73)
    const re = f === 'play.js' ? /\b(wrong|fail(?:s|ed|ing|ure)?|incorrect|mistakes?|late|errors?)\b/i : BAD_WORDS;
    assert.deepEqual(offenders(f, re), [], f);
  });
  test(f + ': no therapy, treatment, diagnosis, proven or other claim words', () => {
    assert.deepEqual(offenders(f, CLAIM_WORDS), [], f);
  });
  test(f + ': "Peek", never "Peep"', () => {
    assert.deepEqual(offenders(f, PEEP, lits(f).map(text)), [], f);
  });
  test(f + ': "find spelling hard" only in the grown-up description', () => {
    const bad = offenders(f, DESCRIPTION, lits(f).map(text)).filter((s) => !/^\s*For children who find spelling hard\./.test(s));
    assert.deepEqual(bad, [], f);
    if (!ADULT_FILES.includes(f)) assert.deepEqual(offenders(f, DESCRIPTION, lits(f).map(text)), [], f + ' is not a grown-up file');
  });
}

for (const f of CHILD_FILES.filter((x) => SCOPE.includes(x))) {
  test(f + ' (child): no ASD, ADHD, SEN, autism, dyslexia or diagnosis word on a child screen', () => {
    assert.deepEqual(offenders(f, LABELS), [], f);
  });
}

for (const f of SBS_CHILD_FILES.filter((x) => SCOPE.includes(x))) {
  test(f + ' (Step by step child): no "special", count of tries, "Try harder" or year group', () => {
    assert.deepEqual(offenders(f, SPECIAL), [], f + ' special');
    assert.deepEqual(offenders(f, TRIES), [], f + ' tries');
    assert.deepEqual(offenders(f, YEAR_N), [], f + ' year group');
  });
}

// ---- at most 8 words to a child instruction (sentences; lists of names excepted) ----
const words = (s) => s.trim().split(/\s+/).filter((x) => x !== '·' && x !== '–').length;
const parts = (s) => s.split(/(?<=[.!?])\s+/).filter(Boolean);
// Markup, attributes, selectors, ids, urls and CSS are code, not an instruction a child reads.
const isCode = (s) => /[{}=;]|=>|\/\/|\bdata-|\baria-|\bclass\b|^\s*[#.\[]|\.(js|css|json|png|svg|mp3)\b|^\s*[a-z]+[-_:][a-z-_:]+\s*$/.test(s);
const LONG_KNOWN = []; // [{ f, has, why }]: an instruction the design draws longer
test('child instructions: every sentence is 8 words or fewer (Step by step and builder child files)', () => {
  const bad = [];
  for (const f of SBS_CHILD_FILES.filter((x) => SCOPE.includes(x))) {
    for (const s of lits(f).map(text)) {
      if (!/\s/.test(s.trim()) || isCode(s)) continue;
      for (const p of parts(s)) if (words(p) > 8 && !LONG_KNOWN.some((k) => k.f === f && p.includes(k.has))) bad.push(f + ': ' + p);
    }
  }
  assert.deepEqual(bad, []);
});

test('the child job sentences and the step lines a child reads are 8 words or fewer (today, all child files)', async () => {
  const C = await import('../site/js/child-doc.js');
  const bad = [];
  for (const s of Object.values(C.JOB_SENTENCE)) for (const p of parts(s)) if (words(p) > 8) bad.push(p);
  assert.deepEqual(bad, []);
});

// ---- words read through the exports once the WPs land ----
test('exported child copy objects (STONE_TEXT, STEP_TEXT, JOB_SENTENCE) pass the lists', async () => {
  const mods = [];
  for (const [f, names] of [['sbs-views.js', ['STONE_TEXT', 'STEP_TEXT']], ['child-doc.js', ['JOB_SENTENCE']], ['study-doc.js', ['STEP_TEXT']], ['sbs-rules.js', ['STONE_TEXT']]]) {
    if (!existsSync(path(f))) continue;
    const m = await import('../site/js/' + f);
    for (const n of names) if (m[n]) mods.push([f + '.' + n, m[n]]);
  }
  assert.ok(mods.length >= 1);
  const flat = (v) => (typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(flat) : []);
  const bad = [];
  for (const [n, v] of mods) for (const s of flat(v)) if (BAD_WORDS.test(s) || CLAIM_WORDS.test(s) || PEEP.test(s)) bad.push(n + ': ' + s);
  assert.deepEqual(bad, []);
});

// ---- the self-tests: the lists catch what they should and let the right words through ----
test('the lists: whole words only', () => {
  for (const s of ['That is wrong.', 'Failed', 'a mistake', 'too late', 'lost', 'an error', 'Try the treat', 'It treats', 'a cure', 'Calms you', 'blue light', 'helps focus']) assert.ok(BAD_WORDS.test(s) || CLAIM_WORDS.test(s), s);
  for (const s of ['Down the street', 'a retreat', 'translate it', 'a secure place', 'chocolate', 'slate', 'terror', 'senses', 'The sentence', 'Peek']) assert.ok(!BAD_WORDS.test(s) && !CLAIM_WORDS.test(s), s);
  assert.ok(PEEP.test('Peep') && !PEEP.test('Peek') && !PEEP.test('peeped at'.replace('peeped', 'peeked')));
  assert.ok(SPECIAL.test('a special word') && !SPECIAL.test('specialist'));
  assert.ok(LABELS.test('ADHD mode') && !LABELS.test('sensible') && !LABELS.test('Sentence'));
});

test('KNOWN entries are still needed (remove one when its WP has landed)', () => {
  // runs last in file order: every scan above has recorded its hits
  const stale = [];
  for (const [f, list] of Object.entries(KNOWN)) {
    if (!SCOPE.includes(f)) continue;
    for (const k of list) if (!hits.has(f + '|' + k.has)) stale.push(f + ': ' + k.has);
  }
  assert.deepEqual(stale, []);
});
