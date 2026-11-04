// Study mode's pages: Hello words, Fix it in, Game day, Story day and Mend and
// keep. Practice day and Test day are the grid and the test (words-views.js).
// The rules are in study-doc.js. Signed in only (gate.js).
import * as D from './data.js';
import * as S from './store.js';
import * as W from './words-doc.js';
import * as St from './study-doc.js';
import * as R from './spell-run.js';
import { entryFor, meaningsFor } from './word-info.js';
import { speak, spellOut, sayLine, stop } from './speech.js';
import { runSession } from './play.js';
import { loadStories, storyFor } from './stories.js';
import { storyPage } from './story-views.js';
import { playGames } from './games-views.js';
import { burstHtml, placeBursts } from './celebrate.js';
import { esc, ICON, picture, chunked, boldWord, keyboard, toast, dotsHtml, rowCountHtml } from './ui.js';

const today = () => W.localDay(Date.now());
const groupHref = (id) => '#/words/g/' + encodeURIComponent(id);
const head = (step, line) => '<div class="pagehead"><span class="eyebrow">' + esc(St.STEP_TEXT[step].title) + '</span>' + line + '</div>';

/** "Come back to this": straight to that word, in the job it was skipped from. */
export function comeBackHref(g, w, flow) {
  const n = W.rows(g).indexOf(w);
  return groupHref(g.id) + (flow === 'x' ? '/study/fix/' + n : '/spell/' + n);
}

/** Where a job's button goes. */
export function stepHref(d, g, step, day) {
  if (step === 'practice') return groupHref(g.id) + '/spell/' + W.rows(g).indexOf(W.queue(d, g, day, 'p')[0] ?? W.rows(g)[0]);
  if (step === 'test') return groupHref(g.id) + '/test';
  if (step === 'mend' && St.mendPart(d, g, day) === 'fixups') return groupHref(g.id) + '/spell/' + W.rows(g).indexOf(W.queue(d, g, day, 'f')[0]);
  return groupHref(g.id) + '/study/' + step;
}

function finishStep(main, g, step) {
  const day = today();
  S.updateWords((d) => W.markStep(d, g, step, day, Date.now()));
  const d = S.readWords();
  const s = St.studyState(d, g, day);
  const more = s.status === 'job';
  main.innerHTML = '<section class="wrap page"><div class="card result result--good"><div class="result__head"><span class="celebrate"><span class="result__badge">✓</span>' + burstHtml(12, 1.3) + '</span>'
    + '<h1>' + (more ? esc(St.STEP_TEXT[step].title) + ' done' : 'Done for today!') + '</h1></div>'
    + '<div class="btnrow">' + (more ? '<a class="btn btn--primary" href="' + stepHref(d, g, s.job, day) + '">Next: ' + esc(St.STEP_TEXT[s.job].title) + ICON.arrow + '</a>' : '<a class="btn btn--primary" href="#/">Back to my room' + ICON.arrow + '</a>')
    + '<a class="btn btn--ghost" href="' + groupHref(g.id) + '">My words</a></div></div></section>';
  placeBursts(main);
  window.scrollTo(0, 0);
}

// The part of a job to carry on from, if it was left halfway.
const firstLeft = (d, g, step, n) => { for (let i = 0; i < n; i += 1) if (!W.stepDay(d, g, step + ':' + i)) return i; return 0; };
const markPart = (g, step, i) => { const day = today(); S.updateWords((d) => W.markStep(d, g, step + ':' + i, day, Date.now())); };

