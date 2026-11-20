// SB5 (WP-A): the child's Practice order (practice-doc.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as PD from '../site/js/practice-doc.js';
import * as C from '../site/js/child-doc.js';

const own = [
  { id: 'o1', name: 'Old list', words: ['island'], at: 1 },
  { id: 'o2', name: 'New list', words: ['quay', 'weight'], at: 9 },
];

test('lists first when the child has one, newest first', () => {
  const s = PD.practiceSections({ own, hidden: [] });
  assert.deepEqual(s.map((x) => x.kind), ['lists', 'sentenceGames', 'tricky', 'years', 'pick', 'progress']);
  assert.deepEqual(s[0].items, [{ id: 'o2', name: 'New list' }, { id: 'o1', name: 'Old list' }]);
});

test('no list: the year chapters lead and there is no lists section', () => {
  assert.deepEqual(PD.practiceSections({ own: [], hidden: [] }).map((x) => x.kind), ['years', 'sentenceGames', 'tricky', 'pick', 'progress']);
  assert.deepEqual(PD.practiceSections({}).map((x) => x.kind), ['years', 'sentenceGames', 'tricky', 'pick', 'progress']);
});

test('a list holding a hidden word has a name and no link (case ignored, a Set works)', () => {
  const s = PD.practiceSections({ own, hidden: ['QUAY'] });
  assert.deepEqual(s[0].items, [{ id: 'o2', name: 'New list', hidden: true }, { id: 'o1', name: 'Old list' }]);
  assert.equal(PD.practiceSections({ own, hidden: new Set(['island']) })[0].items[1].hidden, true);
});

test('child copy: short sentences, no grown-up words', () => {
  for (const s of [PD.PRACTICE_TITLE, PD.FROM_GROWNUP, PD.PRACTICE_SUB, PD.HIDDEN_LINE]) {
    assert.ok(s.split(/\s+/).length <= 8, s);
    assert.doesNotMatch(s, /\bgroup\b|word list|own chapter|list library/i, s);
  }
  assert.equal(PD.PRACTICE_SUB, C.menuRows({ hasGroup: false }).find((r) => r.id === 'practice').sub);
});

// ---- SB5 (WP-A2, TR-101): the Sentence games tile ---------------------------------------------------------
test('the Sentence games tile follows the first section: Meaning match, Fill in the blanks, Mix and match', () => {
  const withLists = PD.practiceSections({ own, hidden: [] });
  assert.deepEqual(withLists[1], { kind: 'sentenceGames', items: ['match', 'fill', 'mix'] });
  const none = PD.practiceSections({ own: [], hidden: [] });
  assert.deepEqual(none.map((x) => x.kind), ['years', 'sentenceGames', 'tricky', 'pick', 'progress']);
  assert.deepEqual(none[1].items, ['match', 'fill', 'mix']);
  assert.deepEqual(PD.SENTENCE_GAMES, ['match', 'fill', 'mix']);
});
test('no week yet: no Sentence games tile', () => {
  assert.deepEqual(PD.practiceSections({ own, hasWeek: false }).map((x) => x.kind), ['lists', 'tricky', 'years', 'pick', 'progress']);
  assert.deepEqual(PD.practiceSections({ own: [], hasWeek: false }).map((x) => x.kind), ['years', 'tricky', 'pick', 'progress']);
});
test('the tile never changes the lists: a hidden word still hides its list, and a tile is a new object each time', () => {
  const s = PD.practiceSections({ own, hidden: ['quay'] });
  assert.equal(s[0].items[0].hidden, true);
  s[1].items.pop();
  assert.deepEqual(PD.practiceSections({ own, hidden: [] })[1].items, ['match', 'fill', 'mix']);
});
test('the tile\'s copy is short and child-safe, and the games it opens exist', async () => {
  const G = await import('../site/js/games-doc.js');
  for (const s of [PD.SENTENCE_GAMES_TITLE, PD.SENTENCE_GAMES_SUB]) {
    assert.ok(s.split(/\s+/).length <= 8, s);
    assert.doesNotMatch(s, /\bgroup\b|word list|own chapter|list library/i, s);
  }
  assert.equal(PD.SENTENCE_GAMES_TITLE, 'Sentence games');
  for (const id of PD.SENTENCE_GAMES) assert.ok(G.GAMES[id].title, id);
});
