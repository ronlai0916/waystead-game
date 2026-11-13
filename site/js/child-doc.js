// What a child's screens say (SB3-C1, "Direction A, the garden path"). Pure: the
// date and the study state come in; nothing here draws, saves or changes a rule.
// The rules stay in study-doc.js and words-doc.js; this file only picks words.
//
// Wording rules: a job is "waiting", never behind; an instruction is 8 words or
// fewer; an audio button says "Hear it" (the word's own button: "Hear the word").
import * as W from './words-doc.js';
import * as St from './study-doc.js';

export const CHILD_TIME = 'About 15 minutes';
export const SAVED_LINE = 'Your place is saved.';
export const GAMES_CLOSED = 'Test first, then games.';
export const FLOWER_GAME = 'Play the flower game';
export const SKIP_TEXT = 'Skip for now. It comes back later.';
export const PEEK_HINT = 'Peeking starts your count again.';
export const PEEKED_LINE = 'Peeked. Start your count again.';
export const SPELL_INSTRUCTION = 'Listen, then type the word.';
export const HELLO_INSTRUCTION = 'Meet this word. Hear it.';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** "Tuesday", for a day like 2026-11-17. */
export const weekdayName = (day) => WEEKDAYS[new Date(day + 'T00:00:00Z').getUTCDay()];

/** One sentence for each job, in a child's words. */
export const JOB_SENTENCE = {
  hello: 'Meet each word, then play the flower game.',
  fix: 'Look, say, cover and write each word.',
  games: 'Play four quick games with your words.',
  story: 'Read about your words. Write three sentences.',
  practice: 'Spell each word three times in a row.',
  test: 'Spell each word once. Do your best.',
  mend: 'Mend any words that slipped.',
  mendQuick: 'One quick-fire round of all your words.',
};
const BUTTON = { test: 'Start the test' };

/** "11 stars". */
export const starsText = (n) => n + (n === 1 ? ' star' : ' stars');

/** The count of jobs before the test that are still to do, with their day gone: "2 jobs waiting for you". */
export const waitingEyebrow = (n) => n + (n === 1 ? ' job' : ' jobs') + ' waiting for you';

/** "Your test day was Tue 10 Nov." and "Finish your jobs, then take the test here." (St.catchUpLine, split at its full stop). */
export function catchUpParts(g, day) {
  const line = St.catchUpLine(g, day);
  const at = line.indexOf('. ') + 1;
  // The date stays on one line (non-breaking spaces), as in the design.
  return [line.slice(0, at).replace(/([A-Z][a-z]{2}) (\d{1,2}) ([A-Z][a-z]{2})\./, '$1\u00a0$2\u00a0$3.'), line.slice(at + 1)];
}

/** "Then Practice day. The test opens when your jobs are done." */
export function thenLine(steps, jobId) {
  const i = steps.findIndex((s) => s.id === jobId);
  const next = steps.slice(i + 1).find((s) => St.BEFORE_TEST.includes(s.id) && s.state !== 'done');
  return next ? 'Then ' + next.title + '. The test opens when your jobs are done.' : 'The test opens when your jobs are done.';
}

/** "Job 3 of 7": today's job, else the first one not done. */
export function jobNumber(steps, jobId) {
  const s = steps.find((x) => x.id === jobId) || steps.find((x) => x.state !== 'done');
  return s ? s.n : steps.length;
}

/**
 * What the child's home shows. `r` is St.roomState(d, day); `waiting` is
 * St.studyState(...).waiting; `mendPart` is St.mendPart(...) when the job is Mend and keep.
 *   eyebrow, headline, line (a second sentence or ''), say (read by "Hear it"),
 *   button { label, href: 'job' | 'wordbright' | 'words' | 'new' }, note (the quiet line under it),
 *   catchUp (true: the headline and line are the catch-up pair), path (show the path card).
 */
