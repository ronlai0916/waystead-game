// SB4-WP7: a grown-up's own chapters: the child's chapter shape, the one save path, the words check, the guard rule, parentOf, the plan hand-off.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const W = await import('../site/js/words-doc.js');
const St = await import('../site/js/study-doc.js');
const Ow = await import('../site/js/own-doc.js');
const Su = await import('../site/js/setup-doc.js');
const Ch = await import('../site/js/chapters-doc.js');
const S = await import('../site/js/store.js');
const A = await import('../site/js/grownups-data.js');
const D = await import('../site/js/own-data.js');
const { checkTyped, REFUSED, NEEDS_LIST } = await import('../site/js/wordcheck.js');
const { testGuard, RULES } = await import('../site/js/test-guard.js');
const { fakeAccount } = await import('../shared/tests/fake-account.js');

const ADULT = '33333333-3333-4333-8333-333333333333';
const K1 = '11111111-1111-4111-8111-111111111111';
const K2 = '22222222-2222-4222-8222-222222222222';
const MON = '2026-11-02';
const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
let clock = Date.parse(MON + 'T10:00:00Z');
const now = () => (clock += 1000);
const WORDS = ['island', 'because', 'friend', 'lantern'];

function setUp() {
  mem.clear();
  S.usePlayer(ADULT);
  const acct = fakeAccount();
  acct.children = (id) => (id === ADULT ? [{ id: K1, nickname: 'Robin', year: 4, avatar: null }, { id: K2, nickname: 'Wren', year: 6, avatar: null }] : []);
  acct.who = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };
  acct.put(K1, 'spellbright', 'words', W.emptyDoc());
  acct.put(K2, 'spellbright', 'words', W.emptyDoc());
  return { acct, api: A.createChildApi({ origin: 'https://account.example', fetch: acct.fetch }) };
}
const master = () => Ow.normalise(W.ownOf(S.readWords()));
const copyOn = async (api, k, oid) => ((await A.readChild(api, k)).setup.own || {})[oid];

test('ownChapter: the shape, and null for a missing or gone copy', () => {
  const entryFor = (w) => ({ word: w, chunks: [w] });
  const setup = { own: { o1: { name: 'Spring', words: ['island', 'quay'], src: 'typed', at: 5 }, o2: { name: 'Old', words: ['x'], src: 'typed', at: 5, gone: 9 } } };
  assert.deepEqual(Ch.ownChapter(setup, 'o1', entryFor), { id: 'own-o1', own: true, n: null, title: 'Spring', yearId: null, index: 0, words: [entryFor('island'), entryFor('quay')], base: '#/words/own/o1' });
  assert.equal(Ch.ownChapter(setup, 'o2', entryFor), null);
  assert.equal(Ch.ownChapter(setup, 'nope', entryFor), null);
  assert.equal(Ch.ownChapter({}, 'o1', entryFor), null);
});

test('saveOwnChapter: new, shared with two, then an edit keeps the oid and the copies follow', async () => {
  const { api } = setUp();
  const r = await D.saveOwnChapter(api, { name: 'Week', words: WORDS, to: [K1, K2] }, { now });
  assert.equal(r.ok, true);
  assert.deepEqual(r.notSent, []);
  const m = master()[r.oid];
  assert.deepEqual(m.to, [K1, K2]);
  for (const k of [K1, K2]) {
    const c = await copyOn(api, k, r.oid);
    assert.equal(c.at, m.at);
    assert.deepEqual(c.words, WORDS);
  }
  const e = await D.saveOwnChapter(api, { oid: r.oid, name: 'Week 2', words: WORDS.slice(1), to: [K1, K2] }, { now });
  assert.equal(e.oid, r.oid);
  assert.equal(Object.keys(master()).length, 1);
  const c = await copyOn(api, K2, r.oid);
  assert.equal(c.name, 'Week 2');
  assert.equal(c.at, master()[r.oid].at);
  assert.ok(c.at > m.at);
});

