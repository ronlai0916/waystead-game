// End of the game: final scores, winner, best word, Star words made.
import { savedGame } from '../store.js';
import { starWords } from '../data.js';
import { esc, ICON } from '../ui/dom.js';
import { starEntry, starCardHtml } from '../ui/moves.js';

const SPELLBRIGHT_YEARS = ['3-4', '5-6'];

export function endView(main) {
  const saved = savedGame();
  const s = saved && saved.state;
  if (!s || !s.over) {
    main.innerHTML = '<section class="wrap page"><div class="card empty"><h1>No finished game</h1>'
      + '<p class="muted">The scores show here when a game ends.</p>'
      + '<a class="btn btn--primary" href="' + (s ? '#/play' : '#/new') + '">' + (s ? 'Continue game' : 'New game') + '</a></div></section>';
    return null;
  }
  const r = s.result;
  const names = r.winners.map((i) => s.players[i].name);
  const headline = names.length === 1 ? names[0] + ' wins!'
    : 'A draw between ' + names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] + '!';
  const reason = r.reason === 'out' ? 'The bag is empty and ' + esc(s.players[s.history[s.history.length - 1].player].name) + ' used every tile.'
    : 'Three full rounds went by with no score.';

  // Best word: the word worth the most points in one move.
  let best = null;
  const made = new Map(); // Star word -> who made it
  for (const h of s.history) {
    if (h.type !== 'play') continue;
    for (const w of h.words) {
      if (!best || w.points > best.points) best = { ...w, player: h.player };
      if (w.star && !made.has(w.word)) made.set(w.word, h.player);
    }
  }

  const order = s.players.map((p, i) => i).sort((a, b) => s.players[b].score - s.players[a].score);
  const rows = order.map((i) => {
    const p = s.players[i];
    const pen = r.penalties[i];
    return '<li class="final__row' + (r.winners.includes(i) ? ' is-winner' : '') + '"><span class="final__name">' + esc(p.name) + '</span>'
      + '<span class="final__note small muted">' + (pen ? 'minus ' + pen + ' for tiles left' : 'no tiles left') + '</span>'
      + '<span class="final__pts">' + p.score + '</span></li>';
  }).join('');

  main.innerHTML = '<section class="wrap page endgame">'
    + '<div class="pagehead"><span class="eyebrow">Game over</span><h1>' + esc(headline) + '</h1><p class="muted">' + reason + '</p></div>'
    + '<div class="card final"><h2>Final scores</h2><ol class="final__list">' + rows + '</ol></div>'
    + (best ? '<div class="card bestword"><span class="eyebrow">Best word</span><p class="bestword__word">' + esc(best.word.toUpperCase()) + '</p>'
      + '<p class="muted">' + esc(s.players[best.player].name) + ', ' + best.points + ' points</p></div>' : '')
    + '<div class="card stars" data-stars><h2>Star words made</h2>'
    + (made.size ? '<p class="muted small">Loading meanings…</p>' : '<p class="muted">No Star words this time. Look out for them next game: they score 5 extra points.</p>') + '</div>'
    + '<div class="btnrow" data-actions><a class="btn btn--primary" href="#/new">New game' + ICON.arrow + '</a></div>'
    + '</section>';

  if (made.size) {
    starWords().then((list) => {
      const box = main.querySelector('[data-stars]');
      if (!box) return;
      box.innerHTML = '<h2>Star words made</h2><div class="starcards">'
        + [...made].map(([word, who]) => {
          const e = starEntry(list, word);
          return e ? starCardHtml(e, { by: s.players[who].name }) : '';
        }).join('') + '</div>';
      // Spellbright covers the Year 3–6 lists, so only offer it for those words.
      const inSpellbright = [...made.keys()].some((word) => {
        const e = starEntry(list, word);
        return e && e.years.some((y) => SPELLBRIGHT_YEARS.includes(y));
      });
      if (inSpellbright) {
        main.querySelector('[data-actions]').insertAdjacentHTML('beforeend',
          '<a class="btn btn--ghost" href="../spellbright/">Practise these in Spellbright' + ICON.external + '</a>');
      }
    }).catch(() => {});
  }
  return null;
}
