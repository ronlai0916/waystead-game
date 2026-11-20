// "My words": the word group, today's job, the practice grid, spelling a word,
// the test and the numbers. The rules are in words-doc.js and spell-run.js;
// these pages only show them. Signed in only (gate.js).
import * as D from './data.js';
import * as S from './store.js';
import * as W from './words-doc.js';
import * as R from './spell-run.js';
import { checkTyped } from './wordcheck.js';
import { speak, stop, sayLine } from './speech.js';
import { burstHtml, placeBursts } from './celebrate.js';
import { esc, ICON, keyboard, shuffle, toast, dotsHtml, rowCountHtml, inARowHtml, RETRY_LINE } from './ui.js';
import * as C from './child-doc.js';
import * as St from './study-doc.js';
import { stepHref, stripHtml, comeBackHref, comeBackHtml, markFold } from './study-views.js';
import * as G from './games-doc.js';
import { tileHtml, openSheet, todayJobs, jobLabel } from './child-views.js';
import { findEntry, entryFor } from './word-info.js';
import { getWeek, setWeek } from './week-choice.js';
import { childYear } from './who.js';
import * as Tr from './tray.js';
import { hearInSentence, canSentence } from './sentence.js';
import * as A from './assess-doc.js';
import * as AV from './assess-views.js';
import { safeDecode } from './chapters-doc.js'; // SB4-WP13: a bad address piece is '' (never throws)

const PEEK_MS = 2000;
const AGAIN_MS = 1600; // how long a finished word stays before it comes back
const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const today = () => W.localDay(Date.now());
const groupHref = (id) => '#/words/g/' + encodeURIComponent(id);
const toGroup = (id) => { location.replace(groupHref(id)); };
const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);

const JOB = {
  practise: { title: 'Practise', line: St.DAILY_TIME_CAP + '. Tap a word: it\'s hidden and spoken, and you spell it.' },
  test: { title: 'Test today', line: 'Each word is spoken, with no peeking and one go each. You see how you did at the end.' },
  wait: { title: 'Test done', line: 'Well done. Your fix-ups come tomorrow.' },
  fixups: { title: 'Fix-ups', line: 'A little extra practice for the words that slipped.' },
  'fixed-today': { title: 'Fix-ups done for today', line: 'Those words come back tomorrow for one more clean go.' },
  finished: { title: 'All done', line: 'This group is finished. Words not yet remembered come back in your next group.' },
};

// ---- the first group ---------------------------------------------------------------
// The chapter the player is on: their own school year's first unpassed one when it is known, else the
// first unpassed chapter of the furthest year they have started, else the first open one (Year 3 on).
function currentChapter() {
  const live = D.liveYears();
  const order = [...['y3', 'y4', 'y5', 'y6'].filter((y) => live.includes(y)), ...['y1', 'y2'].filter((y) => live.includes(y))];
  const open = (y) => D.chapters(y).find((c) => !S.chapterProgress(c.id).passed);
  const began = (y) => D.chapters(y).some((c) => { const p = S.chapterProgress(c.id); return p.studied || p.practised || p.attempts > 0; });
  const own = 'y' + childYear();
  if (live.includes(own) && open(own)) return open(own);
  const furthest = [...order].reverse().find((y) => began(y) && open(y));
  if (furthest) return open(furthest);
  const first = order.find(open);
  return first ? open(first) : D.chapters(order[order.length - 1]).at(-1);
}
export function ensureStarter() {
  if (!W.needsStarter(S.readWords())) return;
  const ch = currentChapter();
  S.updateWords((d) => W.starterGroup(d, { name: D.chapterTitle(ch).name, words: ch.words.map((w) => w.word), today: today() }));
}

/** The words of any test that's due, for the pages that list words. */
export const hiddenToday = () => (S.currentPlayer() ? St.hiddenWords(S.readWords(), today()) : new Set());

/** For the home page. */
export function todayLine() {
  if (!S.currentPlayer()) return 'Your words for the week';
  const d = S.readWords();
  const day = today();
  const g = W.currentGroup(d, day);
  if (!g) return 'Your words for the week';
  const job = W.jobFor(d, g, day);
  return job === 'practise' ? 'Practise: ' + W.starsOn(d, g, day) + ' of ' + W.rows(g).length + ' stars today' : JOB[job].title;
}
/** Up to 3 words not yet remembered, for the flower game, as word entries. */
export function backAgainFor(words) {
  if (!S.currentPlayer()) return [];
  return W.returningWords(S.readWords(), today(), words, 50).map((w) => D.entry(w)).filter(Boolean).slice(0, W.MAX_BACK);
}

// ---- the group page ----------------------------------------------------------------
function starsLine(d, g, day) {
  const n = W.starsOn(d, g, day);
  return '<p class="starline">' + ICON.star + '<span><b>' + n + ' of ' + W.rows(g).length + '</b> stars today</span></p>';
}
const spellHref = (g, w) => groupHref(g.id) + '/spell/' + W.rows(g).indexOf(w);

