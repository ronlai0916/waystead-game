// SB4-WP11: the teacher page. #/grownups/teach (the lists, and how each child spells) and #/grownups/teach/:oid (one list across the
// children it is shared with: how each did, the words to go over, set this week's test for several at once, print, copy).
// The rules and the wording are in teach-doc.js. Nothing is kept on this device: every child's data is read from the account when
// the page opens and stays in memory while it is on show. The only writes are "Set the test" (changeWords, one week for each
// ticked child) and "Try again" on a list that did not reach a child (the one save path, own-data.js).
import * as S from './store.js';
import * as W from './words-doc.js';
import * as Ow from './own-doc.js';
import * as D from './own-data.js';
import * as A from './grownups-data.js';
import * as P from './grownups-doc.js';
import * as AD from './assess-doc.js';
import * as T from './teach-doc.js';
import { adultOnly } from './grownups-views.js';
import { overviewLink } from './setup-views.js';
import { isOn } from './scan-doc.js';
import { allowance } from './scan-data.js';
import { recheckWho } from './who.js';
import { esc } from './ui.js';
import { accountOrigin } from './account/config.js';

const today = () => W.localDay(Date.now());
let api = null;
const childApi = () => { if (!api) api = A.createChildApi({ origin: accountOrigin(location) }); return api; };
const redraw = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
const HOME = '#/grownups/teach';
const childHref = (id) => '#/grownups/child/' + encodeURIComponent(id);
const svg = (inner) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + inner + '</svg>';
const I = {
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  cam: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  print: svg('<path d="M7 9V4h10v5M7 17H4v-7h16v7h-3"/><path d="M7 14h10v6H7z"/>'),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
};

const wrap = (body, attr = '') => '<section class="wrap page grownups gu"' + attr + '>' + body + '</section>';
const pagehead = (eyebrow, title, line) => '<div class="pagehead"><span class="eyebrow">' + esc(eyebrow) + '</span><h1>' + esc(title) + '</h1>' + (line ? '<p class="muted">' + esc(line) + '</p>' : '') + '</div>';

/** After the first draw of a page reached from a Menu row or a link, focus goes to the page's h1 (never stolen from something already focused). */
function settle(main) {
  const go = () => {
    const a = document.activeElement;
    if (a && a !== document.body && a !== main && main.contains(a)) return;
    const h = main.querySelector('h1');
    if (!h) return;
    h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
  };
  go();
  setTimeout(go, 0); // a page drawn at once is focused by the router afterwards: the h1 wins
}

/** A call that did not work, as a whole page: what happened and one next step. */
async function problemPage(main, problem) {
  if (problem === 'playing') { await recheckWho(); adultOnly(main); return; }
  if (problem === 'signed-out') recheckWho();
  const offline = problem === 'offline';
  main.innerHTML = wrap(pagehead('Grown-ups', T.TITLE, '') + '<div class="card gu-panel" data-teach-problem="' + esc(problem) + '"><p role="alert">' + esc(offline ? T.OFFLINE : P.PROBLEM_TEXT[problem] || P.PROBLEM_TEXT.other) + '</p>'
    + '<div class="btnrow"><button type="button" class="btn btn--primary" data-retry>Try again</button><a class="btn btn--ghost" href="#/grownups">Back to Grown-ups</a></div></div>', offline ? ' data-teach-offline' : '');
  const b = main.querySelector('[data-retry]');
  if (b) b.addEventListener('click', redraw);
  settle(main);
}

/** Every child's data at once (at most five): [{ kid, data } | { kid, problem }]. */
const readAll = (kids) => Promise.all(kids.map(async (kid) => {
  const r = await A.readChild(childApi(), kid.id);
  return r.problem ? { kid, problem: r.problem } : { kid, data: r };
}));

