// Headless smoke test for Spellbright 2: real pages in Chrome, a fake clock, a
// fake Waystead account on localhost:3000 (shared/tests/fake-account.js) and the
// site served with nginx's own Content-Security-Policy.
// No npm packages: Chrome's DevTools Protocol over Node's WebSocket.
//
//   node tools/sb2-smoke.mjs <folder for screenshots>
//
// The grown-ups' flag (CHILD_DATA_API) is off in the repo; the server here turns
// it on in what it serves, so Plan and Dashboard can be walked through.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { fakeAccount } from '../shared/tests/fake-account.js';
import * as W from '../site/js/words-doc.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.argv[2] || join(tmpdir(), 'sb2-shots');
const ONLY = process.argv[3] || '';
const PORT = 8123;
const ACCOUNT = 'http://localhost:3000';
const SITE = 'http://localhost:' + PORT;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHILD = '11111111-1111-4111-8111-111111111111';
const CHILD2 = '22222222-2222-4222-8222-222222222222';
const ADULT = '33333333-3333-4333-8333-333333333333';
const STRANGER = '44444444-4444-4444-8444-444444444444';
const childMe = { signedIn: true, kind: 'child', id: CHILD, nickname: 'Robin', year: 4, avatar: null, parentId: ADULT };
const adultMe = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };

mkdirSync(OUT, { recursive: true });
const csp = /add_header Content-Security-Policy "([^"]+)"/.exec(readFileSync(ROOT + 'nginx/default.conf', 'utf8'))[1].replaceAll('https://account.waystead.co.uk', ACCOUNT);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.dawg': 'application/octet-stream' };

let flagOn = true;
let storiesLive = false;
const site = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, SITE).pathname);
  const m = /^\/(spellbright|wordbright)\/(.*)$/.exec(path);
  const base = m ? (m[1] === 'spellbright' ? 'site/' : 'wordbright/site/') : null;
  let file = base ? ROOT + base + (m[2] || 'index.html') : null;
  if (file && existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file || !existsSync(file)) { res.writeHead(404, { 'Content-Security-Policy': csp }); res.end('not here'); return; }
  let body = readFileSync(file);
  if (file.endsWith('grownups-data.js') && flagOn) body = String(body).replace('CHILD_DATA_API = false', 'CHILD_DATA_API = true');
  if (file.endsWith('stories.json') && storiesLive) body = String(body).replaceAll('"reviewed": false', '"reviewed": true');
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Content-Security-Policy': csp, 'Cache-Control': 'no-store' });
  res.end(body);
});

const acct = fakeAccount();
acct.children = (id) => (id === ADULT ? [{ id: CHILD, nickname: 'Robin', year: 4, avatar: null }, { id: CHILD2, nickname: 'Wren', year: 6, avatar: null }] : []);
const account = createServer(async (req, res) => {
  const cors = { 'Access-Control-Allow-Origin': SITE, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS', Vary: 'Origin' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  if (req.url.startsWith('/api/voice/')) { res.writeHead(404, cors); res.end(); return; }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const r = await acct.fetch(ACCOUNT + req.url, { method: req.method, credentials: 'include', body: chunks.length ? Buffer.concat(chunks).toString() : undefined });
  res.writeHead(r.status, { ...cors, 'Content-Type': 'application/json' });
  const data = r.status === 204 ? null : await r.json();
  res.end(data === null ? '' : JSON.stringify(data));
});

// ---- Chrome ---------------------------------------------------------------------------
const PROFILE = join(tmpdir(), 'sb2-smoke-' + process.pid);
const chrome = spawn(CHROME, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=9333', '--user-data-dir=' + PROFILE, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function connect() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await (await fetch('http://127.0.0.1:9333/json')).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) { /* not up yet */ }
    await sleep(150);
  }
  throw new Error('Chrome did not start');
}

let ws;
let seq = 0;
const waiting = new Map();
const problems = [];
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    seq += 1;
    waiting.set(seq, { resolve, reject });
    ws.send(JSON.stringify({ id: seq, method, params }));
  });
}
function listen() {
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && waiting.has(m.id)) {
      const w = waiting.get(m.id);
      waiting.delete(m.id);
      if (m.error) w.reject(new Error(m.error.message)); else w.resolve(m.result);
      return;
    }
    if (m.method === 'Runtime.exceptionThrown') problems.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type)) problems.push('console.' + m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
    if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) {
      const t = m.params.entry.text + ' ' + (m.params.entry.url || '');
      // Expected: a 404 from the voice (the device speaks instead), a 409 from a save (merged and sent again).
      if (!/\/api\/voice\//.test(t) && !/status of 409/.test(t)) problems.push('log: ' + t);
    }
  });
}

async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text) + ' in ' + expr);
  return r.result.value;
}
async function until(expr, what = expr, ms = 6000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await ev('!!(' + expr + ')')) return;
    await sleep(40);
  }
  const text = await ev('document.querySelector("main").innerText.slice(0,300)');
  throw new Error('timed out waiting for ' + what + ' at ' + await ev('location.hash') + ' — page says: ' + text);
}
const q = (s) => JSON.stringify(s);
const has = (s) => ev('!!document.querySelector(' + q(s) + ')');
const text = (s = 'main') => ev('(document.querySelector(' + q(s) + ')||{}).innerText||""');
async function click(s) { await until('document.querySelector(' + q(s) + ')', s); await ev('document.querySelector(' + q(s) + ').click()'); await sleep(30); }
async function key(k) {
  const code = k.length === 1 ? 'Key' + k.toUpperCase() : k;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, text: k.length === 1 ? k : k === 'Enter' ? '\r' : undefined, windowsVirtualKeyCode: k === 'Enter' ? 13 : k === 'Backspace' ? 8 : k.toUpperCase().charCodeAt(0) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code });
}
async function keys(s) { for (const c of s) await key(c); }
async function go(hash) { await ev('location.hash=' + q(hash)); await sleep(60); }
const step = (n) => console.log('  · ' + n);
function ok(cond, what) { if (!cond) throw new Error('FAILED: ' + what); }

