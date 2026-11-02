// Spellbright and the Waystead account (B4b): signed out, today's keys exactly;
// signed in, the player's own progress (progress-doc.js), merged without losing
// a test result, trimmed before the size cap, imported once; G6; offline.
// Run: node --test tests/
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { memoryStorage, fakeAccount, manualTimers, CHILD_A, KID_A, KID_B } from '../shared/tests/fake-account.js';

globalThis.localStorage = memoryStorage();
const S = await import('../site/js/store.js');
const P = await import('../site/js/progress-doc.js');
const { needsSignIn, isPlayPath, isLocked, isOpenPath } = await import('../site/js/gate.js');
const { createApi } = await import('../site/js/account/api.js');
const { createSync } = await import('../site/js/account/sync.js');

const A = KID_A.id;
const B = KID_B.id;
const DAY = 86400000;
beforeEach(() => { localStorage.clear(); S.usePlayer(null); });

test('signed out: exactly today\'s keys and shapes (sb.progress, sb.tricky); nothing per player', () => {
  S.markStudied('y34-ch01');
  S.recordTest('y34-ch01', 9, 10);
  S.recordTest('y34-ch01', 10, 10);
  S.noteMissed('accident', 'y34-ch01');
  assert.deepEqual(localStorage.keys().sort(), ['sb.progress', 'sb.tricky']);
  const p = JSON.parse(localStorage.getItem('sb.progress'))['y34-ch01'];
  assert.deepEqual({ ...p, lastAt: 'x' }, { studied: true, practised: false, passed: true, attempts: 2, best: 10, lastAt: 'x' });
  assert.equal(JSON.parse(localStorage.getItem('sb.tricky')).accident.count, 1);
});

test('signed in: the player\'s own key only; the device\'s signed-out progress is not touched', () => {
  S.recordTest('y34-ch01', 4, 10); // signed out first
  const before = localStorage.getItem('sb.progress');
  const sent = [];
  S.usePlayer(A, (k) => sent.push(k));
  assert.equal(S.chapterProgress('y34-ch01').attempts, 0, 'a new player starts empty');
  S.markStudied('y34-ch01');
  S.recordTest('y34-ch01', 10, 10);
  S.noteMissed('island', 'y34-ch02');
  assert.equal(localStorage.getItem('sb.progress'), before);
  assert.ok(localStorage.getItem('sb.progress:' + A));
  assert.deepEqual(sent, ['progress', 'progress', 'progress']);
  const p = S.chapterProgress('y34-ch01');
  assert.equal(p.studied, true);
  assert.equal(p.passed, true);
  assert.equal(p.attempts, 1);
  assert.deepEqual(S.trickyWords().map((t) => t.word), ['island']);
});

test('two players on one device never see each other\'s progress', () => {
  S.usePlayer(A);
  S.recordTest('y34-ch01', 10, 10);
  S.noteMissed('island', 'y34-ch02');
  S.usePlayer(B);
  assert.equal(S.chapterProgress('y34-ch01').attempts, 0);
  assert.deepEqual(S.trickyWords(), []);
  S.recordTest('y56-ch01', 3, 10);
  S.usePlayer(A);
  assert.equal(S.chapterProgress('y56-ch01').attempts, 0);
  assert.equal(S.chapterProgress('y34-ch01').attempts, 1);
});

// ---- merge rules ------------------------------------------------------------------
const doc = (fn) => fn(P.emptyDoc());
const test1 = (d, id, s, at, rid) => P.recordTest(d, id, s, 10, at, rid);

test('merge: test results are a union by id; attempts are counted, never added; no result is lost', () => {
  const common = doc((d) => test1(test1(d, 'c1', 6, 1, 'r1'), 'c1', 7, 2, 'r2'));
  const here = test1(common, 'c1', 10, 3, 'r3');
  const there = test1(common, 'c1', 8, 4, 'r4');
  const m = P.merge(here, there);
  assert.deepEqual(m.results.map((r) => r.id), ['r1', 'r2', 'r3', 'r4']);
  const p = P.chapterProgress(m, 'c1');
  assert.equal(p.attempts, 4, 'not 6 (2 + 2 + 1 + 1)');
  assert.equal(p.best, 10);
  assert.equal(p.passed, true);
  assert.deepEqual(P.merge(m, m), m, 'merging again changes nothing');
  assert.deepEqual(P.merge(there, here).results, m.results, 'the order of the two copies does not matter');
});