/* ------------------------------------------------------------ Hello words --- */
function wordCard(w, clue) {
  const m = w.meaning;
  return '<div class="card wordcard">' + picture(w) + '<div class="wordcard__body">'
    + '<div class="wordcard__word">' + chunked(w, '', { tricky: true }) + '</div>'
    + (w.ipa ? '<div class="wordcard__line"><span class="ipa">' + esc(w.ipa) + '</span><span class="pill">' + esc(m.partOfSpeech) + '</span></div>' : '')
    + (m.definition ? '<p>' + esc(m.definition) + '</p>' : '')
    + (m.example ? '<p class="example">' + boldWord(m.example, w.word) + '</p>' : '')
    + (w.chunks.length > 1 ? '<p class="chunktext">Syllables: ' + esc(w.chunks.join(' · ')) + '</p>' : '')
    + (w.tricky ? '<p class="chunktext">Tricky letters: ' + esc(w.tricky) + '</p>' : '')
    + (clue ? '<p class="small"><b>Your clue:</b> ' + esc(clue) + '</p>' : '')
    + '<div class="btnrow"><button type="button" class="btn btn--quiet btn--small" data-hear>' + ICON.play + 'Hear it</button>'
    + '<button type="button" class="btn btn--quiet btn--small" data-spell>' + ICON.spell + 'Spell it out</button>'
    + (m.example ? '<button type="button" class="btn btn--quiet btn--small" data-example>Hear the example</button>' : '') + '</div>'
    + '</div></div>';
}
function wireWordCard(main, w) {
  main.querySelector('[data-hear]').addEventListener('click', () => speak(w.word));
  main.querySelector('[data-spell]').addEventListener('click', () => spellOut(w.word, (i) => {
    main.querySelectorAll('.chunked__letter').forEach((el) => el.classList.toggle('is-on', Number(el.dataset.i) === i));
  }));
  const ex = main.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => sayLine(w.meaning.example));
}

function hello(main, g) {
  const list = W.rows(g);
  let i = firstLeft(S.readWords(), g, 'hello', list.length);
  let endGame = null;
  let stopped = false;
  function card() {
    const w = entryFor(list[i]);
    main.innerHTML = '<section class="wrap page">' + head('hello', '<h1>Word ' + (i + 1) + ' of ' + list.length + '</h1>')
      + wordCard(w, W.clueFor(S.readWords(), w.word))
      + '<div class="btnrow"><button type="button" class="btn btn--primary" data-play>Play the flower game' + ICON.arrow + '</button></div></section>';
    wireWordCard(main, w);
    main.querySelector('[data-play]').addEventListener('click', () => {
      stop();
      endGame = runSession(main, { eyebrow: 'Hello words', title: 'Word ' + (i + 1) + ' of ' + list.length, words: [w], mode: 'mini', lastLabel: i + 1 < list.length ? 'Next word' : 'Finish', onFinish: next });
    });
    speak(w.word);
    window.scrollTo(0, 0);
  }
  function next() {
    endGame = null;
    markPart(g, 'hello', i);
    i += 1;
    if (i < list.length) card(); else finishStep(main, g, 'hello');
  }
  meaningsFor(list).then(() => { if (!stopped) card(); });
  return () => { stopped = true; if (endGame) endGame(); stop(); };
}

