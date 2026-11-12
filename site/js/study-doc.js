// Study mode: the guided week for one word group, and what My room shows. Pure:
// the date comes in as `today`. What's done is read from the saved value
// (words-doc.js): a job's mark, the grid's round, the test.
//
// The week is seven jobs in a fixed order: hello, fix, games, story, practice,
// then the test on its date, then Mend and keep. Each job has a date: the days
// up to the test are shared out evenly, in order, so a long gap spreads them and
// a short one (under 5 days) puts several on a day. No job is ever passed over.
//
//   · A job opens on its date, once every job before it is done. A missed job
//     waits, and is offered first.
//   · Before the test date: one job a day, unless there are now more jobs left
//     than days before the test: then the day's share goes up so the week fits.
//   · From the test date, jobs still waiting catch up in order, at most CATCH_UP
//     a day (a job finished today counts). The words stay on show meanwhile.
//   · The test opens once all five jobs are done (the same day the last one is
//     finished, if it is on or after the test date). Only then is it due and its
//     words hidden: W.jobFor in words-doc.js decides that, for every page.
//   · Mend and keep: the day after the test was done.
//   · Weeks from before this rule: a test already finished while jobs were left
//     undone. Those jobs are 'missed' ("Not done"): never a job, never waiting.
//     A week that follows this rule never has one.
import * as W from './words-doc.js';

export const DAILY_TIME = 'about 15–20 minutes a day';
export const DAILY_TIME_CAP = 'About 15–20 minutes a day';
export const ROW_LINE = 'Each word is spelled 3 times in a row before it counts.';

export const BEFORE_TEST = W.STUDY_JOBS;
export const STEPS = [...BEFORE_TEST, 'test', 'mend'];
export const CATCH_UP = 2; // jobs a day once the test date has come and some are still waiting
export const MEND_WAIT = 7; // Mend and keep is on offer this many days after its date
export const MIN_SENTENCE = 4;
export const SENTENCES = 3;

export const STEP_TEXT = {
  hello: { title: 'Hello words', short: 'Hello', line: 'Meet each word: hear it, see what it means, then play the flower game.' },
  fix: { title: 'Fix it in', short: 'Fix', line: 'Look, say, cover, write and check each word, then spell it 3 times in a row.' },
  games: { title: 'Game day', short: 'Games', line: 'Four quick games with your words.' },
  story: { title: 'Story day', short: 'Story', line: 'See your words at work, then write three sentences of your own.' },
  practice: { title: 'Practice day', short: 'Practice', line: 'One round of the practice grid: every word, hidden and spoken, 3 times in a row.' },
  test: { title: 'Test day', short: 'Test', line: 'Each word is spoken, with no peeking and one go each.' },
  mend: { title: 'Mend and keep', short: 'Mend', line: 'Mend any words that slipped, then a quick-fire round of them all.' },
};

/** The date each job opens. */
export function stepDates(g, testDone = '') {
  const n = W.daysBetween(g.start, g.test);
  const out = {};
  BEFORE_TEST.forEach((s, i) => { out[s] = W.addDays(g.start, Math.floor((i * n) / BEFORE_TEST.length)); });
  out.test = g.test;
  out.mend = W.addDays(testDone > g.test ? testDone : g.test, 1);
  return out;
}

/** The day a job was finished, or ''. */
export function doneDay(d, g, step) {
  if (BEFORE_TEST.includes(step)) return W.studyJobDay(d, g, step);
  if (step === 'test') return W.testDone(d, g) ? W.testDayOf(W.testResults(d, g)) : '';
  return W.stepDay(d, g, step);
}

function beforeTest(d, g, today, done) {
  const first = BEFORE_TEST.find((s) => !done[s]);
  if (!first) return { status: 'ready', job: null };
  const doneToday = BEFORE_TEST.filter((s) => done[s] === today).length;
  const left = BEFORE_TEST.filter((s) => !done[s] || done[s] === today).length;
  const share = Math.ceil(left / W.daysBetween(today, g.test));
  const dates = stepDates(g);
  if (today < dates[first] || doneToday >= share) return { status: doneToday ? 'done' : 'rest', job: null };
  return { status: 'job', job: first };
}