/* ------------------------------------------------------------------ a small dialog --- */
/** Focus kept inside, Escape = the safe answer (null), focus back to the opener. actions: [{ id, label, cls }]. */
function ask({ title, bodyHtml, actions, init, read, describedby }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'gu-overlay';
    overlay.innerHTML = '<div class="gu-dialog" role="dialog" aria-modal="true" aria-labelledby="teach-dt"' + (describedby ? ' aria-describedby="' + describedby + '"' : '') + ' data-dialog><h2 id="teach-dt">' + esc(title) + '</h2>' + bodyHtml
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
    (root.querySelector('input:not(:disabled)') || root.querySelector('[data-act]')).focus();
  });
}

/* ------------------------------------------------------------------ the teacher home --- */
const yearOf = (k) => (k.year ? 'Year ' + k.year : '');
const levelOf = (setup, k) => { const c = P.spellCard(setup, k.year, k.nickname); return { letters: AD.LEVEL_NAME[c.lv], help: AD.PROFILE_NAME[c.pf] }; };

const stepsHtml = ({ scan, anyList }) => '<section class="card gu-panel" aria-label="Three steps"><ol class="t-steps">'
  + '<li><span class="t-num" aria-hidden="true">1</span><b>' + esc(T.STEPS[0].title) + '</b><div class="gu-actions">'
  + (scan ? '<a class="btn ' + (anyList ? 'btn--ghost' : 'btn--primary') + '" href="#/grownups/scan" data-scan-link>' + I.cam + 'Scan a paper</a>' : '')
  + '<a class="btn ' + (scan || anyList ? 'btn--ghost' : 'btn--primary') + '" href="#/grownups/own/new" data-type-link>Type a list</a></div></li>'
  + T.STEPS.slice(1).map((s) => '<li><span class="t-num" aria-hidden="true">' + s.n + '</span><b>' + esc(s.title) + '</b><p>' + esc(s.text) + '</p></li>').join('') + '</ol></section>';

