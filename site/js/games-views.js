// Game mode's pages, and the games themselves: on Game day, in Mend and keep and
// any time from Game mode. The rules are in games-doc.js. Every game speaks its
// words (the bundled recording, then the Waystead voice, then the device) and
// takes the on-screen and the physical keyboard.
import * as D from './data.js';
import * as S from './store.js';
import * as W from './words-doc.js';
import * as St from './study-doc.js';
import * as R from './spell-run.js';
import * as G from './games-doc.js';
import { entryFor, hasMeaning, meaningsFor } from './word-info.js';
import { speak, stop } from './speech.js';
import { burstHtml, placeBursts } from './celebrate.js';
import { esc, ICON, chunked, keyboard, toast, RETRY_LINE } from './ui.js';
import * as C from './child-doc.js';
import { dotsListHtml } from './study-views.js';
import { modeSwitch } from './words-views.js';

const today = () => W.localDay(Date.now());
const groupHref = (id) => '#/words/g/' + encodeURIComponent(id);
const plural = (n, one) => n + ' ' + one + (n === 1 ? '' : 's');
const plainKey = (e) => !(e.metaKey || e.ctrlKey || e.altKey);

function pageHtml(ctx, title, n, body) {
  return '<section class="wrap page spellpage game" data-game="' + title.id + '"><div class="pagehead"><span class="eyebrow">' + esc(ctx.eyebrow) + '</span><h1>' + esc(title.text) + '</h1>'
    + (n ? '<p class="muted">' + esc(n) + '</p>' : '') + '</div>' + body + '</section>';
}
// The same Hear and Skip rows as practice: one big "Hear the word", Skip as a link.
const heard = () => '<div class="btnrow btnrow--center"><button type="button" class="btn btn--primary btn--wide" data-hear>' + ICON.play + 'Hear the word</button></div>'
  + '<div class="skiprow"><button type="button" class="linkbtn" data-skip>' + C.SKIP_TEXT + '</button></div>';

function wordDone(ctx, slot, w, clean, next, last) {
  slot.innerHTML = '<div class="card result ' + (clean ? 'result--good' : 'result--bad') + '"><div class="result__head">'
    + (clean ? '<span class="celebrate"><span class="result__badge">✓</span>' + burstHtml(10, 1.2) + '</span>' : '<span class="result__badge">•</span>')
    + '<h2>' + (clean ? 'Clean!' : 'You got there') + '</h2></div><div class="result__word">' + chunked(entryFor(w)) + '</div>'
    + '<div class="btnrow"><button type="button" class="btn btn--primary" data-next>' + (last ? 'Finish' : 'Next word') + ICON.arrow + '</button></div></div>';
  placeBursts(slot);
  const b = slot.querySelector('[data-next]');
  b.addEventListener('click', next);
  b.focus({ preventScroll: true });
}

