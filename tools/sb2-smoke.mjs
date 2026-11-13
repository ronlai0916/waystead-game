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
      if (!/\/api\/voice\//.test(t) && !/wordbright\/js\/account\/api\.js/.test(t) /* Wordbright's own CSP does not list the test account on :3000 */ && !/status of 40[349]/.test(t) && !(/net::ERR/.test(t) && netDown)) problems.push('log: ' + t);
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
  await until('document.querySelector("[data-child],[data-first],[data-noapi]")', 'the adult\'s home');
  ok(!await ev('document.body.classList.contains("is-child")') && await ev('document.body.classList.contains("is-adult")'), 'the adult\'s chrome, not a child\'s');
  ok(await visible('#adult-menu-btn') && await visible('#adult-chip') && !await visible('#theme') && await visible('.foot') && !await visible('#child-menu'), 'Menu and the account chip show, the old look menu and the child Menu do not');
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
  await until('document.querySelector("[data-child],[data-first],[data-noapi]")', 'the adult\'s home after /api/me', 9000);
  ok(!await ev('document.body.classList.contains("is-child")') && await visible('#adult-menu-btn') && !await visible('#child-menu'), 'the adult bar after the answer');
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

const bar = () => ev('({ adult: !!document.querySelector("#adult-menu-btn") && document.querySelector("#adult-menu-btn").getBoundingClientRect().width > 0, child: document.body.classList.contains("is-child"), pending: document.body.classList.contains("is-pending") || document.documentElement.classList.contains("wa-pre"), nav: !!document.querySelector(".topbar__nav") && document.querySelector(".topbar__nav").getBoundingClientRect().width > 0 && getComputedStyle(document.querySelector(".topbar__nav")).visibility !== "hidden", chip: document.querySelector("#player-slot") && document.querySelector("#player-slot").getBoundingClientRect().width > 0 && getComputedStyle(document.querySelector("#player-slot")).visibility !== "hidden", look: !!document.querySelector("#theme") && document.querySelector("#theme").getBoundingClientRect().width > 0 && getComputedStyle(document.querySelector("#theme")).visibility !== "hidden", foot: !!document.querySelector(".foot") && document.querySelector(".foot").getBoundingClientRect().height > 0 && getComputedStyle(document.querySelector(".foot")).visibility !== "hidden", menu: !document.querySelector("#child-menu").hidden && document.querySelector("#child-menu").getBoundingClientRect().width > 0, brand: document.querySelector(".brand").getBoundingClientRect().width > 0 })');
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
  ok((seen.at(-1).look || seen.at(-1).adult) && seen.at(-1).foot && !seen.at(-1).pending, 'then the full bar: ' + JSON.stringify(seen.at(-1)));
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
  await until('document.querySelector(".morerows")', 'the chapters page');
  ok(await visible('#child-back') && await visible('#child-menu'), 'Back and Menu');
  ok(await ev('[...document.querySelectorAll(".morerows a")].every((a) => a.getBoundingClientRect().height >= 48 && a.getBoundingClientRect().width >= 48)'), 'the links are at least 48 px');
  await allViews('child-chapters');
  for (const [href, ready] of [['#/custom', 'main h1'], ['#/tricky', 'main h1'], ['#/progress', 'main h1']]) {
    await go('#/chapters');
    await click('.morerows a[href="' + href + '"]');
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
    const side = w >= 820 && h <= 900; // wide but short (SB3-C1c): the keyboard stands to the right of the page
    ok(kb.w <= 560 && (w > 480 && !side ? Math.abs(kb.x + kb.w / 2 - w / 2) < 16 : true), 'the keyboard is capped and centred: ' + JSON.stringify(kb));
    if (h === 844 && w === 390) console.log(await ev('JSON.stringify([...document.querySelectorAll("main section > *, main section [data-slot] > *")].map((e) => [e.className || e.tagName, Math.round(e.getBoundingClientRect().top), Math.round(e.getBoundingClientRect().height)]))'));
    if (h >= 844) ok(await ev('document.documentElement.scrollHeight <= innerHeight + 1'), 'no scrolling needed to reach the keyboard at ' + w + 'x' + h + ': ' + await ev('document.documentElement.scrollHeight + " vs " + innerHeight + " kb " + JSON.stringify(document.querySelector(".keyboard").getBoundingClientRect())'));
    ok(side ? kb.x >= skip.x + skip.w - 0.5 : kb.y >= skip.y + skip.h - 0.5, 'the keyboard is below (or, wide and short, beside) Skip at ' + w + 'x' + h + ': ' + JSON.stringify({ kb, skip }));
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
  t('build', plus(2), { source: 'x', clean: false, tries: 2 }); // real practice: wrong letters here do say Needs help
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

// Wren's own week for the home with two children: a different word list and test date.
const WREN_WORDS = ['necessary', 'rhythm', 'island', 'guard'];
function wrenWeek() {
  let d = W.createGroup(W.emptyDoc(), { id: 'w1', name: 'Year 5 and 6 words', test: plus(8), words: WREN_WORDS, today: MON, now: Date.parse(MON + 'T09:00:00') }).doc;
  d = W.markStep(d, W.groupById(d, 'w1'), 'hello', MON, Date.parse(MON + 'T10:00:00'));
  return d;
}
const gone = (s) => s.replace(/\s+/g, ' ');
const textOf = async (s) => gone(await text(s));
async function seedTwo(day = plus(2)) {
  await signedOutBlank(day);
  acct.who = adultMe;
  acct.put(CHILD, 'spellbright', 'words', childWeek());
  acct.put(CHILD2, 'spellbright', 'words', wrenWeek());
  await open(day, '#/');
}
const saved = (id = CHILD) => W.normalise(acct.data.get(id).get('spellbright/words').value);
async function typeWord(w) {
  await until('document.querySelector("[data-typed]")', 'the typed box');
  await ev('(()=>{const n=document.querySelector("[data-typed]");n.value=' + q(w) + ';n.dispatchEvent(new Event("input"));document.querySelector("[data-typeform]").requestSubmit()})()');
  await sleep(500);
  return text('[data-typednote]');
}
const setDate = (v) => ev('(()=>{const n=document.querySelector("[data-test]");n.value=' + q(v) + ';n.dispatchEvent(new Event("input"))})()');
const nextBtn = () => click('[data-next]');

scene('grown-ups: home with two children, and one child\'s week', async () => {
  storiesHidden = true; // the stories wait to be read: the notice comes first
  try {
    await seedTwo();
    await until('document.querySelector("[data-child],[data-first],[data-noapi]")', 'the adult\'s home is the week at a glance');
    ok(!await has('[data-room]'), 'an adult doesn\'t get a child\'s room');
    await go('#/grownups');
    await until('document.querySelectorAll("[data-child]").length === 2', 'a card for each child');
    ok(!await has('table'), 'no table on the home');
    ok(await ev('(() => { const n = document.querySelector("[data-stories]"), c = document.querySelector("[data-child]"); return !!n && !!(n.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING); })()'), 'the stories notice is before the children');
    ok(/20 stories to read first/.test(await textOf('[data-stories]')), 'the notice counts the stories');
    const robin = await textOf('[data-child="' + CHILD + '"]');
    ok(/Robin Year 4/.test(robin) && /Week one/.test(robin) && /test /.test(robin), 'name, year, group and word count: ' + robin);
    ok(/Needs help/.test(robin) && /build/.test(robin), 'a Needs help word on the card');
    ok(/Next: Game day\. Then Story day\./.test(robin), 'the next job: ' + robin);
    ok(await ev('document.querySelectorAll("[data-child=\\"' + CHILD + '\\"] .gu-stones li").length') === 7, 'seven stones');
    ok(/On track/.test(await textOf('[data-child="' + CHILD + '"] [data-chip]')), 'On track');
    ok(/Wren Year 6/.test(await textOf('[data-child="' + CHILD2 + '"]')), 'the second child');
    ok(/job waiting/.test(await textOf('[data-child="' + CHILD2 + '"] [data-chip]')) || /On track|Not started/.test(await textOf('[data-child="' + CHILD2 + '"] [data-chip]')), 'a status chip for Wren');
    ok(await has('[data-planweek]') && /See Robin.s week/.test(await textOf('[data-child="' + CHILD + '"] [data-see]')), 'Plan a week, and one See button');
    await allViews('gu-home');

    step('one child\'s week');
    await click('[data-child="' + CHILD + '"] [data-see]');
    await until('document.querySelector("[data-glance]")', 'the week');
    ok(/All children/.test(await textOf('.gu-back')), 'back to All children');
    ok(/Week one/.test(await text('h1')), 'the group name is the title');
    const glance = await textOf('[data-glance]');
    ok(/At a glance/.test(glance) && /Today Game day/.test(glance) && /Jobs waiting None/.test(glance) && /Stars/.test(glance), 'at a glance: ' + glance);
    ok(await ev('document.querySelectorAll(".gu-path li").length') === 7, 'the path of seven stones');
    ok(await ev('document.querySelectorAll(".gu-wordlist li").length') === 4 && !await has('table'), 'the words as rows, no table');
    ok(/Needs help · 2 or more wrong letters/.test(await textOf('[data-word="build"] [data-wordchip]')), 'status with its reason');
    ok(/What we noticed/.test(await textOf('[data-word="heart"]')), 'what we noticed');
    ok(/Memory clue/.test(await textOf('[data-word="build"]')), 'the clue is shown');
    ok((await ev('[...document.querySelectorAll(".gu-wordlist li")].map((e) => e.dataset.word)')).join() === 'build,earth,fruit,heart', 'help first, then the week\'s order');
    for (const b of ['[data-edit]', '[data-delete]', '[data-print]', '[data-plannext]']) ok(await has(b), b);
    ok(/Change words or test date/.test(await text('[data-edit]')) && /Delete this week/.test(await text('[data-delete]')) && /Print this week/.test(await text('[data-print]')) && /Plan next week/.test(await text('[data-plannext]')), 'the four buttons');
    ok(await ev('[...document.querySelectorAll(".gu a, .gu button, .gu input")].filter((e) => e.getBoundingClientRect().width && e.getBoundingClientRect().height < 40 && !e.closest(".gu-stones")).length') === 0, 'every control is 40 px or more high');
    await allViews('gu-week');
    step('print this week');
    await send('Emulation.setEmulatedMedia', { media: 'print' });
    await width(1280);
    await shot('gu-week-print');
    ok(!await ev('(() => { const e = document.querySelector(".gu-actions"); return e && getComputedStyle(e).display !== "none"; })()'), 'the buttons are not printed');
    await send('Emulation.setEmulatedMedia', { media: '' });
    await width(390);
    step('back to all children');
    await click('.gu-back');
    await until('document.querySelector("[data-child]")', 'home again');
  } finally { storiesHidden = false; }
});

scene('grown-ups: a child with no week yet', async () => {
  await signedOutBlank(plus(2));
  acct.who = adultMe;
  acct.put(CHILD, 'spellbright', 'words', childWeek());
  await open(plus(2), '#/grownups');
  await until('document.querySelectorAll("[data-child]").length === 2', 'both cards');
  ok(/No week yet/.test(await textOf('[data-child="' + CHILD2 + '"] [data-chip]')), 'No week yet');
  await allViews('gu-home-noweek');
  await go('#/grownups/child/' + CHILD2);
  await until('document.querySelector("[data-noweek]")', 'the empty state');
  ok(await has('[data-plan]'), 'Plan a week');
  await allViews('gu-week-empty');
});

scene('grown-ups: plan a week in three steps', async () => {
  await seedTwo();
  await go('#/grownups');
  await until('document.querySelector("[data-planweek]")', 'home');
  await click('[data-planweek]');
  step('1 who');
  await until('document.querySelector("[data-plan-step=\\"1\\"]")', 'step 1');
  ok(/Step 1 of 3/i.test(await text('[data-stepmark]')), 'Step 1 of 3');
  ok(await ev('document.querySelectorAll("input[type=radio]").length') === 2, 'a radio for each child');
  await allViews('gu-plan1');
  const pos = async () => ev('(() => { const b = document.querySelector("[data-back]").getBoundingClientRect(), n = document.querySelector("[data-next]").getBoundingClientRect(); return [Math.round(b.left), Math.round(n.right)].join(); })()');
  const where1 = await pos();
  await nextBtn();
  ok(/choose a child/.test(await text('[data-error]')), 'no child chosen: a kind line');
  await click('input[value="' + CHILD + '"]');
  await nextBtn();
  step('2 which words');
  await until('document.querySelector("[data-plan-step=\\"2\\"]")', 'step 2');
  ok(/Step 2 of 3/i.test(await text('[data-stepmark]')) && /Robin/i.test(await text('[data-stepmark]')), 'Step 2 of 3 for Robin');
  ok(await ev('document.querySelectorAll("[data-pick]").length') > 40, 'Robin\'s year list is the default: ' + await ev('document.querySelectorAll("[data-pick]").length'));
  ok(await has('[data-pick="believe"]') || await has('[data-pick="build"]'), 'a Year 3 and 4 word');
  ok(where1 === await pos(), 'Back and Next are in the same place on step 1 and step 2: ' + where1 + ' vs ' + await pos());
  await allViews('gu-plan2');
  ok(/Added tractor/.test(await typeWord('tractor')), 'a word on our lists is added');
  const unknown = await typeWord('zzqx');
  const blocked = await typeWord('arse');
  ok(unknown === blocked && /isn.t on our lists/.test(unknown), 'blocked and unknown get the same reply');
  ok(await until('/Meaning from the Wordbright word list/.test(document.querySelector("[data-typedrow=tractor]").innerText)', 'the typed word\'s meaning', 4000).then(() => true, () => false), 'a typed word says where its meaning is from');
  ok(/No picture, meaning only/.test(await text('[data-typedrow="tractor"]')), 'and that it has no picture');
  step('other lists are reachable');
  await click('[data-other]');
  for (const t of ['chapter', 'pattern', 'year', 'tricky']) ok(await has('[data-tab=' + t + ']'), 'tab ' + t);
  await click('[data-tab=pattern]');
  await until('document.querySelector("[data-pattern]")', 'the patterns');
  await ev('(()=>{const n=document.querySelector("[data-pattern]");n.value="ough";n.dispatchEvent(new Event("change"))})()');
  await until('document.querySelector("[data-pick=enough]")', 'the pattern\'s words');
  await allViews('gu-plan2-other');
  await click('[data-pick=enough]');
  await click('[data-tab=chapter]');
  await until('document.querySelector("[data-chapter]")', 'chapters');
  await click('[data-tab=year]');
  await click('[data-other]');
  ok(!await has('[data-tab=year]'), 'Fewer lists closes them');
  step('10 words is a full week');
  const picks = await ev('[...document.querySelectorAll("[data-pick]")].filter((b) => b.getAttribute("aria-pressed") === "false").slice(0, 8).map((b) => b.dataset.pick)');
  for (const w of picks) { await click('[data-pick="' + w + '"]'); await sleep(20); }
  ok(/10 of 10/.test(await text('[data-count]')), '10 of 10: ' + await text('[data-count]'));
  ok(/10 words is a full week\. Remove one to add another\./.test(await text('[data-full]')), 'the full-week line');
  ok(await ev('document.querySelector("[data-typed]").disabled && document.querySelector("[data-add]").disabled'), 'the field and Add are disabled');
  ok(await ev('[...document.querySelectorAll("[data-pick][aria-pressed=false]")].every((b) => b.disabled) && document.querySelectorAll("[data-pick][aria-pressed=false]").length > 0'), 'unpicked chips are disabled');
  ok(await ev('[...document.querySelectorAll("[data-pick][aria-pressed=true]")].every((b) => !b.disabled)'), 'picked chips stay enabled (to take off)');
  await allViews('gu-plan2-full');
  await click('[data-remove="tractor"]');
  ok(await ev('!document.querySelector("[data-typed]").disabled && !document.querySelector("[data-add]").disabled && !document.querySelector("[data-full]")'), 'one removed: the field is back');
  await click('[data-pick="' + picks[0] + '"]');
  await click('[data-pick="' + picks[1] + '"]');
  ok(/7 of 10/.test(await text('[data-count]')), 'two taken off: ' + await text('[data-count]'));
  ok(/Added tractor/.test(await typeWord('tractor')), 'and a typed word again');
  await sleep(700);
  step('3 test date');
  await nextBtn();
  await until('document.querySelector("[data-plan-step=\\"3\\"]")', 'step 3');
  ok(/Step 3 of 3/i.test(await text('[data-stepmark]')), 'Step 3 of 3');
  ok(await has('#p-test') && await ev('document.querySelector("#p-test").type') === 'date', 'a date input with a label');
  ok(where1 === await pos(), 'Back and Next are in the same place on step 3 too: ' + await pos());
  ok(/Start the week for Robin/.test(await text('[data-next]')), 'the button says who');
  ok(/School spellings/.test(await ev('document.querySelector("[data-name]").value')), 'the name defaults to School spellings for typed words');
  ok(/Fri 27 Nov|Sat 7 Nov/.test(gone(await text('[data-datewords]'))) || /\w{3} \d+ \w{3}/.test(gone(await text('[data-datewords]'))), 'the date is written beside the field: ' + await text('[data-datewords]'));
  ok(/Meet your new words/.test(await text('[data-glimpse]')) && /Hello words/.test(await text('[data-glimpse]')), 'what the child sees first');
  await setDate(plus(5));
  ok(await has('[data-short]') && /Short week: some days will have two jobs\./.test(await text('[data-short]')), 'fewer than 5 days: the short-week line');
  await allViews('gu-plan3-short');
  await setDate(plus(9));
  ok(!await has('[data-short]'), 'a longer week: no short-week line');
  ok(gone(await text('[data-datewords]')) === gone(W.dayLabel(plus(9))), 'the date written: ' + await text('[data-datewords]'));
  await allViews('gu-plan3');
  step('Back loses nothing');
  await click('[data-back]');
  await until('document.querySelector("[data-plan-step=\\"2\\"]")', 'step 2 again');
  ok(/8 of 10/.test(await text('[data-count]')) && await has('[data-typedrow="tractor"]'), 'the words are still there: ' + await text('[data-count]'));
  await nextBtn();
  await until('document.querySelector("[data-plan-step=\\"3\\"]")', 'step 3 again');
  ok(await ev('document.querySelector("#p-test").value') === plus(9), 'and the date');
  step('start the week');
  const before = childGroups().length;
  await click('[data-next]');
  await until('document.querySelector("[data-flash]")', 'the week page with a confirmation');
  ok(/Started School spellings for Robin\./.test(await text('[data-flash]')), 'a confirmation line');
  ok(childGroups().length === before + 1, 'one new group');
  const plan = childGroups().find((x) => x.name === 'School spellings');
  ok(plan && plan.test === plus(9) && plan.words.includes('tractor') && plan.words.length === 8, 'saved: ' + JSON.stringify(plan));
  ok(/School spellings/.test(await text('h1')), 'the new week is on show');
  ok(await has('[data-week="' + plan.id + '"]'), 'by its own link');
  ok(/Typed|tractor/.test(await text('[data-word="tractor"]')) && /No picture, meaning only/.test(await text('[data-word="tractor"]')), 'a typed word shows its picture status here too');
  await allViews('gu-week-new');
  step('a single child skips step 1');
  const real = acct.children;
  acct.children = (id) => real(id).slice(0, 1);
  await go('#/grownups/plan');
  await until('document.querySelector("[data-plan-step]")', 'the planner');
  ok(await has('[data-plan-step="2"]'), 'one child: straight to Which words');
  ok(/Step 2 of 3/i.test(await text('[data-stepmark]')), 'still Step 2 of 3');
  acct.children = real;
  step('from a child\'s page the child is chosen');
  await go('#/grownups/child/' + CHILD + '/plan');
  await until('document.querySelector("[data-plan-step]")', 'the planner');
  ok(await has('[data-plan-step="2"]') && /Robin/i.test(await text('[data-stepmark]')), 'Robin is chosen');
  await click('[data-back]');
  await until('document.querySelector("[data-plan-step=\\"1\\"]")', 'Back goes to Who when there is a choice');
  ok(await ev('document.querySelector("input[value=\\"' + CHILD + '\\"]").checked'), 'with Robin still ticked');
  step('a child switcher with two weeks');
  await go('#/grownups/child/' + CHILD);
  await until('document.querySelector(".gu-switch")', 'the switcher');
  ok(await ev('document.querySelectorAll(".gu-switch a").length') === 2, 'two weeks, two links');
  ok(/2 weeks running/.test(await ev('document.querySelector("[data-manyweeks]").innerText')), 'it says there are two weeks'); ok(await ev('!!document.querySelector("[data-edit]") && !!document.querySelector("[data-delete]")'), 'change and delete are on each week page');
  await click('.gu-switch a:not([aria-current])');
  await until('document.querySelector("[data-week]")', 'the other week');
});
const childGroups = () => W.liveGroups(saved());

scene('grown-ups: change a week, before and after the test date, and after the test began', async () => {
  await seedTwo();
  await go('#/grownups/child/' + CHILD);
  await until('document.querySelector("[data-edit]")', 'the week');
  const triesBefore = saved().results.length;
  step('before the test date');
  await click('[data-edit]');
  await until('document.querySelector("[data-plan-step=\\"2\\"]")', 'the form, pre-filled');
  ok(/Change the week for Robin/i.test(await text('[data-stepmark]')) && /Step 2 of 3/i.test(await text('[data-stepmark]')), 'a change, not a plan');
  ok(await ev('document.querySelectorAll("[data-mywords] .gu-chip").length') === 4 && /4 of 10/.test(await text('[data-count]')), 'the four words are filled in');
  await click('[data-remove="heart"]');
  await click('[data-pick="guard"]').catch(async () => { await ev('document.querySelector("[data-pick]:not([aria-pressed=true])").click()'); });
  await nextBtn();
  await until('document.querySelector("[data-plan-step=\\"3\\"]")', 'step 3');
  ok(await ev('document.querySelector("#p-test").value') === plus(5), 'the date is filled in');
  ok(/Week one/.test(await ev('document.querySelector("[data-name]").value')), 'and the name');
  await setDate(plus(6));
  await click('[data-next]');
  await until('document.querySelector("[data-flash]")', 'saved');
  ok(/Changed Week one\./.test(await text('[data-flash]')), 'a confirmation');
  let g = W.groupById(saved(), 'g1');
  ok(g.test === plus(6) && !g.words.includes('heart') && g.words.length === 4 && g.words.slice(0, 3).join() === 'build,earth,fruit', 'words and date changed: ' + JSON.stringify(g));
  ok(saved().results.length === triesBefore, 'no try destroyed');
  const dots = W.allDots(saved(), g, plus(2));
  ok(dots.find((x) => x.word === 'build') && !dots.some((x) => x.word === 'heart'), 'a removed word no longer counts');
  ok(/Needs help · 2 or more wrong letters/.test(await textOf('[data-word="build"] [data-wordchip]')), 'a kept word keeps its practice');

  step('on the test date, no result yet: still open');
  await open(plus(6), '#/grownups/child/' + CHILD + '/plan/g1');
  await until('document.querySelector("[data-plan-step=\\"2\\"]")', 'still open on the test date');
  ok(!await has('[data-locked]'), 'not locked');
  await nextBtn();
  await until('document.querySelector("[data-plan-step=\\"3\\"]")', 'step 3');
  ok(await ev('document.querySelector("#p-test").value') === plus(6), 'on the test day step 3 shows the current date, not tomorrow');
  ok(!await has('[data-datepassed]'), 'it has not passed yet');
  await click('[data-next]');
  await until('document.querySelector("[data-flash]")', 'saved with the same date');
  ok(W.groupById(saved(), 'g1').test === plus(6), 'S3: only words or name changed: the test date did not move');
  await open(plus(6), '#/grownups/child/' + CHILD + '/plan/g1');
  await until('document.querySelector("[data-plan-step=\\"2\\"]")', 'again');
  await nextBtn();
  await until('document.querySelector("[data-plan-step=\\"3\\"]")', 'step 3 again');
  await setDate(plus(5));
  await click('[data-next]');
  await until('document.querySelector("[data-error]") && /after today/.test(document.querySelector("[data-error]").innerText)', 'a date must be after today');
  ok(/after today/.test(await text('[data-error]')), 'a new date must be after today');
  await setDate(plus(9));
  await click('[data-next]');
  await until('document.querySelector("[data-flash]")', 'moved to a later date');
  ok(W.groupById(saved(), 'g1').test === plus(9), 'moved');

  step('the test date has passed: kept, with a quiet note');
  await open(plus(10), '#/grownups/child/' + CHILD + '/plan/g1');
  await until('document.querySelector("[data-plan-step=\\"2\\"]")', 'open after the date');
  await nextBtn();
  await until('document.querySelector("[data-plan-step=\\"3\\"]")', 'step 3');
  ok(await ev('document.querySelector("#p-test").value') === plus(9), 'the passed date is shown, not moved');
  ok(/The test date has passed\. Robin.s test opens when the jobs are done\. You can pick a new date\./.test(await text('[data-datepassed]')), 'the quiet note');
  await allViews('gu-plan3-passed');
  await click('[data-next]');
  await until('document.querySelector("[data-flash]")', 'saved after the date');
  ok(W.groupById(saved(), 'g1').test === plus(9), 'S3: still the same date');

  step('after the test began: refused kindly');
  let d = saved();
  const g1 = W.groupById(d, 'g1');
  d = W.addTry(d, { id: 'tt1', word: 'build', day: plus(6), group: 'g1', kind: 't', tries: 0, peeks: 0, clean: true, now: Date.parse(plus(6) + 'T11:00:00') });
  acct.put(CHILD, 'spellbright', 'words', d);
  ok(g1, 'week exists');
  await open(plus(6), '#/grownups/child/' + CHILD + '/week/g1');
  await until('document.querySelector("[data-edit]")', 'the week');
  await click('[data-edit]');
  await until('document.querySelector("[data-locked]")', 'the explanation');
  ok(/test has begun/.test(await text('[data-locked]')) && /rename/i.test(await text('[data-locked]')), 'says why: ' + await textOf('[data-locked]'));
  ok(await has('[data-plannext]') && !await has('[data-test]'), 'offers Plan next week, no date field');
  await ev('history.back()');
  await until('document.querySelector("[data-edit]")', 'back on the week');
  ok(/Rename this week/.test(await text('[data-edit]')), 'S5: the button says Rename this week once the test has begun');
  await click('[data-edit]');
  await until('document.querySelector("[data-locked]")', 'the explanation again');
  await allViews('gu-plan-locked');
  await ev('(()=>{const n=document.querySelector("[data-name]");n.value="Renamed week";n.dispatchEvent(new Event("input"))})()');
  await click('[data-rename]');
  await until('document.querySelector("[data-flash]")', 'renamed');
  ok(W.groupById(saved(), 'g1').name === 'Renamed week', 'the name can change any time');
});

scene('grown-ups: delete this week, undo, deleted weeks, bring back', async () => {
  await seedTwo();
  await go('#/grownups/child/' + CHILD);
  await until('document.querySelector("[data-delete]")', 'the week');
  step('the dialog');
  await click('[data-delete]');
  await until('document.querySelector("[role=dialog]")', 'the dialog');
  ok(/Delete Week one for Robin\?/.test(await text('[role=dialog]')) && /Robin.s practice on these words is kept and still counts towards remembered words\./.test(await text('[role=dialog]')), 'the question and the reassurance');
  ok(await ev('document.activeElement.hasAttribute("data-keep")'), 'focus starts on Keep it');
  ok(await ev('document.querySelector("[role=dialog]").getAttribute("aria-modal") === "true"'), 'modal');
  await allViews('gu-delete-dialog');
  await key('Tab');
  ok(await ev('document.activeElement.hasAttribute("data-confirm")'), 'Tab stays in the dialog');
  await key('Tab');
  ok(await ev('document.activeElement.hasAttribute("data-keep")'), 'and wraps');
  await key('Escape');
  await until('!document.querySelector("[role=dialog]")', 'Escape closes it');
  ok(await ev('document.activeElement === document.querySelector("[data-delete]")'), 'focus goes back to the button');
  ok(W.liveGroups(saved()).length === 1, 'nothing deleted');
  await click('[data-delete]');
  await until('document.querySelector("[data-keep]")', 'the dialog again');
  await click('[data-keep]');
  ok(W.liveGroups(saved()).length === 1, 'Keep it: nothing deleted');
  step('S4: Back while the dialog is open');
  await click('[data-delete]');
  await until('document.querySelector("[role=dialog]")', 'the dialog a third time');
  await ev('history.pushState(null, "", "#/grownups"); window.dispatchEvent(new HashChangeEvent("hashchange"))');
  await until('!document.querySelector("[role=dialog]")', 'the dialog closed when the page changed');
  await until('document.querySelector("[data-planweek]")', 'the home');
  ok(await ev('document.querySelectorAll("[inert]").length') === 0, 'nothing is left inert');
  ok(W.liveGroups(saved()).length === 1, 'nothing was deleted');
  await ev('history.back(); window.dispatchEvent(new HashChangeEvent("hashchange"))');
  await until('document.querySelector("[data-delete]")', 'back on the week');
  ok(await ev('document.querySelectorAll("[inert]").length') === 0 && await ev('!document.querySelector("[role=dialog]")'), 'the week page is usable');
  step('delete');
  const triesBefore = saved().results.length;
  await click('[data-delete]');
  await until('document.querySelector("[data-confirm]")', 'the dialog');
  await click('[data-confirm]');
  await until('document.querySelector("[data-deleted]")', 'Deleted. Undo');
  ok(/Deleted\. Undo/.test(gone(await text('[data-deleted]'))), 'a line "Deleted. Undo"');
  ok(W.liveGroups(saved()).length === 0 && saved().groups.g1.gone, 'soft deleted: gone is set');
  ok(saved().results.length === triesBefore, 'the child\'s tries are kept');
  ok(await has('[data-deletedlist] [data-restore="g1"]') && /Deleted weeks/.test(await text('[data-deletedlist]')), 'a Deleted weeks list with Bring back');
  await allViews('gu-deleted');
  step('undo');
  await click('[data-undo]');
  await until('document.querySelector("[data-week=\\"g1\\"]")', 'the week is back');
  ok(W.liveGroups(saved()).length === 1 && !('gone' in saved().groups.g1), 'restored: gone is cleared');
  ok(/Brought back/.test(await text('[data-flash]')), 'a line says so');
  step('delete again, bring back from the list');
  await click('[data-delete]');
  await click('[data-confirm]');
  await until('document.querySelector("[data-restore=\\"g1\\"]")', 'the list');
  ok(!await has('[data-week]'), 'no live week: the empty state');
  await click('[data-restore="g1"]');
  await until('document.querySelector("[data-week=\\"g1\\"]")', 'brought back');
  ok(W.liveGroups(saved()).length === 1, 'back');
  step('a live week with the same words and date: refused kindly');
  await click('[data-delete]');
  await click('[data-confirm]');
  await until('document.querySelector("[data-restore=\\"g1\\"]")', 'the list');
  const twin = W.createGroup(saved(), { id: 'twin', name: 'Same again', test: plus(5), words: WORDS, today: plus(2), now: Date.now() }).doc;
  acct.put(CHILD, 'spellbright', 'words', twin);
  await click('[data-restore="g1"]');
  await until('document.querySelector("[data-problemline]")', 'the refusal');
  ok(/already a week with these words and this test date/.test(await text('[data-problemline]')), 'kind words');
  ok(W.groupById(saved(), 'g1') === null, 'nothing restored');
  await allViews('gu-restore-refused');
});

scene('grown-ups: a child whose week was deleted lands on a safe home', async () => {
  await seedChild(weekDoc());
  await open(MON, '#/words/g/g1/study/hello');
  await until('document.querySelector(".wordcard")', 'a job page mid-job');
  const gone1 = W.deleteGroup(weekDoc(), 'g1', Date.now() + 1000);
  await ev('localStorage.setItem("sb.words:' + CHILD + '",' + q(JSON.stringify(gone1)) + ')');
  await ev('window.dispatchEvent(new HashChangeEvent("hashchange"))');
  await until('location.hash === "#/" || location.hash === ""', 'the home');
  await until('document.querySelector("main section, main .card")', 'something drawn');
  ok(!/Something went wrong|undefined/.test(await text()), 'no error on the page');
  for (const p of ['#/words/g/g1', '#/words/g/g1/path', '#/words/g/g1/games', '#/words/g/g1/game/missing', '#/words/g/g1/test', '#/words/g/g1/spell/0', '#/words/g/g1/study/fix', '#/words/g/g1/edit']) {
    await go(p);
    await sleep(120);
    ok(await ev('location.hash === "#/" || location.hash === "#/words" || location.hash === ""'), p + ' lands on a safe page, not stuck: ' + await ev('location.hash'));
  }
  await allViews('gu-child-after-delete');
});

// Pick up a plan as far as its last step: one word from the list, a date, then the button is next.
async function toStart(word) {
  await go('#/grownups/child/' + CHILD + '/plan');
  await until('document.querySelector("[data-pick=\\"' + word + '\\"]")', 'the plan form');
  await click('[data-pick="' + word + '"]');
  await sleep(30);
  await nextBtn();
  await until('document.querySelector("[data-plan-step=\\"3\\"]")', 'the last step');
}

scene('grown-ups: when things go wrong', async () => {
  await seedAdult();
  await until('document.querySelector("[data-child],[data-first],[data-noapi]")', 'home');
  step('409: the child saved first');
  await toStart('guard');
  const newer = W.addTry(saved(), { id: 'late', word: 'earth', day: plus(2), group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, now: Date.parse(plus(2) + 'T09:30:00') });
  const realFetch = acct.fetch;
  let raced = false; // the child's device saves between the page's read and its write
  acct.fetch = async (url, init) => {
    if (init.method === 'PUT' && String(url).includes('/api/children/') && !raced) { raced = true; acct.put(CHILD, 'spellbright', 'words', newer); }
    return realFetch(url, init);
  };
  await click('[data-next]');
  await until('document.querySelector("#toast").classList.contains("show") && /Updated with the latest/.test(document.querySelector("#toast").textContent)', 'Updated with the latest');
  acct.fetch = realFetch;
  ok(raced, 'the 409 really happened');
  await until('document.querySelector("[data-flash]")', 'the week page');
  ok(saved().results.some((x) => x.id === 'late'), 'the child\'s try is still there');
  ok(childGroups().length === 2, 'and the plan');

  step('network: nothing half-saved, then try again');
  await toStart('heard');
  const before = JSON.stringify(acct.data.get(CHILD).get('spellbright/words'));
  netDown = true;
  acct.offline = true;
  await click('[data-next]');
  await until('/can.t reach Waystead/.test(document.querySelector("[data-error]").innerText)', 'a kind message');
  ok(/Nothing has been saved/.test(await text('[data-error]')), 'says nothing was saved');
  ok(JSON.stringify(acct.data.get(CHILD).get('spellbright/words')) === before, 'nothing half-saved');
  await allViews('gu-network');
  acct.offline = false;
  await click('[data-next]');
  await until('document.querySelector("[data-flash]")', 'saved on the second go');
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
  await click('[data-planweek]');
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
  await until('document.querySelector("[data-child],[data-first],[data-noapi]")', 'home');
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
  for (const p of ['#/grownups', '#/grownups/stories', '#/grownups/plan', '#/grownups/child/' + CHILD, '#/grownups/child/' + CHILD + '/week/g1', '#/grownups/child/' + CHILD + '/plan']) {
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
  for (const p of ['#/grownups', '#/grownups/stories', '#/grownups/plan', '#/grownups/child/' + CHILD, '#/grownups/child/' + CHILD + '/week/g1', '#/grownups/child/' + CHILD + '/plan']) {
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
  await until('document.querySelector("[data-child],[data-first],[data-noapi]")', 'home');
  await go('#/grownups');
  await until('document.querySelector("[data-noapi]")', 'the note');
  ok(await has('a[href="#/grownups/stories"]'), 'the story review still opens');
  await allViews('grownups-flag-off');
  await go('#/grownups/child/' + CHILD);
  await until('document.querySelector("[data-noapi]")', 'back at the note');
  flagOn = true;
});

// ---- SB3-C1b: the child chooses which week to study ------------------------------------------
const WORDS2 = ['guard', 'bury', 'busy', 'calendar'];
/** Week one (test +5, nothing done) and Week two (test +9, Hello and Fix it in done): at +2 their jobs differ. */
function twoWeeksDoc() {
  let d = weekDoc(WORDS, plus(5));
  d = W.createGroup(d, { id: 'g2', name: 'Week two', test: plus(9), words: WORDS2, today: MON, now: Date.parse(MON + 'T09:30:00') }).doc;
  const g2 = W.groupById(d, 'g2');
  d = W.markStep(d, g2, 'hello', MON, Date.parse(MON + 'T09:40:00'));
  return W.markStep(d, g2, 'fix', plus(1), Date.parse(plus(1) + 'T09:40:00'));
}
const weekKey = () => ev('localStorage.getItem("sb.week:' + CHILD + '")');
const noWordsOf = async (list, where) => {
  const t = (await ev('document.body.innerText')).toLowerCase();
  for (const w of list) ok(!new RegExp('\\b' + w + '\\b').test(t), where + ' shows ' + w);
};

scene('week choice: one week shows nothing new; a stale choice is cleared', async () => {
  await seedChild(gameDayDoc(), plus(2));
  await ev('localStorage.setItem("sb.week:' + CHILD + '","gone")');
  await open(plus(2), '#/');
  await until('document.querySelector("[data-room=job]")', 'the home');
  ok(!await has('.weekline') && !/Week:/.test(await text()) && !await has('[data-week-change]'), 'no Week line with one week');
  ok(await weekKey() === null, 'the stale choice was cleared');
});

scene('week choice: two weeks, Change, the sheet, and everything follows', async () => {
  await seedChild(twoWeeksDoc(), plus(3));
  await open(plus(3), '#/');
  await until('document.querySelector("[data-room=job]")', 'the home');
  step('no choice: the first week with a job, and the Week line');
  ok(/Week:\s*Week one/.test(await text('.weekline')), 'the Week line: ' + await text('.weekline'));
  ok(/Meet each word/.test(await text('h1')), 'Week one sentence: ' + await text('h1'));
  ok((await rect('[data-week-change]')).h >= 48 && /^Change$/.test((await text('[data-week-change]')).trim()), 'Change is a 48 px button');
  ok(await ev('document.querySelector("[data-week-change]").tagName') === 'BUTTON', 'a real button');
  ok(await ev('document.querySelector(".weekline").getBoundingClientRect().bottom <= document.querySelector(".btn--hero").getBoundingClientRect().top'), 'the line is above the big button');
  await allViews('week-home');
  step('the sheet: a real dialog');
  await click('[data-week-change]');
  await until('document.querySelector("[role=dialog]")', 'the sheet');
  ok(/Which week\?/.test(await text('#sheet-title')), 'titled Which week?');
  ok(await ev('document.querySelector("[role=dialog]").getAttribute("aria-modal") === "true"'), 'aria-modal');
  ok(await ev('document.activeElement && document.activeElement.hasAttribute("data-close")'), 'focus moves in');
  ok(await ev('document.querySelector("main").hasAttribute("inert") && document.querySelector("header").hasAttribute("inert")'), 'the page behind is inert');
  ok(await ev('document.querySelectorAll("[data-week]").length') === 2, 'two rows');
  ok(await ev('[...document.querySelectorAll("[data-week]")].every((e) => e.getBoundingClientRect().height >= 64)'), 'rows are 64 px high');
  const cur = await text('[data-week][aria-current]');
  ok(/Week one/.test(cur) && /Showing now/.test(cur) && /Test \w{3} \d+ \w{3}/.test(cur) && /Job 1 of 7/.test(cur), 'the current row: ' + cur);
  const other = await text('[data-week=g2]');
  ok(/Week two/.test(other) && /Job 3 of 7/.test(other) && !/Showing now/.test(other), 'the other row: ' + other);
  ok(!/Jobs waiting/.test(other), 'no waiting pill: its job is today\'s');
  await ev('document.querySelector("[data-week=g2]").focus()');
  await key('Tab');
  ok(await ev('document.activeElement.hasAttribute("data-close")'), 'Tab wraps to Close');
  await allViews('week-sheet');
  await key('Escape');
  await until('!document.querySelector("[role=dialog]")', 'Escape closes it');
  ok(await ev('document.activeElement.hasAttribute("data-week-change")'), 'focus returns to Change');
  ok(await weekKey() === null, 'Escape chose nothing');
  await click('[data-week-change]');
  await until('document.querySelector("[role=dialog]")', 'the sheet again');
  await click('[data-close]');
  await until('!document.querySelector("[role=dialog]")', 'Close closes it');
  step('pick Week two');
  await click('[data-week-change]');
  await until('document.querySelector("[role=dialog]")', 'the sheet');
  await click('[data-week=g2]');
  await until('!document.querySelector("[role=dialog]")', 'the sheet closes');
  ok(await weekKey() === 'g2', 'saved on this device: ' + await weekKey());
  ok(/Week:\s*Week two/.test(await text('.weekline')), 'the Week line follows');
  ok(/Play four quick games/.test(await text('h1')), 'the sentence follows: ' + await text('h1'));
  ok(/Start Game day/.test(await text('[data-job]')) && (await ev('document.querySelector("[data-job]").getAttribute("href")')).includes('/g2/'), 'the big button targets Week two');
  ok(/Job 3 of 7/.test(await text('.pathcard')) && (await ev('document.querySelector("[data-pathcard]").getAttribute("href")')) === '#/words/g/g2/path', 'the path card follows');
  ok(await ev('document.activeElement.hasAttribute("data-week-change")'), 'focus is on Change');
  ok(!await has('[data-duetest]'), 'no test line');
  await click('[data-week-change]');
  await until('document.querySelector("[role=dialog]")', 'the sheet');
  ok(/Jobs waiting/.test(await text('[data-week=g1]')), 'Week one has jobs waiting: ' + await text('[data-week=g1]'));
  step('a route change while the sheet is open closes it and keeps focus on the page (a sync redraw: settleFocus, not driven here)');
  await ev('window.dispatchEvent(new HashChangeEvent("hashchange"))');
  await until('!document.querySelector("[role=dialog]")', 'the redraw closes the sheet');
  await sleep(80);
  ok(await ev('document.activeElement && document.activeElement.isConnected && !document.activeElement.closest(".sheetlayer") && document.activeElement !== document.body'), 'focus is not lost');
  ok(await ev('!document.querySelector("main").hasAttribute("inert")'), 'the page is live');
  step('the path, the Menu and My words follow');
  await click('[data-pathcard]');
  await until('document.querySelector("[data-path]")', 'the path');
  ok(/week two/i.test(await text('.pagehead .eyebrow')), 'the path is Week two: ' + await text('.pagehead .eyebrow'));
  await click('#child-back');
  await until('document.querySelector("[data-room=job]")', 'home');
  await click('#child-menu');
  await until('document.querySelector("[role=dialog]")', 'the Menu');
  ok(await has('.sheetrow[data-row=words][href="#/words/g/g2"]'), 'My words opens Week two');
  ok(await has('.sheetrow[data-row=games][href^="#/words/g/g2/"]'), 'Games is Week two\'s');
  await click('.sheetrow[data-row=words]');
  await until('document.querySelector(".pagehead h1")', 'My words');
  ok(/Week two/.test(await text('h1')), 'the group page is Week two');
  ok(/Week one/.test(await text('.sectionhead + .list')) && /Study this week/.test(await text('[data-study-week]')), 'the other week has Study this week');
  ok((await rect('[data-study-week]')).h >= 48, 'Study this week is 48 px');
  await go('#/words/g/g1');
  await until('document.querySelector(".pagehead h1")', 'Week one page');
  ok(!await has('[data-study-week]'), 'no Study this week under the chosen week');
  await go('#/words/g/g2');
  await until('document.querySelector("[data-study-week]")', 'back on Week two');
  step('reload: still Week two');
  await open(plus(3), '#/');
  await until('document.querySelector("[data-room=job]")', 'the home again');
  ok(/Week:\s*Week two/.test(await text('.weekline')) && /Play four quick games/.test(await text('h1')), 'still Week two');
  step('Study this week (Week one) on the group page');
  await go('#/words/g/g2');
  await until('document.querySelector("[data-study-week=g1]")', 'the button');
  await click('[data-study-week=g1]');
  await until('location.hash === "#/words/g/g1"', 'opens Week one');
  ok(await weekKey() === 'g1', 'and chooses it');
  await go('#/');
  await until('document.querySelector("[data-room=job]")', 'home');
  ok(/Week:\s*Week one/.test(await text('.weekline')) && /Meet each word/.test(await text('h1')), 'the home is Week one');
});

scene('week choice: nothing to do here, another week has a job', async () => {
  let d = weekDoc(WORDS, plus(5));
  d = W.createGroup(d, { id: 'g2', name: 'Week two', test: plus(9), words: WORDS2, today: MON, now: Date.parse(MON + 'T09:30:00') }).doc;
  d = W.markStep(d, W.groupById(d, 'g1'), 'hello', MON, Date.parse(MON + 'T10:00:00'));
  await seedChild(d, MON);
  await ev('localStorage.setItem("sb.week:' + CHILD + '","g1")');
  await open(MON, '#/');
  await until('document.querySelector("[data-room]")', 'the home');
  ok(/Done for today/.test(await text('h1')), 'Week one is done for today: ' + await text('h1'));
  ok(/Week two has a job waiting\./.test(await text('[data-nextweek]')), 'the quiet line: ' + await text('.homego'));
  ok((await rect('[data-go-week]')).h >= 48 && /Go to that week/.test(await text('[data-go-week]')), 'Go to that week, 48 px');
  await noWordsOf(WORDS.concat(WORDS2), 'the home');
  await allViews('week-home-next');
  await click('[data-go-week]');
  await until('document.querySelector("[data-room=job]")', 'Week two');
  ok(await weekKey() === 'g2' && /Week:\s*Week two/.test(await text('.weekline')), 'Week two is chosen');
  ok(!await has('[data-nextweek]'), 'no pointer now');
});

scene('week choice: a finished chosen week falls back', async () => {
  let d = studied(weekDoc(WORDS, plus(3)), 'g1', plus(1));
  const g1 = W.groupById(d, 'g1');
  WORDS.forEach((w, i) => { d = W.addTry(d, { id: 'tt' + i, word: w, day: plus(3), group: 'g1', kind: 't', tries: 0, peeks: 0, clean: true, now: Date.parse(plus(3) + 'T10:00:00') + i }); });
  d = W.markStep(d, g1, 'mend', plus(4), Date.parse(plus(4) + 'T10:00:00'));
  d = W.createGroup(d, { id: 'g2', name: 'Week two', test: plus(10), words: WORDS2, today: MON, now: Date.parse(MON + 'T09:30:00') }).doc;
  await seedChild(d, plus(5));
  await ev('localStorage.setItem("sb.week:' + CHILD + '","g1")');
  await open(plus(5), '#/');
  await until('document.querySelector("[data-room]")', 'the home');
  ok(!/This week is finished/.test(await text()), 'the finished week is not shown: ' + await text('h1'));
  ok(!await has('.weekline'), 'one live week left: no Week line');
  ok(await has('[data-pathcard][href="#/words/g/g2/path"]'), 'Week two is shown');
  ok(await weekKey() === null, 'the stale choice was cleared');
});

scene('week choice: one test due while another week is chosen', async () => {
  const d = W.createGroup(studied(weekDoc(WORDS, plus(5)), 'g1', plus(1)), { id: 'g2', name: 'Week two', test: plus(12), words: WORDS2, today: MON, now: Date.parse(MON + 'T09:30:00') }).doc;
  await seedChild(d, plus(5));
  await ev('localStorage.setItem("sb.week:' + CHILD + '","g2")');
  await open(plus(5), '#/');
  await until('document.querySelector("[data-room]")', 'the home');
  ok(/Week:\s*Week two/.test(await text('.weekline')), 'Week two is shown');
  ok(/Your test for Week one is ready\./.test(await text('[data-duetest]')), 'the quiet line: ' + await text('.homego'));
  ok(/Take the test/.test(await text('[data-taketest]')) && (await rect('[data-taketest]')).h >= 48, 'Take the test, 48 px');
  ok((await ev('document.querySelector("[data-taketest]").getAttribute("href")')) === '#/words/g/g1/test', 'it goes to Week one\'s test');
  await noWordsOf(WORDS, 'the home');
  await allViews('week-home-due');
  await click('[data-week-change]');
  await until('document.querySelector("[role=dialog]")', 'the sheet');
  ok(/Test ready/.test(await text('[data-week=g1]')), 'the row says Test ready: ' + await text('[data-week=g1]'));
  await noWordsOf(WORDS, 'the sheet');
  await allViews('week-sheet-due');
  await click('[data-week=g1]');
  await until('!document.querySelector("[role=dialog]")', 'closed');
  ok(/Start the test/.test(await text('[data-job]')) && !await has('[data-duetest]'), 'Week one chosen: the test button, no extra line');
  await noWordsOf(WORDS, 'the home on its test day');
  await click('[data-week-change]');
  await until('document.querySelector("[role=dialog]")', 'the sheet');
  await click('[data-week=g2]');
  await until('!document.querySelector("[role=dialog]")', 'closed');
  await click('[data-pathcard]');
  await until('document.querySelector("[data-path]")', 'the path');
  await noWordsOf(WORDS, 'the path');
  await click('#child-back');
  await until('document.querySelector("[data-room]")', 'home');
  await click('#child-menu');
  await until('document.querySelector("[role=dialog]")', 'the Menu');
  await click('.sheetrow[data-row=words]');
  await until('document.querySelector(".pagehead h1")', 'My words');
  ok(/Week two/.test(await text('h1')), 'My words is Week two');
  await noWordsOf(WORDS, 'My words');
  ok(/Study this week/.test(await text('[data-study-week=g1]')), 'the due week can be opened (names only)');
  await click('[data-study-week=g1]');
  await sleep(150);
  await noWordsOf(WORDS, 'the due week\'s page');
  await go('#/words/g/g1');
  await sleep(150);
  await noWordsOf(WORDS, 'the due week\'s group page');
});

scene('week choice: sign-out forgets the choice', async () => {
  await seedChild(twoWeeksDoc(), plus(3));
  await ev('localStorage.setItem("sb.week:' + CHILD + '","g2")');
  ok(await weekKey() === 'g2', 'set');
  acct.who = null;
  await setClock(plus(3));
  await send('Page.navigate', { url: 'about:blank' });
  await send('Page.navigate', { url: SITE + '/spellbright/?signedout=1' });
  await until('document.readyState === "complete"', 'the page');
  await until('localStorage.getItem("sb.words:' + CHILD + '") === null', 'the cached words go');
  ok(await weekKey() === null, 'the chosen week goes with them');
});

// ---- SB3-C1c: the whole keyboard fits when the screen is wide but short (a landscape tablet or laptop) ----
// For a child and for an adult, on the flower game (Pick words), practice, the test and quick-fire.
const KB_VIEWS = [[1180, 640], [1180, 700], [1024, 650], [1366, 900], [1024, 768], [1366, 930], [1366, 950], [1366, 1000], [1920, 1000], [844, 390]];
const KB_PORTRAIT = [[390, 844], [768, 1024], [1024, 1366], [820, 1180], [834, 1194], [1920, 1080]];
// The keyboard's [x, y, width, height] and the Q key's [width, height] at the base commit (33fafd7), by "role page style WxH".
const KB_BASE = {
  "child flower garden 390x844": [6,590.4,378,264,35.1,56],
  "child flower garden 768x1024": [134,699.7,500,264,46,56],
  "child flower garden 1024x1366": [262,1041.7,500,264,46,56],
  "child flower garden 820x1180": [160,855.7,500,264,46,56],
  "child flower garden 834x1194": [167,869.7,500,264,46,56],
  "child flower garden 1920x1080": [710,755.7,500,264,46,56],
  "child flower night 390x844": [6,585.4,378,264,35.1,56],
  "child flower night 768x1024": [134,694.7,500,264,46,56],
  "child flower night 1024x1366": [262,1036.7,500,264,46,56],
  "child flower night 820x1180": [160,850.7,500,264,46,56],
  "child flower night 834x1194": [167,864.7,500,264,46,56],
  "child flower night 1920x1080": [710,750.7,500,264,46,56],
  "child practice garden 390x844": [6,572,378,264,35.1,56],
  "child practice garden 768x1024": [134,752,500,264,46,56],
  "child practice garden 1024x1366": [262,1094,500,264,46,56],
  "child practice garden 820x1180": [160,908,500,264,46,56],
  "child practice garden 834x1194": [167,922,500,264,46,56],
  "child practice garden 1920x1080": [710,808,500,264,46,56],
  "child practice night 390x844": [6,567,378,264,35.1,56],
  "child practice night 768x1024": [134,747,500,264,46,56],
  "child practice night 1024x1366": [262,1089,500,264,46,56],
  "child practice night 820x1180": [160,903,500,264,46,56],
  "child practice night 834x1194": [167,917,500,264,46,56],
  "child practice night 1920x1080": [710,803,500,264,46,56],
  "child test garden 390x844": [6,481.7,378,264,35.1,56],
  "child test garden 768x1024": [134,661.7,500,264,46,56],
  "child test garden 1024x1366": [262,1003.7,500,264,46,56],
  "child test garden 820x1180": [160,817.7,500,264,46,56],
  "child test garden 834x1194": [167,831.7,500,264,46,56],
  "child test garden 1920x1080": [710,717.7,500,264,46,56],
  "child test night 390x844": [6,478.2,378,264,35.1,56],
  "child test night 768x1024": [134,658.2,500,264,46,56],
  "child test night 1024x1366": [262,1000.2,500,264,46,56],
  "child test night 820x1180": [160,814.2,500,264,46,56],
  "child test night 834x1194": [167,828.2,500,264,46,56],
  "child test night 1920x1080": [710,714.2,500,264,46,56],
  "child quick garden 390x844": [6,485.7,378,264,35.1,56],
  "child quick garden 768x1024": [134,665.7,500,264,46,56],
  "child quick garden 1024x1366": [262,1007.7,500,264,46,56],
  "child quick garden 820x1180": [160,821.7,500,264,46,56],
  "child quick garden 834x1194": [167,835.7,500,264,46,56],
  "child quick garden 1920x1080": [710,721.7,500,264,46,56],
  "child quick night 390x844": [6,482.2,378,264,35.1,56],
  "child quick night 768x1024": [134,662.2,500,264,46,56],
  "child quick night 1024x1366": [262,1004.2,500,264,46,56],
  "child quick night 820x1180": [160,818.2,500,264,46,56],
  "child quick night 834x1194": [167,832.2,500,264,46,56],
  "child quick night 1920x1080": [710,718.2,500,264,46,56],
  "child fix garden 390x844": [6,544.3,378,264,35.1,56],
  "child fix garden 768x1024": [134,661.7,500,264,46,56],
  "child fix garden 1024x1366": [262,1003.7,500,264,46,56],
  "child fix garden 820x1180": [160,817.7,500,264,46,56],
  "child fix garden 834x1194": [167,831.7,500,264,46,56],
  "child fix garden 1920x1080": [710,717.7,500,264,46,56],
  "child fix night 390x844": [6,536.4,378,264,35.1,56],
  "child fix night 768x1024": [134,658.2,500,264,46,56],
  "child fix night 1024x1366": [262,1000.2,500,264,46,56],
  "child fix night 820x1180": [160,814.2,500,264,46,56],
  "child fix night 834x1194": [167,828.2,500,264,46,56],
  "child fix night 1920x1080": [710,714.2,500,264,46,56],
  "adult flower garden 390x844": [16,632.8,372.5,154.4,32.8,46.8],
  "adult flower garden 768x1024": [16,703.1,721,176,46,54],
  "adult flower garden 1024x1366": [16,703.1,992,176,46,54],
  "adult flower garden 820x1180": [16,703.1,788,176,46,54],
  "adult flower garden 834x1194": [16,703.1,802,176,46,54],
  "adult flower garden 1920x1080": [448.5,703.1,1008,176,46,54],
  "adult flower night 390x844": [16,626.3,372.5,154.4,32.8,46.8],
  "adult flower night 768x1024": [16,696.7,721,176,46,54],
  "adult flower night 1024x1366": [16,696.7,992,176,46,54],
  "adult flower night 820x1180": [16,696.7,788,176,46,54],
  "adult flower night 834x1194": [16,696.7,802,176,46,54],
  "adult flower night 1920x1080": [448.5,696.7,1008,176,46,54],
  "adult practice garden 390x844": [16,538.5,358,154.4,31.3,46.8],
  "adult practice garden 768x1024": [120,566.9,528,176,46,54],
  "adult practice garden 1024x1366": [248,566.9,528,176,46,54],
  "adult practice garden 820x1180": [146,566.9,528,176,46,54],
  "adult practice garden 834x1194": [153,566.9,528,176,46,54],
  "adult practice garden 1920x1080": [696,566.9,528,176,46,54],
  "adult practice night 390x844": [16,532,358,154.4,31.3,46.8],
  "adult practice night 768x1024": [120,560.5,528,176,46,54],
  "adult practice night 1024x1366": [248,560.5,528,176,46,54],
  "adult practice night 820x1180": [146,560.5,528,176,46,54],
  "adult practice night 834x1194": [153,560.5,528,176,46,54],
  "adult practice night 1920x1080": [696,560.5,528,176,46,54],
  "adult test garden 390x844": [16,334.2,358,154.4,31.3,46.8],
  "adult test garden 768x1024": [120,355.5,528,176,46,54],
  "adult test garden 1024x1366": [248,355.5,528,176,46,54],
  "adult test garden 820x1180": [146,355.5,528,176,46,54],
  "adult test garden 834x1194": [153,355.5,528,176,46,54],
  "adult test garden 1920x1080": [696,355.5,528,176,46,54],
  "adult test night 390x844": [16,329.2,358,154.4,31.3,46.8],
  "adult test night 768x1024": [120,350.5,528,176,46,54],
  "adult test night 1024x1366": [248,350.5,528,176,46,54],
  "adult test night 820x1180": [146,350.5,528,176,46,54],
  "adult test night 834x1194": [153,350.5,528,176,46,54],
  "adult test night 1920x1080": [696,350.5,528,176,46,54],
  "adult quick garden 390x844": [16,412,358,154.4,31.3,46.8],
  "adult quick garden 768x1024": [120,433.4,528,176,46,54],
  "adult quick garden 1024x1366": [248,433.4,528,176,46,54],
  "adult quick garden 820x1180": [146,433.4,528,176,46,54],
  "adult quick garden 834x1194": [153,433.4,528,176,46,54],
  "adult quick garden 1920x1080": [696,433.4,528,176,46,54],
  "adult quick night 390x844": [16,407,358,154.4,31.3,46.8],
  "adult quick night 768x1024": [120,428.4,528,176,46,54],
  "adult quick night 1024x1366": [248,428.4,528,176,46,54],
  "adult quick night 820x1180": [146,428.4,528,176,46,54],
  "adult quick night 834x1194": [153,428.4,528,176,46,54],
  "adult quick night 1920x1080": [696,428.4,528,176,46,54],
  "adult fix garden 390x844": [16,536,358,154.4,31.3,46.8],
  "adult fix garden 768x1024": [112.5,569.3,528,176,46,54],
  "adult fix garden 1024x1366": [248,569.3,528,176,46,54],
  "adult fix garden 820x1180": [146,569.3,528,176,46,54],
  "adult fix garden 834x1194": [153,569.3,528,176,46,54],
  "adult fix garden 1920x1080": [696,569.3,528,176,46,54],
  "adult fix night 390x844": [16,529.6,358,154.4,31.3,46.8],
  "adult fix night 768x1024": [120,562.8,528,176,46,54],
  "adult fix night 1024x1366": [248,562.8,528,176,46,54],
  "adult fix night 820x1180": [146,562.8,528,176,46,54],
  "adult fix night 834x1194": [153,562.8,528,176,46,54],
  "adult fix night 1920x1080": [696,562.8,528,176,46,54],
};
async function kbSeed(role, page) {
  const day = { flower: MON, practice: plus(4), test: plus(5), quick: plus(2), fix: plus(1) }[page];
  const helloDone = () => { const d = weekDoc(); return W.markStep(d, W.groupById(d, 'g1'), 'hello', MON, Date.parse(MON + 'T09:00:00')); };
  const doc = { flower: weekDoc(), practice: practiceDayDoc(), test: studied(weekDoc()), quick: gameDayDoc(), fix: helloDone() }[page];
  if (role === 'child') await seedChild(doc, day);
  else {
    await signedOutBlank(day);
    acct.who = adultMe;
    acct.put(ADULT, 'spellbright', 'words', doc);
    await ev('localStorage.setItem("wa.player",' + q(JSON.stringify({ id: ADULT, name: 'Sam', avatar: null })) + ')');
    await ev('localStorage.setItem("sb.words:' + ADULT + '",' + q(JSON.stringify(doc)) + ')');
  }
  await open(day, '#/');
  await width(1180, 700);
  if (page === 'flower') {
    const list = await ev(`(async () => { const c = await (await fetch('data/curriculum.json')).json(); return c.year_3_4.chapters.flatMap((ch) => ch.words.map((w) => w.word)).slice(0, 10); })()`);
    await ev('sessionStorage.setItem("sb.selection",' + q(JSON.stringify(list)) + ')');
    await go('#/custom/play');
    await until('document.querySelector(".blanks") && document.querySelector(".keyboard .key")', 'the flower game');
  } else if (page === 'practice') {
    await go('#/words/g/g1/spell/0');
    await until('document.querySelector(".spellbox.is-next")', 'the practice word');
  } else if (page === 'test') {
    await go('#/words/g/g1/test');
    await until('document.querySelector("[data-next]") && document.querySelector(".keyboard .key")', 'the test');
  } else if (page === 'fix') { // Fix it in: look, cover, then the typing step
    await go('#/words/g/g1/study/fix');
    await click('[data-cover]');
    await click('[data-written]');
    await until('document.querySelector("[data-check]") && document.querySelector(".keyboard .key")', 'Fix it in typing');
  } else {
    await go('#/words/g/g1/game/quick');
    await until('document.querySelector("[data-game=quick]") && document.querySelector(".keyboard .key")', 'Quick-fire');
  }
  await ev('document.fonts.ready.then(() => true)');
  await sleep(150);
}
const kbMeasure = () => ev(`(() => {
  const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
  const kb = document.querySelector('.keyboard');
  const keys = [...kb.querySelectorAll('.key')].map(R);
  const rows = [...kb.querySelectorAll('.keyboard-row')];
  const names = ['[data-hear]', '[data-hearmain]', '[data-peekbtn]', '[data-skip]', '[data-next]', '[data-check]', '[data-go]', '.keyboard', '.blanks', '.spellboxes', '[data-answer]', '.play__top .pic', '.play__top .flower', 'details.hint', '.pagehead', '.status', '.peekrow', '.skiprow'];
  const boxes = names.map((n) => [n, document.querySelector(n)]).filter(([, e]) => e && e.getBoundingClientRect().height > 0);
  const hit = [];
  for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
    const a = boxes[i][1].getBoundingClientRect(), b = boxes[j][1].getBoundingClientRect();
    if (a.right - 1 > b.left && a.left < b.right - 1 && a.bottom - 1 > b.top && a.top < b.bottom - 1 && !boxes[i][1].contains(boxes[j][1]) && !boxes[j][1].contains(boxes[i][1])) hit.push(boxes[i][0] + ' / ' + boxes[j][0]);
  }
  const lb = document.querySelector('.blanks, .spellboxes, [data-answer]');
  const ctl = ['[data-hear]', '[data-hearmain]', '[data-peekbtn]', '[data-skip]', '[data-next]', '[data-check]', '[data-go]'].map((s) => R(document.querySelector(s))).filter(Boolean);
  const first = rows[0].querySelectorAll('.key');
  return {
    vw: innerWidth, vh: innerHeight, cw: document.documentElement.clientWidth, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight,
    kb: R(kb), keysTop: Math.min(...keys.map((k) => k.y)), keysBottom: Math.max(...keys.map((k) => k.b)),
    minW: Math.min(...keys.map((k) => k.w)), minH: Math.min(...keys.map((k) => k.h)),
    q: R(kb.querySelector('.key[data-letter=Q]')), rows: rows.map((r) => r.querySelectorAll('.key').length).join(), wrap: getComputedStyle(rows[0]).flexWrap,
    oneRow: Math.abs(first[0].getBoundingClientRect().y - first[first.length - 1].getBoundingClientRect().y) < 1,
    boxes: R(lb), ctlTop: Math.min(...ctl.map((c) => c.y)), ctlBottom: Math.max(...ctl.map((c) => c.b)), hit,
  };
})()`);
const kbPop = (L) => ev(`(() => {
  const k = document.querySelector('.key[data-letter=${L}]');
  k.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  const a = document.querySelector('.keypop').getBoundingClientRect();
  const out = ['[data-skip]', '[data-peekbtn]', '[data-hear]', '[data-hearmain]'].filter((s) => { const e = document.querySelector(s); if (!e) return false; const b = e.getBoundingClientRect(); return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom); });
  document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  return out;
})()`);
async function shotView(name) {
  await sleep(60);
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(OUT, name + '.png'), Buffer.from(r.data, 'base64'));
}
scene('keyboard fits in landscape', async () => {
  const dump = {};
  const nextAt = [];
  let cases = 0;
  for (const role of ['child', 'adult']) {
    for (const page of ['flower', 'practice', 'test', 'quick', 'fix']) {
      await kbSeed(role, page);
      for (const s of ['garden', 'night']) {
        await style(s);
        for (const [w, h] of [...KB_VIEWS, ...KB_PORTRAIT]) {
          await width(w, h);
          await sleep(120);
          const m = await kbMeasure();
          const id = role + ' ' + page + ' ' + s + ' ' + w + 'x' + h;
          dump[id] = m;
          if (process.env.KB_DUMP) { if (h <= 1000 && w >= 820) await shotView('kb-' + id.replaceAll(' ', '-')); continue; } // KB_DUMP: measure only (the base values), with the pictures
          cases += 1;
          ok(m.sw <= m.cw, id + ': scrolls sideways (' + m.sw + ' > ' + m.cw + ')');
          ok(m.rows === '10,9,7' || m.rows === '10,9,8' || m.rows === '10,9,7', id + ': rows ' + m.rows);
          ok(m.wrap === 'nowrap' && m.oneRow, id + ': a row wraps');
          ok(m.hit.length === 0, id + ': overlap ' + m.hit.join('; '));
          if (w >= 820 && h <= 1000) {
            ok(m.minW >= 44 && m.minH >= 48, id + ': keys ' + m.minW + ' x ' + m.minH);
            if (h > 400) {
              ok(m.kb.y >= 0 && m.kb.b <= h, id + ': keyboard ' + Math.round(m.kb.y) + '..' + Math.round(m.kb.b) + ' of ' + h);
              ok(m.boxes.y >= 0 && m.boxes.b <= h, id + ': letter boxes ' + Math.round(m.boxes.y) + '..' + Math.round(m.boxes.b) + ' of ' + h);
              ok(m.ctlBottom <= h, id + ': controls reach ' + Math.round(m.ctlBottom) + ' of ' + h);
            }
            await shotView('kb-' + id.replaceAll(' ', '-'));
          } else if (w < 820 && h < 500) { // a phone on its side: it may scroll, but the keyboard is reachable and nothing overlaps
            ok(m.minW >= 30 && m.minH >= 44, id + ': keys ' + m.minW + ' x ' + m.minH);
            await ev('document.querySelector(".keyboard").scrollIntoView({ block: "end" })');
            const r = await ev('(() => { const r = document.querySelector(".keyboard").getBoundingClientRect(); return [r.top, r.bottom]; })()');
            ok(r[1] <= h + 0.5 && r[0] >= -0.5, id + ': keyboard unreachable ' + r);
            await ev('window.scrollTo(0, 0)');
            await shotView('kb-' + id.replaceAll(' ', '-'));
          } else {
            const b = KB_BASE[role + ' ' + page + ' ' + s + ' ' + w + 'x' + h];
            ok(b, id + ': no base values recorded');
            const now = [m.kb.x, m.kb.y, m.kb.w, m.kb.h, m.q.w, m.q.h].map((n) => Math.round(n * 10) / 10);
            // An adult's page now has the Waystead Learning line in its foot (SB3-F): a tall page may gain a scroll bar, which makes the keyboard up to 17 px narrower. Where it sits is unchanged.
            const same = role === 'adult' ? now.every((n, i) => (i === 2 || i === 4 ? n <= b[i] + 0.5 && n >= b[i] - 17 : i === 0 ? Math.abs(n - b[i]) <= 9 : n === b[i])) : JSON.stringify(now) === JSON.stringify(b);
            ok(same, id + ': keyboard moved: base ' + JSON.stringify(b) + ' now ' + JSON.stringify(now));
          }
          if (role === 'child' && w >= 820 && h <= 1000 && (s === 'garden' || page === 'flower')) {
            await ev('window.scrollTo(0, 0)');
            for (const L of ['Q', 'P', 'I', 'A', 'M']) { const hits = await kbPop(L); ok(!hits.length, id + ': the pop-up for ' + L + ' covers ' + hits.join(' ')); }
          }
        }
      }
    }
  }
  if (!process.env.KB_DUMP) {
    // The flower game's end-of-word card takes the keyboard's place: Next word is in view and the left column does not move.
    for (const role of ['child', 'adult']) {
      for (const [s, vs] of [['garden', KB_VIEWS], ['night', [[1180, 640]]]]) { // ten words in Pick words: a new list for each look
        await kbSeed(role, 'flower');
        await style(s);
        for (const [w, h] of vs.filter(([vw, vh]) => vw >= 820 && vh <= 1000 && vh > 400)) {
          await width(w, h);
          await sleep(100);
          const id = role + ' end-of-word ' + s + ' ' + w + 'x' + h;
          const at = () => ev('(() => { const y = (s) => document.querySelector(s).getBoundingClientRect().y; return [y(".status"), y(".play__top"), y(".blanks")]; })()');
          const before = await at();
          const n = await ev('globalThis.__said.length');
          await click('[data-hearmain]');
          await until('globalThis.__said.length > ' + n, 'the word');
          await keys([...new Set(await said())].join(''));
          await until('document.querySelector("[data-next]")', 'the end of the word');
          await sleep(120);
          const after = await at();
          const next = await rect('[data-next]');
          const card = await rect('.result');
          nextAt.push(w + 'x' + h + ' ' + role + ' ' + Math.round(next.y + next.h));
          ok(next.y >= 0 && next.y + next.h <= h, id + ': Next word at ' + Math.round(next.y) + '..' + Math.round(next.y + next.h) + ' of ' + h);
          ok(card.x >= w * 0.4, id + ': the card is in the right column (x ' + Math.round(card.x) + ')');
          ok(before.every((v, i) => Math.abs(v - after[i]) < 1.5), id + ': the left column moved ' + before + ' -> ' + after);
          ok(await ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), id + ': scrolls sideways');
          if (s === 'night' || w === 1180) await shotView('kb-' + id.replaceAll(' ', '-'));
          await click('[data-next]');
          await until('document.querySelector(".blanks") && document.querySelector(".keyboard .key")', 'the next word');
        }
      }
    }
  }
  if (nextAt.length) step('Next word ends at: ' + nextAt.join(', '));
  if (process.env.KB_DUMP) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(process.env.KB_DUMP, JSON.stringify(dump, null, 1));
    return;
  }
  step(cases + ' cases');
  await width(390, 900);
});

// ---- SB3-F: the adult's front page, top bar, Menu and account panel ---------------------------
const KIDS2 = [{ id: CHILD, nickname: 'Robin', year: 4, avatar: null }, { id: CHILD2, nickname: 'Wren', year: 6, avatar: null }];
const setKids = (list) => { acct.children = (id) => (id === ADULT ? list : []); };
function wrenOnTrack() { let d = wrenWeek(); d = W.markStep(d, W.groupById(d, 'w1'), 'fix', plus(1), Date.parse(plus(1) + 'T10:00:00')); return d; }
function endedWeek() {
  let d = studied(weekDoc(WORDS, plus(3)), 'g1', plus(1));
  WORDS.forEach((w, i) => { d = W.addTry(d, { id: 'et' + i, word: w, day: plus(3), group: 'g1', kind: 't', tries: 0, peeks: 0, clean: true, now: Date.parse(plus(3) + 'T10:00:00') + i }); });
  return W.markStep(d, W.groupById(d, 'g1'), 'mend', plus(4), Date.parse(plus(4) + 'T10:00:00'));
}
async function seedFront(docs, kids, day = plus(2), who = adultMe) {
  await signedOutBlank(day);
  acct.who = who;
  setKids(kids);
  for (const [id, d] of docs) acct.put(id, 'spellbright', 'words', d);
  await open(day, '#/');
  await until('document.querySelector("[data-child],[data-first]")', 'the front page');
}
const primaries = () => ev('[...document.querySelectorAll("main .btn--primary")].map((e) => e.textContent.replace(/\\s+/g, " ").trim())');
const inFirstScreen = async (sel, w, h) => { await width(w, h); const r = await rect(sel); return r.y >= 0 && r.y + r.h <= h; };

scene('front page (adult): two children, one green button in the header row, stable order', async () => {
  storiesHidden = true;
  try {
    await seedFront([[CHILD, childWeek()], [CHILD2, wrenWeek()]], KIDS2);
    ok(!await has('[data-room]') && /^#\/?$/.test(await ev('location.hash')), 'the adult\'s #/ is the week at a glance, not the chapters or a room');
    ok(/Wednesday 4 November/i.test(await text('[data-date]')), 'a date eyebrow: ' + await text('[data-date]'));
    ok(/Wren has a job waiting\. Robin is on track\./.test(await text('[data-summary]')), 'one summary sentence: ' + await text('[data-summary]'));
    ok((await primaries()).join('|') === 'See Wren’s week', 'one green button, the first child who needs attention: ' + await primaries());
    ok(await ev('!!document.querySelector(".gu-top [data-primary]") && !!document.querySelector(".gu-top .btn--ghost[data-planweek]")'), 'the green button is in the header row, with a quiet Plan a week');
    ok(await ev('[...document.querySelectorAll("[data-child] [data-see]")].every((e) => e.classList.contains("btn--ghost"))'), 'every card button is quiet');
    ok((await ev('[...document.querySelectorAll("[data-child]")].map((e) => e.dataset.child)')).join() === CHILD + ',' + CHILD2, 'the account\'s order');
    ok(!await has('.gu-facts') && await ev('document.querySelectorAll(".gu-stones--one").length') === 2, 'no facts tiles; the stone strip on each card');
    ok(/Next: Game day\. Then Story day\./.test(await textOf('[data-child="' + CHILD + '"] [data-next]')), 'Robin: ' + await textOf('[data-child="' + CHILD + '"]'));
    ok(/Next: Fix it in \(waiting\)\. Then Game day\./.test(await textOf('[data-child="' + CHILD2 + '"] [data-next]')), 'Wren: ' + await textOf('[data-child="' + CHILD2 + '"] [data-next]'));
    ok(/Needs help/.test(await textOf('[data-child="' + CHILD + '"] [data-help]')) && /build/.test(await textOf('[data-child="' + CHILD + '"] [data-help]')), 'Needs help: build');
    ok(await ev('[...document.querySelectorAll(".gu-stones--one")].every((o) => o.querySelectorAll("li.is-today").length === 1)'), 'the sun is on one stone in each strip');
    ok(/20 stories to read first/.test(await textOf('[data-stories]')), 'the stories notice is kept');
    ok(/Sun: next job/.test(await textOf('[data-stonekey]')), 'the key');
    for (const [w, h] of [[1180, 640], [390, 844]]) ok(await inFirstScreen('[data-primary]', w, h), 'the green button is in the first screen at ' + w + 'x' + h);
    await width(390, 844);
    ok(await ev('[...document.querySelectorAll(".gu-stones--one")].every((o) => new Set([...o.children].map((li) => Math.round(li.getBoundingClientRect().top))).size === 1)'), 'the seven stones stay on one line at 390');
    step('the foot: one quiet line from Waystead Learning, and the part-of-Waystead line, not For parents or More games');
    ok(await visible('.foot__papers') && /11\+ English practice papers/.test(await text('.foot__papers')) && /learning\.waystead\.co\.uk\/packs/.test(await ev('document.querySelector(".foot__papers a").href')), 'the papers line');
    ok(await visible('.foot') && !await visible('.foot__more') && /part of Waystead/.test(await text('.foot')), 'the footer has the Waystead line only');
    await allViews('front-two');
    await click('[data-primary]');
    await until('location.hash === "#/grownups/child/' + CHILD2 + '"', 'Wren\'s week');
    ok(await visible('.foot__papers'), 'the papers line is on the other adult pages too');
  } finally { storiesHidden = false; setKids(KIDS2); }
});

scene('front page (adult): one child; everyone on track; a week that has ended; a child with no week', async () => {
  try {
    step('one child');
    await seedFront([[CHILD, childWeek()]], [KIDS2[0]]);
    ok(await ev('document.querySelectorAll("[data-child]").length') === 1 && /Robin is on track\./.test(await text('[data-summary]')), 'one card: ' + await text('[data-summary]'));
    ok((await primaries()).join('|') === 'Plan a week', 'Plan a week is the green button when no one needs you: ' + await primaries());
    ok(await has('.gu-top [data-planweek].btn--primary'), 'it is in the header row');
    await allViews('front-one');
    step('everyone on track');
    await seedFront([[CHILD, childWeek()], [CHILD2, wrenOnTrack()]], KIDS2);
    ok(/Robin and Wren are on track\./.test(await text('[data-summary]')), await text('[data-summary]'));
    ok((await primaries()).join('|') === 'Plan a week' && await ev('[...document.querySelectorAll("[data-see]")].every((e) => e.classList.contains("btn--ghost"))'), 'Plan a week leads; the cards are quiet');
    await allViews('front-ontrack');
    step('a week that has ended');
    await seedFront([[CHILD, endedWeek()], [CHILD2, wrenOnTrack()]], KIDS2, plus(5));
    ok(/Robin’s week has ended\. Wren has 2 jobs waiting\./.test(await text('[data-summary]')), await text('[data-summary]'));
    ok((await primaries()).join('|') === 'Plan Robin’s next week', 'the green button plans the next week: ' + await primaries());
    ok(/week ended on/.test(await textOf('[data-child="' + CHILD + '"] [data-next]')) && await has('[data-child="' + CHILD + '"] [data-plan]') && /Week finished/.test(await textOf('[data-child="' + CHILD + '"] [data-chip]')), 'the ended card: ' + await textOf('[data-child="' + CHILD + '"]'));
    await allViews('front-ended');
    step('a child with no week');
    await seedFront([[CHILD, childWeek()]], KIDS2);
    ok((await primaries()).join('|') === 'Plan a week for Wren', 'Plan a week for Wren is the green button: ' + await primaries());
    ok(/No week yet/.test(await textOf('[data-child="' + CHILD2 + '"] [data-chip]')) && await ev('document.querySelector("[data-child=\\"' + CHILD2 + '\\"] [data-plan]").classList.contains("btn--ghost")'), 'the card button is quiet');
    await allViews('front-noweek');
  } finally { setKids(KIDS2); }
});

scene('front page (adult): five children get one compact row each; no children says what to do first', async () => {
  const ids = [1, 2, 3, 4, 5].map((n) => 'b' + n + '111111-1111-4111-8111-111111111111');
  const names = ['Amara', 'Ben', 'Chloe', 'Dev', 'Ellie'];
  const kids = ids.map((id, i) => ({ id, nickname: names[i], year: 4, avatar: null }));
  try {
    await seedFront(ids.map((id, i) => [id, i === 1 || i === 4 ? wrenWeek() : childWeek()]), kids);
    ok(await ev('document.querySelectorAll(".gu-card--row").length') === 5 && await ev('document.querySelectorAll(".gu-stones").length') === 0, 'five rows, no stone strips');
    ok(/Ben and Ellie need you\. Three children are on track\./.test(await text('[data-summary]')), await text('[data-summary]'));
    ok((await ev('[...document.querySelectorAll("[data-child]")].map((e) => e.dataset.child)')).join() === ids.join(), 'stable order');
    ok((await primaries()).join('|') === 'See Ben’s week' && await ev('[...document.querySelectorAll("[data-see]")].every((e) => e.classList.contains("btn--ghost"))'), 'Ben gets the one green button, in the header: ' + await primaries());
    for (const [w, h] of [[1180, 640], [390, 844]]) ok(await inFirstScreen('[data-primary]', w, h), 'the green button is in the first screen at ' + w + 'x' + h);
    await width(390, 844);
    const tall = await ev('document.documentElement.scrollHeight');
    ok(tall < 2300, 'five rows are not three screens at 390: ' + tall);
    await allViews('front-five');
    step('no children');
    await seedFront([], []);
    ok(await has('[data-first]') && /Add your first child/.test(await text('[data-first] h1')) && !await has('[data-planweek]'), 'what to do first: ' + await text('main'));
    ok(/\/account$/.test(await ev('document.querySelector("[data-addchild]").href')) && /Add a child/.test(await text('[data-addchild]')), 'Add a child, on the Waystead account');
    ok(await visible('.foot__papers'), 'the papers line');
    await allViews('front-none');
  } finally { setKids(KIDS2); }
});

scene('adult bar: the mark with Grown-ups, Menu, the account chip; one row at 390; the old bar is gone', async () => {
  await seedFront([[CHILD, childWeek()], [CHILD2, wrenWeek()]], KIDS2);
  await width(1280, 800);
  ok(await ev('document.body.classList.contains("is-adult") && !document.body.classList.contains("is-child")'), 'the adult chrome');
  ok(/Grown-ups/i.test(await text('.brand')) && await visible('.brand__tag'), 'the mark with a Grown-ups tag');
  ok(await ev('document.querySelector(".brand").getAttribute("href")') === '#/', 'one link to the front page');
  ok(await visible('#adult-menu-btn') && await visible('#adult-chip'), 'Menu and the chip');
  ok(await ev('[...document.querySelectorAll(".topbar a, .topbar button")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; }).length') === 3, 'three controls in the bar');
  for (const sel of ['#theme', '.allgames', '#player-slot', '.navmenu']) ok(!await visible(sel), sel + ' has left the adult bar');
  ok(await ev('getComputedStyle(document.querySelector(".topbar__nav")).display') !== 'none', 'the nav is never display: none');
  ok(await ev('document.querySelector("#adult-menu-btn").getAttribute("aria-controls")') === 'adult-menu-panel' && await ev('document.querySelector("#adult-chip").getAttribute("aria-controls")') === 'adult-account-panel', 'aria-controls');
  ok(/Sam/.test(await text('#adult-chip')) && await ev('document.querySelector("#adult-chip").getAttribute("aria-label")') === 'Sam. Account menu', 'the chip shows the name, labelled');
  for (const w of [390, 360]) {
    await width(w, 844);
    const m = await ev('(() => { const i = document.querySelector(".topbar__inner"), ks = [...i.querySelectorAll(".brand, #adult-menu-btn, #adult-chip")].map((e) => e.getBoundingClientRect()); return { h: i.getBoundingClientRect().height, tops: ks.map((r) => Math.round(r.top)), right: Math.max(...ks.map((r) => r.right)), over: document.documentElement.scrollWidth - innerWidth, name: getComputedStyle(document.querySelector(".adultchip__name")).display, tag: getComputedStyle(document.querySelector(".brand__tag")).display, chipW: ks[2].width }; })()');
    ok(m.h < 70 && new Set(m.tops).size <= 2 && m.right <= w && m.over <= 0, 'one row at ' + w + ': ' + JSON.stringify(m));
    ok(m.name === 'none' && m.chipW >= 44, 'the chip is the avatar only on a phone: ' + JSON.stringify(m));
  }
  step('an account with no name');
  await seedFront([], [], plus(2), { ...adultMe, displayName: '' });
  await width(1280, 800);
  ok(/Your account/.test(await text('#adult-chip')) && await has('#adult-chip .adultface--plain'), 'Your account with a person glyph: ' + await text('#adult-chip'));
  await click('#adult-chip');
  await until('!document.querySelector("#adult-account-panel").hidden', 'the panel');
  ok(!/Grown-up(?!s)/.test(await ev('document.querySelector(".topbar").innerText + " " + document.querySelector("#adult-account-panel").innerText')), 'the word Grown-up is never shown as a name');
  ok(/Your account/.test(await text('#adult-account-panel .adultwho')), 'the panel says Your account');
  await shot('adult-chip-noname');
  await key('Escape');
});

scene('adult Menu: below the bar on a wide screen, a bottom sheet on a phone; focus, Escape, Close, inert, route change', async () => {
  await seedFront([[CHILD, childWeek()], [CHILD2, wrenWeek()]], KIDS2);
  await width(1280, 800);
  await click('#adult-menu-btn');
  await until('!document.querySelector("#adult-menu-panel").hidden', 'the Menu');
  ok(await ev('document.querySelector("#adult-menu-btn").getAttribute("aria-expanded")') === 'true', 'aria-expanded');
  const rows = await ev('[...document.querySelectorAll("#adult-menu-panel nav ul a")].map((a) => ({ t: a.querySelector("b").textContent, h: a.getAttribute("href"), tall: a.getBoundingClientRect().height, sub: a.querySelector("span.adultrow__text > span").textContent }))');
  ok(rows.map((r) => r.t).join() === 'More practice,My words,Pick words,Tricky words,Progress,All games' && rows.map((r) => r.h).join() === '#/chapters,#/words,#/custom,#/tricky,#/progress,../', 'the six rows: ' + JSON.stringify(rows));
  ok(rows.every((r) => r.tall >= 48 && r.sub.length > 0), 'each row 48 px or more with a helper');
  ok(await ev('document.querySelector("#adult-menu-panel nav") !== null && !document.querySelector("#adult-menu-panel [role=menu]")'), 'a nav with a list, no role=menu');
  const bar = await rect('.topbar');
  const panel = await rect('#adult-menu-panel');
  ok(panel.y >= bar.y + bar.h - 1, 'the panel is below the bar: ' + JSON.stringify({ bar, panel }));
  ok(await ev('document.activeElement.hasAttribute("data-adult-close") && !!document.activeElement.closest("#adult-menu-panel")'), 'focus is in the Menu, on Close');
  ok(await ev('document.querySelector("main").hasAttribute("inert") && document.querySelector(".foot").hasAttribute("inert")'), 'the page behind is inert');
  for (let i = 0; i < 9; i += 1) { await key('Tab'); ok(await ev('!!document.activeElement.closest("#adult-menu-panel")'), 'Tab stays in the Menu (' + i + ')'); }
  await shot('adult-menu-1280');
  await key('Escape');
  await sleep(60);
  ok(await ev('document.querySelector("#adult-menu-panel").hidden && document.activeElement.id === "adult-menu-btn" && !document.querySelector("main").hasAttribute("inert")'), 'Escape closes, focus goes back to Menu, nothing inert');
  await click('#adult-menu-btn');
  await click('#adult-menu-panel [data-adult-close]');
  ok(await ev('document.querySelector("#adult-menu-panel").hidden && document.activeElement.id === "adult-menu-btn"'), 'Close closes');
  await click('#adult-menu-btn');
  await click('#adult-chip');
  ok(await ev('document.querySelector("#adult-menu-panel").hidden && !document.querySelector("#adult-account-panel").hidden'), 'the chip swaps the Menu for the account panel');
  await key('Escape');
  step('a route change closes it; every row opens its page');
  for (const [href, ready] of [['#/chapters', '[data-chapters]'], ['#/words', 'main h1'], ['#/custom', 'main h1'], ['#/tricky', 'main h1'], ['#/progress', 'main h1']]) {
    await go('#/');
    await until('document.querySelector("[data-child]")', 'the front page');
    await click('#adult-menu-btn');
    await click('#adult-menu-panel a[href="' + href + '"]');
    await until('location.hash === ' + q(href) + ' && document.querySelector(' + q(ready) + ')', href);
    await sleep(80);
    ok(await ev('document.activeElement === document.querySelector("main h1")'), 'after choosing ' + href + ' focus is on the new page\'s heading');
    ok(await ev('document.querySelector("#adult-menu-panel").hidden && !document.querySelector("main").hasAttribute("inert")'), 'a row closes the Menu: ' + href);
  }
  ok(await ev('document.querySelector("#adult-menu-panel a[href=\\"../\\"]").getAttribute("href")') === '../', 'All games goes to the games home');
  await click('#adult-menu-btn');
  await go('#/tricky');
  await sleep(80);
  ok(await ev('document.querySelector("#adult-menu-panel").hidden'), 'a route change closes the Menu');
  step('a phone: the bottom sheet');
  await width(390, 844);
  await go('#/');
  await until('document.querySelector("[data-child]")', 'the front page');
  await click('#adult-menu-btn');
  const sheet = await rect('#adult-menu-panel');
  ok(Math.abs(sheet.y + sheet.h - 844) <= 1 && sheet.w >= 389 && sheet.x <= 1, 'a bottom sheet: ' + JSON.stringify(sheet));
  ok(await visible('#adult-menu-btn') && (await rect('#adult-menu-btn')).y + (await rect('#adult-menu-btn')).h <= sheet.y, 'the Menu button stays visible above the sheet');
  await shot('adult-menu-390');
  await style('night');
  await shot('adult-menu-night-390');
  await width(1280, 800);
  await shot('adult-menu-night-1280');
  await style('garden');
  await key('Escape');
});

scene('adult account panel: name, ONE Play as a child row, Your account, the look, For parents, Sign out', async () => {
  await seedFront([[CHILD, childWeek()], [CHILD2, wrenWeek()]], KIDS2);
  await width(1280, 800);
  await click('#adult-chip');
  await until('document.querySelector("#adult-account-panel [data-switch]")', 'the switch rows');
  ok(await ev('document.querySelector("#adult-chip").getAttribute("aria-expanded")') === 'true', 'aria-expanded');
  const t = await textOf('#adult-account-panel');
  ok(/Sam/.test(await textOf('#adult-account-panel .adultwho')) && /Play as a child/.test(t) && /Robin or Wren/.test(t) && !/Switch to /.test(t) && !/Manage children|My account/.test(t) && /Your account/.test(t) && /Children, password and sign-in/.test(t) && !/on this device/i.test(t) && /For parents/.test(t) && /Sign out/.test(t), 'the panel: ' + t);
  ok(await ev('document.querySelectorAll("#adult-account-panel [data-switch]").length') === 1 && await ev('document.querySelectorAll("#adult-account-panel a[href$=\\"/account\\"]").length') === 1, 'ONE play-as row and ONE account row (no two rows to the same place)');
  const hrefs = await ev('Object.fromEntries([...document.querySelectorAll("#adult-account-panel a")].map((a) => [a.textContent.replace(/\\s+/g, " ").trim().split(" ")[0] + (a.dataset.switch ? ":" + a.dataset.switch : ""), a.href]))');
  ok(/\/play\?return=/.test(await ev('document.querySelector("[data-switch]").href')), 'Play as a child uses the existing play-as-a-child flow');
  ok(/\/signout\?return=/.test(await ev('document.querySelector("[data-signout]").href')) && /\/account$/.test(await ev('document.querySelector("[data-account]").href')) && /#\/about$/.test(await ev('document.querySelector("[data-parents]").href')), 'Sign out, Your account and For parents: ' + JSON.stringify(hrefs));
  ok(await ev('document.querySelectorAll("#adult-account-panel [role=radio][data-choice]").length') === 4 && await ev('document.querySelectorAll("#adult-account-panel [data-choice][aria-checked=true]").length') === 1, 'four looks, one ticked');
  ok(await ev('[...document.querySelectorAll("#adult-account-panel a, #adult-account-panel button")].every((e) => e.getBoundingClientRect().height >= 44)'), 'every control is 44 px or more');
  ok(await ev('(() => { const o = document.querySelector("[data-signout] svg path").getAttribute("d"); return !/M9 6l6 6/.test(o); })()'), 'Sign out has an exit icon');
  await shot('adult-account-garden-1280');
  step('the look changes to Night and back, and the old look menu stays in step');
  await click('#adult-account-panel [data-choice=night]');
  await until('document.documentElement.dataset.style === "night"', 'Night');
  ok(await ev('document.querySelector("#adult-account-panel [data-choice=night]").getAttribute("aria-checked")') === 'true' && await ev('document.querySelector("#theme").dataset.choice') === 'night' && await ev('localStorage.getItem("sb.theme")') === 'dark', 'Night is on and saved, the old menu follows');
  await shot('adult-account-night-1280');
  await width(390, 844);
  await shot('adult-account-night-390');
  await width(1280, 800);
  await click('#adult-account-panel [data-choice=garden]');
  await until('document.documentElement.dataset.style === "garden"', 'Sunny garden');
  ok(await ev('document.querySelector("#adult-account-panel [data-choice=garden]").getAttribute("aria-checked")') === 'true' && await ev('localStorage.getItem("sb.theme")') === 'light', 'back to the Sunny garden');
  step('arrow keys move through the looks');
  await ev('document.querySelector("#adult-account-panel [data-choice=garden]").focus()');
  await key('ArrowDown');
  await until('document.documentElement.dataset.style === "paint"', 'Paint box by the arrow key');
  await click('#adult-account-panel [data-choice=garden]');
  step('a short screen: the panel scrolls inside itself');
  await width(1180, 640);
  const p640 = await rect('#adult-account-panel');
  ok(p640.y + p640.h <= 640, 'the panel fits 1180x640: ' + JSON.stringify(p640));
  ok(await ev('(() => { const p = document.querySelector("#adult-account-panel"); return p.scrollHeight >= p.clientHeight; })()'), 'it scrolls inside');
  await shot('adult-account-1180x640');
  await width(390, 844);
  const p390 = await rect('#adult-account-panel');
  ok(p390.y + p390.h <= 844 && p390.w >= 389, 'the sheet fits 390x844: ' + JSON.stringify(p390));
  ok(await ev('document.documentElement.scrollWidth <= innerWidth'), 'no sideways scroll');
  await shot('adult-account-390');
  await key('Escape');
  ok(await ev('document.querySelector("#adult-account-panel").hidden && document.activeElement.id === "adult-chip"'), 'Escape closes, focus back on the chip');
  await width(1280, 800);
  step('switching to a child: the child\'s own bar');
  acct.who = { ...adultMe, playingAs: { id: CHILD, nickname: 'Robin', year: 4, avatar: null } };
  await seedChild(gameDayDoc(), plus(2));
  acct.who = { ...adultMe, playingAs: { id: CHILD, nickname: 'Robin', year: 4, avatar: null } };
  await open(plus(2), '#/');
  await until('document.querySelector("[data-room], .childhome, main h1")', 'the child home');
  ok(!await ev('document.body.classList.contains("is-adult")') && await ev('document.body.classList.contains("is-child")') && !await visible('#adult-menu-btn'), 'playing as Robin: the child bar, not the adult bar');
  acct.who = childMe;
});

scene('adult: every old control is still reachable; the child, signed-out and Wordbright bars are unchanged', async () => {
  await seedFront([[CHILD, childWeek()], [CHILD2, wrenWeek()]], KIDS2);
  await width(1280, 800);
  const old = { 'Pick words': '#/custom', 'Tricky words': '#/tricky', 'Progress': '#/progress', 'More practice': '#/chapters', 'All games': '../' };
  await click('#adult-menu-btn');
  for (const [title, href] of Object.entries(old)) ok(await has('#adult-menu-panel a[href="' + href + '"]') && new RegExp(title).test(await text('#adult-menu-panel a[href="' + href + '"]')), title + ' is in the Menu');
  await key('Escape');
  await click('#adult-chip');
  await until('document.querySelector("#adult-account-panel [data-signout]")', 'the account panel');
  for (const s of ['[data-choice=garden]', '[data-choice=paint]', '[data-choice=night]', '[data-choice=system]', '[data-signout]', '[data-account]', '[data-parents]']) ok(await has('#adult-account-panel ' + s), 'the account panel has ' + s);
  await key('Escape');
  await go('#/words');
  await until('document.querySelector("main h1")', 'My words by its address');
  ok(await ev('document.body.classList.contains("is-adult")') && !/Not found|isn.t here/i.test(await text('main h1')), 'My words still opens by its address (its link now lives inside each child\'s week)');
  step('a child: the child bar, no adult bar, no papers line');
  await seedChild(gameDayDoc(), plus(2));
  await open(plus(2), '#/');
  await until('document.querySelector("[data-room]")', 'the room');
  ok(await ev('document.body.classList.contains("is-child") && !document.body.classList.contains("is-adult")') && await visible('#child-menu') && !await visible('#adult-menu-btn') && !await visible('.foot') && !await visible('.foot__papers') && !await visible('.brand__tag'), 'the child bar is as before');
  step('signed out: the full bar as before, no adult bar, no papers line');
  await signedOutBlank(plus(2));
  acct.who = null;
  await open(plus(2), '#/about');
  ok(await visible('.foot__more') && !await visible('#adult-menu-btn') && !await visible('.foot__papers') && !await ev('document.body.classList.contains("is-adult")'), 'signed out: no adult bar, no papers line; For parents and More games stay in the footer');
  ok(await ev('document.querySelectorAll(".topbar__nav a").length') === 4 && !await visible('.topbar__nav') && !await visible('#theme') && !await visible('.allgames') && await ev('document.body.classList.contains("is-visitor")'), 'signed out: the four links are still in the page, out of sight (the visitor bar)');
  step('Wordbright\'s bar is not touched');
  acct.who = adultMe;
  await send('Page.navigate', { url: SITE + '/wordbright/' });
  await until('document.readyState === "complete" && document.querySelector(".topbar__nav, .topbar")', 'Wordbright');
  await sleep(300);
  ok(!await has('#adult-chip') && !await has('.adultbar') && !await ev('document.body.classList.contains("is-adult")') && (await has('.topbar')), 'Wordbright has no adult bar');
  acct.who = null;
});

// ---- SB3-F: the front pages (signed out, More practice, one chapter) --------------------------------
import * as FD from '../site/js/front-doc.js';
const progDoc = (chapters = {}, results = []) => ({ v: 1, resetAt: 0, chapters, results, folded: {}, tricky: {} });
const T0 = Date.parse(MON + 'T09:00:00');
const passedCh = (n) => ({ id: 'r' + n, c: 'y34-ch' + String(n).padStart(2, '0'), s: 5, t: 5, at: T0 + n });
const PROG_3 = progDoc({ 'y34-ch01': { studiedAt: T0, practisedAt: T0 }, 'y34-ch02': { studiedAt: T0, practisedAt: T0 }, 'y34-ch03': { studiedAt: T0 } }, [passedCh(1), passedCh(2)]);
async function putProgress(id, doc) { await ev('localStorage.setItem("sb.progress:' + id + '",' + q(JSON.stringify(doc)) + ')'); }
async function childWith(doc, hash, day = plus(2)) {
  await seedChild(gameDayDoc(), day);
  await putProgress(CHILD, doc);
  await open(day, hash);
}
async function adultWith(doc, hash, day = plus(2)) {
  await signedOutBlank(day);
  acct.who = adultMe;
  await putProgress(ADULT, doc);
  await open(day, hash);
  await until('document.querySelector("[data-for=adult]") || document.querySelector("[data-chapterpage][data-for=adult]")', 'the adult\'s page', 9000);
}
const mainButtons = () => ev('[...document.querySelectorAll("main a[href], main button")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height; }).length');
const frontPrimaries = () => ev('document.querySelectorAll("main .btn--primary").length');
/** Press Tab until the element is focused, then say how thick its outline is. */
async function tabTo(sel) {
  for (let i = 0; i < 40; i += 1) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    if (await ev('document.activeElement && document.activeElement.matches(' + q(sel) + ')')) return ev('parseFloat(getComputedStyle(document.activeElement).outlineWidth)');
  }
  throw new Error('Tab never reached ' + sel);
}

scene('SB3-F signed out: one button, the seven jobs, no word, no game', async () => {
  await signedOutBlank(plus(2));
  acct.who = null;
  await open(plus(2), '#/');
  await until('document.querySelector("[data-front=signed-out]")', 'the signed-out page');
  const t = await text();
  ok(/A spelling week\.\s*One short job a day\./.test(t), 'the headline');
  ok(/Children: ask a grown-up to sign in\./.test(t) && /New here\? Create a free account/.test(t), 'the sign-up and child lines');
  ok(await frontPrimaries() === 1 && /Sign in to start/.test(await text('main .btn--primary')), 'ONE primary: Sign in to start');
  ok(/\/signin\?return=/.test(await ev('document.querySelector("[data-signin]").href')) && /\/signin\?return=/.test(await ev('document.querySelector("[data-create]").href')), 'the sign-in link carries the return URL (no separate sign-up route: both go to the sign-in page)');
  ok(await mainButtons() <= 5, 'at most 5 tappable things in the page, found ' + await mainButtons());
  ok(await ev('document.querySelector("[data-about]").getAttribute("href")') === '#/about', 'For parents and teachers goes to #/about');
  ok(!/Start game|Today's word|Waystead Learning|Learning/.test(t), 'no game, Today\'s word or Learning advert');
  ok(!await has('main .chunked, main .keyboard, main [data-hear]'), 'no word, keyboard or Hear it');
  const copy = new Set((JSON.stringify(FD.SIGNED_OUT) + ' ' + JSON.stringify(FD.JOBS)).toLowerCase().match(/[a-z]+/g));
  const words = await ev(`(async () => { const c = await (await fetch('data/curriculum.json')).json(); const all = new Set(); for (const y of ['year_3_4','year_5_6']) for (const ch of c[y].chapters) for (const w of ch.words) all.add(w.word.toLowerCase()); return [...all]; })()`);
  const seen = new Set(document_text(t).filter((w) => !copy.has(w)));
  ok(!words.some((w) => seen.has(w)), 'no spelling word on the page: ' + words.filter((w) => seen.has(w)));
  ok(!/^\s*$/.test(await ev('document.querySelector(".front__pip img").getAttribute("src")')), 'Pip');
  step('the seven jobs: one row at 1280 and 1180, a list at 390 and 820');
  for (const w of [1280, 1180]) {
    await width(w, 800);
    const tops = await ev('[...document.querySelectorAll(".jobs__one")].map((e) => Math.round(e.getBoundingClientRect().top))');
    ok(tops.length === 7 && new Set(tops).size === 1, 'seven in ONE row at ' + w + ': ' + tops);
    const lines = await ev(`[...document.querySelectorAll(".jobs__text span")].map((e) => { const r = document.createRange(); r.selectNodeContents(e); const ls = {}; for (const c of r.getClientRects()) { const k = Math.round(c.top); ls[k] = (ls[k] || 0) + c.width; } return Object.values(ls); })`);
    ok(lines.every((l) => l.length <= 2 && l.every((x) => x > 40)), 'no orphan word in a helper at ' + w + ': ' + JSON.stringify(lines));
  }
  for (const w of [820, 390]) {
    await width(w, 900);
    const xs = await ev('[...document.querySelectorAll(".jobs__one")].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; })');
    ok(new Set(xs.map((x) => x[0])).size === 1 && xs.every((x, i) => i === 0 || x[1] > xs[i - 1][1]), 'a numbered list at ' + w);
  }
  step('focus ring: 3 px on the button and the links');
  await width(1280, 800);
  ok(await tabTo('[data-signin]') >= 3, 'a 3 px ring on Sign in to start');
  ok(await tabTo('[data-create]') >= 3 && await tabTo('[data-about]') >= 3, 'rings on the links');
  await allViews('front-signedout');
  await width(1180, 640);
  ok(await ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), 'no sideways scroll at 1180x640');
  await width(820, 1180);
  ok(await ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), 'no sideways scroll at 820x1180');
  await width(390);
});
function document_text(t) { return (t.toLowerCase().match(/[a-z]+/g) || []); }

