// SB5 (WP-E, TR-45): the results of one Word list, at #/grownups/own/:oid/results. It replaces teach-views.js: the old teacher page minus
// the Set form (a week is set from "Set a week", set-views.js). A parent or tutor sees each child's score and the words to practise again;
// a teacher opens on the class table with the "Needs help" column and "Print for the class" first. Tab 2 is the words view: which words to
// go over together. Nothing is kept on this device: every child's data is read from the account when the page opens and stays in
// memory while it is on show. The only write is "Try again" on a list that did not reach a child (the one save path, own-data.js).
// The rules and wording are in teach-doc.js (kept), role-doc.js and lists-doc.js.
import * as S from './store.js';
import * as W from './words-doc.js';
import * as Ow from './own-doc.js';
import * as D from './own-data.js';
import * as A from './grownups-data.js';
import * as P from './grownups-doc.js';
import * as T from './teach-doc.js';
import * as RD from './role-doc.js';
import * as ST from './set-data.js';
import * as L from './lists-doc.js';
import { adultOnly } from './grownups-views.js';
import { ask, settle, roleHere } from './own-views.js';
import { esc } from './ui.js';
import { recheckWho } from './who.js';
import { accountOrigin } from './account/config.js';

const today = () => W.localDay(Date.now());
let api = null;
const childApi = () => { if (!api) api = A.createChildApi({ origin: accountOrigin(location) }); return api; };
const redraw = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
const LIST = '#/grownups/own';
const enc = encodeURIComponent;
const svg = (inner) => '<svg viewBox="0 0 24 24" aria-hidden="true">' + inner + '</svg>';
const I = {
  back: svg('<path d="M15 18l-6-6 6-6"/>'),
  print: svg('<path d="M7 9V4h10v5M7 17H4v-7h16v7h-3"/><path d="M7 14h10v6H7z"/>'),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>'),
};
const wrap = (body, attr = '') => '<section class="wrap page grownups gu ls"' + attr + '>' + body + '</section>';
const back = '<a class="gu-back" href="' + LIST + '" data-back-list>' + I.back + 'Word lists</a>';
const joinNames = (names) => T.joinNames(names);

/** The words under a word on the words tab: who needs help with it. */
export const helpLine = (names) => (names.length ? joinNames(names) + (names.length === 1 ? ' needs help' : ' need help') : 'Nobody');
/** "8 of 10" for a child's finished test in a week, else the dash. */
export function scoreOf(d, g) {
  if (!d || !g || !W.testDone(d, g)) return L.NO_HELP;
  const rs = W.testResults(d, g);
  return rs.length ? rs.filter((x) => x.result && x.result.right).length + ' of ' + rs.length : L.NO_HELP;
}
/** One child's "Given to" line: the week, the stage, the test and the newest quiz. */
export function givenLine(x) {
  if (x.has !== 'sent') return '';
  const bits = [x.week ? 'Week of ' + W.dayLabel(x.week.test).replace(/^\w+ /, '') + ' · ' + x.week.line : 'Practice only', x.stage.label];
  if (x.test) bits.push(x.test.line);
  if (x.quiz) bits.push('newest quiz ' + x.quiz);
  return bits.join(' · ');
}

async function problemPage(main, problem) {
  const offline = problem === 'offline';
  if (problem === 'signed-out' || problem === 'playing') recheckWho(); // S3-D13: the session may have changed in another tab
  main.innerHTML = wrap('<div class="pagehead"><span class="eyebrow">Grown-ups</span><h1>Results</h1></div><div class="card gu-panel" data-teach-problem="' + esc(problem) + '"><p>' + esc(offline ? T.OFFLINE : P.PROBLEM_TEXT[problem] || P.PROBLEM_TEXT.other) + '</p>'
    + '<div class="btnrow"><button type="button" class="btn btn--primary" data-retry>Try again</button><a class="btn btn--ghost" href="' + LIST + '">Back to Word lists</a></div></div>', offline ? ' data-teach-offline' : '');
  const b = main.querySelector('[data-retry]');
  if (b) b.addEventListener('click', redraw);
  settle(main);
}

