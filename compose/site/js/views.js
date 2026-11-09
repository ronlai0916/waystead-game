// A child's pages: the tasks, then one task from Look to Final, and My writing.
import * as S from './store.js';
import * as W from './writing-doc.js';
import * as C from './checks.js';
import { allTasks, taskById, visibleTo, comicVisible, ownVisible, adventureVisible, LEVELS } from './tasks.js';
import * as K from './comic-doc.js';
import { speak, stop } from './speech.js';
import { askFeedback } from './feedback.js';
import { loadRealWords } from './wordcheck.js';
import { kind, isAdult, playerName } from './who.js';
import { accountOrigin } from './account/config.js';
import { burstHtml, placeBursts } from './celebrate.js';
import { esc, ICON, imgHtml, stripHtml, wireStrip, toast } from './ui.js';

const SAVE_MS = 700;
const taskHref = (t, step = '') => '#/t/' + t.id + (step ? '/' + step : '');
const STEPS = [['look', 'Look'], ['plan', 'Plan'], ['write', 'Write'], ['check', 'Check'], ['feedback', 'Better'], ['final', 'Final']];
const stepBar = (on) => '<ol class="stepbar" aria-label="Steps">' + STEPS.map(([id, label]) => '<li' + (id === on ? ' class="is-on" aria-current="step"' : '') + '>' + label + '</li>').join('') + '</ol>';
const head = (t, on, title) => '<div class="pagehead"><span class="eyebrow">Year ' + t.level + ' · ' + esc(t.title) + '</span><h1>' + esc(title) + '</h1></div>' + stepBar(on);

export function notFound(main) {
  main.innerHTML = '<section class="wrap page"><div class="card empty"><h1>That page isn\'t here</h1><a class="btn btn--primary" href="#/">Back to the tasks</a></div></section>';
}
// Only tasks this person may see. Everything else goes back to the list.
function task(id) {
  const t = taskById(id);
  if (t && visibleTo([t], kind()).length) return t;
  location.replace('#/');
  return null;
}
// This task's piece, made on first need.
function pieceFor(t) {
  const open = W.openPiece(S.readWriting(), t.id);
  if (open) return open;
  const id = S.newId();
  S.updateWriting((d) => W.startPiece(d, t, { id, now: Date.now() }));
  return S.readWriting().pieces[id];
}

/* ------------------------------------------------------------------ tasks --- */
export function home(main) {
  const who = kind();
  const list = visibleTo(allTasks(), who);
  const d = S.readWriting();
  const comics = S.readComics();
  const card = (t) => {
    const comic = comicVisible(t, who);
    const open = comic ? K.openComic(comics, t.id) : W.openPiece(d, t.id);
    const done = comic ? K.finished(comics).some((c) => c.task === t.id) : W.finals(d).some((p) => p.task === t.id);
    const waiting = !t.reviewed || (comic && !t.comic.reviewed);
    return '<a class="card taskcard" href="' + (comic ? '#/c/' + t.id : taskHref(t, 'look')) + '" data-task="' + esc(t.id) + '"' + (comic ? ' data-comic-task' : '') + '>' + imgHtml(t.pictures[0], '(min-width: 720px) 33vw, 100vw') + '<strong>' + esc(t.title) + '</strong>'
      + '<span class="btnrow">' + (waiting ? '<span class="pill pill--warm">Not reviewed yet</span>' : '') + (comic ? '<span class="pill">Comic</span>' : '') + (open ? '<span class="pill">Carry on</span>' : '') + (done ? '<span class="pill pill--done">Finished</span>' : '') + '</span></a>';
  };
  const own = ownVisible(who);
  main.innerHTML = '<section class="wrap page"><div class="pagehead"><span class="eyebrow">Composition · Comic Studio</span><h1>' + (playerName() ? 'Hello, ' + esc(playerName()) : 'Picture stories') + '</h1>'
    + '<p class="muted">Choose a picture story and turn it into a comic, one small step at a time.</p></div>'
    + '<div class="shortcuts">' + (isAdult() ? '<a class="card shortcut" href="#/grownups"><span><strong>Grown-ups</strong><br><span class="muted small">See each child\'s writing and comics, and mark them</span></span>' + ICON.arrow + '</a>' : '')
    + '<a class="card shortcut" href="#/comics" data-shelflink><span><strong>My comics</strong><br><span class="muted small">' + K.finished(comics).length + ' finished</span></span>' + ICON.arrow + '</a>'
    + (own ? '<a class="card shortcut" href="#/own" data-ownlink><span><strong>My own story</strong><br><span class="muted small">Make a comic with stickers' + (isAdult() && !ownVisible('child') ? ' · not reviewed yet' : '') + '</span></span>' + ICON.arrow + '</a>' : '')
    + (adventureVisible(who) ? '<a class="card shortcut" href="#/adv" data-advlink><span><strong>Story Adventure</strong><br><span class="muted small">Your own story, with pictures drawn for you' + (isAdult() && !adventureVisible('child') ? ' · not reviewed yet' : '') + '</span></span>' + ICON.arrow + '</a>' : '') + '</div>'
    + (list.length ? LEVELS.filter((n) => list.some((t) => t.level === n)).map((n) => '<h2 class="levelhead">Year ' + n + '</h2><div class="taskgrid">' + list.filter((t) => t.level === n).map(card).join('') + '</div>').join('')
      : '<div class="card empty" data-notasks><h2>New stories are on their way</h2><p class="muted">Ask a grown-up to check back soon.</p></div>')
    + '</section>';
}

