// Grown-ups: the rules with no page in them. Pure; the date comes in as `today`.
// A plan is an ordinary word group, written into the child's own saved value,
// so everything else (Study mode, the grid, merging) treats it like any other.
// The numbers are all counted from the child's tries, as they are for the child.
import * as W from './words-doc.js';
import * as St from './study-doc.js';
import { trickyWords } from './progress-doc.js';
import * as PR from './progress-doc.js';
import * as Su from './setup-doc.js';
import * as A from './assess-doc.js';
import * as F from './front-doc.js';
import { switchUrl, accountUrl } from './account/config.js';
import { stoneView } from './child-doc.js';

/** Only an adult playing as themselves. A child, or an adult playing as one, never. */
export const canSeeGrownups = (kind) => kind === 'adult';

/** The account's "Who's playing?", coming back to this page. */
export const switchBackHref = (origin, here) => switchUrl(origin, here);
export const playingLine = (name) => 'You\'re playing as ' + (name || 'a child') + '. Switch back to yourself to plan and see progress.';

/** What each problem (grownups-data.js) says. */
export const PROBLEM_TEXT = {
  network: 'We can\'t reach Waystead just now. Check your connection, then try again.',
  busy: 'Waystead is busy just now. Please wait a moment, then try again.',
  'too-big': 'This child\'s saved words are full. Please try a shorter plan, or ask us for help.',
  'signed-out': 'You\'ve been signed out. Please sign in again.',
  'no-child': 'That child isn\'t on your account.',
  playing: 'You\'re playing as a child. Switch back to yourself first, then try again.',
  other: 'Something went wrong on our side. Please try again.',
};

/** What a plan will do, before it's saved. */
export function preview(d, { name, test, words }, today) {
  const r = W.createGroup(d, { id: 'preview', name, test, words, today, now: 1 });
  if (r.error) return { error: r.error };
  const g = W.groupById({ ...r.doc, resetAt: 0 }, 'preview');
  return { name: g.name, test: g.test, words: g.words, back: g.back, steps: St.studyState(r.doc, g, today).steps, squeezed: W.daysBetween(g.start, g.test) < St.BEFORE_TEST.length };
}
export const createPlan = (d, plan, { id, today, now }) => W.createGroup(d, { id, name: plan.name, test: plan.test, words: plan.words, today, now });
export const editPlan = (d, gid, plan, { today, now }) => W.editGroup(d, gid, plan, today, now);

/** The words a pattern offers, up to a group's worth. */
export const patternWords = (patterns, id) => ((patterns.find((p) => p.id === id) || { words: [] }).words).slice(0, W.MAX_WORDS);
export const childTricky = (progress) => trickyWords(progress).map((t) => t.word);

export function groupReport(d, g, today) {
  const p = W.groupProgress(d, g);
  const dots = new Map(W.allDots(d, g, today).map((x) => [x.word, x.dots]));
  const comeBack = W.comeBack(d, g, today).map((x) => x.word);
  const inARow = (w) => Math.max(...['p', 'x', 'f'].map((flow) => W.sessionCount(d, g, w, today, flow))); // today, in any flow
  const s = St.studyState(d, g, today);
  const test = W.testResults(d, g).filter((x) => x.result);
  return {
    id: g.id, name: g.name, start: g.start, testDate: g.test, canEdit: W.canEdit(d, g),
    status: s.status, job: s.job ? St.STEP_TEXT[s.job].title : '',
    steps: s.steps,
    // Jobs whose date has gone, still to do (before the test is taken); testWaits: the test date has come, so the test waits for them.
    waiting: today < g.test || s.catchUp ? s.waiting : 0, testWaits: s.catchUp,
    ready: W.readyForTest(d, g),
    words: p.words.map((x) => ({ word: x.word, back: x.back, status: x.status, tries: x.tries, peeks: x.peeks, dots: dots.get(x.word), today: inARow(x.word), comeBack: comeBack.includes(x.word) })),
    comeBack,
    test: { taken: test.length, right: test.filter((x) => x.result.right).length, of: g.words.length, rows: test.map((x) => ({ word: x.word, right: x.result.right })) },
    stars: p.stars, of: p.of,
    sentences: W.notesFor(d, g).map((x) => ({ word: x.w, text: x.x, day: x.d })),
  };
}

/** Everything the dashboard shows for one child. */
export function dashboard(d, today) {
  const g = St.studyGroup(d, today);
  const o = W.overall(d);
  const clues = Object.entries(d.clues).filter(([, c]) => c.t).map(([word, c]) => ({ word, clue: c.t })).sort((a, b) => a.word.localeCompare(b.word));
  return {
    current: g ? groupReport(d, g, today) : null,
    others: W.liveGroups(d).filter((x) => !g || x.id !== g.id).map((x) => groupReport(d, x, today)),
    remembered: o.remembered, practised: o.practised, independent: o.independent, firstGoes: o.firstGoes, clean: o.clean,
    clues,
  };
}

