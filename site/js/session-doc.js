// One Step-by-step sitting (SB6, TR-26; D9, D18-D21; checker note on WP-1a). Pure: no page, no storage, no clock, no Math.random.
// `now` comes in as a number of milliseconds. A sitting is plain data; every function returns a new one.
//
// The runner (sbs-views.js) loops:  item = nextItem(s, ctx, now)  ->  show it  ->  s = afterItem(s, { item, tries, peeks }, now, ctx).
//   ctx = { words, facts, entries, rungs?, known? }
//     words    the stone's words still to do, in stone order (sbs-week-doc wordsLeft)
//     facts    word -> W.ladderFacts (a Map, an object or a function)
//     entries  word -> { word, chunks, tricky? } (a Map, an object or a function)
//     rungs    word -> rung codes (optional; ladder-doc rungsFor(entry) when absent)
//     known    other words the child knows at the whole word (optional, for quick checks)
//     resume   word -> rung code the word was left at last sitting (rows-doc/ session-doc resumeOf), or 0
//     setAside (optional) (word, day) -> true when a grown-up has set the word aside for TODAY (D25): it is skipped today, first in line tomorrow
//     rows     (stone 'practice' only) { next(), start(size, word), plan() } from rows-doc rowsCtx: the next row group still to do
// A row item is spelled together: afterItem takes outcome.perWord = [{ tries, peeks }] for item.words, in order.
// D22-D24: NO PARKING. A word stays until its whole word is clean. The time cap (and "Stop for now") end a sitting between items; a word in
// hand is saved at its exact step and comes back FIRST next sitting (ctx.resume). No word starts in the last 90 seconds. A sitting tries to END ON
// A CLEAN TRY (a quick check of a word that ended clean); when it cannot, the end says so (`clean: false`, a calm line) and nothing is praised.
import { RULES } from './sbs-rules.js';
import * as Su from './setup-doc.js';
import { CODE, rungsFor, startCode, newWordRun, afterTry } from './ladder-doc.js';
import { resumeCode } from './rows-doc.js';
import { runInfo } from './runs-doc.js';

const STUCK_LINE = RULES.lines.stuck;
const CALM_END = RULES.lines.endCalm;

const lc = (w) => String(w).toLowerCase();
const get = (m, w) => {
  if (!m) return null;
  if (typeof m === 'function') return m(w) || m(lc(w)) || null;
  if (m instanceof Map) return m.get(w) || m.get(lc(w)) || null;
  return m[w] || m[lc(w)] || null;
};
const bestOf = (f) => (f ? Math.max(f.best || 0, f.bestToday || 0) : 0);
const isMet = (f) => !!f && (bestOf(f) > 0 || !!(f.days && f.days.length) || !!f.metOn);
const knownAll = (f) => !!f && (!!f.secure || bestOf(f) >= CODE.ALL);

/** New words a sitting may bring: Years 1-2 three, Years 3-6 four, never more than the maximum. */
export function newWordCap(year, rules = RULES.session) {
  const y = Number.isInteger(year) && year >= 1 && year <= 6 ? 'y' + year : null;
  const n = y ? rules.newWords[y] : Math.min(rules.newWords.y1, rules.noYearWords);
  return Math.min(n, rules.newWords.max);
}

/** A fresh sitting. `ss` is the id the tries carry; `then` says whether a game follows (default: yes for Meet and Letter ladder). */
export function newSitting({ gid, stone, ss, startedAt, year, setup, then, day = '' } = {}) {
  const sbs = Su.sbsOf(setup);
  return {
    v: 1, gid, stone, ss, startedAt, day, year: year || 0,
    minutes: sbs.min, ms: sbs.min * 60000, big: sbs.big,
    newCap: newWordCap(year), reviewCap: RULES.session.reviewWords,
    then: then === undefined ? stone === 'hello' || stone === 'fix' || stone === 'practice' : !!then,
    begun: false, stopped: false, closed: false, final: false, thenDone: false,
    paused: 0, heard: [], current: null,
    done: [], doneAll: [], checks: [], row: null, rowKeys: [], items: 0, stuck: [], stuckQ: [],
    started: 0, newCount: 0, wordsDone: 0,
    needCheck: null, breakWordsAt: 0, breaks: 0, lateOffered: false,
    lastClean: true, closeTries: 0, last: null, plan: 0,
  };
}

