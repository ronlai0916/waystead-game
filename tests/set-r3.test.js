// SB5 round 3b (R3): Set a week gaps (Add a word on the trim step, Save in, the one no-sentences wording and its link, scanOn from the
// allowance, "Updated with the latest"), the week id of typed words, and the pure rules of the list pages (did-you-mean, copies, Give).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const V = await import('../site/js/set-views.js');
const L = await import('../site/js/lists-doc.js');
const I = await import('../site/js/info-doc.js');
const W = await import('../site/js/words-doc.js');
const S = await import('../site/js/store.js');
const Ow = await import('../site/js/own-doc.js');
const SET = await import('../site/js/set-doc.js');
const A = await import('../site/js/grownups-data.js');
const SD = await import('../site/js/set-data.js');
const D = await import('../site/js/own-data.js');
const { fakeAccount } = await import('../shared/tests/fake-account.js');

const read = (p) => readFileSync(fileURLToPath(new URL('../' + p, import.meta.url)), 'utf8');
const SRC = read('site/js/set-views.js');

// ---- Set a week ---------------------------------------------------------------------------------------------------------------
test('trim step: "Add a word" with its help line, and the add box is off at 15 words', () => {
  const some = V.trimHtml({ label: 'Class 4', words: Array.from({ length: 12 }, (_, i) => 'w' + i), ticked: ['w0'] });
  assert.match(some, /Add a word/);
  assert.match(some, /A list plus words you add is saved as a new list in Word lists\./);
  assert.doesNotMatch(some, /data-addword[^>]*disabled/);
  const msg = V.trimHtml({ label: 'x', words: ['a', 'b'], ticked: ['a'], msg: 'Already in the list' });
  assert.match(msg, /Already in the list/);
});
test('Save in: a new list first, then each list with room; none when there is no list', () => {
  assert.equal(V.saveInHtml({ saveIn: [] }), '');
  const h = V.saveInHtml({ saveIn: [{ id: 'r1', label: 'Class 4' }], addTo: 'r1' });
  assert.match(h, /<option value="">A new list<\/option>/);
  assert.match(h, /<option value="r1" selected>Class 4<\/option>/);
  const t = V.typeAllHtml({ listName: 'x', text: 'a', count: 1, saveIn: [{ id: 'r1', label: 'Class 4' }], addTo: 'r1' });
  assert.match(t, /data-addto/);
  assert.doesNotMatch(t, /data-listname/); // the list's own name stays
});
test('one wording for "no sentences yet", and its link goes to the sentences page', () => {
  assert.equal(V.noSentenceLine(2), I.LINES.noSentence(2));
  assert.equal(I.LINES.noSentence(2), '2 of your own words have no sentences yet.');
  assert.match(SRC, /\/sentences'/);
});
test('scan comes from the allowance, never a fixed false', () => {
  assert.doesNotMatch(SRC, /scanOn: false/);
  assert.match(SRC, /Sc\.isOn\(await within\(ScD\.allowance\(/);
});
test('ready-made chapter and own list offer a copy', () => {
  const r = V.wordsHtml({ tab: 'ready', sub: '', backLabel: 'Children', years: [{ id: 'y4', label: 'Year 4', on: true }], yearId: 'y4', chapters: [{ id: 'y4c3', on: true, title: 'Chapter 3', small: '10 words', words: ['a'] }], chaptersTitle: 'Year 4', ready: true, barLine: '', why: '' });
  assert.match(r, /Make my own copy/);
  assert.match(r, /#\/grownups\/own\/ready\/y4c3\/copy/);
  const l = V.wordsHtml({ tab: 'lists', sub: '', backLabel: 'Children', lists: [{ id: 'r000000000001', on: true, title: 'Class 4', small: '15 words' }], ready: true, barLine: '', why: '' });
  assert.match(l, /Edit a copy/);
  assert.match(l, /#\/grownups\/own\/r000000000001\/copy/);
});

// ---- the week id of typed words ----------------------------------------------------------------------------------------------------
test('setWeekFromWords: the week ids carry the new list\'s id, not "a."; "Save in" adds to a chosen list', async () => {
  mem.clear();
  const ADULT = '33333333-3333-4333-8333-333333333333';
  S.usePlayer(ADULT);
  const acct = fakeAccount();
  const kid = '00000000-0000-4000-8000-000000000001';
  acct.children = (id) => (id === ADULT ? [{ id: kid, nickname: 'Kid', year: 4, avatar: null }] : []);
  acct.who = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };
  acct.put(kid, 'spellbright', 'words', W.emptyDoc());
  const api = A.createChildApi({ origin: 'https://account.example', fetch: (u, i) => acct.fetch(u, i) });
  let clock = Date.parse('2026-11-02T10:00:00Z');
  const now = () => (clock += 1000);
  const gids = SD.makeGids([kid], { oid: '', role: 'parent' });
  assert.match(gids[kid], /^a\./);
  const r = await SD.setWeekFromWords(api, { words: ['quay', 'weight'], name: 'Week', cids: [kid], gids, test: '2026-11-09', today: '2026-11-02' }, { now });
  assert.ok(r.oid && r.results[kid].ok);
  assert.equal(SET.weekListOid(r.gids[kid]), r.oid);
  const d = W.normalise(acct.get(kid, 'spellbright', 'words'));
  assert.deepEqual(Object.keys(d.groups), [r.gids[kid]]);
  assert.equal(SET.weeksFromList(d, r.oid).length, 1);
  // add to the chosen list
  const g2 = SD.makeGids([kid], { oid: '', role: 'parent' });
  const r2 = await SD.setWeekFromWords(api, { words: ['guard'], name: 'More', cids: [kid], gids: g2, test: '2026-11-10', today: '2026-11-02', addTo: r.oid }, { now });
  assert.equal(r2.oid, r.oid);
  assert.deepEqual(Ow.normalise(W.ownOf(S.readWords()))[r.oid].words, ['quay', 'weight', 'guard']);
  assert.equal(SET.weekListOid(r2.gids[kid]), r.oid);
  // a full list refuses before any child call
  const full = 'apple bread chair dance eagle faint grape horse ivory joker kitten lemon mango nurse olive'.split(' ');
  assert.ok(D.saveOwnMaster({ oid: r.oid, name: 'Class', words: full, src: 'typed', to: [] }).ok);
  acct.calls.length = 0;
  const r3 = await SD.setWeekFromWords(api, { words: ['island'], name: 'x', cids: [kid], gids: SD.makeGids([kid], { oid: '', role: 'parent' }), test: '2026-11-11', today: '2026-11-02', addTo: r.oid }, { now });
  assert.deepEqual(r3, { error: 'too-many-words' });
  assert.equal(acct.calls.length, 0);
});

// ---- the list pages' rules -------------------------------------------------------------------------------------------------------
test('did you mean: one letter away (two for a longer word), the same first letter first, nothing when far or short', () => {
  const list = ['necessary', 'separate', 'definitely', 'guard', 'island'];
  assert.equal(L.suggestWord('neccessary', list), 'necessary');
  assert.equal(L.suggestWord('seperate', list), 'separate');
  assert.equal(L.suggestWord('definately', list), 'definitely');
  assert.equal(L.suggestWord('gard', list), 'guard');
  assert.equal(L.suggestWord('xyzzy', list), '');
  assert.equal(L.suggestWord('ab', list), '');
  assert.equal(L.suggestWord('guard', list), ''); // the word itself is not a suggestion
  assert.equal(L.suggestWord('gard', list, { skip: ['guard'] }), ''); // already in the list
  assert.equal(L.suggestWord('b4d', list), ''); // a number is not a typo of a word
  assert.equal(L.editDistance('kitten', 'sitting', 5), 3);
  assert.equal(L.didYouMean('guard'), 'Did you mean “guard”?');
});
test('copy: what was taken out and put in; names for the second list', () => {
  assert.deepEqual(L.copyDiff(['a', 'b', 'c'], ['a', 'C', 'd']), { out: ['b'], in: ['d'] });
  assert.equal(L.secondLine(5), 'Make a second list with those 5');
  assert.ok(L.secondName('x'.repeat(40)).length <= Ow.MAX_NAME);
  assert.equal(L.secondName('Class 4'), 'Class 4 2');
});
test('Given to lines, the Give for practice button and the given title', () => {
  const week = { start: '2026-11-15', test: '2026-11-20', words: ['a', 'b'] };
  assert.equal(L.givenLineFor(week, ['a', 'b', 'c'], '2026-11-23'), 'Week of Sun 15 Nov · first 2 words · tested 20 Nov');
  assert.equal(L.givenLineFor(null, ['a'], '2026-11-23'), 'Practice only');
  assert.equal(L.giveButton(0), 'Give for practice');
  assert.equal(L.giveButton(1), 'Give to 1 child');
  assert.equal(L.giveButton(3), 'Give to 3 children');
  assert.equal(L.givenTitle(['Ada']), 'Given for practice to Ada');
  assert.equal(L.madeLine(15, '2026-11-10', '2026-11-23'), '15 words · made 10 Nov');
  assert.equal(L.madeLine(12, '2026-11-23', '2026-11-23'), '12 words · made today');
});

// ---- the views' sources ----------------------------------------------------------------------------------------------------------------
test('the new list pages are exported and keep the rules: no inline style, nothing stored on a child, no :has', () => {
  const ov = read('site/js/own-views.js');
  for (const n of ['listPage', 'givePage', 'copyPage', 'readyLists', 'readyList', 'sentencesPage']) assert.match(ov, new RegExp('export (async )?function ' + n + '\\b'), n);
  assert.doesNotMatch(ov, /style="|\.style\./);
  assert.match(ov, /Make a second list|secondLine/);
  assert.match(ov, /data-act="fix"/);
  assert.match(ov, /data-notgiven/);
  assert.match(read('site/js/results-views.js'), /data-notgiven/);
  assert.doesNotMatch((read('site/css/lists.css') + read('site/css/set.css')).replace(/\/\*[\s\S]*?\*\//g, ''), /:has\(/);
});
test('every class the three views use has a CSS rule (ids and attributes are not classes)', () => {
  const css = ['lists.css', 'set.css', 'grownups.css', 'adult.css', 'app.css'].map((f) => read('site/css/' + f)).join('\n');
  const have = new Set([...css.matchAll(/\.([A-Za-z][\w-]*)/g)].map((m) => m[1]));
  const miss = new Set();
  for (const f of ['own-views.js', 'results-views.js', 'set-views.js']) {
    for (const m of read('site/js/' + f).matchAll(/class="((?:st|ls)-[^"]*)"/g)) for (const c of m[1].split(/\s+/)) if (/^(st|ls)-[a-z][\w-]*$/.test(c) && !have.has(c) && !/^st-g\d/.test(c)) miss.add(f + ' ' + c);
  }
  assert.deepEqual([...miss], []);
});
