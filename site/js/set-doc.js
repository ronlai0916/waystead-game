// SB5-WP-A: the rules of "Set a week" and of how a week is tied to a Word list. Pure: no DOM, no storage, no clock, no random.
// The date comes in as `today`/`now`, and the six hex characters of a week id are passed in, so every test is deterministic.
// No new saved field: the list a week came from and the role that set it are carried in the week id `<oid>.<role><5hex>` (role p, u or t:
// parent, tutor, teacher) and inferred (TRS TR-12, TR-13, TR-14, TR-83).
// WP-A2 additions: weekRole, roleOfLetter, findWords, sourceOf (D27), previewFirst (D23), lengthLine, DATE_CHIPS, chipTest (D39), setByWords.
import * as W from './words-doc.js';
import * as St from './study-doc.js';
import * as Su from './setup-doc.js';
import * as Ow from './own-doc.js';
import * as K from './sbs-week-doc.js';

// ---- the lines a grown-up reads ---------------------------------------------------------------------
export const SET_TITLE = 'Set a week';
export const BACK_LINE = 'Spellbright may add up to 3 words each child found tricky before.';
export const SHORT_WEEK_LINE = 'Short week: some days will have two jobs.'; // the same text as grownups-doc.js SHORT_WEEK_LINE (a test compares the two)
export const LIST_LIMIT_LINE = 'You have ' + Ow.MAX_LISTS + ' word lists. Delete one to make another.';
export const TICK_ONE_CHILD = 'Tick at least one child.';
export const TICK_ONE_WORD = 'Tick at least one word.';
export const NO_DATE = 'Please choose a test date.';
export const COPY_ERRORS = { 'too-many': 'This child already has ' + Su.MAX_OWN + ' word lists.', bad: 'That list could not be given for practice.' };
export const SET_DONE = (name) => 'Set for ' + name + '.';
export const SET_NOT_YET = (name) => 'Not set for ' + name + ' yet.';
export const restButton = (n) => 'Set next week with the other ' + n + (n === 1 ? ' word' : ' words');
export const runningNote = (name, week, fromThisList) => (fromThisList
  ? name + ' already has a week from this list, with a test on ' + W.dayLabel(week.test) + '.'
  : name + ' already has a week running: ' + week.name + '. This adds another week.');

const lc = (w) => String(w).toLowerCase();
const isDay = (x) => /^\d{4}-\d{2}-\d{2}$/.test(x || '');
const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
const joinNames = (names) => { const n = names.filter(Boolean); return n.length <= 1 ? n.join('') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1]; };

// ---- the week id (TR-12) ------------------------------------------------------------------------------
export const WEEK_ID_RE = /^([A-Za-z0-9_-]{1,13})\.([put])([0-9a-f]{5})$/;
const LIST_WEEK_RE = /^(r[0-9a-f]{12})\.[put][0-9a-f]{5}$/;
const LETTER = { parent: 'p', tutor: 'u', teacher: 't' };
const ROLE_OF = { p: 'parent', u: 'tutor', t: 'teacher' };
const PLAN_ID_RE = /^p[0-9a-f]{12}$/;
const OLD_LIST_RE = /^r[0-9a-f]{12}$/;

/**
 * 'r…12.t9c41e' for a week made from (or typed into) a list; 'a.t9c41e' when its words came from no list. role = 'parent' | 'tutor' |
 * 'teacher' (or its letter p, u, t; anything else is parent); hex5 is passed in. At most 20 characters.
 */
export const weekId = (listOid, role, hex5) => (LIST_WEEK_RE.test(String(listOid || '') + '.p00000') ? listOid : 'a') + '.' + (LETTER[role] || (ROLE_OF[role] ? role : 'p')) + hex5;
/** The role that set a week, read from its id: 'parent' | 'tutor' | 'teacher', or '' (an older id has no role). */
export function weekRole(gid) {
  const m = WEEK_ID_RE.exec(String(gid || ''));
  return m ? ROLE_OF[m[2]] : '';
}
/** The list a week came from, read from its id: 'r…12', or '' (no list, or an older week). */
export function weekListOid(gid) {
  const m = LIST_WEEK_RE.exec(String(gid || ''));
  return m ? m[1] : '';
}
/** A week a grown-up set: a dotted id, or the old plan wizard's `p` + 12 hex. */
export const isGrownupWeek = (gid) => String(gid || '').includes('.') || PLAN_ID_RE.test(String(gid || ''));

