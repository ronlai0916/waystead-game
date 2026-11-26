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
import { askable } from './pictures-data.js';
import { wordsToAsk } from './pictures-doc.js';

// ---- the lines a grown-up reads (exact strings) -------------------------------------------
export const OWN_REFUSED = "We can't use this word yet"; // one line for a blocked word and an unknown one: the block list is never revealed
/** The reason, for a word with no near match. It says what kind of word is not a spelling word here and what to do, and still never says which rule caught it. */
export const OWN_REFUSED_WHY = 'Names of people, places and months are not spelling words here. Check the spelling, or remove it.';
/** A refused word's two lines: { head, tail }. With a near match it is the plain "doesn't look right" with the question; else the reason. */
export const refusedLines = (word, sug = '') => (sug
  ? { head: '“' + word + '” doesn’t look right.', tail: 'Did you mean “' + sug + '”?' }
  : { head: OWN_REFUSED, tail: OWN_REFUSED_WHY });
export const OWN_REPEAT = 'Already in the list';
export const OWN_FULL = "That's 15 words, the most a list can hold.";
export const OWN_30 = 'You have 30 word lists. Delete one to make another.';
/** Saved while the device had no connection: the list is on this device and the account's queue sends it later. */
export const OWN_SAVED_OFFLINE = "Saved on this device. It is sent when you're back online. Your children see it after you open Word lists again.";
export const OWN_OFFLINE = "You're offline. You can make lists when you're back online.";
/** D15: a list still saves offline. Only a typed word we cannot check without the word list waits for a connection (ready-made words work offline). */
export const OWN_WORD_OFFLINE = "You're offline. Ready-made words still work. Other words need a connection to check. The rest of your list is kept.";
export const OWN_ERRORS = {
  'no-name': 'Give the list a name.',
  'no-words': 'Add at least one word first.',
  'too-many-words': OWN_FULL,
  'too-many': OWN_30,
  'not-there': "That list isn't here any more.",
};
export const PLAN_KEY = 'sb.planWords'; // sessionStorage: a leftover hand-off from the old "Use for this week" (read once for one release, then deleted in SB6)

// ---- pure helpers -------------------------------------------------------------------------
/** "School words, 13 Nov" for a day 'YYYY-MM-DD'. */
export const defaultName = (day) => 'School words, ' + W.dayLabel(day).replace(/^\w+ /, '');
/** "Robin", "Robin and Wren", "Robin, Wren and Ada". */
export function joinNames(names) {
  const n = names.filter(Boolean);
  return n.length <= 1 ? n.join('') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
}
export const savedLine = (names) => (names.length
  ? 'Saved. ' + joinNames(names) + " can find it under 'From your grown-up'."
  : 'Saved. Set a week with it, or give it to a child for practice.');
export const startedLine = (names) => (names.length === 1
  ? names[0] + ' has started this list. Changes show next time ' + names[0] + ' plays.'
  : joinNames(names) + ' have started this list. Changes show next time they play.');
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

/** Has this child begun this list? (studied, practised or tested: from their progress value.) */
export function hasStarted(progress, oid) {
  const p = P.chapterProgress(P.normalise(progress), 'own-' + oid);
  return !!(p.studied || p.practised || p.attempts > 0);
}

/** Read once: words an older "Use for this week" left behind, or null (kept one release; Set a week drains it). The key is removed whatever it held. */
export function takePlanWords(storage = globalThis.sessionStorage) {
  let raw = null;
  try { raw = storage.getItem(PLAN_KEY); storage.removeItem(PLAN_KEY); } catch (e) { return null; }
  try {
    const v = JSON.parse(raw);
    const words = Array.isArray(v) ? v.filter((w) => typeof w === 'string' && /^[A-Za-z]{1,20}$/.test(w)).slice(0, W.MAX_WORDS) : [];
    return words.length ? words : null;
  } catch (e) { return null; }
}

