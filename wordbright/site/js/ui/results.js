// The results panel after every play: one row per word made (the main word
// first, then the cross words) with its points, pronunciation, a Hear button,
// part of speech, meaning and example. The end screen uses the same rows.
import { esc, ICON } from './dom.js';
import { wordInfo } from '../meanings.js';
import { starEntry } from './moves.js';
import { canSpeak, hear, onVoices } from './speak.js';

export const LOOK_UP = 'https://dictionary.cambridge.org/dictionary/english/';

let ids = 0;

// The words of a move in the order shown: main word first, then cross words.
export function movedWords(score) {
  return [...score.words.filter((w) => w.main), ...score.words.filter((w) => !w.main)];
}

// One row. w: { word, points, star }; info: from wordInfo(); by: who made it (end screen).
export function wordRowHtml(w, info, { by = '', speak = false, pop = false } = {}) {
  const id = 'wm' + (++ids);
  const hearable = !!info.audio || speak;
  const pos = info.pos ? esc(info.pos) + (info.lemma ? ', a form of “' + esc(info.lemma) + '”' : '') : '';
  return '<li class="wordrow' + (w.star ? ' wordrow--star' : '') + '">'
    + '<div class="wordrow__head"><span class="wordrow__word" lang="en-GB">' + esc(w.word.toUpperCase()) + '</span>'
    + (w.star ? '<span class="plus5' + (pop ? ' plus5--pop' : '') + '" aria-label="Star word, 5 extra points">+5</span>' : '')
    + (w.points == null ? '' : '<span class="wordrow__pts">' + w.points + '<span class="sr">' + (w.points === 1 ? ' point' : ' points') + '</span></span>')
    + '</div>'
    + (by ? '<p class="small muted">' + esc(by) + '</p>' : '')
    + '<div class="wordrow__say">'
    + (info.ipa ? '<span class="wordrow__ipa" lang="en-GB-fonipa" aria-label="Pronunciation ' + esc(info.ipa) + '">' + esc(info.ipa) + '</span>' : '')
    + '<button type="button" class="btn btn--quiet btn--small wordrow__hear" data-hear="' + esc(w.word) + '"'
    + (info.audio ? ' data-audio="' + esc(info.audio) + '"' : '') + (hearable ? '' : ' hidden') + '>'
    + ICON.speaker + 'Hear<span class="sr"> ' + esc(w.word) + '</span></button></div>'
    + (info.meaning
      ? (pos ? '<p class="wordrow__pos small muted">' + pos + '</p>' : '')
        + '<p class="wordrow__meaning" id="' + id + '">' + esc(info.meaning) + '</p>'
        + '<button type="button" class="linkbtn wordrow__more" data-more aria-controls="' + id + '" aria-expanded="false" hidden>More</button>'
        + (info.example ? '<p class="example">' + esc(info.example) + '</p>' : '')
      : '<p class="wordrow__meaning muted">No meaning yet.</p>')
    + '<a class="small wordrow__look" href="' + LOOK_UP + encodeURIComponent(w.word) + '" target="_blank" rel="noopener">Look it up'
    + '<span class="sr"> in the Cambridge Dictionary (opens in a new tab)</span>' + ICON.external + '</a>'
    + '</li>';
}

// Rows for words. entries: Map word -> shard entry; starWords: star_words.json.
export function wordRowsHtml(words, entries, starWords, opts = {}) {
  return '<ul class="wordrows">' + words.map((w) => {
    const star = w.star ? starEntry(starWords, w.word) : null;
    return wordRowHtml(w, wordInfo(w.word, entries.get(w.word) || null, star), { ...opts, by: w.by || '' });
  }).join('') + '</ul>';
}

// The whole panel for one play.
export function resultsHtml(name, score, entries, starWords) {
  const extra = [];
  if (score.starBonus) extra.push(['Star words', '+' + score.starBonus]);
  if (score.fullRack) extra.push(['Full-rack bonus', '+' + score.fullRack]);
  return '<div class="card movecard results" aria-labelledby="results-title">'
    + '<h2 id="results-title">' + esc(name) + ' scored ' + score.total + '</h2>'
    + wordRowsHtml(movedWords(score), entries, starWords, { speak: canSpeak(), pop: true })
    + '<ul class="wordlines">' + extra.map(([k, v]) => '<li class="wordline--bonus"><span class="wordline__word">' + k + '</span><span class="wordline__pts">' + v + '</span></li>').join('')
    + '<li class="wordline--total"><span class="wordline__word">Total</span><span class="wordline__pts">' + score.total + '</span></li></ul>'
    + '</div>';
}

// Hear and More buttons. Returns a function that stops listening.
export function wireRows(root) {
  const onClick = (e) => {
    const h = e.target.closest('[data-hear]');
    if (h) { hear(h.dataset.hear, h.dataset.audio || ''); return; }
    const m = e.target.closest('[data-more]');
    if (m) {
      const open = m.getAttribute('aria-expanded') !== 'true';
      root.querySelector('#' + m.getAttribute('aria-controls')).classList.toggle('is-open', open);
      m.setAttribute('aria-expanded', String(open));
      m.textContent = open ? 'Less' : 'More';
    }
  };
  root.addEventListener('click', onClick);
  // "More" only where the meaning is cut short.
  const measure = () => root.querySelectorAll('[data-more]').forEach((b) => {
    const p = root.querySelector('#' + b.getAttribute('aria-controls'));
    if (b.getAttribute('aria-expanded') === 'true') return;
    b.hidden = p.scrollHeight <= p.clientHeight + 1;
  });
  measure();
  const ro = new ResizeObserver(measure);
  ro.observe(root);
  // The device may list its voices after the panel is drawn.
  const stop = onVoices(() => root.querySelectorAll('[data-hear]:not([data-audio])').forEach((b) => { b.hidden = !canSpeak(); }));
  return () => { root.removeEventListener('click', onClick); ro.disconnect(); stop(); };
}
