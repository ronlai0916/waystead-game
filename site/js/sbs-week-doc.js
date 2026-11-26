// The week in Step by step (SB6, TR-30, TR-30a, TR-31; D9, D14, D18-D21). Pure: the date and the setup come in.
// `W.jobFor` stays the one source of "the test is due" and of hidden words: nothing here changes dueGroups, hiddenWords,
// gamesOpen, returningWords or testDay. Step by step only changes WHEN a stone may be done (several a day, earlier stones
// again) and how a stone counts as done (from the ladder's facts and step marks), never when the test opens.
import * as W from './words-doc.js';
import * as St from './study-doc.js';
import * as Su from './setup-doc.js';
import * as Rows from './rows-doc.js';
import { RULES } from './sbs-rules.js';
import { fillableOf } from './tiles-doc.js';
import { CODE } from './ladder-doc.js';
import { newWordCap } from './session-doc.js';

/** The names a child sees for the seven stones (code names stay hello, fix, games, story, practice, test, mend). */
export const STONE_TEXT = Object.freeze({
  hello: { title: 'Meet the words', short: 'Meet', line: 'Hear each word, then spell it.' },
  fix: { title: 'Letter ladder', short: 'Ladder', line: 'Spell each word with more letters hidden.' },
  games: { title: 'Meanings', short: 'Meanings', line: 'Match each word to what it means.' },
  story: { title: 'Sentences', short: 'Sentences', line: 'Use your words in sentences.' },
  practice: { title: 'Words in a row', short: 'Rows', line: 'Spell the words together in rows.' },
  test: { title: 'Test day', short: 'Test', line: 'Spell each word you hear.' },
  mend: { title: 'Mend and keep', short: 'Mend', line: 'Look again at words that need more time.' },
});

const lc = (w) => String(w).toLowerCase();
const clean = (r) => r.c === 1 && !r.t && !r.p;
const LADDER_J = ['h', 'f', 'm'];   // the tries of the ladder itself (rows, checks, builder and games are other stones)
const STONE_J = { hello: 'h', fix: 'f', practice: 'w', mend: 'm' };

// ---- the week ---------------------------------------------------------------------------------------------------
/**
 * studyState (unchanged, hashed) with two Step-by-step changes (D9): before the test date a stone that is done for
 * today's share or not yet on its date is offered at once when every stone before it is done (`early: true`: "You can do this now");
 * from the test date the CATCH_UP cap is not applied. Stone order is never skipped. `setup` is accepted for symmetry.
 */
export function weekState(d, g, today) {
  const s = St.studyState(d, g, today);
  const firstLeft = St.BEFORE_TEST.find((id) => !St.doneDay(d, g, id));
  let { status, job } = s;
  let early = false;
  if (firstLeft) {
    if (today < g.test && (status === 'done' || status === 'rest')) { status = 'job'; job = firstLeft; early = true; }
    else if (s.catchUp && status === 'done') { status = 'job'; job = firstLeft; }
  }
  const steps = s.steps.map((x) => (x.id === job && x.state !== 'done' ? { ...x, state: 'today' } : x));
  return { ...s, status, job, steps, share: 0, early };
}

/** A stone's page may open (D9): the test is not due, and the stone is done (a revisit) or is the job now. The test and Mend keep their own rules. */
export function canOpen(d, g, step, today, setup) {
  const due = W.jobFor(d, g, today) === 'test';
  if (step === 'test') return due;
  if (due) return false;
  return !!St.doneDay(d, g, step) || weekState(d, g, today, setup).job === step;
}

// ---- when a stone is done -----------------------------------------------------------------------------------------
const partMark = (d, g, step, word) => !!W.stepDay(d, g, step + ':' + W.rows(g).indexOf(word));

const reachedAll = (d, g, w, today) => {
  const f = W.ladderFacts(d, w, today);
  return f.secure || Math.max(f.best, f.bestToday) >= CODE.ALL
    || d.results.some((r) => r.g === g.id && lc(r.w) === lc(w) && r.r === CODE.ALL && (r.j === 'h' || r.j === 'f') && clean(r));
};
/** Meet the words: the word reached the whole word on its own once (D22: no pass-over, it must climb). */
export const helloWordDone = (d, g, w, today) => partMark(d, g, 'hello', w) || reachedAll(d, g, w, today);
/** Letter ladder: a clean whole-word go in the ladder, on any day (D9). */
export const fixWordDone = (d, g, w) => partMark(d, g, 'fix', w)
  || d.results.some((r) => r.g === g.id && lc(r.w) === lc(w) && r.j === 'f' && r.r === CODE.ALL && clean(r));