// The clock, and what the page speaks (the word is hidden on screen, so the
// driver reads it from the recording the page asked for, as a child hears it).
let boot = null;
async function setClock(day, hour = 10) {
  if (boot) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: boot });
  const t = Date.parse(day + 'T' + String(hour).padStart(2, '0') + ':00:00');
  const src = `(() => {
    const R = Date, start = R.now(), T = ${t};
    class F extends R { constructor(...a) { if (a.length) super(...a); else super(T + (R.now() - start)); } static now() { return T + (R.now() - start); } }
    globalThis.Date = F;
    globalThis.__said = [];
    globalThis.__lines = [];
    globalThis.Audio = class { constructor(u) { this.u = u; } play() { const m = /audio\\/(?:words|stories)\\/([^.?]+)/.exec(this.u); if (m) globalThis.__said.push(m[1]); setTimeout(() => this.onended && this.onended(), 5); return Promise.resolve(); } pause() {} };
    try {
      const real = speechSynthesis.speak.bind(speechSynthesis);
      speechSynthesis.speak = (u) => { globalThis.__lines.push(u.text); setTimeout(() => { if (u.onend) u.onend(new Event('end')); u.dispatchEvent && u.dispatchEvent(new Event('end')); }, 5); };
      void real;
    } catch (e) { /* no speech here */ }
  })();`;
  boot = (await send('Page.addScriptToEvaluateOnNewDocument', { source: src })).identifier;
}
async function open(day, hash = '#/') {
  await setClock(day);
  await send('Page.navigate', { url: 'about:blank' }); // a new load, so the new clock counts
  await send('Page.navigate', { url: SITE + '/spellbright/' + hash });
  await until('document.readyState === "complete" && document.querySelector("main section, main .card")', 'the page');
  await sleep(120);
}
const said = async () => ev('globalThis.__said.at(-1)||""');
const lastWord = async (prev = '') => { await until('globalThis.__said.length', 'a spoken word'); void prev; return said(); };

async function shot(name) {
  await sleep(60);
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
}
async function width(w, h = 900) { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 }); await sleep(40); }
async function style(name) {
  await ev(name === 'night' ? "localStorage.setItem('sb.theme','dark')" : "localStorage.setItem('sb.theme','light');localStorage.setItem('sb.dayStyle'," + q(name) + ')');
  await ev('window.sbTheme && window.sbTheme.apply()');
  await sleep(60);
}
const STYLES = ['garden', 'paint', 'night'];
const WIDTHS = [390, 768, 1280];
let layoutChecks = 0;
/** This page in all three styles at all three widths: no sideways scroll; garden and night saved at 390 and 1280. */
async function allViews(name) {
  for (const s of STYLES) {
    await style(s);
    for (const w of WIDTHS) {
      await width(w);
      const over = await ev('document.documentElement.scrollWidth - document.documentElement.clientWidth');
      ok(over <= 0, name + ' scrolls sideways by ' + over + 'px at ' + w + ' in ' + s);
      const bad = await ev(`[...document.querySelectorAll('main *')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && !e.closest('.gridwrap,.picker') && getComputedStyle(e).position !== 'fixed' && !e.closest('.sr'); }).slice(0,3).map((e) => e.className || e.tagName).join(' ')`);
      ok(!bad, name + ': off the page at ' + w + ' in ' + s + ': ' + bad);
      layoutChecks += 1;
      if (s !== 'paint' && w !== 768) await shot(name + '-' + s + '-' + w);
    }
  }
  await style('garden');
  await width(390);
}

// ---- helpers for the child's week -----------------------------------------------------
const WORDS = ['build', 'earth', 'fruit', 'heart'];
function readDoc() { const rows = acct.data.get(CHILD); return rows && rows.get('spellbright/words') ? W.normalise(rows.get('spellbright/words').value) : null; }
const readLocal = async () => W.normalise(JSON.parse(await ev('localStorage.getItem("sb.words:' + CHILD + '")')));

async function missingLetters() {
  await until('document.querySelector("[data-game=missing]")', 'Missing letters');
  for (let n = 0; n < 40; n += 1) {
    if (!await has('[data-game=missing]')) return;
    if (await has('[data-next]')) { await click('[data-next]'); await sleep(40); continue; }
    const w = await lastWord();
    const gaps = await ev('[...document.querySelectorAll(".spellbox")].map((b,i)=>b.dataset.gap!==undefined&&!b.classList.contains("is-filled")?i:-1).filter(i=>i>=0)');
    await keys(gaps.map((i) => w[i]).join(''));
    await until('document.querySelector("[data-next]")', 'the end of the word');
  }
}
async function unjumble() {
  await until('document.querySelector("[data-game=unjumble]")', 'Unjumble');
  let first = true;
  for (let n = 0; n < 40; n += 1) {
    if (!await has('[data-game=unjumble]')) return;
    if (await has('[data-next]')) { await click('[data-next]'); await sleep(40); continue; }
    const w = await lastWord();
    if (first) { // tap on the first word; type the rest
      first = false;
      for (const c of w) await ev('[...document.querySelectorAll("[data-tile]:not(:disabled)")].find(t=>t.dataset.tile===' + q(c) + ').click()');
    } else await keys(w);
    await until('document.querySelector("[data-next]")', 'the end of the word');
  }
}
async function meaningMatch() {
  await until('document.querySelector("[data-game=match]")', 'Meaning match');
  for (let n = 0; n < 12; n += 1) {
    if (!await has('[data-game=match]')) return;
    const pairs = await ev(`(async () => { const c = await (await fetch('data/curriculum.json')).json(); const m = {}; for (const y of ['year_3_4','year_5_6']) for (const ch of c[y].chapters) for (const w of ch.words) m[w.word] = w.meaning.definition; return m; })()`);
    const word = await ev('(document.querySelector("[data-word]:not(:disabled)")||{}).innerText');
    if (!word) break;
    const w = word.replace(/^\d\s*/, '').trim();
    await ev('document.querySelector("[data-word]:not(:disabled)").click()');
    await sleep(20);
    await ev('[...document.querySelectorAll("[data-meaning]")].find(b=>b.innerText.includes(' + q(pairs[w]) + ')).click()');
    await sleep(30);
  }
}
async function quickFire(wrongFirst = false) {
  await until('document.querySelector("[data-game=quick]")', 'Quick-fire');
  let n = 0;
  for (let i = 0; i < 40; i += 1) {
    if (!await has('[data-game=quick]')) return;
    if (await has('[data-next]')) { await click('[data-next]'); await sleep(40); continue; }
    const w = await lastWord();
    await keys(wrongFirst && n === 0 ? w + 'x' : w);
    n += 1;
    await key('Enter');
    await until('document.querySelector("[data-next]")', 'the end of the word');
  }
}
const hasTurn = 'document.querySelector("[data-next]") || document.querySelector(".spellbox.is-next")';
/** Spell the word on show until its session is done: 3 clean in a row. */
async function spellToDone() {
  for (let n = 0; n < 6; n += 1) {
    await until(hasTurn, 'the word', 8000);
    if (await has('[data-next]')) return;
    await keys(await lastWord());
    await sleep(40);
  }
  throw new Error('the word never finished');
}
async function gridRound() {
  for (let n = 0; n < 12; n += 1) {
    await spellToDone();
    const label = await text('[data-next]');
    await click('[data-next]');
    await sleep(60);
    if (/Back/.test(label)) return;
  }
}
const rowNow = () => text('[data-row]');
async function typeFix(w) { await keys(w); await key('Enter'); await sleep(40); }

