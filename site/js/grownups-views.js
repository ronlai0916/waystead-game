// The Grown-ups area: for an adult signed in as themselves, never a child and
// never an adult playing as one. Plan a week, and a dashboard for each child.
// The rules are in grownups-doc.js; the account calls in grownups-data.js.
import * as D from './data.js';
import * as W from './words-doc.js';
import * as P from './grownups-doc.js';
import * as A from './grownups-data.js';
import { checkTyped } from './wordcheck.js';
import { entryFor, findEntry } from './word-info.js';
import { isAdult, kind } from './who.js';
import { esc, ICON, chunked, toast, dotsHtml } from './ui.js';
import { accountOrigin } from './account/config.js';
import { stripHtml } from './study-views.js';

const today = () => W.localDay(Date.now());
const childHref = (id) => '#/grownups/child/' + encodeURIComponent(id);
const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);
const PRIVACY = 'Only you and your child can see this.';
let api = null;
const childApi = () => { if (!api) api = A.createChildApi({ origin: accountOrigin(location) }); return api; };

const wrap = (eyebrow, title, line, body) => '<section class="wrap page grownups"><div class="pagehead"><span class="eyebrow">' + esc(eyebrow) + '</span><h1>' + esc(title) + '</h1>'
  + (line ? '<p class="muted">' + esc(line) + '</p>' : '') + '</div>' + body + '</section>';

// A child never gets past here: not the page, and not a single fetch.
export function adultOnly(main) {
  if (isAdult()) return true;
  main.innerHTML = kind() === 'unknown'
    ? '<section class="wrap page"><div class="card empty"><h1>Just a moment</h1><p class="muted">Checking who is here…</p></div></section>'
    : '<section class="wrap page"><div class="card empty" data-notforyou><h1>This page is for grown-ups</h1><a class="btn btn--primary" href="#/">Back to the start</a></div></section>';
  return false;
}
function failed(main, line) {
  main.innerHTML = wrap('Grown-ups', 'That didn\'t load', line, '<a class="btn btn--primary" href="#/grownups">Back to Grown-ups</a>');
}

/* ---------------------------------------------------------------- the home --- */
export function grownups(main) {
  if (!adultOnly(main)) return undefined;
  const stories = '<a class="card shortcut" href="#/grownups/stories"><span><strong>Review the stories</strong><br><span class="muted small">Read each one before children can see it</span></span>' + ICON.arrow + '</a>';
  if (!A.CHILD_DATA_API) {
    main.innerHTML = wrap('Grown-ups', 'Grown-ups', '', '<div class="card setting" data-noapi><h2>Plan a week and the dashboard</h2><p class="muted">These open with the next Waystead account update.</p></div><div class="shortcuts">' + stories + '</div>');
    return undefined;
  }
  let stopped = false;
  main.innerHTML = wrap('Grown-ups', 'Grown-ups', 'Plan a week and see how it\'s going.', '<p class="muted">Finding your children…</p>');
  A.listChildren(childApi()).then((list) => {
    if (stopped) return;
    main.innerHTML = wrap('Grown-ups', 'Grown-ups', 'Plan a week and see how it\'s going.', (list.length
      ? '<div class="list">' + list.map((c) => '<div class="card listrow" data-child="' + esc(c.id) + '"><span><strong>' + esc(c.nickname) + '</strong><br><span class="muted small">Year ' + esc(c.year) + '</span></span>'
        + '<span class="btnrow"><a class="btn btn--quiet btn--small" href="' + childHref(c.id) + '">Dashboard</a><a class="btn btn--primary btn--small" href="' + childHref(c.id) + '/plan">Plan a week</a></span></div>').join('') + '</div>'
      : '<div class="card empty"><p class="muted">Add a child to your Waystead account, and they\'ll show here.</p></div>')
      + '<div class="shortcuts">' + stories + '</div>');
  });
  return () => { stopped = true; };
}

// The child, checked against this adult's own list first.
async function loadChild(cid) {
  const list = await A.listChildren(childApi());
  const child = list.find((c) => c.id === cid);
  if (!child) return null;
  const data = await A.readChild(childApi(), cid);
  return data ? { child, ...data } : null;
}
const needsApi = (main) => { if (A.CHILD_DATA_API) return false; location.replace('#/grownups'); return true; };

