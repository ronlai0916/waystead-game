// End of the game: final scores, winner, best word, Star words made, and a
// short video of a computer player (it won, or it cheers for the child who did).
import { savedGame } from '../store.js';
import { starWords, meanings } from '../data.js';
import { esc, ICON, prefersReducedMotion } from '../ui/dom.js';
import { character } from '../ai/characters.js';
import { starEntry } from '../ui/moves.js';
import { wordRowsHtml, wireRows } from '../ui/results.js';
import { canSpeak } from '../ui/speak.js';

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
    + celebrationHtml(s)
    + '<div class="card final"><h2>Final scores</h2><ol class="final__list">' + rows + '</ol></div>'
    + (best ? '<div class="card bestword" data-best><span class="eyebrow">Best word</span><p class="bestword__word">' + esc(best.word.toUpperCase()) + '</p>'
      + '<p class="muted">' + esc(s.players[best.player].name) + ', ' + best.points + ' points</p></div>' : '')
    + '<div class="card stars" data-stars><h2>Star words made</h2>'
    + (made.size ? '<p class="muted small">Loading meanings…</p>' : '<p class="muted">No Star words this time. Look out for them next game: they score 5 extra points.</p>') + '</div>'
    + '<div class="btnrow" data-actions><a class="btn btn--primary" href="#/new">New game' + ICON.arrow + '</a></div>'
    + '</section>';

  const v = main.querySelector('.cheer video');
  if (v) {
    v.muted = true; // never any sound
    v.play().catch(() => {}); // if autoplay is refused, the poster stays
  }

  // The best word and the Star words get the same rows as the results panel.
  const stops = [];
  const wanted = [...made.keys()].concat(best ? [best.word] : []);
  if (wanted.length) {
    Promise.all([starWords(), meanings.lookup(wanted).catch(() => new Map())]).then(([list, entries]) => {
      const box = main.querySelector('[data-stars]');
      if (!box) return;
      const speak = canSpeak();
      if (best) {
        const bestBox = main.querySelector('[data-best]');
        bestBox.innerHTML = '<span class="eyebrow">Best word</span>'
          + wordRowsHtml([{ ...best, by: s.players[best.player].name }], entries, list, { speak });
        stops.push(wireRows(bestBox));
      }
      if (!made.size) return;
      box.innerHTML = '<h2>Star words made</h2>'
        + wordRowsHtml([...made].map(([word, who]) => ({ word, star: true, points: null, by: s.players[who].name })), entries, list, { speak });
      stops.push(wireRows(box));
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
  return () => stops.forEach((stop) => stop());
}

// Which computer player celebrates: the first computer among the winners, or
// else the first computer in the game cheering for the child who won. A game
// of children only has no video. Returns { player, won } or null.
export function celebration(state) {
  const winners = state.result.winners.map((i) => state.players[i]);
  const winner = winners.find((p) => p.computer);
  if (winner) return { player: winner, won: true };
  const fan = state.players.find((p) => p.computer);
  return fan ? { player: fan, won: false } : null;
}

function celebrationHtml(state) {
  const c = celebration(state);
  if (!c) return '';
  const ch = character(c.player.strength);
  const poster = 'assets/characters/' + ch.id + '-happy-256.webp';
  const text = c.won ? esc(c.player.name) + ' is celebrating!' : esc(c.player.name) + ' is cheering for you!';
  const alt = ch.name + ' the ' + ch.animal + ', ' + (c.won ? 'celebrating' : 'cheering');
  const media = prefersReducedMotion()
    ? '<img class="cheer__media" src="' + poster + '" width="256" height="256" alt="' + esc(alt) + '">'
    : '<video class="cheer__media" muted playsinline autoplay preload="auto" poster="' + poster + '" width="256" height="256" aria-label="' + esc(alt) + '">'
      + '<source src="assets/videos/' + ch.id + '-win.webm" type="video/webm"><source src="assets/videos/' + ch.id + '-win.mp4" type="video/mp4"></video>';
  return '<figure class="card cheer">' + media + '<figcaption>' + text + '</figcaption></figure>';
}
