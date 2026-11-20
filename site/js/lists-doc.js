// SB5 (WP-E): the pure rules and wording of the Word lists pages (TR-43, TR-45, TR-98, TRS-change-2 6.7): the line on each library card
// for each role, what a typed word's row says about its sentences, why the sentence panel shows the typing box, and how a list's `info`
// is changed. No DOM, no storage, no clock (the day comes in), no fetch. own-views.js and results-views.js draw it.
import * as W from './words-doc.js';
import * as Ow from './own-doc.js';
import * as I from './info-doc.js';
import * as SN from './sentences-data.js';
import { possessive } from './grownups-doc.js';

export const MAX_LISTS_LINE = (n) => n + ' of ' + Ow.MAX_LISTS + ' lists';
export const NOT_GIVEN = 'Not given to anyone yet';
export const OFFLINE_UNKNOWN = 'Not known while offline';
export const OFFLINE_GIVEN = 'Given for practice · names show when you are online';
/** S7 (FAT m-3): offline the children are not read, so "not given" cannot be said. The device's own record (`to`) says given or not known. */
export const offlineLine = (givenCount) => (givenCount ? OFFLINE_GIVEN : OFFLINE_UNKNOWN);
export const NOT_SET = 'Not set yet';
export const OFFLINE_LIST = 'You are offline. Lists you make now are kept on this phone and sent when you are back online.';
export const KEEP_SAFE_LINE = 'Printed or copied results show children\'s names. Keep them safe.';

const join = (names) => (names.length <= 1 ? names.join('') : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]);
const short = (day) => W.dayLabel(day).replace(/^\w+ /, '');

/** "tested 20 Nov" once the date has come, "test Fri 27 Nov" before. */
export const testPart = (test, today) => (test ? (today && test < today ? 'tested ' + short(test) : 'test ' + W.dayLabel(test)) : '');

/**
 * The line under a list's name on its card.
 * role: parent | tutor | teacher. toNames: the names of the children it is given to. weeks: [{ name, test }] for the children whose newest
 * week came from this list (newest first). today: 'YYYY-MM-DD'.
 */
export function cardLine(role, { toNames = [], weeks = [], today = '' } = {}) {
  const set = [...new Set(weeks.map((w) => w.name))];
  const newest = weeks[0];
  if (role === 'teacher') {
    if (!newest) return NOT_SET;
    const n = Math.max(toNames.length, set.length);
    return 'Class week: ' + W.dayLabel(newest.test) + ' · ' + n + (n === 1 ? ' child' : ' children');
  }
  const given = set.length
    ? 'Week set for ' + join(set) + ' · ' + testPart(newest.test, today)
    : toNames.length ? 'Given for practice to ' + join(toNames) : NOT_GIVEN;
  if (role === 'tutor' && toNames.length === 1) {
    return possessive(toNames[0]) + ' list' + (set.length ? ' · ' + (newest && today && newest.test < today ? 'tested ' + short(newest.test) : 'week set for ' + toNames[0]) : '');
  }
  return given;
}

/** The name of a copy: "Copy of X", kept within the name limit. */
export const copyName = (name) => ('Copy of ' + String(name || '')).slice(0, Ow.MAX_NAME).trim();

// ---- own words and their sentences (TR-98, 02b13-02b15) ------------------------------------------------------------
/** The statements a grown-up has not removed, for a word. gen = { status, statements }; info = the list's info entry for the word. */
export const visibleFor = (gen, entry) => SN.visible((gen && gen.statements) || [], (entry && entry.x) || []);