export function homeView(r, day, { waiting = 0, mendPart = 'quick', testStarted = false } = {}) {
  const g = r.group;
  const comeBack = g && !r.hideWords ? r.comeBack : [];
  const v = { status: r.status, pip: r.pip, path: !!g, comeBack, catchUp: false, line: '', note: '' };
  if (r.status === 'none') {
    return { ...v, eyebrow: 'Welcome', headline: 'Let\'s make your first word group.', say: 'Let\'s make your first word group.', button: { label: 'My words', href: 'words' } };
  }
  if (r.status === 'job') {
    const id = r.step.id;
    const sentence = id === 'mend' ? (mendPart === 'fixups' ? 'Fix the words that slipped.' : JOB_SENTENCE.mendQuick) : JOB_SENTENCE[id];
    const button = { label: id === 'test' && testStarted ? 'Carry on with the test' : BUTTON[id] || 'Start ' + r.step.title, href: 'job' };
    if (r.catchUp) {
      const [headline, line] = catchUpParts(g, day);
      return { ...v, catchUp: true, eyebrow: waitingEyebrow(Math.max(waiting, 1)), headline, line, say: headline + ' ' + line, button, note: thenLine(r.strip, id) };
    }
    return { ...v, eyebrow: weekdayName(day) + ' · ' + r.step.title, headline: sentence, say: sentence, button, note: CHILD_TIME };
  }
  const WB = { label: 'Play Wordbright', href: 'wordbright' };
  const text = {
    done: ['Done for today!', 'Well done. Your next job is ready tomorrow.'],
    rest: ['No job today.', 'Your next job is on its way.'],
    ready: ['Every job is done.', 'You\'re ready for the test.'],
    finished: ['This week is finished.', 'Well done!'],
  }[r.status];
  const button = r.status === 'finished' ? { label: 'New word group', href: 'new' } : WB;
  return { ...v, eyebrow: weekdayName(day), headline: text[0], line: text[1], say: text.join(' '), button };
}

// ---- the path ---------------------------------------------------------------------
/**
 * One stone. `step` is a St.studyState step; `doneOn` the day it was done (St.doneDay) or ''.
 *   kind: done · today · todaywait (today's job, and its day has gone) · waiting · later · missed
 *   icon: star (done) · clock (waiting) · flag (the test, not done) · number
 */
export function stoneView(step, day, doneOn = '') {
  const name = step.id === 'test' ? 'Test' : step.title;
  const date = W.dayParts(step.date).join(' ');
  const gone = step.date < day;
  const kind = step.state === 'today' && gone ? 'todaywait' : step.state;
  const sub = {
    done: 'Done' + (doneOn ? ' · ' + W.dayParts(doneOn).join(' ') : ''),
    today: 'Today · tap to start',
    todaywait: 'Today · tap to start',
    waiting: 'Waiting for you',
    missed: 'Not done',
    later: step.id === 'test' ? date + ' · test day' : step.id === 'mend' ? 'Fix any slips · ' + date : date,
  }[kind];
  const say = {
    done: 'done', today: 'today, tap to start', todaywait: 'today and waiting, tap to start', waiting: 'waiting for you',
    missed: 'not done', later: 'on ' + W.dayLabel(step.date),
  }[kind];
  const icon = kind === 'done' ? 'star' : kind === 'waiting' || kind === 'todaywait' ? 'clock' : step.id === 'test' ? 'flag' : 'number';
  return { id: step.id, n: step.n, kind, icon, name, sub, aria: name + ': ' + say, helper: step.id === 'mend' && kind !== 'done' && kind !== 'later' ? 'Fix any slips' : '' };
}

/** Which job names go in the top bar inside a job, from the route. Games: 'Games'. */
export function jobTitle(path, d, day) {
  const m = /^words\/g\/([^/]+)\/(spell\/\d+|test|study\/([a-z]+)(?:\/\d+)?|game\/[a-z]+)$/.exec(path);
  if (!m) return '';
  if (m[3]) return (St.STEP_TEXT[m[3]] || { title: '' }).title;
  if (m[2] === 'test') return St.STEP_TEXT.test.title;
  if (m[2].startsWith('game/')) return 'Games';
  const g = W.groupById(d, decodeURIComponent(m[1]));
  const job = g ? W.jobFor(d, g, day) : '';
  return job === 'fixups' || job === 'fixed-today' ? St.STEP_TEXT.mend.title : St.STEP_TEXT.practice.title;
}

/** A page inside a job: the child sees "Stop for now" there, and no Menu. */
export const isJobPath = (path) => /^words\/g\/[^/]+\/(spell\/\d+|test|study\/[a-z]+(\/\d+)?|game\/[a-z]+)$/.test(path);