/* ===================================================================================
   SB3-C2: the garden-path Grown-ups screens. Everything below is pure and counted
   from data the app already keeps (the tries, the jobs done, the groups): nothing
   new is stored, and nothing is guessed.
   =================================================================================== */

// ---- word status ----------------------------------------------------------------
export const STATUS_LABEL = { got: 'Got it', getting: 'Getting there', help: 'Needs help', new: 'Not started' };
export const STATUS_KEY = 'Got it: 3 in a row done. Getting there: practised, not yet 3 in a row. Needs help: 2 or more wrong letters or a peek in the latest practice, or a slip in the test. Not started: no tries yet.';
const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : n + ' times');

/**
 * One word's status and its reason.
 *   dots     the 3-in-a-row count the app shows (W.dots)
 *   tries    wrong letters so far (the app counts letters, not goes), peeks  peeks so far
 *   slipped  wrong in the test and still to fix; passed  right in the test or remembered
 *   any      the word has been tried at all
 *   assisted (SB4) every try that counted used letter tiles (levels 1 to 3), a fill or a hint
 * Got it needs the 3 in a row (or a test passed): it wins over earlier mistakes, so a word that
 * has been mended stops showing as help.
 */
export function classify({ dots = 0, tries = 0, peeks = 0, slipped = false, passed = false, any = false, remembered = false, assisted = false }) {
  if (slipped) {
    const why = ['slipped in the test'];
    if (peeks) why.push('peeked ' + times(peeks));
    return { key: 'help', label: STATUS_LABEL.help, reason: why.join(', ') };
  }
  if (remembered) return { key: 'got', label: STATUS_LABEL.got, reason: 'remembered' };
  // SB4: every try that counted used letter tiles (levels 1 to 3), a fill or a hint: honest, so not "Got it" yet.
  if ((dots >= W.ROW_NEEDED || passed) && assisted) return { key: 'getting', label: STATUS_LABEL.getting, reason: 'tiles' };
  if (dots >= W.ROW_NEEDED || passed) return { key: 'got', label: STATUS_LABEL.got, reason: passed && dots < W.ROW_NEEDED ? 'right in the test' : '' };
  if (tries >= 2 || peeks >= 1) {
    const why = [];
    if (tries >= 2) why.push('2 or more wrong letters');
    if (peeks) why.push('peeked ' + times(peeks));
    return { key: 'help', label: STATUS_LABEL.help, reason: why.join(', ') };
  }
  if (any || dots > 0) return { key: 'getting', label: STATUS_LABEL.getting, reason: dots > 0 ? dots + ' in a row' : 'practised' };
  return { key: 'new', label: STATUS_LABEL.new, reason: 'no tries yet' };
}

/**
 * The mistakes that say "needs help": wrong letters and peeks from the word's spelling practice (My words practice and
 * Fix it in), on the latest day it was practised. Games, meaning match and the test don't count here, and an older
 * day's mistakes stop counting once the word has been practised again.
 */
export function recentHelp(d, g, word) {
  const rs = d.results.filter((r) => r.g === g.id && r.w === word && r.k !== 't' && r.s !== 'g' && r.s !== 'm');
  if (!rs.length) return { tries: 0, peeks: 0 };
  const last = rs.reduce((m, r) => (r.d > m ? r.d : m), '');
  const on = rs.filter((r) => r.d === last);
  return { tries: on.reduce((n, r) => n + (r.t || 0), 0), peeks: on.reduce((n, r) => n + (r.p || 0), 0) };
}

/** What we can honestly say about a word: only what the tries show (never which letters were wrong: that isn't kept). */
export function noticed({ back, skipped, clue, slipped, rightInTest }) {
  const out = [];
  if (slipped) out.push('Slipped in the test: it comes back in Mend and keep.');
  else if (rightInTest) out.push('Right in the test.');
  if (skipped) out.push('Skipped for now today.');
  if (back) out.push('Back again from an earlier week.');
  if (clue) out.push('Memory clue: ' + clue);
  return out;
}