/* -------------------------------------------------------------- Fix it in --- */
// Look, say, cover, write, check; then the word is typed until it's clean 3
// times in a row. A slip goes back to Look and starts the count again. `start`:
// a row to open first, from "Come back to this".
function fix(main, g, start) {
  const rows = W.rows(g);
  const trickyList = new Set(S.trickyWords().map((t) => t.word));
  const left = () => W.queue(S.readWords(), g, today(), 'x');
  const first = rows[Number(start)];
  let word = first !== undefined && left().includes(first) ? first : left()[0];
  if (word === undefined) { location.replace(groupHref(g.id)); return undefined; }
  let typed = '';
  let peeks = 0;
  let phase = 'look';
  let slipped = false; // this word needed another go
  let timer = null;
  const w = () => entryFor(word);
  const count = () => W.sessionCount(S.readWords(), g, word, today(), 'x');
  const skipBtn = '<div class="btnrow btnrow--center"><button type="button" class="btn btn--ghost" data-skip>Skip for now</button></div>';
  const page = (title, body, n = count()) => {
    main.innerHTML = '<section class="wrap page spellpage">' + head('fix', '<h1>' + esc(title) + '</h1><p class="muted">Word ' + (rows.indexOf(word) + 1) + ' of ' + rows.length + '</p><p class="rowcount" data-row>' + rowCountHtml(n) + '</p>') + body + '</section>';
    const b = main.querySelector('[data-skip]');
    if (b) b.addEventListener('click', skip);
    window.scrollTo(0, 0);
  };
  const button = (sel, fn) => main.querySelector(sel).addEventListener('click', fn);

  function look(line = '') {
    phase = 'look';
    page('Look and say', (line ? '<p class="spellline" role="status">' + esc(line) + '</p>' : '') + '<div class="card spell"><div class="spell__word">' + chunked(w(), '', { tricky: true }) + '</div>'
      + '<p class="muted">Look at the word. Say it out loud.</p>'
      + (W.clueFor(S.readWords(), w().word) ? '<p class="small"><b>Your clue:</b> ' + esc(W.clueFor(S.readWords(), w().word)) + '</p>' : '')
      + '<div class="btnrow btnrow--center"><button type="button" class="btn btn--ghost" data-hear>' + ICON.play + 'Hear it</button>'
      + '<button type="button" class="btn btn--primary" data-cover>Cover it' + ICON.arrow + '</button></div></div>' + skipBtn);
    button('[data-hear]', () => speak(w().word));
    button('[data-cover]', cover);
    speak(w().word);
  }
  function cover() {
    phase = 'cover';
    stop();
    page('Cover and write', '<div class="card spell"><p>The word is hidden. Write it on paper.</p>'
      + '<div class="btnrow btnrow--center"><button type="button" class="btn btn--ghost" data-hear>' + ICON.play + 'Hear it</button>'
      + '<button type="button" class="btn btn--primary" data-written>I\'ve written it' + ICON.arrow + '</button></div></div>' + skipBtn);
    button('[data-hear]', () => speak(w().word));
    button('[data-written]', type);
  }
  function type(line = '') {
    phase = 'type';
    typed = '';
    peeks = 0;
    page('Now type it', '<p class="peek" data-peek aria-live="polite"></p><p class="spellline" role="status">' + esc(typeof line === 'string' ? line : '') + '</p><p class="answerline" data-answer aria-live="polite" aria-label="Your answer"></p>'
      + '<div class="btnrow btnrow--center"><button type="button" class="btn btn--ghost" data-hear>' + ICON.play + 'Hear it</button><button type="button" class="btn btn--ghost" data-peekbtn>Peek</button></div>' + keyboard()
      + '<div class="btnrow btnrow--center testbtns"><button type="button" class="btn btn--ghost" data-del>Delete</button>'
      + '<button type="button" class="btn btn--primary" data-check>Check' + ICON.arrow + '</button></div>' + skipBtn);
    main.querySelectorAll('.key').forEach((k) => k.addEventListener('click', () => put(k.dataset.letter)));
    button('[data-hear]', () => speak(w().word));
    button('[data-peekbtn]', peek);
    button('[data-del]', del);
    button('[data-check]', check);
    speak(w().word);
  }
  function peek() {
    peeks += 1;
    main.querySelector('[data-row]').innerHTML = rowCountHtml(0);
    main.querySelector('[data-peek]').textContent = w().word;
    main.querySelector('[data-peekbtn]').disabled = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (phase !== 'type') return;
      main.querySelector('[data-peek]').textContent = '';
      main.querySelector('[data-peekbtn]').disabled = false;
    }, 2000);
  }
  const show = () => { main.querySelector('[data-answer]').textContent = typed; };
  function put(L) { if (typed.length < 24) { typed += L.toLowerCase(); show(); } }
  function del() { typed = typed.slice(0, -1); show(); }
  function record(right) {
    const day = today();
    S.updateWords((d) => W.addTry(d, { id: S.newId(), word: w().word, day, group: g.id, kind: 'p', tries: right ? 0 : 1, peeks, clean: right && !peeks, source: 'x', now: Date.now() }));
  }
  function check() {
    if (!typed) { toast('Type the word first'); return; }
    phase = 'check';
    const right = R.checkAnswer(w().word, typed);
    record(right);
    const clean = right && !peeks;
    if (clean && count() < W.ROW_NEEDED) { type('Clean! Now again, all on your own.'); return; }
    if (!clean) slipped = true;
    page(clean ? 'Check' : 'Let\'s try that one again', '<div class="card result ' + (clean ? 'result--good' : 'result--bad') + '"><div class="result__head"><span class="result__badge">' + (clean ? '✓' : '×') + '</span><h2>' + (clean ? 'That\'s it' : right ? 'Right, with a peek' : 'Not quite yet') + '</h2></div>'
      + '<div class="result__word">' + chunked(w(), '', { tricky: true }) + '</div>'
      + (right ? '' : '<p class="muted">You wrote: <b>' + esc(typed) + '</b></p>')
      + '<div class="btnrow"><button type="button" class="btn btn--primary" data-go>' + (clean ? 'Next' : 'Look again') + ICON.arrow + '</button></div></div>');
    button('[data-go]', clean ? afterWord : () => look());
    main.querySelector('[data-go]').focus({ preventScroll: true });
    if (clean) speak(w().word);
  }
  function afterWord() {
    const e = w();
    if ((e.tricky || trickyList.has(e.word) || slipped) && !W.clueFor(S.readWords(), e.word)) clue(); else nextWord();
  }
  function clue() {
    phase = 'clue';
    const options = St.clueOptions(w());
    page('A memory clue', '<div class="card setting"><p>A clue can help a tricky word stick. Pick one, or type your own.</p>'
      + '<div class="list">' + options.map((c, n) => '<button type="button" class="btn btn--quiet" data-clue="' + n + '">' + esc(c) + '</button>').join('') + '</div>'
      + '<form class="btnrow" data-own><input class="field typedword" maxlength="' + W.MAX_CLUE + '" aria-label="Your own clue" placeholder="My clue" data-text><button type="submit" class="btn btn--quiet">Save</button></form>'
      + '<div class="btnrow"><button type="button" class="btn btn--ghost" data-noclue>Not now</button></div></div>');
    const save = (text) => { S.updateWords((d) => W.setClue(d, w().word, text, Date.now())); nextWord(); };
    main.querySelectorAll('[data-clue]').forEach((b) => b.addEventListener('click', () => save(options[Number(b.dataset.clue)])));
    main.querySelector('[data-own]').addEventListener('submit', (e) => { e.preventDefault(); const t = main.querySelector('[data-text]').value; if (t.trim()) save(t); });
    button('[data-noclue]', nextWord);
  }
  function nextWord() {
    slipped = false;
    word = left()[0];
    if (word !== undefined) look(); else { phase = 'end'; finishStep(main, g, 'fix'); }
  }
  // The word moves to the end of today's list. With nothing else left, back to the list: the job stays open.
  function skip() {
    const day = today();
    if (phase === 'type' && peeks) record(true); // a peek still ends the run, as leaving does
    S.updateWords((d) => W.addSkip(d, { id: S.newId(), group: g.id, word, day, flow: 'x', now: Date.now() }));
    const others = left().filter((x) => x !== word);
    phase = 'end';
    if (!others.length) { location.hash = groupHref(g.id); return; }
    word = others[0];
    slipped = false;
    look();
  }
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey || phase !== 'type') return;
    if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); put(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); del(); } else if (e.key === 'Enter') { e.preventDefault(); check(); }
  }
  document.addEventListener('keydown', onKey);
  look();
  return () => {
    clearTimeout(timer);
    if (phase === 'type' && peeks) record(true); // left after a peek: that still ends the run
    document.removeEventListener('keydown', onKey);
    stop();
  };
}

