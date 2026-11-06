// The tasks, the review flag, Grown-ups through the account's routes, feedback, and
// how the site is served. Run: node --test compose/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdtempSync, mkdirSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as T from '../site/js/tasks.js';
import * as A from '../site/js/grownups-data.js';
import * as W from '../site/js/writing-doc.js';
import * as C from '../site/js/checks.js';
import { cleanFeedback, askFeedback } from '../site/js/feedback.js';
import { isPlayPath, isLocked } from '../site/js/gate.js';
import { fakeAccount } from '../../shared/tests/fake-account.js';
import { loadWordGraph, isWord } from '../../wordbright/site/js/engine/words.js';

const root = (p) => fileURLToPath(new URL('../../' + p, import.meta.url));
const site = (p) => root('compose/site/' + p);
const text = (p) => readFileSync(root(p), 'utf8');
const data = JSON.parse(text('compose/site/data/tasks.json'));
const buf = readFileSync(root('wordbright/site/data/words_all.dawg'));
const graph = loadWordGraph(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));

test('12 tasks: 6 at Year 3, 3 at Year 4, 2 at Year 5, 1 at Year 6', () => {
  const by = (n) => data.tasks.filter((t) => t.level === n).length;
  assert.deepEqual([by(3), by(4), by(5), by(6), data.tasks.length], [6, 3, 2, 1, 12]);
  assert.equal(new Set(data.tasks.map((t) => t.id)).size, 12);
});
const MODEL = { 3: [95, 140], 4: [120, 175], 5: [170, 230], 6: [220, 285] };
for (const t of data.tasks) {
  test(t.id + ': complete, and right for its level', () => {
    assert.equal(t.reviewed, false, 'unreviewed until approved');
    const sentences = t.background.match(/[.!?](\s|$)/g).length;
    assert.ok(sentences >= 2 && sentences <= 4, 'background sentences ' + sentences);
    assert.equal(t.pictures.length, 4);
    assert.equal(t.planner.length, 4);
    assert.ok(t.hints.length >= 8 && t.hints.length <= 12);
    assert.ok(t.criteria.length >= 5);
    const n = C.wordCount(t.model);
    assert.ok(n >= MODEL[t.level][0] && n <= MODEL[t.level][1], 'model ' + n);
  });
  test(t.id + ': every picture exists, in both sizes, with alt text', () => {
    for (const p of t.pictures) {
      assert.ok(p.alt.length > 20);
      for (const w of [600, 1200]) assert.ok(existsSync(site(p.file + '-' + w + '.webp')), p.file + ' ' + w);
    }
  });
  test(t.id + ': the hint words are on our list (so child-safe)', () => {
    for (const h of t.hints) assert.ok(isWord(h, graph), h);
    assert.equal(new Set(t.hints).size, t.hints.length);
  });
  test(t.id + ': British, with no brands or tags', () => {
    const s = JSON.stringify(t);
    assert.doesNotMatch(s, /\b(color|favorite|neighbor|center|realize|mom)\b/i);
    assert.doesNotMatch(s, /<[a-z]/i);
  });
}
test('Year 3 stays simple: short background and short planner lines', () => {
  for (const t of data.tasks.filter((x) => x.level === 3)) {
    assert.ok(C.wordCount(t.background) <= 25, t.id);
    assert.ok(t.planner.every((l) => C.wordCount(l) <= 8), t.id);
    assert.ok(t.criteria.some((c) => /capital/i.test(c)) && t.criteria.some((c) => /full stop/i.test(c)) && t.criteria.some((c) => /and or because/.test(c)));
  }
});
test('only everyday words count as real: a rarity near a hint word is still a slip', async () => {
  const { COMMON_TIER } = await import('../site/js/wordcheck.js');
  const real = (w) => isWord(w, graph, COMMON_TIER);
  assert.deepEqual(C.misspelledHints('The kyte flew.', ['kite'], real), [{ word: 'kyte', hint: 'kite' }]);
  assert.deepEqual(C.misspelledHints('A kit and a bite.', ['kite'], real), []);
});
test('a model answer gets every check for its level, near enough', () => {
  for (const t of data.tasks) {
    const failed = C.autoChecks(t.model, t, (w) => isWord(w, graph)).filter((c) => !c.ok).map((c) => c.id);
    assert.deepEqual(failed.filter((x) => ['words', 'spelling', 'capitals', 'stops'].includes(x)), [], t.id);
  }
});