/** 'making' | 'ready' | 'own' | 'failed' | 'none' for a typed word's row. */
export function sentenceState(gen, entry) {
  if (gen && gen.status === 'making') return 'making';
  if (visibleFor(gen, entry).length) return 'ready';
  if (entry && entry.s) return 'own';
  if (gen && gen.status === 'failed') return 'failed';
  return 'none';
}
/** The words of a row's second line (after "Typed by you"), and the one button that goes with it. */
export function stateLine(state, { word = '', n = 0 } = {}) {
  switch (state) {
    case 'making': return { text: 'Making sentences…', actions: [] };
    case 'ready': return { text: n + (n === 1 ? ' sentence' : ' sentences') + ' ready', actions: [{ id: 'see', label: 'See them' }] };
    case 'own': return { text: 'Your sentence', actions: [{ id: 'see', label: 'See it' }] };
    case 'failed': return { text: 'We couldn’t make sentences for ' + word + ' yet', whole: true, actions: [{ id: 'retry', label: 'Try again' }, { id: 'see', label: 'Write your own' }] };
    default: return { text: 'No sentence yet', actions: [{ id: 'see', label: 'Add one' }] };
  }
}
/** What the sentence maker's allowance says when it will not make sentences now: the row offers the typing box, with the reason for the note. */
export const genFromAllowance = (al) => ({ status: 'none', statements: [], why: al.why, ...(al.left != null ? { left: al.left } : {}), ...(al.limit != null ? { limit: al.limit } : {}) });
/** A call that did not answer: offline is not a failure of the maker (the box says so); anything else is "We couldn't make sentences" with Try again. */
export const genFromProblem = (problem) => (problem === 'offline' || problem === 'off' ? { status: 'none', statements: [], why: problem } : { status: 'failed', statements: [], why: problem === 'timeout' ? 'timeout' : 'failed' });
/** One answered word (sentences-data askFor item) -> the row's state; no item at all is a failure. 'writing' stays 'making' until fetched. */
export function genFromItem(it) {
  if (!it) return { status: 'failed', statements: [], why: 'failed' };
  if ((it.status === 'ok' || it.status === 'partial') && it.statements && it.statements.length) return { status: 'ready', statements: it.statements };
  if (it.status === 'writing') return { status: 'making', statements: [] };
  if (it.status === 'refused') return { status: 'none', statements: [], why: 'refused' };
  return { status: 'failed', statements: [], why: 'failed' };
}
/** How many of the typed (not ready-made) words have no sentence from anyone yet. */
export function missingCount(words, { isReady, info = {}, gens = {} } = {}) {
  return words.filter((w) => !(isReady && isReady(w)) && sentenceState(gens[w], info[w]) !== 'ready' && sentenceState(gens[w], info[w]) !== 'own').length;
}

/** The note above the typing box when the maker is not in play: { head, tail }. why: off | offline | timeout | paused | monthly-limit | hourly-limit | refused | failed | ''. */
export function typingNote(why, { online = true, left = null, limit = null } = {}) {
  if (!online) return { head: 'You are offline.', tail: ' You can still write and save this sentence. It is kept on this phone and goes with the list when you are back online.' };
  switch (why) {
    case 'off': return { head: 'New sentences are switched off for now.', tail: ' Words already in our bank still work, and you can write your own.' };
    case 'offline': case 'timeout': return { head: 'You are offline.', tail: ' We make sentences when you are back online. Your list is kept on this phone, and you can write your own now.' };
    case 'paused': case 'monthly-limit': return { head: 'New sentences are used up this month', tail: (limit ? ' (' + (limit - (left || 0)) + ' of ' + limit + ')' : '') + '. Words already in our bank still work, and you can write your own.' };
    case 'hourly-limit': return { head: 'That is a lot of sentences for now.', tail: ' Try again in a little while, or write your own.' };
    case 'refused': return { head: 'We can’t make sentences for that word.', tail: ' Every sentence has to be safe for children, so some words are left out. You can write one yourself.' };
    case 'failed': return { head: 'We couldn’t make sentences for that word yet.', tail: ' You can try again later, or write your own.' };
    default: return null;
  }
}
export const CHECKING_LINE = 'One moment, checking the last word. This one is next.';
/** A tutor's pages say "learner(s)", never "child(ren)". Applied to a line that is shared with the other roles. */
export const asRole = (text, role) => (role === 'tutor'
  ? String(text).replace(/\bchildren\b/g, 'learners').replace(/\bChildren\b/g, 'Learners').replace(/\bchild\b/g, 'learner').replace(/\bChild\b/g, 'Learner')
  : String(text));
/** The editor's foot line about sentences. Maker on: it makes them. Maker off (ships off): say what really happens. */
export const sentenceFoot = (off) => (off
  ? 'Sentences: for a word you type, you write a sentence yourself. Words we already have use ready-made ones.'
  : 'Sentences are made for words you type.');
/** Add "Also:" help to the everyday-words line (03l4). */
export const EVERYDAY_EXTRA = ' Also: 4 to 15 words, at most 90 letters, and no web addresses or @.';
export const explain = (line) => (line === I.LINES.everyday ? { head: line, tail: EVERYDAY_EXTRA } : { head: line, tail: '' });