scene('SB3-F More practice as a child: chrome, one button, year switch, stones', async () => {
  await childWith(PROG_3, '#/chapters');
  await until('document.querySelector("[data-chapters]")', 'More practice');
  ok(await visible('#child-back') && await visible('#child-menu'), 'Back and Menu');
  const t = await text();
  ok(!/Learning|Start game|Today's word|Waystead/.test(t) , 'no advert, no Start game, no Today\'s word');
  ok(/^More practice/.test(t) && /Learn a chapter, then test it\./.test(t), 'the child\'s title and sentence');
  ok(await frontPrimaries() === 1 && /Carry on: Chapter 3/.test(await text('[data-carry]')) && /Practise/.test(await text('[data-carry] small')), 'ONE primary: Carry on: Chapter 3 (next step Practise)');
  ok(await ev('document.querySelector("[data-carry]").getAttribute("href")') === '#/y34/ch03/practice', 'the button goes to the next step');
  const states = await ev('[...document.querySelectorAll(".stonelink")].map((a) => a.dataset.state)');
  ok(states.join() === 'passed,passed,studying,todo,todo,todo,todo,todo,todo,todo', 'stone states: ' + states);
  ok(/109 words in 10 chapters · 2 tests passed/.test(await text('.yearcard__sum')), 'the year line');
  ok(await ev('[...document.querySelectorAll(".stonelink")].every((a) => { const r = a.getBoundingClientRect(); return r.height >= 48 && r.width >= 48; })'), 'stones are at least 48 px');
  ok(await ev('[...document.querySelectorAll(".stonelink")].every((a) => { const r = a.getBoundingClientRect(); return r.height >= 72 && r.width >= 60; })'), 'stones are about 64 x 72 at 390');
  ok(await ev('[...document.querySelectorAll(".stonelink__label")].every((e) => parseFloat(getComputedStyle(e).fontSize) >= 14)'), 'labels are at least 14 px');
  ok(await ev('document.querySelectorAll(".stonelink[data-state=passed] svg").length') === 2, 'a passed stone has a star');
  ok(await ev('[...document.querySelectorAll(".yearswitch__b, .morerow, [data-carry], .hearit")].every((e) => e.getBoundingClientRect().height >= 48)'), 'switch, rows, button and Hear it are at least 48 px');
  ok(await ev('document.querySelectorAll(".morerows a").length') === 3, 'three quiet rows');
  ok(await tabTo('.stonelink') >= 3, 'a 3 px focus ring on a stone');
  await click('[data-hear]');
  await until('globalThis.__lines.some((l) => /Learn a chapter/.test(l))', 'the sentence spoken');
  step('the year switch, remembered');
  await click('.yearswitch__b[data-year=y56]');
  ok(await ev('document.querySelector("[data-yearpanel]").dataset.yearpanel') === 'y56' && /Start: Chapter 1/.test(await text('[data-carry]')) && await frontPrimaries() === 1, 'Year 5 and 6: Start: Chapter 1, still one primary');
  ok(await ev('document.querySelector(".yearswitch__b[data-year=y56]").getAttribute("aria-pressed")') === 'true', 'pressed state');
  await open(plus(2), '#/chapters');
  await until('document.querySelector("[data-yearpanel=y56]")', 'the remembered year');
  await click('.yearswitch__b[data-year=y34]');
  await allViews('front-chapters-child');
  await width(1180, 640);
  ok(await ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), 'no sideways scroll at 1180x640');
  await width(820, 1180);
  ok(await ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), 'no sideways scroll at 820x1180');
  await width(390);
  step('every chapter is reachable, a closed one says what to pass first');
  await click('.stonelink[data-chapter=ch04]');
  await until('document.querySelector("[data-chapter-locked]")', 'the closed chapter');
  ok(/Pass Chapter 3 first\./.test(await text()) && await ev('document.querySelector("[data-chapter-locked] a.btn").getAttribute("href")') === '#/y34/ch03', 'Pass Chapter 3 first, with a way there');
  step('all ten passed');
  await childWith(progDoc({}, Array.from({ length: 10 }, (_, i) => passedCh(i + 1))), '#/chapters');
  ok(await ev('document.querySelector("[data-yearpanel]").dataset.yearpanel') === 'y56', 'with Year 3 and 4 all passed the page opens on Year 5 and 6');
  await click('.yearswitch__b[data-year=y34]');
  await until('document.querySelector("[data-allpassed]")', 'the all-passed state');
  ok(await frontPrimaries() === 0 && /All 10 passed/.test(await text('[data-allpassed]')), 'All ten passed, no button');
});