// Study mode: the group's guided week.
const STATUS_LINE = {
  done: ['Done for today!', 'Your next job is ready tomorrow. You can still play games with these words.'],
  rest: ['No job today', 'Your next job is on its way. You can still play games with these words.'],
  ready: ['Every job done', 'Your test is on the way. Keep these words warm with a game.'],
  finished: [JOB.finished.title, JOB.finished.line],
};
function testCard(g) {
  return '<div class="card job job--test" data-testcard><span class="eyebrow">Today</span><h2>' + esc(JOB.test.title) + '</h2><p class="muted">' + esc(JOB.test.line) + '</p>'
    + '<a class="btn btn--primary" href="' + groupHref(g.id) + '/test" data-job>Start the test' + ICON.arrow + '</a></div>';
}
/** In place of any page that would show a test's words (test-guard.js). */
export function testTodayPage(main, g) {
  main.innerHTML = '<section class="wrap page"><div class="pagehead"><span class="eyebrow">' + esc(g.name) + '</span><h1>' + esc(JOB.test.title) + '</h1></div>' + testCard(g) + '</section>';
}
function studyCard(d, g, day) {
  const s = St.studyState(d, g, day);
  const step = s.steps.find((x) => x.id === s.job);
  if (s.job === 'test') return testCard(g);
  const late = s.catchUp ? '<p data-catchup>' + esc(St.catchUpLine(g, day)) + '</p>' : '';
  if (!step) {
    const [title, line] = STATUS_LINE[s.status];
    return '<div class="card job"><span class="eyebrow">Today</span><h2>' + esc(title) + '</h2>' + late + '<p class="muted">' + esc(line) + '</p></div>';
  }
  const line = step.id === 'mend' && St.mendPart(d, g, day) === 'fixups' ? JOB.fixups.line : step.line;
  return '<div class="card job job--' + step.id + '"><span class="eyebrow">Today</span><h2>' + esc(step.title) + '</h2>' + late + '<p class="muted">' + esc(line) + '</p><p class="muted small">' + esc(St.DAILY_TIME_CAP) + '</p>'
    + (step.id === 'practice' ? starsLine(d, g, day) : '')
    + '<a class="btn btn--primary" href="' + stepHref(d, g, step.id, day) + '" data-job>Start' + ICON.arrow + '</a></div>';
}

// Practise 3 times, for the whole group.
function roundsLine(d, g, day) {
  const all = W.allDots(d, g, day).filter((x) => !x.back);
  const full = all.filter((x) => x.dots >= W.ROW_NEEDED).length;
  return W.readyForTest(d, g) ? '<p class="readyline"><span class="pill pill--done">Ready for the test</span> Every word has its 3 dots.</p>'
    : '<p class="readyline small muted">' + full + ' of ' + all.length + ' words have all 3 dots. Each word needs 3 clean spellings in a row before the test.</p>';
}

/** Study or Game: the same words, a guided week or the games any time. */
function modeSwitch(g, mode) {
  const link = (id, label, href) => '<a class="tab" href="' + href + '" role="tab" aria-selected="' + (mode === id) + '" data-mode="' + id + '">' + label + '</a>';
  return '<div class="tabs modeswitch" role="tablist" aria-label="Study or Game">' + link('study', 'Study mode', groupHref(g.id)) + link('game', 'Game mode', groupHref(g.id) + '/games') + '</div>';
}
export { modeSwitch };

function gridHtml(d, g, day, job) {
  // While the jobs catch up after the test date, the grid runs on to today.
  const days = W.practiceDays(g);
  if (job === 'practise') for (let x = g.test; x <= day; x = W.addDays(x, 1)) days.push(x);
  const open = job === 'practise';
  const L = W.allDots(d, g, day);
  const later = new Map(W.comeBack(d, g, day).map((x) => [x.word, x.flow]));
  const row = (w, i) => {
    const name = esc(w) + (g.back.includes(w) ? ' <span class="pill">back again</span>' : '');
    if (later.has(w)) return rowHtml(w, i, '<a href="' + comeBackHref(g, w, later.get(w)) + '" data-comeback>' + name + '</a> <span class="pill pill--warm">Come back to this</span>');
    return rowHtml(w, i, open ? '<a href="' + spellHref(g, w) + '">' + name + '</a>' : name);
  };
  const rowHtml = (w, i, head) => {
    return '<tr><th scope="row">' + head + '</th><td class="gridcell gridcell--dots">' + dotsHtml(L[i].dots, W.ROW_NEEDED) + '</td>' + days.map((x) => {
      const c = W.cell(d, g, w, x);
      const mark = c === 'clean' ? ICON.star + '<span class="sr">Done clean</span>' : c === 'help' ? TICK + '<span class="sr">Done with help</span>' : '<span class="sr">Not yet</span>';
      return '<td class="gridcell gridcell--' + c + (x === day ? ' is-today' : '') + '">' + mark + '</td>';
    }).join('') + '</tr>';
  };
  return '<div class="gridwrap" role="region" aria-label="Practice grid" tabindex="0"><table class="wordgrid"><thead><tr><th scope="col"><span class="sr">Word</span></th><th scope="col">Rounds</th>'
    + days.map((x) => { const [a, b] = W.dayParts(x); return '<th scope="col"' + (x === day ? ' class="is-today"' : '') + '>' + a + '<br>' + b + '</th>'; }).join('')
    + '</tr></thead><tbody>' + W.rows(g).map(row).join('') + '</tbody></table></div>'
    + '<p class="gridkey small muted"><span>' + ICON.star + ' Done clean</span><span>' + TICK + ' Done with help</span><span><i class="gridkey__empty"></i> Not yet</span></p>';
}

function resultsCard(d, g) {
  const res = W.testResults(d, g);
  const right = res.filter((x) => x.result.right).length;
  const all = right === res.length;
  return '<div class="pagehead' + (all ? ' pagehead--pass' : '') + '">'
    + (all ? '<span class="celebrate passmark" aria-hidden="true"><span class="passmark__badge">' + ICON.star + '</span>' + burstHtml(16, 2) + '</span>' : '')
    + '<h2>' + right + ' of ' + res.length + ' right in the test</h2></div>'
    + '<div class="list">' + res.map((x) => '<div class="card listrow"><strong>' + esc(x.word) + '</strong>'
      + (x.result.right ? '<span class="pill pill--done">Right</span>' : '<span class="pill pill--warm">Slipped</span>') + '</div>').join('') + '</div>';
}

function fixupList(d, g, day) {
  const left = W.fixups(d, g);
  if (!left.length) return '';
  return '<div class="list">' + left.map((w) => '<a class="card listrow" href="' + spellHref(g, w) + '"><strong>' + esc(w) + '</strong>'
    + (W.sessionDone(d, g, w, day, 'f') ? '<span class="pill pill--done">Done today</span>' : W.comeBack(d, g, day).some((x) => x.word === w && x.flow === 'f') ? '<span class="pill pill--warm">Come back to this</span>' : '<span class="pill">Not yet</span>') + '</a>').join('') + '</div>';
}

