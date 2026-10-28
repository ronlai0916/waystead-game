// Words made in a move, Star-word meaning cards, and the scores strip.
import { esc } from './dom.js';

export function starEntry(starWords, word) {
  return starWords.find((s) => s.word === word) || null;
}

// by: who made it (end screen).
export function starCardHtml(entry, { pop = false, by = '' } = {}) {
  return '<div class="starcard">' + (by ? '<span class="small muted">' + esc(by) + '</span>' : '')
    + '<div class="starcard__head"><span class="starcard__word">' + esc(entry.word) + '</span>'
    + '<span class="plus5' + (pop ? ' plus5--pop' : '') + '" aria-label="5 extra points">+5</span></div>'
    + '<p>' + esc(entry.meaning) + '</p>'
    + (entry.example ? '<p class="example">' + esc(entry.example) + '</p>' : '')
    + '</div>';
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
    + '<span class="scores__name">' + esc(p.name) + '</span><span class="scores__pts">' + p.score + '</span></li>').join('');
  return '<ul class="scores" aria-label="Scores">' + items + '</ul>'
    + (bag == null ? '' : '<p class="bagcount">Tiles in the bag: <b>' + bag + '</b></p>');
}
