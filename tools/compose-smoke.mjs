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
let netDown = false;
let storiesLive = false;
const site = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, SITE).pathname);
  const m = /^\/(spellbright|wordbright|compose)\/(.*)$/.exec(path);
  const base = m ? { spellbright: 'site/', wordbright: 'wordbright/site/', compose: 'compose/site/' }[m[1]] : null;
  let file = base ? ROOT + base + (m[2] || 'index.html') : ROOT + 'hub/site' + (path === '/' ? '/index.html' : path);
  if (file && existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
  if (!file || !existsSync(file)) { res.writeHead(404, { 'Content-Security-Policy': csp }); res.end('not here'); return; }
  let body = readFileSync(file);
  if (file.endsWith('.html')) body = String(body).replaceAll('https://account.waystead.co.uk', ACCOUNT); // the page's own CSP
  if (file.endsWith('tasks.json') && tasksLive) body = String(body).replaceAll('"reviewed": false', '"reviewed": true');
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
const fill = (sel, value) => ev('(()=>{const n=document.querySelector(' + q(sel) + ');n.value=' + q(value) + ';n.dispatchEvent(new Event("input",{bubbles:true}))})()');
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
