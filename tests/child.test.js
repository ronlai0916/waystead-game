// SB3-C1: what a child's screens say (child-doc.js, pure) and that the child's views keep to the
// hard constraints. Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as W from '../site/js/words-doc.js';
import * as St from '../site/js/study-doc.js';
import * as C from '../site/js/child-doc.js';
import { testGuard, RULES } from '../site/js/test-guard.js';

const MON = '2026-11-02';
const plus = (n) => W.addDays(MON, n);
const at = (day, h = 12) => Date.parse(day + 'T' + String(h).padStart(2, '0') + ':00:00Z');
const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
function made(words = ['fruit', 'earth'], t = plus(5)) {
  const r = W.createGroup(W.emptyDoc(), { id: 'g1', name: 'Week', test: t, words, today: MON, now: at(MON) });
  return { d: r.doc, g: W.groupById(r.doc, 'g1') };
}
const job = (d, g, step, day) => W.markStep(d, g, step, day, at(day));
const view = (d, day) => {
  const r = St.roomState(d, day);
  const s = r.group ? St.studyState(d, r.group, day) : null;
  return { r, s, v: C.homeView(r, day, { waiting: s ? s.waiting : 0, mendPart: r.group && r.step && r.step.id === 'mend' ? St.mendPart(d, r.group, day) : 'quick' }) };
};

test('the weekday name', () => {
  assert.equal(C.weekdayName('2026-11-17'), 'Tuesday');
  assert.equal(C.weekdayName('2026-11-15'), 'Sunday');
});

test('home, first group: a calm welcome and one button to My words', () => {
  const { v } = view(W.emptyDoc(), MON);
  assert.equal(v.status, 'none');
  assert.equal(v.button.href, 'words');
  assert.equal(v.path, false);
  assert.match(v.headline, /first word group/);
});

test('home, a job: the day and the job, one sentence, one button, the time', () => {
  let { d, g } = made(['fruit', 'earth'], plus(7));
  d = job(job(d, g, 'hello', MON), g, 'fix', plus(1));
  const { v } = view(d, plus(2));
  assert.equal(v.status, 'job');
  assert.equal(v.eyebrow, 'Wednesday · Game day');
  assert.equal(v.headline, 'Play four quick games with your words.');
  assert.deepEqual(v.button, { label: 'Start Game day', href: 'job' });
  assert.equal(v.note, 'About 15 minutes');
  assert.equal(v.say, v.headline);
  assert.ok(v.path);
});

test('home, every job has one short sentence and a button of its own', () => {
  for (const id of St.STEPS) assert.ok(C.JOB_SENTENCE[id], id);
  for (const s of Object.values(C.JOB_SENTENCE)) assert.ok(s.split(/\s+/).length <= 8, s);
  assert.equal(C.JOB_SENTENCE.test.includes('late'), false);
});

test('home, done / rest / ready / finished: the same calm layout, one button', () => {
  let { d, g } = made(['fruit', 'earth'], plus(5));
  d = job(d, g, 'hello', MON);
  let x = view(d, MON).v;
  assert.equal(x.status, 'done');
  assert.equal(x.headline, 'Done for today!');
  assert.equal(x.button.href, 'wordbright');
  d = job(job(job(job(d, g, 'fix', plus(1)), g, 'games', plus(2)), g, 'story', plus(3)), g, 'practice', plus(4));
  const rest = view(made(['fruit'], plus(6)).d, MON);
  assert.ok(rest.v.button, 'always one button');
  for (const s of ['done', 'rest', 'ready', 'finished']) {
    const fake = C.homeView({ status: s, group: { id: 'g1' }, pip: 'cheering', comeBack: [], hideWords: false, strip: [] }, MON);
    assert.ok(fake.headline && fake.button, s);
    assert.doesNotMatch(fake.headline + fake.line, /late|behind/i, s);
  }
  assert.equal(C.homeView({ status: 'finished', group: { id: 'g1' }, comeBack: [] }, MON).button.href, 'new');
});

test('home, the test is due: "Start the test", and no word on the screen', () => {
  let { d, g } = made(['fruit', 'earth'], plus(5));
  for (const [s, k] of [['hello', 0], ['fix', 1], ['games', 2], ['story', 3], ['practice', 4]]) d = job(d, g, s, plus(k));
  for (const w of g.words) for (const h of [9, 10, 11]) d = W.addTry(d, { id: 'p' + w + h, word: w, day: plus(4), group: 'g1', kind: 'p', tries: 0, peeks: 0, clean: true, now: at(plus(4), h) });
  const { r, v } = view(d, plus(5));
  assert.equal(r.step.id, 'test');
  assert.equal(v.button.label, 'Start the test');
  assert.deepEqual(v.comeBack, []);
  const text = JSON.stringify(v).toLowerCase();
  for (const w of g.words) assert.ok(!text.includes(w), w);
});