/** The Back button's target on a child's page, or '' for the usual one level up. */
export function backTarget(path) {
  if (/^words\/g\/[^/]+\/path$/.test(path) || path === 'settings') return '#/';
  return '';
}

/** The rows of the Menu sheet. Games closes while the test is due. */
export function menuRows({ gid, gamesOpen, hasGroup, canSwitch = false, wordsGid = '' }) {
  const rows = [];
  if (hasGroup) {
    rows.push(gamesOpen
      ? { id: 'games', title: 'Games', sub: 'Quick games with your words', href: '#/words/g/' + encodeURIComponent(gid) + '/games' }
      : { id: 'games', title: 'Games', sub: GAMES_CLOSED, closed: true });
  }
  rows.push({ id: 'words', title: 'My words', sub: 'See your words', href: wordsGid ? '#/words/g/' + encodeURIComponent(wordsGid) : '#/words' });
  rows.push({ id: 'practice', title: 'More practice', sub: 'Chapters, tricky words, your progress', href: '#/chapters' });
  rows.push({ id: 'settings', title: 'Settings', sub: canSwitch ? 'Day or night, switch player' : 'Day or night', href: '#/settings', quiet: true });
  return rows;
}

// ---- which week the home shows (SB3-C1b) --------------------------------------------
/**
 * The child may have several live weeks. `chosen` is this device's saved choice (a group id or '').
 *   group: the week to show: the chosen one if it is live and not finished, else St.studyGroup's pick.
 *   chosen: true when `group` is the saved choice.   stale: a choice was saved but no longer applies (clear it).
 *   weeks: the switchable weeks (live, not finished), each { id, name, test (day), testLabel, job, waiting, due, current }.
 *     job is "Job 3 of 7", "Every job done" or "Test ready" (a name only: no word is ever printed here).
 *   next: another week with a job when the shown week has none today, or null.   canSwitch: two or more weeks.   due: the weeks whose test is due, other than `group`.
 */
/**
 * The one guard for every words/g/:gid page (SB3-G): a grown-up's switch is off and the player is not an adult
 * (a child, or unknown: the same rule as editLinkLabel), and the page is another week's. Answers the id of the app's pick
 * to go to, or null (switch on, an adult, the pick's own page, a week whose test is due, an unknown week).
 */
export function weekGuard(d, today, gid, kind) {
  if (kind === 'adult' || W.weekPickOn(d) || !W.groupById(d, gid)) return null;
  const pick = weekChoice(d, today, '');
  if (!pick.group || pick.group.id === gid || pick.due.some((x) => x.id === gid)) return null;
  return pick.group.id;
}
export function weekChoice(d, today, chosenSaved = '') {
  // SB3-G: a grown-up can switch the choice off; the device's saved week is then ignored (and kept, for when it is on again).
  const allowed = W.weekPickOn(d);
  const chosen = allowed ? chosenSaved : '';
  const pick = St.studyGroup(d, today);
  const info = W.liveGroups(d).map((g) => ({ g, s: St.studyState(d, g, today), due: W.jobFor(d, g, today) === 'test' })).filter((x) => x.s.status !== 'finished');
  const mine = chosen ? info.find((x) => x.g.id === chosen) : null;
  const group = mine ? mine.g : pick;
  const weeks = info.map(({ g, s, due }) => ({
    id: g.id, name: g.name, test: g.test, testLabel: 'Test ' + W.dayLabel(g.test), due, current: !!group && g.id === group.id,
    waiting: s.waiting > 0 && !due, // jobs whose day has gone
    job: due ? 'Test ready' : s.status === 'ready' ? 'Every job done' : 'Job ' + jobNumber(s.steps, s.job || '') + ' of 7',
  }));
  const shown = info.find((x) => group && x.g.id === group.id);
  // Nothing to do today in the shown week, but another has a job: a quiet pointer to it (names only).
  const next = shown && shown.s.status !== 'job' ? info.find((x) => x.g.id !== group.id && !x.due && x.s.status === 'job') : null;
  return {
    group, chosen: !!mine, next: next && allowed ? { id: next.g.id, name: next.g.name } : null, stale: !!chosen && !mine, weeks, canSwitch: allowed && weeks.length >= 2, allowed,
    due: info.filter((x) => x.due && (!group || x.g.id !== group.id)).map((x) => ({ id: x.g.id, name: x.g.name })),
  };
}
