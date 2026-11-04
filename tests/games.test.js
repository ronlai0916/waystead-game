// SB2-2: the four games (site/js/games-doc.js): right, wrong, the clean rule and
// what each records. Randomness is seeded. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as G from '../site/js/games-doc.js';
import * as R from '../site/js/spell-run.js';
import * as W from '../site/js/words-doc.js';

const MON = '2026-11-02';
const plus = (n) => W.addDays(MON, n);
const at = (day) => Date.parse(day + 'T12:00:00Z');
function seeded(seed = 7) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
function made(words = ['fruit', 'earth', 'heart'], test = plus(7)) {
  const r = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week', test, words, today: MON, now: at(MON) });
  return { d: r.doc, g: W.groupById(r.doc, 'g1') };
}
let n = 0;
const rec = (d, g, w, p, day = plus(1)) => G.recordPass(d, g, w, p, { id: 'x' + (++n), day, now: at(day) + n });
const typeAll = (run, letters) => [...letters].reduce((r, L) => R.typeLetter(r, L).run, run);
const entry = (word, chunks = [word], tricky, meaning = word + ' means this') => ({ word, chunks, tricky, meaning: { definition: meaning } });

// ---- Missing letters --------------------------------------------------------------------
test('Missing letters blanks the tricky letters when a word has them', () => {
  assert.deepEqual(G.blanksFor(entry('build', ['build'], 'ui')), [1, 2]);
});
test('Missing letters: otherwise one whole syllable, and each can come up', () => {
  const e = entry('different', ['dif', 'fer', 'ent']);
  const seen = new Set();
  const rand = seeded();
  for (let i = 0; i < 30; i += 1) seen.add(G.blanksFor(e, rand).join());
  assert.deepEqual([...seen].sort(), ['0,1,2', '3,4,5', '6,7,8']);
});
test('Missing letters: a one-part word loses its middle, never the whole word', () => {
  assert.deepEqual(G.blanksFor(entry('fruit')), [1, 2]);
  assert.deepEqual(G.blanksFor(entry('at')), [1]);
  for (const w of ['cat', 'tree', 'strength']) assert.ok(G.blanksFor(entry(w)).length < w.length, w);
});
test('Missing letters: right letters finish it clean', () => {
  const run = typeAll(G.newMissing('build', [1, 2]), 'ui');
  assert.equal(run.at, 2);
  assert.deepEqual(G.passOf(run), { tries: 0, clean: true });
});
test('Missing letters: a wrong letter stays out, counts, and the pass isn\'t clean', () => {
  const r1 = R.typeLetter(G.newMissing('build', [1, 2]), 'z');
  assert.equal(r1.hit, false);
  assert.equal(r1.run.at, 0);
  assert.deepEqual(G.passOf(typeAll(r1.run, 'ui')), { tries: 1, clean: false });
});

// ---- Unjumble ---------------------------------------------------------------------------
test('Unjumble: the same letters, never in order', () => {
  const rand = seeded();
  for (const w of ['fruit', 'heart', 'to', 'different']) {
    const j = G.jumble(w, rand);
    assert.notEqual(j.join(''), w);
    assert.equal([...j].sort().join(''), [...w].sort().join(''));
  }
});
test('Unjumble: a word of one letter repeated comes back rather than looping for ever', () => {
  assert.deepEqual(G.jumble('aa', seeded()), ['a', 'a']);
});
test('Unjumble: tapping in order is clean; a wrong tap isn\'t', () => {
  assert.deepEqual(G.passOf(typeAll(R.newRun('heart'), 'heart')), { tries: 0, clean: true });
  assert.deepEqual(G.passOf(typeAll(R.newRun('heart'), 'hxeart')), { tries: 1, clean: false });
});