/* --------------------------------------------------------------- dashboard --- */
function reportHtml(r, cid) {
  const row = (w) => '<tr><th scope="row">' + esc(w.word) + (w.back ? ' <span class="pill">back again</span>' : '') + '</th><td>' + dotsHtml(w.dots, W.ROW_NEEDED) + '</td><td>' + w.tries + '</td><td>' + w.peeks + '</td><td>' + esc(w.status) + '</td></tr>';
  return '<div class="card setting report" data-report="' + esc(r.id) + '"><h2>' + esc(r.name) + '</h2>'
    + '<p class="muted small">Test on ' + esc(W.dayLabel(r.testDate)) + (r.job ? ' · Today: ' + esc(r.job) : '') + (r.ready ? ' · Ready for the test' : '') + '</p>'
    + stripHtml(r.steps, today())
    + '<div class="gridwrap" role="region" aria-label="Words in ' + esc(r.name) + '" tabindex="0"><table class="wordgrid reportgrid"><thead><tr><th scope="col">Word</th><th scope="col">Rounds</th><th scope="col">Wrong letters</th><th scope="col">Peeks</th><th scope="col">Status</th></tr></thead><tbody>' + r.words.map(row).join('') + '</tbody></table></div>'
    + (r.test.taken ? '<p><b>Test:</b> ' + r.test.right + ' of ' + r.test.of + ' right' + (r.test.rows.some((x) => !x.right) ? ' · Slipped: ' + esc(r.test.rows.filter((x) => !x.right).map((x) => x.word).join(', ')) : '') + '</p>' : '')
    + (r.stars.length ? '<p class="small starsbyday">' + r.stars.map((s) => '<span>' + esc(W.dayLabel(s.day)) + ': ' + s.stars + ' of ' + r.of + '</span>').join('') + '</p>' : '')
    + (r.sentences.length ? '<h3>Sentences</h3><ul class="report__list">' + r.sentences.map((s) => '<li><b>' + esc(s.word) + ':</b> ' + esc(s.text) + '</li>').join('') + '</ul>' : '')
    + (r.canEdit ? '<div class="btnrow noprint"><a class="btn btn--ghost btn--small" href="' + childHref(cid) + '/plan/' + encodeURIComponent(r.id) + '">Change this plan</a></div>' : '')
    + '</div>';
}
export function childDashboard(main, { cid }) {
  if (!adultOnly(main) || needsApi(main)) return undefined;
  const id = decodeURIComponent(cid);
  let stopped = false;
  main.innerHTML = wrap('Grown-ups', 'Dashboard', '', '<p class="muted">Loading…</p>');
  loadChild(id).then((c) => {
    if (stopped) return;
    if (!c) { failed(main, 'We couldn\'t find that child on your account.'); return; }
    const r = P.dashboard(c.words, today());
    const stat = (n, label, sub = '') => '<div class="card stat"><b>' + esc(n) + '</b><span>' + esc(label) + '</span>' + (sub ? '<span class="muted small">' + esc(sub) + '</span>' : '') + '</div>';
    main.innerHTML = wrap('Grown-ups', c.child.nickname + '\'s words', PRIVACY,
      '<div class="btnrow noprint"><a class="btn btn--primary" href="' + childHref(id) + '/plan">Plan a week' + ICON.arrow + '</a><button type="button" class="btn btn--ghost" data-print>Print weekly report</button></div>'
      + '<div class="stats">' + stat(r.remembered, 'Remembered') + stat(r.practised, 'Words practised') + stat(r.independent + '%', 'Independent first goes', r.clean + ' of ' + plural(r.firstGoes, 'first go', 'first goes')) + '</div>'
      + (r.current ? reportHtml(r.current, id) : '<div class="card empty"><p class="muted">No word group yet. Plan a week to start.</p></div>')
      + (r.clues.length ? '<h2 class="sectionhead">Memory clues</h2><ul class="report__list card setting">' + r.clues.map((x) => '<li><b>' + esc(x.word) + ':</b> ' + esc(x.clue) + '</li>').join('') + '</ul>' : '')
      + (r.others.length ? '<h2 class="sectionhead noprint">Other weeks</h2><div class="settings noprint">' + r.others.map((x) => reportHtml(x, id)).join('') + '</div>' : ''));
    main.querySelector('[data-print]').addEventListener('click', () => window.print());
  });
  return () => { stopped = true; };
}