// On or after the test date, with jobs still waiting: they come first, in order, CATCH_UP a day.
function catchUp(done, today) {
  const first = BEFORE_TEST.find((s) => !done[s]);
  const doneToday = BEFORE_TEST.filter((s) => done[s] === today).length;
  return doneToday >= CATCH_UP ? { status: 'done', job: null } : { status: 'job', job: first };
}

function afterTest(d, g, today, done, dates) {
  const job = W.jobFor(d, g, today);
  if (job === 'test') return { status: 'job', job: 'test' };
  if (job === 'wait') return { status: 'done', job: null };
  if (job === 'fixups') return { status: 'job', job: 'mend' };
  if (done.mend) return { status: job === 'fixed-today' ? 'done' : 'finished', job: null };
  if (today < dates.mend) return { status: 'done', job: null };
  if (job === 'finished' && W.daysBetween(dates.mend, today) > MEND_WAIT) return { status: 'finished', job: null };
  return { status: 'job', job: 'mend' };
}

/**
 * Where the group's week is today.
 *   status: 'job' (job is today's), 'done' (today's job is done), 'rest' (no job
 *   today), 'ready' (every job done, the test to come), 'finished'.
 *   steps: each job with state 'done' · 'today' · 'waiting' (its date has gone,
 *   still to do) · 'later' (the test and Mend and keep while jobs catch up, too) ·
 *   'missed' (only a legacy week: the test was finished with this job undone).
 *   catchUp: the test date has come and jobs are still waiting.
 *   waiting: how many jobs before the test are still to do with their date gone.
 */
export function studyState(d, g, today) {
  const done = Object.fromEntries(STEPS.map((s) => [s, doneDay(d, g, s)]));
  const dates = stepDates(g, done.test);
  const catching = today >= g.test && W.jobFor(d, g, today) === 'practise';
  const { status, job } = today < g.test ? beforeTest(d, g, today, done) : catching ? catchUp(done, today) : afterTest(d, g, today, done, dates);
  const steps = STEPS.map((id, i) => {
    const state = done[id] ? 'done' : id === job ? 'today' : done.test && BEFORE_TEST.includes(id) ? 'missed'
      : catching && !BEFORE_TEST.includes(id) ? 'later' : dates[id] < today ? 'waiting' : 'later';
    return { id, n: i + 1, date: dates[id], state, ...STEP_TEXT[id] };
  });
  const waiting = done.test ? 0 : BEFORE_TEST.filter((id) => !done[id] && dates[id] < today).length;
  return { status, job, steps, catchUp: catching, waiting, squeezed: W.daysBetween(g.start, g.test) < BEFORE_TEST.length };
}

/** The line for a child once the test date has come and jobs are still waiting. */
export function catchUpLine(g, today) {
  return (today === g.test ? 'Today is your test day.' : 'Your test day was ' + W.dayLabel(g.test) + '.') + ' Finish your jobs, then take the test here.';
}

/** A job's page may open: today's job, or one already done, again, while the words are on show before the test. */
export function canOpen(d, g, step, today) {
  const s = studyState(d, g, today);
  return s.job === step || (W.jobFor(d, g, today) === 'practise' && !!doneDay(d, g, step));
}

/** Mend and keep: 'fixups' first; then 'quick', all the words; 'done'. */
export function mendPart(d, g, today) {
  if (W.jobFor(d, g, today) === 'fixups') return 'fixups';
  return W.stepDay(d, g, 'mend') ? 'done' : 'quick';
}

/** The group for today: one with a job waiting, else the first not finished, else the newest. */
export function studyGroup(d, today) {
  const all = W.liveGroups(d);
  const states = all.map((g) => ({ g, s: studyState(d, g, today) }));
  const pick = states.find((x) => x.s.status === 'job') || states.find((x) => x.s.status !== 'finished');
  return pick ? pick.g : all[all.length - 1] || null;
}

