// One-load updates (G4b): a new release's worker reloads the page at once, or
// after the game in progress; an unknown My words page waits for it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { watchForUpdate } from '../site/js/update/update.js';
import { isWordsPath, isPlayPath } from '../site/js/gate.js';

const read = (f) => readFileSync(new URL('../site/' + f, import.meta.url), 'utf8');

class Worker {
  constructor() { this.state = 'installing'; this.fns = []; }
  addEventListener(t, fn) { this.fns.push(fn); }
  become(s) { this.state = s; this.fns.forEach((f) => f()); }
}
function setup({ controller = {}, busy = false, reg = {}, wait = 1000 } = {}) {
  const t = { reloads: 0, busy, leave: [], fns: [], timers: [] };
  t.reg = { update: async () => {}, installing: null, waiting: null, ...reg };
  t.sw = {
    controller,
    addEventListener: (type, fn) => { assert.equal(type, 'controllerchange'); t.fns.push(fn); },
    register: async (path, opts) => { assert.equal(path, 'sw.js'); assert.deepEqual(opts, { updateViaCache: 'none' }); return t.reg; },
  };
  t.watch = watchForUpdate({ sw: t.sw, isBusy: () => t.busy, reload: () => { t.reloads += 1; }, onLeave: (fn) => t.leave.push(fn), onSafe: () => {}, onVisible: () => {}, every: () => {}, storage: null, wait, setTimer: (fn) => { t.timers.push(fn); } });
  t.takeOver = () => t.fns.forEach((f) => f());
  t.move = () => t.leave.forEach((f) => f());
  return t;
}
const pending = async (p) => { let done = false; p.then(() => { done = true; }); await new Promise((r) => { setTimeout(r, 5); }); return !done; };

test('a new worker taking over reloads the page at once', () => {
  const t = setup();
  t.takeOver();
  assert.equal(t.reloads, 1);
});

test('the listener is on before any waiting: it is attached by watchForUpdate, not register()', () => {
  const t = setup();
  assert.equal(t.fns.length, 1);
  const app = read('js/app.js');
  assert.ok(app.indexOf('watchForUpdate({') < app.indexOf('await loadData()'), 'a worker can take over while the word list loads');
});

test('the first install never reloads: the page is already current', () => {
  const t = setup({ controller: null });
  t.takeOver();
  assert.equal(t.reloads, 0);
});

test('during a game or test the reload waits until the player leaves it, not the next word', () => {
  const t = setup({ busy: true });
  t.takeOver();
  t.takeOver(); // a second takeover queues nothing more
  assert.equal(t.reloads, 0);
  assert.equal(t.leave.length, 1);
  t.move(); // spell/3 -> spell/4: still playing
  assert.equal(t.reloads, 0);
  t.busy = false;
  t.move();
  assert.equal(t.reloads, 1);
});

test('settled: no update means settled at once; so do no worker and a first install', async () => {
  const t = setup();
  t.watch.register();
  assert.equal(await pending(t.watch.settled()), false);
  assert.equal(await pending(watchForUpdate({ sw: null }).settled()), false);
  const first = setup({ controller: null, reg: { installing: new Worker() } });
  first.watch.register();
  assert.equal(await pending(first.watch.settled()), false);
});

test('settled: offline (update fails) is settled; a refused registration too', async () => {
  const t = setup({ reg: { update: async () => { throw new Error('offline'); } } });
  t.watch.register();
  assert.equal(await pending(t.watch.settled()), false);
  const u = setup();
  u.sw.register = async () => { throw new Error('no'); };
  u.watch.register();
  assert.equal(await pending(u.watch.settled()), false);
});

test('settled: a worker on its way keeps the page waiting, even once active (the reload ends it)', async () => {
  const w = new Worker();
  const t = setup({ reg: { installing: w } });
  t.watch.register();
  const s = t.watch.settled();
  assert.equal(await pending(s), true);
  w.become('activated');
  assert.equal(await pending(s), true);
});

test('settled: a worker that fails to install ends the wait, and so does the time limit', async () => {
  const w = new Worker();
  const t = setup({ reg: { installing: w } });
  t.watch.register();
  const s = t.watch.settled();
  assert.equal(await pending(s), true);
  w.become('redundant');
  assert.equal(await pending(s), false);
  const v = setup({ reg: { installing: new Worker() } });
  v.watch.register();
  const s2 = v.watch.settled();
  assert.equal(await pending(s2), true);
  v.timers.forEach((f) => f());
  assert.equal(await pending(s2), false);
});

test('only My words paths wait; the play paths that hold back a reload are unchanged', () => {
  for (const p of ['words', 'words/new', 'words/anything/else']) assert.ok(isWordsPath(p), p);
  for (const p of ['', 'wordsmith', 'y34', 'custom']) assert.ok(!isWordsPath(p), p);
  for (const p of ['y3', 'y1/ch01', 'chapters']) assert.ok(isWordsPath(p), p);
  for (const p of ['y3/ch01/test', 'y4/ch02/quiz', 'words/exam/abc', 'words/own/abc/quick']) assert.ok(isPlayPath(p), p);
  assert.ok(isPlayPath('words/g/abc/spell/3') && isPlayPath('words/g/abc/test') && isPlayPath('y34/ch01/test'));
  const app = read('js/app.js');
  assert.match(app, /if \(!isWordsPath\(path\)\) \{ V\.notFound\(main\); return; \}/);
  assert.match(app, /updates\.settled\(\)\.then\(\(\) => \{ if \(currentPath\(\) === path\) V\.notFound\(main\); \}\)/);
});

test('the service worker takes over at once, and update/update.js and nav.js are in its shell', () => {
  const sw = read('sw.js');
  assert.match(sw, /self\.skipWaiting\(\)/);
  assert.match(sw, /self\.clients\.claim\(\)/);
  assert.match(sw, /'js\/update\/update\.js'/);
  assert.match(sw, /'js\/nav\/nav\.js'/);
  assert.doesNotMatch(sw, /spellbright-2026-11-03a/);
});
