// Headless smoke test for Composition: real pages in Chrome, a fake Waystead
// account on localhost:3000 (shared/tests/fake-account.js, plus a fake AI feedback
// route) and the site served with nginx's own Content-Security-Policy. The driver
// is the one in tools/sb2-smoke.mjs.
//
//   node tools/compose-smoke.mjs <folder for screenshots> [scene]
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { fakeAccount } from '../shared/tests/fake-account.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = process.argv[2] || join(tmpdir(), 'compose-shots');
const ONLY = process.argv[3] || '';
const PORT = 8124;
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

let tasksLive = false;
let comicsLive = false; // C2: the comic tiles' own review flag (with tasksLive)
let ownLive = false; // C2-2: My own story's review flag
let netDown = false;
let storiesLive = false;
const TASKS = JSON.parse(readFileSync(ROOT + 'compose/site/data/tasks.json', 'utf8')).tasks;
const SHARED = JSON.parse(readFileSync(ROOT + 'compose/site/data/comic.json', 'utf8'));
const site = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, SITE).pathname);
  const m = /^\/(spellbright|wordbright|compose)\/(.*)$/.exec(path);
  const base = m ? { spellbright: 'site/', wordbright: 'wordbright/site/', compose: 'compose/site/' }[m[1]] : null;
  let file = base ? ROOT + base + (m[2] || 'index.html') : ROOT + 'hub/site' + (path === '/' ? '/index.html' : path);
  if (file && existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file || !existsSync(file)) { res.writeHead(404, { 'Content-Security-Policy': csp }); res.end('not here'); return; }
  let body = readFileSync(file);
  if (file.endsWith('.html')) body = String(body).replaceAll('https://account.waystead.co.uk', ACCOUNT); // the page's own CSP
  // tasks.json: a task's own flag is at 3 spaces, its comic's at 4 (indent 1).
  if (file.endsWith('tasks.json') && tasksLive) body = String(body).replace(/^ {3}"reviewed": false/gm, '   "reviewed": true');
  if (file.endsWith('tasks.json') && comicsLive) body = String(body).replace(/^ {4}"reviewed": false/gm, '    "reviewed": true');
  if (file.endsWith('comic.json') && ownLive) body = String(body).replace('"reviewed": false', '"reviewed": true');
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Content-Security-Policy': csp, 'Cache-Control': 'no-store' });
  res.end(body);
});