const RANK = { help: 0, new: 1, getting: 2, got: 3 };
/** The words of a week with a status, a reason and what we noticed. Words that need help come first, then the week's own order. */
export function weekWords(d, g, today) {
  const prog = W.groupProgress(d, g);
  const dots = new Map(W.allDots(d, g, today).map((x) => [x.word, x.dots]));
  const toFix = new Set(W.fixups(d, g));
  const results = new Map(W.testResults(d, g).map((x) => [x.word, x.result]));
  const skipped = new Set(W.comeBack(d, g, today).map((x) => x.word));
  const rows = prog.words.map((x, i) => {
    const r = results.get(x.word);
    const slipped = toFix.has(x.word);
    const rh = recentHelp(d, g, x.word);
    const st = classify({ dots: dots.get(x.word) || 0, tries: rh.tries, peeks: rh.peeks, slipped, passed: !!(r && r.right), any: x.tries > 0 || x.peeks > 0 || x.status === 'practising', remembered: x.status === 'remembered' && !(r && !r.right), assisted: assistedWord(d, g, x.word) });
    return { word: x.word, back: x.back, dots: dots.get(x.word) || 0, tries: rh.tries, peeks: rh.peeks, status: st.key, label: st.label, reason: st.reason === 'tiles' ? tilesReason(dots.get(x.word) || 0) : st.reason, i,
      notes: noticed({ back: x.back, skipped: skipped.has(x.word), clue: W.clueFor(d, x.word), slipped, rightInTest: !!(r && r.right) }) };
  });
  return rows.sort((a, b) => (a.status === 'help' ? 0 : 1) - (b.status === 'help' ? 0 : 1) || a.i - b.i);
}

/** Typed words (not on our lists) say what they have; a listed word is ready and says nothing. */
export function readiness({ typed, hasMeaning }) {
  if (!typed) return null;
  return {
    meaning: hasMeaning,
    meaningLine: hasMeaning ? 'Meaning from the Wordbright word list' : 'No meaning found',
    picture: hasMeaning ? 'No picture, meaning only' : 'No picture or meaning',
  };
}

// ---- a week at a glance ----------------------------------------------------------
export const CHIP_LABEL = { ontrack: 'On track', notstarted: 'Not started', finished: 'Week finished', none: 'No week yet' };
export const waitingLabel = (n) => n + (n === 1 ? ' job waiting' : ' jobs waiting');

/**
 * One week's summary, for the home card and the child's page.
 * waiting: its day has passed and it is not done (St.studyState's `waiting`). "On track" only when nothing is waiting.
 */
export function weekCard(d, g, today) {
  const s = St.studyState(d, g, today);
  const done = (id) => s.steps.find((x) => x.id === id).state === 'done';
  const waitingSteps = s.steps.filter((x) => St.BEFORE_TEST.includes(x.id) && x.state !== 'done' && x.state !== 'missed' && x.date < today && !done('test'));
  const started = s.steps.some((x) => x.state === 'done') || d.results.some((r) => r.g === g.id);
  const finished = s.status === 'finished';
  const chip = finished ? { key: 'finished', label: CHIP_LABEL.finished }
    : waitingSteps.length ? { key: 'waiting', label: waitingLabel(waitingSteps.length) }
      : !started ? { key: 'notstarted', label: CHIP_LABEL.notstarted }
        : { key: 'ontrack', label: CHIP_LABEL.ontrack };
  const job = s.job ? St.STEP_TEXT[s.job].title : '';
  const todayLine = job || ({ done: 'Done for today', rest: 'No job today', ready: 'Ready for the test', finished: 'Week finished' }[s.status] || '');
  const words = weekWords(d, g, today);
  return {
    id: g.id, name: g.name, start: g.start, test: g.test, count: g.words.length, back: g.back.length,
    chip, waiting: waitingSteps.length, waitingTitles: waitingSteps.filter((x) => x.state !== 'today').map((x) => x.title), waitingToday: waitingSteps.some((x) => x.state === 'today'),
    jobId: s.job || '', today: todayLine, catchUp: s.catchUp, status: s.status,
    steps: s.steps.map((x) => ({ ...stoneView(x, today, St.doneDay(d, g, x.id)), date: x.date, title: x.title })),
    stars: St.weekStars(d, g), help: words.filter((x) => x.status === 'help').map((x) => x.word),
    short: s.squeezed, canEdit: W.canEdit(d, g), testBegun: W.testBegun(d, g),
  };
}
/**
 * The line under a stone on the grown-up's path. `date` is the job's planned day ("Wed 4").
 * Today's job says "Today"; a job whose day has passed says "waiting since"; never a past date as "Today".
 */
export function pathLabel(v, date) {
  if (v.kind === 'done') return v.sub;
  if (v.kind === 'today') return 'Today';
  if (v.kind === 'todaywait') return 'Today · waiting since ' + date;
  if (v.kind === 'waiting') return 'Waiting since ' + date;
  if (v.id === 'test') return date + ' · test';
  return date;
}
/** "Today is Game day, and nothing is waiting." */
export function weekLine(card) {
  if (card.status === 'finished') return 'This week is finished.';
  const day = card.jobId ? 'Today is ' + card.today : card.today ? card.today : 'Nothing to do today';
  const waiting = card.waiting ? card.waiting + (card.waiting === 1 ? ' job is' : ' jobs are') + ' waiting' : 'nothing is waiting';
  return day + ', and ' + waiting + '.';
}