test('saveOwnChapter: un-sharing one child marks their copy gone', async () => {
  const { api } = setUp();
  const r = await D.saveOwnChapter(api, { name: 'Week', words: WORDS, to: [K1, K2] }, { now });
  await D.saveOwnChapter(api, { oid: r.oid, name: 'Week', words: WORDS, to: [K1] }, { now });
  assert.ok((await copyOn(api, K2, r.oid)).gone > 0);
  assert.equal((await copyOn(api, K1, r.oid)).gone, undefined);
  assert.equal(Su.liveOwn((await A.readChild(api, K2)).setup).length, 0);
});

test('saveOwnChapter: a child who cannot be reached is in notSent, the master is saved', async () => {
  const { api } = setUp();
  const broken = { ...api, game: (id) => (id === K2 ? Promise.resolve({ ok: false, status: 0, data: null }) : api.game(id)) };
  const r = await D.saveOwnChapter(broken, { name: 'Week', words: WORDS, to: [K1, K2] }, { now });
  assert.equal(r.ok, true);
  assert.deepEqual(r.notSent, [K2]);
  assert.ok(master()[r.oid]);
  assert.ok(await copyOn(api, K1, r.oid));
  assert.equal(await copyOn(api, K2, r.oid), undefined);
});

test('saveOwnChapter: a 409 is retried and the child\'s newer work is kept', async () => {
  const { acct, api } = setUp();
  let first = true;
  const racing = { ...api, put: async (id, key, value, version) => {
    if (first) { first = false; acct.put(K1, 'spellbright', 'words', W.withSetup(W.emptyDoc(), Su.setHelp({}, 2, 5, 'Sam'))); }
    return api.put(id, key, value, version);
  } };
  const r = await D.saveOwnChapter(racing, { name: 'Week', words: WORDS, to: [K1] }, { now });
  assert.deepEqual(r.notSent, []);
  const c = await A.readChild(api, K1);
  assert.equal(c.setup.help.lv, 2);
  assert.ok(c.setup.own[r.oid]);
});

test('delete, then restore: the master and each copy follow', async () => {
  const { api } = setUp();
  const r = await D.saveOwnChapter(api, { name: 'Week', words: WORDS, to: [K1, K2] }, { now });
  const d = await D.deleteOwnChapter(api, r.oid, { now });
  assert.equal(d.ok, true);
  assert.ok(master()[r.oid].gone);
  assert.ok((await copyOn(api, K1, r.oid)).gone);
  assert.deepEqual(Ow.deleted(master(), clock).map((e) => e.id), [r.oid]);
  const b = await D.restoreOwnChapter(api, r.oid, { now });
  assert.equal(b.ok, true);
  assert.equal(master()[r.oid].gone, undefined);
  for (const k of [K1, K2]) assert.equal((await copyOn(api, k, r.oid)).gone, undefined);
  assert.equal((await D.deleteOwnChapter(api, 'nope', { now })).error, 'not-there');
});

test('the 31st list is refused', async () => {
  const { api } = setUp();
  let own = {};
  for (let i = 0; i < 30; i += 1) own = Ow.set(own, 'o' + i, { name: 'L' + i, words: ['island'], src: 'typed', to: [] }, 1000 + i).own;
  S.updateWords((d) => W.withOwn(d, own));
  const r = await D.saveOwnChapter(api, { name: 'One more', words: WORDS, to: [K1] }, { now });
  assert.equal(r.error, 'too-many');
  assert.equal(D.OWN_ERRORS['too-many'], 'You have 30 word lists. Delete one to make another.');
  assert.equal(Ow.live(master()).length, 30);
});

test('syncOwn repairs: a field dropped by an older app comes back from the copies', async () => {
  const { api } = setUp();
  const r = await D.saveOwnChapter(api, { name: 'Week', words: WORDS, to: [K1, K2] }, { now });
  S.updateWords((d) => W.withOwn(d, {}));
  assert.deepEqual(master(), {});
  const s = await D.syncOwn(api, [{ id: K1 }, { id: K2 }], { now });
  assert.deepEqual(s.notSent, []);
  assert.deepEqual(master()[r.oid].to.sort(), [K1, K2].sort());
  assert.equal(master()[r.oid].name, 'Week');
});