test('merge: studied/practised keep the later time; a tricky word: the copy changed last wins', () => {
  let a = P.mark(P.emptyDoc(), 'c1', 'studiedAt', 5);
  let b = P.mark(P.emptyDoc(), 'c1', 'practisedAt', 6);
  a = P.noteMissed(P.noteMissed(a, 'island', 'c1', 10), 'island', 'c1', 11); // missed twice here (count 2)
  b = P.noteMissed(b, 'island', 'c1', 12); // once there, later
  const m = P.merge(a, b);
  assert.deepEqual(P.chapterProgress(m, 'c1').studied && P.chapterProgress(m, 'c1').practised, true);
  assert.equal(P.trickyWords(m)[0].count, 1, 'the later copy, not 3');
  const removed = P.removeTricky(m, 'island', 20);
  assert.deepEqual(P.trickyWords(P.merge(removed, a)), [], 'a removed word stays removed');
  assert.equal(P.trickyWords(P.merge(removed, P.noteMissed(a, 'island', 'c1', 21)))[0].count, 3, 'until it is missed again');
});

test('merge: "Clear my progress" wins over older progress from another device, not newer', () => {
  const old = test1(P.mark(P.emptyDoc(), 'c1', 'studiedAt', 1), 'c1', 9, 2, 'r1');
  const cleared = P.reset(10);
  const later = test1(old, 'c2', 5, 20, 'r2');
  const m = P.merge(cleared, later);
  assert.equal(P.chapterProgress(m, 'c1').attempts, 0);
  assert.equal(P.chapterProgress(m, 'c1').studied, false);
  assert.equal(P.chapterProgress(m, 'c2').attempts, 1);
});

test('size cap: past 48 KB the oldest results are folded until under 40 KB; counts, best and passed are kept', () => {
  let d = P.emptyDoc();
  const chapters = ['y34-ch01', 'y34-ch02', 'y56-ch07'];
  for (let i = 0; i < 1500; i++) d = test1(d, chapters[i % 3], i === 7 ? 10 : i % 9, 1000 + i * DAY / 10, 'r' + String(i).padStart(5, '0'));
  assert.ok(P.sizeOf(d) > P.TRIM_AT);
  const before = Object.fromEntries(chapters.map((c) => [c, P.chapterProgress(d, c)]));
  const t = P.trim(d, Date.now());
  assert.ok(P.sizeOf(t) <= P.TRIM_TO, P.sizeOf(t) + ' bytes');
  assert.ok(t.results.length > 100, 'the newest results stay in detail');
  for (const c of chapters) {
    const after = P.chapterProgress(t, c);
    assert.equal(after.attempts, before[c].attempts, c + ' attempts');
    assert.equal(after.best, before[c].best, c + ' best');
    assert.equal(after.passed, before[c].passed, c + ' passed');
  }
  // An untrimmed copy elsewhere merges in without counting the folded tests twice.
  const m = P.merge(t, d);
  for (const c of chapters) assert.equal(P.chapterProgress(m, c).attempts, before[c].attempts);
});

test('import: the device\'s signed-out progress, once; importing the same device again counts nothing twice', () => {
  S.markStudied('y34-ch01');
  S.recordTest('y34-ch01', 7, 10);
  S.recordTest('y34-ch01', 10, 10);
  S.noteMissed('island', 'y34-ch02');
  const here = S.deviceProgress();
  S.usePlayer(A);
  S.recordTest('y34-ch01', 5, 10); // the player's own, from another device
  const add = P.fromDevice(here.progress, here.tricky, 'device1', Date.now());
  const once = P.merge(S.readDoc(), add);
  const twice = P.merge(once, add);
  for (const d of [once, twice]) {
    const p = P.chapterProgress(d, 'y34-ch01');
    assert.equal(p.attempts, 3);
    assert.equal(p.best, 10);
    assert.equal(p.passed, true);
    assert.equal(p.studied, true);
    assert.deepEqual(P.trickyWords(d).map((t) => t.word), ['island']);
  }
  assert.equal(S.hasDeviceProgress(), true, 'the device keeps its own copy');
});

