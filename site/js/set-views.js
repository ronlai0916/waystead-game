// SB5-WP-D: "Set a week" (TR-18, TR-44, TR-84, D23, D26, D27, D34, D39, D45) and its two small neighbours, Change a week and Rename a week.
// One address, three steps on it: Which words? (04a*), Who and when? (04b*, the page the Set button is on) and the done page (04d*).
// The rules are in set-doc.js, role-doc.js and study-doc.js, the writes in set-data.js; nothing here decides a rule. Every page is built
// by a pure function of a plain object (exported, so a test can read the markup); one controller per page draws it and listens on `main`.
// CSS only (css/set.css): no inline style attribute, no :has(). The page asks nothing of the browser but `location.hash` and `navigator.onLine`.
import * as S from './store.js';
import * as W from './words-doc.js';
import * as St from './study-doc.js';
import * as Ow from './own-doc.js';
import * as SD from './set-doc.js';
import * as RO from './role-doc.js';
import * as RD from './role-data.js';
import * as D from './own-data.js';
import * as A from './grownups-data.js';
import * as SX from './set-data.js';
import * as P from './grownups-doc.js';
import * as Dt from './data.js';
import { findEntry } from './word-info.js';
import { checkTyped, NEEDS_LIST } from './wordcheck.js';
import * as IN from './info-doc.js';
import * as Sc from './scan-doc.js';
import * as ScD from './scan-data.js';
import * as L from './lists-doc.js';
import { isAdult, playingAsChild, kind, recheckWho, unknownCard } from './who.js';
import { esc } from './ui.js';
import { playingCard } from './grownups-views.js';
import { accountOrigin, accountUrl } from './account/config.js';

const today = () => W.localDay(Date.now());
const iso = (x) => /^\d{4}-\d{2}-\d{2}$/.test(x || '');
const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
const joinNames = (names) => { const n = names.filter(Boolean); return n.length <= 1 ? n.join('') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1]; };
const poss = (n) => n + '’s';
const lc = (w) => String(w).toLowerCase();
const initial = (n) => esc(String(n || '?').slice(0, 1).toUpperCase());

// ---- what the page says (design: 04a-04f, 05d, 05j) -------------------------------------------------------
export const TEXT = {
  wordsTitle: 'Which words?',
  whenTitle: 'Who and when?',
  nextButton: 'Next: who and when',
  pickFirst: 'Pick a chapter, or open My lists or New words.',
  pickYear: 'Pick a year and a chapter first.',
  noYear: (name) => 'We don’t know ' + poss(name) + ' year yet. Pick one to see its chapters. A step back or a step up is fine.',
  tabs: [['ready', 'Ready-made'], ['lists', 'My lists'], ['new', 'New words']],
  tabHelp: 'Opens on the tab you used last time on this phone.',
  readOnly: 'Ready-made words are read-only.',
  noLists: 'No word lists yet. Make one in New words.',
  newAdd: 'Add words',
  newPick: 'Or pick from',
  wordByWord: ['Word by word', 'Find ready-made words or type new ones. Each is checked'],
  typeAll: ['Type or paste all', 'One box for the whole list'],
  scan: ['Scan a paper', 'Take a photo of the school sheet'],
  patterns: ['Spelling patterns', 'Silent letters, endings …'],
  findLabel: 'Find a word, or type a new one',
  findHint: 'Start typing a word',
  addWord: 'Add word',
  yourWords: 'Your words',
  oneList: 'Picked and typed words are in one list.',
  nameList: 'Name your list',
  nameSuggest: 'We suggest this name. Change it if you like.',
  savedAs: 'Saved as a Word list called',
  typeLabel: 'Words, one on each line or with commas',
  remove: 'Remove',
  trimTitle: 'Which 10 words?',
  trimDone: (n) => 'Done: use these ' + n,
  trimThen: 'Then pick children and a date',
  trimChoose: 'Choose which 10 words',
  trimChooseClass: 'You choose which 10 words',
  change: 'Change',
  testOn: 'Test on',
  pickDate: 'Pick a date',
  dateLabel: 'Test date',
  differentDate: 'Different date for one child',
  differentHelp: (date) => 'Pick a child, then a date. The others keep ' + date + '.',
  children: 'Children',
  tickHelp: (one) => 'Tick each ' + one + ' who should get this week.',
  learner: 'Learner',
  nameThis: 'Name this week',
  optional: 'Optional',
  weekName: 'Week name',
  nameHelp: (list) => 'Leave it empty to call the week “' + list + '”, the name of the list. Up to 40 letters.',
  seeSentences: 'See sentences',
  seeFirst: (names) => 'See what ' + names + ' will see first',
  show: 'Show',
  dayByDay: 'Day by day',
  close: 'Close',
  back: 'Back',
  anotherLearner: 'Same list for another learner',
  offline: 'You’re offline. Set a week needs a connection. Your choices are kept here.',
  offlineWhy: 'When you’re back online, tap Set a week.',
  failed: 'Couldn’t set the week. Check your connection and try again. Nothing was saved, so you won’t get two weeks.',
  tryAgain: 'Try again',
  choicesKept: 'Your choices are kept.',
  noKids: 'Add a child on your account first, then set a week.',
  noKidsLink: 'Go to Children',
  listGone: 'That list isn’t here any more.',
  keepBoth: 'Add another week',
  keepBothSub: 'Both weeks run',
  replace: 'Replace it',
  replaceSub: 'You can bring it back',
  noWeek: 'No week yet',
  weekDone: 'Week done',
  weekRunning: 'Week running',
  notThisWeek: 'Untick a child for “not this week”',
  asking: 'Ask for more places',
  limitOn: ' on your plan.',
  // done
  doneMake: 'Back to children',
  seeResults: 'See results',
  rename: 'Rename this week',
  renameTitle: 'Rename this week',
  saveName: 'Save name',
  useListName: (n) => 'Use the list’s name: ' + n,
  nameEmpty: 'Please give the week a name.',
  nameFull: ['40 letters, the most.', ' The field stops at 40.'],
  nameHelp40: 'Up to 40 letters.',
  nameBoth: ' The new name is used for both weeks.',
  printClass: 'Print the list for the class',
  classResults: 'See the class results',
  // change a week
  saveChanges: 'Save changes',
  lockedNote: ['The test has started.', ' The words and date can’t change now. You can still rename the week.'],
  nowChip: 'now',
  estimateDate: 'Change the test date',
  addAWord: 'Add a word',
  trimAddHelp: 'A list plus words you add is saved as a new list in Word lists.',
  trimFull: 'A list holds up to ' + Ow.MAX_WORDS + ' words.',
  saveIn: 'Save in',
  newList: 'A new list',
  editCopy: 'Edit a copy',
  savedLine: 'Your changes are saved.',
};
export const setButton = (role, names) => {
  const r = RO.roleOf(role);
  if (r === 'teacher') return RO.WORDS.teacher.set;
  return names.length === 1 ? 'Set a week for ' + names[0] : 'Set a week for ' + names.length + ' ' + RO.WORDS[r].many;
};
export const noSentenceLine = (n) => IN.LINES.noSentence(n); // one wording, the list pages' (info-doc.js)
const SET_CHAPTER_KEY = 'sb.setChapter'; // sessionStorage, read once: "Set a week" on a ready-made chapter (own-views.js readyList)
/** "will see: Set by Mum" with whom it is for ("Ben", "Ada and Cy", "The class"). */
export const willSeeLine = (who, role, by) => who + ' will see: ' + SD.setByWords(role, by);
export const doneSub = (names, role, by) => (RO.roleOf(role) === 'teacher' ? 'Each child will see: ' + SD.setByWords(role, by) + '.' : willSeeLine(joinNames(names), role, by));
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** "Sunday 22 Nov" for a day string. */
export const eyebrowDay = (day) => (iso(day) ? WEEKDAYS[new Date(day + 'T00:00:00Z').getUTCDay()] + ' ' + W.dayLabel(day).replace(/^\w+ /, '') : '');
/** "Sun 22 to Wed 25 Nov" (one month) or "Sun 29 Nov to Wed 2 Dec". */
export function rangeLine(start, test) {
  if (!iso(start) || !iso(test)) return '';
  const a = W.dayLabel(start).split(' ');
  const b = W.dayLabel(test).split(' ');
  return (a[2] === b[2] ? a[0] + ' ' + a[1] : W.dayLabel(start)) + ' to ' + W.dayLabel(test);
}
/** The line over the Set button (04b*): who and the days. Teacher: "All 5 children · test Fri 27 Nov". '' when there is nothing to say yet. */
export function barLine({ role, names, count, total, start, test, today: day }) {
  if (!iso(test) || !iso(day) || !names.length) return '';
  if (RO.roleOf(role) === 'teacher') return (count === total && total > 1 ? 'All ' + total + ' children' : plural(count, 'child', 'children')) + ' · test ' + W.dayLabel(test);
  const n = W.daysBetween(day, test);
  if (n < 1) return '';
  const who = joinNames(names);
  const when = n === 1 ? 'test tomorrow' : n <= 7 ? (n === 7 ? 'in 1 week' : 'in ' + n + ' days') : '';
  if (names.length >= 3) return who + ' · ' + (when ? when + ', ' : 'test ') + W.dayLabel(test);
  if (n === 1) return who + ': test tomorrow, ' + W.dayLabel(test);
  return who + ': ' + rangeLine(start, test) + (when ? ' (' + when + ')' : '');
}