/** The signed-in player's role as the page chrome knows it: only a grown-up may delete a week (SB3-G). */
const roleNow = () => (document.body.classList.contains('is-adult') ? 'adult' : document.body.classList.contains('is-child') ? 'child' : 'unknown');
/** SB4-WP5: a quiet "Try a quick quiz" once Practice day is done, if the grown-up allows it, and never while this week's test is due. */
function quizRow(d, g, day, job) {
  if (job === 'test' || !St.doneDay(d, g, 'practice') || !S.helpNow(childYear()).offer.quiz) return '';
  return '<p class="quizrow"><a class="linkbtn" href="' + groupHref(g.id) + '/quiz" data-quizrow>' + C.QUIZ_ROW + '</a></p>';
}
// ---- a child's "This week's words" (09b): tiles, not a manage page --------------------------------
const WEEK_ICON = {
  job: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M10.2 8.8l5 3.2-5 3.2z"/></svg>',
  game: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="11" rx="5"/><path d="M8 10.5v4M6 12.5h4M15.5 11.5h.01M17.5 13.5h.01"/></svg>',
  type: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M12 6v13M9 19h6"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>',
  tick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  words: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
};
/** The six games on a week's page, in the order of 08d, with their one-line sub (the five a day plays are chosen by Game day, not here). */
export const WEEK_GAMES = [
  ['missing', 'Fill in the letters'], ['unjumble', 'Put the letters in order'], ['match', 'Words and their meanings'],
  ['fill', 'Put the word in the sentence'], ['mix', 'Put each word in its sentence'], ['quick', 'Spell fast'],
];
/** What a child's "This week's words" holds: [{ id, title, sub, href?, lock?, first? }] in the order of 09b. */
export function weekTiles(d, g, day, { year = 0, others = [], quizOn = false, setBy = '' } = {}) {
  const st = St.studyState(d, g, day);
  const job = W.jobFor(d, g, day);
  const open = St.gamesOpen(d, g, day);
  const tiles = [];
  const jobs = todayJobs(d, g, day, st);
  if (jobs.length) {
    const kind = St.weekKind(g);
    const label = jobs.length > 1 ? jobs.map((x) => x.title).join(', ') : jobLabel(jobs[0], { games: G.dayGames(year, kind).length, sentences: St.storySentences(kind) });
    tiles.push({ id: 'job', icon: 'job', title: job === 'test' ? 'Today’s test' : jobs.length > 1 ? 'Today’s jobs' : 'Today’s job', sub: label, href: stepHref(d, g, jobs[0].id, day), first: true, attr: ' data-job' });
  }
  for (const [id, sub] of WEEK_GAMES) tiles.push({ id: 'game-' + id, icon: id === 'fill' ? 'type' : id === 'mix' || id === 'match' ? 'list' : 'game', title: G.GAMES[id].title, sub: open ? sub : 'Opens after your test', href: groupHref(g.id) + '/game/' + id, lock: !open });
  if (W.testDone(d, g)) {
    const res = W.testResults(d, g);
    tiles.push({ id: 'results', icon: 'star', title: 'Test results', sub: 'Last test: ' + res.filter((x) => x.result.right).length + ' of ' + res.length, still: true });
  }
  if (quizOn && job !== 'test' && St.doneDay(d, g, 'practice')) tiles.push({ id: 'quiz', icon: 'tick', title: 'Quiz', sub: '5 quick questions', href: groupHref(g.id) + '/quiz', attr: ' data-quizrow' });
  tiles.push({ id: 'study', icon: 'words', title: 'Study this week', sub: g.name + ' · ' + plural(g.words.length, 'word'), href: groupHref(g.id) + '/path' });
  if (others.length) tiles.push({ id: 'others', icon: 'cal', title: 'Other weeks', sub: others[0].name + (others.length > 1 ? ' · ' + (others.length - 1) + ' more' : ''), button: true, attr: ' data-other-weeks' });
  tiles.push({ id: 'progress', icon: 'eye', title: 'How I’m doing with each word', sub: 'How often each word went right', href: '#/words/progress' });
  void setBy;
  return tiles;
}

function drawChildWeek(main, g, others) {
  const d = S.readWords();
  const day = today();
  const job = W.jobFor(d, g, day);
  const year = childYear();
  const setBy = C.setByLine(g.id, S.readSetup());
  const switchable = W.weekPickOn(d) ? new Set(C.weekChoice(d, day, '').weeks.map((w) => w.id)) : new Set();
  const more = W.weekPickOn(d) ? others.filter((o) => switchable.has(o.id)) : [];
  const tiles = weekTiles(d, g, day, { year, others: more, quizOn: S.helpNow(year).offer.quiz, setBy });
  const after = ['wait', 'fixups', 'fixed-today', 'finished'].includes(job);
  main.innerHTML = '<section class="wrap page weekpage" data-weekpage>'
    + '<div class="pagehead"><h1>This week’s words</h1>' + (setBy ? '<p class="path__sub" data-setby>' + esc(setBy) + '</p>' : '') + '</div>'
    + '<ul class="tilelist">' + tiles.map((t) => '<li>' + tileHtml({ ...t, icon: WEEK_ICON[t.icon] }) + '</li>').join('') + '</ul>'
    + (job === 'fixups' || job === 'fixed-today' ? fixupList(d, g, day) : '')
    + (job === 'test' ? '' : comeBackHtml(g, W.comeBack(d, g, day)))
    + (after ? resultsCard(d, g) : '') + '</section>';
  const ow = main.querySelector('[data-other-weeks]');
  if (ow) ow.addEventListener('click', () => openSheet(ow, { title: 'Other weeks', cls: 'weeksheet', body: more.map((o) => '<button type="button" class="sheetrow weekrow" data-week="' + esc(o.id) + '"><span class="sheetrow__text"><b>' + esc(o.name) + '</b><span>Test ' + esc(W.dayLabel(o.test)) + '</span></span><span class="pill">Study this week</span></button>').join(''),
    onPick: (el) => { setWeek(el.dataset.week); location.hash = groupHref(el.dataset.week); } }));
  placeBursts(main);
}