/** Everything a grown-up sees for one child. Live weeks soonest test first; the one Study mode would show is `current`. */
export function childOverview(d, today, now) {
  const g = St.studyGroup(d, today);
  const live = W.liveGroups(d);
  return {
    current: g ? weekCard(d, g, today) : null,
    weeks: live.map((x) => ({ id: x.id, name: x.name, test: x.test })),
    deleted: W.deletedGroups(d, now).map((x) => ({ id: x.id, name: x.name, test: x.test, words: x.words.length, gone: x.gone })),
    chip: g ? weekCard(d, g, today).chip : { key: 'none', label: CHIP_LABEL.none },
  };
}
export const weekOf = (d, id, today) => { const g = W.groupById(d, id); return g ? weekCard(d, g, today) : null; };

// ---- planning a week -----------------------------------------------------------------
export const FULL_WEEK_LINE = W.MAX_WORDS + ' words is a full week. Remove one to add another.';
export const passedLine = (nick) => 'The test date has passed. ' + nick + '\'s test opens when the jobs are done. You can pick a new date.';
export const STONE_KEY = 'Plum star: done. Sun: today. Dashed with a clock: waiting. Dashed: later.';
export const SHORT_WEEK_LINE = 'Short week: some days will have two jobs.';
export const FULL_WEEK_DAYS = St.BEFORE_TEST.length;
export const atCap = (words) => words.length >= W.MAX_WORDS;
/** Fewer than 5 days from the start to the test: some days hold two jobs. */
export const isShortWeek = (start, test) => W.daysBetween(start, test) < FULL_WEEK_DAYS;
/** "Fri 27 Nov", for the date written beside the date field. '' for no date. */
export const dateWords = (test) => (/^\d{4}-\d{2}-\d{2}$/.test(test || '') ? W.dayLabel(test) : '');
/** The year list a child's words come from first: their own school year, kept to the years that have words (Year 1 and 2 are Year 3 until they do). */
export function yearListFor(year, live = ['y3', 'y4', 'y5', 'y6']) {
  const n = Math.min(6, Math.max(1, Math.round(Number(year)) || 3));
  if (!live.length) return 'y' + n;
  let best = live[0];
  for (const id of live) if (Math.abs(Number(id.slice(1)) - n) < Math.abs(Number(best.slice(1)) - n)) best = id;
  return best;
}
/** The week's name: "School spellings" once a typed word is in, else the list's name, else the date's. */
export function suggestName({ typedCount = 0, listName = '', test }) {
  if (typedCount > 0) return 'School spellings';
  return listName || W.defaultName(test || '1970-01-01');
}
/** Where a plan starts: step 1 (who) only when there's a choice to make and nobody is chosen yet. */
export const firstStep = ({ children, chosen, editing }) => (editing || chosen || children < 2 ? 2 : 1);
/** The step before this one, or 0 (leave the form). Step 1 is skipped when it was never shown. */
export const stepBack = (step, { children, editing }) => (step === 3 ? 2 : step === 2 && firstStep({ children, chosen: null, editing }) === 1 ? 1 : 0);
/** What the child will see first, today: the first job. */
export const firstSight = (start) => ({ day: start, title: St.STEP_TEXT.hello.title, line: St.STEP_TEXT.hello.line, kind: 'hello' });
export const confirmLine = (name, child) => 'Started ' + name + ' for ' + child + '.';
export const editedLine = (name) => 'Changed ' + name + '.';
export const deletedLine = 'Deleted.';
export const deleteQuestion = (name, child) => 'Delete ' + name + ' for ' + child + '?';
export const deleteBody = (child) => child + '\'s practice on these words is kept and still counts towards remembered words.';
export const LOCKED_LINE = 'The test has begun, so the words and date can\'t change now. You can still rename the week, or plan next week.';

/* ===================================================================================
   SB3-F: the adult's front page ("This week at a glance"). Pure, like the rest.
   =================================================================================== */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** "Tuesday 17 November" for a day string; '' for anything else. */
export function longDate(day) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || '');
  if (!m) return '';
  const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return WEEKDAYS[t.getUTCDay()] + ' ' + t.getUTCDate() + ' ' + MONTHS[t.getUTCMonth()];
}

export const STONE_KEY_NEXT = 'Star: done. Sun: next job. Sun with a clock: next job, waiting. Dashed: later.';

/**
 * The next job and the one after it, from a week card's steps: the first two jobs not done (a job left undone in
 * a legacy week is never a job). `waiting` is true when the next job's day has gone.
 */
export function nextJobs(card) {
  const open = card.steps.filter((s) => s.kind !== 'done' && s.kind !== 'missed');
  // The child's home names card.jobId. Mend marked done with fix-ups left is "done" here but still the job: put it first.
  const job = card.jobId && !open.some((s) => s.id === card.jobId) ? card.steps.find((s) => s.id === card.jobId) : null;
  if (job) open.unshift(job);
  const one = open[0] || null;
  const two = open[1] || null;
  return { next: one, then: two, waiting: !!one && (one.kind === 'waiting' || one.kind === 'todaywait') };
}
/** "Next: Hello words (waiting). Then Fix it in." The next job comes first, a missed one before today's. '' when nothing is left. */
export function nextLine(card) {
  const { next, then, waiting } = nextJobs(card);
  if (!next) return '';
  return 'Next: ' + next.title + (waiting ? ' (waiting)' : '') + (then ? '. Then ' + then.title : '') + '.';
}
/** The stone that carries the sun: the next job, whether or not today has one. '' when none is left. */
export const sunStep = (card) => { const { next } = nextJobs(card); return next ? next.id : ''; };