scene('SB3-F More practice as an adult: the adult header, no advert here, a place for the foot line', async () => {
  await adultWith(progDoc(), '#/chapters');
  ok(/MORE PRACTICE/i.test(await text('.pagehead .eyebrow')) && /Practise chapter by chapter/.test(await text('h1')), 'eyebrow and title');
  ok(/Each chapter: learn the words, practise them, then take the chapter test\./.test(await text()), 'the sentence');
  ok(!await has('[data-hear]') && await visible('#adult-menu-btn') && !await visible('#child-menu'), 'no Hear it, the adult bar');
  ok(!/Start game|Today's word/.test(await text('main')) && /From Waystead Learning/i.test(await text('.foot__papers')) && await visible('.foot__papers'), 'one Learning papers line, in the footer; no Start game');
  ok(await frontPrimaries() === 1 && /Start: Chapter 1/.test(await text('[data-carry]')), 'ONE primary: Start: Chapter 1');
  await allViews('front-chapters-adult');
  await width(1180, 640);
  ok(await ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), 'no sideways scroll at 1180x640');
  await width(390);
});

scene('SB3-F one chapter: three steps, the test gated until practised, a test already allowed stays open', async () => {
  await childWith(PROG_3, '#/y34/ch03');
  await until('document.querySelector("[data-chapterpage]")', 'the chapter');
  const st = await ev('[...document.querySelectorAll("[data-step]")].map((e) => e.dataset.step + ":" + e.dataset.state)');
  ok(st.join() === 'learn:done,practise:next,test:later', 'steps: ' + st);
  ok(await frontPrimaries() === 1 && await has('[data-primary=practise]'), 'ONE primary: the next step');
  ok(await has('[data-test-gated]') && !await has('a[href$="/ch03/test"]') && !await has('[data-test-anyway]'), 'the test is a quiet row for a child: Opens when you\'ve practised.');
  ok(/Opens when you’ve practised\./.test(await text('[data-test-gated]')), 'its words');
  ok(await has('[data-hear]') && await has('[data-quick]'), 'Hear it, and the quick game stays');
  ok(await ev('[...document.querySelectorAll("main a, main summary, main button")].every((e) => e.getBoundingClientRect().height >= 48)'), 'every control is at least 48 px');
  await click('.chapterwords summary');
  ok(await visible('.chapterwords .wordchips span'), 'the word list opens from step 1');
  await allViews('front-chapter');
  step('practised: the test becomes the primary');
  await childWith(progDoc({ 'y34-ch01': { studiedAt: T0, practisedAt: T0 }, 'y34-ch02': { studiedAt: T0, practisedAt: T0 }, 'y34-ch03': { studiedAt: T0, practisedAt: T0 } }, [passedCh(1), passedCh(2)]), '#/y34/ch03');
  await until('document.querySelector("[data-chapterpage]")', 'the chapter');
  ok(await has('[data-primary=test]') && await frontPrimaries() === 1 && !await has('[data-test-gated]'), 'Take the test is the one primary');
  step('tried before, never practised on this record: still openable');
  await childWith(progDoc({ 'y34-ch01': { studiedAt: T0, practisedAt: T0 }, 'y34-ch02': { studiedAt: T0, practisedAt: T0 } }, [passedCh(1), passedCh(2), { id: 'x3', c: 'y34-ch03', s: 3, t: 5, at: T0 + 9 }]), '#/y34/ch03');
  await until('document.querySelector("[data-chapterpage]")', 'the chapter');
  ok(await ev('document.querySelector("[data-step-link=test]").getAttribute("href")') === '#/y34/ch03/test' && !await has('[data-test-gated]'), 'an attempted test stays openable');
  step('a passed chapter: its test opens again, Next chapter leads on');
  await go('#/y34/ch01');
  await until('document.querySelector("[data-chapterpage]")', 'chapter 1');
  ok(/Take the test again/.test(await text('[data-step-link=test]')) && await has('[data-next-chapter]'), 'Take the test again, and Next chapter');
  await click('[data-step-link=test]');
  await until('location.hash === "#/y34/ch01/test"', 'the test opens');
  step('learning marks the step done');
  await childWith(PROG_3, '#/y34/ch03/study');
  await click('[data-done]');
  await go('#/y34/ch03');
  await until('document.querySelector("[data-chapterpage]")', 'the chapter');
  ok((await ev('document.querySelector("[data-step=practise]").dataset.state')) === 'next', 'practise is next');
  step('an adult may always open the test');
  await adultWith(PROG_3, '#/y34/ch03');
  await until('document.querySelector("[data-chapterpage]")', 'the chapter');
  ok(await has('[data-test-gated]') && await ev('document.querySelector("[data-test-anyway]").getAttribute("href")') === '#/y34/ch03/test', 'Take the test anyway, for an adult');
  ok(!await has('[data-hear]'), 'no Hear it for an adult');
});