// ---- icons -------------------------------------------------------------------------------------------------
const svg = (inner) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + inner + '</svg>';
const I = {
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  go: svg('<path d="M9 6l6 6-6 6"/>'),
  tick: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  warn: svg('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.01"/>'),
  info: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/>'),
  ext: svg('<path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5"/>'),
  word: svg('<path d="M5 18l3.5-12h1L13 18M6.5 14h5M15 8h4M15 12h4M15 16h4"/>'),
  list: svg('<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
  scan: svg('<path d="M4 8V5h3M17 5h3v3M20 16v3h-3M7 19H4v-3M4 12h16"/>'),
  cal: svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>'),
  print: svg('<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2"/><path d="M7 14h10v6H7z"/>'),
  copy: svg('<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/>'),
};

// ---- the markup, as pure functions of plain objects ---------------------------------------------------------
const att = (k, v) => ' ' + k + '="' + esc(v) + '"';
const attrs = (o) => Object.entries(o).filter(([, v]) => v !== false && v !== undefined && v !== null).map(([k, v]) => (v === true ? ' ' + k : att(k, v))).join('');
const face = (n) => '<span class="st-face" aria-hidden="true">' + initial(n) + '</span>';
const back = (label, o = {}) => '<button type="button" class="st-back" data-act="' + (o.act || 'back') + '">' + I.back + esc(label) + '</button>';
const sectionH = (text) => '<h2 class="st-h2">' + esc(text) + '</h2>';
/** Where "See the class results" goes: the list's results (with Print), else the class results page (with Print for all). */
export const classResultsHref = (oid) => (oid ? '#/grownups/own/' + encodeURIComponent(oid) + '/results' : '#/grownups/class');
const bar = (button, line = '') => '<div class="st-bar">' + button + (line ? '<p class="st-bar__line" data-bar-line>' + line + '</p>' : '') + '</div>';
const primary = (label, act, o = {}) => '<button type="button" class="btn btn--primary btn--big"' + att('data-act', act) + attrs({ disabled: o.disabled, 'aria-describedby': o.why }) + '>' + (o.icon || '') + esc(label) + '</button>';
const ghost = (label, act, icon = '', o = {}) => '<button type="button" class="btn btn--ghost"' + att('data-act', act) + attrs(o) + '>' + icon + esc(label) + '</button>';
const quiet = (label, act, o = {}) => '<button type="button" class="st-quiet"' + att('data-act', act) + attrs(o) + '>' + esc(label) + '</button>';
const link = (label, href, cls = 'st-quiet') => '<a class="' + cls + '"' + att('href', href) + '>' + esc(label) + '</a>';
const note = (html, icon = I.info, cls = '') => '<div class="st-note' + (cls ? ' ' + cls : '') + '">' + icon + '<p>' + html + '</p></div>';
const warn = (html, o = {}) => '<div class="st-warn' + (o.cls ? ' ' + o.cls : '') + '" role="status">' + I.warn + '<p>' + html + '</p></div>';
const errBox = (html) => '<div class="st-err" role="alert">' + I.warn + '<p>' + html + '</p></div>';
const kidRow = (k, on, small = '', o = {}) => '<label class="st-row' + (on ? ' is-on' : '') + '"><input type="checkbox"' + att('data-kid', k.id) + attrs({ checked: on }) + '>' + face(k.nickname)
  + '<span class="st-row__text"><b>' + esc(k.nickname) + '</b>' + (small ? '<small>' + esc(small) + '</small>' : '') + '</span></label>';
const radioRow = (name, value, on, title, small, o = {}) => '<label class="st-row' + (on ? ' is-on' : '') + '"><input type="radio"' + att('name', name) + att('value', value) + attrs({ checked: on }) + (o.attr || '') + '><span class="st-row__text"><b>' + esc(title) + '</b>' + (small ? '<small>' + esc(small) + '</small>' : '') + '</span></label>';
const wchips = (words, cls = '') => '<span class="st-chips">' + words.map((w) => '<span class="st-wchip' + (cls ? ' ' + cls : '') + '">' + esc(w) + '</span>').join('') + '</span>';

/** The date chips and, when "Pick a date" is open or holds the date, the date field. `chosen` is the chip's days (2, 3, 5, 7) or 0 for a picked date. */
export function datesHtml({ today: day, test, pick, label = SD.DATE_CHIPS, min = '', max = '' }) {
  const on0 = SD.DATE_CHIPS.find((n) => SD.chipTest(day, n) === test) || 0;
  const on = pick ? 0 : on0; // "Change the test date" opens the date field even when a chip is on
  const picked = !on && (pick || !!test);
  const chips = SD.DATE_CHIPS.map((n) => '<button type="button" class="' + (on === n ? 'is-on' : '') + '"' + att('data-act', 'chip') + att('data-days', n) + att('aria-pressed', on === n ? 'true' : 'false') + '>' + esc(SD.chipLabel(n)) + '<small>' + esc(W.dayLabel(SD.chipTest(day, n))) + '</small></button>').join('')
    + '<button type="button" class="' + (picked ? 'is-on' : '') + '"' + att('data-act', 'pickdate') + att('aria-pressed', picked ? 'true' : 'false') + '>' + esc(TEXT.pickDate) + (picked && iso(test) ? '<small>' + esc(W.dayLabel(test)) + '</small>' : '') + '</button>';
  const field = picked ? '<div class="st-field st-field--date"><label for="st-date">' + esc(TEXT.dateLabel) + '</label><input id="st-date" class="st-input" type="date" data-date' + att('value', iso(test) ? test : '') + att('min', min) + att('max', max) + '></div>' : '';
  return '<div class="st-dates" role="group"' + att('aria-label', TEXT.testOn) + '>' + chips + '</div>' + field;
}
/** SB6 (TR-30a, TR-47): "At least about N sittings of 10 minutes before the test: about X a day." for each ticked Step-by-step child; a calm line gets a link to change the date (C6: the button is just after the live status block, not in it). */
export function estimateHtml(lines) {
  if (!lines || !lines.length) return '';
  const many = lines.length > 1;
  const link = lines.some((l) => l.calm) ? '<button type="button" class="st-quiet st-est__date" data-act="pickdate" data-estimate-date>' + esc(TEXT.estimateDate) + '</button>' : '';
  return '<div class="st-est-wrap"><div class="st-est" data-estimate role="status">' + lines.map((l) => '<p class="st-help st-est__line' + (l.calm ? ' is-calm' : '') + '" data-estimate-line' + (Number.isFinite(l.tries) ? att('data-tries', l.tries) + att('data-sittings', l.sittings) : '') + '>' + (many ? '<b>' + esc(l.name) + ':</b> ' : '') + esc(l.line) + '</p>').join('') + '</div>' + link + '</div>';
}
/** The one line under the date: plain help, or the amber note for "test tomorrow" (never a blocker). */
export function lengthHtml(day, test) {
  const line = SD.lengthLine(day, test);
  if (!line) return '';
  if (line === SD.LENGTH_LINES.tomorrow) return warn('<b>Test tomorrow:</b>' + esc(line.replace('Test tomorrow:', '')), { cls: 'st-len' });
  const m = /^([^.:]*[.:])(.*)$/.exec(line);
  return '<p class="st-help st-len" role="status"><b>' + esc(m[1]) + '</b>' + esc(m[2]) + '</p>';
}

/** The jobs of one day, said in words: "Hello words, Fix it in", "Game day (4 games), Story day", "Test". */
export function dayJobsLine(jobs) {
  return jobs.map((j) => (j.id === 'test' ? 'Test' : St.STEP_TEXT[j.id].title + (j.games ? ' (' + plural(j.games, 'game') + ')' : ''))).join(', ');
}
const weekdayShort = (day) => W.dayParts(day)[0];
/** The Day by day list (04b13): each day with jobs, then the Mend and keep day. */
export function dayByDayHtml(p) {
  const rows = p.days.map((d) => ({ day: d.day, line: dayJobsLine(d.jobs) }));
  const mend = p.stones.find((s) => s.id === 'mend');
  if (mend) rows.push({ day: mend.date, line: St.STEP_TEXT.mend.title });
  return '<ul class="st-daylist">' + rows.map((r) => '<li><b>' + esc(weekdayShort(r.day)) + '</b> ' + esc(r.line) + '</li>').join('') + '</ul>';
}
const kindNote = (p) => {
  if (p.kind === 'full') return '';
  const s = (p.days.flatMap((d) => d.jobs).find((j) => j.sentences) || {}).sentences || St.storySentences(p.kind);
  return (p.kind === 'quick' ? 'Quick week' : 'Short week') + ': shorter games and ' + plural(s, 'story sentence') + '. No job is left out.';
};
/** What the child reads first, in one line: "Sun 22 Nov (today), on Today: <b>2 jobs</b>, first Hello words, then Fix it in". */
export function firstLine(p, n) {
  const jobs = p.days[0].jobs;
  const titles = jobs.map((j) => St.STEP_TEXT[j.id].title);
  const head = esc(p.opens) + (p.today ? ' (today)' : '') + ', on Today: ';
  if (jobs.length === 1) return head + '<b>' + esc(titles[0]) + '</b> · ' + plural(n, 'word');
  const tail = jobs.length <= 3 ? titles.map((t, i) => (i === 0 ? 'first ' : 'then ') + esc(t)).join(', ') : 'first ' + esc(titles[0]);
  return head + '<b>' + jobs.length + ' jobs</b>, ' + tail;
}
const stonesMini = (p) => {
  const k = p.days[0].jobs.length;
  return '<div class="st-stones st-stones--mini" role="img"' + att('aria-label', k + ' of 7 jobs today') + '>' + p.stones.map((s, i) => '<span class="st-stone' + (i < k ? ' is-today' : '') + '"></span>').join('') + '</div>';
};
/** The seven stones with the day each opens under them (04b13). */
export function stonesByDay(p) {
  const k = p.days[0].jobs.length;
  const groups = [];
  p.stones.forEach((s, i) => {
    const last = groups[groups.length - 1];
    if (last && last.date === s.date) last.items.push({ s, i });
    else groups.push({ date: s.date, items: [{ s, i }] });
  });
  return '<div class="st-stones st-stones--days" role="img"' + att('aria-label', eyebrowDay(p.days[0].day).split(' ')[0] + ': jobs 1 to ' + k + ' of 7 today') + '>'
    + groups.map((g) => '<div class="st-sg st-g' + g.items.length + '"><span class="st-sg__s">' + g.items.map(({ s, i }) => '<span class="st-stone' + (i < k ? ' is-today' : '') + '">' + s.n + '</span>').join('') + '</span><small>' + esc(weekdayShort(g.date)) + '</small></div>').join('') + '</div>';
}

/**
 * The preview card on Who and when (D23, D34, D39): "What Ben will see first", the day's line, stones, "Ben will see: Set by Mum", the
 * sentence line, then Day by day, and the cue that opens the same thing as a sheet on a short phone. `m` = the model from previewModel().
 */
export function previewHtml(m) {
  if (!m || m.error) return '';
  const p = m.p;
  const sentences = m.noSentence ? '<p class="st-help">' + esc(noSentenceLine(m.noSentence)) + '</p>' + (m.sentenceHref ? link(TEXT.seeSentences, m.sentenceHref) : '') : '';
  return '<div class="st-card st-see st-see--full"><b>' + esc(m.heading) + '</b><p class="st-card__line">' + firstLine(p, m.count) + '</p>' + stonesMini(p)
    + '<p class="st-help">' + esc(m.willSee) + '</p>' + sentences + '</div>'
    + '<details class="st-det st-daybyday"' + (m.dayOpen ? ' open' : '') + ' data-day><summary><span>' + esc(TEXT.dayByDay) + '</span><span class="st-det__cue">' + esc(TEXT.show) + I.go + '</span></summary>' + dayByDayHtml(p) + (kindNote(p) ? '<p class="st-help st-daynote">' + esc(kindNote(p)) + '</p>' : '') + '</details>'
    + '<button type="button" class="st-quiet st-morerow st-see st-see--cue" data-act="preview"><b>' + esc(TEXT.seeFirst(m.names)) + '</b><span class="st-det__cue">' + esc(TEXT.show) + I.go + '</span></button>';
}
/** The same preview as a sheet over the page (04b10, 04b13). */
export function sheetHtml(m) {
  const p = m.p;
  const jobs = p.days[0].jobs;
  const single = jobs.length === 1;
  const hello = m.hello ? '<b>Hello, ' + esc(m.hello) + '!</b> ' : '';
  const today1 = single ? 'Today’s job: <b>' + esc(St.STEP_TEXT[jobs[0].id].title) + '</b>' : 'Today: ' + plural(jobs.length, 'job') + '. First ' + esc(St.STEP_TEXT[jobs[0].id].title) + (jobs.length > 1 ? ', then ' + esc(St.STEP_TEXT[jobs[1].id].title) : '') + '.';
  return '<div class="st-sheetwrap" data-sheet><section class="st-sheetbox" role="dialog" aria-modal="true" aria-labelledby="st-pv" tabindex="-1"><h2 id="st-pv">' + esc(m.heading) + '</h2>'
    + '<div class="st-card"><p class="st-eyebrow">' + esc(eyebrowDay(p.days[0].day)) + '</p><p class="st-card__line">' + (single ? (m.hello ? '<b>Hello, ' + esc(m.hello) + '!</b>' : '') : hello + today1) + '</p>'
    + (single ? '<p class="st-card__line">' + today1 + '</p>' + wchips(p.words) : '') + stonesByDay(p) + '<p class="st-help">' + esc(m.willSee) + '</p></div>'
    + '<div class="st-card"><b>' + esc(TEXT.dayByDay) + '</b>' + dayByDayHtml(p) + (kindNote(p) ? '<p class="st-help">' + esc(kindNote(p)) + '</p>' : '') + '</div>'
    + '<div class="st-sheetact"><button type="button" class="btn btn--primary" data-act="closesheet">' + esc(TEXT.close) + '</button></div></section></div>';
}
/** The preview model: pure. st = { role, by, today, test, words, name (shown), kids (ticked: [{ nickname, year, d }]), allDay }. */
export function previewModel({ role, by = '', today: day, test, words, name = '', kids = [], oidInfo = null, listOid = '', own = null }) {
  if (!kids.length || !words.length || !iso(test)) return null;
  const first = kids[0];
  const p = SD.previewFirst(first.d || W.emptyDoc(), { words, test, name, by, year: Number.isInteger(first.year) ? first.year : null }, day, role);
  if (p.error) return { error: p.error };
  const r = RO.roleOf(role);
  const names = kids.map((k) => k.nickname);
  const none = own ? own.filter((w) => SD.sourceOf(w, findEntry).kind === 'typed' && !(oidInfo && oidInfo[w] && oidInfo[w].s)).length : 0;
  const who = r === 'teacher' ? 'The class' : joinNames(names);
  return {
    p, count: words.length, names: r === 'teacher' ? 'the class' : joinNames(names), heading: r === 'teacher' ? RO.WORDS.teacher.previewFor() : RO.WORDS[r].previewFor(joinNames(names)),
    willSee: willSeeLine(who, role, by), hello: r === 'teacher' ? '' : first.nickname, noSentence: none, sentenceHref: none && listOid ? '#/grownups/own/' + encodeURIComponent(listOid) + '/sentences' : '',
  };
}

// ---- the three steps -----------------------------------------------------------------------------------------
const frame = (cls, body, o = {}) => '<div class="wrap st-page ' + cls + '"' + (o.inert ? ' inert' : '') + '>' + body + '</div>' + (o.after || '');

/** Which words? (04a, 04a3-04a5u): three tabs. `m` = { who, sub, tab, ... }. */
export function wordsHtml(m) {
  const tabs = '<div class="st-seg" role="tablist"' + att('aria-label', 'Where the words come from') + '>' + TEXT.tabs.map(([k, t]) => '<button type="button" role="tab" class="' + (m.tab === k ? 'is-on' : '') + '"'
    + att('data-act', 'tab') + att('data-tab', k) + att('aria-selected', m.tab === k ? 'true' : 'false') + '>' + { ready: I.list, lists: I.list, new: I.plus }[k] + esc(t) + '</button>').join('') + '</div>';
  let body = '';
  if (m.tab === 'ready') body = readyHtml(m);
  else if (m.tab === 'lists') body = listsHtml(m);
  else body = newHtml(m);
  const head = '<div><h1 class="st-h1">' + esc(TEXT.wordsTitle) + '</h1>' + (m.sub ? '<p class="st-sub">' + esc(m.sub) + '</p>' : '') + '</div>';
  return frame('st-words' + (m.tab === 'new' ? ' st-words--new' : ''), back(m.backLabel) + head + tabs + body + (m.tab === 'new' ? '' : bar(primary(TEXT.nextButton, 'next', { disabled: !m.ready, why: m.ready ? '' : 'st-why' }), m.ready ? esc(m.barLine) : '<span id="st-why">' + esc(m.why) + '</span>')));
}
function readyHtml(m) {
  const years = '<div class="st-years" role="tablist"' + att('aria-label', 'Year') + '>' + m.years.map((y) => '<button type="button" role="tab" class="' + (y.on ? 'is-on' : '') + '"' + att('data-act', 'year') + att('data-year', y.id) + att('aria-selected', y.on ? 'true' : 'false') + '>' + esc(y.label) + '</button>').join('') + '</div>';
  const label = m.yearLabel ? '<span class="st-label">' + esc(m.yearLabel) + '</span>' : '';
  const help = m.yearHelp ? '<p class="st-help">' + esc(m.yearHelp) + '</p>' : '';
  const chapters = m.chapters.length ? sectionH(m.chaptersTitle) + '<div class="st-stack st-stack--tight">' + m.chapters.map((c) => radioRow('ch', c.id, c.on, c.title, c.small, { attr: att('data-chapter', c.id) })
    + (c.on ? '<div class="st-card st-card--flat">' + wchips(c.words) + '<p class="st-help">' + esc(TEXT.readOnly) + '</p>' + link(L.COPY.makeOwn, '#/grownups/own/ready/' + encodeURIComponent(c.id) + '/copy') + '</div>' : '')).join('') + '</div>' : (m.yearId ? '' : note('Or use <b>My lists</b> for words you already saved, or <b>New words</b> to add some.'));
  return '<div class="st-field">' + label + years + help + '</div>' + chapters;
}
function listsHtml(m) {
  if (!m.lists.length) return note(esc(TEXT.noLists));
  const on = m.lists.find((l) => l.on);
  return '<p class="st-help">' + esc(TEXT.tabHelp) + '</p><div class="st-stack st-stack--tight">' + m.lists.map((l) => radioRow('ls', l.id, l.on, l.title, l.small, { attr: att('data-list', l.id) })).join('') + '</div>'
    + (on ? link(TEXT.editCopy, '#/grownups/own/' + encodeURIComponent(on.id) + '/copy') : '');
}
function newHtml(m) {
  const tile = (t, act, icon, href) => (href ? '<a class="st-sum" href="' + esc(href) + '"><b>' + esc(t[0]) + '</b>' + I.go + '<small>' + esc(t[1]) + '</small></a>'
    : '<button type="button" class="st-sum"' + att('data-act', act) + '><b>' + esc(t[0]) + '</b>' + I.go + '<small>' + esc(t[1]) + '</small></button>');
  return sectionH(TEXT.newAdd) + '<div class="st-stack st-stack--tight">' + tile(TEXT.wordByWord, 'wbw') + tile(TEXT.typeAll, 'typeall') + (m.scanOn ? tile(TEXT.scan, '', '', '#/grownups/scan') : '') + '</div>'
    + sectionH(TEXT.newPick) + '<div class="st-stack st-stack--tight">' + tile(TEXT.patterns, 'patterns') + (m.tricky ? tile([m.tricky.title, plural(m.tricky.count, 'word')], 'tricky') : '') + '</div>';
}

/** "Save in": a new list, or one of the lists that has room (typed words are added to it). m.saveIn = [{ id, label }], m.addTo = the chosen id. */
export function saveInHtml(m) {
  if (!m.saveIn || !m.saveIn.length) return '';
  return '<div class="st-field st-savein"><label for="st-ai">' + esc(TEXT.saveIn) + '</label><select id="st-ai" class="st-select" data-addto><option value="">' + esc(TEXT.newList) + '</option>'
    + m.saveIn.map((o) => '<option value="' + esc(o.id) + '"' + (m.addTo === o.id ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('') + '</select></div>';
}
/** Word by word (04a9): find ready-made words from the 2nd letter, or type a new one. */
export function wbwHtml(m) {
  const sugg = suggHtml(m.suggest, m.find);
  const rows = m.words.length ? m.words.map((w, i) => '<div class="st-wd"><span class="st-wd__no" aria-hidden="true">' + (m.words.length - i) + '</span><span class="st-wd__st" role="img" aria-label="Checked, fine">' + I.tick + '</span><span class="st-wd__w">' + esc(w.word) + '</span>'
    + '<button type="button" class="st-small"' + att('data-act', 'rm') + att('data-word', w.word) + att('aria-label', TEXT.remove + ' ' + w.word) + '>' + esc(TEXT.remove) + '</button><small class="st-help st-wd__sub">' + esc(w.source) + '</small></div>').join('')
    : '<p class="st-help st-wd__empty">No words yet. Find one above, or type one.</p>';
  const count = '<span class="st-count' + (m.words.length > W.MAX_WORDS ? ' st-count--full' : '') + '" role="status">' + plural(m.words.length, 'word') + ' · a week takes ' + W.MAX_WORDS + '</span>';
  return frame('st-wbw', back(TEXT.wordsTitle.replace('?', ''), { act: 'toWords' }) + '<div><h1 class="st-h1">' + esc(TEXT.wordByWord[0]) + '</h1></div>'
    + '<div class="st-field st-addrow"><label for="st-find">' + esc(TEXT.findLabel) + '</label><div class="st-addrow__r"><input id="st-find" class="st-input" role="combobox" aria-expanded="' + (sugg ? 'true' : 'false') + '" aria-controls="st-sg" data-find autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done"'
    + att('placeholder', TEXT.findHint) + att('value', m.find) + '><button type="button" class="btn btn--ghost st-add" data-act="addfind">' + I.plus + esc(TEXT.addWord) + '</button></div><div data-sugg>' + sugg + '</div></div>'
    + (m.msg ? '<p class="st-help" role="status" data-msg>' + esc(m.msg) + '</p>' : '<p class="st-help" role="status" data-msg></p>')
    + '<div class="st-wd__head"><h2 class="st-h2">' + esc(TEXT.yourWords) + '</h2>' + count + '</div><div class="st-wd__list">' + rows + '</div><p class="st-help st-wd__help">' + esc(TEXT.oneList) + '</p>'
    + saveInHtml(m) + (m.addTo ? '' : '<div class="st-field st-wd__name"><label for="st-ln">' + esc(TEXT.nameList) + '</label><input id="st-ln" class="st-input" data-listname maxlength="' + Ow.MAX_NAME + '"' + att('value', m.listName) + '><p class="st-help">' + esc(TEXT.nameSuggest) + '</p></div>')
    + bar(primary(TEXT.nextButton, 'next', { disabled: !m.words.length, why: m.words.length ? '' : 'st-why' }), m.words.length ? '' : '<span id="st-why">Add at least one word first.</span>'));
}
/** The suggestions under the find box: ready-made matches with their year, then "Add 'bel' as a new word". */
export function suggHtml(list, query) {
  if (!list || !list.length && !query) return '';
  const q = String(query || '').trim();
  const items = list.map((s) => '<li><button type="button" role="option" class="st-sug"' + att('data-act', 'pick') + att('data-word', s.word) + '><b>' + esc(s.word) + '</b><span>' + (s.year ? 'Year ' + s.year : '') + '</span></button></li>');
  if (q.length >= 2 && !list.some((s) => lc(s.word) === lc(q))) items.push('<li><button type="button" role="option" class="st-sug st-sug--new"' + att('data-act', 'addfind') + '><b>Add “' + esc(q) + '” as a new word</b><span>Not from a list</span></button></li>');
  return items.length ? '<ul id="st-sg" class="st-sugg" role="listbox" aria-label="Ready-made words that match">' + items.join('') + '</ul>' : '';
}
/** Type or paste all (04a2). */
export function typeAllHtml(m) {
  const refused = m.refused ? '<p class="st-help" role="status" data-msg>' + esc(m.refused) + '</p>' : '<p class="st-help" role="status" data-msg></p>';
  return frame('st-typeall', back(TEXT.wordsTitle.replace('?', ''), { act: 'toWords' }) + '<div><h1 class="st-h1">New words</h1></div>'
    + saveInHtml(m) + (m.addTo ? '' : '<div class="st-field"><label for="st-ln">' + esc(TEXT.savedAs) + '</label><input id="st-ln" class="st-input" data-listname maxlength="' + Ow.MAX_NAME + '"' + att('value', m.listName) + '></div>')
    + '<div class="st-field"><label for="st-tx">' + esc(TEXT.typeLabel) + '</label><textarea id="st-tx" class="st-text" data-text autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false">' + esc(m.text) + '</textarea>'
    + '<p class="st-help" role="status"><span class="st-count" data-count>' + esc(plural(m.count, 'word')) + '</span>. A list holds up to ' + Ow.MAX_WORDS + '.</p>' + refused + '</div>'
    + bar(primary(TEXT.nextButton, 'next', { disabled: !m.count }), ''));
}
/** Spelling patterns (04a7). */
export function patternsHtml(m) {
  const sel = m.patterns.find((p) => p.on);
  return frame('st-patterns', back('New words', { act: 'toNew' }) + '<div><h1 class="st-h1">' + esc(TEXT.patterns[0]) + '</h1><p class="st-sub">' + esc(m.sub) + '</p></div>'
    + '<div class="st-stack st-stack--tight">' + m.patterns.map((p) => radioRow('pt', p.id, p.on, p.title, p.small, { attr: att('data-pattern', p.id) })).join('') + '</div>'
    + (sel ? '<div class="st-card st-card--flat"><b>The rule for ' + esc(sel.title) + '</b><p class="st-card__line">' + esc(sel.rule) + '</p>' + wchips(sel.words) + '</div>' : '')
    + '<p class="st-help">' + esc(m.credit) + '</p>'
    + bar(primary(TEXT.nextButton, 'next', { disabled: !sel }), sel ? esc(sel.title + ': ' + plural(sel.words.length, 'word')) : ''));
}
/** A child's words to practise again (04a8). */
export function trickyHtml(m) {
  return frame('st-tricky', back('New words', { act: 'toNew' }) + '<div><h1 class="st-h1">' + esc(m.title) + '</h1><p class="st-sub">Words ' + esc(m.name) + ' missed in tests and practice.</p></div>'
    + wchips(m.words, 'is-miss') + note(esc(m.note)) + bar(primary(TEXT.nextButton, 'next'), esc(plural(m.words.length, 'word') + ' to practise again')));
}
/** Which 10 words? (04c): tick up to 10 of a longer list. */
export function trimHtml(m) {
  const full = m.ticked.length >= W.MAX_WORDS;
  const live = full ? m.ticked.length + ' ticked, a full week. Untick one to swap a word.' : m.ticked.length + ' ticked. You can tick ' + (W.MAX_WORDS - m.ticked.length) + ' more.';
  const togs = m.words.map((w) => { const on = m.ticked.some((t) => lc(t) === lc(w)); return '<label class="st-tog' + (on ? ' is-on' : '') + '"><input type="checkbox" data-tick' + att('value', w) + attrs({ checked: on, disabled: !on && full, 'aria-describedby': 'st-live' }) + '><i>' + I.tick + '</i><span>' + esc(w) + '</span></label>'; }).join('');
  return frame('st-trim', back(m.label, { act: 'toWhen' }) + '<div><h1 class="st-h1">' + esc(TEXT.trimTitle) + '</h1><p class="st-sub">' + esc(m.label + ' has ' + m.words.length + '. A week holds ' + W.MAX_WORDS + '.') + '</p></div>'
    + '<div class="st-card st-card--flat"><b class="st-count">' + m.ticked.length + ' of ' + W.MAX_WORDS + ' ticked</b><span class="st-help">The other ' + (m.words.length - m.ticked.length) + ' can go in a later week. You choose.</span></div>'
    + '<p class="st-live" id="st-live" role="status" aria-live="polite">' + esc(live) + '</p><div class="st-togs" role="group" aria-label="Words for the week">' + togs + '</div>'
    + '<div class="st-field st-addrow"><label for="st-add">' + esc(TEXT.addAWord) + '</label><div class="st-addrow__r"><input id="st-add" class="st-input" data-addword autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"' + (m.words.length >= Ow.MAX_WORDS ? ' disabled' : '') + '><button type="button" class="btn btn--ghost st-add" data-act="addword"' + (m.words.length >= Ow.MAX_WORDS ? ' disabled' : '') + '>' + I.plus + esc(TEXT.addWord) + '</button></div>'
    + '<p class="st-help" role="status" data-msg>' + esc(m.msg || (m.words.length >= Ow.MAX_WORDS ? TEXT.trimFull : '')) + '</p><p class="st-help">' + esc(TEXT.trimAddHelp) + '</p></div>'
    + bar(primary(TEXT.trimDone(m.ticked.length), 'trimdone', { disabled: !m.ticked.length }), esc(TEXT.trimThen)));
}

/** The summary card on Who and when: the list's name, how many words, Change; then "Choose which 10 words" when the list is longer. */
/** A child in one year given another year's chapter: said plainly, and never a block. */
export const yearNote = (nick, year, chapterYear) => nick + ' is in Year ' + year + '. These are Year ' + chapterYear + ' words, so they may be ' + (chapterYear < year ? 'easier' : 'harder') + ' than ' + nick + ' needs. You can still set them.';
/** The words of a longer list that are not in the week, in the list's order. */
export const leftOut = (listWords, weekWords) => { const t = (weekWords || []).map((w) => String(w).toLowerCase()); return (listWords || []).filter((w) => !t.includes(String(w).toLowerCase())); };
/** Said before Save, so nobody learns it afterwards: "Left out of this week: length." (the way to change it follows). */
export const leftOutLine = (left) => (left && left.length
  ? 'Left out of this week: ' + left.join(', ') + '. To swap ' + (left.length === 1 ? 'it' : 'them') + ', use the link below.'
  : '');
export function summaryHtml(m) {
  const trimLink = m.over ? quiet(m.role === 'teacher' ? TEXT.trimChooseClass : TEXT.trimChoose, 'trim') : '';
  return '<div class="st-sum"><b>' + esc(m.label) + '</b><button type="button" class="st-quiet st-sum__go" data-act="toWords">' + esc(TEXT.change) + '</button><small>' + esc(m.line) + '</small></div>' + (m.left && m.left.length ? '<p class="st-help" data-leftout>' + esc(leftOutLine(m.left)) + '</p>' : '') + trimLink;
}

/**
 * Who and when? (04b-04b13, 04bu, 04bt): words summary, the date, the preview, the children, the name, the Set bar.
 * m: { role, sum, today, test, pick, lengthHtml, previewHtml, kidsBlock, nameOpen, nameValue, namePlaceholder, nameHelp, bar: { label, line, disabled, why }, banner, title, back, sheet }
 */
export function whenHtml(m) {
  const head = '<h1 class="st-h1">' + esc(m.title) + '</h1>';
  const dateLabel = m.dateLabel;
  const name = '<details class="st-det st-namethis"' + (m.nameOpen ? ' open' : '') + ' data-name-det><summary><span>' + esc(TEXT.nameThis) + '</span><span class="st-det__cue">' + esc(TEXT.optional) + I.go + '</span></summary><div class="st-field st-field--pad"><label for="st-wk">' + esc(TEXT.weekName) + '</label><input id="st-wk" class="st-input" maxlength="' + W.MAX_NAME + '" data-name'
    + att('placeholder', m.namePlaceholder) + att('value', m.nameValue) + '><p class="st-help">' + esc(TEXT.nameHelp(m.namePlaceholder)) + '</p></div></details>';
  const different = m.different ? '<details class="st-det"' + (m.different.open ? ' open' : '') + ' data-diff><summary>' + esc(TEXT.differentDate) + '</summary><div class="st-diff"><p class="st-help">' + esc(TEXT.differentHelp(m.different.date)) + '</p>' + m.different.body + '</div></details>' : '';
  const button = primary(m.bar.label, 'set', { disabled: m.bar.disabled, icon: I.tick, why: m.bar.why ? 'st-why' : '' });
  const line = m.bar.why ? '<span id="st-why">' + esc(m.bar.why) + '</span>' : esc(m.bar.line);
  const body = back(m.backLabel) + head + (m.banner || '') + m.summary
    + '<h2 class="st-h2">' + esc(dateLabel) + '</h2>' + datesHtml(m.dates) + m.length + (m.estimate || '') + m.preview + (m.kids || '') + different + name + bar(button, line);
  return frame('st-when' + (m.preview ? ' st-has-cue' : '') + (m.length ? ' st-has-len' : ''), body, { inert: !!m.sheet, after: m.sheet || '' });
}

/** The children group (D45: never more places than the plan holds). */
export function kidsHtml(m) {
  if (!m.kids.length) return '';
  const rows = m.kids.map((k) => kidRow(k, k.on, k.small)).join('');
  const all = m.showAll ? '<label class="st-row st-tri' + (m.ticked ? ' is-on' : '') + '"><input type="checkbox" data-all aria-describedby="st-allh"' + attrs({ checked: m.ticked === m.kids.length }) + '><span class="st-row__text"><b>All ' + m.kids.length + ' ' + esc(m.many) + '</b><small id="st-allh">' + esc(m.allLine) + '</small></span></label>' : '';
  const busy = m.busy.map((b) => '<fieldset class="st-card st-card--flat st-twinset"><legend class="st-label">' + esc(b.legend) + '</legend><div class="st-twin">'
    + radioRow('bz-' + b.id, 'keep', !b.replace, TEXT.keepBoth, TEXT.keepBothSub, { attr: att('data-busy', b.id) }) + radioRow('bz-' + b.id, 'replace', b.replace, TEXT.replace, TEXT.replaceSub, { attr: att('data-busy', b.id) }) + '</div></fieldset>').join('');
  const limit = m.limit ? '<p class="st-help"><b>' + esc(m.limit.line) + '</b>' + esc(m.limit.tail) + '</p>' + (m.limit.ask ? '<a class="st-quiet" href="' + esc(m.limit.href) + '">' + I.ext + esc(RO.ASK_MORE) + '</a>' : '') : '';
  return '<h2 class="st-h2">' + esc(m.title) + '</h2>' + (m.one ? '<p class="st-help" data-tickhelp>' + esc(TEXT.tickHelp(m.one)) + '</p>' : '') + '<div class="st-stack st-stack--tight">' + all + rows + '</div>' + busy + limit;
}

// ---- the done page (04d, 04d2, 04d3, 04dt, 04du) -------------------------------------------------------------------
/**
 * m: { role, names (set), ok: [{ id, name, from, test }], failed: [{ id, name, line }], test, weekName, line (e.g. "first 10 words"), by, rest: [words],
 *      notSet: [names without a week], oid, links: { change }, next: { id, name, note } | null, count, total, sameTest }
 */
export function doneHtml(m) {
  const r = RO.roleOf(m.role);
  const okNames = m.ok.map((k) => k.name);
  const partial = m.failed.length > 0;
  let saved; let h1;
  if (r === 'teacher' && !partial) { saved = 'Class week set'; h1 = 'The class test is on ' + W.dayLabel(m.test); }
  else if (!m.ok.length) { saved = ''; h1 = 'Nothing was set'; }
  else { saved = 'Week set for ' + joinNames(okNames); h1 = m.ok.length === 1 ? poss(okNames[0]) + ' test is on ' + W.dayLabel(m.ok[0].test) : m.sameTest ? 'Their test is on ' + W.dayLabel(m.test) : 'Tests are set for ' + joinNames(okNames); }
  const sub = m.ok.length && !partial && r !== 'teacher' ? '<p class="st-sub">' + esc(doneSub(okNames, m.role, m.by)) + '</p>' : '';
  const head = '<div>' + (saved ? '<span class="st-saved">' + I.tick + esc(saved) + '</span>' : '') + '<h1 class="st-h1 st-h1--done">' + esc(h1) + '</h1>' + sub + '</div>';
  const errs = m.failed.map((f) => errBox('<b>' + esc('Couldn’t set ' + poss(f.name) + ' week.') + '</b> ' + esc(f.line))).join('');
  const nameCard = m.ok.length ? '<div class="st-card st-card--flat"><p class="st-card__line">Week name: <b>' + esc(m.weekName) + '</b>' + (m.line ? ' · ' + esc(m.line) : '') + '</p>'
    + (r === 'teacher' ? '<ul class="st-hlist">' + m.ok.map((k) => '<li><span class="st-hrow">' + face(k.name) + '<span><b>' + esc(k.name) + '</b><small>' + I.tick + ' Sees the words from ' + esc(W.dayLabel(k.from)) + '</small></span></span></li>').join('') + '</ul><p class="st-help">' + esc(doneSub(okNames, m.role, m.by)) + '</p>'
      : '<button type="button" class="st-quiet" data-act="rename">' + esc(TEXT.rename) + '</button>' + (m.ok.length === 1 ? '<p class="st-card__line st-card__line--muted">' + esc(m.ok[0].name + ' sees them on Today from ' + W.dayLabel(m.ok[0].from) + '.') + '</p>' : ''))
    + '</div>' : '';
  const each = r !== 'teacher' && m.ok.length > 1 ? '<div class="st-eachkid">' + m.ok.map((k) => '<div class="st-card st-card--flat">' + face(k.name) + '<div><b>' + esc(k.name) + '</b><p class="st-card__line st-card__line--muted">' + esc('Sees the words from ' + W.dayLabel(k.from) + ' · test ' + W.dayLabel(k.test)) + '</p></div></div>').join('') + '</div>' : '';
  const restNote = m.rest.length ? note(esc(plural(m.rest.length, 'word') + (m.rest.length === 1 ? ' is' : ' are') + ' not in this week: ') + '<b>' + esc(m.rest.join(', ')) + '</b>' + esc('. You can put ' + (m.rest.length === 1 ? 'it' : 'them') + ' in a later week.')) : '';
  const notSet = m.notSet.length && r !== 'teacher' ? note(esc(joinNames(m.notSet) + (m.notSet.length === 1 ? ' has' : ' have') + ' no week yet.')) : '';
  const stack = [];
  if (m.rest.length) stack.push(ghost(SD.restButton(m.rest.length), 'rest', I.cal));
  if (m.ok.length && r === 'tutor') stack.push(ghost(TEXT.anotherLearner, 'another', I.copy));
  if (m.notSet.length && r === 'parent' && !partial) stack.push(ghost('Set a week for ' + m.notSet[0] + ' too', 'also', I.cal, { 'data-cid': m.notSetIds[0] }));
  if (m.ok.length && r !== 'teacher') stack.push(link('Change ' + (m.ok.length === 1 ? poss(okNames[0]) : joinNames(okNames.map((n) => poss(n)).slice(0, 2)).replace(/’s and /, '’s or ')) + ' week', m.links.change));
  if (m.oid && r !== 'teacher') stack.push(link(TEXT.seeResults, '#/grownups/own/' + encodeURIComponent(m.oid) + '/results'));
  if (m.oid && r === 'teacher') stack.push('<a class="btn btn--ghost" href="' + esc(classResultsHref(m.oid)) + '">' + I.print + esc(TEXT.printClass) + '</a>');
  let barHtml;
  if (partial) barHtml = bar(primary(TEXT.tryAgain + ' for ' + joinNames(m.failed.map((f) => f.name)), 'retry', { icon: I.tick }), 'Same words and date');
  else if (r === 'teacher') barHtml = bar('<a class="btn btn--primary btn--big" href="' + classResultsHref(m.oid) + '">' + esc(TEXT.classResults) + '</a>', esc(m.count + ' of ' + m.total + ' children have the week'));
  else if (r === 'tutor' && m.next) barHtml = bar(primary('Set a week for ' + m.next.name, 'nextlearner', { icon: I.cal }), esc(m.next.note));
  else barHtml = bar('<a class="btn btn--primary btn--big" href="#/grownups">' + esc(r === 'tutor' ? 'Back to my learners' : r === 'teacher' ? 'Back to my class' : TEXT.doneMake) + '</a>');
  const back2 = partial ? '<div class="st-cardlink__row"><a class="btn btn--ghost" href="#/grownups">Back to ' + (r === 'parent' ? 'Children' : 'my ' + RO.WORDS[r].many) + '</a></div>' : '';
  return frame('st-done', head + errs + nameCard + '<div data-pictures-host></div>' + each + restNote + notSet + (stack.length ? '<div class="st-stack">' + stack.join('') + '</div>' : '') + back2 + barHtml);
}

/** Rename the week you just set (05j5, 05j6), or a child's week (05j, 05j2-05j4). m: { title, sub, value, help, error, useList, locked, backLabel, saveLine } */
export function renameHtml(m) {
  const full = m.value.length >= W.MAX_NAME;
  const help = full ? '<span class="st-count st-count--full">' + esc(TEXT.nameFull[0]) + '</span>' + esc(TEXT.nameFull[1]) : esc(m.help);
  const lock = m.locked ? note('<b>' + esc(TEXT.lockedNote[0]) + '</b>' + esc(TEXT.lockedNote[1])) : '';
  const err = m.error ? errBox('<b>' + esc(m.error) + '</b>') + (m.useList ? '<div class="st-cardlink__row"><button type="button" class="btn btn--ghost" data-act="uselist">' + esc(TEXT.useListName(m.useList)) + '</button></div>' : '') : '';
  return frame('st-rename', back(m.backLabel, { act: 'backrename' }) + '<div><h1 class="st-h1">' + esc(TEXT.renameTitle) + '</h1><p class="st-sub">' + esc(m.sub) + '</p></div>' + lock + err
    + '<div class="st-field"><label for="st-rn">' + esc(TEXT.weekName) + '</label><input id="st-rn" class="st-input" maxlength="' + W.MAX_NAME + '" data-rename' + att('value', m.value) + (m.error ? ' aria-invalid="true"' : '') + '><p class="st-help" role="status" data-rhelp>' + help + '</p></div>'
    + bar(primary(TEXT.saveName, 'savename'), esc(m.saveLine)));
}
/** Change a week (05d): one child's words, test date and name. m: { name, others, sum, dates, length, wordsOpen, wordsBlock, nameValue, saveLine, error, saving } */
export function changeHtml(m) {
  const name = '<details class="st-det st-namethis"' + (m.nameOpen ? ' open' : '') + ' data-name-det><summary><span>' + esc(TEXT.nameThis) + '</span><span class="st-det__cue">' + esc(TEXT.optional) + I.go + '</span></summary><div class="st-field st-field--pad"><label for="st-wk">' + esc(TEXT.weekName) + '</label><input id="st-wk" class="st-input" maxlength="' + W.MAX_NAME + '" data-name' + att('value', m.nameValue) + '></div></details>';
  return frame('st-change', back(m.backLabel) + '<div><h1 class="st-h1">Change ' + esc(poss(m.name)) + ' week</h1><p class="st-sub">Only ' + esc(poss(m.name)) + ' week changes.' + (m.other ? ' ' + esc(poss(m.other)) + ' week stays as it is.' : '') + '</p></div>' + (m.notice ? note('<b>Updated with the latest.</b> This week was changed on another device a moment ago.') : '') + (m.error ? errBox(esc(m.error)) : '')
    + '<div class="st-sum"><b>' + esc(m.label) + '</b><button type="button" class="st-quiet st-sum__go" data-act="words">' + esc(TEXT.change) + '</button><small>' + esc(plural(m.count, 'word') + ' · you can change which') + '</small></div>' + (m.wordsOpen ? m.wordsBlock : '')
    + '<h2 class="st-h2">' + esc(TEXT.testOn) + '</h2>' + m.dates + (m.passed ? note(esc(m.passed)) : '') + m.length + (m.estimate || '') + name + bar(primary(TEXT.saveChanges, 'save', { disabled: m.saving }), esc(m.saveLine)));
}
/** Chips of this week's words with a Remove, and one box to add a word (the Change button of 05d). */
export function wordsBlockHtml(m) {
  return '<div class="st-card st-card--flat"><div class="st-togs" role="group" aria-label="Words for the week">' + (m.shown || m.words).map((w) => { const on = m.words.some((x) => lc(x) === lc(w)); return '<label class="st-tog' + (on ? ' is-on' : '') + '"><input type="checkbox" data-wk' + attrs({ checked: on }) + att('value', w) + '><i>' + I.tick + '</i><span>' + esc(w) + '</span></label>'; }).join('') + '</div>'
    + '<div class="st-field st-addrow"><label for="st-add">' + esc(TEXT.addAWord) + '</label><div class="st-addrow__r"><input id="st-add" class="st-input" data-addword autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"><button type="button" class="btn btn--ghost st-add" data-act="addword">' + I.plus + esc(TEXT.addWord) + '</button></div>'
    + '<p class="st-help" role="status" data-msg>' + esc(m.msg || '') + '</p></div></div>';
}

// ---- the page's pure helpers (tested without a page) ---------------------------------------------------------------------------
/** The children the page may show: the account's order, at most `cap` places (D45). */
export function shownKids(kids, cap) {
  return kids.slice(0, Math.max(0, cap));
}
/** What the children group says about the plan (D45): the count line when the plan is full, and the ask for more places. */
export function limitFor({ role, count, limit, cap, origin }) {
  const total = count;
  if (total < cap && total <= limit) return null;
  return { line: RO.limitLine(role, Math.min(total, cap), limit), tail: total > cap ? ' shown. ' + RO.atLimitLine(role, total, limit) : TEXT.limitOn, ask: true, href: accountUrl(origin || '', 'adult') };
}
/** Words of a list for the picker, and the words an earlier week of these children already used (so the next ones are ticked first). */
export function usedFrom(kids, oid, lists) {
  return kids.flatMap((k) => (k.d ? SD.weeksFromList(k.d, oid, lists).flatMap((g) => g.words) : []));
}
/** How a child is doing, as one small line under a learner's name (tutor). */
export function kidStatus(d) {
  if (!d) return '';
  const live = W.liveGroups(d);
  if (!live.length) return TEXT.noWeek;
  return live.some((g) => !W.testDone(d, g)) ? TEXT.weekRunning : TEXT.weekDone;
}
/** Which ticked words to send and how the page words the size of the week: "first 10 words", "10 of 15 words", "10 words". */
export function weekSizeLine(listWords, words) {
  if (!listWords || listWords.length <= words.length) return plural(words.length, 'word');
  const first = listWords.slice(0, words.length);
  return first.every((w, i) => lc(w) === lc(words[i])) ? 'first ' + plural(words.length, 'word') : words.length + ' of ' + listWords.length + ' words';
}
/** The most useful message for one child's failed write. */
export function failLine(r) {
  if (r.error === 'no-week-id' || r.error === SD.ID_TAKEN) return 'Please try again.';
  if (r.error) return String(r.error).length > 1 ? r.error : P.PROBLEM_TEXT.other;
  return (P.PROBLEM_TEXT[r.problem] || P.PROBLEM_TEXT.other) + ' Nothing changed for this child.';
}

// ---- who is here -------------------------------------------------------------------------------------------------------------------
function guard(main) {
  if (isAdult()) return true;
  if (playingAsChild()) { playingCard(main); return false; } // S3-D5: the child's name and Switch back to myself, as the home card
  if (kind() === 'unknown') { unknownCard(main, 'st'); return false; }
  main.innerHTML = '<section class="wrap st-page"><div class="st-card" data-notforyou><h1 class="st-h1">This page is for grown-ups</h1><a class="btn btn--primary" href="#/">Back to the start</a></div></section>';
  return false;
}
let tools = { api: null, prefs: null };
/** The app hands over what only it holds: the prefs sync (for the saved role and name) and, in a test, a fake account. */
export function useSetTools({ api, prefs } = {}) {
  if (api !== undefined) tools.api = api;
  if (prefs !== undefined) tools.prefs = prefs;
}
const childApi = () => { if (!tools.api) tools.api = A.createChildApi({ origin: accountOrigin(location) }); return tools.api; };
function roleNow(me) {
  let rs = null;
  try { rs = RD.createRoleStore({ storage: globalThis.localStorage, playerId: S.currentPlayer(), prefs: typeof tools.prefs === 'function' ? tools.prefs() : tools.prefs }); } catch (e) { rs = null; }
  const got = rs ? rs.get() : null;
  return { role: got ? RO.roleOf(got.r) : RO.roleOf(me && me.role), name: got && got.n ? got.n : '' };
}
const TAB_KEY = 'sb.setTab:';
const tabOf = () => { try { const v = globalThis.localStorage.getItem(TAB_KEY + S.currentPlayer()); return ['ready', 'lists', 'new'].includes(v) ? v : ''; } catch (e) { return ''; } };
const rememberTab = (t) => { try { globalThis.localStorage.setItem(TAB_KEY + S.currentPlayer(), t); } catch (e) { /* the page works without it */ } };
const go = (hash) => { if (typeof location !== 'undefined') location.hash = hash; };
const toTop = () => { try { if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0); } catch (e) { /* no window */ } };
const loadingPage = (main, text = 'Getting ready…') => { main.innerHTML = '<section class="wrap st-page"><p class="st-help" role="status">' + esc(text) + '</p></section>'; };
const LOAD_MS = 15000;
const SIDE_MS = 3000;
/** The promise's answer, or `fallback` when it has not settled in `ms` (a fetch that never answers must not keep a page on "loading"). */
function within(p, ms, fallback) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    Promise.resolve(p).then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve(fallback); });
  });
}
function problemPage(main, problem, retry) {
  if (problem === 'playing') { recheckWho().then(() => guard(main)); return; }
  if (problem === 'signed-out') recheckWho();
  main.innerHTML = '<section class="wrap st-page"><div class="st-err" role="alert" data-problem' + att('data-problem', problem) + '>' + I.warn + '<p><b>That didn’t load.</b> ' + esc(P.PROBLEM_TEXT[problem] || P.PROBLEM_TEXT.other) + '</p></div><div class="st-cardlink__row">'
    + (retry ? '<button type="button" class="btn btn--primary" data-act="reload">' + esc(TEXT.tryAgain) + '</button>' : '') + '<a class="btn btn--ghost" href="#/grownups">Back to children</a></div></section>';
  const b = main.querySelector && main.querySelector('[data-act="reload"]');
  if (b && retry) b.addEventListener('click', retry);
}
const pageApi = (main, handlers) => {
  const click = (e) => { const t = e.target && e.target.closest ? e.target.closest('[data-act]') : null; if (t && handlers.click) handlers.click(t, e); };
  const change = (e) => { if (handlers.change) handlers.change(e.target, e); };
  const input = (e) => { if (handlers.input) handlers.input(e.target, e); };
  const key = (e) => { if (handlers.key) handlers.key(e); };
  main.addEventListener('click', click);
  main.addEventListener('change', change);
  main.addEventListener('input', input);
  main.addEventListener('keydown', key);
  return () => { main.removeEventListener('click', click); main.removeEventListener('change', change); main.removeEventListener('input', input); main.removeEventListener('keydown', key); };
};
const focusKey = (main, k) => { const e = k && main.querySelector ? main.querySelector('[data-act="' + k.act + '"]' + (k.attr ? '[' + k.attr + ']' : '')) : null; if (e && e.focus) e.focus(); };
const fixIndeterminate = (main, on) => { const a = main.querySelector ? main.querySelector('[data-all]') : null; if (a) a.indeterminate = !!on; };