/** How a child stands on the front page. key: 'noweek' 'ended' 'waiting' 'notstarted' 'ontrack' 'problem'. */
export function glanceKey(overview, problem = '') {
  if (problem) return { key: 'problem', waiting: 0 };
  const k = overview && overview.current;
  if (!k) return { key: 'noweek', waiting: 0 };
  if (k.status === 'finished') return { key: 'ended', waiting: 0 };
  if (k.chip.key === 'waiting') return { key: 'waiting', waiting: k.waiting };
  return { key: k.chip.key === 'notstarted' ? 'notstarted' : 'ontrack', waiting: 0 };
}
/** A child who needs the grown-up: a job waiting, a week that has ended, or no week at all. */
export const needsYou = (key) => key === 'waiting' || key === 'ended' || key === 'noweek';
/** The first card that needs the grown-up (its one button is the green one), or -1. Order is the account's. */
export const primaryIndex = (items) => items.findIndex((x) => needsYou(x.key));
/** "Plan a week" leads only when no child needs attention. */
export const planIsPrimary = (items) => primaryIndex(items) < 0;

const COUNTS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const cap = (s) => s.replace(/^./, (c) => c.toUpperCase());
const countWord = (n) => (n < COUNTS.length ? COUNTS[n] : String(n));
const joinNames = (names) => (names.length < 2 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]);
/** One rule for a name: always 's, with a curly apostrophe (Chris’s week, James’s week). */
export const possessive = (n) => n + '’s';
function fragment(x) {
  switch (x.key) {
    case 'waiting': return x.name + (x.waiting === 1 ? ' has a job waiting' : ' has ' + x.waiting + ' jobs waiting');
    case 'ended': return possessive(x.name) + ' week has ended';
    case 'noweek': return x.name + ' has no week yet';
    case 'notstarted': return x.name + ' is ready to start';
    case 'problem': return possessive(x.name) + ' week did not load';
    default: return x.name + ' is on track';
  }
}
/**
 * The one sentence under the heading. items: [{ name, key, waiting }] in the account's order.
 * Up to three children: one short sentence each, the ones who need you first, those on track together
 * ("Wren has a job waiting. Robin is on track."). From four: "Ben and Ellie need you. Three children are on track."
 */
export function glanceSummary(items) {
  if (!items.length) return '';
  const calm = (x) => x.key === 'ontrack' || x.key === 'notstarted';
  if (items.length <= 3) {
    const out = [];
    items.filter((x) => !calm(x)).sort((a, b) => (needsYou(a.key) ? 0 : 1) - (needsYou(b.key) ? 0 : 1)).forEach((x) => out.push(fragment(x)));
    const ok = items.filter(calm);
    if (ok.length) {
      if (ok.every((x) => x.key === 'ontrack')) out.push(joinNames(ok.map((x) => x.name)) + (ok.length === 1 ? ' is' : ' are') + ' on track');
      else ok.forEach((x) => out.push(fragment(x)));
    }
    return out.map((s) => s + '.').join(' ');
  }
  const need = items.filter((x) => needsYou(x.key));
  const calmN = items.filter(calm).length;
  const bad = items.filter((x) => x.key === 'problem').length;
  const parts = [];
  if (need.length) parts.push(joinNames(need.map((x) => x.name)) + (need.length === 1 ? ' needs you.' : ' need you.'));
  if (calmN === items.length) parts.push('All ' + countWord(calmN) + ' children are on track.');
  else if (calmN) parts.push(cap(countWord(calmN)) + (calmN === 1 ? ' child is' : ' children are') + ' on track.');
  if (bad) parts.push(cap(countWord(bad)) + (bad === 1 ? ' week' : ' weeks') + ' did not load.');
  return parts.join(' ');
}

/** The one green button in the header row. items: [{ name, key }] in the account's order. */
export function primaryAction(items) {
  const i = primaryIndex(items);
  if (i < 0) return { kind: 'plan', index: -1, label: 'Plan a week' };
  const x = items[i];
  if (x.key === 'noweek') return { kind: 'plan-child', index: i, label: 'Plan a week for ' + x.name };
  if (x.key === 'ended') return { kind: 'plan-child', index: i, label: 'Plan ' + possessive(x.name) + ' next week' };
  return { kind: 'see', index: i, label: 'See ' + possessive(x.name) + ' week' };
}
/** One or two children keep the full cards with stones; from three, one compact row each. */
export const isCompact = (n) => n >= 3;
/** The Waystead account's home (its children page is not a known address): "Add a child" and "Manage children". */
export const accountHomeHref = (origin) => accountUrl(origin, 'adult');