/* ------------------------------------------------------- Missing letters --- */
function missing(main, ctx, done) {
  let words = ctx.order();
  let w = '';
  let blanks = [];
  let run = null;
  let live = false;
  function show(line = '') {
    const e = entryFor(words[0]);
    w = e.word;
    blanks = G.blanksFor(e);
    run = G.newMissing(w, blanks);
    live = true;
    main.innerHTML = pageHtml(ctx, { id: 'missing', text: G.GAMES.missing.title }, ctx.leftLine(words),
      '<div class="spellboxes" aria-label="The word with letters missing">' + [...w].map((c, n) => '<span class="spellbox' + (blanks.includes(n) ? '" data-gap="' + blanks.indexOf(n) + '">' : ' is-filled">' + esc(c)) + '</span>').join('') + '</div>'
      + '<p class="spellline" data-line role="status" aria-live="polite">' + esc(line) + '</p>'
      + '<div data-slot>' + heard() + keyboard() + '</div>');
    main.querySelector('[data-hear]').addEventListener('click', () => speak(w));
    main.querySelector('[data-skip]').addEventListener('click', skip);
    main.querySelectorAll('.key').forEach((k) => k.addEventListener('click', () => letter(k.dataset.letter)));
    mark();
    speak(w);
    window.scrollTo(0, 0);
  }
  const mark = () => main.querySelectorAll('[data-gap]').forEach((b) => b.classList.toggle('is-next', Number(b.dataset.gap) === run.at));
  function letter(L) {
    if (!live) return;
    const at = run.at;
    const r = R.typeLetter(run, L);
    run = r.run;
    const line = main.querySelector('[data-line]');
    if (!r.hit) { line.textContent = R.wrongLine(run.tries); return; }
    const box = main.querySelector('[data-gap="' + at + '"]');
    box.textContent = run.word[at];
    box.classList.add('is-filled');
    line.textContent = '';
    mark();
    if (r.finished) {
      live = false;
      const p = G.passOf(run);
      ctx.record(w, p);
      words = G.afterPass(words, p.clean);
      if (!p.clean) { show(RETRY_LINE); return; }
      wordDone(ctx, main.querySelector('[data-slot]'), w, p.clean, () => (words.length ? show() : done()), !words.length);
      speak(w);
    }
  }
  function skip() {
    if (!live) return;
    if (R.mustRecord(run)) ctx.record(w, { tries: run.tries, clean: false });
    ctx.skip(w);
    words = G.afterSkip(words);
    show();
  }
  function onKey(e) {
    if (plainKey(e) && /^[a-z]$/i.test(e.key)) { e.preventDefault(); letter(e.key); }
  }
  document.addEventListener('keydown', onKey);
  show();
  return () => {
    document.removeEventListener('keydown', onKey);
    if (live && R.mustRecord(run)) ctx.record(w, { tries: run.tries, clean: false }); // left halfway after a mistake
  };
}

/* -------------------------------------------------------------- Unjumble --- */
function unjumble(main, ctx, done) {
  let words = ctx.order();
  let w = '';
  let run = null;
  let live = false;
  function show(line = '') {
    w = entryFor(words[0]).word;
    run = R.newRun(w);
    live = true;
    main.innerHTML = pageHtml(ctx, { id: 'unjumble', text: G.GAMES.unjumble.title }, ctx.leftLine(words),
      '<div class="spellboxes" aria-label="Your word, ' + w.length + ' letters">' + [...w].map((_, n) => '<span class="spellbox" data-box="' + n + '"></span>').join('') + '</div>'
      + '<p class="spellline" data-line role="status" aria-live="polite">' + esc(line) + '</p>'
      + '<div data-slot>' + heard() + '<div class="tiles-row" role="group" aria-label="Letters">' + G.jumble(w).map((c) => '<button type="button" class="key tile" data-tile="' + esc(c.toLowerCase()) + '">' + esc(c.toUpperCase()) + '</button>').join('') + '</div></div>');
    main.querySelector('[data-hear]').addEventListener('click', () => speak(w));
    main.querySelector('[data-skip]').addEventListener('click', skip);
    main.querySelectorAll('[data-tile]').forEach((t) => t.addEventListener('click', () => tap(t)));
    speak(w);
    window.scrollTo(0, 0);
  }
  function tap(tile) {
    if (!live) return;
    const at = run.at;
    const r = R.typeLetter(run, tile.dataset.tile);
    run = r.run;
    const line = main.querySelector('[data-line]');
    if (!r.hit) { line.textContent = R.wrongLine(run.tries); return; }
    const box = main.querySelector('[data-box="' + at + '"]');
    box.textContent = w[at];
    box.classList.add('is-filled');
    tile.disabled = true;
    tile.classList.add('hit');
    line.textContent = '';
    if (r.finished) {
      live = false;
      const p = G.passOf(run);
      ctx.record(w, p);
      words = G.afterPass(words, p.clean);
      if (!p.clean) { show(RETRY_LINE); return; }
      wordDone(ctx, main.querySelector('[data-slot]'), w, p.clean, () => (words.length ? show() : done()), !words.length);
      speak(w);
    }
  }
  function skip() {
    if (!live) return;
    if (R.mustRecord(run)) ctx.record(w, { tries: run.tries, clean: false });
    ctx.skip(w);
    words = G.afterSkip(words);
    show();
  }
  function onKey(e) {
    if (!plainKey(e) || !/^[a-z]$/i.test(e.key) || !live) return;
    e.preventDefault();
    const want = w[run.at].toLowerCase();
    const key = e.key.toLowerCase();
    const free = [...main.querySelectorAll('[data-tile]:not(:disabled)')];
    // A typed letter takes its tile; one that isn't left still counts as a wrong letter.
    const tile = free.find((t) => t.dataset.tile === key && key === want) || free.find((t) => t.dataset.tile === key) || { dataset: { tile: key } };
    tap(tile);
  }
  document.addEventListener('keydown', onKey);
  show();
  return () => {
    document.removeEventListener('keydown', onKey);
    if (live && R.mustRecord(run)) ctx.record(w, { tries: run.tries, clean: false });
  };
}