/* ------------------------------------------------------------- Game day --- */
function gameDay(main, g) {
  return playGames(main, g, { eyebrow: 'Game day', part: 'games', onDone: () => finishStep(main, g, 'games') });
}
function mend(main, g) {
  return playGames(main, g, { eyebrow: 'Mend and keep', games: ['quick'], onDone: () => finishStep(main, g, 'mend') });
}

/* ------------------------------------------------------- writing sentences --- */
/** Write one sentence for each of `words`, then onDone(). */
export function sentences(main, g, onDone) {
  const words = St.sentenceWords(S.readWords(), g);
  const left = [...words];
  let note = '';
  let draft = '';
  function draw() {
    const w = left[0];
    if (!w) { onDone(); return; }
    main.innerHTML = '<section class="wrap page">' + head('story', '<h1>Write a sentence</h1><p class="muted">' + (words.length - left.length + 1) + ' of ' + words.length + '</p>') + '<div class="card setting">'
      + '<p>Use this word in a sentence of your own:</p><p class="today__word">' + chunked(entryFor(w)) + '</p>'
      + '<div class="btnrow"><button type="button" class="btn btn--quiet btn--small" data-hear>' + ICON.play + 'Hear it</button></div>'
      + '<label class="small muted" for="sentence">Your sentence</label><textarea id="sentence" class="field" rows="3" maxlength="' + W.MAX_NOTE + '" data-text>' + esc(draft) + '</textarea>'
      + '<p class="small" data-note role="status">' + esc(note) + '</p>'
      + '<div class="btnrow"><button type="button" class="btn btn--primary" data-save>Save' + ICON.arrow + '</button></div></div></section>';
    const box = main.querySelector('[data-text]');
    box.addEventListener('input', () => { draft = box.value; });
    main.querySelector('[data-hear]').addEventListener('click', () => speak(w));
    main.querySelector('[data-save]').addEventListener('click', () => {
      const problem = St.checkSentence(box.value, w);
      if (problem) { note = problem; main.querySelector('[data-note]').textContent = note; return; }
      const day = today();
      S.updateWords((d) => W.addNote(d, { id: S.newId(), group: g.id, word: w, text: box.value, day, now: Date.now() }));
      left.shift();
      note = '';
      draft = '';
      draw();
      window.scrollTo(0, 0);
    });
    speak(w);
  }
  draw();
}

