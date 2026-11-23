// SB5 (WP-E): the Word lists pages. The library (TR-43: newest first, "Set a week" and "Results" on each card, "Copy for a learner" for a
// tutor, the class line for a teacher), the editor (word by word with "find a word" D27, type or paste all, a link to scan, the sentence
// rows 02b13-02b15, the sentence panel 03k/03l, saved state 02d) and the child's routes for playing a list (unchanged).
// The rules and wording are in lists-doc.js (pure), own-doc.js and own-data.js (saving). Nothing here decides a rule. There is no "Use for
// this week" dialog any more: "Set a week" goes to #/grownups/set/list/:oid (set-views.js).
import * as S from './store.js';
import * as W from './words-doc.js';
import * as Ow from './own-doc.js';
import * as D from './own-data.js';
import * as A from './grownups-data.js';
import * as P from './grownups-doc.js';
import * as V from './views.js';
import * as FV from './front-views.js';
import * as AV from './assess-views.js';
import * as Dt from './data.js';
import * as SET from './set-doc.js';
import * as ST from './set-data.js';
import * as I from './info-doc.js';
import * as SN from './sentences-data.js';
import * as L from './lists-doc.js';
import * as RD from './role-doc.js';
import { createRoleStore } from './role-data.js';
import { adultOnly } from './grownups-views.js';
import { checkTyped, NEEDS_LIST } from './wordcheck.js';
import { findEntry, meaningsFor } from './word-info.js';
import { recheckWho } from './who.js';
import { esc } from './ui.js';
import { accountOrigin } from './account/config.js';
import * as Sc from './scan-doc.js'; // SB4-WP8
import * as SD from './scan-data.js'; // SB4-WP8

const today = () => W.localDay(Date.now());
let api = null;
const childApi = () => { if (!api) api = A.createChildApi({ origin: accountOrigin(location) }); return api; };
const redraw = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
const LIST = '#/grownups/own';
const enc = encodeURIComponent;
const svg = (inner) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + inner + '</svg>';
const ICON = {
  cam: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>'),
};
/** SB4-WP8: scanning is offered only when the account says so (exactly on: true). Any other answer, a 404 or a network error is off. */
const scanIsOn = async () => Sc.isOn(await SD.allowance(accountOrigin(location)));
let undo = null; // { oid, name, until }: the list just deleted, for 10 seconds on the library
const EDIT = (oid) => LIST + '/' + enc(oid) + '/edit';
let gave = null; // { oid, names, prev, notSent }: Give for practice just done, shown once on the list page (03g) with Undo
const SET_CHAPTER_KEY = 'sb.setChapter'; // sessionStorage: "Set a week" on a ready-made chapter hands its id to Set a week, read once
const COPY_KEY = 'sb.copyList'; // sessionStorage: "Copy for a learner" hands the words to the new-list editor, read once

/** The name this adult chose for children to see (or undefined); never throws. */
export function roleNameNow() { try { const p = JSON.parse(window.localStorage.getItem('wa.player')); return p && p.id ? createRoleStore({ storage: window.localStorage, playerId: p.id }).name() || undefined : undefined; } catch (e) { return undefined; } }

/** This adult's role (parent until one is chosen): the device copy the role store keeps; never throws. */
export function roleHere() {
  try {
    const p = JSON.parse(window.localStorage.getItem('wa.player'));
    if (p && p.id) return createRoleStore({ storage: window.localStorage, playerId: p.id }).role();
  } catch (e) { /* no storage: parent */ }
  return 'parent';
}

// The sentence maker's client. It ships OFF (SENTENCES_API = false in sentences-data.js): then every call answers `off` with no request.
let sent = null;
const sentences = () => sent || (sent = SN.createSentences({ origin: accountOrigin(location) }));
/** For tests and for the day the switch is turned on: use this client in place of the real one. */
export const useSentences = (c) => { sent = c; };
// The ready-made bank (site/data/statements.json, our own site, in the service worker's shell). One fetch, kept in memory.
let bank = null;
export const loadBank = () => {
  if (!bank) {
    bank = fetch('data/statements.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((j) => (j && j.w ? j.w : {}));
    bank.then((b) => { if (!Object.keys(b).length) bank = null; }); // a failed fetch is not kept for the session (m8): the next page tries again
  }
  return bank;
};

const wrap = (title, line, body, attr = '') => '<section class="wrap page grownups gu ls"' + attr + '><div class="pagehead"><span class="eyebrow">Grown-ups</span><h1>' + esc(title) + '</h1>'
  + (line ? '<p class="muted">' + esc(line) + '</p>' : '') + '</div>' + body + '</section>';
const backLink = (href, text, attr = '') => '<a class="gu-back" href="' + href + '"' + attr + '>' + ICON.back + esc(text) + '</a>';

async function problemPage(main, problem) {
  if (problem === 'playing') { await recheckWho(); adultOnly(main); return; }
  if (problem === 'signed-out') recheckWho();
  const offline = problem === 'network';
  main.innerHTML = wrap('Word lists', '', '<div class="card gu-panel" data-own-problem="' + esc(problem) + '"><p>' + esc(offline ? L.OFFLINE_LIST : P.PROBLEM_TEXT[problem] || P.PROBLEM_TEXT.other) + '</p>'
    + '<div class="btnrow"><button type="button" class="btn btn--primary" data-retry>Try again</button><a class="btn btn--ghost" href="#/grownups">Back to Grown-ups</a></div></div>', offline ? ' data-own-offline' : '');
  const b = main.querySelector('[data-retry]');
  if (b) b.addEventListener('click', redraw);
}

/** After the first draw of a page reached from a Menu row or a link, focus goes to the page's h1 (never lost to the redraw). */
export function settle(main) {
  const a = document.activeElement;
  if (a && a !== document.body && a !== main && main.contains(a)) return;
  const h = main.querySelector('h1');
  if (!h) return;
  h.setAttribute('tabindex', '-1');
  h.focus({ preventScroll: true });
}
/** An error line, made only when there is something to say (an empty alert leaves a gap), after `after`. */
function showError(after, text) {
  let p = after.parentElement.querySelector('[data-error]');
  if (!p) { p = document.createElement('p'); p.className = 'gu-error'; p.setAttribute('role', 'alert'); p.setAttribute('data-error', ''); after.insertAdjacentElement('afterend', p); }
  p.textContent = text;
}

/* ------------------------------------------------------------------ a small dialog --- */
/** A dialog with focus kept inside, Escape to close. actions: [{ id, label, cls }]. Answers the id clicked (and read(root)), or null. */
export function ask({ title, bodyHtml, actions, init, read, describedby }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'gu-overlay';
    overlay.innerHTML = '<div class="gu-dialog" role="dialog" aria-modal="true" aria-labelledby="own-dt"' + (describedby ? ' aria-describedby="' + describedby + '"' : '') + ' data-dialog><h2 id="own-dt">' + esc(title) + '</h2>' + bodyHtml
      + '<div class="btnrow">' + actions.map((a) => '<button type="button" class="btn ' + (a.cls || 'btn--ghost') + '" data-act="' + a.id + '">' + esc(a.label) + '</button>').join('') + '</div></div>';
    const prior = document.activeElement;
    const inert = [...document.body.children].filter((e) => e !== overlay && !e.hasAttribute('inert'));
    inert.forEach((e) => e.setAttribute('inert', ''));
    document.body.appendChild(overlay);
    const root = overlay.querySelector('.gu-dialog');
    const focusable = () => [...root.querySelectorAll('input:not(:disabled), button:not(:disabled)')];
    const close = (answer) => {
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('hashchange', away);
      overlay.remove();
      inert.forEach((e) => e.removeAttribute('inert'));
      if (prior && prior.focus && document.contains(prior)) prior.focus();
      resolve(answer);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(null); return; }
      if (e.key !== 'Tab') return;
      const f = focusable();
      const at = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    };
    const away = () => close(null);
    window.addEventListener('hashchange', away);
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => close({ id: b.dataset.act, value: read ? read(root) : null })));
    if (init) init(root);
    (root.querySelector('input:not(:disabled)') || root.querySelector('[data-act]:last-child')).focus();
  });
}

/* ------------------------------------------------------------------ the library --- */
const copyIcon = ICON.copy;

/** 02a: the Ready-made lists section, a card to the Year 1 to 6 pages. */
function readyCard(kids) {
  const who = kids.filter((k) => Number(k.year) >= 1 && Number(k.year) <= 6).map((k) => k.nickname + ' Year ' + k.year).join(' · ');
  return '<h2 class="ls-sec">' + esc(L.READY.section) + '</h2><p class="muted">' + esc(L.READY.sectionHelp) + '</p><a class="card gu-panel ls-ready" href="' + LIST + '/ready" data-ready-card><b>' + esc(L.READY.card) + '</b><span class="ls-fine">' + esc(L.READY.cardSub) + '</span><span>' + esc(L.READY.cardHelp) + '</span>'
    + (who ? '<span class="ls-fine">' + esc(who) + '</span>' : '') + '</a>';
}

