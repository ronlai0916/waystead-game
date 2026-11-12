// Headless smoke test for Spellbright 2: real pages in Chrome, a fake clock, a
// fake Waystead account on localhost:3000 (shared/tests/fake-account.js) and the
// site served with nginx's own Content-Security-Policy.
// No npm packages: Chrome's DevTools Protocol over Node's WebSocket.
//
//   node tools/sb2-smoke.mjs <folder for screenshots>
//   CHROME_PATH=/path/to/chromium node tools/sb2-smoke.mjs <folder>   (default: macOS Chrome)
//
// The grown-ups' flag (CHILD_DATA_API) is served as it is in the repo (on), and
// the fake account follows the real /api/children replies. One scene turns the
// flag off in what's served, to check that path still works.
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
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; // CHROME_PATH: another Chrome or Chromium
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
let netDown = false;
let blocked = ''; // a file name the site answers 404 to, for a scene about a failed load
let storiesHidden = false; // the stories are approved in the repo: some scenes need them waiting
const site = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, SITE).pathname);
  const m = /^\/(spellbright|wordbright)\/(.*)$/.exec(path);
  const base = m ? (m[1] === 'spellbright' ? 'site/' : 'wordbright/site/') : null;
  let file = base ? ROOT + base + (m[2] || 'index.html') : null;
  if (file && existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (blocked && path.endsWith(blocked)) file = null;
  if (!file || !existsSync(file)) { res.writeHead(404, { 'Content-Security-Policy': csp }); res.end('not here'); return; }
  let body = readFileSync(file);
  if (file.endsWith('grownups-data.js') && !flagOn) body = String(body).replace('CHILD_DATA_API = true', 'CHILD_DATA_API = false');
  if (file.endsWith('stories.json') && storiesHidden) body = String(body).replaceAll('"reviewed": true', '"reviewed": false');
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Content-Security-Policy': csp, 'Cache-Control': 'no-store' });
  res.end(body);
});

