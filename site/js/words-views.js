// "My words": the word group, today's job, the practice grid, spelling a word,
// the test and the numbers. The rules are in words-doc.js and spell-run.js;
// these pages only show them. Signed in only (gate.js).
import * as D from './data.js';
import * as S from './store.js';
import * as W from './words-doc.js';
import * as R from './spell-run.js';
import { checkTyped } from './wordcheck.js';
import { speak, stop } from './speech.js';
import { burstHtml, placeBursts } from './celebrate.js';
import { esc, ICON, keyboard, shuffle, toast, dotsHtml } from './ui.js';
import * as St from './study-doc.js';
import { stepHref, stripHtml } from './study-views.js';
import { findEntry } from './word-info.js';

const PEEK_MS = 2000;
const AGAIN_MS = 1600; // how long a finished word stays before the clean run
const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const today = () => W.localDay(Date.now());
const groupHref = (id) => '#/words/g/' + encodeURIComponent(id);
const toGroup = (id) => { location.replace(groupHref(id)); };
const plural = (n, one, many = one + 's') => n + ' ' + (n === 1 ? one : many);

const JOB = {
  practise: { title: 'Practise', line: 'About 10 to 15 minutes. Tap a word: it\'s hidden and spoken, and you spell it.' },
  test: { title: 'Test today', line: 'Each word is spoken, with no peeking and one go each. You see how you did at the end.' },
  wait: { title: 'Test done', line: 'Well done. Your fix-ups come tomorrow.' },
  fixups: { title: 'Fix-ups', line: 'A little extra practice for the words that slipped.' },
  'fixed-today': { title: 'Fix-ups done for today', line: 'Those words come back tomorrow for one more clean go.' },
  finished: { title: 'All done', line: 'This group is finished. Words not yet remembered come back in your next group.' },
};

// ---- the first group ---------------------------------------------------------------
// The chapter the player is on: Year 3 & 4's first unpassed one, unless all of
// those are passed or they have already started on Year 5 & 6.
function currentChapter() {
  const open = (y) => D.chapters(y).find((c) => !S.chapterProgress(c.id).passed);
  const started = D.chapters('y56').some((c) => { const p = S.chapterProgress(c.id); return p.studied || p.practised || p.attempts > 0; });
  return (started && open('y56')) || open('y34') || open('y56') || D.chapters('y56').at(-1);
}
export function ensureStarter() {
  if (!W.needsStarter(S.readWords())) return;
  const ch = currentChapter();
  S.updateWords((d) => W.starterGroup(d, { name: D.chapterTitle(ch).name, words: ch.words.map((w) => w.word), today: today() }));
}

/** The words of any test that's due, for the pages that list words. */
export const hiddenToday = () => (S.currentPlayer() ? St.hiddenWords(S.readWords(), today()) : new Set());

/** For the home page. */
export function todayLine() {
  if (!S.currentPlayer()) return 'Your words for the week';
  const d = S.readWords();
  const day = today();
  const g = W.currentGroup(d, day);
  if (!g) return 'Your words for the week';
  const job = W.jobFor(d, g, day);
  return job === 'practise' ? 'Practise: ' + W.starsOn(d, g, day) + ' of ' + W.rows(g).length + ' stars today' : JOB[job].title;
}
/** Up to 3 words not yet remembered, for the flower game, as word entries. */
export function backAgainFor(words) {
  if (!S.currentPlayer()) return [];
  return W.returningWords(S.readWords(), today(), words, 50).map((w) => D.entry(w)).filter(Boolean).slice(0, W.MAX_BACK);
}

// ---- the group page ----------------------------------------------------------------
function starsLine(d, g, day) {
  const n = W.starsOn(d, g, day);
  return '<p class="starline">' + ICON.star + '<span><b>' + n + ' of ' + W.rows(g).length + '</b> stars today</span></p>';
}
const firstToDo = (d, g, day, list) => list.find((w) => !W.doneOn(d, g, w, day));
const spellHref = (g, w) => groupHref(g.id) + '/spell/' + W.rows(g).indexOf(w);

