// Start screen: continue the saved game, or start a new one.
import { BRAND } from '../brand.js';
import { savedGame } from '../store.js';
import { esc, ICON } from '../ui/dom.js';
import { tileHtml } from '../ui/board.js';

const TITLES = { junior: 'Junior', standard: 'Standard', large: 'Large' };

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
  main.innerHTML = '<section class="wrap page">'
    + '<div class="hero"><div class="stack">'
    + '<span class="eyebrow">' + esc(BRAND.full) + '</span>'
    + '<h1>Make words. Light up the board.</h1>'
    + '<p class="hero__lede">A word-tile game for 11+ practice. Play against Pip, Ottie, Bramble and Fizz, or with up to 4 people on one device. Find the bonus squares, and score extra for the school spelling words.</p>'
    + '<div class="btnrow"><a class="btn btn--primary" href="#/new">New game' + ICON.arrow + '</a>'
    + '<a class="btn btn--ghost" href="#/rules">How to play</a></div></div>'
    + '<div class="hero__art" aria-hidden="true"><div class="hero__tiles">' + word + '</div></div>'
    + '</div>'
    + resume
    + '</section>';
}