export const PANEL_INTRO_OWN = 'Used in Fill in the blanks or Mix and match, never the same sentence in both in a week. Nothing is added until you save.';
export const PANEL_INTRO_MADE = 'Made for you for Fill in the blanks and Mix and match. They were checked first. Your children only see the ones you keep.';
export const PANEL_REMOVED = 'A removed sentence is never shown to your children. A sentence used in Fill in the blanks is not used again in Mix and match that week.';
export const REPORTED = { head: 'Reported.', tail: ' That sentence is hidden for you and we will look at it.' };
export const sentencesFoot = (n) => n + (n === 1 ? ' sentence' : ' sentences') + ' · used as soon as they are ready';

// ---- changing a list's `info` (immutable) --------------------------------------------------------------------------
/** A new info with `patch` ({ s?, m?, x? }) applied to one word; '' removes s or m; an entry with nothing left is dropped; no `{}` (undefined). */
export function editInfo(info, word, patch = {}) {
  const next = { ...(info || {}) };
  const e = { ...(next[word] || {}) };
  for (const k of ['s', 'm']) if (k in patch) { if (patch[k]) e[k] = patch[k]; else delete e[k]; }
  if ('x' in patch) { if (patch.x && patch.x.length) e.x = patch.x.slice(0, 5); else delete e.x; }
  if (Object.keys(e).length) next[word] = e; else delete next[word];
  return Object.keys(next).length ? next : undefined;
}
/** Hide one generated statement (the id goes in `x`, at most 5 kept, the newest). */
export function hideId(info, word, id) {
  const x = [...((info && info[word] && info[word].x) || [])].filter((i) => i !== id);
  x.push(id);
  return editInfo(info, word, { x: x.slice(-5) });
}
/** Does this info fit the list (own-doc's rules and the 400 byte budget)? -> { ok, info } | { ok: false, line }. */
export function fitInfo(info, words, isReady) {
  if (!info) return { ok: true, info: undefined };
  const clean = I.cleanInfo(info, words, { isReady, noBudget: true });
  if (clean && I.infoBytes(clean) > I.MAX_INFO_BYTES) return { ok: false, line: I.LINES.shorter };
  return { ok: true, info: clean };
}
/** Words that left the list take their info with them. */
export const infoFor = (info, words, isReady) => I.cleanInfo(info, words, { isReady, noBudget: true });

// ---- results (TR-45) -----------------------------------------------------------------------------------------------
export const RESULTS_TABS = { results: 'Class results', words: 'The words' };
export const NEEDS_HELP_HEAD = 'Needs help';
export const NO_HELP = '–';
/** The line under the heading of a results page. */
export function resultsHead(role, { n = 0, names = [], test = '' } = {}) {
  const words = n + (n === 1 ? ' word' : ' words');
  if (role === 'teacher') return words + ' · class week' + (test ? ', test ' + W.dayLabel(test) : '') + ' · ' + names.length + (names.length === 1 ? ' child' : ' children');
  return words + ' · ' + (names.length ? 'given for practice to ' + join(names) : 'not given for practice yet');
}

// ---- did you mean (E16, 02b9) ------------------------------------------------------------------------------------------
/** Letters to change, add or take out to turn a into b (stops early once it is over `cap`). */
export function editDistance(a, b, cap = 3) {
  const x = String(a);
  const y = String(b);
  if (Math.abs(x.length - y.length) > cap) return cap + 1;
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= y.length; j += 1) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[y.length];
}
/**
 * The ready-made word a refused word was probably meant to be: one letter away (two for a word of 5 letters or more), the closest
 * first, the same first letter before a different one, then the order of the list. '' when nothing is near. Pure: the candidates come in.
 */