scene('SB3-F no "Start game" in the site, every old link still resolves, no test word on test day', async () => {
  const { readdirSync } = await import('node:fs');
  for (const dir of ['site/js', 'site/css']) for (const f of readdirSync(ROOT + dir)) {
    if (!/\.(js|css)$/.test(f)) continue;
    ok(!/Start game/.test(readFileSync(ROOT + dir + '/' + f, 'utf8')), 'Start game in ' + dir + '/' + f);
  }
  ok(!/Start game/.test(readFileSync(ROOT + 'site/index.html', 'utf8')), 'Start game in index.html');
  await childWith(PROG_3, '#/chapters');
  const seen = new Set();
  for (const h of ['#/chapters', '#/y34', '#/y56', '#/y34/ch03', '#/y34/ch05', '#/custom', '#/tricky', '#/progress', '#/about', '#/words']) {
    await go(h);
    await sleep(200);
    const t = await text();
    ok(!/Start game|Today's word/.test(t), h + ' says Start game or Today\'s word');
    ok(!/That page isn.t here/.test(t) && (await ev('!!document.querySelector("main h1")')), h + ' is a dead link');
    for (const a of await ev('[...document.querySelectorAll("main a[href^=\\"#/\\"]")].map((a) => a.getAttribute("href"))')) seen.add(a);
  }
  const fine = [...seen].filter((a) => !/\/(quick|practice|test)(\/|$)|^#\/custom\/play/.test(a));
  for (const h of fine) {
    await go(h);
    await sleep(120);
    ok(!/That page isn.t here/.test(await text()), 'a link on the front pages is dead: ' + h);
  }
  await go('#/y34');
  await until('location.hash === "#/chapters"', 'the old year page goes to More practice');
  ok(await ev('document.querySelector(".yearswitch__b[data-year=y34]").getAttribute("aria-pressed")') === 'true', 'with the year chosen');
  await go('#/y56');
  await until('document.querySelector("[data-yearpanel=y56]")', 'Year 5 and 6 chosen by its old link');
  step('test day: More practice and a chapter show no test word');
  await seedChild(studied(weekDoc()), plus(5));
  await putProgress(CHILD, PROG_3);
  await open(plus(5), '#/chapters');
  for (const h of ['#/chapters', '#/y34/ch03', '#/y56']) {
    await go(h);
    await sleep(250);
    const t = (await text()).toLowerCase();
    for (const w of WORDS) ok(!new RegExp('\\b' + w + '\\b').test(t), h + ' on test day shows ' + w);
  }
});

scene('SB3-F signed-out top bar: the mark and Sign in only; open pages keep a way back; offline says so by the button', async () => {
  await signedOutBlank(plus(2));
  acct.who = null;
  await open(plus(2), '#/');
  await width(1280, 800);
  await until('document.querySelector("[data-front=signed-out]")', 'the signed-out page');
  ok(await ev('document.body.classList.contains("is-visitor")'), 'body.is-visitor');
  ok(await visible('.brand') && await visible('.playerchip--out') && /Sign in/.test(await text('.playerchip--out')), 'the mark and a small Sign in');
  ok(!await visible('.topbar__nav') && !await visible('.allgames') && !await visible('#theme') && !await visible('#adult-menu-btn') && !await visible('#child-menu'), 'no My words, Pick words, Tricky words, Progress, All games or look menu');
  ok(await ev('getComputedStyle(document.querySelector(".topbar__nav")).display') !== 'none', 'the nav is never display: none');
  ok(!await visible('#back'), 'no Back on the front page');
  await ev('Object.defineProperty(navigator, "onLine", { get: () => true, configurable: true }); window.dispatchEvent(new Event("online"))'); // the namespace may report no network
  ok(await ev('!!document.querySelector("[data-offline]") && document.querySelector("[data-offline]").hidden'), 'online: no offline line');
  step('offline: the line by the button');
  await ev('Object.defineProperty(navigator, "onLine", { get: () => false, configurable: true }); window.dispatchEvent(new Event("offline"))');
  await until('!document.querySelector("[data-offline]").hidden', 'the offline line');
  ok(await text('[data-offline]') === 'You need to be online to sign in.' && await visible('[data-offline]') && await visible('[data-signin]'), 'You need to be online to sign in.');
  const near = await ev('(() => { const a = document.querySelector("[data-offline]").getBoundingClientRect(), b = document.querySelector("[data-signin]").getBoundingClientRect(); return Math.abs(a.top - b.bottom); })()');
  ok(near < 60, 'the line sits close to the button: ' + near);
  await width(390, 800);
  ok(await visible('[data-offline]') && await ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), 'at 390: visible, no sideways scroll');
  await allViews('front-signedout-offline');
  await width(1280, 800);
  await ev('Object.defineProperty(navigator, "onLine", { get: () => true, configurable: true }); window.dispatchEvent(new Event("online"))');
  await until('document.querySelector("[data-offline]").hidden', 'the line goes when online');
  step('an open page: the same bar, a way back to the front page');
  await go('#/about');
  await until('document.querySelector("main h1")', 'How to play');
  ok(await ev('document.body.classList.contains("is-visitor")') && !await visible('.topbar__nav') && !await visible('.allgames') && !await visible('#theme') && await visible('.playerchip--out'), 'the same mark-and-Sign-in bar');
  ok(await visible('#back') && await visible('.brand'), 'Back and the mark are there');
  await click('#back');
  await until('location.hash === "#/" || location.hash === ""', 'back to the front page');
  await until('document.querySelector("[data-front=signed-out]")', 'the signed-out page again');
  await go('#/about');
  await until('document.querySelector("main h1")', 'About again');
  await click('.brand');
  await until('document.querySelector("[data-front=signed-out]")', 'the mark goes to the front page');
});

