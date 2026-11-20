// SB5 (WP-A2, TR-81, TR-84, TR-100, TR-107): the three roles a grown-up can set spellings as (parent, tutor, teacher): one engine, three
// sets of words and defaults. Pure: no DOM, no storage, no clock (today comes in), no fetch. The views read and write the role itself
// (the account's prefs.sbRole = { r, n?, at } and the device copy); nothing here touches a list, week, child or result.
//
// Exports
//   ROLES, roleOf(x) (unknown -> 'parent'), roleLetter(role) 'p'|'u'|'t', normRole(x) -> { r, n?, at } | null
//   WORDS[role]              every string a role changes (BRS-change-1 1.11); the same keys for all three roles
//   CHIPS, NAME_LINE, cleanName(s), nameHint(role, displayName)       the name children see (D34, TR-100)
//   menuRows(role)           the Menu rows: children | lists | set | help | yourself | games (parent has no help row)
//   needsHelp(kid, today)    -> [{ why: 'test'|'words'|'jobs'|'notsent', line }]; NOBODY_LINE when a class has none
//   helpList(kids, today)    -> [{ id, name, reasons }] for the kids who need help (no ranking, account order)
//   homeOrder(role, kids, today)   tutor: by need (test due, jobs waiting, words to go over, then name); others: account order
//   teacherSteps({ lists, weeks, openedResults })   the three steps panel's ticks
//   setDefaults(role, { kids, lists, today, from })  what Set a week starts with (wraps set-doc nextDefaults)
//   nextLearner(role, kids, setFor)   the tutor's "Set a week for <next learner>"
//   limitLine(role, count, limit), atLimitLine(role, count, limit), ASK_MORE   the child limit (D38, TR-107)
import * as W from './words-doc.js';
import * as St from './study-doc.js';
import * as SD from './set-doc.js';
import * as Su from './setup-doc.js';

export const ROLES = ['parent', 'tutor', 'teacher'];
export const roleOf = (x) => (ROLES.includes(x) ? x : 'parent');
const LETTERS = { parent: 'p', tutor: 'u', teacher: 't' };
export const roleLetter = (role) => LETTERS[roleOf(role)];

/** The saved role entry (prefs.sbRole), cleaned: { r, n?, at } or null when there is no usable role. */
export function normRole(x) {
  if (!x || typeof x !== 'object' || !ROLES.includes(x.r)) return null;
  const n = cleanName(x.n);
  return { r: x.r, ...(n ? { n } : {}), at: Number.isFinite(x.at) && x.at > 0 ? x.at : 0 };
}

// ---- the words each role uses (BRS-change-1 1.11) ----------------------------------------------------------
export const WORDS = {
  parent: {
    card: 'My own children',
    cardLine: 'Set spellings for your own children.',
    home: 'Your children',
    one: 'child',
    many: 'children',
    set: 'Set a week',
    all: 'All children in one table',
    help: 'Help for each child',
    seen: 'Set by your grown-up',
    empty: 'Add your first child on your account',
    nameAsk: 'What do your children call you?',
    nameExample: 'Auntie Jo',
    weekPrefix: '',
    previewFor: (name) => 'What ' + name + ' will see first',
  },
  tutor: {
    card: 'Learners I tutor',
    cardLine: 'Set spellings for learners, one at a time.',
    home: 'My learners',
    one: 'learner',
    many: 'learners',
    set: 'Set a week',
    all: 'All learners in one table',
    help: 'Help for each learner',
    seen: 'Set by your tutor',
    empty: 'Add your first learner on your account',
    nameAsk: 'What do your learners call you?',
    nameExample: 'Sam',
    weekPrefix: '',
    previewFor: (name) => 'What ' + name + ' will see first',
  },
  teacher: {
    card: 'My class',
    cardLine: 'Set one list and one test date for your class.',
    home: 'My class',
    one: 'child in your class',
    many: 'children in your class',
    set: 'Set the class week',
    all: '',
    help: 'Help for each child',
    seen: 'Set by your teacher',
    empty: 'Add the children in your class on your account',
    nameAsk: 'What does your class call you?',
    nameExample: 'Ms Patel',
    weekPrefix: 'Class week: ',
    previewFor: () => 'What the class will see first',
  },
};