test('a finished test reaches the account (fake API), merged with another device\'s on 409', async () => {
  const acct = fakeAccount();
  acct.who = CHILD_A;
  const timers = manualTimers();
  const api = createApi({ origin: 'https://account.waystead.co.uk', fetch: acct.fetch });
  const docs = { [P.DOC_KEY]: { read: () => (S.hasDoc(A) ? S.readDoc(A) : undefined), write: (v) => S.writeDoc(P.normalise(v), A), merge: P.merge, prepare: (v) => P.trim(v, Date.now()) } };
  const sync = createSync({ api, game: 'spellbright', storage: localStorage, playerId: A, docs, setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  S.usePlayer(A, (k) => sync.changed(k));
  S.recordTest('y34-ch01', 8, 10);
  await timers.run();
  acct.put(A, 'spellbright', 'progress', test1(acct.get(A, 'spellbright', 'progress'), 'y34-ch01', 10, Date.now() + 5, 'elsewhere'));
  S.recordTest('y34-ch01', 9, 10);
  await timers.run();
  const saved = acct.get(A, 'spellbright', 'progress');
  assert.equal(saved.results.length, 3);
  assert.deepEqual(P.chapterProgress(saved, 'y34-ch01').attempts, 3);
  assert.equal(S.chapterProgress('y34-ch01').best, 10, 'this device has the other device\'s result too');
});

// ---- G6 -----------------------------------------------------------------------------
test('REQUIRE_SIGN_IN on (G6): the play routes need a signed-in player; the other pages, For parents included, never', () => {
  const plays = ['y34/ch01/quick', 'y34/ch01/quick/accident', 'y56/ch07/practice', 'y34/ch02/test', 'custom/play'];
  const pages = ['', 'y34', 'y34/ch01', 'y34/ch01/study', 'tricky', 'progress', 'custom', 'about'];
  for (const p of plays) {
    assert.ok(isPlayPath(p), p);
    assert.equal(needsSignIn(p, null), true, 'on: ' + p);
    assert.equal(needsSignIn(p, null, false), false, 'off: ' + p);
    assert.equal(needsSignIn(p, { id: A }), false, 'signed in: ' + p);
  }
  for (const p of pages) assert.equal(needsSignIn(p, null), false, 'never gated: ' + p);
});

test('G6b: signed out, every Spellbright page is locked except About (For parents)', () => {
  for (const p of ['', 'y34', 'y34/ch01', 'y34/ch01/study', 'y34/ch01/study/build', 'y34/ch01/quick', 'y56/ch07/practice', 'y34/ch02/test', 'tricky', 'progress', 'custom', 'custom/play', 'nope']) {
    assert.equal(isLocked(p), true, p);
  }
  assert.equal(isLocked('about'), false);
  assert.equal(isOpenPath('about'), true);
});

test('G6b: the router shows the gate card for every locked page, returning to it after sign-in', () => {
  const app = readFileSync(fileURLToPath(new URL('../site/js/app.js', import.meta.url)), 'utf8');
  assert.match(app, /account\.gate\(path, isLocked\(path\)\)/);
  assert.match(app, /gateHtml\(gateCard\(answer, navigator\.onLine\), account\.signInHref\(\), \{ href: '#\/about', label: 'About Spellbright' \}\)/);
  const play = readFileSync(fileURLToPath(new URL('../site/js/play.js', import.meta.url)), 'utf8');
  assert.doesNotMatch(play, /wa:finished/, 'no "finish this game" grace any more');
});

// ---- offline ------------------------------------------------------------------------
const SITE = fileURLToPath(new URL('../site/', import.meta.url));
const sw = readFileSync(SITE + 'sw.js', 'utf8');
const files = (dir) => readdirSync(join(SITE, dir)).flatMap((n) => (statSync(join(SITE, dir, n)).isDirectory() ? files(dir + '/' + n) : [dir + '/' + n]));

test('the service worker\'s shell has every script, the account client included', () => {
  const shell = new Function(sw.slice(sw.indexOf('const SHELL'), sw.indexOf("self.addEventListener('install'")) + '; return SHELL;')();
  assert.deepEqual(files('js').filter((f) => !shell.includes(f)), []);
});

test('the service worker answers for no account call or /api path, except the Waystead voice\'s MP3s (G8c)', () => {
  assert.match(sw, /if \(url\.origin !== location\.origin \|\| url\.pathname\.startsWith\('\/api\/'\)\) return;/);
  // The one account URL in the worker: the voice origins (tests/sw-voice.test.js drives the rule).
  const code = sw.replace(/^\s*\/\/.*$/gm, '');
  assert.deepEqual(code.match(/account\.waystead\.co\.uk/g), ['account.waystead.co.uk']);
  assert.match(code, /const VOICE_ORIGINS = \['https:\/\/account\.waystead\.co\.uk', 'http:\/\/localhost:3000'\];/);
  assert.match(code, /if \(isVoiceRequest\(url\)\) \{ event\.respondWith\(voiceRecording\(req\)\); return; \}/);
});
