// C2-3 Part 0: one-load updates that always take over (shared/update/update.js),
// for Spellbright, Wordbright and Composition. Fake worker container: no browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { watchForUpdate, workerContainer, safePoint, CHECK_EVERY_MS, RELOAD_GUARD_MS, GUARD_KEY, SAFE_EVENT } from '../update/update.js';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

class Worker {
  constructor(state = 'installing') { this.state = state; this.fns = []; this.messages = []; }
  addEventListener(t, fn) { this.fns.push(fn); }
  postMessage(m) { this.messages.push(m); }
  become(s) { this.state = s; this.fns.forEach((f) => f()); }
}
function memory() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; }
function setup({ controller = {}, busy = false, reg = {}, clock = 1_000_000 } = {}) {
  const t = { reloads: 0, busy, leave: [], safe: [], visible: [], every: [], fns: [], updates: 0, clock, timers: [] };
  t.reg = { update: async () => { t.updates += 1; }, installing: null, waiting: null, ...reg };
  t.sw = { controller, addEventListener: (type, fn) => t.fns.push(fn), register: async () => t.reg };
  t.storage = memory();
  t.watch = watchForUpdate({
    sw: t.sw, isBusy: () => t.busy, reload: () => { t.reloads += 1; },
    onLeave: (fn) => t.leave.push(fn), onSafe: (fn) => t.safe.push(fn), onVisible: (fn) => t.visible.push(fn),
    every: (fn, ms) => t.every.push([fn, ms]), storage: t.storage, now: () => t.clock, setTimer: (fn, ms) => t.timers.push([fn, ms]),
  });
  t.takeOver = () => t.fns.forEach((f) => f());
  const tick = () => new Promise((r) => { setTimeout(r, 5); });
  t.tick = tick;
  return t;
}

test('1. it looks for a new version on load, whenever the tab comes back into view, and every 30 minutes', async () => {
  const t = setup();
  t.watch.register();
  await t.tick();
  assert.equal(t.updates, 1, 'on load');
  t.visible.forEach((f) => f());
  await t.tick();
  assert.equal(t.updates, 2, 'back into view');
  assert.equal(t.every[0][1], CHECK_EVERY_MS);
  assert.equal(CHECK_EVERY_MS, 30 * 60 * 1000);
  t.every[0][0]();
  await t.tick();
  assert.equal(t.updates, 3, 'on the timer');
});

test('2. in a comic, the reload waits for the end of the move (a safe point), not for leaving the page', () => {
  const t = setup({ busy: true });
  t.takeOver();
  assert.equal(t.reloads, 0, 'not mid-move');
  assert.equal(t.safe.length, 1);
  t.safe[0]();
  assert.equal(t.reloads, 1, 'the move is finished and saved: now');
});

test('2b. a game or test still waits until the player leaves it', () => {
  const t = setup({ busy: true });
  t.takeOver();
  t.takeOver(); // queues nothing more
  assert.equal(t.leave.length, 1);
  t.leave[0]();
  assert.equal(t.reloads, 0, 'still playing');
  t.busy = false;
  t.leave[0]();
  assert.equal(t.reloads, 1);
});

test('3. a page that had no worker ignores only its first takeover; the next one reloads it', () => {
  const t = setup({ controller: null });
  t.takeOver();
  assert.equal(t.reloads, 0, 'the first worker: the page is current');
  t.clock += RELOAD_GUARD_MS + 1;
  t.takeOver();
  assert.equal(t.reloads, 1, 'a later release reloads it (the old code ignored this for good)');
});

test('4. a new worker left waiting is told to take over; one still installing, once installed', async () => {
  const waiting = new Worker('installed');
  const t = setup({ reg: { waiting } });
  t.watch.register();
  await t.tick();
  assert.deepEqual(waiting.messages, [{ type: 'skip-waiting' }]);
  const installing = new Worker();
  const u = setup({ reg: { installing } });
  u.watch.register();
  await u.tick();
  u.reg.waiting = installing;
  installing.become('installed');
  assert.deepEqual(installing.messages, [{ type: 'skip-waiting' }]);
  const first = new Worker('installed');
  const f = setup({ controller: null, reg: { waiting: first } });
  f.watch.register();
  await f.tick();
  assert.deepEqual(first.messages, [], 'a first visit has nothing to replace');
});

