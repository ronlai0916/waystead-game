// SB2b: while a group's test is due, no page shows its words. Every route in
// app.js is checked, so a new route can't slip past. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as W from '../site/js/words-doc.js';
import * as St from '../site/js/study-doc.js';
import { RULES, testGuard } from '../site/js/test-guard.js';

const MON = '2026-11-02';
const plus = (n) => W.addDays(MON, n);
const at = (day) => Date.parse(day + 'T12:00:00Z');
const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const routes = [...readFileSync(file('site/js/app.js'), 'utf8').matchAll(/^ {2}\['([^']*)', /gm)].map((m) => m[1]);
const CH1 = ['build', 'earth', 'fruit', 'heart'];
const chapterWords = (y, s) => (y === 'y34' && s === 'ch01' ? CH1 : ['island', 'recent']);
const params = { gid: 'g1', yearId: 'y34', slug: 'ch01' };

// All five Study mode jobs done (SB3-A): the test is due only once they are.
function studied(d, id = 'g1', day = plus(1)) {
  const g = W.groupById(d, id);
  let x = ['hello', 'fix', 'games', 'story'].reduce((y, s) => W.markStep(y, g, s, day, at(day)), d);
  for (const w of W.rows(g)) for (const h of [9, 10, 11]) x = W.addTry(x, { id: 'p' + w + day + h, word: w, day, group: id, kind: 'p', tries: 0, peeks: 0, clean: true, now: at(day) + h });
  return x;
}
function due({ testDay = plus(5), words = ['fruit', 'earth'], study = true } = {}) {
  const d = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week', test: testDay, words, today: MON, now: at(MON) }).doc;
  return study ? studied(d) : d;
}
const take = (d, word, day, right = true) => W.addTry(d, { id: word + day, word, day, group: 'g1', kind: 't', tries: right ? 0 : 1, peeks: 0, clean: right, now: at(day) });
const guard = (pattern, d, day, p = params) => testGuard(pattern, p, d, day, chapterWords);
const addGroup = (d, id, words) => W.createGroup(d, { id, name: id, test: plus(9), words, today: plus(1), now: at(plus(1)) }).doc;

test('every route in app.js has been looked at', () => {
  assert.ok(routes.length >= 30, 'found the routes');
  for (const r of routes) assert.ok(r in RULES, 'route "' + r + '" needs a rule in test-guard.js');
  for (const r of Object.keys(RULES)) assert.ok(routes.includes(r), 'rule for a route that\'s gone: ' + r);
});
test('a route nobody has classified is blocked', () => {
  assert.equal(guard('words/g/:gid/brand-new', due(), plus(5)).id, 'g1');
});

const BLOCKED = ['words/new', 'words/progress', 'words/g/:gid/edit', 'words/g/:gid/spell/:n', 'words/g/:gid/study/:step', 'words/g/:gid/games', 'words/g/:gid/game/:game',
  ':yearId/:slug', ':yearId/:slug/study', ':yearId/:slug/study/:word', ':yearId/:slug/quick', ':yearId/:slug/quick/:word', ':yearId/:slug/practice', ':yearId/:slug/test'];
for (const r of BLOCKED) {
  test('test day: ' + r + ' shows the Test today card', () => {
    assert.equal(guard(r, due(), plus(5)).id, 'g1');
  });
  test('the day before: ' + r + ' opens as usual', () => {
    assert.equal(guard(r, due(), plus(4)), null);
  });
  test('test done: ' + r + ' opens again', () => {
    assert.equal(guard(r, take(take(due(), 'fruit', plus(5)), 'earth', plus(5)), plus(5)), null);
  });
}
for (const r of ['', 'about', 'progress', ':yearId', 'words/g/:gid', 'words/g/:gid/test']) {
  test('test day: ' + r + ' opens, and has no test word on it', () => {
    assert.equal(guard(r, due(), plus(5)), null);
  });
}
test('the group page keeps its words off on test day', () => {
  const v = readFileSync(file('site/js/words-views.js'), 'utf8');
  assert.match(v, /const testing = job === 'test'/);
  assert.match(v, /\(testing \? '' : gridHtml/);
  assert.match(v, /if \(s\.job === 'test'\) return testCard\(g\);/);
});
test('a missed test keeps its words hidden on every later day', () => {
  assert.equal(guard('words/progress', due(), plus(9)).id, 'g1');
});
test('a test left halfway keeps them hidden', () => {
  assert.equal(guard('words/progress', take(due(), 'fruit', plus(5)), plus(5)).id, 'g1');
});
test('test day with study jobs still waiting: nothing is hidden, so they can be done', () => {
  for (const r of BLOCKED) assert.equal(guard(r, due({ study: false }), plus(5)), null, r);
  assert.equal(guard('words/g/:gid/test', due({ study: false }), plus(5)), null);
  assert.equal(St.hiddenWords(due({ study: false }), plus(9)).size, 0, 'nor on later days');
  assert.equal(St.roomState(due({ study: false }), plus(5)).hideWords, false);
});
test('a deleted group hides nothing', () => {
  assert.equal(guard('words/progress', W.deleteGroup(due(), 'g1', at(plus(1))), plus(5)), null);
});

test('a chapter without a test word stays open', () => {
  assert.equal(guard(':yearId/:slug', due(), plus(5), { yearId: 'y34', slug: 'ch03' }), null);
});
test('the card for a chapter is the group holding its word; capitals don\'t matter', () => {
  assert.equal(guard(':yearId/:slug', due({ words: ['FRUIT'] }), plus(5)).id, 'g1');
});
test('another group sharing a test word is blocked, and sends you to the test', () => {
  const d = addGroup(due(), 'b', ['fruit', 'guard']);
  for (const r of ['words/g/:gid', 'words/g/:gid/spell/:n', 'words/g/:gid/game/:game', 'words/g/:gid/games']) assert.equal(guard(r, d, plus(5), { gid: 'b' }).id, 'g1', r);
});
test('another group with different words stays open', () => {
  const d = addGroup(due(), 'b', ['guard']);
  assert.equal(guard('words/g/:gid/games', d, plus(5), { gid: 'b' }), null);
  assert.equal(guard('words/g/:gid', d, plus(5), { gid: 'b' }), null);
});
test('a word back again in another group counts too', () => {
  let d = addGroup(due(), 'b', ['guard']);
  d = { ...d, groups: { ...d.groups, b: { ...d.groups.b, back: ['earth'] } } };
  assert.equal(guard('words/g/:gid', d, plus(5), { gid: 'b' }).id, 'g1');
});
test('an unknown group is left to its page', () => {
  assert.equal(guard('words/g/:gid/games', due(), plus(5), { gid: 'nope' }), null);
});

// ---- the pages that list words ---------------------------------------------------------
test('lists lose the hidden words, whatever their shape', () => {
  const hidden = St.hiddenWords(due(), plus(5));
  assert.deepEqual([...hidden].sort(), ['earth', 'fruit']);
  assert.deepEqual(St.withoutHidden(['fruit', 'guard', 'Earth'], hidden), ['guard']);
  assert.deepEqual(St.withoutHidden([{ word: 'fruit' }, { word: 'guard' }], hidden), [{ word: 'guard' }]);
});
test('nothing is hidden before the test or once it\'s done', () => {
  assert.equal(St.hiddenWords(due(), plus(4)).size, 0);
  assert.equal(St.hiddenWords(take(take(due(), 'fruit', plus(5)), 'earth', plus(5)), plus(5)).size, 0);
});
test('Pick words, Tricky words and playing a pick all use the filter (Today\'s word left the front page, SB3-F)', () => {
  const v = readFileSync(file('site/js/views.js'), 'utf8');
  assert.match(v, /const all = withoutHidden\(D\.allWords\(\), hidden\)/);
  assert.match(v, /const tricky = withoutHidden\(S\.trickyWords\(\)/);
  assert.match(v, /const list = withoutHidden\(S\.trickyWords\(\)/);
  assert.match(v, /withoutHidden\(S\.getSelection\(\), hiddenToday\(\)\)/);
});
test('words due in a test never come back in another group or a flower game', () => {
  const d = due();
  assert.deepEqual(W.returningWords(d, plus(5)), []);
  const r = W.createGroup(d, { id: 'n', name: 'N', test: plus(9), words: ['guard'], today: plus(5), now: at(plus(5)) });
  assert.deepEqual(r.doc.groups.n.back, []);
});
test('once the test is done, slipped words come back as before', () => {
  const d = take(take(due(), 'fruit', plus(5)), 'earth', plus(5), false);
  assert.ok(W.returningWords(d, plus(6)).includes('earth'));
});
test('My room hides the words of any group touching a due test', () => {
  assert.equal(St.roomState(due(), plus(5)).hideWords, true);
  assert.equal(St.roomState(due(), plus(4)).hideWords, false);
});
test('the card is the same everywhere: one function, on the group page too', () => {
  const v = readFileSync(file('site/js/words-views.js'), 'utf8');
  assert.equal(v.match(/data-testcard/g).length, 1);
  const a = readFileSync(file('site/js/app.js'), 'utf8');
  assert.match(a, /testGuard\(found\.pattern, found\.params/);
  assert.ok(a.indexOf('testGuard(found') < a.indexOf('found.view(main'), 'asked before the page is drawn');
});
test('every site script parses (the tests above only read some of them as text)', () => {
  const dir = file('site/js/');
  for (const f of readdirSync(dir, { recursive: true }).filter((x) => x.endsWith('.js'))) {
    execFileSync(process.execPath, ['--input-type=module', '--check', '-'], { input: readFileSync(dir + f), stdio: ['pipe', 'pipe', 'pipe'] });
  }
});