/** Milliseconds spent so far, breaks left out. */
export const elapsedMs = (s, now) => Math.max(0, now - s.startedAt - s.paused);
const leftMs = (s, now) => s.ms - elapsedMs(s, now);

/** A new word may begin: more than 90 seconds left and fewer new words than the cap. */
export function canStartNewWord(s, now, rules = RULES.session) {
  return leftMs(s, now) > rules.noNewWordLastMs && s.newCount < s.newCap;
}

/** "No practice after" has passed (device local time as 'HH:MM'): job pages say spelling is finished for today. */
export function afterTime(setup, nowLocalHHMM) {
  const after = Su.sbsOf(setup).after;
  return after !== '' && /^([01]\d|2[0-3]):[0-5]\d$/.test(String(nowLocalHHMM)) && String(nowLocalHHMM) >= after;
}

// ---- which word next -------------------------------------------------------------------------------
function order(s, ctx) {
  const left = ctx.words.filter((w) => !s.done.some((x) => x.word === lc(w)) && !(s.current && s.current.word === lc(w)) && !s.stuck.some((x) => x.word === lc(w)) && !asideToday(s, ctx, w));
  const resumed = left.filter((w) => resumeAt(ctx, w) > 0); // D22: a word left unfinished comes back first, at its step
  return [...resumed, ...left.filter((w) => !resumed.includes(w))];
}
// D25: a grown-up set the word aside for today (from the grown-up pages; the runner passes ctx.setAside(word, day))
const asideToday = (s, ctx, w) => !!(ctx.setAside && ctx.setAside(w, s.day));
/** Words that cannot be offered now: stuck in this sitting, or set aside for today. Rows read it to skip a group whose remaining words are all in it. */
const skipOf = (s, ctx) => (w) => s.stuck.some((x) => x.word === lc(w)) || asideToday(s, ctx, w);

/** D22: where a word was left (the newest ladder try of facts.resume), or 0. ctx.resume (a function or object) overrides it. */
const resumeAt = (ctx, w) => {
  if (ctx.resume) { const v = typeof ctx.resume === 'function' ? ctx.resume(w) : (ctx.resume[lc(w)] || ctx.resume[w]); if (v) return v; }
  const f = get(ctx.facts, w);
  const e = get(ctx.entries, w);
  return f && f.resume && e ? resumeCode(f.resume.r, f.resume.clean, e) : 0;
};
const totalCap = (s) => (s.stone === 'hello' ? s.newCap + s.reviewCap : s.reviewCap);
// no word, row or new thing starts in the last 90 seconds (S2); only the one in hand and the closing checks run on
const MAX_ITEMS = RULES.session.maxItems; // a sitting is finite whatever the clock says
const isOver = (s, now) => leftMs(s, now) <= 0 || s.items >= MAX_ITEMS;
const timeFor = (s, now) => leftMs(s, now) > RULES.session.noNewWordLastMs;

function pickWord(s, ctx, now) {
  if (!timeFor(s, now) || s.started >= totalCap(s)) return null;
  for (const w of order(s, ctx)) {
    const isNew = !isMet(get(ctx.facts, w));
    if (isNew && !canStartNewWord(s, now)) continue;
    return { word: w, isNew };
  }
  return null;
}
const rowKey = (r) => r.size + ':' + r.index;
function pickRow(s, ctx, now) {
  if (s.stone !== 'practice' || !ctx.rows || !timeFor(s, now)) return null;
  const skip = skipOf(s, ctx);
  const r = ctx.rows.next(skip); // the next group of the round with someone left to do (R-M3: a group of stuck or set-aside words is skipped)
  if (!r || s.rowKeys.includes(rowKey(r))) return null;
  const left = r.left.filter((w) => !skip(w));
  return left.length ? { ...r, left } : null;
}