// ---- no word on show while its test is due ---------------------------------------
/** The groups whose test is due (W.jobFor): the date has come, every study job is done, and the test isn't finished. */
export const dueGroups = (d, today) => W.liveGroups(d).filter((g) => W.jobFor(d, g, today) === 'test');
/** Every word of those tests, lower case. */
export const hiddenWords = (d, today) => new Set(dueGroups(d, today).flatMap((g) => g.words.map((w) => w.toLowerCase())));
const isHidden = (hidden, w) => hidden.has(w.toLowerCase());
export const showsHidden = (g, hidden) => W.rows(g).some((w) => isHidden(hidden, w));
/** A list of words, or of things with a .word, without the hidden ones. */
export const withoutHidden = (list, hidden) => list.filter((x) => !isHidden(hidden, typeof x === 'string' ? x : x.word));

/** Game mode: any time, except while the test is due (no word on show then). */
export const gamesOpen = (d, g, today) => W.jobFor(d, g, today) !== 'test';

export const weekStars = (d, g) => W.practiceDays(g).reduce((n, day) => n + W.starsOn(d, g, day), 0);

/** Three words for Story day: those with the fewest sentences so far, in order. */
export function sentenceWords(d, g) {
  const count = (w) => W.notesFor(d, g).filter((x) => x.w === w).length;
  return [...g.words].map((w, i) => ({ w, i })).sort((a, b) => count(a.w) - count(b.w) || a.i - b.i).slice(0, SENTENCES).map((x) => x.w);
}

// Fix it in: ready-made memory clues for a tricky word; the child can type their own.
export function clueOptions(entry) {
  const w = entry.word;
  const out = [];
  if (entry.tricky) out.push('Watch the letters ' + entry.tricky + ' in ' + w);
  if (entry.chunks && entry.chunks.length > 1) out.push('Say every part: ' + entry.chunks.join(' · '));
  out.push('Chant the letters: ' + [...w].join('-'));
  return out;
}

const wordRe = (word) => new RegExp('(^|[^a-z])' + word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es|ed|d|ing)?($|[^a-z])');
/** '' when the sentence will do, else a kind line. */
export function checkSentence(text, word) {
  const s = String(text || '').trim();
  if (!wordRe(word).test(s.toLowerCase())) return 'Use the word ' + word + ' in your sentence, spelled just like that.';
  if (s.split(/\s+/).filter((x) => /[a-z]/i.test(x)).length < MIN_SENTENCE) return 'Make it a little longer: at least ' + MIN_SENTENCE + ' words.';
  return '';
}

// Pip's look: 'happy', 'thinking' (something to work at) or 'cheering'.
function pipFor(status, step, today) {
  if (status === 'finished' || status === 'done' || status === 'ready') return 'cheering';
  return step && (step.id === 'test' || step.date < today) ? 'thinking' : 'happy'; // a test, or a job that waited
}

/** All My room needs. `group` is null before the first group. On test day it must not show the words.
 *  `chosen` (optional): a live group to show instead of studyGroup's pick (the child's chosen week). */
export function roomState(d, today, chosen = null) {
  const g = chosen || studyGroup(d, today);
  if (!g) return { status: 'none', group: null, pip: 'happy', hideWords: false };
  const s = studyState(d, g, today);
  const step = s.steps.find((x) => x.id === s.job) || null;
  return {
    status: s.status, group: g, step, strip: s.steps, stars: weekStars(d, g), test: g.test, catchUp: s.catchUp ? catchUpLine(g, today) : '',
    dots: W.allDots(d, g, today), ready: W.readyForTest(d, g), comeBack: W.comeBack(d, g, today), pip: pipFor(s.status, step, today), hideWords: showsHidden(g, hiddenWords(d, today)),
  };
}