/* --------------------------------------------------------- Meaning match --- */
function match(main, ctx, done) {
  const entries = ctx.words.map(entryFor).filter((e) => hasMeaning(e.word));
  if (!entries.length) { Promise.resolve().then(done); return () => {}; }
  const spare = D.allWords().filter((e) => !ctx.words.includes(e.word));
  const rounds = G.matchRounds(entries, spare);
  let r = 0;
  let state = G.newMatch();
  let chosen = '';
  function draw(line = '') {
    const round = rounds[r];
    main.innerHTML = pageHtml(ctx, { id: 'match', text: G.GAMES.match.title }, 'Round ' + (r + 1) + ' of ' + rounds.length,
      '<p class="spellline" data-line role="status" aria-live="polite">' + esc(line || (chosen ? 'Now tap what it means.' : 'Tap a word.')) + '</p>'
      + '<div class="matchgrid"><div class="matchcol" role="group" aria-label="Words">' + round.cards.map((c, n) => '<button type="button" class="matchcard matchcard--word' + (c.word === chosen ? ' is-on' : '') + (state.matched.includes(c.word) ? ' is-done' : '') + '" data-word="' + n + '"' + (state.matched.includes(c.word) ? ' disabled' : '') + '><span class="matchcard__key" aria-hidden="true">' + (n + 1) + '</span>' + esc(c.word) + '</button>').join('') + '</div>'
      + '<div class="matchcol" role="group" aria-label="Meanings">' + round.meanings.map((m, n) => {
        const used = round.cards.some((c) => c.meaning === m && state.matched.includes(c.word));
        return '<button type="button" class="matchcard' + (used ? ' is-done' : '') + '" data-meaning="' + n + '"' + (used ? ' disabled' : '') + '><span class="matchcard__key" aria-hidden="true">' + 'ABCD'[n] + '</span>' + esc(m) + '</button>';
      }).join('') + '</div></div>');
    main.querySelectorAll('[data-word]').forEach((b) => b.addEventListener('click', () => pickWord(Number(b.dataset.word))));
    main.querySelectorAll('[data-meaning]').forEach((b) => b.addEventListener('click', () => pickMeaning(Number(b.dataset.meaning))));
  }
  function pickWord(n) {
    const c = rounds[r].cards[n];
    if (!c || state.matched.includes(c.word)) return;
    chosen = c.word;
    draw();
    speak(c.word);
  }
  function pickMeaning(n) {
    const round = rounds[r];
    if (!chosen) { draw('Tap a word first.'); return; }
    const m = round.meanings[n];
    if (m === undefined || round.cards.some((c) => c.meaning === m && state.matched.includes(c.word))) return;
    const got = G.pickMatch(state, round, chosen, m);
    state = got.state;
    if (!got.hit) { draw('Not that one. Try another.'); return; }
    chosen = '';
    if (!G.matchDone(state, round)) { draw('That\'s a match.'); return; }
    G.matchPasses(state, round).forEach((p) => ctx.record(p.word, p)); // source 'm': no dot
    r += 1;
    state = G.newMatch();
    if (r < rounds.length) { draw(); window.scrollTo(0, 0); } else done();
  }
  function onKey(e) {
    if (!plainKey(e)) return;
    if (/^[1-4]$/.test(e.key)) { e.preventDefault(); pickWord(Number(e.key) - 1); } else if (/^[a-d]$/i.test(e.key)) { e.preventDefault(); pickMeaning('abcd'.indexOf(e.key.toLowerCase())); }
  }
  document.addEventListener('keydown', onKey);
  draw();
  return () => { document.removeEventListener('keydown', onKey); };
}

