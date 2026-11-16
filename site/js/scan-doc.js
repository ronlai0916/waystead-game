// SB4-WP8: scanning a school paper into an own chapter. Pure rules and the wording: no DOM, no storage,
// no clock, no random. The account's answers are never trusted (clean); the scan page is drawn only
// when the account says scanning is on (isOn).

import { weekdayForm } from './wordcheck.js';

export const WORD_RE = /^[A-Za-z][A-Za-z'-]{0,24}$/;
export const MAX_FOUND = 40;
export const MAX_PICK = 15;
export const MAX_BYTES = 2097152;
export const TIMEOUT_MS = 30000;
export const STILL_READING_MS = 15000;

// Ron fills these in before switching scanning on. While empty, the consent text says "an AI service".
export const SCAN_VENDOR = '';
export const PRIVACY_HREF = '';

/** True only for a 200 answer whose `on` is exactly true. Anything else (404, offline, HTML) is off. */
export function isOn(a) {
  return !!(a && a.ok === true && a.status === 200 && a.data && typeof a.data === 'object' && a.data.on === true);
}

/** The words the account sent, or { problem } or { words }. Never trusts the shape. */
export function clean(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.words)) return { problem: 'read-failed' };
  const seen = new Set();
  const words = [];
  for (const w of data.words) {
    if (typeof w !== 'string' || !WORD_RE.test(w)) continue;
    const k = w.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    words.push(w);
    if (words.length === MAX_FOUND) break;
  }
  return words.length ? { words } : { problem: 'no-words' };
}

export const REASON = {
  cant: 'We can\'t use this word yet', // the same text as own-data.js OWN_REFUSED (a test compares the two)
  name: 'Looks like a name',
  over: 'For the next chapter',
};

