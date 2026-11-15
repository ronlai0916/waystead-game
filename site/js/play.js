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
import { playable } from './games-doc.js';

const MAX_BLUR = 20;

export function runSession(main, opts) {
  const { title, eyebrow, mode, onFinish, backAgain = [], lastLabel = 'See how you did', progress = true } = opts;
  const words = opts.words.filter((e) => playable(e, 'flower')); // SB4-WP4: a one-letter word cannot be played on a flower
  if (!words.length) { Promise.resolve().then(() => onFinish([])); return () => {}; }
  const maxWrong = mode === 'mini' ? 6 : 10;
  const results = [];
  let index = 0;
  let round = null;
  let w = null;
  let tiled = false; // this word is played on the letter pad (level 1 to 4): no petal is lost
  const tried = new Set();

  function onKey(e) {
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
    round = new Round(w.word, maxWrong);
    // SB4-WP4: level 1 to 4 replaces the 26 keys with the word's letters and a few more; the level's shown letters are already on.
    const { lv, pf } = S.helpNow(childYear());
    const seed = T.seedOf(w.word, W.localDay(Date.now()));
    const opts = { profile: pf, lexicon: D.lexicon() };
    const spec = lv < 5 ? T.tilesFor(w, lv, seed, opts) : null;
    const letters = spec ? T.keypadFor(w, lv, seed, opts) : [];
    tiled = !!spec && letters.length > 0;
    tried.clear();
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
      + '<div class="btnrow btnrow--center"><button type="button" class="btn btn--primary" data-hearmain>' + ICON.play + 'Hear the word</button></div>'
      + '<div class="blanks" aria-live="polite"></div>'
      + (tiled ? '<p class="spellline" data-line role="status" aria-live="polite"></p>' : '')
      + '<details class="hint"><summary>Show the meaning</summary><div class="hint__body">'
      + '<p><span class="pill">' + esc(w.meaning.partOfSpeech) + '</span> ' + esc(w.meaning.definition) + '</p>'
      + '<p class="example">' + redact(w.meaning.example, w.word) + '</p>'
      + '</div></details>'
      + '<div data-slot>' + (tiled ? padHtml(letters, revealed) : keyboard()) + '</div>'
      + '<p class="muted small" data-wrongtext></p>'
      + '</section>';
    main.querySelectorAll('[data-hear], [data-hearmain]').forEach((b) => b.addEventListener('click', () => speak(w.word)));
    main.querySelectorAll('.key').forEach((k) => k.addEventListener('click', () => guess(k.dataset.letter)));
    setBlur(main, MAX_BLUR);
    paint();
  }

  function paint() {
    const st = round.state;
    const blanks = main.querySelector('.blanks');
    blanks.innerHTML = [...round.word].map((c) => {
      const got = round.guessed.has(c);
      if (got) return '<span class="got">' + c + '</span>';
      if (st === 'lost') return '<span class="missed">' + c + '</span>';
      return '<span aria-label="blank">&nbsp;</span>';
    }).join('');
    drawFlower(main.querySelector('.flower'), round.wrong);
    main.querySelectorAll('.lives i').forEach((el, i) => el.classList.toggle('lost', i >= maxWrong - round.wrong));
    main.querySelector('[data-wrongtext]').textContent = 'Petals left: ' + (maxWrong - round.wrong);
    if (mode === 'mini' && st === 'playing') setBlur(main, MAX_BLUR * (1 - round.wrong / maxWrong));
  }

  function guess(L) {
    if (!round || round.state !== 'playing') return;
    if (tiled) { // no petal is lost: a letter that is not in the word just greys out
      if (tried.has(L) || round.guessed.has(L)) return;
      tried.add(L);
      const k = main.querySelector('.key[data-letter="' + L + '"]');
      if (!round.word.includes(L)) {
        if (k) { k.classList.add('miss'); k.disabled = true; }
        main.querySelector('[data-line]').textContent = LINES.letter;
        return;
      }
      main.querySelector('[data-line]').textContent = '';
    }
    const r = round.guess(L);
    if (r === 'repeat') return;
    const key = main.querySelector('.key[data-letter="' + L + '"]');
    if (key) { key.classList.add(r === 'hit' ? 'hit' : 'miss'); key.disabled = true; }
    paint();
    if (round.state !== 'playing') finishWord();
  }

  function finishWord() {
    const won = round.state === 'won';
    results.push({ entry: w, won, wrong: round.wrong, ...(tiled ? { tiles: true } : {}) });
    revealPicture(main, w);
    main.querySelectorAll('.key').forEach((k) => { k.disabled = true; });
    const last = index === words.length - 1;
    main.querySelector('[data-slot]').innerHTML = '<div class="card result ' + (won ? 'result--good' : 'result--soft') + '">'
      + '<div class="result__head">' + (won ? '<span class="celebrate"><span class="result__badge">✓</span>' + burstHtml(12, 1.3) + '</span>' : '<span class="result__badge">•</span>')
      + '<h2>' + (won ? 'You got it' : 'The word was') + '</h2></div>'
      + '<div class="stack"><div class="result__word">' + chunked(w) + '</div>'
      + '<p class="ipa">' + esc(w.ipa) + '</p>'
      + '<p>' + esc(w.meaning.definition) + '</p></div>'
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
  }

  renderWord();
  return () => { cleanup(); stop(); };
}

export function summaryHtml(results, heading) {
  const right = results.filter((r) => r.won).length;
  return '<div class="pagehead"><span class="eyebrow">Finished</span><h1>' + esc(heading) + '</h1>'
    + '<p class="muted">You spelled ' + right + ' of ' + results.length + ' words.</p></div>'
    + '<div class="list">' + results.map((r) =>
      '<div class="card listrow"><strong>' + esc(r.entry.word) + '</strong>'
      + (r.won ? '<span class="pill pill--done">Got it</span>' : '<span class="pill pill--warm">Missed</span>') + '</div>').join('') + '</div>';
}