/** The words of the week a stone still needs (Meet, Letter ladder), or the words to mend. */
export function wordsLeft(d, g, step, today) {
  if (step === 'hello') return g.words.filter((w) => !helloWordDone(d, g, w, today));
  if (step === 'fix') return g.words.filter((w) => !fixWordDone(d, g, w));
  if (step === 'mend') return W.fixups(d, g);
  return [];
}

/** Has the stone's work been done (from the marks and tries)? The runner then marks the step. The step mark itself also counts. */
export function stoneDone(d, g, step, today) {
  // Step by step reads only the marks its own runner writes: Normal rounds (grid, Fix it in) never complete a stone here, so the test cannot open without the rows (D14)
  if (St.BEFORE_TEST.includes(step) && W.stepDay(d, g, step)) return true;
  switch (step) {
    case 'hello': return g.words.every((w) => helloWordDone(d, g, w, today));
    case 'fix': return g.words.every((w) => fixWordDone(d, g, w));
    case 'games': return !!W.stepDay(d, g, 'games:match');
    case 'story': return W.notesFor(d, g).length >= St.storySentences(St.weekKind(g));
    case 'practice': return false; // only the `practice` step mark, written once every row size has its mark (pendingMarks)
    case 'test': return W.testDone(d, g);
    case 'mend': return !!W.stepDay(d, g, 'mend') && W.jobFor(d, g, today) !== 'fixups';
    default: return false;
  }
}

/** The step marks the runner should write now (at a safe point between words): part marks and the stone's own mark; for rows the rw: marks then `practice`. */
export function pendingMarks(d, g, step, today) {
  const have = (s) => !!W.stepDay(d, g, s);
  const out = [];
  if (step === 'practice') {
    const facts = new Map(g.words.map((w) => [w, W.ladderFacts(d, w, today)]));
    return Rows.marksToWrite(d, g, today, facts);
  }
  if (step === 'hello' || step === 'fix') {
    for (const w of g.words) {
      const ok = step === 'hello' ? helloWordDone(d, g, w, today) : fixWordDone(d, g, w);
      const mark = step + ':' + W.rows(g).indexOf(w);
      if (ok && !have(mark)) out.push(mark);
    }
  }
  if (stoneDone(d, g, step, today) && !W.stepDay(d, g, step)) out.push(step);
  return out;
}

// ---- which way a stone runs (TR-31) -------------------------------------------------------------------------------
/** Evidence of the way a stone was started: 'sbs' (a try with the stone's `j`, or a sentence with a builder level), 'usual' (the Normal marks and tries), or ''. */
function startedWay(d, g, step) {
  const mine = d.results.filter((r) => r.g === g.id);
  if (STONE_J[step] && mine.some((r) => r.j === STONE_J[step])) return 'sbs';
  if (step === 'story') {
    const notes = W.notesFor(d, g);
    if (notes.some((n) => n.bl)) return 'sbs';
    return notes.length ? 'usual' : '';
  }
  if (step === 'games') return mine.some((r) => r.j === 'q') ? 'sbs' : (Object.keys(d.steps).some((k) => k.startsWith(g.id + '|games:') && k !== g.id + '|games:match') ? 'usual' : '');
  const parts = Object.keys(d.steps).some((k) => k.startsWith(g.id + '|' + step + ':') && /^\d+$/.test(k.slice((g.id + '|' + step + ':').length)));
  if (step === 'fix' && mine.some((r) => r.s === 'x' && !r.j)) return 'usual';
  if (step === 'practice' && mine.some((r) => r.k === 'p' && !r.j && !r.s)) return 'usual';
  return parts ? 'usual' : '';
}
/** 'sbs' or 'usual' for a stone: one already done uses today's setting (a revisit); one started keeps the way it started; else the setting. */
export function wayFor(d, g, step, setup) {
  const now = Su.wayOf(setup);
  if (step === 'test' || St.doneDay(d, g, step)) return now;
  return startedWay(d, g, step) || now;
}