// ---- the scenarios -----------------------------------------------------------------------
const MON = '2026-11-02';
const plus = (n) => W.addDays(MON, n);
const SCENES = [];
const scene = (name, fn) => SCENES.push({ name, fn });


// A clean start: signed out, so the last scene's page can't send its saved values into this one.
async function signedOutBlank(day) {
  acct.who = null;
  await open(day, '#/about');
  await ev('localStorage.clear()');
  await sleep(50);
  acct.prefs.clear();
  acct.data.clear();
  acct.calls.length = 0;
}
async function seedChild(doc, day = MON) {
  await signedOutBlank(day);
  acct.who = childMe;
  await ev('localStorage.setItem("wa.player",' + q(JSON.stringify({ id: CHILD, name: 'Robin', avatar: null })) + ')');
  await ev('localStorage.setItem("sb.words:' + CHILD + '",' + q(JSON.stringify(doc)) + ')');
}
function weekDoc(words = WORDS, test = plus(5), from = MON) {
  return W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week one', test, words, today: from, now: Date.parse(from + 'T09:00:00') }).doc;
}
const noWord = async (where) => {
  const t = (await text()).toLowerCase();
  for (const w of WORDS) ok(!t.includes(w), where + ' shows ' + w);
};
async function hearTheFlower(w) {
  await click('[data-play]');
  await until('document.querySelector(".blanks")', 'the flower game');
  await keys([...new Set(w)].join(''));
  await click('[data-next]');
  await sleep(40);
}