const isCapital = (w) => /^[A-Z]/.test(w);
// A capital that stays when a word is saved the way our lists spell it.
export const KEEP_CAPITAL = new Set(['I', 'Mr', 'Mrs', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Christmas']);
const listSpelling = (w) => weekdayForm(w) || (KEEP_CAPITAL.has(w) ? w : w.toLowerCase());

/**
 * Splits the found words into the ones to offer and the ones left out.
 * `checks` maps a lower-case word to true when it is on our lists (the answer of checkTyped); anything else is not.
 * `known` maps a lower-case word to true when it is a curriculum word (findEntry has it).
 * A word that starts with a capital is offered only when it is a curriculum word or in KEEP_CAPITAL; any other is a name
 * and is masked first, even with an apostrophe or hyphen: `shown` is "R.....", never the word or its length.
 * Any other word with an apostrophe or hyphen, an unknown one and a blocked one all give the same single line.
 * A word that is offered goes into `use` in its list spelling (lower case, except KEEP_CAPITAL).
 * `limit` (default 15) caps `use`; the words past it are in `out` as REASON.over. The screens pass MAX_FOUND and pre-tick the first 15.
 */
export function sortFound(words, checks, limit = MAX_PICK, known = {}) {
  const use = [];
  const out = [];
  const has = (m, w) => !!m && typeof m === 'object' && Object.hasOwn(m, w.toLowerCase()) && m[w.toLowerCase()] === true;
  for (const w of Array.isArray(words) ? words : []) {
    if (isCapital(w) && !has(known, w) && !KEEP_CAPITAL.has(w) && !weekdayForm(w)) { out.push({ word: w, shown: w[0] + '.....', reason: REASON.name }); continue; }
    if (/['-]/.test(w) || !has(checks, w)) { out.push({ word: w, shown: w, reason: REASON.cant }); continue; }
    if (use.length >= limit) { out.push({ word: w, shown: w, reason: REASON.over }); continue; }
    use.push(listSpelling(w));
  }
  return { use, out };
}

export const MANY_NAMES = 'Many words start with a capital letter, so we left them out in case they are names. Add them with Add a word.';
/** More than half of the found words were left out as names: the extra line is drawn. */
export const manyNames = (found, names) => found > 0 && names * 2 > found;

/** A key for what went wrong, from { ok, status, data, timedOut }; null when nothing did. */
export function problemOf(r) {
  const s = r && typeof r.status === 'number' ? r.status : 0;
  const e = r && r.data && typeof r.data === 'object' ? r.data.error : '';
  if (s === 0) return r && r.timedOut ? 'timeout' : r && r.aborted ? 'cancelled' : 'offline'; // 'cancelled' has no copy: the page ignores it
  if (s >= 200 && s < 300) return null;
  if (s === 401) return 'signed-out';
  if (s === 403) return 'playing';
  if (s === 404) return 'off';
  if (s === 412) return 'consent';
  if (s === 413 || s === 415) return 'too-large';
  if (s === 429) return e === 'hourly-limit' ? 'hourly' : e === 'monthly-limit' ? 'monthly' : 'failed';
  if (s === 503) return 'paused';
  return 'failed';
}

const TRY = 'Try again';
const PHOTO = 'Take another photo';
export const PROBLEM_COPY = {
  offline: { line: 'You\'re offline. Connect to the internet and try again.', button: TRY },
  timeout: { line: 'That didn\'t work this time.', button: TRY },
  failed: { line: 'That didn\'t work this time.', button: TRY },
  'read-failed': { line: 'That didn\'t work this time.', button: TRY },
  cancelled: { line: 'Stopped. Your photo is still here.', button: TRY, button2: PHOTO },
  'no-words': { line: 'We couldn\'t find any words. Try a flatter photo in better light, or a printed list.', button: PHOTO },
  'too-large': { line: 'That photo is too big. Try a closer photo of just the list.', button: PHOTO },
  unreadable: { line: 'We couldn\'t open that photo. Try a different photo, or a screenshot of the list.', button: PHOTO },
  hourly: { line: 'You\'ve done {n} scans in the last hour. You can scan again {when}.', button: null },
  monthly: { line: 'No scans left this month. They come back on {date}.', button: null },
  paused: { line: 'Scanning isn\'t working right now. You can type the words instead.', button: null },
  off: { line: 'Scanning isn\'t available yet.', button: null },
  'own-full': { line: 'You have 30 chapters. Delete one to make another.', button: 'Back to your chapters', noType: true },
  'signed-out': { line: 'You\'ve been signed out. Please sign in again.', button: 'Sign in' },
};
export const TYPE_INSTEAD = 'Type the words instead';
/** The button that takes another photo: on a laptop there is no camera to take one with. */
export const anotherPhoto = (laptop) => (laptop ? 'Choose another photo' : PHOTO);
export const SIGNED_OUT_KEPT = 'We\'ll keep the words you ticked.';
export const SIGNED_OUT_AGAIN = 'After you sign in, take or choose the photo again.';

/** '4:52pm' (local, lower-case am and pm) from hours 0 to 23 and minutes. */
export function clockTime(h, m) {
  const hh = ((Math.floor(Number(h)) % 24) + 24) % 24;
  const mm = Math.max(0, Math.min(59, Math.floor(Number(m) || 0)));
  return ((hh % 12) || 12) + ':' + String(mm).padStart(2, '0') + (hh < 12 ? 'am' : 'pm');
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** '2026-12-01' -> '1 December'; anything else -> 'the 1st of next month'. */
export function resetDate(resetsOn) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(resetsOn || ''));
  const mi = m ? Number(m[2]) - 1 : -1;
  const day = m ? Number(m[3]) : 0;
  if (!m || mi < 0 || mi > 11 || day < 1 || day > 31) return 'the 1st of next month';
  return day + ' ' + MONTHS[mi];
}

/** { line, button, button2?, noType? } for a problem key; `info` = { resetsOn, time } (time: '4:52pm' when known). */
export function problemLine(key, info = {}) {
  const c = PROBLEM_COPY[key];
  if (!c) return null;
  const when = typeof info.time === 'string' && /^\d{1,2}:\d{2}(am|pm)$/.test(info.time) ? 'at ' + info.time : 'within the hour';
  return { ...c, line: c.line.replace('{n}', '5').replace('{when}', when).replace('{date}', resetDate(info.resetsOn)) };
}

/** The sizes and qualities to try, in order. Never enlarges. After the last one: 'too-large' (AFTER_PLAN). */
export const AFTER_PLAN = 'too-large';
export function shrinkPlan(width, height) {
  const w = Math.max(1, Math.round(Number(width) || 1));
  const h = Math.max(1, Math.round(Number(height) || 1));
  const fit = (max) => {
    const k = Math.min(1, max / Math.max(w, h));
    return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
  };
  return [
    { ...fit(1600), quality: 0.85 },
    { ...fit(1600), quality: 0.7 },
    { ...fit(1280), quality: 0.7 },
  ];
}

export function leftLine(left) {
  const v = typeof left === 'string' && /^\d+$/.test(left.trim()) ? Number(left) : left;
  const n = Number.isInteger(v) && v >= 0 ? v : 0;
  return 'You have ' + n + ' scan' + (n === 1 ? '' : 's') + ' left this month.';
}

/** Consent wording; any vendor name from the server is drawn with textContent and shown only when SCAN_VENDOR is set. The vendor and privacy link come from the two constants (or the allowance). */
export function consentText(vendor = SCAN_VENDOR) {
  const v = String(vendor || '').trim();
  return {
    heading: 'Before you scan',
    send: (v ? 'We send the photo to ' + v + ', an AI service, to read the words.' : 'We send the photo to an AI service to read the words.') + ' Waystead does not keep the photo: we only save the words you tick.',
    names: 'School papers often show a child\'s name, class or school.',
    cover: 'Cover names before you take the photo, or use a list with no names on it.',
    tip: 'Printed lists work best. Handwriting is often misread.',
    go: 'I understand, scan a paper',
    privacy: 'Privacy notice',
  };
}

// ---- the words on the screens (exact copy: HF check of 16 Nov, section 5, then the HF scan review, then the BA) ----
export const T = {
  title: 'Scan a paper',
  cover: 'Cover any names first.',
  tip: 'Lay the paper flat in good light. A screenshot of a list works too.',
  limits: 'A long list can become up to 3 chapters from one photo.',
  take: 'Take a photo',
  choose: 'Choose a photo',
  how: 'How scanning works',
  back: 'Back',
  close: 'Close',
  ready: 'Getting the photo ready…',
  reading: 'Reading the words',
  readingLine: 'This usually takes 10 to 20 seconds.',
  stillReading: 'Still reading. This can take up to 30 seconds.',
  cancel: 'Cancel',
  checkTitle: 'Check the words',
  wordsToSave: 'Words to save',
  edit: 'Edit',
  change: 'Change it',
  done: 'Done',
  checking: 'Checking…',
  addLabel: 'Add a word',
  add: 'Add',
  addHint: 'Press Enter to add. Paste a list to add them all.',
  addedToList: 'Added to the list.',
  hide: 'Hide',
  show: 'Show',
  next: 'Next: name and share',
  tickOne: 'Tick at least one word.',
  picOk: 'Has a meaning and picture',
  picNo: 'No picture',
  nameHidden: 'A name, hidden',
  nameTitle: 'Name and share',
  nameLabel: 'Name of the chapter',
  shareLegend: 'Share with',
  shareHelp: 'Children on your account.',
  noChildren: 'Add a child to your Waystead account to share a chapter.',
  notShared: 'Not shared yet. Children can\'t see it until you share it.',
  tickAll: 'Tick all',
  save: 'Save chapter',
  savedTitle: 'Chapter saved',
  useWeek: 'Use for this week',
  backList: 'Back to your chapters',
  another: 'Scan another paper',
  results: 'See results and set the test',
  leaveTitle: 'Leave without saving?',
  leaveBody: 'The words you ticked won\'t be kept.',
  stay: 'Stay',
  leave: 'Leave',
  nothingSaved: ' Nothing has been saved.',
  addNote: (a, r, d) => [a ? a + ' added.' : '', r ? r + ' we can\'t use yet.' : '', d ? d + ' already in the list.' : ''].filter(Boolean).join(' '),
};
export const foundLine = (n) => 'We found ' + n + ' word' + (n === 1 ? '' : 's') + '. Untick any you don\'t want.';
export const foundMore = (n) => 'We found ' + n + ' words. A chapter holds ' + MAX_PICK + '. Tick up to ' + MAX_PICK + ' now. You can save the other ' + (n - MAX_PICK) + ' as a second chapter next, without scanning again.';
export const otherLede = (m) => 'Here are the other ' + m + ' word' + (m === 1 ? '' : 's') + '. Untick any you don\'t want.';
export const leftOutHead = (n) => 'We left these out (' + n + ')';
export const tickedLine = (n) => (n > MAX_PICK ? n + ' ticked. A chapter holds ' + MAX_PICK + '.' : n + ' of ' + MAX_PICK + ' words');
export const limitReason = (n) => (n > MAX_PICK ? 'Untick ' + (n - MAX_PICK) + ' word' + (n - MAX_PICK === 1 ? '' : 's') + ' to go on. You can save unticked words as another chapter next.' : n === 0 ? T.tickOne : '');
/** The button on Done for the words left over (chapterNo = the one just saved, from 1). */
export const moreButton = (chapterNo, m) => 'Make ' + (chapterNo === 1 ? 'a second' : chapterNo === 2 ? 'a third' : 'another') + ' chapter with the other ' + m + ' word' + (m === 1 ? '' : 's');
/** "School words, 16 Nov (2)", cut to 40 characters. */
export const nextName = (base, n, max = 40) => {
  const tail = ' (' + n + ')';
  return String(base || '').slice(0, Math.max(0, max - tail.length)).trimEnd() + tail;
};
export const countWords = (n) => n + (n === 1 ? ' word' : ' words');

/** The line after a save: names only the children it reached. Shared with some but reached none: just "Saved." (`base` is own-data's savedLine). */
export const savedLineFor = (sharedCount, reachedNames, base) => (!reachedNames.length && sharedCount > 0 ? 'Saved.' : base(reachedNames));