// ---- the name children see (TR-100) ------------------------------------------------------------------------
/** The home's confirmation of the saved name: "Your children see you as Mum."; '' when no name is saved. */
export const seenAsLine = (role, name) => {
  const n = String(name || '').trim();
  if (!n) return '';
  const r = roleOf(role);
  return 'Set by ' + n + '. ' + (r === 'teacher' ? 'Your class' : 'Your ' + WORDS[r].many) + ' see' + (r === 'teacher' ? 's' : '') + ' this name on their weeks.';
};
export const CHIPS = ['Mum', 'Dad', 'Grandma', 'Grandad'];
export const NAME_LINE = Su.NAME_LINE;
/** trim, collapse spaces; 1 to 24 characters, 1 to 3 words, letters (any alphabet), spaces, ' . -; no @, web address or digit. Else ''. */
export const cleanName = Su.cleanName;
/** What the name box starts with: a tutor's first name (the first word of the account's name); a parent or teacher: nothing. */
export function nameHint(role, displayName) {
  if (roleOf(role) !== 'tutor') return '';
  return cleanName(String(displayName || '').trim().split(/\s+/)[0]);
}

// ---- the Menu (BR-26) ---------------------------------------------------------------------------------------
const ROW = {
  children: { href: '#/grownups' },
  lists: { title: 'Word lists', sub: 'Type or scan school spellings', href: '#/grownups/own' },
  set: { href: '#/grownups/set' },
  help: { href: '#/grownups/help' },
  yourself: { title: 'Play yourself', sub: 'Your own practice', href: '#/grownups/yourself' },
  games: { title: 'All games', sub: 'Waystead’s other games', href: '../' },
};
/** The Menu's rows for a role, in order. `id` picks the icon; every role's rows go to the same addresses. */
export function menuRows(role) {
  const r = roleOf(role);
  const w = WORDS[r];
  const rows = [
    { id: 'children', ...ROW.children, title: r === 'parent' ? 'Children' : w.home, sub: r === 'parent' ? 'Their weeks and results' : r === 'tutor' ? 'Their weeks and results' : 'Your class table' },
    { id: 'lists', ...ROW.lists },
    { id: 'set', ...ROW.set, title: w.set, sub: r === 'teacher' ? 'One list and one date for the class' : 'Words, children and a test date' },
  ];
  if (r !== 'parent') rows.push({ id: 'help', ...ROW.help, title: w.help, sub: 'How each one spells' });
  rows.push({ id: 'yourself', ...ROW.yourself }, { id: 'games', ...ROW.games });
  return rows.map((x) => ({ ...x }));
}

// ---- who needs help (BR-25 AC4) -----------------------------------------------------------------------------
export const NOBODY_LINE = 'Nobody needs extra help this week.';
export const NEEDS = { testBelow: 0.6, words: 3, jobs: 2 }; // test under 6 of 10; 3 or more words to practise again; 2 or more jobs waiting
const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);
function week(kid, today) {
  if (kid.week) return kid.week;
  return kid.d && today ? St.studyGroup(kid.d, today) : null;
}
const practiseOf = (kid, g) => (Array.isArray(kid.toPractise) ? kid.toPractise : kid.d && g ? W.slipped(kid.d, g) : []);
/**
 * Why a child needs help, for their newest week, in a fixed order: 'test' (a finished test under 6 of 10 right), 'words' (3 or more words to
 * practise again), 'jobs' (2 or more jobs waiting), 'notsent' (the week did not reach the child). [] when none.
 * kid = { d (the child's words doc), week? (a live group; else the app's pick for `today`), toPractise? (words; else the words that slipped in
 * the test), sent? (false when the week did not reach this child) }. Nobody is ranked.
 */