test('home, catching up after the test day: the day, the line, "2 jobs waiting", one "then" line', () => {
  const { d } = made(['fruit', 'earth'], plus(5));
  const { v, s } = view(d, plus(6));
  assert.equal(s.waiting, 5);
  assert.equal(v.catchUp, true);
  assert.equal(v.eyebrow, '5 jobs waiting for you');
  assert.equal(v.headline, 'Your test day was Sat\u00a07\u00a0Nov.');
  assert.equal(v.line, 'Finish your jobs, then take the test here.');
  assert.equal(v.say.replace(/\u00a0/g, ' '), St.catchUpLine(St.studyGroup(d, plus(6)), plus(6)));
  assert.equal(v.button.label, 'Start Hello words');
  assert.equal(v.note, 'Then Fix it in. The test opens when your jobs are done.');
  assert.doesNotMatch(JSON.stringify(v), /late|behind/i);
  assert.equal(C.waitingEyebrow(1), '1 job waiting for you');
  assert.equal(C.waitingEyebrow(2), '2 jobs waiting for you');
});

test('the test day itself reads "Today is your test day."', () => {
  const { g } = made(['fruit', 'earth'], plus(5));
  assert.deepEqual(C.catchUpParts(g, plus(5)), ['Today is your test day.', 'Finish your jobs, then take the test here.']);
});

test('"then": the next job still to do; the last study job has none after it', () => {
  const { d, g } = made(['fruit', 'earth'], plus(5));
  const steps = St.studyState(d, g, plus(6)).steps;
  assert.equal(C.thenLine(steps, 'practice'), 'The test opens when your jobs are done.');
  assert.equal(C.thenLine(steps, 'story'), 'Then Practice day. The test opens when your jobs are done.');
});

test('the path card: "Job 3 of 7" is today\'s job, else the first not done', () => {
  let { d, g } = made(['fruit', 'earth'], plus(7));
  d = job(job(d, g, 'hello', MON), g, 'fix', plus(1));
  assert.equal(C.jobNumber(St.studyState(d, g, plus(2)).steps, 'games'), 3);
  assert.equal(C.jobNumber(St.studyState(d, g, plus(2)).steps, ''), 3);
});

test('stones: done, today, today and waiting, waiting, later, the test, Mend and keep, not done', () => {
  let { d, g } = made(['fruit', 'earth'], plus(5));
  d = job(d, g, 'hello', MON);
  const day = plus(3); // Fix it in is waiting and comes first: today's stone and waiting both
  const s = St.studyState(d, g, day);
  const v = Object.fromEntries(s.steps.map((x) => [x.id, C.stoneView(x, day, St.doneDay(d, g, x.id))]));
  assert.equal(v.hello.kind, 'done');
  assert.equal(v.hello.icon, 'star');
  assert.equal(v.hello.sub, 'Done · Mon 2'.replace(/ /g, ' ').replace('Done · Mon 2', 'Done · Mon 2'));
  assert.equal(v.fix.kind, 'todaywait');
  assert.equal(v.fix.icon, 'clock');
  assert.equal(v.fix.sub, 'Today · tap to start');
  assert.match(v.fix.aria, /today and waiting/);
  assert.equal(v.games.kind, 'waiting');
  assert.equal(v.games.sub, 'Waiting for you');
  assert.equal(v.story.kind, 'later');
  assert.equal(v.story.icon, 'number');
  assert.equal(v.test.icon, 'flag');
  assert.equal(v.test.name, 'Test');
  assert.match(v.test.sub, /test day$/);
  assert.equal(v.mend.sub.startsWith('Fix any slips'), true);
  for (const x of Object.values(v)) assert.doesNotMatch(x.sub + x.aria, /late|behind/i);
  // today, not waiting
  const t = C.stoneView({ id: 'games', n: 3, title: 'Game day', date: day, state: 'today' }, day);
  assert.equal(t.kind, 'today');
  assert.equal(t.icon, 'number');
  // a legacy week
  assert.equal(C.stoneView({ id: 'story', n: 4, title: 'Story day', date: plus(3), state: 'missed' }, plus(6)).sub, 'Not done');
  // Mend and keep today: the helper line
  assert.equal(C.stoneView({ id: 'mend', n: 7, title: 'Mend and keep', date: plus(6), state: 'today' }, plus(6)).helper, 'Fix any slips');
});