/* ------------------------------------------------------------- plan a week --- */
function planForm(main, cid, gid) {
  const day = today();
  const id = decodeURIComponent(cid);
  const editing = gid ? decodeURIComponent(gid) : null;
  let c = null;
  let patterns = [];
  let credit = '';
  let stopped = false;
  let name = '';
  let test = W.defaultTest(day);
  let chosen = [];
  let tab = 'chapter';
  let chapterId = D.chapters('y34')[0].id;
  let patternId = '';
  let yearId = 'y34';
  let typed = '';
  let note = '';
  let showing = null; // the preview

  const tricky = () => P.childTricky(c.progress).filter((w) => findEntry(w));
  const source = () => (tab === 'chapter' ? D.chapterById(chapterId).words.map((w) => w.word)
    : tab === 'pattern' ? P.patternWords(patterns, patternId)
      : tab === 'tricky' ? tricky()
        : tab === 'year' ? D.chapters(yearId).flatMap((x) => x.words.map((w) => w.word)).sort((a, b) => a.localeCompare(b, 'en-GB', { sensitivity: 'base' })) : []);
  const tabBtn = (k, label) => '<button type="button" class="tab" role="tab" aria-selected="' + (tab === k) + '" data-tab="' + k + '">' + esc(label) + '</button>';
  const chapterOpts = () => ['y34', 'y56'].map((y) => '<optgroup label="' + esc(D.years()[y].label) + '">' + D.chapters(y).map((x) => '<option value="' + x.id + '"' + (x.id === chapterId ? ' selected' : '') + '>' + esc(D.chapterTitle(x).n + '. ' + D.chapterTitle(x).name) + '</option>').join('') + '</optgroup>').join('');
  const patternOpts = () => [['y34', 'Years 3 and 4'], ['y56', 'Years 5 and 6']].map(([s, label]) => '<optgroup label="' + label + '">' + patterns.filter((p) => p.stage === s).map((p) => '<option value="' + p.id + '"' + (p.id === patternId ? ' selected' : '') + '>' + esc(p.title) + '</option>').join('') + '</optgroup>').join('');

  function picker() {
    const list = source();
    const p = patterns.find((x) => x.id === patternId);
    return '<div class="tabs" role="tablist">' + tabBtn('chapter', 'A chapter') + tabBtn('pattern', 'A spelling pattern') + tabBtn('year', 'A year list') + tabBtn('tricky', 'Tricky words (' + tricky().length + ')') + tabBtn('typed', 'School words') + '</div>'
      + (tab === 'chapter' ? '<select class="field" aria-label="Chapter" data-chapter>' + chapterOpts() + '</select>' : '')
      + (tab === 'pattern' ? '<select class="field" aria-label="Spelling pattern" data-pattern>' + patternOpts() + '</select>' + (p ? '<p class="small muted">' + esc(p.rule) + '</p>' : '') + '<p class="foot__small">' + esc(credit) + '</p>' : '')
      + (tab === 'year' ? '<select class="field" aria-label="Year list" data-year>' + ['y34', 'y56'].map((y) => '<option value="' + y + '"' + (y === yearId ? ' selected' : '') + '>' + esc(D.years()[y].label) + '</option>').join('') + '</select>' : '')
      + (tab === 'tricky' && !tricky().length ? '<div class="card empty"><p>No tricky words yet.</p></div>' : '')
      + (tab === 'typed' ? '<form class="btnrow" data-typeform><input class="field typedword" aria-label="Type a word" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="20" value="' + esc(typed) + '" data-typed><button type="submit" class="btn btn--quiet">Add</button></form>'
        + (note ? '<p class="small" role="status" data-typednote>' + esc(note) + '</p>' : '') : '')
      + (list.length ? '<div class="picker">' + list.map((w) => '<label><input type="checkbox" value="' + esc(w) + '"' + (chosen.includes(w) ? ' checked' : '') + '>' + esc(w) + '</label>').join('') + '</div>' : '');
  }
  function draw() {
    if (showing) { drawPreview(); return; }
    main.innerHTML = wrap('Plan a week', 'For ' + c.child.nickname, 'Up to ' + W.MAX_WORDS + ' words. The week fits itself to the test date.', '<div class="card groupform">'
      + '<label class="small muted" for="p-name">Name</label><input id="p-name" class="field" maxlength="' + W.MAX_NAME + '" value="' + esc(name) + '" placeholder="' + esc(W.defaultName(test)) + '" data-name>'
      + '<label class="small muted" for="p-test">Test date</label><input id="p-test" class="field" type="date" value="' + esc(test) + '" min="' + W.addDays(day, 1) + '" max="' + W.addDays(day, W.MAX_DAYS) + '" data-test></div>'
      + '<h2 class="sectionhead">Words <span class="muted small">(' + chosen.length + ' of ' + W.MAX_WORDS + ')</span></h2>'
      + (chosen.length ? '<div class="wordchips">' + chosen.map((w) => '<button type="button" class="chip" data-remove="' + esc(w) + '" aria-label="Remove ' + esc(w) + '">' + esc(w) + ' ×</button>').join('') + '</div>' : '<p class="muted small">No words yet. Add some below.</p>')
      + '<div class="stack addwords">' + picker() + '</div>'
      + '<div class="btnrow"><button type="button" class="btn btn--primary" data-preview>Preview' + ICON.arrow + '</button><a class="btn btn--ghost" href="' + childHref(id) + '">Cancel</a></div>');
    wire();
  }
  function add(w) {
    if (chosen.includes(w)) return true;
    if (chosen.length >= W.MAX_WORDS) { toast('A week can have up to ' + W.MAX_WORDS + ' words'); return false; }
    chosen.push(w);
    return true;
  }
  function wire() {
    const q = (s) => main.querySelector(s);
    q('[data-name]').addEventListener('input', (e) => { name = e.target.value; });
    q('[data-test]').addEventListener('input', (e) => { test = e.target.value; });
    main.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; note = ''; draw(); }));
    main.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => { chosen.splice(chosen.indexOf(b.dataset.remove), 1); draw(); }));
    if (q('[data-chapter]')) q('[data-chapter]').addEventListener('change', (e) => { chapterId = e.target.value; draw(); });
    if (q('[data-pattern]')) q('[data-pattern]').addEventListener('change', (e) => { patternId = e.target.value; draw(); });
    if (q('[data-year]')) q('[data-year]').addEventListener('change', (e) => { yearId = e.target.value; draw(); });
    main.querySelectorAll('.picker input').forEach((cb) => cb.addEventListener('change', () => {
      if (cb.checked) add(cb.value); else if (chosen.includes(cb.value)) chosen.splice(chosen.indexOf(cb.value), 1);
      draw();
    }));
    const form = q('[data-typeform]');
    if (form) {
      q('[data-typed]').addEventListener('input', (e) => { typed = e.target.value; });
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const r = await checkTyped(typed, findEntry);
        if (r.word && add(r.word)) { typed = ''; note = 'Added ' + r.word + '.'; } else if (r.error) note = r.error;
        draw();
        q('[data-typed]').focus();
      });
    }
    q('[data-preview]').addEventListener('click', () => {
      const base = editing ? { ...c.words, groups: Object.fromEntries(Object.entries(c.words.groups).filter(([k]) => k !== editing)) } : c.words;
      const r = P.preview(base, { name, test, words: chosen }, day);
      if (r.error) { toast(r.error); return; }
      showing = r;
      draw();
      window.scrollTo(0, 0);
    });
  }
  function drawPreview() {
    const p = showing;
    main.innerHTML = wrap('Plan a week', 'Preview for ' + c.child.nickname, '', '<div class="card setting" data-previewcard><h2>' + esc(p.name) + '</h2>'
      + '<p class="muted small">Test on ' + esc(W.dayLabel(p.test)) + (p.squeezed ? ' · A short week: some days have two jobs' : '') + '</p>'
      + stripHtml(p.steps, day)
      + '<div class="previewwords">' + p.words.map((w) => '<span>' + chunked(entryFor(w)) + '</span>').join('') + '</div>'
      + (p.back.length ? '<p class="muted small">Back again with these: ' + esc(p.back.join(', ')) + '</p>' : '') + '</div>'
      + '<div class="btnrow"><button type="button" class="btn btn--primary" data-save>' + (editing ? 'Save the changes' : 'Send to ' + esc(c.child.nickname)) + ICON.arrow + '</button><button type="button" class="btn btn--ghost" data-back>Change it</button></div>');
    main.querySelector('[data-back]').addEventListener('click', () => { showing = null; draw(); });
    main.querySelector('[data-save]').addEventListener('click', save);
  }
  async function save() {
    const now = Date.now();
    const newId = 'p' + [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, '0')).join('');
    const r = await A.changeWords(childApi(), id, (doc) => (editing
      ? P.editPlan(doc, editing, { name: name.trim() || showing.name, words: chosen, test }, { today: day, now })
      : P.createPlan(doc, { name, test, words: chosen }, { id: newId, today: day, now })));
    if (r.error) { toast(r.error); return; }
    toast('Saved');
    location.hash = childHref(id);
  }
  Promise.all([loadChild(id), fetch('data/patterns.json').then((r) => r.json()).catch(() => ({ patterns: [] }))]).then(([child, data]) => {
    if (stopped) return;
    if (!child) { failed(main, 'We couldn\'t find that child on your account.'); return; }
    c = child;
    patterns = data.patterns;
    credit = (data._meta || {}).credit || '';
    patternId = patterns.length ? patterns[0].id : '';
    if (editing) {
      const g = W.groupById(c.words, editing);
      if (!g || !W.canEdit(g, day)) { location.replace(childHref(id)); return; }
      name = g.name;
      test = g.test;
      chosen = [...g.words];
    }
    draw();
  });
  main.innerHTML = wrap('Plan a week', 'Plan a week', '', '<p class="muted">Loading…</p>');
  return () => { stopped = true; };
}
export function planWeek(main, { cid }) { return !adultOnly(main) || needsApi(main) ? undefined : planForm(main, cid, null); }
export function editWeek(main, { cid, gid }) { return !adultOnly(main) || needsApi(main) ? undefined : planForm(main, cid, gid); }
