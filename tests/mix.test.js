// SB5 (WP-A2): Fill in the blanks and Mix and match: the pure rules in games-doc.js (TR-91, TR-101). Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as G from '../site/js/games-doc.js';
import * as W from '../site/js/words-doc.js';

function seeded(seed = 7) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
const curriculum = JSON.parse(readFileSync(fileURLToPath(new URL('../site/data/curriculum.json', import.meta.url)), 'utf8'));
const entries609 = ['year_1', 'year_2', 'year_3_4', 'year_5_6'].flatMap((b) => curriculum[b].chapters.flatMap((ch) => ch.words));
const bank = JSON.parse(readFileSync(fileURLToPath(new URL('../site/data/statements.json', import.meta.url)), 'utf8'));

// An entry with a ready-made sentence (and statements), or an own word (statements only).
const ready = (word, example, statements) => ({ word, sentence: example, statements });
const own = (word, statements) => ({ word, statements });
const S = (w, i) => ['The ' + w + ' was by the door.', 'We saw the ' + w + ' at school.', 'Mum gave me a ' + w + ' today.'][i];
const mk = (w, isReady = false) => (isReady ? ready(w, 'I like the ' + w + ' a lot.', [S(w, 0), S(w, 1), S(w, 2)]) : own(w, [S(w, 0), S(w, 1), S(w, 2)]));
const WORDS = ['apple', 'bench', 'candle', 'dragon', 'engine', 'forest', 'garden', 'hammer', 'island', 'jungle'];
const TEN = WORDS.map((w) => mk(w, true));
const OWN_TEN = WORDS.map((w) => mk(w, false));

// ---- gapOf and usableMeaning -----------------------------------------------------------------------------
test('gapOf: the word once as a whole word, case ignored; before and after keep the text', () => {
  assert.deepEqual(G.gapOf('We looked up and saw the moon.', 'moon'), { before: 'We looked up and saw the ', after: '.' });
  assert.deepEqual(G.gapOf('Monday is my favourite day.', 'monday'), { before: '', after: ' is my favourite day.' });
  assert.deepEqual(G.gapOf('A big BOAT sailed by.', 'boat'), { before: 'A big ', after: ' sailed by.' }, 'case ignored, original text kept');
  assert.equal(G.gapOf('The cat saw the cat.', 'cat'), null, 'twice');
  assert.equal(G.gapOf('The dog barked.', 'cat'), null, 'absent');
  assert.equal(G.gapOf('The cats ran.', 'cat'), null, 'part of a longer word');
  assert.equal(G.gapOf("The dog's bone is here.", 'dog'), null, 'dog\'s is another word');
  assert.equal(G.gapOf('A well-known song.', 'well'), null, 'hyphen joins words');
  assert.equal(G.gapOf('', 'cat'), null);
  assert.equal(G.gapOf('The cat sat.', ''), null);
  assert.equal(G.gapOf(null, 'cat'), null);
  assert.deepEqual(G.gapOf('Look at the cat.', 'cat').after, '.');
  assert.deepEqual(G.gapOf('I can’t see the ant.', 'ant'), { before: 'I can’t see the ', after: '.' }, 'a curly apostrophe elsewhere is fine');
});
test('gapOf on all 609 curriculum sentences: 607 gaps; quarter and sacrifice have none', () => {
  assert.equal(entries609.length, 609);
  const none = entries609.filter((e) => !G.gapOf(e.meaning.example, e.word)).map((e) => e.word).sort();
  assert.deepEqual(none, ['quarter', 'sacrifice']);
  assert.equal(entries609.length - none.length, 607);
});
test('usableMeaning: not empty, and not naming the word', () => {
  assert.equal(G.usableMeaning('', 'cat'), false);
  assert.equal(G.usableMeaning('   ', 'cat'), false);
  assert.equal(G.usableMeaning(undefined, 'cat'), false);
  assert.equal(G.usableMeaning('A small pet that purrs.', 'cat'), true);
  assert.equal(G.usableMeaning('A cat is a pet.', 'cat'), false);
  assert.equal(G.usableMeaning('A CAT is a pet.', 'cat'), false, 'case ignored');
  assert.equal(G.usableMeaning('Many cats live here.', 'cat'), true, 'cats is another word');
});
test('usableMeaning on the curriculum: the 6 self-naming meanings are refused, the rest pass', () => {
  const bad = entries609.filter((e) => !G.usableMeaning(e.meaning.definition, e.word)).map((e) => e.word).sort();
  assert.deepEqual(bad, ['a', 'by', 'me', 'of', 'the', 'you']);
});