function examples(main, g, go) {
  const list = W.rows(g).map(entryFor).filter((w) => w.meaning.example);
  main.innerHTML = '<section class="wrap page">' + head('story', '<h1>Your words at work</h1><p class="muted">Read each sentence and listen for your word.</p>')
    + '<div class="list">' + list.map((w, i) => '<div class="card listrow"><p class="example">' + boldWord(w.meaning.example, w.word) + '</p><button type="button" class="btn btn--quiet btn--small" data-say="' + i + '" aria-label="Hear this sentence">' + ICON.play + '</button></div>').join('') + '</div>'
    + '<div class="btnrow"><button type="button" class="btn btn--primary" data-go>Write my sentences' + ICON.arrow + '</button></div></section>';
  main.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => sayLine(list[Number(b.dataset.say)].meaning.example)));
  main.querySelector('[data-go]').addEventListener('click', () => { stop(); go(); });
}
// A group from a chapter with a story a grown-up has reviewed reads it aloud; any other group has the examples.
function storyDay(main, g) {
  let stopped = false;
  let end = null;
  const write = () => sentences(main, g, () => finishStep(main, g, 'story'));
  Promise.all([loadStories(), meaningsFor(W.rows(g))]).then(([stories]) => {
    if (stopped) return;
    const story = storyFor(stories, g, D.allChapters());
    if (story) end = storyPage(main, g, story, write); else examples(main, g, write);
  });
  return () => { stopped = true; if (end) end(); stop(); };
}

/* ---------------------------------------------------------------- routes --- */
const PAGES = { hello, fix, games: gameDay, story: storyDay, mend };

export function studyStep(main, { gid, step, n }) {
  const id = decodeURIComponent(gid);
  const d = S.readWords();
  const g = W.groupById(d, id);
  if (!g) { location.replace('#/words'); return undefined; }
  if (!PAGES[step] || !St.canOpen(d, g, step, today())) { location.replace(groupHref(id)); return undefined; }
  if (step === 'mend' && St.mendPart(d, g, today()) === 'fixups') { location.replace(groupHref(id)); return undefined; }
  return PAGES[step](main, g, n);
}

// The week strip: one badge a job. Used by the group page and My room.
export function stripHtml(steps, day) {
  return '<ol class="weekstrip" aria-label="This week">' + steps.map((s) => '<li class="weekstrip__day is-' + s.state + '"' + (s.state === 'today' ? ' aria-current="step"' : '') + '>'
    + '<span class="weekstrip__badge">' + (s.state === 'done' ? ICON.star : s.n) + '</span><span class="weekstrip__name">' + esc(s.short) + '</span>'
    + '<span class="sr">' + esc(s.title + ': ' + ({ done: 'done', today: 'today', waiting: 'waiting for you', later: 'on ' + W.dayLabel(s.date), passed: 'passed over' }[s.state])) + '</span>'
    + '<span class="weekstrip__date" aria-hidden="true">' + (s.date === day ? 'Today' : esc(W.dayParts(s.date).join(' '))) + '</span></li>').join('') + '</ol>';
}

/** Today's skipped words, each a link back to it. */
export function comeBackHtml(g, list) {
  if (!list.length) return '';
  return '<h2 class="sectionhead">Come back to this</h2><div class="list">' + list.map((x) => '<a class="card listrow" href="' + comeBackHref(g, x.word, x.flow) + '" data-comeback><strong>' + esc(x.word) + '</strong><span class="pill pill--warm">Come back to this</span></a>').join('') + '</div>';
}

/** Each word and its dots. On a day the words can't be shown: only the dots. */
export function dotsListHtml(list, hideWords) {
  return '<ul class="dotlist">' + list.map((x, i) => '<li><span>' + (hideWords ? 'Word ' + (i + 1) : esc(x.word)) + '</span>' + dotsHtml(x.dots, W.ROW_NEEDED) + '</li>').join('') + '</ul>';
}