test('a refused word has one line, whether blocked or unknown; a repeat and the 16th are told apart', async () => {
  for (const raw of ["it's", 'well-known', 'ice cream', 'x1']) assert.deepEqual(await checkTyped(raw, () => null), { error: REFUSED });
  const unknown = async () => ({ error: REFUSED });
  const blocked = async () => ({ error: REFUSED });
  const a = await D.addTyped('grlpx', [], unknown);
  const b = await D.addTyped('grlpx', [], blocked);
  assert.deepEqual(a, b);
  assert.deepEqual(a.refused, ['grlpx']);
  assert.equal(D.OWN_REFUSED, "We can't use this word yet");
  const ok = async (w) => ({ word: w.toLowerCase() });
  const rep = await D.addTyped('island, Island', ['island'], ok);
  assert.deepEqual(rep.list, ['island']);
  assert.equal(rep.repeats.length, 2);
  assert.equal(D.OWN_REPEAT, 'Already in the list');
  const many = await D.addTyped(Array.from({ length: 17 }, (_, i) => 'w' + String.fromCharCode(97 + i)).join(', '), [], ok);
  assert.equal(many.list.length, 15);
  assert.equal(many.full, true);
  assert.equal((await D.addTyped('island', [], async () => ({ error: NEEDS_LIST }))).offline, true);
  assert.deepEqual(D.splitTyped('a, b\nc;d'), ['a', 'b', 'c', 'd']);
  assert.deepEqual(D.splitTyped('1. island\n2) quay\r\n3 .because\t4.  friend'), ['island', 'quay', 'because', 'friend'], 'list numbers are stripped');
  assert.deepEqual(D.splitTyped('x1, 12'), ['x1', '12'].map((x) => x), 'a word is not mistaken for a number');
});

test('a paste with line breaks or tabs becomes one comma list; a plain paste is left alone', () => {
  assert.equal(D.needsPaste('island\nquay'), true);
  assert.equal(D.needsPaste('island\tquay'), true);
  assert.equal(D.needsPaste('island, quay'), false);
  assert.equal(D.pasteText('island\r\nquay\n\nbecause\n'), 'island, quay, because');
  assert.equal(D.pasteText('\nisland\tquay'), 'island, quay');
  assert.deepEqual(D.splitTyped(D.pasteText('1. island\n2. quay')), ['island', 'quay']);
});

test('words past 15 are named, and the add says what it did once', async () => {
  const ok = async (w) => ({ word: w.toLowerCase() });
  const start = Array.from({ length: 13 }, (_, i) => 'w' + String.fromCharCode(97 + i));
  const r = await D.addTyped('one, two, three, four, island', start, ok);
  assert.equal(r.list.length, 15);
  assert.deepEqual(r.dropped, ['three', 'four', 'island']);
  assert.equal(D.addedLine(r, 13), "2 added. Not added, no room: three, four, island.");
  const m = await D.addTyped('grlpx, wa, wa', [], async (w) => (w === 'grlpx' ? { error: REFUSED } : { word: w }));
  assert.equal(D.addedLine(m, 0), "1 added. 1 we can't use yet. 1 already in the list.");
});

test('an oid is checked: only letters, digits, - and _; a bad address never throws', () => {
  assert.equal(D.validOid('r1a2b3'), true);
  for (const bad of ['', 'a/b', '../x', 'a b', 'x'.repeat(41), '<img>']) assert.equal(D.validOid(bad), false, bad);
  assert.equal(Ch.safeDecode('%E0%A4%A'), '');
  assert.equal(Ch.safeDecode('r%31'), 'r1');
  const setup = { own: { 'a/b': { name: 'X', words: ['x'], src: 'typed', at: 1 } } };
  assert.equal(Ch.ownChapter(setup, 'a/b', (w) => ({ word: w })), null);
});