// ---- levels and Game day ---------------------------------------------------------------------------------
test('levelFor: Years 1-2 pick from 3, Years 3-4 pick from 4 with a look-alike, Years 5-6 spell; statements only; unknown is Years 3-4', () => {
  const young = { fill: 'pick', choices: 3, items: 5, boards: ['statement', 'statement'], cards: 3 };
  assert.deepEqual(G.levelFor(1), young);
  assert.deepEqual(G.levelFor(2), young);
  const mid = { fill: 'pick', choices: 4, items: 6, boards: ['statement', 'statement'], cards: 4, lookAlike: true };
  assert.deepEqual(G.levelFor(3), mid);
  assert.deepEqual(G.levelFor(4), mid);
  const old = { fill: 'spell', items: 6, boards: ['statement', 'statement'], cards: 4, spare: true };
  assert.deepEqual(G.levelFor(5), old);
  assert.deepEqual(G.levelFor(6), old);
  for (const x of [undefined, null, 0, 7, '3', 'x', NaN]) assert.deepEqual(G.levelFor(x), mid, String(x));
  for (const y of [1, 2, 3, 4, 5, 6, null]) assert.ok(G.levelFor(y).boards.every((b) => b === 'statement'), 'no meaning boards, year ' + y);
});
test('dayGames: three year bands by three week kinds', () => {
  assert.deepEqual(G.dayGames(1, 'full'), ['missing', 'match', 'fill', 'mix']);
  assert.deepEqual(G.dayGames(2, 'full'), ['missing', 'match', 'fill', 'mix']);
  assert.deepEqual(G.dayGames(3, 'full'), ['missing', 'unjumble', 'match', 'fill', 'mix', 'quick']);
  assert.deepEqual(G.dayGames(6, 'full'), ['missing', 'unjumble', 'match', 'fill', 'mix', 'quick']);
  assert.deepEqual(G.dayGames(null, 'full'), ['missing', 'unjumble', 'match', 'fill', 'mix', 'quick']);
  assert.deepEqual(G.dayGames(1, 'short'), ['missing', 'match', 'mix']);
  assert.deepEqual(G.dayGames(2, 'short'), ['missing', 'match', 'mix']);
  assert.deepEqual(G.dayGames(4, 'short'), ['missing', 'match', 'fill', 'mix']);
  assert.deepEqual(G.dayGames(5, 'short'), ['missing', 'match', 'fill', 'mix']);
  assert.deepEqual(G.dayGames(undefined, 'short'), ['missing', 'match', 'fill', 'mix']);
  for (const y of [1, 2, 3, 4, 5, 6, null]) assert.deepEqual(G.dayGames(y, 'quick'), ['missing', 'mix']);
  assert.deepEqual(G.dayGames(4), G.dayGames(4, 'full'), 'no kind: full');
  assert.deepEqual(G.dayGames(4, 'odd'), G.dayGames(4, 'full'), 'unknown kind: full');
  G.dayGames(4, 'full').pop();
  assert.equal(G.dayGames(4, 'full').length, 6, 'a fresh array each time');
});
test('dayGames: Missing letters and Mix and match are never dropped; the drop order is Quick-fire, Unjumble, Fill in the blanks, Meaning match', () => {
  for (const y of [1, 3, 5, null]) for (const k of ['full', 'short', 'quick']) { const g = G.dayGames(y, k); assert.ok(g.includes('missing') && g.includes('mix'), y + k); }
  const order = ['quick', 'unjumble', 'fill', 'match'];
  const has = (k) => G.dayGames(4, k);
  // each shorter kind keeps a prefix-closed subset of the survivors: what goes first is gone from the shortest week
  assert.ok(has('full').includes('quick') && !has('short').includes('quick') && !has('quick').includes('quick'));
  assert.ok(has('full').includes('unjumble') && !has('short').includes('unjumble'));
  assert.ok(has('short').includes('fill') && !has('quick').includes('fill'));
  assert.ok(has('short').includes('match') && !has('quick').includes('match'));
  assert.equal(order.length, 4);
});
test('the games are registered: six ids in Game day order, Meaning match kept, both new ones have a title and a line', () => {
  assert.deepEqual(G.GAME_IDS, ['missing', 'unjumble', 'match', 'fill', 'mix', 'quick']);
  assert.equal(G.GAMES.match.title, 'Meaning match');
  assert.equal(G.GAMES.fill.title, 'Fill in the blanks');
  assert.equal(G.GAMES.fill.line, 'Find the word that fits.');
  assert.equal(G.GAMES.mix.title, 'Mix and match');
  assert.equal(G.GAMES.mix.line, 'Put each word in its place.');
});
test('gamesFor offers fill and mix only with at least 3 usable texts; mix leaves an own word\'s first statement to fill', () => {
  const meaning = (w) => ({ word: w, chunks: [w], meaning: { definition: w + ' means this' } });
  const plain = ['one', 'two', 'three', 'four'].map(meaning);
  assert.deepEqual(G.gamesFor(plain), ['missing', 'unjumble', 'match', 'quick'], 'no sentences: today\'s four');
  const three = [mk('apple', true), mk('bench', true), mk('candle', true)].map((e) => ({ ...meaning(e.word), ...e }));
  assert.deepEqual(G.gamesFor(three), ['missing', 'unjumble', 'fill', 'mix', 'quick']);
  assert.deepEqual(G.gamesFor(three.slice(0, 2)), ['missing', 'unjumble', 'quick'], 'two is too few');
  const oneStatement = ['apple', 'bench', 'candle'].map((w) => ({ ...meaning(w), word: w, statements: [S(w, 0)] }));
  assert.deepEqual(G.gamesFor(oneStatement), ['missing', 'unjumble', 'fill', 'quick'], 'own words with 1 statement: fill yes, mix no');
  assert.deepEqual(G.gamesFor(three, {}, ['fill', 'mix']), ['fill', 'mix']);
});