/* ------------------------------------------------------------------- look --- */
const hintsHtml = (t, used = []) => '<div class="hintlist">' + t.hints.map((h) => '<button type="button" class="hint' + (used.includes(h) ? ' is-used' : '') + '" data-hint="' + esc(h) + '">' + (used.includes(h) ? ICON.tick : ICON.play) + esc(h) + (used.includes(h) ? '<span class="sr"> used</span>' : '') + '</button>').join('') + '</div>';
const wireHints = (main) => main.querySelectorAll('[data-hint]').forEach((b) => b.addEventListener('click', () => speak(b.dataset.hint)));

export function look(main, { id }) {
  const t = task(id);
  if (!t) return undefined;
  main.innerHTML = '<section class="wrap page">' + head(t, 'look', t.title) + stripHtml(t)
    + '<div class="card setting"><p>' + esc(t.background) + '</p></div>'
    + '<h2 class="sectionhead">Hint words</h2><p class="muted small">Tap a word to hear it.</p>' + hintsHtml(t)
    + '<div class="btnrow"><a class="btn btn--primary" href="' + taskHref(t, 'plan') + '" data-go>Plan my story' + ICON.arrow + '</a></div></section>';
  wireStrip(main, t);
  wireHints(main);
  return stop;
}

/* ------------------------------------------------------------------- plan --- */
function saver(pieceId) {
  let timer = null;
  let fields = null;
  const flush = () => { clearTimeout(timer); timer = null; if (fields) { const f = fields; fields = null; S.updateWriting((d) => W.change(d, pieceId, f, Date.now())); } };
  return { save(f) { fields = { ...fields, ...f }; clearTimeout(timer); timer = setTimeout(flush, SAVE_MS); }, flush };
}

export function plan(main, { id }) {
  const t = task(id);
  if (!t) return undefined;
  const p = pieceFor(t);
  const lines = [...p.plan];
  const box = saver(p.id);
  main.innerHTML = '<section class="wrap page">' + head(t, 'plan', 'Plan my story') + stripHtml(t)
    + t.planner.map((q, i) => '<div class="planline"><label for="plan-' + i + '"><b>' + (i + 1) + '.</b> ' + esc(q) + '</label><input id="plan-' + i + '" class="field" maxlength="120" autocomplete="off" value="' + esc(lines[i] || '') + '" data-line="' + i + '"></div>').join('')
    + '<div class="btnrow"><a class="btn btn--primary" href="' + taskHref(t, 'write') + '" data-go>Write my story' + ICON.arrow + '</a></div></section>';
  wireStrip(main, t);
  main.querySelectorAll('[data-line]').forEach((el) => el.addEventListener('input', () => { lines[Number(el.dataset.line)] = el.value; box.save({ plan: [...lines] }); }));
  return box.flush;
}