// ================================================================== Set a week ======================================================
/**
 * #/grownups/set, #/grownups/set/list/:oid, #/grownups/set/child/:cid, (#/grownups/set/list/:oid/child/:cid).
 * params: { oid?, cid? } (already decoded by the router; a bad piece is '').
 */
export function setWeek(main, params = {}) {
  if (!guard(main)) return undefined;
  const api = childApi();
  let stopped = false;
  let off = () => {};
  loadingPage(main);
  const run = async () => {
    // S2 round 4: nothing here may wait for ever. The account has 15 s to answer; the patterns file and the scan allowance (a side check, 30 s of its own) 3 s each.
    const [me, lc0] = await Promise.all([within(A.readMe(api), LOAD_MS, A.meFacts(null)), within(A.listChildren(api), LOAD_MS, { problem: 'network' })]);
    if (stopped) return;
    if (lc0.problem) { problemPage(main, lc0.problem, run); return; }
    const kidsAll = lc0.children;
    if (!kidsAll.length) { main.innerHTML = frame('st-none', '<h1 class="st-h1">' + esc(RO.WORDS[roleNow(me).role].set) + '</h1>' + note(esc(TEXT.noKids)) + link(TEXT.noKidsLink, '#/grownups', 'btn btn--primary')); return; }
    const read = await within(SX.readKids(api, kidsAll), LOAD_MS, kidsAll.map((k) => ({ id: k.id, problem: 'network' })));
    if (stopped) return;
    const bad = read.find((k) => k.problem && k.problem !== 'no-child');
    if (bad) { problemPage(main, bad.problem, run); return; }
    const patternsData = await within(fetch('data/patterns.json').then((r) => r.json()).catch(() => ({ patterns: [] })), SIDE_MS, { patterns: [] });
    if (stopped) return;
    let scanOn = false;
    try { scanOn = Sc.isOn(await within(ScD.allowance(accountOrigin(location)), SIDE_MS, null)); } catch (e) { scanOn = false; } // dark unless the account says on: true
    if (stopped) return;
    start({ me, kidsAll, read, patternsData, scanOn });
  };
  run();

  function start({ me, kidsAll, read, patternsData, scanOn = false }) {
    const { role, name: by } = roleNow(me);
    const limit = me.limit;
    const cap = A.childCap(limit);
    const shown = shownKids(kidsAll, cap);
    const byId = Object.fromEntries(read.map((r) => [r.id, r]));
    const kids = shown.map((c) => ({ id: c.id, nickname: c.nickname, year: Number(c.year) || 0, d: byId[c.id] && byId[c.id].d ? byId[c.id].d : null, progress: byId[c.id] ? byId[c.id].progress : null }));
    const day = today();
    const ownAll = () => Ow.normalise(W.ownOf(S.readWords()));
    const listsNow = () => Ow.live(ownAll()).map((e) => ({ ...e })).sort((a, b) => (b.at || 0) - (a.at || 0) || String(a.id).localeCompare(String(b.id)));
    const lists0 = listsNow();
    const defaults = RO.setDefaults(role, { kids: kids.map((k) => ({ id: k.id, d: k.d || W.emptyDoc() })), lists: lists0, today: day, from: params.cid || '' });
    const oneKid = kids.length === 1;
    const st = {
      step: 'words', tab: '', yearId: '', chapterId: '', patternId: '', src: null, ticked: [], listWords: [],
      wbw: [], listName: '', text: '', find: '', msg: '', refused: '',
      cids: params.cid && kids.some((k) => k.id === params.cid) ? [params.cid] : defaults.cids.filter((c) => kids.some((k) => k.id === c)),
      test: defaults.test, pick: false, name: '', nameOpen: false, dayOpen: false, sheet: false, trimmed: false,
      addTo: '', trimMsg: '', own: {}, busy: {}, ownOpen: false, ownCid: '', gids: null, saving: false, results: null, message: '', offline: false,
      returnTo: 'when', done: null, renaming: false, rename: '', renameErr: '', focus: null, flash: '',
    };
    if (oneKid) st.cids = [kids[0].id];
    if (!st.cids.length && kids.length && role !== 'parent') st.cids = [kids[0].id];
    const fixedCid = params.cid || '';
    const patterns = patternsData.patterns || [];
    const credit = (patternsData._meta || {}).credit || '';
    st.patternId = patterns.length ? patterns[0].id : '';
    const stickTab = tabOf();
    st.tab = stickTab || (lists0.length ? 'lists' : 'ready');
    if (role !== 'parent' && lists0.length) st.tab = stickTab === 'new' || stickTab === 'ready' ? stickTab : 'lists';
    st.wv = 'main'; // main | wbw | typeall | patterns | tricky
    const live = () => Dt.liveYears();
    const pickKids = () => (st.cids.length ? kids.filter((k) => st.cids.includes(k.id)) : kids);
    const kidOf = (id) => kids.find((k) => k.id === id);
    const tickedKids = () => kids.filter((k) => st.cids.includes(k.id));
    const trickyOf = (k) => (k && k.progress ? P.childTricky(k.progress).filter((w) => findEntry(w)) : []);
    const isTeacher = role === 'teacher';

    // -- sources -------------------------------------------------------------------------------------------------------------
    const finalWords = () => {
      const t = st.ticked.map(lc);
      return st.listWords.filter((w) => t.includes(lc(w)));
    };
    const setSource = (src, words) => {
      st.src = src;
      st.listWords = [...words];
      st.trimmed = false;
      if (src.kind === 'list') st.ticked = SD.firstTicks(words, usedFrom(pickKids(), src.id, listsNow()));
      else st.ticked = words.slice(0, W.MAX_WORDS);
    };
    const selectList = (oid) => {
      const e = listsNow().find((l) => l.id === oid);
      if (!e) return false;
      setSource({ kind: 'list', id: oid, label: e.name }, e.words);
      return true;
    };
    const selectChapter = (id) => {
      const ch = Dt.chapterById(id);
      if (!ch) return false;
      const y = Dt.years()[ch.yearId];
      st.chapterId = id;
      setSource({ kind: 'chapter', id, label: y.label + ' · Chapter ' + ch.n, year: y.n }, ch.words.map((w) => w.word));
      return true;
    };
    const selectPattern = (id) => {
      const p = patterns.find((x) => x.id === id);
      if (!p) return false;
      st.patternId = id;
      setSource({ kind: 'pattern', id, label: p.title }, P.patternWords(patterns, id));
      return true;
    };
    const typedSource = () => {
      const words = st.wbw.map((w) => w.word);
      const to = st.addTo ? ownAll()[st.addTo] : null;
      setSource({ kind: 'typed', id: '', label: to ? to.name : st.listName || W.defaultName(st.test) }, words);
    };
    /** The lists a typed word can be added to: those with room for what has been typed. */
    const saveInOptions = (n) => listsNow().filter((l) => l.words.length + n <= Ow.MAX_WORDS && !l.gone).map((l) => ({ id: l.id, label: l.name }));
    const newName = () => W.defaultName(iso(st.test) ? st.test : W.defaultTest(day));
    st.listName = newName();

    // -- the models the markup is made from ----------------------------------------------------------------------------------------
    const subLine = () => {
      if (isTeacher) return 'For the whole class';
      const ks = pickKids();
      if (ks.length === 1) return 'For ' + ks[0].nickname + (ks[0].year ? ' · Year ' + ks[0].year : '');
      return 'For all your ' + RO.WORDS[role].many;
    };
    const backLabelWords = () => (fixedCid && kidOf(fixedCid) ? kidOf(fixedCid).nickname : role === 'parent' ? 'Children' : RO.WORDS[role].home);
    const yearTabs = () => {
      const ks = pickKids();
      return Dt.liveYears().map((y) => {
        const n = Dt.years()[y].n;
        const who = ks.length > 1 ? ks.filter((k) => k.year === n).map((k) => k.nickname) : [];
        return { id: y, label: Dt.years()[y].label + (who.length ? ' · ' + who.join(', ') : ''), on: st.yearId === y };
      });
    };
    const openYear = () => {
      if (st.yearId) return;
      const k = pickKids().find((x) => x.year >= 1 && x.year <= 6);
      const id = k ? 'y' + k.year : '';
      if (id && live().includes(id)) st.yearId = id;
    };
    const wordsModel = () => {
      openYear();
      const ks = pickKids();
      const first = ks[0];
      const known = ks.some((k) => k.year >= 1 && k.year <= 6);
      const chs = st.yearId ? Dt.chapters(st.yearId).map((c) => ({ id: c.id, on: st.src && st.src.kind === 'chapter' && st.src.id === c.id, title: 'Chapter ' + c.n, small: plural(c.words.length, 'word') + ' · ' + c.words.slice(0, 4).map((w) => w.word).join(', ') + ' …', words: c.words.map((w) => w.word) })) : [];
      const m = {
        tab: st.tab, sub: subLine(), backLabel: backLabelWords(),
        years: yearTabs(), yearId: st.yearId, chapters: chs, chaptersTitle: st.yearId ? Dt.years()[st.yearId].label + ' · ' + plural(chs.length, 'chapter') : '',
        yearLabel: st.yearId && known ? (ks.length > 1 ? 'Opened on ' + poss(first.nickname) + ' year' : 'Opened on ' + poss(first.nickname) + ' year') : 'Which year ' + (ks.length === 1 ? 'is ' + first.nickname + ' in?' : 'to look in?'),
        yearHelp: !known ? TEXT.noYear(first ? first.nickname : 'your child') : ks.length > 1 ? ks.map((k) => k.nickname + (k.year ? ' Year ' + k.year : '')).join(' · ') + '. One list can go to all of them.' : '',
        lists: orderedLists().map((l) => ({ id: l.id, on: st.src && st.src.kind === 'list' && st.src.id === l.id, title: l.title, small: l.small })),
        scanOn, tricky: null,
      };
      const kt = oneKid || (st.cids.length === 1) ? pickKids()[0] : null;
      if (kt && SD.trickyOffered(st.cids.length ? st.cids : [kt.id]) && !isTeacher) { const t = trickyOf(kt); if (t.length) m.tricky = { title: poss(kt.nickname) + ' words to practise again', count: t.length }; }
      const sel = st.src;
      m.ready = !!sel && st.tab !== 'new';
      if (m.ready && st.tab === 'ready' && sel.kind !== 'chapter') m.ready = false;
      if (m.ready && st.tab === 'lists' && sel.kind !== 'list') m.ready = false;
      m.barLine = sel ? (sel.kind === 'chapter' ? sel.label + ': ' + plural(st.listWords.length, 'word') + ', all fit a week' : st.listWords.length > W.MAX_WORDS ? plural(st.listWords.length, 'word') + '. A week takes ' + W.MAX_WORDS + ': you choose which ' + W.MAX_WORDS + '.' : plural(st.listWords.length, 'word') + ', all fit a week') : '';
      m.why = st.tab === 'ready' && !st.yearId ? TEXT.pickYear : TEXT.pickFirst;
      return m;
    };
    function orderedLists() {
      const all = listsNow();
      const kid = role === 'tutor' && st.cids.length === 1 ? st.cids[0] : '';
      const mine = kid ? all.filter((l) => (l.to || []).includes(kid)) : [];
      const rest = kid ? all.filter((l) => !(l.to || []).includes(kid)) : all;
      const had = (l) => kids.filter((k) => k.d && SD.weeksFromList(k.d, l.id, all).length).map((k) => k.nickname);
      return [...mine, ...rest].map((l) => {
        const who = had(l);
        const owner = role === 'tutor' && (l.to || []).length === 1 && kidOf(l.to[0]) ? poss(kidOf(l.to[0]).nickname) + ' list · ' : '';
        return { id: l.id, title: l.name, small: owner + plural(l.words.length, 'word') + (who.length ? ' · ' + joinNames(who) + ' had it' : '') };
      });
    }
    const wbwModel = () => ({
      find: st.find, msg: st.msg, listName: st.listName, saveIn: saveInOptions(st.wbw.length), addTo: saveInOptions(st.wbw.length).some((o) => o.id === st.addTo) ? st.addTo : '',
      words: [...st.wbw].reverse().map((w) => { const s = SD.sourceOf(w.word, findEntry); return { word: w.word, source: s.kind === 'ready' ? 'Ready-made · ' + (s.year ? 'Year ' + s.year : 'ready-made') : 'Typed by you' }; }).map((w) => ({ ...w, source: w.source.replace('Ready-made · ready-made', 'Ready-made') })),
      suggest: SD.findWords(st.find, Dt.allWords()).filter((s) => !st.wbw.some((w) => lc(w.word) === lc(s.word))),
    });
    const patternsModel = () => ({
      sub: subLine().replace(/^For /, 'For ') + ' · pick one pattern. The words are made for you.', credit,
      patterns: patterns.map((p) => ({ id: p.id, on: st.patternId === p.id && st.src && st.src.kind === 'pattern', title: p.title, small: P.patternWords(patterns, p.id).slice(0, 3).join(', ') + ' · ' + plural(P.patternWords(patterns, p.id).length, 'word'), rule: p.rule, words: P.patternWords(patterns, p.id) })),
    });
    const sumModel = () => {
      const n = st.listWords.length;
      const fromTrim = st.listWords.length > W.MAX_WORDS;
      return {
        role, label: st.src ? st.src.label : '', over: n > W.MAX_WORDS, left: n > W.MAX_WORDS ? leftOut(st.listWords, finalWords()) : [],
        line: !fromTrim ? plural(n, 'word') + (st.src && st.src.kind === 'chapter' ? ' · Ready-made · all fit a week' : ' · all fit a week') : isTeacher && !st.trimmed ? n + ' words. The other ' + (n - W.MAX_WORDS) + ' can go in a later week.' : st.trimmed ? finalWords().length + ' of ' + n + ' words · you chose them' : n + ' words. A week takes ' + W.MAX_WORDS + ': you choose which ' + W.MAX_WORDS + '.',
      };
    };
    const weekName = () => (st.name.trim() || defaultWeekName());
    const defaultWeekName = () => (isTeacher ? RO.WORDS.teacher.weekPrefix : '') + (st.src ? st.src.label : '');
    const infoOf = () => { if (!st.src || st.src.kind !== 'list') return null; const e = ownAll()[st.src.id]; return e && e.info ? e.info : null; };
    const datesModel = () => ({ today: day, test: st.test, pick: st.pick, min: W.addDays(day, 1), max: W.addDays(day, W.MAX_DAYS) });
    const dateLabel = () => {
      const ks = tickedKids();
      if (isTeacher) return TEXT.testOn + ' (the whole class)';
      if (ks.length <= 1) return TEXT.testOn;
      return TEXT.testOn + ' (' + (ks.length >= 3 ? 'all ' + ks.length : joinNames(ks.map((k) => k.nickname))) + ')';
    };
    const kidsModel = () => {
      const mismatch = st.src && st.src.kind === 'chapter' ? st.src.year : 0;
      const rows = kids.map((k) => {
        const on = st.cids.includes(k.id);
        let small = role === 'tutor' ? kidStatus(k.d) : '';
        if (mismatch && k.year && k.year !== mismatch) small = on ? yearNote(k.nickname, k.year, mismatch) : k.nickname + ' is in Year ' + k.year + '.';
        return { id: k.id, nickname: k.nickname, on, small };
      });
      const busy = tickedKids().map((k) => {
        const r = k.d ? SD.runningFor(k.d, st.src && st.src.kind === 'list' ? st.src.id : '', listsNow()) : null;
        return r ? { id: k.id, legend: SD.runningNote(k.nickname, { name: r.name, test: r.test }, r.from), replace: st.busy[k.id] === 'replace' } : null;
      }).filter(Boolean);
      const lim = limitFor({ role, count: kidsAll.length, limit, cap, origin: accountOrigin(location) });
      const total = kids.length;
      return {
        kids: rows, title: role === 'tutor' ? TEXT.learner : TEXT.children, many: RO.WORDS[role].many, one: RO.WORDS[role].one, busy, limit: lim,
        showAll: isTeacher ? total > 1 : total >= 3 && !fixedCid && role !== 'tutor', ticked: st.cids.length,
        allLine: isTeacher ? TEXT.notThisWeek : st.cids.length + ' ticked' + (st.cids.length ? ', as last week' : ''),
      };
    };
    const diffModel = () => {
      if (!isTeacher || tickedKids().length < 2) return null;
      const chosen = kidOf(st.ownCid) ? st.ownCid : tickedKids()[0].id;
      const sel = '<div class="st-field"><label for="st-oc">Child</label><select id="st-oc" class="st-select" data-ownkid>' + tickedKids().map((k) => '<option value="' + esc(k.id) + '"' + (k.id === chosen ? ' selected' : '') + '>' + esc(k.nickname) + (st.own[k.id] ? ' · ' + esc(W.dayLabel(st.own[k.id])) : '') + '</option>').join('') + '</select></div>'
        + '<div class="st-field"><label for="st-od">Test date for this child</label><input id="st-od" class="st-input" type="date" data-owndate' + att('value', st.own[chosen] || st.test) + att('min', W.addDays(day, 1)) + att('max', W.addDays(day, W.MAX_DAYS)) + '></div>'
        + (st.own[chosen] ? '<button type="button" class="st-quiet" data-act="ownclear">The class date for ' + esc(kidOf(chosen).nickname) + '</button>' : '');
      return { open: st.ownOpen || Object.keys(st.own).length > 0, date: W.dayLabel(st.test), body: sel };
    };
    const previewModelNow = () => {
      const ks = tickedKids();
      const words = finalWords();
      return previewModel({ role, by, today: day, test: st.test, words, name: weekName(), kids: ks.map((k) => ({ nickname: k.nickname, year: k.year || null, d: k.d })), oidInfo: infoOf(), listOid: st.src && st.src.kind === 'list' ? st.src.id : '', own: words.filter((w) => SD.sourceOf(w, findEntry).kind === 'typed') });
    };
    const problem = () => {
      const needsList = st.src && st.src.kind === 'typed';
      const base = SD.setProblem({ cids: st.cids, words: finalWords(), test: st.test, today: day, listsCount: listsNow().length, needsList });
      if (base) return base;
      for (const [cid, t] of Object.entries(st.own)) if (st.cids.includes(cid)) { const r = SD.setProblem({ cids: [cid], words: finalWords(), test: t, today: day }); if (r) return r; }
      return '';
    };
    const whenModel = () => {
      const ks = tickedKids();
      const pm = previewModelNow();
      const why = st.offline ? TEXT.offlineWhy : problem();
      const names = ks.map((k) => k.nickname);
      const banner = (st.message ? errBox(esc(st.message)) : '') + (st.offline ? warn('<b>You’re offline.</b> ' + esc(TEXT.offline.replace('You’re offline. ', ''))) : '');
      const kidsBlock = oneKid ? '' : kidsHtml(kidsModel());
      return {
        title: isTeacher ? RO.WORDS.teacher.set : TEXT.whenTitle, backLabel: fixedCid && kidOf(fixedCid) ? kidOf(fixedCid).nickname : TEXT.wordsTitle.replace('?', ''),
        summary: summaryHtml({ ...sumModel(), role }), dateLabel: dateLabel(), dates: datesModel(), length: lengthHtml(day, st.test),
        estimate: estimateHtml(SD.estimateLines({ kids: ks.map((k) => ({ nickname: k.nickname, year: k.year, d: k.d })), words: finalWords(), test: st.test, today: day })),
        preview: pm && !pm.error ? previewHtml({ ...pm, dayOpen: st.dayOpen }) : '', kids: kidsBlock, different: diffModel() && { ...diffModel() },
        nameOpen: st.nameOpen, nameValue: st.name, namePlaceholder: defaultWeekName(), banner,
        bar: { label: st.message ? TEXT.tryAgain : setButton(role, names.length ? names : ['your child']), line: st.message ? barLine0(names) + '. ' + TEXT.choicesKept : barLine0(names), disabled: !!why || st.saving || st.offline, why: st.message ? '' : why },
        sheet: st.sheet && pm && !pm.error ? sheetHtml(pm) : '',
      };
    };
    const barLine0 = (names) => barLine({ role, names, count: names.length, total: kids.length, start: day, test: st.test, today: day });
    const trimModel = () => ({ label: st.src ? st.src.label : '', words: st.listWords, ticked: st.ticked, msg: st.trimMsg });

    // -- drawing ----------------------------------------------------------------------------------------------------------------------
    function draw(focus = null) {
      let html;
      if (st.step === 'done') html = doneHtml(doneModel());
      else if (st.renaming) html = renameHtml(renameModel());
      else if (st.step === 'trim') html = trimHtml(trimModel());
      else if (st.step === 'when') html = whenHtml(whenModel());
      else if (st.wv === 'wbw') html = wbwHtml(wbwModel());
      else if (st.wv === 'typeall') html = typeAllHtml({ listName: st.listName, saveIn: saveInOptions(D.splitTyped(st.text).length), addTo: saveInOptions(D.splitTyped(st.text).length).some((o) => o.id === st.addTo) ? st.addTo : '', text: st.text, count: D.splitTyped(st.text).length, refused: st.refused });
      else if (st.wv === 'patterns') html = patternsHtml(patternsModel());
      else if (st.wv === 'tricky') { const k = pickKids()[0]; const t = trickyOf(k); html = trickyHtml({ title: poss(k.nickname) + ' words to practise again', name: k.nickname, words: t.slice(0, W.MAX_WORDS), note: plural(t.length, 'word') + ' to practise again. A week holds ' + W.MAX_WORDS + '. Add more from My lists or Ready-made to fill the week, or use just these.' }); }
      else html = wordsHtml(wordsModel());
      main.innerHTML = html;
      fixIndeterminate(main, st.step === 'when' && st.cids.length > 0 && st.cids.length < kids.length);
      if (st.sheet) { const box = main.querySelector('.st-sheetbox'); if (box && box.focus) box.focus(); }
      else if (focus) focusKey(main, focus);
    }
    const goStep = (step) => { st.step = step; st.sheet = false; draw(); toTop(); };

    // -- steps ------------------------------------------------------------------------------------------------------------------------------
    const reachedWhen = () => {
      if (st.src && st.src.kind === 'typed') typedSource();
      st.gids = null; // the words or children may have changed: ids are made again for this form
      goStep('when');
    };
    function addTypedWords(text) {
      const before = st.wbw.length;
      return D.addTyped(text, st.wbw.map((w) => w.word), (raw) => checkTyped(raw, findEntry)).then((r) => {
        if (stopped) return null;
        st.wbw = r.list.map((w) => ({ word: w }));
        st.msg = D.addedLine(r, before) + (r.offline ? ' ' + 'We can’t check that word just now.' : '');
        st.refused = r.refused.length ? r.refused.length + ' we can’t use yet: ' + r.refused.join(', ') + '. ' + D.OWN_REFUSED_WHY : '';
        return r;
      });
    }
    const suggestUpdate = () => { const box = main.querySelector('[data-sugg]'); if (box) box.innerHTML = suggHtml(SD.findWords(st.find, Dt.allWords()).filter((s) => !st.wbw.some((w) => lc(w.word) === lc(s.word))), st.find); };

    /** D9: a word typed on "Which 10 words?" joins the list; the list plus the word is saved as a new list when the week is set. */
    function addToTrim(raw) {
      if (!raw.trim()) return;
      if (st.listWords.length >= Ow.MAX_WORDS) { st.trimMsg = TEXT.trimFull; draw(); return; }
      checkTyped(raw, findEntry).then((r) => {
        if (stopped) return;
        if (!r.word) { st.trimMsg = r.error === NEEDS_LIST ? D.OWN_WORD_OFFLINE : D.OWN_REFUSED + '. ' + D.OWN_REFUSED_WHY; draw({ act: 'addword' }); return; }
        if (st.listWords.some((w) => lc(w) === lc(r.word))) { st.trimMsg = D.OWN_REPEAT; draw({ act: 'addword' }); return; }
        if (!st.src || st.src.kind !== 'typed') {
          const label = (st.src ? st.src.label : '').slice(0, Ow.MAX_NAME);
          st.wbw = st.listWords.map((w) => ({ word: w }));
          st.src = { kind: 'typed', id: '', label };
          st.listName = label || newName();
          st.addTo = '';
        } else st.wbw = st.listWords.map((w) => ({ word: w }));
        st.listWords = [...st.listWords, r.word];
        st.wbw.push({ word: r.word });
        if (st.ticked.length < W.MAX_WORDS) st.ticked = [...st.ticked, r.word];
        st.trimMsg = ''; st.gids = null; st.newOid = null; st.trimmed = true;
        draw({ act: 'addword' });
        const box = main.querySelector('[data-addword]'); if (box && box.focus) box.focus();
      });
    }
    function onClick(t, e) {
      const act = t.dataset.act;
      const arg = t.dataset;
      if (act === 'tab') { st.tab = arg.tab; rememberTab(st.tab); if (st.tab === 'lists' && !(st.src && st.src.kind === 'list')) { const f = orderedLists()[0]; if (f) selectList(f.id); } draw({ act, attr: 'data-tab="' + arg.tab + '"' }); }
      else if (act === 'year') { st.yearId = arg.year; draw({ act, attr: 'data-year="' + arg.year + '"' }); }
      else if (act === 'next') {
        if (st.step === 'words' && st.wv !== 'main') {
          if (st.wv === 'wbw') { if (!st.wbw.length) return; typedSource(); }
          else if (st.wv === 'typeall') { addTypedWords(st.text).then(() => { if (stopped) return; if (!st.wbw.length) { draw(); return; } typedSource(); st.wv = 'main'; reachedWhen(); }); return; }
          else if (st.wv === 'patterns') { if (!selectPattern(st.patternId)) return; }
          else if (st.wv === 'tricky') { const t = trickyOf(pickKids()[0]); setSource({ kind: 'tricky', id: 'tricky', label: poss(pickKids()[0].nickname) + ' words to practise again' }, t.slice(0, W.MAX_WORDS)); }
          st.wv = 'main';
        }
        if (!st.src || !st.listWords.length) return;
        reachedWhen();
      }
      else if (act === 'wbw') { st.wv = 'wbw'; st.find = ''; st.msg = ''; if (!(st.src && st.src.kind === 'typed')) st.wbw = []; draw({ act: 'wbw' }); toTop(); }
      else if (act === 'typeall') { st.wv = 'typeall'; st.refused = ''; draw(); toTop(); }
      else if (act === 'patterns') { st.wv = 'patterns'; if (!(st.src && st.src.kind === 'pattern') && patterns.length) selectPattern(st.patternId); draw(); toTop(); }
      else if (act === 'tricky') { st.wv = 'tricky'; draw(); toTop(); }
      else if (act === 'toWords') { st.wv = 'main'; st.step = 'words'; draw(); toTop(); }
      else if (act === 'toNew') { st.wv = 'main'; st.tab = 'new'; draw(); toTop(); }
      else if (act === 'toWhen') goStep('when');
      else if (act === 'back') {
        if (st.step === 'when') { st.step = 'words'; draw(); toTop(); return; }
        go(fixedCid ? '#/grownups/child/' + encodeURIComponent(fixedCid) : params.oid ? '#/grownups/own/' + encodeURIComponent(params.oid) : '#/grownups');
      }
      else if (act === 'pick') { if (st.wbw.length < Ow.MAX_WORDS && !st.wbw.some((w) => lc(w.word) === lc(arg.word))) st.wbw.push({ word: arg.word }); st.find = ''; st.msg = st.wbw.length >= Ow.MAX_WORDS ? D.OWN_FULL : ''; draw({ act: 'wbw' }); const i = main.querySelector('[data-find]'); if (i && i.focus) i.focus(); }
      else if (act === 'addfind') { const q = st.find.trim(); if (!q) return; addTypedWords(q).then((r) => { if (stopped || !r) return; if (!st.refused) st.find = ''; draw(); const i = main.querySelector('[data-find]'); if (i && i.focus) i.focus(); const m = main.querySelector('[data-msg]'); if (m && st.refused) m.textContent = st.refused; }); }
      else if (act === 'rm') { st.wbw = st.wbw.filter((w) => w.word !== arg.word); draw({ act: 'wbw' }); }
      else if (act === 'trim') { st.returnTo = 'when'; goStep('trim'); }
      else if (act === 'addword') { const box = main.querySelector('[data-addword]'); addToTrim(box ? box.value : ''); }
      else if (act === 'trimdone') { st.trimmed = st.listWords.length > W.MAX_WORDS; st.gids = null; goStep('when'); }
      else if (act === 'chip') { st.test = SD.chipTest(day, Number(arg.days)); st.pick = false; st.gids = null; draw({ act, attr: 'data-days="' + arg.days + '"' }); }
      else if (act === 'pickdate') { st.pick = true; draw({ act }); const i = main.querySelector('[data-date]'); if (i && i.focus) i.focus(); }
      else if (act === 'preview') { st.sheet = true; draw(); }
      else if (act === 'closesheet') { st.sheet = false; draw({ act: 'preview' }); }
      else if (act === 'ownclear') { delete st.own[st.ownCid]; draw(); }
      else if (act === 'set' || act === 'retry') doSet(act === 'retry');
      else if (act === 'rest') startAgain({ rest: true });
      else if (act === 'another' || act === 'nextlearner' || act === 'also') startAgain({ cid: act === 'also' ? t.dataset.cid : null, another: act === 'another', next: act === 'nextlearner' });
      else if (act === 'rename') { st.renaming = true; st.rename = st.done ? st.done.weekName : ''; st.renameErr = ''; draw(); toTop(); }
      else if (act === 'backrename') { st.renaming = false; draw(); }
      else if (act === 'uselist') { st.rename = st.src ? st.src.label : ''; st.renameErr = ''; draw(); }
      else if (act === 'savename') saveRename();
    }
    function onChange(t) {
      if (t.dataset && t.dataset.kid !== undefined) {
        const id = t.dataset.kid;
        const set = new Set(st.cids);
        if (t.checked) set.add(id); else set.delete(id);
        st.cids = kids.filter((k) => set.has(k.id)).map((k) => k.id);
        if (role === 'tutor' && st.cids.length > 1) { /* a tutor may tick more than one learner */ }
        st.gids = null; refresh();
      } else if (t.dataset && t.dataset.all !== undefined) {
        st.cids = st.cids.length === kids.length ? [] : kids.map((k) => k.id);
        st.gids = null; refresh();
      } else if (t.dataset && t.dataset.tick !== undefined) {
        const w = t.value;
        if (t.checked) { if (st.ticked.length < W.MAX_WORDS) st.ticked = st.listWords.filter((x) => lc(x) === lc(w) || st.ticked.some((y) => lc(y) === lc(x))); }
        else st.ticked = st.ticked.filter((x) => lc(x) !== lc(w));
        st.gids = null; draw();
      } else if (t.dataset && t.dataset.addto !== undefined) { st.addTo = t.value; st.newOid = null; st.gids = null; if (st.src && st.src.kind === 'typed') typedSource(); draw(); }
      else if (t.dataset && t.dataset.chapter !== undefined) { selectChapter(t.dataset.chapter); draw(); }
      else if (t.dataset && t.dataset.list !== undefined) { selectList(t.dataset.list); draw(); }
      else if (t.dataset && t.dataset.pattern !== undefined) { selectPattern(t.dataset.pattern); draw(); }
      else if (t.dataset && t.dataset.busy !== undefined) { st.busy[t.dataset.busy] = t.value === 'replace' ? 'replace' : 'keep'; draw(); }
      else if (t.dataset && t.dataset.date !== undefined) { if (iso(t.value)) { st.test = t.value; st.pick = true; st.gids = null; draw({ act: 'pickdate' }); } }
      else if (t.dataset && t.dataset.ownkid !== undefined) { st.ownCid = t.value; st.ownOpen = true; draw(); }
      else if (t.dataset && t.dataset.owndate !== undefined) { if (iso(t.value) && t.value !== st.test) st.own[st.ownCid || tickedKids()[0].id] = t.value; else delete st.own[st.ownCid || tickedKids()[0].id]; st.ownOpen = true; draw(); }
    }
    function onInput(t) {
      if (t.dataset && t.dataset.find !== undefined) { st.find = t.value; suggestUpdate(); }
      else if (t.dataset && t.dataset.listname !== undefined) { st.listName = t.value; }
      else if (t.dataset && t.dataset.text !== undefined) { st.text = t.value; const c = main.querySelector('[data-count]'); if (c) c.textContent = plural(D.splitTyped(st.text).length, 'word'); }
      else if (t.dataset && t.dataset.name !== undefined) { st.name = t.value; }
      else if (t.dataset && t.dataset.rename !== undefined) { st.rename = t.value; const h = main.querySelector('[data-rhelp]'); if (h) h.textContent = t.value.length >= W.MAX_NAME ? TEXT.nameFull.join('') : TEXT.nameHelp40; }
    }
    function onKey(e) {
      if (e.key === 'Escape' && st.sheet) { st.sheet = false; draw({ act: 'preview' }); return; }
      if (e.key === 'Enter' && e.target && e.target.dataset && e.target.dataset.find !== undefined) { e.preventDefault(); onClick({ dataset: { act: 'addfind' } }, e); }
      if (e.key === 'Enter' && e.target && e.target.dataset && e.target.dataset.name !== undefined) e.preventDefault();
    }
    // after a tick: only the parts that change are drawn again (the child's list, the bar, the preview), so the tapped box keeps focus
    function refresh() { draw(); }
    const detToggles = () => {
      const n = main.querySelector('[data-name-det]');
      if (n) n.addEventListener('toggle', () => { st.nameOpen = !!n.open; });
      const d = main.querySelector('[data-day]');
      if (d) d.addEventListener('toggle', () => { st.dayOpen = !!d.open; });
    };
    const drawBase = draw;
    // eslint-disable-next-line no-func-assign
    draw = function drawWithToggles(focus) { drawBase(focus); detToggles(); };

    // -- Set --------------------------------------------------------------------------------------------------------------------------------
    function makeIds() {
      if (st.gids) return st.gids;
      const oid = st.src && st.src.kind === 'list' ? st.src.id : st.newOid || '';
      st.gids = SX.makeGids(st.cids, { oid, role });
      return st.gids;
    }
    async function doSet(retry) {
      if (st.saving) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) { st.offline = true; draw(); return; }
      st.offline = false;
      const why = problem();
      if (why) { draw(); return; }
      st.saving = true; st.message = '';
      draw();
      const words = finalWords();
      const name = weekName().slice(0, W.MAX_NAME);
      const cids = retry && st.done ? st.done.failed.map((f) => f.id) : [...st.cids];
      let oid = st.src && st.src.kind === 'list' ? st.src.id : '';
      const wasTyped = !!(st.src && st.src.kind === 'typed');
      const opts = { now: () => Date.now(), by: by || undefined };
      // typed or picked words become a Word list first (the master only), and the week ids carry that list's id
      if (st.src && st.src.kind === 'typed' && !oid) {
        const into = st.addTo ? ownAll()[st.addTo] : null;
        // SB5 M2: an existing list's id is never kept in st.newOid (a later "Save in" change would then overwrite it);
        // st.newOid holds only an id this page made, kept so a retry of a failed save reuses the same new list.
        if (!into && !st.newOid) st.newOid = S.newId();
        oid = into ? st.addTo : st.newOid;
        // "Save in": the typed words join the chosen list (its name, children and sentences stay); else a new list is made
        const merged = into ? [...into.words, ...st.listWords.filter((w) => !into.words.some((x) => lc(x) === lc(w)))] : st.listWords;
        if (into && merged.length > Ow.MAX_WORDS) { st.saving = false; st.message = TEXT.trimFull + ' Pick another list, or a new one.'; draw(); return; }
        const made = D.saveOwnMaster(into ? { oid, name: into.name, words: merged, src: into.src, to: into.to, info: into.info } : { oid, name: st.listName || name, words: st.listWords, src: 'typed', to: [] }, { now: opts.now, isReady: (w) => SD.sourceOf(w, findEntry).kind === 'ready' });
        if (!made.ok) { st.saving = false; st.message = made.error ? (D.OWN_ERRORS[made.error] || P.PROBLEM_TEXT.other) : (P.PROBLEM_TEXT[made.problem] || P.PROBLEM_TEXT.other); draw(); return; }
        // The words are a Word list now: this page carries on with that list, so a retry or "Set a week for <next learner>" reuses it
        // and never makes a second copy (SB5 M2, m1). The ticked words stay as they are.
        st.src = { kind: 'list', id: oid, label: (into ? into.name : st.listName || name).slice(0, Ow.MAX_NAME) };
        st.gids = null; st.newOid = null; st.addTo = '';
      }
      const gids = makeIds();
      const groups = new Map();
      for (const cid of cids) { const t = st.own[cid] || st.test; (groups.get(t) || groups.set(t, []).get(t)).push(cid); }
      const results = {};
      let masterBad = null;
      for (const [t, ids] of groups) {
        const r = await SX.setWeek(childApi(), { oid, cids: ids, gids, name, test: t, words, today: day }, opts);
        if (stopped) return;
        if (r.master && !r.master.ok) { masterBad = r.master; break; }
        Object.assign(results, r.results);
      }
      st.saving = false;
      if (masterBad) { st.message = masterBad.error ? (D.OWN_ERRORS[masterBad.error] || TEXT.failed) : (P.PROBLEM_TEXT[masterBad.problem] ? TEXT.failed : TEXT.failed); if (masterBad.problem === 'signed-out') recheckWho(); draw(); return; }
      const prior = retry && st.done ? st.done.ok : [];
      const ok = [...prior, ...cids.filter((c) => results[c] && results[c].ok).map((c) => ({ id: c, name: kidOf(c).nickname, from: day, test: st.own[c] || st.test, gid: gids[c] }))];
      const failed = cids.filter((c) => !(results[c] && results[c].ok)).map((c) => ({ id: c, name: kidOf(c).nickname, line: failLine(results[c] || { problem: 'other' }) }));
      // "Replace it": the week that was running goes (it can be brought back for 30 days), only for a child whose new week was saved
      for (const o of ok) {
        if (st.busy[o.id] !== 'replace' || o.replaced) continue;
        const k = kidOf(o.id);
        const r0 = k && k.d ? SD.runningFor(k.d, oid, listsNow()) : null;
        const old = r0 && k.d ? W.liveGroups(k.d).find((g) => g.name === r0.name && g.test === r0.test && !W.testDone(k.d, g)) : null;
        if (old && old.id !== o.gid) { await SX.deleteWeek(childApi(), o.id, old.id, opts); o.replaced = true; }
      }
      st.done = { ok, failed, oid, weekName: name, words, listWords: st.listWords, role };
      if (st.cids.length && !failed.length) st.cidsSet = ok.map((o) => o.id);
      goStep('done');
      // WP-8: after a week with typed words, ask for their pictures (the grown-up's own typed words only; never swaps by itself)
      const own = wasTyped ? words.filter((w) => !findEntry(w)) : [];
      if (own.length && ok.length && oid) import('./pictures-views.js').then((PV) => PV.savedNote(main.querySelector('[data-pictures-host]'), { words: own, oid })).catch(() => {});
    }
    function doneModel() {
      const d = st.done;
      const same = new Set(d.ok.map((o) => o.test)).size <= 1;
      const rest = SD.restAfter(d.listWords, d.words);
      const doneIds = d.ok.map((o) => o.id);
      const notSet = kids.filter((k) => !doneIds.includes(k.id) && !(k.d && W.liveGroups(k.d).some((g) => !W.testDone(k.d, g))));
      const next = RO.nextLearner(role, kids.map((k) => ({ id: k.id, name: k.nickname, d: k.d })), doneIds);
      return {
        role, ok: d.ok, failed: d.failed, test: d.ok.length ? d.ok[0].test : st.test, sameTest: same, weekName: d.weekName, line: weekSizeLine(d.listWords, d.words), by, rest, oid: d.oid,
        notSet: notSet.map((k) => k.nickname), notSetIds: notSet.map((k) => k.id), links: { change: d.ok.length ? '#/grownups/child/' + encodeURIComponent(d.ok[0].id) + '/plan/' + encodeURIComponent(d.ok[0].gid) : '#/grownups' },
        next: next ? { id: next.id, name: next.name, note: next.name + ' has no week yet' } : null, count: d.ok.length, total: kids.length,
      };
    }
    function startAgain({ rest, cid, another, next }) {
      const d = st.done;
      const doneIds = d ? d.ok.map((o) => o.id) : [];
      st.gids = null; st.newOid = null; st.done = null; st.message = ''; st.own = {}; st.busy = {}; st.name = ''; st.renaming = false;
      if (rest && d) { const oid = d.oid; if (oid) { go('#/grownups/set/list/' + encodeURIComponent(oid) + (st.cids.length === 1 ? '/child/' + encodeURIComponent(st.cids[0]) : '')); return; } st.listWords = SD.restAfter(d.listWords, d.words); st.ticked = st.listWords.slice(0, W.MAX_WORDS); st.src = { kind: 'typed', id: '', label: st.src ? st.src.label : '' }; st.step = 'when'; draw(); toTop(); return; }
      if (another) { const nx = RO.nextLearner(role, kids.map((k) => ({ id: k.id, name: k.nickname, d: k.d })), doneIds); if (nx) st.cids = [nx.id]; st.step = 'when'; draw(); toTop(); return; }
      if (cid) { st.cids = [cid]; st.step = 'when'; draw(); toTop(); return; }
      if (next) { const nx = RO.nextLearner(role, kids.map((k) => ({ id: k.id, name: k.nickname, d: k.d })), doneIds); if (nx) go('#/grownups/set/child/' + encodeURIComponent(nx.id)); }
    }
    // -- rename what was just set (05j5, 05j6) ----------------------------------------------------------------------------------------
    const renameModel = () => {
      const d = st.done;
      const names = d.ok.map((o) => o.name);
      return { value: st.rename, help: TEXT.nameHelp40 + (d.ok.length > 1 ? TEXT.nameBoth : ''), error: st.renameErr, useList: st.renameErr && st.src ? st.src.label : '', locked: false, backLabel: names[0], title: TEXT.renameTitle,
        sub: joinNames(names) + ' · ' + rangeLine(day, d.ok[0].test) + ' · ' + d.weekName, saveLine: names[0] + ' sees the new name on Today' };
    };
    async function saveRename() {
      const text = st.rename.trim();
      if (!text) { st.renameErr = TEXT.nameEmpty; draw(); return; }
      const d = st.done;
      const rs = await Promise.all(d.ok.map((o) => SX.changeWeek(childApi(), o.id, o.gid, { name: text }, { today: day, by: by || undefined })));
      if (stopped) return;
      const bad = rs.find((r) => !r.ok);
      if (bad) { st.renameErr = bad.error || P.PROBLEM_TEXT[bad.problem] || P.PROBLEM_TEXT.other; draw(); return; }
      d.weekName = text; st.renaming = false; st.renameErr = ''; draw(); toTop();
    }

    off = pageApi(main, { click: onClick, change: onChange, input: onInput, key: onKey });
    // -- the way in ------------------------------------------------------------------------------------------------------------------------
    if (typeof navigator !== 'undefined' && navigator.onLine === false) st.offline = true;
    const listOid = params.oid || '';
    if (listOid) {
      if (selectList(listOid)) st.step = 'when';
      else { st.message = TEXT.listGone; }
    } else if (defaults.oid && st.tab === 'lists' && listsNow().length) { selectList(defaults.oid); }
    if (st.step === 'when' && st.src && st.src.kind === 'list' && !st.cids.length) st.cids = defaults.cids.length ? defaults.cids : [kids[0].id];
    if (role === 'tutor' && listOid && fixedCid) st.cids = [fixedCid];
    // legacy hand-off (one release): words an older "Use for this week" left behind
    let chapterId = '';
    try { chapterId = globalThis.sessionStorage.getItem(SET_CHAPTER_KEY) || ''; globalThis.sessionStorage.removeItem(SET_CHAPTER_KEY); } catch (e) { chapterId = ''; }
    if (!listOid && chapterId && Dt.chapterById(chapterId) && selectChapter(chapterId)) {
      st.tab = 'ready'; st.yearId = Dt.chapterById(chapterId).yearId; st.step = 'when';
      if (!st.cids.length) st.cids = defaults.cids.length ? defaults.cids : [kids[0].id];
    }
    const handed = D.takePlanWords();
    if (handed && !listOid) { st.wbw = handed.map((w) => ({ word: w })); st.wv = 'wbw'; typedSource(); st.wv = 'main'; st.step = 'when'; }
    draw();
  }
  return () => { stopped = true; off(); };
}