function drawGroup(main, g, others = []) {
  const d = S.readWords();
  const day = today();
  const job = W.jobFor(d, g, day);
  const testing = job === 'test'; // no word on show on test day
  const after = ['wait', 'fixups', 'fixed-today', 'finished'].includes(job);
  const child = document.body.classList.contains('is-child');
  if (child) { drawChildWeek(main, g, others); return; } // D26: a child's page is tiles; no New group, no Change this week
  const editLabel = W.editLinkLabel(d, g, day, roleNow());
  if (child && !W.weekPickOn(d)) others = []; // switch off: a child's My words shows only the app's pick
  const switchable = child && W.weekPickOn(d) ? new Set(C.weekChoice(d, day, '').weeks.map((w) => w.id)) : new Set(); // a child can make another week the one the home shows
  main.innerHTML = '<section class="wrap page">'
    + '<div class="pagehead"><span class="eyebrow">My words</span><h1>' + esc(g.name) + '</h1>'
    + '<p class="muted">' + plural(g.words.length, 'word') + (g.back.length ? ', and ' + g.back.length + ' back again' : '') + ' · Test on ' + esc(W.dayLabel(g.test)) + '</p></div>'
    + modeSwitch(g, 'study')
    + studyCard(d, g, day)
    + stripHtml(St.studyState(d, g, day).steps, day)
    + quizRow(d, g, day, job)
    + (job === 'fixups' || job === 'fixed-today' ? fixupList(d, g, day) : '')
    + (testing ? '' : comeBackHtml(g, W.comeBack(d, g, day)))
    + (after ? resultsCard(d, g) : '')
    + (job === 'practise' ? roundsLine(d, g, day) : '')
    + (testing ? '' : gridHtml(d, g, day, job))
    + '<div class="btnrow groupmanage">' + (editLabel ? '<a class="btn btn--ghost" href="' + groupHref(g.id) + '/edit">' + editLabel + '</a>' : '')
    + '<a class="btn btn--ghost" href="#/words/new">New group</a>'
    + '<a class="btn btn--ghost" href="#/words/progress">My word numbers</a></div>'
    // A child sees only this quiet link (a grown-up plans the week, but a group the child made is theirs to change).
    + (editLabel ? '<p class="groupedit"><a class="linkbtn" href="' + groupHref(g.id) + '/edit">' + editLabel + '</a></p>' : '')
    + (others.length ? '<h2 class="sectionhead">Other groups</h2><div class="list">' + others.map((o) => '<a class="card listrow" href="' + groupHref(o.id) + '"><span><strong>' + esc(o.name) + '</strong><br><span class="muted small">Test on ' + esc(W.dayLabel(o.test)) + '</span></span>'
      + '<span class="pill">' + esc(JOB[W.jobFor(d, o, day)].title) + '</span></a>'
      + (switchable.has(o.id) && getWeek() !== o.id ? '<button type="button" class="btn btn--quiet studyweek" data-study-week="' + esc(o.id) + '">Study this week<span class="sr">: ' + esc(o.name) + '</span></button>' : '')).join('') + '</div>' : '')
    + '</section>';
  main.querySelectorAll('[data-study-week]').forEach((b) => b.addEventListener('click', () => { setWeek(b.dataset.studyWeek); location.hash = groupHref(b.dataset.studyWeek); }));
  placeBursts(main);
}

export function myWords(main) {
  if (roleNow() === 'adult') ensureStarter(); // D26: a child never gets a week of their own; only a grown-up makes one
  const d = S.readWords();
  const current = W.currentGroup(d, today());
  // Another group sharing a word with a test that's due: the test's own page instead.
  let g = current && St.showsHidden(current, St.hiddenWords(d, today())) ? St.dueGroups(d, today())[0] : current;
  // Switch off: a child or unknown player's My words is the app's pick (the due-test branch above stays first).
  if (roleNow() !== 'adult' && !W.weekPickOn(d) && !(g && St.dueGroups(d, today()).some((x) => x.id === g.id))) { const pick = C.weekChoice(d, today(), '').group; if (pick) g = pick; }
  if (!g) {
    if (roleNow() !== 'adult') {
      main.innerHTML = '<section class="wrap page weekpage" data-weekpage data-none><div class="pagehead"><h1>This week’s words</h1></div>'
        + '<div class="card empty"><p>Your grown-up will set your next week.</p><p class="muted">You can still practise.</p><a class="btn btn--primary btn--wide" href="#/chapters">Practice</a></div></section>';
      return;
    }
    main.innerHTML = '<section class="wrap page"><div class="pagehead"><span class="eyebrow">My words</span><h1>Your words for the week</h1></div>'
      + '<div class="card empty"><p class="muted">Make a group of up to ' + W.MAX_WORDS + ' words and pick a test date.</p><a class="btn btn--primary" href="#/words/new">New group</a></div></section>';
    return;
  }
  drawGroup(main, g, W.liveGroups(d).filter((o) => o.id !== g.id));
}

export function group(main, { gid }) {
  const d0 = S.readWords();
  const g = W.groupById(d0, safeDecode(gid));
  if (!g) { location.replace('#/'); return; }
  // (app.js's router has already sent a child to the pick when the week switch is off: C.weekGuard.)
  drawGroup(main, g, document.body.classList.contains('is-child') ? W.liveGroups(d0).filter((o) => o.id !== g.id) : []);
}