test('the menu: Games, My words, More practice, a quiet Settings; Games closes while the test is due', () => {
  const open = C.menuRows({ gid: 'g 1', hasGroup: true, gamesOpen: true });
  assert.deepEqual(open.map((r) => r.id), ['games', 'words', 'practice', 'settings']);
  assert.equal(open[0].href, '#/words/g/g%201/games');
  assert.equal(open[2].href, '#/chapters');
  assert.equal(open[2].sub, 'Chapters, tricky words, your progress');
  assert.equal(open[3].quiet, true);
  const closed = C.menuRows({ gid: 'g1', hasGroup: true, gamesOpen: false });
  assert.equal(closed[0].closed, true);
  assert.equal(closed[0].sub, 'Test first, then games.');
  assert.equal(closed[0].href, undefined);
  assert.deepEqual(C.menuRows({ hasGroup: false }).map((r) => r.id), ['words', 'practice', 'settings']);
});

test('inside a job: which routes get "Stop for now", and the job\'s name', () => {
  for (const p of ['words/g/g1/study/hello', 'words/g/g1/study/fix/2', 'words/g/g1/spell/0', 'words/g/g1/test', 'words/g/g1/game/quick', 'words/g/g1/study/mend']) assert.ok(C.isJobPath(p), p);
  for (const p of ['', 'words', 'words/g/g1', 'words/g/g1/path', 'words/g/g1/games', 'settings', 'about', 'chapters']) assert.ok(!C.isJobPath(p), p);
  const { d } = made();
  assert.equal(C.jobTitle('words/g/g1/study/hello', d, MON), 'Hello words');
  assert.equal(C.jobTitle('words/g/g1/study/fix/1', d, MON), 'Fix it in');
  assert.equal(C.jobTitle('words/g/g1/study/games', d, MON), 'Game day');
  assert.equal(C.jobTitle('words/g/g1/study/mend', d, MON), 'Mend and keep');
  assert.equal(C.jobTitle('words/g/g1/test', d, MON), 'Test day');
  assert.equal(C.jobTitle('words/g/g1/spell/0', d, MON), 'Practice day');
  assert.equal(C.jobTitle('words/g/g1/game/quick', d, MON), 'Games');
  assert.equal(C.jobTitle('words/g/g1', d, MON), '');
});

test('Back from the path and Settings goes home; the other pages go up a level', () => {
  assert.equal(C.backTarget('words/g/g1/path'), '#/');
  assert.equal(C.backTarget('settings'), '#/');
  assert.equal(C.backTarget('words'), '');
});

test('the new routes are classified for the test guard, and show no word', () => {
  assert.equal(RULES['words/g/:gid/path'], 'safe');
  assert.equal(RULES.settings, 'safe');
  const { d } = made();
  assert.equal(testGuard('words/g/:gid/path', { gid: 'g1' }, d, plus(5), () => []), null);
});

test('wording: instructions are 8 words or fewer; audio buttons say "Hear it"; nothing is "late"', () => {
  for (const s of [C.SPELL_INSTRUCTION, C.HELLO_INSTRUCTION, C.PEEK_HINT, C.PEEKED_LINE, C.GAMES_CLOSED, C.SAVED_LINE]) assert.ok(s.split(/\s+/).length <= 8, s);
  assert.equal(C.SAVED_LINE, 'Your place is saved.');
  const src = ['child-doc.js', 'child-views.js'].map((f) => readFileSync(file('site/js/' + f), 'utf8')).join('\n');
  assert.doesNotMatch(src.replace(/\bplate\b|related|translate/g, ''), /\blate\b/i);
});

