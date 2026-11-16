// SB4-WP11: the teacher page, the rules and the wording. Pure: no DOM, no storage, no clock, no random. The date comes in
// as `today` / `day`, every child's data as arguments. One own chapter (own-doc.js) is shown across the children it is shared
// with; nothing here is saved, and no new field is made. The page is teach-views.js.
import * as W from './words-doc.js';
import * as Ow from './own-doc.js';
import * as PR from './progress-doc.js';
import * as P from './grownups-doc.js';
import * as F from './front-doc.js';
import * as A from './assess-doc.js';

// ---- the lines a grown-up reads (exact strings: HF check section 5, then the BA's section 5) ------------------
export const TITLE = 'For teachers and tutors';
export const LEDE = 'Give up to 5 children the same list, set the test, and see how each one did.';
export const SCOPE_LINE = 'Your account holds up to 5 children. Whole classes are not here yet.';
export const PERMISSION_LINE = 'Only add children whose parents or carers have agreed.';
export const STEPS = [
  { n: 1, title: 'Make the list' },
  { n: 2, title: 'Share it with your children', text: 'Choose them when you save the list.' },
  { n: 3, title: 'Set the test and see results', text: 'Open a list below.' },
];
export const NO_LISTS = 'No lists yet. Make one above.';
export const NOT_SHARED_YET = 'Not shared yet';
export const HELP_CAPTION = 'How each child spells. Change it on the child\'s page.';
export const HEADINGS = { lists: 'Your lists', help: 'Help for each child', each: 'Each child', words: 'The words', set: 'Set this week\'s test', share: 'Print and share' };
export const GONE = 'That list isn\'t here any more.';
export const OFFLINE = 'You\'re offline. You can see results when you\'re back online.';
export const NO_WEEK = 'No week set from this list';
export const NO_TEST = 'Not taken yet';
export const NO_QUIZ = 'No quiz yet';
export const NONE_NOTED = 'None noted yet';
export const NO_ONE = 'No one noted';
export const WORDS_CAPTION = 'Which words to go over together.';
export const KEY_LINE = 'Words to practise come from the newest quiz, this week\'s practice and test, and the tricky-words list. Only what has been saved is shown.';
export const KEEP_SAFE = 'Printed or copied results show children\'s names. Keep them safe.';
export const NOBODY_NOW = 'Not started by anyone yet';
// Set this week's test
export const SET_LINE = 'Each child practises these words in the game every day, then takes the test on the test date.';
export const TRICKY_LINE = 'Spellbright may add up to 3 words each child found tricky before.';
export const TICK_ONE_CHILD = 'Tick at least one child.';
export const TICK_ONE_WORD = 'Tick at least one word.';
export const PICK_LEGEND = 'Pick ' + W.MAX_WORDS + ' for this week';
export const COPIED = 'Copied.';
export const COPY_FAILED = 'Couldn\'t copy. You can print instead.';

const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
/** "Robin", "Robin and Wren", "Robin, Wren and Ada". */
export function joinNames(names, joiner = 'and') {
  const n = names.filter(Boolean);
  return n.length <= 1 ? n.join('') : n.slice(0, -1).join(', ') + ' ' + joiner + ' ' + n[n.length - 1];
}
export const wordsLine = (n) => plural(n, 'word');
export const sharedLine = (names) => (names.length ? 'Shared with ' + joinNames(names) : NOT_SHARED_YET);
export const headLine = (n, names) => wordsLine(n) + ' · ' + (names.length ? 'shared with ' + joinNames(names) : 'not shared yet');
export const printOneLine = (n, name) => wordsLine(n) + ' · ' + name;
export const printedLine = (day) => 'Printed on ' + W.dayLabel(day).replace(/^\w+ /, '') + ' ' + day.slice(0, 4);
export const notSentLine = (name) => 'Not sent to ' + name + ' yet.';
export const notReachedLine = (names) => 'It hasn\'t reached ' + joinNames(names, 'or') + ' yet.';
export const attemptsLine = (n) => 'Taken ' + plural(n, 'time');
export const seeChildLine = (name) => 'See ' + P.possessive(name) + ' page';
export const changeSpellLabel = (name) => 'Change how ' + name + ' spells';
export const onePrintLine = (name) => 'Only ' + P.possessive(name) + ' results will print or copy. Use this when you share with one family.';
export const setDone = (name) => 'Set for ' + name + '.';
export const setFailed = (name) => 'Not set for ' + name + ' yet.';
export const pickLine = (n) => n + ' of ' + W.MAX_WORDS + ' ticked.' + (n >= W.MAX_WORDS ? ' Untick one to choose another.' : '');
/** After a successful Set: who was set, and why the button now waits (every child has a week from this list). */
export const weekSetFor = (names) => 'Week set for ' + joinNames(names) + '.';
export const ALL_HAVE_WEEK = 'All of these children already have a week from this list.';
export const SET_BUTTON_PLAIN = 'Set the test';
export const setButton = (n) => 'Set the test for ' + plural(n, 'child', 'children');
export const hasWeekFromList = (name, test) => name + ' already has a week from this list, with a test on ' + W.dayLabel(test) + '.';
export const hasOtherWeek = (name, week) => name + ' already has a week running: ' + week + '. This adds another week.';

