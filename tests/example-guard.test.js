// SB4-E/F: no example sentence on a study page may show a word whose group's test is due (whole word, any case, with a
// trailing s / es / ed / d / ing as boldWord marks it). Year 1 function words (the, said, was) are the hard case.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { memoryStorage } from '../shared/tests/fake-account.js';
import { mentionsHidden, guardEntry } from '../site/js/test-guard.js';
import * as W from '../site/js/words-doc.js';

globalThis.localStorage = memoryStorage();
const S = await import('../site/js/store.js');
const { shown } = await import('../site/js/word-info.js');
const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const src = (p) => readFileSync(file(p), 'utf8');
const cur = JSON.parse(src('site/data/curriculum.json'));
const hid = (...w) => new Set(w);

test('mentionsHidden: whole words, any case, with boldWord\'s endings', () => {
  assert.equal(mentionsHidden('The cat sat.', hid('the')), true, 'capital');
  assert.equal(mentionsHidden('She said hello.', hid('said')), true);
  assert.equal(mentionsHidden('It was fun.', hid('was')), true);
  assert.equal(mentionsHidden('They walked home.', hid('walk')), true, 'ed');
  assert.equal(mentionsHidden('She is walking.', hid('walk')), true, 'ing');
  assert.equal(mentionsHidden('Two walks a day.', hid('walk')), true, 's');
  assert.equal(mentionsHidden('He used a pen.', hid('use')), true, 'd');
  assert.equal(mentionsHidden('The box is full.', hid('boxes', 'fox')), false, 'a part of a word is not the word');
  assert.equal(mentionsHidden('Another one.', hid('the', 'other')), false, 'not inside another word');
  assert.equal(mentionsHidden('A theme park.', hid('the')), false);
  assert.equal(mentionsHidden('I can see it.', hid('i')), true, 'one-letter word');
  assert.equal(mentionsHidden('It is in the sky.', hid('i')), false, 'I is not the letter inside other words');
  assert.equal(mentionsHidden('He has a cat.', hid('a')), true);
  assert.equal(mentionsHidden('The cats ran.', hid('a')), false);
  assert.equal(mentionsHidden('As I said.', hid('a')), false, 'a takes no ending: not "as"');
  assert.equal(mentionsHidden('She said it.', hid('sa')), false, 'a short word takes no ending');
  assert.equal(mentionsHidden('', hid('the')), false);
  assert.equal(mentionsHidden('The cat.', hid()), false);
  assert.equal(mentionsHidden('The cat.', null), false);
  assert.equal(mentionsHidden('Go to bed.', hid('Mr'.toLowerCase())), false);
  assert.equal(mentionsHidden('Mr Ray said hello.', hid('mr')), true, 'a capital word stored with a capital is hidden in lower case');
});

test('mentionsHidden: e-drop, doubled consonant, y to i, and -er -est -ly -ness -ful -y', () => {
  assert.equal(mentionsHidden('She is making tea.', hid('make')), true, 'e-drop ing');
  assert.equal(mentionsHidden('He baked a cake.', hid('bake')), true, 'ed on a word that ends in e');
  assert.equal(mentionsHidden('The frog hopped.', hid('hop')), true, 'doubled ed');
  assert.equal(mentionsHidden('It is running.', hid('run')), true, 'doubled ing');
  assert.equal(mentionsHidden('A sunny day.', hid('sun')), true, 'doubled y');
  assert.equal(mentionsHidden('Her kindness was clear.', hid('kind')), true, 'ness');
  assert.equal(mentionsHidden('He kindly helped.', hid('kind')), true, 'ly');
  assert.equal(mentionsHidden('A quicker way.', hid('quick')), true, 'er');
  assert.equal(mentionsHidden('The tallest tree.', hid('tall')), true, 'est');
  assert.equal(mentionsHidden('A careful boy.', hid('care')), true, 'ful');
  assert.equal(mentionsHidden('A joyful day.', hid('joy')), true, 'ful');
  assert.equal(mentionsHidden('Two babies.', hid('baby')), true, 'ies');
  assert.equal(mentionsHidden('She carried it.', hid('carry')), true, 'ied');
  assert.equal(mentionsHidden('Happiness is here.', hid('happy')), true, 'ness after i');
  assert.equal(mentionsHidden('A long song.', hid('son')), false, 'a part of a word is not the word');
  assert.equal(mentionsHidden('The shipper sat.', hid('shop')), false, 'no match across different vowels');
  assert.equal(mentionsHidden('We use it.', hid('us')), false, 'a two-letter word takes no ending');
  assert.equal(mentionsHidden('The ring rang.', hid('rin')), false, 'ing alone is not an ending on a two-letter stem');
});

