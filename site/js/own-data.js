// SB4-WP7: a grown-up's own chapters, saved. The ONE save path (the scan package imports saveOwnChapter with src: 'scan').
// The master list lives in the grown-up's own words value (`own`, own-doc.js); each shared child gets a copy in their
// setup (`setup.own`, setup-doc.js), written with changeSetup (a 409 is retried there). No DOM here: the clock comes in
// as `now`, the account as `api` (grownups-data.js createChildApi), and the words value is the signed-in player's.
// Answers: { ok: true, oid, notSent: childId[] } | { error } (the list itself is wrong) | { problem } (nothing could be saved).
import * as S from './store.js';
import * as W from './words-doc.js';
import * as Ow from './own-doc.js';
import * as Su from './setup-doc.js';
import * as A from './grownups-data.js';
import * as P from './progress-doc.js';
import { NEEDS_LIST } from './wordcheck.js';

// ---- the lines a grown-up reads (exact strings) -------------------------------------------
export const OWN_REFUSED = "We can't use this word yet"; // one line for a blocked word and an unknown one: the block list is never revealed
export const OWN_REPEAT = 'Already in the list';
export const OWN_FULL = "That's 15 words, the most a chapter can hold.";
export const OWN_30 = 'You have 30 chapters. Delete one to make another.';
/** Saved while the device had no connection: the chapter is on this device and the account's queue sends it later. */
export const OWN_SAVED_OFFLINE = "Saved on this device. It will be sent when you're back online.";
export const OWN_OFFLINE = "You're offline. You can make chapters when you're back online.";
export const OWN_ERRORS = {
  'no-name': 'Give the chapter a name.',
  'no-words': 'Add at least one word first.',
  'too-many-words': OWN_FULL,
  'too-many': OWN_30,
  'not-there': "That chapter isn't here any more.",
};
export const PLAN_KEY = 'sb.planWords'; // sessionStorage: the words "Use for this week" hands to Plan a week

// ---- pure helpers -------------------------------------------------------------------------
/** "School words, 13 Nov" for a day 'YYYY-MM-DD'. */
export const defaultName = (day) => 'School words, ' + W.dayLabel(day).replace(/^\w+ /, '');
/** "Robin", "Robin and Wren", "Robin, Wren and Ada". */
export function joinNames(names) {
  const n = names.filter(Boolean);
  return n.length <= 1 ? n.join('') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
}
export const savedLine = (names) => (names.length
  ? "Saved. " + joinNames(names) + " can find it under 'From your grown-up'."
  : "Saved. Share it with a child so they can find it under 'From your grown-up'.");
export const startedLine = (names) => (names.length === 1
  ? names[0] + ' has started this chapter. Changes show next time ' + names[0] + ' plays.'
  : joinNames(names) + ' have started this chapter. Changes show next time they play.');
export const notSentLine = (name) => 'Not sent to ' + name + ' yet.';
export const deleteTitle = (name) => "Delete '" + name + "'?";
export const deleteBody = (names) => (names.length
  ? joinNames(names.map((n) => (/s$/i.test(n) ? n + "'" : n + "'s"))) + ' stars stay.'
  : 'You can bring it back within 30 days.');
export const countLine = (n) => n + ' of ' + Ow.MAX_WORDS + ' words';

/** The words in a typed or pasted text: commas, semicolons and new lines separate them. A space does not (so "ice cream" is refused whole). */
export function splitTyped(text) {
  return String(text || '').split(/[,;\n\r\t]+/).map((s) => s.trim().replace(/^\d+\s*[.)]\s*/, '')).filter(Boolean); // "1. island" and "2) quay" lose their numbers
}
/** A pasted text for a one-line box: line breaks and tabs become ", " (a one-line box would otherwise drop them and join the words). */
export const pasteText = (text) => String(text || '').replace(/[\r\n\t]+/g, ', ').replace(/(,\s*)+$/, '').replace(/^(\s*,)+\s*/, '');
export const needsPaste = (text) => /[\r\n\t]/.test(String(text || ''));
/** An oid made here is 'r' and hex; anything else in an address is not one of ours. */
export const validOid = (x) => typeof x === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(x);
export const safeDecode = (x) => { try { return decodeURIComponent(x); } catch (e) { return ''; } };
/** What an add did, said once for a screen reader: "3 added. 1 we can't use yet. 1 already in the list." */
export function addedLine(r, before) {
  const parts = [];
  const n = r.list.length - before;
  if (n > 0) parts.push(n + ' added.');
  if (r.refused.length) parts.push(r.refused.length + " we can't use yet.");
  if (r.repeats.length) parts.push(r.repeats.length + ' already in the list.');
  if (r.dropped.length) parts.push('Not added, no room: ' + r.dropped.join(', ') + '.');
  return parts.join(' ');
}