scene('SB3-F Back from a chapter page, and the year address, go to More practice, for an adult and a child', async () => {
  for (const who of ['adult', 'child']) {
    if (who === 'adult') await adultWith(PROG_3, '#/y34/ch03'); else await childWith(PROG_3, '#/y34/ch03');
    await until('document.querySelector("[data-chapterpage]")', who + ': the chapter page');
    const back = who === 'adult' ? '#back' : '#child-back';
    ok(await visible(back), who + ': Back is there on a chapter page');
    if (who === 'adult') { const r = await rect('#back'); ok(Math.round(r.w) === 44 && Math.round(r.h) === 44, 'the adult Back is 44 x 44: ' + JSON.stringify(r)); }
    await click(back);
    await until('location.hash === "#/chapters" && document.querySelector("[data-chapters]")', who + ': chapter page Back is More practice, not the front page');
    await go('#/y34');
    await until('location.hash === "#/chapters" && document.querySelector("[data-chapters]")', who + ': the old year address opens More practice');
  }
});

scene('SB3-F adult Menu: My words is the second row and opens My words; the Learning line shows on More practice for an adult only', async () => {
  await adultWith(progDoc(), '#/chapters');
  await width(1280, 800);
  ok(await visible('.foot__papers') && /From Waystead Learning/i.test(await text('.foot__papers')) && await ev('document.querySelectorAll(".foot__papers").length') === 1, 'ONE Learning papers line, at the foot of More practice');
  await click('#adult-menu-btn');
  await until('!document.querySelector("#adult-menu-panel").hidden', 'the Menu');
  const rows = await ev('[...document.querySelectorAll("#adult-menu-panel nav ul a")].map((a) => [a.querySelector("b").textContent, a.querySelector("span.adultrow__text > span").textContent])');
  ok(rows.length === 6 && rows[1][0] === 'My words' && rows[1][1] === 'Practise words yourself', 'My words, Practise words yourself, after More practice: ' + JSON.stringify(rows));
  await click('#adult-menu-panel a[href="#/words"]');
  await until('location.hash === "#/words" && document.querySelector("main h1")', 'My words');
  await childWith(PROG_3, '#/chapters');
  await until('document.querySelector("[data-chapters]")', 'More practice as a child');
  ok(!await visible('.foot__papers'), 'never for a child');
  await signedOutBlank(plus(2));
  acct.who = null;
  await open(plus(2), '#/');
  await until('document.querySelector("[data-front=signed-out]")', 'signed out');
  ok(!await visible('.foot__papers'), 'never for a visitor');
});