export function list(main) {
  if (!adultOnly(main)) return undefined;
  let stopped = false;
  let timer = null;
  const role = roleHere();
  main.innerHTML = wrap('Word lists', '', '<p class="muted">Finding your lists…</p>');
  (async () => {
    const offline0 = navigator.onLine === false;
    const lc = offline0 ? { children: [] } : await A.listChildren(childApi());
    if (stopped) return;
    if (lc.problem && lc.problem !== 'network') { problemPage(main, lc.problem); return; }
    const offline = offline0 || !!lc.problem;
    const kids = offline ? [] : lc.children;
    let notSent = [];
    if (!offline) {
      const sync = await D.syncOwn(childApi(), kids);
      if (stopped) return;
      if (sync.problem) { problemPage(main, sync.problem); return; }
      notSent = sync.notSent;
    }
    const own0 = Ow.normalise(W.ownOf(S.readWords()));
    const inTo = new Set(Ow.live(own0).flatMap((e) => e.to));
    const reads = offline ? [] : await ST.readKids(childApi(), kids.filter((k) => inTo.has(k.id)));
    if (stopped) return;
    const readOf = Object.fromEntries(reads.map((r) => [r.id, r]));
    const kidOf = Object.fromEntries(kids.map((c) => [c.id, c]));
    const names = (ids) => ids.map((id) => (kidOf[id] || {}).nickname).filter(Boolean);
    const lineFor = (e, own) => {
      if (offline) return L.offlineLine(e.to.length);
      const weeks = e.to.map((id) => {
        const r = readOf[id];
        const g = r && r.d ? SET.weeksFromList(r.d, e.id, own)[0] : null;
        return g ? { name: (kidOf[id] || {}).nickname, test: g.test } : null;
      }).filter((x) => x && x.name).sort((a, b) => b.test.localeCompare(a.test));
      return L.cardLine(role, { toNames: names(e.to), weeks, today: today() });
    };
    const draw = () => {
      const own = Ow.normalise(W.ownOf(S.readWords()));
      const live = Ow.liveNewest(own);
      const gone = Ow.deleted(own, Date.now());
      const full = live.length >= Ow.MAX_LISTS;
      const showUndo = undo && Date.now() < undo.until;
      const setLabel = RD.WORDS[role].set;
      const cards = live.map((e) => {
        const to = names(e.to);
        const late = notSent.filter((x) => x.oid === e.id && kidOf[x.childId]); // a child no longer on the account is not "not sent"
        return '<article class="card gu-panel gu-ownchap ls-card" data-own="' + esc(e.id) + '"><div class="gu-panel__head"><h2><a class="ls-card__title" href="' + LIST + '/' + enc(e.id) + '" data-edit aria-label="' + esc("Edit '" + e.name + "'") + '">' + esc(e.name) + '</a></h2><span class="gu-count">' + e.words.length + (e.words.length === 1 ? ' word' : ' words') + '</span></div>'
          + '<p class="muted" data-shared>' + esc(lineFor(e, own)) + '</p>'
          + late.map((x) => '<p class="gu-line gu-line--warn" data-notsent>' + esc(D.notSentLine((kidOf[x.childId] || {}).nickname || L.asRole('your child', role))) + '<button type="button" class="btn btn--ghost" data-retry>Try again</button></p>').join('')
          + '<div class="gu-actions"><a class="btn btn--primary" href="#/grownups/set/list/' + enc(e.id) + '" data-set aria-label="' + esc(setLabel + ": '" + e.name + "'") + '">' + esc(setLabel) + '</a>'
          + (to.length ? '<a class="btn btn--ghost" href="' + LIST + '/' + enc(e.id) + '/results" data-results-link aria-label="' + esc("Results for '" + e.name + "'") + '">Results</a>' : '')
          + (role === 'tutor' ? '<button type="button" class="btn btn--ghost" data-copy="' + esc(e.id) + '">' + copyIcon + 'Copy for a learner</button>' : '')
          + '</div></article>';
      }).join('');
      const deleted = gone.length
        ? '<details class="card gu-deleted ls-deleted" data-deleted><summary>Deleted lists (' + gone.length + ') · bring back within 30 days</summary><p class="muted">Bring a list back within 30 days. After that it is gone for good.</p><ul>' + gone.map((e) => '<li><span>' + esc(e.name) + '</span><button type="button" class="btn btn--ghost" data-restore="' + esc(e.id) + '">Bring back</button></li>').join('') + '</ul></details>' : '';
      const lede = role === 'teacher' ? 'One list for the whole class.' : role === 'tutor' ? 'Each learner can have a list of their own.' : 'Saved words. Use any list for a week, or give it for practice.';
      const empty = '<section class="card gu-panel" data-none><h2>No lists of your own yet</h2><p>Add the school\'s words once, word by word, pasted or scanned. Then use them every week, for any child.</p></section>';
      main.innerHTML = wrap('Word lists', lede,
        (offline ? '<p class="gu-line gu-line--warn" role="status" data-offline>' + esc(L.OFFLINE_LIST) + '</p>' : '')
        + (showUndo ? '<p class="gu-line" role="status" data-undo>Deleted “' + esc(undo.name) + '”. You can bring it back within 30 days. <button type="button" class="btn btn--ghost" data-undo-go>Undo</button></p>' : '')
        + (live.length ? '<h2 class="ls-sec">' + (role === 'parent' ? 'Your word lists' : 'My lists') + '</h2><div class="gu-ownlist ls-cards">' + cards + '</div>' : empty) + deleted + readyCard(kids)
        + '<div class="ls-bar" data-bar>' + (full ? '<p class="gu-line gu-line--warn" role="status" data-thirty>' + esc(D.OWN_30) + '</p>'
          : '<a class="btn btn--primary btn--big" href="' + LIST + '/new" data-own-new>' + ICON.plus + (live.length ? 'New list' : 'Make your first list') + '</a>')
        + '<p class="small muted" data-count-line>' + esc(L.MAX_LISTS_LINE(live.length)) + (full ? '. Delete one first.' : '') + '</p></div>', ' data-own-list');
      main.querySelectorAll('[data-retry]').forEach((b) => b.addEventListener('click', redraw));
      main.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => {
        const e = own[b.dataset.copy];
        if (!e) return;
        try { window.sessionStorage.setItem(COPY_KEY, JSON.stringify({ name: e.name, words: e.words, ...(e.info ? { info: e.info } : {}) })); } catch (x) { /* no storage: an empty new list opens */ }
        location.hash = LIST + '/new';
      }));
      main.querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', async () => {
        b.disabled = true;
        const r = await D.restoreOwnChapter(childApi(), b.dataset.restore);
        if (stopped) return;
        if (r.error || r.problem) { showError(main.querySelector('[data-deleted] ul'), r.error ? D.OWN_ERRORS[r.error] : (P.PROBLEM_TEXT[r.problem] || P.PROBLEM_TEXT.other)); b.disabled = false; return; }
        notSent = r.notSent.map((childId) => ({ oid: r.oid, childId }));
        draw();
      }));
      const u = main.querySelector('[data-undo-go]');
      if (u) {
        u.addEventListener('click', async () => {
          u.disabled = true;
          const keep = undo;
          undo = null;
          const r = await D.restoreOwnChapter(childApi(), keep.oid);
          if (stopped) return;
          if (!r.ok) { undo = keep; u.disabled = false; showError(u.parentElement, r.error ? D.OWN_ERRORS[r.error] : (P.PROBLEM_TEXT[r.problem] || P.PROBLEM_TEXT.other)); return; } // it stays here to try again
          notSent = r.notSent.map((childId) => ({ oid: keep.oid, childId }));
          draw();
        });
        clearTimeout(timer);
        timer = setTimeout(() => { if (!stopped) { undo = null; draw(); } }, Math.max(0, undo.until - Date.now()));
      }
    };
    draw();
    settle(main);
  })();
  return () => { stopped = true; clearTimeout(timer); };
}

/* ------------------------------------------------------------------ the editor --- */
export function editor(main, { oid: given, view: startView = 'edit' } = {}) {
  const editing = given ? D.safeDecode(given) : '';
  // SB4-WP8: words carried from a scan screen are read once, here, so they never outlive this page whatever happens next.
  const hand = editing ? null : SD.takeScanWords(window.sessionStorage, 'editor');
  let copy = null;
  if (!editing) { // "Copy for a learner": read once
    try { copy = JSON.parse(window.sessionStorage.getItem(COPY_KEY)); window.sessionStorage.removeItem(COPY_KEY); } catch (e) { copy = null; }
    if (!copy || !Array.isArray(copy.words) || !copy.words.every((w) => typeof w === 'string')) copy = null;
    if (copy && !(Array.isArray(copy.add) && copy.add.every((w) => typeof w === 'string'))) delete copy.add;
  }
  if (!adultOnly(main)) return undefined;
  const role = roleHere();
  let stopped = false;
  main.innerHTML = wrap(editing ? 'Edit words' : 'New list', '', '<p class="muted">Loading…</p>');
  (async () => {
    const offline0 = navigator.onLine === false;
    const [lc, scanOn] = offline0 ? [{ children: [] }, false] : await Promise.all([A.listChildren(childApi()), editing ? false : scanIsOn()]); // the link is for a new list only
    if (stopped) return;
    if (lc.problem && lc.problem !== 'network') { problemPage(main, lc.problem); return; }
    const kids = (lc.problem ? [] : lc.children).slice(0, Math.min(Ow.MAX_TO, 15));
    const master = editing && D.validOid(editing) ? Ow.normalise(W.ownOf(S.readWords()))[editing] : null;
    if (editing && (!D.validOid(editing) || !master || master.gone)) {
      main.innerHTML = wrap('That list isn’t here', 'It may have been deleted, or the link is old. Look in Deleted lists, or go back to Word lists.', '<p><a class="btn btn--primary btn--big" href="' + LIST + '">Back to Word lists</a></p>', ' data-own-missing');
      return;
    }
    let started = [];
    if (editing && kids.length) {
      const reads = await Promise.all(kids.map((k) => A.readChild(childApi(), k.id)));
      if (stopped) return;
      const bad = reads.find((r) => r.problem);
      if (bad) { problemPage(main, bad.problem); return; }
      started = kids.filter((k, i) => D.hasStarted(reads[i].progress, editing)).map((k) => k.nickname);
    }
    run(main, { kids, master, editing, started, scanOn, hand, copy, role, startView, isStopped: () => stopped });
  })();
  return () => { stopped = true; };
}

const isReady = (w) => !!findEntry(w);
const yearOf = (w) => { const s = SET.sourceOf(w, findEntry); return s.kind === 'ready' ? s.year : null; };
const wordsLine = (n) => n + (n === 1 ? ' word' : ' words');