export function home(main) {
  if (!adultOnly(main)) return undefined;
  if (navigator.onLine === false) { problemPage(main, 'offline'); return undefined; }
  let stopped = false;
  main.innerHTML = wrap(pagehead('Grown-ups', T.TITLE, T.LEDE) + '<p class="muted">Finding your lists…</p>', ' data-teach-home');
  (async () => {
    const lc = await A.listChildren(childApi());
    if (stopped) return;
    if (lc.problem) { problemPage(main, lc.problem); return; }
    const kids = lc.children.slice(0, Ow.MAX_TO);
    const head = pagehead('Grown-ups', T.TITLE, T.LEDE) + '<div class="t-limits"><p>' + esc(T.SCOPE_LINE) + '</p><p>' + esc(T.PERMISSION_LINE) + '</p></div>';
    if (!kids.length) {
      const href = P.accountHomeHref(accountOrigin(location));
      main.innerHTML = wrap(head + '<section class="card gu-panel" data-first><h2>Add your first child</h2><p class="muted">Spellbright plans a spelling week for each child. Start by adding a child to your Waystead account.</p>'
        + '<div class="gu-actions"><a class="btn btn--primary" href="' + esc(href) + '" data-addchild>Add a child' + I.plus + '</a></div></section>', ' data-teach-home');
      settle(main);
      return;
    }
    const [reads, al] = await Promise.all([readAll(kids), allowance(accountOrigin(location)).then(isOn, () => false)]);
    if (stopped) return;
    const day = today();
    const own = Ow.normalise(W.ownOf(S.readWords()));
    const byId = Object.fromEntries(reads.map((r) => [r.kid.id, r]));
    const resultOf = (oid, cid) => {
      const r = byId[cid];
      return r && r.data ? T.childResult({ oid, master: own[oid], d: r.data.words, progress: r.data.progress, setup: r.data.setup, today: day, childId: cid }) : null;
    };
    const lists = T.listSummary(own, resultOf, kids.map((k) => k.id));
    const nameOf = Object.fromEntries(kids.map((k) => [k.id, k.nickname]));
    const cards = lists.map((x, i) => {
      const shared = x.to.length > 0;
      return '<article class="card gu-panel gu-ownchap" data-own="' + esc(x.id) + '"><div class="gu-panel__head"><h2>' + esc(x.name) + '</h2><span class="gu-count">' + esc(T.wordsLine(x.n)) + '</span></div>'
        + '<p class="muted" data-shared>' + esc(T.sharedLine(x.to.map((id) => nameOf[id]))) + '</p>'
        + (shared && x.read ? '<p class="t-summary" data-summary>' + esc(T.summaryLine(x.counts)) + '</p>' : '')
        + '<div class="gu-actions">' + (shared
          ? '<a class="btn ' + (i === 0 ? 'btn--primary' : 'btn--ghost') + '" href="' + HOME + '/' + encodeURIComponent(x.id) + '" data-see-results aria-label="' + esc("See results for '" + x.name + "'") + '">See results</a>'
          : '<a class="btn btn--ghost" href="#/grownups/own/' + encodeURIComponent(x.id) + '" data-share-it aria-label="' + esc("Share '" + x.name + "'") + '">Share it</a>') + '</div></article>';
    }).join('');
    const help = reads.map(({ kid, data, problem }) => {
      if (problem) return '<tr data-child="' + esc(kid.id) + '" data-problem="' + esc(problem) + '"><th scope="row"><a href="' + childHref(kid.id) + '">' + esc(kid.nickname) + '</a></th><td colspan="4">' + esc(P.PROBLEM_TEXT[problem] || P.PROBLEM_TEXT.other) + ' <button type="button" class="btn btn--ghost" data-retry>Try again</button></td></tr>';
      const l = levelOf(data.setup, kid);
      return '<tr data-child="' + esc(kid.id) + '"><th scope="row"><a href="' + childHref(kid.id) + '" aria-label="' + esc(T.seeChildLine(kid.nickname)) + '">' + esc(kid.nickname) + '</a></th><td data-label="Year">' + esc(yearOf(kid)) + '</td>'
        + '<td data-label="Letters or keyboard">' + esc(l.letters) + '</td><td data-label="Help in tests">' + esc(l.help) + '</td>'
        + '<td><a class="btn btn--ghost" href="' + childHref(kid.id) + '/spelling" aria-label="' + esc(T.changeSpellLabel(kid.nickname)) + '">Change</a></td></tr>';
    }).join('');
    main.innerHTML = wrap(head + stepsHtml({ scan: al, anyList: lists.length > 0 })
      + '<h2 class="t-sec">' + esc(T.HEADINGS.lists) + '</h2>' + (lists.length ? '<div class="gu-ownlist" data-lists>' + cards + '</div>' : '<p class="muted" data-none>' + esc(T.NO_LISTS) + '</p>')
      + '<h2 class="t-sec">' + esc(T.HEADINGS.help) + '</h2><section class="card gu-panel"><table class="gu-table t-table" data-help-table><caption>' + esc(T.HELP_CAPTION) + '</caption><thead><tr><th scope="col">Child</th><th scope="col">Year</th><th scope="col">Letters or keyboard</th><th scope="col">Help in tests</th><th scope="col">Change</th></tr></thead><tbody>' + help + '</tbody></table></section>'
      + overviewLink(kids.length), ' data-teach-home');
    main.querySelectorAll('[data-retry]').forEach((b) => b.addEventListener('click', redraw));
    settle(main);
  })();
  return () => { stopped = true; };
}

