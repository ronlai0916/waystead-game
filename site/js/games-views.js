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
import { speak, stop, sayLine } from './speech.js';
import { burstHtml, placeBursts } from './celebrate.js';
import { esc, ICON, chunked, keyboard, toast, RETRY_LINE } from './ui.js';
import * as C from './child-doc.js';
import { dotsListHtml } from './study-views.js';
import { modeSwitch } from './words-views.js';
import * as A from './assess-doc.js';
import * as Tr from './tray.js';
import { hearInSentence, canSentence } from './sentence.js';
import { childYear } from './who.js';
import { safeDecode } from './chapters-doc.js'; // SB4-WP13: a bad address piece is '' (never throws)
import { weekListOid } from './set-doc.js';
import { readCache, visible } from './sentences-data.js';
import { peekRowHtml, peekButtonHtml, mountPeek } from './peek.js';
import { peekMs } from './peek-doc.js';
import * as Su from './setup-doc.js';
import { RULES } from './sbs-rules.js';

const today = () => W.localDay(Date.now());
const groupHref = (id) => '#/words/g/' + encodeURIComponent(id);
const plural = (n, one) => n + ' ' + one + (n === 1 ? '' : 's');
const plainKey = (e) => !(e.metaKey || e.ctrlKey || e.altKey);

function pageHtml(ctx, title, n, body) {
  return '<section class="wrap page spellpage' + (body.includes('tileword') ? ' tilepage' : '') + ' game" data-game="' + title.id + '"><div class="pagehead"><span class="eyebrow">' + esc(ctx.eyebrow) + '</span><h1>' + esc(title.text) + '</h1>'
    + (n ? '<p class="muted">' + esc(n) + '</p>' : '') + '</div>' + body + '</section>';
}
// The same Hear and Skip rows as practice: one big "Hear the word", Skip as a link.
// peek: true = its own row under Hear (the grid's place); 'beside' = in Hear's row, so the page keeps its height (the keyboard games: 23b's fold numbers stay).
const heard = ({ peek = true } = {}) => '<div class="btnrow btnrow--center' + (peek === 'beside' ? ' btnrow--peek' : '') + '"><button type="button" class="btn btn--primary btn--wide" data-hear>' + ICON.play + 'Hear the word</button>' + (peek === 'beside' ? peekButtonHtml() : '') + '</div>'
  + (peek === true ? peekRowHtml() : '')
  + '<div class="skiprow"><button type="button" class="linkbtn" data-skip>' + C.SKIP_TEXT + '</button></div>';

// SB4-WP4: the letter-tray screens (levels 1 to 4) of Missing letters and Quick-fire share these.
const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const tileBody = (spec, lv) => Tr.lineHtml(Tr.instructionFor(lv), Tr.moreFor(spec, lv))
  + '<div class="card tileword">' + Tr.boxesHtml(spec, { tricky: spec.tricky }) + '<div class="btnrow btnrow--peek"><button type="button" class="btn btn--ghost btn--wide" data-hear>' + ICON.play + 'Hear again</button>' + peekButtonHtml() + '</div></div>'
  + '<div data-slot>' + Tr.colHtml(Tr.trayHtml(spec),
    '<div class="btnrow btnrow--center testbtns testbtns--tray"><button type="button" class="btn btn--primary" data-check disabled>' + TICK + 'Check</button>'
    + '<button type="button" class="btn btn--ghost" data-skip>Skip for now<span class="sr">. It comes back later.</span></button></div>') + '</div>';
// SB6 (TR-41): one Peek on every spelling game. The setup gives the way (Step by step shows it 3 s by default) and the child's Peek time.
const peekMsFor = (input) => { const setup = S.readSetup(); return peekMs(setup, { way: Su.wayOf(setup), input }); };
const peekNudge = () => (Su.wayOf(S.readSetup()) === 'sbs' ? 10000 : 0);
/** A Peek on a keyboard page: the word shows in the boxes, or on the line above them; `lock` freezes the keys; `onPeek` counts it. */
function keyPeek(main, word, { boxes, lock, onPeek, can, line }) {
  return mountPeek(main, { word, ms: peekMsFor('keys'), boxes, lock, onPeek, can, line, nudgeMs: peekNudge() });
}
/** Mounts the tray on the page just drawn. Returns the controller; onRight(pass) when a Check is right. */
function wireTiles(main, spec, entry, { lv, pf, onRight, onSkip, onLock }) {
  const rules = A.RULES.practice[pf] || A.RULES.practice.normal;
  const hearNow = () => (rules.sentence === 'auto' && canSentence(entry) ? hearInSentence(entry) : speak(entry.word));
  const ctrl = Tr.mountTray(main, spec, {
    glowAfter: rules.glowAfter, xs: pf === 'sen',
    onChange: (st) => { const c = main.querySelector('[data-check]'); if (c) c.disabled = !st.full || st.right; },
  });
  main.querySelector('[data-hear]').addEventListener('click', hearNow);
  main.querySelector('[data-skip]').addEventListener('click', onSkip);
  const box = { peeks: 0 };
  main.querySelector('[data-check]').addEventListener('click', () => { const r = ctrl.check(); if (r && r.right) onRight(passOf(r, lv, box.peeks)); });
  const peek = mountPeek(main, {
    word: entry.word, ms: peekMsFor('tiles'), words: () => [{ root: main, entry }], nudgeMs: peekNudge(),
    lock: (on) => { ctrl.lock(on); const c = main.querySelector('[data-check]'); if (c) c.disabled = on || !ctrl.state().full || ctrl.state().right; if (onLock) onLock(on); },
    onPeek: () => { box.peeks += 1; },
  });
  return { ctrl, hearNow, rules, peeks: () => box.peeks, peek, destroy() { peek.destroy(); ctrl.destroy(); } };
}
/** A tile pass as a game records it: clean only when the first Check was right and the tray filled nothing. */
function passOf(s, lv, peeks = 0) { return G.withPeeks({ tries: s.tries, clean: !s.tries && !s.helped, lv, ...(s.helped ? { h: 1 } : {}) }, peeks); }
const leftPass = (ctrl, lv, peeks = 0) => { const s = ctrl.state(); return s.tries || s.helped || peeks ? passOf(s, lv, peeks) : null; };

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
  let tiles = null; // the letter tray, on level 1 to 4
  let level = 5;
  let peeking = false;
  let peekCtl = null;
  function show(line = '') {
    if (peekCtl) { peekCtl.destroy(); peekCtl = null; }
    peeking = false;
    const e = entryFor(words[0]);
    w = e.word;
    blanks = G.blanksFor(e);
    run = G.newMissing(w, blanks);
    live = true;
    if (tiles) { tiles.destroy(); tiles = null; }
    const { lv, pf } = S.helpNow(childYear());
    level = lv;
    const spec = lv < 5 ? Tr.specFor(e, lv, { pf, gaps: blanks }) : null;
    if (spec) {
      main.innerHTML = pageHtml(ctx, { id: 'missing', text: G.GAMES.missing.title }, ctx.leftLine(words), tileBody({ ...spec, tricky: e.tricky }, lv));
      tiles = wireTiles(main, spec, e, {
        lv, pf, onSkip: skip,
        onRight(p) {
          live = false;
          ctx.record(w, p);
          words = G.afterPass(words, p.clean);
          if (!p.clean) { show(RETRY_LINE); return; }
          wordDone(ctx, main.querySelector('[data-slot]'), w, p.clean, () => (words.length ? show() : done()), !words.length);
          speak(w);
        },
      });
      if (line) tiles.ctrl.say(line);
      tiles.hearNow();
      window.scrollTo(0, 0);
      return;
    }
    main.innerHTML = pageHtml(ctx, { id: 'missing', text: G.GAMES.missing.title }, ctx.leftLine(words),
      '<div class="spellboxes" aria-label="The word with letters missing">' + [...w].map((c, n) => '<span class="spellbox' + (blanks.includes(n) ? '" data-gap="' + blanks.indexOf(n) + '">' : ' is-filled">' + esc(c)) + '</span>').join('') + '</div>'
      + '<p class="spellline" data-line role="status" aria-live="polite">' + esc(line) + '</p>'
      + '<div data-slot>' + heard({ peek: 'beside' }) + keyboard() + '</div>');
    main.querySelector('[data-hear]').addEventListener('click', () => speak(w));
    main.querySelector('[data-skip]').addEventListener('click', skip);
    main.querySelectorAll('.key').forEach((k) => k.addEventListener('click', () => letter(k.dataset.letter)));
    peekCtl = keyPeek(main, w, { boxes: () => [...main.querySelectorAll('.spellboxes .spellbox')], lock: (on) => { peeking = on; }, onPeek: () => { run = R.peek(run); }, can: () => live });
    mark();
    speak(w);
    window.scrollTo(0, 0);
  }
  const mark = () => main.querySelectorAll('[data-gap]').forEach((b) => b.classList.toggle('is-next', Number(b.dataset.gap) === run.at));
  function letter(L) {
    if (!live || peeking) return;
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
    if (tiles) { const lp = leftPass(tiles.ctrl, level, tiles.peeks()); if (lp) ctx.record(w, { ...lp, clean: false }); } else if (R.mustRecord(run)) ctx.record(w, G.leftPassOf(run));
    ctx.skip(w);
    words = G.afterSkip(words);
    show();
  }
  function onKey(e) {
    if (!plainKey(e)) return;
    if (tiles) {
      if (!live) return;
      if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); tiles.ctrl.key(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); tiles.ctrl.back(); }
      return;
    }
    if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); letter(e.key); }
  }
  document.addEventListener('keydown', onKey);
  show();
  return () => {
    document.removeEventListener('keydown', onKey);
    if (tiles) {
      if (live) { const lp = leftPass(tiles.ctrl, level, tiles.peeks()); if (lp) ctx.record(w, { ...lp, clean: false }); }
      tiles.destroy();
    } else if (live && R.mustRecord(run)) ctx.record(w, G.leftPassOf(run)); // left halfway after a slip or a peek
    if (peekCtl) peekCtl.destroy();
  };
}

