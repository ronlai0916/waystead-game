// Study mode's pages: Hello words, Fix it in, Game day, Story day and Mend and
// keep. Practice day and Test day are the grid and the test (words-views.js).
// The rules are in study-doc.js. Signed in only (gate.js).
import * as D from './data.js';
import * as S from './store.js';
import * as W from './words-doc.js';
import * as St from './study-doc.js';
import * as R from './spell-run.js';
import { entryFor, meaningsFor, shown } from './word-info.js';
import { speak, spellOut, sayLine, stop } from './speech.js';
import { loadStories, storyFor } from './stories.js';
import { storyPage } from './story-views.js';
import { playGames } from './games-views.js';
import { burstHtml, placeBursts } from './celebrate.js';
import { runSession } from './play.js';
import { esc, ICON, chunked, boldWord, keyboard, toast, dotsHtml, rowCountHtml, inARowHtml, pictureState, picture } from './ui.js';
import * as C from './child-doc.js';
import * as G from './games-doc.js';
import * as A from './assess-doc.js';
import * as Tr from './tray.js';
import * as K from './sbs-week-doc.js'; // SB6: which way a stone runs, and the Step by step names
import * as SD from './sentence-doc.js';
import { sbsStone } from './sbs-views.js';
import { buildSentence, helpMeBuild, HELP_LABEL } from './builder-views.js';
import { hearInSentence, canSentence } from './sentence.js';
import { childYear } from './who.js';
import { peekRowHtml, peekButtonHtml, mountPeek } from './peek.js';
import { peekMs } from './peek-doc.js';
import * as Su from './setup-doc.js';
import { safeDecode } from './chapters-doc.js'; // SB4-WP13: a bad address piece is '' (never throws)

const today = () => W.localDay(Date.now());
const groupHref = (id) => '#/words/g/' + encodeURIComponent(id);
/**
 * TR-61: every control that answers or moves on carries data-fold (check | next | hear | peek | skip | keys), so the fold test can find it.
 * Marked from the attributes the pages already use; a control that has one is left alone.
 */
export function markFold(root) {
  const set = (sel, v) => root.querySelectorAll(sel).forEach((el) => { if (!el.hasAttribute('data-fold')) el.setAttribute('data-fold', v); });
  set('[data-check]', 'check');
  set('[data-go], [data-next], [data-play], [data-cover], [data-save]', 'next');
  set('[data-hear], [data-instruct]', 'hear');
  set('[data-peekbtn]', 'peek');
  set('[data-skip]', 'skip');
  set('.keyboard', 'keys');
}
const wayOf = (d, g, step) => K.wayFor(d, g, step, S.readSetup());
const head = (step, line) => '<div class="pagehead"><span class="eyebrow">' + esc(St.STEP_TEXT[step].title) + '</span>' + line + '</div>';

/** "Come back to this": straight to that word, in the job it was skipped from. */
export function comeBackHref(g, w, flow) {
  const n = W.rows(g).indexOf(w);
  return groupHref(g.id) + (flow === 'x' ? '/study/fix/' + n : '/spell/' + n);
}

/** Where a job's button goes. */
export function stepHref(d, g, step, day) {
  if (step === 'test') return groupHref(g.id) + '/test';
  // Step by step (TR-43): Words in a row and Mend (the fix-ups too) are stones of their own, never the grid
  if ((step === 'practice' || step === 'mend') && wayOf(d, g, step) === 'sbs') return groupHref(g.id) + '/study/' + step;
  if (step === 'practice') return groupHref(g.id) + '/spell/' + W.rows(g).indexOf(W.queue(d, g, day, 'p')[0] ?? W.rows(g)[0]);
  if (step === 'mend' && St.mendPart(d, g, day) === 'fixups') return groupHref(g.id) + '/spell/' + W.rows(g).indexOf(W.queue(d, g, day, 'f')[0]);
  return groupHref(g.id) + '/study/' + step;
}