scene('week', async () => {
  await seedChild(weekDoc());
  await open(MON, '#/');
  await until('document.querySelector("[data-room=job]")', 'My room');
  ok(await has('[data-pip=happy]'), 'Pip is happy');
  await allViews('room-job');

  step('Day 1: Hello words');
  await click('[data-job]');
  await until('document.querySelector(".wordcard")', 'Hello words');
  await allViews('day1-hello');
  for (let i = 0; i < WORDS.length; i += 1) {
    await until('document.querySelector("[data-play]")', 'word ' + i);
    const w = await lastWord();
    if (i === 0) { await click('[data-example]'); ok(await ev('globalThis.__lines.length > 0'), 'the example is read aloud'); }
    await hearTheFlower(w);
  }
  await until('/Done for today/.test(document.querySelector("main").innerText)', 'Done for today');
  await click('a[href="#/"]');
  await until('document.querySelector("[data-room=done]")', 'room: done');
  ok(await has('[data-wordbright]'), 'Play Wordbright is offered');
  ok(await has('[data-pip=cheering]'), 'Pip cheers');
  await allViews('room-done');

  step('Day 2: Fix it in');
  await open(plus(1), '#/');
  await click('[data-job]');
  for (let i = 0; i < WORDS.length; i += 1) {
    await until('document.querySelector("[data-cover]")', 'Look');
    const w = await lastWord();
    if (i === 0) await allViews('day2-fix-look');
    await click('[data-cover]');
    await until('document.querySelector("[data-written]")', 'Cover');
    ok(!(await text()).includes(w), 'the word is hidden after Cover');
    if (i === 0) await allViews('day2-fix-cover');
    await click('[data-written]');
    await until('document.querySelector("[data-check]")', 'Type');
    if (i === 1) { // a wrong go first: look again
      await keys(w + 'x');
      await key('Enter');
      await click('[data-go]');
      await until('document.querySelector("[data-cover]")', 'Look again');
      await click('[data-cover]');
      await click('[data-written]');
      await until('document.querySelector("[data-check]")', 'Type again');
    }
    for (let k = 0; k < 3; k += 1) await typeFix(w);
    await until('document.querySelector("[data-go]")', 'Check');
    if (i === 0) await allViews('day2-fix-check');
    await click('[data-go]');
    await sleep(40);
    if (await has('[data-clue]')) {
      if (i === 0) { await allViews('day2-fix-clue'); await click('[data-clue="0"]'); } else {
        await ev('document.querySelector("[data-text]").value="My own clue"');
        await ev('document.querySelector("[data-own]").requestSubmit()');
      }
      await sleep(40);
    }
  }
  await until('/Done for today/.test(document.querySelector("main").innerText)', 'Fix it in done');
  let d = await readLocal();
  const g = W.groupById(d, 'g1');
  ok(W.clueFor(d, 'build'), 'the clue for build is saved');
  ok(W.clueFor(d, 'earth') === 'My own clue', 'the typed clue is saved');
  ok(WORDS.every((w) => W.dots(d, g, w, plus(1)) === 3), 'all three dots after Fix it in');

  step('Day 3: Game day');
  await open(plus(2), '#/');
  await click('[data-job]');
  await until('document.querySelector("[data-game]")', 'the first game');
  await allViews('day3-game-missing');
  await missingLetters();
  await until('document.querySelector("[data-game=unjumble]")', 'Unjumble');
  await allViews('day3-game-unjumble');
  await unjumble();
  await until('document.querySelector("[data-game=match]")', 'Meaning match');
  await allViews('day3-game-match');
  await meaningMatch();
  await until('document.querySelector("[data-game=quick]")', 'Quick-fire');
  await allViews('day3-game-quick');
  await quickFire();
  await until('/Done for today/.test(document.querySelector("main").innerText)', 'Game day done');
  d = await readLocal();

  step('Day 4: Story day');
  await open(plus(3), '#/');
  await click('[data-job]');
  await until('document.querySelector("[data-go]")', 'the examples');
  await allViews('day4-story-examples');
  await click('[data-go]');
  for (let i = 0; i < 3; i += 1) {
    await until('document.querySelector("[data-text]")', 'a sentence box');
    const w = await lastWord();
    if (i === 0) {
      await allViews('day4-sentence');
      await ev('document.querySelector("[data-text]").value="too short"');
      await click('[data-save]');
      ok(/Use the word/.test(await text('[data-note]')), 'a sentence without the word is refused');
    }
    await ev('document.querySelector("[data-text]").value=' + q('My sentence uses ' + w + ' well.'));
    await click('[data-save]');
    await sleep(40);
  }
  await until('/Done for today/.test(document.querySelector("main").innerText)', 'Story day done');
  ok((await readLocal()).notes.length === 3, 'three sentences saved');

  step('Day 5: Practice day');
  await open(plus(4), '#/');
  await click('[data-job]');
  await until('document.querySelector(".spellbox.is-next")', 'the grid');
  await allViews('day5-practice');
  await gridRound();
  await until('location.hash.endsWith("/g1")', 'back at the group');
  await until('/Ready for the test/.test(document.querySelector("main").innerText)', 'ready for the test');
  await allViews('group-ready');

  step('Game mode from the group page');
  await click('[data-mode=game]');
  await until('document.querySelector(".gamecards")', 'Game mode');
  await allViews('game-mode');

  step('Day 6: Test day');
  await open(plus(5), '#/');
  await until('document.querySelector("[data-room=job]")', 'room on test day');
  await noWord('the room on test day');
  ok(await has('[data-pip=thinking]'), 'Pip thinks on test day');
  await allViews('room-test');
  await go('#/words/g/g1');
  await noWord('the group page on test day');
  await allViews('group-test');
  await go('#/words/g/g1/games');
  await noWord('Game mode on test day');
  await go('#/words/g/g1/game/match');
  await sleep(80);
  await noWord('a game on test day');
  await go('#/words/g/g1/study/hello');
  await sleep(80);
  await noWord('Hello words on test day');
  await go('#/');
  await click('[data-job]');
  await until('document.querySelector("[data-next]")', 'the test');
  await allViews('day6-test');
  for (let i = 0; i < WORDS.length; i += 1) {
    const w = await lastWord();
    await keys(i === 0 ? w + 'x' : w);
    await key('Enter');
    await sleep(50);
  }
  await until('location.hash.endsWith("/g1")', 'the results');
  ok(/3 of 4 right/.test(await text()), 'three of four right: ' + await text());

  step('Day 7: Mend and keep');
  await open(plus(6), '#/');
  await allViews('room-mend');
  await click('[data-job]');
  await until('document.querySelector(".spellbox.is-next")', 'the fix-up');
  await allViews('day7-mend-fixup');
  await spellToDone();
  await click('[data-next]');
  await until('location.hash.endsWith("/g1")', 'the group');
  await click('[data-job]');
  await until('document.querySelector("[data-game=quick]")', 'the quick-fire round');
  await allViews('day7-mend-quick');
  await quickFire();
  await until('/Done for today/.test(document.querySelector("main").innerText)', 'Mend and keep done');
  await click('a[href="#/"]');
  await until('document.querySelector("[data-room=finished]")', 'room: finished');
  await allViews('room-finished');
  await sleep(1800); // the debounced save
  const saved = readDoc();
  ok(saved && saved.results.length >= 20, 'the week reached the account: ' + (saved && saved.results.length));
});

scene('each game once, in Game mode', async () => {
  const doc = weekDoc(['build', 'earth', 'fruit'], plus(7));
  doc.groups.g1.back = ['heart']; // a word back again joins in
  await seedChild(doc, plus(1));
  await open(plus(1), '#/words/g/g1/games');
  await until('document.querySelector(".gamecards")', 'Game mode');
  const games = { missing: missingLetters, unjumble, match: meaningMatch, quick: quickFire };
  for (const [id, play] of Object.entries(games)) {
    step(id);
    await go('#/words/g/g1/game/' + id);
    await play();
    await until('/ done/.test(document.querySelector("main").innerText)', id + ' finished');
    await allViews('game-done-' + id);
  }
  const d = await readLocal();
  const g = W.groupById(d, 'g1');
  ok(d.results.filter((r) => r.s === 'g').length === 12 && d.results.filter((r) => r.s === 'm').length === 4, 'each game records each word: ' + d.results.length);
  ok(d.results.some((r) => r.w === 'heart' && r.s === 'g'), 'the returning word joined in');
  ok(W.dots(d, g, 'heart', plus(1)) === 0, 'games earn no dots');
  ok(W.starsOn(d, g, plus(1)) === 4, 'a star each');
  step('a wrong letter in Missing letters is not clean');
  await go('#/words/g/g1/game/missing');
  await until('document.querySelector("[data-game=missing]")', 'Missing letters');
  await keys('z');
  ok(await until('/./.test(document.querySelector("[data-line]").innerText)', 'a kind line') === undefined, 'a kind line');
  step('leaving halfway after a mistake still counts');
  await go('#/words/g/g1/games');
  await sleep(60);
  const after = await readLocal();
  ok(after.results.at(-1).c === 0 && after.results.at(-1).t === 1, 'the unfinished try is saved as not clean');
});