/* -------------------------------------------------------------- Unjumble --- */
function unjumble(main, ctx, done) {
  let words = ctx.order();
  let w = '';
  let run = null;
  let live = false;
  let peeking = false;
  let peekCtl = null;
  function show(line = '') {
    if (peekCtl) { peekCtl.destroy(); peekCtl = null; }
    peeking = false;
    w = entryFor(words[0]).word;
    run = R.newRun(w);
    live = true;
    main.innerHTML = pageHtml(ctx, { id: 'unjumble', text: G.GAMES.unjumble.title }, ctx.leftLine(words),
      '<div class="spellboxes" aria-label="Your word, ' + w.length + ' letters">' + [...w].map((_, n) => '<span class="spellbox" data-box="' + n + '"></span>').join('') + '</div>'
      + '<p class="spellline" data-line role="status" aria-live="polite">' + esc(line) + '</p>'
      + '<div data-slot>' + heard({ peek: 'beside' }) + '<div class="tiles-row" role="group" aria-label="Letters">' + G.jumble(w).map((c) => '<button type="button" class="key tile" data-tile="' + esc(c.toLowerCase()) + '">' + esc(c.toUpperCase()) + '</button>').join('') + '</div></div>');
    main.querySelector('[data-hear]').addEventListener('click', () => speak(w));
    main.querySelector('[data-skip]').addEventListener('click', skip);
    main.querySelectorAll('[data-tile]').forEach((t) => t.addEventListener('click', () => tap(t)));
    peekCtl = keyPeek(main, w, { boxes: () => [...main.querySelectorAll('.spellboxes .spellbox')], lock: (on) => { peeking = on; }, onPeek: () => { run = R.peek(run); }, can: () => live });
    speak(w);
    window.scrollTo(0, 0);
  }
  function tap(tile) {
    if (!live || peeking) return;
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
    if (R.mustRecord(run)) ctx.record(w, G.leftPassOf(run));
    ctx.skip(w);
    words = G.afterSkip(words);
    show();
  }
  function onKey(e) {
    if (!plainKey(e) || !/^[a-z]$/i.test(e.key) || !live || peeking) return;
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
    if (live && R.mustRecord(run)) ctx.record(w, G.leftPassOf(run));
    if (peekCtl) peekCtl.destroy();
  };
}