// ---- saving ---------------------------------------------------------------------------------
// SB5: every write to a child can carry `by` (the name the child sees, TR-100) in the SAME PUT: opts.by is the grown-up's
// cleaned name ('' = none; undefined = leave what the child has). A copy carries the master's `info` (TR-93, TR-98).
const copyOf = (e) => ({ name: e.name, words: e.words, src: e.src, ...(e.info ? { info: e.info } : {}) });
const sendCopy = (api, id, oid, e, { now, by }) => A.changeSetup(api, id, (s) => Su.setOwnCopy(s, oid, copyOf(e), e.at), { now, by });
const removeCopy = (api, id, oid, { now, by }) => A.changeSetup(api, id, (s) => ({ setup: Su.dropOwnCopy(s, oid, now()) }), { now, by });

/** Do each child's job, at most 5 at a time (15 children stay under the account's 429 busy). jobs: [{ id, run }]. Answers the ids whose job did not work. */
async function runJobs(jobs) {
  const rs = await A.pool(jobs, (j) => j.run());
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
 * Only the master: make or change a list in the grown-up's own value and send nothing (Set a week with typed words puts the copy
 * inside the week's own PUT, TR-16). Answers { ok: true, oid, entry, before } | { error } | { problem }.
 * `info` (SB5) is { [word]: { s?, m?, x? } }; left out, the list keeps what it had. opts.isReady(word) drops info for ready-made words.
 */
export function saveOwnMaster({ oid, name, words, src = 'typed', to, info }, { now = () => Date.now(), isReady = null } = {}) {
  if (!S.currentPlayer()) return { problem: 'signed-out' };
  const id = oid || S.newId();
  let made;
  try { made = changeMaster(id, (own) => Ow.set(own, id, { name, words, src, to, info }, now(), { isReady })); } catch (e) { return { problem: 'other' }; }
  if (made.result.error) return { error: made.result.error };
  return { ok: true, oid: id, entry: made.result.own[id], before: made.before };
}

/**
 * Make or change a list (the oid never changes), then send it to each child in `to` and take it from each child that
 * had it and is not in `to` now. A child that could not be reached is in notSent; the master is saved all the same.
 * opts.by: the name the child sees, written in the same PUT.
 */
export async function saveOwnChapter(api, { oid, name, words, src = 'typed', to, info }, { now = () => Date.now(), by, isReady = null } = {}) {
  const made = saveOwnMaster({ oid, name, words, src, to, info }, { now, isReady });
  if (!made.ok) return made.error ? { error: made.error } : { problem: made.problem };
  const { entry: e, before } = made;
  const prev = before && !before.gone ? before.to : [];
  const jobs = [
    ...e.to.map((c) => ({ id: c, run: () => sendCopy(api, c, made.oid, e, { now, by }) })),
    ...prev.filter((c) => !e.to.includes(c)).map((c) => ({ id: c, run: () => removeCopy(api, c, made.oid, { now, by }) })),
  ];
  return { ok: true, oid: made.oid, notSent: await runJobs(jobs) };
}

/** Delete (it can be brought back for 30 days) and take the copy from each child. Answers { ok, oid, notSent } | { error } | { problem }. */
export async function deleteOwnChapter(api, oid, { now = () => Date.now(), by } = {}) {
  if (!S.currentPlayer()) return { problem: 'signed-out' };
  let made;
  try { made = changeMaster(oid, (own) => (own[oid] && !own[oid].gone ? { own: Ow.drop(own, oid, now()) } : { error: 'not-there' })); } catch (e) { return { problem: 'other' }; }
  if (made.result.error) return { error: made.result.error };
  const ids = made.before.to;
  return { ok: true, oid, notSent: await runJobs(ids.map((c) => ({ id: c, run: () => removeCopy(api, c, oid, { now, by }) }))) };
}

/** Bring a deleted list back and send it to the children it was shared with. Answers { ok, oid, notSent } | { error } | { problem }. */
export async function restoreOwnChapter(api, oid, { now = () => Date.now(), by } = {}) {
  if (!S.currentPlayer()) return { problem: 'signed-out' };
  let made;
  try { made = changeMaster(oid, (own) => Ow.restore(own, oid, now())); } catch (e) { return { problem: 'other' }; }
  if (made.result.error) return { error: made.result.error };
  const e = made.result.own[oid];
  return { ok: true, oid, notSent: await runJobs(e.to.map((c) => ({ id: c, run: () => sendCopy(api, c, oid, e, { now, by }) }))) };
}

/**
 * A live copy that is in step by `at` but lacks (or differs in) the master's `info`: an older app dropped it (TR-93 repair).
 * The copy is sent again, in the write this page makes for that child anyway.
 */
export const lacksInfo = (master, copy) => !!master && !master.gone && !!copy && !copy.gone && copy.at >= master.at
  && JSON.stringify(master.info || null) !== JSON.stringify(copy.info || null);

/**
 * The repair, run on opening the list page. Reads every child's setup; a live copy with no master entry becomes one
 * (an older app dropped the field); what is `behind` (older, missing, or without the master's `info`) is sent again and what is
 * `remove` is taken away. kids: [{ id }]. Answers { own, notSent: [{ oid, childId }] } or { problem }.
 */
export async function syncOwn(api, kids, { now = () => Date.now(), by } = {}) {
  if (!S.currentPlayer()) return { problem: 'signed-out' };
  const reads = await A.pool(kids, (k) => A.readChild(api, k.id));
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
  const rows = Ow.delivery(own, setups)
    .map((r) => (r.state === 'sent' && lacksInfo(own[r.oid], ((setups[r.childId] || {}).own || {})[r.oid]) ? { ...r, state: 'behind' } : r))
    .filter((r) => r.state !== 'sent' && r.childId in setups);
  const byChild = new Map();
  for (const r of rows) byChild.set(r.childId, [...(byChild.get(r.childId) || []), r]);
  const failed = [];
  await A.pool([...byChild], async ([childId, mine]) => {
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
    }, { now, by });
    if (!r.ok) for (const x of mine) failed.push({ oid: x.oid, childId });
  });
  return { own, notSent: failed };
}