// ---- lists and their children --------------------------------------------------------------------------------
/** Every live own chapter, newest first. */
export const liveLists = (own) => Ow.live(own).sort((a, b) => b.at - a.at || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

const lc = (w) => String(w).toLowerCase();

/** The newest live week whose every word is in `words` (case does not matter), or null. A week with one outside word is not from this list. */
export function weekFor(d, words, pool = null) {
  const set = new Set((words || []).map(lc));
  const from = (pool || W.liveGroups(d)).filter((g) => g.words.length && g.words.every((w) => set.has(lc(w))));
  from.sort((a, b) => b.at - a.at || b.test.localeCompare(a.test) || a.id.localeCompare(b.id));
  return from[0] || null;
}

/** Words of the list to go over, in the list's order, no repeats: missed in the newest quiz, needing help or not right in the week, or tricky. */
export function toPractise({ words, quizMiss = [], weekHelp = [], tricky = [] }) {
  const want = new Set([...quizMiss, ...weekHelp, ...tricky].map(lc));
  const seen = new Set();
  const out = [];
  for (const w of words || []) {
    const k = lc(w);
    if (want.has(k) && !seen.has(k)) { seen.add(k); out.push(w); }
  }
  return out;
}

/** "Test" or "Quiz (practice)" at the front of a result line is dropped on the page: the column says which it is. */
const bare = (line) => line.replace(/^(Test|Quiz \(practice\)) · /, '');

/**
 * One child's results on one list, only from what the account holds (no new saved data). master = the grown-up's own entry
 * { name, words, at, to }; d = the child's words doc; progress = their progress doc; setup = their setup.
 * Answers { has: 'sent' | 'behind', stage: { key, label }, studied, practised, test: { line, passed, attempts } | null,
 *           quiz: line | null, week: { id, name, test, line, done } | null, toPractise: [word] }
 */
export function childResult({ oid, master, d, progress, setup, today, childId = 'c' }) {
  const row = Ow.delivery({ [oid]: master }, { [childId]: setup || {} }).find((r) => r.oid === oid && r.childId === childId);
  const has = row && row.state === 'sent' ? 'sent' : 'behind';
  const cp = PR.chapterProgress(progress, 'own-' + oid);
  const key = F.stoneState(cp);
  const t = P.chapterTestLine(progress, { id: 'own-' + oid }, '');
  const run = PR.checksOf(progress, 'q:own-' + oid).runs[0] || null;
  const quiz = run ? bare(A.resultLine({ kind: 'quiz', scope: '', right: run.s, of: run.t, pf: run.pf, lv: run.lv, hr: run.hr, hn: run.hn, pk: run.pk })) : null;
  const g = weekFor(d, master.words);
  let week = null;
  let weekHelp = [];
  if (g) {
    const done = W.testDone(d, g);
    const line = done ? (P.weekTestLine(d, g) || g.name + ' test') : 'Test on ' + W.dayLabel(g.test) + ' · ' + P.weekCard(d, g, today).chip.label;
    week = { id: g.id, name: g.name, test: g.test, line, done };
    weekHelp = [...P.weekWords(d, g, today).filter((x) => x.status === 'help').map((x) => x.word), ...W.slipped(d, g)];
  }
  return {
    has,
    stage: { key, label: P.stateText(key) },
    studied: !!cp.studied,
    practised: !!cp.practised,
    test: t ? { line: bare(t.line), passed: !!t.passed, attempts: cp.attempts } : null,
    quiz,
    week,
    toPractise: toPractise({ words: master.words, quizMiss: run && Array.isArray(run.miss) ? run.miss : [], weekHelp, tricky: PR.trickyWords(progress).map((x) => x.word) }),
  };
}

/** A child with a live week whose test is not done: from this list (HF M12) or another one. Answers null, or { from: true|false, name, test }. */
export function runningWeek(d, words) {
  const live = W.liveGroups(d).filter((g) => !W.testDone(d, g));
  const own = weekFor(d, words, live); // the newest week from this list that is still running (an older one counts when a newer one is tested)
  if (own) return { from: true, name: own.name, test: own.test };
  const other = live[0];
  return other ? { from: false, name: other.name, test: other.test } : null;
}

/** A child who already has a week from this list that is not tested yet starts unticked; everyone else is ticked. */
export const startsTicked = (running) => !(running && running.from);
/** The line under a child in the Set this week's test card, or ''. */
export function runningLine(name, running) {
  if (!running) return '';
  return running.from ? hasWeekFromList(name, running.test) : hasOtherWeek(name, running.name);
}

// ---- the summary on a list card -----------------------------------------------------------------------------------
/** counts: { passed, studying, todo, notSent }. Only the non-zero parts, in the order passed, studying, to do, not sent yet. */
export function summaryLine(counts) {
  const c = counts || {};
  const parts = [];
  if (c.passed) parts.push(c.passed + ' passed');
  if (c.studying) parts.push(c.studying + ' studying');
  if (c.todo) parts.push(c.todo + ' to do');
  if (c.notSent) parts.push(c.notSent + ' not sent yet');
  return parts.length ? parts.join(' · ') : NOBODY_NOW;
}

/**
 * One summary for each live list. resultOf(oid, childId) answers that child's childResult for the list, or null when their data
 * could not be read (they are left out of the counts); kidIds = the children still on the account (others are skipped).
 * `read` is how many children were counted.
 */
export function listSummary(own, resultOf, kidIds) {
  const ids = new Set(kidIds || []);
  return liveLists(own).map((e) => {
    const to = e.to.filter((id) => ids.has(id));
    const counts = { passed: 0, studying: 0, todo: 0, notSent: 0 };
    let read = 0;
    for (const id of to) {
      const r = resultOf(e.id, id);
      if (!r) continue;
      read += 1;
      if (r.has !== 'sent') counts.notSent += 1;
      else counts[r.stage.key === 'todo' ? 'todo' : r.stage.key] += 1;
    }
    return { id: e.id, name: e.name, n: e.words.length, to, counts, read };
  });
}

// ---- the words, one row each ------------------------------------------------------------------------------------------
/** [{ word, names: [childName] }] in the list's order (never by "worst"). results: [{ name, toPractise: [word] }]. */
export function wordRows(words, results) {
  return (words || []).map((w) => ({ word: w, names: (results || []).filter((r) => (r.toPractise || []).some((x) => lc(x) === lc(w))).map((r) => r.name) }));
}
export const wordRowLine = (names) => (names.length ? 'To practise: ' + names.join(', ') : NO_ONE);

// ---- the Set this week's test card --------------------------------------------------------------------------------
/** The words picked for the week: all of them up to 10; more than 10 start with the first 10 ticked. */
export const firstPick = (words) => (words || []).slice(0, W.MAX_WORDS);
/** What is wrong with a plan before anything is asked of the account ('' when nothing). */
export function planProblem({ words, test, name, today }) {
  if (!words.length) return TICK_ONE_WORD;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(test || '')) return 'Please choose a test date.';
  const r = W.createGroup(W.emptyDoc(), { id: 'check', name, test, words, today, now: 1 });
  return r.error || '';
}
export const isShort = (today, test) => /^\d{4}-\d{2}-\d{2}$/.test(test || '') && test > today && P.isShortWeek(today, test);