function finishStep(main, g, step, way = 'usual') {
  const day = today();
  S.updateWords((d) => W.markStep(d, g, step, day, Date.now()));
  const d = S.readWords();
  const sbs = way === 'sbs';
  const names = sbs ? K.STONE_TEXT : St.STEP_TEXT; // a Step by step child sees the stone names
  const s = sbs ? K.weekState(d, g, day) : St.studyState(d, g, day);
  const more = s.status === 'job';
  main.innerHTML = '<section class="wrap page"><div class="card result result--good"><div class="result__head"><span class="celebrate"><span class="result__badge">✓</span>' + burstHtml(12, 1.3) + '</span>'
    + '<h1>' + (more ? esc(names[step].title) + ' done' : 'Done for today!') + '</h1></div>'
    + '<div class="btnrow">' + (more ? '<a class="btn btn--primary" data-fold="next" href="' + stepHref(d, g, s.job, day) + '">Next: ' + esc(names[s.job].title) + ICON.arrow + '</a>' : '<a class="btn btn--primary" data-fold="next" href="#/">Go to Today' + ICON.arrow + '</a>')
    + '<a class="btn btn--ghost" href="' + groupHref(g.id) + '">This week’s words</a></div></div></section>';
  placeBursts(main);
  window.scrollTo(0, 0);
}

// The part of a job to carry on from, if it was left halfway.
const firstLeft = (d, g, step, n) => { for (let i = 0; i < n; i += 1) if (!W.stepDay(d, g, step + ':' + i)) return i; return 0; };
const markPart = (g, step, i) => { const day = today(); S.updateWords((d) => W.markStep(d, g, step + ':' + i, day, Date.now())); };

/* ------------------------------------------------------------ Hello words --- */
const HEAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const roundHear = (attr, label) => '<button type="button" class="hearround" ' + attr + ' aria-label="' + label + '">' + HEAR + '</button>';

// The picture, by state (ui.js pictureState): a picture; "Picture on its way" (a later
// slice: nothing returns 'pending' yet); or none at all, a calm layout with no empty box.
// SB4-WP9: a word with no picture but an example shows the sentence as a card, with Hear; with no example, today's lettered tile.
export const hasSentenceCard = (w) => pictureState(w) === 'none' && !!(w.meaning && w.meaning.example);
export function sentenceCard(w) {
  return '<div class="pic pic--sentence"><p class="example">' + boldWord(w.meaning.example, w.word) + '</p>' + roundHear('data-sentence', 'Hear the sentence') + '</div>';
}
export function wireSentence(root, w) {
  const b = root.querySelector('[data-sentence]');
  if (b) b.addEventListener('click', () => sayLine(w.meaning.example));
}
function helloPicture(w) {
  const st = pictureState(w);
  if (hasSentenceCard(w)) return sentenceCard(w);
  if (st === 'ready') return picture(w);
  if (st === 'pending') return '<div class="nopic nopic--wait"><img class="nopic__pip" src="assets/characters/pip-thinking-256.webp" width="64" height="64" alt=""><p><b>Picture on its way</b><br><span class="muted">Pip is drawing it.</span></p></div>';
  return '';
}

function wordCard(w, clue) {
  const m = w.meaning;
  // 24a: a picture and a short word share one row on a phone (CSS, device.css); a long word and a sentence card keep their own rows
  const row = pictureState(w) === 'ready' && !hasSentenceCard(w) && [...w.word].length <= 8;
  return '<div class="card wordcard wordcard--hello' + (pictureState(w) === 'none' ? ' wordcard--nopic' : '') + (row ? ' wordcard--row' : ' wordcard--stack') + '">' + helloPicture(w)
    + '<div class="wordcard__word">' + chunked(w, '', { tricky: true }) + '</div>'
    + (clue ? '<p class="small"><b>Your clue:</b> ' + esc(clue) + '</p>' : '')
    + '<div class="stackbtns"><button type="button" class="btn btn--primary btn--wide" data-hear>' + ICON.play + 'Hear it</button>'
    + '<button type="button" class="btn btn--ghost btn--wide" data-spell>' + ICON.spell + 'Say the letters</button></div>'
    + (m.definition ? '<div class="means"><h2 class="means__head">What it means</h2><div class="means__row"><p>' + esc(m.definition) + '</p>' + roundHear('data-mean', 'Hear the meaning') + '</div>'
      + (m.example && !hasSentenceCard(w) ? '<div class="means__row"><p class="example">' + boldWord(m.example, w.word) + '</p>' + roundHear('data-example', 'Hear the example') + '</div>' : '') + '</div>' : '')
    + '</div>';
}
function wireWordCard(main, w) {
  main.querySelector('[data-hear]').addEventListener('click', () => speak(w.word));
  main.querySelector('[data-spell]').addEventListener('click', () => spellOut(w.word, (i) => {
    main.querySelectorAll('.chunked__letter').forEach((el) => el.classList.toggle('is-on', Number(el.dataset.i) === i));
  }));
  wireSentence(main, w);
  const ex = main.querySelector('[data-example]');
  if (ex) ex.addEventListener('click', () => sayLine(w.meaning.example));
  const mean = main.querySelector('[data-mean]');
  if (mean) mean.addEventListener('click', () => sayLine(w.meaning.definition));
}

