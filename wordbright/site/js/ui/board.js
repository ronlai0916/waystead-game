// Drawing the board, the squares and the tiles. Plain HTML strings; no inline
// styles (CSP), sizes are set from JS with el.style.

import { esc } from './dom.js';

// Our own square icons (24×24), drawn for Wordbright.
const SVG = (d) => '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + d + '</svg>';
export const SQUARE_ICON = {
  Spark: SVG('<path d="M12 3.5l1.9 6.6 6.6 1.9-6.6 1.9-1.9 6.6-1.9-6.6-6.6-1.9 6.6-1.9z"/>'),
  Glow: SVG('<circle cx="12" cy="12" r="4.2"/><path class="ray" d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.8 1.8M16.7 16.7l1.8 1.8M5.5 18.5l1.8-1.8M16.7 7.3l1.8-1.8"/>'),
  Shine: SVG('<path d="M7 4.5h10l3.5 5L12 20 3.5 9.5z"/><path class="cut" d="M3.8 9.5h16.4M9.4 4.8L12 9.5l2.6-4.7M12 9.5V19.4"/>'),
  Star: SVG('<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/>'),
};

// What each square does, in words (for the legend and screen readers).
export const SQUARE_TEXT = {
  Spark: 'the letter counts twice',
  Glow: 'the letter counts three times',
  Shine: 'the whole word counts twice',
  Star: 'the whole word counts three times',
};

export const KINDS = ['Spark', 'Glow', 'Shine', 'Star'];

export function squareKind(board, i) {
  return board.bonus[i].name || '';
}

// A tile: letter plus its points. A blank shows its letter in a different
// style and no points.
export function tileHtml(letter, { blank = false, value = 0, pending = false, extra = '' } = {}) {
  const cls = 'tile' + (blank ? ' tile--blank' : '') + (pending ? ' tile--pending' : '') + (extra ? ' ' + extra : '');
  const shown = letter === '?' ? '' : letter.toUpperCase();
  const pts = blank || letter === '?' ? '' : '<span class="tile__v">' + value + '</span>';
  return '<span class="' + cls + '"><span class="tile__l">' + esc(shown) + '</span>' + pts + '</span>';
}

// The inside of a square: a tile, or the square's icon and name.
export function squareInner(board, i, tile, values) {
  if (tile) return tileHtml(tile.letter, { blank: tile.blank, value: values[tile.letter], pending: tile.pending });
  if (board.start.has(i)) return '<span class="sq__start" aria-hidden="true"></span>';
  const kind = squareKind(board, i);
  if (!kind) return '';
  return '<span class="sq__icon">' + SQUARE_ICON[kind] + '</span><span class="sq__label" aria-hidden="true">' + kind + '</span>';
}

export function squareClass(board, i) {
  const kind = squareKind(board, i);
  return 'sq' + (kind ? ' sq--' + kind.toLowerCase() : '') + (board.start.has(i) ? ' sq--start' : '');
}

// "Row 7, column 3, Glow square, letter B"
export function squareLabel(board, i, tile) {
  const r = Math.floor(i / board.size);
  const c = i % board.size;
  const kind = squareKind(board, i);
  const parts = ['Row ' + (r + 1), 'column ' + (c + 1)];
  if (kind) parts.push(kind + ' square');
  if (board.start.has(i)) parts.push('start square');
  if (tile) {
    parts.push('letter ' + tile.letter.toUpperCase() + (tile.blank ? ' (blank)' : '') + (tile.pending ? ', placed this turn' : ''));
  } else parts.push('empty');
  return parts.join(', ');
}

// The board as a grid of buttons. Rows use display: contents so the squares
// sit in one CSS grid.
export function boardHtml(board, label) {
  let html = '<div class="board" role="grid" aria-label="' + esc(label) + '" data-board>';
  for (let r = 0; r < board.size; r++) {
    html += '<div role="row" class="board__row">';
    for (let c = 0; c < board.size; c++) {
      const i = r * board.size + c;
      html += '<div role="gridcell" class="board__cell"><button type="button" class="' + squareClass(board, i) + '" data-sq="' + i + '" tabindex="-1"></button></div>';
    }
    html += '</div>';
  }
  return html + '</div>';
}

export function legendHtml(board) {
  const present = new Set(board.bonus.map((b) => b.name).filter(Boolean));
  const items = KINDS.filter((k) => present.has(k)).map((k) =>
    '<li><span class="sq sq--' + k.toLowerCase() + ' legend__sq"><span class="sq__icon">' + SQUARE_ICON[k] + '</span></span>'
    + '<span><b>' + k + '</b> ' + SQUARE_TEXT[k] + '</span></li>');
  const starts = board.start.size;
  items.push('<li><span class="sq sq--start legend__sq"><span class="sq__start"></span></span><span><b>Start</b> '
    + (starts > 1 ? 'the first word covers one of these ' + starts + ' squares' : 'the first word covers this square') + '</span></li>');
  return '<ul class="legend" aria-label="What the squares do">' + items.join('') + '</ul>';
}