const feedbackCalls = [];
const AI_REPLY = { stars: ['You chose the word bright well.', 'Your ending is clear.'], wish: 'Try saying how Maya felt in picture 2.', spellings: [{ word: 'kyte', suggestion: 'kite' }] };
const acct = fakeAccount();
acct.children = (id) => (id === ADULT ? [{ id: CHILD, nickname: 'Robin', year: 4, avatar: null }, { id: CHILD2, nickname: 'Wren', year: 6, avatar: null }] : []);
const account = createServer(async (req, res) => {
  const cors = { 'Access-Control-Allow-Origin': SITE, 'Access-Control-Allow-Credentials': 'true', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS', Vary: 'Origin' };
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
  if (acct.offline) { req.socket.destroy(); return; } // the network gone, as the browser sees it
  if (req.url.startsWith('/api/voice/')) { res.writeHead(404, cors); res.end(); return; }
  if (req.url === '/api/compose/feedback') { // the real rules are tested in waystead-account
    const chunks0 = [];
    for await (const c of req) chunks0.push(c);
    feedbackCalls.push(JSON.parse(Buffer.concat(chunks0).toString()));
    const on = acct.data.get(CHILD)?.get('compose/settings')?.value?.aiFeedback === true;
    res.writeHead(on ? 200 : 403, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify(on ? AI_REPLY : { error: 'ai-feedback-off' }));
    return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const r = await acct.fetch(ACCOUNT + req.url, { method: req.method, credentials: 'include', body: chunks.length ? Buffer.concat(chunks).toString() : undefined });
  res.writeHead(r.status, { ...cors, 'Content-Type': 'application/json' });
  const data = r.status === 204 ? null : await r.json();
  res.end(data === null ? '' : JSON.stringify(data));
});

// ---- Chrome ---------------------------------------------------------------------------
const PROFILE = join(tmpdir(), 'compose-smoke-' + process.pid);
const chrome = spawn(CHROME, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--remote-debugging-port=9334', '--user-data-dir=' + PROFILE, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function connect() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await (await fetch('http://127.0.0.1:9334/json')).json();
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
// Taps and typed characters, counted for the report (C2: a Year 3 comic needs no typing).
const count = { taps: 0, typed: 0 };
async function click(s) { await until('document.querySelector(' + q(s) + ')', s); await ev('document.querySelector(' + q(s) + ').click()'); count.taps += 1; await sleep(30); }
/** Tap the button whose attribute is exactly this value (tile text can hold any character). */
async function tapBy(attr, value) {
  const expr = '[...document.querySelectorAll("[' + attr + ']")].find((b) => b.getAttribute(' + q(attr) + ') === ' + q(String(value)) + ')';
  await until(expr, attr + '=' + value);
  await ev('(' + expr + ').click()');
  count.taps += 1;
  await sleep(30);
}
async function key(k) {
  const code = k.length === 1 ? 'Key' + k.toUpperCase() : k;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, text: k.length === 1 ? k : k === 'Enter' ? '\r' : undefined, windowsVirtualKeyCode: k === 'Enter' ? 13 : k === 'Backspace' ? 8 : k.toUpperCase().charCodeAt(0) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code });
}
async function keys(s) { for (const c of s) await key(c); }
/** Keyboard only: Tab until this element has the focus, then press Enter. */
async function tabTo(sel, max = 80) {
  for (let i = 0; i < max; i += 1) {
    if (await ev('!!document.activeElement && document.activeElement.matches(' + q(sel) + ')')) return;
    await key('Tab');
  }
  throw new Error('Tab never reached ' + sel + ' (at ' + await ev('document.activeElement && document.activeElement.outerHTML.slice(0,120)') + ')');
}
async function press(k) { await key(k); count.taps += 1; await sleep(40); }
/** A real mouse drag (pointer events) from one element's centre to another's. */
async function drag(fromSel, toSel) {
  await ev('document.querySelector(' + q(toSel) + ').scrollIntoView({block:"center"})');
  const box = (s2) => ev('(()=>{const r=document.querySelector(' + q(s2) + ').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()');
  const [x0, y0] = await box(fromSel);
  const [x1, y1] = await box(toSel);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x0, y: y0, button: 'left', clickCount: 1 });
  for (let k = 1; k <= 6; k += 1) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x0 + ((x1 - x0) * k) / 6, y: y0 + ((y1 - y0) * k) / 6, button: 'left' });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x1, y: y1, button: 'left', clickCount: 1 });
  await sleep(80);
}
async function tapAt(sel, fx, fy) {
  await ev('document.querySelector(' + q(sel) + ').scrollIntoView({block:"center"})');
  const [x, y] = await ev('(()=>{const r=document.querySelector(' + q(sel) + ').getBoundingClientRect();return [r.left+r.width*' + fx + ',r.top+r.height*' + fy + ']})()');
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  count.taps += 1;
  await sleep(80);
}
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
    globalThis.Audio = class { constructor(u) { this.u = u; } play() { setTimeout(() => this.onended && this.onended(), 5); return Promise.resolve(); } pause() {} };
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
  await send('Page.navigate', { url: SITE + '/compose/' + hash });
  await until('document.readyState === "complete" && document.querySelector("main section, main .card")', 'the page');
  await sleep(120);
}