// ---- the week-choice switch (SB3-G) ----------------------------------------------------
export const WEEKPICK_NAME = 'Your child can choose which week to study';
export const weekPickState = (on) => (on ? 'On' : 'Off');
export const weekPickLabel = (on) => 'Your child can choose which week to study: ' + (on ? 'On' : 'Off');
export const weekPickHelp = (nick, on) => on
  ? nick + ' can pick which week to study when there is more than one. Switch it off and ' + nick + ' sees the week the app picks.'
  : nick + ' sees the week the app picks. A week ' + nick + ' chose on the device is ignored until you switch this back on.';
export const weekPickFlash = (on) => (on ? 'Your child can choose which week to study again.' : 'Your child now sees the week the app picks.');

// ====================================================================================================
// SB4-WP6: how a child spells, exams, honest result lines, the overview. All pure: the day and the
// time come in as arguments. Grown-up copy: no jargon, sentences of 20 words or fewer.
// ====================================================================================================
const plural2 = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
const isDayText = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
/** "12 Nov": a date without its weekday, from a time in milliseconds. */
export const shortDate = (ms) => W.dayLabel(W.localDay(ms)).replace(/^\w+ /, '');

// ---- statuses: letter tiles are honest -------------------------------------------------------------
export const tilesReason = (dots) => (dots >= W.ROW_NEEDED ? W.ROW_NEEDED + ' in a row with letter tiles' : 'right in the test with letter tiles');
/** Every try of the word that counted (spelled with no slip, in a practice flow or the test) used tile help or a hint; there is at least one. */
export function assistedWord(d, g, word) {
  const rs = d.results.filter((r) => r.g === g.id && r.w === word && r.s !== 'm' && (r.k === 't' || W.flowOf(r)) && r.c && !r.t && !r.p);
  return rs.length > 0 && rs.every((r) => W.assisted(r));
}

// ---- the card: How <name> spells ---------------------------------------------------------------------
export const spellTitle = (name) => 'How ' + name + ' spells';
export const spellLevelLine = (lv) => 'Letters or keyboard: ' + A.LEVEL_NAME[lv];
export const spellHelpLine = (pf) => 'Help in tests: ' + A.PROFILE_NAME[pf];
export const usualLine = (year) => 'Using \'' + A.LEVEL_NAME[A.SUGGEST[year].lv] + '\', the usual start for Year ' + year + '. You can change it.';
/** What the card says: two lines, who changed it and when (when known), and the usual-start line for Year 1 and 2 with nothing saved. */
export function spellCard(setup, year, name) {
  const s = setup || {};
  const lv = Su.effectiveLevel(s, year, true);
  const pf = Su.effectiveProfile(s, true);
  const saved = [Su.helpOf(s), Su.profileOf(s)].filter(Boolean).sort((a, b) => b.at - a.at)[0];
  const changed = saved ? 'Last changed ' + (saved.by ? 'by ' + saved.by + ', ' : '') + shortDate(saved.at) : '';
  return {
    title: spellTitle(name),
    lines: [spellLevelLine(lv), spellHelpLine(pf)],
    changed,
    usual: (year === 1 || year === 2) && !Su.helpOf(s) ? usualLine(year) : '',
    lv,
    pf,
  };
}
/** { next, line } when the child is ready for fewer letters (and is on tiles), else null. The app never changes the level itself. */
export function levelHint(d, today, setup, year, name) {
  const lv = Su.effectiveLevel(setup || {}, year, true);
  if (lv >= 5) return null;
  const g = W.currentGroup(d, today);
  if (!g || !W.levelReady(d, g, lv)) return null;
  return { next: lv + 1, line: name + ' is ready for fewer letters. Try \'' + A.LEVEL_NAME[lv + 1] + '\'?' };
}
export const SPELL_TILES_NOTE = 'Words spelled with letter tiles count as remembered only at \'All the letters\' and \'Keyboard\'.';
export const examOfferText = (name, year, pf) => (A.kindName('exam', pf, year) === 'Exam'
  ? 'You set these yourself, with a date. ' + name + ' sees \'Exam\'.'
  : 'You set these yourself, with a date. ' + name + ' sees \'Big test\'.');
export const QUIZ_OFFER_TEXT = 'A short practice check. Nothing is marked.';
export const TEST_OFFER_TEXT = 'The weekly test and chapter tests are always on.';
export const spellSub = (name, year) => (year ? name + ' is in Year ' + year + '. ' : '') + 'Each choice saves as soon as you tap it.';
export const stretchNote = (lv) => 'Stretch is keyboard only in quizzes and tests. Practice still uses \'' + A.LEVEL_NAME[lv] + '\'.';