function run(main, { kids, master, editing, started, scanOn = false, hand = null, copy = null, role = 'parent', startView = 'edit', isStopped }) {
  let oid = editing;
  let name = master ? master.name : copy ? L.copyName(copy.name) : D.defaultName(today());
  let words = master ? [...master.words] : copy ? [...copy.words].slice(0, Ow.MAX_WORDS) : [];
  let info = master ? master.info : copy ? copy.info : undefined;
  let refused = [];
  let repeats = [];
  let dropped = []; // words past 15, named
  let note = ''; // the offline line, when the word list could not be fetched
  let to = master ? master.to.filter((id) => kids.some((k) => k.id === id)) : [];
  let tab = 'word'; // 'word' | 'paste'
  let typed = '';
  let year = ''; // the year filter of the find box
  let pasteValue = '';
  let view = 'edit'; // 'edit' | 'panel' | 'sentences' | 'saved'
  let panel = null; // { word, mode: 'made' | 'write', reported: bool, line: { head, tail } | null }
  let saved = null; // { names, notSent: [childId], shared, offline }
  let message = '';
  let busy = false;
  const gens = {}; // word -> { status: 'making' | 'ready' | 'failed' | 'none', statements, why, left, limit }
  const src = master ? master.src : 'typed';
  const full = () => words.length >= Ow.MAX_WORDS;
  const nameOf = (id) => (kids.find((k) => k.id === id) || {}).nickname;
  const kidsFor = () => to.map((id) => kids.find((k) => k.id === id)).filter(Boolean);
  const own = () => words.filter((w) => !isReady(w));

  main.innerHTML = wrap(editing ? 'Edit words' : 'New list', '', '<div class="sr" role="status" aria-live="polite" data-live></div><div data-edit-body></div>', ' data-own-edit');
  const live = main.querySelector('[data-live]');
  const body = main.querySelector('[data-edit-body]');
  const q = (s) => body.querySelector(s);
  const say = (t) => { live.textContent = ''; if (t) setTimeout(() => { live.textContent = t; }, 30); };
  const clearSay = () => { live.textContent = ''; }; // T1: a status such as "1 added." belongs to the tap that made it; a later edit empties it
  const focus = (el) => { if (el) el.focus({ preventScroll: false }); };
  const titleEl = main.querySelector('.pagehead');
  const h1 = () => main.querySelector('h1');
  /** One heading for the whole page: each view sets the words of the one that is there. */
  const head = (title, line = '') => { titleEl.innerHTML = '<span class="eyebrow">Grown-ups</span><h1 tabindex="-1">' + esc(title) + '</h1>' + (line ? '<p class="muted">' + esc(line) + '</p>' : ''); return ''; };

  // ---- the sentences of a typed word ------------------------------------------------------------------------
  const wordGen = (w) => gens[w] || { status: 'none', statements: [] };
  async function make(list) {
    const ask = list.filter((w) => !isReady(w) && SN.WORD_RE.test(w.toLowerCase()));
    if (!ask.length) return;
    const S2 = sentences();
    if (S2.off || navigator.onLine === false) { ask.forEach((w) => { gens[w] = L.genFromAllowance({ why: S2.off ? 'off' : 'offline' }); }); drawRows(); return; } // nothing is asked, so nothing is "being made"
    ask.forEach((w) => { gens[w] = { status: 'making', statements: [] }; });
    drawRows();
    const al = await S2.allowance();
    if (isStopped()) return;
    if (!al.on) { ask.forEach((w) => { gens[w] = L.genFromAllowance(al); }); drawRows(); return; }
    const r = await S2.askFor(ask);
    if (isStopped()) return;
    if (r.problem) { ask.forEach((w) => { gens[w] = L.genFromProblem(r.problem); }); drawRows(); return; }
    const again = [];
    for (const w of ask) {
      gens[w] = L.genFromItem(r.items.find((x) => x.word === w.toLowerCase()));
      if (gens[w].status === 'making') again.push(w);
    }
    drawRows();
    if (again.length) setTimeout(() => poll(again, 1), 6000);
  }
  async function poll(list, n) {
    if (isStopped()) return;
    const r = await sentences().fetchFor(list);
    if (isStopped()) return;
    const still = [];
    for (const w of list) {
      if (!gens[w] || gens[w].status !== 'making') continue;
      const s = !r.problem && r.items[w.toLowerCase()];
      if (s) gens[w] = { status: 'ready', statements: s };
      else still.push(w);
    }
    if (still.length && n < 4) setTimeout(() => poll(still, n + 1), 6000);
    else still.forEach((w) => { gens[w] = { status: 'failed', statements: [], why: 'failed' }; });
    drawRows();
  }
  /** What is already known for the typed words of a list being edited (read only; counts nothing). */
  async function known() {
    const list = own().filter((w) => SN.WORD_RE.test(w.toLowerCase()));
    if (!list.length) return;
    const r = await sentences().fetchFor(list);
    if (isStopped() || r.problem) return;
    for (const w of list) if (r.items[w.toLowerCase()] && !gens[w]) gens[w] = { status: 'ready', statements: r.items[w.toLowerCase()] };
    if (view === 'edit') drawRows();
  }

  // ---- drawing -----------------------------------------------------------------------------------------------
  function rowsHtml() {
    const rows = words.map((w, i) => {
      const y = yearOf(w);
      const typedWord = !isReady(w);
      let status;
      let acts = '';
      if (!typedWord) status = 'Ready-made' + (y ? ' · Year ' + y : '');
      else {
        const e = (info || {})[w];
        const st = L.sentenceState(wordGen(w), e);
        const sl = L.stateLine(st, { word: w, n: L.visibleFor(wordGen(w), e).length });
        status = sl.whole ? sl.text : 'Typed by you · ' + sl.text;
        acts = sl.actions.map((a) => '<button type="button" class="btn btn--quiet ls-quiet" data-act="' + a.id + '" data-w="' + esc(w) + '">' + esc(a.label) + '<span class="sr"> for ' + esc(w) + '</span></button>').join('');
      }
      const noPic = typedWord || !Dt.hasImage(findEntry(w) || {}) ? '<span class="ls-fine">No picture for this word. It shows letters.</span>' : '';
      return { i, html: '<li class="gu-ownword ls-row' + (typedWord && wordGen(w).status === 'making' ? ' is-making' : '') + '" data-word="' + esc(w) + '"><span class="ls-num" aria-hidden="true">' + (i + 1) + '</span><span class="gu-ownword__w">' + esc(w) + '</span>'
        + '<span class="gu-ownword__s" data-status>' + esc(status) + noPic + '</span>' + (acts ? '<span class="ls-acts">' + acts + '</span>' : '')
        + '<button type="button" class="btn btn--ghost gu-ownword__x" data-act="remove" data-w="' + esc(w) + '" aria-label="Remove \'' + esc(w) + '\'">Remove</button></li>' };
    }).reverse().map((x) => x.html).join('');
    return rows
      + refused.map((w) => {
        const sug = L.suggestWord(w, Dt.allWords().map((x) => x.word), { skip: words });
        const rl = D.refusedLines(w, sug);
        return '<li class="gu-ownword is-refused" data-refused="' + esc(w) + '"><span class="gu-ownword__w">' + esc(w) + '</span><span class="gu-ownword__s">' + esc(rl.head) + '<span class="ls-fine"' + (sug ? ' data-mean' : ' data-why') + '>' + esc(rl.tail) + '</span></span>'
          + (sug ? '<button type="button" class="btn btn--ghost ls-fix" data-act="fix" data-w="' + esc(w) + '" data-to="' + esc(sug) + '" aria-label="' + esc('Use ' + sug + ' instead of ' + w) + '">' + esc('Use “' + sug + '”') + '</button>' : '')
          + '<button type="button" class="btn btn--ghost gu-ownword__x" data-act="remove-refused" data-w="' + esc(w) + '" aria-label="Remove \'' + esc(w) + '\'">Remove</button></li>';
      }).join('')
      + repeats.map((w) => '<li class="gu-ownword is-note" data-repeat="' + esc(w) + '"><span class="gu-ownword__w">' + esc(w) + '</span><span class="gu-ownword__s">' + esc(D.OWN_REPEAT) + '</span></li>').join('');
  }
  const countText = () => wordsLine(words.length) + (words.length > W.MAX_WORDS ? ' · a week takes ' + W.MAX_WORDS : words.length ? ' · a week takes ' + W.MAX_WORDS : '');
  function missingHtml() {
    const n = L.missingCount(words, { isReady, info: info || {}, gens });
    return n && !full() ? '<p class="gu-line" data-nosentence>' + esc(I.LINES.noSentence(n)) + ' <button type="button" class="btn btn--ghost" data-act="sentences">See sentences</button></p>' : '';
  }
  function drawRows() {
    const ul = q('[data-ownwords]');
    if (!ul || view !== 'edit') return;
    ul.innerHTML = rowsHtml();
    q('[data-empty]').hidden = words.length > 0 || refused.length > 0;
    q('[data-count]').textContent = countText();
    const m = q('[data-missing]');
    if (m) m.innerHTML = missingHtml();
    const typedBox = q('[data-typed]');
    if (typedBox) { typedBox.disabled = full(); q('[data-add]').disabled = full(); }
  }
  function sugHtml() {
    const t = typed.trim();
    if (tab !== 'word' || t.length < 2) return '';
    const hits = SET.findWords(t, Dt.allWords(), { limit: 60 }).filter((h) => (!year || String(h.year) === String(year))).filter((h) => !words.some((w) => w.toLowerCase() === h.word.toLowerCase())).slice(0, 5);
    const lis = hits.map((h) => '<li><button type="button" class="ls-sug__b" data-act="pick" data-w="' + esc(h.word) + '"><b>' + esc(h.word) + '</b><span>' + (h.year ? 'Year ' + h.year : 'Ready-made') + '</span></button></li>').join('');
    const none = hits.length ? '' : '<p class="muted" data-nomatch>No ready-made word matches “' + esc(t) + '”.</p>';
    return none + '<ul class="ls-sug__list">' + lis + (/^[A-Za-z'’-]{2,25}$/.test(t) ? '<li><button type="button" class="ls-sug__b ls-sug__b--new" data-act="addnew" data-w="' + esc(t) + '"><b>Add “' + esc(t) + '” as a new word</b><span>Not from a list</span></button></li>' : '') + '</ul>';
  }
  function updateSug() { const el = q('[data-sug]'); if (el) el.innerHTML = sugHtml(); }

  function editHtml() {
    const tabs = '<div class="ls-tabs" role="group" aria-label="How to add words"><button type="button" class="ls-tab" data-act="tab" data-tab="word" aria-pressed="' + (tab === 'word') + '">Word by word</button>'
      + '<button type="button" class="ls-tab" data-act="tab" data-tab="paste" aria-pressed="' + (tab === 'paste') + '">Type or paste all</button>'
      + (scanOn ? '<a class="ls-tab" href="#/grownups/scan" data-scan-link>' + ICON.cam + 'Scan a paper</a>' : '') + '</div>';
    const find = tab === 'word'
      ? '<form class="ls-find" data-typeform><label for="own-add">' + (words.length ? 'Find a word, or type a new one' : 'Next word') + '</label><div class="ls-find__row"><input id="own-add" class="field" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(typed) + '"' + (full() ? ' disabled' : '') + ' data-typed>'
        + '<button type="submit" class="btn btn--ghost" data-add' + (full() ? ' disabled' : '') + '>Add word</button></div>'
        + '<div class="ls-years" role="group" aria-label="Only from"><span class="ls-years__l">Only from</span>' + ['', 1, 2, 3, 4, 5, 6].map((y) => '<button type="button" class="ls-chip" data-act="year" data-y="' + y + '" aria-pressed="' + (String(year) === String(y)) + '">' + (y ? 'Year ' + y : 'All years') + '</button>').join('') + '</div>'
        + '<div class="ls-sug" data-sug>' + sugHtml() + '</div><p class="small muted">Matches come from all ready-made Year 1 to 6 words. Tap one to add it.</p></form>'
      : '<div class="gu-field ls-paste"><label for="own-paste">Words, one on each line or with commas</label><textarea id="own-paste" class="field" rows="8" autocomplete="off" autocapitalize="off" spellcheck="false" data-paste>' + esc(pasteValue) + '</textarea>'
        + '<p class="small muted" data-pastecount>' + esc(D.splitTyped(pasteValue).length + ' words') + '. A list holds up to ' + Ow.MAX_WORDS + '. You can paste a whole list.</p></div>';
    const share = kids.length
      ? '<section class="card gu-panel"><fieldset class="gu-share"><legend>Give for practice</legend><p class="muted">' + esc(L.asRole(L.PAGE.giveHelp, role)) + '</p>' + kids.map((k) => '<label class="gu-check"><input type="checkbox" value="' + esc(k.id) + '"' + (to.includes(k.id) ? ' checked' : '') + ' data-share><span>' + esc(k.nickname) + '</span></label>').join('') + '</fieldset>'
        + (started.length ? '<p class="gu-line" data-started>' + esc(D.startedLine(started)) + '</p>' : '') + '</section>' : '';
    const row = oid ? '<p class="gu-ownlink"><a class="ls-link" href="' + LIST + '/' + enc(oid) + '/results" data-results-link>Results</a></p>' : '';
    return head(editing ? 'Edit words' : 'New list') + '<div class="gu-own ls-edit" data-own-editor>' + backLink(LIST, 'Word lists', ' data-back-list')
      + '<section class="card gu-panel">' + tabs + find
      + '<h2 class="ls-sec">Your words</h2><p data-count tabindex="-1" class="ls-count">' + esc(countText()) + '</p>'
      + '<div data-missing>' + missingHtml() + '</div>'
      + '<p class="gu-line gu-line--warn" data-full' + (full() ? '' : ' hidden') + '>' + esc(D.OWN_FULL + (dropped.length ? ' Not added, no room: ' + dropped.join(', ') + '.' : '')) + '</p>'
      + (dropped.length ? '<p data-second><button type="button" class="btn btn--ghost" data-act="second">' + esc(L.secondLine(dropped.length)) + '</button></p>' : '')
      + (note ? '<p class="gu-line gu-line--warn" data-note>' + esc(note) + '</p>' : '')
      + '<p class="muted" data-empty' + (words.length || refused.length ? ' hidden' : '') + '>No words yet. Type the first one above.</p>'
      + '<ul class="gu-ownwords" data-ownwords>' + rowsHtml() + '</ul>'
      + '<p class="small muted">A list holds up to ' + Ow.MAX_WORDS + '. A week takes ' + W.MAX_WORDS + '. ' + esc(L.sentenceFoot(sentences().off)) + '</p></section>'
      + '<section class="card gu-panel"><div class="gu-field"><label for="own-name">Name your list</label><p class="small muted">We suggest this name. Change it if you like.</p><input id="own-name" class="field" maxlength="' + Ow.MAX_NAME + '" value="' + esc(name) + '" data-name></div></section>'
      + share + row
      + '<div class="ls-bar" data-bar><button type="button" class="btn btn--primary btn--big" data-act="save"' + (busy ? ' disabled' : '') + '>' + (editing ? 'Save changes' : 'Save list') + '</button>'
      + (message ? '<p class="gu-error" role="alert" data-error>' + esc(message) + '</p>' : '')
      + '<p class="small muted">' + (navigator.onLine === false ? 'Save list keeps it on this phone' : 'The list stays in Word lists') + '</p>'
      + (oid ? '<button type="button" class="linkbtn" data-act="delete">Delete list</button>' : '') + '</div></div>';
  }
  const noteHtml = (n) => (n ? '<p class="gu-line gu-line--warn" role="status" data-note-line><b>' + esc(n.head) + '</b>' + esc(n.tail) + '</p>' : '');

  function savedHtml() {
    const late = saved.notSent.filter((id) => nameOf(id));
    return head('List saved') + '<div class="gu-own ls-saved" data-own-saved><section class="card gu-panel"><p class="gu-line" role="status" tabindex="-1" data-saved>' + esc(Sc.savedLineFor(saved.shared, saved.names, D.savedLine)) + '</p>'
      + '<h2>' + esc(name) + '</h2><p class="muted">' + esc(wordsLine(words.length)) + ' are ready to use.</p><ul class="ls-chips">' + words.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul>'
      + (saved.offline ? '<p class="gu-line gu-line--warn" data-saved-offline>' + esc(D.OWN_SAVED_OFFLINE) + '</p>' : '')
      + late.map((id) => '<p class="gu-line gu-line--warn" data-notsent>' + esc(D.notSentLine(nameOf(id))) + '<button type="button" class="btn btn--ghost" data-act="resend">Try again</button></p>').join('')
      + '<div class="btnrow"><a class="btn btn--ghost" href="' + LIST + '/new" data-act="another">Make another list</a><a class="btn btn--ghost" href="' + LIST + '" data-back-list>Back to Word lists</a>'
      + (to.length ? '<a class="btn btn--ghost" href="' + LIST + '/' + enc(oid) + '/results" data-results-link>Results</a>' : '') + '</div></section>'
      + '<div class="ls-bar" data-bar><a class="btn btn--primary btn--big" href="#/grownups/set/list/' + enc(oid) + '" data-set>Set a week with this list</a><p class="small muted">Next: who and when</p></div></div>';
  }

  // 03k: the typed words of this list and where each stands; the ready-made ones have theirs in the bank.
  function sentencesHtml(bankWords) {
    const mine = own();
    const items = mine.map((w) => {
      const e = (info || {})[w];
      const st = L.sentenceState(wordGen(w), e);
      const sl = L.stateLine(st, { word: w, n: L.visibleFor(wordGen(w), e).length });
      const acts = sl.actions.map((a) => '<button type="button" class="btn btn--quiet ls-quiet" data-act="' + a.id + '" data-w="' + esc(w) + '">' + esc(a.label) + '</button>').join('');
      return '<li class="ls-srow" data-srow="' + esc(w) + '"><b>' + esc(w) + '</b><span class="ls-fine">' + esc(sl.whole ? sl.text : st === 'making' ? sl.text : st === 'none' ? 'No sentence yet.' : sl.text) + '</span>' + acts + '</li>';
    }).join('');
    const ready = words.filter((w) => isReady(w) && bankWords[w.toLowerCase()]);
    return head('Sentences for your own words', 'We make sentences for the words you typed. Ready-made words already have theirs.') + '<div class="gu-own ls-sentences" data-own-sentences>' + backLink('#', name, ' data-act="leave-sentences"')
      + '<section class="card gu-panel"><h2>Your own words</h2>' + (items ? '<ul class="ls-slist">' + items + '</ul>' : '<p class="muted">You have not typed any words of your own.</p>') + '</section>'
      + (ready.length ? '<section class="card gu-panel"><h2>Ready-made words</h2><p>' + esc(ready.join(', ')) + ' already have sentences in our bank.</p><p class="muted">Not a blocker: you can set the week without them. A word without sentences sits out of Mix and match.</p></section>' : '')
      + '<div class="ls-bar" data-bar><button type="button" class="btn btn--primary btn--big" data-act="leave-sentences">Back to the list</button><p class="small muted">Used as soon as they are ready · remove any you don’t want</p></div></div>';
  }

  function panelHtml() {
    const w = panel.word;
    const e = (info || {})[w] || {};
    const g = wordGen(w);
    if (panel.mode === 'made') {
      const vis = L.visibleFor(g, e);
      return head('Sentences for ' + w, L.asRole(L.PANEL_INTRO_MADE, role)) + '<div class="gu-own ls-panel" data-own-panel>' + backLink('#', 'Edit words', ' data-act="panel-back"')
        + (panel.reported ? '<p class="gu-line" role="status" tabindex="-1" data-reported><b>' + esc(L.REPORTED.head) + '</b>' + esc(L.REPORTED.tail) + '</p>' : '')
        + '<section class="card gu-panel"><ul class="ls-made">' + vis.map((s) => '<li data-st="' + esc(s.id) + '"><p class="ls-sent">' + esc(s.s) + '</p><div class="gu-actions"><button type="button" class="btn btn--ghost" data-act="remove-st" data-id="' + esc(s.id) + '" aria-label="' + esc('Remove: ' + s.s) + '">Remove</button><button type="button" class="btn btn--ghost" data-act="report-st" data-id="' + esc(s.id) + '" aria-label="' + esc('Report: ' + s.s) + '">Report</button></div></li>').join('') + '</ul>'
        + '<button type="button" class="btn btn--quiet ls-quiet" data-act="panel-write">Write my own</button><p class="small muted">' + esc(L.asRole(L.PANEL_REMOVED, role)) + '</p></section>'
        + '<div class="ls-bar" data-bar><button type="button" class="btn btn--primary btn--big" data-act="panel-back">Done</button><p class="small muted">' + esc(L.sentencesFoot(vis.length)) + '</p></div></div>';
    }
    const why = g.status === 'none' || g.status === 'failed' ? g.why : '';
    const nt = panel.line ? L.explain(panel.line.head) : L.typingNote(why, { online: navigator.onLine !== false, left: g.left, limit: g.limit });
    return head('A sentence for ' + w, L.PANEL_INTRO_OWN) + '<div class="gu-own ls-panel" data-own-panel>' + backLink('#', 'Edit words', ' data-act="panel-back"')
      + '<form class="card gu-panel" data-sentform>' + noteHtml(nt)
      + '<div class="gu-field"><label for="ls-s">Write a short sentence with <b>' + esc(w) + '</b> in it</label><input id="ls-s" class="field" maxlength="' + I.MAX_SENTENCE_CHARS + '" autocomplete="off" value="' + esc(panel.s != null ? panel.s : e.s || '') + '" data-sent><p class="small muted">4 to 15 words, at most 90 letters. Letters and . , ! ? \' - only.</p></div>'
      + '<div class="gu-field"><label for="ls-m">What does it mean? (short, optional, used in Meaning match)</label><input id="ls-m" class="field" maxlength="' + I.MAX_MEANING_CHARS + '" autocomplete="off" value="' + esc(panel.m != null ? panel.m : e.m || '') + '" data-mean><p class="small muted">2 to 12 words, without the word itself.</p></div>'
      + '<div class="ls-bar" data-bar><button type="submit" class="btn btn--primary btn--big" data-act="save-sentence">Save sentence</button><p class="small muted">Used as soon as you save it</p></div></form></div>';
  }

  function draw() {
    if (view === 'panel') body.innerHTML = panelHtml();
    else if (view === 'sentences') { body.innerHTML = '<p class="muted">Loading…</p>'; loadBank().then((b) => { if (!isStopped() && view === 'sentences') { body.innerHTML = sentencesHtml(b); focus(h1()); } }); return; }
    else if (view === 'saved') body.innerHTML = savedHtml();
    else body.innerHTML = editHtml();
  }
  const go = (v, to2) => { view = v; panel = to2 || null; draw(); const h = q('[data-saved]') || q('[data-reported]') || h1() || q('[data-sent]'); focus(h); window.scrollTo(0, 0); };
  const toEdit = (focusSel) => { view = 'edit'; panel = null; draw(); focus(q(focusSel) || h1()); };

  // ---- adding and removing words ---------------------------------------------------------------------------
  const waiting = []; // words typed while the last one was being checked: taken in turn, never dropped (UAT3 H6)
  async function addText(text) {
    if (!text.trim()) return;
    if (busy) { waiting.push(text); say(L.CHECKING_LINE); return; }
    if (full()) return;
    busy = true;
    const before = words.length;
    const prev = [...words];
    const r = await D.addTyped(text, words, (raw) => checkTyped(raw, findEntry));
    busy = false;
    if (isStopped()) return;
    words = r.list;
    refused = [...refused, ...r.refused.filter((w) => !refused.includes(w))];
    repeats = r.repeats;
    dropped = r.dropped;
    note = r.offline ? D.OWN_WORD_OFFLINE : '';
    typed = r.offline ? text : '';
    saved = null;
    if (r.offline) { /* the word list cannot be fetched: nothing was added */ }
    draw();
    say(r.offline ? D.OWN_WORD_OFFLINE : D.addedLine(r, before));
    focus(full() ? q('[data-count]') : q('[data-typed]'));
    make(words.filter((w) => !prev.includes(w)));
    if (waiting.length) await addText(waiting.shift());
  }
  /** Take the paste box into the list (it replaces the list: the box is the list). */
  async function commitPaste() {
    if (tab !== 'paste') return;
    const box = q('[data-paste]');
    pasteValue = box ? box.value : pasteValue;
    const prev = [...words];
    const r = await D.addTyped(pasteValue, [], (raw) => checkTyped(raw, findEntry));
    if (isStopped()) return;
    words = r.list;
    refused = r.refused;
    repeats = r.repeats;
    dropped = r.dropped;
    note = r.offline ? D.OWN_WORD_OFFLINE : '';
    info = L.infoFor(info, words, isReady);
    make(words.filter((w) => !prev.includes(w)));
  }
  function removeWord(w) {
    words = words.filter((x) => x !== w);
    info = L.infoFor(info, words, isReady);
    delete gens[w];
    repeats = [];
    dropped = [];
    note = '';
    saved = null;
    draw();
    say(w + ' removed. ' + D.countLine(words.length) + '.');
    focus(body.querySelector('[data-act="remove"]') || q('[data-typed]'));
  }

  // ---- saving ----------------------------------------------------------------------------------------------
  /** Save the list (the one save path). Answers { r, offlineOnly } or null with `message` set. */
  async function persist() {
    message = '';
    const fit = L.fitInfo(info, words, isReady);
    if (!fit.ok) { message = fit.line; return null; }
    const offline = navigator.onLine === false;
    const keep = { oid: oid || undefined, name, words, src, to, info: fit.info || {} };
    const r = offline ? { ...D.saveOwnMaster(keep, { isReady }), notSent: [] } : await D.saveOwnChapter(childApi(), keep, { by: roleName(), isReady });
    if (isStopped()) return null;
    if (r.problem) { message = (r.problem === 'network' ? D.OWN_OFFLINE : P.PROBLEM_TEXT[r.problem] || P.PROBLEM_TEXT.other) + ' Nothing has been saved.'; return null; }
    if (r.error) { message = r.error === 'info-too-big' ? I.LINES.shorter : D.OWN_ERRORS[r.error] || P.PROBLEM_TEXT.other; return null; }
    oid = r.oid;
    editing = oid; // a second Save changes this list, never makes another
    return { r, offlineOnly: offline && r.ok };
  }
  async function save() {
    if (busy) return;
    busy = true;
    if (tab === 'paste') await commitPaste();
    const btn = q('[data-act="save"]');
    if (btn) btn.disabled = true;
    const out = await persist();
    busy = false;
    if (isStopped()) return;
    if (!out) { draw(); focus(q('[data-error]')); return; }
    refused = [];
    repeats = [];
    dropped = [];
    note = '';
    saved = { names: kidsFor().filter((k) => !out.r.notSent.includes(k.id)).map((k) => k.nickname), notSent: out.r.notSent, shared: kidsFor().length, offline: out.offlineOnly };
    go('saved');
  }
  const roleName = roleNameNow;
  async function remove() {
    const e = Ow.normalise(W.ownOf(S.readWords()))[oid];
    const r = await ask({
      title: 'Delete this list?',
      bodyHtml: '<p>The list goes to Deleted lists. You can bring it back within 30 days. Weeks and results already set stay as they are.</p>',
      actions: [{ id: 'no', label: 'Keep it', cls: 'btn--primary' }, { id: 'yes', label: 'Yes, delete it', cls: 'btn--destroy' }],
    });
    if (!r || r.id !== 'yes' || isStopped()) return;
    const d = await D.deleteOwnChapter(childApi(), oid);
    if (isStopped()) return;
    if (d.error || d.problem) { message = d.error ? D.OWN_ERRORS[d.error] : P.PROBLEM_TEXT[d.problem] || P.PROBLEM_TEXT.other; draw(); focus(q('[data-error]')); return; }
    undo = { oid, name: e ? e.name : name, until: Date.now() + 10000 };
    location.hash = LIST;
  }

  /** E15: save this list, then open a new one holding the words that had no room. */
  async function secondList() {
    if (busy || !dropped.length) return;
    busy = true;
    const out = await persist();
    busy = false;
    if (isStopped()) return;
    if (!out) { draw(); focus(q('[data-error]')); return; }
    try { window.sessionStorage.setItem(COPY_KEY, JSON.stringify({ name: L.secondName(name), words: [], add: dropped })); } catch (e) { /* no storage: an empty new list opens */ }
    if (location.hash.replace(/\/$/, '') === LIST + '/new') redraw(); else location.hash = LIST + '/new';
  }

  // ---- the sentence panel (03k, 03l) -------------------------------------------------------------------------
  const inList = async (key) => { const r = await checkTyped(key, findEntry); if (r.error === NEEDS_LIST) throw new Error('offline'); return !!r.word; };
  function openPanel(w) {
    const e = (info || {})[w];
    const g = wordGen(w);
    go('panel', { word: w, mode: L.visibleFor(g, e).length ? 'made' : 'write', reported: false, line: null });
  }
  async function saveSentence() {
    const w = panel.word;
    const s = q('[data-sent]').value.replace(/\s+/g, ' ').trim();
    const m = q('[data-mean]').value.replace(/\s+/g, ' ').trim();
    panel.s = s;
    panel.m = m;
    if (s || m) {
      let line = '';
      try { line = await I.checkInfo({ word: w, s, m }, { inList: navigator.onLine === false ? null : inList, findEntry }); } catch (e) { line = I.LINES.offline; }
      if (isStopped()) return;
      if (line) { panel.line = { head: line }; draw(); focus(q('[data-sent]')); return; }
    }
    const next = L.editInfo(info, w, { s, m });
    const fit = L.fitInfo(next, words, isReady);
    if (!fit.ok) { panel.line = { head: fit.line }; draw(); focus(q('[data-sent]')); return; }
    info = next;
    saved = null;
    if (oid && !busy) { busy = true; await persist(); busy = false; } // a list that is already saved sends the sentence with it
    if (isStopped()) return;
    toEdit(message ? '[data-error]' : '[data-typed]');
    say(message || 'Sentence saved.');
  }
  async function reportSentence(id) {
    const r = await sentences().report(id);
    if (isStopped()) return;
    info = L.hideId(info, panel.word, id); // hidden for this grown-up and for the children either way
    panel.reported = true;
    if (!L.visibleFor(wordGen(panel.word), (info || {})[panel.word]).length) { panel.mode = 'write'; panel.reported = false; }
    draw();
    focus(q('[data-reported]') || h1());
  }

  // ---- events: one listener for each kind, all on the body -----------------------------------------------------
  body.addEventListener('click', async (ev) => {
    const t = ev.target.closest && ev.target.closest('[data-act]');
    if (!t || !body.contains(t)) return;
    const act = t.dataset.act;
    const w = t.dataset.w;
    if (act === 'another') { if (location.hash.replace(/\/$/, '') === LIST + '/new') { ev.preventDefault(); redraw(); } return; } // a link to the empty form: fresh state, never the saved oid
    ev.preventDefault();
    if (!['pick', 'addnew', 'fix', 'remove'].includes(act)) clearSay();
    if (act === 'tab') { if (tab === 'paste' && t.dataset.tab === 'word') { await commitPaste(); } if (t.dataset.tab === 'paste') pasteValue = words.join('\n'); tab = t.dataset.tab; draw(); focus(q(tab === 'word' ? '[data-typed]' : '[data-paste]')); }
    else if (act === 'year') { year = t.dataset.y; draw(); focus(q('[data-typed]')); }
    else if (act === 'pick') { typed = ''; await addText(w); }
    else if (act === 'addnew') { typed = ''; await addText(w); }
    else if (act === 'remove') removeWord(w);
    else if (act === 'remove-refused') { refused = refused.filter((x) => x !== w); drawRows(); focus(q('[data-typed]')); }
    else if (act === 'see') openPanel(w);
    else if (act === 'retry') { make([w]); }
    else if (act === 'sentences') { view = 'sentences'; draw(); }
    else if (act === 'fix') { refused = refused.filter((x) => x !== w); typed = ''; await addText(t.dataset.to); }
    else if (act === 'second') secondList();
    else if (act === 'leave-sentences') { if (startView === 'sentences' && oid) location.hash = LIST + '/' + enc(oid); else toEdit('[data-typed]'); }
    else if (act === 'save') save();
    else if (act === 'delete') remove();
    else if (act === 'resend') save();
    else if (act === 'panel-back') toEdit('[data-typed]');
    else if (act === 'panel-write') { panel.mode = 'write'; draw(); focus(q('[data-sent]')); }
    else if (act === 'remove-st') { info = L.hideId(info, panel.word, t.dataset.id); if (!L.visibleFor(wordGen(panel.word), (info || {})[panel.word]).length) panel.mode = 'write'; draw(); focus(h1()); }
    else if (act === 'report-st') reportSentence(t.dataset.id);
    else if (act === 'save-sentence') saveSentence();
  });
  body.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (ev.target.matches('[data-typeform]')) { const text = q('[data-typed]').value; typed = ''; addText(text); }
    else if (ev.target.matches('[data-sentform]')) saveSentence();
  });
  body.addEventListener('input', (ev) => {
    const t = ev.target;
    clearSay();
    if (t.matches('[data-name]')) name = t.value;
    else if (t.matches('[data-typed]')) { typed = t.value; updateSug(); }
    else if (t.matches('[data-paste]')) { pasteValue = t.value; q('[data-pastecount]').textContent = D.splitTyped(pasteValue).length + ' words. A list holds up to ' + Ow.MAX_WORDS + '. You can paste a whole list.'; }
  });
  body.addEventListener('change', (ev) => { clearSay(); if (ev.target.matches('[data-share]')) to = [...body.querySelectorAll('[data-share]')].filter((x) => x.checked).map((x) => x.value); });
  // A one-line box drops line breaks and tabs on paste, which would join the words: they become ", " instead.
  body.addEventListener('paste', (ev) => {
    const box = ev.target;
    if (!box.matches || !box.matches('[data-typed]')) return;
    const t = ev.clipboardData ? ev.clipboardData.getData('text') : '';
    if (!D.needsPaste(t)) return;
    ev.preventDefault();
    const ins = D.pasteText(t);
    const a = box.selectionStart == null ? box.value.length : box.selectionStart;
    const b = box.selectionEnd == null ? a : box.selectionEnd;
    box.value = box.value.slice(0, a) + (a > 0 && !/[,\s]$/.test(box.value.slice(0, a)) ? ', ' : '') + ins + box.value.slice(b);
    typed = box.value;
    box.setSelectionRange(box.value.length, box.value.length);
    updateSug();
  });

  if (copy && copy.add && copy.add.length) addText(copy.add.join(', '));
  if (startView === 'sentences' && master) view = 'sentences';
  draw();
  settle(main);
  if (master) known();
  // SB4-WP8: words carried from "Type the words instead" on a scan screen, read once, a new list only, added as if pasted.
  if (hand) addText(hand.join(', ')).then(() => { if (!isStopped()) say(D.countLine(words.length) + '.'); });
}