/* --------------------------------------------------------- Meaning match --- */
function match(main, ctx, done) {
  const entries = ctx.words.map(entryFor).filter((e) => hasMeaning(e.word));
  if (!entries.length) { Promise.resolve().then(done); return () => {}; }
  const spare = D.allWords().filter((e) => !ctx.words.includes(e.word));
  const rounds = G.matchRounds(entries, spare, Math.random, ctx.sbs ? RULES.meanings.cards : G.MATCH_SIZE);
  let r = 0;
  let state = G.newMatch();
  let chosen = '';
  function draw(line = '') {
    const round = rounds[r];
    const opt = (btn, text, kind) => (ctx.sbs ? '<div class="matchopt">' + btn + optHear(text, kind) + '</div>' : btn);
    main.innerHTML = pageHtml(ctx, { id: 'match', text: G.GAMES.match.title }, 'Round ' + (r + 1) + ' of ' + rounds.length,
      '<p class="spellline" data-line role="status" aria-live="polite">' + esc(line || (chosen ? 'Now tap what it means.' : 'Tap a word.')) + '</p>'
      + '<div class="matchgrid' + (ctx.sbs ? ' matchgrid--sbs' : '') + '"><div class="matchcol" role="group" aria-label="Words">' + round.cards.map((c, n) => opt('<button type="button" class="matchcard matchcard--word' + (c.word === chosen ? ' is-on' : '') + (state.matched.includes(c.word) ? ' is-done' : '') + '" data-word="' + n + '"' + (state.matched.includes(c.word) ? ' disabled' : '') + '><span class="matchcard__key" aria-hidden="true">' + (n + 1) + '</span>' + esc(c.word) + '</button>', c.word, 'word')).join('') + '</div>'
      + '<div class="matchcol" role="group" aria-label="Meanings">' + round.meanings.map((m, n) => {
        const used = round.cards.some((c) => c.meaning === m && state.matched.includes(c.word));
        return opt('<button type="button" class="matchcard' + (used ? ' is-done' : '') + '" data-meaning="' + n + '"' + (used ? ' disabled' : '') + '><span class="matchcard__key" aria-hidden="true">' + 'ABCD'[n] + '</span>' + esc(m) + '</button>', m, 'meaning');
      }).join('') + '</div></div>');
    wireOptHear(main);
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
  let tiles = null;
  let level = 5;
  let peeking = false;
  let peekCtl = null;
  let peeksN = 0; // Peeks at this go (keyboard)
  // The gentle bar and its "take your time": a Peek stops them, and they start again from full when the word is hidden.
  function startClock() {
    const secs = G.quickSeconds(w);
    const bar = main.querySelector('[data-bar]');
    if (bar) { bar.classList.remove('is-paused'); bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; bar.style.setProperty('--secs', secs + 's'); }
    clearTimeout(timer);
    timer = setTimeout(() => { // the timer only ever says this
      if (!live || peeking) return;
      if (tiles) { tiles.ctrl.say('Take your time.'); tiles.hearNow(); return; }
      main.querySelector('[data-line]').textContent = 'Take your time.';
      speak(w);
    }, secs * 1000);
  }
  function holdClock(on) {
    peeking = on;
    const bar = main.querySelector('[data-bar]');
    if (on) { clearTimeout(timer); if (bar) bar.classList.add('is-paused'); } else if (live) startClock();
  }
  function ask(line = '') {
    if (peekCtl) { peekCtl.destroy(); peekCtl = null; }
    peeking = false;
    peeksN = 0;
    const e = entryFor(words[0]);
    w = e.word;
    typed = '';
    live = true;
    if (tiles) { tiles.destroy(); tiles = null; }
    const { lv, pf } = S.helpNow(childYear());
    level = lv;
    const spec = lv < 5 ? Tr.specFor(e, lv, { pf }) : null;
    if (spec) {
      const bar = (A.RULES.practice[pf] || A.RULES.practice.normal).quickBar;
      main.innerHTML = pageHtml(ctx, { id: 'quick', text: G.GAMES.quick.title }, ctx.leftLine(words), (bar ? '<div class="gentlebar" aria-hidden="true"><span data-bar></span></div>' : '') + tileBody({ ...spec, tricky: e.tricky }, lv));
      tiles = wireTiles(main, spec, e, {
        lv, pf, onSkip: skip, onLock: holdClock,
        onRight(p) {
          live = false;
          clearTimeout(timer);
          ctx.record(w, p);
          words = G.afterPass(words, p.clean);
          if (!p.clean) { ask(RETRY_LINE); return; }
          wordDone(ctx, main.querySelector('[data-slot]'), w, p.clean, () => (words.length ? ask() : done()), !words.length);
          speak(w);
        },
      });
      if (line) tiles.ctrl.say(line);
      startClock();
      tiles.hearNow();
      window.scrollTo(0, 0);
      return;
    }
    main.innerHTML = pageHtml(ctx, { id: 'quick', text: G.GAMES.quick.title }, ctx.leftLine(words),
      '<div class="gentlebar" aria-hidden="true"><span data-bar></span></div>'
      + '<p class="spellline" data-line role="status" aria-live="polite">' + esc(line) + '</p>'
      + '<p class="answerline" data-answer aria-live="polite" aria-label="Your answer"></p>'
      + '<div data-slot>' + heard({ peek: 'beside' }) + keyboard({ del: true })
      + '<div class="btnrow btnrow--center testbtns"><button type="button" class="btn btn--primary btn--wide" data-go>Next' + ICON.arrow + '</button></div></div>');
    main.querySelector('[data-hear]').addEventListener('click', () => speak(w));
    main.querySelector('[data-del]').addEventListener('click', del);
    main.querySelector('[data-go]').addEventListener('click', submit);
    main.querySelector('[data-skip]').addEventListener('click', skip);
    main.querySelectorAll('.key[data-letter]').forEach((k) => k.addEventListener('click', () => put(k.dataset.letter)));
    peekCtl = keyPeek(main, w, { line: '[data-answer]', lock: holdClock, onPeek: () => { peeksN += 1; }, can: () => live });
    startClock();
    speak(w);
    window.scrollTo(0, 0);
  }
  const show = () => { main.querySelector('[data-answer]').textContent = typed; };
  function put(L) { if (live && !peeking && typed.length < 24) { typed += L.toLowerCase(); show(); } }
  function del() { if (live && !peeking) { typed = typed.slice(0, -1); show(); } }
  function submit() {
    if (!live || peeking) return;
    if (!typed) { toast('Type the word first'); return; }
    live = false;
    clearTimeout(timer);
    const p = G.quickPass(w, typed, peeksN);
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
    if (tiles) { const lp = leftPass(tiles.ctrl, level, tiles.peeks()); if (lp) ctx.record(w, { ...lp, clean: false }); } else if (peeksN) ctx.record(w, { tries: 0, clean: false, peeks: peeksN });
    ctx.skip(w);
    words = G.afterSkip(words);
    ask();
  }
  function onKey(e) {
    if (!plainKey(e)) return;
    if (tiles) {
      if (!live) return;
      if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); tiles.ctrl.key(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); tiles.ctrl.back(); }
      return;
    }
    if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); put(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); del(); } else if (e.key === 'Enter' && live) { e.preventDefault(); submit(); }
  }
  document.addEventListener('keydown', onKey);
  ask();
  return () => {
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey);
    if (tiles) { if (live) { const lp = leftPass(tiles.ctrl, level, tiles.peeks()); if (lp) ctx.record(w, { ...lp, clean: false }); } tiles.destroy(); } else if (live && peeksN) ctx.record(w, { tries: 0, clean: false, peeks: peeksN });
    if (peekCtl) peekCtl.destroy();
  };
}


/* ------------------------------------------------------------------------------------------------------------------
 * SB5 (WP-F1): Fill in the blanks and Mix and match. Sentences come from the bundled bank (data/statements.json, three new
 * statements for each ready-made word), the curriculum's own example sentence (Fill in the blanks only) and a grown-up's
 * sentences for their own words. Both games draw a sentence with a gap; the blank is read as "blank".
 * ---------------------------------------------------------------------------------------------------------------- */
const lc = (w) => String(w).toLowerCase();
let bankP = null;
/** The statements bank, once: { word: [statements] } ('' if it did not load: then only the sentences already on a word are used). */
export function loadBank() {
  if (!bankP) {
    bankP = fetch('data/statements.json').then((r) => (r.ok ? r.json() : null)).then((j) => (j && j.w) || {}).catch(() => ({}));
    bankP.then((b) => { if (!Object.keys(b).length) bankP = null; });
  }
  return bankP;
}
/**
 * The text an entry brings to the two games: { word, sentence?, statements?, own? } (the shape games-doc reads).
 * Ready-made word: its example sentence (when the gap fits) and the bank's statements. Own word: the grown-up's `info[word].s` and the
 * statements the account made (the device's cache), minus the ones the grown-up hid (`info[word].x`).
 */
