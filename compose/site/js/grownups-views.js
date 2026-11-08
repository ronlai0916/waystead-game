// Grown-ups: each child's writing, marking, the AI feedback switch, printing, and
// the review of the tasks. For an adult signed in as themselves only.
import * as W from './writing-doc.js';
import * as A from './grownups-data.js';
import * as C from './checks.js';
import * as K from './comic-doc.js';
import * as R from './comic-render.js';
import { allTasks, taskById, approveCommand, REVIEW_KEY, comicShared } from './tasks.js';
import { checksHtml, feedbackHtml } from './views.js';
import { isAdult, kind, playingAsChild, playerName, recheckWho } from './who.js';
import { accountOrigin, switchUrl } from './account/config.js';
import { esc, ICON, stripHtml, wireStrip, toast } from './ui.js';

const PRIVACY = 'Only you and your child can see this.';
const childHref = (id) => '#/grownups/child/' + encodeURIComponent(id);
const TEXT = {
  network: 'We can\'t reach Waystead just now. Check your connection, then try again.',
  busy: 'Waystead is busy just now. Please wait a moment, then try again.',
  'too-big': 'This child\'s saved writing is full.',
  'signed-out': 'You\'ve been signed out. Please sign in again.',
  other: 'Something went wrong on our side. Please try again.',
};
let api = null;
const childApi = () => { if (!api) api = A.createChildApi({ origin: accountOrigin(location) }); return api; };
const wrap = (title, line, body) => '<section class="wrap page grownups"><div class="pagehead"><span class="eyebrow">Grown-ups</span><h1>' + esc(title) + '</h1>' + (line ? '<p class="muted">' + esc(line) + '</p>' : '') + '</div>' + body + '</section>';
const redraw = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

export const playingLine = (name) => 'You\'re playing as ' + (name || 'a child') + '. Switch back to yourself to plan and see progress.';
function playingCard(main) {
  main.innerHTML = '<section class="wrap page"><div class="card empty" data-playing><h1>Grown-ups</h1><p class="muted">' + esc(playingLine(playingAsChild() ? playerName() : '')) + '</p>'
    + '<a class="btn btn--primary" href="' + esc(switchUrl(accountOrigin(location), location.href)) + '" data-switchback>Switch back to myself' + ICON.arrow + '</a></div></section>';
}
function adultOnly(main) {
  if (isAdult()) return true;
  if (playingAsChild()) { playingCard(main); return false; }
  main.innerHTML = kind() === 'unknown'
    ? '<section class="wrap page"><div class="card empty"><h1>Just a moment</h1><p class="muted">Checking who is here…</p></div></section>'
    : '<section class="wrap page"><div class="card empty" data-notforyou><h1>This page is for grown-ups</h1><a class="btn btn--primary" href="#/">Back to the start</a></div></section>';
  return false;
}
async function showProblem(main, problem) {
  if (problem === 'playing') { await recheckWho(); playingCard(main); return; }
  if (problem === 'signed-out') recheckWho();
  const back = problem === 'no-child';
  main.innerHTML = wrap(back ? 'That child isn\'t on your account.' : 'That didn\'t load', back ? '' : TEXT[problem], '<div class="btnrow" data-problem="' + esc(problem) + '">'
    + (back ? '' : '<button type="button" class="btn btn--primary" data-retry>Try again</button>') + '<a class="btn ' + (back ? 'btn--primary' : 'btn--ghost') + '" href="#/grownups">Back to the list</a></div>');
  const retry = main.querySelector('[data-retry]');
  if (retry) retry.addEventListener('click', redraw);
}
async function loadChild(cid) {
  const { children, problem } = await A.listChildren(childApi());
  if (problem) return { problem };
  const child = children.find((c) => c.id === cid);
  if (!child) return { problem: 'no-child' };
  const data = await A.readChild(childApi(), cid);
  return data.problem ? data : { child, ...data };
}