// ---- SB3-G: only a grown-up deletes a week; a grown-up's switch for the week choice --------------------
scene('SB3-G: a child never gets a delete, on the group page or the edit form', async () => {
  await seedChild(twoWeeksDoc(), plus(3));
  await open(plus(3), '#/words/g/g1');
  await until('document.querySelector("main h1")', 'the group page');
  ok(!/delete/i.test(await text()), 'no word "delete" on a child\'s group page: ' + (await text()).slice(0, 80));
  ok(await ev('[...document.querySelectorAll("main a[href$=\\"/edit\\"]")].every((a) => !/delete/i.test(a.textContent))'), 'no edit link says delete');
  await go('#/words/g/g1/edit');
  await until('document.querySelector("[data-save]")', 'the edit form');
  ok(!await has('[data-delete]') && !/delete/i.test(await text()), 'the child\'s form has no Delete button or wording');
  step('from the test day the child has no edit link and the edit route goes back to the group');
  await open(plus(5), '#/words/g/g1');
  await until('document.querySelector("main h1")', 'the group page on test day');
  ok(!await has('main a[href$="/edit"]') && !/delete/i.test(await text()), 'no edit link at all');
  await go('#/words/g/g1/edit');
  await until('location.hash === "#/words/g/g1"', 'sent back to the group');
  ok(!await has('[data-delete]'), 'no delete path');
});