export function listResults(main, { oid: given } = {}) {
  if (!adultOnly(main)) return undefined;
  if (navigator.onLine === false) { problemPage(main, 'offline'); return undefined; }
  const oid = D.safeDecode(given || '');
  const role = roleHere();
  let stopped = false;
  let cleanup = () => {};
  main.innerHTML = wrap('<div class="pagehead"><span class="eyebrow">Grown-ups</span><h1>Results</h1><p class="muted">Finding the results…</p></div>', ' data-teach-chapter');
  (async () => {
    const masterOf = () => (D.validOid(oid) ? Ow.normalise(W.ownOf(S.readWords()))[oid] || null : null);
    let master = masterOf();
    if (!master) {
      main.innerHTML = wrap(back + '<div class="pagehead"><h1>That list isn’t here</h1></div><section class="card t-empty" data-gone><p>It may have been deleted, or the link is old. Look in Deleted lists, or go back to Word lists.</p><div class="gu-actions"><a class="btn btn--primary btn--big" href="' + LIST + '">Back to Word lists</a></div></section>', ' data-teach-empty');
      settle(main);
      return;
    }
    const lc = await A.listChildren(childApi());
    if (stopped) return;
    if (lc.problem) { problemPage(main, lc.problem); return; }
    const kids = lc.children.slice(0, Ow.MAX_TO);
    const sharedKids = () => kids.filter((k) => master.to.includes(k.id));
    const day = today();
    const deleted = !!master.gone;
    const title = 'Results: ' + master.name;
    const head = (extra = '') => back + '<div class="pagehead"><span class="eyebrow">Results</span><h1>' + esc(title) + '</h1>'
      + '<p class="muted" data-headline>' + esc(L.resultsHead(role, { n: master.words.length, names: sharedKids().map((k) => k.nickname), test: testDay })) + '</p><p class="muted t-printone" data-printone></p>'
      + (deleted ? '<p class="gu-line gu-line--warn" data-deleted>This list was deleted.</p>' : '') + extra + '</div>';
    let testDay = '';
    if (!sharedKids().length) {
      main.innerHTML = wrap(head() + '<section class="card t-empty" data-shared-none><h2>No results yet</h2><p>Results show after a child practises these words.</p></section><h2 class="ls-sec">Given to</h2><p class="muted" data-notgiven>' + esc(L.NOT_GIVEN) + '.</p><div class="ls-bar" data-bar><a class="btn btn--primary btn--big" href="#/grownups/set/list/' + enc(oid) + '">' + esc(RD.WORDS[role].set) + '</a><a class="btn btn--ghost" href="' + LIST + '/' + enc(oid) + '/give" data-give>Give for practice</a></div>', ' data-teach-chapter');
      settle(main);
      return;
    }
    const read = async () => {
      const rs = await ST.readKids(childApi(), sharedKids());
      return rs.map((r, i) => ({ kid: sharedKids()[i], ...(r.problem ? { problem: r.problem } : { data: { words: r.d, setup: r.setup, progress: r.progress } }) }));
    };
    let reads = await read();
    if (stopped) return;
    const resultFor = (r) => (r.data ? T.childResult({ oid, master, d: r.data.words, progress: r.data.progress, setup: r.data.setup, today: day, childId: r.kid.id }) : null);
    let results = reads.map((r) => ({ ...r, result: resultFor(r) }));
    const shown = () => results.filter((r) => !r.problem);
    const groupOf = (r) => (r.data && r.result && r.result.week ? W.liveGroups(r.data.words).find((g) => g.id === r.result.week.id) || null : null);
    const newestTest = () => results.map((r) => r.result && r.result.week && r.result.week.test).filter(Boolean).sort().pop() || '';
    let tab = 'results';

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

    // ---- tab 1: the table, then who has the list
    const helpOf = (r) => (r.result ? RD.needsHelp({ d: r.data.words, week: groupOf(r), toPractise: r.result.toPractise, sent: r.result.has === 'sent' }, day) : []);
    const row = (r) => {
      const k = r.kid;
      const who = '<th scope="row" tabindex="-1"><span class="t-who"><b>' + esc(k.nickname) + '</b></span></th>';
      if (r.problem) return '<tr data-cid="' + esc(k.id) + '" data-problem="' + esc(r.problem) + '">' + who + '<td colspan="2">' + esc(P.PROBLEM_TEXT[r.problem] || P.PROBLEM_TEXT.other) + ' <button type="button" class="btn btn--ghost" data-retry-child>Try again</button></td></tr>';
      const x = r.result;
      const score = x.has === 'sent' ? (scoreOf(r.data.words, groupOf(r)) !== L.NO_HELP ? scoreOf(r.data.words, groupOf(r)) : x.test ? x.test.line : L.NO_HELP) : L.NO_HELP;
      const third = role === 'teacher'
        ? (helpOf(r).length ? helpOf(r).map((h) => esc(h.line)).join(' · ') : L.NO_HELP)
        : (x.toPractise.length ? x.toPractise.map((w) => '<span class="gu-hw">' + esc(w) + '</span>').join('<span class="sr">, </span>') : esc(T.NONE_NOTED));
      return '<tr data-cid="' + esc(k.id) + '">' + who + '<td data-label="' + (role === 'teacher' ? 'Test' : 'Score') + '">' + esc(score) + '</td><td data-label="' + (role === 'teacher' ? L.NEEDS_HELP_HEAD : 'To practise again') + '">' + third + '</td></tr>';
    };
    const givenRows = () => results.map((r) => {
      const k = r.kid;
      if (r.problem || !r.result) return '';
      if (r.result.has !== 'sent') return '<li class="ls-given" data-cid="' + esc(k.id) + '"><b>' + esc(k.nickname) + '</b><span class="gu-line gu-line--warn" data-notsent>' + esc(T.notSentLine(k.nickname)) + ' The week did not reach ' + esc(k.nickname) + '. Try again.<button type="button" class="btn btn--ghost" data-resend="' + esc(k.id) + '">Try again for ' + esc(k.nickname) + '</button></span></li>';
      return '<li class="ls-given" data-cid="' + esc(k.id) + '"><b>' + esc(k.nickname) + '</b><span class="muted">' + esc(givenLine(r.result)) + '</span></li>';
    }).join('');
    const tableHtml = () => '<section class="card gu-panel"><table class="gu-table t-table" data-each-table><caption class="sr">One row for each child who has this list, in the order on your account.</caption>'
      + '<thead><tr><th scope="col">Child</th><th scope="col">' + (role === 'teacher' ? 'Test' : 'Score') + '</th><th scope="col">' + (role === 'teacher' ? L.NEEDS_HELP_HEAD : 'To practise again') + '</th></tr></thead><tbody>' + results.map(row).join('') + '</tbody></table>'
      + '<p class="t-key">' + esc(T.KEY_LINE) + '</p></section>'
      + (givenRows() ? '<h2 class="ls-sec">Given to</h2><section class="card gu-panel"><ul class="ls-giventlist">' + givenRows() + '</ul></section>' : '');
    // ---- tab 2: the words
    const wordsHtml = () => {
      const rows = T.wordRows(master.words, shown().map((r) => ({ name: r.kid.nickname, toPractise: r.result.toPractise })));
      return '<section class="card gu-panel"><h2>Words</h2><p class="muted">Words: which to go over together</p><ul class="t-wordlist">'
        + rows.map((w) => '<li class="t-wordrow' + (w.names.length ? ' is-flag' : '') + '" data-word-row><span class="t-word">' + esc(w.word) + '</span><span>' + esc(helpLine(w.names)) + '</span></li>').join('') + '</ul></section>';
    };
    const tabsHtml = () => '<div class="ls-tabs ls-noprint" role="group" aria-label="Results">'
      + ['results', 'words'].map((k) => '<button type="button" class="ls-tab" data-tab="' + k + '" aria-pressed="' + (tab === k) + '">' + esc(k === 'words' ? L.RESULTS_TABS.words : role === 'teacher' ? L.RESULTS_TABS.results : 'Results') + '</button>').join('') + '</div>';
    const shareHtml = () => '<div class="ls-bar ls-bar--static ls-noprint" data-bar>'
      + (role === 'teacher' ? '<button type="button" class="btn btn--primary btn--big" data-print-all>' + I.print + 'Print for the class</button><p class="small muted">One page, every child</p>' : '<button type="button" class="btn btn--primary btn--big" data-print-all>' + I.print + 'Print results</button>')
      + '<div class="gu-actions"><button type="button" class="btn btn--ghost" data-print-one aria-haspopup="dialog">' + I.print + 'Print for one child</button><button type="button" class="btn btn--ghost" data-copy-all>' + I.copy + 'Copy results as text</button></div>'
      + '<p class="t-fine" role="status" data-copied></p><p class="t-fine">' + esc(T.KEEP_SAFE) + '</p></div>';

    function drawAll() {
      testDay = newestTest();
      main.innerHTML = wrap('<p class="t-printdate">' + esc(T.printedLine(day)) + '</p>' + head() + tabsHtml()
        + '<div data-part="results"' + (tab === 'results' ? '' : ' hidden') + '>' + tableHtml() + '</div><div data-part="words"' + (tab === 'words' ? '' : ' hidden') + '>' + wordsHtml() + '</div>'
        + shareHtml() + '<p class="t-printkeep">' + esc(T.KEEP_SAFE) + '</p>', ' data-teach-chapter' + (role === 'teacher' ? ' data-class' : ''));
      wire();
    }
    const q = (s) => main.querySelector(s);
    const qa = (s) => [...main.querySelectorAll(s)];
    const page = () => q('.gu');

    function wire() {
      qa('[data-tab]').forEach((b) => b.addEventListener('click', () => {
        tab = b.dataset.tab;
        qa('[data-tab]').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.tab === tab)));
        q('[data-part="results"]').hidden = tab !== 'results';
        q('[data-part="words"]').hidden = tab !== 'words';
      }));
      const back2 = (cid) => { const th = q('tr[data-cid="' + cid + '"] th'); if (th) th.focus({ preventScroll: true }); };
      qa('[data-resend]').forEach((b) => b.addEventListener('click', async () => {
        const cid = b.dataset.resend;
        b.disabled = true;
        await D.saveOwnChapter(childApi(), { oid, name: master.name, words: master.words, src: master.src, to: master.to });
        if (stopped) return;
        master = masterOf() || master;
        await refresh();
        back2(cid);
      }));
      qa('[data-retry-child]').forEach((b) => b.addEventListener('click', async () => {
        const cid = b.closest('tr').dataset.cid;
        b.disabled = true;
        await refresh();
        back2(cid);
      }));
      q('[data-print-all]').addEventListener('click', () => { clearOne(); window.print(); });
      q('[data-copy-all]').addEventListener('click', () => copy(''));
      q('[data-print-one]').addEventListener('click', printOneDialog);
    }
    async function refresh() {
      reads = await read();
      if (stopped) return;
      results = reads.map((r) => ({ ...r, result: resultFor(r) }));
      drawAll();
    }

    // ---- print and copy
    const rowsFor = () => results.map((r) => ({ cid: r.kid.id, name: r.kid.nickname, year: r.kid.year, result: r.result, problem: r.problem }));
    const textFor = (only) => T.reportText({ listName: master.name, day, rows: rowsFor(), words: master.words, only });
    const copy = async (only) => {
      let done = false;
      try { await navigator.clipboard.writeText(textFor(only)); done = true; } catch (e) { done = false; }
      const said = q('[data-copied]');
      said.textContent = '';
      setTimeout(() => { if (!stopped) said.textContent = done ? T.COPIED : T.COPY_FAILED; }, 30);
    };
    const clearOne = () => {
      const p = page();
      if (p) p.removeAttribute('data-print-only');
      qa('[data-print-skip]').forEach((e) => e.removeAttribute('data-print-skip'));
    };
    // Print for one child: every other child's row, the words and the line naming the children are skipped, and a line with this child only takes their place.
    const printOne = (cid) => {
      const k = kids.find((x) => x.id === cid);
      if (!k) return;
      clearOne();
      page().setAttribute('data-print-only', cid);
      qa('[data-cid]').forEach((tr) => { if (tr.dataset.cid !== cid) tr.setAttribute('data-print-skip', ''); });
      q('[data-part="words"]').setAttribute('data-print-skip', '');
      q('[data-headline]').setAttribute('data-print-skip', '');
      q('[data-printone]').textContent = T.printOneLine(master.words.length, k.nickname);
      window.print();
    };
    async function printOneDialog() {
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
    }
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
    drawAll();
    settle(main);
  })();
  return () => { stopped = true; cleanup(); };
}