/* ------------------------------------------------------------------ the list's own page, Give for practice, copies, ready-made --- */
export function sentencesPage(main, params = {}) { return editor(main, { ...params, view: 'sentences' }); }

/** Listen on `main` until the page is left (main is shared by every page, so a listener must never outlive its page). */
const listen = (offs, main, type, fn) => { main.addEventListener(type, fn); offs.push(() => main.removeEventListener(type, fn)); };
const face = (n) => '<span class="ls-face" aria-hidden="true">' + esc(String(n || '?').slice(0, 1).toUpperCase()) + '</span>';
const missingPage = (main, title, line, href, label) => {
  main.innerHTML = wrap(title, line, '<p><a class="btn btn--primary btn--big" href="' + href + '">' + esc(label) + '</a></p>', ' data-own-missing');
  settle(main);
};
const masterFor = (oid) => (D.validOid(oid) ? Ow.normalise(W.ownOf(S.readWords()))[oid] || null : null);
/** The children of the account, the first 15, with a problem answered as a page (the caller returns when `bad`). */
async function kidsOf(main) {
  const offline = navigator.onLine === false;
  const lc = offline ? { children: [] } : await A.listChildren(childApi());
  if (lc.problem && lc.problem !== 'network') { problemPage(main, lc.problem); return { bad: true }; }
  return { kids: (lc.problem ? [] : lc.children).slice(0, Math.min(Ow.MAX_TO, 15)), offline: offline || !!lc.problem };
}
async function deleteFlow(oid, name) {
  const r = await ask({
    title: 'Delete this list?',
    bodyHtml: '<p>The list goes to Deleted lists. You can bring it back within 30 days. Weeks and results already set stay as they are.</p>',
    actions: [{ id: 'no', label: 'Keep it', cls: 'btn--primary' }, { id: 'yes', label: 'Yes, delete it', cls: 'btn--destroy' }],
  });
  if (!r || r.id !== 'yes') return '';
  const d = await D.deleteOwnChapter(childApi(), oid);
  if (d.error || d.problem) return d.error ? D.OWN_ERRORS[d.error] : P.PROBLEM_TEXT[d.problem] || P.PROBLEM_TEXT.other;
  undo = { oid, name, until: Date.now() + 10000 };
  location.hash = LIST;
  return 'gone';
}