// ---- making and changing a group -----------------------------------------------------
function groupForm(main, existing) {
  const day = today();
  const locked = existing && !W.canEditAsChild(S.readWords(), existing, day);
  const tricky = S.trickyWords().map((t) => t.word).filter((w) => D.entry(w));
  let name = existing ? existing.name : '';
  let test = existing ? existing.test : W.defaultTest(day);
  const chosen = existing ? [...existing.words] : [];
  let tab = 'chapter';
  let chapterId = currentChapter().id;
  let yearId = D.defaultYear();
  let typed = '';
  let note = '';
  let armed = false;
  const mayDelete = !!existing && W.mayDeleteWeek(roleNow()); // a child never gets a delete (SB3-G)

  const tabBtn = (id, label) => '<button type="button" class="tab" role="tab" aria-selected="' + (tab === id) + '" data-tab="' + id + '">' + esc(label) + '</button>';
  const source = () => (tab === 'chapter' ? D.chapterById(chapterId).words.map((w) => w.word)
    : tab === 'tricky' ? tricky
      : tab === 'year' ? D.chapters(yearId).flatMap((c) => c.words.map((w) => w.word)).sort((a, b) => a.localeCompare(b, 'en-GB', { sensitivity: 'base' })) : []);
  const chapterOpts = () => D.liveYears().map((y) => '<optgroup label="' + esc(D.years()[y].label) + '">' + D.chapters(y).map((c) => '<option value="' + c.id + '"'
    + (c.id === chapterId ? ' selected' : '') + '>' + esc(D.chapterTitle(c).n + '. ' + D.chapterTitle(c).name) + '</option>').join('') + '</optgroup>').join('');

  function picker() {
    const list = source();
    return '<div class="tabs" role="tablist">' + tabBtn('chapter', 'A chapter') + tabBtn('tricky', 'Practise again (' + tricky.length + ')') + tabBtn('year', 'A year list') + tabBtn('typed', 'Type a word') + '</div>'
      + (tab === 'chapter' ? '<select class="field" aria-label="Chapter" data-chapter>' + chapterOpts() + '</select>' : '')
      + (tab === 'year' ? '<select class="field" aria-label="Year list" data-year>' + D.liveYears().map((y) => '<option value="' + y + '"' + (y === yearId ? ' selected' : '') + '>' + esc(D.years()[y].label) + '</option>').join('') + '</select>' : '')
      + (tab === 'tricky' && !tricky.length ? '<div class="card empty"><p>No words to practise again yet.</p></div>' : '')
      + (tab === 'typed' ? '<form class="btnrow" data-typeform><input class="field typedword" aria-label="Type a word" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="20" value="' + esc(typed) + '" data-typed>'
        + '<button type="submit" class="btn btn--quiet">Add</button></form>' + (note ? '<p class="small" role="status">' + esc(note) + '</p>' : '') : '')
      + (list.length ? '<div class="picker">' + list.map((w) => '<label><input type="checkbox" value="' + esc(w) + '"' + (chosen.includes(w) ? ' checked' : '') + '>' + esc(w) + '</label>').join('') + '</div>' : '');
  }

  function draw() {
    const back = existing ? existing.back : W.returningWords(S.readWords(), day, chosen);
    main.innerHTML = '<section class="wrap page"><div class="pagehead"><span class="eyebrow">My words</span><h1>' + (existing ? 'Change this group' : 'New group') + '</h1>'
      + (locked ? '<p class="muted">The test ' + (W.testBegun(S.readWords(), existing) ? 'has begun' : 'day has come') + ', so the words and date stay as they are. You can still rename it' + (mayDelete ? ' or delete it' : '') + '.</p>' : '<p class="muted">Up to ' + W.MAX_WORDS + ' words. Practise each day until the test.</p>') + '</div>'
      + '<div class="card groupform">'
      + '<label class="small muted" for="g-name">Name</label><input id="g-name" class="field" maxlength="' + W.MAX_NAME + '" value="' + esc(name) + '" placeholder="' + esc(W.defaultName(test)) + '" data-name>'
      + (locked ? '' : '<label class="small muted" for="g-test">Test date</label><input id="g-test" class="field" type="date" value="' + esc(test) + '" min="' + W.addDays(day, 1) + '" max="' + W.addDays(existing ? existing.start : day, W.MAX_DAYS) + '" data-test>')
      + '</div>'
      + '<h2 class="sectionhead">Words <span class="muted small">(<span data-count>' + chosen.length + '</span> of ' + W.MAX_WORDS + ')</span></h2>'
      + (chosen.length ? '<div class="wordchips">' + chosen.map((w) => (locked ? '<span>' + esc(w) + '</span>' : '<button type="button" class="chip" data-remove="' + esc(w) + '" aria-label="Remove ' + esc(w) + '">' + esc(w) + ' ×</button>')).join('') + '</div>' : '<p class="muted small">No words yet. Add some below.</p>')
      + (back.length ? '<p class="muted small">Back again with this group: ' + esc(back.join(', ')) + '</p>' : '')
      + (locked ? '' : '<div class="stack addwords">' + picker() + '</div>')
      + '<div class="btnrow"><button type="button" class="btn btn--primary" data-save>Save</button>'
      + (mayDelete ? '<button type="button" class="btn btn--ghost" data-delete>' + (armed ? 'Tap again to delete' : 'Delete this group') + '</button>' : '') + '</div>'
      + '</section>';
    wire();
  }

  function add(w) {
    if (chosen.includes(w)) return true;
    if (chosen.length >= W.MAX_WORDS) { toast('A group can have up to ' + W.MAX_WORDS + ' words'); return false; }
    chosen.push(w);
    return true;
  }
  function wire() {
    const q = (s) => main.querySelector(s);
    q('[data-name]').addEventListener('input', (e) => { name = e.target.value; });
    if (q('[data-test]')) q('[data-test]').addEventListener('input', (e) => { test = e.target.value; });
    main.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; note = ''; draw(); }));
    main.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => { chosen.splice(chosen.indexOf(b.dataset.remove), 1); draw(); }));
    if (q('[data-chapter]')) q('[data-chapter]').addEventListener('change', (e) => { chapterId = e.target.value; draw(); });
    if (q('[data-year]')) q('[data-year]').addEventListener('change', (e) => { yearId = e.target.value; draw(); });
    main.querySelectorAll('.picker input').forEach((cb) => cb.addEventListener('change', () => {
      if (cb.checked) add(cb.value); else if (chosen.includes(cb.value)) chosen.splice(chosen.indexOf(cb.value), 1);
      draw();
    }));
    const form = q('[data-typeform]');
    if (form) {
      q('[data-typed]').addEventListener('input', (e) => { typed = e.target.value; });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await checkTyped(typed, findEntry);
        if (r.word && add(r.word)) { typed = ''; note = 'Added ' + r.word + '.'; } else if (r.error) note = r.error;
        draw();
        q('[data-typed]').focus();
      });
    }
    q('[data-save]').addEventListener('click', save);
    const del = q('[data-delete]');
    if (del && mayDelete) del.addEventListener('click', () => {
      if (!W.mayDeleteWeek(roleNow())) return;
      if (!armed) { armed = true; draw(); return; }
      S.updateWords((d) => W.deleteGroup(d, existing.id, Date.now()));
      toast('Group deleted');
      location.hash = '#/words';
    });
  }
  function save() {
    const d = S.readWords();
    const now = Date.now();
    const r = existing
      ? W.editGroup(d, existing.id, { name: name.trim() || existing.name, ...(locked ? {} : { words: chosen, test }) }, day, now)
      : W.createGroup(d, { id: S.newId(), name, test, words: chosen, today: day, now });
    if (r.error) { toast(r.error); return; }
    S.updateWords(() => r.doc);
    location.hash = groupHref(existing ? existing.id : r.id);
  }
  draw();
}

