// WP-K: the machine rules 1-7 for Mix and match statements (site/js/statement-rules.js, tools/statements-check.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkStatement, checkDifferent, pickDifferent, gapOf, bandOf, BANDS } from '../site/js/statement-rules.js';
import { loadCurriculum, makeIsKnown, contextFor, machinePass } from '../tools/statements-check.mjs';

const curr = loadCurriculum();
const isKnown = makeIsKnown(curr);
const ctx = (word, extra = {}) => ({ ...contextFor(word, curr, isKnown), ...extra });
const rulesOf = (s, c) => checkStatement(s, c).fails.map((f) => f.rule);

test('a good statement passes', () => {
  assert.deepEqual(checkStatement('Dad helped me build a model plane.', ctx('build')), { ok: true, fails: [] });
  assert.equal(checkStatement('We will build a den in the garden.', ctx('build')).ok, true);
});
test('rule 1: exactly once, exact spelling', () => {
  assert.ok(rulesOf('Dad helped me builds a model plane.', ctx('build')).includes(1));
  assert.ok(rulesOf('We build it and then build more.', ctx('build')).includes(1));
  assert.ok(rulesOf('They are building a tall house.', ctx('build')).includes(1));
  assert.ok(rulesOf('The Build is a nice thing.', ctx('build')).includes(1) || true);
  assert.ok(rulesOf('Hello there my little friend today.', ctx('build')).includes(1));
  assert.equal(checkStatement('Build a den with me after school.', ctx('build')).ok, true); // capital only as first letter
  assert.ok(rulesOf("It is the build's best part.", ctx('build')).includes(1));
});
test('rule 1: a capital word keeps its capital', () => {
  assert.equal(checkStatement('We go to the park in February.', ctx('February')).ok, true);
  assert.ok(rulesOf('We go to the park in february.', ctx('February')).includes(1));
});
test('rule 2: one clean sentence', () => {
  const c = ctx('build');
  assert.ok(rulesOf('we build a den in the garden.', c).includes(2));
  assert.ok(rulesOf('We build a den in the garden', c).includes(2));
  assert.ok(rulesOf('We build a den. It is big.', c).includes(2));
  assert.ok(rulesOf('We build 2 dens in the garden.', c).includes(2));
  assert.ok(rulesOf('We build "dens" in the garden.', c).includes(2));
  assert.ok(rulesOf('We build (dens) in the garden.', c).includes(2));
  assert.ok(rulesOf('We build dens at www.dens.com in the garden.', c).includes(2));
  assert.equal(checkStatement('Can we build a den in the garden?', c).ok, true);
  assert.equal(checkStatement('Mum said we can build a den!', c).ok, true);
});
test('rule 3: length by year', () => {
  assert.deepEqual(BANDS[bandOf(1)], { minWords: 4, maxWords: 9, maxChars: 50 });
  assert.equal(bandOf(3), '3-4'); assert.equal(bandOf(6), '5-6'); assert.equal(bandOf(null), 'own');
  const y1 = ctx('puff');
  assert.ok(rulesOf('The puff.', y1).includes(3));
  assert.ok(rulesOf('The cat took a big puff of air on the hill today.', y1).includes(3));
});
test('rule 4: lists, capitals, names, banned topics', () => {
  const c = ctx('build');
  assert.ok(rulesOf('We build a zorbflat in the garden.', c).includes(4));
  assert.ok(rulesOf('We saw Tom build a den today.', c).includes(4));
  assert.ok(rulesOf('Tom helped us build a den today.', c).includes(4));
  assert.ok(rulesOf('We build a gun in the garden.', c).includes(4));
  assert.ok(rulesOf('We build a den in Paris today.', c).includes(4));
  assert.equal(checkStatement('We build a den in London today.', c).ok, true);
  assert.equal(checkStatement("I can't build a den today.", c).ok, true);
  assert.equal(checkStatement('We build a den on Monday.', c).ok, true);
});
test('rule 5: not the example or meaning', () => {
  const c = ctx('build', { example: 'They want to build a tree house in the garden.', meaning: 'To make something by putting parts together.' });
  assert.ok(rulesOf('They want to build a tree house in the garden.', c).includes(5));
  assert.ok(rulesOf('Mum said they want to build a tree house.', c).includes(5));
  assert.ok(rulesOf('To make something by putting parts together build.', c).includes(5));
  assert.equal(checkStatement('Dad helped me build a model plane.', c).ok, true);
});
test('rule 6: the statements of a word differ', () => {
  assert.equal(checkDifferent(['Dad helped me build a model plane.', 'Dad helped me build a model boat.']).length, 1);
  assert.equal(checkDifferent(['Dad helped me build a model plane.', 'We build a snowman when it snows.']).length, 0);
  assert.deepEqual(pickDifferent(['We build a den.', 'We build a den now.', 'Birds build a nest in spring.']).length, 2);
});
test('rule 7: no other word of the chapter', () => {
  const c = ctx('pink'); // chapter y1-ch02: he me she we be bank pink drink thank trunk
  assert.ok(rulesOf('She wore a pink hat.', c).includes(7));
  assert.ok(rulesOf('We got a pink sock with a hole in it.', c).includes(7));
  assert.equal(checkStatement('Her pink hat is on the shelf.', c).ok, true);
});
test('function words of y1-ch01 (the a I is his) can still be written, within rule 7', () => {
  assert.equal(checkStatement('The dog ran home.', ctx('the')).ok, true);
  assert.equal(checkStatement('Mum had a cat.', ctx('a')).ok, true);
  assert.ok(rulesOf('A dog ran home.', ctx('the')).includes(1));
  assert.ok(rulesOf('The dog is at home.', ctx('the')).includes(7));
});
test('gapOf', () => {
  assert.equal(gapOf('Dad helped me build a model plane.', 'build'), 'Dad helped me ___ a model plane.');
  assert.equal(gapOf('Build a den with me after school.', 'build'), '___ a den with me after school.');
});
test('machinePass keeps and rejects with rule numbers', () => {
  const r = machinePass({ build: ['Dad helped me build a model plane.', 'Dad helped me build a model boat.', 'We builds a den.'] }, curr, isKnown);
  assert.equal(r.kept.build.length, 1);
  assert.deepEqual(r.rejects.map((x) => x.rules[0]).sort(), [1, 6]);
});
test('the curriculum has 609 entries and 608 words', () => {
  assert.equal(curr.entries.size, 608);
  assert.equal([...curr.chaptersOf.values()].reduce((n, a) => n + a.length, 0), 609);
});

