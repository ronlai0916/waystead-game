// The automatic checks (compose/site/js/checks.js). Run: node --test compose/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../site/js/checks.js';

const HINTS = ['kite', 'climb', 'ladder', 'happy', 'string'];
test('word count: words, not spaces or punctuation', () => {
  assert.equal(C.wordCount(''), 0);
  assert.equal(C.wordCount('   '), 0);
  assert.equal(C.wordCount('The kite flew.'), 3);
  assert.equal(C.wordCount('  It   was\n\nMaya\'s kite!  '), 4);
  assert.equal(C.wordCount('Wow... 123 --'), 1);
  assert.equal(C.wordCount('don’t stop'), 2);
});
test('hint words: found whatever the capitals, and with simple endings', () => {
  assert.deepEqual(C.hintsUsed('The KITE was high.', HINTS), ['kite']);
  assert.deepEqual(C.hintsUsed('He climbed up and climbing was hard.', HINTS), ['climb']);
  assert.deepEqual(C.hintsUsed('Kites fly.', HINTS), ['kite']);
  assert.deepEqual(C.hintsUsed('She was happily singing.', HINTS), ['happy']);
  assert.deepEqual(C.hintsUsed('Baking is fun.', ['bake']), ['bake']);
  assert.deepEqual(C.hintsUsed('They stopped.', ['stop']), ['stop']);
});
test('hint words: a word inside another doesn\'t count, nor a misspelling', () => {
  assert.deepEqual(C.hintsUsed('Kiteboard', HINTS), []);
  assert.deepEqual(C.hintsUsed('The kyte flew.', HINTS), []);
});
test('distance: one slip is 1, and a swap of two letters is 1', () => {
  assert.equal(C.distance('kite', 'kite'), 0);
  assert.equal(C.distance('kite', 'kyte'), 1);
  assert.equal(C.distance('kite', 'kit'), 1);
  assert.equal(C.distance('ladder', 'ladedr'), 1);
  assert.equal(C.distance('climb', 'clime'), 1);
});
test('misspellings: a near miss of a hint word is flagged, with the hint', () => {
  assert.deepEqual(C.misspelledHints('The kyte flew.', HINTS), [{ word: 'kyte', hint: 'kite' }]);
  assert.deepEqual(C.misspelledHints('He went up the ladedr.', HINTS), [{ word: 'ladedr', hint: 'ladder' }]);
});
test('misspellings: two slips only in a long hint word', () => {
  assert.deepEqual(C.misspelledHints('a stirng.', HINTS).length, 1);
  assert.deepEqual(C.misspelledHints('the kaet', HINTS), []);
  assert.deepEqual(C.misspelledHints('a suprise', ['surprise']), [{ word: 'suprise', hint: 'surprise' }]);
  assert.deepEqual(C.misspelledHints('a sirprize', ['surprise']).length, 1);
});
test('misspellings: a real word is left alone', () => {
  const real = (w) => ['kit', 'bite', 'climbs'].includes(w);
  assert.deepEqual(C.misspelledHints('A kit and a bite.', HINTS, real), []);
});
test('misspellings: right forms, short words and repeats are left alone', () => {
  assert.deepEqual(C.misspelledHints('Kites and climbing and a ladder.', HINTS), []);
  assert.deepEqual(C.misspelledHints('to at in', HINTS), []);
  assert.equal(C.misspelledHints('kyte kyte kyte', HINTS).length, 1);
});
test('misspellings: a name from the task is never a slip', () => {
  assert.deepEqual(C.misspelledHints('Sam and Maya ran.', ['sad', 'may']), []);
  assert.deepEqual(C.misspelledHints('Benn ran.', ['bent'], () => false, ['Benn']), []);
  const task = { level: 3, hints: ['bent'], background: 'Benn is here.', opening: '' };
  assert.equal(C.autoChecks('Benn ran and hid.', task).find((c) => c.id === 'spelling').ok, true);
});
test('sentences: split on . ! ?, keeping closing quotes, over lines', () => {
  assert.deepEqual(C.sentences('One. Two! Three?'), ['One.', 'Two!', 'Three?']);
  assert.deepEqual(C.sentences('First line\nSecond line.'), ['First line', 'Second line.']);
  assert.deepEqual(C.sentences('"Stop!" he said.'), ['"Stop!"', 'he said.']);
  assert.deepEqual(C.sentences(''), []);
});
test('capitals: sentences starting small are counted', () => {
  assert.equal(C.capitalsAndStops('The dog ran. it was fast.').noCapital, 1);
  assert.equal(C.capitalsAndStops('The dog ran. It was fast.').noCapital, 0);
  assert.equal(C.capitalsAndStops('the dog. the cat.').noCapital, 2);
});
test('capitals: "he said" after speech isn\'t a new sentence', () => {
  assert.equal(C.capitalsAndStops('"Stop!" he said.').noCapital, 0);
});
test('capitals: a sentence opening with speech goes by its first letter', () => {
  assert.equal(C.capitalsAndStops('"Hello," said Sam.').noCapital, 0);
  assert.equal(C.capitalsAndStops('"hello," said Sam.').noCapital, 1);
});
test('a small i on its own', () => {
  assert.equal(C.capitalsAndStops('Then i ran and i hid.').smallI, 2);
  assert.equal(C.capitalsAndStops('I saw it. In it.').smallI, 0);
});
test('full stops: each paragraph must end with an end mark', () => {
  assert.equal(C.capitalsAndStops('The dog ran').noStop, 1);
  assert.equal(C.capitalsAndStops('The dog ran.\n\nThe cat sat').noStop, 1);
  assert.equal(C.capitalsAndStops('Yes!\n\nWhy?\n\n"Go."').noStop, 0);
  assert.equal(C.capitalsAndStops('').noStop, 0);
});
test('sentence openers: the same word twice running', () => {
  assert.equal(C.repeatedOpeners('He ran. He hid. She sat.'), 1);
  assert.equal(C.repeatedOpeners('He ran. She hid.'), 0);
});
const task = (level) => ({ level, hints: HINTS });
const ids = (list) => list.map((c) => c.id);
test('Year 3 gets the basics and the joining word, nothing harder', () => {
  const c = C.autoChecks('The kite got stuck and Maya was sad.', task(3));
  assert.deepEqual(ids(c), ['words', 'hints', 'spelling', 'capitals', 'stops', 'joins']);
  assert.equal(c.find((x) => x.id === 'joins').ok, true);
});
test('later years add paragraphs, speech and time words; Year 5 adds openers', () => {
  assert.deepEqual(ids(C.autoChecks('x', task(4))).slice(5), ['paragraphs', 'speech', 'time']);
  assert.deepEqual(ids(C.autoChecks('x', task(5))).slice(5), ['paragraphs', 'speech', 'time', 'openers']);
});
test('the wording is kind: nothing is called wrong', () => {
  for (const c of C.autoChecks('kyte', task(6))) assert.doesNotMatch(c.text, /wrong|bad|fail|error|mistake/i, c.text);
});
test('a good Year 3 story passes every check', () => {
  const s = 'Maya had a red kite. She was happy because it flew high. The string broke. A man got a ladder and he helped her climb.';
  assert.ok(C.autoChecks(s, task(3)).every((c) => c.ok), JSON.stringify(C.autoChecks(s, task(3))));
});
