// SB5 WP-G: the router (TR-1, TR-2, TR-82), Back (TR-4), landing (TR-5), the guard rules (TR-3) and the shell list (TR-8).
// The router is read as text and its pure parts run from there, as tests/own.test.js does.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RULES } from '../site/js/test-guard.js';
import { adultParent } from '../site/js/nav-doc.js';
import { safeDecode } from '../site/js/chapters-doc.js';

const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const read = (p) => readFileSync(file(p), 'utf8');
const app = read('site/js/app.js');
const sw = read('site/sw.js');
const SHELL = new Function(sw.slice(sw.indexOf('const SHELL'), sw.indexOf("self.addEventListener('install'")) + '; return SHELL;')();
const routeLines = new Map([...app.matchAll(/^ {2}\['([^']*)', (.*)\],?(?: \/\/.*)?$/gm)].map((m) => [m[1], m[2]]));

const parentOf = new Function('path', /function parentOf\(path\) \{([\s\S]*?)\n\}/.exec(app)[1]);

test('TR-1: the new adult pages are routed to the named views, all under grownups/', () => {
  const want = {
    'grownups/set': 'SET.setWeek', 'grownups/set/list/:oid': 'SET.setWeek', 'grownups/set/child/:cid': 'SET.setWeek',
    'grownups/own/:oid/results': 'RV.listResults', 'grownups/yourself': 'GU.yourself', 'grownups/role': 'GU.rolePage', 'grownups/help': 'GU.helpTable',
    'grownups/child/:cid/plan/:gid': 'SET.changeWeek', 'grownups/own': 'OV.list', 'grownups/own/new': 'OV.editor',
    'grownups/own/:oid': "later(OV, 'listPage', OV.editor)", 'grownups/own/:oid/edit': 'OV.editor', 'grownups/own/:oid/give': "later(OV, 'givePage')",
    'grownups/own/ready': "later(OV, 'readyLists')", 'grownups/own/ready/:id': "later(OV, 'readyList')", 'grownups/own/:oid/copy': "later(OV, 'copyPage')", 'grownups/own/:oid/sentences': "later(OV, 'sentencesPage')", look: "later(CV, 'lookVoicePage')",
    'grownups/child/:cid/rename/:gid': 'SET.renameWeek', 'grownups/more': 'GU.askMore',
    'grownups/child/:cid/week/:gid': "later(GU, 'pastWeek', GU.childDashboard)", 'grownups/child/:cid/weeks': "later(GU, 'earlierWeeks')", 'grownups/child/:cid/print/:gid': "later(GU, 'printWeek')",
  };
  for (const [r, v] of Object.entries(want)) assert.equal(routeLines.get(r), v, r);
  assert.match(app, /import \* as SET from '\.\/set-views\.js'/);
  assert.match(app, /import \* as RV from '\.\/results-views\.js'/);
  assert.doesNotMatch(app, /teach-views|TV\./);
  assert.ok(app.indexOf("'grownups/own/new'") < app.indexOf("'grownups/own/:oid'"), 'new before :oid');
  assert.ok(app.indexOf("'grownups/own/ready'") < app.indexOf("'grownups/own/:oid'"), 'ready before :oid');
});

test('TR-3, TR-82: the seven new routes are adult pages; no rule was removed', () => {
  for (const r of ['grownups/set', 'grownups/set/list/:oid', 'grownups/set/child/:cid', 'grownups/own/:oid/results', 'grownups/yourself', 'grownups/role', 'grownups/help']) assert.equal(RULES[r], 'adult', r);
  for (const r of ['grownups/plan', 'grownups/child/:cid/plan', 'grownups/teach', 'grownups/teach/:oid']) assert.equal(RULES[r], 'adult', r);
  assert.equal(RULES.chapters, 'lists');
});

test('SB5 round 3b: every new route has an adult rule, and a view another file has not exported yet cannot stop app.js loading', () => {
  for (const r of ['grownups/more', 'grownups/child/:cid/rename/:gid', 'grownups/own/ready', 'grownups/own/ready/:id', 'grownups/own/ready/:id/copy', 'grownups/own/:oid/copy', 'grownups/own/:oid/sentences', 'grownups/own/:oid/edit', 'grownups/own/:oid/give', 'grownups/child/:cid/weeks', 'grownups/child/:cid/print/:gid']) assert.equal(RULES[r], 'adult', r);
  assert.equal(RULES.look, 'safe');
  for (const [r] of routeLines) if (r.startsWith('grownups')) assert.ok(RULES[r], 'a rule for ' + r);
  assert.match(app, /const later = \(ns, name, fallback\) => \(m, p\) => \{ const f = ns\[name\] \|\| fallback;/);
  // the same lookup, run: a missing export falls back, then to the not-found page
  const V = { notFound: () => 'nf' };
  const later = new Function('V', 'return ' + /const later = (.*);\n/.exec(app)[1] + ';')(V);
  assert.equal(later({ f: () => 'ok' }, 'f')(null, {}), 'ok');
  assert.equal(later({}, 'f', () => 'fb')(null, {}), 'fb');
  assert.equal(later({}, 'f')(null, {}), 'nf');
});

test('SB5 round 3b: prefs and role reach the adult tools; a null prefs is never cached', () => {
  assert.match(app, /useAdultTools\(\{ origin: \(\) => account\.origin, player: \(\) => account\.session\.player, prefs: \(\) => account\.prefs \}\)/);
  assert.match(app, /SET\.useSetTools\(\{ prefs: \(\) => account\.prefs \}\)/);
  assert.match(app, /have\.prefs !== prefs/);
});

test('TR-2: each old route is a redirect, and the redirect takes the right address', () => {
  // run the redirect lines against a fake location
  const run = (route, params, role = 'parent') => {
    const to = [];
    const location = { replace: (u) => to.push(u) };
    const piece = (v) => { const d = safeDecode(v); return d ? encodeURIComponent(d) : ''; };
    const redirect = (f) => (m, p) => { location.replace('#/' + f(p || {})); };
    const roleNow = () => role;
    const SU = { overview: () => to.push('overview view') };
    // eslint-disable-next-line no-new-func
    new Function('redirect', 'piece', 'roleNow', 'SU', 'location', 'return (' + routeLines.get(route) + ');')(redirect, piece, roleNow, SU, location)(null, params);
    return to;
  };
  assert.deepEqual(run('grownups/plan', {}), ['#/grownups/set']);
  assert.deepEqual(run('grownups/child/:cid/plan', { cid: 'c1' }), ['#/grownups/set/child/c1']);
  assert.deepEqual(run('grownups/child/:cid/plan', { cid: 'a%20b' }), ['#/grownups/set/child/a%20b']);
  assert.deepEqual(run('grownups/child/:cid/plan', { cid: '%E0%A4%A' }), ['#/grownups/set'], 'a bad piece goes to the page without it');
  assert.deepEqual(run('grownups/teach', {}, 'parent'), ['#/grownups/own']);
  assert.deepEqual(run('grownups/teach', {}, 'tutor'), ['#/grownups/own']);
  assert.deepEqual(run('grownups/teach', {}, 'teacher'), ['#/grownups']);
  assert.deepEqual(run('grownups/teach/:oid', { oid: 'r1' }), ['#/grownups/own/r1/results']);
  assert.deepEqual(run('grownups/teach/:oid', { oid: '%E0%A4%A' }), ['#/grownups/own']);
  assert.deepEqual(run('grownups/overview', {}, 'teacher'), ['#/grownups']);
  assert.deepEqual(run('grownups/overview', {}, 'parent'), ['overview view']);
  assert.deepEqual(run('grownups/overview', {}, 'tutor'), ['overview view']);
});

test('TR-4, TR-82: Back', () => {
  const B = {
    'grownups/set': '#/grownups', 'grownups/set/list/r1': '#/grownups/own/r1', 'grownups/set/child/c1': '#/grownups/child/c1',
    'grownups/own/r1/results': '#/grownups/own/r1', 'grownups/own/r1': '#/grownups/own', 'grownups/own/new': '#/grownups/own', 'grownups/scan': '#/grownups/own',
    'grownups/yourself': '#/grownups', 'grownups/role': '#/grownups', 'grownups/help': '#/grownups', 'grownups/own': '#/grownups', grownups: '#/',
    'grownups/child/c1/plan/g1': '#/grownups/child/c1', 'grownups/child/c1': '#/grownups', 'grownups/child/c1/exam/e1': '#/grownups/child/c1',
    'grownups/more': '#/grownups', 'grownups/child/c1/rename/g1': '#/grownups/child/c1',
    'grownups/own/ready': '#/grownups/own', 'grownups/own/ready/y4-ch03': '#/grownups/own/ready', 'grownups/own/ready/y4-ch03/copy': '#/grownups/own/ready/y4-ch03', 'grownups/own/r1/copy': '#/grownups/own/r1', 'grownups/own/r1/sentences': '#/grownups/own/r1', look: '#/', 'grownups/own/r1/edit': '#/grownups/own/r1', 'grownups/own/r1/give': '#/grownups/own/r1',
    'grownups/child/c1/weeks': '#/grownups/child/c1', 'grownups/child/c1/week/g1': '#/grownups/child/c1/weeks', 'grownups/child/c1/print/g1': '#/grownups/child/c1',
    'words/own/r1': '#/chapters', 'words/own/r1/study': '#/words/own/r1', 'words/g/g1/study/hello': '#/words/g/g1',
  };
  for (const [p, to] of Object.entries(B)) assert.equal(parentOf(p), to, p);
  assert.doesNotMatch(app, /parts\[1\] === 'teach'/, 'no teach rule');
});

test('TR-4: an adult on their own practice pages goes back to Play yourself; a child is unchanged', () => {
  for (const p of ['chapters', 'custom', 'custom/play', 'tricky', 'progress', 'words', 'words/progress']) {
    assert.equal(adultParent(p, 'adult'), '#/grownups/yourself', p);
    assert.equal(adultParent(p, 'child'), '', p);
  }
  assert.equal(adultParent('grownups/own', 'adult'), '');
  assert.match(app, /adultParent\(path, kind\(\)\)/);
  assert.match(app, /location\.hash = backOf\(path\)/);
  assert.match(app, /path === 'grownups\/help' && roleNow\(\) === 'parent'\) return '#\/grownups\/overview'/);
});

test('TR-5, TR-82: an adult with no role and no "Not now" goes to the role page first', () => {
  assert.match(app, /function landing\(path\)/);
  assert.match(app, /if \(path !== '' && path !== 'grownups'\) return false;/);
  assert.match(app, /r\.askState\(\)/); // T1 round 2: shouldAsk plus the wait for the account prefs, one rule
  assert.match(app, /location\.replace\('#\/grownups\/role'\)/);
  assert.ok(app.indexOf('if (landing(path)) return;') < app.indexOf('const found = match(path);'), 'asked before the page is chosen');
});

test('TR-8: every shell file exists, nothing the app needs is missing, and the new css is linked', () => {
  assert.equal(new Set(SHELL).size, SHELL.length, 'no file twice');
  for (const f of SHELL) if (f !== './') assert.ok(existsSync(file('site/' + f)), 'in the shell but not on disk (the install would fail): ' + f);
  for (const f of ['js/role-doc.js', 'js/info-doc.js', 'js/set-doc.js', 'js/nav-doc.js', 'js/practice-doc.js', 'js/set-data.js', 'js/role-data.js', 'js/sentences-data.js', 'js/statement-rules.js',
    'js/set-views.js', 'js/results-views.js', 'css/set.css', 'css/lists.css', 'css/mix.css', 'data/statements.json']) assert.ok(SHELL.includes(f), f);
  assert.ok(!SHELL.includes('js/teach-views.js'));
  const index = read('site/index.html');
  for (const f of readdirSync(file('site/css')).filter((n) => n.endsWith('.css'))) assert.ok(index.includes('css/' + f), 'linked: ' + f);
  for (const f of SHELL.filter((x) => /^css\/[^/]+\.css$/.test(x))) assert.ok(index.includes(f), 'linked: ' + f);
  assert.match(sw, /VERSION = 'spellbright-2026-11-23a'/);
});

test('16c devices: a new version replaces every older cache and takes over at once', () => {
  assert.match(sw, /k\.startsWith\('spellbright-'\) && k !== VERSION/);
  assert.match(sw, /skipWaiting\(\)/);
  assert.match(sw, /type === 'skip-waiting'/);
  assert.match(sw, /req\.mode === 'navigate'[\s\S]{0,120}fetch\(req\)\.catch/, 'pages: network first, the cached shell when offline');
});
