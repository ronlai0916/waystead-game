// A child's screens (SB3-C1, "Direction A, the garden path"): the home, the path
// for the week, the Menu sheet, Settings and the top bar's three shapes (home, a
// page, a job). Views only: the rules stay in study-doc.js and words-doc.js, the
// words on screen come from child-doc.js. Signed-in child only; an adult and a
// signed-out visitor keep today's top bar and pages.
import * as S from './store.js';
import * as W from './words-doc.js';
import * as St from './study-doc.js';
import * as C from './child-doc.js';
import { stepHref, comeBackHref } from './study-views.js';
import { sayLine, stop } from './speech.js';
import { MORE } from './voice/menu.js';
import { CHOICES, currentChoice, choose } from './thememenu.js';
import { announce } from './daystyle.js';
import { getWeek, setWeek } from './week-choice.js';
import { esc, ICON } from './ui.js';
import { childYear, playerName } from './who.js';
import * as G from './games-doc.js';
import * as SENT from './sentences-data.js';
import { accountOrigin } from './account/config.js';
import * as K from './sbs-week-doc.js';
import * as Su from './setup-doc.js';
import * as SD from './session-doc.js';
import { safeDecode } from './chapters-doc.js'; // SB4-WP13: a bad address piece is '' (never throws)

const hhmmNow = () => { const n = new Date(); return String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'); };
const today = () => W.localDay(Date.now());
const groupHref = (id) => '#/words/g/' + encodeURIComponent(id);

const PIP = { happy: 'pip-portrait', thinking: 'pip-thinking', cheering: 'pip-happy' };
const pipHtml = (state) => '<span class="pipring"><span class="pipring__disc"><img class="room__pip" data-pip="' + state + '" src="assets/characters/' + PIP[state] + '-256.webp" width="148" height="148" alt="Pip the dormouse"></span></span>';

const SVG = {
  hear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true" class="fill"><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/></svg>',
  flag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4"/><path d="M6 4h11l-2.5 4L17 12H6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>',
  again: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v4.5h4.5"/></svg>',
  games: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="18" height="11" rx="5"/><path d="M8 10.5v4M6 12.5h4M15.5 11.5h.01M17.5 13.5h.01"/></svg>',
  words: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  practice: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/></svg>',
  say: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4 3.5V16H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M8.5 9.5h7M8.5 12.5h4"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true" class="hero__ico"><circle cx="12" cy="12" r="9.5"/><path d="M10 8.2l6 3.8-6 3.8z"/></svg>',
  playc: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M10.2 8.8l5 3.2-5 3.2z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2.5"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/></svg>',
  home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-6.5 8 6.5M6.5 9.5V19h11V9.5"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  look: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 2-1.8 0-1.4-1.2-1.4-1.2-2.7 0-.9.8-1.5 1.7-1.5H17a3.5 3.5 0 0 0 3.5-3.5C20.5 7 16.8 3.5 12 3.5z"/><path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
};

/** The inline link above a child page's title (09a, 08a): "< Today". Only a signed-in child sees it (child.css); the top bar's Back stays. */
export const backLink = (label = 'Today', to = '#/') => '<a class="backlink" href="' + esc(to) + '" data-backlink>' + SVG.back + esc(label) + '</a>';

/* ------------------------------------------------------------ the stones --- */
/** Step by step: the seven stones carry their own names (STONE_TEXT); `st` is returned as it was for any other way. */
export function namedState(st, setup) {
  if (!st || Su.wayOf(setup) !== 'sbs') return st;
  return { ...st, steps: st.steps.map((s) => (K.STONE_TEXT[s.id] ? { ...s, title: K.STONE_TEXT[s.id].title, line: K.STONE_TEXT[s.id].line } : s)) };
}

const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const dayShort = (day) => W.dayParts(day)[0]; // "Sun"
const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);

/** The 7 stones grouped by the day they open: [{ day, label: 'Sun', steps }]. A short week has days with 2 or 3 stones. */
export function dayGroups(steps) {
  const out = [];
  for (const s of steps) {
    const last = out[out.length - 1];
    if (last && last.day === s.date) last.steps.push(s); else out.push({ day: s.date, label: dayShort(s.date), steps: [s] });
  }
  return out;
}

/**
 * One stone of the row on Today and My week: a tick when done, its number when today (sun and plum ring), to do or not done, a clock when waiting.
 * The stones are drawn in groups by day; a label under each group only when some day holds two or more stones (a short week).
 */
export function stonesHtml(steps, day, { label = '' } = {}) {
  const groups = dayGroups(steps);
  const labels = groups.some((x) => x.steps.length > 1);
  const one = (s) => {
    const v = C.stoneView(s, day, '');
    const inner = v.kind === 'done' ? TICK : v.kind === 'waiting' || v.kind === 'todaywait' ? SVG.clock : String(s.n);
    return '<span class="daystone daystone--' + v.kind + '" aria-hidden="true">' + inner + '</span>';
  };
  const aria = label || steps.map((s) => C.stoneView(s, day, '').aria).join('. ');
  return '<span class="daystones" role="img" aria-label="' + esc(aria) + '">'
    + groups.map((x) => '<span class="daygroup daygroup--' + x.steps.length + '"><span class="daygroup__stones">' + x.steps.map(one).join('') + '</span>'
      + (labels ? '<span class="daygroup__label" aria-hidden="true">' + esc(x.label) + '</span>' : '') + '</span>').join('') + '</span>';
}

/** The first word of the child's name ("Hello, Ada!"), or ''. */
export const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || '';

/**
 * The jobs today's share allows (SB5, short weeks): in a short week a day can hold 2 or 3 jobs, and Today names them together.
 * One job in a full week, in the catch-up, on test day and for Mend and keep. `st` is St.studyState(d, g, day).
 */
export function todayJobs(d, g, day, st) {
  if (st.status !== 'job' || !st.job) return [];
  const step = (id) => st.steps.find((x) => x.id === id);
  if (St.BEFORE_TEST.includes(st.job) && !st.catchUp && day < g.test) {
    const doneToday = St.BEFORE_TEST.filter((id) => St.doneDay(d, g, id) === day).length;
    const room = Math.max(1, (st.share || 1) - doneToday);
    return St.BEFORE_TEST.filter((id) => step(id).state !== 'done' && step(id).date <= day).slice(0, room).map(step);
  }
  return [step(st.job)];
}