export function needsHelp(kid, today = (kid && kid.today) || '') {
  const out = [];
  if (!kid) return out;
  const g = week(kid, today);
  if (g && kid.d && W.testDone(kid.d, g)) {
    const rs = W.testResults(kid.d, g);
    const right = rs.filter((x) => x.result && x.result.right).length;
    if (rs.length && right < rs.length * NEEDS.testBelow) out.push({ why: 'test', line: 'Test ' + right + ' of ' + rs.length });
  }
  const p = practiseOf(kid, g);
  if (p.length >= NEEDS.words) out.push({ why: 'words', line: plural(p.length, 'word', 'words') + ' to practise again' });
  if (g && kid.d && today) {
    const waiting = St.studyState(kid.d, g, today).waiting;
    if (waiting >= NEEDS.jobs) out.push({ why: 'jobs', line: plural(waiting, 'job', 'jobs') + ' waiting' });
  }
  if (kid.sent === false) out.push({ why: 'notsent', line: 'Week not sent yet' });
  return out;
}
/** The kids who need help, in the order given: [{ id, name, reasons }]. Empty means NOBODY_LINE. */
export function helpList(kids, today) {
  return (kids || []).map((k) => ({ id: k.id, name: k.name, reasons: needsHelp(k, today) })).filter((x) => x.reasons.length);
}

// ---- the home (BR-25) ---------------------------------------------------------------------------------------
const running = (d) => !!d && W.liveGroups(d).some((g) => !W.testDone(d, g));
/**
 * The children on the home in the role's order. Parent and teacher: the account's order, never reshuffled. Tutor: by need: a test due,
 * then jobs waiting, then words to go over, then name. kids = [{ id, name, d?, week?, toPractise? }].
 */
export function homeOrder(role, kids, today) {
  const list = [...(kids || [])];
  if (roleOf(role) !== 'tutor') return list;
  const key = (k) => {
    const g = week(k, today);
    const due = !!(g && k.d && today && W.jobFor(k.d, g, today) === 'test');
    const waiting = !!(g && k.d && today && St.studyState(k.d, g, today).waiting > 0);
    const words = practiseOf(k, g).length > 0;
    return [due ? 0 : 1, waiting ? 0 : 1, words ? 0 : 1];
  };
  return list.map((k, i) => ({ k, i, key: key(k) }))
    .sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2] || String(a.k.name).localeCompare(String(b.k.name)) || a.i - b.i)
    .map((x) => x.k);
}

/**
 * The teacher's three steps (BR-25 AC3), worked out from data that exists: 1 the teacher has a Word list, 2 a class week is running
 * (weeks = [{ done? }] the children's live weeks), 3 they have opened a list's class results (`openedResults`, the device's key sb.t3:<id>;
 * absent = not done). allDone: fold the panel to "How it works: 3 steps".
 */
export function teacherSteps({ lists = [], weeks = [], openedResults = false } = {}) {
  const steps = [
    { n: 1, title: 'Make the class list', done: (lists || []).length > 0 },
    { n: 2, title: 'Set the class week', done: (weeks || []).some((w) => w && !w.done) },
    { n: 3, title: 'See who needs help', done: !!openedResults },
  ];
  const allDone = steps.every((s) => s.done);
  return steps.map((s) => ({ ...s, allDone }));
}

// ---- Set a week (TR-84, BR-27) -------------------------------------------------------------------------------
/**
 * What Set a week starts with: { cids, test, oid, name, tricky, title }.
 *   teacher: every child ticked, one date, name "Class week: <list>", no tricky words, title "Set the class week".
 *   tutor: ONE learner (`from`, else the first with no week running, else the first), the learner's own lists first (a list whose `to` holds them),
 *     a date a week after that learner's last week.
 *   parent: `from` (a child card) ticks that child; else last time's children (set-doc nextDefaults).
 * kids = [{ id, d }]; lists = [{ id, name, words, at, to }].
 */