const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const segsHtml = (i, n) => '<div class="segs" role="img" aria-label="Word ' + (i + 1) + ' of ' + n + '">' + Array.from({ length: n }, (_, k) => '<i class="' + (k < i ? 'is-done' : k === i ? 'is-now' : '') + '"></i>').join('') + '</div>';

function hello(main, g) {
  const list = W.rows(g).filter((x) => G.playable(entryFor(x), 'flower')); // "a" and "I" cannot be played on a flower
  if (!list.length) { finishStep(main, g, 'hello'); return () => {}; } // a group of only "a" and "I": nothing to play
  let i = firstLeft(S.readWords(), g, 'hello', list.length);
  let stopped = false;
  let endGame = null;
  function card() {
    const w = shown(entryFor(list[i]));
    main.innerHTML = '<section class="wrap page hellopage"><div class="pagehead"><span class="eyebrow">Word ' + (i + 1) + ' of ' + list.length + '</span>' + segsHtml(i, list.length)
      + '<div class="instruct"><h1>' + C.HELLO_INSTRUCTION + '</h1>' + roundHear('data-instruct', 'Read it to me') + '</div></div>'
      + wordCard(w, W.clueFor(S.readWords(), w.word))
      + '<div class="btnrow btnrow--wide"><button type="button" class="btn btn--primary btn--big" data-play>' + C.FLOWER_GAME + ICON.arrow + '</button></div></section>';
    wireWordCard(main, w);
    markFold(main);
    main.querySelector('[data-instruct]').addEventListener('click', () => sayLine(C.HELLO_INSTRUCTION));
    main.querySelector('[data-play]').addEventListener('click', () => {
      stop();
      endGame = runSession(main, { eyebrow: 'Hello words', title: 'Word ' + (i + 1) + ' of ' + list.length, words: [w], mode: 'mini', progress: false, lastLabel: i + 1 < list.length ? 'Next word' : 'Finish', onFinish: next });
    });
    speak(w.word);
    window.scrollTo(0, 0);
  }
  // The game ends with its word: only then is the word marked (leaving before leaves it undone).
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
// Look, say, hide, spell and check on the screen (no paper, for any child); then the word is spelled until it's clean 3
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
  let peekCtl = null;
  let ctrl = null; // the letter tray, on level 1 to 4
  const w = () => entryFor(word);
  const count = () => W.sessionCount(S.readWords(), g, word, today(), 'x');
  const skipBtn = '<div class="skiprow"><button type="button" class="linkbtn" data-skip>' + C.SKIP_TEXT + '</button></div>';
  const page = (title, body, n = count(), cls = '') => {
    if (peekCtl) { peekCtl.destroy(); peekCtl = null; }
    if (ctrl) { ctrl.destroy(); ctrl = null; }
    main.innerHTML = '<section class="wrap page spellpage' + cls + '">' + head('fix', '<h1>' + esc(title) + '</h1><p class="muted">Word ' + (rows.indexOf(word) + 1) + ' of ' + rows.length + '</p><p class="rowcount" data-row>' + inARowHtml(n) + '</p>') + body + '</section>';
    const b = main.querySelector('[data-skip]');
    if (b) b.addEventListener('click', skip);
    markFold(main);
    window.scrollTo(0, 0);
  };
  const button = (sel, fn) => main.querySelector(sel).addEventListener('click', fn);

  function look(line = '') {
    phase = 'look';
    page('Look and say', (line ? '<p class="spellline" role="status">' + esc(line) + '</p>' : '') + '<div class="card spell"><div class="spell__word">' + chunked(w(), '', { tricky: true }) + '</div>'
      + '<p class="muted">Look at the word. Say it out loud.</p>'
      + (W.clueFor(S.readWords(), w().word) ? '<p class="small"><b>Your clue:</b> ' + esc(W.clueFor(S.readWords(), w().word)) + '</p>' : '')
      + '<div class="btnrow btnrow--center"><button type="button" class="btn btn--ghost" data-hear>' + ICON.play + 'Hear it</button>'
      + '<button type="button" class="btn btn--primary" data-cover>Hide it' + ICON.arrow + '</button></div></div>' + skipBtn);
    button('[data-hear]', () => speak(w().word));
    button('[data-cover]', () => { stop(); type(); }); // Hide it: straight to spelling it (TR-40)
    speak(w().word);
  }
  function typeTiles(line, lv, pf, spec) {
    const rules = A.RULES.practice[pf] || A.RULES.practice.normal;
    const entry = w();
    page('Hide and spell', Tr.lineHtml(Tr.instructionFor(lv), Tr.moreFor(spec, lv)) + '<p class="peek" data-peek aria-live="polite"></p>'
      + '<div class="card tileword">' + Tr.boxesHtml(spec, { tricky: entry.tricky }) + '<div class="btnrow btnrow--peek"><button type="button" class="btn btn--ghost btn--wide" data-hear>' + ICON.play + 'Hear again</button>' + peekButtonHtml() + '</div>'
      + '<p class="peekhint" data-hint aria-live="polite">' + esc(C.PEEK_HINT) + '</p></div>'
      + '<div data-slot>' + Tr.colHtml(Tr.trayHtml(spec),
        '<div class="btnrow btnrow--center testbtns testbtns--tray"><button type="button" class="btn btn--primary" data-check disabled>' + TICK + 'Check</button>'
        + '<button type="button" class="btn btn--ghost" data-skip>Skip for now<span class="sr">. It comes back later.</span></button></div>') + '</div>', count(), ' tilepage');
    ctrl = Tr.mountTray(main, spec, {
      glowAfter: rules.glowAfter, xs: pf === 'sen',
      onChange: (st) => { const c = main.querySelector('[data-check]'); if (c) c.disabled = !st.full || st.right; },
    });
    if (line) ctrl.say(line);
    const hearNow = () => (rules.sentence === 'auto' && canSentence(entry) ? hearInSentence(entry) : speak(entry.word));
    button('[data-hear]', hearNow);
    mountFixPeek(true);
    button('[data-check]', () => { const r = ctrl.check(); if (r && r.right) check({ tries: r.tries, helped: r.helped }); });
    hearNow();
  }
  function type(line = '') {
    phase = 'type';
    typed = '';
    peeks = 0;
    const { lv, pf } = S.helpNow(childYear());
    const spec = lv < 5 ? Tr.specFor(w(), lv, { pf }) : null;
    if (spec) { typeTiles(typeof line === 'string' ? line : '', lv, pf, spec); return; }
    page('Hide and spell', '<p class="peek" data-peek aria-live="polite"></p><p class="spellline" role="status">' + esc(typeof line === 'string' ? line : '') + '</p><p class="answerline" data-answer aria-live="polite" aria-label="Your answer"></p>'
      + '<div class="btnrow btnrow--center"><button type="button" class="btn btn--primary btn--wide" data-hear>' + ICON.play + 'Hear the word</button></div>'
      + peekRowHtml({ hint: C.PEEK_HINT })
      + skipBtn + keyboard({ del: true })
      + '<div class="btnrow btnrow--center testbtns"><button type="button" class="btn btn--primary btn--wide" data-check>Check' + ICON.arrow + '</button></div>');
    main.querySelectorAll('.key[data-letter]').forEach((k) => k.addEventListener('click', () => put(k.dataset.letter)));
    button('[data-hear]', () => speak(w().word));
    mountFixPeek(false);
    button('[data-del]', del);
    button('[data-check]', () => check());
    speak(w().word);
  }
  // The shared Peek (peek.js): it follows the child's Peek time, shows the word on the line above, and freezes the tray while it shows.
  function mountFixPeek(tiles) {
    if (peekCtl) peekCtl.destroy();
    const setup = S.readSetup();
    peekCtl = mountPeek(main, {
      word: w().word,
      ms: peekMs(setup, { way: Su.wayOf(setup), input: tiles ? 'tiles' : 'keys' }),
      can: () => phase === 'type',
      lock: (on) => { if (ctrl) ctrl.lock(on); },
      onPeek: () => {
        peeks += 1;
        main.querySelector('[data-row]').innerHTML = inARowHtml(0);
        main.querySelector('[data-hint]').textContent = C.PEEKED_LINE;
      },
    });
  }
  const show = () => { main.querySelector('[data-answer]').textContent = typed; };
  function put(L) { if (typed.length < 24) { typed += L.toLowerCase(); show(); } }
  function del() { typed = typed.slice(0, -1); show(); }
  // info: a tile pass { tries, helped } (the letters not right at each Check, and whether the tray filled one).
  function record(right, info = null) {
    const day = today();
    const { lv } = S.helpNow(childYear());
    const extra = info ? { lv, ...(info.helped ? { h: 1 } : {}) } : {};
    S.updateWords((d) => W.addTry(d, { id: S.newId(), word: w().word, day, group: g.id, kind: 'p', tries: info ? info.tries : (right ? 0 : 1), peeks, clean: right && !peeks && !(info && (info.tries || info.helped)), source: 'x', now: Date.now(), ...extra }));
  }
  // Leaving the typing step after a peek, or after letters the tray sent back, still ends the run.
  function recordLeave() {
    if (phase !== 'type') return;
    if (ctrl) { const st = ctrl.state(); if (peeks || st.tries || st.helped) record(false, { tries: st.tries, helped: st.helped }); } else if (peeks) record(true);
  }
  function check(info = null) {
    if (!info && !typed) { toast('Type the word first'); return; }
    phase = 'check';
    const right = info ? true : R.checkAnswer(w().word, typed);
    record(right, info);
    const clean = right && !peeks && !(info && (info.tries || info.helped));
    if (clean && count() < W.ROW_NEEDED) { type('Clean! Now again, all on your own.'); return; }
    if (!clean) slipped = true;
    page(clean ? 'Check' : 'Let\'s try that one again', '<div class="card result ' + (clean ? 'result--good' : 'result--soft') + '"><div class="result__head"><span class="result__badge">' + (clean ? '✓' : '•') + '</span><h2>' + (clean ? 'That\'s it' : peeks && right ? 'Right, with a peek' : right ? 'You got there' : 'Nearly') + '</h2></div>'
      + '<div class="result__word">' + chunked(w(), '', { tricky: true }) + '</div>'
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
    recordLeave(); // a peek still ends the run, as leaving does
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
    if (ctrl) {
      if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); ctrl.key(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); ctrl.back(); }
      return;
    }
    if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); put(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); del(); } else if (e.key === 'Enter') { e.preventDefault(); check(); }
  }
  document.addEventListener('keydown', onKey);
  look();
  return () => {
    clearTimeout(timer);
    recordLeave(); // left after a peek: that still ends the run
    if (peekCtl) { peekCtl.destroy(); peekCtl = null; }
    if (ctrl) { ctrl.destroy(); ctrl = null; }
    document.removeEventListener('keydown', onKey);
    stop();
  };
}