// ---- word pictures (SB6 TR-52, D15, D16): ask for a picture for each own word after a list is saved ---------------------------------
/**
 * Ask the account for a picture of each own word that has none and no state yet (one A1, one A3, then one A2 per word). Never swaps by itself:
 * when an ask answers `swap-needed` the caller's confirmSwap({ rate, credits, waiting }) is asked (every time) and only a true answer sends `swap: true`.
 * pics: createPictures(). words: the list's words. isReady(word): has a ready-made picture. Nothing here touches the DOM or storage.
 * Answers { off? , problem?, none-left?, made: [word], unsuitable: [word], refused: [word], waiting: [word], asked: [word] }.
 * `waiting` are the words still to ask when it stopped (not now, a limit, offline); the page keeps a "Make picture" button on them.
 */
export async function makePictures(pics, { words, isReady = () => false, confirmSwap = async () => false } = {}) {
  const out = { made: [], unsuitable: [], refused: [], waiting: [], asked: [] };
  const a = await pics.allowance();
  if (a.problem) return { ...out, problem: a.problem, off: a.problem === 'off' };
  if (a.on !== true) return { ...out, off: true };
  if (!(a.unlimited || a.left > 0 || a.credits > 0)) return { ...out, noneLeft: true };
  const all = askable(words);
  const st = all.length ? await pics.states(all) : { items: [] };
  if (st.problem) return { ...out, problem: st.problem };
  const todo = wordsToAsk([words], isReady, st.items.filter((it) => it.status !== 'none')); // A3 answers every word: 'none' means never asked
  out.asked = todo;
  for (let i = 0; i < todo.length; i += 1) {
    const w = todo[i];
    let r = await pics.ask(w);
    if (r.problem === 'swap-needed') {
      const yes = await confirmSwap({ rate: r.rate, credits: r.credits, waiting: todo.length - i });
      if (yes !== true) { out.waiting = todo.slice(i); return out; }
      r = await pics.ask(w, { swap: true });
    }
    if (r.problem === 'refused') { out.refused.push(w); continue; }
    if (r.problem === 'already-making') { out.made.push(w); continue; }
    if (r.problem) { out.waiting = todo.slice(i); out.problem = r.problem; if (r.retryAfter) out.retryAfter = r.retryAfter; return out; }
    if (r.status === 'unsuitable') out.unsuitable.push(w); else out.made.push(w);
  }
  return out;
}