/* ------------------------------------------------------------- Quick-fire --- */
function quick(main, ctx, done) {
  let words = ctx.order();
  let w = '';
  let typed = '';
  let live = false;
  let timer = null;
  function ask(line = '') {
    w = entryFor(words[0]).word;
    typed = '';
    live = true;
    main.innerHTML = pageHtml(ctx, { id: 'quick', text: G.GAMES.quick.title }, ctx.leftLine(words),
      '<div class="gentlebar" aria-hidden="true"><span data-bar></span></div>'
      + '<p class="spellline" data-line role="status" aria-live="polite">' + esc(line) + '</p>'
      + '<p class="answerline" data-answer aria-live="polite" aria-label="Your answer"></p>'
      + '<div data-slot>' + heard() + keyboard({ del: true })
      + '<div class="btnrow btnrow--center testbtns"><button type="button" class="btn btn--primary btn--wide" data-go>Next' + ICON.arrow + '</button></div></div>');
    main.querySelector('[data-hear]').addEventListener('click', () => speak(w));
    main.querySelector('[data-del]').addEventListener('click', del);
    main.querySelector('[data-go]').addEventListener('click', submit);
    main.querySelector('[data-skip]').addEventListener('click', skip);
    main.querySelectorAll('.key[data-letter]').forEach((k) => k.addEventListener('click', () => put(k.dataset.letter)));
    const secs = G.quickSeconds(w);
    main.querySelector('[data-bar]').style.setProperty('--secs', secs + 's');
    clearTimeout(timer);
    timer = setTimeout(() => { // the timer only ever says this
      if (!live) return;
      main.querySelector('[data-line]').textContent = 'Take your time.';
      speak(w);
    }, secs * 1000);
    speak(w);
    window.scrollTo(0, 0);
  }
  const show = () => { main.querySelector('[data-answer]').textContent = typed; };
  function put(L) { if (live && typed.length < 24) { typed += L.toLowerCase(); show(); } }
  function del() { if (live) { typed = typed.slice(0, -1); show(); } }
  function submit() {
    if (!live) return;
    if (!typed) { toast('Type the word first'); return; }
    live = false;
    clearTimeout(timer);
    const p = G.quickPass(w, typed);
    ctx.record(w, p);
    words = G.afterPass(words, p.clean);
    if (!p.clean) { ask(RETRY_LINE); return; }
    wordDone(ctx, main.querySelector('[data-slot]'), w, p.clean, () => (words.length ? ask() : done()), !words.length);
    speak(w);
  }
  function skip() {
    if (!live) return;
    live = false;
    clearTimeout(timer);
    ctx.skip(w);
    words = G.afterSkip(words);
    ask();
  }
  function onKey(e) {
    if (!plainKey(e)) return;
    if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); put(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); del(); } else if (e.key === 'Enter' && live) { e.preventDefault(); submit(); }
  }
  document.addEventListener('keydown', onKey);
  ask();
  return () => { clearTimeout(timer); document.removeEventListener('keydown', onKey); };
}

