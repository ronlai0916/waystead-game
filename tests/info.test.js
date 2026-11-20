// SB5 (WP-A2): the grown-up's sentence and meaning for an own word (info-doc.js, TR-93, TR-94) and how Word lists carry them. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as I from '../site/js/info-doc.js';
import * as Ow from '../site/js/own-doc.js';
import * as Su from '../site/js/setup-doc.js';

// A small child-safe list: the words these tests use. Names and numbers are not on it.
const SAFE = new Set('the a an we saw at my in on is it of and to for this that was by me you big old red small sat sail sails sailed boat tree under dog park loves quickly bright light ship water floats keeps people safe from rain is very tall plays with likes eat eats lives lives here tower day see do lighthouse shines night near sea warns ships rocks stand over there'.split(' '));
const CURRICULUM = new Set(['monday', 'happy']);
const deps = { inList: (w) => SAFE.has(w), findEntry: (w) => (CURRICULUM.has(w) ? { word: w } : null) };
const check = (x) => I.checkInfo(x, deps);

test('the limits are the TRS numbers', () => {
  assert.equal(I.MAX_INFO_BYTES, 400);
  assert.equal(I.MAX_SENTENCE_CHARS, 90);
  assert.equal(I.MAX_MEANING_CHARS, 70);
  assert.deepEqual(I.SENTENCE_WORDS, [4, 15]);
  assert.deepEqual(I.MEANING_WORDS, [2, 12]);
});
test('checkInfo accepts a plain sentence and a plain meaning', async () => {
  assert.equal(await check({ word: 'lighthouse', s: 'The lighthouse shines at night.' }), '');
  assert.equal(await check({ word: 'lighthouse', m: 'A tall tower that shines a light for ships' }), '');
  assert.equal(await check({ word: 'lighthouse', s: 'The lighthouse shines at night.', m: 'A tall tower that warns ships' }), '');
  assert.equal(await check({ word: 'lighthouse' }), '', 'nothing to check');
  assert.equal(await check({ word: 'lighthouse', s: '', m: '  ' }), '');
});
test('checkInfo: the word must be in the sentence exactly once', async () => {
  assert.equal(await check({ word: 'lighthouse', s: 'The ship sails near the sea.' }), I.LINES.needsWord('lighthouse'));
  assert.equal(await check({ word: 'lighthouse', s: 'The lighthouse and a lighthouse shine.' }), I.LINES.needsWord('lighthouse'), 'twice');
  assert.equal(await check({ word: 'lighthouse', s: 'The lighthouses shine at night.' }), I.LINES.needsWord('lighthouse'), 'another form of the word');
  assert.equal(I.LINES.needsWord('boat'), 'Please use boat once, spelled just like that.');
});
test('checkInfo: length rules for a sentence and a meaning', async () => {
  assert.equal(await check({ word: 'boat', s: 'The boat is big.' }), '', '4 words is enough');
  assert.equal(await check({ word: 'boat', s: 'The boat sat.' }), I.LINES.longer, '3 words is too few');
  assert.equal(await check({ word: 'boat', s: 'The boat ' + 'is very big and old '.repeat(3) + 'now.' }), I.LINES.shorter, 'over 15 words');
  assert.equal(await check({ word: 'boat', s: 'The boat ' + 'a'.repeat(90) }), I.LINES.shorter, 'over 90 characters');
  assert.equal(await check({ word: 'boat', m: 'Floats' }), I.LINES.longer, 'a meaning needs 2 words');
  assert.equal(await check({ word: 'boat', m: 'It is a big old red small thing that floats on water for people near the sea' }), I.LINES.shorter, 'over 12 words');
});
test('checkInfo: a name, a number, a web address and an email are refused with the everyday-words line', async () => {
  assert.equal(I.LINES.everyday, 'Please use everyday words only (no names or numbers).');
  assert.equal(await check({ word: 'boat', s: 'My friend Ben saw the boat.' }), I.LINES.everyday, 'a name in the middle');
  assert.equal(await check({ word: 'boat', s: 'Ben saw the boat by the tree.' }), I.LINES.everyday, 'a name that starts the sentence is still not a word on the lists');
  assert.equal(await check({ word: 'boat', s: 'We saw the boat at 5 oclock.' }), I.LINES.everyday, 'a number');
  assert.equal(await check({ word: 'boat', s: 'We saw the boat at www.boats.com today' }), I.LINES.everyday, 'a web address');
  assert.equal(await check({ word: 'boat', s: 'We saw the boat at https://boats' }), I.LINES.everyday);
  assert.equal(await check({ word: 'boat', s: 'Mail me about the boat at a@b.co' }), I.LINES.everyday, 'an email');
  assert.equal(await check({ word: 'boat', s: 'We saw the boat <b>now</b> by the tree' }), I.LINES.everyday, 'markup characters');
});
test('checkInfo: every other word must be on the child-safe lists; the curriculum counts too', async () => {
  assert.equal(await check({ word: 'boat', s: 'The boat is very zzxqk today.' }), I.LINES.everyday);
  assert.equal(await check({ word: 'boat', s: 'The boat is happy on Monday.' }), '', 'curriculum words and a weekday');
  assert.equal(await check({ word: 'boat', s: 'The boat is by the dog.' }), '');
  assert.equal(await check({ word: 'boat', s: 'The boat is under the dog\'s tree.' }), '', 'a possessive is not a word of its own');
  assert.equal(await check({ word: 'boat', s: 'We don\'t see the boat.' }), '', 'don\'t is read as do');
  assert.equal(await check({ word: 'boat', s: 'We can\'t see the boat.' }), I.LINES.everyday, '"can" is not on this test\'s list');
  assert.equal(await check({ word: 'boat', s: 'I saw the boat by the tree.' }), '', '"I" and "a" are words');
  assert.equal(await check({ word: 'boat', s: 'We saw a boat by the Tree.' }), I.LINES.everyday, 'a capital inside a sentence looks like a name');
});
test('checkInfo: a meaning that names the word is refused', async () => {
  assert.equal(await check({ word: 'boat', m: 'A boat that floats on water' }), I.LINES.selfMeaning);
  assert.equal(I.LINES.selfMeaning, 'The meaning should not use the word itself.');
});
test('checkInfo: sync or async inList, and offline (no list) is one kind line', async () => {
  const asyncDeps = { inList: async (w) => SAFE.has(w), findEntry: deps.findEntry };
  assert.equal(await I.checkInfo({ word: 'lighthouse', s: 'The lighthouse shines at night.' }, asyncDeps), '');
  assert.equal(await I.checkInfo({ word: 'lighthouse', s: 'The lighthouse shines at night.' }, { findEntry: deps.findEntry }), I.LINES.offline, 'needs the word list');
  assert.equal(await I.checkInfo({ word: 'happy', s: 'Monday is a happy day for you.' }, { findEntry: (w) => ({ word: w }) }), '', 'all curriculum: no list needed');
  assert.equal(I.LINES.offline, 'Adding a sentence needs a connection. Your list is saved.');
});
test('LINES: kind lines, the no-sentence count', () => {
  assert.equal(I.LINES.shorter, 'Make it a little shorter.');
  assert.equal(I.LINES.noSentence(1), '1 of your own words has no sentence yet.');
  assert.equal(I.LINES.noSentence(3), '3 of your own words have no sentences yet.');
});
test('suggestionFor: Wordbright\'s meaning and example, Wiktionary dropped, anything that fails the rules left out', () => {
  assert.deepEqual(I.suggestionFor({ m: 'A tall tower with a light for ships', e: 'The lighthouse shines at night.', p: 'noun' }, 'lighthouse'), { s: 'The lighthouse shines at night.', m: 'A tall tower with a light for ships' });
  assert.deepEqual(I.suggestionFor({ m: 'A tall tower', e: 'The lighthouse shines at night.', src: 'wikt' }, 'lighthouse'), {}, 'Wiktionary is never offered');
  assert.deepEqual(I.suggestionFor({ m: 'A lighthouse is a tower', e: 'See it.' }, 'lighthouse'), {}, 'self-naming meaning and a 2-word example both fail');
  assert.deepEqual(I.suggestionFor({ m: 'A tall tower with a light', e: 'No such word here at all.' }, 'lighthouse'), { m: 'A tall tower with a light' });
  assert.deepEqual(I.suggestionFor(new Map([['lighthouse', { m: 'A tower with a light' }]]), 'lighthouse'), { m: 'A tower with a light' }, 'a Map from lookup()');
  assert.deepEqual(I.suggestionFor(null, 'x'), {});
  assert.deepEqual(I.suggestionFor({ m: 'Has 3 parts', e: '' }, 'x'), {});
});