// Study mode: the group's guided week.
const STATUS_LINE = {
  done: ['Done for today!', 'Your next job is ready tomorrow. You can still play games with these words.'],
  rest: ['No job today', 'Your next job is on its way. You can still play games with these words.'],
  ready: ['Every job done', 'Your test is on the way. Keep these words warm with a game.'],
  finished: [JOB.finished.title, JOB.finished.line],
};
function testCard(g) {
  return '<div class="card job job--test" data-testcard><span class="eyebrow">Today</span><h2>' + esc(JOB.test.title) + '</h2><p class="muted">' + esc(JOB.test.line) + '</p>'
    + '<a class="btn btn--primary" href="' + groupHref(g.id) + '/test" data-job>Start the test' + ICON.arrow + '</a></div>';
}
/** In place of any page that would show a test's words (test-guard.js). */
export function testTodayPage(main, g) {
  main.innerHTML = '<section class="wrap page"><div class="pagehead"><span class="eyebrow">' + esc(g.name) + '</span><h1>' + esc(JOB.test.title) + '</h1></div>' + testCard(g) + '</section>';
}
function studyCard(d, g, day) {
  const s = St.studyState(d, g, day);
  const step = s.steps.find((x) => x.id === s.job);
  if (s.job === 'test') return testCard(g);
  if (!step) {
    const [title, line] = STATUS_LINE[s.status];
    return '<div class="card job"><span class="eyebrow">Today</span><h2>' + esc(title) + '</h2><p class="muted">' + esc(line) + '</p></div>';
  }
  const line = step.id === 'mend' && St.mendPart(d, g, day) === 'fixups' ? JOB.fixups.line : step.line;
  return '<div class="card job job--' + step.id + '"><span class="eyebrow">Today</span><h2>' + esc(step.title) + '</h2><p class="muted">' + esc(line) + '</p>'
    + (step.id === 'practice' ? starsLine(d, g, day) : '')
    + '<a class="btn btn--primary" href="' + stepHref(d, g, step.id, day) + '" data-job>Start' + ICON.arrow + '</a></div>';
}

// Practise 3 times, for the whole group.
function roundsLine(d, g) {
  const all = W.allDots(d, g).filter((x) => !x.back);
  const full = all.filter((x) => x.dots >= W.ROUNDS_NEEDED).length;
  return W.readyForTest(d, g) ? '<p class="readyline"><span class="pill pill--done">Ready for the test</span> Every word has its 3 dots.</p>'
    : '<p class="readyline small muted">' + full + ' of ' + all.length + ' words have all 3 dots. Each word needs 3 clean rounds before the test.</p>';
}

/** Study or Game: the same words, a guided week or the games any time. */
function modeSwitch(g, mode) {
  const link = (id, label, href) => '<a class="tab" href="' + href + '" role="tab" aria-selected="' + (mode === id) + '" data-mode="' + id + '">' + label + '</a>';
  return '<div class="tabs modeswitch" role="tablist" aria-label="Study or Game">' + link('study', 'Study mode', groupHref(g.id)) + link('game', 'Game mode', groupHref(g.id) + '/games') + '</div>';
}
export { modeSwitch };