// ---- Meaning match ----------------------------------------------------------------------
const ten = 'abcdefghij'.split('').map((c) => entry('word' + c));
test('Meaning match: rounds of 4, every word scored once', () => {
  const rounds = G.matchRounds(ten, [], seeded());
  assert.deepEqual(rounds.map((r) => r.cards.length), [4, 4, 4]);
  const scored = rounds.flatMap((r) => r.cards.filter((c) => c.scored).map((c) => c.word));
  assert.equal(scored.length, 10);
  assert.equal(new Set(scored).size, 10);
});
test('Meaning match: a short last round is filled with unscored words; each card once', () => {
  const rounds = G.matchRounds(ten, [], seeded());
  const last = rounds.at(-1);
  assert.equal(last.cards.filter((c) => !c.scored).length, 2);
  assert.equal(new Set(last.cards.map((c) => c.word)).size, 4);
  assert.deepEqual([...last.meanings].sort(), last.cards.map((c) => c.meaning).sort());
});
test('Meaning match: one word still makes 4 cards, from the spare words', () => {
  const r = G.matchRounds([entry('fruit')], ten, seeded());
  assert.equal(r.length, 1);
  assert.equal(r[0].cards.length, 4);
  assert.deepEqual(r[0].cards.filter((c) => c.scored).map((c) => c.word), ['fruit']);
});
test('Meaning match: right pairs are clean; a wrong pair marks the word chosen', () => {
  const [round] = G.matchRounds(ten.slice(0, 4), [], seeded());
  const [a, b, c, e] = round.cards;
  let s = G.newMatch();
  const miss = G.pickMatch(s, round, a.word, b.meaning);
  assert.equal(miss.hit, false);
  s = miss.state;
  for (const x of [a, b, c, e]) {
    const r = G.pickMatch(s, round, x.word, x.meaning);
    assert.equal(r.hit, true);
    s = r.state;
  }
  assert.equal(G.matchDone(s, round), true);
  const passes = G.matchPasses(s, round);
  assert.deepEqual(passes.find((p) => p.word === a.word), { word: a.word, tries: 1, clean: false, source: 'm' });
  assert.deepEqual(passes.find((p) => p.word === b.word), { word: b.word, tries: 0, clean: true, source: 'm' });
});
test('Meaning match: a matched card can\'t be matched again; unscored words aren\'t recorded', () => {
  const [round] = G.matchRounds(ten.slice(0, 2), ten.slice(2), seeded());
  let s = G.newMatch();
  for (const c of round.cards) s = G.pickMatch(s, round, c.word, c.meaning).state;
  assert.equal(G.pickMatch(s, round, round.cards[0].word, round.cards[0].meaning).hit, false);
  assert.equal(G.matchPasses(s, round).length, 2);
});

// ---- Quick-fire -------------------------------------------------------------------------
test('Quick-fire: right is clean, wrong isn\'t; capitals and spaces don\'t matter', () => {
  assert.deepEqual(G.quickPass('fruit', 'fruit'), { tries: 0, clean: true });
  assert.deepEqual(G.quickPass('February', ' february '), { tries: 0, clean: true });
  assert.deepEqual(G.quickPass('fruit', 'froot'), { tries: 1, clean: false });
});
test('Quick-fire: longer words get longer; time plays no part in a pass', () => {
  assert.ok(G.quickSeconds('accommodate') > G.quickSeconds('fruit'));
  assert.equal(G.quickPass.length, 2, 'it takes the word and the answer, and no time');
  const src = readFileSync(fileURLToPath(new URL('../site/js/games-views.js', import.meta.url)), 'utf8');
  const after = src.slice(src.indexOf('the timer only ever says this'));
  assert.match(after.slice(0, 200), /Take your time/);
  assert.doesNotMatch(after.slice(0, 200), /record|submit/, 'running out records nothing');
});