// ---- the review flag -----------------------------------------------------------------
const live = { id: 'a', reviewed: true };
const waiting = { id: 'b', reviewed: false };
test('unreviewed tasks are for adults only', () => {
  assert.deepEqual(T.visibleTo([live, waiting], 'adult'), [live, waiting]);
  assert.deepEqual(T.visibleTo([live, waiting], 'child'), [live]);
  assert.deepEqual(T.visibleTo([live, waiting], 'unknown'), [live]);
  assert.deepEqual(T.visibleTo([{ id: 'c', reviewed: 'yes' }], 'child'), []);
});
test('as shipped: nothing is live for children', () => {
  assert.deepEqual(T.visibleTo(data.tasks, 'child'), []);
});
test('every task page goes through the same check', () => {
  const v = text('compose/site/js/views.js');
  assert.match(v, /visibleTo\(\[t\], kind\(\)\)\.length/);
  for (const fn of ['look', 'plan', 'write', 'check', 'feedback', 'better']) {
    const i = v.indexOf('export function ' + fn + '(');
    assert.match(v.slice(i, i + 110), /const t = task\(id\);/, fn);
  }
});
test('the approve tool sets the flag, takes it back and refuses an unknown id', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tasks-'));
  mkdirSync(join(dir, 'tools'));
  mkdirSync(join(dir, 'compose/site/data'), { recursive: true });
  copyFileSync(root('tools/approve-tasks.mjs'), join(dir, 'tools/approve-tasks.mjs'));
  const f = join(dir, 'compose/site/data/tasks.json');
  writeFileSync(f, JSON.stringify({ tasks: [{ id: 'a', level: 3, title: 'A', reviewed: false }, { id: 'b', level: 3, title: 'B', reviewed: false }] }));
  const run = (...a) => execFileSync(process.execPath, [join(dir, 'tools/approve-tasks.mjs'), ...a], { stdio: 'pipe' }).toString();
  const read = () => JSON.parse(readFileSync(f, 'utf8')).tasks.map((t) => t.reviewed);
  run('b');
  assert.deepEqual(read(), [false, true]);
  run('--off', 'b');
  assert.deepEqual(read(), [false, false]);
  assert.throws(() => run('nope'));
});
test('the review page is for adults, and its switches only make a command', () => {
  const v = text('compose/site/js/grownups-views.js');
  const body = v.slice(v.indexOf('export function taskReview'));
  assert.match(body.slice(0, 90), /adultOnly\(main\)/);
  assert.equal(T.approveCommand(['a', 'b']), 'node tools/approve-tasks.mjs a b');
  assert.doesNotMatch(text('compose/site/js/tasks.js'), /localStorage/);
});

