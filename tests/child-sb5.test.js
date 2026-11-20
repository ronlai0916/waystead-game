// SB5 (WP-F2): the child's Today, My week, Menu, This week's words, Practice and the fold rules. The views are text-checked and their pure helpers run here.
// Worked example (NOTES-final section 22): set Sun 15 Nov, test Fri 20 Nov, today Wed 18 = Day 4 (Story day, 3 sentences).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as W from '../site/js/words-doc.js';
import * as St from '../site/js/study-doc.js';
import * as C from '../site/js/child-doc.js';
import * as PR from '../site/js/practice-doc.js';
import * as CV from '../site/js/child-views.js';
import * as WV from '../site/js/words-views.js';
import { literalsOf } from './copy-sb4.test.js';

const file = (p) => fileURLToPath(new URL('../' + p, import.meta.url));
const read = (p) => readFileSync(file(p), 'utf8');
const WORDS = ['one', 'two', 'three', 'four'];
const mk = (start, n) => { const d = W.createGroup(W.emptyDoc(), { id: 'g', name: 'Class 4 spellings', test: W.addDays(start, n), words: WORDS, today: start, now: 1 }).doc; return { d, g: W.groupById(d, 'g') }; };
const doneUpTo = (d, g, ids, day) => ids.reduce((x, id) => W.markStep(x, g, id, day, 2), d);
const at = (day, hour = 12) => Date.parse(day + 'T00:00:00Z') + hour * 3600000;
let n = 0;
/** Practice day done: every word spelled clean three times in a row on `day`. */
const practised = (d, g, day) => [9, 10, 11].reduce((x, hour) => W.rows(g).reduce((y, w) => W.addTry(y, { id: 'r' + (n += 1), word: w, day, group: g.id, kind: 'p', tries: 0, peeks: 0, clean: true, now: at(day, hour) }), x), d);
const view = (d, g, day, year = 4) => { const st = St.studyState(d, g, day); const jobs = CV.todayJobs(d, g, day, st); return { st, jobs, t: CV.todayText({ g, st, day, year, jobs }) }; };