// ---- statementFor ------------------------------------------------------------------------------------------
test('statementFor: the (n mod count)-th usable statement, the same everywhere', () => {
  const b = { boat: ['A boat sails on the sea.', 'We rowed the boat home.', 'My boat is red.'], Monday: ['Monday is a school day.', 'We swim on Monday.'], bad: ['No word here.', 'Only one bad here.'] };
  assert.equal(G.statementFor('boat', 0, b), 'A boat sails on the sea.');
  assert.equal(G.statementFor('boat', 1, b), 'We rowed the boat home.');
  assert.equal(G.statementFor('boat', 3, b), 'A boat sails on the sea.', 'wraps round');
  assert.equal(G.statementFor('boat', -1, b), 'My boat is red.', 'negative numbers wrap too');
  assert.equal(G.statementFor('boat', 1.9, b), 'We rowed the boat home.', 'whole numbers only');
  assert.equal(G.statementFor('boat', NaN, b), 'A boat sails on the sea.');
  assert.equal(G.statementFor('Monday', 1, b), 'We swim on Monday.');
  assert.equal(G.statementFor('bad', 0, b), 'Only one bad here.', 'a statement without the word is skipped, never shown');
  assert.equal(G.statementFor('nothing', 0, b), '');
  assert.equal(G.statementFor('boat', 0, null), '');
  assert.equal(G.statementFor('boat', 1, { _meta: { v: 1 }, w: b }), 'We rowed the boat home.', 'the whole file works too');
});
test('statementFor on the real bank: every bank word with a statement gives one holding the word once, on every turn', () => {
  const w = bank.w;
  let n = 0;
  for (const word of Object.keys(w).slice(0, 80)) for (let i = 0; i < 4; i++) { const s = G.statementFor(word, i, bank); if (s) { assert.ok(G.gapOf(s, word), word + ': ' + s); n += 1; } }
  assert.ok(n > 200);
});