export function textEntryFor(word, { bank = {}, info = {}, cache = {}, curriculum = null } = {}) {
  const k = lc(word);
  const inf = Object.entries(info || {}).find(([w]) => lc(w) === k);
  const i = inf ? inf[1] : {};
  const c = curriculum;
  if (c) {
    const ex = c.meaning && typeof c.meaning.example === 'string' ? c.meaning.example : '';
    const list = Array.isArray(bank[k]) ? bank[k] : [];
    return { word, ...(ex && G.gapOf(ex, word) ? { sentence: ex } : {}), ...(list.length ? { statements: list } : {}) };
  }
  const cached = cache[k] && Array.isArray(cache[k].s) ? visible(cache[k].s, i.x).map((x) => x.s) : [];
  return { word, own: true, ...(i.s ? { sentence: i.s } : {}), ...(cached.length ? { statements: cached } : {}) };
}
/** Words that may join Mix and match: two statements or more (an own word with its own sentence needs one). */
export function mixPool(entries) {
  return (entries || []).filter((e) => {
    const n = (Array.isArray(e.statements) ? e.statements : []).filter((t) => typeof t === 'string' && G.gapOf(t, e.word)).length;
    return n >= 2 || (e.own && e.sentence && n >= 1);
  });
}

/** What the week's words bring to the sentence games, read from the bank, the week's list copy and the device's cache. */
function sentenceEntries(g, words, bank) {
  let info = {};
  let cache = {};
  try {
    const oid = weekListOid(g.id);
    const own = oid ? ((S.readSetup().own || {})[oid]) : null;
    if (own && !own.gone && own.info) info = own.info;
  } catch (e) { info = {}; }
  try { cache = readCache(globalThis.localStorage, S.currentPlayer()); } catch (e) { cache = {}; }
  return words.map((w) => textEntryFor(w, { bank, info, cache, curriculum: D.entry(w) || null }));
}
/** Other words (not scored) to fill a short board. */
function spareEntries(words, bank) {
  const mine = new Set(words.map(lc));
  const pool = D.allWords().filter((e) => !mine.has(lc(e.word)) && Array.isArray(bank[lc(e.word)]) && bank[lc(e.word)].length >= 2);
  return G.shuffled(pool).slice(0, 24).map((e) => textEntryFor(e.word, { bank, curriculum: e }));
}
/** Whether a game is on the list for these words: Fill in the blanks and Mix and match need enough sentences. */
function sentenceGameOn(g, words, id, bank, sbs = false) {
  const es = sentenceEntries(g, words, bank);
  return G.gamesFor(id === 'mix' ? mixPool(es) : es, {}, [id], { sbs: false }).length > 0 && (!sbs || es.length >= RULES.meanings.cards);
}

// ---- the same Stop-free page for both: the sentence, the cards and a bar at the foot -------------------------------------
const mixPage = (ctx, id, title, n, body) => '<section class="wrap page mixpage game" data-game="' + id + '"><div class="pagehead"><span class="eyebrow">' + esc(ctx.eyebrow) + '</span><h1>' + esc(title) + '</h1>'
  + (n ? '<p class="muted">' + esc(n) + '</p>' : '') + '</div>' + body + '</section>';
// F6: in Step by step every option on a Meanings board has its own Hear (48 x 48, a sibling of the card so a tap on it never picks the option), which says the option's text
const HEAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const optHear = (text, kind) => '<button type="button" class="hearround" data-hearopt="' + kind + '" data-text="' + esc(text) + '" aria-label="Hear: ' + esc(text) + '">' + HEAR_SVG + '</button>';
function wireOptHear(main) {
  main.querySelectorAll('[data-hearopt]').forEach((b) => b.addEventListener('click', () => (b.dataset.hearopt === 'word' ? speak(b.dataset.text) : sayLine(b.dataset.text))));
}
const cardHtml = (word, cls = '', extra = '') => '<button type="button" class="mixcard' + cls + '" data-card="' + esc(word) + '"' + extra + '>' + esc(word) + '</button>';
const gapHtml = (before, after, fill = '') => esc(before) + '<span class="blank' + (fill ? ' is-filled' : '') + '" data-blank role="img" aria-label="' + (fill ? esc(fill) : 'blank') + '">' + esc(fill) + '</span>' + esc(after);
const READ_BTN = '<div class="btnrow btnrow--center"><button type="button" class="btn btn--ghost" data-read>' + ICON.play + 'Read it to me</button></div>';

/**
 * Pointer-event dragging for the word cards (not the HTML5 drag-and-drop API: it does not work with touch on iOS Safari).
 * A card follows the finger by a transform set from script (the CSP forbids style attributes in markup, not this). Under 8 px it stays a tap.
 * onDrop(word, targetElement) when let go over a target; the click that follows a drag is swallowed. Returns the cleanup.
 */
export function enableDrag(main, { targets, onDrop }) {
  let drag = null;
  let swallow = false;
  const over = (x, y) => [...main.querySelectorAll(targets)].find((el) => { const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }) || null;
  const clear = () => main.querySelectorAll('.is-over').forEach((el) => el.classList.remove('is-over'));
  const down = (e) => {
    const c = e.target && e.target.closest ? e.target.closest('[data-card]') : null;
    if (!c || c.disabled || !main.contains(c) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { c, id: e.pointerId, x: e.clientX, y: e.clientY, on: false };
  };
  const move = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.on) {
      if (Math.hypot(dx, dy) < 8) return;
      drag.on = true;
      try { drag.c.setPointerCapture(e.pointerId); } catch (err) { /* no capture: the document still hears the move */ }
      drag.c.classList.add('is-lifted');
    }
    drag.c.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
    const t = over(e.clientX, e.clientY);
    clear();
    if (t) t.classList.add('is-over');
    if (e.cancelable) e.preventDefault();
  };
  const end = (e, dropped) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.on) return;
    swallow = true;
    setTimeout(() => { swallow = false; }, 0);
    const t = dropped ? over(e.clientX, e.clientY) : null;
    d.c.style.transform = '';
    d.c.classList.remove('is-lifted');
    clear();
    if (t) onDrop(d.c.dataset.card, t);
  };
  const up = (e) => end(e, true);
  const cancel = (e) => end(e, false);
  const click = (e) => { if (swallow) { e.stopPropagation(); e.preventDefault(); } };
  main.addEventListener('pointerdown', down);
  document.addEventListener('pointermove', move, { passive: false });
  document.addEventListener('pointerup', up);
  document.addEventListener('pointercancel', cancel);
  main.addEventListener('click', click, true);
  return () => {
    main.removeEventListener('pointerdown', down);
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    document.removeEventListener('pointercancel', cancel);
    main.removeEventListener('click', click, true);
  };
}

/**
 * One Mix and match board's play, with no page in it (so it can be tested): cards are chosen or dragged to a slot and WAIT there;
 * Check keeps the right ones (games-doc placeCard) and sends the others back, charging each miss to its word and its slot.
 */
