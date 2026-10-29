// Words made in a move (short form), Star-word lookup, and the scores strip.
// The full results panel, with meanings, is ui/results.js.
import { esc } from './dom.js';
import { pictureHtml } from '../ai/characters.js';

export function starEntry(starWords, word) {
  return starWords.find((s) => s.word === word) || null;
}

// score: from scoreMove / play().
export function wordsHtml(score) {
  const rows = score.words.map((w) => '<li><span class="wordline__word">' + esc(w.word.toUpperCase()) + '</span>'
    + (w.star ? '<span class="pill pill--star">Star word</span>' : '')
    + '<span class="wordline__pts">' + w.points + '</span></li>');
  if (score.starBonus) rows.push('<li class="wordline--bonus"><span class="wordline__word">Star words</span><span class="wordline__pts">+' + score.starBonus + '</span></li>');
  if (score.fullRack) rows.push('<li class="wordline--bonus"><span class="wordline__word">Full-rack bonus</span><span class="wordline__pts">+' + score.fullRack + '</span></li>');
  return '<ul class="wordlines">' + rows.join('') + '<li class="wordline--total"><span class="wordline__word">Total</span><span class="wordline__pts">' + score.total + '</span></li></ul>';
}

export function scoresHtml(state, { bag = null } = {}) {
  const items = state.players.map((p, i) => '<li class="scores__p' + (i === state.turn && !state.over ? ' is-turn' : '') + '"'
    + (i === state.turn && !state.over ? ' aria-current="true"' : '') + '>'
    + (p.computer ? pictureHtml(p.strength, 'portrait', 128, 'avatar avatar--chip') : '')
    + '<span class="scores__name">' + esc(p.name) + '</span><span class="scores__pts">' + p.score + '</span></li>').join('');
  return '<ul class="scores" aria-label="Scores">' + items + '</ul>'
    + (bag == null ? '' : '<p class="bagcount">Tiles in the bag: <b>' + bag + '</b></p>');
}