/* ------------------------------------------------------------------ one list across its children --- */
export function chapter(main, { oid: given }) {
  if (!adultOnly(main)) return undefined;
  if (navigator.onLine === false) { problemPage(main, 'offline'); return undefined; }
  const oid = D.safeDecode(given || '');
  let stopped = false;
  let cleanup = () => {};
  main.innerHTML = wrap(pagehead('List', T.TITLE, '') + '<p class="muted">Finding the results…</p>', ' data-teach-chapter');
  (async () => {
    const masterOf = () => (D.validOid(oid) ? Ow.normalise(W.ownOf(S.readWords()))[oid] : null);
    if (!masterOf() || masterOf().gone) {
      main.innerHTML = wrap(pagehead('Grown-ups', T.TITLE, '') + '<section class="card t-empty" data-gone><p>' + esc(T.GONE) + '</p><div class="gu-actions"><a class="btn btn--primary" href="' + HOME + '">Back to For teachers</a></div></section>', ' data-teach-empty');
      settle(main);
      return;
    }
    const lc = await A.listChildren(childApi());
    if (stopped) return;
    if (lc.problem) { problemPage(main, lc.problem); return; }
    const kids = lc.children.slice(0, Ow.MAX_TO);
    let master = masterOf();
    const sharedKids = () => kids.filter((k) => master.to.includes(k.id));
    const head = (extra = '') => '<a class="gu-back" href="' + HOME + '">' + I.back + 'For teachers</a>'
      + '<div class="pagehead"><span class="eyebrow">List</span><h1>' + esc(master.name) + '</h1>'
      + '<p class="muted" data-headline>' + esc(T.headLine(master.words.length, sharedKids().map((k) => k.nickname))) + '</p><p class="muted t-printone" data-printone></p>'
      + '<p class="t-link-row"><a class="t-link" href="#/grownups/own/' + encodeURIComponent(oid) + '" data-change-list>Change the list or who has it</a></p></div>' + extra;
    if (!sharedKids().length) {
      main.innerHTML = wrap(head() + '<section class="card t-empty" data-shared-none><p><b>Not shared yet.</b></p><p>Share this list with up to 5 children to see how they get on.</p><div class="gu-actions"><a class="btn btn--primary" href="#/grownups/own/' + encodeURIComponent(oid) + '">Share it</a></div></section>', ' data-teach-chapter');
      settle(main);
      return;
    }
    let reads = await readAll(sharedKids());
    if (stopped) return;
    const day = today();
    const resultFor = (r) => (r.data ? T.childResult({ oid, master, d: r.data.words, progress: r.data.progress, setup: r.data.setup, today: day, childId: r.kid.id }) : null);
    let results = reads.map((r) => ({ ...r, result: resultFor(r) }));
    const shown = () => results.filter((r) => !r.problem);

    if (results.every((r) => r.result && r.result.has === 'behind')) {
      main.innerHTML = wrap(head() + '<section class="card t-empty" data-nochild><p><b>No child has this list yet.</b></p><p>' + esc(T.notReachedLine(results.map((r) => r.kid.nickname))) + '</p><div class="gu-actions"><button type="button" class="btn btn--primary" data-resend-all>Try again</button></div></section>', ' data-teach-chapter');
      main.querySelector('[data-resend-all]').addEventListener('click', async (e) => {
        e.currentTarget.disabled = true;
        await D.saveOwnChapter(childApi(), { oid, name: master.name, words: master.words, src: master.src, to: master.to });
        if (!stopped) redraw();
      });
      settle(main);
      return;
    }

    // ---- part A: each child
    const hasCell = (r) => (r.result.has === 'sent' ? 'Yes' : '<span class="t-line">' + esc(T.notSentLine(r.kid.nickname)) + '</span><button type="button" class="btn btn--ghost" data-resend="' + esc(r.kid.id) + '">Try again</button>');
    const row = (r) => {
      const k = r.kid;
      const who = '<th scope="row" tabindex="-1"><span class="t-who"><b>' + esc(k.nickname) + '</b><span class="t-sub">' + esc(yearOf(k)) + '</span></span><a class="t-link" href="' + childHref(k.id) + '" aria-label="' + esc(T.seeChildLine(k.nickname)) + '">' + esc(T.seeChildLine(k.nickname)) + '</a></th>';
      if (r.problem) return '<tr data-cid="' + esc(k.id) + '" data-problem="' + esc(r.problem) + '">' + who + '<td colspan="6">' + esc(P.PROBLEM_TEXT[r.problem] || P.PROBLEM_TEXT.other) + ' <button type="button" class="btn btn--ghost" data-retry-child>Try again</button></td></tr>';
      const x = r.result;
      return '<tr data-cid="' + esc(k.id) + '">' + who
        + '<td data-label="Has the list" data-has="' + x.has + '">' + hasCell(r) + '</td>'
        + '<td data-label="Stage"><span class="t-line"><b>' + esc(x.stage.label) + '</b></span><span class="t-sub">Learned the words: ' + (x.studied ? 'Yes' : 'Not yet') + '</span><span class="t-sub">Practised: ' + (x.practised ? 'Yes' : 'Not yet') + '</span></td>'
        + '<td data-label="Chapter test">' + (x.test ? '<span class="t-line">' + esc(x.test.line) + '</span>' + (x.test.passed ? '<span class="gu-tag gu-tag--pass">Passed</span> ' : '') + '<span class="t-sub">' + esc(T.attemptsLine(x.test.attempts)) + '</span>' : esc(T.NO_TEST)) + '</td>'
        + '<td data-label="Newest quiz">' + (x.quiz ? '<span class="t-line">' + esc(x.quiz) + '</span>' : esc(T.NO_QUIZ)) + '</td>'
        + '<td data-label="This week\'s test">' + (x.week ? esc(x.week.line) : esc(T.NO_WEEK)) + '</td>'
        + '<td data-label="Words to practise">' + (x.toPractise.length ? x.toPractise.map((w) => '<span class="gu-hw">' + esc(w) + '</span>').join('<span class="sr">, </span>') : esc(T.NONE_NOTED)) + '</td></tr>';
    };
    const partA = () => '<h2 class="t-sec">' + esc(T.HEADINGS.each) + '</h2><section class="card gu-panel"><table class="gu-table t-table t-wide" data-each-table><caption class="sr">One row for each child who has this list, in the order on your account.</caption>'
      + '<thead><tr><th scope="col">Child</th><th scope="col">Has the list</th><th scope="col">Stage</th><th scope="col">Chapter test</th><th scope="col">Newest quiz</th><th scope="col">This week\'s test</th><th scope="col">Words to practise</th></tr></thead><tbody>'
      + results.map(row).join('') + '</tbody></table><p class="t-key">' + esc(T.KEY_LINE) + '</p></section>';
    // ---- part B: the words
    const partB = () => {
      const rows = T.wordRows(master.words, shown().map((r) => ({ name: r.kid.nickname, toPractise: r.result.toPractise })));
      return '<h2 class="t-sec">' + esc(T.HEADINGS.words) + '</h2><section class="card gu-panel"><p class="t-cap">' + esc(T.WORDS_CAPTION) + '</p><ul class="t-wordlist">'
        + rows.map((w) => '<li class="t-wordrow' + (w.names.length ? ' is-flag' : '') + '" data-word-row><span class="t-word">' + esc(w.word) + '</span><span>' + esc(T.wordRowLine(w.names)) + '</span></li>').join('') + '</ul></section>';
    };
    // ---- part C: set this week's test
    const many = master.words.length > W.MAX_WORDS;
    const tomorrow = W.addDays(day, 1);
    const kidLines = () => sharedKids().map((k) => {
      const r = results.find((x) => x.kid.id === k.id);
      const running = r && r.data ? T.runningWeek(r.data.words, master.words) : null;
      const line = T.runningLine(k.nickname, running);
      return '<label class="gu-check"><input type="checkbox" value="' + esc(k.id) + '" data-kid' + (T.startsTicked(running) ? ' checked' : '') + (line ? ' aria-describedby="t-run-' + esc(k.id) + '"' : '') + '><b>' + esc(k.nickname) + '</b></label>'
        + (line ? '<p class="t-warn" id="t-run-' + esc(k.id) + '" data-running>' + esc(line) + '</p>' : '');
    }).join('');
    const setCard = '<section class="card gu-panel t-set" aria-labelledby="t-set-h" data-set><h2 id="t-set-h">' + esc(T.HEADINGS.set) + '</h2><p class="muted">' + esc(T.SET_LINE) + '</p>'
      + (many ? '<fieldset class="gu-share"><legend>' + esc(T.PICK_LEGEND) + '</legend><p class="muted" role="status" aria-live="polite" id="t-pickline" data-pickline></p><ul class="t-pickgrid">'
        + master.words.map((w, i) => '<li><label class="gu-check"><input type="checkbox" value="' + esc(w) + '" data-pickword aria-describedby="t-pickline"' + (i < W.MAX_WORDS ? ' checked' : '') + '><span class="t-word t-word--small">' + esc(w) + '</span></label></li>').join('') + '</ul></fieldset>' : '')
      + '<div class="gu-field"><label for="t-date">Test date</label><input id="t-date" class="field" type="date" value="' + esc(W.defaultTest(day)) + '" min="' + esc(tomorrow) + '" data-date></div>'
      + '<p class="gu-line gu-line--warn" role="status" data-short hidden>' + esc(P.SHORT_WEEK_LINE) + '</p>'
      + '<div class="gu-field"><label for="t-name">Name of the week</label><input id="t-name" class="field" maxlength="' + W.MAX_NAME + '" value="' + esc(master.name.slice(0, W.MAX_NAME)) + '" data-weekname></div>'
      + '<fieldset class="gu-share" data-kids><legend>Children</legend>' + kidLines() + '</fieldset>'
      + '<p class="muted">' + esc(T.TRICKY_LINE) + '</p>'
      + '<p class="t-fine" id="t-why" data-why hidden></p>'
      + '<button type="button" class="btn btn--primary t-setbtn" data-set-go aria-describedby="t-why"></button>'
      + '<p class="gu-error" role="alert" tabindex="-1" data-set-error></p>'
      + '<div class="t-results" role="status" tabindex="-1" data-set-results hidden></div></section>';
    const share = '<h2 class="t-sec t-noprint">' + esc(T.HEADINGS.share) + '</h2><section class="card gu-panel t-noprint" aria-label="' + esc(T.HEADINGS.share) + '"><div class="t-actions">'
      + '<button type="button" class="btn btn--ghost" data-print-all>' + I.print + 'Print this page</button>'
      + '<button type="button" class="btn btn--ghost" data-print-one aria-haspopup="dialog">' + I.print + 'Print for one child</button>'
      + '<button type="button" class="btn btn--ghost" data-copy-all>' + I.copy + 'Copy as text</button></div>'
      + '<p class="t-fine" role="status" data-copied></p><p class="t-fine">' + esc(T.KEEP_SAFE) + '</p></section>';

    main.innerHTML = wrap('<p class="t-printdate">' + esc(T.printedLine(day)) + '</p>' + head()
      + '<div data-part="each">' + partA() + '</div><div class="t-two"><div data-part="words">' + partB() + '</div>' + setCard + '</div>' + share + '<p class="t-printkeep">' + esc(T.KEEP_SAFE) + '</p>', ' data-teach-chapter');
    const page = main.querySelector('.gu');
    const q = (s) => main.querySelector(s);
    const qa = (s) => [...main.querySelectorAll(s)];
    const partsRedraw = () => {
      q('[data-part="each"]').innerHTML = partA();
      q('[data-part="words"]').innerHTML = partB();
      wireTable();
    };

    // Try again on a list that did not reach a child, and on a child whose data could not be read.
    function wireTable() {
      const back = (cid) => { const th = q('tr[data-cid="' + cid + '"] th'); if (th) th.focus({ preventScroll: true }); }; // the redraw took the button: focus its row
      qa('[data-resend]').forEach((b) => b.addEventListener('click', async () => {
        const cid = b.dataset.resend;
        b.disabled = true;
        await D.saveOwnChapter(childApi(), { oid, name: master.name, words: master.words, src: master.src, to: master.to });
        if (stopped) return;
        master = masterOf() || master;
        await refresh();
        back(cid);
      }));
      qa('[data-retry-child]').forEach((b) => b.addEventListener('click', async () => {
        const cid = b.closest('tr').dataset.cid;
        b.disabled = true;
        await refresh();
        back(cid);
      }));
    }
    async function refresh({ children = false } = {}) {
      reads = await readAll(sharedKids());
      if (stopped) return;
      results = reads.map((r) => ({ ...r, result: resultFor(r) }));
      partsRedraw();
      if (children) { q('[data-kids]').innerHTML = '<legend>Children</legend>' + kidLines(); sync(); } // who has a week from this list now: unticked, with the line
    }
    wireTable();

    // ---- the Set this week's test card
    const gids = {}; // one week id for each child for the whole visit: a Try again, or a second press of Set, never makes a second week
    let plan = null;
    let didSet = false; // a Set worked in this visit
    const setNames = []; // who was set in this visit, in order
    const noteSet = (cid) => {
      const nm = (kids.find((k) => k.id === cid) || {}).nickname;
      if (nm && !setNames.includes(nm)) setNames.push(nm);
      didSet = true;
      const old = results$.querySelector('[data-set-summary]');
      if (old) old.remove();
      results$.insertAdjacentHTML('afterbegin', '<p class="t-result" role="status" data-set-summary data-ok>' + esc(T.weekSetFor(setNames)) + '</p>');
    };
    const pickedWords = () => (many ? qa('[data-pickword]:checked').map((b) => b.value) : master.words.slice(0, W.MAX_WORDS));
    const ticked = () => qa('[data-kid]:checked').map((b) => b.value);
    const sync = () => {
      const words = pickedWords();
      if (many) {
        qa('[data-pickword]').forEach((b) => { b.disabled = !b.checked && words.length >= W.MAX_WORDS; });
        q('[data-pickline]').textContent = T.pickLine(words.length);
      }
      const n = ticked().length;
      const btn = q('[data-set-go]');
      const why = q('[data-why]');
      const settled = n === 0 && didSet && qa('[data-kid]').every((b) => b.hasAttribute('aria-describedby')); // everyone who was ticked now has a week from this list: say so, not 0 children
      btn.textContent = settled ? T.SET_BUTTON_PLAIN : T.setButton(n);
      const reason = settled ? T.ALL_HAVE_WEEK : n === 0 ? T.TICK_ONE_CHILD : words.length === 0 ? T.TICK_ONE_WORD : '';
      btn.disabled = !!reason;
      why.hidden = !reason;
      why.textContent = reason;
      q('[data-short]').hidden = !T.isShort(day, q('[data-date]').value);
    };
    ['change', 'input'].forEach((ev) => q('[data-set]').addEventListener(ev, sync));
    sync();

    const results$ = q('[data-set-results]');
    const lineFor = (cid, r) => {
      const name = (kids.find((k) => k.id === cid) || {}).nickname || '';
      return '<p class="t-result" data-set-result="' + esc(cid) + '"' + (r.ok ? ' data-ok' : '') + '>' + esc(r.ok ? T.setDone(name) : T.setFailed(name) + (r.error ? ' ' + r.error : '')) + (r.ok || r.error ? '' : '<button type="button" class="btn btn--ghost" data-set-retry="' + esc(cid) + '">Try again</button>') + '</p>';
    };
    const setOne = async (cid) => {
      if (!gids[cid]) gids[cid] = S.newId();
      const r = await A.changeWords(childApi(), cid, (d) => P.createPlan(d, { name: plan.name, test: plan.test, words: plan.words }, { id: gids[cid], today: plan.today, now: Date.now() }));
      return r.ok ? { ok: true } : r.error ? { error: r.error } : { problem: r.problem };
    };
    const showResult = (cid, r) => {
      let p = results$.querySelector('[data-set-result="' + cid + '"]');
      if (!p) { results$.insertAdjacentHTML('beforeend', lineFor(cid, r)); p = results$.querySelector('[data-set-result="' + cid + '"]'); } else p.outerHTML = lineFor(cid, r);
      const b = results$.querySelector('[data-set-retry="' + cid + '"]');
      if (b) b.addEventListener('click', async () => {
        b.disabled = true;
        const again = await setOne(cid);
        if (stopped) return;
        showResult(cid, again);
        if (again.ok) noteSet(cid);
        results$.focus();
        await refresh({ children: true });
      });
    };
    q('[data-set-go]').addEventListener('click', async () => {
      const err = q('[data-set-error]');
      err.textContent = '';
      const name = q('[data-weekname]').value.trim() || master.name;
      const words = pickedWords();
      const test = q('[data-date]').value;
      const problem = T.planProblem({ words, test, name, today: day });
      if (problem) { err.textContent = problem; err.focus(); return; }
      plan = { name, test, words, today: day };
      const ids = ticked();
      const btn = q('[data-set-go]');
      btn.disabled = true;
      results$.hidden = false;
      results$.innerHTML = '';
      const out = await Promise.all(ids.map((cid) => setOne(cid)));
      if (stopped) return;
      ids.forEach((cid, i) => showResult(cid, out[i]));
      ids.forEach((cid, i) => { if (out[i].ok) noteSet(cid); });
      btn.disabled = false;
      sync();
      results$.focus();
      await refresh({ children: true }); // parts A and B and the Children boxes again, from fresh reads; focus stays on the results
    });

    // ---- print and copy
    const rowsFor = () => results.map((r) => ({ cid: r.kid.id, name: r.kid.nickname, year: r.kid.year, result: r.result, problem: r.problem }));
    const textFor = (only) => T.reportText({ listName: master.name, day, rows: rowsFor(), words: master.words, only });
    const said = q('[data-copied]');
    const copy = async (only) => {
      let done = false;
      try { await navigator.clipboard.writeText(textFor(only)); done = true; } catch (e) { done = false; }
      said.textContent = '';
      setTimeout(() => { if (!stopped) said.textContent = done ? T.COPIED : T.COPY_FAILED; }, 30);
    };
    const clearOne = () => {
      page.removeAttribute('data-print-only');
      qa('[data-print-skip]').forEach((e) => e.removeAttribute('data-print-skip'));
    };
    // Print for one child: every other child's row, the word rows and the line naming the children are skipped, and a line with this child only takes their place.
    const printOne = (cid) => {
      const k = kids.find((x) => x.id === cid);
      if (!k) return;
      clearOne();
      page.setAttribute('data-print-only', cid);
      qa('[data-cid]').forEach((tr) => { if (tr.dataset.cid !== cid) tr.setAttribute('data-print-skip', ''); });
      q('[data-part="words"]').setAttribute('data-print-skip', '');
      q('[data-headline]').setAttribute('data-print-skip', '');
      q('[data-printone]').textContent = T.printOneLine(master.words.length, k.nickname);
      window.print();
    };
    const onAfter = () => clearOne();
    window.addEventListener('afterprint', onAfter);
    const mq = typeof matchMedia === 'function' ? matchMedia('print') : null;
    const onMq = (e) => { if (!e.matches) clearOne(); }; // a browser that never says afterprint
    if (mq && mq.addEventListener) mq.addEventListener('change', onMq);
    cleanup = () => {
      window.removeEventListener('afterprint', onAfter);
      if (mq && mq.removeEventListener) mq.removeEventListener('change', onMq);
      clearOne();
    };
    q('[data-print-all]').addEventListener('click', () => { clearOne(); window.print(); });
    q('[data-copy-all]').addEventListener('click', () => copy(''));
    q('[data-print-one]').addEventListener('click', async () => {
      const list = sharedKids();
      const r = await ask({
        title: 'Print for one child',
        describedby: 't-onedesc',
        bodyHtml: '<fieldset class="gu-who"><legend class="sr">Which child</legend>' + list.map((k, i) => '<label class="gu-radio"><input type="radio" name="t-kid" value="' + esc(k.id) + '"' + (i === 0 ? ' checked' : '') + ' data-name="' + esc(k.nickname) + '"><span class="gu-radio__text"><b>' + esc(k.nickname) + '</b></span></label>').join('') + '</fieldset>'
          + '<p id="t-onedesc" data-onedesc>' + esc(T.onePrintLine(list[0].nickname)) + '</p>',
        actions: [{ id: 'print', label: 'Print', cls: 'btn--primary' }, { id: 'copy', label: 'Copy as text' }, { id: 'no', label: 'Cancel' }],
        init: (root) => root.addEventListener('change', () => { root.querySelector('[data-onedesc]').textContent = T.onePrintLine(root.querySelector('input[name="t-kid"]:checked').dataset.name); }),
        read: (root) => root.querySelector('input[name="t-kid"]:checked').value,
      });
      if (!r || stopped) return;
      if (r.id === 'print') printOne(r.value);
      else if (r.id === 'copy') copy(r.value);
    });
    settle(main);
  })();
  return () => { stopped = true; cleanup(); };
}