function gridHtml(d, g, day, job) {
  const days = W.practiceDays(g);
  const open = job === 'practise';
  const L = W.allDots(d, g);
  const row = (w, i) => {
    const name = esc(w) + (g.back.includes(w) ? ' <span class="pill">back again</span>' : '');
    return '<tr><th scope="row">' + (open ? '<a href="' + spellHref(g, w) + '">' + name + '</a>' : name) + '</th><td class="gridcell gridcell--dots">' + dotsHtml(L[i].dots, W.ROUNDS_NEEDED) + '</td>' + days.map((x) => {
      const c = W.cell(d, g, w, x);
      const mark = c === 'clean' ? ICON.star + '<span class="sr">Done clean</span>' : c === 'help' ? TICK + '<span class="sr">Done with help</span>' : '<span class="sr">Not yet</span>';
      return '<td class="gridcell gridcell--' + c + (x === day ? ' is-today' : '') + '">' + mark + '</td>';
    }).join('') + '</tr>';
  };
  return '<div class="gridwrap" role="region" aria-label="Practice grid" tabindex="0"><table class="wordgrid"><thead><tr><th scope="col"><span class="sr">Word</span></th><th scope="col">Rounds</th>'
    + days.map((x) => { const [a, b] = W.dayParts(x); return '<th scope="col"' + (x === day ? ' class="is-today"' : '') + '>' + a + '<br>' + b + '</th>'; }).join('')
    + '</tr></thead><tbody>' + W.rows(g).map(row).join('') + '</tbody></table></div>'
    + '<p class="gridkey small muted"><span>' + ICON.star + ' Done clean</span><span>' + TICK + ' Done with help</span><span><i class="gridkey__empty"></i> Not yet</span></p>';
}

function resultsCard(d, g) {
  const res = W.testResults(d, g);
  const right = res.filter((x) => x.result.right).length;
  const all = right === res.length;
  return '<div class="pagehead' + (all ? ' pagehead--pass' : '') + '">'
    + (all ? '<span class="celebrate passmark" aria-hidden="true"><span class="passmark__badge">' + ICON.star + '</span>' + burstHtml(16, 2) + '</span>' : '')
    + '<h2>' + right + ' of ' + res.length + ' right in the test</h2></div>'
    + '<div class="list">' + res.map((x) => '<div class="card listrow"><strong>' + esc(x.word) + '</strong>'
      + (x.result.right ? '<span class="pill pill--done">Right</span>' : '<span class="pill pill--warm">Slipped</span>') + '</div>').join('') + '</div>';
}

function fixupList(d, g, day) {
  const left = W.fixups(d, g);
  if (!left.length) return '';
  return '<div class="list">' + left.map((w) => '<a class="card listrow" href="' + spellHref(g, w) + '"><strong>' + esc(w) + '</strong>'
    + (W.doneOn(d, g, w, day) ? '<span class="pill pill--done">Done today</span>' : '<span class="pill">Not yet</span>') + '</a>').join('') + '</div>';
}

function drawGroup(main, g, others = []) {
  const d = S.readWords();
  const day = today();
  const job = W.jobFor(d, g, day);
  const testing = job === 'test'; // no word on show on test day
  const after = ['wait', 'fixups', 'fixed-today', 'finished'].includes(job);
  main.innerHTML = '<section class="wrap page">'
    + '<div class="pagehead"><span class="eyebrow">My words</span><h1>' + esc(g.name) + '</h1>'
    + '<p class="muted">' + plural(g.words.length, 'word') + (g.back.length ? ', and ' + g.back.length + ' back again' : '') + ' · Test on ' + esc(W.dayLabel(g.test)) + '</p></div>'
    + modeSwitch(g, 'study')
    + studyCard(d, g, day)
    + stripHtml(St.studyState(d, g, day).steps, day)
    + (job === 'fixups' || job === 'fixed-today' ? fixupList(d, g, day) : '')
    + (after ? resultsCard(d, g) : '')
    + (day < g.test ? roundsLine(d, g) : '')
    + (testing ? '' : gridHtml(d, g, day, job))
    + '<div class="btnrow"><a class="btn btn--ghost" href="' + groupHref(g.id) + '/edit">' + (W.canEdit(g, day) ? 'Change this group' : 'Rename or delete') + '</a>'
    + '<a class="btn btn--ghost" href="#/words/new">New group</a>'
    + '<a class="btn btn--ghost" href="#/words/progress">My word numbers</a></div>'
    + (others.length ? '<h2 class="sectionhead">Other groups</h2><div class="list">' + others.map((o) => '<a class="card listrow" href="' + groupHref(o.id) + '"><span><strong>' + esc(o.name) + '</strong><br><span class="muted small">Test on ' + esc(W.dayLabel(o.test)) + '</span></span>'
      + '<span class="pill">' + esc(JOB[W.jobFor(d, o, day)].title) + '</span></a>').join('') + '</div>' : '')
    + '</section>';
  placeBursts(main);
}