/** How many words (or, for rows, groups) the sitting plans to do (for "First: 3 words."). */
export function planWords(s, ctx, now = s.startedAt) {
  if (s.stone === 'practice') return ctx.rows ? Math.max(0, ctx.rows.plan(skipOf(s, ctx))) : 0;
  let t = { ...s };
  let n = 0;
  for (let i = 0; i < 20; i += 1) {
    const p = pickWord(t, ctx, now);
    if (!p) break;
    n += 1;
    t = { ...t, done: [...t.done, { word: lc(p.word) }], started: t.started + 1, newCount: t.newCount + (p.isNew ? 1 : 0) };
  }
  return n;
}

/** The First / Then card: { first: 'First: 3 words.', then: 'Then: a game.' }. `sitting.plan` holds the count (rows: groups). */
export function firstThenOf(stone, s, rules = RULES.session) {
  const n = s.plan || 0;
  const noun = stone === 'practice' ? ['row', 'rows'] : ['word', 'words'];
  return { first: 'First: ' + n + ' ' + (n === 1 ? noun[0] : noun[1]) + '.', then: s.then ? 'Then: a game.' : 'Then: we stop.', game: s.then ? rules.thenGame.game : '' };
}

// ---- checks (a known word, a clean try) ----------------------------------------------------------------
// A check never uses a word that ended this sitting with a slip or a Peek (M5). No word left: no check.
function checkFor(s, ctx, { reason, exclude = '', attempt = 0 }) {
  const inHand = [...(s.current ? [s.current.word] : []), ...(s.row ? s.row.words.filter((w) => !s.row.runs[w].done && !s.row.runs[w].stuck) : [])];
  const rough = new Set([...s.done.filter((x) => x.clean === false).map((x) => x.word), ...s.stuck.map((x) => x.word), ...inHand, lc(exclude)]); // never a word that ended unclean
  const pool = [...new Set([...ctx.words, ...s.done.map((x) => x.word), ...(ctx.known || [])].map(lc))].filter((w) => !rough.has(w));
  const allOk = (w) => knownAll(get(ctx.facts, w)) || s.doneAll.includes(w);
  const unchecked = (list) => [...list.filter((w) => !s.checks.includes(w)), ...list.filter((w) => s.checks.includes(w))];
  const withAll = unchecked(pool.filter(allOk));
  if (reason === 'new') return withAll.length ? { word: withAll[0], code: CODE.ALL } : null;
  if (withAll.length && attempt === 0) return { word: withAll[0], code: CODE.ALL };
  const met = unchecked(pool.filter((w) => isMet(get(ctx.facts, w)) || s.done.some((x) => x.word === w)));
  return met.length ? { word: met[0], code: CODE.COPY } : null;
}

// ---- the next item ---------------------------------------------------------------------------------------
const screenKey = (item) => (item.kind === 'rung' ? (item.code === CODE.COPY ? 'copy' : item.code >= CODE.ALL ? 'all' : 'rung') : item.kind);
const finish = (s, item) => ({ ...item, say: !s.heard.includes(screenKey(item)) });

const breakDue = (s, now) => s.wordsDone - s.breakWordsAt >= RULES.session.breakOffer.everyWords
  || (!s.lateOffered && elapsedMs(s, now) >= RULES.session.breakOffer.afterMs);

const rowItem = (s, row, start) => {
  const active = row.words.filter((w) => !row.runs[w].done && !row.runs[w].stuck);
  return {
    kind: 'row', size: row.size, index: row.index, of: row.of, ...(start ? { start: true } : {}),
    words: active.map((w) => ({ word: w, code: row.runs[w].code, repeat: row.runs[w].repeat, line: row.lines[w] || '' })),
    kept: row.words.filter((w) => row.runs[w].done),
  };
};