// ---- exams ------------------------------------------------------------------------------------------------
const yearNum = (ch) => Number(String(ch.yearId || '').slice(1)) || 0;
export const chapterLabel = (ch) => 'Year ' + yearNum(ch) + ', Chapter ' + ch.n;
/**
 * The places an exam can draw words from. A chapter is ready once it has been attempted or passed; a week once its
 * test is done. Anything else is listed (the child's own year, and every week) but not ready: it never shows a word.
 * chapters: [{ id, yearId, n, words: [{ word }] }]; progress: the child's progress; d: their words.
 */
export function examSources({ chapters, progress, d, year, today }) {
  const out = [];
  const yid = 'y' + year;
  for (const ch of chapters || []) {
    const cp = PR.chapterProgress(progress, ch.id);
    const ready = cp.passed || cp.attempts > 0;
    if (!ready && ch.yearId !== yid) continue;
    out.push({ key: ch.id, kind: 'chapter', label: chapterLabel(ch), ready, at: cp.lastAt ? Date.parse(cp.lastAt) : 0, words: ch.words.map((w) => w.word), yearId: ch.yearId, n: ch.n });
  }
  out.sort((a, b) => (a.yearId < b.yearId ? -1 : a.yearId > b.yearId ? 1 : a.n - b.n));
  for (const g of W.liveGroups(d)) {
    out.push({ key: 'g-' + g.id, kind: 'week', label: g.name, ready: W.testDone(d, g), at: g.at || 0, words: g.words.slice(), yearId: '', n: 0 });
  }
  void today;
  return out;
}
/** What a choice of sources makes: how many words, from how many chapters and weeks, and the pools to draw from. */
export function examPlan(sources, keys, pf) {
  const pick = sources.filter((s) => s.ready && keys.includes(s.key));
  const distinct = new Set();
  for (const s of pick) for (const w of s.words) distinct.add(String(w).toLowerCase());
  const cap = A.rulesFor('exam', pf).words;
  return {
    n: Math.min(cap, distinct.size),
    chapters: pick.filter((s) => s.kind === 'chapter').length,
    weeks: pick.filter((s) => s.kind === 'week').length,
    keys: pick.map((s) => s.key),
    pools: pick.map((s) => ({ src: s.key, words: s.words, at: s.at })),
  };
}
export function examSummary(plan) {
  const parts = [];
  if (plan.chapters) parts.push(plural2(plan.chapters, 'chapter'));
  if (plan.weeks) parts.push(plural2(plan.weeks, 'week'));
  return parts.length ? plural2(plan.n, 'word') + ' from ' + parts.join(' and ') : 'Nothing chosen yet.';
}
export const EXAM_NOT_DONE = 'Test not done yet';
export const examDefaultName = (date) => ('Big test, ' + W.dayLabel(date).replace(/^\w+ /, '')).slice(0, Su.MAX_NAME);
export const examPlanLimit = () => 'You already have ' + Su.MAX_EXAMS + ' exams. Delete one first.';
export function examProblem({ keys, date, today, liveCount }) {
  if (!keys || !keys.length) return 'Choose at least one chapter or week.';
  if (!isDayText(date) || date < today) return 'Choose today or a later date.';
  if (liveCount >= Su.MAX_EXAMS) return examPlanLimit();
  return '';
}
/** The state of an exam, in words: Opens on <date> / Ready / Done on <date>. */
export function examStateLine(state, exam, last) {
  if (state === 'later') return 'Opens on ' + W.dayLabel(exam.date);
  if (state === 'done') return last ? 'Done on ' + W.dayLabel(isDayText(last.d) ? last.d : W.localDay(last.at)) : 'Done';
  return 'Ready';
}
export const examChip = (state) => (state === 'done' ? 'finished' : state === 'later' ? 'notstarted' : 'waiting');
/** The result line of an exam's newest run. */
export function examResultLine(exam, last) {
  return A.resultLine({ kind: 'exam', scope: exam.name, right: last.s, of: last.t, pf: last.pf, lv: last.lv, hr: last.hr, hn: last.hn, pk: last.pk });
}
export const examMissLine = (last) => (last && Array.isArray(last.miss) && last.miss.length ? 'Words to practise: ' + last.miss.join(', ') : '');
/** An exam's state and last run for a child, from their progress. */
export const examNow = (progress, exam, today) => PR.examState(progress, exam.id, exam, today);