scene('test day: no page shows a test word', async () => {
  // A second group sharing a word, one with different words, and Tricky words holding a test word.
  let doc = weekDoc();
  doc = W.createGroup(doc, { id: 'g2', name: 'Shares', test: plus(9), words: ['fruit', 'guard'], today: plus(1), now: Date.parse(plus(1) + 'T09:00:00') }).doc;
  doc = W.createGroup(doc, { id: 'g3', name: 'Other', test: plus(9), words: ['island'], today: plus(1), now: Date.parse(plus(1) + 'T09:00:00') }).doc;
  await seedChild(doc, plus(5));
  await ev('localStorage.setItem("sb.progress:' + CHILD + '",' + q(JSON.stringify({ v: 1, resetAt: 0, chapters: {}, results: [], folded: {}, tricky: { fruit: { n: 2, chapterId: 'y34-ch01', at: 1 }, island: { n: 2, chapterId: 'y34-ch03', at: 1 } } })) + ')');
  await ev('sessionStorage.setItem("sb.selection",' + q(JSON.stringify(['fruit', 'island'])) + ')');
  const shown = async () => {
    const t = (await ev('document.querySelector("main").textContent')).toLowerCase();
    return WORDS.filter((w) => new RegExp('\\b' + w + '\\b').test(t));
  };
  const carded = ['#/words/new', '#/words/progress', '#/words/g/g1/edit', '#/words/g/g2/edit', '#/words/g/g1/spell/0', '#/words/g/g1/study/hello', '#/words/g/g1/games', '#/words/g/g1/game/match',
    '#/words/g/g2', '#/words/g/g2/games', '#/words/g/g2/spell/0', '#/y34/ch01', '#/y34/ch01/study', '#/y34/ch01/study/fruit', '#/y34/ch01/quick', '#/y34/ch01/quick/fruit', '#/y34/ch01/practice', '#/y34/ch01/test'];
  await open(plus(5), '#/words/progress');
  for (const p of carded) {
    await go(p);
    await until('document.querySelector("[data-testcard]")', 'the Test today card at ' + p);
    ok(!(await shown()).length, p + ' shows ' + await shown());
  }
  await go('#/words/progress');
  await until('document.querySelector("[data-testcard]")', 'the card');
  await allViews('test-today-card');
  for (const p of ['#/', '#/chapters', '#/words', '#/words/g/g1', '#/tricky', '#/custom', '#/custom/play', '#/progress', '#/y34', '#/about', '#/words/g/g3', '#/y34/ch03']) {
    await go(p);
    await sleep(120);
    ok(!await has('[data-testcard]') || p === '#/words' || p === '#/words/g/g1', p + ' needn\'t be blocked');
    ok(!(await shown()).length, p + ' shows ' + await shown());
  }
  await go('#/custom');
  await until('document.querySelector("[data-tab]")', 'Pick words');
  for (const t of await ev('[...document.querySelectorAll("[data-tab]")].map((b) => b.dataset.tab)')) {
    await click('[data-tab=' + t + ']');
    await sleep(40);
    ok(!(await shown()).length, 'Pick words, ' + t + ', shows ' + await shown());
  }
  step('the test taken: the pages come back');
  const done = (await readLocal());
  const g = W.groupById(done, 'g1');
  let after = done;
  WORDS.forEach((w, i) => { after = W.addTry(after, { id: 't' + i, word: w, day: plus(5), group: g.id, kind: 't', tries: 0, peeks: 0, clean: true, now: Date.parse(plus(5) + 'T11:00:00') + i }); });
  await ev('localStorage.setItem("sb.words:' + CHILD + '",' + q(JSON.stringify(after)) + ')');
  await open(plus(5), '#/words/progress');
  await until('/fruit/.test(document.querySelector("main").textContent)', 'the words on My word numbers');
  ok(!await has('[data-testcard]'), 'no card once the test is done');
});