/* ------------------------------------------------------------- Game day --- */
function gameDay(main, g) {
  // SB5 (TR-101): the games of the day by the child's year and the week's length (6 in a full week, 3 to 4 or 2 in a short one).
  return playGames(main, g, { eyebrow: 'Game day', part: 'games', games: G.dayGames(childYear(), St.weekKind(g)), onDone: () => finishStep(main, g, 'games') });
}
/** SB6 (TR-44): in Step by step the games stone is Meanings: match, fill and mix always (G.SBS_GAMES, any week, any year), never a timed one, tap only; a game with too few words is left out and the stone still finishes. */
function meaningsStone(main, g) {
  const done = () => finishStep(main, g, 'games', 'sbs');
  return playGames(main, g, { eyebrow: K.STONE_TEXT.games.title, part: 'games', sbs: true, onDone: done, onNone: done });
}
function mend(main, g) {
  return playGames(main, g, { eyebrow: 'Mend and keep', games: ['quick'], onDone: () => finishStep(main, g, 'mend') });
}

/* ------------------------------------------------------- writing sentences --- */
/** Make one sentence for each of `words`, then onDone(). Returns a cleanup. */
export function sentences(main, g, onDone) {
  const kind = St.weekKind(g);
  const count = St.storySentences(kind); // full 3, short 2, quick 1
  const words = St.sentenceWords(S.readWords(), g, count);
  const left = [...words];
  let note = '';
  let draft = '';
  let builder = null; // the "Help me build it" builder while it is open (BR-34)
  const closeBuilder = () => { if (builder) { builder(); builder = null; } };
  function draw() {
    closeBuilder();
    const w = left[0];
    if (!w) { onDone(); return; }
    main.innerHTML = '<section class="wrap page" data-story>' + head('story', '<h1>Make a sentence</h1><p class="muted">' + (kind === 'full' ? '' : (kind === 'quick' ? 'Quick week: ' : 'Short week: ') + count + (count === 1 ? ' sentence' : ' sentences') + ' today. A full week has 3. ') + 'Sentence ' + (words.length - left.length + 1) + ' of ' + words.length + '</p>') + '<div class="card setting">'
      + '<p>Use this word in a sentence of your own:</p><p class="today__word">' + chunked(entryFor(w)) + '</p>'
      + '<div class="btnrow"><button type="button" class="btn btn--quiet btn--small" data-hear>' + ICON.play + 'Hear it</button></div>'
      + '<label class="small muted" for="sentence">Your sentence</label><textarea id="sentence" class="field" rows="3" maxlength="' + W.MAX_NOTE + '" data-text>' + esc(draft) + '</textarea>'
      + '<p class="small" data-note role="status">' + esc(note) + '</p>'
      + '<div class="btnrow"><button type="button" class="btn btn--primary" data-save>Save' + ICON.arrow + '</button>'
      + '<button type="button" class="btn btn--quiet" data-build>' + esc(HELP_LABEL) + '</button></div></div></section>';
    markFold(main);
    const box = main.querySelector('[data-text]');
    box.addEventListener('input', () => { draft = box.value; });
    main.querySelector('[data-hear]').addEventListener('click', () => speak(w));
    // "Help me build it": the builder (levels 1 and 3) fills the box; leaving it with nothing leaves the box as it was. Nothing is saved until Save.
    main.querySelector('[data-build]').addEventListener('click', () => {
      stop();
      draft = box.value;
      builder = helpMeBuild(main, {
        g, word: w, year: childYear(),
        onDone: (made) => { if (made && made.text) { draft = made.text; note = ''; } setTimeout(draw, 0); },
      });
    });
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
  return () => { closeBuilder(); stop(); };
}

function examples(main, g, go) {
  const list = W.rows(g).map((x) => shown(entryFor(x))).filter((w) => w.meaning.example);
  main.innerHTML = '<section class="wrap page">' + head('story', '<h1>Your words at work</h1><p class="muted">Read each sentence and listen for your word.</p>')
    + '<div class="list">' + list.map((w, i) => '<div class="card listrow"><p class="example">' + boldWord(w.meaning.example, w.word) + '</p><button type="button" class="btn btn--quiet btn--small" data-say="' + i + '" aria-label="Hear this sentence">' + ICON.play + '</button></div>').join('') + '</div>'
    + '<div class="btnrow"><button type="button" class="btn btn--primary" data-go>Make my sentences' + ICON.arrow + '</button></div></section>';
  main.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => sayLine(list[Number(b.dataset.say)].meaning.example)));
  main.querySelector('[data-go]').addEventListener('click', () => { stop(); go(); });
}
// A group from a chapter with a story a grown-up has reviewed reads it aloud; any other group has the examples.
function storyDay(main, g) {
  let stopped = false;
  let end = null;
  let writing = null;
  const write = () => { writing = sentences(main, g, () => finishStep(main, g, 'story')); };
  Promise.all([loadStories(), meaningsFor(W.rows(g))]).then(([stories]) => {
    if (stopped) return;
    const story = storyFor(stories, g, D.allChapters());
    if (story) end = storyPage(main, g, story, write); else examples(main, g, write);
  });
  return () => { stopped = true; if (end) end(); if (writing) writing(); stop(); };
}