// ---- honest result lines ----------------------------------------------------------------------------------
/** A tested week: the line says how the test was taken. Only when every word has its answer. */
export function weekTestLine(d, g) {
  if (!W.testDone(d, g) || !g.words.length) return '';
  const tests = { results: d.results.filter((r) => r.k === 't') };
  const mine = tests.results.filter((r) => r.g === g.id && g.words.includes(r.w));
  const res = W.testResults(d, g);
  const right = res.filter((x) => x.result && x.result.right).length;
  // How the test was taken is only known while every word still has its test try: after folding, say nothing about it.
  if (!g.words.every((w) => mine.some((r) => r.w === w))) return g.name + ' test · ' + right + ' of ' + g.words.length;
  let lv = 5;
  let hr = 0;
  let hn = 0;
  for (const w of g.words) {
    const h = W.helpOf(tests, g, w);
    lv = Math.min(lv, h.minLv);
    hr += h.hears;
    hn += h.hints;
  }
  const pf = (mine.find((r) => r.pf === 'sen' || r.pf === 'top') || {}).pf || 'normal';
  return A.resultLine({ kind: 'test', scope: g.name, right, of: g.words.length, pf, lv, hr, hn });
}
/** The newest chapter test: { line, passed } or null. */
export function chapterTestLine(progress, ch, scope) {
  const rs = progress.results.filter((r) => r.c === ch.id && r.at > progress.resetAt && typeof r.s === 'number' && typeof r.t === 'number')
    .sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : -1));
  if (!rs.length) return null;
  const r = rs[0];
  return { line: A.resultLine({ kind: 'test', scope, right: r.s, of: r.t, pf: r.pf, lv: r.lv, hr: r.hr, hn: r.hn }), passed: PR.chapterProgress(progress, ch.id).passed, at: r.at };
}
/** The newest three quiz runs: [{ line, at }]. nameOf(src) gives the chapter or week a quiz was about. */
export function quizLines(progress, nameOf, n = 3) {
  const keys = [...new Set(progress.results.filter((r) => r.k === 'q' && /^q:/.test(r.c)).map((r) => r.c))];
  const runs = [];
  for (const c of keys) for (const r of PR.checksOf(progress, c).runs) runs.push({ c, r });
  runs.sort((a, b) => b.r.at - a.r.at || (a.r.id < b.r.id ? 1 : -1));
  return runs.slice(0, n).map(({ c, r }) => ({
    at: r.at,
    line: A.resultLine({ kind: 'quiz', scope: nameOf(c.slice(2)), right: r.s, of: r.t, pf: r.pf, lv: r.lv, hr: r.hr, hn: r.hn, pk: r.pk }),
  }));
}
/** One year's counts: passed, studying, to do (the same stones the child sees). */
export function yearCounts(chs, progress) {
  const of = (c) => PR.chapterProgress(progress, c.id);
  const sum = F.yearSummary(chs, of);
  let studying = 0;
  let todo = 0;
  for (const c of chs) {
    const st = F.stoneState(of(c));
    if (st === 'studying') studying += 1;
    else if (st === 'todo') todo += 1;
  }
  return { total: sum.total, passed: sum.passed, studying, todo };
}
export const yearCountsLine = (c) => c.passed + ' passed · ' + c.studying + ' studying · ' + c.todo + ' to do';
/** The child's own chapters ("From you"): name and state, from progress under own-<oid>. */
export function ownRows(setup, progress) {
  return Su.liveOwn(setup).map((o) => ({ id: o.id, name: o.name, state: F.stoneState(PR.chapterProgress(progress, 'own-' + o.id)) }));
}
export const stateText = (s) => F.STONE_LABEL[s] || '';

// ---- the overview: one row for each child, in the account's order ----------------------------------------
export const OVERVIEW_CAPTION = 'One row for each child, in the order on your account. This is not a ranking.';
export const OVERVIEW_MAX = 5;
/** The newest test line, a week's or a chapter's. chapters: every chapter [{ id, yearId, n }]. */
export function lastTestLine(d, progress, chapters) {
  let best = null;
  const take = (at, line) => { if (line && (!best || at > best.at)) best = { at, line }; };
  for (const g of W.liveGroups(d)) {
    const day = W.testDayOf(W.testResults(d, g));
    if (day) take(Date.parse(day + 'T12:00:00Z'), weekTestLine(d, g));
  }
  for (const ch of chapters || []) {
    const t = chapterTestLine(progress, ch, 'Chapter ' + ch.n);
    if (t) take(t.at, t.line);
  }
  return best ? best.line : '';
}
export function nextExam(setup, progress, today) {
  for (const e of Su.liveExams(setup)) {
    if (e.date < today) continue;
    if (PR.examState(progress, e.id, e, today).state !== 'done') return e;
  }
  return null;
}
export function overviewRow({ name, words, progress, setup, chapters, today, now }) {
  const o = childOverview(words, today, now);
  const exam = nextExam(setup, progress, today);
  return {
    name,
    week: o.current ? o.current.name : 'No week planned',
    test: lastTestLine(words, progress, chapters) || 'No test yet',
    passed: (chapters || []).filter((c) => PR.chapterProgress(progress, c.id).passed).length,
    exam: exam ? exam.name + ', ' + W.dayLabel(exam.date) : 'None',
  };
}