const GAME_MINUTES = { 1: 3, 2: 6, 3: 8, 4: 10, 5: 12, 6: 15 };
/** "Game day: 6 games", "Story day: 3 sentences", else the job's name. */
export function jobLabel(step, { games = 0, sentences = 0 } = {}) {
  if (step.id === 'games' && games) return step.title + ': ' + plural(games, 'game');
  if (step.id === 'story' && sentences) return step.title + ': ' + plural(sentences, 'sentence');
  return step.title;
}
/** "Hello words, then Fix it in" and "Hello words, Fix it in, then Game day". */
export const thenList = (names) => (names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ', then ' + names[names.length - 1]);
/** How many days this week really has: start to test day (5, 6, 7, up to 14). At least 1. */
export const weekLength = (g) => Math.max(1, W.daysBetween(g.start, g.test));
/** "Day 4 of 7": the day of the week the child is on, never past the week's own length (SB5 M1: not always 7). */
export const dayNumber = (g, day) => Math.min(weekLength(g), Math.max(1, W.daysBetween(g.start, day) + 1));
/** "Friday" while the test is within a week, else "Fri 27 Nov". */
export const testWhen = (g, day) => { const n = W.daysBetween(day, g.test); return n > 0 && n < 7 ? C.weekdayName(g.test) : W.dayLabel(g.test); };

/**
 * What Today says (07a to 07p), all in a child's words:
 *   line (the short-week line under "Hello"), sub (the day line), big + bigSub (the main button), to ('job' | 'practice' | 'wordbright' | 'tricky'),
 *   jobs (how many today), say (what Read it to me reads).
 * `jobs` = todayJobs; `year` = the child's school year (Game day's game count); `score` = { right, of } on the day the test was done.
 */
export function todayText({ g, st, day, year = 0, jobs = [], testStarted = false, score = null, finishedLine = '', sbs = false }) {
  if (!g) return { line: '', sub: 'No week yet. Your grown-up sets your weeks. You can still practise.', big: 'Pick words', bigSub: 'Choose words to practise', to: 'practice', jobs: 0 };
  const kind = St.weekKind(g);
  const gamesN = G.dayGames(year, kind).length;
  const sentN = St.storySentences(kind);
  const when = testWhen(g, day);
  // F9: a Step by step child's lines are 8 words or fewer ("Day 3 of 5 · test on Saturday", "All done. Test tomorrow.")
  const dayLine = sbs ? 'Day ' + dayNumber(g, day) + ' of ' + weekLength(g) + ' · test ' + (/^[A-Z][a-z]+day$/.test(when) ? 'on ' : '') + when
    : 'Day ' + dayNumber(g, day) + ' of ' + weekLength(g) + ' · your test is on ' + when;
  const shortLine = kind !== 'full' && day < g.test ? { quick: 'Quick', short: 'Short' }[kind] + ' week: test on ' + W.dayLabel(g.test) + '.' : '';
  const out = (o) => ({ line: shortLine, jobs: jobs.length, ...o });
  if (st.status === 'job') {
    const step = st.steps.find((x) => x.id === st.job);
    if (st.catchUp) {
      const n = Math.max(st.waiting, 1);
      return out({ line: '', sub: n + (n === 1 ? ' job is' : ' jobs are') + ' waiting. Do one now.', big: 'Do the next job', bigSub: plural(n, 'job') + ' waiting', to: 'job' });
    }
    if (st.job === 'test') {
      return out({ line: '', sub: g.test === day ? 'Test day! Your test is today.' : 'Your test is ready.', big: testStarted ? 'Carry on with the test' : 'Do your test', bigSub: plural(g.words.length, 'word') + ' · you can do it', to: 'job' });
    }
    if (jobs.length > 1) {
      const names = thenList(jobs.map((s) => s.title));
      const games = jobs.some((s) => s.id === 'games');
      const sub = sbs ? (kind === 'quick' ? 'Quick week: ' : 'Today: ') + jobs.length + ' jobs.' : kind === 'quick'
        ? 'Quick week: ' + jobs.length + ' jobs today, test on ' + W.dayLabel(g.test) + '.' + (games ? ' Game day has ' + plural(gamesN, 'game') + '.' : '')
        : 'Today: ' + jobs.length + ' jobs.' + (games && kind === 'short' ? ' Game day: ' + plural(gamesN, 'game') + '.' : '');
      return out({ line: kind === 'quick' ? '' : shortLine, sub, big: 'Do today’s jobs', bigSub: names, to: 'job' });
    }
    if (st.job === 'games' && sbs) { // F7: the Meanings stone, under its own name (the Usual way's Game day counts games a Step by step child does not play)
      return out({ sub: kind === 'full' ? dayLine : 'Your test is on ' + when + '.', big: step.title, bigSub: step.line, to: 'job' });
    }
    if (st.job === 'games') {
      return out({ sub: kind === 'full' ? dayLine : 'Game day: ' + plural(gamesN, 'game') + ' with your words.', big: 'Game day', bigSub: plural(gamesN, 'game') + ' · about ' + (GAME_MINUTES[gamesN] || 10) + ' minutes', to: 'job' });
    }
    return out({ sub: kind === 'full' ? dayLine : 'Your test is on ' + when + '.', big: 'Do today’s job', bigSub: jobLabel(step, { games: gamesN, sentences: sentN }), to: 'job' });
  }
  const WB = { big: 'Play Wordbright', to: 'wordbright' };
  if (st.status === 'done') {
    if (score) {
      const missed = score.of - score.right;
      return out({ line: '', sub: 'Test done: ' + score.right + ' of ' + score.of + '. Well done!', ...(missed ? { big: 'Practise the ' + plural(missed, 'test word'), bigSub: 'Words you missed today', to: 'tricky' } : { ...WB, bigSub: 'You did them all' }) });
    }
    return out({ line: '', sub: finishedLine || 'Today’s job is done. See you tomorrow!', ...WB, bigSub: 'A word game to enjoy' });
  }
  if (st.status === 'rest') return out({ line: '', sub: 'No job today. Have a rest.', big: 'Pick words', bigSub: 'Choose words to practise', to: 'practice' });
  if (st.status === 'ready') return out({ line: '', sub: (sbs ? 'All done. Test ' : 'Every job this week is done. Your test is ') + (W.daysBetween(day, g.test) === 1 ? 'tomorrow' : 'on ' + W.dayLabel(g.test)) + '.', ...WB, bigSub: 'You earned it' });
  return out({ line: '', sub: 'Your week is finished. Your grown-up will set your next week.', big: 'Pick words', bigSub: 'Choose words to practise', to: 'practice' });
}