// ---- Fill in the blanks ------------------------------------------------------------------------------------
test('fillItems: gapped sentences, up to the level\'s items, fewest done today first', () => {
  const lv = G.levelFor(2);
  const items = G.fillItems(TEN, lv, {}, seeded(3));
  assert.equal(items.length, 5);
  for (const it of items) {
    assert.equal(it.kind, 'statement');
    assert.equal(it.scored, true);
    assert.ok(it.text.includes(G.BLANK) && !it.text.toLowerCase().includes(it.word), 'the word is not on show: ' + it.text);
    assert.equal(it.before + it.word + it.after, it.full);
    assert.ok(it.full.includes(it.word));
  }
  assert.equal(new Set(items.map((i) => i.word)).size, 5);
  const done = G.fillItems(TEN, lv, { doneToday: { apple: 2, bench: 1, candle: 1, dragon: 1, engine: 1, forest: 1, garden: 1 } }, seeded(3)).map((i) => i.word);
  assert.deepEqual(done.slice(0, 3).sort(), ['hammer', 'island', 'jungle'], 'the three not done today come first');
  assert.ok(!done.includes('apple'), 'the most-done word is last and cut');
  const asSet = G.fillItems(TEN, G.levelFor(5), { doneToday: new Set(['apple', 'bench']) }, seeded(3)).map((i) => i.word);
  assert.ok(!asSet.includes('apple') && !asSet.includes('bench'), 'a list or Set of words counts once each');
  assert.equal(asSet.length, 6);
  const m = new Map([['apple', 3]]);
  assert.ok(!G.fillItems(TEN, G.levelFor(5), { doneToday: m }, seeded(3)).some((i) => i.word === 'apple'));
});
test('fillItems: hidden words, sentences naming a hidden word, entries with no usable sentence and a seeded rand', () => {
  const lv = G.levelFor(4);
  const hid = G.fillItems(TEN, lv, { hidden: ['APPLE', new Set(['x']).values().next().value] }, seeded(1)).map((i) => i.word);
  assert.ok(!hid.includes('apple'));
  const naming = [{ word: 'bench', sentence: 'We sat on the bench by the apple tree.' }, { word: 'candle', sentence: 'A candle glows.' }];
  assert.deepEqual(G.fillItems(naming, lv, { hidden: new Set(['apple']) }, seeded(1)).map((i) => i.word), ['candle'], 'a sentence that holds a hidden word is dropped');
  const none = [{ word: 'cat', sentence: 'The dog ran.' }, { word: 'dog' }, { word: 'owl', sentence: 'An owl and an owl.' }, { word: 'hen', statements: [] }];
  assert.deepEqual(G.fillItems(none, lv, {}, seeded(1)), []);
  assert.deepEqual(G.fillItems(TEN, lv, {}, seeded(9)), G.fillItems(TEN, lv, {}, seeded(9)), 'the same seed gives the same round');
  assert.notDeepEqual(G.fillItems(TEN, lv, {}, seeded(9)).map((i) => i.word), G.fillItems(TEN, lv, {}, seeded(10)).map((i) => i.word));
  assert.deepEqual(G.fillItems([], lv, {}, seeded(1)), []);
  assert.equal(G.fillItems([TEN[0], TEN[0]], lv, {}, seeded(1)).length, 1, 'a word twice is one item');
});
test('fillItems: a ready-made word uses its sentence; an own word uses statement 0 (and a bad sentence is not replaced by a statement)', () => {
  const r = G.fillItems([ready('apple', 'I ate an apple.', [S('apple', 0)])], G.levelFor(3), {}, seeded(1));
  assert.equal(r[0].full, 'I ate an apple.');
  const o = G.fillItems([own('bench', [S('bench', 0), S('bench', 1)])], G.levelFor(3), {}, seeded(1));
  assert.equal(o[0].full, S('bench', 0));
  assert.deepEqual(G.fillItems([ready('quarter', 'Cut the pizza into quarters.', [S('quarter', 0)])], G.levelFor(3), {}, seeded(1)), [], 'no gap in the example: sits out');
});
test('readLine says the gap as "blank"', () => {
  assert.equal(G.readLine('I like the ', ' a lot.'), 'I like the blank a lot.');
  assert.equal(G.readLine('', ' is here.'), 'blank is here.');
});
test('fillChoices: the answer and choices - 1 others; the look-alike first when the level has one; never hidden; none in spell mode', () => {
  const item = { word: 'bench' };
  const week = ['bench', 'bend', 'apple', 'candle', 'dragon', 'engine'];
  const c3 = G.fillChoices(item, week, G.levelFor(1), [], seeded(2));
  assert.equal(c3.length, 3);
  assert.ok(c3.includes('bench'));
  assert.equal(new Set(c3).size, 3);
  for (let s = 1; s < 20; s += 1) {
    const c4 = G.fillChoices(item, week, G.levelFor(4), [], seeded(s));
    assert.equal(c4.length, 4);
    assert.ok(c4.includes('bench') && c4.includes('bend'), 'the look-alike (same first two letters) is always one of them, seed ' + s);
  }
  assert.ok(![...Array(20).keys()].some((s) => G.fillChoices(item, week, G.levelFor(1), [], seeded(s + 1)).length !== 3));
  for (let s = 1; s < 20; s += 1) assert.ok(!G.fillChoices(item, week, G.levelFor(3), ['BEND', 'apple'], seeded(s)).some((w) => w === 'bend' || w === 'apple'), 'hidden words never appear');
  assert.deepEqual(G.fillChoices(item, week, G.levelFor(5), [], seeded(1)), [], 'spell mode has no cards');
  assert.deepEqual(G.fillChoices(item, ['bench', 'BENCH'], G.levelFor(1), [], seeded(1)), ['bench'], 'too few other words: just what there is');
  assert.deepEqual(G.fillChoices(item, week, G.levelFor(3), [], seeded(4)), G.fillChoices(item, week, G.levelFor(3), [], seeded(4)));
  const noLook = G.fillChoices({ word: 'apple' }, week, G.levelFor(1), [], seeded(2));
  assert.equal(noLook.length, 3, 'Years 1-2 have no look-alike rule but still give 3');
});
test('fillPass: a pick is source m, a spelled gap is source g with the tile help', () => {
  const item = { word: 'bench' };
  assert.deepEqual(G.fillPass(item, { tries: 0 }), { word: 'bench', tries: 0, clean: true, source: 'm' });
  assert.deepEqual(G.fillPass(item, { tries: 2 }), { word: 'bench', tries: 2, clean: false, source: 'm' });
  assert.deepEqual(G.fillPass(item), { word: 'bench', tries: 0, clean: true, source: 'm' });
  assert.deepEqual(G.fillPass(item, { tries: 0, spelled: true }), { word: 'bench', tries: 0, clean: true, source: 'g' });
  assert.deepEqual(G.fillPass(item, { tries: 1, spelled: true, lv: 2, h: 1 }), { word: 'bench', tries: 1, clean: false, source: 'g', lv: 2, h: 1 });
});
test('recordPass: a pick is a played pass (k p, s m), a spelled gap a spelling try (s g); no new kind', () => {
  let d = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'x', test: '2026-11-25', words: ['bench'], today: '2026-11-20', now: 1 }).doc;
  const g = W.groupById(d, 'g1');
  d = G.recordPass(d, g, 'bench', G.fillPass({ word: 'bench' }, { tries: 0 }), { id: 't1', day: '2026-11-21', now: 5 });
  d = G.recordPass(d, g, 'bench', G.fillPass({ word: 'bench' }, { tries: 0, spelled: true, lv: 2 }), { id: 't2', day: '2026-11-21', now: 6 });
  const [a, b] = d.results;
  assert.deepEqual([a.k, a.s, a.c], ['p', 'm', 1]);
  assert.deepEqual([b.k, b.s, b.c, b.lv], ['p', 'g', 1, 2]);
  assert.ok(['p', 'x', 'g', 'm'].includes(a.s) && !('lv' in a));
});