function practiceDayDoc() {
  let doc = weekDoc();
  const g = W.groupById(doc, 'g1');
  for (const [st, k] of [['hello', 0], ['fix', 1], ['games', 2], ['story', 3]]) doc = W.markStep(doc, g, st, plus(k), Date.parse(plus(k) + 'T09:00:00'));
  return doc;
}
scene('a wrong word, a peek, a skip and coming back', async () => {
  await seedChild(practiceDayDoc(), plus(4));
  await open(plus(4), '#/');
  await click('[data-job]');
  await until('document.querySelector(".spellbox.is-next")', 'the first word');
  const first = await lastWord();
  const here = await ev('location.hash');
  const turn = () => until('document.querySelector(".spellbox.is-next")', 'the word again', 8000);
  step('a mistake: the same word again, at 0/3');
  await keys('z');
  ok(/0\/3/.test(await rowNow()), 'a mistake shows 0/3');
  await allViews('spell-mistake');
  await keys(first);
  await until('/try that one again/.test(document.querySelector("[data-line]").innerText)', 'the retry line');
  await allViews('spell-retry');
  await turn();
  ok(await ev('location.hash') === here, 'still the same word');
  step('two clean, then a mistake at 2/3 resets');
  await keys(first);
  await sleep(60);
  ok(/1\/3/.test(await rowNow()), '1/3: ' + await rowNow());
  await turn();
  await keys(first);
  await sleep(60);
  ok(/2\/3/.test(await rowNow()), '2/3');
  await allViews('spell-two-of-three');
  await turn();
  await keys('z');
  await keys(first);
  await sleep(60);
  ok(/0\/3/.test(await rowNow()), 'a mistake at 2/3 resets');
  step('a peek resets too');
  await turn();
  await keys(first);
  await sleep(60);
  ok(/1\/3/.test(await rowNow()), '1/3 again');
  await turn();
  await click('[data-peekbtn]');
  ok(/0\/3/.test(await rowNow()), 'a peek shows 0/3');
  await sleep(2200);
  await keys(first);
  await sleep(60);
  ok(/0\/3/.test(await rowNow()), 'a peek counts as no clean spelling');
  await spellToDone();
  ok(/3\/3/.test(await rowNow()), '3/3');
  await click('[data-next]');
  await until('document.querySelector(".spellbox.is-next") && location.hash !== ' + q(here), 'the next word');

  step('Skip for now');
  const skipped = await lastWord();
  await click('[data-skip]');
  await until('document.querySelector(".spellbox.is-next")', 'the word after');
  await sleep(100);
  const third = await lastWord();
  ok(third !== skipped, 'the skipped word has gone to the end');
  step('leaving halfway keeps the count');
  await keys(third);
  await sleep(60);
  ok(/1\/3/.test(await rowNow()), '1/3');
  await sleep(1800); // the debounced save
  await go('#/words/g/g1');
  await until('document.querySelector("[data-comeback]")', 'the marker on the group page');
  ok(/Come back to this/.test(await text()), 'the marker');
  ok(!/Done for today/.test(await text()), 'not done');
  await allViews('group-comeback');
  await go('#/');
  await until('document.querySelector("[data-comeback]")', 'the marker in the room');
  ok(await has('[data-room=job]'), 'the job is still open today');
  await allViews('room-comeback');
  await go('#/words/g/g1/spell/' + WORDS.indexOf(third));
  await until('document.querySelector(".spellbox.is-next")', 'the word again');
  ok(/1\/3/.test(await rowNow()), 'it carries on at 1/3');
  await sleep(1800);

  step('another device carries on');
  const device = await ev('localStorage.getItem("wa.player")');
  await ev('localStorage.clear()');
  await ev('localStorage.setItem("wa.player",' + q(device) + ')');
  await open(plus(4), '#/');
  await until('document.querySelector("[data-comeback]")', 'the marker on the other device', 8000);
  await go('#/words/g/g1/spell/' + WORDS.indexOf(third));
  await until('document.querySelector("[data-row]").innerText.includes("1/3")', 'the count on the other device');

  step('tapping the marker opens the word; the job ends only then');
  await spellToDone();
  await click('[data-next]');
  await sleep(100);
  await spellToDone(); // the fourth word
  await click('[data-next]');
  await sleep(100);
  await until('document.querySelector(".spellbox.is-next") || document.querySelector("[data-comeback]")', 'the skipped word', 8000);
  if (await has('[data-comeback]')) await click('[data-comeback]');
  await until('document.querySelector(".spellbox.is-next")', 'the skipped word opens');
  ok(await lastWord() === skipped, 'it is the skipped word');
  await spellToDone();
  await click('[data-next]');
  await until('/Ready for the test/.test(document.querySelector("main").innerText)', 'ready');
  ok(!await has('[data-comeback]'), 'no marker left');
  await go('#/');
  await until('document.querySelector("[data-room=ready]")', 'the job complete');
  ok(!await has('[data-comeback]'), 'no marker in the room');
});

scene('Fix it in: a peek, a skip, coming back', async () => {
  let doc = weekDoc(['build', 'earth']);
  doc = W.markStep(doc, W.groupById(doc, 'g1'), 'hello', MON, Date.parse(MON + 'T09:00:00'));
  await seedChild(doc, plus(1));
  await open(plus(1), '#/');
  await click('[data-job]');
  await until('document.querySelector("[data-cover]")', 'Look');
  await click('[data-skip]');
  await until('document.querySelector("[data-cover]")', 'the next word');
  const w = await lastWord();
  ok(w === 'earth', 'the second word: ' + w);
  await click('[data-cover]');
  await click('[data-written]');
  await until('document.querySelector("[data-peekbtn]")', 'Type');
  await click('[data-peekbtn]');
  ok(/0\/3/.test(await rowNow()), 'a peek shows 0/3');
  await typeFix(w);
  await until('document.querySelector("[data-go]")', 'Check');
  ok(/try that one again/i.test(await text('h1')), 'right with a peek still comes back');
  await click('[data-go]');
  await until('document.querySelector("[data-cover]")', 'Look again');
  await click('[data-cover]');
  await click('[data-written]');
  await until('document.querySelector("[data-check]")', 'Type again');
  for (let k = 0; k < 3; k += 1) await typeFix(w);
  await click('[data-go]');
  await sleep(60);
  if (await has('[data-noclue]')) await click('[data-noclue]');
  await until('document.querySelector("[data-cover]")', 'the skipped word comes round');
  ok(await lastWord() === 'build', 'the skipped word');
  await click('[data-skip]');
  await until('location.hash.endsWith("/g1")', 'back at the list: nothing else left');
  ok(!/Done for today/.test(await text()), 'the job stays open');
  await click('[data-comeback]');
  await until('document.querySelector("[data-cover]")', 'it opens directly');
  ok(/\/study\/fix\/0$/.test(await ev('location.hash')), 'by its row');
  await click('[data-cover]');
  await click('[data-written]');
  await until('document.querySelector("[data-check]")', 'Type');
  for (let k = 0; k < 3; k += 1) await typeFix('build');
  await click('[data-go]');
  await sleep(60);
  if (await has('[data-noclue]')) await click('[data-noclue]');
  await until('/Done for today/.test(document.querySelector("main").innerText)', 'only now');
});