export function grownups(main) {
  if (!adultOnly(main)) return undefined;
  let stopped = false;
  const tasks = '<div class="shortcuts"><a class="card shortcut" href="#/grownups/tasks"><span><strong>Review the tasks</strong><br><span class="muted small">Read each one before children can see it</span></span>' + ICON.arrow + '</a></div>';
  main.innerHTML = wrap('Grown-ups', 'See each child\'s writing, mark it and print it.', '<p class="muted">Finding your children…</p>');
  A.listChildren(childApi()).then(({ children: list, problem }) => {
    if (stopped) return;
    if (problem) { showProblem(main, problem); return; }
    main.innerHTML = wrap('Grown-ups', 'See each child\'s writing, mark it and print it.', (list.length
      ? '<div class="list">' + list.map((c) => '<a class="card listrow" href="' + childHref(c.id) + '" data-child="' + esc(c.id) + '"><span><strong>' + esc(c.nickname) + '</strong><br><span class="muted small">Year ' + esc(c.year) + '</span></span>' + ICON.arrow + '</a>').join('') + '</div>'
      : '<div class="card empty"><p class="muted">Add a child to your Waystead account, and they\'ll show here.</p></div>') + tasks);
  });
  return () => { stopped = true; };
}

export function childPage(main, { cid }) {
  if (!adultOnly(main)) return undefined;
  const id = decodeURIComponent(cid);
  let stopped = false;
  main.innerHTML = wrap('Writing', '', '<p class="muted">Loading…</p>');
  loadChild(id).then((c) => {
    if (stopped) return;
    if (c.problem) { showProblem(main, c.problem); return; }
    const pieces = Object.values(c.writing.pieces).sort((a, b) => b.at - a.at);
    const row = (p) => { const t = taskById(p.task); const m = c.marks.marks[p.id]; return '<a class="card listrow" href="' + childHref(id) + '/p/' + encodeURIComponent(p.id) + '" data-piece="' + esc(p.id) + '"><span><strong>' + esc(t ? t.title : p.task) + '</strong><br><span class="muted small">Year ' + esc(p.level) + ' · ' + C.wordCount(p.final || W.textOf(p.parts)) + ' words</span></span>'
      + '<span class="pill ' + (W.isFinal(p) ? 'pill--done' : '') + '">' + (m ? 'Marked' : W.isFinal(p) ? 'Finished' : 'Being written') + '</span></a>'; };
    const comics = Object.values(c.comics.comics).filter((x) => x.kind === 'own' || taskById(x.task)).sort((a, b) => b.at - a.at);
    const comicRow = (x) => { const t = x.kind === 'task' ? taskById(x.task) : null; const m = c.marks.marks[x.id]; const st = K.starsOf(x); return '<a class="card listrow" href="' + childHref(id) + '/c/' + encodeURIComponent(x.id) + '" data-comicrow="' + esc(x.id) + '"><span><strong>' + esc(t ? t.title : x.title || 'My own story') + '</strong><br><span class="muted small">' + (t ? 'Comic · Year ' + esc(x.level) + ' · ' + st.total + ' stars' + (x.challenge && x.challenge.done ? ' · wrote it too' : '') : 'Own story · Year ' + esc(x.level)) + '</span></span>'
      + '<span class="pill ' + (K.isDone(x) ? 'pill--done' : '') + '">' + (m ? 'Marked' : K.isDone(x) ? 'Finished' : 'Being made') + '</span></a>'; };
    main.innerHTML = wrap(c.child.nickname + '\'s writing', PRIVACY,
      '<div class="card setting"><label class="switchrow"><input type="checkbox" data-ai' + (c.settings.aiFeedback ? ' checked' : '') + '> AI feedback for ' + esc(c.child.nickname) + '</label>'
      + '<p class="muted small">Off unless you turn it on. Only the story, its level and the task\'s title are sent to our AI provider: never a name, an account or an email.</p><p class="small" data-ainote role="status"></p></div>'
      + (comics.length ? '<h2 class="sectionhead">Comics</h2><div class="list">' + comics.map(comicRow).join('') + '</div>' : '')
      + (pieces.length ? '<h2 class="sectionhead">Writing</h2><div class="list">' + pieces.map(row).join('') + '</div>' : comics.length ? '' : '<div class="card empty"><p class="muted">Nothing written yet.</p></div>'));
    const box = main.querySelector('[data-ai]');
    box.addEventListener('change', async () => {
      const want = box.checked;
      box.disabled = true;
      const r = await A.setAiFeedback(childApi(), id, want, Date.now());
      box.disabled = false;
      if (r.ok) { main.querySelector('[data-ainote]').textContent = want ? 'AI feedback is on.' : 'AI feedback is off.'; return; }
      box.checked = !want;
      if (r.problem === 'playing' || r.problem === 'no-child') showProblem(main, r.problem);
      else main.querySelector('[data-ainote]').textContent = TEXT[r.problem] + ' Nothing has changed.';
    });
  });
  return () => { stopped = true; };
}