/** One tile: Practice, Words to practise again, a week's own pages. `lock` draws it shut with its reason; `still` is a row with no link. */
export function tileHtml({ href = '', icon = '', title, sub = '', lock = false, first = false, still = false, button = false, attr = '' }) {
  const body = (icon ? '<span class="sheetrow__ico">' + icon + '</span>' : '') + '<span class="sheetrow__text"><b>' + esc(title) + '</b>' + (sub ? '<span class="tile__sub">' + esc(sub) + '</span>' : '') + '</span>';
  if (lock) return '<div class="sheetrow tile tile--lock" aria-disabled="true"' + attr + '>' + body + '<span class="sheetrow__go" aria-hidden="true">' + ICON.lock + '</span></div>';
  if (button) return '<button type="button" class="sheetrow tile"' + attr + '>' + body + '<span class="sheetrow__go" aria-hidden="true">' + SVG.chevron + '</span></button>';
  if (still || !href) return '<div class="sheetrow tile tile--still"' + attr + '>' + body + '</div>';
  return '<a class="sheetrow tile' + (first ? ' tile--first' : '') + '" href="' + esc(href) + '"' + attr + '>' + body + '<span class="sheetrow__go" aria-hidden="true">' + SVG.chevron + '</span></a>';
}

/* app.js hands over the shared Voice part of the look menu, so Settings can offer the same choices. */
let tools = { voice: () => null, speaker: () => null };
export const useChildTools = (t) => { tools = { ...tools, ...t }; };

/* ----------------------------------------------------------------- saved --- */
let savedPending = false;
/** "Stop for now" was pressed: the home says "Your place is saved." once. */
export const markSaved = () => { savedPending = true; };
const takeSaved = () => { const s = savedPending; savedPending = false; return s; };

/* ---------------------------------------------------------- statements --- */
// SB5 (TR-105 6.7): a child's device may fetch the statements for the week's words once a day, when the grown-up's account allows it.
// SENTENCES_API ships false in sentences-data.js, so today this makes no request at all; the cache it fills is `sb.st:<playerId>`.
let sentencesClient = null;
export function warmStatements(words, { origin = '', storage = null, playerId = '', now = Date.now() } = {}) {
  try {
    if (!SENT.SENTENCES_API || !origin || !playerId || !storage) return Promise.resolve(false);
    const cache = SENT.readCache(storage, playerId);
    const need = SENT.needFetch(cache, words, now);
    if (!need.length) return Promise.resolve(false);
    if (!sentencesClient) sentencesClient = SENT.createSentences({ origin });
    return sentencesClient.fetchFor(need).then((r) => {
      if (!r || r.problem) return false;
      return SENT.writeCache(storage, playerId, SENT.mergeCache(cache, need, r.items || {}, now));
    }).catch(() => false);
  } catch (e) { return Promise.resolve(false); }
}

/** The four quiet links under Today (07a): they sit below the bottom 110 px a phone's browser bar covers (child.css), so the main button and tiles end above it. */
export const FOOT_LINKS = [
  { href: 'https://learning.waystead.co.uk/packs', text: 'Waystead Learning papers' },
  { href: 'https://waystead.co.uk', text: 'Spellbright is part of Waystead' },
  { href: '#/about', text: 'For parents' },
  { href: '../', text: 'More games' },
];
/** The grown-up's name from the device's own cache when the words value has none yet (first paint on a cold start); remembered whenever the value has it. */
function byCached(setup) {
  const id = S.currentPlayer();
  const key = id ? 'sb.by:' + id : '';
  try {
    const n = setup && setup.by && typeof setup.by.n === 'string' ? setup.by.n : '';
    if (key && n) localStorage.setItem(key, n);
    return C.setupWithBy(setup, key && !n ? localStorage.getItem(key) : '');
  } catch (e) { return setup || {}; }
}
const todayFoot = () => '<nav class="wrap page today__foot" aria-label="More from Waystead" data-todayfoot>' + FOOT_LINKS.map((l) => '<a href="' + esc(l.href) + '">' + esc(l.text) + '</a>').join('') + '</nav>';