export function boardPlay(board) {
  let st = G.newBoard();
  let held = {};
  let chosen = '';
  const inTray = (w) => board.cards.some((c) => lc(c.word) === lc(w));
  const isPlaced = (w) => Object.values(st.placed).some((x) => lc(x) === lc(w));
  const isHeld = (w) => Object.values(held).some((x) => lc(x) === lc(w));
  return {
    state: () => st,
    held: () => ({ ...held }),
    chosen: () => chosen,
    /** 'placed' (right and kept), 'held' (waiting in a slot), or 'free'. */
    cardState: (w) => (isPlaced(w) ? 'placed' : isHeld(w) ? 'held' : 'free'),
    /** Tap a card: it is chosen, or un-chosen when it already was. A card that is placed or waiting cannot be chosen. */
    choose(w) {
      if (!inTray(w) || isPlaced(w) || isHeld(w)) return chosen;
      chosen = lc(chosen) === lc(w) ? '' : (board.cards.find((c) => lc(c.word) === lc(w)) || {}).word;
      return chosen;
    },
    unchoose() { chosen = ''; },
    /** Put a card in a slot ('held'); a slot already right, a card already placed or a card off the board changes nothing ('no'). */
    place(w, i) {
      if (!board.slots[i] || st.placed[i] !== undefined || !inTray(w) || isPlaced(w)) return 'no';
      for (const k of Object.keys(held)) if (lc(held[k]) === lc(w)) delete held[k];
      held[i] = (board.cards.find((c) => lc(c.word) === lc(w)) || {}).word;
      chosen = '';
      return 'held';
    },
    /** Take a waiting card back to the tray. */
    take(i) { if (held[i] === undefined) return false; delete held[i]; return true; },
    canCheck: () => Object.keys(held).length > 0,
    /** -> { hit: [slot], miss: [slot], done, glow: { slot, word } | null } */
    check() {
      const out = { hit: [], miss: [] };
      for (const k of Object.keys(held).map(Number).sort((a, b) => a - b)) {
        const r = G.placeCard(st, board, held[k], k);
        st = r.state;
        (r.hit ? out.hit : out.miss).push(k);
      }
      held = {};
      chosen = '';
      out.done = G.boardDone(st, board);
      out.glow = G.glowFor(st, board);
      return out;
    },
    done: () => G.boardDone(st, board),
    passes: () => G.boardPasses(st, board),
    /** Words with a miss that never got a place: a board left or skipped halfway still tells the week about them. */
    partial: () => board.slots.filter((s, i) => s.scored && st.placed[i] === undefined && st.tries[s.word]).map((s) => ({ word: s.word, tries: st.tries[s.word], clean: false, source: 'm' })),
    leftWords: () => board.slots.filter((s, i) => s.scored && st.placed[i] === undefined).map((s) => s.word),
  };
}