// ---- Mix and match -----------------------------------------------------------------------------------------
test('mixBoards: 2 boards of 3 (Years 1-2) or 4 (Years 3-6), statements only, the word is never on show', () => {
  for (const [year, per] of [[1, 3], [2, 3], [3, 4], [4, 4]]) {
    const boards = G.mixBoards(TEN, G.levelFor(year), {}, seeded(year));
    assert.equal(boards.length, 2, 'year ' + year);
    for (const b of boards) {
      assert.equal(b.kind, 'statement');
      assert.equal(b.slots.length, per);
      assert.equal(b.cards.length, per, 'no spare card below Year 5');
      for (const s of b.slots) {
        assert.equal(s.kind, 'statement');
        assert.equal(s.scored, true);
        assert.ok(s.text.includes(G.BLANK) && !s.text.toLowerCase().includes(s.word));
        assert.equal(s.before + s.word + s.after, s.full);
      }
      assert.deepEqual(b.cards.map((c) => c.word).sort(), b.slots.map((s) => s.word).sort());
    }
    const all = boards.flatMap((b) => b.slots.map((s) => s.word));
    assert.equal(new Set(all).size, all.length, 'a word sits on one board only');
  }
});
test('mixBoards: Years 5-6 add one spare card per board, another week word that fits nowhere on it', () => {
  const boards = G.mixBoards(TEN, G.levelFor(5), {}, seeded(5));
  assert.equal(boards.length, 2);
  for (const b of boards) {
    assert.equal(b.slots.length, 4);
    assert.equal(b.cards.length, 5);
    const spare = b.cards.filter((c) => c.spare);
    assert.equal(spare.length, 1);
    assert.ok(!b.slots.some((s) => s.word === spare[0].word), 'the spare word has no slot here');
    assert.ok(WORDS.includes(spare[0].word));
  }
  const used = new Set(boards.flatMap((b) => b.slots.map((s) => s.word)));
  assert.ok(boards.every((b) => b.cards.find((c) => c.spare)), 'both boards have one');
  assert.equal(used.size, 8);
  const small = G.mixBoards(TEN.slice(0, 3), G.levelFor(5), {}, seeded(1));
  assert.equal(small[0].cards.filter((c) => c.spare).length, 0, 'no other week word to spare: no spare card');
});
test('mixBoards: words not used in Fill in the blanks come first; the excluded ones only fill the gaps', () => {
  const ex = WORDS.slice(0, 6);
  const boards = G.mixBoards(TEN, G.levelFor(4), { exclude: ex }, seeded(8));
  const words = boards.flatMap((b) => b.slots.map((s) => s.word));
  for (const fresh of WORDS.slice(6)) assert.ok(words.includes(fresh), fresh + ' is on a board');
  assert.equal(words.length, 8);
  assert.equal(words.filter((w) => ex.includes(w)).length, 4, 'four slots had to take words from Fill');
  const few = G.mixBoards(TEN.slice(0, 4), G.levelFor(4), { exclude: ['apple'] }, seeded(8));
  assert.equal(few.length, 1);
  assert.equal(few[0].slots.length, 4);
});
test('mixBoards: a short board is filled with spare words, unscored; no board is made of spares alone', () => {
  const spareEntries = [mk('kettle', true), mk('ladder', true), mk('mirror', true)];
  const boards = G.mixBoards(TEN.slice(0, 5), G.levelFor(4), { spare: spareEntries }, seeded(2));
  assert.equal(boards.length, 2);
  assert.equal(boards[0].slots.length, 4);
  assert.equal(boards[1].slots.length, 4);
  const scored = boards.flatMap((b) => b.slots).filter((s) => s.scored);
  const unscored = boards.flatMap((b) => b.slots).filter((s) => !s.scored);
  assert.equal(scored.length, 5);
  assert.equal(unscored.length, 3);
  assert.ok(unscored.every((s) => ['kettle', 'ladder', 'mirror'].includes(s.word)));
  assert.equal(G.mixBoards([], G.levelFor(4), { spare: spareEntries }, seeded(2)).length, 0, 'spares alone make no board');
  assert.deepEqual(G.mixBoards(TEN.slice(0, 3), G.levelFor(1), { spare: spareEntries }, seeded(2)).map((b) => b.slots.length), [3], '3 words fill one Year 2 board');
  const dup = G.mixBoards(TEN.slice(0, 5), G.levelFor(4), { spare: [mk('apple', true), ...spareEntries] }, seeded(2));
  assert.equal(dup.flatMap((b) => b.slots).filter((s) => s.word === 'apple').length, 1, 'a week word is never also a spare');
});
test('mixBoards: hidden words never appear, in a slot, a card or a statement', () => {
  for (let s = 1; s < 15; s += 1) {
    const boards = G.mixBoards(TEN, G.levelFor(5), { hidden: ['apple', 'BENCH'] }, seeded(s));
    for (const b of boards) {
      for (const sl of b.slots) assert.ok(!['apple', 'bench'].includes(sl.word));
      for (const c of b.cards) assert.ok(!['apple', 'bench'].includes(c.word));
    }
  }
  const naming = [{ word: 'candle', statements: ['We lit the candle near the apple.', 'A candle burns.'] }, mk('dragon'), mk('engine'), mk('forest')];
  const b = G.mixBoards(naming, G.levelFor(1), { hidden: ['apple'], n: 0 }, seeded(1));
  assert.ok(!b[0].slots.some((s) => s.full.includes('apple')), 'a statement that names a hidden word is not used');
});
test('mixBoards: an own word never uses statement 0 (Fill in the blanks has it); a ready-made word may', () => {
  for (let n = 0; n < 6; n += 1) {
    const boards = G.mixBoards(OWN_TEN, G.levelFor(3), { n }, seeded(n + 1));
    for (const s of boards.flatMap((b) => b.slots)) assert.notEqual(s.full, S(s.word, 0), 'own word, turn ' + n);
  }
  const seen = new Set();
  for (let n = 0; n < 3; n += 1) for (const s of G.mixBoards(TEN, G.levelFor(3), { n }, seeded(1)).flatMap((b) => b.slots)) seen.add(s.full);
  assert.ok([...seen].some((t) => t === S('apple', 0) || t === S('bench', 0) || t === S('dragon', 0) || t === S('candle', 0) || t === S('engine', 0) || t === S('forest', 0) || t === S('garden', 0) || t === S('hammer', 0) || t === S('island', 0) || t === S('jungle', 0)), 'ready-made words start at statement 0');
  const oneOwn = [own('apple', [S('apple', 0)]), ...OWN_TEN.slice(1, 4)];
  assert.ok(!G.mixBoards(oneOwn, G.levelFor(1), {}, seeded(1)).flatMap((b) => b.slots).some((s) => s.word === 'apple'), 'an own word with one statement sits out of Mix and match');
});
test('mixBoards: the next turn gives the next statement; the same seed and turn give the same boards', () => {
  const t0 = G.mixBoards(TEN, G.levelFor(3), { n: 0 }, seeded(6)).flatMap((b) => b.slots).map((s) => s.full).sort();
  const t1 = G.mixBoards(TEN, G.levelFor(3), { n: 1 }, seeded(6)).flatMap((b) => b.slots).map((s) => s.full).sort();
  assert.notDeepEqual(t0, t1);
  assert.deepEqual(G.mixBoards(TEN, G.levelFor(3), { n: 2 }, seeded(6)), G.mixBoards(TEN, G.levelFor(3), { n: 2 }, seeded(6)));
  assert.notDeepEqual(G.mixBoards(TEN, G.levelFor(3), {}, seeded(6)), G.mixBoards(TEN, G.levelFor(3), {}, seeded(7)));
});
test('mixBoards on real bank statements: every slot is a gap that holds its word once', () => {
  const ents = ['boat', 'house', 'garden', 'friend', 'school', 'light'].map((w) => ({ word: w, statements: bank.w[w] }));
  const boards = G.mixBoards(ents.filter((e) => e.statements), G.levelFor(4), { n: 1 }, seeded(3));
  assert.ok(boards.length >= 1);
  for (const s of boards.flatMap((b) => b.slots)) assert.ok(G.gapOf(s.full, s.word));
});