/** The newest live week whose every word is in `words` (case does not matter), or null. A week with one outside word is not from this list. */
export function weekFor(d, words, pool = null) {
  const set = new Set((words || []).map(lc));
  const from = (pool || W.liveGroups(d)).filter((g) => g.words.length && g.words.every((w) => set.has(lc(w))));
  from.sort(newest);
  return from[0] || null;
}
const newest = (a, b) => b.at - a.at || b.test.localeCompare(a.test) || a.id.localeCompare(b.id);

/**
 * Who set a week (TR-14, TR-83), from the id and the adult's lists, no stored field.
 * 'parent' | 'tutor' | 'teacher' (a dotted id with its role letter) | 'grown-up' (the old plan id `p`+12 hex, a dotted id with no letter,
 * or an older teacher week whose words all sit in one of the lists) | 'app' (the starter) | 'child' (only a week a child made before SB5).
 */
export function setBy(gid, g, lists) {
  const id = String(gid || '');
  if (weekRole(id)) return weekRole(id);
  if (isGrownupWeek(id)) return 'grown-up';
  if (id === W.STARTER_ID) return 'app';
  if (OLD_LIST_RE.test(id) && g && g.words && g.words.length) {
    for (const l of lists || []) {
      const set = new Set((l.words || []).map(lc));
      if (g.words.every((w) => set.has(lc(w)))) return 'grown-up';
    }
  }
  return 'child';
}

/** True for every answer of setBy that means a grown-up set the week (a role, or the older 'grown-up'). */
export const isByGrownup = (by) => by === 'grown-up' || by === 'parent' || by === 'tutor' || by === 'teacher';

const wordsOfList = (lists, oid) => {
  if (!lists) return [];
  if (Array.isArray(lists)) return (lists.find((l) => l.id === oid) || { words: [] }).words || [];
  return (lists[oid] || { words: [] }).words || [];
};

/**
 * Every live week of this child that came from the list, newest first. A week whose id has the list's prefix is exact.
 * Only when no prefixed week exists do older weeks count, by the word-subset rule (weeks with a dotted id never do).
 * lists = [{ id, words }] or the own map { [oid]: { words } }; with none the fallback has no words and finds nothing.
 */
export function weeksFromList(d, oid, lists = null) {
  const live = W.liveGroups(d);
  const prefixed = live.filter((g) => weekListOid(g.id) === oid).sort(newest);
  if (prefixed.length || !oid) return prefixed;
  const words = new Set(wordsOfList(lists, oid).map(lc));
  return live.filter((g) => !String(g.id).includes('.') && g.words.length && g.words.every((w) => words.has(lc(w)))).sort(newest);
}

/** A child with a live week from this list whose test is not done: { from: true, name, test }; another running week: { from: false, ... }; none: null. */
export function runningFor(d, oid, lists = null) {
  const open = (g) => !W.testDone(d, g);
  const own = weeksFromList(d, oid, lists).find(open);
  if (own) return { from: true, name: own.name, test: own.test };
  const other = W.liveGroups(d).find(open);
  return other ? { from: false, name: other.name, test: other.test } : null;
}

// ---- the words: sources, ticks, size (TR-30) ----------------------------------------------------
export const trickyOffered = (cids) => (cids || []).length === 1;

/**
 * The places words can come from, in the order the page offers them (BR-6): the grown-up's Word lists (newest first), then
 * type and scan, then year chapters, spelling patterns and, only for one child, that child's tricky words.
 * lists: [{ id, name, at }]; years: [{ id, label }]; patterns: [{ id, label }].
 */
export function sourceOrder({ lists = [], years = [], patterns = [], oneChild = false } = {}) {
  const out = [...lists].sort((a, b) => (b.at || 0) - (a.at || 0) || String(a.name).localeCompare(String(b.name)) || String(a.id).localeCompare(String(b.id)))
    .map((l) => ({ kind: 'list', id: l.id, label: l.name }));
  out.push({ kind: 'type', id: 'type', label: 'Type words' }, { kind: 'scan', id: 'scan', label: 'Scan a paper' });
  for (const y of years) out.push({ kind: 'year', id: y.id, label: y.label });
  for (const p of patterns) out.push({ kind: 'pattern', id: p.id, label: p.label });
  if (oneChild) out.push({ kind: 'tricky', id: 'tricky', label: 'Tricky words' });
  return out;
}