/** What to show next: { kind: 'firstThen'|'meet'|'rung'|'row'|'check'|'then'|'break-offer'|'end', ... }. Every item has `say`. */
/** The words left unfinished and the step each is at: [{ word, code }]. They come back first next sitting. */
const resumeList = (s) => [
  ...s.stuck.map((x) => ({ word: x.word, code: x.code, stuck: true })),
  ...(s.current ? [{ word: s.current.word, code: s.current.run.code }] : []),
  ...(s.row ? s.row.words.filter((w) => !s.row.runs[w].done && !s.row.runs[w].stuck).map((w) => ({ word: w, code: s.row.runs[w].code })) : []),
];

export function nextItem(s, ctx, now) {
  const progress = s.done.length > 0 || s.wordsDone > 0; // a sitting that did nothing says so calmly and praises nothing
  const endItem = (normal) => finish(s, {
    kind: 'end', normal, clean: s.lastClean && progress, line: s.lastClean && progress ? '' : CALM_END,
    minutes: Math.max(1, Math.ceil(elapsedMs(s, now) / 60000)), words: [...new Set(s.done.map((x) => x.word))], resume: resumeList(s), // F3: each word once, however many rows it was in
  });
  if (s.closed) return endItem(!s.stopped);
  if (!s.begun) {
    const plan = planWords(s, ctx, now);
    if (plan > 0) return finish(s, { kind: 'firstThen', firstThen: firstThenOf(s.stone, { ...s, plan }), plan }); // C-R1: no card when there is nothing to do
  }
  if (s.stopped) return endItem(false);
  if (s.stuckQ.length) return finish(s, { kind: 'stuck', word: s.stuckQ[0], line: STUCK_LINE }); // each newly stuck word is told once, between items
  const over = isOver(s, now);
  if (s.row && !over) return finish(s, rowItem(s, s.row, false));
  if (s.current && !over) {
    const c = s.current;
    return finish(s, { kind: 'rung', word: c.word, code: c.run.code, repeat: c.run.repeat, once: !!c.once, line: s.last && s.last.word === c.word ? s.last.line : '' });
  }
  if (s.needCheck && !over) {
    const c = checkFor(s, ctx, s.needCheck);
    if (c) return finish(s, { kind: 'check', word: c.word, code: c.code, j: 'k', reason: s.needCheck.reason, closing: false });
  }
  const row = s.final || over ? null : pickRow(s, ctx, now);
  if (row) {
    if (breakDue(s, now)) return finish(s, { kind: 'break-offer' });
    const words = row.left.map((w) => ({ word: w, code: ctx.rows.start(row.size, w), repeat: false, line: '' }));
    return finish(s, { kind: 'row', size: row.size, index: row.index, of: row.of, start: true, words, kept: row.kept || row.group.filter((w) => !row.left.includes(w)) });
  }
  const next = s.final || over || s.stone === 'practice' ? null : pickWord(s, ctx, now);
  if (next) {
    if (breakDue(s, now)) return finish(s, { kind: 'break-offer' });
    const f = get(ctx.facts, next.word) || { best: 0 };
    const entry = get(ctx.entries, next.word);
    const code = startCode({ ...f, best: bestOf(f) }, entry, { inRow: false, resumeAt: resumeAt(ctx, next.word) });
    const after = { ...s, done: [...s.done, { word: lc(next.word) }], started: s.started + 1, newCount: s.newCount + (next.isNew ? 1 : 0) };
    const isLast = s.started + 1 >= totalCap(s) || !pickWord(after, ctx, now);
    return finish(s, { kind: code === CODE.MEET ? 'meet' : 'rung', word: next.word, code, isNew: next.isNew, start: true, ...(isLast ? { warn: s.then ? 'last-word' : 'last-one' } : {}) });
  }
  // the end: first a clean try, then the game, then the stop
  if (!s.lastClean && s.closeTries < RULES.session.closeTries) {
    const c = checkFor(s, ctx, { reason: 'close', exclude: '', attempt: s.closeTries });
    if (c) return finish(s, { kind: 'check', word: c.word, code: c.code, j: 'k', reason: 'close', closing: true });
  }
  if (s.then && !s.thenDone) {
    const words = [...new Set(s.done.map((x) => x.word))].slice(-RULES.session.thenGame.cards);
    if (words.length >= 2) return finish(s, { kind: 'then', game: RULES.session.thenGame.game, cards: words.length, words });
  }
  return endItem(true);
}

