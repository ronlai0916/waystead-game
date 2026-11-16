// SB4-WP7: a grown-up's own chapters. The grown-up's pages (the list, the editor, "Use for this week") and the child's
// routes for playing one (the same views as a year chapter, once any meanings are in). The rules and saving are in
// own-data.js and own-doc.js; nothing here decides a rule.
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
import { adultOnly } from './grownups-views.js';
import { checkTyped } from './wordcheck.js';
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
const CAM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';
/** SB4-WP8: scanning is offered only when the account says so (exactly on: true). Any other answer, a 404 or a network error is off. */
const scanIsOn = async () => Sc.isOn(await SD.allowance(accountOrigin(location)));
let undo = null; // { oid, name, until }: the chapter just deleted, for 10 seconds on the list page

const wrap = (title, line, body, attr = '') => '<section class="wrap page grownups gu"' + attr + '><div class="pagehead"><span class="eyebrow">Grown-ups</span><h1>' + esc(title) + '</h1>'
  + (line ? '<p class="muted">' + esc(line) + '</p>' : '') + '</div>' + body + '</section>';

async function problemPage(main, problem) {
  if (problem === 'playing') { await recheckWho(); adultOnly(main); return; }
  if (problem === 'signed-out') recheckWho();
  const offline = problem === 'network';
  main.innerHTML = wrap('Your own chapters', '', '<div class="card gu-panel" data-own-problem="' + esc(problem) + '"><p>' + esc(offline ? D.OWN_OFFLINE : P.PROBLEM_TEXT[problem] || P.PROBLEM_TEXT.other) + '</p>'
    + '<div class="btnrow"><button type="button" class="btn btn--primary" data-retry>Try again</button><a class="btn btn--ghost" href="#/grownups">Back to Grown-ups</a></div></div>', offline ? ' data-own-offline' : '');
  const b = main.querySelector('[data-retry]');
  if (b) b.addEventListener('click', redraw);
}