// ---- cleaning: the same rules, kept on the list ---------------------------------------------------------------
test('cleanInfo keeps only list words with a sentence or meaning that passes; saved in the list\'s spelling', () => {
  const words = ['Lighthouse', 'boat'];
  const out = I.cleanInfo({ lighthouse: { s: 'The lighthouse shines at night.', m: 'A tower with a light' }, boat: { s: 'No word here at all.' }, ghost: { s: 'The ghost is here today.' }, stray: 5 }, words);
  assert.deepEqual(out, { Lighthouse: { s: 'The lighthouse shines at night.', m: 'A tower with a light' } });
  assert.equal(I.cleanInfo({ boat: { s: 'No word here at all.' } }, words), undefined, 'nothing left: undefined, never {}');
  assert.equal(I.cleanInfo({}, words), undefined);
  assert.equal(I.cleanInfo(null, words), undefined);
  assert.equal(I.cleanInfo([], words), undefined);
  assert.equal(I.cleanInfo({ boat: null }, words), undefined);
});
test('cleanInfo rules: characters, lengths, hidden ids; ready-made words can be dropped', () => {
  const w = ['boat', 'tree'];
  assert.equal(I.cleanInfo({ boat: { s: 'The boat is at 5 pm now.' } }, w), undefined, 'digits');
  assert.equal(I.cleanInfo({ boat: { s: 'The boat <is> here now.' } }, w), undefined, 'characters outside letters and punctuation');
  assert.equal(I.cleanInfo({ boat: { s: 'The boat sat.' } }, w), undefined, 'under 4 words');
  assert.equal(I.cleanInfo({ boat: { m: 'Floats' } }, w), undefined, 'a 1-word meaning');
  assert.equal(I.cleanInfo({ boat: { m: 'A boat floats' } }, w), undefined, 'a meaning naming the word');
  assert.deepEqual(I.cleanInfo({ boat: { s: '  The   boat is here.  ' } }, w), { boat: { s: 'The boat is here.' } }, 'spaces tidied');
  assert.deepEqual(I.cleanInfo({ boat: { x: ['s1', 's2', 'bad id!', 's1'] } }, w), { boat: { x: ['s1', 's2'] } }, 'removed-statement ids: valid ones, once each');
  assert.deepEqual(I.cleanInfo({ boat: { x: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] } }, w).boat.x.length, 5);
  assert.deepEqual(I.cleanInfo({ boat: { s: 'The boat is here.' }, tree: { s: 'The tree is here.' } }, w, { isReady: (x) => x === 'tree' }), { boat: { s: 'The boat is here.' } });
});
test('cleanInfo: over the 400-byte budget the whole thing is dropped (the editor refuses it first)', () => {
  const words = Array.from({ length: 15 }, (_, i) => 'word' + String.fromCharCode(97 + i));
  const info = Object.fromEntries(words.map((w) => [w, { s: 'The ' + w + ' ' + 'is here and there on the day we met up.'.slice(0, 50), m: 'Something that is very big and old for us' }]));
  const big = I.cleanInfo(info, words, { noBudget: true });
  assert.ok(I.infoBytes(big) > I.MAX_INFO_BYTES, 'the fixture is over budget: ' + I.infoBytes(big));
  assert.equal(I.cleanInfo(info, words), undefined);
  assert.equal(I.infoBytes(undefined), 0);
});