// ---- after an item ---------------------------------------------------------------------------------------
function begin(s, ctx, item) {
  const w = item.word;
  const entry = get(ctx.entries, w);
  const rungs = (ctx.rungs && get(ctx.rungs, w)) || rungsFor(entry);
  const f = get(ctx.facts, w);
  return { entry, rungs, isNew: item.isNew !== undefined ? item.isNew : !isMet(f) };
}
const cleanTry = (t) => (t.tries || 0) === 0 && (t.peeks || 0) === 0;

// one row item done: every shown word has its own try and its own ladder step
function afterRow(s, item, outcome, ctx) {
  let row = s.row;
  let n = s;
  if (!row) {
    const runs = {};
    const lines = {};
    for (const x of item.words) runs[lc(x.word)] = newWordRun(get(ctx.entries, x.word), x.code);
    row = { size: item.size, index: item.index, of: item.of, words: [...item.words.map((x) => lc(x.word)), ...(item.kept || []).map(lc)], runs, lines };
    for (const w of (item.kept || [])) runs[lc(w)] = { ...newWordRun(get(ctx.entries, w), CODE.ALL), done: true, passed: [CODE.ALL], endedClean: true };
    n = { ...n, needCheck: null, rowKeys: [...n.rowKeys, item.size + ':' + item.index], started: n.started + 1 };
  }
  const per = outcome.perWord || [];
  const runs = { ...row.runs };
  const lines = { ...row.lines };
  const results = [];
  item.words.forEach((x, i) => {
    const w = lc(x.word);
    const entry = get(ctx.entries, w);
    const rungs = (ctx.rungs && get(ctx.rungs, w)) || rungsFor(entry);
    const t = per[i] || {};
    const r = afterTry(runs[w], { tries: t.tries || 0, peeks: t.peeks || 0, entry }, rungs);
    runs[w] = r.run;
    lines[w] = r.line;
    const stuckNow = r.next === 'back' && runInfo(r.run).stuck;
    if (stuckNow) { runs[w] = { ...r.run, stuck: true }; lines[w] = STUCK_LINE; }
    results.push({ word: w, code: x.code, next: r.next, line: stuckNow ? STUCK_LINE : r.line, clean: cleanTry(t), ...(stuckNow ? { stuck: true } : {}) });
  });
  const clean = results.every((x) => x.clean);
  row = { ...row, runs, lines };
  const finished = row.words.every((w) => runs[w].done || runs[w].stuck);
  const stuckWords = row.words.filter((w) => runs[w].stuck);
  const last = { kind: 'row', size: row.size, index: row.index, words: results, clean, done: finished };
  // S-R3: a word that became stuck in THIS item is told to the child now, once, before the next item (the others in the row carry on)
  const newlyStuck = results.filter((x) => x.stuck).map((x) => x.word);
  n = { ...n, row, lastClean: clean, last, stuck: [...n.stuck, ...newlyStuck.map((w) => ({ word: w, code: runs[w].code }))], stuckQ: [...n.stuckQ, ...newlyStuck] };
  if (!finished) return n;
  return {
    ...n, row: null, wordsDone: n.wordsDone + row.words.length - stuckWords.length,
    done: [...n.done, ...row.words.filter((w) => !runs[w].stuck).map((w) => ({ word: w, passedAll: runs[w].passed.includes(CODE.ALL), clean: runs[w].endedClean, isNew: false }))],
    doneAll: [...n.doneAll, ...row.words.filter((w) => !runs[w].stuck && runs[w].passed.includes(CODE.ALL))],
  };
}