test('registered with updateViaCache "none": sw.js and its imports never come from the HTTP cache', async () => {
  const t = setup();
  let opts = null;
  t.sw.register = async (path, o) => { opts = o; return t.reg; };
  t.watch.register();
  await t.tick();
  assert.deepEqual(opts, { updateViaCache: 'none' });
});

test('never two automatic reloads within 10 s; one too soon is tried again when the time is up', () => {
  const t = setup();
  t.takeOver();
  t.takeOver();
  assert.equal(t.reloads, 1);
  assert.equal(t.storage.getItem(GUARD_KEY), String(t.clock));
  const [retry, ms] = t.timers.at(-1);
  assert.ok(ms > 0 && ms <= RELOAD_GUARD_MS + 50);
  t.clock += RELOAD_GUARD_MS + 1;
  retry();
  assert.equal(t.reloads, 2, 'tried again, not dropped');
  assert.equal(RELOAD_GUARD_MS, 10000);
});

test('a clock put back never holds a reload for ever', () => {
  const t = setup();
  t.storage.setItem(GUARD_KEY, String(t.clock + 60_000));
  t.takeOver();
  assert.equal(t.reloads, 1);
});

test('the end of a comic move reloads even soon after another reload (it cannot loop)', () => {
  const t = setup({ busy: true });
  t.storage.setItem(GUARD_KEY, String(t.clock - 2000)); // a reload 2 s ago
  t.takeOver();
  t.safe[0]();
  assert.equal(t.reloads, 1);
});

test('workerContainer: https, or localhost with sb.swTest; never plain http', () => {
  const nav = { serviceWorker: { id: 'sw' } };
  const st = (v) => ({ getItem: () => v });
  assert.equal(workerContainer(nav, { protocol: 'https:', hostname: 'game.waystead.co.uk' }, st(null)), nav.serviceWorker);
  assert.equal(workerContainer(nav, { protocol: 'http:', hostname: 'localhost' }, st(null)), null);
  assert.equal(workerContainer(nav, { protocol: 'http:', hostname: 'localhost' }, st('1')), nav.serviceWorker);
  assert.equal(workerContainer(nav, { protocol: 'http:', hostname: 'example.com' }, st('1')), null);
  assert.equal(workerContainer({}, { protocol: 'https:' }), null);
});

test('safePoint() sends the sb:safe event', () => {
  const seen = [];
  const target = new EventTarget();
  target.addEventListener(SAFE_EVENT, () => seen.push(1));
  safePoint(target);
  assert.deepEqual(seen, [1]);
});

test('every game\'s worker answers "skip-waiting", is bumped, and lists update/update.js in its shell', () => {
  for (const [sw, app] of [['site/sw.js', 'site/js/app.js'], ['wordbright/site/sw.js', 'wordbright/site/js/app.js'], ['compose/site/sw.js', 'compose/site/js/app.js']]) {
    const s = read(sw);
    assert.match(s, /addEventListener\('message'[\s\S]*?type === 'skip-waiting'\) self\.skipWaiting\(\)/, sw);
    assert.match(s, /'js\/update\/update\.js'/, sw);
    const version = /const VERSION = '[a-z]+-(\d{4}-\d{2}-\d{2}[a-z])'/.exec(s);
    assert.ok(version && version[1] >= '2026-11-09a', sw + ': bumped at least to the shared update fix (2026-11-09a)');
    const a = read(app);
    assert.match(a, /watchForUpdate\(\{\s*sw: workerContainer\(\)/, app);
    assert.doesNotMatch(a, /hadWorker/, app);
  }
});

test('Composition marks the end of every comic move and own-story step as a safe point', () => {
  const v = read('compose/site/js/comic-views.js');
  const o = read('compose/site/js/own-views.js');
  assert.match(v, /moveFinished\(c\.id \+ ':' \+ next\.move/);
  assert.match(o, /moveFinished\(cid \+ ':' \+ next\.move/);
  assert.match(v, /if \(was && was !== key\) safePoint\(\);/);
});