const MISS_LINE = 'Not that one. Try another word.';
const BOARD_HELP = 'Drag a word onto a sentence, or tap a word then a sentence.';
const SBS_BOARD_HELP = 'Tap a word, then its sentence.';
/** The end-of-game card for the two sentence games: the score, then on. */
function scoreCard(main, ctx, title, clean, total, onNext) {
  main.innerHTML = '<section class="wrap page mixpage game"><div class="card result result--good mixscore" role="status"><div class="result__head"><span class="celebrate"><span class="result__badge">✓</span>' + burstHtml(12, 1.3) + '</span>'
    + '<h1>' + esc(title) + ' is done</h1></div><p class="mixscore__n">' + clean + ' of ' + total + '</p><p class="muted">right first time</p>'
    + '<div class="btnrow"><button type="button" class="btn btn--primary btn--big" data-next>' + (ctx.more ? 'Next game' : 'Finish') + ICON.arrow + '</button></div></div></section>';
  placeBursts(main);
  const b = main.querySelector('[data-next]');
  b.addEventListener('click', onNext);
  b.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
const focusAfter = (main, sel) => { const el = sel && main.querySelector(sel); if (el && !el.disabled) el.focus({ preventScroll: true }); };

/* -------------------------------------------------------- Fill in the blanks --- */
function fill(main, ctx, done) {
  const level = ctx.sbs ? G.sbsLevel(ctx.year) : G.levelFor(ctx.year);
  const items = G.fillItems(ctx.entries, level, { hidden: ctx.hidden, doneToday: ctx.doneToday });
  if (!items.length) { Promise.resolve().then(done); return () => {}; }
  const total = items.length;
  const spelled = level.fill === 'spell';
  const weekWords = ctx.words.filter((w) => !ctx.hidden.has(lc(w)));
  let queue = [...items];
  let cleanN = 0;
  let k = 0; // sentences finished
  let item = null;
  let tries = 0;
  let live = false;
  let tiles = null;
  let lvl = 5;
  let typed = '';
  let stopDrag = () => {};
  let peeking = false;
  let peekCtl = null;
  let peeksN = 0; // Peeks at this sentence (keyboard)
  const sbs = !!ctx.sbs; // Step by step: tap only, the sentence read aloud, cards of 3
  const head = () => 'Sentence ' + (k + 1) + ' of ' + total;
  const cardBox = (fillWord = '') => '<div class="fillcard"><p class="fillgap" data-gaptext>' + gapHtml(item.before, item.after, fillWord) + '</p></div>';

  function finish() {
    stopDrag();
    stopDrag = () => {};
    scoreCard(main, ctx, G.GAMES.fill.title, cleanN, total, done);
  }
  function next() {
    queue = queue.slice(1);
    k += 1;
    if (!queue.length) { finish(); return; }
    show();
  }
  function record(pass) {
    ctx.record(item.word, pass);
    ctx.fillUsed.push(item.word);
    if (pass.clean) cleanN += 1;
  }
  function show(line = '') {
    item = queue[0];
    tries = 0;
    typed = '';
    live = true;
    peeksN = 0;
    peeking = false;
    if (peekCtl) { peekCtl.destroy(); peekCtl = null; }
    if (tiles) { tiles.destroy(); tiles = null; }
    stopDrag();
    stopDrag = () => {};
    if (spelled) { showSpell(line); return; }
    const cards = G.fillChoices(item, weekWords, level, [...ctx.hidden]);
    main.innerHTML = mixPage(ctx, 'fill', G.GAMES.fill.title, head(), cardBox()
      + '<p class="spellline" data-line role="status" aria-live="polite">' + esc(line || (sbs ? 'Tap the word that fits.' : 'Tap a word to fill in the blank, or drag it.')) + '</p>' + READ_BTN
      + '<div class="mixbar' + (sbs ? ' mixbar--sbs' : '') + '" data-fold="keys"><div class="mixtray" role="group" aria-label="Word cards">' + cards.map((w) => (sbs ? '<span class="mixopt">' + cardHtml(w) + optHear(w, 'word') + '</span>' : cardHtml(w))).join('') + '</div>'
      + '<div class="mixact"><button type="button" class="btn btn--ghost" data-skip>Skip<span class="sr"> for now. It comes back later.</span></button></div></div>');
    wireOptHear(main);
    main.querySelectorAll('[data-card]').forEach((c) => c.addEventListener('click', () => pick(c.dataset.card)));
    main.querySelector('[data-skip]').addEventListener('click', skip);
    main.querySelector('[data-read]').addEventListener('click', () => sayLine(G.readLine(item.before, item.after)));
    if (!sbs) stopDrag = enableDrag(main, { targets: '[data-blank], .fillcard', onDrop: (w) => pick(w) });
    else sayLine(G.readLine(item.before, item.after));
    window.scrollTo(0, 0);
  }
  function pick(word) {
    if (!live) return;
    const line = main.querySelector('[data-line]');
    if (lc(word) !== lc(item.word)) {
      tries += 1;
      const c = [...main.querySelectorAll('[data-card]')].find((x) => lc(x.dataset.card) === lc(word));
      if (c) { c.classList.add('is-back'); c.disabled = true; }
      line.textContent = MISS_LINE;
      if (tries >= G.glowAfter) {
        const right = [...main.querySelectorAll('[data-card]')].find((x) => lc(x.dataset.card) === lc(item.word));
        if (right) { right.classList.add('is-glow'); line.textContent = MISS_LINE + ' The glowing word fits.'; }
      }
      return;
    }
    live = false;
    stopDrag();
    stopDrag = () => {};
    record(G.fillPass(item, { tries }));
    main.querySelector('[data-gaptext]').innerHTML = gapHtml(item.before, item.after, item.word);
    main.querySelector('[data-line]').textContent = 'Yes! ' + item.word;
    main.querySelector('.mixtray').remove();
    main.querySelector('.mixact').innerHTML = '<button type="button" class="btn btn--primary btn--big" data-next>' + (queue.length > 1 ? 'Next sentence' : 'Finish') + ICON.arrow + '</button>';
    const n = main.querySelector('[data-next]');
    n.addEventListener('click', next);
    n.focus({ preventScroll: true });
    speak(item.word);
  }
  function skip() {
    if (!live) return;
    if (tiles) { const lp = leftPass(tiles.ctrl, lvl, tiles.peeks()); if (lp) ctx.record(item.word, { ...G.fillPass(item, { tries: lp.tries, spelled: true, lv: lp.lv, h: lp.h, peeks: lp.peeks }), clean: false }); } else if (tries || peeksN) ctx.record(item.word, { ...G.fillPass(item, { tries, spelled, peeks: peeksN }), clean: false });
    ctx.skip(item.word);
    queue = [...queue.slice(1), queue[0]];
    show();
  }

  // Years 5 and 6: spell the missing word (the Missing letters way: the tray where help is on, else the keyboard), then Check.
  function showSpell(line) {
    const e = entryFor(item.word);
    const { lv, pf } = S.helpNow(childYear());
    lvl = lv;
    const spec = lv < 5 ? Tr.specFor(e, lv, { pf }) : null;
    if (spec) {
      main.innerHTML = mixPage(ctx, 'fill', G.GAMES.fill.title, head(), cardBox() + tileBody({ ...spec, tricky: e.tricky }, lv));
      tiles = wireTiles(main, spec, e, {
        lv, pf, onSkip: skip,
        onRight(p) { live = false; record({ ...G.fillPass(item, { tries: p.tries, spelled: true, lv: p.lv, h: p.h, peeks: p.peeks }), clean: p.clean }); spelledRight(); },
      });
      if (line) tiles.ctrl.say(line);
      window.scrollTo(0, 0);
      return;
    }
    main.innerHTML = mixPage(ctx, 'fill', G.GAMES.fill.title, head(), cardBox()
      + '<div class="btnrow btnrow--center btnrow--peek"><button type="button" class="btn btn--ghost" data-hear>' + ICON.play + 'Hear the word</button>' + peekButtonHtml() + '</div>'
      + '<p class="answerline" data-answer role="status" aria-label="Your answer so far"></p>'
      + '<p class="spellline" data-line role="status" aria-live="polite">' + esc(line || 'Spell the missing word. Then tap Check.') + '</p>'
      + '<div data-slot>' + keyboard({ del: true }) + '</div>'
      + '<div class="mixbar" data-fold="keys"><div class="mixact"><button type="button" class="btn btn--ghost" data-skip>Skip<span class="sr"> for now. It comes back later.</span></button>'
      + '<button type="button" class="btn btn--primary btn--big" data-check disabled>Check</button></div></div>');
    main.querySelector('[data-hear]').addEventListener('click', () => speak(item.word));
    main.querySelector('[data-skip]').addEventListener('click', skip);
    main.querySelector('[data-check]').addEventListener('click', check);
    main.querySelector('[data-del]').addEventListener('click', del);
    main.querySelectorAll('.key[data-letter]').forEach((b) => b.addEventListener('click', () => put(b.dataset.letter)));
    peekCtl = keyPeek(main, item.word, { line: '[data-answer]', lock: (on) => { peeking = on; main.querySelector('[data-check]').disabled = on || !typed; }, onPeek: () => { peeksN += 1; }, can: () => live });
    window.scrollTo(0, 0);
  }
  const showTyped = () => { main.querySelector('[data-answer]').textContent = typed; main.querySelector('[data-check]').disabled = !typed; };
  function put(L) { if (live && !tiles && !peeking && typed.length < 24) { typed += lc(L); showTyped(); } }
  function del() { if (live && !tiles && !peeking) { typed = typed.slice(0, -1); showTyped(); } }
  function check() {
    if (!live || tiles || peeking || !typed) return;
    if (typed !== lc(item.word)) {
      tries += 1;
      typed = '';
      showTyped();
      main.querySelector('[data-line]').textContent = 'Not quite. Have another go.';
      return;
    }
    live = false;
    record(G.fillPass(item, { tries, spelled: true, peeks: peeksN }));
    spelledRight();
  }
  function spelledRight() {
    speak(item.word);
    main.querySelector('[data-gaptext]').innerHTML = gapHtml(item.before, item.after, item.word);
    if (peekCtl) { peekCtl.destroy(); peekCtl = null; }
    ['[data-slot]', '.tileword', '.tileline', '.mixbar', '[data-hear]', '.peekrow'].forEach((q) => { const el = main.querySelector(q); if (el) el.remove(); });
    main.querySelector('.mixpage').insertAdjacentHTML('beforeend', '<div class="mixbar" data-fold="keys"><div class="mixact"><button type="button" class="btn btn--primary btn--big" data-next>' + (queue.length <= 1 ? 'Finish' : 'Next sentence') + ICON.arrow + '</button></div></div>');
    const n = main.querySelector('[data-next]');
    n.addEventListener('click', next);
    n.focus({ preventScroll: true });
  }
  function onKey(e) {
    if (!plainKey(e) || !live || !spelled) return;
    if (tiles) {
      if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); tiles.ctrl.key(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); tiles.ctrl.back(); }
      return;
    }
    if (/^[a-z]$/i.test(e.key)) { e.preventDefault(); put(e.key); } else if (e.key === 'Backspace') { e.preventDefault(); del(); } else if (e.key === 'Enter' && typed) { e.preventDefault(); check(); }
  }
  document.addEventListener('keydown', onKey);
  show();
  return () => {
    document.removeEventListener('keydown', onKey);
    stopDrag();
    if (live && item) {
      if (tiles) { const lp = leftPass(tiles.ctrl, lvl, tiles.peeks()); if (lp) ctx.record(item.word, { ...G.fillPass(item, { tries: lp.tries, spelled: true, lv: lp.lv, h: lp.h, peeks: lp.peeks }), clean: false }); } else if (tries || peeksN) ctx.record(item.word, { ...G.fillPass(item, { tries, spelled, peeks: peeksN }), clean: false });
    }
    if (peekCtl) peekCtl.destroy();
    if (tiles) tiles.destroy();
  };
}

