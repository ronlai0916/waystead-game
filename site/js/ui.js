// Small shared pieces: escaping, the word picture, the chunked word, the keyboard.
import { hasImage } from './data.js';

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  spell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18l4-12 4 12M5.5 14h5"/><path d="M15 9h5M15 13h5M15 17h3"/></svg>',
  game: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h8M6 20V4h8v3"/><circle cx="14" cy="10" r="2.5"/><path d="M14 12.5V17"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

const WAYMARK = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M16 34 L34 70 L50 26 L66 70 L84 34"/></svg>';

// The word's picture. When the illustration hasn't been made yet, a tile
// stands in: in play it shows the part of speech (a fair hint), otherwise the
// first letter.
export function picture(w, { blur = null, alt = true } = {}) {
  const cls = 'pic' + (blur != null ? ' pic--blur' : '');
  const label = alt ? 'Picture for ' + w.word : '';
  let inner;
  if (hasImage(w)) {
    inner = '<img src="assets/images/' + esc(w.image) + '" alt="' + esc(label) + '" loading="lazy" decoding="async">';
  } else if (blur != null) {
    inner = '<div class="pic__ph" role="img" aria-label="Picture not drawn yet">' + WAYMARK + '<span>' + esc(w.meaning.partOfSpeech) + '</span></div>';
  } else {
    inner = '<div class="pic__ph" role="img" aria-label="' + esc(label) + '"><div><b>' + esc(w.word[0].toUpperCase()) + '</b><br><span>' + esc(w.meaning.partOfSpeech) + '</span></div></div>';
  }
  return '<div class="' + cls + '" data-pic>' + inner + '</div>';
}

// Blur is a CSS variable on the picture, so changing it animates.
export function setBlur(root, px) {
  const el = root.querySelector('[data-pic]');
  if (el) el.style.setProperty('--blur', px + 'px');
}
export function revealPicture(root, w) {
  const el = root.querySelector('[data-pic]');
  if (el) el.outerHTML = picture(w);
}

// The word laid out as its spelling chunks, each letter addressable for highlights.
export function chunked(w, cls = '') {
  let i = 0;
  const parts = w.chunks.map((c) => {
    const letters = [...c].map((ch) => '<span class="chunked__letter" data-i="' + (i++) + '">' + esc(ch) + '</span>').join('');
    return '<span class="chunked__chunk">' + letters + '</span>';
  });
  return '<span class="chunked ' + cls + '" aria-label="' + esc(w.word + ', in parts: ' + w.chunks.join(', ')) + '">' + parts.join('') + '</span>';
}
export const chunkText = (w) => w.chunks.join(' · ');

// Hide the target word (and simple endings) inside an example sentence.
export function redact(sentence, word) {
  const re = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es|ed|d|ing)?\\b', 'gi');
  return esc(sentence).replace(re, '<b>_____</b>');
}
export function boldWord(sentence, word) {
  const re = new RegExp('\\b(' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:s|es|ed|d|ing)?)\\b', 'gi');
  return esc(sentence).replace(re, '<b>$1</b>');
}

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
export function keyboard() {
  return '<div class="keyboard" role="group" aria-label="Letters">' + ROWS.map((row) =>
    '<div class="keyboard-row">' + [...row].map((L) =>
      '<button type="button" class="key" data-letter="' + L + '" aria-label="Guess ' + L + '">' + L + '</button>').join('') + '</div>').join('') + '</div>';
}

export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let toastTimer = null;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

export function meter(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return '<div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + done + '"><span data-w="' + pct + '"></span></div>';
}
// Widths are set from JS so the page needs no inline style attributes (CSP).
export function applyMeters(root) {
  root.querySelectorAll('.meter > span[data-w]').forEach((s) => { s.style.width = s.dataset.w + '%'; });
}