// ================================================================== Change a week (TR-18, 05d, 05j4) =======================================
/** #/grownups/child/:cid/plan/:gid: one child's week. The words and the date until the test has begun; the name any time. */
export function changeWeek(main, { cid, gid } = {}) {
  return oneWeek(main, { cid, gid, mode: 'change' });
}
/** #/grownups/child/:cid/rename/:gid: the name only (05j, 05j2, 05j3). */
export function renameWeek(main, { cid, gid } = {}) {
  return oneWeek(main, { cid, gid, mode: 'rename' });
}
function oneWeek(main, { cid, gid, mode }) {
  if (!guard(main)) return undefined;
  const api = childApi();
  let stopped = false;
  let off = () => {};
  loadingPage(main);
  const day = today();
  const run = async () => {
    const [me, lc0] = await Promise.all([within(A.readMe(api), LOAD_MS, A.meFacts(null)), within(A.listChildren(api), LOAD_MS, { problem: 'network' })]);
    if (stopped) return;
    if (lc0.problem) { problemPage(main, lc0.problem, run); return; }
    const kid = lc0.children.find((c) => c.id === cid);
    if (!kid) { problemPage(main, 'no-child'); return; }
    const c = await within(A.readChild(api, cid), LOAD_MS, { problem: 'network' });
    if (stopped) return;
    if (c.problem) { problemPage(main, c.problem, run); return; }
    let g = W.groupById(c.words, gid);
    if (!g) { go('#/grownups/child/' + encodeURIComponent(cid)); return; }
    const { name: by } = roleNow(me);
    const others = lc0.children.filter((x) => x.id !== cid);
    const oid = SD.weekListOid(g.id);
    const master = oid ? Ow.normalise(W.ownOf(S.readWords()))[oid] : null;
    let locked = !W.canEdit(c.words, g);
    const st = { name: g.name, test: g.test, words: [...g.words], shown: [...g.words], wordsOpen: false, pick: false, error: '', saving: false, msg: '', nameOpen: false, notice: false };
    const childHref = '#/grownups/child/' + encodeURIComponent(cid);
    const renameModel = () => ({ value: st.name, help: TEXT.nameHelp40, error: st.error, useList: st.error && master ? master.name : '', locked, backLabel: kid.nickname, sub: (locked ? W.dayLabel(g.test) + ' · test started' : rangeLine(g.start, g.test) + ' · ' + g.name), saveLine: locked ? 'Results stay with the week' : kid.nickname + ' sees the new name on Today' });
    const changeModel = () => ({
      name: kid.nickname, other: others.length ? others[0].nickname : '', backLabel: kid.nickname, label: g.name, count: st.words.length, wordsOpen: st.wordsOpen, wordsBlock: wordsBlockHtml({ words: st.words, shown: st.shown, msg: st.msg }),
      dates: datesChange(), length: lengthHtml(day, st.test), estimate: estimateHtml(SD.estimateOne({ nickname: kid.nickname, year: Number(kid.year) || 0, d: c.words, words: st.words, test: st.test, today: day })), nameOpen: st.nameOpen, nameValue: st.name, saveLine: st.notice ? TEXT.savedLine : kid.nickname + ' sees the change on Today', error: st.error, saving: st.saving, notice: st.notice,
      passed: g.test < day && st.test === g.test ? P.passedLine(kid.nickname) : '', // S3-D4
    });
    const datesChange = () => {
      const same = st.test === g.test;
      const chips = '<div class="st-dates st-dates--3" role="group" aria-label="' + esc(TEXT.testOn) + '"><button type="button" class="' + (same && !st.pick ? 'is-on' : '') + '" data-act="keepdate" aria-pressed="' + (same && !st.pick) + '">' + esc(W.dayLabel(g.test)) + '<small>' + esc(TEXT.nowChip) + '</small></button>'
        + SD.DATE_CHIPS.filter((n) => SD.chipTest(day, n) !== g.test).slice(0, 1).map((n) => '<button type="button" class="' + (st.test === SD.chipTest(day, n) && !st.pick ? 'is-on' : '') + '" data-act="chip" data-days="' + n + '" aria-pressed="' + (st.test === SD.chipTest(day, n) && !st.pick) + '">' + esc(SD.chipLabel(n)) + '<small>' + esc(W.dayLabel(SD.chipTest(day, n))) + '</small></button>').join('')
        + '<button type="button" class="' + (st.pick || (!same && !SD.DATE_CHIPS.some((n) => SD.chipTest(day, n) === st.test)) ? 'is-on' : '') + '" data-act="pickdate" aria-pressed="' + st.pick + '">' + esc(TEXT.pickDate) + '</button></div>';
      const field = st.pick ? '<div class="st-field st-field--date"><label for="st-date">' + esc(TEXT.dateLabel) + '</label><input id="st-date" class="st-input" type="date" data-date value="' + esc(st.test) + '" min="' + esc(W.addDays(day, 1)) + '" max="' + esc(W.addDays(g.start, W.MAX_DAYS)) + '"></div>' : '';
      return chips + field;
    };
    const draw = (focus) => {
      main.innerHTML = mode === 'rename' || locked ? renameHtml(renameModel()) : changeHtml(changeModel());
      const n = main.querySelector('[data-name-det]');
      if (n) n.addEventListener('toggle', () => { st.nameOpen = !!n.open; });
      if (focus) focusKey(main, focus);
    };
    async function save() {
      if (st.saving) return;
      const name = st.name.trim();
      if (!name) { st.error = TEXT.nameEmpty; draw(); return; }
      st.saving = true; st.error = ''; draw();
      const changes = mode === 'rename' || locked ? { name } : { name, words: st.words, test: st.test };
      const r = await SX.changeWeek(api, cid, gid, changes, { today: day, by: by || undefined });
      if (stopped) return;
      st.saving = false;
      if (r.ok && r.updated) { // D21: the week was changed on another device meanwhile; our change went on top of it. Show what is there now.
        const again = await A.readChild(api, cid);
        if (stopped) return;
        const g2 = again.problem ? null : W.groupById(again.words, gid);
        if (g2) { g = g2; locked = !W.canEdit(again.words, g2); st.name = g2.name; st.test = g2.test; st.words = [...g2.words]; st.notice = true; st.pick = false; draw(); toTop(); return; }
      }
      if (r.ok) { go(childHref); return; }
      if (r.problem === 'signed-out') recheckWho();
      st.error = r.error || (P.PROBLEM_TEXT[r.problem] || P.PROBLEM_TEXT.other) + ' Nothing has been saved.';
      draw();
    }
    off = pageApi(main, {
      click: (t) => {
        const a = t.dataset.act;
        if (a === 'back' || a === 'backrename') go(childHref);
        else if (a === 'save' || a === 'savename') save();
        else if (a === 'uselist') { if (master) st.name = master.name; st.error = ''; draw(); }
        else if (a === 'words') { st.wordsOpen = !st.wordsOpen; draw({ act: 'words' }); }
        else if (a === 'keepdate') { st.test = g.test; st.pick = false; draw(); }
        else if (a === 'chip') { st.test = SD.chipTest(day, Number(t.dataset.days)); st.pick = false; draw(); }
        else if (a === 'pickdate') { st.pick = true; draw(); }
        else if (a === 'addword') {
          const box = main.querySelector('[data-addword]');
          const raw = box ? box.value : '';
          if (st.words.length >= W.MAX_WORDS) { st.msg = 'A week holds ' + W.MAX_WORDS + ' words.'; draw(); return; }
          checkTyped(raw, findEntry).then((r) => { if (stopped) return; if (r.word) { if (!st.words.some((w) => lc(w) === lc(r.word))) st.words.push(r.word); if (!st.shown.some((w) => lc(w) === lc(r.word))) st.shown.push(r.word); st.msg = ''; } else st.msg = r.error; draw(); });
        }
      },
      change: (t) => {
        if (t.dataset.wk !== undefined) { if (t.checked && st.words.length >= W.MAX_WORDS) { st.msg = 'A week holds ' + W.MAX_WORDS + ' words.'; draw(); return; } st.words = t.checked ? [...st.words, t.value] : st.words.filter((w) => lc(w) !== lc(t.value)); st.msg = st.words.length ? '' : 'Keep at least one word.'; if (!st.words.length) st.words = [t.value]; draw(); }
        else if (t.dataset.date !== undefined && iso(t.value)) { st.test = t.value; draw(); }
      },
      input: (t) => {
        if (t.dataset.name !== undefined || t.dataset.rename !== undefined) { st.name = t.value; const h = main.querySelector('[data-rhelp]'); if (h) h.textContent = t.value.length >= W.MAX_NAME ? TEXT.nameFull.join('') : TEXT.nameHelp40; }
      },
      key: () => {},
    });
    draw();
  };
  run();
  return () => { stopped = true; off(); };
}
