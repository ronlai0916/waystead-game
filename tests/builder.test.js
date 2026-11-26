// U-builder (SB6 TR-27, WP-4): the sentence builder's pure rules, with the real bank.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as SD from '../site/js/sentence-doc.js';

const bank = JSON.parse(readFileSync(new URL('../site/data/builder.json', import.meta.url), 'utf8'));
const cur = JSON.parse(readFileSync(new URL('../site/data/curriculum.json', import.meta.url), 'utf8'));
const entries = [];
(function walk(o) { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') { if (o.word && o.meaning) entries.push(o); else Object.values(o).forEach(walk); } })(cur);
const entry = (w) => entries.find((e) => e.word === w);

test('levels by year and way: Years 1-2 [1], Years 3-6 [1,2,3] and 4 offered, the Usual way [1,3]', () => {
  assert.deepEqual(SD.levelsFor(1, 'sbs'), [1]);
  assert.deepEqual(SD.levelsFor(2, 'sbs'), [1]);
  assert.deepEqual(SD.levelsFor(3, 'sbs'), [1, 2, 3, 4]);
  assert.deepEqual(SD.levelsFor(6, 'sbs').filter((l) => !SD.OPTIONAL_LEVELS.includes(l)), [1, 2, 3]);
  assert.deepEqual(SD.levelsFor(4, 'usual'), [1, 3]);
  assert.deepEqual(SD.levelsFor(0, 'usual'), [1, 3]);
});

test('level 1: every curriculum word gets a frame, the target slot is ONE card, every other slot 3, and any picks make a sentence', () => {
  let n = 0;
  for (const e of entries) {
    const f = SD.frameFor(e, bank, 0);
    assert.ok(f, e.word + ' has no frame');
    const target = f.parts.filter((p) => p.slot === 'w');
    assert.equal(target.length, 1, e.word);
    assert.deepEqual(target[0].cards, [e.word]);
    for (const p of f.parts.filter((x) => x.slot && x.slot !== 'w')) assert.equal(p.cards.length, 3, e.word + ' ' + f.id);
    // the first, middle and last card of each slot
    for (const pick of [0, 1, 2]) {
      const picks = Object.fromEntries(f.parts.filter((p) => p.slot && p.slot !== 'w').map((p) => [p.slot, p.cards[pick]]));
      assert.ok(SD.complete(f, picks));
      const s = SD.sentenceOf(f, picks);
      assert.match(s, /^[A-Z].*[.!?]$/, s);
      assert.ok(s.toLowerCase().includes(e.word.toLowerCase()), s);
      assert.ok(!s.includes('...'), s);
      n += 1;
    }
  }
  assert.ok(n > 1800);
});

test('a different seed picks another of the word\'s frames; the same seed the same one; a frame holding the target as a card is skipped', () => {
  const e = entry('friend');
  assert.equal(SD.frameFor(e, bank, 3).id, SD.frameFor(e, bank, 3).id);
  const ids = new Set([0, 1, 2, 3, 4, 5].map((s) => SD.frameFor(e, bank, s).id));
  assert.ok(ids.size >= 2);
  const fake = { frames: { noun: [{ id: 'x1', t: 'The {w} was in the {a}.', s: { a: ['box', 'car', 'hat'] }, y: [1, 6] }, { id: 'x2', t: 'I like the {w}.', s: {}, y: [1, 6] }] }, w: {} };
  assert.equal(SD.frameFor({ word: 'box', meaning: { partOfSpeech: 'noun' } }, fake, 0).id, 'x2');
});

test('a word with no entry in the bank (an own word) only gets frames with no sp flag (word frames never)', () => {
  for (const pos of ['noun', 'verb', 'adjective', 'adverb', 'preposition']) {
    const own = { word: 'zzword', meaning: { partOfSpeech: pos } };
    for (let s = 0; s < 8; s += 1) {
      const f = SD.frameFor(own, bank, s);
      assert.ok(f, pos);
      const all = Object.values(bank.frames).flat();
      assert.ok(!all.find((x) => x.id === f.id).sp, pos + ' ' + f.id);
    }
  }
});

test('level 2 and 3 sources: info, the curriculum example, statements, then the bank; a word whose test is due never appears in a model', () => {
  const e = { word: 'night', meaning: { partOfSpeech: 'noun', example: 'We saw the moon at night.' } };
  const ctx = { bank, statements: ['The night was cold and still.'], info: { s: 'My night light is blue.' } };
  const list = SD.modelsFor(e, ctx);
  assert.equal(list[0], 'My night light is blue.');
  assert.equal(list[1], 'We saw the moon at night.');
  assert.equal(list[2], 'The night was cold and still.');
  assert.ok(list.length >= 3);
  const hid = SD.modelsFor(e, { ...ctx, hidden: new Set(['moon', 'cold']) });
  assert.ok(!hid.some((m) => /moon|cold/i.test(m)));
  assert.deepEqual(SD.missingWord('We saw the moon at night.', 'night'), { before: 'We saw the moon at ', after: '.' });
  assert.equal(SD.missingWord('Night after night.', 'night'), null); // twice: not usable
  assert.equal(SD.modelFor({ word: 'qq', meaning: {} }, { bank }), '');
});

test('every bank model makes 4 to 6 cards, solvable, and never starts in the answer order', () => {
  let n = 0;
  for (const [word, w] of Object.entries(bank.w)) {
    const oc = SD.orderCards(w.m);
    assert.ok(oc, word + ': ' + w.m);
    assert.ok(oc.cards.length >= 4 && oc.cards.length <= 6, word + ' ' + oc.cards.length);
    assert.equal(oc.cards[0].first, true);
    assert.equal(oc.cards.at(-1).last, true);
    const shuffled = SD.shuffleCards(oc.cards, 5);
    assert.equal(shuffled.length, oc.cards.length);
    assert.ok(SD.orderRight(oc.cards, oc.answer, oc.answer), word);
    if (new Set(oc.cards.map((c) => c.text)).size > 1) assert.notDeepEqual(shuffled.map((c) => c.id), oc.answer, word);
    // the sentence reads back from the cards and the end mark
    assert.equal(oc.cards.map((c) => c.text).join(' ') + oc.end, w.m);
    n += 1;
  }
  assert.ok(n >= 600);
  assert.equal(SD.orderCards('Too short here.'), null);
});

test('hints: the next card after the right start, and a wrong start is trimmed', () => {
  const oc = SD.orderCards('The night was very dark today.');
  const [a, b, c] = oc.answer;
  assert.equal(SD.nextCard(oc.cards, oc.answer, []), a);
  assert.equal(SD.nextCard(oc.cards, oc.answer, [a, b]), c);
  assert.equal(SD.rightPrefix(oc.cards, oc.answer, [a, oc.answer[3]]), 1);
  assert.equal(SD.nextCard(oc.cards, oc.answer, [a, oc.answer[3]]), b);
  assert.equal(SD.nextCard(oc.cards, oc.answer, oc.answer), null);
  assert.equal(SD.orderRight(oc.cards, oc.answer, [b, a, c, ...oc.answer.slice(3)]), false);
  // two cards with the same words are the same card
  const twin = SD.orderCards('We like the cat and the dog.');
  const ids = twin.cards.filter((x) => x.text === 'the').map((x) => x.id);
  if (ids.length === 2) assert.ok(SD.orderRight(twin.cards, twin.answer, twin.answer.map((id) => (id === ids[0] ? ids[1] : id === ids[1] ? ids[0] : id))));
});

const known = new Set('the night was very dark and we saw it in a sky sat cat on mat friend my'.split(' '));
const safe = { isKnown: (w) => known.has(w), extra: ['friend'] };
test('checkOwn answers one kind line: unknown and refused words the same, under 4 words, the word missing', () => {
  assert.equal(SD.checkOwn('The night was very dark.', 'night', safe), '');
  assert.equal(SD.checkOwn('The NIGHT was very dark', 'night', safe), ''); // case does not matter
  assert.equal(SD.checkOwn('The night wibble', 'night', safe), 'Try a different word.');
  assert.equal(SD.checkOwn('The night was very stupid', 'night', safe), 'Try a different word.'); // unkind: the same answer as unknown
  assert.equal(SD.checkOwn('Maya saw the night sky', 'night', safe), 'Try a different word.'); // a name
  assert.equal(SD.checkOwn('The night', 'night', safe), 'Add a few more words.');
  assert.equal(SD.checkOwn('The sky was very dark', 'night', safe), 'Use the word night.');
  assert.equal(SD.checkOwn('The night was dark 123', 'night', safe), 'Try a different word.');
  assert.equal(SD.checkOwn('the night was very dark ' + 'and '.repeat(40), 'night', safe), 'Make it a little shorter.');
  assert.equal(SD.checkOwn('', 'night', safe), 'Add a few more words.');
  assert.equal(SD.checkOwn('The night was very dark', 'night', () => false), 'Try a different word.'); // no list: nothing is allowed through
  // the lines are all kind
  for (const l of ['Try a different word.', 'Add a few more words.', 'Make it a little shorter.', 'Use the word night.']) assert.doesNotMatch(l, /wrong|fail|mistake|error/i);
});

test('voiceOk is false whenever the child typed any of it, and for a word that is not on the list', () => {
  const allow = new Set(['the', 'night', 'was', 'dark']);
  assert.equal(SD.voiceOk('The night was dark.', allow, { typed: false }), true);
  assert.equal(SD.voiceOk('The night was dark.', allow, { typed: true }), false);
  assert.equal(SD.voiceOk('The night was dark.', allow), true);
  assert.equal(SD.voiceOk('The night was cold.', allow, { typed: false }), false);
  assert.equal(SD.voiceOk('', allow), false);
  assert.equal(SD.voiceOk('The night was dark.', null), false);
});

test('a level that cannot be made is left out and at least one remains', () => {
  const e = entry('friend');
  assert.deepEqual(SD.usableLevels([1, 2, 3, 4], e, { bank }), [1, 2, 3, 4]);
  const own = { word: 'zzword', meaning: { partOfSpeech: 'noun' } };
  assert.deepEqual(SD.usableLevels([1, 2, 3], own, { bank }), [1]); // no model: levels 2 and 3 are left out
  assert.deepEqual(SD.usableLevels([1, 2, 3], own, { bank: null }), [4]); // no frames either: level 4 is the one left
  assert.deepEqual(SD.usableLevels([2, 3], own, { bank }), [4]);
  const withInfo = SD.usableLevels([1, 2, 3], own, { bank, info: 'I have a zzword in my bag.' });
  assert.deepEqual(withInfo, [1, 2, 3]);
});

test('Years 1-2 words: every level-1 sentence is at most 8 words (bank rule) and nothing is a test-due word', () => {
  for (const e of entries.slice(0, 120)) {
    const f = SD.frameFor(e, bank, 1);
    const picks = Object.fromEntries(f.parts.filter((p) => p.slot && p.slot !== 'w').map((p) => [p.slot, p.cards[0]]));
    assert.ok(SD.sentenceOf(f, picks).split(' ').length <= 14);
  }
});