// ---- the field on a Word list (own-doc.js) and its copy on a child (setup-doc.js) -------------------------------
const INFO = { lighthouse: { s: 'The lighthouse shines at night.', m: 'A tower with a light' } };
test('own-doc: a list keeps `info` for its words; no info is no key; merge lets the later entry win with its info', () => {
  const a = Ow.set({}, 'o1', { name: 'Sea', words: ['lighthouse', 'boat'], src: 'typed', to: ['k1'], info: INFO }, 100).own;
  assert.deepEqual(a.o1.info, INFO);
  assert.equal(Object.prototype.hasOwnProperty.call(Ow.set({}, 'o2', { name: 'Sea', words: ['boat'], src: 'typed', to: [] }, 100).own.o2, 'info'), false);
  assert.equal(Ow.normalise({ o1: { ...a.o1, info: {} } }).o1.info, undefined, 'info: {} is not kept');
  assert.equal(Ow.normalise({ o1: { ...a.o1, info: { ghost: { s: 'The ghost is here today.' } } } }).o1.info, undefined, 'a word not in the list');
  const later = Ow.set(a, 'o1', { name: 'Sea', words: ['lighthouse', 'boat'], src: 'typed', to: ['k1'], info: { lighthouse: { s: 'We saw the lighthouse at sea.' } } }, 200).own;
  assert.equal(Ow.merge(a, later).o1.info.lighthouse.s, 'We saw the lighthouse at sea.');
  assert.deepEqual(Ow.merge(later, a).o1, Ow.merge(a, later).o1, 'either order');
  assert.ok(later.o1.at > a.o1.at, 'a change bumps at, so the copy goes out again');
});
test('own-doc.set: editing without info keeps the earlier info for words still there; dropping a word drops its info; too big is refused', () => {
  let own = Ow.set({}, 'o1', { name: 'Sea', words: ['lighthouse', 'boat'], src: 'typed', to: [], info: INFO }, 100).own;
  own = Ow.set(own, 'o1', { name: 'Sea 2', words: ['lighthouse', 'boat', 'tree'], src: 'typed', to: [] }, 200).own;
  assert.deepEqual(own.o1.info, INFO, 'info untouched when not given');
  own = Ow.set(own, 'o1', { name: 'Sea 2', words: ['boat', 'tree'], src: 'typed', to: [] }, 300).own;
  assert.equal(own.o1.info, undefined, 'the word went, so did its info');
  own = Ow.set(own, 'o1', { name: 'Sea 2', words: ['lighthouse', 'boat'], src: 'typed', to: [], info: INFO }, 400).own;
  own = Ow.set(own, 'o1', { name: 'Sea 2', words: ['lighthouse', 'boat'], src: 'typed', to: [], info: {} }, 500).own;
  assert.equal(own.o1.info, undefined, 'info: {} clears it');
  const words = Array.from({ length: 15 }, (_, i) => 'word' + String.fromCharCode(97 + i));
  const fat = Object.fromEntries(words.map((w) => [w, { s: 'The ' + w + ' is here and there on the day we met.', m: 'Something that is very big and old for us' }]));
  assert.deepEqual(Ow.set({}, 'o3', { name: 'Big', words, src: 'typed', to: [], info: fat }, 1), { error: 'info-too-big' });
  assert.ok(Ow.set({}, 'o3', { name: 'Big', words, src: 'typed', to: [], info: { worda: fat.worda } }, 1).own.o3.info.worda);
  assert.equal(Ow.set({}, 'o4', { name: 'Sea', words: ['lighthouse'], src: 'typed', to: [], info: { lighthouse: { s: 'The lighthouse shines at night.' } } }, 1, { isReady: (w) => w === 'lighthouse' }).own.o4.info, undefined, 'ready-made words carry no info');
});
test('own-doc: the delivery rule sees a changed info as behind (the master\'s at moved)', () => {
  const a = Ow.set({}, 'o1', { name: 'Sea', words: ['lighthouse'], src: 'typed', to: ['k1'] }, 100).own;
  const copyDoc = Su.setOwnCopy({}, 'o1', { name: 'Sea', words: ['lighthouse'], src: 'typed' }, a.o1.at).setup;
  assert.equal(Ow.delivery(a, { k1: copyDoc })[0].state, 'sent');
  const b = Ow.set(a, 'o1', { name: 'Sea', words: ['lighthouse'], src: 'typed', to: ['k1'], info: INFO }, 200).own;
  assert.equal(Ow.delivery(b, { k1: copyDoc })[0].state, 'behind');
});
test('setup-doc: a child\'s copy carries info through setOwnCopy, normalise, merge and trim', () => {
  const r = Su.setOwnCopy({}, 'o1', { name: 'Sea', words: ['lighthouse', 'boat'], src: 'typed', info: INFO }, 100);
  assert.deepEqual(r.setup.own.o1.info, INFO);
  assert.deepEqual(Su.normalise(r.setup).own.o1.info, INFO);
  assert.deepEqual(Su.liveOwn(r.setup)[0].info, INFO);
  const none = Su.setOwnCopy({}, 'o2', { name: 'Sea', words: ['boat'], src: 'typed' }, 100).setup;
  assert.equal('info' in none.own.o2, false);
  const newer = Su.setOwnCopy(r.setup, 'o1', { name: 'Sea', words: ['lighthouse', 'boat'], src: 'typed', info: { boat: { s: 'We sat on the boat today.' } } }, 200).setup;
  assert.equal(Su.merge(r.setup, newer).own.o1.info.boat.s, 'We sat on the boat today.');
  assert.deepEqual(Su.trim(r.setup, 1e12).own.o1.info, INFO);
  assert.equal(Su.normalise({ own: { o1: { name: 'x', words: ['boat'], src: 'typed', at: 1, info: { boat: { s: 'Too short.' } } } } }).own.o1.info, undefined, 'the same rules as the master');
});
test('16c behaviour on purpose: a device that does not know `info` keeps every word, list and week (here: normalise without the key)', () => {
  const a = Ow.set({}, 'o1', { name: 'Sea', words: ['lighthouse', 'boat'], src: 'typed', to: ['k1'], info: INFO }, 100).own;
  const { info, ...as16c } = a.o1;
  void info;
  const back = Ow.normalise({ o1: as16c });
  assert.deepEqual(back.o1.words, ['lighthouse', 'boat']);
  assert.equal(back.o1.info, undefined);
  assert.equal(Ow.merge(a, back).o1.info, undefined, 'the same at: the larger JSON wins, so info comes back only on the next send');
});