// ---- consent and Grown-ups -----------------------------------------------------------
const KID = '11111111-1111-4111-8111-111111111111';
const OTHER = '55555555-5555-4555-8555-555555555555';
const ADULT = '33333333-3333-4333-8333-333333333333';
function family() {
  const acct = fakeAccount();
  acct.children = (id) => (id === ADULT ? [{ id: KID, nickname: 'Robin', year: 4, avatar: null }] : []);
  acct.who = { signedIn: true, kind: 'parent', id: ADULT, displayName: 'Sam', role: 'parent', playingAs: null };
  return { acct, api: A.createChildApi({ origin: 'https://account.example', fetch: acct.fetch }) };
}
test('AI feedback defaults to off; a parent turns it on and off through /api/children', async () => {
  const { acct, api } = family();
  assert.equal((await A.readChild(api, KID)).settings.aiFeedback, false);
  assert.equal((await A.setAiFeedback(api, KID, true, 10)).ok, true);
  assert.equal(acct.data.get(KID).get('compose/settings').value.aiFeedback, true);
  assert.equal((await A.readChild(api, KID)).settings.aiFeedback, true);
  await A.setAiFeedback(api, KID, false, 20);
  assert.equal((await A.readChild(api, KID)).settings.aiFeedback, false);
  assert.ok(acct.calls.filter((c) => c.method === 'PUT').every((c) => c.path === '/api/children/' + KID + '/game/compose/settings'));
});
test('the game asks for feedback only with consent', () => {
  assert.match(text('compose/site/js/views.js'), /S\.readSettings\(\)\.aiFeedback && text\.length <= W\.MAX_TEXT/);
});
const MARK = { ideas: 4, order: 4, words: 3, sentences: 3, spelling: 2, comment: 'Lovely ending.' };
test('a parent marks a piece; a clash is made again on the newer copy', async () => {
  const { acct, api } = family();
  acct.put(KID, 'compose', 'marks', { v: 1, marks: { other: { ideas: 1, at: 1 } } });
  const realPut = api.put;
  let once = true;
  const racing = { ...api, put: async (...a) => { if (once) { once = false; acct.put(KID, 'compose', 'marks', { v: 1, marks: { other: { ideas: 2, at: 2 } } }); } return realPut(...a); } };
  const r = await A.saveMark(racing, KID, 'p1', MARK, 10);
  assert.deepEqual([r.ok, r.updated], [true, true]);
  const m = acct.data.get(KID).get('compose/marks').value.marks;
  assert.deepEqual([m.p1.ideas, m.other.ideas], [4, 2]);
});
test('an incomplete mark saves nothing', async () => {
  const { acct, api } = family();
  assert.match((await A.saveMark(api, KID, 'p1', { ...MARK, ideas: 0 }, 10)).error, /each part/);
  assert.equal((acct.data.get(KID) || new Map()).size, 0);
});
test('another family\'s child: no-child; playing as a child: playing; network: network', async () => {
  const { acct, api } = family();
  assert.deepEqual(await A.readChild(api, OTHER), { problem: 'no-child' });
  acct.who = { ...acct.who, playingAs: { id: KID, nickname: 'Robin', year: 4, avatar: null } };
  assert.deepEqual(await A.readChild(api, KID), { problem: 'playing' });
  assert.deepEqual(await A.listChildren(api), { problem: 'playing' });
  acct.offline = true;
  assert.deepEqual(await A.listChildren(api), { problem: 'network' });
});
test('a parent reads the child\'s plan, draft, final, checks and feedback', async () => {
  const { acct, api } = family();
  let d = W.startPiece(W.emptyDoc(), { id: 'lost-kite', level: 3 }, { id: 'p1', now: 1 });
  d = W.change(d, 'p1', { plan: ['a', 'b', 'c', 'd'], parts: ['First.', '', '', ''] }, 2);
  d = W.submit(d, 'p1', { checks: [{ id: 'words', ok: true, text: 'x' }], feedback: { stars: ['s', 't'], wish: 'w', spellings: [] } }, 3);
  d = W.change(d, 'p1', { parts: ['Better.', '', '', ''] }, 4);
  d = W.finish(d, 'p1', 5);
  acct.put(KID, 'compose', 'writing', d);
  const p = (await A.readChild(api, KID)).writing.pieces.p1;
  assert.deepEqual([p.plan[0], p.first, p.final, p.checks.length, p.feedback.wish], ['a', 'First.', 'Better.', 1, 'w']);
});
test('nothing about a child is kept on the adult\'s device', () => {
  assert.doesNotMatch(text('compose/site/js/grownups-data.js'), /localStorage|sessionStorage/);
  const v = text('compose/site/js/grownups-views.js');
  assert.equal(v.match(/localStorage/g).length, 2, 'only the task review\'s own switches');
});

// ---- feedback ----------------------------------------------------------------------------
const GOOD = { stars: ['One.', 'Two.'], wish: 'Next.', spellings: [{ word: 'kyte', suggestion: 'kite' }] };
test('a good reply is used; anything else is no feedback', () => {
  assert.deepEqual(cleanFeedback(GOOD), GOOD);
  for (const bad of [null, {}, { fallback: true }, { ...GOOD, stars: ['one'] }, { ...GOOD, wish: ' ' }, { ...GOOD, spellings: 'x' }, { ...GOOD, stars: ['', 'a'] }]) assert.equal(cleanFeedback(bad), null);
});
test('at most 5 spellings', () => {
  assert.equal(cleanFeedback({ ...GOOD, spellings: Array(9).fill(GOOD.spellings[0]) }).spellings.length, 5);
});
test('the call: only the task id, level and text, with credentials', async () => {
  let seen = null;
  const out = await askFeedback({ origin: 'https://a.example', taskId: 't', level: 3, text: 'x', fetch: async (u, i) => { seen = { u, i }; return { ok: true, json: async () => GOOD }; } });
  assert.deepEqual(out, GOOD);
  assert.equal(seen.u, 'https://a.example/api/compose/feedback');
  assert.equal(seen.i.credentials, 'include');
  assert.deepEqual(JSON.parse(seen.i.body), { taskId: 't', level: 3, text: 'x' });
});
test('a refusal, a fallback or no network is no feedback', async () => {
  const none = (r) => askFeedback({ origin: 'o', taskId: 't', level: 3, text: 'x', fetch: r });
  assert.equal(await none(async () => ({ ok: false, status: 403 })), null);
  assert.equal(await none(async () => ({ ok: false, status: 503 })), null);
  assert.equal(await none(async () => { throw new TypeError('offline'); }), null);
  assert.equal(await none(async () => ({ ok: true, json: async () => ({ fallback: true }) })), null);
});