/* ------------------------------------------------------------------ home --- */
export function childHome(main) {
  const d = S.readWords();
  const day = today();
  const pick = C.weekChoice(d, day, getWeek());
  if (pick.stale) setWeek(''); // the saved week is finished, gone or reset: the home shows its own pick
  const r = St.roomState(d, day, pick.group);
  const g = r.group;
  const setupNow = S.readSetup();
  const sbsWay = Su.wayOf(setupNow) === 'sbs';
  const st = g ? namedState(St.studyState(d, g, day), setupNow) : null;
  const year = childYear();
  const testStarted = !!(g && r.step && r.step.id === 'test' && W.testLeft(d, g).length < g.words.length); // stopped part-way: no word is named
  const jobs = g && st ? todayJobs(d, g, day, st) : [];
  const done = g && st ? st.steps.find((x) => x.id === 'test') : null;
  const results = g && done && done.state === 'done' && St.doneDay(d, g, 'test') === day ? W.testResults(d, g) : [];
  const score = results.length ? { right: results.filter((x) => x.result.right).length, of: results.length } : null;
  const t = todayText({ g, st, day, year, jobs, testStarted, sbs: sbsWay, score: st && st.status === 'done' ? score : null,
    finishedLine: sbsWay && SD.afterTime(setupNow, hhmmNow()) ? 'Spelling is finished for today.' : '' });
  const locked = St.dueGroups(d, day).length > 0; // a test is due: Practice, Words to practise again and Games stay shut until it is done
  const tricky = S.trickyWords().length;
  const setBy = g ? C.setByLine(g.id, byCached(S.readSetup())) : '';
  const href = { job: g && r.step ? stepHref(d, g, r.step.id, day) : '#/chapters', wordbright: '../wordbright/', practice: '#/chapters', tricky: '#/tricky' }[t.to];
  const attr = t.to === 'job' ? ' data-job' : t.to === 'wordbright' ? ' data-wordbright' : '';
  const name = firstName(playerName());
  const weekLine = pick.canSwitch
    ? '<div class="weekline"><p class="weekline__name">Week: <b>' + esc(g.name) + '</b></p><button type="button" class="btn btn--quiet weekline__change" data-week-change aria-haspopup="dialog">Change</button></div>' : '';
  const shortLine = t.line ? '<p class="today__week" data-shortweek><b>' + esc(t.line.split(':')[0]) + ':</b>' + esc(t.line.slice(t.line.indexOf(':') + 1)) + '</p>' : '';
  // Things waiting: another week's test, a job in another week, a Big test. One shows as a row; two or more behind one row and a sheet.
  const things = [];
  const due = pick.due[0];
  if (due) things.push({ id: 'test', text: 'Your test for ' + due.name + ' is ready', sub: 'Do it when you like', href: groupHref(due.id) + '/test', attr: ' data-taketest' });
  else if (pick.next) things.push({ id: 'week', text: pick.next.name + ' has a job waiting', sub: 'Go to that week', week: pick.next.id, attr: ' data-nextweek' });
  const exam = St.dueGroups(d, day).length === 0 ? C.examLine(S.readSetup(), S.readDoc(), day, year, S.helpNow(year).pf) : null;
  if (exam) things.push({ id: 'exam', text: exam.line, sub: 'Start it when you are', href: exam.href, attr: ' data-examrow' });
  const thing = (x) => (x.week
    ? '<button type="button" class="sheetrow tile" data-go-week="' + esc(x.week) + '"' + x.attr + '><span class="sheetrow__text"><b>' + esc(x.text) + '</b><span class="tile__sub">' + esc(x.sub) + '</span></span><span class="sheetrow__go" aria-hidden="true">' + SVG.chevron + '</span></button>'
    : '<a class="sheetrow tile" href="' + esc(x.href) + '"' + x.attr + '><span class="sheetrow__text"><b>' + esc(x.text) + '</b><span class="tile__sub">' + esc(x.sub) + '</span></span><span class="sheetrow__go" aria-hidden="true">' + SVG.chevron + '</span></a>');
  const thingsHtml = things.length === 1 ? '<div class="today__things">' + thing(things[0]) + '</div>'
    : things.length > 1 ? '<div class="today__things"><button type="button" class="sheetrow tile" data-things aria-haspopup="dialog"><span class="sheetrow__text"><b>' + things.length + ' things waiting</b></span><span class="sheetrow__go" aria-hidden="true">' + SVG.chevron + '</span></button></div>' : '';
  const back = r.hideWords ? '' : (r.comeBack || []).map((x) => '<a class="linkbtn" href="' + comeBackHref(g, x.word, x.flow) + '" data-comeback>Come back to this: ' + esc(x.word) + '</a>').join('');
  const stones = g && st ? '<a class="seeweek" href="' + groupHref(g.id) + '/path" data-pathcard aria-label="See my week">' + stonesHtml(st.steps, day) + '</a>' : '';
  const say = [t.line, t.sub, t.big + '.', t.bigSub].filter(Boolean).join(' ');
  const practiceTile = tileHtml({ href: '#/chapters', icon: SVG.practice, title: 'Practice', sub: g ? 'Year chapters and lists, any time' : 'Year chapters, one at a time', lock: locked && !!g, ...(locked && g ? { sub: 'Opens after your test' } : {}) });
  const showTricky = !!g && st.status !== 'finished' && !(score && !t.big.startsWith('Practise the'));
  const trickyTile = showTricky ? tileHtml({ href: '#/tricky', icon: SVG.again, title: 'Words to practise again', sub: locked ? 'Opens after your test' : tricky ? plural(tricky, 'word') : 'None yet', lock: locked }) : '';
  main.innerHTML = '<section class="wrap page room childhome today" data-room="' + r.status + '">'
    + (takeSaved() ? '<p class="savedline" role="status" data-saved>' + C.SAVED_LINE + '</p>' : '')
    + '<div class="today__l"><div class="today__head"><p class="eyebrow">' + esc(C.weekdayName(day) + (setBy ? ' · ' + setBy : '')) + '</p>'
    + '<h1 class="today__hello">' + (name ? 'Hello, ' + esc(name) + '!' : 'Hello!') + '</h1></div>'
    + (sbsWay && g ? '<p class="sbs-tag" data-sbs-tag>Step by step</p>' : '') + weekLine + shortLine + stones
    + '<div class="today__subrow"' + (st && st.catchUp ? ' data-catchup' : '') + '><p class="today__sub">' + esc(t.sub) + '</p>'
    + '<button type="button" class="btn btn--ghost hearit hearit--icon" data-hear title="Read it to me" aria-label="Read it to me: ' + esc(t.sub) + '">' + SVG.say + '<span class="hearit__t">Read it to me</span></button></div>'
    + thingsHtml + (back ? '<div class="comeback">' + back + '</div>' : '') + '</div>'
    + '<div class="today__r"><a class="btn btn--primary btn--hero today__big" href="' + esc(href) + '"' + attr + '>' + SVG.play + '<span class="today__bigtext"><b>' + esc(t.big) + '</b><small>' + esc(t.bigSub) + '</small></span></a>'
    + practiceTile + trickyTile + '</div></section>' + todayFoot();
  main.querySelector('[data-hear]').addEventListener('click', () => sayLine(say));
  const change = main.querySelector('[data-week-change]');
  if (change) change.addEventListener('click', () => openWeeks(change, pick.weeks, (id) => { setWeek(id); if (!change.isConnected) return; childHome(main); const b = main.querySelector('[data-week-change]'); if (b) b.focus(); }));
  const goWeek = main.querySelector('[data-go-week]');
  if (goWeek) goWeek.addEventListener('click', () => { setWeek(goWeek.dataset.goWeek); childHome(main); const b = main.querySelector('[data-week-change]'); if (b) b.focus(); });
  const many = main.querySelector('[data-things]');
  if (many) many.addEventListener('click', () => openSheet(many, { title: things.length + ' things waiting', cls: 'thingssheet', body: things.map(thing).join(''), onPick: (el) => {
    const w = el.closest('[data-go-week]');
    if (w) { setWeek(w.dataset.goWeek); childHome(main); const b = main.querySelector('[data-week-change]'); if (b) b.focus(); }
  } }));
  const saved = main.querySelector('[data-saved]');
  if (saved) setTimeout(() => saved.remove(), 6000);
  if (g) warmStatements(g.words, { origin: accountOrigin(location), storage: (() => { try { return localStorage; } catch (e) { return null; } })(), playerId: S.currentPlayer() || '' });
  return () => stop();
}

/* ------------------------------------------------------------ My week --- */
/**
 * The rows of My week (07n, 07n2): one for each day that holds a job (a short week puts 2 or 3 jobs on one day), then the test day and Mend and keep.
 * -> [{ id, state: 'done' | 'today' | 'waiting' | 'later', title, sub, step }]; `step` is the job to open (today's, or a done one to do again), else null.
 */