/** 03a, 03b, 03g: one Word list: its words, who has it, Give for practice, Set a week and Results. */
export function listPage(main, { oid: given } = {}) {
  if (!adultOnly(main)) return undefined;
  let stopped = false;
  const oid = D.safeDecode(given || '');
  const role = roleHere();
  const flash = gave && gave.oid === oid ? gave : null;
  gave = null;
  main.innerHTML = wrap('Word list', '', '<p class="muted">Finding your list…</p>');
  (async () => {
    const e = masterFor(oid);
    if (!e || e.gone) { missingPage(main, 'That list isn’t here', 'It may have been deleted, or the link is old. Look in Deleted lists, or go back to Word lists.', LIST, 'Back to Word lists'); return; }
    const k0 = await kidsOf(main);
    if (stopped || k0.bad) return;
    const kids = k0.kids;
    const kidOf = Object.fromEntries(kids.map((k) => [k.id, k]));
    const reads = k0.offline ? [] : await ST.readKids(childApi(), kids.filter((k) => e.to.includes(k.id)));
    if (stopped) return;
    const readOf = Object.fromEntries(reads.map((r) => [r.id, r]));
    const day = today();
    const draw = (m, flashNow) => {
      const lines = m.to.map((id) => {
        const k = kidOf[id];
        if (!k) return '';
        const r = readOf[id];
        const g = r && r.d ? SET.weeksFromList(r.d, oid, Ow.normalise(W.ownOf(S.readWords())))[0] : null;
        return '<li class="ls-given ls-given--kid" data-cid="' + esc(id) + '">' + face(k.nickname) + '<span class="ls-given__t"><b>' + esc(k.nickname) + '</b><span class="muted">' + esc(L.givenLineFor(g, m.words, day)) + (g || !(r && r.d) ? '' : ' · from today') + '</span></span></li>';
      }).join('');
      const used = new Set(m.to.flatMap((id) => { const r = readOf[id]; return r && r.d ? SET.weeksFromList(r.d, oid, Ow.normalise(W.ownOf(S.readWords()))).flatMap((g) => g.words.map((w) => w.toLowerCase())) : []; }));
      const unused = used.size ? m.words.filter((w) => !used.has(w.toLowerCase())) : [];
      const miss = L.missingCount(m.words, { isReady, info: m.info || {}, gens: {} });
      const head = flashNow
        ? '<div class="pagehead"><span class="eyebrow">Grown-ups</span><h1 tabindex="-1">' + esc(L.givenTitle(flashNow.names)) + '</h1><p class="muted">' + esc(m.name) + ' · ' + esc(L.madeLine(m.words.length, W.localDay(e.at), day)) + '</p></div>'
          + '<section class="card gu-panel ls-flash" role="status" data-given-flash><p>' + esc(L.asRole(L.givenHelp(flashNow.names), role)) + '</p>' + flashNow.notSent.map((n) => '<p class="gu-line gu-line--warn" data-notsent>' + esc(D.notSentLine(n)) + '</p>').join('')
          + '<div class="gu-actions"><button type="button" class="btn btn--ghost" data-undo-give>' + esc(L.PAGE.undo) + '</button><a class="btn btn--ghost" href="' + LIST + '/' + enc(oid) + '/give" data-give-else>' + esc(L.PAGE.giveElse) + '</a></div></section>'
        : '<div class="pagehead"><span class="eyebrow">Grown-ups</span><h1 tabindex="-1">' + esc(m.name) + '</h1><p class="muted">' + esc(L.madeLine(m.words.length, W.localDay(e.at), day)) + '</p></div>';
      const top = flashNow ? '' : '<div class="gu-actions ls-top"><a class="btn btn--ghost" href="' + LIST + '/' + enc(oid) + '/copy" data-copy-list>' + ICON.copy + esc(L.PAGE.copyThis) + '</a><a class="btn btn--ghost" href="' + EDIT(oid) + '" data-edit-words>' + esc(L.PAGE.editWords) + '</a></div><p class="small muted">' + esc(L.PAGE.copyHelp) + '</p>';
      const sent = miss ? '<p class="gu-line" data-nosentence>' + esc(I.LINES.noSentence(miss)) + ' <a class="btn btn--ghost" href="' + LIST + '/' + enc(oid) + '/sentences" data-see-sentences>See sentences</a></p>' : '';
      const results = m.to.length
        ? '<h2 class="ls-sec">' + esc(L.PAGE.results) + '</h2><p><a class="btn btn--ghost" href="' + LIST + '/' + enc(oid) + '/results" data-results-link aria-label="' + esc("Results for '" + m.name + "'") + '">' + esc(L.PAGE.results) + '</a></p>'
        : '<h2 class="ls-sec">' + esc(L.PAGE.results) + '</h2><p class="muted" data-no-results>' + esc(L.asRole(L.PAGE.noResults, role)) + '</p>';
      const given = '<h2 class="ls-sec">' + esc(L.PAGE.givenTo) + '</h2>' + (lines ? '<ul class="ls-giventlist" data-given>' + lines + '</ul>' : '<p class="muted" data-notgiven>' + esc(L.NOT_GIVEN) + '.</p>')
        + (unused.length ? '<p class="muted" data-unused>' + unused.length + (unused.length === 1 ? ' word is' : ' words are') + ' not used yet: ' + esc(unused.join(', ')) + '.</p>' : '');
      const give = '<section class="card gu-panel"><h2>' + esc(L.PAGE.give) + '</h2><p class="muted">' + esc(L.asRole(L.PAGE.giveHelp, role)) + '</p>'
        + (kids.length && !k0.offline ? '<a class="btn btn--ghost" href="' + LIST + '/' + enc(oid) + '/give" data-give>' + esc(L.PAGE.give) + '</a>' : '') + '</section>';
      const wordsSec = '<h2 class="ls-sec">' + esc(L.PAGE.words) + '</h2><ul class="ls-chips" data-words>' + m.words.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul>';
      const setLabel = RD.WORDS[role].set;
      main.innerHTML = '<section class="wrap page grownups gu ls" data-own-page>' + backLink(LIST, 'Word lists', ' data-back-list') + head + '<div class="gu-own ls-listpage">' + top + sent + results + given + give + wordsSec
        + '<p><button type="button" class="linkbtn" data-delete-list>' + esc(L.PAGE.deleteList) + '</button></p>'
        + '<p class="gu-error" role="alert" data-error hidden></p>'
        + '<div class="ls-bar" data-bar><a class="btn btn--primary btn--big" href="#/grownups/set/list/' + enc(oid) + '" data-set>' + esc(setLabel) + '</a><p class="small muted">With this list</p></div></div></section>';
      const del = main.querySelector('[data-delete-list]');
      if (del) del.addEventListener('click', async () => { const r = await deleteFlow(oid, m.name); if (stopped || !r || r === 'gone') return; const er = main.querySelector('[data-error]'); er.textContent = r; er.hidden = false; });
      const u = main.querySelector('[data-undo-give]');
      if (u) u.addEventListener('click', async () => {
        u.disabled = true;
        const r = await D.saveOwnChapter(childApi(), { oid, name: e.name, words: e.words, src: e.src, to: flashNow.prev }, { by: roleNameNow() });
        if (stopped) return;
        if (r.error || r.problem) { u.disabled = false; const er = main.querySelector('[data-error]'); er.textContent = r.error ? D.OWN_ERRORS[r.error] : P.PROBLEM_TEXT[r.problem] || P.PROBLEM_TEXT.other; er.hidden = false; return; }
        redraw();
      });
    };
    const m = masterFor(oid) || e;
    draw({ name: m.name, words: m.words, to: m.to, info: m.info }, flash);
    settle(main);
  })();
  return () => { stopped = true; };
}