export function myWords(main) {
  ensureStarter();
  const d = S.readWords();
  const current = W.currentGroup(d, today());
  // Another group sharing a word with a test that's due: the test's own page instead.
  const g = current && St.showsHidden(current, St.hiddenWords(d, today())) ? St.dueGroups(d, today())[0] : current;
  if (!g) {
    main.innerHTML = '<section class="wrap page"><div class="pagehead"><span class="eyebrow">My words</span><h1>Your words for the week</h1></div>'
      + '<div class="card empty"><p class="muted">Make a group of up to ' + W.MAX_WORDS + ' words and pick a test date.</p><a class="btn btn--primary" href="#/words/new">New group</a></div></section>';
    return;
  }
  drawGroup(main, g, W.liveGroups(d).filter((o) => o.id !== g.id));
}

export function group(main, { gid }) {
  const g = W.groupById(S.readWords(), decodeURIComponent(gid));
  if (!g) { location.replace('#/words'); return; }
  drawGroup(main, g);
}

// ---- making and changing a group -----------------------------------------------------
function groupForm(main, existing) {
  const day = today();
  const locked = existing && !W.canEdit(existing, day);
  const tricky = S.trickyWords().map((t) => t.word).filter((w) => D.entry(w));
  let name = existing ? existing.name : '';
  let test = existing ? existing.test : W.defaultTest(day);
  const chosen = existing ? [...existing.words] : [];
  let tab = 'chapter';
  let chapterId = currentChapter().id;
  let yearId = 'y34';
  let typed = '';
  let note = '';
  let armed = false;

  const tabBtn = (id, label) => '<button type="button" class="tab" role="tab" aria-selected="' + (tab === id) + '" data-tab="' + id + '">' + esc(label) + '</button>';
  const source = () => (tab === 'chapter' ? D.chapterById(chapterId).words.map((w) => w.word)
    : tab === 'tricky' ? tricky
      : tab === 'year' ? D.chapters(yearId).flatMap((c) => c.words.map((w) => w.word)).sort((a, b) => a.localeCompare(b, 'en-GB', { sensitivity: 'base' })) : []);
  const chapterOpts = () => ['y34', 'y56'].map((y) => '<optgroup label="' + esc(D.years()[y].label) + '">' + D.chapters(y).map((c) => '<option value="' + c.id + '"'
    + (c.id === chapterId ? ' selected' : '') + '>' + esc(D.chapterTitle(c).n + '. ' + D.chapterTitle(c).name) + '</option>').join('') + '</optgroup>').join('');

  function picker() {
    const list = source();
    return '<div class="tabs" role="tablist">' + tabBtn('chapter', 'A chapter') + tabBtn('tricky', 'Tricky words (' + tricky.length + ')') + tabBtn('year', 'A year list') + tabBtn('typed', 'Type a word') + '</div>'
      + (tab === 'chapter' ? '<select class="field" aria-label="Chapter" data-chapter>' + chapterOpts() + '</select>' : '')
      + (tab === 'year' ? '<select class="field" aria-label="Year list" data-year>' + ['y34', 'y56'].map((y) => '<option value="' + y + '"' + (y === yearId ? ' selected' : '') + '>' + esc(D.years()[y].label) + '</option>').join('') + '</select>' : '')
      + (tab === 'tricky' && !tricky.length ? '<div class="card empty"><p>No tricky words yet.</p></div>' : '')
      + (tab === 'typed' ? '<form class="btnrow" data-typeform><input class="field typedword" aria-label="Type a word" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="20" value="' + esc(typed) + '" data-typed>'
        + '<button type="submit" class="btn btn--quiet">Add</button></form>' + (note ? '<p class="small" role="status">' + esc(note) + '</p>' : '') : '')
      + (list.length ? '<div class="picker">' + list.map((w) => '<label><input type="checkbox" value="' + esc(w) + '"' + (chosen.includes(w) ? ' checked' : '') + '>' + esc(w) + '</label>').join('') + '</div>' : '');
  }

  function draw() {
    const back = existing ? existing.back : W.returningWords(S.readWords(), day, chosen);
    main.innerHTML = '<section class="wrap page"><div class="pagehead"><span class="eyebrow">My words</span><h1>' + (existing ? 'Change this group' : 'New group') + '</h1>'
      + (locked ? '<p class="muted">The test day has come, so the words and date stay as they are. You can still rename or delete it.</p>' : '<p class="muted">Up to ' + W.MAX_WORDS + ' words. Practise each day until the test.</p>') + '</div>'
      + '<div class="card groupform">'
      + '<label class="small muted" for="g-name">Name</label><input id="g-name" class="field" maxlength="' + W.MAX_NAME + '" value="' + esc(name) + '" placeholder="' + esc(W.defaultName(test)) + '" data-name>'
      + (locked ? '' : '<label class="small muted" for="g-test">Test date</label><input id="g-test" class="field" type="date" value="' + esc(test) + '" min="' + W.addDays(day, 1) + '" max="' + W.addDays(existing ? existing.start : day, W.MAX_DAYS) + '" data-test>')
      + '</div>'
      + '<h2 class="sectionhead">Words <span class="muted small">(<span data-count>' + chosen.length + '</span> of ' + W.MAX_WORDS + ')</span></h2>'
      + (chosen.length ? '<div class="wordchips">' + chosen.map((w) => (locked ? '<span>' + esc(w) + '</span>' : '<button type="button" class="chip" data-remove="' + esc(w) + '" aria-label="Remove ' + esc(w) + '">' + esc(w) + ' ×</button>')).join('') + '</div>' : '<p class="muted small">No words yet. Add some below.</p>')
      + (back.length ? '<p class="muted small">Back again with this group: ' + esc(back.join(', ')) + '</p>' : '')
      + (locked ? '' : '<div class="stack addwords">' + picker() + '</div>')
      + '<div class="btnrow"><button type="button" class="btn btn--primary" data-save>Save</button>'
      + (existing ? '<button type="button" class="btn btn--ghost" data-delete>' + (armed ? 'Tap again to delete' : 'Delete this group') + '</button>' : '') + '</div>'
      + '</section>';
    wire();
  }

  function add(w) {
    if (chosen.includes(w)) return true;
    if (chosen.length >= W.MAX_WORDS) { toast('A group can have up to ' + W.MAX_WORDS + ' words'); return false; }
    chosen.push(w);
    return true;
  }
  function wire() {
    const q = (s) => main.querySelector(s);
    q('[data-name]').addEventListener('input', (e) => { name = e.target.value; });
    if (q('[data-test]')) q('[data-test]').addEventListener('input', (e) => { test = e.target.value; });
    main.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; note = ''; draw(); }));
    main.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => { chosen.splice(chosen.indexOf(b.dataset.remove), 1); draw(); }));
    if (q('[data-chapter]')) q('[data-chapter]').addEventListener('change', (e) => { chapterId = e.target.value; draw(); });
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
    q('[data-save]').addEventListener('click', save);
    const del = q('[data-delete]');
    if (del) del.addEventListener('click', () => {
      if (!armed) { armed = true; draw(); return; }
      S.updateWords((d) => W.deleteGroup(d, existing.id, Date.now()));
      toast('Group deleted');
      location.hash = '#/words';
    });
  }
  function save() {
    const d = S.readWords();
    const now = Date.now();
    const r = existing
      ? W.editGroup(d, existing.id, { name: name.trim() || existing.name, ...(locked ? {} : { words: chosen, test }) }, day, now)
      : W.createGroup(d, { id: S.newId(), name, test, words: chosen, today: day, now });
    if (r.error) { toast(r.error); return; }
    S.updateWords(() => r.doc);
    location.hash = groupHref(existing ? existing.id : r.id);
  }
  draw();
}