// ---- the site ---------------------------------------------------------------------------
test('every page where a child writes is busy; only For parents is open', () => {
  for (const p of ['t/lost-kite/plan', 't/lost-kite/write', 't/lost-kite/check', 't/lost-kite/better']) assert.equal(isPlayPath(p), true, p);
  assert.equal(isPlayPath('t/lost-kite/look'), false);
  assert.equal(isLocked('about'), false);
  for (const p of ['', 'writing', 'grownups', 't/x/look']) assert.equal(isLocked(p), true, p);
});
test('every file in the worker\'s shell is there, and every script is in it', () => {
  const shell = /const SHELL = \[([\s\S]*?)\];/.exec(text('compose/site/sw.js'))[1].match(/'[^']+'/g).map((s) => s.slice(1, -1)).filter((s) => s !== './');
  for (const f of shell) assert.ok(existsSync(site(f)), f);
  const scripts = readdirSync(site('js'), { recursive: true }).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);
  assert.deepEqual(scripts.filter((f) => !shell.includes(f)), []);
});
test('the worker: its own caches, no pictures or fonts in the shell, account calls alone', () => {
  const sw = text('compose/site/sw.js');
  assert.match(sw, /const VERSION = 'compose-[\w-]+';/);
  assert.match(sw, /k\.startsWith\('compose-'\)/);
  assert.doesNotMatch(sw, /woff2|\.webp'/);
  assert.match(sw, /url\.origin !== location\.origin \|\| url\.pathname\.startsWith\('\/api\/'\)/);
});
test('every script parses', () => {
  for (const f of readdirSync(site('js'), { recursive: true }).filter((x) => x.endsWith('.js'))) {
    execFileSync(process.execPath, ['--input-type=module', '--check', '-'], { input: readFileSync(site('js/' + f)), stdio: ['pipe', 'pipe', 'pipe'] });
  }
});
test('nginx serves /compose/ like /wordbright/, with the same CSP, and the page has it too', () => {
  const conf = text('nginx/default.conf');
  assert.match(conf, /location = \/compose \{ return 301 \/compose\/; \}/);
  const csp = /add_header Content-Security-Policy "([^"]+)"/.exec(conf)[1];
  const block = conf.slice(conf.indexOf('location /compose/ {'));
  assert.ok(block.slice(0, 1400).includes(csp));
  assert.ok(text('compose/site/index.html').includes('content="' + csp + '"') || /Content-Security-Policy/.test(text('compose/site/index.html')));
  assert.match(text('docker-compose.yml'), /\.\/compose\/site:\/usr\/share\/nginx\/html\/compose:ro/);
});
test('no inline scripts or styles', () => {
  const html = text('compose/site/index.html');
  assert.doesNotMatch(html, /\sstyle="/);
  assert.equal(html.match(/<script(?![^>]*src=)/g), null);
  for (const f of ['views.js', 'grownups-views.js', 'ui.js']) assert.doesNotMatch(text('compose/site/js/' + f), /style="/, f);
});
test('the task titles match the account\'s list (what the AI is told)', { skip: !existsSync(root('../waystead-account/src/lib/compose-feedback.ts')) }, () => {
  const src = text('../waystead-account/src/lib/compose-feedback.ts');
  for (const t of data.tasks) assert.ok(src.includes('"' + t.id + '": "' + t.title + '"'), t.id);
});
test('the pictures keep their shape: every sized image has height auto', () => {
  const css = text('compose/site/css/app.css');
  for (const sel of ['.taskcard img', '.strip__pic img', '.writebox img', '.bigpic img']) assert.match(css.slice(css.indexOf(sel + ' {')).split('}')[0], /height: auto/, sel);
});
test('the hub has the card', () => {
  const hub = text('hub/site/index.html');
  assert.match(hub, /href="compose\/" data-compose/);
  assert.ok(existsSync(root('hub/site/home-assets/img/compose-128.webp')));
});