/* ------------------------------------------------------------- Mix and match --- */
function mix(main, ctx, done) {
  const level = ctx.sbs ? G.sbsLevel(ctx.year) : G.levelFor(ctx.year);
  const boards = G.mixBoards(mixPool(ctx.entries), level, { exclude: ctx.fillUsed, spare: mixPool(ctx.spare), hidden: [...ctx.hidden], n: ctx.turn });
  if (!boards.length) { Promise.resolve().then(done); return () => {}; }
  const total = boards.length;
  let queue = [...boards];
  let finished = 0;
  let cleanN = 0;
  let scoredN = 0;
  let play = null;
  let live = false;
  let stopDrag = () => {};
  const board = () => queue[0];
  const slotText = (s) => G.readLine(s.before, s.after);
  const boardHelp = () => (ctx.sbs ? SBS_BOARD_HELP : BOARD_HELP);

  function start(line = '', focus = '') {
    play = boardPlay(board());
    live = true;
    draw(line || boardHelp(), focus);
    if (ctx.sbs) sayLine(board().slots.map(slotText).join(' ')); // Step by step: the sentences are read aloud once, when a board starts
    window.scrollTo(0, 0);
  }
  function draw(line, focus = '', glow = null) {
    const b = board();
    const st = play.state();
    const held = play.held();
    const chosen = play.chosen();
    const slots = b.slots.map((s, i) => {
      const placed = st.placed[i] !== undefined;
      const h = held[i];
      const chip = placed ? '<span class="mixslot__w">' + TICK + esc(s.word) + '</span>' : h ? '<span class="mixslot__w mixslot__w--held">' + esc(h) + '</span>' : '';
      const label = placed ? s.word + ' is here: ' + slotText(s) : h ? h + ' is in: ' + slotText(s) + '. Tap to take it back.' : chosen ? 'Put ' + chosen + ' here: ' + slotText(s) : 'Empty: ' + slotText(s);
      const cls = placed ? ' is-ok' : h ? ' is-held' : (st.misses[i] ? ' is-try' : '') + (chosen ? ' is-target' : '');
      return '<button type="button" class="mixslot' + cls + '" data-slot-i="' + i + '" aria-label="' + esc(label) + '"><span class="mixslot__t">' + gapHtml(s.before, s.after) + '</span>' + chip + '</button>';
    }).join('');
    const cards = b.cards.filter((c) => play.cardState(c.word) !== 'placed').map((c) => {
      const held1 = play.cardState(c.word) === 'held';
      const isChosen = lc(chosen) === lc(c.word);
      const isGlow = glow && lc(glow.word) === lc(c.word);
      const card = cardHtml(c.word, (isChosen ? ' is-chosen' : '') + (held1 ? ' is-used' : '') + (isGlow ? ' is-glow' : ''), ' aria-pressed="' + (isChosen ? 'true' : 'false') + '"' + (held1 ? ' disabled' : ''));
      return ctx.sbs ? '<span class="mixopt">' + card + optHear(c.word, 'word') + '</span>' : card;
    }).join('');
    main.innerHTML = mixPage(ctx, 'mix', G.GAMES.mix.title, 'Board ' + (finished + 1) + ' of ' + total,
      '<p class="spellline" data-line role="status" aria-live="polite">' + esc(line) + '</p>' + READ_BTN
      + '<div class="mixboard' + (ctx.sbs ? ' mixboard--sbs' : '') + '" role="group" aria-label="Sentences" data-fold="slot">' + slots + '</div>'
      + '<div class="mixbar' + (ctx.sbs ? ' mixbar--sbs' : '') + '" data-fold="keys"><div class="mixtray" role="group" aria-label="Word cards">' + cards + '</div>'
      + '<div class="mixact"><button type="button" class="btn btn--ghost" data-skip>Skip<span class="sr"> this board. It comes back later.</span></button>'
      + '<button type="button" class="btn btn--primary btn--big" data-check' + (play.canCheck() ? '' : ' disabled') + '>' + TICK + 'Check</button></div></div>');
    stopDrag();
    wireOptHear(main);
    main.querySelectorAll('[data-card]').forEach((c) => c.addEventListener('click', () => { play.choose(c.dataset.card); draw(chosenLine(), '[data-card="' + c.dataset.card + '"]', glow); }));
    main.querySelectorAll('[data-slot-i]').forEach((s) => s.addEventListener('click', () => tapSlot(Number(s.dataset.slotI), glow)));
    main.querySelector('[data-skip]').addEventListener('click', skip);
    main.querySelector('[data-check]').addEventListener('click', check);
    main.querySelector('[data-read]').addEventListener('click', () => sayLine(b.slots.map((s, i) => (st.placed[i] === undefined ? slotText(s) : '')).filter(Boolean).join(' ')));
    stopDrag = ctx.sbs ? () => {} : enableDrag(main, { targets: '[data-slot-i]', onDrop: (w, t) => put(w, Number(t.dataset.slotI), glow) });
    focusAfter(main, focus);
  }
  const chosenLine = () => (play.chosen() ? play.chosen() + ' is chosen. Tap a sentence to put it there.' : boardHelp());
  function put(word, i, glow = null) {
    if (!live) return;
    const r = play.place(word, i);
    if (r === 'no') { draw('That sentence is done.', '', glow); return; }
    draw(word + ' is in sentence ' + (i + 1) + '. Tap Check when you are ready.', '[data-slot-i="' + i + '"]', glow);
  }
  function tapSlot(i, glow) {
    if (!live) return;
    const chosen = play.chosen();
    if (chosen) { put(chosen, i, glow); return; }
    if (play.take(i)) draw('Back in the tray.', '[data-slot-i="' + i + '"]', glow);
  }
  function check() {
    if (!live || !play.canCheck()) return;
    const r = play.check();
    if (r.done) { boardDone(); return; }
    if (r.miss.length) {
      draw(r.glow ? MISS_LINE + ' The glowing word fits.' : MISS_LINE + ' The right ones stay.', '[data-check]', r.glow);
    } else draw('Yes! Keep going.', '[data-check]', r.glow);
  }
  function boardDone() {
    live = false;
    stopDrag();
    const passes = play.passes();
    passes.forEach((p) => { ctx.record(p.word, p); ctx.mixUsed.push(p.word); });
    scoredN += passes.length;
    cleanN += passes.filter((p) => p.clean).length;
    finished += 1;
    queue = queue.slice(1);
    if (queue.length) { start(); return; }
    scoreCard(main, ctx, G.GAMES.mix.title, cleanN, scoredN, done);
  }
  function skip() {
    if (!live) return;
    play.partial().forEach((p) => ctx.record(p.word, p));
    play.leftWords().forEach((w) => ctx.skip(w));
    queue = [...queue.slice(1), queue[0]];
    start();
  }
  function onKey(e) {
    if (e.key === 'Escape' && live && play.chosen()) { play.unchoose(); draw(boardHelp(), ''); }
  }
  document.addEventListener('keydown', onKey);
  start();
  return () => {
    document.removeEventListener('keydown', onKey);
    stopDrag();
    if (live && play) play.partial().forEach((p) => ctx.record(p.word, p)); // left halfway after a miss
  };
}

