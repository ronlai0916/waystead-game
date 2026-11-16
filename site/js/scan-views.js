// SB4-WP8: "Scan a paper" (#/grownups/scan). A grown-up photographs a printed spelling list, ticks and corrects the words
// and saves them as an own chapter. The rules and the wording are in scan-doc.js, the three calls in scan-data.js, the one
// save path in own-data.js. The steps live in memory, never in the URL (no word is ever in an address). The photo, its
// bitmap, canvas and shrunk copy live in closure variables only: no object URL, no image element, no storage; they are cleared
// when the words are read, on leaving and on "Scan another paper". A name found on the paper is never kept: only its
// first letter is.
import * as S from './store.js';
import * as W from './words-doc.js';
import * as Ow from './own-doc.js';
import * as D from './own-data.js';
import * as A from './grownups-data.js';
import * as P from './grownups-doc.js';
import * as Sc from './scan-doc.js';
import * as SD from './scan-data.js';
import * as Dt from './data.js';
import { adultOnly } from './grownups-views.js';
import { useForWeek } from './own-views.js';
import { checkTyped, NEEDS_LIST } from './wordcheck.js';
import { findEntry } from './word-info.js';
import { recheckWho, isKnownChild } from './who.js';
import { esc } from './ui.js';
import { accountOrigin, signInUrl } from './account/config.js';

const T = Sc.T;
const LIST = '#/grownups/own';
const ic = (p) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>';
const I = {
  back: ic('<path d="M15 18l-6-6 6-6"/>'),
  eye: ic('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  info: ic('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  cam: ic('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  img: ic('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M4 18l5-5 4 4 3-3 4 4"/>'),
};
const today = () => W.localDay(Date.now());
const status = (w) => { const e = findEntry(w); return e && e.meaning && e.meaning.definition && Dt.hasImage(e) ? T.picOk : T.picNo; };
const laptop = () => {
  try { return window.matchMedia('(pointer: fine)').matches && !(navigator.maxTouchPoints > 0) && !('ontouchstart' in window); } catch (e) { return false; }
};
const clockOf = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? Sc.clockTime(d.getHours(), d.getMinutes()) : '');

let api = null;
const childApi = () => { if (!api) api = A.createChildApi({ origin: accountOrigin(location) }); return api; };

const btn = (label, extra = '', cls = 'btn--ghost') => '<button type="button" class="btn ' + cls + '"' + extra + '>' + label + '</button>';
const primary = (label, extra = '') => btn(label, extra, 'btn--primary');
const plain = (label, extra = '') => btn(label, extra, 'btn--plain');
const msg = (text, extra = '') => '<div class="s-msg" role="alert" tabindex="-1" data-msg' + extra + '>' + I.info + '<p>' + esc(text) + '</p></div>';

/** A small dialog with focus kept inside; the safe choice is first, takes focus, and Escape means it. Answers true for Leave. */
function confirmLeave() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'gu-overlay';
    overlay.innerHTML = '<div class="gu-dialog" role="dialog" aria-modal="true" aria-labelledby="scan-lt" data-dialog><h2 id="scan-lt">' + esc(T.leaveTitle) + '</h2><p>' + esc(T.leaveBody) + '</p>'
      + '<div class="btnrow"><button type="button" class="btn btn--primary" data-stay>' + esc(T.stay) + '</button><button type="button" class="btn btn--ghost" data-leave>' + esc(T.leave) + '</button></div></div>';
    const prior = document.activeElement;
    const inert = [...document.body.children].filter((e) => e !== overlay && !e.hasAttribute('inert'));
    inert.forEach((e) => e.setAttribute('inert', ''));
    document.body.appendChild(overlay);
    const root = overlay.querySelector('.gu-dialog');
    const close = (leave) => {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      inert.forEach((e) => e.removeAttribute('inert'));
      if (!leave && prior && prior.focus && document.contains(prior)) prior.focus();
      resolve(leave);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(false); return; }
      if (e.key !== 'Tab') return;
      const f = [...root.querySelectorAll('button')];
      e.preventDefault();
      f[(f.indexOf(document.activeElement) + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    };
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    root.querySelector('[data-stay]').addEventListener('click', () => close(false));
    root.querySelector('[data-leave]').addEventListener('click', () => close(true));
    root.querySelector('[data-stay]').focus();
  });
}

/** The photo, made small on the device: longest side 1600 at 0.85, then 0.7, then 1280 at 0.7. EXIF is dropped by the re-encoding. */
async function shrink(file) {
  let bmp = null;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) {
    try { bmp = await createImageBitmap(file); } catch (e2) { return { problem: 'unreadable' }; }
  }
  try {
    const canvas = document.createElement('canvas'); // never added to the page
    const ctx = canvas.getContext('2d');
    if (!ctx) return { problem: 'unreadable' };
    let made = false;
    for (const step of Sc.shrinkPlan(bmp.width, bmp.height)) {
      canvas.width = step.width;
      canvas.height = step.height;
      ctx.drawImage(bmp, 0, 0, step.width, step.height);
      const blob = await new Promise((resolve) => { try { canvas.toBlob(resolve, 'image/jpeg', step.quality); } catch (e) { resolve(null); } });
      if (!blob) continue;
      made = true;
      if (blob.size <= Sc.MAX_BYTES) { canvas.width = 1; canvas.height = 1; return { blob }; }
    }
    canvas.width = 1;
    canvas.height = 1;
    return { problem: made ? Sc.AFTER_PLAN : 'unreadable' };
  } finally { if (bmp && bmp.close) bmp.close(); }
}