export function setDefaults(role, { kids = [], lists = [], today, from = '' } = {}) {
  const r = roleOf(role);
  const base = SD.nextDefaults({ lists, kids, today });
  const listName = (oid) => (lists.find((l) => l.id === oid) || {}).name || '';
  const make = (cids, test, oid) => ({
    cids, test, oid, tricky: SD.trickyOffered(cids) && r !== 'teacher',
    name: r === 'teacher' && listName(oid) ? WORDS.teacher.weekPrefix + listName(oid) : '', title: WORDS[r].set,
  });
  if (r === 'teacher') return make(kids.map((k) => k.id), base.test, base.oid);
  if (r === 'tutor') {
    const kid = kids.find((k) => k.id === from) || kids.find((k) => !running(k.d)) || kids[0];
    if (!kid) return make([], base.test, base.oid);
    const mine = [...lists].filter((l) => (l.to || []).includes(kid.id)).sort((a, b) => (b.at || 0) - (a.at || 0) || String(a.id).localeCompare(String(b.id)));
    const own = SD.nextDefaults({ lists, kids: [kid], today });
    return make([kid.id], own.test, mine.length ? mine[0].id : base.oid);
  }
  const cids = from && kids.some((k) => k.id === from) ? [from] : base.cids;
  return make(cids, base.test, base.oid);
}
/** The tutor's next step on the done screen: the first kid (in order) not just set and with no week running; null when none (always null for a teacher). */
export function nextLearner(role, kids, setFor = []) {
  if (roleOf(role) === 'teacher') return null;
  const done = new Set(setFor || []);
  return (kids || []).find((k) => !done.has(k.id) && !running(k.d)) || null;
}

// ---- the teacher's bottom band when a class week already exists (UAT3 H4) ---------------------------------------
/**
 * What the class home's bottom band says. tests = the test dates (YYYY-MM-DD) of the weeks still running; ended = how many children's
 * weeks are finished; dayLabel(iso) -> "Fri 27 Nov". With no week at all it is the first-week wording; with a week it says that week's
 * state and offers the next one, so it never reads as if nothing is running.
 */
export function classBand({ tests = [], ended = 0, n = 0, today = '', dayLabel = (x) => x } = {}) {
  const running = tests.filter(Boolean).sort();
  if (!running.length && !ended) return { label: WORDS.teacher.set, line: 'All ' + n + ' children ticked, one test date' };
  if (!running.length) return { label: 'Set next week', line: 'The class test is done · pick a new list and date' };
  const t = running[0];
  const when = t === today ? 'The class test is today' : t < today ? 'The class test date has passed' : 'Class week running · test ' + dayLabel(t);
  return { label: 'Set next week', line: when + ' · the next week starts after it' };
}

// ---- the child limit (D38, TR-107) ----------------------------------------------------------------------------
export const ASK_MORE = 'Ask for more places';
/** The same title in the tutor's word: learners, not places. */
export const askMoreFor = (role) => (roleOf(role) === 'tutor' ? 'Ask for more learners' : ASK_MORE);
/** The ask page's sentence. With no address given (ASK_EMAIL empty) it never says "email us": it points at the Waystead account. */
export const askLine = (many, hasEmail) => (hasEmail
  ? 'To add more ' + many + ', email us and say how many ' + (many === 'learners' ? 'learners' : 'places') + ' you need. We will reply by email.'
  : 'To add more ' + many + ', ask on your Waystead account. Open it with the button below and say how many ' + (many === 'learners' ? 'learners' : 'places') + ' you need.');
/** "You have 3 of 5 places." (parent, teacher) or "You have 3 of 5 learners." (tutor). */
export const placesLine = (role, n, limit) => 'You have ' + n + ' of ' + limit + ' ' + (roleOf(role) === 'tutor' ? 'learners' : 'places') + '.';
/** "3 of 5 children", "3 of 15 learners", "5 of 15 children in your class". Quiet text, not a bar. */
export const limitLine = (role, count, limit) => count + ' of ' + limit + ' ' + WORDS[roleOf(role)].many;
/** What is said at the limit, before ASK_MORE: "Your plan holds 5 children."; a teacher with more children than places says so. */
export function atLimitLine(role, count, limit) {
  const r = roleOf(role);
  if (r === 'teacher' && count > limit) return 'You have ' + count + ' children in your class and your plan holds ' + limit + '.';
  return 'Your plan holds ' + limit + ' ' + (r === 'tutor' ? 'learners' : 'children') + '.';
}