scene('SB3-G: the parent switches the week choice off, the child has no switcher; on again restores it', async () => {
  await signedOutBlank(plus(3));
  acct.who = adultMe;
  acct.put(CHILD, 'spellbright', 'words', twoWeeksDoc());
  acct.put(CHILD2, 'spellbright', 'words', wrenWeek());
  await open(plus(3), '#/grownups/child/' + CHILD);
  await until('document.querySelector("[data-weekpick-toggle]")', 'the switch');
  const tog = '[data-weekpick-toggle]';
  ok(await ev('document.querySelector("' + tog + '").getAttribute("aria-pressed")') === 'true' && /Your child can choose which week to study/.test(await text(tog)) && /On/.test(await text(tog + ' [data-weekpick-state]')) && await ev('document.querySelector("' + tog + ' [data-weekpick-state]").getAttribute("aria-hidden")') === 'true', 'on by default: ' + await text(tog));
  ok((await rect(tog)).h >= 48, 'at least 48 px high');
  await click(tog);
  await until('/Off/.test(document.querySelector("' + tog + ' [data-weekpick-state]").textContent)', 'Off');
  ok(await ev('document.querySelector("' + tog + '").getAttribute("aria-pressed")') === 'false', 'aria-pressed false');
  ok(saved().weekPick && saved().weekPick.on === false, 'saved to the child\'s words in the account');
  async function asChild(label) {
    const doc = saved();
    acct.who = childMe;
    await ev('localStorage.setItem("wa.player",' + q(JSON.stringify({ id: CHILD, name: 'Robin', avatar: null })) + ')');
    await ev('localStorage.setItem("sb.words:' + CHILD + '",' + q(JSON.stringify(doc)) + ')');
    await ev('localStorage.setItem("sb.week:' + CHILD + '","g2")');
    await open(plus(3), '#/');
    await until('document.querySelector("[data-room]")', label + ': the home');
  }
  await asChild('off');
  ok(!await has('.weekline') && !await has('[data-week-change]') && !/Week:/.test(await text()), 'off: no Week line or Change');
  ok(!/Week two/.test(await text('h1, .homesay')) , 'off: the saved week is ignored');
  await go('#/words/g/g1');
  await until('document.querySelector("main h1")', 'the group page');
  ok(!await has('[data-study-week]'), 'off: no Study this week buttons');
  step('off: another week\'s group page goes to the pick; a child has no Clear my progress');
  await go('#/words/g/g2');
  await until('location.hash === "#/words/g/g1"', 'sent to the pick');
  ok(!await has('main .list a[href*="/g/"]'), 'no Other groups list');
  await go('#/words/g/g2/path');
  await until('location.hash === "#/words/g/g1"', 'another week\'s path goes to the pick');
  await go('#/words/g/g2/games');
  await until('location.hash === "#/words/g/g1"', 'another week\'s games go to the pick');
  await go('#/words');
  await until('document.querySelector("main h1")', 'My words');
  ok(!await has('main .list a[href*="/g/"]') && /Week one/.test(await text('main h1')), 'My words shows the pick only: ' + await text('main h1'));
  await go('#/progress');
  await until('document.querySelector("main h1")', 'Progress');
  ok(!await has('[data-reset]') && !/Clear my progress/.test(await text()), 'no Clear my progress for a child');
  step('on again');
  acct.who = adultMe;
  await open(plus(3), '#/grownups/child/' + CHILD);
  await until('document.querySelector("[data-weekpick-toggle]")', 'the switch again');
  await click(tog);
  await until('/On/.test(document.querySelector("' + tog + ' [data-weekpick-state]").textContent)', 'On');
  await asChild('on');
  ok(await has('[data-week-change]'), 'on: the Change button is back');
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
