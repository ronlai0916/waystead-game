// Small shared pieces: escaping, the word picture, the chunked word, the keyboard.
import { hasImage } from './data.js';

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  spell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18l4-12 4 12M5.5 14h5"/><path d="M15 9h5M15 13h5M15 17h3"/></svg>',
  game: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="2"/><path d="M12 5.5a2.5 2.5 0 1 0-2.4 3.2M12 5.5a2.5 2.5 0 1 1 2.4 3.2M9.6 8.7a2.5 2.5 0 1 0 2.4 2.8M14.4 8.7a2.5 2.5 0 1 1-2.4 2.8"/><path d="M12 11.5V21M12 17c-2.5 0-4-1.5-4.5-3.5 2.5 0 4 1.5 4.5 3.5z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  external: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>',
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
  const own = ownPictureUrl(w);
  if (hasImage(w)) {
    inner = '<img src="assets/images/' + esc(w.image) + '" alt="' + esc(label) + '" loading="lazy" decoding="async">';
  } else if (own) {
    // SB6 TR-53: a grown-up's approved picture of an own word. If it cannot load, the tile below takes its place (the error listener at the foot of this file).
    inner = '<img src="' + esc(own) + '" alt="' + esc(label) + '" loading="lazy" decoding="async" data-ownpic="' + esc(w.word) + '" data-letter="' + esc(w.word[0].toUpperCase()) + '" data-pos="' + esc((w.meaning && w.meaning.partOfSpeech) || '') + '">';
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
// A one-syllable word is one chunk. With { tricky: true } (study pages only,
// never in a test or the practice boxes) its tricky letters stand out.
export function chunked(w, cls = '', { tricky = false } = {}) {
  const from = tricky && w.tricky ? w.word.indexOf(w.tricky) : -1;
  const to = from < 0 ? -1 : from + w.tricky.length;
  let i = 0;
  const parts = w.chunks.map((c) => {
    const letters = [...c].map((ch) => {
      const hot = i >= from && i < to;
      return '<span class="chunked__letter' + (hot ? ' is-tricky' : '') + '" data-i="' + (i++) + '">' + esc(ch) + '</span>';
    }).join('');
    return '<span class="chunked__chunk">' + letters + '</span>';
  });
  const label = w.word + (w.chunks.length > 1 ? ', in parts: ' + w.chunks.join(', ') : '') + (from >= 0 ? ', tricky letters: ' + w.tricky : '');
  return '<span class="chunked ' + cls + '" aria-label="' + esc(label) + '">' + parts.join('') + '</span>';
}
export const chunkText = (w) => (w.tricky ? 'Tricky letters: ' + w.tricky : w.chunks.join(' · '));

// Hide the target word (and simple endings) inside an example sentence.
export function redact(sentence, word) {
  const re = new RegExp('\\b' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es|ed|d|ing)?\\b', 'gi');
  return esc(sentence).replace(re, '<b>_____</b>');
}
export function boldWord(sentence, word) {
  const ends = word.length <= 2 ? '' : '(?:s|es|ed|d|ing)?'; // "I" and "a" take no ending: not "as", "ad"
  const re = new RegExp('\\b(' + word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ends + ')\\b', 'gi');
  return esc(sentence).replace(re, '<b>$1</b>');
}

// Practise 3 times: a word's dots. Filled as its clean rounds come in.
export function dotsHtml(n, of = 3) {
  return '<span class="dots" role="img" aria-label="' + n + ' of ' + of + ' clean rounds">' + Array.from({ length: of }, (_, i) => '<i' + (i < n ? ' class="is-on"' : '') + '></i>').join('') + '</span>';
}

// How far a word's session has got: the dots and "2/3".
export const rowCountHtml = (n, of = 3) => dotsHtml(n, of) + ' <span class="small">' + n + '/' + of + '</span>';
export const RETRY_LINE = 'Let\'s try that one again.';

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const DEL_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5h10a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9l-6-7z"/><path d="M13 9.5l4 4M17 9.5l-4 4"/></svg>';
// { del: true } puts a Delete key at the end of the third row (typed answers only).
export function keyboard({ del = false } = {}) {
  return '<div class="keyboard" role="group" aria-label="Letters">' + ROWS.map((row, r) =>
    '<div class="keyboard-row">' + [...row].map((L) =>
      '<button type="button" class="key" data-letter="' + L + '" aria-label="Guess ' + L + '">' + L + '</button>').join('')
      + (del && r === 2 ? '<button type="button" class="key key--del" data-del aria-label="Delete">' + DEL_ICON + '</button>' : '') + '</div>').join('')
    + '<span class="keypop" aria-hidden="true"></span></div>';
}

// A letter pops up above the key being pressed. One listener for every keyboard; the
// pop-up is absolute, so nothing moves. The key's own letter is aria-hidden here.
let popTimer = null;
function initKeyPop() {
  if (typeof document === 'undefined') return;
  const hide = () => {
    clearTimeout(popTimer);
    popTimer = setTimeout(() => {
      document.querySelectorAll('.keypop.is-on').forEach((p) => p.classList.remove('is-on'));
      document.querySelectorAll('.key.is-pressed').forEach((k) => k.classList.remove('is-pressed'));
    }, 120);
  };
  document.addEventListener('pointerdown', (e) => {
    const key = e.target.closest && e.target.closest('.key[data-letter]');
    const board = key && key.closest('.keyboard');
    const pop = board && board.querySelector('.keypop');
    if (!pop || key.disabled || !document.body.classList.contains('is-child')) return; // a child's screens only
    clearTimeout(popTimer);
    pop.textContent = key.dataset.letter.toLowerCase();
    const w = 50;
    // S3-D1: on a phone the 72 px room above the keys is gone (child.css, FOLD), so a pop-up above the key would sit on Hear, Peek and Skip.
    // There it shows in the key's own row, a key's width beyond the neighbour, on the side with the room (it never covers a control).
    const side = getComputedStyle(board, '::before').display === 'none';
    pop.classList.toggle('keypop--side', side);
    // Work in the board's own coordinates (its box may not be the key's offset parent), then shift back to the key's.
    const bw = board.getBoundingClientRect().width;
    const kr = key.getBoundingClientRect();
    const inBoard = kr.left - board.getBoundingClientRect().left;
    const mid = inBoard + kr.width / 2;
    let left;
    if (side) left = mid < bw / 2 ? inBoard + kr.width * 2 + 6 : inBoard - kr.width - 6 - w;
    else left = mid - w / 2;
    left = Math.max(0, Math.min(bw - w, left));
    pop.style.left = (key.offsetLeft + left - inBoard) + 'px';
    pop.style.top = (side ? key.offsetTop : key.offsetTop - 76) + 'px';
    pop.classList.add('is-on');
    key.classList.add('is-pressed');
  });
  ['pointerup', 'pointercancel'].forEach((t) => document.addEventListener(t, hide));
}
initKeyPop();

// SB6 TR-53: the grown-up's approved pictures of own words, for THIS page load only (never stored). pictures-views.js fills it (A6, approved ones only).
let APPROVED = { map: new Map(), url: () => '' };
/** map: word -> picture id (A6); imageUrl(id): the account's image address. Replaces the whole map, so a removed picture is gone on the next load. */
export function setApprovedPictures(map, imageUrl) {
  APPROVED = { map: map instanceof Map ? new Map([...map].map(([w, id]) => [String(w).toLowerCase(), id])) : new Map(), url: typeof imageUrl === 'function' ? imageUrl : () => '' };
}
const ownPictureUrl = (w) => {
  const id = w && typeof w.word === 'string' ? APPROVED.map.get(w.word.toLowerCase()) : null;
  return id ? APPROVED.url(id) || '' : '';
};
/** Where a word's picture stands: 'ready' (a made picture, or a grown-up's approved one), or 'none'. A child never sees "on its way": nothing is shown until it is approved. */
export const pictureState = (w) => (hasImage(w) || ownPictureUrl(w) ? 'ready' : 'none');

/** "1 of 3 in a row", with its dots. */
export const inARowHtml = (n, of = 3) => dotsHtml(n, of) + ' <span class="inarow">' + n + ' of ' + of + ' in a row</span>';

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

// A picture that will not load (offline, removed): the lettered tile stands in at once, and the word is dropped from the map so a redraw uses the sentence card.
if (typeof document !== 'undefined') {
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!img || img.tagName !== 'IMG' || !img.dataset || !img.dataset.ownpic) return;
    APPROVED.map.delete(img.dataset.ownpic.toLowerCase());
    const ph = document.createElement('div');
    ph.className = 'pic__ph';
    ph.setAttribute('role', 'img');
    ph.setAttribute('aria-label', 'Picture for ' + img.dataset.ownpic);
    const box = document.createElement('div');
    // A screen that spells the word never shows its letter (SB6): inside [data-sbs] or .b6 the tile stays plain and neutral.
    if (!img.closest('[data-sbs], .b6')) {
      const b = document.createElement('b');
      b.textContent = img.dataset.letter || '';
      box.append(b);
    }
    if (!img.closest('[data-sbs], .b6') && img.dataset.pos) { box.append(document.createElement('br')); const sp = document.createElement('span'); sp.textContent = img.dataset.pos; box.append(sp); }
    ph.append(box);
    img.replaceWith(ph);
  }, true);
}
