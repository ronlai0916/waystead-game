import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { isWord, wordTier, findEdge, edgesOf, loadWordGraph, childOf, NO_WORD } from '../site/js/engine/words.js';
import { TIERS, listTier } from '../site/js/engine/levels.js';
import { words as all, starWords, LIST_IDS, ROOT } from './helpers.js';

const design = ROOT + '../wordbright-design/wordlist/';
const FULL = listTier('full');

test('colour is a word, color is not', () => {
  assert.equal(isWord('colour', all, FULL), true);
  assert.equal(isWord('color', all), false);
});

test('every Star word is in every list', () => {
  for (const id of LIST_IDS) {
    const missing = starWords.filter((s) => !isWord(s.word, all, listTier(id))).map((s) => s.word);
    assert.deepEqual(missing, [], `missing from ${id}`);
  }
});

test('removed words (excluded_full.txt) are in no list', () => {
  const removed = readFileSync(design + 'excluded_full.txt', 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t')[0]);
  assert.ok(removed.length > 100);
  assert.ok(removed.includes('arse'));
  assert.deepEqual(removed.filter((w) => isWord(w, all)), []);
});

test('prefixes, odd input and length limits', () => {
  assert.equal(isWord('colou', all), false);
  assert.equal(isWord('colours', all), true);
  assert.equal(isWord('colourss', all), false);
  assert.equal(isWord('', all), false);
  assert.equal(isWord('a', all), false);
  assert.equal(isWord('Colour', all), false);
  assert.equal(isWord('col our', all), false);
  assert.equal(isWord(42, all), false);
});

test('walking the graph by hand', () => {
  const c = findEdge(all, 0, 'c');
  assert.ok(c >= 0);
  const next = edgesOf(all, childOf(all.edges[c])).map((e) => e.letter);
  assert.ok(next.includes('o') && next.includes('a'));
  assert.equal(findEdge(all, 0, '{'), -1);
});

test('a file that is not a word graph is refused', () => {
  assert.throws(() => loadWordGraph(new Uint8Array(20)), /Not a Wordbright word graph/);
});

test('only words_all.dawg is shipped', () => {
  const files = readdirSync(ROOT + 'site/data/').filter((f) => f.endsWith('.dawg'));
  assert.deepEqual(files, ['words_all.dawg']);
});

// words_all.dawg: one graph for every list (C3).
const listWords = Object.fromEntries(LIST_IDS.map((id) => [id, readFileSync(design + `words_${id}.txt`, 'utf8').split('\n').filter(Boolean)]));

test('words_all: tiers follow the list order, and the lists grow', () => {
  assert.deepEqual(TIERS, LIST_IDS);
  assert.equal(all.words, listWords.xlarge.length);
  assert.equal(all.tierCounts.length, 5);
  assert.equal(all.tierCounts.reduce((a, b) => a + b, 0), all.words);
  assert.ok(all.tierCounts.every((n) => n > 0));
});

test('words_all at tier t holds exactly the words of list t', () => {
  for (const id of LIST_IDS) {
    const t = listTier(id);
    const inList = new Set(listWords[id]);
    assert.equal(all.tierCounts.slice(0, t + 1).reduce((a, b) => a + b, 0), inList.size, id);
    for (const w of listWords.xlarge) assert.equal(isWord(w, all, t), inList.has(w), `${w} at ${id}`);
  }
});

test('a word\'s tier is the smallest list it is in', () => {
  assert.equal(wordTier('build', all), 0);
  assert.equal(wordTier('color', all), NO_WORD);
  for (const id of LIST_IDS) {
    const t = listTier(id);
    const smaller = t ? new Set(listWords[LIST_IDS[t - 1]]) : new Set();
    const sample = listWords[id].filter((w) => !smaller.has(w)).slice(0, 200);
    for (const w of sample) assert.equal(wordTier(w, all), t, w);
  }
  assert.equal(isWord('library', all, 0, 6), false);
  assert.equal(isWord('build', all, 0, 6), true);
});