// ---- placing cards ------------------------------------------------------------------------------------------
const BOARD = () => G.mixBoards(TEN, G.levelFor(4), {}, seeded(11))[0];
test('placeCard: a right card stays and a wrong one adds a try to that word', () => {
  const board = BOARD();
  let st = G.newBoard();
  assert.deepEqual(st, { placed: {}, tries: {}, misses: {} });
  const right = board.slots[0].word;
  const wrong = board.slots[1].word;
  let r = G.placeCard(st, board, wrong, 0);
  assert.equal(r.hit, false);
  assert.deepEqual(r.state.placed, {});
  assert.equal(r.state.tries[wrong], 1);
  assert.equal(r.state.misses[0], 1);
  r = G.placeCard(r.state, board, wrong, 0);
  assert.equal(r.state.tries[wrong], 2, 'every miss counts');
  r = G.placeCard(r.state, board, right, 0);
  assert.equal(r.hit, true);
  assert.equal(r.state.placed[0], right);
  assert.equal(st.placed[0], undefined, 'the old state is not changed');
});
test('placeCard: a filled slot, a card already placed, an empty slot index and a card not on the board change nothing', () => {
  const board = BOARD();
  const a = board.slots[0].word;
  const b = board.slots[1].word;
  let { state } = G.placeCard(G.newBoard(), board, a, 0);
  for (const [w, i] of [[b, 0], [a, 1], [b, 9], ['zzz', 1], [b, -1]]) {
    const r = G.placeCard(state, board, w, i);
    assert.equal(r.hit, false, w + i);
    assert.equal(r.state, state, 'the very same state, no try added: ' + w + i);
  }
  assert.equal(G.placeCard(state, board, b.toUpperCase(), 1).hit, true, 'case ignored');
});
test('the spare card never fits: dropping it is a miss, charged to the spare word, not to a scored one', () => {
  const board = G.mixBoards(TEN, G.levelFor(6), {}, seeded(12))[0];
  const spare = board.cards.find((c) => c.spare).word;
  const r = G.placeCard(G.newBoard(), board, spare, 0);
  assert.equal(r.hit, false);
  assert.equal(r.state.tries[spare], 1);
  let st = G.newBoard();
  board.slots.forEach((s, i) => { st = G.placeCard(st, board, s.word, i).state; });
  assert.equal(G.boardDone(st, board), true, 'the spare stays in the tray when the board is done');
});
test('boardDone and boardPasses: scored slots only, source m, clean unless a drop missed', () => {
  const spareEntries = [mk('kettle', true)];
  const board = G.mixBoards(TEN.slice(0, 3), G.levelFor(4), { spare: spareEntries }, seeded(2))[0];
  assert.equal(board.slots.length, 4);
  let st = G.newBoard();
  assert.equal(G.boardDone(st, board), false);
  const first = board.slots.findIndex((s) => s.scored);
  const other = board.slots.findIndex((s, i) => s.scored && i !== first);
  st = G.placeCard(st, board, board.slots[other].word, first).state; // a miss
  board.slots.forEach((s, i) => { st = G.placeCard(st, board, s.word, i).state; });
  assert.equal(G.boardDone(st, board), true);
  const passes = G.boardPasses(st, board);
  assert.equal(passes.length, 3, 'the unscored spare word has no pass');
  assert.ok(passes.every((p) => p.source === 'm'));
  const missed = passes.find((p) => p.word === board.slots[other].word);
  assert.deepEqual([missed.tries, missed.clean], [1, false]);
  assert.ok(passes.filter((p) => p.word !== missed.word).every((p) => p.tries === 0 && p.clean));
  assert.ok(!passes.some((p) => p.word === 'kettle'));
});
test('glowFor: after two misses on one slot the right card glows; filled slots do not', () => {
  const board = BOARD();
  assert.equal(G.glowAfter, 2);
  const wrong = board.slots[1].word;
  let st = G.newBoard();
  assert.equal(G.glowFor(st, board), null);
  st = G.placeCard(st, board, wrong, 0).state;
  assert.equal(G.glowFor(st, board), null, 'one miss is not enough');
  st = G.placeCard(st, board, wrong, 0).state;
  assert.deepEqual(G.glowFor(st, board), { slot: 0, word: board.slots[0].word });
  st = G.placeCard(st, board, board.slots[0].word, 0).state;
  assert.equal(G.glowFor(st, board), null, 'once placed it stops');
  assert.equal(G.glowFor({ placed: {}, tries: {} }, board), null, 'an old-shaped state is fine');
});