/** The words to tick first: the first `max` that are not in an earlier week from this list, topped up from the used ones if fewer. List order is kept. */
export function firstTicks(listWords, usedWords, max = W.MAX_WORDS) {
  const used = new Set((usedWords || []).map(lc));
  const words = listWords || [];
  const pick = new Set();
  words.forEach((w, i) => { if (pick.size < max && !used.has(lc(w))) pick.add(i); });
  words.forEach((w, i) => { if (pick.size < max && !pick.has(i)) pick.add(i); });
  return words.filter((w, i) => pick.has(i));
}
/** The words of the list that are not ticked, in the list's order ("the other N next week"). */
export function restAfter(listWords, tickedWords) {
  const ticked = new Set((tickedWords || []).map(lc));
  return (listWords || []).filter((w) => !ticked.has(lc(w)));
}
/** '' when everything fits; else why only some are ticked. */
export function fitLine(n, max = W.MAX_WORDS) {
  return n <= max ? '' : 'A week holds ' + max + ' words. The first ' + max + ' are ticked; the other ' + (n - max) + ' can be next week.';
}

// ---- next-week defaults (TR-17), stateless ------------------------------------------------------------
/**
 * What Set a week starts with. lists: the live Word lists [{ id, name, words, at, to }]; kids: [{ id, d }] (each child's words doc).
 * cids = the `to` of the newest list that has a grown-up week in any child (only children still on the account); one child: always them.
 * test = the newest grown-up week's date + 7 when that is after today, else a week from today. oid = the newest list.
 */
export function nextDefaults({ lists = [], kids = [], today }) {
  const ids = kids.map((k) => k.id);
  const byNew = [...lists].sort((a, b) => (b.at || 0) - (a.at || 0) || String(a.id).localeCompare(String(b.id)));
  const plain = byNew.map((l) => ({ id: l.id, words: l.words }));
  const weeksOf = (l) => kids.flatMap((k) => weeksFromList(k.d, l.id, plain).filter((g) => isByGrownup(setBy(g.id, g, plain))));
  let cids = [];
  let test = '';
  for (const l of byNew) {
    const ws = weeksOf(l);
    if (!ws.length) continue;
    cids = (l.to || []).filter((id) => ids.includes(id));
    break;
  }
  const mine = kids.flatMap((k) => W.liveGroups(k.d).filter((g) => isByGrownup(setBy(g.id, g, plain)))).sort(newest);
  if (mine.length) test = W.addDays(mine[0].test, 7);
  if (!isDay(test) || test <= today) test = W.defaultTest(today);
  if (kids.length === 1) cids = [kids[0].id];
  return { cids, test, oid: byNew.length ? byNew[0].id : '' };
}

// ---- words typed or scanned in the flow become a list first (TR-16) ----------------------------------
/**
 * { make: true, words } when a NEW list must be saved from the final ticked words (typed or scanned words are among them);
 * else { make: false, oid } (a chosen list is never changed; oid is '' when the words came from no list).
 */
export function flowList({ typed = [], scanned = [], listOid = '', ticked = [] } = {}) {
  const ticks = new Set((ticked || []).map(lc));
  const own = [...typed, ...scanned].some((w) => ticks.has(lc(w)));
  if (own) {
    const seen = new Set();
    return { make: true, words: (ticked || []).filter((w) => { const k = lc(w); if (seen.has(k)) return false; seen.add(k); return true; }) };
  }
  return { make: false, oid: listOid || '' };
}
/** "Week of 24 Nov": the list's name when the flow makes one. */
export const listNameFor = (test) => 'Week of ' + W.dayLabel(test).replace(/^\w+ /, '');

/** What is wrong before anything is asked of the account ('' when nothing): one plain line. */
export function setProblem({ cids = [], words = [], test, today, listsCount = 0, needsList = false } = {}) {
  if (needsList && listsCount >= Ow.MAX_LISTS) return LIST_LIMIT_LINE;
  if (!cids.length) return TICK_ONE_CHILD;
  if (!words.length) return TICK_ONE_WORD;
  if (!isDay(test)) return NO_DATE;
  return W.createGroup(W.emptyDoc(), { id: 'check', name: 'check', test, words, today, now: 1 }).error || '';
}