/**
 * The child finished an item. outcome = { item, tries?, peeks?, perWord?, pausedMs?, stop? }: `tries` wrong letters, `peeks` Peeks (a Meet, a break and the
 * First / Then card have neither); a row item takes `perWord` = [{ tries, peeks }] in the order of item.words. `ctx` is the same as nextItem's. The result's `last` holds
 * { kind, word, code, next, line, clean } (a row: { kind:'row', size, index, words:[{ word, code, next, line, clean }], clean, done }): the runner
 * writes each try with `triesOf(sitting)` below.
 */
export function afterItem(s0, outcome, now, ctx = {}) {
  const item = outcome.item || outcome;
  const key = screenKey(item);
  let s = { ...s0, begun: true, items: s0.items + 1, heard: s0.heard.includes(key) ? s0.heard : [...s0.heard, key], paused: s0.paused + (outcome.pausedMs || 0) };
  if (outcome.stop) return { ...s, stopped: true, last: { kind: 'stop' } };
  const tries = outcome.tries || 0;
  const peeks = outcome.peeks || 0;
  const clean = tries === 0 && peeks === 0;
  switch (item.kind) {
    case 'firstThen': return { ...s, begun: true, plan: item.plan || 0 };
    case 'break-offer': return { ...s, breakWordsAt: s.wordsDone, breaks: s.breaks + 1, lateOffered: s.lateOffered || elapsedMs(s, now) >= RULES.session.breakOffer.afterMs, last: { kind: 'break-offer' } };
    case 'stuck': return { ...s, stuckQ: s.stuckQ.filter((x) => x !== lc(item.word)), last: { kind: 'stuck', word: lc(item.word) } };
    case 'then': return { ...s, thenDone: true, last: { kind: 'then' } };
    case 'end': return { ...s, closed: true };
    case 'row': return afterRow(s, item, outcome, ctx);
    case 'check': return {
      ...s, lastClean: clean, needCheck: null, checks: [...s.checks, lc(item.word)], closeTries: item.closing ? s.closeTries + 1 : s.closeTries,
      last: { kind: 'check', word: lc(item.word), code: item.code, clean, next: clean ? 'up' : 'repeat', line: '', },
    };
    case 'meet': {
      const b = begin(s, ctx, item);
      const run = { ...newWordRun(b.entry, CODE.MEET), code: b.rungs[1] };
      return {
        ...s, needCheck: null, started: s.started + 1, newCount: s.newCount + (b.isNew ? 1 : 0),
        current: { word: lc(item.word), run, isNew: b.isNew, last: !!item.warn, allRun: 0, extra: 0, once: false },
        last: { kind: 'meet', word: lc(item.word), code: CODE.MEET, next: 'up', line: '', clean: true },
      };
    }
    case 'rung': {
      const w = lc(item.word);
      const b = begin(s, ctx, item);
      let cur = s.current && s.current.word === w ? s.current : null;
      if (!cur) {
        cur = { word: w, run: newWordRun(b.entry, item.code), isNew: b.isNew, last: !!item.warn, allRun: 0, extra: 0, once: false };
        s = { ...s, needCheck: null, started: s.started + 1, newCount: s.newCount + (b.isNew ? 1 : 0) };
      }
      const r = afterTry(cur.run, { tries, peeks, entry: b.entry }, b.rungs);
      const last = { kind: 'rung', word: w, code: item.code, next: r.next, line: r.line, clean };
      let n = { ...s, lastClean: clean, last };
      cur = { ...cur, run: r.run, once: false };
      if (!r.run.done && r.next === 'back' && runInfo(r.run).stuck) {
        // D25: stuck: the word is saved at its step, tells the child once, and the sitting moves on to the other words
        return { ...n, current: null, stuck: [...s.stuck, { word: w, code: r.run.code }], stuckQ: [...s.stuckQ, w], final: s.final || cur.last, last: { ...last, stuck: true, line: STUCK_LINE } };
      }
      if (!r.run.done) return { ...n, current: cur };
      // the word leaves the sitting
      const run = r.run;
      const passedAll = run.passed.includes(CODE.ALL);
      if (s.stone === 'mend') {
        // Mend: the whole word again until allRunNeeded clean goes in a row; a slip or Peek at the whole word starts the count again
        const wholeClean = !run.slipRungs.includes(CODE.ALL) && !run.peekedRungs.includes(CODE.ALL);
        const allRun = wholeClean ? cur.allRun + 1 : 0;
        const cap = RULES.mend.allRunNeeded * RULES.session.mendExtra;
        if (allRun < RULES.mend.allRunNeeded && cur.extra < cap) {
          return { ...n, current: { ...cur, allRun, extra: cur.extra + 1, once: true, run: { ...newWordRun(b.entry, CODE.ALL), dropped: true, cleanStreak: allRun } } };
        }
      }
      return {
        ...n, current: null, wordsDone: s.wordsDone + 1,
        done: [...s.done, { word: w, passedAll, clean: run.endedClean, isNew: cur.isNew }],
        doneAll: passedAll ? [...s.doneAll, w] : s.doneAll,
        final: s.final || cur.last,
        needCheck: s.stone === 'hello' && cur.isNew && passedAll ? { reason: 'new', exclude: w } : null,
      };
    }
    default: return s;
  }
}