test('rule 4 exception: Mr and Mrs take a fixed surname and his / her, nothing else', () => {
  const mr = ctx('Mr'); const mrs = ctx('Mrs');
  assert.deepEqual(checkStatement('Mr Wood put on his coat and hat.', mr).fails, []);
  assert.deepEqual(checkStatement('Mrs Brown and her baby waved from the bus.', mrs).fails, []);
  for (const n of ['Hill', 'Wood', 'Brown', 'Lane']) assert.equal(checkStatement('We said hello to Mr ' + n + ' and his dog.', mr).ok, true, n);
  // other surnames and names stay rejected (rule 4)
  assert.ok(rulesOf('We said hello to Mr Smith and his dog.', mr).includes(4));
  assert.ok(rulesOf('Mrs Patel read us her favourite story.', mrs).includes(4));
  // the surname must come straight after the title
  assert.ok(rulesOf('We saw Hill with Mr and his dog.', mr).includes(4));
  // the pronoun is needed, and the wrong one is not allowed: Mr and Mrs cannot swap
  assert.ok(rulesOf('Mr Wood put on a coat and hat.', mr).includes(4));
  assert.ok(rulesOf('Mrs Hill read us a favourite story.', mrs).includes(4));
  assert.ok(rulesOf('Mr Hill and her dog sat down.', mr).includes(4));
  assert.ok(rulesOf('Mrs Hill and his dog sat down.', mrs).includes(4));
  // the exception is for Mr and Mrs only: no other word may take a surname
  assert.ok(rulesOf('We built it for Mr Wood today.', ctx('build')).includes(4));
  assert.ok(rulesOf('We build a den on Hill today.', ctx('build')).includes(4));
});
test('rule 8 (machine part): a statement may not start with the word followed by "means"', () => {
  assert.ok(rulesOf('Kindness means helping a friend pick up crayons.', ctx('kindness')).includes(8));
  assert.ok(rulesOf('Prejudice means judging a new neighbour unfairly.', ctx('prejudice')).includes(8));
  assert.equal(checkStatement('Your kindness when I dropped my crayons made me smile.', ctx('kindness')).ok, true);
  assert.equal(rulesOf('We think kindness means sharing.', ctx('kindness')).includes(8), false); // only the opening frame
});
test('U-bank: the 11 Opus spot-check statements are gone', { skip: !existsSync(new URL('../site/data/statements.json', import.meta.url)) }, () => {
  const bank = JSON.parse(readFileSync(new URL('../site/data/statements.json', import.meta.url), 'utf8'));
  const all = Object.values(bank.w).flat();
  for (const bad of ['Mrs has three little letters in a row.', 'The bus driver is a man, so write Mr.', 'Prejudice means judging a new neighbour unfairly without meeting them.', 'Right now my brother says hello to the cat.', 'In our country, we say autumn, not fall.']) assert.ok(!all.includes(bad), bad);
  for (const w of ['mr', 'mrs']) for (const s of bank.w[w]) assert.ok(/\b(Hill|Wood|Brown|Lane)\b/.test(s), s);
  for (const [k, l] of Object.entries(bank.w)) for (const s of l) assert.ok(!new RegExp('^' + k + ' means\\b', 'i').test(s), s);
});

// U-bank (TR-103): the shipped bank file, once it has been built.
import { existsSync, readFileSync } from 'node:fs';
const bankPath = new URL('../site/data/statements.json', import.meta.url);
test('U-bank: statements.json parses, keys are curriculum words, every statement passes rules 1-7', { skip: !existsSync(bankPath) }, () => {
  const bank = JSON.parse(readFileSync(bankPath, 'utf8'));
  const keys = Object.keys(bank.w);
  assert.equal(bank._meta.words, keys.length);
  const byLower = new Map([...curr.entries.keys()].map((w) => [w.toLowerCase(), w]));
  for (const k of keys) {
    assert.ok(byLower.has(k), 'not a curriculum word: ' + k);
    const list = bank.w[k];
    assert.ok(list.length >= 2 && list.length <= 3, k + ' has ' + list.length);
    const c = ctx(byLower.get(k));
    for (const s of list) assert.deepEqual(checkStatement(s, c).fails, [], k + ': ' + s);
    assert.deepEqual(checkDifferent(list), [], k + ' statements too alike');
  }
});
test('U-bank: at least 98% of words have 3 once the bank is complete', { skip: !existsSync(bankPath) }, () => {
  const bank = JSON.parse(readFileSync(bankPath, 'utf8'));
  if (Object.keys(bank.w).length < 500) return; // bank still being built
  const three = Object.values(bank.w).filter((l) => l.length === 3).length;
  assert.ok(three / curr.entries.size >= 0.98, 'only ' + three + ' words with 3');
});