scene('games: the same word back, and skip', async () => {
  await seedChild(weekDoc(['fruit', 'earth'], plus(7)), plus(1));
  await open(plus(1), '#/words/g/g1/game/quick');
  await until('document.querySelector("[data-game=quick]")', 'Quick-fire');
  const w = await lastWord();
  await keys(w + 'x');
  await key('Enter');
  await until('/try that one again/.test(document.querySelector("[data-line]").innerText)', 'the retry');
  ok(await lastWord() === w, 'the same word');
  await allViews('game-retry');
  await click('[data-skip]');
  await sleep(60);
  const other = await lastWord();
  ok(other !== w, 'skipped to the other word');
  await keys(other);
  await key('Enter');
  await click('[data-next]');
  await sleep(60);
  ok(await lastWord() === w, 'the skipped word comes back');
  await keys(w);
  await key('Enter');
  await click('[data-next]');
  await until('/ done/.test(document.querySelector("main").innerText)', 'the game ends');
  step('Unjumble: a wrong tile');
  await go('#/words/g/g1/game/unjumble');
  await until('document.querySelector("[data-game=unjumble]")', 'Unjumble');
  const u = await lastWord();
  const wrong = [...u].find((c) => c !== u[0]);
  await keys(wrong);
  await keys(u);
  await until('/try that one again/.test(document.querySelector("[data-line]").innerText)', 'the retry');
  ok(await lastWord() === u, 'the same word');
});

scene('a reviewed story', async () => {
  storiesLive = true;
  try { await reviewedStory(); } finally { storiesLive = false; }
});
async function reviewedStory() {
  let doc = weekDoc();
  const g = W.groupById(doc, 'g1');
  for (const [s, k] of [['hello', 0], ['fix', 1], ['games', 2]]) doc = W.markStep(doc, g, s, plus(k), Date.parse(plus(k) + 'T09:00:00'));
  await seedChild(doc, plus(3));
  await open(plus(3), '#/');
  await click('[data-job]');
  await until('document.querySelector(".story")', 'the story');
  ok(/Queen of the Compost/.test(await text('h1')), 'the chapter\'s own story');
  ok(await ev('document.querySelectorAll(".storyword").length') >= 4, 'the week\'s words are picked out');
  await allViews('day4-story');
  await click('[data-read]');
  await until('document.querySelector(".storyline.is-on")', 'a sentence lit up');
  await until('globalThis.__lines.length >= document.querySelectorAll(".storyline").length', 'every sentence read aloud', 12000);
  await until('!document.querySelector(".storyline.is-on")', 'the reading to end');
  await click('[data-go]');
  await until('document.querySelector("[data-text]")', 'writing');
}

scene('a typed word gets Wordbright\'s meaning', async () => {
  await seedChild(weekDoc(['tractor']));
  await open(MON, '#/');
  await click('[data-job]');
  await until('document.querySelector(".wordcard")', 'Hello words');
  ok(/vehicle|farm|pull/i.test(await text('.wordcard')), 'a meaning: ' + await text('.wordcard'));
  await click('[data-play]');
  await until('document.querySelector(".blanks")', 'the flower game');
});

function childWeek() {
  let d = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week one', test: plus(5), words: WORDS, today: MON, now: Date.parse(MON + 'T09:00:00') }).doc;
  const g = W.groupById(d, 'g1');
  const t = (word, day, o = {}) => { d = W.addTry(d, { id: 'x' + d.results.length, word, day, group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, now: Date.parse(day + 'T10:00:00') + d.results.length, ...o }); };
  d = W.markStep(d, g, 'hello', MON, Date.parse(MON + 'T10:00:00'));
  WORDS.forEach((w) => t(w, plus(1), { source: 'x' }));
  d = W.markStep(d, g, 'fix', plus(1), Date.parse(plus(1) + 'T10:00:00'));
  t('build', plus(2), { source: 'g', clean: false, tries: 2 });
  t('earth', plus(2), { source: 'g' });
  d = W.setClue(d, 'build', 'Watch the letters ui in build', Date.parse(plus(1) + 'T10:00:00'));
  d = W.addNote(d, { id: 'n1', group: 'g1', word: 'build', text: 'We will build a den today.', day: plus(2), now: Date.parse(plus(2) + 'T10:00:00') });
  return d;
}
async function seedAdult(day = plus(2)) {
  await signedOutBlank(day);
  acct.who = adultMe;
  acct.put(CHILD, 'spellbright', 'words', childWeek());
  await open(day, '#/');
}