export function newGroup(main) { groupForm(main, null); }
export function editGroupPage(main, { gid }) {
  const g = W.groupById(S.readWords(), decodeURIComponent(gid));
  if (!g) { location.replace('#/words'); return; }
  groupForm(main, g);
}

// ---- spelling a word ---------------------------------------------------------------
function boxesHtml(w) {
  const chunks = (findEntry(w) || { chunks: [w] }).chunks;
  let i = 0;
  return '<div class="spellboxes" aria-label="Letter boxes, ' + w.length + ' letters">' + chunks.map((c) => '<span class="spellboxes__group">'
    + [...c].map(() => '<span class="spellbox" data-box="' + (i++) + '"></span>').join('') + '</span>').join('') + '</div>';
}

export function spellWord(main, { gid, n }) {
  const id = decodeURIComponent(gid);
  const d0 = S.readWords();
  const g = W.groupById(d0, id);
  const day = today();
  const w = g ? W.rows(g)[Number(n)] : null;
  const job = g ? W.jobFor(d0, g, day) : '';
  const fixing = (job === 'fixups' || job === 'fixed-today') && !!w && W.fixups(d0, g).includes(w);
  if (!w || !(job === 'practise' || fixing)) { if (g) toGroup(id); else location.replace('#/words'); return; }
  const kind = fixing ? 'f' : 'p';
  const list = fixing ? W.fixups(d0, g) : W.rows(g);

  let run = R.newRun(w);
  let hold = false; // a peek on show, or the pause before the clean run
  let done = false;
  let timer = null;

  main.innerHTML = '<section class="wrap page spellpage"><div class="pagehead"><span class="eyebrow">' + esc(fixing ? 'Fix-ups' : g.name) + '</span>'
    + '<h1>Word ' + (list.indexOf(w) + 1) + ' of ' + list.length + '</h1>'
    + (g.back.includes(w) ? '<span class="pill">Back again</span>' : '') + '</div>'
    + '<p class="peek" data-peek aria-live="polite"></p>'
    + boxesHtml(w)
    + '<p class="spellline" data-line role="status" aria-live="polite"></p>'
    + '<div data-slot><div class="btnrow btnrow--center"><button type="button" class="btn btn--primary" data-hear>' + ICON.play + 'Hear again</button>'
    + '<button type="button" class="btn btn--ghost" data-peekbtn>Peek</button></div>' + keyboard() + '</div></section>';

  const line = (s) => { main.querySelector('[data-line]').textContent = s; };
  const clearBoxes = () => main.querySelectorAll('[data-box]').forEach((b) => { b.textContent = ''; b.classList.remove('is-filled', 'is-next'); });
  const markNext = () => {
    main.querySelectorAll('[data-box]').forEach((b) => b.classList.toggle('is-next', Number(b.dataset.box) === run.at));
  };
  const record = (r, clean) => S.updateWords((d) => W.addTry(d, { id: S.newId(), word: w, day, group: id, kind, tries: r.tries, peeks: r.peeks, clean, now: Date.now() }));

  function finish() {
    done = true;
    const star = W.cell(S.readWords(), g, w, day) === 'clean';
    const d = S.readWords();
    const left = (fixing ? W.fixups(d, g).filter((x) => !W.doneOn(d, g, x, day)) : W.gridLeft(d, g, day)).filter((x) => x !== w);
    const next = left.length ? spellHref(g, left[0]) : groupHref(id);
    main.querySelector('[data-slot]').innerHTML = '<div class="card result result--good"><div class="result__head"><span class="celebrate"><span class="result__badge">' + (star ? '★' : '✓') + '</span>' + burstHtml(12, 1.3) + '</span>'
      + '<h2>' + (star ? 'A star for today' : 'Done for today') + '</h2></div>'
      + (fixing ? '' : '<p class="muted">' + W.starsOn(d, g, day) + ' of ' + W.rows(g).length + ' stars today</p>')
      + '<div class="btnrow"><a class="btn btn--primary" href="' + next + '" data-next>' + (left.length ? 'Next word' : 'Back to my words') + ICON.arrow + '</a>'
      + (left.length ? '<a class="btn btn--ghost" href="' + groupHref(id) + '">Back to my words</a>' : '') + '</div></div>';
    placeBursts(main);
    line('');
    main.querySelector('[data-next]').focus({ preventScroll: true });
  }

  function endPass() {
    if (R.isClean(run)) { record(run, true); finish(); return; }
    record(run, false);
    hold = true;
    line('You got there. Now once more, all on your own.');
    timer = setTimeout(() => {
      hold = false;
      run = R.again(run);
      clearBoxes();
      markNext();
      line('');
      speak(w);
    }, AGAIN_MS);
  }

  function letter(L) {
    if (hold || done) return;
    const at = run.at;
    const r = R.typeLetter(run, L);
    run = r.run;
    if (r.hit) {
      const box = main.querySelector('[data-box="' + at + '"]');
      box.textContent = w[at];
      box.classList.add('is-filled');
      line('');
      markNext();
      if (r.finished) endPass();
    } else {
      line(R.wrongLine(run.tries));
    }
  }

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); letter(e.key); }
  }
  // Leaving halfway after a mistake or a peek still counts as this word's try.
  function leave() {
    if (!done && R.mustRecord(run)) { record(run, false); run = R.again(run); }
  }
  document.addEventListener('keydown', onKey);
  window.addEventListener('pagehide', leave);
  main.querySelectorAll('.key').forEach((k) => k.addEventListener('click', () => letter(k.dataset.letter)));
  main.querySelector('[data-hear]').addEventListener('click', () => speak(w));
  const peekBtn = main.querySelector('[data-peekbtn]');
  peekBtn.addEventListener('click', () => {
    if (hold || done) return;
    run = R.peek(run);
    hold = true;
    peekBtn.disabled = true;
    main.querySelector('[data-peek]').textContent = w;
    timer = setTimeout(() => {
      hold = false;
      peekBtn.disabled = false;
      main.querySelector('[data-peek]').textContent = '';
    }, PEEK_MS);
  });
  markNext();
  speak(w);
  return () => {
    clearTimeout(timer);
    leave();
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('pagehide', leave);
    stop();
  };
}