/** 03e: who can practise this list. Nothing is set up as a week: no test, no daily jobs. */
export function givePage(main, { oid: given } = {}) {
  if (!adultOnly(main)) return undefined;
  let stopped = false;
  const role = roleHere();
  const offs = [];
  const oid = D.safeDecode(given || '');
  main.innerHTML = wrap('Give for practice', '', '<p class="muted">Finding your ' + (role === 'tutor' ? 'learners' : 'children') + '…</p>');
  (async () => {
    const e = masterFor(oid);
    if (!e || e.gone) { missingPage(main, 'That list isn’t here', 'It may have been deleted, or the link is old.', LIST, 'Back to Word lists'); return; }
    const k0 = await kidsOf(main);
    if (stopped || k0.bad) return;
    const kids = k0.kids;
    const reads = k0.offline ? [] : await ST.readKids(childApi(), kids.filter((k) => e.to.includes(k.id)));
    if (stopped) return;
    const readOf = Object.fromEntries(reads.map((r) => [r.id, r]));
    const own = Ow.normalise(W.ownOf(S.readWords()));
    const hasWeek = (id) => !!(readOf[id] && readOf[id].d && SET.weeksFromList(readOf[id].d, oid, own).length);
    const has = (id) => e.to.includes(id);
    const free = kids.filter((k) => !has(k.id));
    let pick = new Set();
    let busy = false;
    let message = '';
    const back = LIST + '/' + enc(oid);
    const draw = () => {
      const rows = kids.map((k) => {
        const taken = has(k.id);
        return '<label class="ls-row' + (taken ? ' is-taken' : '') + '"><input type="checkbox" data-kid="' + esc(k.id) + '"' + (taken || pick.has(k.id) ? ' checked' : '') + (taken ? ' disabled' : '') + '>' + face(k.nickname)
          + '<span class="ls-row__t"><b>' + esc(k.nickname) + '</b>' + (taken ? '<span class="ls-fine">' + esc(hasWeek(k.id) ? L.PAGE.hasWeek : L.PAGE.hasIt) + '</span>' : '') + '</span></label>';
      }).join('');
      const all = free.length > 1 ? '<label class="ls-row ls-row--all"><input type="checkbox" data-all' + (pick.size === free.length ? ' checked' : '') + '><span class="ls-row__t"><b>' + esc(L.asRole(L.PAGE.allKids, role)) + '</b><span class="ls-fine">' + esc(free.map((k) => k.nickname).join(' and ')) + '</span></span></label>' : '';
      main.innerHTML = wrap(L.PAGE.give, '', backLink(back, 'Word lists', ' data-back-list') + '<div class="gu-own ls-give" data-own-give><p class="ls-lede">' + esc(e.name) + '</p><p class="muted">' + esc(L.givePageLine(e.words.length)) + '</p>'
        + (k0.offline ? '<p class="gu-line gu-line--warn" role="status">' + esc(L.OFFLINE_LIST) + '</p>' : '')
        + (kids.length ? '<fieldset class="card gu-panel ls-rows"><legend class="sr">' + (role === 'tutor' ? 'Learners' : 'Children') + '</legend>' + all + rows + '</fieldset>' : '<p class="muted">' + esc(L.asRole('Add a child on your account first.', role)) + '</p>')
        + (message ? '<p class="gu-error" role="alert" data-error>' + esc(message) + '</p>' : '')
        + '<div class="ls-bar" data-bar><button type="button" class="btn btn--primary btn--big" data-act="give"' + (pick.size && !busy && !k0.offline ? '' : ' disabled') + '>' + esc(L.asRole(L.giveButton(pick.size), role)) + '</button><a class="btn btn--ghost" href="' + back + '" data-cancel>' + esc(L.PAGE.cancel) + '</a></div></div>', ' data-own-give-page');
    };
    listen(offs, main, 'change', (ev) => {
      const t = ev.target;
      if (t.matches && t.matches('[data-kid]')) { if (t.checked) pick.add(t.dataset.kid); else pick.delete(t.dataset.kid); draw(); const b = main.querySelector('[data-kid="' + t.dataset.kid + '"]'); if (b) b.focus(); }
      else if (t.matches && t.matches('[data-all]')) { pick = t.checked ? new Set(free.map((k) => k.id)) : new Set(); draw(); const b = main.querySelector('[data-all]'); if (b) b.focus(); }
    });
    listen(offs, main, 'click', async (ev) => {
      const b = ev.target.closest && ev.target.closest('[data-act="give"]');
      if (!b || busy || !pick.size) return;
      ev.preventDefault();
      busy = true; message = ''; draw();
      const to = [...e.to, ...pick].slice(0, Ow.MAX_TO);
      const r = await D.saveOwnChapter(childApi(), { oid, name: e.name, words: e.words, src: e.src, to }, { by: roleNameNow() });
      busy = false;
      if (stopped) return;
      if (r.error || r.problem) { message = (r.error ? D.OWN_ERRORS[r.error] : r.problem === 'network' ? D.OWN_OFFLINE : P.PROBLEM_TEXT[r.problem] || P.PROBLEM_TEXT.other) + ' Nothing has been given.'; draw(); return; }
      const names = kids.filter((k) => pick.has(k.id)).map((k) => k.nickname);
      gave = { oid, names, prev: [...e.to], notSent: r.notSent.map((id) => (kids.find((k) => k.id === id) || {}).nickname).filter(Boolean) };
      location.hash = back;
    });
    draw();
    settle(main);
  })();
  return () => { stopped = true; offs.forEach((f) => f()); };
}