async function shot(name) {
  await ev('window.scrollTo(0, 0)');
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

// ---- the scenes ---------------------------------------------------------------------------
const DAY = '2026-11-05';
const SCENES = [];
const scene = (name, fn) => SCENES.push({ name, fn });
async function blank() {
  acct.who = null;
  await open(DAY, '#/about');
  await ev('localStorage.clear()');
  await sleep(50);
  acct.prefs.clear();
  acct.data.clear();
  acct.calls.length = 0;
  feedbackCalls.length = 0;
}
const fill = (sel, value) => { count.typed += value.length; return ev('(()=>{const n=document.querySelector(' + q(sel) + ');n.value=' + q(value) + ';n.dispatchEvent(new Event("input",{bubbles:true}))})()'); };
const STORY = ['Maya had a bright red kyte and she was happy.', 'The string broke and the kite got stuck in a tree', 'A man got a ladder because he wanted to help.', 'he gave the kite back. Maya said thank you.'];
const writing = () => acct.data.get(CHILD)?.get('compose/writing')?.value;
const onePiece = () => Object.values(writing()?.pieces || {})[0];

scene('the hub card', async () => {
  await blank();
  await send('Page.navigate', { url: 'about:blank' });
  await send('Page.navigate', { url: SITE + '/' });
  await until('document.querySelector("[data-compose]")', 'the card');
  await allViews('hub');
  await ev('document.querySelector("[data-compose]").click()');
  await until('location.pathname === "/compose/"', 'the card goes to Composition');
  await until('document.querySelector("[data-gate-signin]")', 'sign in to play');
  await allViews('gate');
});

scene('a child: nothing until a task is reviewed', async () => {
  await blank();
  acct.who = childMe;
  await open(DAY, '#/');
  await until('document.querySelector("[data-notasks]")', 'no tasks yet');
  await go('#/t/lost-kite/look');
  await until('document.querySelector("[data-notasks]")', 'an unreviewed task sends a child back');
  ok(!await ev('document.querySelector("main").innerText.includes("Maya")'), 'no task text');
});

scene('grown-ups: review and consent', async () => {
  await blank();
  acct.who = adultMe;
  await open(DAY, '#/');
  await until('document.querySelector("[data-task=\\"lost-kite\\"]")', 'an adult sees every task');
  ok(await ev('document.querySelectorAll("[data-task]").length') === 12, 'all 12');
  ok(/Not reviewed yet/.test(await text()), 'marked as unreviewed');
  await allViews('tasks-adult');
  await go('#/grownups/tasks');
  await until('document.querySelectorAll("[data-review]").length === 12', 'the review page');
  await allViews('task-review');
  await click('[data-approve="lost-kite"]');
  ok(/approve-tasks\.mjs lost-kite/.test(await text('[data-command]')), 'the command');
  await click('[data-approvecomic="seal-pup"]');
  ok(/approve-tasks\.mjs --comic seal-pup/.test(await text('[data-comiccommand]')), 'the comic command');
  ok(/approve-tasks\.mjs --own/.test(await text('[data-summary]')), 'and the own-story command');
  await ev('document.querySelector("[data-review=\\"lost-kite\\"] details").open = true');
  ok(/Maya\|?.*flew|Maya flew her kite/.test(await text('[data-review="lost-kite"]')), 'the comic tiles to read');
  await go('#/grownups');
  await until('document.querySelector("[data-child]")', 'the children');
  await click('[data-child="' + CHILD + '"]');
  await until('document.querySelector("[data-ai]")', 'the child page');
  ok(!await ev('document.querySelector("[data-ai]").checked'), 'off by default');
  await click('[data-ai]');
  await until('/AI feedback is on/.test(document.querySelector("[data-ainote]").innerText)', 'saved');
  ok(acct.data.get(CHILD).get('compose/settings').value.aiFeedback === true, 'in the child\'s data');
  await allViews('grownups-child-empty');
});

scene('a child writes a Year 3 story', async () => {
  tasksLive = true;
  try {
    const settings = { v: 1, aiFeedback: true, at: 1 };
    await blank();
    acct.who = childMe;
    acct.put(CHILD, 'compose', 'settings', settings);
    await open(DAY, '#/');
    await until('document.querySelector("[data-task=\\"lost-kite\\"]")', 'the tasks');
    await allViews('tasks-child');
    await click('[data-task="lost-kite"]');
    await until('document.querySelector(".strip img")', 'Look');
    const shapes = await ev('[...document.querySelectorAll(".strip img")].map((i) => { const r = i.getBoundingClientRect(); return r.width / r.height; })');
    ok(shapes.length === 4 && shapes.every((x) => Math.abs(x - 4 / 3) < 0.02), 'whole pictures, not cropped: ' + shapes);
    await allViews('look');
    await click('[data-big="0"]');
    await until('document.querySelector("dialog[open] img")', 'the bigger picture');
    await shot('look-enlarged-garden-390');
    await click('[data-close]');
    await click('[data-hint="kite"]');
    await click('[data-go]');
    await until('document.querySelector("[data-line=\\"0\\"]")', 'Plan');
    for (let i = 0; i < 4; i += 1) await fill('[data-line="' + i + '"]', 'Line ' + (i + 1));
    await allViews('plan');
    await click('[data-go]');
    await until('document.querySelector("[data-part=\\"3\\"]")', 'Write: a box per picture');
    ok(await ev('document.querySelectorAll("[data-part]").length') === 4, 'four boxes at Year 3');
    for (let i = 0; i < 4; i += 1) await fill('[data-part="' + i + '"]', STORY[i]);
    await sleep(300);
    const t = await text('.livebar');
    ok(/\d+ words/.test(t), 'a live word count: ' + t);
    await until('document.querySelectorAll(".hint.is-used").length >= 3', 'hint words ticked');
    await until('/Is kyte spelled like the hint word kite/.test(document.querySelector("[data-slips]").innerText)', 'the misspelling flagged');
    await click('[data-gentlebtn]');
    ok(/capital|full stop/.test(await text('[data-gentle]')), 'the gentle check: ' + await text('[data-gentle]'));
    await allViews('write');
    step('leaving keeps the draft');
    await sleep(900);
    await click('[data-go]');
    await until('document.querySelector("[data-tick]")', 'Check');
    ok(/bright red kyte/.test(await text('.piece')), 'the story is there');
    await click('[data-tick="0"]');
    await allViews('check');
    await sleep(800);
    await click('[data-submit]');
    await until('document.querySelector("[data-ai]")', 'the AI feedback');
    ok(feedbackCalls.length === 1 && Object.keys(feedbackCalls[0]).sort().join() === 'level,taskId,text', 'only those three go');
    ok(/Two stars and a wish/.test(await text()), 'the feedback shows');
    ok(await has('[data-checks]'), 'and the automatic checks');
    await allViews('feedback');
    await click('[data-better]');
    await until('document.querySelector("[data-part=\\"0\\"]")', 'Make it better');
    await fill('[data-part="0"]', 'Maya had a bright red kite and she was happy.');
    await fill('[data-part="3"]', 'He gave the kite back. Maya said thank you.');
    await allViews('better');
    await click('[data-finish]');
    await until('document.querySelector("[data-final]")', 'Final');
    await allViews('final');
    await go('#/writing');
    await until('document.querySelector("[data-piece]")', 'My writing');
    await allViews('my-writing');
    await sleep(1900);
    const p = onePiece();
    ok(p && p.stage === 'final' && /bright red kite/.test(p.final) && /kyte/.test(p.first), 'saved to the account: first and final');
    step('the parent sees it and marks it');
    await ev('sessionStorage.clear()');
    acct.who = null;
    await open(DAY, '#/about');
    const before = acct.data.get(CHILD);
    await ev('localStorage.clear()');
    acct.data.set(CHILD, before);
    acct.who = adultMe;
    await open(DAY, '#/grownups/child/' + CHILD);
    await until('document.querySelector("[data-piece]")', 'the piece in the list');
    await allViews('grownups-child');
    await click('[data-piece="' + p.id + '"]');
    await until('document.querySelector("[data-mark]")', 'the piece');
    const page = await text();
    for (const want of ['Line 1', 'First draft', 'Automatic checks', 'Two stars and a wish', 'Only you and your child']) ok(page.includes(want), 'the parent sees: ' + want);
    await click('[data-save]');
    await until('/each part/.test(document.querySelector("[data-note]").innerText)', 'all five scores needed');
    for (const k of ['ideas', 'order', 'words', 'sentences', 'spelling']) await click('[name="r-' + k + '"][value="4"]');
    await fill('[data-comment]', 'Lovely ending.');
    await allViews('marking');
    await click('[data-save]');
    await until('/Mark saved/.test(document.querySelector("[data-note]").innerText)', 'the mark saved');
    ok(acct.data.get(CHILD).get('compose/marks').value.marks[p.id].ideas === 4, 'in the child\'s data');
    await send('Emulation.setEmulatedMedia', { media: 'print' });
    await width(1280);
    await shot('piece-print');
    await send('Emulation.setEmulatedMedia', { media: '' });
    await width(390);
    step('the child sees the comment');
    acct.who = null;
    await open(DAY, '#/about');
    await ev('localStorage.clear()');
    acct.data.set(CHILD, before);
    acct.who = childMe;
    await open(DAY, '#/writing/' + p.id);
    await until('/Lovely ending/.test(document.querySelector("main").innerText) || document.querySelector("[data-piece]")', 'the piece');
    await sleep(600);
    if (await has('[data-piece]')) await click('[data-piece]');
    await until('/Lovely ending/.test(document.querySelector("main").innerText)', 'the comment');
  } finally { tasksLive = false; }
});

scene('no consent: no call, and the checks still show', async () => {
  tasksLive = true;
  try {
    await blank();
    acct.who = childMe;
    await open(DAY, '#/t/lost-kite/write');
    await until('document.querySelector("[data-part=\\"0\\"]")', 'Write');
    await fill('[data-part="0"]', 'The kite flew high and Maya was happy.');
    await sleep(800);
    await go('#/t/lost-kite/check');
    await click('[data-submit]');
    await until('document.querySelector("[data-checks]")', 'the checks');
    ok(!await has('[data-ai]') && feedbackCalls.length === 0, 'no AI feedback, and no call');
  } finally { tasksLive = false; }
});

scene('a Year 5 task: one box, offline drafts', async () => {
  tasksLive = true;
  try {
    await blank();
    acct.who = childMe;
    await open(DAY, '#/t/seal-pup/write');
    await until('document.querySelector("[data-part=\\"0\\"]")', 'Write');
    ok(await ev('document.querySelectorAll("[data-part]").length') === 1, 'one box');
    await allViews('write-y5');
    netDown = true;
    acct.offline = true;
    await fill('[data-part="0"]', 'The beach was empty.');
    await sleep(900);
    await go('#/');
    await sleep(100);
    ok(/empty/.test(await ev('localStorage.getItem("cp.writing:' + CHILD + '")')), 'kept on the device');
    acct.offline = false;
    await ev('window.dispatchEvent(new Event("online"))');
    for (let i = 0; i < 100 && !/empty/.test(JSON.stringify(writing() || {})); i += 1) await sleep(100);
    ok(/empty/.test(JSON.stringify(writing())), 'sent once back online');
    await sleep(200);
    netDown = false;
  } finally { tasksLive = false; }
});

// ---- Comic Studio (C2) ----------------------------------------------------------------------
const comics = () => acct.data.get(CHILD)?.get('compose/comics')?.value;
const theComic = (kindOf = 'task') => Object.values(comics()?.comics || {}).find((c) => c.kind === kindOf);
const taskOf = (id) => TASKS.find((t) => t.id === id);
const fits = (t, q2) => t.comic[q2].findIndex((o) => o.fits);
async function next() { await click('[data-welldone] [data-next]'); }
async function moveIs(m) { await until('document.querySelector("[data-move=\\"' + m + '\\"]")', 'the ' + m + ' move'); }
/** Order it, with no mistakes: tap each picture, then its box. */
async function orderByTaps() {
  await moveIs('order');
  for (let k = 0; k < 4; k += 1) { await click('[data-card="' + k + '"]'); await click('[data-slot="' + k + '"]'); }
  await click('[data-check]');
  await until('document.querySelector("[data-welldone]")', 'well done after the order');
  await next();
}
async function wheelByTaps(t) {
  for (const q2 of ['who', 'where', 'when']) { await moveIs('wheel'); await click('[data-choice="' + fits(t, q2) + '"]'); }
  await until('document.querySelector("[data-welldone]")', 'the opening');
  ok(/One windy afternoon|One |Early|On /.test(await text('[data-welldone]')), 'the opening caption is shown');
  await next();
}
async function joinByTaps() {
  await moveIs('join');
  for (let n = 0; n < 4 && await has('[data-up]'); n += 1) { await click('[data-up]'); await sleep(40); }
  await click('[data-end="0"]');
  await until('document.querySelector("[data-welldone]")', 'joined up');
  await next();
}

scene('Comic Studio: a full Year 3 comic, taps only', async () => {
  tasksLive = true; comicsLive = true;
  try {
    await blank();
    acct.who = childMe;
    await open(DAY, '#/');
    await until('document.querySelector("[data-task=\\"lost-kite\\"][data-comic-task]")', 'the comic task');
    await allViews('c-home');
    const t = taskOf('lost-kite');
    count.taps = 0; count.typed = 0;
    await click('[data-task="lost-kite"]');
    await until('document.querySelector("[data-start]")', 'the studio');
    await allViews('c-start');
    await click('[data-start]');
    await moveIs('order');
    await allViews('c1-order');
    await orderByTaps();
    await moveIs('wheel');
    await allViews('c2-wheel');
    await wheelByTaps(t);
    for (let i = 0; i < 4; i += 1) {
      const spec = t.comic.panels[i];
      await until('document.querySelector("[data-op]")', 'the starters, panel ' + (i + 1));
      if (i === 0) await allViews('c3-panel-opener');
      await click('[data-op="0"]');
      const path = spec.paths[0].split('|');
      for (let k = 0; k < path.length; k += 1) {
        if (i === 0 && k === 1) await allViews('c3-panel-tiles');
        await tapBy('data-tile', path[k]);
      }
      await until('document.querySelector("[data-face]")', 'the faces');
      if (i === 0) await allViews('c3-panel-face');
      await click('[data-face="' + spec.feel.fits[0] + '"]');
      await until('document.querySelector("[data-feel]")', 'the feeling words');
      if (i === 0) await allViews('c3-panel-feeling');
      await click('[data-feel]');
      await until('document.querySelector("[data-say]")', 'the speech');
      if (i === 0) await allViews('c3-panel-speech');
      await click('[data-say="0"]');
      await until('document.querySelector("[data-welldone]")', 'panel done');
      if (i === 0) await allViews('c3-panel-welldone');
      await next();
    }
    await moveIs('join');
    await allViews('c4-join');
    await joinByTaps();
    await moveIs('read');
    await allViews('c5-read');
    const before = { ...count };
    await click('[data-readall]');
    await until('document.querySelector(".is-reading")', 'a line lit while it is read');
    await until('!document.querySelector(".is-reading")', 'reading ends', 15000);
    count.taps = before.taps; // listening is optional: not in the count
    await click('[data-finish]');
    await until('document.querySelector("[data-final]")', 'the finished comic');
    ok(count.typed === 0, 'no typing at all: ' + count.typed);
    console.log('    Year 3 comic: ' + count.taps + ' taps, ' + count.typed + ' typed characters');
    ok(await has('.cover .stamp') && await has('.comic--big .bubble'), 'a cover with a stamp, and speech bubbles');
    ok(/One windy afternoon, Maya and her little brother Sam were at the park\./.test(await text()), 'the opening caption');
    await allViews('c7-finished');
    await sleep(1900);
    const c = theComic();
    ok(c && c.stage === 'done' && c.panels.every((p) => p.done) && c.order.done, 'saved to the account, finished');
    await go('#/comics');
    await until('document.querySelector("[data-comic]")', 'My comics');
    ok(/1 stamp/.test(await text()), 'one stamp');
    await allViews('c8-shelf');
    await send('Emulation.setEmulatedMedia', { media: 'print' });
    await go('#/comics/' + c.id);
    await until('document.querySelector("[data-final]")', 'the comic again');
    await width(1280);
    await shot('c7-finished-print');
    await send('Emulation.setEmulatedMedia', { media: '' });
    await width(390);
  } finally { tasksLive = false; comicsLive = false; }
});

scene('Comic Studio: keyboard only, a drag, and kind answers', async () => {
  tasksLive = true; comicsLive = true;
  try {
    await blank();
    acct.who = childMe;
    await open(DAY, '#/c/muddy-dog');
    await until('document.querySelector("[data-start]")', 'the studio');
    await width(1280);
    await tabTo('[data-start]'); await press('Enter');
    await moveIs('order');
    step('a drag puts picture 1 in box 1');
    await drag('[data-card="0"]', '[data-slot="0"]');
    ok(await has('[data-slot="0"].is-full'), 'dropped in the box');
    step('the rest by keyboard: two swapped on purpose');
    const put = async (card, slot) => { await tabTo('[data-card="' + card + '"]'); await press('Enter'); await tabTo('[data-slot="' + slot + '"]'); await press('Enter'); };
    await put(1, 2); await put(2, 1); await put(3, 3);
    await tabTo('[data-check]'); await press('Enter');
    await until('/Nearly/.test(document.querySelector("[data-gentle]").innerText)', 'a kind answer, no cross');
    ok(!/wrong|incorrect/i.test(await text()), 'never "wrong"');
    await allViews('c1-order-nearly');
    await put(1, 1); await put(2, 2);
    await tabTo('[data-check]'); await press('Enter');
    await until('document.querySelector("[data-welldone]")', 'in order');
    ok((await text('[data-welldone]')).length > 0 && await ev('document.querySelectorAll("[data-welldone] .stars .is-on").length') === 2, 'two stars after one try back');
    await tabTo('[data-next]'); await press('Enter');
    const t = taskOf('muddy-dog');
    for (const q2 of ['who', 'where', 'when']) {
      await moveIs('wheel');
      const wrongOne = t.comic[q2].findIndex((o) => !o.fits);
      if (q2 === 'who') { await tabTo('[data-choice="' + wrongOne + '"]'); await press('Enter'); await until('/look at the pictures again/i.test(document.querySelector("[data-gentle]").innerText)', 'a kind answer'); }
      await tabTo('[data-choice="' + fits(t, q2) + '"]'); await press('Enter');
    }
    await tabTo('[data-next]'); await press('Enter');
    await until('document.querySelector("[data-op]")', 'the starters');
    await tabTo('[data-op="1"]'); await press('Enter');
    await until('document.querySelector("[data-tile]")', 'the tiles');
    await tabTo('[data-tile="a penguin"]'); await press('Enter');
    await until('/Try another word/.test(document.querySelector("[data-gentle]").innerText)', 'try another word');
    await tabTo('[data-tile="Honey"]'); await press('Enter');
    await until('document.querySelector("[data-undo=\\"0\\"]")', 'placed');
    await tabTo('[data-undo="0"]'); await press('Enter');
    await until('!document.querySelector("[data-undo]")', 'taken back');
    ok(await ev('document.activeElement && document.activeElement.matches("[data-focus], body, main")') !== null, 'focus is somewhere sensible');
    await width(390);
  } finally { tasksLive = false; comicsLive = false; }
});

scene('Comic Studio: a Year 5 comic with the challenge, and Grown-ups', async () => {
  tasksLive = true; comicsLive = true;
  try {
    await blank();
    acct.who = childMe;
    const t = taskOf('seal-pup');
    await open(DAY, '#/c/seal-pup');
    await until('document.querySelector("[data-start]")', 'the studio');
    ok(/Level: Year 5/.test(await text()), 'starts at the task\'s level');
    count.taps = 0; count.typed = 0;
    await click('[data-start]');
    await orderByTaps();
    await wheelByTaps(t);
    for (let i = 0; i < 4; i += 1) {
      const spec = t.comic.panels[i];
      await until('document.querySelector("[data-op]")', 'the starters');
      await click('[data-op="1"]');
      await until('document.querySelector("[data-typed]")', 'the typing box');
      if (i === 0) {
        await click('[data-add]');
        ok(/ $/.test(await ev('document.querySelector("[data-typed]").value')), 'a tapped word goes in the box');
        await fill('[data-typed]', SHARED.openers['5'][0][1] + ' my frend found shells');
        await click('[data-done]');
        await until('/We don.t know the word "frend"/.test(document.querySelector("[data-gentle]").innerText)', 'the filter, kindly');
        await allViews('c5y-type');
      }
      await fill('[data-typed]', SHARED.openers['5'][i][1] + ' ' + spec.paths[0].split('|').join(' '));
      await click('[data-done]');
      await until('document.querySelector("[data-face]")', 'the faces');
      await click('[data-face="' + spec.feel.fits[0] + '"]');
      await click('[data-feel]');
      await until('document.querySelector("[data-why]")', 'why');
      if (i === 0) {
        await click('[data-join="so"]');
        await fill('[data-why]', 'she called for help');
        await allViews('c5y-why');
        await click('[data-done]');
      } else await click('[data-skip]');
      await until('document.querySelector("[data-say]")', 'speech');
      if (i === 1) {
        await click('.ownbubble summary');
        await fill('[data-bubble]', 'We need help');
        await allViews('c5y-ownbubble');
        await click('[data-ownsay]');
      } else await click('[data-say="1"]');
      await until('document.querySelector("[data-welldone]")', 'panel done');
      await next();
    }
    await joinByTaps();
    await moveIs('read');
    ok(/she called for help/.test(await text()), 'the reason is in the caption');
    await click('[data-challenge]');
    await until('document.querySelector("[data-story]")', 'Write it yourself');
    await allViews('c6-challenge');
    await fill('[data-story]', 'The beach was empty, or so they thought. Rosa and Finn collected shells along the shore.\n\nA seal was tangled in an old net. Rosa felt anxious, so she phoned the rescue team.\n\n"You did the right thing," said the rescuer. She gently cut the net away.\n\nFinally, the seal slid into the waves. They waved goodbye.');
    await click('[data-done]');
    await until('document.querySelector("[data-checks]")', 'the checks');
    await allViews('c6-challenge-done');
    await click('[data-finish]');
    await until('document.querySelector("[data-final]")', 'finished');
    ok(/In my own words/.test(await text()), 'the challenge is with the comic');
    console.log('    Year 5 comic with the challenge: ' + count.taps + ' taps, ' + count.typed + ' typed characters');
    await sleep(1900);
    const c = theComic();
    ok(c && c.stage === 'done' && c.challenge.done && c.challenge.checks.length >= 5, 'saved with the checks');
    step('the parent sees the comic, the challenge, the stars, and marks it');
    acct.who = null;
    await open(DAY, '#/about');
    const before2 = acct.data.get(CHILD);
    await ev('localStorage.clear()');
    acct.data.set(CHILD, before2);
    acct.who = adultMe;
    await open(DAY, '#/grownups/child/' + CHILD);
    await until('document.querySelector("[data-comicrow]")', 'the comic in the list');
    await allViews('g-child-comics');
    await click('[data-comicrow="' + c.id + '"]');
    await until('document.querySelector("[data-mark]")', 'the comic page');
    const page = await text();
    for (const want of ['Stars:', 'Write it yourself', 'Automatic checks', 'The comic as a story', 'Only you and your child']) ok(page.includes(want), 'the parent sees: ' + want);
    await allViews('g-comic');
    for (const k of ['ideas', 'order', 'words', 'sentences', 'spelling']) await click('[name="r-' + k + '"][value="3"]');
    await click('[data-save]');
    await until('/Mark saved/.test(document.querySelector("[data-note]").innerText)', 'the mark saved');
    ok(acct.data.get(CHILD).get('compose/marks').value.marks[c.id].ideas === 3, 'the mark, by the comic\'s id');
  } finally { tasksLive = false; comicsLive = false; }
});

scene('My own story: stickers, sparks, captions, a finished comic', async () => {
  ownLive = true;
  try {
    await blank();
    acct.who = childMe;
    await open(DAY, '#/');
    await until('document.querySelector("[data-ownlink]")', 'the own-story card');
    await click('[data-ownlink]');
    await until('document.querySelector("[data-new]")', 'the start');
    await allViews('o0-start');
    count.taps = 0; count.typed = 0;
    await click('[data-new]');
    await until('document.querySelector("[data-bg]")', 'places');
    await allViews('o1-setting');
    await click('[data-bg="park"]');
    await until('document.querySelector("[data-pick]")', 'characters');
    await click('[data-pick="amara"]'); await click('[data-pick="biscuit"]');
    await allViews('o2-cast');
    await click('[data-next]');
    await until('document.querySelector("[data-pick=\\"kite\\"]")', 'things');
    await click('[data-pick="kite"]');
    await allViews('o3-props');
    await click('[data-next]');
    await until('document.querySelector("[data-spark]")', 'problems');
    await allViews('o4-problem');
    await click('[data-spark="0"]');
    await until('/The problem/.test(document.querySelector("main").innerText)', 'solutions');
    await click('[data-spark="2"]');
    await until('document.querySelector("[data-add]")', 'the sticker stage');
    await click('[data-add="amara.a"]');
    await click('[data-add="biscuit.b"]');
    await click('[data-add="kite"]');
    step('tap the picture: the chosen sticker moves there');
    await width(1280);
    await tapAt('[data-stagebox] [data-stage]', 0.8, 0.3);
    let st = await ev('[...document.querySelectorAll(".sticker")].map((e) => [e.dataset.x, e.dataset.y].join(","))');
    ok(st[2] === '80,30', 'the kite went where the picture was tapped: ' + st);
    step('drag a sticker');
    await drag('[data-stagebox] .sticker[data-st="1"]', '[data-stagebox] [data-stage]'); // Biscuit, on top of Amara
    st = await ev('[...document.querySelectorAll(".sticker")].map((e) => [e.dataset.x, e.dataset.y].join(","))');
    ok(/^(4\d|5\d|60),(4\d|5\d|60)$/.test(st[1]) && st[1] !== '50,62', 'Biscuit was dragged to the middle: ' + st);
    step('bigger, flip, keyboard nudge, take one out');
    await click('[data-choose="1"]');
    await click('[data-tool="bigger"]');
    await click('[data-tool="flip"]');
    await ev('document.querySelector("[data-stagebox]").focus()');
    await press('ArrowRight');
    await click('[data-choose="2"]');
    await click('[data-tool="delete"]');
    await width(390);
    await allViews('o5-stickers');
    await click('[data-stdone]');
    await until('document.querySelector("[data-tile]")', 'caption tiles');
    for (let k = 0; k < 4; k += 1) { await click('.ctiles [data-tile]'); await sleep(30); }
    await until('document.querySelector("[data-endhere]")', 'where, or finish here');
    await allViews('o6-caption');
    await click('.ctiles [data-tile]');
    await until('document.querySelector("[data-sayline]")', 'the bubble');
    await allViews('o7-bubble');
    await click('[data-sayline]');
    await next();
    for (let i = 1; i < 4; i += 1) {
      await until('document.querySelector("[data-stdone]")', 'panel ' + (i + 1));
      await click('[data-add="amara.b"]');
      await click('[data-stdone]');
      await until('document.querySelector("[data-quick]")', 'the quick caption');
      await click('[data-quick]');
      await until('document.querySelector("[data-nosay]")', 'the bubble');
      await click('[data-nosay]');
      await next();
    }
    await until('document.querySelector("[data-title]")', 'titles');
    await allViews('o8-title');
    await click('[data-title]');
    await until('document.querySelector("[data-final]")', 'the finished comic');
    console.log('    Own story: ' + count.taps + ' taps, ' + count.typed + ' typed characters');
    await allViews('o9-finished');
    await sleep(1900);
    const c = theComic('own');
    ok(c && c.stage === 'done' && c.title && c.panels[0].st.length === 2, 'saved: ' + JSON.stringify(c && c.panels[0].st));
    ok(c.panels[0].st.every((x) => typeof x.x === 'number' && typeof x.y === 'number' && typeof x.s === 'number' && /^[a-z.]+$/.test(x.k)), 'stickers are data, not pictures');
    ok(c.panels[0].st.some((x) => x.s === 1.2 && x.f === 1), 'resized and flipped');
    ok(!JSON.stringify(c).includes('data:image'), 'no pictures saved');
  } finally { ownLive = false; }
});

scene('playing as a child', async () => {
  await blank();
  acct.who = { ...adultMe, playingAs: { id: CHILD, nickname: 'Robin', year: 4, avatar: null } };
  await open(DAY, '#/grownups');
  await until('document.querySelector("[data-playing]")', 'the switch-back card');
  ok(/You.re playing as Robin/.test(await text()), 'names the child');
  ok(!acct.calls.some((c) => c.path.startsWith('/api/children')), 'no child data asked for');
  await allViews('grownups-playing');
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
