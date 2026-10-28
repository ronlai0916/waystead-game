import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isWord, findEdge, edgesOf, loadWordGraph } from '../site/js/engine/words.js';
import { graphs, starWords, LIST_IDS, ROOT } from './helpers.js';

const design = ROOT + '../wordbright-design/wordlist/';

test('colour is a word, color is not (full list)', () => {
  assert.equal(isWord('colour', graphs.full), true);
  assert.equal(isWord('color', graphs.full), false);
});

test('every Star word is in every list', () => {
  for (const id of LIST_IDS) {
    const missing = starWords.filter((s) => !isWord(s.word, graphs[id])).map((s) => s.word);
    assert.deepEqual(missing, [], `missing from ${id}`);
  }
});

test('removed words (excluded_full.txt) are in no list', () => {
  const removed = readFileSync(design + 'excluded_full.txt', 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t')[0]);
  assert.ok(removed.length > 100);
  assert.ok(removed.includes('arse'));
  for (const id of LIST_IDS) {
    const found = removed.filter((w) => isWord(w, graphs[id]));
    assert.deepEqual(found, [], `found in ${id}`);
  }
});

test('each graph holds exactly the words of its list', () => {
  for (const id of LIST_IDS) {
    const words = readFileSync(design + `words_${id}.txt`, 'utf8').split('\n').filter(Boolean);
    assert.equal(graphs[id].words, words.length, id);
    assert.ok(words.every((w) => isWord(w, graphs[id])), id);
  }
});

test('prefixes, odd input and length limits', () => {
  const g = graphs.full;
  assert.equal(isWord('colou', g), false);
  assert.equal(isWord('colours', g), true);
  assert.equal(isWord('colourss', g), false);
  assert.equal(isWord('', g), false);
  assert.equal(isWord('a', g), false);
  assert.equal(isWord('Colour', g), false);
  assert.equal(isWord('col our', g), false);
  assert.equal(isWord('library', graphs.starter, 6), false);
  assert.equal(isWord('build', graphs.starter, 6), true);
});

test('the lists grow: starter ⊂ steady ⊂ full ⊂ large ⊂ xlarge', () => {
  const counts = LIST_IDS.map((id) => graphs[id].words);
  assert.deepEqual(counts, counts.slice().sort((a, b) => a - b));
});

test('walking the graph by hand', () => {
  const g = graphs.full;
  const c = findEdge(g, 0, 'c');
  assert.ok(c >= 0);
  const next = edgesOf(g, g.edges[c] >>> 7).map((e) => e.letter);
  assert.ok(next.includes('o') && next.includes('a'));
  assert.equal(findEdge(g, 0, '{'), -1);
});

test('a file that is not a word graph is refused', () => {
  assert.throws(() => loadWordGraph(new Uint8Array(16)), /Not a Wordbright word graph/);
});