/**
 * Add what was typed to the list. check(raw) answers { word } or { error } (wordcheck.checkTyped). A word the list has
 * already goes to `repeats`; a word we cannot use to `refused` (its own text, shown greyed); past 15 words nothing more
 * is added (`full`); a word list that cannot be fetched stops the run (`offline`).
 * Answers { list, refused, repeats, dropped (the words past 15, named), full, offline }.
 */
export async function addTyped(text, list, check) {
  const out = { list: [...list], refused: [], repeats: [], dropped: [], full: false, offline: false };
  const has = (w) => out.list.some((x) => x.toLowerCase() === w.toLowerCase());
  const all = splitTyped(text);
  for (const [i, raw] of all.entries()) {
    if (out.list.length >= Ow.MAX_WORDS) { out.full = true; out.dropped = all.slice(i).map((x) => x.slice(0, 20)); break; }
    if (has(raw)) { out.repeats.push(raw.toLowerCase()); continue; }
    const r = await check(raw);
    if (r.error === NEEDS_LIST) { out.offline = true; break; }
    if (r.error) { if (!out.refused.includes(raw.slice(0, 30))) out.refused.push(raw.slice(0, 30)); continue; }
    if (has(r.word)) { out.repeats.push(r.word.toLowerCase()); continue; }
    out.list.push(r.word);
  }
  return out;
}

/** Has this child begun this chapter? (studied, practised or tested: from their progress value.) */
export function hasStarted(progress, oid) {
  const p = P.chapterProgress(P.normalise(progress), 'own-' + oid);
  return !!(p.studied || p.practised || p.attempts > 0);
}

/** Read once: the words "Use for this week" handed over, or null. The key is removed whatever it held. */
export function takePlanWords(storage = globalThis.sessionStorage) {
  let raw = null;
  try { raw = storage.getItem(PLAN_KEY); storage.removeItem(PLAN_KEY); } catch (e) { return null; }
  try {
    const v = JSON.parse(raw);
    const words = Array.isArray(v) ? v.filter((w) => typeof w === 'string' && /^[A-Za-z]{1,20}$/.test(w)).slice(0, W.MAX_WORDS) : [];
    return words.length ? words : null;
  } catch (e) { return null; }
}
export function givePlanWords(storage, words) {
  storage = storage || globalThis.sessionStorage;
  try { storage.setItem(PLAN_KEY, JSON.stringify(words)); return true; } catch (e) { return false; }
}

// ---- saving ---------------------------------------------------------------------------------
const copyOf = (e) => ({ name: e.name, words: e.words, src: e.src });
const sendCopy = (api, id, oid, e, now) => A.changeSetup(api, id, (s) => Su.setOwnCopy(s, oid, copyOf(e), e.at), { now });
const removeCopy = (api, id, oid, now) => A.changeSetup(api, id, (s) => ({ setup: Su.dropOwnCopy(s, oid, now()) }), { now });

/** Do each child's job at the same time. jobs: [{ id, run }]. Answers the ids whose job did not work. */
async function runJobs(jobs) {
  const rs = await Promise.all(jobs.map((j) => j.run()));
  return jobs.filter((j, i) => !rs[i].ok).map((j) => j.id);
}

/** Change the master through the words value; answers what `fn(own)` answered ({ own } or { error }), and the entry before. */
function changeMaster(oid, fn) {
  let result = null;
  let before = null;
  S.updateWords((d) => {
    const own = W.ownOf(d);
    before = own[oid] || null;
    result = fn(own);
    return result.error ? d : W.withOwn(d, result.own);
  });
  return { result, before };
}

/**
 * Make or change a list (the oid never changes), then send it to each child in `to` and take it from each child that
 * had it and is not in `to` now. A child that could not be reached is in notSent; the master is saved all the same.
 */