/* ------------------------------------------------------------------ write --- */
function writePage(main, t, step, title, intro, nextHtml, wireNext) {
  const p = pieceFor(t);
  const parts = [...p.parts];
  const box = saver(p.id);
  let isReal = () => false;
  const planLine = (i) => (p.plan[i] ? '<p class="muted small">My plan: ' + esc(p.plan[i]) + '</p>' : '');
  const fields = t.level === 3
    ? t.pictures.map((pic, i) => '<div class="card writebox writebox--pic">' + imgHtml(pic, '110px') + '<div class="stack"><label for="part-' + i + '"><b>Picture ' + (i + 1) + '</b></label>' + planLine(i)
      + '<textarea id="part-' + i + '" class="field" spellcheck="false" autocapitalize="off" data-part="' + i + '" placeholder="' + (i === 0 && t.opening ? esc(t.opening) : '') + '">' + esc(parts[i] || '') + '</textarea></div></div>').join('')
    : stripHtml(t) + (p.plan.some(Boolean) ? '<div class="card setting"><b>My plan</b><ol class="slips">' + p.plan.map((l) => '<li>' + esc(l) + '</li>').join('') + '</ol></div>' : '')
      + '<div class="card writebox writebox--one"><label for="part-0"><b>My story</b></label><textarea id="part-0" class="field" spellcheck="false" autocapitalize="off" data-part="0" placeholder="' + esc(t.opening || '') + '">' + esc(parts[0] || '') + '</textarea></div>';
  main.innerHTML = '<section class="wrap page">' + head(t, step, title) + intro + fields
    + '<div class="livebar" aria-live="polite"><span data-count></span><div data-hints></div><div data-slips></div><p class="small" data-gentle></p>'
    + '<div class="btnrow"><button type="button" class="btn btn--quiet btn--small" data-gentlebtn>Check my capitals and full stops</button></div></div>'
    + nextHtml + '</section>';
  if (t.level !== 3) wireStrip(main, t);
  const text = () => W.textOf(parts);
  function live() {
    const s = text();
    main.querySelector('[data-count]').innerHTML = '<b>' + C.wordCount(s) + '</b> words';
    const used = C.hintsUsed(s, t.hints);
    main.querySelector('[data-hints]').innerHTML = hintsHtml(t, used);
    wireHints(main.querySelector('[data-hints]'));
    const slips = C.misspelledHints(s, t.hints, isReal, C.taskWords(t));
    main.querySelector('[data-slips]').innerHTML = slips.length ? '<ul class="slips small">' + slips.map((x) => '<li>Is <b>' + esc(x.word) + '</b> spelled like the hint word <b>' + esc(x.hint) + '</b>?</li>').join('') + '</ul>' : '';
  }
  main.querySelectorAll('[data-part]').forEach((el) => el.addEventListener('input', () => {
    parts[Number(el.dataset.part)] = el.value;
    box.save({ parts: [...parts] });
    main.querySelector('[data-gentle]').textContent = '';
    live();
  }));
  main.querySelector('[data-gentlebtn]').addEventListener('click', () => {
    const c = C.capitalsAndStops(text());
    const say = [];
    if (c.noCapital) say.push('Some sentences could start with a capital letter.');
    if (c.smallI) say.push('Remember a capital for the word I.');
    if (c.noStop) say.push('Look at the end of each sentence for a full stop.');
    main.querySelector('[data-gentle]').textContent = say.length ? say.join(' ') : 'Those look good!';
  });
  loadRealWords().then((fn) => { isReal = fn; if (main.querySelector('[data-count]')) live(); });
  live();
  wireNext(box, text);
  return () => { box.flush(); stop(); };
}

export function write(main, { id }) {
  const t = task(id);
  if (!t) return undefined;
  if (pieceFor(t).stage !== 'write') { location.replace(taskHref(t, 'feedback')); return undefined; }
  return writePage(main, t, 'write', 'Write my story', '', '<div class="btnrow"><a class="btn btn--primary" href="' + taskHref(t, 'check') + '" data-go>Check my work' + ICON.arrow + '</a></div>', () => {});
}