/** What Set will do, in lines: who, how many words, the test date, the short-week line when it applies, and the returning-words line. */
export function previewLines({ names = [], words = [], test, today } = {}) {
  const ok = isDay(test);
  return {
    who: joinNames(names),
    words: plural(words.length, 'word'),
    date: ok ? 'Test on ' + W.dayLabel(test) : '',
    short: ok && test > today && W.daysBetween(today, test) < St.BEFORE_TEST.length ? SHORT_WEEK_LINE : '',
    back: BACK_LINE,
  };
}

// ---- the two writes, pure (TR-15, TR-18) --------------------------------------------------------------
/** Change one child's week: only the keys given are changed (W.editGroup's rules). Answers { doc } or { error }. */
export function weekChange(d, gid, { words, test, name } = {}, { today, now }) {
  const changes = {};
  if (name !== undefined) changes.name = name;
  if (words !== undefined) changes.words = words;
  if (test !== undefined) changes.test = test;
  return W.editGroup(d, gid, changes, today, now);
}

/**
 * Make one child's week and, when it came from a list, that list's copy on the child (so the child can practise it afterwards).
 * Idempotent: when the week `gid` is already in the doc (a retry after an unseen success) the doc comes back unchanged.
 * copy = { name, words, src } and copyAt = the master's `at`. Answers { doc } or { error }.
 */
export const ID_TAKEN = 'id-taken';
const wordKey = (ws) => [...new Set((Array.isArray(ws) ? ws : []).map((w) => String(w).toLowerCase()))].join('|');
export function setChange(d, { gid, name, test, words, oid = '', copy = null, copyAt = 0 }, { today, now }) {
  const have = d.groups && d.groups[gid];
  if (have) {
    // The same week again is a retry after an unseen success: nothing changes. A DIFFERENT week under the same id is a rare
    // id collision (20 random bits): answer 'id-taken' so the caller makes a new id, and never show "Set" for a week that was not made.
    if (wordKey(have.words) === wordKey(words) && (!test || have.test === test)) return { doc: d };
    return { error: ID_TAKEN };
  }
  const made = W.createGroup(d, { id: gid, name, test, words, today, now });
  if (made.error) return { error: made.error };
  if (!oid || !copy) return { doc: made.doc };
  const c = Su.setOwnCopy(W.setupOf(made.doc), oid, copy, copyAt);
  if (c.error) return { error: COPY_ERRORS[c.error] || COPY_ERRORS.bad };
  return { doc: W.withSetup(made.doc, c.setup) };
}

// ---- finding ready-made words (D27) ---------------------------------------------------------------------
const yearOfEntry = (e) => (Number.isInteger(e.year) ? e.year : Number.isInteger(+String(e.yearId || '').slice(1)) && /^y\d$/.test(e.yearId || '') ? +e.yearId.slice(1) : null);
/**
 * Search the ready-made words as the grown-up types (from the 2nd letter): words that start with the query first, then words that
 * hold it, each group in the order of `entries` (D.allWords()). -> [{ word, year }], at most `limit`; a word that is in two chapters is one match.
 */
