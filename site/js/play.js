// One play session: a list of words, played one after another as the
// flower game (guess letters before the petals fall).
// Used by the quick game (6 wrong guesses, picture sharpens as you miss),
// the full practice (10 wrong guesses, picture stays blurred until the end)
// and "Pick words".
import { Round, flower, drawFlower } from './flower.js';
import { speak, stop } from './speech.js';
import { burstHtml, placeBursts } from './celebrate.js';
import { esc, picture, setBlur, revealPicture, chunked, redact, keyboard, ICON } from './ui.js';
import * as S from './store.js';
import * as D from './data.js';
import * as T from './tiles-doc.js';
import * as W from './words-doc.js';
import { childYear } from './who.js';
import { padHtml, LINES } from './tray.js';
import { shown } from './word-info.js';
import * as G from './games-doc.js';
import { playable } from './games-doc.js';
import { peekButtonHtml, mountPeek } from './peek.js';
import { peekMs } from './peek-doc.js';
import * as Su from './setup-doc.js';

const MAX_BLUR = 20;

export function runSession(main, opts) {
  const { title, eyebrow, mode, onFinish, backAgain = [], lastLabel = 'See how you did', progress = true } = opts;
  const words = opts.words.filter((e) => playable(e, 'flower')); // SB4-WP4: a one-letter word cannot be played on a flower
  if (!words.length) { Promise.resolve().then(() => onFinish([])); return () => {}; }
  const keyPetals = mode === 'mini' ? 6 : 10;
  let maxWrong = keyPetals; // a letter pad (tiles) has its own count: fewer petals than wrong tiles (T.petalsFor)
  const results = [];
  let index = 0;
  let round = null;
  let w = null;
  const setup = S.readSetup();
  const sbs = opts.sbs !== undefined ? !!opts.sbs : Su.wayOf(setup) === 'sbs'; // Step by step: no petal is ever lost on a slip
  let peeking = false;
  let peek = null;
  let peeked = false; // this round ended with a peek
  let slips = 0; // real misses this round (Step by step keeps the petals, but the slips still count)
  let tiled = false; // this word is played on the letter pad (level 1 to 4): a wrong tile takes a petal, as a wrong key does

  function onKey(e) {
    if (peeking) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (/^[a-z]$/i.test(e.key)) {
      e.preventDefault();
      guess(e.key.toUpperCase());
    } else if (e.key === 'Enter' && round && round.state !== 'playing') {
      const next = main.querySelector('[data-next]');
      if (next) { e.preventDefault(); next.click(); }
    }
  }
  document.addEventListener('keydown', onKey);

  function renderWord() {
    w = words[index];
    // SB4-WP4: level 1 to 4 replaces the 26 keys with the word's letters and a few more; the level's shown letters are already on.
    const { lv, pf } = S.helpNow(childYear());
    const seed = T.seedOf(w.word, W.localDay(Date.now()));
    const opts = { profile: pf, lexicon: D.lexicon() };
    const spec = lv < 5 ? T.tilesFor(w, lv, seed, opts) : null;
    const letters = spec ? T.keypadFor(w, lv, seed, opts) : [];
    tiled = !!spec && letters.length > 0;
    maxWrong = tiled ? T.petalsFor(T.wrongTilesOf(w.word, letters)) : keyPetals;
    round = new Round(w.word, maxWrong);
    peeked = false;
    slips = 0;
    if (peek) { peek.destroy(); peek = null; }
    const revealed = new Set();
    if (tiled) {
      const gapSet = new Set(spec.gaps);
      const chars = [...w.word];
      for (const c of new Set(chars.map((x) => x.toUpperCase()))) {
        if (chars.every((x, i) => x.toUpperCase() !== c || !gapSet.has(i))) { revealed.add(c); round.guessed.add(c); }
      }
    }
    main.innerHTML = '<section class="wrap page play">'
      + '<div class="pagehead"><span class="eyebrow">' + esc(eyebrow) + '</span><h1>' + esc(title) + '</h1></div>'
      + '<div class="status">' + (progress ? '<span class="progressline">Word ' + (index + 1) + ' of ' + words.length
      + (backAgain.includes(w) ? ' <span class="pill">Back again</span>' : '') + '</span>' : '<span></span>')
      + '<span class="lives" aria-label="Lives">' + '<i></i>'.repeat(maxWrong) + '</span></div>'
      + '<div class="play__top">' + picture(w, { blur: MAX_BLUR }) + flower(maxWrong) + '</div>'
      + '<div class="btnrow btnrow--center"><button type="button" class="btn btn--primary" data-hearmain>' + ICON.play + 'Hear the word</button>' + peekButtonHtml() + '</div>'
      + '<div class="blanks" aria-live="polite"></div>'
      + (tiled ? '<p class="spellline" data-line role="status" aria-live="polite"></p>' : '')
      + (w.meaning.definition // SB4-WP7: an own word with no meaning has no meaning box
        ? '<details class="hint"><summary>Show the meaning</summary><div class="hint__body">'
          + '<p><span class="pill">' + esc(w.meaning.partOfSpeech) + '</span> ' + esc(w.meaning.definition) + '</p>'
          + (shown(w).meaning.example ? '<p class="example">' + redact(w.meaning.example, w.word) + '</p>' : '')
          + '</div></details>' : '')
      + '<div data-slot>' + (tiled ? padHtml(letters, revealed) : keyboard()) + '</div>'
      + (sbs ? '' : '<p class="muted small" data-wrongtext></p>')
      + '</section>';
    main.querySelectorAll('[data-hear], [data-hearmain]').forEach((b) => b.addEventListener('click', () => speak(w.word)));
    main.querySelectorAll('.key').forEach((k) => k.addEventListener('click', () => guess(k.dataset.letter)));
    setBlur(main, MAX_BLUR);
    paint();
    // Peek: the whole word shows in the blanks; the round then ends "with a peek", no petal lost (BR-3 AC3).
    peek = mountPeek(main, {
      word: w.word.toUpperCase(),
      ms: peekMs(setup, { way: sbs ? 'sbs' : 'usual', input: tiled ? 'tiles' : 'keys' }),
      boxes: () => [...main.querySelectorAll('.blanks span')],
      lock: (on) => {
        peeking = on;
        main.querySelectorAll('.key').forEach((k) => { k.disabled = on || k.classList.contains('hit') || k.classList.contains('miss'); });
        const bl = main.querySelector('.blanks'); // the Peek announces the word once; the blanks stay quiet while it shows
        if (bl) bl.setAttribute('aria-live', on ? 'off' : 'polite');
      },
      can: () => !!round && round.state === 'playing',
      nudgeMs: sbs ? 10000 : 0,
      onEnd: () => { if (round && round.state === 'playing') { peeked = true; finishWord(); } },
    });
  }

  function paint() {
    const st = round.state;
    const blanks = main.querySelector('.blanks');
    blanks.innerHTML = [...round.word].map((c) => {
      const got = round.guessed.has(c);
      if (got || peeked) return '<span class="got">' + c + '</span>';
      if (st === 'lost') return '<span class="missed">' + c + '</span>';
      return '<span aria-label="blank">&nbsp;</span>';
    }).join('');
    drawFlower(main.querySelector('.flower'), round.wrong);
    main.querySelectorAll('.lives i').forEach((el, i) => el.classList.toggle('lost', i >= maxWrong - round.wrong));
    const wt = main.querySelector('[data-wrongtext]');
    if (wt) wt.textContent = 'Petals left: ' + (maxWrong - round.wrong);
    if (mode === 'mini' && st === 'playing') setBlur(main, MAX_BLUR * (1 - round.wrong / maxWrong));
  }

  function guess(L) {
    if (!round || round.state !== 'playing') return;
    const before = round.wrong;
    const r = round.guess(L);
    if (r === 'repeat') return;
    if (r === 'miss') slips += 1;
    if (sbs && r === 'miss') round.wrong = before; // Step by step: a slip takes no petal
    const line = main.querySelector('[data-line]');
    if (line) line.textContent = r === 'miss' && round.state === 'playing' ? LINES.letter : '';
    const key = main.querySelector('.key[data-letter="' + L + '"]');
    if (key) { key.classList.add(r === 'hit' ? 'hit' : 'miss'); key.disabled = true; }
    paint();
    if (round.state !== 'playing') finishWord();
  }

  function finishWord() {
    const won = round.state === 'won' && !peeked;
    if (peeked) { const bl = main.querySelector('.blanks'); if (bl) bl.setAttribute('aria-live', 'off'); }
    // A round with a slip (Step by step keeps the petals) or a peek is not a spelling from memory: `won` is false for the record,
    // so views.js keeps the word in Words to practise again. The card stays kind ("You got it") when the word was finished.
    results.push(G.flowerResult({ entry: w, state: round.state, peeked, slips, wrong: round.wrong, tiled, sbs }));
    if (peek) { peek.destroy(); peek = null; }
    paint();
    revealPicture(main, w);
    main.querySelectorAll('.key').forEach((k) => { k.disabled = true; });
    const last = index === words.length - 1;
    main.querySelector('[data-slot]').innerHTML = '<div class="card result ' + (won ? 'result--good' : 'result--soft') + '">'
      + '<div class="result__head">' + (won ? '<span class="celebrate"><span class="result__badge">✓</span>' + burstHtml(12, 1.3) + '</span>' : '<span class="result__badge">•</span>')
      + '<h2>' + (won ? 'You got it' : peeked ? 'With a peek' : sbs && slips && round.state === 'won' ? 'With a slip' : 'The word was') + '</h2></div>'
      + '<div class="stack"><div class="result__word">' + chunked(w) + '</div>'
      + (w.ipa ? '<p class="ipa">' + esc(w.ipa) + '</p>' : '')
      + (w.meaning.definition ? '<p>' + esc(w.meaning.definition) + '</p>' : '') + '</div>'
      + '<div class="btnrow"><button type="button" class="btn btn--primary" data-next>' + (last ? lastLabel : 'Next word') + ICON.arrow + '</button>'
      + '<button type="button" class="btn btn--ghost" data-hear2>' + ICON.play + 'Hear it</button></div></div>';
    placeBursts(main);
    main.querySelector('[data-hear2]').addEventListener('click', () => speak(w.word));
    main.querySelector('[data-next]').addEventListener('click', () => {
      stop();
      if (last) {
        cleanup();
        onFinish(results);
      } else {
        index += 1;
        renderWord();
        window.scrollTo(0, 0);
      }
    });
    main.querySelector('[data-next]').focus({ preventScroll: true });
    speak(w.word);
  }

  function cleanup() {
    document.removeEventListener('keydown', onKey);
    if (peek) { peek.destroy(); peek = null; }
  }

  renderWord();
  return () => { cleanup(); stop(); };
}

export function summaryHtml(results, heading) {
  const right = results.filter((r) => r.won).length;
  const sbs = results.some((r) => r.sbs); // Step by step: no count, and a slip is never "missed"
  return '<div class="pagehead"><span class="eyebrow">Finished</span><h1>' + esc(heading) + '</h1>'
    + (sbs ? '' : '<p class="muted">You spelled ' + right + ' of ' + results.length + ' words.</p>') + '</div>'
    + '<div class="list">' + results.map((r) =>
      '<div class="card listrow"><strong>' + esc(r.entry.word) + '</strong>'
      + (r.won ? '<span class="pill pill--done">Got it</span>' : r.peeked ? '<span class="pill pill--warm">With a peek</span>' : r.sbs ? '<span class="pill pill--warm">With a slip</span>' : '<span class="pill pill--warm">Missed</span>') + '</div>').join('') + '</div>';
}