test('guardEntry: the example goes, the rest stays; an entry with nothing to hide is the same object', () => {
  const w = { word: 'cat', chunks: ['cat'], meaning: { partOfSpeech: 'noun', definition: 'a small pet', example: 'The cat said hello.' } };
  const g = guardEntry(w, hid('said'));
  assert.equal(g.meaning.example, '');
  assert.equal(g.meaning.definition, 'a small pet');
  assert.equal(g.word, 'cat');
  assert.equal(w.meaning.example, 'The cat said hello.', 'the original is not changed');
  assert.equal(guardEntry(w, hid('dog')), w);
  assert.equal(guardEntry(w, hid()), w);
  const none = { word: 'x', meaning: { definition: 'd', example: '' } };
  assert.equal(guardEntry(none, hid('x')), none);
  assert.equal(guardEntry(null, hid('x')), null);
});

test('Year 1: with the, said and was hidden, every Year 1 example that holds one is withheld, the others stay', () => {
  const hidden = hid('the', 'said', 'was');
  let withheld = 0, kept = 0;
  for (const c of cur.year_1.chapters) {
    for (const w of c.words) {
      const g = guardEntry(w, hidden);
      const has = /\b(the|said|was)\b/i.test(w.meaning.example);
      if (has) { assert.equal(g.meaning.example, '', c.id + '/' + w.word); withheld += 1; } else { assert.equal(g, w, c.id + '/' + w.word); kept += 1; }
    }
  }
  assert.ok(withheld > 0 && kept > 0, withheld + ' withheld, ' + kept + ' kept');
  // and the hidden word's own entry: its example holds the word, so it is withheld too
  const the = cur.year_1.chapters.flatMap((c) => c.words).find((w) => w.word === 'the');
  assert.equal(guardEntry(the, hidden).meaning.example, '');
});

test('shown(): only while a test is due; signed out or no test due, nothing is withheld', () => {
  const today = W.localDay(Date.now());
  const ago = (n) => W.addDays(today, -n);
  const w = { word: 'cat', chunks: ['cat'], meaning: { partOfSpeech: 'noun', definition: 'a pet', example: 'The cat said hello.' } };
  S.usePlayer(null);
  assert.equal(shown(w), w, 'signed out');
  S.usePlayer('kid1');
  assert.equal(shown(w), w, 'no group');
  let d = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week', test: ago(1), words: ['said', 'was'], today: ago(6), now: Date.parse(ago(6) + 'T12:00:00Z') }).doc;
  const g = W.groupById(d, 'g1');
  const day = ago(5);
  d = ['hello', 'fix', 'games', 'story'].reduce((y, s) => W.markStep(y, g, s, day, Date.parse(day + 'T12:00:00Z')), d);
  for (const x of W.rows(g)) for (const h of [9, 10, 11]) d = W.addTry(d, { id: 'p' + x + h, word: x, day, group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, now: Date.parse(day + 'T12:00:00Z') + h });
  S.updateWords(() => d);
  assert.equal(shown(w).meaning.example, '', 'the test for "said" is due: the sentence with "said" is withheld');
  assert.equal(shown({ ...w, meaning: { ...w.meaning, example: 'The cat sat.' } }).meaning.example, 'The cat sat.');
  S.updateWords(() => W.createGroup(W.emptyDoc(), { id: 'g2', name: 'Later', test: W.addDays(today, 3), words: ['said'], today: ago(1), now: Date.now() }).doc);
  assert.equal(shown(w), w, 'the test is not due yet: the word is still on show');
  S.usePlayer(null);
});

test('the pages that show an example sentence ask shown() first', () => {
  assert.match(src('site/js/views.js'), /function wordEntries\(ch\) \{ return rawEntries\(ch\)\.map\(shown\); \}/, 'chapter study and quick game');
  assert.match(src('site/js/views.js'), /words: shuffle\(rawEntries\(ch\)\)/, 'the chapter test hears its sentence');
  assert.match(src('site/js/views.js'), /const w = shown\(from && from\.ch\.own/, 'spell it out');
  assert.match(src('site/js/study-views.js'), /const w = shown\(entryFor\(list\[i\]\)\)/, 'Hello words');
  assert.match(src('site/js/study-views.js'), /map\(\(x\) => shown\(entryFor\(x\)\)\)\.filter\(\(w\) => w\.meaning\.example\)/, 'Your words at work');
  assert.match(src('site/js/play.js'), /shown\(w\)\.meaning\.example/, 'the meaning hint');
  assert.match(src('site/js/word-info.js'), /export function shown/);
});