export function weekRows(d, g, day, st, year) {
  const kind = St.weekKind(g);
  const gamesN = G.dayGames(year, kind).length;
  const sentN = St.storySentences(kind);
  const paren = (s) => (s.id === 'games' ? s.title + ' (' + plural(gamesN, 'game') + ')' : s.id === 'story' ? s.title + ' (' + plural(sentN, 'sentence') + ')' : s.title);
  const groups = dayGroups(st.steps);
  const multi = groups.some((x) => x.steps.length > 1);
  return groups.map((grp) => {
    const steps = grp.steps;
    const s = steps[0];
    const state = steps.every((x) => x.state === 'done') ? 'done' : steps.some((x) => x.state === 'today') ? 'today' : steps.some((x) => x.state === 'waiting') ? 'waiting' : 'later';
    const step = steps.find((x) => x.state === 'today') || steps.find((x) => x.state === 'waiting') || steps.find((x) => x.state === 'done' && St.canOpen(d, g, x.id, day)) || null;
    const when = W.dayParts(grp.day)[0];
    if (steps.length > 1) {
      return { id: s.id, state, step, title: when + ' · ' + plural(steps.length, 'job'),
        sub: state === 'done' ? steps.map((x) => x.title).join(', ') + ' · done · Do it again' : steps.map(paren).join(', ') };
    }
    const name = s.id === 'test' ? 'Test day' : s.title;
    const title = (multi ? '' : 'Day ' + s.n + ' · ') + when + ' · ' + name;
    let sub;
    if (s.id === 'test') sub = (state === 'done' ? 'Done · ' : 'Your test · ') + W.dayLabel(s.date);
    else if (s.id === 'mend') sub = 'Words to practise again';
    else if (state === 'done') sub = 'Done' + (s.id === 'games' ? ' · ' + plural(gamesN, 'game') : '') + ' · Do it again';
    else if (state === 'today' || state === 'waiting') sub = s.id === 'games' ? 'Today: ' + plural(gamesN, 'game') + ' with your words' : s.id === 'story' ? 'Today: ' + plural(sentN, 'sentence') : 'Today’s job';
    else sub = 'Not yet' + (s.id === 'story' ? ' · ' + plural(sentN, 'sentence') : '');
    return { id: s.id, state, step, title, sub };
  });
}

/* ------------------------------------------------------------------ path --- */
export function pathPage(main, { gid }) {
  const d = S.readWords();
  const g = W.groupById(d, safeDecode(gid));
  if (!g) { location.replace('#/'); return undefined; }
  const day = today();
  const st = namedState(St.studyState(d, g, day), S.readSetup());
  const year = childYear();
  const kind = St.weekKind(g);
  const setBy = C.setByLine(g.id, byCached(S.readSetup()));
  const icon = { done: TICK, today: SVG.playc, waiting: SVG.clock, later: SVG.cal };
  const rows = weekRows(d, g, day, st, year).map((x) => {
    const live = x.step && (x.state === 'today' || x.state === 'waiting');
    const body = { href: x.step ? stepHref(d, g, x.step.id, day) : '', icon: x.id === 'test' ? SVG.flag : x.id === 'mend' ? SVG.again : icon[x.state], title: x.title, sub: x.sub, first: live };
    return '<li class="pathrow2 pathrow2--' + x.state + '">' + tileHtml({ ...body, attr: x.step ? (live ? ' data-job data-step="' : ' data-again="') + x.step.id + '"' : '' }) + '</li>';
  });
  const sbsWay = Su.wayOf(S.readSetup()) === 'sbs';
  const dayBit = kind !== 'full' ? { quick: 'Quick week', short: 'Short week' }[kind] : 'Day ' + dayNumber(g, day) + ' of ' + weekLength(g);
  // F9: a Step by step child reads two short lines ("Day 5 of 5 · test Sat 7 Nov", "20 stars · Set by Sam"), each 8 words or fewer
  const sub = sbsWay ? [dayBit, 'test ' + W.dayLabel(g.test)].join(' · ')
    : [setBy, dayBit, C.starsText(St.weekStars(d, g)) + ' so far', 'your test is on ' + W.dayLabel(g.test)].filter(Boolean).join(' · ');
  const sub2 = sbsWay ? [C.starsText(St.weekStars(d, g)), setBy].filter(Boolean).join(' · ') : '';
  main.innerHTML = '<section class="wrap page childpath" data-path>'
    + '<div class="pagehead"><span class="eyebrow">' + esc(g.name) + ' · ' + plural(g.words.length, 'word') + '</span>'
    + '<div class="instruct"><h1>My week</h1><button type="button" class="hearround" data-hear aria-label="Hear it">' + SVG.hear + '</button></div></div>'
    + '<div class="path__top">' + stonesHtml(st.steps, day) + '<p class="path__sub">' + esc(sub) + '</p>' + (sub2 ? '<p class="path__sub">' + esc(sub2) + '</p>' : '') + '</div>'
    + '<ol class="pathlist" aria-label="My week">' + rows.join('') + '</ol></section>';
  main.querySelector('[data-hear]').addEventListener('click', () => sayLine('My week. ' + sub + '. ' + (sub2 ? sub2 + '. ' : '') + 'Tap today\'s job to start.'));
  return () => stop();
}

/* -------------------------------------------------------------- settings --- */
const chipLink = (item) => { const a = document.querySelector('#player-slot [data-item="' + item + '"]'); return a ? a.getAttribute('href') : ''; };
/** The Voice choices the look menu holds (shared/voice), as plain radio buttons. */
function voiceChoices() {
  const vm = tools.voice();
  const hidden = document.querySelector('#theme-menu [data-voice-part]');
  if (!vm || !hidden || hidden.hidden) return [];
  return vm.items().filter((it) => it.dataset.voice !== MORE).map((it) => ({ id: it.dataset.voice, label: it.textContent.replace(/\s+/g, ' ').trim(), on: it.getAttribute('aria-checked') === 'true', off: it.getAttribute('aria-disabled') === 'true' }));
}
const radios = (list, attr) => list.map((c) => '<button type="button" class="choice" role="radio" aria-checked="' + c.on + '" tabindex="' + (c.on ? 0 : -1) + '" ' + attr + '="' + esc(c.id) + '"' + (c.off ? ' aria-disabled="true"' : '') + '>' + esc(c.label) + '</button>').join('');
/** The Voice card: the shared list as radios, "Add more voices" when the menu offers it, and the menu's own tip line. */
export function voiceCardHtml() {
  const vs = voiceChoices();
  if (!vs.length) return '';
  const vm = tools.voice();
  const more = vm.items().find((it) => it.dataset.voice === MORE);
  const tip = document.querySelector('#theme-menu [data-voice-tip]');
  const line = tip && !tip.hidden ? tip.textContent.trim() : '';
  return '<h2 id="voice-h">Voice</h2><div class="choices" role="radiogroup" aria-labelledby="voice-h" data-voices>' + radios(vs, 'data-voice') + '</div>'
    + (more ? '<button type="button" class="linkbtn" data-more aria-expanded="' + more.getAttribute('aria-expanded') + '">Add more voices</button>' : '')
    + (line ? '<p class="small muted" data-voicetip>' + esc(line) + '</p>' : '');
}
// Arrow keys move through a group of radios and choose as they go.
export function roving(box, attr, pick) {
  box.addEventListener('keydown', (e) => {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (!keys[e.key]) return;
    const all = [...box.querySelectorAll('[' + attr + ']')];
    const i = all.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    pick(all[(i + keys[e.key] + all.length) % all.length]);
  });
}