/** 03c, 03f, 02h: a copy of a Word list or of a ready-made chapter. `oid` = a list, `ready` = a chapter id. The original never changes. */
export function copyPage(main, params = {}) {
  if (!adultOnly(main)) return undefined;
  let stopped = false;
  const oid = D.safeDecode(params.oid || '');
  const readyId = D.safeDecode(params.ready || '');
  const e = readyId ? null : masterFor(oid);
  const ch = readyId ? Dt.chapterById(readyId) : null;
  if ((!readyId && (!e || e.gone)) || (readyId && !ch)) { missingPage(main, 'That list isn’t here', 'It may have been deleted, or the link is old.', LIST, 'Back to Word lists'); return undefined; }
  const srcName = ch ? Dt.years()[ch.yearId].label + ' · Chapter ' + ch.n : e.name;
  const srcWords = ch ? ch.words.map((w) => w.word) : [...e.words];
  const srcHref = ch ? LIST + '/ready/' + enc(ch.id) : LIST + '/' + enc(oid);
  const offs = [];
  let name = L.copyName(srcName);
  let text = srcWords.join('\n');
  let message = '';
  let busy = false;
  let done = null;
  const count = () => D.splitTyped(text).length;
  const draw = () => {
    if (done) {
      const diff = L.copyDiff(srcWords, done.words);
      const hasDiff = diff.out.length || diff.in.length;
      main.innerHTML = wrap(L.COPY.saved, '', backLink(srcHref, srcName, ' data-back-src') + '<div class="gu-own ls-saved" data-own-copied><section class="card gu-panel"><h2 tabindex="-1" data-saved>' + esc(done.name) + '</h2><p class="muted">' + esc(done.words.length + (done.words.length === 1 ? ' word. ' : ' words. ') + L.COPY.unchanged(srcName)) + '</p>'
        + (done.names.length ? '<p class="muted">' + esc(L.COPY.results(done.names, srcName)) + '</p>' : '')
        + (hasDiff ? '<h3>' + esc(L.COPY.changed) + '</h3>' + (diff.out.length ? '<p><b>' + esc(L.COPY.takenOut(diff.out.length)) + '</b> ' + esc(diff.out.join(', ')) + '</p>' : '') + (diff.in.length ? '<p><b>' + esc(L.COPY.putIn(diff.in.length)) + '</b> ' + esc(diff.in.join(', ')) + '</p>' : '') : '')
        + '<div class="btnrow"><a class="btn btn--ghost" href="' + EDIT(done.oid) + '" data-again>' + esc(L.COPY.again) + '</a><a class="btn btn--ghost" href="' + srcHref + '">' + esc(L.COPY.back(srcName)) + '</a></div></section>'
        + '<div class="ls-bar" data-bar><a class="btn btn--primary btn--big" href="#/grownups/set/list/' + enc(done.oid) + '" data-set>' + esc(L.COPY.setWith) + '</a><p class="small muted">' + esc(L.COPY.next(done.names)) + '</p></div></div>', ' data-own-copy-saved');
      const h = main.querySelector('[data-saved]');
      if (h && h.focus) h.focus();
      return;
    }
    main.innerHTML = wrap(L.COPY.title, L.COPY.stays(srcName), backLink(srcHref, srcName, ' data-back-src') + '<form class="gu-own ls-copy" data-copyform><section class="card gu-panel"><div class="gu-field"><label for="cp-name">' + esc(L.COPY.nameLabel) + '</label><input id="cp-name" class="field" maxlength="' + Ow.MAX_NAME + '" value="' + esc(name) + '" data-name></div>'
      + '<div class="gu-field ls-paste"><label for="cp-words">' + esc(L.COPY.wordsLabel) + '</label><textarea id="cp-words" class="field" rows="10" autocomplete="off" autocapitalize="off" spellcheck="false" data-words>' + esc(text) + '</textarea>'
      + '<p class="small muted" data-count><b>' + esc(count() + (count() === 1 ? ' word' : ' words')) + '</b>. A list holds up to ' + Ow.MAX_WORDS + '. Change any you like.</p></div>'
      + (message ? '<p class="gu-error" role="alert" data-error>' + esc(message) + '</p>' : '') + '</section>'
      + '<div class="ls-bar" data-bar><button type="submit" class="btn btn--primary btn--big" data-act="save-copy"' + (busy || !count() ? ' disabled' : '') + '>' + esc(L.COPY.save) + '</button><p class="small muted">' + esc(L.COPY.then) + '</p></div></form>', ' data-own-copy');
  };
  listen(offs, main, 'input', (ev) => {
    const t = ev.target;
    if (t.matches && t.matches('[data-name]')) name = t.value;
    else if (t.matches && t.matches('[data-words]')) {
      text = t.value;
      const c = main.querySelector('[data-count]');
      if (c) c.innerHTML = '<b>' + esc(count() + (count() === 1 ? ' word' : ' words')) + '</b>. A list holds up to ' + Ow.MAX_WORDS + '. Change any you like.';
      const b = main.querySelector('[data-act="save-copy"]');
      if (b) b.disabled = !count();
    }
  });
  listen(offs, main, 'submit', async (ev) => {
    if (!ev.target.matches || !ev.target.matches('[data-copyform]')) return;
    ev.preventDefault();
    if (busy || !count()) return;
    busy = true; message = '';
    const r = await D.addTyped(text, [], (raw) => checkTyped(raw, findEntry));
    if (stopped) return;
    if (r.offline) { busy = false; message = D.OWN_OFFLINE; draw(); return; }
    if (!r.list.length) { busy = false; message = D.OWN_REFUSED + ': ' + r.refused.join(', ') + '. ' + D.OWN_REFUSED_WHY; draw(); return; }
    const isReadyW = (w) => !!findEntry(w);
    const info = e && e.info ? L.infoFor(e.info, r.list, isReadyW) : undefined;
    const out = await D.saveOwnChapter(childApi(), { name: name.trim() || L.copyName(srcName), words: r.list, src: 'typed', to: [], ...(info ? { info } : {}) }, { by: roleNameNow(), isReady: isReadyW });
    busy = false;
    if (stopped) return;
    if (out.error || out.problem) { message = (out.error ? D.OWN_ERRORS[out.error] : P.PROBLEM_TEXT[out.problem] || P.PROBLEM_TEXT.other) + ' Nothing has been saved.'; draw(); return; }
    done = { oid: out.oid, name: name.trim() || L.copyName(srcName), words: r.list, names: [] };
    draw();
    window.scrollTo(0, 0);
  });
  draw();
  settle(main);
  return () => { stopped = true; offs.forEach((f) => f()); };
}