export function newGroup(main) {
  if (roleNow() !== 'adult') { location.replace('#/words'); return; } // D26: a child never makes a week (an old link goes to My words)
  groupForm(main, null);
}
export function editGroupPage(main, { gid }) {
  const g = W.groupById(S.readWords(), safeDecode(gid));
  if (!g) { location.replace('#/'); return; }
  // A child may open the form only where their own rules let them change something; never to delete (SB3-G).
  if (roleNow() !== 'adult' && !W.canEditAsChild(S.readWords(), g, today())) { location.replace(groupHref(g.id)); return; }
  if (roleNow() !== 'adult') { location.replace(groupHref(g.id)); return; } // D26: a child never changes a week (the line above is the 16c rule, kept for the test)
  groupForm(main, g);
}

// ---- spelling a word ---------------------------------------------------------------
function boxesHtml(w) {
  const chunks = (findEntry(w) || { chunks: [w] }).chunks;
  let i = 0;
  return '<div class="spellboxes" aria-label="Letter boxes, ' + w.length + ' letters">' + chunks.map((c) => '<span class="spellboxes__group">'
    + [...c].map(() => '<span class="spellbox" data-box="' + (i++) + '"></span>').join('') + '</span>').join('') + '</div>';
}

export function spellWord(main, { gid, n }) {
  const id = safeDecode(gid);
  const d0 = S.readWords();
  const g = W.groupById(d0, id);
  const day = today();
  const w = g ? W.rows(g)[Number(n)] : null;
  const job = g ? W.jobFor(d0, g, day) : '';
  const fixing = (job === 'fixups' || job === 'fixed-today') && !!w && W.fixups(d0, g).includes(w);
  if (!w || !(job === 'practise' || fixing)) { if (g) toGroup(id); else location.replace('#/'); return; }
  const kind = fixing ? 'f' : 'p';
  const flow = kind;
  const list = fixing ? W.fixups(d0, g) : W.rows(g);

  // SB4-WP4: a child on level 1 to 4 spells with the letter tray; level 5 (almost everyone) keeps today's keyboard page exactly.
  const { lv, pf } = S.helpNow(childYear());
  const entry = findEntry(w) || { word: w, chunks: [w] };
  const spec = lv < 5 ? Tr.specFor(entry, lv, { pf }) : null;
  const rules = A.RULES.practice[pf] || A.RULES.practice.normal;
  const hearNow = () => (spec && rules.sentence === 'auto' && canSentence(entry) ? hearInSentence(entry) : speak(w));
  let ctrl = null;
  let recorded = false; // this tile pass is already saved (the pause before the next one)
  let run = R.newRun(w);
  let hold = false; // a peek on show, or the pause before the next spelling
  let done = false;
  let timer = null;
  const count = () => W.sessionCount(S.readWords(), g, w, day, flow);

  const eyebrow = '<span class="eyebrow">Word ' + (list.indexOf(w) + 1) + ' of ' + list.length + (g.back.includes(w) ? ' · back again' : '') + '</span>';
  if (spec) {
    main.innerHTML = '<section class="wrap page spellpage tilepage"><div class="pagehead">' + eyebrow + '<h1 class="sr">Spell the word</h1><p class="rowcount" data-row></p></div>'
      + Tr.lineHtml(Tr.instructionFor(lv), Tr.moreFor(spec, lv))
      + '<p class="peek" data-peek aria-live="polite"></p>'
      + '<div class="card tileword">' + Tr.boxesHtml(spec, { tricky: entry.tricky }) + '<button type="button" class="btn btn--ghost btn--wide" data-hear>' + ICON.play + 'Hear again</button></div>'
      + '<div class="peekrow"><button type="button" class="btn btn--ghost" data-peekbtn>' + Tr.EYE_ICON + 'Peek</button><span class="peekrow__hint" data-hint>' + C.PEEK_HINT + '</span></div>'
      + '<div data-slot>' + Tr.colHtml(Tr.trayHtml(spec),
        '<div class="btnrow btnrow--center testbtns testbtns--tray"><button type="button" class="btn btn--primary" data-check disabled>' + TICK + 'Check</button>'
        + '<button type="button" class="btn btn--ghost" data-skip>Skip for now<span class="sr">. It comes back later.</span></button></div>') + '</div></section>';
  } else {
    main.innerHTML = '<section class="wrap page spellpage"><div class="pagehead">' + eyebrow
      + '<h1>' + C.SPELL_INSTRUCTION + '</h1><button type="button" class="linkbtn linkbtn--start" data-instruct>Read it to me</button><p class="rowcount" data-row></p></div>'
      + '<p class="peek" data-peek aria-live="polite"></p>'
      + boxesHtml(w)
      + '<p class="spellline" data-line role="status" aria-live="polite"></p>'
      + '<div data-slot><div class="btnrow btnrow--center"><button type="button" class="btn btn--primary btn--wide" data-hear>' + ICON.play + 'Hear the word</button></div>'
      + '<div class="peekrow"><button type="button" class="btn btn--ghost" data-peekbtn>Peek</button><span class="peekrow__hint" data-hint>' + C.PEEK_HINT + '</span></div>'
      + '<div class="skiprow"><button type="button" class="linkbtn" data-skip>' + C.SKIP_TEXT + '</button></div>' + keyboard() + '</div></section>';
  }

  markFold(main);
  const line = (s) => { main.querySelector('[data-line]').textContent = s; };
  const showRow = (n2) => { main.querySelector('[data-row]').innerHTML = inARowHtml(n2); };
  const clearBoxes = () => main.querySelectorAll('[data-box]').forEach((b) => { b.textContent = ''; b.classList.remove('is-filled', 'is-next'); });
  const markNext = () => {
    main.querySelectorAll('[data-box]').forEach((b) => b.classList.toggle('is-next', Number(b.dataset.box) === run.at));
  };
  const record = (r, clean, extra = {}) => S.updateWords((d) => W.addTry(d, { id: S.newId(), word: w, day, group: id, kind, tries: r.tries, peeks: r.peeks, clean, now: Date.now(), ...extra }));
  // A tile pass: t = the letters not right at each Check, summed; clean only when the first Check was right with no peek and no fill.
  const tileRun = () => { const s = ctrl.state(); return { tries: s.tries, peeks: run.peeks, helped: s.helped }; };
  const recordTiles = () => { const r = tileRun(); const clean = !r.tries && !r.peeks && !r.helped; record(r, clean, { lv, ...(r.helped ? { h: 1 } : {}) }); return clean; };
  const nextHref = () => { const left = W.queue(S.readWords(), g, day, flow).filter((x) => x !== w); return left.length ? spellHref(g, left[0]) : ''; };

  function finish() {
    done = true;
    const d = S.readWords();
    const star = W.cell(d, g, w, day) === 'clean';
    const next = nextHref();
    main.querySelector('[data-slot]').innerHTML = '<div class="card result result--good"><div class="result__head"><span class="celebrate"><span class="result__badge">' + (star ? '★' : '✓') + '</span>' + burstHtml(12, 1.3) + '</span>'
      + '<h2>' + (star ? 'A star for today' : '3 in a row!') + '</h2></div>'
      + (fixing ? '' : '<p class="muted">' + W.starsOn(d, g, day) + ' of ' + W.rows(g).length + ' stars today</p>')
      + '<div class="btnrow"><a class="btn btn--primary" href="' + (next || groupHref(id)) + '" data-next data-fold="next">' + (next ? 'Next word' : 'Back to my words') + ICON.arrow + '</a>'
      + (next ? '<a class="btn btn--ghost" href="' + groupHref(id) + '">Back to my words</a>' : '') + '</div></div>';
    placeBursts(main);
    if (spec) { const pr = main.querySelector('.peekrow'); if (pr) pr.remove(); } else line('');
    main.querySelector('[data-next]').focus({ preventScroll: true });
  }

  // The same word, straight back: after a slip, or until it has its 3 in a row.
  function nextPass(say) {
    hold = true;
    if (!spec) line(say);
    timer = setTimeout(() => {
      hold = false;
      run = R.again(run);
      if (spec) { recorded = false; ctrl.reset(); ctrl.say(say); } else {
        clearBoxes();
        markNext();
        line('');
      }
      main.querySelector('[data-hint]').textContent = C.PEEK_HINT;
      hearNow();
    }, AGAIN_MS);
  }
  function endPass() {
    const clean = R.isClean(run);
    record(run, clean);
    const n2 = count();
    showRow(n2);
    if (n2 >= W.ROW_NEEDED && clean) { finish(); return; }
    nextPass(clean ? 'Clean! Now again, all on your own.' : RETRY_LINE);
  }

  // Tiles: Check once every gap is full.
  function onCheck() {
    if (hold || done) return;
    const r = ctrl.check();
    if (!r) return;
    if (!r.right) { showRow(0); return; }
    const clean = recordTiles();
    recorded = true;
    const n2 = count();
    showRow(n2);
    if (n2 >= W.ROW_NEEDED && clean) { finish(); return; }
    nextPass(clean ? 'Clean! Now again, all on your own.' : RETRY_LINE);
  }

  function letter(L) {
    if (hold || done) return;
    const at = run.at;
    const r = R.typeLetter(run, L);
    run = r.run;
    if (r.hit) {
      const box = main.querySelector('[data-box="' + at + '"]');
      box.textContent = w[at];
      box.classList.add('is-filled');
      line('');
      markNext();
      if (r.finished) endPass();
    } else {
      showRow(0);
      line(R.wrongLine(run.tries));
    }
  }

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (spec) {
      if (hold || done) return;
      if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); ctrl.key(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); ctrl.back(); }
      return;
    }
    if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); letter(e.key); }
  }
  // Leaving halfway after a mistake or a peek still counts as this word's try.
  function leave() {
    if (spec) {
      if (done || !ctrl || recorded) return;
      const r = tileRun();
      if (r.tries || r.peeks || r.helped) { record(r, false, { lv, ...(r.helped ? { h: 1 } : {}) }); run = R.again(run); ctrl.reset(); }
      return;
    }
    if (!done && R.mustRecord(run)) { record(run, false); run = R.again(run); }
  }
  document.addEventListener('keydown', onKey);
  window.addEventListener('pagehide', leave);
  if (spec) {
    ctrl = Tr.mountTray(main, spec, {
      glowAfter: rules.glowAfter, xs: pf === 'sen',
      onChange: (s) => { const c = main.querySelector('[data-check]'); if (c) c.disabled = !s.full || s.right; },
    });
    main.querySelector('[data-check]').addEventListener('click', onCheck);
    main.querySelector('[data-hear]').addEventListener('click', () => hearNow());
  } else {
    main.querySelectorAll('.key').forEach((k) => k.addEventListener('click', () => letter(k.dataset.letter)));
    main.querySelector('[data-hear]').addEventListener('click', () => speak(w));
    main.querySelector('[data-instruct]').addEventListener('click', () => sayLine(C.SPELL_INSTRUCTION));
  }
  main.querySelector('[data-skip]').addEventListener('click', () => {
    if (done) return;
    leave();
    S.updateWords((d) => W.addSkip(d, { id: S.newId(), group: id, word: w, day, flow, now: Date.now() }));
    done = true; // nothing more to record for this visit
    location.hash = nextHref() || groupHref(id);
  });
  const peekBtn = main.querySelector('[data-peekbtn]');
  peekBtn.addEventListener('click', () => {
    if (hold || done) return;
    run = R.peek(run);
    showRow(0);
    main.querySelector('[data-hint]').textContent = C.PEEKED_LINE;
    hold = true;
    peekBtn.disabled = true;
    main.querySelector('[data-peek]').textContent = w;
    if (ctrl) ctrl.lock(true);
    timer = setTimeout(() => {
      hold = false;
      peekBtn.disabled = false;
      main.querySelector('[data-peek]').textContent = '';
      if (ctrl) ctrl.lock(false);
    }, spec ? 3000 : PEEK_MS);
  });
  showRow(count());
  if (!spec) markNext();
  hearNow();
  return () => {
    clearTimeout(timer);
    leave();
    if (ctrl) ctrl.destroy();
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('pagehide', leave);
    stop();
  };
}