/** The voice menu and speaker app.js gave us (the grown-up's account panel shares the Voice card). */
export const childTools = () => tools;

/** "Garden / Paint / Night / Match device": the four looks, as the short names 06d and 10d draw them. */
export const LOOK_NAMES = { garden: 'Garden', paint: 'Paint', night: 'Night', system: 'Match device' };
/** The Look radios (the same four choices as the look menu): a segmented row, shared by Look and voice (10d) and the About page (06d). */
export function lookHtml(labelledBy = 'look-h') {
  const list = CHOICES.map((c) => ({ id: c.id, label: LOOK_NAMES[c.id] || c.short, on: c.id === currentChoice() }));
  return '<div class="choices choices--look" role="radiogroup" aria-labelledby="' + labelledBy + '" data-looks>' + radios(list, 'data-choice') + '</div>';
}
/** Wire the Look radios inside `root` (click and arrow keys); follows a change made elsewhere. Answers the clean-up. */
export function wireLook(root) {
  const box = root.querySelector('[data-looks]');
  if (!box) return () => {};
  const redraw = () => { const cur = root.querySelector('[data-looks]'); if (!cur) return; const keep = document.activeElement && document.activeElement.dataset.choice; cur.outerHTML = lookHtml(cur.getAttribute('aria-labelledby')); if (keep) { const b = root.querySelector('[data-looks] [data-choice="' + keep + '"]'); if (b) b.focus(); } };
  const pickLook = (b) => { choose(b.dataset.choice); announce(); redraw(); };
  root.addEventListener('click', (e) => { const b = e.target.closest('[data-looks] [data-choice]'); if (b && root.contains(b)) pickLook(b); });
  root.addEventListener('keydown', (e) => {
    const cur = document.activeElement;
    if (!cur || !cur.closest || !cur.closest('[data-looks]')) return;
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (!keys[e.key]) return;
    const all = [...root.querySelectorAll('[data-looks] [data-choice]')];
    const i = all.indexOf(cur);
    if (i < 0) return;
    e.preventDefault();
    const nb = all[(i + keys[e.key] + all.length) % all.length];
    nb.focus();
    pickLook(nb);
  });
  const follow = () => { if (root.isConnected && root.querySelector('[data-looks]')) redraw(); }; // the look changed elsewhere: Match device
  document.addEventListener('sb:look', follow);
  return () => document.removeEventListener('sb:look', follow);
}

/** "Menu" above Settings and Look and voice (10c, 10d): goes to Today and opens the Menu again. */
function menuBackLink(main) {
  main.querySelector('[data-backlink]').addEventListener('click', (e) => {
    e.preventDefault();
    location.hash = '#/';
    setTimeout(() => { const m = $('child-menu'); if (m && !m.hidden) m.click(); }, 80);
  });
}

/** Settings (10c): switch player, Grown-ups, My account, Sign out, and About and licence. Look and voice has its own page (10d). */
export function settingsPage(main) {
  const swi = chipLink('switch');
  const acc = chipLink('account');
  const out = chipLink('out');
  const row = (href, id, title, sub) => '<a class="card setrow" href="' + esc(href) + '" data-' + id + '><span><strong>' + title + '</strong>' + (sub ? '<br><span class="muted small">' + sub + '</span>' : '') + '</span>' + ICON.arrow + '</a>';
  main.innerHTML = '<section class="wrap page childsettings" data-settings><div class="pagehead">' + backLink('Menu') + '<h1>Settings</h1></div>'
    + (swi ? row(swi, 'switch', 'Switch player', 'Who is playing?') : '')
    + row('#/grownups', 'grownups', 'Grown-ups', 'Ask a grown-up to sign in')
    + (acc ? row(acc, 'account', 'My account', 'Your name and year') : '')
    + (out ? row(out, 'signout', 'Sign out', '') : '')
    + '<details class="card setting about" data-about><summary>About and licence</summary><div class="about__body">'
    + '<p><a href="#/about"><b>For parents</b><br><span class="muted small">How Spellbright works</span></a></p>'
    + '<p><a href="https://waystead.co.uk"><b>Waystead</b><br><span class="muted small">Who makes Spellbright</span></a></p>'
    + '<p><a href="../"><b>More games</b><br><span class="muted small">All Waystead games</span></a></p>'
    + '<p class="small muted">Some words and facts come from UK Government material under the Open Government Licence v3.0.</p></div></details>'
    + '<p class="small devlink"><a href="#/device" data-devicelink>About this device</a></p></section>';
  menuBackLink(main);
  return () => stop();
}

/** Look and voice (10d): the four looks, then the voice choices with Hear a sample, and the reading speed. */
export function lookVoicePage(main) {
  const voices = voiceCardHtml();
  main.innerHTML = '<section class="wrap page childsettings childlook" data-looksettings><div class="pagehead">' + backLink('Menu') + '<h1>Look and voice</h1></div>'
    + '<div class="card setting"><h2 id="look-h">Look</h2>' + lookHtml('look-h') + '</div>'
    + '<div class="card setting" data-voicecard' + (voices ? '' : ' hidden') + '><div data-voiceslot>' + voices + '</div>'
    + '<button type="button" class="btn btn--ghost" data-sample>' + SVG.hear + 'Hear a sample</button></div></section>';
  menuBackLink(main);
  const unlook = wireLook(main);
  // The voices can come in after the page is drawn (iPad Safari lists them once the page is up): draw the card again when they do.
  const vcard = main.querySelector('[data-voicecard]');
  const slot = vcard.querySelector('[data-voiceslot]');
  const drawVoices = () => {
    if (!vcard.isConnected) return;
    const keep = slot.contains(document.activeElement) ? (document.activeElement.dataset.voice || (document.activeElement.hasAttribute('data-more') ? '+more' : null)) : null;
    const html = voiceCardHtml();
    slot.innerHTML = html;
    vcard.hidden = !html;
    if (keep !== null) { const b = slot.querySelector(keep === '+more' ? '[data-more]' : '[data-voice="' + CSS.escape(keep) + '"]'); if (b) b.focus(); }
  };
  const pickVoice = (b) => { if (b.getAttribute('aria-disabled') === 'true') return; tools.voice().pick(b.dataset.voice); drawVoices(); };
  vcard.addEventListener('click', (e) => {
    const b = e.target.closest('[data-voice]');
    if (b) { pickVoice(b); return; }
    if (e.target.closest('[data-more]')) { tools.voice().pick(MORE); drawVoices(); return; }
    if (e.target.closest('[data-sample]')) sayLine('Hello! This is how I sound.');
  });
  roving(vcard, 'data-voice', (b) => { b.focus(); pickVoice(b); });
  const sp = tools.speaker();
  const unvoice = sp && sp.onVoices ? sp.onVoices(drawVoices) : null;
  return () => { unlook(); if (unvoice) unvoice(); stop(); };
}