function rubricHtml(m) {
  return '<div class="rubric">' + W.RUBRIC.map(([k, label]) => '<fieldset><legend>' + esc(label) + '</legend>' + [1, 2, 3, 4, 5].map((n) => '<label><input type="radio" name="r-' + k + '" value="' + n + '"' + (m && m[k] === n ? ' checked' : '') + '> ' + n + '</label>').join('') + '</fieldset>').join('') + '</div>'
    + '<label class="small muted" for="comment">Comment</label><textarea id="comment" class="field" rows="3" maxlength="500" data-comment>' + esc(m ? m.comment : '') + '</textarea>';
}
export function piecePage(main, { cid, pid }) {
  if (!adultOnly(main)) return undefined;
  const id = decodeURIComponent(cid);
  const pieceId = decodeURIComponent(pid);
  let stopped = false;
  main.innerHTML = wrap('A piece of writing', '', '<p class="muted">Loading…</p>');
  loadChild(id).then((c) => {
    if (stopped) return;
    if (c.problem) { showProblem(main, c.problem); return; }
    const p = c.writing.pieces[pieceId];
    if (!p) { location.replace(childHref(id)); return; }
    const t = taskById(p.task);
    const m = c.marks.marks[pieceId];
    const section = (title, text) => (text ? '<div class="card setting"><h2>' + esc(title) + '</h2><p class="piece">' + esc(text) + '</p></div>' : '');
    main.innerHTML = wrap((t ? t.title : p.task), c.child.nickname + ' · Year ' + p.level + ' · ' + PRIVACY,
      (t ? stripHtml(t) : '')
      + (p.plan.some(Boolean) ? '<div class="card setting"><h2>Plan</h2><ol class="slips">' + p.plan.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ol></div>' : '')
      + section(W.isFinal(p) ? 'Final' : 'Being written', p.final || W.textOf(p.parts))
      + section('First draft', p.first && p.first !== p.final ? p.first : '')
      + section('Also saved on another device', (p.other || {}).text)
      + (p.checks ? '<div class="card setting" data-checks><h2>Automatic checks</h2>' + checksHtml(p.checks) + '</div>' : '')
      + (p.feedback ? feedbackHtml(p.feedback) : '')
      + '<div class="card setting" data-mark><h2>Mark</h2>' + rubricHtml(m) + '<p class="small" data-note role="status"></p><div class="btnrow noprint"><button type="button" class="btn btn--primary" data-save>Save the mark</button><button type="button" class="btn btn--ghost" data-print>Print</button></div></div>'
      + (t ? '<details class="hint noprint"><summary>Model answer (for grown-ups)</summary><div class="hint__body"><p class="piece">' + esc(t.model) + '</p></div></details>' : ''));
    if (t) wireStrip(main, t);
    main.querySelector('[data-print]').addEventListener('click', () => window.print());
    main.querySelector('[data-save]').addEventListener('click', async () => {
      const fields = { comment: main.querySelector('[data-comment]').value };
      for (const [k] of W.RUBRIC) { const r = main.querySelector('[name="r-' + k + '"]:checked'); fields[k] = r ? r.value : 0; }
      const note = main.querySelector('[data-note]');
      const r = await A.saveMark(childApi(), id, pieceId, fields, Date.now());
      if (r.ok) { toast(r.updated ? 'Updated with the latest' : 'Saved'); note.textContent = 'Mark saved.'; return; }
      if (r.problem === 'playing' || r.problem === 'no-child') { showProblem(main, r.problem); return; }
      note.textContent = r.error || TEXT[r.problem] + ' Nothing has been saved.';
    });
  });
  return () => { stopped = true; };
}

/** A child's comic: the finished comic, the typed challenge with its checks, the stars, and the same mark as a piece. */
export function comicPage(main, { cid, comicId }) {
  if (!adultOnly(main)) return undefined;
  const id = decodeURIComponent(cid);
  const xid = decodeURIComponent(comicId);
  let stopped = false;
  main.innerHTML = wrap('A comic', '', '<p class="muted">Loading…</p>');
  loadChild(id).then((c) => {
    if (stopped) return;
    if (c.problem) { showProblem(main, c.problem); return; }
    const x = c.comics.comics[xid];
    const t = x && x.kind === 'task' ? taskById(x.task) : null;
    if (!x || (x.kind === 'task' && !t)) { location.replace(childHref(id)); return; }
    const m = c.marks.marks[xid];
    const st = K.starsOf(x);
    const nameOf = (k) => R.stickerName(k + '.a') || k;
    const lines = R.comicLines(x, t, nameOf);
    const moves = Object.entries(st.moves).map(([k, n]) => '<li>' + esc({ order: 'Order it', wheel: 'Story wheel', panel1: 'Panel 1', panel2: 'Panel 2', panel3: 'Panel 3', panel4: 'Panel 4', join: 'Join it up', read: 'Read it' }[k] || k) + ' ' + R.starsHtml(n) + '</li>').join('');
    const ch = x.challenge;
    main.innerHTML = wrap(t ? t.title : x.title || 'My own story', c.child.nickname + ' · Year ' + x.level + ' · ' + (K.isDone(x) ? 'Finished' : 'Being made') + ' · ' + PRIVACY,
      R.coverHtml(x, t, { name: c.child.nickname, stamp: K.isDone(x) })
      + R.comicHtml(x, t, { cls: 'comic--big comic--print', nameOf, label: 'The comic' })
      + '<div class="card setting"><h2>The comic as a story</h2><p class="piece">' + esc(K.comicText(lines) || 'Nothing yet.') + '</p></div>'
      + (t ? '<div class="card setting" data-stars><h2>Stars: ' + st.total + ' of ' + (st.max + 3) + '</h2><ul class="starlist">' + moves + (st.bonus ? '<li>Write it yourself ' + R.starsHtml(st.bonus) + '</li>' : '') + '</ul><p class="small muted">Stars come from how many tries each move took. They are for your child, not a mark.</p></div>' : '')
      + (ch && ch.text ? '<div class="card setting" data-challenge><h2>Write it yourself' + (ch.done ? '' : ' (not finished)') + '</h2><p class="piece">' + esc(ch.text) + '</p>' + (ch.checks ? '<h3>Automatic checks</h3>' + checksHtml(ch.checks) : '') + '</div>' : '')
      + ((x.other || {}).text ? '<div class="card setting"><h2>Also saved on another device</h2><p class="piece">' + esc(x.other.text) + '</p></div>' : '')
      + '<div class="card setting" data-mark><h2>Mark</h2>' + rubricHtml(m) + '<p class="small" data-note role="status"></p><div class="btnrow noprint"><button type="button" class="btn btn--primary" data-save>Save the mark</button><button type="button" class="btn btn--ghost" data-print>Print</button></div></div>'
      + (t ? '<details class="hint noprint"><summary>Model answer (for grown-ups)</summary><div class="hint__body"><p class="piece">' + esc(t.model) + '</p></div></details>' : ''));
    R.placeStickers(main);
    main.querySelector('[data-print]').addEventListener('click', () => window.print());
    main.querySelector('[data-save]').addEventListener('click', async () => {
      const fields = { comment: main.querySelector('[data-comment]').value };
      for (const [k] of W.RUBRIC) { const r = main.querySelector('[name="r-' + k + '"]:checked'); fields[k] = r ? r.value : 0; }
      const note = main.querySelector('[data-note]');
      const r = await A.saveMark(childApi(), id, xid, fields, Date.now());
      if (r.ok) { toast(r.updated ? 'Updated with the latest' : 'Saved'); note.textContent = 'Mark saved.'; return; }
      if (r.problem === 'playing' || r.problem === 'no-child') { showProblem(main, r.problem); return; }
      note.textContent = r.error || TEXT[r.problem] + ' Nothing has been saved.';
    });
  });
  return () => { stopped = true; };
}

/* ------------------------------------------------------- the review page --- */
const marked = () => { try { const v = JSON.parse(localStorage.getItem(REVIEW_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const mark = (list) => { try { localStorage.setItem(REVIEW_KEY, JSON.stringify(list)); } catch (e) { /* private mode */ } };
// The comic tiles are reviewed apart from the task (approve-tasks.mjs --comic); notes on this device only.
const COMIC_KEY = REVIEW_KEY + '.comic';
const markedComics = () => { try { const v = JSON.parse(localStorage.getItem(COMIC_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const markComics = (list) => { try { localStorage.setItem(COMIC_KEY, JSON.stringify(list)); } catch (e) { /* private mode */ } };
/** Everything a child could tap in a task's comic, for a grown-up to read before approving. */
export function comicReviewHtml(t) {
  const k = t.comic;
  if (!k) return '';
  const opts = (list) => list.map((o) => esc(o.text.replace(/,$/, '')) + (o.fits ? '' : ' <i>(does not fit)</i>')).join(' · ');
  return '<details class="hint"><summary>Comic tiles</summary><div class="hint__body small">'
    + '<p><b>Who:</b> ' + opts(k.who) + '<br><b>Where:</b> ' + opts(k.where) + '<br><b>When:</b> ' + opts(k.when) + '</p>'
    + k.panels.map((p, i) => '<p><b>Panel ' + (i + 1) + '</b> (' + esc(p.slots.join(' ')) + ')<br>' + p.paths.map((x) => esc(x.split('|').join(' '))).join('<br>')
      + '<br><i>Wrong tiles:</i> ' + esc(p.wrong.flat().join(', ')) + '<br><i>Describing ' + esc(p.describe.noun) + ':</i> ' + esc(p.describe.ideas.join(', '))
      + '<br><i>' + esc(p.feel.who) + ' feels:</i> ' + esc(p.feel.fits.join(', ')) + '<br><i>Speech:</i> ' + p.speech.map((s) => esc(s.who) + ': “' + esc(s.says) + '”').join(' · ') + '</p>').join('')
    + '<p><b>Stronger words:</b> ' + Object.entries(k.upgrades).map(([a, b]) => esc(a) + ' → ' + esc(b.join(', '))).join(' · ') + '<br><b>Endings:</b> ' + k.endings.map(esc).join(' · ') + '</p></div></details>';
}
export function taskReview(main) {
  if (!adultOnly(main)) return;
  const tasks = allTasks();
  const waiting = () => marked().filter((id) => tasks.some((t) => t.id === id && !t.reviewed));
  const waitingComics = () => markedComics().filter((id) => tasks.some((t) => t.id === id && t.comic && !t.comic.reviewed));
  const own = comicShared() && comicShared().own;
  const summary = () => {
    const ids = waiting();
    const cids = waitingComics();
    return '<p>' + tasks.filter((t) => t.reviewed).length + ' of ' + tasks.length + ' tasks are live for children, and ' + tasks.filter((t) => t.reviewed && t.comic && t.comic.reviewed).length + ' as comics. ' + (ids.length + cids.length) + ' marked here to approve.</p>'
      + (ids.length || cids.length ? '<p class="small muted">To release them, run this in the game folder, then deploy:</p>' + (ids.length ? '<code class="command" data-command>' + esc(approveCommand(ids)) + '</code>' : '') + (cids.length ? '<code class="command" data-comiccommand>' + esc(approveCommand(cids, '--comic')) + '</code>' : '') : '<p class="small muted">A switch here is your own note on this device. Nothing reaches children until the approve command has run and the site is deployed.</p>')
      + '<p class="small muted">A comic reaches a child only when its task is live too. Until then a live task uses the older pages (Look, Plan, Write).</p>'
      + (own ? '<p class="small"><b>My own story:</b> ' + (own.reviewed ? 'live for children.' : 'waiting. Its story sparks and lines are in data/comic.json; to release it: <code class="command" data-owncommand>node tools/approve-tasks.mjs --own</code>') + '</p>' : '');
  };
  main.innerHTML = wrap('Review the tasks', '', '<div class="card setting" data-summary>' + summary() + '</div><div class="settings storyreview">'
    + tasks.map((t) => '<article class="card setting" data-review="' + esc(t.id) + '"><span class="eyebrow">Year ' + t.level + '</span><h2>' + esc(t.title) + '</h2>' + stripHtml(t) + '<p>' + esc(t.background) + '</p>'
      + '<p class="small"><b>Hint words:</b> ' + esc(t.hints.join(', ')) + '</p><p class="small"><b>Opening line:</b> ' + esc(t.opening) + '</p><ol class="slips small">' + t.planner.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ol>'
      + '<ul class="report__list small">' + t.criteria.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ul>'
      + '<details class="hint"><summary>Model answer (' + C.wordCount(t.model) + ' words)</summary><div class="hint__body"><p class="piece">' + esc(t.model) + '</p></div></details>'
      + comicReviewHtml(t)
      + '<div class="btnrow">' + (t.reviewed ? '<span class="pill pill--done">Live for children</span>' : '<label class="approve"><input type="checkbox" data-approve="' + esc(t.id) + '"' + (marked().includes(t.id) ? ' checked' : '') + '> Approve the task</label>')
      + (t.comic ? (t.comic.reviewed ? '<span class="pill pill--done">Comic live</span>' : '<label class="approve"><input type="checkbox" data-approvecomic="' + esc(t.id) + '"' + (markedComics().includes(t.id) ? ' checked' : '') + '> Approve the comic</label>') : '') + '</div></article>').join('') + '</div>');
  tasks.forEach((t) => { const el = main.querySelector('[data-review="' + t.id + '"]'); wireStrip(el, t); });
  main.querySelectorAll('[data-approve]').forEach((box) => box.addEventListener('change', () => {
    const id = box.dataset.approve;
    mark(box.checked ? [...new Set([...marked(), id])] : marked().filter((x) => x !== id));
    main.querySelector('[data-summary]').innerHTML = summary();
  }));
  main.querySelectorAll('[data-approvecomic]').forEach((box) => box.addEventListener('change', () => {
    const id = box.dataset.approvecomic;
    markComics(box.checked ? [...new Set([...markedComics(), id])] : markedComics().filter((x) => x !== id));
    main.querySelector('[data-summary]').innerHTML = summary();
  }));
}