// ---- the tries to write -----------------------------------------------------------------------------------
const J = { hello: 'h', fix: 'f', mend: 'm' };
/**
 * The fields of the try (or tries) the last item made, for W.addTry (id, group, day, now, kind and the box indices `sl` are the runner's):
 * [{ word, r, j, ss, source?, rw?, tries, peeks, clean }] (exactly addTry's field names). THE CONTRACT: every Step-by-step try carries `source: 'g'` (a known value, no dots, no
 * Practice/Fix it in run) EXCEPT Mend's ladder tries (flow `f`, TR-31): without it a Meet try would count as the Normal practice round and could open the test.
 * The end-of-sitting meaning game (`then`) gives one try per card from `outcome.results` ([{ word, tries, clean }]): `source: 'm'`, `j: 'q'`, no `r`.
 * Meet, break, First/Then and the end make no try.
 */
export function triesOf(s, outcome = {}) {
  const l = s.last;
  if (!l) return [];
  const per = outcome.perWord || [];
  if (l.kind === 'row') return l.words.map((w, i) => ({ word: w.word, r: w.code, j: 'w', rw: l.size, ss: s.ss, source: 'g', tries: (per[i] || {}).tries || 0, peeks: (per[i] || {}).peeks || 0, clean: w.clean }));
  if (l.kind === 'check') return [{ word: l.word, r: l.code, j: 'k', ss: s.ss, source: 'g', tries: outcome.tries || 0, peeks: outcome.peeks || 0, clean: l.clean }];
  if (l.kind === 'then') return (outcome.results || []).map((r) => ({ word: r.word, j: 'q', ss: s.ss, source: 'm', tries: r.tries || 0, peeks: 0, clean: !!r.clean })); // the meaning game: s 'm' (stars, played), no rung, no `r`
  if (l.kind !== 'rung') return [];
  const mend = s.stone === 'mend';
  return [{ word: l.word, r: l.code, j: J[s.stone] || 'f', ss: s.ss, ...(mend ? {} : { source: 'g' }), tries: outcome.tries || 0, peeks: outcome.peeks || 0, clean: l.clean }];
}