/** After the first draw of a page reached from a Menu row or a link, focus goes to the page's h1 (never lost to the redraw). */
function settle(main) {
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
function ask({ title, bodyHtml, actions, init, read }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'gu-overlay';
    overlay.innerHTML = '<div class="gu-dialog" role="dialog" aria-modal="true" aria-labelledby="own-dt" data-dialog><h2 id="own-dt">' + esc(title) + '</h2>' + bodyHtml
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

/* ------------------------------------------------------------------ Use for this week --- */
/** Hand a chapter's words to Plan a week: which child first (when shared with more than one), then Pick 10 when there are more than 10. */
export async function useForWeek({ words, kids }) {
  let cid = '';
  if (kids.length > 1) {
    const r = await ask({
      title: 'Which child is this week for?',
      bodyHtml: '<fieldset class="gu-who"><legend class="sr">Which child</legend>' + kids.map((k, i) => '<label class="gu-radio"><input type="radio" name="own-kid" value="' + esc(k.id) + '"' + (i === 0 ? ' checked' : '') + '><span class="gu-radio__text"><b>' + esc(k.nickname) + '</b></span></label>').join('') + '</fieldset>',
      actions: [{ id: 'go', label: 'Next', cls: 'btn--primary' }, { id: 'no', label: 'Cancel' }],
      read: (root) => root.querySelector('input[name="own-kid"]:checked').value,
    });
    if (!r || r.id !== 'go') return false;
    cid = r.value;
  } else if (kids.length === 1) cid = kids[0].id;
  let chosen = words;
  if (words.length > W.MAX_WORDS) {
    const r = await ask({
      title: 'Pick ' + W.MAX_WORDS + ' for this week',
      bodyHtml: '<p class="muted" role="status" aria-live="polite" data-pickline></p><ul class="gu-pick">' + words.map((w, i) => '<li><label class="gu-check"><input type="checkbox" value="' + esc(w) + '"' + (i < W.MAX_WORDS ? ' checked' : '') + ' data-pick><span>' + esc(w) + '</span></label></li>').join('') + '</ul>',
      actions: [{ id: 'go', label: 'Use these words', cls: 'btn--primary' }, { id: 'no', label: 'Cancel' }],
      init: (root) => {
        const sync = () => {
          const boxes = [...root.querySelectorAll('[data-pick]')];
          const n = boxes.filter((b) => b.checked).length;
          boxes.forEach((b) => { b.disabled = !b.checked && n >= W.MAX_WORDS; });
          root.querySelector('[data-pickline]').textContent = n + ' of ' + W.MAX_WORDS + ' ticked.' + (n >= W.MAX_WORDS ? ' Untick one to choose another.' : '');
          root.querySelector('[data-act="go"]').disabled = n === 0;
        };
        root.addEventListener('change', sync);
        sync();
      },
      read: (root) => [...root.querySelectorAll('[data-pick]:checked')].map((b) => b.value),
    });
    if (!r || r.id !== 'go') return false;
    chosen = r.value;
  }
  D.givePlanWords(null, chosen);
  location.hash = cid ? '#/grownups/child/' + encodeURIComponent(cid) + '/plan' : '#/grownups/plan';
  return true; // true: it went on to the plan page; false: the grown-up cancelled
}

/* ------------------------------------------------------------------ the list --- */
export function list(main) {
  if (!adultOnly(main)) return undefined;
  if (navigator.onLine === false) { problemPage(main, 'network'); return undefined; }
  let stopped = false;
  let timer = null;
  main.innerHTML = wrap('Your own chapters', '', '<p class="muted">Finding your chapters…</p>');
  (async () => {
    const [lc, scanOn] = await Promise.all([A.listChildren(childApi()), scanIsOn()]); // SB4-WP8: the allowance is asked once for the page
    if (stopped) return;
    if (lc.problem) { problemPage(main, lc.problem); return; }
    const sync = await D.syncOwn(childApi(), lc.children);
    if (stopped) return;
    if (sync.problem) { problemPage(main, sync.problem); return; }
    let notSent = sync.notSent;
    const kidOf = Object.fromEntries(lc.children.map((c) => [c.id, c]));
    const names = (ids) => ids.map((id) => (kidOf[id] || {}).nickname).filter(Boolean);
    const draw = () => {
      const own = Ow.normalise(W.ownOf(S.readWords()));
      const live = Ow.live(own);
      const gone = Ow.deleted(own, Date.now());
      const full = live.length >= Ow.MAX_LISTS;
      const showUndo = undo && Date.now() < undo.until;
      const cards = live.map((e) => {
        const to = names(e.to);
        const late = notSent.filter((x) => x.oid === e.id && kidOf[x.childId]); // a child no longer on the account is not "not sent"
        return '<article class="card gu-panel gu-ownchap" data-own="' + esc(e.id) + '"><div class="gu-panel__head"><h2>' + esc(e.name) + '</h2><span class="gu-count">' + e.words.length + (e.words.length === 1 ? ' word' : ' words') + '</span></div>'
          + '<p class="muted" data-shared>' + (to.length ? 'Shared with ' + esc(D.joinNames(to)) : 'Not shared yet') + '</p>'
          + late.map((x) => '<p class="gu-line gu-line--warn" data-notsent>' + esc(D.notSentLine((kidOf[x.childId] || {}).nickname || 'your child')) + '<button type="button" class="btn btn--ghost" data-retry>Try again</button></p>').join('')
          + '<div class="gu-actions"><a class="btn btn--ghost" href="' + LIST + '/' + encodeURIComponent(e.id) + '" data-edit aria-label="' + esc("Edit '" + e.name + "'") + '">Edit</a><button type="button" class="btn btn--ghost" data-use="' + esc(e.id) + '" aria-label="' + esc("Use '" + e.name + "' for this week") + '">Use for this week</button>'
          + (to.length ? '<a class="btn btn--plain" href="#/grownups/teach/' + encodeURIComponent(e.id) + '" data-teach-link aria-label="' + esc("See results for '" + e.name + "'") + '">See results</a>' : '') /* SB4-WP11 */
          + '</div></article>';
      }).join('');
      const deleted = gone.length
        ? '<section class="card gu-deleted" data-deleted><h2>Deleted chapters</h2><p class="muted">You can bring one back for 30 days.</p><ul>' + gone.map((e) => '<li><span>' + esc(e.name) + '</span><button type="button" class="btn btn--ghost" data-restore="' + esc(e.id) + '">Restore</button></li>').join('') + '</ul></section>' : '';
      main.innerHTML = wrap('Your own chapters', 'Type this week\'s school spellings once. Your children find them under "From your grown-up".',
        (showUndo ? '<p class="gu-line" role="status" data-undo>Deleted \'' + esc(undo.name) + '\'. <button type="button" class="btn btn--ghost" data-undo-go>Undo</button></p>' : '')
        + (full ? '<p class="gu-line gu-line--warn" role="status" data-thirty>' + esc(D.OWN_30) + '</p>'
          : scanOn ? '<div class="s-btns" data-scan-links><a class="btn btn--primary" href="' + LIST + '/new" data-own-new>Make a chapter</a><a class="btn btn--ghost" href="#/grownups/scan" data-scan-link>' + CAM + 'Scan a paper</a></div>'
            : '<p><a class="btn btn--primary" href="' + LIST + '/new" data-own-new>Make a chapter</a></p>')
        + (live.length ? '<div class="gu-ownlist">' + cards + '</div>' : '<p class="muted" data-none>No chapters yet.</p>') + deleted, ' data-own-list');
      main.querySelectorAll('[data-retry]').forEach((b) => b.addEventListener('click', redraw));
      main.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => {
        const e = own[b.dataset.use];
        useForWeek({ words: e.words, kids: e.to.map((id) => kidOf[id]).filter(Boolean) });
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
export function editor(main, { oid: given }) {
  const editing = given ? D.safeDecode(given) : '';
  // SB4-WP8: words carried from a scan screen are read once, here, so they never outlive this page whatever happens next.
  const hand = editing ? null : SD.takeScanWords(window.sessionStorage, 'editor');
  if (!adultOnly(main)) return undefined;
  if (navigator.onLine === false) { problemPage(main, 'network'); return undefined; }
  let stopped = false;
  main.innerHTML = wrap(editing ? 'Change your chapter' : 'Make your own chapter', '', '<p class="muted">Loading…</p>');
  (async () => {
    const [lc, scanOn] = await Promise.all([A.listChildren(childApi()), editing ? false : scanIsOn()]); // SB4-WP8: the link is for a new chapter only
    if (stopped) return;
    if (lc.problem) { problemPage(main, lc.problem); return; }
    const kids = lc.children.slice(0, Ow.MAX_TO);
    const master = editing && D.validOid(editing) ? Ow.normalise(W.ownOf(S.readWords()))[editing] : null;
    if (editing && (!D.validOid(editing) || !master || master.gone)) {
      main.innerHTML = wrap('That chapter isn\'t here', '', '<p><a class="btn btn--primary" href="' + LIST + '">Back to your chapters</a></p>', ' data-own-missing');
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
    run(main, { kids, master, editing, started, scanOn, hand, isStopped: () => stopped });
  })();
  return () => { stopped = true; };
}

function run(main, { kids, master, editing, started, scanOn = false, hand = null, isStopped }) {
  let oid = editing;
  let name = master ? master.name : D.defaultName(today());
  let words = master ? [...master.words] : [];
  let refused = [];
  let repeats = [];
  let dropped = []; // words past 15, named
  let note = ''; // the offline line, when the word list could not be fetched
  let to = master ? master.to.filter((id) => kids.some((k) => k.id === id)) : kids.length === 1 ? [kids[0].id] : [];
  let typed = '';
  let saved = null; // { names, notSent: [childId] } after a save
  let message = '';
  let busy = false;
  const src = master ? master.src : 'typed';
  const full = () => words.length >= Ow.MAX_WORDS;
  const nameOf = (id) => (kids.find((k) => k.id === id) || {}).nickname;
  const status = (w) => { const e = findEntry(w); return e && e.meaning && e.meaning.definition && Dt.hasImage(e) ? 'Has a meaning and picture' : 'No picture'; };

  // One live region for the whole page, never rebuilt by a redraw: what an add did is said here once.
  main.innerHTML = wrap(editing ? 'Change your chapter' : 'Make your own chapter', 'Type up to ' + Ow.MAX_WORDS + ' words. Your children find it under "From your grown-up".',
    '<div class="sr" role="status" aria-live="polite" data-live></div><div data-edit-body></div>', ' data-own-edit');
  const live = main.querySelector('[data-live]');
  const body = main.querySelector('[data-edit-body]');
  const say = (t) => { live.textContent = ''; if (t) setTimeout(() => { live.textContent = t; }, 30); };

  function draw() {
    const rows = words.map((w) => '<li class="gu-ownword" data-word="' + esc(w) + '"><span class="gu-ownword__w">' + esc(w) + '</span><span class="gu-ownword__s">' + status(w) + '</span>'
      + '<button type="button" class="btn btn--ghost gu-ownword__x" data-remove="' + esc(w) + '" aria-label="Remove \'' + esc(w) + '\'">Remove</button></li>').join('')
      + refused.map((w) => '<li class="gu-ownword is-refused" data-refused="' + esc(w) + '"><span class="gu-ownword__w">' + esc(w) + '</span><span class="gu-ownword__s">' + esc(D.OWN_REFUSED) + '</span>'
        + '<button type="button" class="btn btn--ghost gu-ownword__x" data-remove-refused="' + esc(w) + '" aria-label="Remove \'' + esc(w) + '\'">Remove</button></li>').join('')
      + repeats.map((w) => '<li class="gu-ownword is-note" data-repeat="' + esc(w) + '"><span class="gu-ownword__w">' + esc(w) + '</span><span class="gu-ownword__s">' + esc(D.OWN_REPEAT) + '</span></li>').join('');
    const share = kids.length
      ? '<fieldset class="gu-share"><legend>Share with</legend><p class="muted">Children on your account.</p>' + kids.map((k) => '<label class="gu-check"><input type="checkbox" value="' + esc(k.id) + '"' + (to.includes(k.id) ? ' checked' : '') + ' data-share><span>' + esc(k.nickname) + '</span></label>').join('') + '</fieldset>'
      : '<p class="muted">Add a child to your Waystead account to share a chapter.</p>';
    const startedHtml = started.length ? '<p class="gu-line" data-started>' + esc(D.startedLine(started)) + '</p>' : '';
    const late = saved ? saved.notSent.filter((id) => nameOf(id)) : []; // a child no longer on the account is not "not sent"
    const savedHtml = saved
      ? '<div class="gu-line" role="status" tabindex="-1" data-saved>' + esc(Sc.savedLineFor(saved.shared, saved.names, D.savedLine)) + '</div>'
        + (saved.offline ? '<p class="gu-line gu-line--warn" data-saved-offline>' + esc(D.OWN_SAVED_OFFLINE) + '</p>' : '')
        + late.map((id) => '<p class="gu-line gu-line--warn" data-notsent>' + esc(D.notSentLine(nameOf(id))) + '<button type="button" class="btn btn--ghost" data-resend>Try again</button></p>').join('')
        + '<div class="btnrow"><button type="button" class="btn btn--ghost" data-use>Use for this week</button><a class="btn btn--ghost" href="' + LIST + '" data-back-list>Back to your chapters</a></div>' : '';
    body.innerHTML = '<div class="gu-own" data-own-editor><section class="card gu-panel"><div class="gu-field"><label for="own-name">Name of the chapter</label><input id="own-name" class="field" maxlength="' + Ow.MAX_NAME + '" value="' + esc(name) + '" data-name></div>'
      + '<form class="gu-field" data-typeform><label for="own-add">Add words</label><div class="gu-typeform"><input id="own-add" class="field" autocomplete="off" autocapitalize="off" spellcheck="false" value="' + esc(typed) + '"' + (full() ? ' disabled' : '') + ' data-typed>'
      + '<button type="submit" class="btn btn--primary" data-add' + (full() ? ' disabled' : '') + '>Add</button></div><span class="small muted">Press Enter to add. Paste a list, then press Add to add them all.</span></form>'
      + (scanOn ? '<p class="gu-ownlink" data-scan-link><a href="#/grownups/scan" class="s-link">Scan a paper instead</a></p>' : '')
      + '<div class="gu-panel__head"><p data-count tabindex="-1">' + esc(D.countLine(words.length)) + '</p></div>'
      + (full() ? '<p class="gu-line gu-line--warn" data-full>' + esc(D.OWN_FULL + (dropped.length ? ' Not added, no room: ' + dropped.join(', ') + '.' : '')) + '</p>' : '')
      + (note ? '<p class="gu-line gu-line--warn" data-note>' + esc(note) + '</p>' : '')
      + (rows ? '<ul class="gu-ownwords" data-ownwords>' + rows + '</ul>' : '<p class="muted">No words yet.</p>') + '</section>'
      + '<div class="stack"><section class="card gu-panel">' + share + startedHtml + '</section>'
      + '<section class="card gu-panel"><button type="button" class="btn btn--primary" data-save' + (busy ? ' disabled' : '') + '>Save chapter</button>'
      + (saved ? '' : '<button type="button" class="btn btn--ghost" data-use-top' + (words.length ? '' : ' disabled') + '>Use for this week</button>')
      + (oid ? '<button type="button" class="linkbtn" data-delete>Delete chapter</button>' : '') + (message ? '<p class="gu-error" role="alert" data-error>' + esc(message) + '</p>' : '') + savedHtml + '</section></div></div>';
    wire();
  }
  const q = (s) => body.querySelector(s);
  const focus = (el) => { if (el) el.focus({ preventScroll: false }); };
  const kidsFor = () => to.map((id) => kids.find((k) => k.id === id)).filter(Boolean);
  function wire() {
    q('[data-name]').addEventListener('input', (e) => { name = e.target.value; });
    const box = q('[data-typed]');
    box.addEventListener('input', (e) => { typed = e.target.value; });
    // A one-line box drops line breaks and tabs on paste, which would join the words: they become ", " instead.
    box.addEventListener('paste', (e) => {
      const t = e.clipboardData ? e.clipboardData.getData('text') : '';
      if (!D.needsPaste(t)) return;
      e.preventDefault();
      const ins = D.pasteText(t);
      const a = box.selectionStart == null ? box.value.length : box.selectionStart;
      const b = box.selectionEnd == null ? a : box.selectionEnd;
      box.value = box.value.slice(0, a) + (a > 0 && !/[,\s]$/.test(box.value.slice(0, a)) ? ', ' : '') + ins + box.value.slice(b);
      typed = box.value;
      box.setSelectionRange(box.value.length, box.value.length);
    });
    body.querySelectorAll('[data-share]').forEach((b) => b.addEventListener('change', () => { to = [...body.querySelectorAll('[data-share]')].filter((x) => x.checked).map((x) => x.value); }));
    q('[data-typeform]').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy || full()) return;
      const text = q('[data-typed]').value;
      if (!text.trim()) return;
      busy = true;
      const before = words.length;
      const r = await D.addTyped(text, words, (raw) => checkTyped(raw, findEntry));
      busy = false;
      if (isStopped()) return;
      words = r.list;
      refused = [...refused, ...r.refused.filter((w) => !refused.includes(w))];
      repeats = r.repeats;
      dropped = r.dropped;
      note = r.offline ? D.OWN_OFFLINE : '';
      typed = r.offline ? text : '';
      saved = null;
      draw();
      say(r.offline ? D.OWN_OFFLINE : D.addedLine(r, before));
      focus(full() ? q('[data-count]') : q('[data-typed]'));
    });
    body.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
      const at = words.indexOf(b.dataset.remove);
      words = words.filter((w) => w !== b.dataset.remove);
      repeats = [];
      dropped = [];
      note = '';
      saved = null;
      draw();
      say(b.dataset.remove + ' removed. ' + D.countLine(words.length) + '.');
      const next = body.querySelectorAll('[data-remove]');
      focus(next[Math.min(at, next.length - 1)] || q('[data-typed]'));
    }));
    body.querySelectorAll('[data-remove-refused]').forEach((b) => b.addEventListener('click', () => {
      const at = refused.indexOf(b.dataset.removeRefused);
      refused = refused.filter((w) => w !== b.dataset.removeRefused);
      draw();
      const next = body.querySelectorAll('[data-remove-refused]');
      focus(next[Math.min(at, next.length - 1)] || q('[data-typed]'));
    }));
    q('[data-save]').addEventListener('click', save);
    const use = (el) => el && el.addEventListener('click', () => useForWeek({ words, kids: kidsFor() }));
    use(q('[data-use-top]'));
    use(q('[data-use]'));
    const re = q('[data-resend]');
    if (re) re.addEventListener('click', save);
    const del = q('[data-delete]');
    if (del) del.addEventListener('click', remove);
  }
  async function save() {
    if (busy) return;
    busy = true;
    message = '';
    q('[data-save]').disabled = true;
    const r = await D.saveOwnChapter(childApi(), { oid: oid || undefined, name, words, src, to });
    busy = false;
    if (isStopped()) return;
    if (r.problem) { message = (r.problem === 'network' ? D.OWN_OFFLINE : P.PROBLEM_TEXT[r.problem] || P.PROBLEM_TEXT.other) + ' Nothing has been saved.'; saved = null; draw(); focus(q('[data-error]')); return; }
    if (r.error) { message = D.OWN_ERRORS[r.error] || P.PROBLEM_TEXT.other; saved = null; draw(); focus(q('[data-error]')); return; }
    oid = r.oid;
    editing = oid; // a second Save changes this chapter, never makes another
    refused = [];
    repeats = [];
    dropped = [];
    note = '';
    const late = r.notSent.filter(nameOf); // SB4-WP8: the saved line names only the children it reached
    saved = { names: kidsFor().filter((k) => !r.notSent.includes(k.id)).map((k) => k.nickname), notSent: r.notSent, shared: kidsFor().length, late: late.length, offline: navigator.onLine === false };
    draw();
    focus(q('[data-saved]'));
  }
  async function remove() {
    const e = Ow.normalise(W.ownOf(S.readWords()))[oid];
    const r = await ask({
      title: D.deleteTitle(e ? e.name : name),
      bodyHtml: '<p>' + esc(D.deleteBody(kidsFor().map((k) => k.nickname))) + '</p>',
      actions: [{ id: 'yes', label: 'Delete', cls: 'btn--destroy' }, { id: 'no', label: 'Keep it' }],
    });
    if (!r || r.id !== 'yes' || isStopped()) return;
    const d = await D.deleteOwnChapter(childApi(), oid);
    if (isStopped()) return;
    if (d.error || d.problem) { message = d.error ? D.OWN_ERRORS[d.error] : P.PROBLEM_TEXT[d.problem] || P.PROBLEM_TEXT.other; draw(); focus(q('[data-error]')); return; }
    undo = { oid, name: e ? e.name : name, until: Date.now() + 10000 };
    location.hash = LIST;
  }
  draw();
  settle(main);
  // SB4-WP8: words carried from "Type the words instead" on a scan screen, read once, a new chapter only, added as if pasted.
  if (hand) {
    busy = true;
    D.addTyped(hand.join(', '), words, (raw) => checkTyped(raw, findEntry)).then((r) => {
      busy = false;
      if (isStopped()) return;
      words = r.list;
      refused = r.refused;
      repeats = r.repeats;
      dropped = r.dropped;
      note = r.offline ? D.OWN_OFFLINE : '';
      draw();
      say(r.offline ? D.OWN_OFFLINE : D.addedLine(r, 0));
    });
  }
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
