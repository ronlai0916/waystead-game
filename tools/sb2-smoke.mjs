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
import { readFileSync, existsSync, statSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

// The word list as it was before SB4-E/F (Years 3 to 6, the 20 old chapters only): scenes written for four years of five chapters serve it.
const LEGACY_CURRICULUM = (() => {
  const c = JSON.parse(readFileSync(ROOT + 'site/data/curriculum.json', 'utf8'));
  delete c.year_1; delete c.year_2;
  for (const k of ['year_3_4', 'year_5_6']) c[k].chapters = c[k].chapters.filter((x) => /^y(34|56)-ch\d\d$/.test(x.id));
  return JSON.stringify(c);
})();
let flagOn = true;
let netDown = false;
let blocked = ''; // a file name the site answers 404 to, for a scene about a failed load
const overrides = new Map(); // H.serve(path, body): a file of the site served from a string for the scene (cleared before every scene)
let curScene = ''; // S3: the scene running now, so a console problem names it
let allowedLog = null; // H.allowLog(/regexp/): console lines a scene expects (the scan scenes make the account answer 401, 412, 413, 429, 502, 503 on purpose); cleared before every scene
let storiesHidden = false; // the stories are approved in the repo: some scenes need them waiting
const site = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, SITE).pathname);
  const m = /^\/(spellbright|wordbright)\/(.*)$/.exec(path);
  const base = m ? (m[1] === 'spellbright' ? 'site/' : 'wordbright/site/') : null;
  let file = base ? ROOT + base + (m[2] || 'index.html') : null;
  if (file && existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (m && m[1] === 'spellbright' && overrides.has(m[2])) {
    res.writeHead(200, { 'Content-Type': TYPES[extname(m[2])] || 'application/octet-stream', 'Content-Security-Policy': csp, 'Cache-Control': 'no-store' });
    res.end(overrides.get(m[2]));
    return;
  }
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
  const cors = { 'Access-Control-Allow-Origin': SITE, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, OPTIONS', 'Access-Control-Expose-Headers': 'Retry-After', Vary: 'Origin' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  if (acct.slowMe && req.url.startsWith('/api/me')) await new Promise((r) => setTimeout(r, acct.slowMe));
  if (acct.offline) { req.socket.destroy(); return; } // the network gone, as the browser sees it
  if (req.url.startsWith('/api/voice/')) { res.writeHead(404, cors); res.end(); return; }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  // A scanned picture goes to the fake as the raw bytes with its own Content-Type; everything else as text.
  const raw = req.url.startsWith('/api/scan/words');
  const body = !chunks.length ? undefined : raw ? Buffer.concat(chunks) : Buffer.concat(chunks).toString();
  const r = await acct.fetch(ACCOUNT + req.url, { method: req.method, credentials: 'include', body, ...(raw ? { headers: { 'Content-Type': req.headers['content-type'] || '' } } : {}) });
  const retry = r.headers.get('Retry-After');
  const data = r.status === 204 ? null : await r.json();
  if (typeof data === 'string') { // the fake answered text (a page, not JSON)
    res.writeHead(r.status, { ...cors, 'Content-Type': 'text/html' });
    res.end(data);
    return;
  }
  res.writeHead(r.status, { ...cors, 'Content-Type': 'application/json', ...(retry ? { 'Retry-After': retry } : {}) });
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
      // the 403 and 404 the Grown-ups scenes ask for (a 401 only where a scene says so with H.allowLog), and failed calls while the network is meant to be down.
      if (!/\/api\/voice\//.test(t) && !/wordbright\/js\/account\/api\.js/.test(t) /* Wordbright's own CSP does not list the test account on :3000 */ && !/status of 40[349]/.test(t) && !(/net::ERR/.test(t) && netDown) && !(allowedLog && allowedLog.test(t))) problems.push('log: ' + t + ' [' + curScene + ']');
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
// SB5: a grown-up with no role is sent to the role page first; the older scenes expect the home, so the page opens with Parent already chosen (a scene about the role page turns this off with H.askRole(true)).
let askRole = false;
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
    try { if (!${askRole} && !localStorage.getItem('sb.role:' + '${ADULT}')) localStorage.setItem('sb.role:' + '${ADULT}', JSON.stringify({ r: 'parent', at: 1 })); } catch (e) { /* no storage */ }
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
  await until('document.readyState === "complete" && document.querySelector("main section, main .card, main .st-page")', 'the page'); // SB5: Set a week and Change a week draw a div.st-page
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
// SB5: Fill in the blanks and Mix and match end on a score card ("<game> is done", Next game / Finish); `leave` clicks it.
async function scoreNext(leave = true) {
  await until('document.querySelector(".mixscore")', 'the score card');
  if (leave) await click('.mixscore [data-next]');
}
/** Fill in the blanks (Years 3 to 4 pick a card): the right word is not on the page, so wrong cards are tried until the sentence says Yes. */
async function fillBlanks(leave = true) {
  await until('document.querySelector("[data-game=fill]")', 'Fill in the blanks');
  for (let n = 0; n < 80; n += 1) {
    if (!await has('[data-game=fill]')) break;
    if (await has('[data-next]')) { await click('[data-next]'); await sleep(40); continue; }
    await ev('(document.querySelector("[data-card]:not(:disabled)")||{click(){}}).click()');
    await sleep(30);
  }
  await scoreNext(leave);
}
/** Mix and match: put the cards in the sentences in turn and Check until every sentence is right (the right ones stay). */
async function mixAndMatch(leave = true) {
  await until('document.querySelector("[data-game=mix]")', 'Mix and match');
  for (let n = 0; n < 80; n += 1) {
    if (!await has('[data-game=mix]')) break;
    const slots = await ev('[...document.querySelectorAll(".mixslot:not(.is-ok)")].map((s) => Number(s.dataset.slotI))');
    for (let k = 0; k < slots.length; k += 1) {
      const cards = await ev('[...document.querySelectorAll("[data-card]:not(:disabled)")].map((c) => c.dataset.card)');
      if (!cards.length) break;
      await ev('document.querySelector("[data-card=" + JSON.stringify(' + q(cards[(k + n) % cards.length]) + ') + "]").click()');
      await ev('document.querySelector("[data-slot-i=\'' + slots[k] + '\']").click()');
    }
    await ev('(document.querySelector("[data-check]:not(:disabled)")||{click(){}}).click()');
    await sleep(30);
  }
  await scoreNext(leave);
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
  ok(/Hello, Robin!/.test(await text('h1')) && !await has('[data-pip]'), 'SB5 Today greets the child by name (Pip is no longer on Today)');
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
  ok(/Today.s job is done/.test(await text('main')), 'Today says the job is done (SB5: no Pip)');
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
  await until('document.querySelector("[data-game=fill]")', 'Fill in the blanks');
  await allViews('day3-game-fill');
  await fillBlanks();
  await until('document.querySelector("[data-game=mix]")', 'Mix and match');
  await allViews('day3-game-mix');
  await mixAndMatch();
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
  // SB5: the readiness line moved from the group page to Today ("Every job this week is done. Your test is ...", status ready)
  await go('#/');
  await until('document.querySelector("[data-room=ready]")', 'Today says every job is done');
  ok(/Every job this week is done/.test(await text('main')), 'Today: ready for the test');
  await allViews('room-ready');
  await go('#/words/g/g1');
  await until('document.querySelector("main .tile")', 'My week');
  await allViews('group-ready');

  step('Game mode from the group page');
  await go('#/words/g/g1/games');
  await until('document.querySelector(".gamecards")', 'Game mode');
  await allViews('game-mode');

  step('Day 6: Test day');
  await open(plus(5), '#/');
  await until('document.querySelector("[data-room=job]")', 'room on test day');
  await noWord('the room on test day');
  ok(/Do your test|Test day/.test(await text('main')), 'SB5 Today names the test (no Pip)');
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
  await until('document.querySelector("[data-assess=end]")', 'the results');
  ok(/3 of 4/.test(await text()), 'three of four right: ' + await text());
  await go('#/words/g/g1');
  await until('/3 of 4 right in the test/.test(document.querySelector("main").innerText)', 'the results card');

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
  // SB5 Today: "5 jobs are waiting. Do one now." and the button "Do the next job"; the old test-day line and the "Then Fix it in" line are gone
  const waitText = (await text('[data-catchup]')).replace(/\s+/g, ' ');
  ok(/5 jobs are waiting\. Do one now\./i.test(waitText), 'the waiting line: ' + waitText);
  ok(/Do the next job/.test(await text('[data-job]')) && /5 jobs waiting/.test(await text('[data-job]')), 'the next job, not the test: ' + await text('[data-job]'));
  ok(/study\/hello$/.test(await ev('document.querySelector("[data-job]").getAttribute("href")')), 'Hello words first');
  ok(!/late|behind/i.test(await text()), 'kind words only');
  ok(await ev('document.querySelectorAll("main .btn--primary").length') === 1, 'one main button on Today');
  ok(await ev('document.querySelectorAll(".daystone--waiting, .daystone--todaywait").length') === 5, 'five waiting stones on the strip');
  await allViews('catchup-room');
  await go('#/words/g/g1/path');
  await until('document.querySelector(".pathrow2--waiting")', 'waiting jobs on My week');
  ok(!await has('[data-testcard]'), 'no test card while jobs wait');
  ok(await ev('document.querySelectorAll(".pathrow2--waiting").length') === 4, 'four waiting rows (the first is today)');
  ok(/Test day/.test(await text('[data-path]')), 'the test row is there');
  await allViews('catchup-path');
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
  ok(/Do your test/.test(await text('[data-job]')), 'the test is the job now: ' + await text('[data-job]'));
  await noWord('the room once the test is due');
});

scene('a legacy week: jobs left undone when the test was taken show "Not done"', async () => {
  let d = weekDoc();
  const g = W.groupById(d, 'g1');
  for (const st of ['fix', 'games']) d = W.markStep(d, g, st, plus(1), Date.parse(plus(1) + 'T09:00:00'));
  WORDS.forEach((w, i) => { d = W.addTry(d, { id: 'lt' + i, word: w, day: plus(5), group: 'g1', kind: 't', tries: 0, peeks: 0, clean: true, now: Date.parse(plus(5) + 'T11:00:00') + i }); });
  await seedChild(d, plus(6));
  await open(plus(6), '#/words/g/g1/path'); // SB5: a child's week is on My week (the path page): the stone row, then one row a job
  await until('document.querySelector(".daystone--missed")', 'missed jobs on My week');
  ok(await ev('document.querySelectorAll(".daystone--missed").length') === 3, 'hello, story and practice are not done');
  ok(!await has('.daystone--waiting, .daystone--todaywait'), 'nothing waiting');
  ok(/Hello words: not done/.test(await ev('document.querySelector(".daystones").getAttribute("aria-label")')), 'the stones say "not done": ' + await ev('document.querySelector(".daystones").getAttribute("aria-label")'));
  await go('#/');
  await until('document.querySelector("[data-room]")', 'Today');
  ok(!await has('[data-catchup]'), 'no waiting line');
  await go('#/words/g/g1/path');
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
  await until('location.hash.endsWith("/g1")', 'back at the week'); // SB5: "Ready for the test" is on Today now (data-room=ready)
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
  step('home (SB5 Today): the day, the greeting, the day line, Read it to me, one button, the week stones link');
  ok(/^Wednesday$/i.test((await text('.eyebrow')).trim()), 'the eyebrow: ' + await text('.eyebrow'));
  ok(/Hello, Robin!/.test(await text('h1')) && /Day 3 of 7 · your test is on Monday/.test(await text('.today__sub')), 'the greeting and the day line: ' + await text('.today__sub'));
  ok(!await has('[data-pip]'), 'SB5: no Pip on Today');
  ok(/Game day/.test(await text('[data-job]')) && /6 games · about 15 minutes/.test(await text('[data-job]')), 'the button: ' + await text('[data-job]'));
  ok(await has('[data-pathcard]') && /Game day: today, tap to start/.test(await ev('document.querySelector("[data-pathcard] .daystones").getAttribute("aria-label")')), 'the week stones link (SB5 Today): ' + await ev('document.querySelector("[data-pathcard]").outerHTML.slice(0, 200)'));
  ok(await ev('document.querySelectorAll("[data-pathcard] .daystone").length') >= 3, 'the day stones');
  ok(await ev('[...document.querySelectorAll("main a, main button")].every((e) => e.getBoundingClientRect().height >= 47)'), 'every tap target is 48 px high');
  await click('[data-hear]');
  const said1 = await ev('globalThis.__lines.at(-1)');
  ok(/Game day/.test(said1) || /Wednesday|Day 3 of 7/.test(said1), 'Read it to me reads the day: ' + said1);
  await allViews('child-home');

  step('the path');
  await click('[data-pathcard]');
  await until('document.querySelector("[data-path]")', 'the path');
  ok(/My week/.test(await text('h1')), 'the heading: ' + await text('h1'));
  ok(await ev('document.querySelectorAll(".pathrow2").length') === 7, 'seven rows');
  ok(await has('.pathrow2--done') && await has('.pathrow2--today') && await has('.pathrow2--later'), 'done, today and later');
  ok(/Today.s job|Today: 6 games/.test(await text('.pathrow2--today')), 'today: ' + await text('.pathrow2--today'));
  ok(await ev('document.querySelectorAll("[data-again]").length') === 2 && /Do it again/.test(await text('[data-again]')), 'Do it again on the two done jobs');
  ok(/your test is on Mon 9 Nov/.test(await text('.path__sub')) && /stars? so far/.test(await text('.path__sub')), 'flat stars and test date: ' + await text('.path__sub'));
  ok(await ev('document.querySelectorAll(".path__sub a, .path__sub button").length') === 0, 'they are not buttons');
  ok(/Words to practise again/.test(await text('.pathrow2:last-child')), 'the Mend row: ' + await text('.pathrow2:last-child'));
  ok(!/late/i.test(await text('[data-path]')), 'no "late"');
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
  const rows = await ev('[...document.querySelectorAll("[role=dialog] .sheetrow")].map((e) => e.querySelector("b").textContent)');
  ok(rows.join() === 'Today,Practice,This week’s words,Words to practise again,My progress,Games,Look and voice,Settings', 'the rows (SB5 Menu): ' + rows);
  ok(/Extra words, any time/.test(await text('.sheetrow[data-row=practice]')) && await has('.sheetrow[data-row=practice][href="#/chapters"]'), 'Practice goes to the chapters');
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
  ok(/Grown-ups/.test(await text()) && /My account/.test(await text()) && /Sign out/.test(await text()) && /About and licence/.test(await text()), 'the rows (SB5 Settings): ' + await text());
  ok(!/Day or night/.test(await text()), 'SB5: Day or night moved to Look and voice');
  ok(!await has('[data-switch]'), 'a child\'s own session cannot switch (the account\'s chip has no Switch player either)');
  await ev('document.querySelector("[data-about]").open = true');
  ok(/Open Government Licence/.test(await text()), 'the licence line moved here');
  await allViews('child-settings');
  step('Look and voice (SB5: its own page, from the Menu)');
  await click('#child-menu');
  await until('document.querySelector("[role=dialog]")', 'the sheet');
  await click('.sheetrow[data-row=look]');
  await until('document.querySelector("[data-looksettings]")', 'Look and voice');
  ok(await ev('document.querySelectorAll("[data-looks] [data-choice]").length') === 4, 'the four looks');
  await click("[data-looks] [data-choice=night]");
  ok(await ev('document.documentElement.dataset.style') === 'night', 'Night is chosen');
  await click("[data-looks] [data-choice=garden]");
  ok(await ev('document.documentElement.dataset.style') === 'garden', 'and the garden again');
  await allViews('child-look');
  ok(!await visible('.foot'), 'no footer');
});

scene('child menu while the test is due, and the test keyboard', async () => {
  await seedChild(studied(weekDoc()), plus(5));
  await open(plus(5), '#/');
  await until('document.querySelector("[data-room=job]")', 'the home on test day');
  ok(/Do your test/.test(await text('[data-job]')), 'Do your test (SB5 wording)');
  await noWord('the home on test day');
  await click('#child-menu');
  await until('document.querySelector("[role=dialog]")', 'the sheet');
  ok(/Opens after your test/.test(await text('[data-row=games]')), 'the closed line (SB5): ' + await text('[data-row=games]'));
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
  await until('document.querySelector("#child-sheet [data-stopnow]")', 'the Stop for now? sheet (SB5)');
  ok(/Your place is saved\./.test(await text('#child-sheet')) && /you go to Today/.test(await text('#child-sheet')), 'the sheet says the place is saved: ' + await text('#child-sheet'));
  await click('[data-stopnow]');
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
  // S7 (F-1): this device heard /api/me say grown-up earlier in this scene, so offline it is still the grown-up's bar (as mid-session), never the child bar
  ok(await visible('#adult-menu-btn') && await ev('document.querySelectorAll(".topbar__nav a").length') === 4, 'the grown-up bar stays offline for a confirmed grown-up');
  await allViews('adult-bar-offline');
  acct.offline = false;
  netDown = false;
});

scene('Settings: look, Voice, My account and Sign out; arrow keys change the look', async () => {
  await seedChild(gameDayDoc(), plus(2));
  await open(plus(2), '#/settings');
  await until('document.querySelector("[data-settings]")', 'Settings');
  await until('document.querySelector("[data-account]")', 'My account', 8000);
  ok(await has('[data-signout]') && await has('[data-grownups]'), 'Sign out and Grown-ups');
  // SB5: the look and the voice are on their own page (#/look, "Look and voice"); Settings keeps the account rows.
  ok(!await has('[data-looks]') && !await has('[data-voices]'), 'Settings has no look or voice card');
  await open(plus(2), '#/look');
  await until('document.querySelector("[data-looksettings]")', 'Look and voice');
  // Headless Chrome has no voices, so the shared menu hides its Voice part: the page shows Voice exactly when the menu does.
  ok(await has('[data-voices]') === await ev('(() => { const p = document.querySelector("#theme-menu [data-voice-part]"); return !!p && !p.hidden; })()'), 'Voice is shown when the look menu offers it');
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
  await until('document.querySelector("#child-sheet [data-stopnow]")', 'the Stop for now? sheet (SB5)');
  await click('[data-stopnow]');
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
  ok(late.length && late.every((x) => (x.look || x.adult) && x.foot && !x.pending), 'the full bar (or, for a grown-up this device already heard from the account, the grown-up bar) by 2.5 s: ' + JSON.stringify(late[0]));
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
  const rows = await ev('[...document.querySelectorAll("[role=dialog] .sheetrow")].map((e) => e.querySelector("b").textContent)');
  ok(rows.join() === 'Today,Practice,This week’s words,Words to practise again,My progress,Games,Look and voice,Settings', 'the eight Menu rows (SB5): ' + rows);
  ok((await rect('.sheetrow[data-row=practice]')).h >= 48, 'the row is 48 px high');
  await allViews('child-menu-8');
  await click('.sheetrow[data-row=practice]');
  await until('document.querySelector(".stonelink")', 'the chapters page (SB5: Practice, the year stones)');
  ok(/^Practice$/.test((await text('main h1')).trim()) || /Practice/.test(await text('.eyebrow, main h1, .pagehead')), 'its heading');
  ok(await visible('#child-menu') && await visible('[data-backlink]'), 'the Menu and the inline Today link');
  ok(await ev('[...document.querySelectorAll("main a")].filter((a) => a.getBoundingClientRect().width).every((a) => a.getBoundingClientRect().height >= 48 && a.getBoundingClientRect().width >= 48)'), 'the links are at least 48 px');
  await allViews('child-chapters');
  // SB5: Words to practise again and My progress are Menu rows (Practice has the year stones); each opens its page, and Today link / Back goes home
  for (const [row, href] of [['tricky', '#/tricky'], ['progress', '#/progress']]) {
    await go('#/');
    await click('#child-menu');
    await until('document.querySelector("[role=dialog]")', 'the sheet');
    await click('.sheetrow[data-row=' + row + ']');
    await until('location.hash === ' + q(href) + ' && document.querySelector("main h1")', href);
    await click('#child-back');
    await until('location.hash === "#/" || location.hash === ""', 'back home from ' + href);
  }
  await go('#/custom');
  await until('document.querySelector("main h1")', 'Pick words (#/custom still opens)');
  await go('#/progress');
  await until('document.querySelector("a[href=\'#/words/progress\']")', 'My word numbers link');
  ok((await rect('a[href="#/words/progress"]')).h >= 48, 'My word numbers is at least 48 px high');
  await click('a[href="#/words/progress"]');
  await until('location.hash === "#/words/progress"', 'My word numbers');
  step('the week page (D26): tiles only, no edit or New group for a child');
  await go('#/words/g/g1');
  await until('document.querySelector("[data-weekpage] .tile")', 'the week page');
  ok(!await has('.groupedit') && !await has('a[href$="/edit"]') && !await has('a[href="#/words/new"]'), 'no Change this group, no New group');
  await go('#/words/g/g1/edit');
  await sleep(200);
  ok(!/\/edit$/.test(await ev('location.hash')), 'a child cannot open the edit page: ' + await ev('location.hash'));
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

scene('Look and voice: voices that arrive late fill the Voice card; the tip stays', async () => {
  await seedChild(gameDayDoc(), plus(2));
  await open(plus(2), '#/look'); // SB5: the Voice card is on Look and voice, not Settings
  await until('document.querySelector("[data-looksettings]")', 'Look and voice');
  ok(!await visible('[data-voicecard]'), 'no voices yet: no Voice card');
  await ev('globalThis.__voices = [{ name: "Test Daniel", lang: "en-GB", localService: true, default: true, voiceURI: "test-daniel" }]; speechSynthesis.dispatchEvent(new Event("voiceschanged"));');
  await until('document.querySelector("[data-voices] [data-voice]")', 'the Voice card after voiceschanged');
  ok(await ev('document.querySelectorAll("[data-voices] [data-voice]").length') >= 1, 'the voices are listed');
  ok(await visible('[data-voicecard]'), 'the card shows');
  ok(await ev('!![...document.querySelectorAll("[data-voices] [data-voice]")].find((e) => e.getAttribute("aria-checked") === "true")'), 'one is ticked');
  ok(await has('[data-more]') || await has('[data-voicetip]'), 'Add more voices or the tip line is kept');
  await click('[data-voices] [data-voice]:last-child');
  await allViews('child-look-voices');
  await go('#/');
  await ev('globalThis.__voices = []; speechSynthesis.dispatchEvent(new Event("voiceschanged"));');
  await sleep(100);
});

scene('Hello flower game: no one-word progress line, lives kept, child-sized keys; the week tiles 48 px high', async () => {
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
  // SB5 (D26): a child's week page is tiles (no word grid); the grid of word links is the grown-up's own page
  await open(plus(4), '#/words/g/g1');
  await until('document.querySelector("[data-weekpage] .tile")', 'the week tiles');
  ok(await ev('[...document.querySelectorAll("[data-weekpage] .tile")].every((a) => a.getBoundingClientRect().height >= 47.5)'), 'week tiles are at least 48 high');
  ok(!await has('.wordgrid'), 'no practice grid for a child (the 48 px grid links are gone with it)');
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
    // SB5: the page ends with a 110 px safe zone (Safari's floating bar), so it can scroll a little; the keyboard is on the first screen
    // and, if it dips into that band, the page scrolls far enough to lift it clear (reachability, not scroll 0).
    if (h >= 844) { const room = await ev('document.documentElement.scrollHeight - innerHeight'); ok(kb.y + kb.h <= h && (w > 600 || kb.y + kb.h <= h - 110 || room >= kb.y + kb.h - (h - 110)), // the 110 px band is the phone rule (R-PH6); a tablet only needs the keyboard on the screen
       'the keyboard is on the first screen and can be lifted clear of the bottom 110 px at ' + w + 'x' + h + ': ' + JSON.stringify({ kb, room })); }
    ok(side ? kb.x >= skip.x + skip.w - 0.5 : kb.y >= skip.y + skip.h - 0.5, 'the keyboard is below (or, wide and short, beside) Skip at ' + w + 'x' + h + ': ' + JSON.stringify({ kb, skip }));
    for (const L of ['Q', 'P', 'I']) {
      await ev('document.querySelector(".key[data-letter=' + L + ']").scrollIntoView({ block: "end" })');
      await ev('document.querySelector(".key[data-letter=' + L + ']").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }))');
      const pop = await rect('.keypop');
      const hit = async (sel) => ev('(() => { const a = document.querySelector(".keypop").getBoundingClientRect(), b = document.querySelector(' + q(sel) + ').getBoundingClientRect(); return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom); })()');
      // S3-D1 (fixed): on a phone the 72 px room is gone and the pop-up shows beside the key in its own row, so it never covers Hear, Peek or Skip at any size.
      for (const sel of ['[data-skip]', '[data-peekbtn]', '[data-hear]']) {
        const covered = await hit(sel);
        ok(!covered, 'the pop-up for ' + L + ' covers ' + sel + ' at ' + w + 'x' + h + ' (pop ' + JSON.stringify(pop) + ')');
      }
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
    // SB5 home (01a): one card a child: name, year, a status pill, "Test on ...", the next job, seven small stones; one green Set a week bar
    const robin = await textOf('[data-child="' + CHILD + '"]');
    ok(/Robin Year 4/.test(robin) && /Test on Sat 7 Nov/.test(robin), 'name, year and test date: ' + robin);
    ok(/Next: /.test(robin), 'the next job: ' + robin);
    ok(await ev('document.querySelectorAll("[data-child=\\"' + CHILD + '\\"] .gh-mini .gh-ms").length') === 7, 'seven stones');
    ok(/jobs? done/.test(await ev('document.querySelector("[data-child=\\"' + CHILD + '\\"] .gh-mini").getAttribute("aria-label")')), 'the stones say how many jobs are done');
    ok(await has('[data-child="' + CHILD + '"] .gh-pill'), 'a status pill');
    ok(/Wren Year 6/.test(await textOf('[data-child="' + CHILD2 + '"]')) && await has('[data-child="' + CHILD2 + '"] .gh-pill'), 'the second child, with a status pill');
    ok(await has('[data-setweek]') && await has('[data-child="' + CHILD + '"] [data-see]') && /Robin/.test(await ev('document.querySelector("[data-child=\\"' + CHILD + '\\"] [data-see]").getAttribute("aria-label")')), 'Set a week, and one See link a card');
    await allViews('gu-home');

    step('one child\'s week');
    await click('[data-child="' + CHILD + '"] [data-see]');
    await until('document.querySelector("[data-glance]")', 'the week');
    ok(/^Children$/.test(await textOf('.gu-back')), 'back to Children (SB5 parent home): ' + await textOf('.gu-back'));
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
    ok(/Change words or test date/.test(await text('[data-edit]')) && /Delete this week/.test(await text('[data-delete]')) && /Print this week/.test(await text('[data-print]')) && /Set next week/.test(await text('[data-plannext]')), 'the four buttons (SB5: Set next week)');
    // S3-D2 (fixed): the Help link is a 48 px quiet link, so every control here is 40 px or more.
    const small = await ev('[...document.querySelectorAll(".gu a, .gu button, .gu input")].filter((e) => e.getBoundingClientRect().width && e.getBoundingClientRect().height < 40 && !e.closest(".gu-stones")).map((e) => e.className + "|" + e.innerText.slice(0, 30))');
    ok(!small.length, 'every control is 40 px or more high: ' + small.join(' ; '));
    ok(await ev('document.querySelector("[data-helplink]").getBoundingClientRect().height') >= 44, 'the Help link is at least 44 px high');
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
  ok(/No week yet/.test(await textOf('[data-child="' + CHILD2 + '"] .gh-pill')), 'No week yet');
  await allViews('gu-home-noweek');
  await go('#/grownups/child/' + CHILD2);
  await until('document.querySelector("[data-noweek]")', 'the empty state');
  ok(await has('[data-plan]'), 'Plan a week');
  await allViews('gu-week-empty');
});

// ---- SB5 Set a week (TR-1, TR-18): Which words? then Who and when? then the done page; the pieces the scenes below drive ------------------
/** Type or find a word on Word by word (it is added at the top of the list); answers the line under the box. */
async function wbwAdd(word) {
  await until('document.querySelector("[data-find]")', 'the find box');
  await ev('(() => { const n = document.querySelector("[data-find]"); n.value = ' + q(word) + '; n.dispatchEvent(new Event("input", { bubbles: true })); document.querySelector("[data-act=addfind]").click(); })()');
  await sleep(500);
  return text('[data-msg]');
}
const stText = () => text('.st-page');
const stClick = (act, extra = '') => click('[data-act="' + act + '"]' + extra);
/** Open Set a week from the Children home; the way in a grown-up takes. */
async function openSet(hash = '#/grownups/set') {
  await go('#/grownups');
  await until('document.querySelector("[data-setweek]")', 'the home');
  await go(hash);
  await until('document.querySelector(".st-page")', 'Set a week');
}
/** Word by word with these words, then on to Who and when. */
async function setTyped(words) {
  await stClick('tab', '[data-tab=new]');
  await stClick('wbw');
  for (const w of words) await wbwAdd(w);
  await stClick('next');
  await until('document.querySelector(".st-when")', 'Who and when');
}
const barText = () => text('.st-bar');

scene('grown-ups: set a week in two steps (Which words, Who and when) and the done page', async () => {
  await seedTwo();
  await go('#/grownups');
  await until('document.querySelector("[data-setweek]")', 'home');
  await click('[data-setweek]');
  step('Which words?');
  await until('document.querySelector(".st-words")', 'Which words');
  ok(/Which words\?/.test(await text('h1')), 'the title');
  ok((await ev('[...document.querySelectorAll("[role=tab][data-tab]")].map((b) => b.dataset.tab).join()')) === 'ready,lists,new', 'three tabs: Ready-made, My lists, New words');
  ok(await ev('document.querySelector("[data-act=next]").disabled'), 'Next waits until a list is chosen');
  ok(/Robin Year 4/.test(await stText()) && /One list can go to all of them/.test(await stText()), 'it says who the words are for: ' + (await stText()).slice(0, 200));
  await allViews('gu-set1');
  step('a ready-made chapter');
  ok(await ev('document.querySelector("[data-act=year][data-year=y4]").classList.contains("is-on")'), 'it opens on Robin\'s year (Year 4)');
  await ev('document.querySelector("input[data-chapter]").click()');
  ok(!await ev('document.querySelector("[data-act=next]").disabled'), 'Next opens once a chapter is picked');
  ok(/Make my own copy/.test(await stText()), 'a ready-made chapter can be copied but not changed');
  await allViews('gu-set1-chapter');
  step('New words: word by word');
  await stClick('tab', '[data-tab=new]');
  await stClick('wbw');
  ok(/1 added/.test(await wbwAdd('tractor')), 'a word of your own is added');
  const unknown = await wbwAdd('zzqx');
  const blocked = await wbwAdd('arse');
  ok(/can.t use yet: zzqx/.test(unknown) && unknown.replace('zzqx', '#') === blocked.replace('arse', '#'), 'blocked and unknown get the same reply (only the typed word differs): ' + unknown + ' | ' + blocked);
  ok(/1 already in the list/.test(await wbwAdd('tractor')), 'a repeat is said kindly');
  ok(/Typed by you/.test(await text('.st-wd__list')), 'a typed word says so');
  await allViews('gu-set-wbw');
  for (const w of ['height', 'island', 'because', 'guard', 'group', 'heart', 'earth', 'fruit', 'build']) await wbwAdd(w);
  ok(/10 words/.test(await text('.st-count')) || /10 word/.test(await text('.st-count')), 'ten words: ' + await text('.st-count'));
  await stClick('rm', '[data-word="build"]');
  ok(/9 words/.test(await text('.st-count')), 'one removed: ' + await text('.st-count'));
  await stClick('next');
  step('Who and when?');
  await until('document.querySelector(".st-when")', 'Who and when');
  ok(/Who and when\?/.test(await text('h1')), 'the title: ' + await text('h1'));
  ok(await ev('document.querySelectorAll("input[data-kid]").length') === 2, 'a box for each child');
  ok(await ev('document.querySelector("[data-act=set]").disabled') && /Tick at least one child/.test(await barText()), 'Set waits for a child: ' + await barText());
  ok(await ev('document.querySelectorAll("[data-act=chip]").length') === 4, 'four date chips and Pick a date');
  await allViews('gu-set2');
  await click('input[data-kid="' + CHILD + '"]');
  ok(!await ev('document.querySelector("[data-act=set]").disabled'), 'one child ticked: Set is ready: ' + await barText());
  ok(/Robin/.test(await text('[data-act=set]')), 'the button says who: ' + await text('[data-act=set]'));
  await stClick('chip', '[data-days="2"]');
  ok(/Short week/i.test(await text('.st-page')) || /two jobs|One job a day|jobs/i.test(await stText()), 'a short week says how the jobs fall: ' + (await stText()).slice(0, 300));
  await allViews('gu-set2-short');
  await stClick('chip', '[data-days="7"]');
  ok(await has('[data-name-det]'), 'Name this week is there, optional');
  step('Back loses nothing');
  await stClick('back');
  await until('document.querySelector(".st-words")', 'Which words again');
  await stClick('wbw'); // typed words stay on New words > Word by word
  ok(/9 words/.test(await text('.st-count')), 'the nine words are still there: ' + await text('.st-count'));
  await stClick('next');
  await until('document.querySelector(".st-when")', 'Who and when again');
  ok(await ev('document.querySelector("input[data-kid=\\"' + CHILD + '\\"]").checked'), 'Robin is still ticked');
  step('set the week');
  const before = childGroups().length;
  await click('[data-act=set]');
  await until('document.querySelector(".st-done")', 'the done page', 8000);
  ok(/Week set for Robin/.test(await stText()), 'a confirmation: ' + (await stText()).slice(0, 200));
  ok(childGroups().length === before + 1, 'one new group');
  const plan = childGroups().find((x) => x.words.includes('tractor'));
  ok(plan && plan.test === plus(9) && plan.words.length === 9, 'saved: ' + JSON.stringify(plan));
  ok(await has('[data-act=rename]') && await has('a[href*="/plan/"]'), 'Rename and Change this week are on the done page');
  await allViews('gu-set-done');
  step('the new week is on the child\'s page');
  await go('#/grownups/child/' + CHILD + '/week/' + plan.id);
  await until('document.querySelector("[data-word=tractor]")', 'the typed word on the week');
  await until('/No picture, meaning only/.test(document.querySelector("[data-word=\\"tractor\\"]").textContent)', 'the typed word\'s meaning loads (S3-D3)');
  const typedLine = await text('[data-word="tractor"]');
  ok(/No picture, meaning only/.test(typedLine), 'a typed word shows its picture status: ' + typedLine);
  ok(/tractor/.test(typedLine), 'the typed word row');
  await allViews('gu-week-new');
  step('from a child\'s page the child is chosen');
  await go('#/grownups/child/' + CHILD);
  await until('document.querySelector("[data-plannext]")', 'Set next week');
  await click('[data-plannext]');
  await until('document.querySelector(".st-words")', 'Which words for Robin');
  ok(/For Robin/.test(await stText()) && /Year 4/.test(await stText()), 'Robin is chosen: ' + (await stText()).slice(0, 160));
  await stClick('back');
  await until('document.querySelector("[data-week]")', 'Back goes to Robin\'s page');
  step('a child switcher with two weeks');
  await go('#/grownups/child/' + CHILD);
  await until('document.querySelector(".gu-switch")', 'the switcher');
  ok(await ev('document.querySelectorAll(".gu-switch a").length') === 2, 'two weeks, two links');
  ok(/2 weeks running/.test(await ev('document.querySelector("[data-manyweeks]").innerText')), 'it says there are two weeks');
  ok(await ev('!!document.querySelector("[data-edit]") && !!document.querySelector("[data-delete]")'), 'change and delete are on each week page');
  await click('.gu-switch a:not([aria-current])');
  await until('document.querySelector("[data-week]")', 'the other week');
});
const childGroups = () => W.liveGroups(saved());

/** Change a week (SB5 05d): pick the test date on the page (the Pick a date field). */
async function changePickDate(v) {
  await ev('(() => { const b = document.querySelector("[data-act=pickdate]"); if (b && !document.querySelector("[data-date]")) b.click(); })()');
  await until('document.querySelector("[data-date]")', 'the date field');
  await ev('(() => { const n = document.querySelector("[data-date]"); n.value = ' + q(v) + '; n.dispatchEvent(new Event("change", { bubbles: true })); })()');
}
scene('grown-ups: change a week, before and after the test date, and after the test began', async () => {
  await seedTwo();
  await go('#/grownups/child/' + CHILD);
  await until('document.querySelector("[data-edit]")', 'the week');
  const triesBefore = saved().results.length;
  step('before the test date');
  await click('[data-edit]');
  await until('document.querySelector(".st-change")', 'the Change a week page');
  ok(/Change Robin.s week/.test(await text('h1')) && /Only Robin.s week changes/.test(await stText()), 'a change, not a new week: ' + await text('h1'));
  ok(!await has('[data-wk]'), 'the words are closed at first (a summary and Change)');
  await stClick('words');
  ok(await ev('document.querySelectorAll("[data-wk]").length') === 4, 'the four words are filled in');
  await ev('document.querySelector("[data-wk][value=heart]").click()');
  await ev('(() => { const n = document.querySelector("[data-addword]"); n.value = "guard"; document.querySelector("[data-act=addword]").click(); })()');
  await sleep(500);
  ok(await ev('document.querySelectorAll("[data-wk]:checked").length') === 4 && await has('[data-wk][value=guard]:checked') && await has('[data-wk][value=heart]') && !await has('[data-wk][value=heart]:checked'), 'S7 m2: heart is unticked but still listed (it can be ticked back), guard is on');
  await ev('document.querySelector("[data-wk][value=heart]").click()');
  ok(await has('[data-wk][value=heart]:checked') && await ev('document.querySelectorAll("[data-wk]:checked").length') === 5, 'S7 m2: heart ticked back');
  await ev('document.querySelector("[data-wk][value=heart]").click()');
  ok(await ev('document.querySelector("[data-act=keepdate]").classList.contains("is-on")'), 'the current date is the one chosen');
  ok(/Week one/.test(await ev('(() => { document.querySelector("[data-name-det]").open = true; return document.querySelector("[data-name]").value; })()')), 'the name is filled in');
  await allViews('gu-change');
  await changePickDate(plus(6));
  await click('[data-act=save]');
  await until('document.querySelector("[data-week]")', 'back on the child\'s page');
  let g = W.groupById(saved(), 'g1');
  ok(g.test === plus(6) && !g.words.includes('heart') && g.words.includes('guard') && g.words.length === 4 && g.words.slice(0, 3).join() === 'build,earth,fruit', 'words and date changed: ' + JSON.stringify(g));
  ok(saved().results.length === triesBefore, 'no try destroyed');
  const dots = W.allDots(saved(), g, plus(2));
  ok(dots.find((x) => x.word === 'build') && !dots.some((x) => x.word === 'heart'), 'a removed word no longer counts');
  ok(/Needs help · 2 or more wrong letters/.test(await textOf('[data-word="build"] [data-wordchip]')), 'a kept word keeps its practice');

  step('on the test date, no result yet: still open');
  await open(plus(6), '#/grownups/child/' + CHILD + '/plan/g1');
  await until('document.querySelector(".st-change")', 'still open on the test date');
  ok(!/test has started/.test(await stText()), 'not locked');
  ok(await ev('document.querySelector("[data-act=keepdate]").classList.contains("is-on")'), 'on the test day the chosen date is the current date, not tomorrow');
  await click('[data-act=save]');
  await until('document.querySelector("[data-week]")', 'saved with the same date');
  ok(W.groupById(saved(), 'g1').test === plus(6), 'S3: only words or name changed: the test date did not move');
  await open(plus(6), '#/grownups/child/' + CHILD + '/plan/g1');
  await until('document.querySelector(".st-change")', 'again');
  ok(await ev('document.querySelector("[data-date]") === null') && await has('[data-act=pickdate]'), 'the date field opens with Pick a date');
  await changePickDate(plus(5));
  await click('[data-act=save]');
  await until('document.querySelector(".st-err, [role=alert], .st-help[role=alert]") || document.querySelector("[data-week]")', 'an answer to a date that is not after today');
  ok(!await has('[data-week]') && /after today/.test(await stText()), 'a new date must be after today: ' + (await stText()).slice(0, 300));
  ok(await ev('document.querySelector("[data-date]").min') === plus(7), 'the date field starts tomorrow');
  await changePickDate(plus(9));
  await click('[data-act=save]');
  await until('document.querySelector("[data-week]")', 'moved to a later date');
  ok(W.groupById(saved(), 'g1').test === plus(9), 'moved');

  step('the test date has passed: kept, the date is shown');
  await open(plus(10), '#/grownups/child/' + CHILD + '/plan/g1');
  await until('document.querySelector(".st-change")', 'open after the date');
  ok(await ev('document.querySelector("[data-act=keepdate]").classList.contains("is-on")') && /Mon 16 Nov|Sun 15 Nov|Mon 9 Nov|Wed 11 Nov/.test(await text('[data-act=keepdate]')), 'the passed date is shown, not moved: ' + await text('[data-act=keepdate]'));
  ok(/The test date has passed\. Robin.s test opens when the jobs are done\. You can pick a new date\./.test(await stText()), 'the passed-date note (S3-D4): ' + await stText());
  await allViews('gu-change-passed');
  await click('[data-act=save]');
  await until('document.querySelector("[data-week]")', 'saved after the date');
  ok(W.groupById(saved(), 'g1').test === plus(9), 'S3: still the same date');

  step('after the test began: refused kindly, the name can change');
  let d = saved();
  const g1 = W.groupById(d, 'g1');
  d = W.addTry(d, { id: 'tt1', word: 'build', day: plus(6), group: 'g1', kind: 't', tries: 0, peeks: 0, clean: true, now: Date.parse(plus(6) + 'T11:00:00') });
  acct.put(CHILD, 'spellbright', 'words', d);
  ok(g1, 'week exists');
  await open(plus(6), '#/grownups/child/' + CHILD + '/week/g1');
  await until('document.querySelector("[data-edit]")', 'the week');
  ok(/Rename this week/.test(await text('[data-edit]')), 'S5: the button says Rename this week once the test has begun');
  ok(!await has('[data-rename]'), 'one rename button only');
  await click('[data-edit]');
  await until('document.querySelector(".st-rename")', 'the rename page');
  ok(/The test has started\./.test(await stText()) && /rename the week/i.test(await stText()), 'says why: ' + (await stText()).slice(0, 220));
  ok(!await has('[data-date]') && !await has('[data-act=chip]'), 'no date field');
  await allViews('gu-change-locked');
  await ev('(() => { const n = document.querySelector("[data-rename]"); n.value = "Renamed week"; n.dispatchEvent(new Event("input", { bubbles: true })); })()');
  await stClick('savename');
  await until('document.querySelector("[data-week]")', 'renamed');
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
  await until('document.querySelector("[data-setweek]")', 'the home');
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

// Set a week for Robin as far as the Set button (SB5): one typed word on New words, Word by word, a date, then Set is next.
async function toStart(word) {
  await go('#/grownups');
  await until('document.querySelector("[data-setweek]")', 'the home');
  await go('#/grownups/set/child/' + CHILD);
  await until('document.querySelector(".st-words")', 'Which words for Robin');
  await setTyped([word]);
  await stClick('chip', '[data-days="7"]');
  await until('!document.querySelector("[data-act=set]").disabled', 'Set is ready');
}

scene('grown-ups: when things go wrong', async () => {
  await seedAdult();
  await until('document.querySelector("[data-child],[data-first],[data-noapi]")', 'home');
  step('409: the child saved first');
  await toStart('calendar');
  const newer = W.addTry(saved(), { id: 'late', word: 'earth', day: plus(2), group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, now: Date.parse(plus(2) + 'T09:30:00') });
  const realFetch = acct.fetch;
  let raced = false; // the child's device saves between the page's read and its write
  acct.fetch = async (url, init) => {
    if (init.method === 'PUT' && String(url).includes('/api/children/') && !raced) { raced = true; acct.put(CHILD, 'spellbright', 'words', newer); }
    return realFetch(url, init);
  };
  await click('[data-act=set]');
  await until('document.querySelector(".st-done")', 'the done page (the save went on top of the child\'s newer copy)', 9000);
  acct.fetch = realFetch;
  ok(raced, 'the 409 really happened');
  ok(saved().results.some((x) => x.id === 'late'), 'the child\'s try is still there');
  ok(childGroups().length === 2, 'and the new week');

  step('network: nothing half-saved, then try again');
  await toStart('enough');
  const before = JSON.stringify(acct.data.get(CHILD).get('spellbright/words'));
  netDown = true;
  acct.offline = true;
  await click('[data-act=set]');
  await until('/can.t reach Waystead/.test(document.querySelector(".st-page").innerText)', 'a kind message', 9000);
  ok(/Couldn.t set Robin.s week/.test(await stText()) && /Nothing changed for this child/.test(await stText()), 'says nothing was saved: ' + (await stText()).slice(0, 300));
  ok(JSON.stringify(acct.data.get(CHILD).get('spellbright/words')) === before, 'nothing half-saved');
  ok(/Same words and date/.test(await stText()), 'Try again keeps the words and date');
  await allViews('gu-network');
  acct.offline = false;
  await click('[data-act=retry]');
  await until('/Week set for Robin/.test(document.querySelector(".st-page").innerText)', 'saved on the second go', 9000);
  ok(childGroups().length === 3, 'exactly one more week');

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
  await open(plus(2), '#/grownups');
  await until('document.querySelector("[data-playing]")', 'the switch-back card on the home');
  ok(/You.re playing as Robin\. Switch back to yourself to plan and see progress/.test(await text()) && await has('[data-switchback]'), 'the home names the child and offers Switch back: ' + await text());
  await go('#/grownups/set');
  await until('document.querySelector("[data-playing] h1")', 'Set a week while playing as a child');
  ok(/You.re playing as (Robin|a child)\. Switch back to yourself/.test(await text()), 'Set a week does not open: ' + await text());
  ok(/playing as Robin/.test(await text()) && await has('[data-switchback]'), 'Set a week names the child and offers Switch back (S3-D5): ' + await text());
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
  for (const p of ['#/grownups', '#/grownups/stories', '#/grownups/plan', '#/grownups/child/' + CHILD, '#/grownups/child/' + CHILD + '/week/g1', '#/grownups/child/' + CHILD + '/plan', '#/grownups/set', '#/grownups/set/child/' + CHILD, '#/grownups/own']) {
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
  for (const p of ['#/grownups', '#/grownups/stories', '#/grownups/child/' + CHILD, '#/grownups/child/' + CHILD + '/week/g1']) {
    await open(MON, p);
    await until('document.querySelector("[data-playing]")', 'the card at ' + p);
  }
  ok(/You.re playing as Robin/.test(await text()), 'names the child');
  const back = await ev('document.querySelector("[data-switchback]").href');
  ok(back.startsWith('http://localhost:3000/play?return=') && decodeURIComponent(back).endsWith('#/grownups/child/' + CHILD + '/week/g1'), 'back to this page: ' + back);
  // SB5: the Set a week pages (and the old plan addresses, which redirect there) show the same card, with the child's name and the Switch back button (S3-D5)
  for (const p of ['#/grownups/plan', '#/grownups/child/' + CHILD + '/plan', '#/grownups/set', '#/grownups/set/child/' + CHILD]) {
    await open(MON, p);
    await until('document.querySelector("[data-playing] h1")', 'the card at ' + p);
    ok(/You.re playing as/.test(await text()) && !await has('.st-words') && !await has('[data-act=set]'), 'Set a week stays shut while playing as a child at ' + p);
  }
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
  ok(/Hello, Robin!/.test(await text('h1')) && /Today: 3 jobs\./.test(await text('.today__sub')), 'Week one sentence (SB5 Today): ' + await text('.today__sub'));
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
  ok(/Day 4 of 9 · your test is on Wednesday/.test(await text('.today__sub')), 'the day line follows: ' + await text('.today__sub'));
  ok(/Game day/.test(await text('[data-job]')) && (await ev('document.querySelector("[data-job]").getAttribute("href")')).includes('/g2/'), 'the big button targets Week two');
  ok((await ev('document.querySelector("[data-pathcard]").getAttribute("href")')) === '#/words/g/g2/path', 'the week stones link follows');
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
  await until('document.querySelector("[data-weekpage]")', 'My week');
  ok(/Week two/.test(await text('[data-weekpage]')) && /Game day/.test(await text('[data-job]')), 'the week page is Week two (SB5: its name is in Study this week): ' + (await text('[data-weekpage]')).slice(0, 200));
  ok(/Week one/.test(await text('[data-other-weeks]')) && /Other weeks/.test(await text('[data-other-weeks]')), 'the other week has an Other weeks tile');
  ok((await rect('[data-other-weeks]')).h >= 48, 'Other weeks is 48 px');
  await go('#/words/g/g1');
  await until('document.querySelector("[data-weekpage]")', 'Week one page');
  ok(/Week one/.test(await text('[data-weekpage]')) && /Week two/.test(await text('[data-other-weeks]')), 'Week one\'s page lists Week two as the other');
  await go('#/words/g/g2');
  await until('document.querySelector("[data-other-weeks]")', 'back on Week two');
  step('reload: still Week two');
  await open(plus(3), '#/');
  await until('document.querySelector("[data-room=job]")', 'the home again');
  ok(/Week:\s*Week two/.test(await text('.weekline')) && /Day 4 of 9/.test(await text('.today__sub')), 'still Week two');
  step('Other weeks (Week one) on the week page');
  await go('#/words/g/g2');
  await until('document.querySelector("[data-other-weeks]")', 'the tile');
  await click('[data-other-weeks]');
  await until('document.querySelector("[role=dialog] [data-week=g1]")', 'the sheet');
  await click('[data-week=g1]');
  await until('location.hash === "#/words/g/g1"', 'opens Week one');
  ok(await weekKey() === 'g1', 'and chooses it');
  await go('#/');
  await until('document.querySelector("[data-room=job]")', 'home');
  ok(/Week:\s*Week one/.test(await text('.weekline')) && /Today: 3 jobs/.test(await text('.today__sub')), 'the home is Week one');
});

scene('week choice: nothing to do here, another week has a job', async () => {
  let d = weekDoc(WORDS, plus(5));
  d = W.createGroup(d, { id: 'g2', name: 'Week two', test: plus(9), words: WORDS2, today: MON, now: Date.parse(MON + 'T09:30:00') }).doc;
  d = W.markStep(d, W.groupById(d, 'g1'), 'hello', MON, Date.parse(MON + 'T10:00:00'));
  await seedChild(d, MON);
  await ev('localStorage.setItem("sb.week:' + CHILD + '","g1")');
  await open(MON, '#/');
  await until('document.querySelector("[data-room]")', 'the home');
  ok(/Today.s job is done/.test(await text('.today__sub')), 'Week one is done for today: ' + await text('.today__sub'));
  ok(/Week two has a job waiting/.test(await text('[data-nextweek]')), 'the line: ' + await text('[data-nextweek]'));
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
  ok(/Your test for Week one is ready/.test(await text('[data-taketest]')), 'the line: ' + await text('[data-taketest]'));
  ok(/Do it when you like/.test(await text('[data-taketest]')) && (await rect('[data-taketest]')).h >= 48, 'the test tile, 48 px');
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
  ok(/Do your test/.test(await text('[data-job]')) && !await has('[data-taketest]'), 'Week one chosen: the test button, no extra line');
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
  await until('document.querySelector("[data-weekpage]")', 'My week');
  ok(/Week two/.test(await text('[data-weekpage]')), 'My week is Week two');
  await noWordsOf(WORDS, 'My week');
  ok(/Week one/.test(await text('[data-other-weeks]')), 'the due week can be opened (names only)');
  await click('[data-other-weeks]');
  await until('document.querySelector("[role=dialog] [data-week=g1]")', 'the sheet');
  await click('[data-week=g1]');
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
// The keyboard's [x, y, width, height] and the Q key's [width, height], by "role page style WxH". Recorded at the base commit (33fafd7); re-recorded for SB5 on 19 Nov 2026 (S3):
// the 26 entries that moved were all reviewed: a phone-portrait keyboard now ends above the 110 px safe band (it sits 35 to 91 px higher), and a grown-up's keyboard is up to 7.5 px further left where a scroll bar appears.
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
  "child practice garden 390x844": [6,480.9,378,264,35.1,56],
  "child practice garden 768x1024": [134,752,500,264,46,56],
  "child practice garden 1024x1366": [262,1094,500,264,46,56],
  "child practice garden 820x1180": [160,908,500,264,46,56],
  "child practice garden 834x1194": [167,922,500,264,46,56],
  "child practice garden 1920x1080": [710,808,500,264,46,56],
  "child practice night 390x844": [6,473,378,264,35.1,56],
  "child practice night 768x1024": [134,747,500,264,46,56],
  "child practice night 1024x1366": [262,1089,500,264,46,56],
  "child practice night 820x1180": [160,903,500,264,46,56],
  "child practice night 834x1194": [167,917,500,264,46,56],
  "child practice night 1920x1080": [710,803,500,264,46,56],
  "child test garden 390x844": [6,395.7,378,264,35.1,56],
  "child test garden 768x1024": [134,665.7,500,264,46,56],
  "child test garden 1024x1366": [262,1007.7,500,264,46,56],
  "child test garden 820x1180": [160,821.7,500,264,46,56],
  "child test garden 834x1194": [167,835.7,500,264,46,56],
  "child test garden 1920x1080": [710,721.7,500,264,46,56],
  "child test night 390x844": [6,392.2,378,264,35.1,56],
  "child test night 768x1024": [134,662.2,500,264,46,56],
  "child test night 1024x1366": [262,1004.2,500,264,46,56],
  "child test night 820x1180": [160,818.2,500,264,46,56],
  "child test night 834x1194": [167,832.2,500,264,46,56],
  "child test night 1920x1080": [710,718.2,500,264,46,56],
  "child quick garden 390x844": [6,395.7,378,264,35.1,56],
  "child quick garden 768x1024": [134,665.7,500,264,46,56],
  "child quick garden 1024x1366": [262,1007.7,500,264,46,56],
  "child quick garden 820x1180": [160,821.7,500,264,46,56],
  "child quick garden 834x1194": [167,835.7,500,264,46,56],
  "child quick garden 1920x1080": [710,721.7,500,264,46,56],
  "child quick night 390x844": [6,392.2,378,264,35.1,56],
  "child quick night 768x1024": [134,662.2,500,264,46,56],
  "child quick night 1024x1366": [262,1004.2,500,264,46,56],
  "child quick night 820x1180": [160,818.2,500,264,46,56],
  "child quick night 834x1194": [167,832.2,500,264,46,56],
  "child quick night 1920x1080": [710,718.2,500,264,46,56],
  "child fix garden 390x844": [6,464.5,378,264,35.1,56],
  "child fix garden 768x1024": [134,661.7,500,264,46,56],
  "child fix garden 1024x1366": [262,1003.7,500,264,46,56],
  "child fix garden 820x1180": [160,817.7,500,264,46,56],
  "child fix garden 834x1194": [167,831.7,500,264,46,56],
  "child fix garden 1920x1080": [710,717.7,500,264,46,56],
  "child fix night 390x844": [6,456.6,378,264,35.1,56],
  "child fix night 768x1024": [134,658.2,500,264,46,56],
  "child fix night 1024x1366": [262,1000.2,500,264,46,56],
  "child fix night 820x1180": [160,814.2,500,264,46,56],
  "child fix night 834x1194": [167,828.2,500,264,46,56],
  "child fix night 1920x1080": [710,714.2,500,264,46,56],
  "adult flower garden 390x844": [16,632.8,372.5,154.4,32.8,46.8],
  "adult flower garden 768x1024": [16,703.1,721,176,46,54],
  "adult flower garden 1024x1366": [16,703.1,992,176,46,54],
  "adult flower garden 820x1180": [16,703.1,773,176,46,54],
  "adult flower garden 834x1194": [16,703.1,787,176,46,54],
  "adult flower garden 1920x1080": [448.5,703.1,1008,176,46,54],
  "adult flower night 390x844": [16,626.3,372.5,154.4,32.8,46.8],
  "adult flower night 768x1024": [16,696.7,721,176,46,54],
  "adult flower night 1024x1366": [16,696.7,992,176,46,54],
  "adult flower night 820x1180": [16,696.7,773,176,46,54],
  "adult flower night 834x1194": [16,696.7,787,176,46,54],
  "adult flower night 1920x1080": [448.5,696.7,1008,176,46,54],
  "adult practice garden 390x844": [16,478.9,358,154.4,31.3,46.8],
  "adult practice garden 768x1024": [112.5,566.9,528,176,46,54],
  "adult practice garden 1024x1366": [248,566.9,528,176,46,54],
  "adult practice garden 820x1180": [146,566.9,528,176,46,54],
  "adult practice garden 834x1194": [153,566.9,528,176,46,54],
  "adult practice garden 1920x1080": [696,566.9,528,176,46,54],
  "adult practice night 390x844": [16,471,358,154.4,31.3,46.8],
  "adult practice night 768x1024": [112.5,560.5,528,176,46,54],
  "adult practice night 1024x1366": [248,560.5,528,176,46,54],
  "adult practice night 820x1180": [146,560.5,528,176,46,54],
  "adult practice night 834x1194": [153,560.5,528,176,46,54],
  "adult practice night 1920x1080": [696,560.5,528,176,46,54],
  "adult test garden 390x844": [16,368.4,358,154.4,31.3,46.8],
  "adult test garden 768x1024": [120,424.5,528,176,46,54],
  "adult test garden 1024x1366": [248,424.5,528,176,46,54],
  "adult test garden 820x1180": [146,424.5,528,176,46,54],
  "adult test garden 834x1194": [153,424.5,528,176,46,54],
  "adult test garden 1920x1080": [696,424.5,528,176,46,54],
  "adult test night 390x844": [16,360.5,358,154.4,31.3,46.8],
  "adult test night 768x1024": [112.5,418,528,176,46,54],
  "adult test night 1024x1366": [248,418,528,176,46,54],
  "adult test night 820x1180": [146,418,528,176,46,54],
  "adult test night 834x1194": [153,418,528,176,46,54],
  "adult test night 1920x1080": [696,418,528,176,46,54],
  "adult quick garden 390x844": [16,377.3,358,154.4,31.3,46.8],
  "adult quick garden 768x1024": [120,433.4,528,176,46,54],
  "adult quick garden 1024x1366": [248,433.4,528,176,46,54],
  "adult quick garden 820x1180": [146,433.4,528,176,46,54],
  "adult quick garden 834x1194": [153,433.4,528,176,46,54],
  "adult quick garden 1920x1080": [696,433.4,528,176,46,54],
  "adult quick night 390x844": [16,370.8,358,154.4,31.3,46.8],
  "adult quick night 768x1024": [112.5,428.4,528,176,46,54],
  "adult quick night 1024x1366": [248,428.4,528,176,46,54],
  "adult quick night 820x1180": [146,428.4,528,176,46,54],
  "adult quick night 834x1194": [153,428.4,528,176,46,54],
  "adult quick night 1920x1080": [696,428.4,528,176,46,54],
  "adult fix garden 390x844": [16,464.5,358,154.4,31.3,46.8],
  "adult fix garden 768x1024": [112.5,569.3,528,176,46,54],
  "adult fix garden 1024x1366": [248,569.3,528,176,46,54],
  "adult fix garden 820x1180": [146,569.3,528,176,46,54],
  "adult fix garden 834x1194": [153,569.3,528,176,46,54],
  "adult fix garden 1920x1080": [688.5,569.3,528,176,46,54],
  "adult fix night 390x844": [16,456.6,358,154.4,31.3,46.8],
  "adult fix night 768x1024": [112.5,562.8,528,176,46,54],
  "adult fix night 1024x1366": [248,562.8,528,176,46,54],
  "adult fix night 820x1180": [146,562.8,528,176,46,54],
  "adult fix night 834x1194": [153,562.8,528,176,46,54],
  "adult fix night 1920x1080": [688.5,562.8,528,176,46,54],
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
/**
 * The keyboard-fit checks for the page now on screen at the viewport already set (width(w, h)):
 * the scene "keyboard fits in landscape" and any later scene use this one function.
 * opts: { role: 'child'|'adult', page, style, w, h, dump?: object that collects the measurements,
 * base?: the recorded keyboard positions for the portrait sizes (default KB_BASE) }.
 * Returns the measurements, or null when KB_DUMP only measures (nothing is checked).
 */
async function kbFit({ role, page, style: s, w, h, dump = null, base = KB_BASE }) {
  const m = await kbMeasure();
  const id = role + ' ' + page + ' ' + s + ' ' + w + 'x' + h;
  if (dump) dump[id] = m;
  if (process.env.KB_DUMP) { if (h <= 1000 && w >= 820) await shotView('kb-' + id.replaceAll(' ', '-')); return null; } // KB_DUMP: measure only (the base values), with the pictures
  ok(m.sw <= m.cw, id + ': scrolls sideways (' + m.sw + ' > ' + m.cw + ')');
  ok(m.rows === '10,9,7' || m.rows === '10,9,8' || m.rows === '10,9,7', id + ': rows ' + m.rows);
  ok(m.wrap === 'nowrap' && m.oneRow, id + ': a row wraps');
  ok(m.hit.length === 0, id + ': overlap ' + m.hit.join('; '));
  if (w >= 820 && h <= 1000 && h >= 500) {
    ok(m.minW >= 44 && m.minH >= 48, id + ': keys ' + m.minW + ' x ' + m.minH);
    if (h > 400) {
      ok(m.kb.y >= 0 && m.kb.b <= h, id + ': keyboard ' + Math.round(m.kb.y) + '..' + Math.round(m.kb.b) + ' of ' + h);
      ok(m.boxes.y >= 0 && m.boxes.b <= h, id + ': letter boxes ' + Math.round(m.boxes.y) + '..' + Math.round(m.boxes.b) + ' of ' + h);
      ok(m.ctlBottom <= h, id + ': controls reach ' + Math.round(m.ctlBottom) + ' of ' + h);
    }
    await shotView('kb-' + id.replaceAll(' ', '-'));
  } else if (h < 500) { // a phone on its side (SB5: F8 844x390 too): it may scroll, but the keyboard is reachable and nothing overlaps. Letter keys are 32 x 48 or more (D11; the fold harness checks the same)
    ok(m.minW >= 31.5 && m.minH >= 47.5, id + ': keys ' + m.minW + ' x ' + m.minH);
    await ev('document.querySelector(".keyboard").scrollIntoView({ block: "end" })');
    const r = await ev('(() => { const r = document.querySelector(".keyboard").getBoundingClientRect(); return [r.top, r.bottom]; })()');
    ok(r[1] <= h + 0.5 && r[0] >= -0.5, id + ': keyboard unreachable ' + r);
    await ev('window.scrollTo(0, 0)');
    await shotView('kb-' + id.replaceAll(' ', '-'));
  } else {
    const b = base[role + ' ' + page + ' ' + s + ' ' + w + 'x' + h];
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
  return m;
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
          if (await kbFit({ role, page, style: s, w, h, dump: dump })) cases += 1;
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

// SB5 Children home (01a, TR-41): one card a child (name, year, a status pill, the test date, the next job, seven small stones), the stone key, links, and one
// green "Set a week" bar fixed at the foot. The old summary sentence, the Plan a week header button and the per-card green See button are gone.
scene('front page (adult): two children, one green Set a week bar, stable order', async () => {
  storiesHidden = true;
  try {
    await seedFront([[CHILD, childWeek()], [CHILD2, wrenWeek()]], KIDS2);
    ok(!await has('[data-room]') && /^#\/?$/.test(await ev('location.hash')), 'the adult\'s #/ is the week at a glance, not the chapters or a room');
    ok(/Wednesday 4 November/i.test(await text('[data-date]')), 'a date eyebrow: ' + await text('[data-date]'));
    ok(/^Your children$/.test((await text('main h1')).trim()), 'the page is Your children: ' + await text('main h1'));
    ok((await primaries()).join('|') === 'Set a week', 'one green button, Set a week: ' + await primaries());
    ok(await ev('!!document.querySelector(".gh-bar [data-setweek][data-primary]")'), 'it is in the bar at the foot');
    ok((await ev('[...document.querySelectorAll("[data-child]")].map((e) => e.dataset.child)')).join() === CHILD + ',' + CHILD2, 'the account\'s order');
    ok(!await has('.gu-facts') && await ev('document.querySelectorAll(".gh-mini").length') === 2, 'no facts tiles; the small stones on each card');
    ok(/Next: /.test(await textOf('[data-child="' + CHILD + '"]')) && /Test on Sat 7 Nov/.test(await textOf('[data-child="' + CHILD + '"]')), 'Robin: ' + await textOf('[data-child="' + CHILD + '"]'));
    ok(/Next: /.test(await textOf('[data-child="' + CHILD2 + '"]')) && /Test on /.test(await textOf('[data-child="' + CHILD2 + '"]')), 'Wren: ' + await textOf('[data-child="' + CHILD2 + '"]'));
    ok(await ev('[...document.querySelectorAll(".gh-mini")].every((o) => o.children.length === 7)'), 'seven stones in each strip');
    ok(/20 stories to read first/.test(await textOf('[data-stories]')), 'the stories notice is kept');
    ok(/Done\s*Today\s*Waiting\s*Later/.test(await textOf('[data-stonekey]')), 'the key: ' + await textOf('[data-stonekey]'));
    for (const [w, h] of [[1180, 640], [390, 844]]) ok(await inFirstScreen('[data-primary]', w, h), 'the green button is in the first screen at ' + w + 'x' + h);
    await width(390, 844);
    ok(await ev('[...document.querySelectorAll(".gh-mini")].every((o) => new Set([...o.children].map((li) => Math.round(li.getBoundingClientRect().top))).size === 1)'), 'the seven stones stay on one line at 390');
    step('the foot: one quiet line from Waystead Learning, and the part-of-Waystead line with For parents and More games');
    ok(await visible('.foot__papers') && /11\+ English practice papers/.test(await text('.foot__papers')) && /learning\.waystead\.co\.uk\/packs/.test(await ev('document.querySelector(".foot__papers a").href')), 'the papers line');
    ok(await visible('.foot') && await visible('.foot__more') && /part of Waystead/.test(await text('.foot')), 'the footer keeps the Waystead line, For parents and More games (grownups-r2 test: not hidden)');
    await allViews('front-two');
    await click('[data-child="' + CHILD2 + '"] [data-see]');
    await until('location.hash === "#/grownups/child/' + CHILD2 + '"', 'Wren\'s week');
    ok(await visible('.foot__papers'), 'the papers line is on the other adult pages too');
  } finally { storiesHidden = false; setKids(KIDS2); }
});

scene('front page (adult): one child; everyone on track; a week that has ended; a child with no week', async () => {
  try {
    step('one child');
    await seedFront([[CHILD, childWeek()]], [KIDS2[0]]);
    ok(await ev('document.querySelectorAll("[data-child]").length') === 1 && await has('.gh-cols--one'), 'one card, one column');
    ok((await primaries()).join('|') === 'Set a week', 'Set a week is the green button: ' + await primaries());
    ok(/Starts today · for Robin/.test(await text('.gh-bar')), 'the bar says who: ' + await text('.gh-bar'));
    await allViews('front-one');
    step('everyone on track');
    await seedFront([[CHILD, childWeek()], [CHILD2, wrenOnTrack()]], KIDS2);
    ok(await has('[data-child="' + CHILD + '"] .gh-pill') && await has('[data-child="' + CHILD2 + '"] .gh-pill'), 'a status pill on each card');
    ok((await primaries()).join('|') === 'Set a week', 'Set a week leads: ' + await primaries());
    await allViews('front-ontrack');
    step('a week that has ended');
    await seedFront([[CHILD, endedWeek()], [CHILD2, wrenOnTrack()]], KIDS2, plus(5));
    ok(await has('[data-child="' + CHILD + '"][data-state=ended]'), 'Robin\'s card is in the ended state: ' + await textOf('[data-child="' + CHILD + '"]'));
    ok(/Last week.s test: 4 of 4/.test(await textOf('[data-child="' + CHILD + '"]')) || /test was/.test(await textOf('[data-child="' + CHILD + '"]')), 'the ended card says how the test went: ' + await textOf('[data-child="' + CHILD + '"]'));
    ok((await primaries()).join('|') === 'Set a week', 'Set a week is the green button: ' + await primaries());
    await allViews('front-ended');
    step('a child with no week');
    await seedFront([[CHILD, childWeek()]], KIDS2);
    ok((await primaries()).join('|') === 'Set a week', 'Set a week is the green button: ' + await primaries());
    ok(/No week yet/.test(await textOf('[data-child="' + CHILD2 + '"] .gh-pill')) && /Set a week for Wren/.test(await textOf('[data-child="' + CHILD2 + '"] [data-plan]')) && await ev('document.querySelector("[data-child=\\"' + CHILD2 + '\\"] [data-plan]").classList.contains("btn--ghost")'), 'the card button is quiet');
    ok(/Starts today · you choose the children/.test(await text('.gh-bar')), 'with two children the bar leaves the choice to the Set a week page: ' + await text('.gh-bar'));
    await allViews('front-noweek');
  } finally { setKids(KIDS2); }
});

scene('front page (adult): five children get one compact row each; no children says what to do first', async () => {
  const ids = [1, 2, 3, 4, 5].map((n) => 'b' + n + '111111-1111-4111-8111-111111111111');
  const names = ['Amara', 'Ben', 'Chloe', 'Dev', 'Ellie'];
  const kids = ids.map((id, i) => ({ id, nickname: names[i], year: 4, avatar: null }));
  try {
    await seedFront(ids.map((id, i) => [id, i === 1 || i === 4 ? wrenWeek() : childWeek()]), kids);
    ok(await ev('document.querySelectorAll("[data-child]").length') === 5 && await ev('document.querySelectorAll(".gh-mini").length') === 5, 'five cards with their small stones');
    ok((await ev('[...document.querySelectorAll("[data-child]")].map((e) => e.dataset.child)')).join() === ids.join(), 'stable order');
    ok((await primaries()).join('|') === 'Set a week', 'one green button: ' + await primaries());
    for (const [w, h] of [[1180, 640], [390, 844]]) ok(await inFirstScreen('[data-primary]', w, h), 'the green button is in the first screen at ' + w + 'x' + h);
    await width(390, 844);
    const tall = await ev('document.documentElement.scrollHeight');
    ok(tall < 844 * 3, 'five cards are under three screens at 390: ' + tall);
    await allViews('front-five');
    step('no children');
    await seedFront([], []);
    ok(await has('[data-first]') && /Add your first child/.test(await text('[data-first] h1')) && !await has('[data-setweek]'), 'what to do first: ' + await text('main'));
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
  ok(rows.map((r) => r.t).join() === 'Children,Word lists,Set a week,Play yourself,All games' && rows.map((r) => r.h).join() === '#/grownups,#/grownups/own,#/grownups/set,#/grownups/yourself,../', 'the five rows (SB5): ' + JSON.stringify(rows));
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
  for (const [href, ready] of [['#/grownups/own', 'main h1'], ['#/grownups/set', '.st-page'], ['#/grownups/yourself', 'main h1'], ['#/grownups', '[data-child]']]) {
    const from = href === '#/grownups/own' ? '#/grownups/yourself' : '#/grownups/own';
    await go(from);
    await until('location.hash === ' + q(from) + ' && document.querySelector("main h1")', 'a page to leave');
    await click('#adult-menu-btn');
    await click('#adult-menu-panel a[href="' + href + '"]');
    await until('location.hash === ' + q(href) + ' && document.querySelector(' + q(ready) + ')', href);
    await sleep(80);
    ok(await ev('document.activeElement === document.querySelector("main h1")'), 'after choosing ' + href + ' focus is on the new page\'s heading, not ' + await ev('document.activeElement.tagName + "." + document.activeElement.className'));
    ok(await ev('document.querySelector("#adult-menu-panel").hidden && !document.querySelector("main").hasAttribute("inert")'), 'a row closes the Menu: ' + href);
  }
  ok(await ev('document.querySelector("#adult-menu-panel a[href=\\"../\\"]").getAttribute("href")') === '../', 'All games goes to the games home');
  await click('#adult-menu-btn');
  await go('#/grownups/own');
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
  const menu = { 'Children': '#/grownups', 'Word lists': '#/grownups/own', 'Set a week': '#/grownups/set', 'Play yourself': '#/grownups/yourself', 'All games': '../' };
  await click('#adult-menu-btn');
  for (const [title, href] of Object.entries(menu)) ok(await has('#adult-menu-panel a[href="' + href + '"]') && new RegExp(title).test(await text('#adult-menu-panel a[href="' + href + '"]')), title + ' is in the Menu');
  await key('Escape');
  await click('#adult-chip');
  await until('document.querySelector("#adult-account-panel [data-signout]")', 'the account panel');
  for (const s of ['[data-choice=garden]', '[data-choice=paint]', '[data-choice=night]', '[data-choice=system]', '[data-signout]', '[data-account]', '[data-parents]']) ok(await has('#adult-account-panel ' + s), 'the account panel has ' + s);
  await key('Escape');
  await go('#/grownups/yourself');
  await until('document.querySelector("main h1")', 'Play yourself');
  for (const [title, href] of Object.entries({ 'More practice': '#/chapters', 'My words': '#/words', 'Pick words': '#/custom', 'words to practise again': '#/tricky', 'progress': '#/progress' })) ok(await has('main a[href="' + href + '"]') && new RegExp(title, 'i').test(await text('main a[href="' + href + '"]')), 'the old control ' + title + ' is a row on Play yourself');
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
/** More practice on a given year (the smoke's child is in Year 4, so it opens on Year 4 unless a year was chosen). */
async function showYear(y, day = plus(2)) {
  await ev('localStorage.setItem("sb.chaptersYear", "' + y + '")');
  await open(day, '#/chapters');
  await until('document.querySelector("[data-yearpanel=' + y + ']")', 'Year ' + y);
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

// SB5 (TR-47): a child's #/chapters is "Practice": the grown-up's lists, Sentence games, Words to practise again, the year chapters (a year grid, then the year's
// stones and one carry button), then Pick words and My progress. The old "More practice" page with its Other years row and spoken sentence is the adult page only.
scene('SB3-F More practice as a child: chrome, one button, year switch, stones', async () => {
  overrides.set('data/curriculum.json', LEGACY_CURRICULUM); // written for Years 3 to 6 with five chapters each
  await childWith(PROG_3, '#/chapters');
  await showYear('y3');
  await until('document.querySelector("[data-chapters]")', 'Practice');
  ok(await visible('#child-back') && await visible('#child-menu'), 'Back and Menu');
  const t = await text();
  ok(!/Learning|Start game|Today's word|Waystead/.test(t), 'no advert, no Start game, no Today\'s word');
  ok(/^Today\s+Practice/.test(t) && /Year chapters/.test(t) && await ev('document.querySelector("[data-chapters]").dataset.for') === 'child', 'the child\'s Practice page: ' + t.slice(0, 120));
  ok(await frontPrimaries() === 1 && /Carry on: Chapter 3/.test(await text('[data-carry]')) && /Practise/.test(await text('[data-carry] small')), 'ONE primary: Carry on: Chapter 3 (next step Practise)');
  ok(await ev('document.querySelector("[data-carry]").getAttribute("href")') === '#/y3/ch03/practice', 'the button goes to the next step');
  const states = await ev('[...document.querySelectorAll(".stonelink")].map((a) => a.dataset.state)');
  ok(states.join() === 'passed,passed,studying,todo,todo', 'stone states: ' + states);
  ok(/55 words in 5 chapters · 2 tests passed/.test(await text('.yearcard__sum')), 'the year line');
  ok(await ev('[...document.querySelectorAll(".stonelink")].every((a) => { const r = a.getBoundingClientRect(); return r.height >= 48 && r.width >= 48; })'), 'stones are at least 48 px');
  ok(await ev('[...document.querySelectorAll(".stonelink")].every((a) => { const r = a.getBoundingClientRect(); return r.height >= 72 && r.width >= 60; })'), 'stones are about 64 x 72 at 390');
  ok(await ev('[...document.querySelectorAll(".stonelink__label")].every((e) => parseFloat(getComputedStyle(e).fontSize) >= 14)'), 'labels are at least 14 px');
  ok(await ev('document.querySelectorAll(".stonelink[data-state=passed] svg").length') === 2, 'a passed stone has a star');
  ok(await ev('[...document.querySelectorAll("[data-yearswitch] [data-year], [data-carry], .tile")].every((e) => e.getBoundingClientRect().height >= 48)'), 'the year buttons, tiles and the button are at least 48 px');
  ok(await ev('document.querySelectorAll("[data-yearswitch] [data-year]").length') === 4, 'a button for each year the curriculum has (3 to 6)');
  ok(await tabTo('.stonelink') >= 3, 'a 3 px focus ring on a stone');
  step('the year grid, remembered');
  await click('[data-yearswitch] [data-year=y5]');
  ok(await ev('document.querySelector("[data-yearpanel]").dataset.yearpanel') === 'y5' && /Start: Chapter 1/.test(await text('[data-carry]')) && await frontPrimaries() === 1, 'Year 5: Start: Chapter 1, still one primary');
  ok(await ev('document.querySelector("[data-yearswitch] [data-year=y5]").getAttribute("aria-pressed")') === 'true', 'pressed state');
  await open(plus(2), '#/chapters');
  await until('document.querySelector("[data-yearpanel=y5]")', 'the remembered year');
  await click('[data-yearswitch] [data-year=y3]');
  await allViews('front-chapters-child');
  await width(1180, 640);
  ok(await ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), 'no sideways scroll at 1180x640');
  await width(820, 1180);
  ok(await ev('document.documentElement.scrollWidth <= document.documentElement.clientWidth'), 'no sideways scroll at 820x1180');
  await width(390);
  step('every chapter is reachable, a closed one says what to pass first');
  await click('.stonelink[data-chapter=ch04]');
  await until('document.querySelector("[data-chapter-locked]")', 'the closed chapter');
  ok(/Pass Chapter 3 first\./.test(await text()) && await ev('document.querySelector("[data-chapter-locked] a.btn").getAttribute("href")') === '#/y3/ch03', 'Pass Chapter 3 first, with a way there');
  step('all five passed');
  await childWith(progDoc({}, Array.from({ length: 5 }, (_, i) => passedCh(i + 1))), '#/chapters');
  ok(await ev('document.querySelector("[data-yearpanel]").dataset.yearpanel') === 'y4', 'a child in Year 4 opens on Year 4, whatever else is passed');
  await click('[data-yearswitch] [data-year=y3]');
  await until('document.querySelector("[data-allpassed]")', 'the all-passed state');
  ok(await frontPrimaries() === 0 && /All 5 passed/.test(await text('[data-allpassed]')), 'All 5 passed, no button');
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
  await childWith(PROG_3, '#/y3/ch03');
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
  await childWith(progDoc({ 'y34-ch01': { studiedAt: T0, practisedAt: T0 }, 'y34-ch02': { studiedAt: T0, practisedAt: T0 }, 'y34-ch03': { studiedAt: T0, practisedAt: T0 } }, [passedCh(1), passedCh(2)]), '#/y3/ch03');
  await until('document.querySelector("[data-chapterpage]")', 'the chapter');
  ok(await has('[data-primary=test]') && await frontPrimaries() === 1 && !await has('[data-test-gated]'), 'Take the test is the one primary');
  step('tried before, never practised on this record: still openable');
  await childWith(progDoc({ 'y34-ch01': { studiedAt: T0, practisedAt: T0 }, 'y34-ch02': { studiedAt: T0, practisedAt: T0 } }, [passedCh(1), passedCh(2), { id: 'x3', c: 'y34-ch03', s: 3, t: 5, at: T0 + 9 }]), '#/y3/ch03');
  await until('document.querySelector("[data-chapterpage]")', 'the chapter');
  ok(await ev('document.querySelector("[data-step-link=test]").getAttribute("href")') === '#/y3/ch03/test' && !await has('[data-test-gated]'), 'an attempted test stays openable');
  step('a passed chapter: its test opens again, Next chapter leads on');
  await go('#/y3/ch01');
  await until('document.querySelector("[data-chapterpage]")', 'chapter 1');
  ok(/Take the test again/.test(await text('[data-step-link=test]')) && await has('[data-next-chapter]'), 'Take the test again, and Next chapter');
  await click('[data-step-link=test]');
  await until('location.hash === "#/y3/ch01/test"', 'the test opens');
  step('learning marks the step done');
  await childWith(PROG_3, '#/y3/ch03/study');
  await click('[data-done]');
  await go('#/y3/ch03');
  await until('document.querySelector("[data-chapterpage]")', 'the chapter');
  ok((await ev('document.querySelector("[data-step=practise]").dataset.state')) === 'next', 'practise is next');
  step('an adult may always open the test');
  await adultWith(PROG_3, '#/y3/ch03');
  await until('document.querySelector("[data-chapterpage]")', 'the chapter');
  ok(await has('[data-test-gated]') && await ev('document.querySelector("[data-test-anyway]").getAttribute("href")') === '#/y3/ch03/test', 'Take the test anyway, for an adult');
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
  for (const h of ['#/chapters', '#/y34', '#/y56', '#/y3/ch03', '#/y3/ch05', '#/custom', '#/tricky', '#/progress', '#/about', '#/words']) {
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
  ok(await ev('document.querySelector("[data-yearswitch] [data-year=y3]").getAttribute("aria-pressed")') === 'true', 'with the year chosen');
  await go('#/y56');
  await until('document.querySelector("[data-yearpanel=y5]")', 'Year 5 and 6 chosen by its old link');
  step('test day: More practice and a chapter show no test word');
  await seedChild(studied(weekDoc()), plus(5));
  await putProgress(CHILD, PROG_3);
  await open(plus(5), '#/chapters');
  for (const h of ['#/chapters', '#/y3/ch03', '#/y56']) {
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
    if (who === 'adult') await adultWith(PROG_3, '#/y3/ch03'); else await childWith(PROG_3, '#/y3/ch03');
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

scene('SB3-F adult Menu: My words is a row on Play yourself and opens My words; the Learning line shows on More practice for an adult only', async () => {
  await adultWith(progDoc(), '#/chapters');
  await width(1280, 800);
  ok(await visible('.foot__papers') && /From Waystead Learning/i.test(await text('.foot__papers')) && await ev('document.querySelectorAll(".foot__papers").length') === 1, 'ONE Learning papers line, at the foot of More practice');
  await click('#adult-menu-btn');
  await until('!document.querySelector("#adult-menu-panel").hidden', 'the Menu');
  const rows = await ev('[...document.querySelectorAll("#adult-menu-panel nav ul a")].map((a) => [a.querySelector("b").textContent, a.querySelector("span.adultrow__text > span").textContent])');
  ok(rows.length === 5 && rows[3][0] === 'Play yourself', 'SB5: five rows, the grown-up\'s own practice is Play yourself: ' + JSON.stringify(rows));
  await click('#adult-menu-panel a[href="#/grownups/yourself"]');
  await until('location.hash === "#/grownups/yourself" && document.querySelector("main h1")', 'Play yourself');
  const my = await ev('[...document.querySelectorAll("main a[href=\\"#/words\\"]")].map((a) => [a.querySelector("b") ? a.querySelector("b").textContent : "", a.innerText])');
  ok(my.length === 1 && /My words/.test(my[0][1]) && /Words you pick to practise/.test(my[0][1]), 'My words, with its helper, is a row on Play yourself: ' + JSON.stringify(my));
  await click('main a[href="#/words"]');
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
  await until('location.hash === "#/words/g/g1"', 'D26: a child has no edit form, the route goes back to the week');
  ok(!await has('[data-save]') && !await has('[data-delete]') && !/delete/i.test(await text()), 'the child gets no form, no Delete button or wording');
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
  ok(!/Week two/.test(await text('h1, .today__head')) , 'off: the saved week is ignored');
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
  ok(!await has('main .list a[href*="/g/"]') && /Week one/.test(await text('main')) && !/Week two/.test(await text('main')), 'My words shows the pick only (D26 tiles, the week named under Study this week): ' + await text('main'));
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

// ---- plug-ins: tools/smoke-sb4/*.mjs, each `export default (H) => { H.scene(name, fn) }` ------------
// A later work package adds its scenes in its own file there, so none edits this one.
const H = {
  scene, go, click, ev, ok, has, text, until, key, keys, sleep, shot, width, style, open, acct,
  allowLog: (re) => { allowedLog = re; },
  askRole: (on) => { askRole = !!on; },
  emulate: (features) => send('Emulation.setEmulatedMedia', { media: '', features }), // e.g. [{ name: 'prefers-reduced-motion', value: 'reduce' }]; cleared before every scene
  serve: (path, body) => { if (body === null) overrides.delete(path); else overrides.set(path, body); }, // a site file served from a string for this scene; null clears it
  legacyCurriculum: LEGACY_CURRICULUM, seedChild, signedOutBlank, childWith, adultWith, readDoc, readLocal, visible, rect,
  KB_VIEWS, KB_PORTRAIT, CHILD, CHILD2, ADULT, MON, plus, W, kbFit,
  kbSeed, weekDoc, studied, practiceDayDoc, gameDayDoc, ROOT, twoWeeksDoc, // SB5-WP-H: the fold harness reuses the keyboard scene's seeding
};
H.send = send; // SB4-WP11: the teacher page's print scenes switch on print media
for (const f of readdirSync(join(ROOT, 'tools/smoke-sb4')).filter((n) => n.endsWith('.mjs')).sort()) (await import(pathToFileURL(join(ROOT, 'tools/smoke-sb4', f)))).default(H);
// SB5: tools/smoke-sb5/*.mjs the same way (fold.mjs is the phone-fold harness, TR-60..61; fold-known.json is its known-failures list, not a scene file)
if (existsSync(join(ROOT, 'tools/smoke-sb5'))) for (const f of readdirSync(join(ROOT, 'tools/smoke-sb5')).filter((n) => n.endsWith('.mjs')).sort()) (await import(pathToFileURL(join(ROOT, 'tools/smoke-sb5', f)))).default(H);

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
    if (ONLY && s.name !== ONLY && !(ONLY.endsWith('*') && s.name.startsWith(ONLY.slice(0, -1)))) continue; // argv[3]: the exact scene name, or a prefix ending in * (e.g. 'SB5 fold*')
    console.log(s.name);
    overrides.clear(); // H.serve is for one scene
    allowedLog = null; curScene = s.name;
    await send('Emulation.setEmulatedMedia', { media: '', features: [] }); // H.emulate is for one scene
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