// ---- the test --------------------------------------------------------------------
export function testDay(main, { gid }) {
  const id = safeDecode(gid);
  const d0 = S.readWords();
  const g = W.groupById(d0, id);
  if (!g) { location.replace('#/'); return; }
  const day = today();
  if (W.jobFor(d0, g, day) !== 'test') { toGroup(id); return; }
  const total = g.words.length;
  const left = shuffle(W.testLeft(d0, g)); // a test left halfway carries on with the words still to do
  const year = childYear();
  const { lv, pf } = S.helpNow(year);
  // SB4-WP5: the shared runner. One go at each word, saved at once, so one go stays one go if the test is left halfway.
  return AV.runCheck(main, {
    kind: 'test', scope: { weekly: true }, words: left.map(entryFor), pf, lv, year, backHref: groupHref(id), title: g.name,
    base: { done: total - left.length, of: total },
    save: (a) => {
      S.updateWords((d) => W.addTry(d, { id: S.newId(), word: a.w, day, group: id, kind: 't', tries: a.ok ? 0 : 1, peeks: 0, clean: !!a.ok, now: Date.now(), lv: a.lv, hr: a.hr, hn: a.hn, pf }));
      const e = D.entry(a.w);
      if (e) { if (a.ok) S.noteCorrect(a.w); else S.noteMissed(a.w, e.chapterId); }
    },
    done: () => {
      const res = W.testResults(S.readWords(), g);
      return {
        right: res.filter((x) => x.result && x.result.right).length, of: total, miss: res.filter((x) => x.result && !x.result.right).map((x) => x.word),
        // 11g: the words that slipped go to Words to practise again; then Today (a week's own page is one tap further).
        buttons: res.some((x) => x.result && !x.result.right)
          ? [{ label: 'Practise the ' + plural(res.filter((x) => x.result && !x.result.right).length, 'test word'), href: '#/tricky', primary: true }, { label: 'Go to Today', href: '#/' }]
          : [{ label: 'Go to Today', href: '#/', primary: true }],
      };
    },
  });
}