test('constraints: no inline style attribute or script in the child views, and the files are in the worker\'s shell', () => {
  for (const f of ['child-doc.js', 'child-views.js', 'ui.js', 'study-views.js', 'words-views.js']) assert.doesNotMatch(readFileSync(file('site/js/' + f), 'utf8'), /\sstyle="/, f);
  const index = readFileSync(file('site/index.html'), 'utf8');
  assert.doesNotMatch(index, /\sstyle="/);
  assert.match(index, /css\/child\.css/);
  const sw = readFileSync(file('site/sw.js'), 'utf8');
  for (const f of ['css/child.css', 'js/child-doc.js', 'js/child-views.js']) assert.ok(sw.includes("'" + f + "'"), f);
  assert.match(sw, /VERSION = 'spellbright-2026-11-13e'/);
});

test('the keyboard stays three rows that never wrap; Delete is at least 48 px wide', () => {
  const css = readFileSync(file('site/css/app.css'), 'utf8') + readFileSync(file('site/css/child.css'), 'utf8');
  assert.match(css, /\.keyboard-row \{[^}]*flex-wrap: nowrap/);
  assert.doesNotMatch(css, /\.keyboard-row \{[^}]*flex-wrap: wrap/);
  assert.match(css, /\.key--del \{ width: calc\(2 \*/);
  const ui = readFileSync(file('site/js/ui.js'), 'utf8');
  assert.match(ui, /const ROWS = \['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'\]/);
});

test('every page of a child that comes from a view has a Back, Menu or Stop (the top bar has three shapes)', () => {
  const html = readFileSync(file('site/index.html'), 'utf8');
  for (const id of ['child-back', 'child-stop', 'child-menu', 'job-name']) assert.match(html, new RegExp('id="' + id + '"'));
  assert.ok(readdirSync(file('site/css')).includes('child.css'));
});

test('SB3-C1 fix round: child chrome only for a known child; the keyboard sizes and pop-up stay on child screens', () => {
  const app = readFileSync(file('site/js/app.js'), 'utf8');
  assert.match(app, /applyChrome\(isKnownChild\(\)/);
  const css = readFileSync(file('site/css/child.css'), 'utf8');
  assert.doesNotMatch(css, /^\.key \{|^\.keyboard \{ container-type/m);
  assert.match(css, /body\.is-child \.keyboard \{ container-type: inline-size/);
  assert.match(css, /\.key--del \{ flex: none; width: 72px; min-width: 48px; \}/);
  assert.match(css, /min-height: calc\(100svh - 80px\)/);
  assert.match(css, /body\.is-child \.brand \{ min-height: 48px/);
  assert.match(css, /body\.is-child \.modeswitch, body\.is-child \.groupmanage \{ display: none/);
  assert.match(readFileSync(file('site/js/ui.js'), 'utf8'), /is-child/);
});

test('SB3-C1 fix round: Hello keeps the flower game; Settings has Voice, account and Sign out; the test can be carried on', () => {
  const sv = readFileSync(file('site/js/study-views.js'), 'utf8');
  assert.match(sv, /data-play/);
  assert.match(sv, /mode: 'mini'/);
  assert.match(sv, /endGame/);
  assert.equal(C.FLOWER_GAME, 'Play the flower game');
  const cv = readFileSync(file('site/js/child-views.js'), 'utf8');
  for (const k of ['data-voices', "'account'", "'signout'", "'switch'"]) assert.ok(cv.includes(k), k);
  assert.match(readFileSync(file('site/js/child-doc.js'), 'utf8'), /Carry on with the test/);
});

test('SB3-C1 last round: pending bar, voices redraw, no one-word progress line, group edit link, 56 px game keys', () => {
  const app = readFileSync(file('site/js/app.js'), 'utf8');
  assert.match(app, /pending\(\)/);
  assert.match(app, /setTimeout\(\(\) => \{ waitedOut = true/);
  const cv = readFileSync(file('site/js/child-views.js'), 'utf8');
  assert.match(cv, /is-pending/);
  assert.match(cv, /onVoices\(drawVoices\)/);
  assert.match(cv, /if \(unvoice\) unvoice\(\)/);
  assert.match(cv, /data-voicetip/);
  assert.match(readFileSync(file('site/js/play.js'), 'utf8'), /progress = true/);
  assert.match(readFileSync(file('site/js/study-views.js'), 'utf8'), /progress: false/);
  assert.match(readFileSync(file('site/js/words-views.js'), 'utf8'), /class="groupedit"/);
  const css = readFileSync(file('site/css/child.css'), 'utf8');
  assert.match(css, /is-pending, html\.wa-pre body\) :is\(\.allgames/);
  assert.doesNotMatch(css, /is-pending \.topbar__nav[^}]*display: none/);
  assert.match(css, /body\.is-child \.play \.keyboard \.key \{ height: 56px/);
  assert.match(css, /body\.is-child \.wordgrid a \{ min-width: 48px/);
  assert.match(css, /\.groupedit \{ display: none; \}/);
});

test('SB3-C1 final: the mark-alone bar cannot stick; the keyboard sits at the foot with room for the pop-up', () => {
  const css = readFileSync(file('site/css/child.css'), 'utf8');
  assert.match(css, /@keyframes wa-release/);
  assert.match(css, /html\.wa-pre body \.topbar__nav,[\s\S]*animation: wa-release 3s/);
  assert.doesNotMatch(css, /wa-pre[^{]*\{[^}]*display: none/);
  assert.match(css, /body\.is-child \.keyboard::before \{ content: ''; display: block; height: 72px/);
  assert.match(css, /body\.is-child \.keyboard \{ margin-top: auto; max-width: 500px; margin-inline: auto/);
  const app = readFileSync(file('site/js/app.js'), 'utf8');
  assert.match(app, /function releaseBar\(\)/);
  assert.match(app, /waitedOut = true;\s*releaseBar\(\); \/\/ the full bar/);
  assert.match(app, /waitedOut = true; releaseBar\(\); if \(drawn\) chrome\(\)/);
});