export function findWords(query, entries, { limit = 8 } = {}) {
  const q = lc(String(query == null ? '' : query).replace(/[^A-Za-z'’-]/g, '').replace(/’/g, '\''));
  if (q.length < 2) return [];
  const seen = new Set();
  const all = (entries || []).filter((e) => e && e.word && !seen.has(lc(e.word)) && seen.add(lc(e.word)));
  const starts = all.filter((e) => lc(e.word).startsWith(q));
  const holds = all.filter((e) => !lc(e.word).startsWith(q) && lc(e.word).includes(q));
  return [...starts, ...holds].slice(0, Math.max(0, limit)).map((e) => ({ word: e.word, year: yearOfEntry(e) }));
}
/** Where a word came from, worked out and never stored: { kind: 'ready', year } for a curriculum word (findEntry), else { kind: 'typed' }. */
export function sourceOf(word, findEntry) {
  const e = typeof findEntry === 'function' ? findEntry(word) : null;
  return e ? { kind: 'ready', year: yearOfEntry(e) } : { kind: 'typed' };
}

// ---- who the child sees the week from (D26, D34) --------------------------------------------------------
/** The role in the child's words: "Set by your grown-up" and so on (also the fallback when no name has arrived). */
export const ROLE_WORD = { parent: 'your grown-up', tutor: 'your tutor', teacher: 'your teacher' };
/** "Set by Mum" with a name, else "Set by your tutor". An unknown role reads "your grown-up". */
export const setByWords = (role, name = '') => 'Set by ' + (String(name || '').trim() || ROLE_WORD[role] || ROLE_WORD.parent);

// ---- the date: chips and the length line (D39, TR-102) ----------------------------------------------------
/** The date chips: the test is this many days after the day the week is set ("In 2 days", "In 3 days", "In 5 days", "In 1 week"). */
export const DATE_CHIPS = [2, 3, 5, 7];
export const chipLabel = (n) => (n === 7 ? 'In 1 week' : 'In ' + n + ' days');
/** The test date a chip gives, from today. A weekend is not skipped. */
export const chipTest = (today, n) => W.addDays(today, n);
export const LENGTH_LINES = {
  tomorrow: 'Test tomorrow: all 5 jobs today, about 40 minutes. A later date makes it easier.',
  quick: 'Quick week: 2 or 3 jobs a day, shorter games.',
  short: 'Short week: some days have 2 jobs, shorter games.',
  even: 'One job a day.',
  long: 'Jobs spread out, with rest days.',
};
/** The one plain line under the date, from the days between today and the test (BRS-change-2 3.4); '' for no usable date. */
export function lengthLine(today, test) {
  if (!isDay(today) || !isDay(test)) return '';
  const n = W.daysBetween(today, test);
  if (n < 1) return '';
  return n === 1 ? LENGTH_LINES.tomorrow : n === 2 ? LENGTH_LINES.quick : n <= 4 ? LENGTH_LINES.short : n <= 7 ? LENGTH_LINES.even : LENGTH_LINES.long;
}

// ---- "What <child> will see first" (D23) ------------------------------------------------------------------
const STONE_ORDER = St.STEPS;
/**
 * The preview a grown-up sees before Set: the child's Today on the week's first day.
 * d = the first ticked child's words doc (used for the returning words); words/test/name as the week will be made; by = the name the
 * grown-up chose ('' for none); year = the child's year (for Game day's game count). Answers
 * { job: 'Hello words', opens: 'Sun 22 Nov', today: true, words: first 3, back, stones: [{ id, n, title, date }] (7, fixed order), days: planByDay, setBy: 'Set by Mum', kind }
 * or { error } when the week itself would be refused.
 */
export function previewFirst(d, { words = [], test, name = '', by = '', year = null } = {}, today, role = 'parent') {
  const made = W.createGroup(d || W.emptyDoc(), { id: 'preview', name: name || 'preview', test, words, today, now: 1 });
  if (made.error) return { error: made.error };
  const g = made.doc.groups.preview;
  const dates = St.stepDates({ start: g.start, test: g.test });
  return {
    job: St.STEP_TEXT.hello.title,
    opens: W.dayLabel(g.start),
    today: g.start === today,
    words: g.words.slice(0, 3),
    back: g.back,
    stones: STONE_ORDER.map((id, i) => ({ id, n: i + 1, title: St.STEP_TEXT[id].title, date: dates[id] })),
    days: St.planByDay({ start: g.start, test: g.test }, year),
    kind: St.weekKind(g),
    setBy: setByWords(role, by),
  };
}

// ---- SB6 (TR-47, D14, D24): the sittings estimate for each Step-by-step child ---------------------------------------------------------
/**
 * One line for each ticked child who is on Step by step: [{ name, line, calm }]. kids = [{ nickname, year, d }]; the words and the test date
 * as the week will be made. Children on the Usual way get none. With one such child the line has no name in front (the page already says whose it is).
 */
export function estimateLines({ kids = [], words = [], test, today } = {}) {
  if (!words.length || !isDay(test) || !isDay(today) || test < today) return [];
  const sbs = kids.filter(sbsKid);
  return sbs.map((k) => {
    const e = K.estimate(words, { minutes: Su.sbsOf(W.setupOf(k.d)).min, today, test, year: Number.isInteger(k.year) && k.year > 0 ? k.year : undefined }); // D21: every word climbs the whole ladder
    return { name: k.nickname, line: e.line, calm: e.calm, tries: e.tries, sittings: e.sittings };
  });
}
/** Does this child learn Step by step? (k = { d }) */
export const sbsKid = (k) => !!(k && k.d && Su.wayOf(W.setupOf(k.d)) === 'sbs');
/** The estimate for one child's changed week (Change a week). */
export const estimateOne = ({ nickname, year, d, words, test, today }) => estimateLines({ kids: [{ nickname, year, d }], words, test, today });