/** 02f: the ready-made Year 1 to 6 lists, one year at a time (the tabs are on this page, no new address). */
export function readyLists(main, { year = '' } = {}) {
  if (!adultOnly(main)) return undefined;
  let stopped = false;
  const offs = [];
  main.innerHTML = wrap(L.READY.title, '', '<p class="muted">Getting the lists…</p>');
  (async () => {
    const k0 = await kidsOf(main);
    if (stopped || k0.bad) return;
    const kids = k0.kids.filter((k) => Number(k.year) >= 1 && Number(k.year) <= 6);
    const years = Dt.liveYears().length ? Dt.liveYears() : Object.keys(Dt.years());
    const kidYear = kids.length ? 'y' + kids[0].year : '';
    let cur = years.includes(year) ? year : years.includes(kidYear) ? kidYear : years[0];
    const who = (y) => kids.filter((k) => 'y' + k.year === y).map((k) => k.nickname);
    const draw = () => {
      const info = Dt.years()[cur];
      const chs = Dt.chapters(cur);
      const tabs = years.map((y) => { const n = who(y); return '<button type="button" class="ls-chip" data-act="year" data-year="' + y + '" aria-pressed="' + (cur === y) + '">' + esc(Dt.years()[y].label + (n.length ? ' · ' + n.join(', ') : '')) + '</button>'; }).join('');
      const line = kids.length ? kids.map((k) => k.nickname + ' Year ' + k.year).join(' · ') + (kidYear && cur === kidYear ? '. Opened on ' + info.label + ', ' + kids[0].nickname + '’s year.' : '.') : '';
      main.innerHTML = wrap(L.READY.title, line, backLink(LIST, 'Word lists', ' data-back-list') + '<div class="gu-own ls-readylists" data-own-ready><div class="ls-years" role="group" aria-label="Year">' + tabs + '</div><p class="muted">' + esc(L.READY.help) + '</p>'
        + '<h2 class="ls-sec">' + esc(info.label + ' · ' + chs.length + (chs.length === 1 ? ' chapter' : ' chapters')) + '</h2><ul class="ls-chlist">'
        + chs.map((c) => '<li><a class="ls-ch" href="' + LIST + '/ready/' + enc(c.id) + '" data-chapter="' + esc(c.id) + '"><b>Chapter ' + c.n + '</b><span class="muted">' + esc(c.words.length + ' words · ' + c.words.slice(0, 4).map((w) => w.word).join(', ') + ' …') + '</span></a></li>').join('') + '</ul></div>', ' data-own-ready-page');
      const sel = main.querySelector('[data-act="year"][aria-pressed="true"]');
      return sel;
    };
    listen(offs, main, 'click', (ev) => {
      const b = ev.target.closest && ev.target.closest('[data-act="year"]');
      if (!b) return;
      cur = b.dataset.year;
      draw();
      const again = main.querySelector('[data-year="' + cur + '"]');
      if (again) again.focus();
    });
    draw();
    settle(main);
  })();
  return () => { stopped = true; offs.forEach((f) => f()); };
}

/** 02g: one ready-made chapter (read-only): its words, Make my own copy, Set a week. A year id (y1 to y6) opens that year's page. */
export function readyList(main, { id = '', year = '' } = {}) {
  if (!adultOnly(main)) return undefined;
  const key = D.safeDecode(id || year || '');
  if (/^y[1-6]$/.test(key)) return readyLists(main, { year: key });
  const ch = Dt.chapterById(key);
  if (!ch) { missingPage(main, 'That chapter isn’t here', 'The link may be old. Go back to the ready-made lists.', LIST + '/ready', 'Back to Ready-made lists'); return undefined; }
  const y = Dt.years()[ch.yearId];
  const title = y.label + ' · Chapter ' + ch.n;
  const words = ch.words.map((w) => w.word);
  main.innerHTML = wrap(title, words.length + ' words · ' + L.READY.readOnly, backLink(LIST + '/ready/' + ch.yearId, y.label, ' data-back-year') + '<div class="gu-own ls-chapter" data-own-chapter><section class="card gu-panel"><h2>Words</h2><ul class="ls-chips" data-words>' + words.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ul></section>'
    + '<section class="card gu-panel"><p>' + esc(L.READY.find) + '</p><a class="btn btn--ghost" href="' + LIST + '/ready/' + enc(ch.id) + '/copy" data-make-copy>' + esc(L.COPY.makeOwn) + '</a></section>'
    + '<div class="ls-bar" data-bar><a class="btn btn--primary btn--big" href="#/grownups/set" data-set-chapter="' + esc(ch.id) + '">' + esc(RD.WORDS[roleHere()].set) + '</a><p class="small muted">With ' + esc(title) + '</p></div></div>', ' data-own-chapter-page');
  const set = main.querySelector('[data-set-chapter]');
  if (set) set.addEventListener('click', () => { try { window.sessionStorage.setItem(SET_CHAPTER_KEY, ch.id); } catch (e) { /* no storage: Set a week opens on its first page */ } });
  settle(main);
  return undefined;
}

/* ------------------------------------------------------------------ the child's routes --- */
const tried = new Set();
/** A chapter view that first fetches the meanings of typed words (Wordbright's, when it has one), for at most 2.5 seconds. */
const ready = (view) => (main, params) => {
  const e = (S.readSetup().own || {})[D.safeDecode(params.oid)];
  const need = e && !e.gone ? e.words.filter((w) => !findEntry(w) && !tried.has(w)) : [];
  if (!need.length) return view(main, params);
  let stopped = false;
  let inner = null;
  main.innerHTML = '<section class="wrap page"><div class="card empty"><h1>Just a moment</h1><p class="muted">Getting your words ready…</p></div></section>';
  Promise.race([meaningsFor(need), new Promise((r) => setTimeout(r, 2500))]).catch(() => {}).then(() => {
    need.forEach((w) => tried.add(w));
    if (!stopped) inner = view(main, params);
  });
  return () => { stopped = true; if (typeof inner === 'function') inner(); };
};
export const chapter = ready(FV.chapter);
export const study = ready(V.study);
export const spell = ready(V.spell);
export const quick = ready(V.quick);
export const practice = ready(V.practice);
export const test = ready(V.test);
export const quiz = ready(AV.chapterQuiz);
