// SB4-WP8: scanning a school paper into an own chapter. Pure rules and the wording: no DOM, no storage,
// no clock, no random. The account's answers are never trusted (clean); the scan page is drawn only
// when the account says scanning is on (isOn).

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
  cant: 'Can\'t use this word yet',
  name: 'Looks like a name',
  over: 'Over the 15-word limit',
};

const isCapital = (w) => /^[A-Z]/.test(w);
// A capital that stays when a word is saved the way our lists spell it.
const KEEP_CAPITAL = new Set(['I', 'Mr', 'Mrs', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Christmas']);
const listSpelling = (w) => (KEEP_CAPITAL.has(w) ? w : w.toLowerCase());

/**
 * Splits the found words into the ones to offer and the ones left out.
 * `checks` maps a lower-case word to true when it is on our lists (the answer of checkTyped); anything else is not.
 * A capitalised word not on our lists is a name and is masked first, even with an apostrophe or hyphen.
 * Any other word with an apostrophe or hyphen, an unknown one and a blocked one all give the same single line.
 * `shown` is what may be drawn: a name is always "R.....", never the word or its length.
 * A word that is on our lists goes into `use` in its list spelling (lower case, except KEEP_CAPITAL).
 */
export function sortFound(words, checks, limit = MAX_PICK) {
  const use = [];
  const out = [];
  const ok = (w) => {
    const k = w.toLowerCase();
    return !!checks && typeof checks === 'object' && Object.hasOwn(checks, k) && checks[k] === true;
  };
  for (const w of Array.isArray(words) ? words : []) {
    if (isCapital(w) && !ok(w)) { out.push({ word: w, shown: w[0] + '.....', reason: REASON.name }); continue; }
    if (/['-]/.test(w) || !ok(w)) { out.push({ word: w, shown: w, reason: REASON.cant }); continue; }
    if (use.length >= limit) { out.push({ word: w, shown: w, reason: REASON.over }); continue; }
    use.push(listSpelling(w));
  }
  return { use, out };
}

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
  offline: { line: 'You\'re offline. You can type the words instead.', button: TRY },
  timeout: { line: 'That didn\'t work this time.', button: TRY },
  failed: { line: 'That didn\'t work this time.', button: TRY },
  'read-failed': { line: 'That didn\'t work this time.', button: TRY },
  'no-words': { line: 'We couldn\'t find any words. Printed lists work best.', button: PHOTO },
  hourly: { line: 'Lots of scans just now. Try again in an hour.', button: null },
  monthly: { line: 'You\'ve used this month\'s {limit} scans. They come back on {date}.', button: null },
  paused: { line: 'Scanning is paused just now.', button: null },
  'too-large': { line: 'Try a closer photo of just the list.', button: PHOTO },
  off: { line: 'Scanning isn\'t available yet.', button: null },
};
export const TYPE_INSTEAD = 'Type the words instead';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** '2026-12-01' -> '1 December'; anything else -> 'the 1st of next month'. */
export function resetDate(resetsOn) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(resetsOn || ''));
  const mi = m ? Number(m[2]) - 1 : -1;
  const day = m ? Number(m[3]) : 0;
  if (!m || mi < 0 || mi > 11 || day < 1 || day > 31) return 'the 1st of next month';
  return day + ' ' + MONTHS[mi];
}

/** { line, button } for a problem key; `info` = { limit, resetsOn } from the allowance or the answer. */
export function problemLine(key, info = {}) {
  const c = PROBLEM_COPY[key];
  if (!c) return null;
  const limit = Number.isInteger(info.limit) && info.limit > 0 ? info.limit : 20;
  return { line: c.line.replace('{limit}', String(limit)).replace('{date}', resetDate(info.resetsOn)), button: c.button };
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

export const defaultName = (dayLabel) => {
  const d = String(dayLabel || '').trim();
  return d ? 'School words, ' + d : 'School words';
};

/** Consent wording; any vendor name from the server is drawn with textContent and shown only when SCAN_VENDOR is set. The vendor and privacy link come from the two constants (or the allowance). */
export function consentText(vendor = SCAN_VENDOR) {
  const v = String(vendor || '').trim();
  return {
    heading: 'Before you scan',
    send: (v ? 'We send the photo to ' + v + ', an AI service, to read the words.' : 'We send the photo to an AI service to read the words.') + ' The photo is not kept: we only save the words you tick.',
    names: 'School papers often show a child\'s name, class or school.',
    cover: 'Cover names before you take the photo, or use a list with no names on it.',
    tip: 'Printed lists work best. Handwriting is often misread.',
    go: 'I understand, scan a paper',
    privacy: 'Privacy notice',
  };
}