/**
 * Step by step Story day (TR-45): one sentence for each of the week's words with the fewest (3, 2 or 1), each made in the builder, then the stone is done.
 * The builder calls onDone(null) when it made and saved nothing: that child has moved on, so the next word comes (nothing is saved or invented here);
 * a stone never traps a child, so it finishes after the last word either way.
 */
export function storySbs(main, g, { build = buildSentence } = {}) { // `build` is for the smoke test (to stand in for the builder)
  const words = St.sentenceWords(S.readWords(), g, St.storySentences(St.weekKind(g)));
  const year = childYear();
  const levels = SD.levelsFor(year, 'sbs');
  let i = 0;
  let stopped = false;
  let end = null;
  function nextWord() {
    if (end) { end(); end = null; }
    if (stopped) return;
    if (i >= words.length) { finishStep(main, g, 'story', 'sbs'); return; }
    const at = i;
    end = build(main, {
      g, word: words[at], levels, way: 'sbs', year, index: at + 1, of: words.length,
      onDone: () => { if (stopped || at !== i) return; i += 1; setTimeout(nextWord, 0); }, // a saved sentence or null: either way the next word
    });
  }
  nextWord();
  return () => { stopped = true; if (end) end(); stop(); };
}

/* ---------------------------------------------------------------- routes --- */
const PAGES = { hello, fix, games: gameDay, story: storyDay, mend };
const SBS_STONES = ['hello', 'fix', 'practice', 'mend']; // sbs-views.js runs these
const SBS_PAGES = { games: meaningsStone, story: storySbs };

