// Start screen: continue the saved game, or start a new one; then the players,
// why it helps, the boards, and Waystead's other things (papers, Spellbright).
import { BRAND } from '../brand.js';
import { savedGame } from '../store.js';
import { BOARD_IDS, BOARD_MINUTES, boardJson } from '../data.js';
import { HINTS_PER_GAME } from '../engine/game.js';
import { CHARACTERS, STRENGTH_ORDER } from '../ai/characters.js';
import { esc, ICON } from '../ui/dom.js';
import { tileHtml } from '../ui/board.js';

const TITLES = { junior: 'Junior', standard: 'Standard', large: 'Large' };

// The four players around the tiles, in reading order: Pip, Ottie, Bramble, Fizz.
function face(strength, cls, alt) {
  const ch = CHARACTERS[strength];
  const src = 'assets/characters/' + ch.id + '-portrait-';
  return '<img class="' + cls + '" src="' + src + '128.webp" srcset="' + src + '128.webp 1x, ' + src + '256.webp 2x"'
    + ' width="128" height="128" alt="' + (alt ? esc(ch.name + ' the ' + ch.animal) : '') + '">';
}

const WHY = [
  { icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>', title: 'Star words: +5',
    text: 'Words from the school spelling lists score 5 extra points. You also see what each one means.' },
  { icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4v-5H4zM10 20h4v-9h-4zM16 20h4V5h-4z"/></svg>', title: 'A word level for each player',
    text: 'From Year 1 to Doctor. It sets which Star words count, and how many words a computer player knows.' },
  { icon: ICON.bulb, title: HINTS_PER_GAME + ' hints per game',
    text: 'Stuck? A hint shows a good word you can make with your tiles.' },
];

const FLOWER = '<svg viewBox="0 0 100 100" class="flower" aria-hidden="true"><g class="flower__petals">'
  + [0, 72, 144, 216, 288].map((r) => '<ellipse cx="50" cy="26" rx="13" ry="18" transform="rotate(' + r + ' 50 46)"/>').join('')
  + '</g><circle cx="50" cy="46" r="10" class="flower__middle"/>'
  + '<path d="M50 58 V94 M50 80 Q36 70 30 74 M50 86 Q62 76 70 79" class="flower__stem"/></svg>';

// A small board drawn from the board file: one cell per square.
const KIND = { S: 'spark', G: 'glow', H: 'shine', T: 'star' };
function miniBoard(b) {
  const starts = new Set(b.start.map(([r, c]) => r * b.size + c));
  let cells = '';
  b.grid.forEach((row, r) => [...row].forEach((ch, c) => {
    const k = starts.has(r * b.size + c) ? 'start' : KIND[ch];
    cells += k ? '<i class="mini--' + k + '"></i>' : '<i></i>';
  }));
  return cells;
}