export function suggestWord(word, candidates = [], { skip = [] } = {}) {
  const w = String(word || '').trim().toLowerCase();
  if (w.length < 3 || !/^[a-z'’-]+$/.test(w)) return '';
  const max = w.length >= 5 ? 2 : 1;
  const no = new Set(skip.map((s) => String(s).toLowerCase()));
  let best = null;
  for (const c of candidates) {
    const cl = String(c).toLowerCase();
    if (cl === w || no.has(cl)) continue;
    const d = editDistance(w, cl, max);
    if (d < 1 || d > max) continue;
    const score = d * 10 + (cl[0] === w[0] ? 0 : 5);
    if (!best || score < best.score || (score === best.score && cl < best.word.toLowerCase())) best = { word: c, score };
  }
  return best ? best.word : '';
}
export const didYouMean = (w) => 'Did you mean “' + w + '”?';

// ---- a list's own page (03a, 03b), Give for practice (03e, 03g), copies (03c, 03f) ----------------------------------------------
export const PAGE = {
  copyThis: 'Copy this list',
  copyHelp: 'Copy this list makes a new list you can change. This one stays as it is.',
  editWords: 'Edit words',
  give: 'Give for practice',
  giveHelp: 'The child can practise these words any time. No test and no daily jobs.',
  results: 'Results',
  noResults: 'No results yet. Results show after a child practises these words.',
  givenTo: 'Given to',
  words: 'Words',
  deleteList: 'Delete this list',
  undo: 'Undo',
  giveElse: 'Give to someone else',
  hasWeek: 'Already has it for a week. Nothing to add.',
  hasIt: 'Already has it for practice.',
  allKids: 'All children who can have it',
  cancel: 'Cancel',
};
export const madeLine = (n, madeDay, today) => n + (n === 1 ? ' word' : ' words') + ' · made ' + (madeDay === today ? 'today' : W.dayLabel(madeDay).replace(/^\w+ /, ''));
/** "first 10 words" or "10 of 15 words" or "10 words", for a week taken from a list of `listN` words. */
export const weekSize = (weekWords, listWords) => {
  const n = weekWords.length;
  if (!listWords || listWords.length <= n) return n + (n === 1 ? ' word' : ' words');
  return weekWords.every((w, i) => String(listWords[i]).toLowerCase() === String(w).toLowerCase()) ? 'first ' + n + (n === 1 ? ' word' : ' words') : n + ' of ' + listWords.length + ' words';
};
/** One child's line under "Given to": the week (newest) or practice only. week = { start, test, words } | null. */
export function givenLineFor(week, listWords, today) {
  if (!week) return 'Practice only';
  return 'Week of ' + W.dayLabel(week.start) + ' · ' + weekSize(week.words, listWords) + ' · ' + testPart(week.test, today);
}
export const givePageLine = (n) => 'Who can practise these ' + n + (n === 1 ? ' word' : ' words') + '? No test and no daily jobs.';
export const giveButton = (n) => (n === 0 ? 'Give for practice' : 'Give to ' + n + (n === 1 ? ' child' : ' children'));
export const givenTitle = (names) => 'Given for practice to ' + join(names);
export const givenHelp = (names) => join(names) + (names.length === 1 ? ' can' : ' can') + ' practise these words any time, in Practice, under “From your grown-up”. No test and no daily jobs.';
/** Words taken out of and put into a copy, compared without case. */
export function copyDiff(before, after) {
  const lc = (w) => String(w).toLowerCase();
  const a = new Set(before.map(lc));
  const b = new Set(after.map(lc));
  return { out: before.filter((w) => !b.has(lc(w))), in: after.filter((w) => !a.has(lc(w))) };
}
export const COPY = {
  title: 'Edit a copy',
  stays: (src) => src + ' stays as it is. Your changes go in the copy.',
  nameLabel: 'Name of the copy',
  wordsLabel: 'Words, one on each line',
  save: 'Save the copy',
  then: 'Then pick children and a date',
  saved: 'Copy saved',
  unchanged: (src) => src + ' is unchanged.',
  results: (names, src) => join(names.map((n) => n + '’s')) + ' results stay with ' + src + '.',
  changed: 'What you changed',
  takenOut: (n) => 'Taken out (' + n + '):',
  putIn: (n) => 'Put in (' + n + '):',
  again: 'Change the copy again',
  back: (src) => 'Back to ' + src,
  setWith: 'Set a week with this copy',
  next: (names) => (names.length ? 'Next: who and when. ' + join(names) + (names.length === 1 ? ' is' : ' are') + ' ticked, as last week.' : 'Next: who and when'),
  makeOwn: 'Make my own copy',
};
// ---- Ready-made lists (02a, 02f-02h) -------------------------------------------------------------------------------------------
export const READY = {
  section: 'Ready-made lists',
  sectionHelp: 'Already here for every child. They can’t be changed, but you can make your own copy.',
  card: 'Year 1 to Year 6',
  cardSub: 'Ready-made',
  cardHelp: '10 chapters a year, about 10 words each',
  title: 'Ready-made lists',
  help: 'Ready-made lists can’t be changed. Open a chapter to see its words, use it for a week, or make your own copy.',
  readOnly: 'Ready-made, read-only',
  find: 'Want only some of these words? In New list, choose Word by word and find them one by one. Or make your own copy to change words. The copy is a normal list in Word lists. This chapter stays as it is.',
  copyHelp: 'The copy is a normal list in Word lists.',
  inLists: 'It is saved in Word lists',
};
export const secondLine = (n) => 'Make a second list with those ' + n;
export const secondName = (name) => (String(name || '').slice(0, Ow.MAX_NAME - 2).trim() + ' 2');