const acct = fakeAccount();
acct.children = (id) => (id === ADULT ? [{ id: CHILD, nickname: 'Robin', year: 4, avatar: null }, { id: CHILD2, nickname: 'Wren', year: 6, avatar: null }] : []);
const account = createServer(async (req, res) => {
  const cors = { 'Access-Control-Allow-Origin': SITE, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS', Vary: 'Origin' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  if (acct.slowMe && req.url.startsWith('/api/me')) await new Promise((r) => setTimeout(r, acct.slowMe));
  if (acct.offline) { req.socket.destroy(); return; } // the network gone, as the browser sees it
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
// Chrome won't start as root (a container) without --no-sandbox.
const NO_SANDBOX = process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : [];
const chrome = spawn(CHROME, [...NO_SANDBOX, '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=9333', '--user-data-dir=' + PROFILE, 'about:blank'], { stdio: 'ignore' });
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
    if (m.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(m.params.type) && !blocked) problems.push('console.' + m.params.type + ': ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
    if (m.method === 'Log.entryAdded' && ['error', 'warning'].includes(m.params.entry.level)) {
      const t = m.params.entry.text + ' ' + (m.params.entry.url || '');
      // Expected: a 404 from the voice (the device speaks instead), a 409 from a save (merged and sent again),
      // the 403 and 404 the Grown-ups scenes ask for, and failed calls while the network is meant to be down.
      if (!/\/api\/voice\//.test(t) && !/status of 40[349]/.test(t) && !(/net::ERR/.test(t) && netDown)) problems.push('log: ' + t);
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
      // A fake Utterance and voice list (empty until a scene fills __voices), so a scene can make voices arrive late.
      globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } addEventListener() {} dispatchEvent() {} };
      globalThis.__voices = [];
      speechSynthesis.getVoices = () => globalThis.__voices;
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
async function hearTheFlower(w, view = '') {
  await click('[data-play]');
  await until('document.querySelector(".blanks")', 'the flower game');
  if (view) await allViews(view);
  await keys([...new Set(w)].join(''));
  await click('[data-next]');
  await sleep(40);
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
// The five Study mode jobs done on `day` (the test is due only once they are, SB3-A).
function studied(doc, id = 'g1', day = plus(1)) {
  const g = W.groupById(doc, id);
  let d = ['hello', 'fix', 'games', 'story'].reduce((x, st) => W.markStep(x, g, st, day, Date.parse(day + 'T09:00:00')), doc);
  W.rows(g).forEach((w, i) => { for (const h of [10, 11, 12]) d = W.addTry(d, { id: 'st' + id + i + h, word: w, day, group: id, kind: 'p', tries: 0, peeks: 0, clean: true, now: Date.parse(day + 'T' + h + ':00:00') + i }); });
  return d;
}
const noWord = async (where) => {
  const t = (await text()).toLowerCase();
  for (const w of WORDS) ok(!t.includes(w), where + ' shows ' + w);
};
scene('week', async () => {
  storiesHidden = true; // the examples path; the story itself has its own scene
  try { await week(); } finally { storiesHidden = false; }
});
async function week() {
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
    if (i === 0) {
      await click('[data-example]'); ok(await ev('globalThis.__lines.length > 0'), 'the example is read aloud');
      ok(/Meet this word\. Hear it\./.test(await text('h1')), 'the instruction');
      ok(/Word 1 of 4/i.test(await text()) && await has('.segs'), 'the progress');
      ok(/What it means/.test(await text()) && /Say the letters/.test(await text()) && /Hear it/.test(await text('[data-hear]')), 'the card');
      ok(/Play the flower game/.test(await text('[data-play]')), 'the main button is the flower game');
    }
    await hearTheFlower(w, i === 0 ? 'day1-hello-game' : '');
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
  await go('#/words/g/g1/games');
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
}

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

scene('a missed week: the jobs catch up from the test date, then the test', async () => {
  await seedChild(weekDoc(), plus(6));
  await open(plus(6), '#/');
  await until('document.querySelector("[data-room=job]")', 'the room with a job');
  const waitText = (await text('[data-catchup]')).replace(/\s+/g, ' ');
  ok(/5 jobs waiting for you/i.test(waitText) && /Your test day was Sat 7 Nov\. Finish your jobs, then take the test here\./.test(waitText), 'the waiting line: ' + waitText);
  ok(/Hello words/.test(await text('[data-job]')), 'Hello words first, not the test: ' + await text('[data-job]'));
  ok(/Then Fix it in\. The test opens when your jobs are done\./.test(await text()), 'the then line');
  ok(!/late|behind/i.test(await text()), 'kind words only');
  ok(await ev('document.querySelectorAll("main button, main a").length') === 3, 'Hear it, the one button and the path card: ' + await ev('document.querySelectorAll("main button, main a").length'));
  await allViews('catchup-room');
  await go('#/words/g/g1');
  await until('document.querySelector("[data-catchup]")', 'the line on the group page');
  ok(/fruit/.test((await text()).toLowerCase()), 'the words are on show');
  ok(!await has('[data-testcard]'), 'no test card while jobs wait');
  ok(await has('.weekstrip__day.is-waiting'), 'waiting jobs on the strip');
  await allViews('catchup-group');
  await go('#/words/g/g1/test');
  await sleep(120);
  ok(!/\/test$/.test(await ev('location.hash')), 'the test page sends you back while jobs wait');
  await go('#/words/g/g1/games');
  await until('document.querySelector(".gamecards")', 'Game mode open during catch-up');
  step('two jobs, then done for today');
  let d = await readLocal();
  const g = W.groupById(d, 'g1');
  for (const st of ['hello', 'fix']) d = W.markStep(d, g, st, plus(6), Date.parse(plus(6) + 'T10:00:00'));
  await ev('localStorage.setItem("sb.words:' + CHILD + '",' + q(JSON.stringify(d)) + ')');
  await open(plus(6), '#/');
  await until('document.querySelector("[data-room=done]")', 'done for today after two');
  step('the rest the next day, and the test opens the same day');
  d = studied(d, 'g1', plus(7));
  await ev('localStorage.setItem("sb.words:' + CHILD + '",' + q(JSON.stringify(d)) + ')');
  await open(plus(7), '#/');
  await until('document.querySelector("[data-room=job]")', 'the test');
  ok(/Start the test/.test(await text('[data-job]')), 'the test is the job now: ' + await text('[data-job]'));
  await noWord('the room once the test is due');
});

scene('a legacy week: jobs left undone when the test was taken show "Not done"', async () => {
  let d = weekDoc();
  const g = W.groupById(d, 'g1');
  for (const st of ['fix', 'games']) d = W.markStep(d, g, st, plus(1), Date.parse(plus(1) + 'T09:00:00'));
  WORDS.forEach((w, i) => { d = W.addTry(d, { id: 'lt' + i, word: w, day: plus(5), group: 'g1', kind: 't', tries: 0, peeks: 0, clean: true, now: Date.parse(plus(5) + 'T11:00:00') + i }); });
  await seedChild(d, plus(6));
  await open(plus(6), '#/words/g/g1');
  await until('document.querySelector(".weekstrip__day.is-missed")', 'missed jobs on the strip');
  ok(await ev('document.querySelectorAll(".weekstrip__day.is-missed").length') === 3, 'hello, story and practice are not done');
  ok(!await has('.weekstrip__day.is-waiting'), 'nothing waiting');
  ok(/Not done/.test(await text('.weekstrip')), 'the strip says Not done');
  ok(!await has('[data-catchup]'), 'no waiting line');
  await allViews('legacy-group');
});

scene('test day: no page shows a test word', async () => {
  // A second group sharing a word, one with different words, and Tricky words holding a test word.
  let doc = studied(weekDoc());
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
  ok(/0 of 3 in a row/.test(await rowNow()), 'a mistake shows 0/3');
  await allViews('spell-mistake');
  await keys(first);
  await until('/try that one again/.test(document.querySelector("[data-line]").innerText)', 'the retry line');
  await allViews('spell-retry');
  await turn();
  ok(await ev('location.hash') === here, 'still the same word');
  step('two clean, then a mistake at 2/3 resets');
  await keys(first);
  await sleep(60);
  ok(/1 of 3 in a row/.test(await rowNow()), '1/3: ' + await rowNow());
  await turn();
  await keys(first);
  await sleep(60);
  ok(/2 of 3 in a row/.test(await rowNow()), '2/3');
  await allViews('spell-two-of-three');
  await turn();
  await keys('z');
  await keys(first);
  await sleep(60);
  ok(/0 of 3 in a row/.test(await rowNow()), 'a mistake at 2/3 resets');
  step('a peek resets too');
  await turn();
  await keys(first);
  await sleep(60);
  ok(/1 of 3 in a row/.test(await rowNow()), '1/3 again');
  await turn();
  await click('[data-peekbtn]');
  ok(/0 of 3 in a row/.test(await rowNow()), 'a peek shows 0/3');
  await sleep(2200);
  await keys(first);
  await sleep(60);
  ok(/0 of 3 in a row/.test(await rowNow()), 'a peek counts as no clean spelling');
  await spellToDone();
  ok(/3 of 3 in a row/.test(await rowNow()), '3/3');
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
  ok(/1 of 3 in a row/.test(await rowNow()), '1/3');
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
  ok(/1 of 3 in a row/.test(await rowNow()), 'it carries on at 1/3');
  await sleep(1800);

  step('another device carries on');
  const device = await ev('localStorage.getItem("wa.player")');
  await ev('localStorage.clear()');
  await ev('localStorage.setItem("wa.player",' + q(device) + ')');
  await open(plus(4), '#/');
  await until('document.querySelector("[data-comeback]")', 'the marker on the other device', 8000);
  await go('#/words/g/g1/spell/' + WORDS.indexOf(third));
  await until('document.querySelector("[data-row]").innerText.includes("1 of 3 in a row")', 'the count on the other device');

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
  ok(/0 of 3 in a row/.test(await rowNow()), 'a peek shows 0/3');
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
  await reviewedStory();
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
  await until('document.querySelector("[data-play]")', 'the flower game button');
});

// ---- SB3-C1: the child's screens ("the garden path") ----------------------------------------
const visible = (sel) => ev('(() => { const e = document.querySelector(' + q(sel) + '); if (!e) return false; const r = e.getBoundingClientRect(); return !!(r.width && r.height && getComputedStyle(e).visibility !== "hidden"); })()');
const rect = (sel) => ev('(() => { const r = document.querySelector(' + q(sel) + ').getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; })()');
const gameDayDoc = () => { let d = weekDoc(WORDS, plus(7)); const g = W.groupById(d, 'g1'); d = W.markStep(d, g, 'hello', MON, Date.parse(MON + 'T09:00:00')); return W.markStep(d, g, 'fix', plus(1), Date.parse(plus(1) + 'T09:00:00')); };

scene('child home, path, Menu and Settings', async () => {
  await seedChild(gameDayDoc(), plus(2));
  await open(plus(2), '#/');
  await until('document.querySelector("[data-room=job]")', 'the home');
  step('the top bar: the mark and one labelled Menu');
  ok(/^Menu$/.test((await text('#child-menu')).trim()), 'a labelled Menu');
  ok(await visible('.brand') && await visible('#child-menu'), 'the mark and Menu show');
  for (const sel of ['.topbar__nav', '.allgames', '#player-slot', '#theme', '.foot']) ok(!await visible(sel), sel + ' is not shown to a child');
  ok((await rect('#child-menu')).h >= 48, 'Menu is at least 48 px high');
  step('home: Pip, the day and job, one sentence, Hear it, one button, the time, the path card');
  ok(/Wednesday · Game day/i.test(await text('.eyebrow')), 'the eyebrow: ' + await text('.eyebrow'));
  ok(/Play four quick games with your words\./.test(await text('h1')), 'the sentence');
  ok(await has('[data-pip=happy]'), 'Pip');
  ok(/Start Game day/.test(await text('[data-job]')), 'the button');
  ok(/About 15 minutes/.test(await text()), 'the time');
  ok(/My path this week/.test(await text('.pathcard')) && /Tap to see your week/.test(await text('.pathcard')) && /Job 3 of 7/.test(await text('.pathcard')), 'the path card: ' + await text('.pathcard'));
  ok(await ev('document.querySelectorAll(".pathcard .stone").length') === 7, 'seven mini stones');
  ok(!/stars|Test day|Fri/.test(await text()), 'no stars or test date on the home');
  ok(await ev('[...document.querySelectorAll("main a, main button")].every((e) => e.getBoundingClientRect().height >= 47)'), 'every tap target is 48 px high');
  await click('[data-hear]');
  ok(await ev('globalThis.__lines.at(-1)') === 'Play four quick games with your words.', 'Hear it reads the sentence');
  await allViews('child-home');

  step('the path');
  await click('[data-pathcard]');
  await until('document.querySelector("[data-path]")', 'the path');
  ok(/Your path this week/.test(await text('h1')), 'the heading');
  ok(await ev('document.querySelectorAll(".pathrow").length') === 7, 'seven stones');
  ok(await has('.pathrow--done') && await has('.pathrow--today') && await has('.pathrow--later'), 'done, today and later');
  ok(/Today · tap to start/.test(await text('.pathrow--today')), 'today: tap to start');
  ok(await ev('document.querySelectorAll("[data-again]").length') === 2 && /Do it again/.test(await text('[data-again]')), 'Do it again on the two done jobs');
  ok(/Test Fri 6 Nov|Test .* Nov/.test(await text('.pathfoot')) && /stars?/.test(await text('.pathfoot')), 'flat stars and test date: ' + await text('.pathfoot'));
  ok(await ev('document.querySelectorAll(".pathfoot a, .pathfoot button").length') === 0, 'they are not buttons');
  ok(/Fix any slips/.test(await text('.pathpanel')), 'the Mend helper');
  ok(!/late/i.test(await text('.pathpanel')), 'no "late"');
  ok(await visible('#child-back') && await visible('#child-menu'), 'Back and Menu');
  ok(/^Back$/.test((await text('#child-back')).trim()), 'Back is labelled');
  await allViews('child-path');
  await click('#child-back');
  await until('document.querySelector("[data-room=job]")', 'home again');

  step('the Menu sheet: a real dialog');
  await click('#child-menu');
  await until('document.querySelector("[role=dialog]")', 'the sheet');
  ok(await ev('document.querySelector("[role=dialog]").getAttribute("aria-modal") === "true"'), 'aria-modal');
  ok(await ev('document.activeElement && document.activeElement.hasAttribute("data-close")'), 'focus moves in, to Close');
  ok(await ev('document.querySelector("main").hasAttribute("inert") && document.querySelector("header").hasAttribute("inert")'), 'the page behind is inert');
  const rows = await ev('[...document.querySelectorAll(".sheetrow")].map((e) => e.querySelector("b").textContent)');
  ok(rows.join() === 'Games,My words,More practice,Settings', 'the rows: ' + rows);
  ok(/Chapters, tricky words, your progress/.test(await text('.sheetrow[data-row=practice]')) && await has('.sheetrow[data-row=practice][href="#/chapters"]'), 'More practice goes to the chapters');
  ok(await has('.sheetrow[data-row=games][href$="/games"]'), 'Games is open');
  await allViews('child-menu');
  await key('Escape');
  await until('!document.querySelector("[role=dialog]")', 'Escape closes it');
  ok(await ev('document.activeElement.id === "child-menu"'), 'focus returns to Menu');
  ok(await ev('!document.querySelector("main").hasAttribute("inert")'), 'the page is live again');
  await click('#child-menu');
  await until('document.querySelector("[role=dialog]")', 'the sheet again');
  await click('[data-close]');
  await until('!document.querySelector("[role=dialog]")', 'Close closes it');

  step('Settings');
  await click('#child-menu');
  await until('document.querySelector("[role=dialog]")', 'the sheet');
  await click('.sheetrow[data-row=settings]');
  await until('document.querySelector("[data-settings]")', 'Settings');
  ok(!await has('[role=dialog]'), 'the sheet closed on the way');
  ok(/Day or night/.test(await text()) && /Grown-ups/.test(await text()) && /About and licence/.test(await text()), 'the rows: ' + await text());
  ok(!await has('[data-switch]'), 'a child\'s own session cannot switch (the account\'s chip has no Switch player either)');
  ok(await ev('document.querySelectorAll("[data-looks] [data-choice]").length') === 4, 'the four looks');
  await click("[data-looks] [data-choice=night]");
  ok(await ev('document.documentElement.dataset.style') === 'night', 'Night is chosen');
  await click("[data-looks] [data-choice=garden]");
  ok(await ev('document.documentElement.dataset.style') === 'garden', 'and the garden again');
  await ev('document.querySelector("[data-about]").open = true');
  ok(/Open Government Licence/.test(await text()), 'the licence line moved here');
  await allViews('child-settings');
  ok(!await visible('.foot'), 'no footer');
});

scene('child menu while the test is due, and the test keyboard', async () => {
  await seedChild(studied(weekDoc()), plus(5));
  await open(plus(5), '#/');
  await until('document.querySelector("[data-room=job]")', 'the home on test day');
  ok(/Start the test/.test(await text('[data-job]')), 'Start the test');
  await noWord('the home on test day');
  await click('#child-menu');
  await until('document.querySelector("[role=dialog]")', 'the sheet');
  ok(/Test first, then games\./.test(await text('[data-row=games]')), 'the closed line');
  ok(!await has('a[data-row=games]'), 'Games is not a link');
  ok(/Hear it/.test(await text('[data-hear-line]')), 'Hear it');
  await click('[data-hear-line]');
  ok(await ev('globalThis.__lines.at(-1)') === 'Test first, then games.', 'the line is read');
  await allViews('child-menu-test');
  await click('[data-close]');
  step('the test: one Hear the word, a keyboard with Delete');
  await click('[data-job]');
  await until('document.querySelector("[data-next]")', 'the test');
  ok(await visible('#child-stop') && !await visible('#child-menu'), 'Stop for now, no Menu');
  ok(/Hear the word/.test(await text('[data-hear]')) && /Listen, then type the word\./.test(await text('h1')), 'the words');
  ok((await rect('.key--del')).w >= 48, 'Delete is at least 48 px wide');
  await noWord('the test');
  await keys('ab');
  await click('[data-del]');
  ok(await text('[data-answer]') === 'a', 'Delete takes a letter off');
});

scene('hello with no picture', async () => {
  await seedChild(weekDoc(['tractor', 'earth']), MON);
  await open(MON, '#/');
  await click('[data-job]');
  await until('document.querySelector(".wordcard")', 'Hello words');
  ok(!await has('.wordcard img') && !await has('.pic'), 'no broken or empty picture');
  ok(await has('.wordcard--nopic'), 'the calm no-picture layout');
  ok(!/Picture on its way/.test(await text()), 'the placeholder stays behind its state');
  ok(await visible('#child-stop') && /Hello words/.test(await text('#job-name')), 'the job name and Stop for now');
  ok((await rect('#child-stop')).h >= 48, 'Stop for now is at least 48 px');
  await allViews('child-hello-nopic');
});

scene('practice: the keyboard, a pressed key, a peek, Stop for now', async () => {
  await seedChild(practiceDayDoc(), plus(4));
  await open(plus(4), '#/');
  await click('[data-job]');
  await until('document.querySelector(".spellbox.is-next")', 'the practice word');
  ok(/Listen, then type the word\./.test(await text('h1')) && /Word 1 of 4/i.test(await text('.eyebrow')), 'the heading');
  ok(/Read it to me/.test(await text()) && /Hear the word/.test(await text('[data-hear]')), 'Read it to me and Hear the word');
  ok(await ev('document.querySelectorAll("main svg:not([aria-hidden])").length') === 0, 'the only speaker icon is Hear the word');
  ok(/1\/3|0 of 3 in a row/.test(await rowNow()), 'the dots caption: ' + await rowNow());
  ok(/Peeking starts your count again\./.test(await text('[data-hint]')), 'the peek hint');
  ok(/Skip for now\. It comes back later\./.test(await text('[data-skip]')) && await ev('document.querySelector("[data-skip]").tagName') === 'BUTTON', 'Skip is a button');
  const skip = await rect('[data-skip]');
  const peek = await rect('[data-peekbtn]');
  ok(skip.h >= 48 && skip.y - (peek.y + peek.h) >= 3, 'Skip is 48 px high and clear of Peek: ' + JSON.stringify([skip, peek]));
  ok(await ev('document.querySelectorAll(".keyboard-row").length') === 3, 'three rows');
  ok(await ev('[...document.querySelectorAll(".keyboard-row")].map((r) => r.querySelectorAll(".key").length).join()') === '10,9,7', '10, 9 and 7 keys');
  ok(await ev('getComputedStyle(document.querySelector(".keyboard-row")).flexWrap') === 'nowrap', 'nowrap');
  const q1 = await rect('.key[data-letter=Q]');
  const p1 = await rect('.key[data-letter=P]');
  const a1 = await rect('.key[data-letter=A]');
  ok(Math.abs(q1.y - p1.y) < 1 && p1.x + p1.w <= 390, 'P stays on row 1 at 390: ' + JSON.stringify(p1));
  ok(q1.w >= 34 && q1.w <= 36 && q1.h === 56, 'keys are about 35 x 56: ' + JSON.stringify(q1));
  ok(Math.abs((a1.y - q1.y - q1.h) - 8) < 1, 'rows are 8 px apart');
  ok(Math.abs((await rect('.key[data-letter=W]')).x - q1.x - q1.w - 3) < 1, 'keys are 3 px apart');
  step('a pressed key shows its letter above, and nothing moves');
  const before = await ev('document.documentElement.scrollHeight');
  const kb = await rect('.keyboard');
  await ev('document.querySelector(".key[data-letter=I]").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))');
  ok(await ev('document.querySelector(".keypop").classList.contains("is-on") && document.querySelector(".keypop").textContent === "i" && document.querySelector(".keypop").getAttribute("aria-hidden") === "true"'), 'the pop-up letter, aria-hidden');
  ok(await ev('document.documentElement.scrollHeight') === before && (await rect('.keyboard')).y === kb.y, 'no layout shift');
  await allViews('child-practice-pressed');
  await ev('document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }))');
  await until('!document.querySelector(".keypop.is-on")', 'the pop-up goes away');
  step('a peek');
  await click('[data-peekbtn]');
  ok(/Peeked\. Start your count again\./.test(await text('[data-hint]')), 'after the peek: ' + await text('[data-hint]'));
  await allViews('child-practice-peeked');
  await sleep(2200);
  step('Stop for now');
  ok(/Practice day/.test(await text('#job-name')) && await visible('#child-stop') && !await visible('#child-menu') && !await visible('.brand') && !await visible('.foot'), 'the job bar');
  await click('#child-stop');
  await until('document.querySelector("[data-room]")', 'home');
  ok(/Your place is saved\./.test(await text('[data-saved]')), 'Your place is saved.');
  await allViews('child-stopped');
  await go('#/words');
  await go('#/');
  await until('document.querySelector("[data-room]")', 'home again');
  ok(!await has('[data-saved]'), 'shown once');
});

scene('an adult playing as a child can switch player from Settings', async () => {
  await seedChild(gameDayDoc(), plus(2));
  acct.who = { ...adultMe, playingAs: { id: CHILD, nickname: 'Robin', year: 4, avatar: null } };
  await open(plus(2), '#/settings');
  await until('document.querySelector("[data-settings]")', 'Settings');
  await until('document.querySelector("[data-switch]")', 'Switch player', 8000);
  ok(/\/play\?return=/.test(await ev('document.querySelector("[data-switch]").href')), 'the existing /play flow');
  acct.who = childMe;
});

scene('an adult keeps today\'s top bar and pages', async () => {
  await seedAdult();
  await until('document.querySelector("a[href=\\"#/grownups\\"]")', 'the adult\'s home');
  ok(!await ev('document.body.classList.contains("is-child")'), 'not a child\'s chrome');
  ok(await visible('#theme') && await visible('.foot') && !await visible('#child-menu'), 'the look menu and footer show, no child Menu');
  ok(await ev('document.querySelectorAll(".topbar__nav a").length') === 4, 'the four links');
});

scene('an adult with a cached player keeps the full top bar: slow account, then no account', async () => {
  await signedOutBlank(plus(2));
  acct.who = adultMe;
  await ev('localStorage.setItem("wa.player",' + q(JSON.stringify({ id: ADULT, name: 'Sam', avatar: null })) + ')');
  acct.slowMe = 2500;
  await setClock(plus(2));
  await send('Page.navigate', { url: 'about:blank' });
  await send('Page.navigate', { url: SITE + '/spellbright/#/' });
  await until('document.readyState === "complete"', 'the page');
  for (let i = 0; i < 5; i += 1) {
    await sleep(300);
    ok(!await ev('document.body.classList.contains("is-child")'), 'no child bar while the account is slow (' + i + ')');
    ok(!await visible('#child-menu'), 'no child Menu while the account is slow');
  }
  await until('document.querySelector("a[href=\\"#/grownups\\"]")', 'the adult\'s home after /api/me', 9000);
  ok(!await ev('document.body.classList.contains("is-child")') && await visible('#theme') && !await visible('#child-menu'), 'the adult bar after the answer');
  acct.slowMe = 0;
  step('account offline, a cached player that has no kind');
  acct.offline = true;
  netDown = true; // the failed /api/me is the point of this scene
  await open(plus(2), '#/');
  await sleep(1500);
  ok(!await ev('document.body.classList.contains("is-child")') && !await visible('#child-menu'), 'never a stuck child bar');
  ok(await visible('#theme') && await ev('document.querySelectorAll(".topbar__nav a").length') === 4, 'the full top bar stays');
  await allViews('adult-bar-offline');
  acct.offline = false;
  netDown = false;
});

scene('Settings: look, Voice, My account and Sign out; arrow keys change the look', async () => {
  await seedChild(gameDayDoc(), plus(2));
  await open(plus(2), '#/settings');
  await until('document.querySelector("[data-settings]")', 'Settings');
  await until('document.querySelector("[data-account]")', 'My account', 8000);
  // Headless Chrome has no voices, so the shared menu hides its Voice part: the page shows Voice exactly when the menu does.
  ok(await has('[data-voices]') === await ev('(() => { const p = document.querySelector("#theme-menu [data-voice-part]"); return !!p && !p.hidden; })()'), 'Voice is shown when the look menu offers it');
  ok(await has('[data-signout]') && await has('[data-grownups]'), 'Sign out and Grown-ups');
  const radios = await ev('[...document.querySelectorAll("[data-looks] [data-choice]")].map((e) => e.getAttribute("role"))');
  ok(radios.length >= 3 && radios.every((r) => r === 'radio'), 'three look radios: ' + JSON.stringify(radios));
  await ev('document.querySelector("[data-looks] [data-choice][aria-checked=true]").focus()');
  const was = await ev('document.querySelector("[data-looks] [data-choice][aria-checked=true]").dataset.choice');
  await key('ArrowRight');
  await sleep(100);
  ok(await ev('document.querySelector("[data-looks] [data-choice][aria-checked=true]").dataset.choice') !== was, 'ArrowRight picks the next look');
  await allViews('child-settings-rows');
});

scene('quick-fire has Delete and the same Hear/Skip rows as practice; the group page is tidy for a child', async () => {
  await seedChild(gameDayDoc(), plus(2));
  await open(plus(2), '#/words/g/g1/game/quick');
  await until('document.querySelector("[data-game=quick]")', 'Quick-fire');
  ok(await has('.key--del') && await has('.skiprow') && /Hear the word/.test(await text('[data-hear]')), 'Delete, Hear and Skip');
  await keys('ab');
  await click('[data-del]');
  ok(await ev('document.querySelectorAll(".spellbox .ch, [data-answer]").length >= 0'), 'Delete pressed');
  ok((await rect('.key--del')).w >= 48, 'Delete is at least 48 px');
  await allViews('child-quickfire');
  await go('#/words/g/g1');
  await until('document.querySelector(".wordgrid, .wordlist, main h1")', 'the group page');
  ok(!await visible('.modeswitch') && !await visible('.groupmanage'), 'no Study/Game tabs or management buttons for a child');
  await allViews('child-group');
});

scene('a stopped test says Carry on with the test', async () => {
  await seedChild(studied(weekDoc()), plus(5));
  await open(plus(5), '#/');
  await until('document.querySelector("[data-job]")', 'home');
  await click('[data-job]');
  await until('document.querySelector("[data-next]")', 'the test');
  await keys(await lastWord());
  await key('Enter');
  await sleep(150);
  await click('#child-stop');
  await until('document.querySelector("[data-room]")', 'home');
  await go('#/');
  await sleep(200);
  ok(/Carry on with the test/.test(await text('[data-job]')) , 'the test button: ' + await text('[data-job]'));
});

scene('an adult\'s keyboard is exactly as before: 46 x 54 keys, 5 px gap at 1280', async () => {
  await seedAdult();
  await width(1280, 900);
  await go('#/y34/ch01/quick/fruit');
  await until('document.querySelector(".keyboard .key[data-letter]")', 'a chapter keyboard');
  const k = await ev('(() => { const a = document.querySelectorAll(".keyboard-row")[0].querySelectorAll(".key"); const r = a[0].getBoundingClientRect(), r2 = a[1].getBoundingClientRect(); return { w: r.width, h: r.height, gap: r2.x - r.right }; })()');
  ok(Math.round(k.w) === 46 && Math.round(k.h) === 54 && Math.round(k.gap) === 5, 'adult keys: ' + JSON.stringify(k));
  ok(!await has('.key--del'), 'no Delete key for an adult');
  await width(1280, 900);
});

const bar = () => ev('({ child: document.body.classList.contains("is-child"), pending: document.body.classList.contains("is-pending") || document.documentElement.classList.contains("wa-pre"), nav: !!document.querySelector(".topbar__nav") && document.querySelector(".topbar__nav").getBoundingClientRect().width > 0 && getComputedStyle(document.querySelector(".topbar__nav")).visibility !== "hidden", chip: document.querySelector("#player-slot") && document.querySelector("#player-slot").getBoundingClientRect().width > 0 && getComputedStyle(document.querySelector("#player-slot")).visibility !== "hidden", look: !!document.querySelector("#theme") && document.querySelector("#theme").getBoundingClientRect().width > 0 && getComputedStyle(document.querySelector("#theme")).visibility !== "hidden", foot: !!document.querySelector(".foot") && document.querySelector(".foot").getBoundingClientRect().height > 0 && getComputedStyle(document.querySelector(".foot")).visibility !== "hidden", menu: !document.querySelector("#child-menu").hidden && document.querySelector("#child-menu").getBoundingClientRect().width > 0, brand: document.querySelector(".brand").getBoundingClientRect().width > 0 })');
/** Sample the top bar every 60 ms for `ms`. */
async function sampleBar(ms) { const out = []; const t0 = Date.now(); while (Date.now() - t0 < ms) { out.push({ at: Date.now() - t0, ...await bar() }); await sleep(60); } return out; }
async function openCached(day, hash = '#/') {
  await setClock(day);
  await send('Page.navigate', { url: 'about:blank' });
  await send('Page.navigate', { url: SITE + '/spellbright/' + hash });
  await until('document.readyState !== "loading"', 'the page');
}

scene('a real child while /api/me is slow: the mark alone, never the full bar, then the child bar', async () => {
  for (const delay of [300, 1500]) {
    step('/api/me takes ' + delay + ' ms');
    await seedChild(gameDayDoc(), plus(2));
    acct.slowMe = delay;
    await openCached(plus(2));
    const seen = await sampleBar(delay + 1200);
    acct.slowMe = 0;
    const early = seen.filter((x) => !x.child);
    ok(early.every((x) => !x.nav && !x.chip && !x.look && !x.foot && !x.menu), 'while waiting: never the nav, chip, look menu, footer or child buttons: ' + JSON.stringify(early.find((x) => x.nav || x.chip || x.look || x.foot || x.menu)));
    ok(early.some((x) => x.pending && x.brand), 'the mark alone while waiting');
    ok(seen.at(-1).child && seen.at(-1).menu && !seen.at(-1).nav && !seen.at(-1).pending, 'then the child bar');
    const swaps = seen.filter((x, i) => i && x.child !== seen[i - 1].child).length;
    ok(swaps === 1, 'one switch only');
    if (delay === 1500) await allViews('child-pending-done');
  }
});

scene('an adult with a cached player and a slow account: never the child bar, the mark alone, then the full bar; offline: the full bar by 2.5 s', async () => {
  await signedOutBlank(plus(2));
  acct.who = adultMe;
  await ev('localStorage.setItem("wa.player",' + q(JSON.stringify({ id: ADULT, name: 'Sam', avatar: null })) + ')');
  acct.slowMe = 1500;
  await openCached(plus(2));
  const seen = await sampleBar(2800);
  acct.slowMe = 0;
  ok(seen.every((x) => !x.child && !x.menu), 'never the child bar');
  ok(seen.slice(0, 5).every((x) => !x.nav && !x.look && !x.chip), 'the mark alone while waiting');
  ok(seen.at(-1).look && seen.at(-1).foot && !seen.at(-1).pending, 'then the full bar: ' + JSON.stringify(seen.at(-1)));
  step('offline');
  acct.offline = true;
  netDown = true;
  await openCached(plus(2));
  const off = await sampleBar(3200);
  ok(off.every((x) => !x.child && !x.menu), 'never the child bar offline');
  const late = off.filter((x) => x.at > 2700);
  ok(late.length && late.every((x) => x.look && x.foot && !x.pending), 'the full bar by 2.5 s: ' + JSON.stringify(late[0]));
  acct.offline = false;
  netDown = false;
});

scene('signed out with no cached player: the full bar at once', async () => {
  await signedOutBlank(plus(2));
  acct.who = null;
  await openCached(plus(2), '#/about');
  const seen = await sampleBar(600);
  ok(seen.every((x) => !x.pending && !x.child), 'no pending state');
});

scene('More practice: Chapters, Pick words, Tricky words, Progress, My word numbers, back; no word on test day', async () => {
  await seedChild(gameDayDoc(), plus(2));
  await open(plus(2), '#/');
  await click('#child-menu');
  await until('document.querySelector("[role=dialog]")', 'the sheet');
  const rows = await ev('[...document.querySelectorAll(".sheetrow")].map((e) => e.querySelector("b").textContent)');
  ok(rows.join() === 'Games,My words,More practice,Settings', 'four rows: ' + rows);
  ok((await rect('.sheetrow[data-row=practice]')).h >= 48, 'the row is 48 px high');
  await allViews('child-menu-4');
  await click('.sheetrow[data-row=practice]');
  await until('document.querySelector(".shortcuts")', 'the chapters page');
  ok(await visible('#child-back') && await visible('#child-menu'), 'Back and Menu');
  ok(await ev('[...document.querySelectorAll(".shortcuts a")].every((a) => a.getBoundingClientRect().height >= 48 && a.getBoundingClientRect().width >= 48)'), 'the links are at least 48 px');
  await allViews('child-chapters');
  for (const [href, ready] of [['#/custom', 'main h1'], ['#/tricky', 'main h1'], ['#/progress', 'main h1']]) {
    await go('#/chapters');
    await click('.shortcuts a[href="' + href + '"]');
    await until('location.hash === ' + q(href) + ' && document.querySelector(' + q(ready) + ')', href);
    await click('#child-back');
    await until('location.hash === "#/" || location.hash === ""', 'back home from ' + href);
  }
  await go('#/progress');
  await until('document.querySelector("a[href=\'#/words/progress\']")', 'My word numbers link');
  ok((await rect('a[href="#/words/progress"]')).h >= 48, 'My word numbers is at least 48 px high');
  await click('a[href="#/words/progress"]');
  await until('location.hash === "#/words/progress"', 'My word numbers');
  step('the group page: only the quiet Change link');
  await go('#/words/g/g1');
  await until('document.querySelector(".groupedit")', 'the group page');
  ok(!await visible('.groupmanage') && await visible('.groupedit a') && (await rect('.groupedit a')).h >= 48, 'a quiet Change this group, 48 px');
  ok(/Change this group|Rename or delete/.test(await text('.groupedit')), 'its words');
  await click('.groupedit a');
  await until('location.hash.endsWith("/edit")', 'the edit page');
  step('test day: these pages show no word');
  await seedChild(studied(weekDoc()), plus(5));
  await open(plus(5), '#/chapters');
  for (const h of ['#/chapters', '#/custom', '#/tricky', '#/progress', '#/words/progress', '#/words', '#/settings']) {
    await go(h);
    await sleep(250);
    const t = (await text()).toLowerCase();
    for (const w of WORDS) ok(!new RegExp('\\b' + w + '\\b').test(t), h + ' on test day shows ' + w); // whole words: "Building up" is a chapter title
  }
});

scene('Settings: voices that arrive late fill the Voice card; the tip stays', async () => {
  await seedChild(gameDayDoc(), plus(2));
  await open(plus(2), '#/settings');
  await until('document.querySelector("[data-settings]")', 'Settings');
  ok(!await visible('[data-voicecard]'), 'no voices yet: no Voice card');
  await ev('globalThis.__voices = [{ name: "Test Daniel", lang: "en-GB", localService: true, default: true, voiceURI: "test-daniel" }]; speechSynthesis.dispatchEvent(new Event("voiceschanged"));');
  await until('document.querySelector("[data-voices] [data-voice]")', 'the Voice card after voiceschanged');
  ok(await ev('document.querySelectorAll("[data-voices] [data-voice]").length') >= 1, 'the voices are listed');
  ok(await visible('[data-voicecard]'), 'the card shows');
  ok(await ev('!![...document.querySelectorAll("[data-voices] [data-voice]")].find((e) => e.getAttribute("aria-checked") === "true")'), 'one is ticked');
  ok(await has('[data-more]') || await has('[data-voicetip]'), 'Add more voices or the tip line is kept');
  await click('[data-voices] [data-voice]:last-child');
  await allViews('child-settings-voices');
  await go('#/');
  await ev('globalThis.__voices = []; speechSynthesis.dispatchEvent(new Event("voiceschanged"));');
  await sleep(100);
});

scene('Hello flower game: no one-word progress line, lives kept, child-sized keys; grid links 48 px wide', async () => {
  await seedChild(weekDoc(), MON);
  await open(MON, '#/');
  await click('[data-job]');
  await until('document.querySelector("[data-play]")', 'Hello');
  await click('[data-play]');
  await until('document.querySelector(".blanks")', 'the flower game');
  ok(!await has('.progressline') && !/Word 1 of 1/.test(await text()), 'no "Word 1 of 1"');
  ok(await ev('document.querySelectorAll(".lives i").length') === 6, 'the lives stay');
  const k = await rect('.key[data-letter=A]');
  ok(Math.round(k.h) === 56 && k.w >= 34 && k.w <= 37, 'keys are 35 x 56: ' + JSON.stringify(k));
  const k2 = await rect('.keyboard-row .key');
  ok(Math.abs(k2.w - 35) < 2.5, 'the same width as the other child keyboards');
  await allViews('child-hello-game');
  await open(plus(4), '#/words/g/g1');
  await until('document.querySelector(".wordgrid a, .gridwrap a")', 'the grid links');
  ok(await ev('[...document.querySelectorAll(".wordgrid a")].every((a) => a.getBoundingClientRect().width >= 47.5 && a.getBoundingClientRect().height >= 47.5)'), 'grid links are 48 x 48');
});

scene('a failed load never leaves the mark-alone bar: word list 404, and app.js 404', async () => {
  await seedChild(gameDayDoc(), plus(2));
  step('the word list does not load');
  blocked = 'curriculum.json';
  await openCached(plus(2));
  await until('/word list didn.t load/.test(document.body.innerText)', 'the message');
  let b = await bar();
  ok(!b.pending && b.look && b.foot && !b.child, 'the full bar beside the message: ' + JSON.stringify(b));
  step('app.js does not load at all');
  blocked = 'js/app.js';
  await openCached(plus(2));
  await sleep(300);
  b = await bar();
  ok(b.pending && !b.look, 'the mark alone at first: ' + JSON.stringify(b));
  await sleep(3200);
  b = await bar();
  ok(b.look && b.foot && !b.menu, 'the bar is back on its own by 3.5 s: ' + JSON.stringify(b));
  ok(await ev('getComputedStyle(document.querySelector(".topbar__nav")).display') !== 'none', 'the nav is never display: none');
  blocked = '';
});

scene('the keyboard sits at the foot; the pop-up letter never covers a control (390x844, 390x667, 768x1024, 1024x768)', async () => {
  await seedChild(practiceDayDoc(), plus(4));
  for (const [w, h] of [[390, 844], [390, 667], [768, 1024], [1024, 768]]) {
    step(w + 'x' + h);
    await open(plus(4), '#/');
    await width(w, h);
    await click('[data-job]');
    await until('document.querySelector(".spellbox.is-next")', 'the practice word');
    await width(w, h);
    await sleep(150);
    const kb = await rect('.keyboard');
    const skip = await rect('[data-skip]');
    const peek = await rect('[data-peekbtn]');
    ok(kb.w <= 560 && (w > 480 ? Math.abs(kb.x + kb.w / 2 - w / 2) < 16 : true), 'the keyboard is capped and centred: ' + JSON.stringify(kb));
    if (h === 844 && w === 390) console.log(await ev('JSON.stringify([...document.querySelectorAll("main section > *, main section [data-slot] > *")].map((e) => [e.className || e.tagName, Math.round(e.getBoundingClientRect().top), Math.round(e.getBoundingClientRect().height)]))'));
    if (h >= 844) ok(await ev('document.documentElement.scrollHeight <= innerHeight + 1'), 'no scrolling needed to reach the keyboard at ' + w + 'x' + h + ': ' + await ev('document.documentElement.scrollHeight + " vs " + innerHeight + " kb " + JSON.stringify(document.querySelector(".keyboard").getBoundingClientRect())'));
    ok(kb.y >= skip.y + skip.h - 0.5, 'the keyboard is below Skip at ' + w + 'x' + h + ': ' + JSON.stringify({ kb, skip }));
    for (const L of ['Q', 'P', 'I']) {
      await ev('document.querySelector(".key[data-letter=' + L + ']").scrollIntoView({ block: "end" })');
      await ev('document.querySelector(".key[data-letter=' + L + ']").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))');
      const pop = await rect('.keypop');
      const hit = async (sel) => ev('(() => { const a = document.querySelector(".keypop").getBoundingClientRect(), b = document.querySelector(' + q(sel) + ').getBoundingClientRect(); return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom); })()');
      for (const sel of ['[data-skip]', '[data-peekbtn]', '[data-hear]']) ok(!await hit(sel), 'the pop-up for ' + L + ' covers ' + sel + ' at ' + w + 'x' + h + ' (pop ' + JSON.stringify(pop) + ')');
      if (L === 'P' && (h === 844 || w === 768)) { await ev('window.scrollTo(0, 0)'); await shot('child-practice-topkey-' + w + 'x' + h); }
      await ev('document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }))');
      await sleep(160);
    }
  }
  await width(390, 900);
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
  t('earth', plus(2), { source: 'x' });
  t('earth', plus(2), { source: 'x' });
  d = W.addSkip(d, { id: 'k1', group: 'g1', word: 'heart', day: plus(2), flow: 'x', now: Date.parse(plus(2) + 'T11:00:00') });
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
  ok(/Come back to this: heart/.test(t), 'the skipped word');
  ok(/2\/3/.test(await text('[data-report="g1"] tbody tr:nth-child(2) [data-inarow]')), 'earth at 2/3');
  ok(/3 times in a row before it counts/.test(t), 'how a word counts');
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
  await until('/That child isn.t on your account/.test(document.querySelector("main").innerText)', 'refused');
  ok(await has('[data-problem="no-child"] a[href="#/grownups"]'), 'back to the list');
  await allViews('grownups-no-child');

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

// Pick up a plan as far as the preview.
async function toPreview(word) {
  await go('#/grownups/child/' + CHILD + '/plan');
  await until('document.querySelector(".picker input[value=guard]")', 'the plan form');
  await click('.picker input[value=' + word + ']');
  await sleep(30);
  await click('[data-preview]');
  await until('document.querySelector("[data-save]")', 'the preview');
}
const childGroups = () => W.liveGroups(W.normalise(acct.data.get(CHILD).get('spellbright/words').value));

scene('grown-ups: when things go wrong', async () => {
  await seedAdult();
  await until('document.querySelector("a[href=\\"#/grownups\\"]")', 'home');
  step('409: the child saved first');
  await toPreview('guard');
  const newer = W.addTry(W.normalise(acct.data.get(CHILD).get('spellbright/words').value), { id: 'late', word: 'earth', day: plus(2), group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, now: Date.parse(plus(2) + 'T09:30:00') });
  const realFetch = acct.fetch;
  let raced = false; // the child's device saves between the page's read and its write
  acct.fetch = async (url, init) => {
    if (init.method === 'PUT' && String(url).includes('/api/children/') && !raced) { raced = true; acct.put(CHILD, 'spellbright', 'words', newer); }
    return realFetch(url, init);
  };
  await click('[data-save]');
  await until('document.querySelector("#toast").classList.contains("show") && /Updated with the latest/.test(document.querySelector("#toast").textContent)', 'Updated with the latest');
  acct.fetch = realFetch;
  ok(raced, 'the 409 really happened');
  await until('document.querySelector("[data-print]")', 'the dashboard');
  const after = W.normalise(acct.data.get(CHILD).get('spellbright/words').value);
  ok(after.results.some((x) => x.id === 'late'), 'the child\'s try is still there');
  ok(childGroups().length === 2, 'and the plan');

  step('network: nothing half-saved, then try again');
  await toPreview('heard');
  const before = JSON.stringify(acct.data.get(CHILD).get('spellbright/words'));
  netDown = true;
  acct.offline = true;
  await click('[data-save]');
  await until('/can.t reach Waystead/.test(document.querySelector("[data-savenote]").innerText)', 'a kind message');
  ok(/Nothing has been saved/.test(await text('[data-savenote]')), 'says nothing was saved');
  ok(JSON.stringify(acct.data.get(CHILD).get('spellbright/words')) === before, 'nothing half-saved');
  await allViews('grownups-network');
  acct.offline = false;
  await click('[data-save]');
  await until('document.querySelector("[data-print]")', 'saved on the second go');
  ok(childGroups().length === 3, 'exactly one more plan');

  step('network while loading: try again');
  acct.offline = true;
  await go('#/grownups');
  await until('document.querySelector("[data-retry]")', 'the retry');
  ok(!/Add a child/.test(await text()), 'a failure doesn\'t look like no children');
  acct.offline = false;
  await click('[data-retry]');
  await until('document.querySelector("[data-child]")', 'the list back');
  await sleep(100);
  netDown = false;

  step('403: switched to playing as a child in another tab');
  acct.who = { ...adultMe, playingAs: { id: CHILD, nickname: 'Robin', year: 4, avatar: null } };
  await click('[data-child="' + CHILD + '"] a[href$="/plan"]');
  await until('document.querySelector("[data-playing]")', 'the switch-back card');
  ok(/You.re playing as Robin\. Switch back to yourself to plan and see progress/.test(await text()), 'names the child');
  acct.who = adultMe;
});

scene('story review', async () => {
  storiesHidden = true;
  try { await storyReview(); } finally { storiesHidden = false; }
});
async function storyReview() {
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
}

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
  step('an adult playing as a child: the switch-back card, and no data asked for');
  acct.who = { ...adultMe, playingAs: { id: CHILD, nickname: 'Robin', year: 4, avatar: null } };
  acct.calls.length = 0;
  for (const p of ['#/grownups', '#/grownups/stories', '#/grownups/child/' + CHILD, '#/grownups/child/' + CHILD + '/plan']) {
    await open(MON, p);
    await until('document.querySelector("[data-playing]")', 'the card at ' + p);
  }
  ok(/You.re playing as Robin/.test(await text()), 'names the child');
  const back = await ev('document.querySelector("[data-switchback]").href');
  ok(back.startsWith('http://localhost:3000/play?return=') && decodeURIComponent(back).endsWith('#/grownups/child/' + CHILD + '/plan'), 'back to this page: ' + back);
  ok(!acct.calls.some((c) => c.path.startsWith('/api/children')), 'no child data asked for');
  await allViews('grownups-playing');
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