export function studyStep(main, { gid, step, n }) {
  const id = safeDecode(gid);
  const d = S.readWords();
  const g = W.groupById(d, id);
  if (!g) { location.replace('#/'); return undefined; }
  // SB6 (TR-31, TR-43): the way the stone runs is decided by wayFor (a stone started keeps its way; a done one follows today's setting)
  if (SBS_STONES.includes(step) || SBS_PAGES[step]) {
    if (wayOf(d, g, step) === 'sbs') {
      if (!K.canOpen(d, g, step, today(), S.readSetup())) { location.replace(groupHref(id)); return undefined; }
      return SBS_STONES.includes(step) ? sbsStone(main, { g, step, n }) : SBS_PAGES[step](main, g);
    }
  }
  if (!PAGES[step] || !St.canOpen(d, g, step, today())) { location.replace(groupHref(id)); return undefined; }
  if (step === 'mend' && St.mendPart(d, g, today()) === 'fixups') { location.replace(groupHref(id)); return undefined; }
  return PAGES[step](main, g, n);
}

// The week strip: one badge a job. Used by the group page and My room.
export function stripHtml(steps, day) {
  return '<ol class="weekstrip" aria-label="This week">' + steps.map((s) => '<li class="weekstrip__day is-' + s.state + '"' + (s.state === 'today' ? ' aria-current="step"' : '') + '>'
    + '<span class="weekstrip__badge">' + (s.state === 'done' ? ICON.star : s.n) + '</span><span class="weekstrip__name">' + esc(s.short) + '</span>'
    + '<span class="sr">' + esc(s.title + ': ' + ({ done: 'done', today: 'today', waiting: 'waiting for you', missed: 'not done', later: s.date < day ? 'once the jobs before it are done' : 'on ' + W.dayLabel(s.date) }[s.state])) + '</span>'
    + '<span class="weekstrip__date" aria-hidden="true">' + (s.state === 'missed' ? 'Not done' : s.date === day ? 'Today' : esc(W.dayParts(s.date).join(' '))) + '</span></li>').join('') + '</ol>';
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