/* ------------------------------------------------------------- self-check --- */
export function check(main, { id }) {
  const t = task(id);
  if (!t) return undefined;
  const p = pieceFor(t);
  if (p.stage !== 'write') { location.replace(taskHref(t, 'feedback')); return undefined; }
  const ticks = t.criteria.map((_, i) => !!p.ticks[i]);
  const box = saver(p.id);
  main.innerHTML = '<section class="wrap page">' + head(t, 'check', 'Check my work')
    + '<div class="card setting"><p>Read your story out loud. Then tick what you did.</p><ul class="checklist">' + t.criteria.map((c, i) => '<li><label><input type="checkbox" data-tick="' + i + '"' + (ticks[i] ? ' checked' : '') + '> ' + esc(c) + '</label></li>').join('') + '</ul></div>'
    + '<div class="card setting"><p class="piece">' + esc(W.textOf(p.parts) || 'You haven\'t written anything yet.') + '</p></div>'
    + '<p class="spellline" data-note role="status"></p>'
    + '<div class="btnrow"><button type="button" class="btn btn--primary" data-submit>Hand it in' + ICON.arrow + '</button><a class="btn btn--ghost" href="' + taskHref(t, 'write') + '">Keep writing</a></div></section>';
  main.querySelectorAll('[data-tick]').forEach((el) => el.addEventListener('change', () => { ticks[Number(el.dataset.tick)] = el.checked; box.save({ ticks: [...ticks] }); }));
  const button = main.querySelector('[data-submit]');
  button.addEventListener('click', async () => {
    box.flush();
    const now = S.readWriting().pieces[p.id];
    const text = W.textOf(now.parts);
    if (C.wordCount(text) < 5) { main.querySelector('[data-note]').textContent = 'Write a little more first.'; return; }
    button.disabled = true;
    main.querySelector('[data-note]').textContent = 'Reading your story…';
    const isReal = await loadRealWords();
    const checks = C.autoChecks(text, t, isReal);
    const feedback = S.readSettings().aiFeedback && text.length <= W.MAX_TEXT
      ? await askFeedback({ origin: accountOrigin(location), taskId: t.id, level: t.level, text }) : null;
    S.updateWriting((d) => W.submit(d, p.id, { checks, feedback }, Date.now()));
    location.hash = taskHref(t, 'feedback');
  });
  return box.flush;
}

/* ---------------------------------------------------------------- feedback --- */
const checksHtml = (list) => '<ul class="autochecks">' + (list || []).map((c) => '<li' + (c.ok ? '' : ' class="is-todo"') + '>' + (c.ok ? ICON.tick : ICON.dot) + '<span>' + esc(c.text) + '</span></li>').join('') + '</ul>';
export const feedbackHtml = (f) => '<div class="card setting" data-ai><h2>Two stars and a wish</h2><ul class="autochecks">' + f.stars.map((s) => '<li>' + ICON.tick + '<span>' + esc(s) + '</span></li>').join('') + '</ul>'
  + '<p><b>A next step:</b> ' + esc(f.wish) + '</p>'
  + (f.spellings.length ? '<p class="small"><b>Spellings to look at:</b> ' + f.spellings.map((s) => esc(s.word) + ' → ' + esc(s.suggestion)).join(', ') + '</p>' : '') + '</div>';
export { checksHtml };

export function feedback(main, { id }) {
  const t = task(id);
  if (!t) return;
  const p = W.openPiece(S.readWriting(), t.id);
  if (!p) { location.replace('#/writing'); return; }
  if (p.stage === 'write') { location.replace(taskHref(t, 'write')); return; }
  if (p.stage === 'better') { location.replace(taskHref(t, 'better')); return; }
  main.innerHTML = '<section class="wrap page">' + head(t, 'feedback', 'How did it go?')
    + '<div class="card setting" data-checks><h2>What we noticed</h2>' + checksHtml(p.checks) + '</div>'
    + (p.feedback ? feedbackHtml(p.feedback) : '')
    + '<div class="btnrow">' + (p.revised ? '' : '<a class="btn btn--primary" href="' + taskHref(t, 'better') + '" data-better>Make it better' + ICON.arrow + '</a>')
    + '<button type="button" class="btn ' + (p.revised ? 'btn--primary' : 'btn--ghost') + '" data-finish>It\'s finished</button></div></section>';
  main.querySelector('[data-finish]').addEventListener('click', () => {
    S.updateWriting((d) => W.finish(d, p.id, Date.now()));
    location.hash = '#/writing/' + p.id;
  });
}