/* ------------------------------------------------------------- Menu sheet --- */
let sheet = null;
export function closeMenu(returnFocus = true) {
  if (!sheet) return false;
  const { root, opener, undo } = sheet;
  sheet = null;
  undo();
  root.remove();
  stop();
  if (returnFocus && opener && opener.isConnected) opener.focus();
  return true;
}

/** The shared bottom sheet: a title, Close, rows; the page behind cannot be reached; Escape closes; Tab stays inside. onPick(el) sees every tap on a row. */
export function openSheet(opener, { title, body, cls = '', onPick = null, hearLine = '' }) {
  if (sheet) return;
  const root = document.createElement('div');
  root.className = 'sheetlayer';
  root.innerHTML = '<div class="sheetback" data-sheet-back></div>'
    + '<div class="sheet' + (cls ? ' ' + cls : '') + '" id="child-sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title"><span class="sheet__grip" aria-hidden="true"></span>'
    + '<div class="sheet__head"><h2 id="sheet-title">' + esc(title) + '</h2><button type="button" class="btn btn--ghost sheet__close" data-close><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>Close</button></div>'
    + '<div class="sheet__rows">' + body + '</div></div>';
  document.body.append(root);
  // The page behind can't be reached: no tab, no tap, nothing read out.
  const behind = [...document.body.children].filter((el) => el !== root && !el.matches('script, #toast'));
  behind.forEach((el) => el.setAttribute('inert', ''));
  const undo = () => behind.forEach((el) => el.removeAttribute('inert'));
  sheet = { root, opener, undo };
  const dlg = root.querySelector('.sheet');
  const close = () => closeMenu();
  root.querySelector('[data-close]').addEventListener('click', close);
  root.querySelector('[data-sheet-back]').addEventListener('click', close);
  root.addEventListener('click', (e) => {
    const hit = e.target.closest('a[href], button[data-week], button[data-go-week]');
    if (hit && onPick) { closeMenu(false); onPick(hit); return; }
    if (e.target.closest('a[href]')) closeMenu(false);
  });
  const hearBtn = root.querySelector('[data-hear-line]');
  if (hearBtn) hearBtn.addEventListener('click', () => sayLine(hearLine));
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...dlg.querySelectorAll('a[href], button:not([disabled])')];
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  root.querySelector('[data-close]').focus();
}

/**
 * The rows of the Menu (10, 10b): Today, Practice, This week's words, Words to practise again, My progress, Games, Settings.
 * While a test is due Practice, Words to practise again and Games are shut and say "Opens after your test".
 */
export function menuItems({ gid = '', wordsGid = '', hasGroup = false, gamesOpen = true, locked = false, tricky = 0 }) {
  const rows = [{ id: 'today', title: 'Today', sub: 'Your job for today', href: '#/', icon: SVG.home }];
  rows.push(locked ? { id: 'practice', title: 'Practice', sub: SHUT, closed: true, icon: SVG.practice } : { id: 'practice', title: 'Practice', sub: 'Extra words, any time', href: '#/chapters', icon: SVG.practice });
  if (hasGroup) rows.push({ id: 'words', title: 'This week’s words', sub: 'Job, results and quiz', href: wordsGid ? '#/words/g/' + encodeURIComponent(wordsGid) : '#/words', icon: SVG.list });
  rows.push(locked ? { id: 'tricky', title: 'Words to practise again', sub: SHUT, closed: true, icon: SVG.again } : { id: 'tricky', title: 'Words to practise again', sub: tricky ? plural(tricky, 'word') : 'None yet', href: '#/tricky', icon: SVG.again });
  rows.push({ id: 'progress', title: 'My progress', sub: 'Chapters you have passed', href: '#/progress', icon: SVG.eye });
  if (hasGroup) rows.push(gamesOpen ? { id: 'games', title: 'Games', sub: 'Quick games with your words', href: '#/words/g/' + encodeURIComponent(gid) + '/games', icon: SVG.games } : { id: 'games', title: 'Games', sub: SHUT, closed: true, icon: SVG.games });
  rows.push({ id: 'look', title: 'Look and voice', sub: 'Colours, reading aloud', href: '#/look', icon: SVG.look });
  rows.push({ id: 'settings', title: 'Settings', sub: 'Switch player, account, sign out', href: '#/settings', icon: SVG.settings, quiet: true });
  return rows;
}
const SHUT = 'Opens after your test';

export function openMenu(opener) {
  if (sheet) return;
  const d = S.readWords();
  const day = today();
  const pick = C.weekChoice(d, day, getWeek());
  const g = pick.group;
  const rows = menuItems({ gid: g ? g.id : '', wordsGid: pick.chosen && g ? g.id : '', hasGroup: !!g, gamesOpen: g ? St.gamesOpen(d, g, day) : false, locked: St.dueGroups(d, day).length > 0, tricky: S.trickyWords().length });
  const row = (x) => (x.closed
    ? '<div class="sheetrow sheetrow--closed" data-row="' + x.id + '" aria-disabled="true"><span class="sheetrow__ico">' + x.icon + '</span><span class="sheetrow__text"><b>' + x.title + '</b><span>' + esc(x.sub) + '</span></span>'
      + (x.id === 'games' ? '<button type="button" class="btn btn--quiet hearit" data-hear-line>' + SVG.hear + 'Hear it</button>' : '<span class="sheetrow__go" aria-hidden="true">' + ICON.lock + '</span>') + '</div>'
    : '<a class="sheetrow' + (x.quiet ? ' sheetrow--quiet' : '') + '" href="' + x.href + '" data-row="' + x.id + '"><span class="sheetrow__ico">' + x.icon + '</span><span class="sheetrow__text"><b>' + x.title + '</b><span>' + esc(x.sub) + '</span></span><span class="sheetrow__go" aria-hidden="true">' + SVG.chevron + '</span></a>');
  openSheet(opener, { title: 'Menu', cls: 'menusheet', body: rows.map(row).join(''), hearLine: C.GAMES_CLOSED });
}