// ---- the test --------------------------------------------------------------------
export function testDay(main, { gid }) {
  const id = decodeURIComponent(gid);
  const d0 = S.readWords();
  const g = W.groupById(d0, id);
  if (!g) { location.replace('#/words'); return; }
  const day = today();
  if (W.jobFor(d0, g, day) !== 'test') { toGroup(id); return; }
  const total = g.words.length;
  const t = R.createTest(shuffle(W.testLeft(d0, g)));
  let typed = '';

  function ask() {
    const w = t.current();
    typed = '';
    main.innerHTML = '<section class="wrap page spellpage"><div class="pagehead"><span class="eyebrow">' + esc(g.name) + ' · Test</span>'
      + '<h1>Word ' + (total - t.remaining() + 1) + ' of ' + total + '</h1></div>'
      + '<div class="btnrow btnrow--center"><button type="button" class="btn btn--primary" data-hear>' + ICON.play + 'Hear again</button></div>'
      + '<p class="answerline" data-answer aria-live="polite" aria-label="Your answer"></p>'
      + keyboard()
      + '<div class="btnrow btnrow--center testbtns"><button type="button" class="btn btn--ghost" data-del>Delete</button>'
      + '<button type="button" class="btn btn--primary" data-next>Next' + ICON.arrow + '</button></div></section>';
    main.querySelector('[data-hear]').addEventListener('click', () => speak(w));
    main.querySelector('[data-del]').addEventListener('click', del);
    main.querySelector('[data-next]').addEventListener('click', next);
    main.querySelectorAll('.key').forEach((k) => k.addEventListener('click', () => put(k.dataset.letter)));
    speak(w);
  }
  const show = () => { main.querySelector('[data-answer]').textContent = typed; };
  function put(L) { if (typed.length < 24) { typed += L.toLowerCase(); show(); } }
  function del() { typed = typed.slice(0, -1); show(); }
  function next() {
    const w = t.current();
    if (!w) return;
    if (!typed) { toast('Type the word first'); return; }
    const right = R.checkAnswer(w, typed);
    // Saved now, so one go stays one go if the test is left halfway. Nothing is shown until the end.
    S.updateWords((d) => W.addTry(d, { id: S.newId(), word: w, day, group: id, kind: 't', tries: right ? 0 : 1, peeks: 0, clean: right, now: Date.now() }));
    const e = D.entry(w);
    if (e) { if (right) S.noteCorrect(w); else S.noteMissed(w, e.chapterId); }
    if (t.answer(typed).next) { ask(); window.scrollTo(0, 0); } else location.hash = groupHref(id);
  }
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); put(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); del(); } else if (e.key === 'Enter') { e.preventDefault(); next(); }
  }
  document.addEventListener('keydown', onKey);
  ask();
  return () => { document.removeEventListener('keydown', onKey); stop(); };
}