export function home(main) {
  const saved = savedGame();
  const s = saved && saved.state;
  let resume = '';
  if (s && !s.over) {
    const scores = s.players.map((p) => esc(p.name) + ' ' + p.score).join(' · ');
    resume = '<div class="card resume"><span class="eyebrow">Saved game</span>'
      + '<h2>' + esc(TITLES[s.board] || s.board) + ' board, ' + s.players.length + ' players</h2>'
      + '<p class="muted">' + scores + '</p>'
      + '<p class="muted small">Next turn: ' + esc(s.players[s.turn].name) + '</p>'
      + '<div class="btnrow"><a class="btn btn--primary" href="#/play">Continue game' + ICON.arrow + '</a></div></div>';
  } else if (s && s.over) {
    resume = '<div class="card resume"><span class="eyebrow">Last game</span><h2>Finished</h2>'
      + '<div class="btnrow"><a class="btn btn--ghost" href="#/end">See the scores</a></div></div>';
  }
  const word = ['w', 'o', 'r', 'd'].map((l, i) => '<span class="hero__t">' + tileHtml(l, { value: [4, 2, 2, 2][i] }) + '</span>').join('');
  const faces = STRENGTH_ORDER.map((k, i) => '<span class="hero__face hero__face--' + (i + 1) + '">' + face(k, 'avatar', true) + '</span>').join('');
  const players = STRENGTH_ORDER.map((k) => {
    const ch = CHARACTERS[k];
    return '<li class="card player">' + face(k, 'avatar player__pic', false)
      + '<div class="player__text"><h3>' + esc(ch.name) + '</h3><span class="pill">' + esc(ch.label) + '</span>'
      + '<p class="small muted">' + esc(ch.about) + '</p></div></li>';
  }).join('');
  const why = WHY.map((w) => '<li class="why__item"><span class="why__icon">' + w.icon + '</span>'
    + '<div><h3>' + esc(w.title) + '</h3><p class="muted">' + esc(w.text) + '</p></div></li>').join('');
  const boards = BOARD_IDS.map((id) => '<li><a class="card boardcard" href="#/new?board=' + id + '">'
    + '<span class="mini" data-mini="' + id + '" aria-hidden="true"></span>'
    + '<span class="boardcard__text"><b>' + esc(TITLES[id]) + '</b> <span class="muted" data-size="' + id + '"></span>'
    + '<span class="small muted">About ' + BOARD_MINUTES[id] + ' minutes for two players</span>'
    + (id === 'large' ? '<span class="small muted boardcard__phone">' + ICON.lock + 'Needs a tablet or computer</span>' : '')
    + '</span></a></li>').join('');

  main.innerHTML = '<section class="wrap page home">'
    + resume
    + '<div class="hero"><div class="stack">'
    + '<span class="eyebrow">' + esc(BRAND.full) + '</span>'
    + '<h1>Make words. Light up the board.</h1>'
    + '<p class="hero__lede">A word-tile game for 11+ practice. Play against Pip, Ottie, Bramble and Fizz, or with up to 4 people on one device. Find the bonus squares, and score extra for the school spelling words.</p>'
    + '<div class="btnrow"><a class="btn btn--primary" href="#/new">New game' + ICON.arrow + '</a>'
    + '<a class="btn btn--ghost" href="#/rules">How to play</a></div></div>'
    + '<div class="hero__art">' + faces + '<div class="hero__tiles" aria-hidden="true">' + word + '</div></div>'
    + '</div>'

    + '<section class="hsec" aria-labelledby="h-players"><h2 id="h-players">Meet the players</h2>'
    + '<p class="muted">Four computer players, from easy to very hard. Pick one or more when you start a game.</p>'
    + '<ul class="players">' + players + '</ul></section>'

    + '<section class="hsec" aria-labelledby="h-why"><h2 id="h-why">Why it helps</h2>'
    + '<ul class="card why">' + why + '</ul></section>'

    + '<section class="hsec" aria-labelledby="h-boards"><h2 id="h-boards">Pick a board</h2>'
    + '<ul class="boardcards">' + boards + '</ul></section>'

    + '<aside class="card promo" aria-label="Waystead Learning">'
    + '<div class="promo__papers" aria-hidden="true"><i></i><i></i><i></i></div>'
    + '<div class="stack"><span class="eyebrow">From Waystead Learning</span>'
    + '<h2>11+ English practice papers</h2>'
    + '<p>Original, printable papers for Years 3–6: two reading passages, plus spelling, punctuation and grammar, with an answer key. Try a free 15-minute sample first.</p>'
    + '<div class="btnrow"><a class="btn btn--primary" href="https://learning.waystead.co.uk/packs">See the papers' + ICON.arrow + '</a>'
    + '<a class="btn btn--ghost" href="https://learning.waystead.co.uk/">Visit Waystead Learning</a></div></div>'
    + '</aside>'

    + '<a class="card sister" href="../spellbright/">' + FLOWER
    + '<span class="sister__text"><span class="eyebrow">Also from Waystead</span>'
    + '<b class="sister__name">Practise spelling with Spellbright</b>'
    + '<span class="muted small">Learn every Year 3–6 spelling word, one chapter at a time, with games and tests.</span></span>'
    + ICON.arrow + '</a>'
    + '</section>';

  // Board sizes and pictures come from the board files.
  BOARD_IDS.forEach((id) => boardJson(id).then((b) => {
    const mini = main.querySelector('[data-mini="' + id + '"]');
    if (!mini) return;
    mini.style.setProperty('--n', b.size);
    mini.innerHTML = miniBoard(b);
    main.querySelector('[data-size="' + id + '"]').textContent = b.size + ' × ' + b.size;
  }).catch(() => {}));
}