const PLAY = { missing, unjumble, match, quick };

/**
 * Play these games in turn with the group's words (those back again too).
 * part: mark each game done under this job, so a job left halfway carries on.
 */
export function playGames(main, g, { eyebrow, games = G.GAME_IDS, part = '', onDone }) {
  const words = W.rows(g);
  let end = null;
  let stopped = false;
  const record = (word, pass) => {
    const day = today();
    S.updateWords((d) => G.recordPass(d, g, word, pass, { id: S.newId(), day, now: Date.now() }));
  };
  const left = part ? games.filter((id) => !W.stepDay(S.readWords(), g, part + ':' + id)) : [...games];
  const list = left.length ? left : [...games];
  let n = 0;
  function next() {
    if (stopped) return;
    if (n >= list.length) { onDone(); return; }
    const id = list[n];
    n += 1;
    const skip = (word) => { const day = today(); S.updateWords((d) => W.addSkip(d, { id: S.newId(), group: g.id, word, day, flow: 'g:' + id, now: Date.now() })); };
    // Today's skipped words wait at the end, here and on another device.
    const order = () => W.inTurn(S.readWords(), g, G.shuffled(words), today(), 'g:' + id);
    const leftLine = (l) => plural(l.length, 'word') + ' to go';
    const ctx = { eyebrow: eyebrow + (list.length > 1 ? ' · game ' + n + ' of ' + list.length : ''), words, record, skip, order, leftLine };
    end = PLAY[id](main, ctx, () => {
      if (end) end(); // its keys stop here, or they'd reach the next game
      end = null;
      if (part) { const day = today(); S.updateWords((d) => W.markStep(d, g, part + ':' + id, day, Date.now())); }
      next();
    });
  }
  meaningsFor(words).then(next);
  return () => { stopped = true; if (end) end(); stop(); };
}

/* ------------------------------------------------------------- Game mode --- */
export function gameMode(main, { gid }) {
  const id = decodeURIComponent(gid);
  const d = S.readWords();
  const g = W.groupById(d, id);
  if (!g) { location.replace('#/'); return; }
  main.innerHTML = '<section class="wrap page"><div class="pagehead"><span class="eyebrow">My words</span><h1>' + esc(g.name) + '</h1>'
    + '<p class="muted">The same words, any time.</p></div>' + modeSwitch(g, 'game')
    + '<div class="shortcuts gamecards">' + G.GAME_IDS.map((k) => '<a class="card shortcut" href="' + groupHref(id) + '/game/' + k + '"><span><strong>' + esc(G.GAMES[k].title) + '</strong><br><span class="muted small">' + esc(G.GAMES[k].line) + '</span></span>' + ICON.arrow + '</a>').join('') + '</div>'
      + '<h2 class="sectionhead">Practise 3 times</h2>' + dotsListHtml(W.allDots(d, g, today()), false)
    + '</section>';
}

export function oneGame(main, { gid, game }) {
  const id = decodeURIComponent(gid);
  const d = S.readWords();
  const g = W.groupById(d, id);
  if (!g) { location.replace('#/'); return undefined; }
  if (!PLAY[game]) { location.replace(groupHref(id) + '/games'); return undefined; }
  return playGames(main, g, {
    eyebrow: g.name,
    games: [game],
    onDone: () => {
      const now = S.readWords();
      main.innerHTML = '<section class="wrap page"><div class="card result result--good"><div class="result__head"><span class="celebrate"><span class="result__badge">✓</span>' + burstHtml(12, 1.3) + '</span><h1>' + esc(G.GAMES[game].title) + ' done</h1></div>'
        + dotsListHtml(W.allDots(now, g, today()), false)
        + '<div class="btnrow"><a class="btn btn--primary" href="' + groupHref(id) + '/games">More games' + ICON.arrow + '</a><a class="btn btn--ghost" href="' + groupHref(id) + '">My words</a></div></div></section>';
      placeBursts(main);
    },
  });
}