// ---- print and copy -----------------------------------------------------------------------------------------------------
const yn = (b) => (b ? 'Yes' : 'Not yet');
/**
 * Plain text for the whole page or one child. rows: [{ cid, name, year, result | problem }]. `only` = a child id, or ''.
 * With `only`, no other child's name appears and the word rows are left out.
 */
export function reportText({ listName, day, rows, words, only = '' }) {
  const shown = only ? rows.filter((r) => r.cid === only) : rows;
  const out = [listName, printedLine(day).replace(/^Printed on /, ''),
    only ? printOneLine(words.length, (shown[0] || {}).name || '') : headLine(words.length, rows.map((r) => r.name)), ''];
  for (const r of shown) {
    out.push(r.name + (r.year ? ' (Year ' + r.year + ')' : ''));
    const x = r.result;
    if (!x) { out.push(r.problem ? P.PROBLEM_TEXT[r.problem] || P.PROBLEM_TEXT.other : ''); out.push(''); continue; }
    out.push('Has the list: ' + (x.has === 'sent' ? 'Yes' : notSentLine(r.name)));
    out.push('Stage: ' + x.stage.label + '. Learned the words: ' + yn(x.studied) + '. Practised: ' + yn(x.practised));
    out.push('Chapter test: ' + (x.test ? x.test.line + (x.test.passed ? ' · Passed' : '') + ' · ' + attemptsLine(x.test.attempts) : NO_TEST));
    out.push('Newest quiz: ' + (x.quiz || NO_QUIZ));
    out.push('This week\'s test: ' + (x.week ? x.week.line : NO_WEEK));
    out.push('Words to practise: ' + (x.toPractise.length ? x.toPractise.join(', ') : NONE_NOTED));
    out.push('');
  }
  if (!only) {
    out.push(HEADINGS.words);
    for (const w of wordRows(words, shown.filter((r) => r.result).map((r) => ({ name: r.name, toPractise: r.result.toPractise })))) out.push(w.word + ': ' + wordRowLine(w.names));
    out.push('');
  }
  out.push(KEY_LINE, KEEP_SAFE);
  return out.join('\n');
}