// ---- the numbers -----------------------------------------------------------------
const STATUS = { remembered: 'pill--done', 'test passed': 'pill--done', practising: 'pill--warm', new: '' };
export function wordsProgress(main) {
  const d = S.readWords();
  const o = W.overall(d);
  const stat = (n, label, sub = '') => '<div class="card stat"><b>' + n + '</b><span>' + esc(label) + '</span>' + (sub ? '<span class="muted small">' + esc(sub) + '</span>' : '') + '</div>';
  const groupCard = (g) => {
    const p = W.groupProgress(d, g);
    return '<div class="card setting"><h2>' + esc(g.name) + '</h2><p class="muted small">Test on ' + esc(W.dayLabel(g.test)) + ' · ' + plural(p.tries, 'wrong letter') + ' · ' + plural(p.peeks, 'peek') + '</p>'
      + '<div class="list">' + p.words.map((x) => '<div class="listrow"><span><strong>' + esc(x.word) + '</strong><br><span class="muted small">' + plural(x.tries, 'wrong letter') + ' · ' + plural(x.peeks, 'peek') + '</span></span>'
        + '<span class="pill ' + STATUS[x.status] + '">' + esc(x.status) + '</span></div>').join('') + '</div>'
      + (p.stars.length ? '<p class="small starsbyday">' + p.stars.map((s) => '<span>' + esc(W.dayLabel(s.day)) + ': ' + s.stars + ' of ' + p.of + '</span>').join('') + '</p>' : '')
      + '</div>';
  };
  const groups = W.liveGroups(d).reverse();
  main.innerHTML = '<section class="wrap page"><div class="pagehead"><span class="eyebrow">My words</span><h1>My word numbers</h1></div>'
    + '<div class="stats">' + stat(o.remembered, 'Remembered') + stat(o.practised, 'Words practised')
    + stat(o.independent + '%', 'Independent', o.clean + ' of ' + plural(o.firstGoes, 'first go', 'first goes') + ' clean, with no help') + '</div>'
    + (groups.length ? '<div class="settings">' + groups.map(groupCard).join('') + '</div>' : '<div class="card empty"><p class="muted">No groups yet.</p><a class="btn btn--primary" href="#/words">My words</a></div>')
    + '</section>';
}