/* ------------------------------------------------------- Which week? sheet --- */
/** The bottom sheet "Which week?": one big row per switchable week; one tap calls pick(id) and closes. Same pattern as the Menu sheet. */
function openWeeks(opener, weeks, pick) {
  const row = (w) => '<button type="button" class="sheetrow weekrow' + (w.current ? ' is-current' : '') + '" data-week="' + esc(w.id) + '"' + (w.current ? ' aria-current="true"' : '') + '>'
    + '<span class="sheetrow__text"><b>' + esc(w.name) + '</b><span>' + esc(w.by ? w.by + ' · ' + w.testLabel : w.testLabel) + '</span><span>' + esc(w.job) + '</span></span>'
    + (w.current ? '<span class="pill pill--done">Showing now</span>' : w.waiting ? '<span class="pill pill--warm">Jobs waiting</span>' : '') + '</button>';
  const setup = S.readSetup();
  const list = weeks.map((w) => ({ ...w, by: C.setByLine(w.id, byCached(setup)) }));
  openSheet(opener, { title: 'Which week?', cls: 'weeksheet', body: list.map(row).join(''), onPick: (el) => {
    const same = el.hasAttribute('aria-current');
    if (same) { if (opener.isConnected) opener.focus(); } else pick(el.dataset.week);
  } });
}

/* -------------------------------------------------------------- top bar --- */
const $ = (id) => document.getElementById(id);

/** Set the top bar for this page: 'home' (mark and Menu), 'page' (Back and Menu), 'job' (Stop for now and the job's name), or null (not a child). */
export function applyChrome(child, path, pending = false) {
  const body = document.body;
  document.documentElement.classList.remove('wa-pre');
  body.classList.toggle('is-pending', !child && pending); // the mark alone until the account says who this is
  const job = child && C.isJobPath(path);
  const mode = !child ? '' : job ? 'job' : path === '' ? 'home' : 'page';
  body.classList.toggle('is-child', !!child);
  ['home', 'page', 'job'].forEach((m) => body.classList.toggle('chrome-' + m, mode === m));
  $('child-menu').hidden = !(mode === 'home' || mode === 'page');
  $('child-back').hidden = mode !== 'page';
  $('child-stop').hidden = mode !== 'job';
  const brkBtn = $('child-break');
  if (brkBtn && mode !== 'job') brkBtn.hidden = true;
  const name = $('job-name');
  name.hidden = mode !== 'job';
  name.textContent = mode === 'job' ? C.jobTitle(path, S.readWords(), today(), { names: K.STONE_TEXT, sbs: (gid, step) => { const dd = S.readWords(); const gg = W.groupById(dd, safeDecode(gid)); return !!gg && K.wayFor(dd, gg, step, S.readSetup()) === 'sbs'; } }) : '';
  if (mode !== 'home' && mode !== 'page') closeMenu(false);
  const brand = document.querySelector('.brand');
  if (brand) brand.toggleAttribute('inert', mode === 'home'); // the mark links to the page you are on
}

/**
 * "Stop for now?" (11d): a sheet, not a straight exit. "Your place is saved. You can come back to word 3. If you stop, you go to Today."
 * A sentence half-written on Story day is only in the box: the sheet says so. Keep going closes it; Stop and go to Today leaves the job.
 */
export const stopLines = ({ word = 0, unsaved = false } = {}) => (unsaved
  ? ['Your sentence is not saved yet.', 'If you stop, it goes. You go to Today.']
  : ['Your place is saved.', (word ? 'You can come back to word ' + word + '. ' : 'You can come back later. ') + 'If you stop, you go to Today.']);
/** The word number on the page ("Word 3 of 10"), or 0. */
const wordOnPage = () => { const m = /Word (\d+) of \d+/.exec((document.querySelector('main') || { textContent: '' }).textContent); return m ? Number(m[1]) : 0; };
export function openStop(opener) {
  const box = document.getElementById('sentence');
  const lines = stopLines({ word: wordOnPage(), unsaved: !!(box && box.value.trim()) });
  openSheet(opener, { title: 'Stop for now?', cls: 'stopsheet', hearLine: lines.join(' '),
    body: '<p class="stop__line"><b>' + esc(lines[0]) + '</b> ' + esc(lines[1]) + '</p>'
      + '<div class="stop__btns"><button type="button" class="btn btn--primary btn--wide" data-keepgoing>Keep going</button>'
      + '<button type="button" class="btn btn--ghost btn--wide" data-stopnow>Stop and go to Today</button></div>' });
  const dlg = document.getElementById('child-sheet');
  if (!dlg) return;
  dlg.querySelector('[data-keepgoing]').addEventListener('click', () => closeMenu());
  dlg.querySelector('[data-stopnow]').addEventListener('click', () => { closeMenu(false); markSaved(); location.hash = '#/'; });
  dlg.querySelector('[data-keepgoing]').focus();
}

/** Step by step (WP-6): the runner's Break and Stop for the job bar. Stop is one tap with no sheet; Break appears beside it. */
let sbsHooks = null;
export function useSbsChrome({ stop: onStop, brk: onBreak }) {
  const hooks = { stop: onStop, brk: onBreak };
  sbsHooks = hooks;
  const stopBtn = document.getElementById('child-stop');
  let b = document.getElementById('child-break');
  if (stopBtn && !b) {
    b = document.createElement('button');
    b.type = 'button';
    b.id = 'child-break';
    b.className = 'childbtn childbtn--break';
    b.setAttribute('aria-label', 'Break');
    b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 9h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z"/><path d="M16 10h2a2 2 0 0 1 0 5h-2"/></svg><span class="childbtn__t">Break</span>';
    stopBtn.before(b);
    b.addEventListener('click', () => { if (sbsHooks && sbsHooks.brk) sbsHooks.brk(); });
  }
  if (b) b.hidden = false;
  return { release() { if (sbsHooks === hooks) sbsHooks = null; const x = document.getElementById('child-break'); if (x) x.hidden = true; } };
}

/** Wire the three buttons once. backTo(path) gives the usual one-level-up target. */
export function wireChrome({ currentPath, parentOf }) {
  $('child-menu').addEventListener('click', (e) => (sheet ? closeMenu() : openMenu(e.currentTarget)));
  $('child-back').addEventListener('click', () => { const p = currentPath(); location.hash = C.backTarget(p) || parentOf(p); });
  $('child-stop').addEventListener('click', (e) => (sbsHooks && sbsHooks.stop ? sbsHooks.stop() : openStop(e.currentTarget)));
  window.addEventListener('hashchange', () => closeMenu(false));
}