test('the own guard rule: blocked when it shares a hidden word, open otherwise', () => {
  const g = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week', test: W.addDays(MON, 5), words: ['fruit', 'earth'], today: MON, now: 1 }).doc;
  const day1 = W.addDays(MON, 1);
  const grp = W.groupById(g, 'g1');
  let d = ['hello', 'fix', 'games', 'story'].reduce((x, s) => W.markStep(x, grp, s, day1, 2), g);
  for (const w of W.rows(grp)) for (const h of [9, 10, 11]) d = W.addTry(d, { id: 'p' + w + h, word: w, day: day1, group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, now: 5 + h });
  const day = W.addDays(MON, 5);
  assert.ok(St.dueGroups(d, day).length);
  const words = { o1: ['Fruit', 'quay'], o2: ['island'] };
  const cw = (y, s, p) => words[p.oid];
  for (const pat of Object.keys(RULES).filter((r) => RULES[r] === 'own')) {
    assert.equal(testGuard(pat, { oid: 'o1' }, d, day, cw).id, 'g1', pat);
    assert.equal(testGuard(pat, { oid: 'o2' }, d, day, cw), null, pat);
    assert.equal(testGuard(pat, { oid: 'o1' }, d, W.addDays(MON, 4), cw), null, pat);
  }
  assert.equal(Object.keys(RULES).filter((r) => RULES[r] === 'own').length, 8);
});

test('parentOf: a page of an own chapter goes up to the chapter, the chapter to More practice', () => {
  const src = readFileSync(file('site/js/app.js'), 'utf8');
  const body = /function parentOf\(path\) \{([\s\S]*?)\n\}/.exec(src)[1];
  const parentOf = new Function('path', body);
  assert.equal(parentOf('words/own/r1/study'), '#/words/own/r1');
  assert.equal(parentOf('words/own/r1/study/island'), '#/words/own/r1');
  assert.equal(parentOf('words/own/r1/quiz'), '#/words/own/r1');
  assert.equal(parentOf('words/own/r1'), '#/chapters');
  assert.equal(parentOf('grownups/own/new'), '#/grownups/own');
  assert.equal(parentOf('grownups/own'), '#/grownups');
});

test('the plan hand-off is read once', () => {
  const m = new Map();
  const st = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
  st.setItem(D.PLAN_KEY, JSON.stringify(['island', 'quay']));
  assert.deepEqual(D.takePlanWords(st), ['island', 'quay']);
  assert.equal(D.takePlanWords(st), null);
  m.set(D.PLAN_KEY, '{bad');
  assert.equal(D.takePlanWords(st), null);
  assert.equal(m.has(D.PLAN_KEY), false);
});

test('the lines, and no inline style or script in what this package wrote', () => {
  assert.equal(D.savedLine(['Robin', 'Wren']), "Saved. Robin and Wren can find it under 'From your grown-up'.");
  assert.equal(D.startedLine(['Robin']), 'Robin has started this list. Changes show next time Robin plays.');
  assert.equal(D.deleteTitle('School words, 13 Nov'), "Delete 'School words, 13 Nov'?");
  assert.equal(D.deleteBody(['Robin']), "Robin's stars stay.");
  assert.equal(D.defaultName('2026-11-13'), 'School words, 13 Nov');
  assert.equal(D.countLine(8), '8 of 15 words');
  for (const f of ['site/js/own-views.js', 'site/js/own-data.js']) {
    const s = readFileSync(file(f), 'utf8');
    assert.doesNotMatch(s, /style="|<script|\.innerHTML\s*=\s*[^;]*style=/, f);
    assert.doesNotMatch(s, /\b(SEN|OCR|toggle|scaffold)\b/, f);
  }
  const sw = readFileSync(file('site/sw.js'), 'utf8');
  assert.ok(sw.includes("'js/own-views.js'") && sw.includes("'js/own-data.js'"));
});