export function better(main, { id }) {
  const t = task(id);
  if (!t) return undefined;
  let p = W.openPiece(S.readWriting(), t.id);
  if (!p) { location.replace('#/writing'); return undefined; }
  if (p.stage === 'feedback') { S.updateWriting((d) => W.startRevision(d, p.id, Date.now())); p = S.readWriting().pieces[p.id]; }
  if (p.stage !== 'better') { location.replace(taskHref(t, 'feedback')); return undefined; }
  const intro = '<div class="card setting"><h2>What we noticed</h2>' + checksHtml(p.checks) + '</div>' + (p.feedback ? feedbackHtml(p.feedback) : '');
  return writePage(main, t, 'feedback', 'Make it better', intro, '<div class="btnrow"><button type="button" class="btn btn--primary" data-finish>It\'s finished' + ICON.arrow + '</button></div>', (box) => {
    main.querySelector('[data-finish]').addEventListener('click', () => {
      box.flush();
      S.updateWriting((d) => W.finish(d, p.id, Date.now()));
      location.hash = '#/writing/' + p.id;
    });
  });
}

/* ------------------------------------------------------------- my writing --- */
export function writing(main) {
  const list = W.finals(S.readWriting());
  const row = (p) => { const t = taskById(p.task); return '<a class="card listrow" href="#/writing/' + esc(p.id) + '" data-piece="' + esc(p.id) + '"><span><strong>' + esc(t ? t.title : 'A story') + '</strong><br><span class="muted small">' + C.wordCount(p.final) + ' words</span></span>' + (S.readMarks().marks[p.id] ? '<span class="pill pill--done">Marked</span>' : '') + '</a>'; };
  main.innerHTML = '<section class="wrap page"><div class="pagehead"><span class="eyebrow">Composition</span><h1>My writing</h1></div>'
    + (list.length ? '<div class="list">' + list.map(row).join('') + '</div>' : '<div class="card empty"><p class="muted">Your finished stories will be here.</p><a class="btn btn--primary" href="#/">Choose a story</a></div>') + '</section>';
}
export function piece(main, { pid }) {
  const p = S.readWriting().pieces[pid];
  if (!p || !W.isFinal(p)) { location.replace('#/writing'); return; }
  const t = taskById(p.task);
  const m = S.readMarks().marks[pid];
  main.innerHTML = '<section class="wrap page"><div class="pagehead"><span class="eyebrow">My writing</span><h1 data-final>' + esc(t ? t.title : 'My story') + '</h1>'
    + '<span class="celebrate"><span class="passmark__badge">' + ICON.tick + '</span>' + burstHtml(14, 1.6) + '</span></div>'
    + (t ? stripHtml(t) : '') + '<div class="card setting"><p class="piece">' + esc(p.final) + '</p><p class="muted small">' + C.wordCount(p.final) + ' words</p></div>'
    + (m && m.comment ? '<div class="card setting"><h2>From your grown-up</h2><p>' + esc(m.comment) + '</p></div>' : '')
    + '<div class="btnrow"><a class="btn btn--primary" href="#/">Write another' + ICON.arrow + '</a><a class="btn btn--ghost" href="#/writing">My writing</a></div></section>';
  placeBursts(main);
  if (t) wireStrip(main, t);
}

export function about(main) {
  main.innerHTML = '<section class="wrap page prose"><span class="eyebrow">For parents</span><h1>About Composition</h1>'
    + '<p>Composition is picture composition practice for Years 3 to 6. Your child looks at four pictures, plans one line for each, writes a story, checks it against a short list, then has one go at making it better.</p>'
    + '<h2>How it helps</h2><p>Year 3 tasks are deliberately simple: one short box for each picture, with hint words to tap and hear. A child can start there whatever their year group, and move up when they\'re ready.</p>'
    + '<p>The checks are automatic and gentle: word count, hint words, capitals and full stops. They aren\'t marks. Grown-ups can read every piece, mark it and print it from Grown-ups.</p>'
    + '<h2>AI feedback</h2><p>AI feedback is off unless you turn it on for your child, in Grown-ups. When it\'s on, only the story, its level and the task\'s title go to our AI provider: never a name, an account or an email. It gives two things done well and one next step, and it never rewrites the story. Each child can ask five times a day.</p>'
    + '<h2>Privacy</h2><p>There are no adverts, no tracking and no analytics. A child signs in with a Waystead account, and their writing is saved to it. Only your child and you can see it.</p>'
    + '<h2>Credits</h2><p class="small">Stories, tasks and hint words are original to Waystead. The pictures were made with AI (Grok Imagine). Fonts: Fredoka, Andika, Baloo 2, Nunito, Lexend and Atkinson Hyperlegible, under the SIL Open Font License 1.1 (assets/fonts/licences/). The Waystead name uses Sora.</p></section>';
}