export function scan(main) {
  // Offline, who is here cannot be asked: a grown-up on a bad connection is told they are offline, never that the page is not for them.
  const offlineNow = navigator.onLine === false && !isKnownChild();
  if (!offlineNow && !adultOnly(main)) return undefined;
  const origin = accountOrigin(location);
  let stopped = false;
  let run = 0; // a new number whenever a request or the shrinking is given up, so a late answer is ignored
  let ctl = null;
  let stillTimer = 0;
  let readyTimer = 0;
  let typeTimer = 0;
  let step = '';
  let allow = null; // the allowance answer's data
  let photoFile = null; // the file chosen; closure only
  let blob = null; // the shrunk JPEG; closure only
  let resendAfterConsent = false;
  // the words
  let rows = []; // { id, word, ticked, bad } the main list, in the paper's order
  let out = []; // { id, kind: 'cant' | 'name' | 'added', word?, shown?, reason? } left out (a name keeps only its first letter)
  let nextId = 1;
  let foundCount = 0;
  let namesOut = 0;
  let pass = 1; // the chapter being made from this scan (1, 2, 3)
  let made = 0; // chapters saved from this scan
  let edit = null; // { kind: 'row' | 'out', id, checking }
  let leftOpen = null; // null = open when it holds a word to fix
  let addNote = '';
  let addText = '';
  let pendingWords = null; // words read, waiting for the word list
  let carried = SD.takeScanWords(window.sessionStorage, 'scan'); // after a sign-in: read once
  // name and share
  let kids = null;
  let name = '';
  let to = [];
  let chapterOid = '';
  let saved = null; // { oid, name, words, to, notSent, offer, m }
  let busy = false;
  let discard = false; // the grown-up chose Leave: the ticked words are not to come back
  let handedOff = false; // the words went to the editor
  let signingIn = false; // the sign-in link was followed: the kept words are for the page we return to

  main.innerHTML = '<section class="wrap page grownups gu" data-scan-page><div data-scan-root></div>'
    + '<div hidden data-scan-files><input type="file" accept="image/*" capture="environment" tabindex="-1" data-file-take><input type="file" accept="image/*" tabindex="-1" data-file-choose></div></section>';
  const rootEl = main.querySelector('[data-scan-root]');
  const takeInput = main.querySelector('[data-file-take]');
  const chooseInput = main.querySelector('[data-file-choose]');

  // ---- small helpers ---------------------------------------------------------------------------------
  const q = (s) => rootEl.querySelector(s);
  const usable = () => rows.filter((r) => !r.bad);
  const ticked = () => rows.filter((r) => r.ticked && !r.bad);
  const tickedWords = () => ticked().map((r) => r.word);
  const dirty = () => (step === 'check' || step === 'name') && ticked().length > 0;
  const clearPhoto = () => { photoFile = null; blob = null; };
  const clearAll = () => { clearPhoto(); rows = []; out = []; kids = null; };
  const stopTimers = () => { clearTimeout(stillTimer); clearTimeout(readyTimer); clearTimeout(typeTimer); };
  const focusEl = (el) => { if (el) { if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT)$/.test(el.tagName)) el.setAttribute('tabindex', '-1'); el.focus({ preventScroll: false }); } };
  const focusH1 = () => { const h = q('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } };

  /** Draw one step. `back` = what the in-page Back button does (none: no button). */
  function draw(stepName, { title = T.title, line = '', body = '', back = null, focus = 'h1', guardBack = true }) {
    step = stepName;
    rootEl.setAttribute('data-scan', stepName);
    rootEl.className = '';
    rootEl.innerHTML = (back ? '<button type="button" class="gu-back" data-back>' + I.back + esc(T.back) + '</button>' : '')
      + '<div class="pagehead"><span class="eyebrow">Grown-ups</span><h1>' + esc(title) + '</h1>' + (line ? '<p class="muted" data-line>' + esc(line) + '</p>' : '') + '</div>' + body;
    document.title = title + ' · Spellbright by Waystead';
    const b = q('[data-back]');
    if (b) b.addEventListener('click', () => (guardBack ? guard(back) : back())); // moving between this scan's own steps loses nothing: no dialog
    if (focus === 'h1') focusH1();
    else if (focus) focusEl(q(focus));
  }

  /** Run `go` now, or after "Leave without saving?" when ticked words are not saved. */
  async function guard(go) {
    if (dirty() && !(await confirmLeave())) return;
    if (!stopped) go();
  }
  const toEditor = () => {
    stopRequests();
    SD.giveScanWords(window.sessionStorage, 'editor', step === 'check' || step === 'name' ? tickedWords() : []);
    handedOff = true;
    location.hash = LIST + '/new';
  };
  const typeInstead = () => `<p class="s-typeline">${plain(esc(Sc.TYPE_INSTEAD), ' data-type')}</p>`;
  function stopRequests() { run += 1; if (ctl) ctl.abort(); ctl = null; stopTimers(); }

  // ---- the three kinds of problem card -----------------------------------------------------------------
  function problem(key, o = {}) {
    const c = Sc.problemLine(key, { resetsOn: o.resetsOn || (allow && allow.resetsOn), time: o.time });
    if (!c) return photoStep();
    const lap = laptop();
    const act = c.button === 'Take another photo' ? { label: Sc.anotherPhoto(lap), run: () => { clearPhoto(); pickPhoto(); } }
      : c.button === 'Try again' ? { label: c.button, run: o.retry || (() => (blob ? read() : photoStep())) }
        : null;
    const act2 = c.button2 ? { label: Sc.anotherPhoto(lap), run: () => { clearPhoto(); pickPhoto(); } } : null;
    const own = key === 'own-full';
    const buttons = own ? '<a class="btn btn--primary" href="' + LIST + '" data-own-back>' + esc(c.button) + '</a>'
      : (act ? primary(esc(act.label), ' data-act') : '') + (act2 ? btn(esc(act2.label), ' data-act2') : '')
        + (act || act2 ? plain(esc(Sc.TYPE_INSTEAD), ' data-type') : primary(esc(Sc.TYPE_INSTEAD), ' data-type'));
    draw('problem', {
      back: () => (allow && Sc.isOn({ ok: true, status: 200, data: allow }) && key !== 'off' ? photoStep() : (location.hash = LIST)),
      body: '<section class="card gu-panel s-state" data-problem="' + esc(key) + '">' + msg(c.line)
        + (key === 'cancelled' && allow ? '<p class="s-fine" data-left>' + esc(Sc.leftLine(allow.left)) + '</p>' : '')
        + '<div class="s-btns">' + buttons + '</div></section>',
      focus: '[data-msg]',
    });
    if (act) q('[data-act]').addEventListener('click', act.run);
    if (act2) q('[data-act2]').addEventListener('click', act2.run);
    const t = q('[data-type]');
    if (t) t.addEventListener('click', toEditor);
  }

  async function refreshLeft() {
    const a = await SD.allowance(origin);
    if (!stopped && Sc.isOn(a)) allow = a.data;
  }

  // ---- opening, consent -------------------------------------------------------------------------------
  async function start() {
    if (navigator.onLine === false) { await Promise.resolve(); if (!stopped) problem('offline', { retry: start }); return; } // after the router has settled, so the line takes focus
    draw('opening', { body: '<p class="muted" role="status">Checking…</p>', focus: 'h1' });
    const a = await SD.allowance(origin);
    if (stopped) return;
    if (!Sc.isOn(a)) {
      const k = Sc.problemOf(a);
      if (k === 'signed-out') { signedOut(); return; }
      if (k === 'playing') { playing(); return; }
      carried = null;
      problem('off');
      return;
    }
    allow = a.data;
    if (needConsent()) consentStep(); else afterConsent();
  }
  const version = () => (allow && typeof allow.consentVersion === 'string' && allow.consentVersion ? allow.consentVersion : 'v1');
  const needConsent = () => !(allow.consent && allow.consent.version === version());
  function afterConsent() {
    if (carried) { const w = carried; carried = null; fromWords(w); return; }
    photoStep();
  }

  function consentStep(readOnly = false, problemKey = '') {
    const c = Sc.consentText(Sc.SCAN_VENDOR);
    const privacy = Sc.PRIVACY_HREF ? '<p class="s-text"><a class="s-link" href="' + esc(Sc.PRIVACY_HREF) + '" target="_blank" rel="noopener">' + esc(c.privacy) + '<span class="sr"> (opens in a new tab)</span></a></p>' : '';
    const pl = problemKey ? Sc.problemLine(problemKey, {}) : null;
    draw('consent', {
      back: readOnly ? photoStep : () => { location.hash = LIST; },
      body: '<section class="card gu-panel s-step" aria-labelledby="scan-bs"><h2 id="scan-bs" class="s-h2">' + esc(c.heading) + '</h2>'
        + '<p class="s-text">' + esc(c.send) + '</p>'
        + '<div class="s-note">' + I.eye + '<p>' + esc(c.names) + ' <b>' + esc(c.cover) + '</b></p></div>'
        + '<p class="s-text">' + esc(c.tip) + '</p>' + privacy
        + (pl ? msg(pl.line) : '')
        + '<div class="s-btns">' + (readOnly ? btn(esc(T.close), ' data-close') : primary(esc(c.go), ' data-agree') + plain(esc(Sc.TYPE_INSTEAD), ' data-type')) + '</div></section>',
      focus: pl ? '[data-msg]' : 'h1',
    });
    const agree = q('[data-agree]');
    if (agree) agree.addEventListener('click', async () => {
      agree.disabled = true;
      const r = await SD.consent(origin, version());
      if (stopped) return;
      const k = Sc.problemOf(r);
      if (k === 'signed-out') { signedOut(); return; }
      if (k === 'playing') { playing(); return; }
      if (k) { consentStep(false, k === 'off' ? 'off' : k); return; }
      allow = { ...allow, consent: (r.data && r.data.consent) || { at: '', version: version() } };
      if (resendAfterConsent && blob) { resendAfterConsent = false; read(); return; }
      resendAfterConsent = false;
      afterConsent();
    });
    const cl = q('[data-close]');
    if (cl) cl.addEventListener('click', photoStep);
    const t = q('[data-type]');
    if (t) t.addEventListener('click', toEditor);
  }

  // ---- take or choose a photo ---------------------------------------------------------------------------
  function photoStep() {
    stopRequests();
    clearPhoto();
    const own = Ow.live(Ow.normalise(W.ownOf(S.readWords()))).length;
    if (own >= Ow.MAX_LISTS) { problem('own-full'); return; }
    if (allow.paused === true) { problem('paused'); return; }
    if (allow.left === 0) { problem('monthly', { resetsOn: allow.resetsOn }); return; }
    if (allow.hourLeft === 0) { problem('hourly', { time: clockOf(new Date(allow.hourResetsAt)) }); return; }
    const lap = laptop();
    draw('photo', {
      line: Sc.leftLine(allow.left),
      back: () => { location.hash = LIST; },
      body: '<section class="card gu-panel s-step" aria-label="' + esc(T.take + ' or ' + T.choose.toLowerCase()) + '">'
        + '<div class="s-note">' + I.eye + '<p><b>' + esc(T.cover) + '</b></p></div>'
        + '<p class="s-text">' + esc(T.tip) + '</p><p class="s-fine" data-limits>' + esc(T.limits) + '</p>'
        + '<div class="s-btns">' + (lap ? '' : primary(I.cam + esc(T.take), ' data-take')) + (lap ? primary(I.img + esc(T.choose), ' data-choose') : btn(I.img + esc(T.choose), ' data-choose')) + '</div>'
        + '<div class="s-btns">' + plain(esc(Sc.TYPE_INSTEAD), ' data-type') + plain(esc(T.how), ' data-how aria-haspopup="dialog"') + '</div></section>',
    });
    const tk = q('[data-take]');
    if (tk) tk.addEventListener('click', () => takeInput.click());
    q('[data-choose]').addEventListener('click', () => chooseInput.click());
    q('[data-type]').addEventListener('click', toEditor);
    q('[data-how]').addEventListener('click', () => consentStep(true));
  }
  /** "Take another photo": the camera on a phone, the file dialog on a laptop. Called from a tap, so the browser allows it. */
  const pickPhoto = () => (laptop() ? chooseInput : takeInput).click();
  for (const inp of [takeInput, chooseInput]) {
    inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0];
      inp.value = '';
      if (f) takePhoto(f);
    });
  }

  async function takePhoto(file) {
    stopRequests();
    clearPhoto();
    photoFile = file;
    const my = (run += 1);
    readyTimer = setTimeout(() => { if (!stopped && run === my) readyStep(); }, 500);
    const r = await shrink(file);
    clearTimeout(readyTimer);
    if (stopped || run !== my) return;
    photoFile = null; // the original is not needed any more
    if (r.problem) { problem(r.problem); return; }
    blob = r.blob;
    read();
  }
  function readyStep() {
    draw('ready', {
      title: T.ready.replace('…', ''),
      back: null,
      body: '<section class="card gu-panel s-step s-wait" aria-label="' + esc(T.ready) + '"><p class="s-wait__line" role="status">' + esc(T.ready) + '</p><div class="s-bar" aria-hidden="true"></div><div class="s-dot" aria-hidden="true"></div>'
        + '<div class="s-btns">' + btn(esc(T.cancel), ' data-cancel') + plain(esc(Sc.TYPE_INSTEAD), ' data-type') + '</div></section>',
    });
    q('[data-cancel]').addEventListener('click', () => { stopRequests(); photoStep(); });
    q('[data-type]').addEventListener('click', toEditor);
  }

  // ---- reading ---------------------------------------------------------------------------------------------
  async function read() {
    stopRequests();
    const my = run;
    ctl = new AbortController();
    draw('reading', {
      title: T.reading,
      body: '<section class="card gu-panel s-step s-wait" aria-label="Reading"><p class="s-wait__line" role="status" data-status>' + esc(T.readingLine) + '</p><div class="s-bar" aria-hidden="true"></div><div class="s-dot" aria-hidden="true"></div>'
        + '<div class="s-btns">' + btn(esc(T.cancel), ' data-cancel') + plain(esc(Sc.TYPE_INSTEAD), ' data-type') + '</div></section>',
    });
    stillTimer = setTimeout(() => { const s = q('[data-status]'); if (s && !stopped && run === my) s.textContent = T.stillReading; }, Sc.STILL_READING_MS);
    q('[data-cancel]').addEventListener('click', async () => {
      stopRequests();
      problem('cancelled');
      await refreshLeft(); // a cancelled scan may still have been used: the count is read again
      const l = q('[data-left]');
      if (l && allow && step === 'problem') l.textContent = Sc.leftLine(allow.left);
    });
    q('[data-type]').addEventListener('click', () => { clearPhoto(); toEditor(); });
    const r = await SD.scanWords(origin, blob, { signal: ctl.signal });
    if (stopped || run !== my) return;
    stopTimers();
    ctl = null;
    answer(r);
  }

  async function answer(r) {
    const key = Sc.problemOf(r);
    if (key === 'consent') { resendAfterConsent = true; consentStep(); return; }
    if (key === 'signed-out') { signedOut(); return; }
    if (key === 'playing') { playing(); return; }
    if (key) {
      if (key === 'failed' || key === 'timeout' || key === 'read-failed') refreshLeft(); // the vendor may have been called
      const at = key === 'hourly' && r.retryAfter ? new Date(Date.now() + r.retryAfter * 1000) : null;
      // The account has just refused: Back from the card must not offer a photo for it. A time is only ever the server's.
      if (key === 'hourly') allow = { ...allow, hourLeft: 0, hourResetsAt: at ? at.toISOString() : undefined };
      else if (key === 'monthly') allow = { ...allow, left: 0, resetsOn: (r.data && r.data.resetsOn) || allow.resetsOn };
      else if (key === 'paused') allow = { ...allow, paused: true };
      if (key === 'too-large') clearPhoto(); // no Try again here: the photo is not needed
      problem(key, { resetsOn: r.data && r.data.resetsOn, time: at ? clockOf(at) : '' });
      return;
    }
    if (r.data && Number.isInteger(r.data.left)) allow = { ...allow, left: r.data.left, hourLeft: Math.max(0, (allow.hourLeft || 0) - 1) };
    const c = Sc.clean(r.data);
    if (c.problem) { if (c.problem === 'no-words') clearPhoto(); if (!(r.data && Number.isInteger(r.data.left))) refreshLeft(); problem(c.problem === 'no-words' ? 'no-words' : 'read-failed'); return; }
    clearPhoto(); // read: the photo is not needed again
    checkWords(c.words);
  }

  // ---- 401 and 403 -----------------------------------------------------------------------------------------
  function signedOut() {
    stopRequests();
    const words = step === 'check' || step === 'name' ? tickedWords() : [];
    SD.giveScanWords(window.sessionStorage, 'scan', words);
    clearPhoto();
    const c = Sc.problemLine('signed-out');
    draw('signedout', {
      body: '<section class="card gu-panel s-state" data-problem="signed-out">' + msg(c.line) + '<p class="s-text">' + esc(words.length ? Sc.SIGNED_OUT_KEPT : Sc.SIGNED_OUT_AGAIN) + '</p>'
        + '<div class="s-btns"><a class="btn btn--primary" href="' + esc(signInUrl(origin, location.href)) + '" data-signin>' + esc(c.button) + '</a>' + plain(esc(Sc.TYPE_INSTEAD), ' data-type') + '</div></section>',
      focus: '[data-msg]',
    });
    q('[data-type]').addEventListener('click', toEditor);
    q('[data-signin]').addEventListener('click', () => { signingIn = true; });
  }
  async function playing() {
    stopRequests();
    clearAll();
    stopped = true; // the switch-back card is the whole page now
    cleanup();
    await recheckWho();
    adultOnly(main);
  }

  // ---- check the words -----------------------------------------------------------------------------------------
  async function checkWords(words) {
    pendingWords = words;
    draw('checking', { title: T.checkTitle, body: '<p class="muted" role="status">' + esc(T.checking) + '</p>' });
    const results = await Promise.all(words.map((w) => checkTyped(w, findEntry)));
    if (stopped) return;
    if (results.some((r) => r.error === NEEDS_LIST)) { problem('offline', { retry: () => checkWords(words) }); return; } // never scans again
    const checks = {};
    const known = {};
    const canon = {};
    words.forEach((w, i) => {
      const k = w.toLowerCase();
      if (findEntry(k)) known[k] = true;
      if (!results[i].error) { checks[k] = true; canon[k] = results[i].word; }
    });
    const sorted = Sc.sortFound(words, checks, Sc.MAX_FOUND, known);
    rows = sorted.use.map((w, i) => ({ id: nextId++, word: canon[w.toLowerCase()] || w, ticked: i < Ow.MAX_WORDS, bad: '' }));
    out = sorted.out.map((o) => (o.reason === Sc.REASON.name
      ? { id: nextId++, kind: 'name', shown: o.shown, reason: o.reason } // the word itself is dropped here
      : { id: nextId++, kind: 'cant', word: o.word, reason: o.reason === Sc.REASON.over ? Sc.REASON.cant : o.reason }));
    foundCount = words.length; // all the words found, names included
    namesOut = out.filter((o) => o.kind === 'name').length;
    pendingWords = null;
    pass = 1;
    made = 0;
    leftOpen = null;
    name = D.defaultName(today());
    to = [];
    chapterOid = '';
    saved = null;
    edit = null;
    addNote = '';
    drawCheck(true);
  }
  /** After a sign-in: the ticked words come back as they were, ticked and checked. */
  function fromWords(words) {
    rows = words.map((w) => ({ id: nextId++, word: w, ticked: true, bad: '' }));
    out = [];
    foundCount = rows.length;
    namesOut = 0;
    pass = 1;
    made = 0;
    leftOpen = null;
    name = D.defaultName(today());
    to = [];
    chapterOid = '';
    saved = null;
    edit = null;
    addNote = '';
    drawCheck(true);
  }

  const over = () => usable().length > Ow.MAX_WORDS;
  const rowStatus = (r) => r.bad || (!r.ticked && over() ? Sc.REASON.over : status(r.word));
  function rowHtml(r) {
    const k = 'sr' + r.id;
    if (edit && edit.kind === 'row' && edit.id === r.id) return editHtml(r.word, "Edit '" + r.word + "'", r.id);
    return '<li class="s-row' + (r.bad ? ' is-off is-note' : !r.ticked && over() ? ' is-over' : '') + '" data-row="' + r.id + '"><label class="s-pick"><input type="checkbox"' + (r.ticked ? ' checked' : '') + (r.bad ? ' disabled' : '') + ' data-tick="' + r.id + '" aria-describedby="' + k + '-st"><span class="s-word">' + esc(r.word) + '</span></label>'
      + '<span class="s-st" id="' + k + '-st" data-st>' + esc(rowStatus(r)) + '</span><button type="button" class="btn btn--ghost s-edit" data-edit="' + r.id + '" aria-describedby="' + k + '-st" aria-label="' + esc("Edit '" + r.word + "'") + '">' + esc(T.edit) + '</button></li>';
  }
  function editHtml(value, label, id) {
    return '<li class="s-row is-edit" data-editing="' + id + '"><label for="scan-ed" class="sr">' + esc(label) + '</label><input id="scan-ed" class="s-input" value="' + esc(value) + '" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" data-edit-input' + (edit.checking ? ' readonly aria-busy="true"' : '') + '>'
      + (edit.checking ? '<p class="s-st" role="status">' + esc(T.checking) + '</p>' : '<div class="s-editbtns">' + primary(esc(T.done), ' data-edit-done') + btn(esc(T.cancel), ' data-edit-cancel') + '</div>')
      + (edit.note ? '<p class="s-st" role="status">' + esc(edit.note) + '</p>' : '') + '</li>';
  }
  function outHtml(o) {
    if (o.kind === 'added') return '<li class="s-row s-row--line is-off is-note" data-out="' + o.id + '"><p class="s-st" role="status" tabindex="-1" data-added>' + esc(T.addedToList) + '</p></li>';
    if (o.kind === 'name') return '<li class="s-row is-off" data-out="' + o.id + '"><span class="s-pick s-pick--plain"><span class="s-word" role="img" aria-label="' + esc(T.nameHidden) + '">' + esc(o.shown) + '</span></span><span class="s-st">' + esc(o.reason) + '</span></li>';
    if (edit && edit.kind === 'out' && edit.id === o.id) return editHtml(o.word, "Change '" + o.word + "'", o.id);
    return '<li class="s-row is-off" data-out="' + o.id + '"><span class="s-pick s-pick--plain"><span class="s-word">' + esc(o.word) + '</span></span><span class="s-st" id="so' + o.id + '-st">' + esc(o.reason) + '</span>'
      + '<button type="button" class="btn btn--ghost s-edit" data-change="' + o.id + '" aria-describedby="so' + o.id + '-st" aria-label="' + esc("Change '" + o.word + "'") + '">' + esc(T.change) + '</button></li>';
  }
  const lede = () => (pass > 1 ? Sc.otherLede(usable().length) : usable().length > Ow.MAX_WORDS ? Sc.foundMore(usable().length) : Sc.foundLine(usable().length));

  function drawCheck(first = false) {
    const nLeft = out.filter((o) => o.kind !== 'added').length;
    const open = leftOpen === null ? out.some((o) => o.kind === 'cant' || o.kind === 'added') : leftOpen;
    const long = pass > 1 || usable().length > Ow.MAX_WORDS;
    const hasOut = out.length > 0;
    const keepFocus = !first && document.activeElement && rootEl.contains(document.activeElement);
    step = 'check';
    const scrollAt = window.scrollY;
    draw('check', {
      title: T.checkTitle,
      line: long ? '' : lede(),
      back: () => photoStepFromCheck(),
      focus: first ? 'h1' : '',
      body: (long ? '<div class="s-note s-note--quiet">' + I.info + '<p data-lede>' + esc(lede()) + '</p></div>' : '')
        + (Sc.manyNames(foundCount, namesOut) && pass === 1 ? '<div class="s-note s-note--quiet" data-many>' + I.info + '<p>' + esc(Sc.MANY_NAMES) + '</p></div>' : '')
        + '<section class="card gu-panel s-block" aria-labelledby="scan-ws"><h2 id="scan-ws">' + esc(T.wordsToSave) + '</h2><ul class="s-words" data-words>' + rows.map(rowHtml).join('') + '</ul>'
        + '<form class="gu-field" data-add-form><label for="scan-aw">' + esc(T.addLabel) + '</label><div class="s-addrow"><input id="scan-aw" class="field s-input" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" value="' + esc(addText) + '" data-add-input>' + btn(esc(T.add), ' type="submit" data-add') + '</div>'
        + '<span class="muted">' + esc(T.addHint) + '</span><p class="s-st s-addnote" role="status" data-add-note>' + esc(addNote) + '</p></form></section>'
        + (hasOut ? '<section class="card gu-panel s-block" aria-labelledby="scan-lo"><div class="s-lohead"><h2 id="scan-lo">' + esc(Sc.leftOutHead(nLeft)) + '</h2>' + plain(esc(open ? T.hide : T.show), ' aria-expanded="' + open + '" aria-controls="scan-lo-list" data-lo-toggle') + '</div>'
          + '<ul class="s-words" id="scan-lo-list"' + (open ? '' : ' hidden') + ' data-out-list>' + out.map(outHtml).join('') + '</ul></section>' : '')
        + typeInstead()
        + '<div class="s-sticky" data-sticky><p class="s-count" data-count aria-live="polite"></p><p class="s-sticky__why" id="scan-why" data-why></p>' + primary(esc(T.next), ' data-next') + '</div>',
    });
    updateBar();
    if (keepFocus) window.scrollTo(0, scrollAt);
  }
  function photoStepFromCheck() { clearAll(); photoStep(); }

  function updateBar() {
    const n = ticked().length;
    const c = q('[data-count]');
    if (!c) return;
    c.textContent = Sc.tickedLine(n);
    const why = Sc.limitReason(n);
    const w = q('[data-why]');
    w.textContent = why;
    w.hidden = !why;
    const b = q('[data-next]');
    b.disabled = !!why;
    if (why) b.setAttribute('aria-describedby', 'scan-why'); else b.removeAttribute('aria-describedby');
  }

  async function commitEdit() {
    const input = q('[data-edit-input]');
    if (!edit || !input || edit.checking) return;
    const v = input.value.trim();
    if (!v) { cancelEdit(); return; }
    edit.checking = true;
    edit.note = '';
    const e = edit;
    input.readOnly = true;
    input.setAttribute('aria-busy', 'true');
    const btns = q('.s-editbtns');
    if (btns) btns.outerHTML = '<p class="s-st" role="status">' + esc(T.checking) + '</p>';
    const r = await checkTyped(v, findEntry);
    if (stopped) return;
    if (r.error === NEEDS_LIST) { edit = { ...e, checking: false, note: D.OWN_OFFLINE }; drawCheck(); focusEl(q('[data-edit-input]')); return; }
    const taken = (id) => rows.some((x) => x.id !== id && !x.bad && x.word.toLowerCase() === (r.word || v).toLowerCase());
    edit = null;
    if (e.kind === 'row') {
      const row = rows.find((x) => x.id === e.id);
      if (row) {
        if (r.error) { row.word = v.slice(0, 30); row.bad = D.OWN_REFUSED; row.ticked = false; } else if (taken(row.id)) { row.word = r.word; row.bad = D.OWN_REPEAT; row.ticked = false; } else { row.word = r.word; row.bad = ''; row.ticked = true; }
      }
      drawCheck();
      focusEl(q('[data-edit="' + e.id + '"]'));
      return;
    }
    const o = out.find((x) => x.id === e.id);
    if (!o) { drawCheck(); return; }
    if (r.error) { o.word = v.slice(0, 30); o.reason = Sc.REASON.cant; drawCheck(); focusEl(q('[data-change="' + o.id + '"]')); return; }
    if (taken(0)) { o.word = r.word; o.reason = D.OWN_REPEAT; drawCheck(); focusEl(q('[data-change="' + o.id + '"]')); return; }
    o.kind = 'added';
    delete o.word;
    rows.push({ id: nextId++, word: r.word, ticked: ticked().length < Ow.MAX_WORDS, bad: '' });
    leftOpen = true;
    drawCheck();
    focusEl(q('[data-out="' + o.id + '"] [data-added]'));
  }
  function cancelEdit() {
    const e = edit;
    edit = null;
    drawCheck();
    if (e) focusEl(q(e.kind === 'row' ? '[data-edit="' + e.id + '"]' : '[data-change="' + e.id + '"]'));
  }
  function openEdit(kind, id) {
    edit = { kind, id, checking: false, note: '' };
    drawCheck();
    const i = q('[data-edit-input]');
    focusEl(i);
    if (i) i.setSelectionRange(i.value.length, i.value.length);
  }

  async function addWords() {
    const input = q('[data-add-input]');
    const text = input ? input.value : '';
    if (!text.trim() || busy) return;
    busy = true;
    const have = new Set(rows.filter((r) => !r.bad).map((r) => r.word.toLowerCase()));
    const r = await D.addTyped(text, [], (raw) => (have.has(raw.trim().toLowerCase()) ? Promise.resolve({ error: 'repeat' }) : checkTyped(raw, findEntry)));
    busy = false;
    if (stopped) return;
    if (r.offline) { addNote = D.OWN_OFFLINE; addText = text; drawCheck(); focusEl(q('[data-add-input]')); return; }
    let added = 0;
    let dup = r.repeats.length;
    let count = ticked().length;
    for (const w of r.list) {
      if (have.has(w.toLowerCase())) { dup += 1; continue; }
      have.add(w.toLowerCase());
      rows.push({ id: nextId++, word: w, ticked: count < Ow.MAX_WORDS, bad: '' });
      if (count < Ow.MAX_WORDS) count += 1;
      added += 1;
    }
    let refused = 0;
    for (const w of r.refused) {
      if (have.has(w.toLowerCase())) { dup += 1; continue; }
      out.push({ id: nextId++, kind: 'cant', word: w, reason: Sc.REASON.cant });
      refused += 1;
    }
    addNote = T.addNote(added, refused, dup);
    addText = '';
    if (refused) leftOpen = true;
    drawCheck();
    focusEl(q('[data-add-input]'));
  }

  // ---- name and share -------------------------------------------------------------------------------------------
  async function nameStep(note = '') {
    if (!kids) {
      draw('name', { title: T.nameTitle, back: () => drawCheck(true), guardBack: false, body: '<p class="muted" role="status">Finding your children…</p>' });
      const lc = await A.listChildren(childApi());
      if (stopped) return;
      if (lc.problem) {
        if (lc.problem === 'playing') { playing(); return; }
        if (lc.problem === 'signed-out') { signedOut(); return; }
        draw('name', { title: T.nameTitle, back: () => drawCheck(true), guardBack: false, body: '<section class="card gu-panel s-step">' + msg(P.PROBLEM_TEXT[lc.problem] || P.PROBLEM_TEXT.other) + '<div class="s-btns">' + primary('Try again', ' data-retry') + '</div></section>', focus: '[data-msg]' });
        q('[data-retry]').addEventListener('click', () => nameStep());
        return;
      }
      kids = lc.children.slice(0, Ow.MAX_TO);
      if (!to.length && kids.length === 1 && made === 0) to = [kids[0].id];
      to = to.filter((id) => kids.some((k) => k.id === id));
    }
    const words = tickedWords();
    const share = kids.length
      ? '<fieldset class="gu-share"><legend>' + esc(T.shareLegend) + '</legend><p class="muted">' + esc(T.shareHelp) + '</p>'
        + kids.map((k) => '<label class="gu-check"><input type="checkbox" value="' + esc(k.id) + '"' + (to.includes(k.id) ? ' checked' : '') + ' data-share><span>' + esc(k.nickname) + '</span></label>').join('')
        + (kids.length >= 3 ? plain(esc(T.tickAll), ' data-tick-all') : '') + '<p class="s-fine" id="scan-ns" data-notshared' + (to.length ? ' hidden' : '') + '>' + esc(T.notShared) + '</p></fieldset>'
      : '<p class="s-text" data-nokids>' + esc(T.noChildren) + '</p>';
    draw('name', {
      title: T.nameTitle,
      back: () => drawCheck(true),
      guardBack: false,
      focus: note ? '[data-error]' : 'h1',
      body: '<section class="card gu-panel s-step"><div class="gu-field"><label for="scan-name">' + esc(T.nameLabel) + '</label><input id="scan-name" class="field" maxlength="' + Ow.MAX_NAME + '" autocomplete="off" value="' + esc(name) + '" data-name' + (note && /name/i.test(note) ? ' aria-invalid="true" aria-describedby="scan-err"' : '') + '></div>'
        + '<p class="s-count" data-count aria-live="polite">' + esc(D.countLine(words.length)) + '</p>' + share
        + (note ? '<p class="gu-error" id="scan-err" role="alert" tabindex="-1" data-error>' + esc(note) + '</p>' : '')
        + '<div class="s-btns">' + primary(esc(T.save), ' data-save' + (kids.length ? ' aria-describedby="scan-ns"' : '')) + '</div></section>',
    });
    const nm = q('[data-name]');
    nm.addEventListener('input', () => { name = nm.value; });
    nm.addEventListener('focus', () => { if (nm.value === D.defaultName(today())) nm.select(); }, { once: true });
    const sync = () => {
      to = [...rootEl.querySelectorAll('[data-share]')].filter((x) => x.checked).map((x) => x.value);
      const ns = q('[data-notshared]');
      if (ns) ns.hidden = to.length > 0;
    };
    rootEl.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('change', sync));
    const all = q('[data-tick-all]');
    if (all) all.addEventListener('click', () => { rootEl.querySelectorAll('[data-share]').forEach((b) => { b.checked = true; }); sync(); });
    q('[data-save]').addEventListener('click', save);
  }

  async function save() {
    if (busy) return;
    busy = true;
    const b = q('[data-save]');
    b.disabled = true;
    const words = tickedWords();
    const r = await D.saveOwnChapter(childApi(), { oid: chapterOid || undefined, name, words, src: 'scan', to });
    busy = false;
    if (stopped) return;
    if (r.problem === 'signed-out') { signedOut(); return; }
    if (r.problem) { nameStep((r.problem === 'network' ? D.OWN_OFFLINE : P.PROBLEM_TEXT[r.problem] || P.PROBLEM_TEXT.other) + T.nothingSaved); return; }
    if (r.error) { nameStep(D.OWN_ERRORS[r.error] || P.PROBLEM_TEXT.other); return; }
    chapterOid = r.oid;
    made += 1;
    const wasLong = usable().length > Ow.MAX_WORDS;
    const left = usable().filter((x) => !x.ticked);
    saved = { oid: r.oid, name, words, to: [...to], notSent: r.notSent, offline: navigator.onLine === false, offer: wasLong && left.length > 0, m: left.length };
    doneStep();
  }

  // ---- done ---------------------------------------------------------------------------------------------------------
  function doneStep() {
    const sv = saved;
    const nick = (id) => (kids.find((k) => k.id === id) || {}).nickname;
    const sharedKids = sv.to.map((id) => kids.find((k) => k.id === id)).filter(Boolean);
    const late = sv.notSent.filter(nick);
    const reached = sharedKids.filter((k) => !sv.notSent.includes(k.id)).map((k) => k.nickname);
    draw('done', {
      title: T.savedTitle,
      focus: '[data-saved]',
      body: '<section class="card gu-panel s-step" aria-label="Saved"><p class="gu-line" role="status" tabindex="-1" data-saved>' + esc(Sc.savedLineFor(sharedKids.length, reached, D.savedLine)) + '</p>'
        + (sv.offline ? '<p class="gu-line gu-line--warn" data-saved-offline>' + esc(D.OWN_SAVED_OFFLINE) + '</p>' : '')
        + late.map((id) => '<p class="gu-line gu-line--warn" data-notsent>' + esc(D.notSentLine(nick(id))) + btn('Try again', ' data-resend') + '</p>').join('')
        + '<div class="s-btns">' + (sv.offer ? primary(esc(Sc.moreButton(made, sv.m)), ' data-more') + btn(esc(T.useWeek), ' data-use') : primary(esc(T.useWeek), ' data-use')) + '</div>'
        + '<div class="s-btns"><a class="btn btn--plain" href="' + LIST + '" data-list>' + esc(T.backList) + '</a>' + plain(esc(T.another), ' data-another')
        + (sharedKids.length >= 2 ? '<a class="btn btn--plain" href="#/grownups/teach/' + encodeURIComponent(sv.oid) + '" data-results>' + esc(T.results) + '</a>' : '') + '</div></section>',
    });
    const re = q('[data-resend]');
    if (re) re.addEventListener('click', async () => {
      re.disabled = true;
      const r = await D.saveOwnChapter(childApi(), { oid: sv.oid, name: sv.name, words: sv.words, src: 'scan', to: sv.to });
      if (stopped) return;
      if (r.ok) saved = { ...sv, notSent: r.notSent };
      doneStep();
      if (!r.ok) focusEl(q('[data-resend]'));
    });
    q('[data-use]').addEventListener('click', async () => {
      const here = location.hash;
      const went = await useForWeek({ words: sv.words, kids: sharedKids });
      if (!went || stopped) return;
      await new Promise((r) => setTimeout(r, 400));
      // Never silent: if the plan page did not open, say so (the button stays, so Try again is the same tap).
      if (!stopped && step === 'done' && location.hash === here && !q('[data-use-problem]')) {
        q('[data-saved]').insertAdjacentHTML('afterend', '<p class="gu-line gu-line--warn" role="alert" data-use-problem>' + esc(P.PROBLEM_TEXT.other) + '</p>');
      }
    });
    q('[data-another]').addEventListener('click', () => { clearAll(); saved = null; made = 0; pass = 1; photoStep(); });
    const more = q('[data-more]');
    if (more) more.addEventListener('click', () => {
      const unfixed = rows.filter((x) => x.bad).map((x) => ({ id: nextId++, kind: 'cant', word: x.word, reason: x.bad }));
      rows = usable().filter((x) => !x.ticked).map((x, i) => ({ ...x, ticked: i < Ow.MAX_WORDS }));
      out = [...out.filter((o) => o.kind !== 'added'), ...unfixed];
      namesOut = out.filter((o) => o.kind === 'name').length;
      pass = made + 1;
      chapterOid = '';
      name = Sc.nextName(D.defaultName(today()), pass);
      saved = null;
      edit = null;
      addNote = '';
      leftOpen = null;
      drawCheck(true);
    });
  }

  // ---- events (one listener for each kind, everything inside the root) ------------------------------------------------
  rootEl.addEventListener('change', (e) => {
    const t = e.target;
    if (t && t.matches && t.matches('[data-tick]')) {
      const r = rows.find((x) => x.id === Number(t.dataset.tick));
      if (!r) return;
      r.ticked = t.checked;
      updateBar();
      rootEl.querySelectorAll('[data-row]').forEach((li) => {
        const row = rows.find((x) => x.id === Number(li.dataset.row));
        const s = li.querySelector('[data-st]');
        if (row && s) { s.textContent = rowStatus(row); li.classList.toggle('is-over', !row.ticked && over() && !row.bad); }
      });
    }
  });
  rootEl.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('button');
    if (!t || !rootEl.contains(t)) return;
    if (t.matches('[data-edit]')) openEdit('row', Number(t.dataset.edit));
    else if (t.matches('[data-change]')) openEdit('out', Number(t.dataset.change));
    else if (t.matches('[data-type]') && (step === 'check' || step === 'name')) toEditor();
    else if (t.matches('[data-edit-done]')) commitEdit();
    else if (t.matches('[data-edit-cancel]')) cancelEdit();
    else if (t.matches('[data-lo-toggle]')) {
      const open = t.getAttribute('aria-expanded') !== 'true';
      leftOpen = open;
      t.setAttribute('aria-expanded', String(open));
      t.textContent = open ? T.hide : T.show;
      const l = q('[data-out-list]');
      if (l) l.hidden = !open;
    } else if (t.matches('[data-next]')) {
      if (t.disabled) return;
      nameStep();
    }
  });
  rootEl.addEventListener('submit', (e) => {
    if (e.target.matches && e.target.matches('[data-add-form]')) { e.preventDefault(); addWords(); }
  });
  rootEl.addEventListener('keydown', (e) => {
    if (e.target.matches && e.target.matches('[data-edit-input]')) {
      if (e.key === 'Enter') { e.preventDefault(); commitEdit(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelEdit(); }
    }
  });
  // The sticky bar steps aside while a text field has the on-screen keyboard.
  rootEl.addEventListener('focusin', (e) => { if (e.target.matches && e.target.matches('input[type="text"], input:not([type])')) rootEl.classList.add('is-typing'); });
  rootEl.addEventListener('focusout', () => { rootEl.classList.remove('is-typing'); });
  rootEl.addEventListener('paste', (e) => {
    const box = e.target;
    if (!box.matches || !box.matches('[data-add-input]')) return;
    const text = e.clipboardData ? e.clipboardData.getData('text') : '';
    if (!D.needsPaste(text)) return;
    e.preventDefault();
    const ins = D.pasteText(text);
    const a = box.selectionStart == null ? box.value.length : box.selectionStart;
    const b2 = box.selectionEnd == null ? a : box.selectionEnd;
    box.value = box.value.slice(0, a) + (a > 0 && !/[,\s]$/.test(box.value.slice(0, a)) ? ', ' : '') + ins + box.value.slice(b2);
  });

  // Links and the Back button in the page chrome ask first while ticked words are not saved.
  let skip = false;
  const onDocClick = (e) => {
    if (skip || !dirty() || stopped) return;
    const a = e.target.closest && e.target.closest('a[href]');
    const back = e.target.closest && e.target.closest('#back');
    const target = back || (a && a.target !== '_blank' && !main.contains(a) ? a : null);
    if (!target) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    confirmLeave().then((leave) => { if (leave && !stopped) { discard = true; skip = true; target.click(); skip = false; } });
  };
  document.addEventListener('click', onDocClick, true);

  function cleanup() {
    // What a ticked list does when this page goes away without the grown-up choosing Leave (the phone's own back gesture, the
    // session ending under the page): the ticked words wait in sb.scanWords for the next visit to this page, which reads them
    // once. Anything else this page wrote for itself is dropped, so no word outlives its page. Words only, never a name.
    if (!signingIn && !handedOff) {
      if (dirty() && !discard) SD.giveScanWords(window.sessionStorage, 'scan', tickedWords());
      else SD.dropScanWords(window.sessionStorage, 'scan');
    }
    stopped = true;
    stopRequests();
    clearAll();
    document.removeEventListener('click', onDocClick, true);
    rootEl.classList.remove('is-typing');
  }

  start();
  return cleanup;
}