// ---- the numbers -----------------------------------------------------------------
const STATUS = { remembered: 'pill--done', 'test passed': 'pill--done', practising: 'pill--warm', new: '' };
export function wordsProgress(main) {
  const d = S.readWords();
  const o = W.overall(d);
  const stat = (n, label, sub = '') => '<div class="card stat"><b>' + n + '</b><span>' + esc(label) + '</span>' + (sub ? '<span class="muted small">' + esc(sub) + '</span>' : '') + '</div>';
  const groupCard = (g) => {
    const p = W.groupProgress(d, g);
    return '<div class="card setting"><h2>' + esc(g.name) + '</h2><p class="muted small">Test on ' + esc(W.dayLabel(g.test)) + ' · ' + plural(p.tries, 'wrong letter') + ' · ' + plural(p.peeks, 'peek') + '</p>'
      + '<div class="list">' + p.words.map((x) => '<div class="listrow"><span><strong>' + esc(x.word) + '</strong><br><span class="muted small">' + plural(x.tries, 'wrong letter') + ' · ' + plural(x.peeks, 'peek') + '</span></span>'
        + '<span class="pill ' + STATUS[x.status] + '">' + esc(x.status) + '</span></div>').join('') + '</div>'
      + (p.stars.length ? '<p class="small starsbyday">' + p.stars.map((s) => '<span>' + esc(W.dayLabel(s.day)) + ': ' + s.stars + ' of ' + p.of + '</span>').join('') + '</p>' : '')
      + '</div>';
  };
  const groups = W.liveGroups(d).reverse();
  main.innerHTML = '<section class="wrap page"><div class="pagehead"><span class="eyebrow">My words</span><h1>My word numbers</h1></div>'
    + '<div class="stats">' + stat(o.remembered, 'Remembered') + stat(o.practised, 'Words practised')
    + stat(o.independent + '%', 'Independent', o.clean + ' of ' + plural(o.firstGoes, 'first go', 'first goes') + ' clean, with no help') + '</div>'
    + (groups.length ? '<div class="settings">' + groups.map(groupCard).join('') + '</div>' : '<div class="card empty"><p class="muted">No groups yet.</p><a class="btn btn--primary" href="#/words">My words</a></div>')
    + '</section>';
}