export async function saveOwnChapter(api, { oid, name, words, src = 'typed', to }, { now = () => Date.now() } = {}) {
  if (!S.currentPlayer()) return { problem: 'signed-out' };
  const id = oid || S.newId();
  let made;
  try { made = changeMaster(id, (own) => Ow.set(own, id, { name, words, src, to }, now())); } catch (e) { return { problem: 'other' }; }
  if (made.result.error) return { error: made.result.error };
  const e = made.result.own[id];
  const prev = made.before && !made.before.gone ? made.before.to : [];
  const jobs = [
    ...e.to.map((c) => ({ id: c, run: () => sendCopy(api, c, id, e, now) })),
    ...prev.filter((c) => !e.to.includes(c)).map((c) => ({ id: c, run: () => removeCopy(api, c, id, now) })),
  ];
  return { ok: true, oid: id, notSent: await runJobs(jobs) };
}

/** Delete (it can be brought back for 30 days) and take the copy from each child. Answers { ok, oid, notSent } | { error } | { problem }. */
export async function deleteOwnChapter(api, oid, { now = () => Date.now() } = {}) {
  if (!S.currentPlayer()) return { problem: 'signed-out' };
  let made;
  try { made = changeMaster(oid, (own) => (own[oid] && !own[oid].gone ? { own: Ow.drop(own, oid, now()) } : { error: 'not-there' })); } catch (e) { return { problem: 'other' }; }
  if (made.result.error) return { error: made.result.error };
  const ids = made.before.to;
  return { ok: true, oid, notSent: await runJobs(ids.map((c) => ({ id: c, run: () => removeCopy(api, c, oid, now) }))) };
}

/** Bring a deleted list back and send it to the children it was shared with. Answers { ok, oid, notSent } | { error } | { problem }. */
export async function restoreOwnChapter(api, oid, { now = () => Date.now() } = {}) {
  if (!S.currentPlayer()) return { problem: 'signed-out' };
  let made;
  try { made = changeMaster(oid, (own) => Ow.restore(own, oid, now())); } catch (e) { return { problem: 'other' }; }
  if (made.result.error) return { error: made.result.error };
  const e = made.result.own[oid];
  return { ok: true, oid, notSent: await runJobs(e.to.map((c) => ({ id: c, run: () => sendCopy(api, c, oid, e, now) }))) };
}

/**
 * The repair, run on opening the list page. Reads every child's setup; a live copy with no master entry becomes one
 * (an older app dropped the field); what is `behind` is sent again and what is `remove` is taken away.
 * kids: [{ id }]. Answers { own, notSent: [{ oid, childId }] } or { problem }.
 */
export async function syncOwn(api, kids, { now = () => Date.now() } = {}) {
  if (!S.currentPlayer()) return { problem: 'signed-out' };
  const reads = await Promise.all(kids.map((k) => A.readChild(api, k.id)));
  const bad = reads.find((r) => r.problem);
  if (bad) return { problem: bad.problem };
  const setups = Object.fromEntries(kids.map((k, i) => [k.id, reads[i].setup]));
  const adopted = Ow.adopt(W.ownOf(S.readWords()), setups, now());
  S.updateWords((d) => {
    const mine = W.ownOf(d);
    const merged = Ow.merge(mine, adopted);
    return JSON.stringify(merged) === JSON.stringify(Ow.normalise(mine)) ? d : W.withOwn(d, merged);
  });
  const own = Ow.normalise(W.ownOf(S.readWords()));
  const rows = Ow.delivery(own, setups).filter((r) => r.state !== 'sent' && r.childId in setups);
  const byChild = new Map();
  for (const r of rows) byChild.set(r.childId, [...(byChild.get(r.childId) || []), r]);
  const failed = [];
  await Promise.all([...byChild].map(async ([childId, mine]) => {
    const r = await A.changeSetup(api, childId, (s) => {
      let out = s;
      for (const x of mine) {
        if (x.state === 'behind') {
          const done = Su.setOwnCopy(out, x.oid, copyOf(own[x.oid]), own[x.oid].at);
          if (done.error) return { error: done.error };
          out = done.setup;
        } else out = Su.dropOwnCopy(out, x.oid, now());
      }
      return { setup: out };
    }, { now });
    if (!r.ok) for (const x of mine) failed.push({ oid: x.oid, childId });
  }));
  return { own, notSent: failed };
}