const PLAY = { missing, unjumble, match, fill, mix, quick };
/** The games to offer for these words: G.gamesFor for the letter games (a word of one letter has none), the sentence games when enough words have sentences. */
const offeredGame = (words, id, g = null, bank = {}, sbs = false) => {
  if (sbs && id === 'quick') return false; // never offered in Step by step
  if (id === 'fill' || id === 'mix') return !!g && sentenceGameOn(g, words, id, bank, sbs);
  if (sbs && id === 'match') return G.gamesFor(words.map(entryFor), {}, [id], { sbs }).length > 0;
  return !['missing', 'unjumble'].includes(id) || G.gamesFor(words.map(entryFor), {}, [id], { sbs }).length > 0;
};

/**
 * Play these games in turn with the group's words (those back again too).
 * part: mark each game done under this job, so a job left halfway carries on.
 * games: the ids in order; Game day ('games') plays G.dayGames(year, week kind) when none are given.
 */
export function playGames(main, g, { eyebrow, games = null, part = '', onDone, onNone = null, sbs = null }) {
  const way = sbs === null ? Su.wayOf(S.readSetup()) === 'sbs' : !!sbs; // Step by step: Meanings only, three cards, tap only (TR-44)
  const words = W.rows(g);
  let end = null;
  let stopped = false;
  const record = (word, pass) => {
    const day = today();
    // As G.recordPass, with the tile help a pass carries (lv 1 to 4, h 1 when the tray filled a letter).
    S.updateWords((d) => {
      const source = pass.source || 'g';
      return W.addTry(d, { id: S.newId(), word, day, group: g.id, kind: source === 'm' ? 'p' : W.kindOn(d, g, word, day), tries: pass.tries, peeks: pass.peeks || 0, clean: pass.clean && !pass.peeks, source, now: Date.now(), lv: pass.lv, h: pass.h });
    });
  };
  const year = childYear();
  const shared = { fillUsed: [], mixUsed: [] }; // Mix and match uses the words Fill in the blanks did not, first
  function start(bank) {
    const order = (games || (part === 'games' ? (way ? G.SBS_GAMES : G.dayGames(year, St.weekKind(g))) : G.GAME_IDS)).filter((id) => !(way && id === 'quick'));
    const offered = (id) => offeredGame(words, id, g, bank, way);
    const left = (part ? order.filter((id) => !W.stepDay(S.readWords(), g, part + ':' + id)) : [...order]).filter(offered);
    const list = left.length ? left : order.filter(offered);
    if (!list.length && way && !onNone) { onDone(); return; } // Step by step: a job with no game to play still finishes (BR-15 AC3)
    if (!list.length && onNone) { onNone(); return; } // nothing to play (m9): say so, never "<game> done"
    let n = 0;
    const hidden = S.currentPlayer() ? St.hiddenWords(S.readWords(), today()) : new Set();
    const entries = sentenceEntries(g, words, bank);
    const spare = spareEntries(words, bank);
    const turn = Math.max(0, W.daysBetween(g.start || today(), today()));
    function next() {
      if (stopped) return;
      if (n >= list.length) { onDone(); return; }
      const id = list[n];
      n += 1;
      const skip = (word) => { const day = today(); S.updateWords((d) => W.addSkip(d, { id: S.newId(), group: g.id, word, day, flow: 'g:' + id, now: Date.now() })); };
      // Today's skipped words wait at the end, here and on another device.
      const pool = words.filter((x) => G.playable(entryFor(x), id)); // a one-letter word is not jumbled or gapped
      const turnOrder = () => W.inTurn(S.readWords(), g, G.shuffled(pool), today(), 'g:' + id);
      const leftLine = (l) => plural(l.length, 'word') + ' to go';
      const ctx = {
        eyebrow: eyebrow + (list.length > 1 ? ' · game ' + n + ' of ' + list.length : ''), words, record, skip, order: turnOrder, leftLine,
        year, hidden, entries, spare, turn, more: n < list.length, doneToday: null, sbs: way, ...shared,
      };
      end = PLAY[id](main, ctx, () => {
        if (end) end(); // its keys stop here, or they'd reach the next game
        end = null;
        if (part) { const day = today(); S.updateWords((d) => W.markStep(d, g, part + ':' + id, day, Date.now())); }
        next();
      });
    }
    next();
  }
  Promise.all([meaningsFor(words), loadBank()]).then(([, bank]) => { if (!stopped) start(bank); });
  return () => { stopped = true; if (end) end(); stop(); };
}

/* ------------------------------------------------------------- Game mode --- */
export function gameMode(main, { gid }) {
  const id = safeDecode(gid);
  const d = S.readWords();
  const g = W.groupById(d, id);
  if (!g) { location.replace('#/'); return; }
  const draw = (bank) => {
    main.innerHTML = '<section class="wrap page"><div class="pagehead"><span class="eyebrow">My words</span><h1>' + esc(g.name) + '</h1>'
      + '<p class="muted">The same words, any time.</p></div>' + modeSwitch(g, 'game')
      + '<div class="shortcuts gamecards">' + G.GAME_IDS.filter((k) => offeredGame(W.rows(g), k, g, bank, Su.wayOf(S.readSetup()) === 'sbs')).map((k) => '<a class="card shortcut" href="' + groupHref(id) + '/game/' + k + '"><span><strong>' + esc(G.GAMES[k].title) + '</strong><br><span class="muted small">' + esc(G.GAMES[k].line) + '</span></span>' + ICON.arrow + '</a>').join('') + '</div>'
      + '<h2 class="sectionhead">Practise 3 times</h2>' + dotsListHtml(W.allDots(d, g, today()), false)
      + '</section>';
  };
  draw({}); // at once, with the games that need no sentences; the other two join when the bank has come
  loadBank().then((bank) => { if (Object.keys(bank).length && main.querySelector('.gamecards')) draw(bank); });
}

export function oneGame(main, { gid, game }) {
  const id = safeDecode(gid);
  const d = S.readWords();
  const g = W.groupById(d, id);
  if (!g) { location.replace('#/'); return undefined; }
  if (!PLAY[game]) { location.replace(groupHref(id) + '/games'); return undefined; }
  if (game === 'quick' && Su.wayOf(S.readSetup()) === 'sbs') { location.replace(groupHref(id) + '/study/games'); return undefined; } // Step by step has no timed game: on to the Meanings stone
  return playGames(main, g, {
    eyebrow: g.name,
    games: [game],
    onNone: () => {
      main.innerHTML = '<section class="wrap page"><div class="card result"><div class="result__head"><h1>' + esc(G.GAMES[game].title) + '</h1></div>'
        + '<p>These words do not have enough for this game. Try another game.</p>'
        + '<div class="btnrow"><a class="btn btn--primary" href="' + groupHref(id) + '/games">More games' + ICON.arrow + '</a><a class="btn btn--ghost" href="' + groupHref(id) + '">My words</a></div></div></section>';
    },
    onDone: () => {
      const now = S.readWords();
      main.innerHTML = '<section class="wrap page"><div class="card result result--good"><div class="result__head"><span class="celebrate"><span class="result__badge">✓</span>' + burstHtml(12, 1.3) + '</span><h1>' + esc(G.GAMES[game].title) + ' done</h1></div>'
        + dotsListHtml(W.allDots(now, g, today()), false)
        + '<div class="btnrow"><a class="btn btn--primary" href="' + groupHref(id) + '/games">More games' + ICON.arrow + '</a><a class="btn btn--ghost" href="' + groupHref(id) + '">My words</a></div></div></section>';
      placeBursts(main);
    },
  });
}