// ---- recording: exactly like the grid ----------------------------------------------------
test('each game\'s clean pass feeds the dots, the star and remembered', () => {
  let { d, g } = made(['fruit'], plus(9));
  d = rec(d, g, 'fruit', { tries: 0, clean: true }, plus(1));
  assert.equal(W.dots(d, g, 'fruit'), 1);
  assert.equal(W.cell(d, g, 'fruit', plus(1)), 'clean');
  assert.equal(W.starsOn(d, g, plus(1)), 1);
  d = rec(d, g, 'fruit', { tries: 0, clean: true }, plus(4));
  d = rec(d, g, 'fruit', { tries: 0, clean: true }, plus(8));
  assert.equal(W.isRemembered(d, 'fruit'), true);
});
test('a pass with mistakes: no dot, no star, and it doesn\'t count towards remembered', () => {
  let { d, g } = made(['fruit']);
  d = rec(d, g, 'fruit', { tries: 2, clean: false });
  assert.equal(W.dots(d, g, 'fruit'), 0);
  assert.equal(W.cell(d, g, 'fruit', plus(1)), 'todo');
  assert.deepEqual(W.goodDays(d, 'fruit'), []);
  assert.equal(W.groupProgress(d, g).tries, 2, 'the wrong letters show on the word\'s numbers');
});
test('a clean game after a slip that day is help, as on the grid', () => {
  let { d, g } = made(['fruit']);
  d = rec(d, g, 'fruit', { tries: 1, clean: false });
  d = rec(d, g, 'fruit', { tries: 0, clean: true });
  assert.equal(W.cell(d, g, 'fruit', plus(1)), 'help');
  assert.equal(W.dots(d, g, 'fruit'), 1);
});
test('the games record as practice with the game\'s mark', () => {
  let { d, g } = made(['fruit']);
  d = rec(d, g, 'fruit', { tries: 0, clean: true });
  const r = d.results.at(-1);
  assert.deepEqual([r.k, r.s, r.t, r.p, r.c, r.g], ['p', 'g', 0, 0, 1, 'g1']);
});
test('words back again join in and get their dots', () => {
  let { d, g } = made(['fruit']);
  d = { ...d, groups: { ...d.groups, g1: { ...d.groups.g1, back: ['earth'] } } };
  g = W.groupById(d, 'g1');
  assert.deepEqual(W.rows(g), ['fruit', 'earth']);
  d = rec(d, g, 'earth', { tries: 0, clean: true });
  assert.equal(W.dots(d, g, 'earth'), 1);
  const src = readFileSync(fileURLToPath(new URL('../site/js/games-views.js', import.meta.url)), 'utf8');
  assert.match(src, /const words = W\.rows\(g\);/, 'the games play every row');
});
test('after the test, a game mends a slipped word as a fix-up', () => {
  let { d, g } = made(['fruit'], plus(2));
  d = W.addTry(d, { id: 't', word: 'fruit', day: plus(2), group: 'g1', kind: 't', tries: 1, peeks: 0, clean: false, now: at(plus(2)) });
  d = rec(d, g, 'fruit', { tries: 0, clean: true }, plus(3));
  assert.equal(d.results.at(-1).k, 'f');
  assert.deepEqual(W.fixups(d, g), []);
});
// ---- Meaning match: stars and played, no dots ---------------------------------------------
const m = (d, g, w, day = plus(1), ok = true) => rec(d, g, w, { tries: ok ? 0 : 1, clean: ok, source: 'm' }, day);
test('Meaning match passes are marked as such', () => {
  const [round] = G.matchRounds(ten.slice(0, 4), [], seeded());
  let s = G.newMatch();
  for (const c of round.cards) s = G.pickMatch(s, round, c.word, c.meaning).state;
  assert.ok(G.matchPasses(s, round).every((p) => p.source === 'm'));
});
test('Meaning match earns no dot, however often it\'s played', () => {
  let { d, g } = made(['fruit']);
  for (const k of [1, 2, 3, 4]) d = m(d, g, 'fruit', plus(k));
  assert.equal(W.dots(d, g, 'fruit'), 0);
  assert.equal(W.readyForTest(d, g), false);
});
test('Meaning match earns the day\'s star, and the word counts as played', () => {
  let { d, g } = made(['fruit']);
  d = m(d, g, 'fruit');
  assert.equal(W.starsOn(d, g, plus(1)), 1);
  assert.equal(W.overall(d).practised, 1);
  assert.equal(W.groupProgress(d, g).words[0].status, 'practising');
});
test('a wrong pairing earns no star, and isn\'t a wrong letter', () => {
  let { d, g } = made(['fruit']);
  d = m(d, g, 'fruit', plus(1), false);
  assert.equal(W.starsOn(d, g, plus(1)), 0);
  assert.equal(W.groupProgress(d, g).tries, 0);
});
test('Meaning match is no first go and never counts towards remembered', () => {
  let { d, g } = made(['fruit'], plus(9));
  for (const k of [1, 4, 8]) d = m(d, g, 'fruit', plus(k));
  assert.equal(W.isRemembered(d, 'fruit'), false);
  assert.deepEqual(W.goodDays(d, 'fruit'), []);
  assert.equal(W.overall(d).firstGoes, 0);
});
test('the day\'s real first go is still to come after Meaning match', () => {
  let { d, g } = made(['fruit']);
  d = m(d, g, 'fruit');
  d = rec(d, g, 'fruit', { tries: 0, clean: true }, plus(1));
  assert.equal(W.cell(d, g, 'fruit', plus(1)), 'clean');
  assert.deepEqual(W.goodDays(d, 'fruit'), [plus(1)]);
  assert.equal(W.dots(d, g, 'fruit'), 1, 'the dot is the spelling game\'s');
});
test('a slip when spelled isn\'t hidden by a clean Meaning match', () => {
  let { d, g } = made(['fruit']);
  d = m(d, g, 'fruit');
  d = rec(d, g, 'fruit', { tries: 1, clean: false }, plus(1));
  assert.equal(W.cell(d, g, 'fruit', plus(1)), 'todo');
  assert.equal(W.overall(d).firstGoes, 1);
  assert.equal(W.overall(d).clean, 0);
});
test('Meaning match doesn\'t do a word for the day, or fill the grid round', () => {
  let { d, g } = made(['fruit']);
  d = m(d, g, 'fruit');
  assert.equal(W.doneOn(d, g, 'fruit', plus(1)), false);
  assert.deepEqual(W.gridLeft(d, g, plus(1)), ['fruit']);
});
test('Meaning match never mends a fix-up, nor spoils that day\'s', () => {
  let { d, g } = made(['fruit'], plus(2));
  d = W.addTry(d, { id: 't2', word: 'fruit', day: plus(2), group: 'g1', kind: 't', tries: 1, peeks: 0, clean: false, now: at(plus(2)) });
  d = m(d, g, 'fruit', plus(3));
  assert.equal(d.results.at(-1).k, 'p');
  assert.deepEqual(W.fixups(d, g), ['fruit']);
  assert.equal(W.jobFor(d, g, plus(3)), 'fixups');
  d = rec(d, g, 'fruit', { tries: 0, clean: true }, plus(3));
  assert.deepEqual(W.fixups(d, g), [], 'the fix-up after it still counts as the first go');
});
test('all of that survives folding', () => {
  let { d, g } = made(['fruit'], plus(9));
  for (const k of [1, 4, 8]) d = m(d, g, 'fruit', plus(k));
  const big = { ...d, groups: { ...d.groups, pad: { name: 'x'.repeat(60000), start: MON, test: plus(7), words: ['a'], back: [], at: at(MON) } } };
  const small = W.normalise(W.trim(big, at(plus(9))));
  assert.equal(small.results.length, 0);
  assert.equal(W.starsOn(small, g, plus(1)), 1);
  assert.equal(W.dots(small, g, 'fruit'), 0);
  assert.equal(W.isRemembered(small, 'fruit'), false);
  assert.equal(W.overall(small).firstGoes, 0);
  assert.equal(W.overall(small).practised, 1);
});
test('the help text says so', () => {
  assert.match(G.GAMES.match.line, /no dot/);
  assert.match(readFileSync(fileURLToPath(new URL('../site/js/views.js', import.meta.url)), 'utf8'), /Meaning match can earn a star but no dot/);
});

test('every game is registered for Game day, in order', () => {
  assert.deepEqual(G.GAME_IDS, ['missing', 'unjumble', 'match', 'quick']);
  for (const id of G.GAME_IDS) assert.ok(G.GAMES[id].title && G.GAMES[id].line, id);
});