scene('grown-ups: plan and dashboard', async () => {
  await seedAdult();
  await until('document.querySelector("a[href=\\"#/grownups\\"]")', 'the Grown-ups card on the adult\'s home');
  ok(!await has('[data-room]'), 'an adult doesn\'t get a child\'s room');
  await allViews('grownups-home-card');
  await click('a[href="#/grownups"]');
  await until('document.querySelector("[data-child]")', 'the children');
  await allViews('grownups-home');
  await click('[data-child="' + CHILD + '"] a[href$="/plan"]');
  await until('document.querySelector("[data-tab=pattern]")', 'the plan form');
  await allViews('grownups-plan');
  await ev('(()=>{const n=document.querySelector("[data-name]");n.value="School spellings";n.dispatchEvent(new Event("input"))})()');
  await click('[data-tab=pattern]');
  await until('document.querySelector("[data-pattern]")', 'the patterns');
  await ev('(()=>{const n=document.querySelector("[data-pattern]");n.value="ough";n.dispatchEvent(new Event("change"))})()');
  await until('document.querySelector(".picker input[value=enough]")', 'the pattern\'s words');
  await allViews('grownups-plan-pattern');
  for (const w of ['enough', 'cough']) { await click('.picker input[value=' + w + ']'); await sleep(30); }
  await click('[data-tab=chapter]');
  await until('document.querySelector(".picker input[value=guard]")', 'a chapter');
  await click('.picker input[value=guard]');
  await sleep(30);
  await click('[data-tab=typed]');
  const say = async (w) => {
    await until('document.querySelector("[data-typed]")', 'the typed box');
    await ev('(()=>{const n=document.querySelector("[data-typed]");n.value=' + q(w) + ';n.dispatchEvent(new Event("input"));document.querySelector("[data-typeform]").requestSubmit()})()');
    await sleep(500);
    return text('[data-typednote]');
  };
  ok(/Added tractor/.test(await say('tractor')), 'a word on our list is added');
  const unknown = await say('zzqx');
  const blocked = await say('arse');
  ok(unknown === blocked && /isn.t on our lists/.test(unknown), 'blocked and unknown get the same reply');
  await click('[data-preview]');
  await until('document.querySelector("[data-previewcard]")', 'the preview');
  await allViews('grownups-preview');
  await click('[data-save]');
  await until('document.querySelector("[data-print]")', 'the dashboard');
  const saved = W.normalise(acct.data.get(CHILD).get('spellbright/words').value);
  const plan = W.liveGroups(saved).find((x) => x.name === 'School spellings');
  ok(plan && plan.words.join() === 'enough,cough,guard,tractor', 'the plan is in the child\'s data: ' + JSON.stringify(plan));
  ok(/Only you and your child can see this/.test(await text()), 'the privacy line');
  const t = await text();
  ok(/Game day/.test(t), 'today\'s job on the dashboard');
  ok(/We will build a den today/.test(t), 'a sentence');
  ok(/Watch the letters ui/.test(t), 'a clue');
  await allViews('grownups-dashboard');
  step('print');
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  await width(1280);
  await shot('grownups-report-print');
  await send('Emulation.setEmulatedMedia', { media: '' });
  await width(390);
  step('edit a plan');
  await click('a[href$="/plan/' + plan.id + '"]');
  await until('document.querySelector("[data-preview]")', 'the plan again');
  await click('[data-remove="tractor"]');
  await sleep(30);
  await click('[data-preview]');
  await until('document.querySelector("[data-previewcard]")', 'the preview');
  await click('[data-save]');
  await until('document.querySelector("[data-print]")', 'the dashboard');
  const after = W.groupById(W.normalise(acct.data.get(CHILD).get('spellbright/words').value), plan.id);
  ok(after.words.join() === 'enough,cough,guard', 'the change saved');
  step('another family\'s child');
  await go('#/grownups/child/' + STRANGER);
  await until('/couldn.t find that child/.test(document.querySelector("main").innerText)', 'refused');

  step('the child sees the plan on their next visit');
  await seedKeep();
});
async function seedKeep() {
  acct.who = null;
  await open(plus(2), '#/about');
  await ev('localStorage.clear()');
  acct.who = childMe;
  await open(plus(2), '#/words');
  await until('/School spellings/.test(document.querySelector("main").innerText)', 'the plan on the child\'s device', 8000);
}

scene('story review', async () => {
  await seedAdult();
  await until('document.querySelector("a[href=\\"#/grownups\\"]")', 'home');
  await go('#/grownups/stories');
  await until('document.querySelectorAll("[data-story]").length === 20', 'all 20 stories');
  ok(/0 of 20 stories are live/.test(await text('[data-summary]')), 'none live');
  await allViews('story-review');
  await click('[data-approve="y34-ch01"]');
  ok(/approve-stories\.mjs y34-ch01/.test(await text('[data-command]')), 'the command to run');
  await allViews('story-review-marked');
  await ev('location.reload()');
  await sleep(300);
  await until('document.querySelector("[data-approve=\\"y34-ch01\\"]")', 'the page again');
  ok(await ev('document.querySelector("[data-approve=\\"y34-ch01\\"]").checked'), 'the mark stays on this device');
});

scene('permissions', async () => {
  await seedChild(weekDoc());
  acct.calls.length = 0;
  for (const p of ['#/grownups', '#/grownups/stories', '#/grownups/child/' + CHILD, '#/grownups/child/' + CHILD + '/plan']) {
    await open(MON, p);
    await until('document.querySelector("[data-notforyou]")', 'refused at ' + p);
  }
  ok(!acct.calls.some((c) => c.path.startsWith('/api/children')), 'a child\'s page never asks for child data');
  await open(MON, '#/');
  await until('document.querySelector("[data-room]")', 'the room');
  ok(!/Grown-ups/.test(await text()), 'no Grown-ups link in the room');
  await allViews('grownups-refused');
  step('an adult playing as a child is a child here');
  acct.who = { ...adultMe, playingAs: { id: CHILD, nickname: 'Robin', year: 4, avatar: null } };
  await open(MON, '#/grownups');
  await until('document.querySelector("[data-notforyou]")', 'refused');
  step('with the flag off');
  flagOn = false;
  await seedAdult();
  await until('document.querySelector("a[href=\\"#/grownups\\"]")', 'home');
  await go('#/grownups');
  await until('document.querySelector("[data-noapi]")', 'the note');
  ok(await has('a[href="#/grownups/stories"]'), 'the story review still opens');
  await allViews('grownups-flag-off');
  await go('#/grownups/child/' + CHILD);
  await until('document.querySelector("[data-noapi]")', 'back at the note');
  flagOn = true;
});

// ---- run ------------------------------------------------------------------------------------
let failed = 0;
async function main() {
  await new Promise((r) => site.listen(PORT, r));
  await new Promise((r) => account.listen(3000, r));
  ws = new WebSocket(await connect());
  await new Promise((r) => ws.addEventListener('open', r));
  listen();
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await width(390);
  for (const s of SCENES) {
    if (ONLY && s.name !== ONLY) continue;
    console.log(s.name);
    try { await s.fn(); console.log('  ok'); } catch (e) {
      failed += 1;
      console.log('  FAILED: ' + e.message);
      await shot('FAILED-' + s.name).catch(() => {});
    }
  }
  const seen = [...new Set(problems)];
  console.log('Layout checks: ' + layoutChecks + ' page views (3 styles × 3 widths)');
  console.log('Console or CSP problems: ' + seen.length);
  seen.slice(0, 20).forEach((p) => console.log('  ' + p.slice(0, 300)));
  console.log(failed || seen.length ? 'SMOKE FAILED' : 'SMOKE PASSED');
}
main().catch((e) => { console.log('harness: ' + e.stack); failed = 1; }).finally(() => {
  chrome.kill();
  site.close();
  account.close();
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  setTimeout(() => process.exit(failed ? 1 : 0), 200);
});