// ---- the grown-up's estimate (TR-30a, D14, D18-D24) ------------------------------------------------------------------
// Counted stone by stone, only the work still to do (a clean child, so "at least"):
//   Meet     tries = sum(letters + 1) + 1 quick check a word   sittings = max(ceil(tries * secondsPerTry / (60 m)), ceil(words / newWordCap))
//   Ladder   tries = 2 a word                                  sittings = max(ceil(tries * ... / (60 m)), ceil(words / reviewWords))
//   Rows     tries = sizes 2 .. startAtAllFrom-1: ceil(2 N) each; sizes from startAtAllFrom: together ceil(1.2 N * count)   sittings = ceil(tries * ... / (60 m))
//   Meanings 1; Sentences ceil(sentences / 2)  (3, 2 or 1 sentences for a full, short or quick week)
// perDay = ceil(sittings / days to the test, at least 1). No skip factor, no focus words, no parking: every word climbs every rung.
const lettersOf = (w) => fillableOf(typeof w === 'string' ? w : w.word).length;
const nameOf = (w) => (typeof w === 'string' ? w : w.word);

/** What of the week is still to do, for `estimate`: { meetWords, fixWords, sizes, meanings, sentences }. */
export function remaining(d, g, today) {
  const none = (step) => stoneDone(d, g, step, today);
  return {
    meetWords: none('hello') ? [] : wordsLeft(d, g, 'hello', today),
    fixWords: none('fix') ? [] : wordsLeft(d, g, 'fix', today),
    sizes: none('practice') ? [] : Rows.roundSizes(g.words.length).filter((k) => !Rows.roundDone(d, g, k)),
    meanings: !none('games'),
    sentences: !none('story'),
  };
}

export function estimate(words, { minutes = RULES.session.defaultMinutes, today, test, start, kind, year, left, rules = RULES } = {}) {
  const N = words.length;
  const m = rules.session.minutes.includes(minutes) ? minutes : rules.session.defaultMinutes;
  const secs = rules.est.secondsPerTry;
  const meetList = left ? left.meetWords : words.map(nameOf);
  const fixN = left ? left.fixWords.length : N;
  const sizes = left ? left.sizes : Rows.roundSizes(N, rules);
  const lowSizes = sizes.filter((k) => k < rules.rows.startAtAllFrom).length;
  const highSizes = sizes.length - lowSizes;
  const meetTries = words.filter((w) => meetList.includes(nameOf(w))).reduce((n, w) => n + lettersOf(w) + 1, 0) + meetList.length;
  const ladderTries = 2 * fixN;
  const rowTries = lowSizes * Math.ceil(rules.est.rowTriesLow * N) + Math.ceil(rules.est.rowTriesHigh * N * highSizes - 1e-9);
  const sit = (tries, words, cap) => (words > 0 || tries > 0 ? Math.max(Math.ceil((tries * secs) / (60 * m)), Math.ceil(words / cap)) : 0);
  const k = kind || St.weekKind({ start: start || today, test });
  const stones = {
    meet: sit(meetTries, meetList.length, newWordCap(year)),
    ladder: sit(ladderTries, fixN, rules.session.reviewWords),
    rows: sit(rowTries, 0, 1),
    meanings: !left || left.meanings ? (rules.est.fixedMeanings ?? 1) : 0,
    sentences: !left || left.sentences ? Math.ceil(St.storySentences(k) / (rules.est.sentencesPerSitting ?? 2)) : 0,
  };
  const sittings = Object.values(stones).reduce((a, b) => a + b, 0);
  const tries = meetTries + ladderTries + rowTries;
  const late = !!today && !!test && today >= test;
  const days = Math.max(1, W.daysBetween(today, test));
  const perDay = Math.ceil(sittings / days);
  const calm = !late && perDay > rules.est.calmLineAbovePerDay;
  const plural = sittings === 1 ? ' sitting' : ' sittings';
  const line = sittings === 0 ? ''
    : late ? 'About ' + sittings + plural + ' left before the test can open.'
      : 'At least about ' + sittings + plural + ' of ' + m + ' minutes before the test: about ' + perDay + ' a day.' + (calm ? ' That is a lot for this week. You could give it more days.' : '');
  return { tries, sittings, days, perDay, calm, line, stones, parts: { meet: meetTries, ladder: ladderTries, rows: rowTries } };
}

/** The estimate for a week in the data: only what is left to do, from today. */
export function estimateFor(d, g, today, setup, { year } = {}) {
  return estimate(g.words, { minutes: Su.sbsOf(setup).min, today, test: g.test, start: g.start, year, left: remaining(d, g, today) });
}