test('the running week: Wed 18 is Day 4, Story day with 3 sentences, 3 stones done', () => {
  let { d, g } = mk('2026-11-15', 5);
  d = W.markStep(d, g, 'hello', '2026-11-15', 2); d = W.markStep(d, g, 'fix', '2026-11-16', 2); d = W.markStep(d, g, 'games', '2026-11-17', 2);
  const { st, jobs, t } = view(d, g, '2026-11-18');
  assert.equal(st.job, 'story');
  assert.equal(jobs.length, 1);
  assert.equal(t.sub, 'Day 4 of 5 · your test is on Friday');
  assert.equal(t.big, 'Do today’s job');
  assert.equal(t.bigSub, 'Story day: 3 sentences');
  assert.equal(t.line, '', 'a full week has no short-week line');
  assert.deepEqual(st.steps.map((s) => s.state), ['done', 'done', 'done', 'today', 'later', 'later', 'later']);
  const html = CV.stonesHtml(st.steps, '2026-11-18');
  assert.equal((html.match(/class="daystone /g) || []).length, 7);
  assert.doesNotMatch(html, /daygroup__label/, 'no day labels in a full week');
  assert.doesNotMatch(html, /style=/);
});

test('Game day: its own button and the games for the year and the kind of week', () => {
  let { d, g } = mk('2026-11-15', 5);
  d = doneUpTo(d, g, ['hello', 'fix'], '2026-11-16');
  const y4 = view(d, g, '2026-11-17', 4).t;
  assert.equal(y4.big, 'Game day');
  assert.equal(y4.bigSub, '6 games · about 15 minutes');
  assert.equal(view(d, g, '2026-11-17', 2).t.bigSub, '4 games · about 10 minutes'.replace('4 games · about 10', '4 games · about 10'));
});

test('a short week: day 1 holds 2 jobs, named together, with the short-week line', () => {
  const { d, g } = mk('2026-11-22', 3); // set Sun 22, test Wed 25
  const { st, jobs, t } = view(d, g, '2026-11-22');
  assert.equal(St.weekKind(g), 'short');
  assert.deepEqual(jobs.map((s) => s.id), ['hello', 'fix']);
  assert.equal(t.big, 'Do today’s jobs');
  assert.equal(t.bigSub, 'Hello words, then Fix it in');
  assert.equal(t.sub, 'Today: 2 jobs.');
  assert.equal(t.line, 'Short week: test on Wed 25 Nov.');
  const html = CV.stonesHtml(st.steps, '2026-11-22');
  assert.deepEqual(CV.dayGroups(st.steps).map((x) => [x.label, x.steps.length]), [['Sun', 2], ['Mon', 2], ['Tue', 1], ['Wed', 1], ['Thu', 1]]);
  assert.equal((html.match(/class="daystone /g) || []).length, 7, 'never fewer than 7 stones');
  assert.equal((html.match(/daygroup__label/g) || []).length, 5, 'a label under each day');
});

test('a quick week: 3 jobs on day 1 and the Game day count in one line', () => {
  const { d, g } = mk('2026-11-22', 2); // test Tue 24
  const { jobs, t } = view(d, g, '2026-11-22');
  assert.deepEqual(jobs.map((s) => s.id), ['hello', 'fix', 'games']);
  assert.equal(t.bigSub, 'Hello words, Fix it in, then Game day');
  assert.equal(t.sub, 'Quick week: 3 jobs today, test on Tue 24 Nov. Game day has 2 games.');
});

test('Story day in a short week: 2 sentences; quick 1', () => {
  let { d, g } = mk('2026-11-22', 3);
  d = doneUpTo(d, g, ['hello', 'fix'], '2026-11-22');
  d = doneUpTo(d, g, ['games'], '2026-11-23');
  const { jobs } = view(d, g, '2026-11-23');
  assert.deepEqual(jobs.map((s) => s.id), ['story']);
  assert.equal(view(d, g, '2026-11-23').t.bigSub, 'Story day: 2 sentences');
  assert.equal(St.storySentences(St.weekKind(g)), 2);
});

test('test day, nothing yet, finished and done: the lines of 07b, 07f, 07j and 07g', () => {
  let { d, g } = mk('2026-11-15', 5);
  d = practised(doneUpTo(d, g, ['hello', 'fix', 'games', 'story'], '2026-11-19'), g, '2026-11-19');
  const test = view(d, g, '2026-11-20').t;
  assert.equal(test.sub, 'Test day! Your test is today.');
  assert.equal(test.big, 'Do your test');
  assert.equal(test.bigSub, '4 words · you can do it');
  assert.equal(CV.todayText({ g: null }).sub, 'No week yet. Your grown-up sets your weeks. You can still practise.');
  assert.doesNotMatch(JSON.stringify(CV.todayText({ g: null })), /own week|Make my/i);
  const fin = CV.todayText({ g, st: { status: 'finished', steps: [], waiting: 0 }, day: '2026-11-30', jobs: [] });
  assert.equal(fin.sub, 'Your week is finished. Your grown-up will set your next week.');
  assert.equal(fin.big, 'Pick words');
  const done = CV.todayText({ g, st: { status: 'done', steps: [], waiting: 0 }, day: '2026-11-17', jobs: [] });
  assert.equal(done.big, 'Play Wordbright');
  assert.equal(done.sub, 'Today’s job is done. See you tomorrow!');
});

test('the Menu: Practice, Words to practise again and Games shut on a test day, with the reason', () => {
  const open = CV.menuItems({ gid: 'g', wordsGid: 'g', hasGroup: true, gamesOpen: true, locked: false, tricky: 4 });
  assert.deepEqual(open.map((r) => r.id), ['today', 'practice', 'words', 'tricky', 'progress', 'games', 'look', 'settings']);
  assert.equal(open.find((r) => r.id === 'tricky').sub, '4 words');
  const shut = CV.menuItems({ gid: 'g', hasGroup: true, gamesOpen: false, locked: true, tricky: 4 });
  for (const id of ['practice', 'tricky', 'games']) { const r = shut.find((x) => x.id === id); assert.equal(r.closed, true, id); assert.equal(r.sub, 'Opens after your test', id); assert.equal(r.href, undefined, id); }
  assert.ok(shut.find((r) => r.id === 'words').href, 'This week’s words stays open');
  assert.equal(CV.menuItems({ hasGroup: false }).some((r) => r.id === 'games' || r.id === 'words'), false, 'no week, no week pages');
});

test('My week: one row a day in a short week; the 7 jobs in order in a full one', () => {
  let { d, g } = mk('2026-11-22', 3);
  d = doneUpTo(d, g, ['hello', 'fix'], '2026-11-22');
  const rows = CV.weekRows(d, g, '2026-11-23', St.studyState(d, g, '2026-11-23'), 4);
  assert.deepEqual(rows.map((r) => r.title), ['Sun · 2 jobs', 'Mon · 2 jobs', 'Tue · Practice day', 'Wed · Test day', 'Thu · Mend and keep']);
  assert.equal(rows[0].sub, 'Hello words, Fix it in · done · Do it again');
  assert.equal(rows[1].sub, 'Game day (4 games), Story day (2 sentences)');
  assert.equal(rows[1].state, 'today');
  assert.equal(rows[3].sub, 'Your test · Wed 25 Nov');
  const full = mk('2026-11-15', 5);
  const f = CV.weekRows(full.d, full.g, '2026-11-18', St.studyState(full.d, full.g, '2026-11-18'), 4);
  assert.equal(f.length, 7);
  assert.equal(f[2].title, 'Day 3 · Tue · Game day');
  assert.equal(f[5].title, 'Day 6 · Fri · Test day');
  assert.equal(f[5].sub, 'Your test · Fri 20 Nov');
});

test('This week\'s words: the job, six games, then results, quiz, study, other weeks; games shut on test day (09b)', () => {
  let { d, g } = mk('2026-11-15', 5);
  d = practised(doneUpTo(d, g, ['hello', 'fix', 'games', 'story'], '2026-11-19'), g, '2026-11-19');
  const day = W.addDays(g.test, -1);
  const open = WV.weekTiles(d, g, day, { year: 4, others: [{ name: 'Autumn words' }, { name: 'Other' }], quizOn: true });
  assert.deepEqual(open.filter((t) => t.id.startsWith('game-')).map((t) => t.title), ['Missing letters', 'Unjumble', 'Meaning match', 'Fill in the blanks', 'Mix and match', 'Quick-fire']);
  assert.ok(open.every((t) => !t.lock), 'open the day before');
  assert.equal(open.at(-2).id, 'others');
  assert.equal(open.find((t) => t.id === 'others').sub, 'Autumn words · 1 more');
  assert.equal(open.at(-1).title, 'How I’m doing with each word');
  const testDay = WV.weekTiles(d, g, g.test, { year: 4 });
  assert.equal(testDay[0].title, 'Today’s test');
  for (const t of testDay.filter((x) => x.id.startsWith('game-'))) { assert.equal(t.lock, true); assert.equal(t.sub, 'Opens after your test'); }
  assert.ok(!JSON.stringify(testDay).match(/Make my own|New group|Change this/));
});

test('Practice: lists from the grown-up first, Sentence games locked on test day (practiceSections)', () => {
  const own = [{ id: 'a', name: 'Class 4 spellings', words: ['one'], at: 5 }, { id: 'b', name: 'Autumn tricky', words: ['two'], at: 4 }];
  const s = PR.practiceSections({ own, hidden: ['two'], hasWeek: true });
  assert.deepEqual(s.map((x) => x.kind), ['lists', 'sentenceGames', 'tricky', 'years', 'pick', 'progress']);
  assert.deepEqual(s[0].items, [{ id: 'a', name: 'Class 4 spellings' }, { id: 'b', name: 'Autumn tricky', hidden: true }]);
  const v = read('site/js/front-views.js');
  const body = v.slice(v.indexOf('export function childPractice'));
  assert.match(body, /PR\.practiceSections\(\{ own, hidden: \[\.\.\.hidden\], hasWeek: !!week \}\)/);
  assert.match(body, /C\.fromLine\(setup\)/, '"From Mum" or "From your grown-up"');
  assert.match(body, /PR\.PRACTICE_TITLE/);
  assert.match(body, /'Opens after your test'|SHUT/);
  assert.ok(body.indexOf('sections.map') > 0 && body.indexOf("lists: (sec)") < body.indexOf('sentenceGames:'), 'lists are drawn first');
});

test('statements: a child device makes no request while SENTENCES_API is off', async () => {
  let asked = 0;
  const store = { getItem: () => null, setItem: () => { asked += 1; } };
  const r = await CV.warmStatements(['island', 'quarter'], { origin: 'https://account.example', storage: store, playerId: 'p1' });
  assert.equal(r, false);
  assert.equal(asked, 0);
});

test('a child never sees Make my own week, group, own chapter or list library (TR-48, D26)', () => {
  for (const f of ['site/js/child-views.js', 'site/js/front-views.js', 'site/js/words-views.js', 'site/js/study-views.js']) {
    const src = read(f);
    assert.doesNotMatch(src, /Make my own week/, f);
    const child = f === 'site/js/words-views.js' ? src.slice(src.indexOf('a child\'s "This week\'s words"'), src.indexOf('function drawGroup')) : src;
    for (const s of literalsOf(child).map((x) => x.replace(/<[^>]*>/g, ' '))) assert.doesNotMatch(s, /\b(group|own chapter|list library|word list)\b/i, f + ': ' + s);
  }
  assert.equal(C.mayMakeOwnWeek({}, '2026-11-18'), false);
  assert.match(read('site/js/words-views.js'), /Your grown-up will set your next week\./);
  assert.match(read('site/js/words-views.js'), /if \(roleNow\(\) !== 'adult'\) \{ location\.replace\('#\/words'\); return; \}/, 'words/new sends a child to My words');
});

test('every new child sentence is at most 8 words (two lines copied from the design are the exceptions)', () => {
  const lines = [];
  for (const kind of [[3, '2026-11-22'], [3, '2026-11-23'], [5, '2026-11-22']]) {
    const { d, g: x } = mk('2026-11-22', kind[0]);
    const { t } = view(d, x, kind[1]);
    lines.push(t.sub, t.line, t.big, t.bigSub);
  }
  lines.push(CV.todayText({ g: null }).sub, 'Your week is finished. Your grown-up will set your next week.', 'Today’s job is done. See you tomorrow!', 'Every job this week is done. Your test is tomorrow.');
  for (const l of lines.filter(Boolean)) for (const p of l.split(/(?<=[.!?])\s+/)) assert.ok(p.replace(/·/g, ' ').trim().split(/\s+/).length <= 8 || /^(Quick week|Day \d+ of \d+)/.test(p), p);
});

test('the fold rules are in the css: the safe zone, 112 px bands, keys at least 32 x 48, no inline style, no new :has()', () => {
  const app = read('site/css/app.css');
  assert.match(app, /--safe-zone: calc\(env\(safe-area-inset-bottom, 0px\) \+ 112px\)/);
  const child = read('site/css/child.css');
  assert.match(child, /\.sheet \{ padding-bottom: calc\(18px \+ var\(--safe-zone\)\); \}/);
  assert.match(child, /body\.is-child \.keyboard \.key \{ min-width: 32px; min-height: 48px; \}/);
  assert.match(read('site/css/tray.css'), /HOTFIX1 \(17 Nov\)/);
  const mine = child.slice(child.indexOf('SB5 (WP-F2)'));
  assert.doesNotMatch(mine, /:has\(/, 'TR-63: no :has() in the new rules');
  assert.match(mine, /\.today \{[^}]*var\(--safe-zone\)/, 'Today ends above the band');
  for (const f of ['child-views.js', 'front-views.js', 'words-views.js', 'study-views.js']) assert.doesNotMatch(read('site/js/' + f), /\sstyle="/, f);
});

test('the controls that answer or move on carry data-fold', () => {
  const sv = read('site/js/study-views.js');
  assert.match(sv, /export function markFold/);
  for (const [attr, v] of [['data-check', 'check'], ['data-hear], [data-instruct', 'hear'], ['data-peekbtn', 'peek'], ['data-skip', 'skip'], ['.keyboard', 'keys']]) assert.ok(sv.includes("'" + (attr.startsWith('.') ? attr : '[' + attr + ']') + "', '" + v + "'"), attr);
  assert.match(read('site/js/words-views.js'), /markFold\(main\)/);
});

// SB5 M1 (CODE-CHECK-2): "Day N of M" uses the week's real length, never a fixed 7.
test('M1: Day N of M takes M from the week: 5, 6, 7 and 14 day weeks', () => {
  for (const len of [5, 6, 7, 14]) {
    const { d, g } = mk('2026-11-15', len);
    assert.equal(CV.weekLength(g), len);
    const first = view(d, g, '2026-11-15');
    assert.equal(first.t.sub, 'Day 1 of ' + len + ' · your test is on ' + CV.testWhen(g, '2026-11-15'));
    assert.equal(CV.dayNumber(g, W.addDays('2026-11-15', len - 1)), len, 'the last day before the test is day ' + len + ' of ' + len);
    assert.equal(CV.dayNumber(g, W.addDays('2026-11-15', len + 3)), len, 'never past the length');
    assert.equal(CV.dayNumber(g, '2026-11-01'), 1, 'never below 1');
  }
});
