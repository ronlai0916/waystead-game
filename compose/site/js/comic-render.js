// Drawing a comic (C2): panels with their picture, a caption box under it and a
// speech bubble over it, as HTML strings. The comic devices (panels, gutters,
// caption boxes, bubbles) are CSS, in each style's own tokens (css/app.css).
// No inline styles (CSP): a sticker's place and size are data-* attributes,
// turned into CSS custom properties by placeStickers() with el.style.setProperty.
import * as K from './comic-doc.js';
import { esc } from './ui.js';
import { stickers, comicShared } from './tasks.js';

const pic = (file, w) => file + '-' + w + '.webp';
const svg = (body, cls = '') => '<svg viewBox="0 0 24 24" aria-hidden="true"' + (cls ? ' class="' + cls + '"' : '') + '>' + body + '</svg>';

/** Small line icons for the story wheel and the spark cards. */
export const ICONS = {
  person: svg('<circle cx="12" cy="7" r="3.5"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>'),
  people: svg('<circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M2.5 20c0-3.5 2.5-6 5.5-6s5.5 2.5 5.5 6M13.5 20c.3-3 1.6-5 3-5 2.2 0 4.5 2 4.5 5"/>'),
  dog: svg('<path d="M5 9l-1 5h3M5 9c0-3 2-5 5-5h4c3 0 5 2 5 5v6a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3"/><circle cx="10" cy="10" r=".8"/><circle cx="15" cy="10" r=".8"/><path d="M11.5 14h2"/>'),
  ball: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5l4 3-1.5 4.5h-5L8 10.5z"/>'),
  tree: svg('<path d="M12 21v-6"/><path d="M12 3c-3.5 0-6 2.7-6 6 0 3.1 2.6 6 6 6s6-2.9 6-6c0-3.3-2.5-6-6-6z"/>'),
  house: svg('<path d="M3.5 11L12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/><path d="M10 20v-5h4v5"/>'),
  school: svg('<path d="M3 20h18M5 20V10l7-5 7 5v10"/><path d="M10 20v-4h4v4M12 8v3"/>'),
  wave: svg('<path d="M2 14c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><circle cx="17" cy="6" r="2.5"/>'),
  bus: svg('<rect x="4" y="4" width="16" height="13" rx="2.5"/><path d="M4 11h16M8 20v-3M16 20v-3"/>'),
  shop: svg('<path d="M3 9l2-5h14l2 5"/><path d="M3 9c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3c0 1.7 1.3 3 3 3s3-1.3 3-3M5 12v8h14v-8"/>'),
  snow: svg('<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5L12 6l2.5-1.5M9.5 19.5L12 18l2.5 1.5"/>'),
  tent: svg('<path d="M2.5 20L12 4l9.5 16z"/><path d="M12 4v16M9 20l3-5 3 5"/>'),
  book: svg('<path d="M12 6c-2-1.5-5-2-8-1.5V19c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V4.5C17 4 14 4.5 12 6zM12 6v14.5"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
  moon: svg('<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.5 6.5 0 0 0 10 10z"/>'),
  rain: svg('<path d="M7 15a4.5 4.5 0 0 1-.6-9A5.5 5.5 0 0 1 17 7.5a3.8 3.8 0 0 1 .5 7.5z"/><path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5"/>'),
  wind: svg('<path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h7"/>'),
  clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>'),
  star: svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>'),
  cake: svg('<path d="M4 20h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2zM4 15c2 1.5 4 1.5 5.3 0 1.4 1.5 4 1.5 5.4 0 1.3 1.5 3.3 1.5 5.3 0M12 11V7"/><path d="M12 3.5c.8 1 .8 2 0 3-.8-1-.8-2 0-3z"/>'),
  robot: svg('<rect x="5" y="8" width="14" height="11" rx="2.5"/><path d="M12 8V4.5"/><circle cx="12" cy="4" r="1"/><circle cx="9.5" cy="13" r="1.2"/><circle cx="14.5" cy="13" r="1.2"/><path d="M2.5 12v3M21.5 12v3"/>'),
  search: svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5.5 5.5"/>'),
  stuck: svg('<path d="M12 21v-6M12 3c-3.5 0-6 2.7-6 6 0 3.1 2.6 6 6 6s6-2.9 6-6c0-3.3-2.5-6-6-6z"/><path d="M14 7l3-1.5 1 3-3 1z"/>'),
  broken: svg('<path d="M4 7h7l-2 4 3 2-2 4H4zM20 7h-6l1.5 3.5L13 13l2 4h5z"/>'),
  path: svg('<path d="M6 21c0-4 4-5 6-8s-1-5 2-8M18 21c0-3-3-4-4-6"/><circle cx="16" cy="4" r="1.5"/>'),
  hands: svg('<path d="M4 12l4-4 4 3 4-3 4 4-8 8z"/><path d="M8 8l4 4"/>'),
  idea: svg('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>'),
  help: svg('<circle cx="12" cy="7" r="3"/><path d="M6 21v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3"/><path d="M15.5 11.5l3-2.5"/>'),
  fix: svg('<path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z"/>'),
  play: svg('<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>'),
  back: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
  bin: svg('<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  flip: svg('<path d="M12 3v18M8 7L3 12l5 5zM16 7l5 5-5 5z"/>'),
  print: svg('<path d="M7 9V3.5h10V9M7 17H4.5V10h15v7H17M7 14h10v6.5H7z"/>'),
  stamp: svg('<circle cx="12" cy="12" r="9"/><path d="M7.5 12.5l3 3 6-6.5"/>'),
};

/** The faces for feelings: a circle, eyes and a mouth. */
const MOUTH = {
  happy: '<path d="M8 14c1.2 2 6.8 2 8 0"/>', excited: '<path d="M7.5 13.5h9c0 3-2 4.5-4.5 4.5s-4.5-1.5-4.5-4.5z"/>', sad: '<path d="M8 17c1.2-2 6.8-2 8 0"/>',
  worried: '<path d="M8 16.5c1.3-1 2.7 1 4 0s2.7 1 4 0"/>', surprised: '<circle cx="12" cy="15.5" r="2.2"/>', cross: '<path d="M8.5 16h7"/>',
  proud: '<path d="M8.5 14.5c1 1.4 6 1.4 7 0"/>', calm: '<path d="M9 15c1 .8 5 .8 6 0"/>', shy: '<path d="M10 15.5c.7.5 3.3.5 4 0"/>',
};
const BROWS = { worried: '<path d="M7 7.5l3 1M17 7.5l-3 1"/>', cross: '<path d="M7 8l3 1.5M17 8l-3 1.5"/>', sad: '<path d="M7.5 8.5l2.5-1M16.5 8.5l-2.5-1"/>', surprised: '<path d="M7.5 7.5c1-.8 2-.8 3 0M13.5 7.5c1-.8 2-.8 3 0"/>' };
export function faceSvg(id) {
  const eyes = id === 'happy' || id === 'proud' || id === 'calm' ? '<path d="M8 10.5c.5-1 1.5-1 2 0M14 10.5c.5-1 1.5-1 2 0"/>' : '<circle cx="9" cy="10.5" r="1" class="fill"/><circle cx="15" cy="10.5" r="1" class="fill"/>';
  const cheeks = id === 'shy' ? '<circle cx="7" cy="13.5" r="1.4" class="fill blush"/><circle cx="17" cy="13.5" r="1.4" class="fill blush"/>' : '';
  return '<svg viewBox="0 0 24 24" class="face" aria-hidden="true"><circle cx="12" cy="12" r="10"/>' + eyes + (BROWS[id] || '') + (MOUTH[id] || MOUTH.calm) + cheeks + '</svg>';
}
export const FEELING_NAMES = { happy: 'Happy', excited: 'Excited', sad: 'Sad', worried: 'Worried', surprised: 'Surprised', cross: 'Cross', proud: 'Proud', calm: 'Calm', shy: 'Shy' };

/** A word or phrase to tap and hear. */
export const hearBtn = (text, label = '') => '<button type="button" class="hearbtn" data-hear="' + esc(text) + '" aria-label="' + esc(label || 'Hear: ' + text) + '">' + ICONS.play + '</button>';

// ---- the pieces of a sticker --------------------------------------------------------------------
export function stickerSrc(k) {
  const s = stickers();
  if (!s) return '';
  const [id, pose] = k.split('.');
  if (pose) { const c = s.characters.find((x) => x.id === id); return c ? c.poses[pose] : ''; }
  const o = s.objects.find((x) => x.id === id);
  return o ? o.src : '';
}
export function stickerName(k) {
  const s = stickers();
  if (!s) return '';
  const id = k.split('.')[0];
  const c = s.characters.find((x) => x.id === id);
  if (c) return c.name;
  const o = s.objects.find((x) => x.id === id);
  return o ? o.name : '';
}
export const isCharacter = (k) => k.includes('.');
export function bgOf(id) {
  const s = stickers();
  return (s && s.backgrounds.find((b) => b.id === id)) || null;
}
const stickerImg = (st, i, { live = false } = {}) => '<img class="sticker' + (isCharacter(st.k) ? ' sticker--char' : '') + '" src="' + esc(stickerSrc(st.k)) + '" alt="' + esc(stickerName(st.k)) + '" data-st="' + i + '" data-x="' + st.x + '" data-y="' + st.y + '" data-s="' + st.s + '" data-f="' + st.f + '" draggable="false"' + (live ? ' tabindex="-1"' : '') + '>';
/** Turn each sticker's data-* into CSS custom properties (CSP: no style attributes). */
export function placeStickers(root) {
  root.querySelectorAll('.sticker').forEach((el) => {
    el.style.setProperty('--x', el.dataset.x);
    el.style.setProperty('--y', el.dataset.y);
    el.style.setProperty('--s', el.dataset.s);
    el.style.setProperty('--flip', el.dataset.f === '1' ? '-1' : '1');
  });
}

// ---- panels ----------------------------------------------------------------------------------------
function artHtml(c, task, i, { big = false } = {}) {
  if (c.kind === 'own') {
    const p = c.panels[i];
    const b = bgOf(p.bg || c.setting);
    return '<div class="panel__art panel__art--stage" data-stage="' + i + '">' + (b ? '<img class="panel__bg" src="' + esc(b.src[big ? '1200' : '600']) + '" alt="' + esc('A picture of ' + b.name) + '" draggable="false">' : '') + p.st.map((s, k) => stickerImg(s, k)).join('') + '</div>';
  }
  const showPic = c.order.done;
  const p = task.pictures[i];
  return '<div class="panel__art">' + (showPic ? '<img src="' + esc(pic(p.file, big ? 1200 : 600)) + '" alt="' + esc(p.alt) + '" width="600" height="450" loading="lazy" decoding="async">' : '<span class="panel__n" aria-hidden="true">' + (i + 1) + '</span>') + '</div>';
}
function linesFor(c, task, nameOf) {
  return c.kind === 'own' ? K.ownReadText(c, nameOf) : K.readText(c, task);
}
/**
 * One panel. opts.on: the panel being made; opts.reading: the line being read
 * (index into the comic's lines); opts.fix: a "Fix this panel" button.
 */
export function panelHtml(c, task, i, opts = {}) {
  const lines = opts.lines || linesFor(c, task, opts.nameOf);
  const mine = lines.map((l, n) => ({ ...l, n })).filter((l) => l.panel === i);
  const caps = mine.filter((l) => l.kind === 'caption');
  const sp = mine.find((l) => l.kind === 'speech');
  const filled = c.kind === 'own' ? c.panels[i].done : c.panels[i].done;
  return '<figure class="panel' + (opts.on === i ? ' is-on' : '') + (filled ? ' is-done' : '') + '" data-panel="' + i + '">'
    + artHtml(c, task, i, opts)
    + (sp ? '<p class="bubble' + (opts.reading === sp.n ? ' is-reading' : '') + '" data-line="' + sp.n + '"><span class="sr">' + esc(sp.who) + ' says: </span>' + esc(sp.says) + '</p>' : '')
    + '<figcaption class="caption">' + (caps.length ? caps.map((l) => '<span class="caption__line' + (opts.reading === l.n ? ' is-reading' : '') + '" data-line="' + l.n + '">' + esc(l.text) + '</span>').join(' ') : '<span class="caption__empty">' + (opts.on === i ? 'Building…' : '&nbsp;') + '</span>') + '</figcaption>'
    + (opts.fix ? '<button type="button" class="btn btn--quiet btn--small panel__fix" data-fix="' + i + '">' + ICONS.fix + 'Fix this panel</button>' : '')
    + '</figure>';
}
/** The whole comic. cls: 'comic--strip' (small, always on show while making), 'comic--big' or 'comic--print'. */
export function comicHtml(c, task, opts = {}) {
  const lines = linesFor(c, task, opts.nameOf);
  return '<div class="comic ' + (opts.cls || '') + '"' + (opts.label ? ' aria-label="' + esc(opts.label) + '" role="group"' : '') + '>' + [0, 1, 2, 3].map((i) => panelHtml(c, task, i, { ...opts, lines })).join('') + '</div>';
}
/** The cover: title, "by" the child's name, the first picture, and a stamp once finished. */
export function coverHtml(c, task, { name = '', stamp = false } = {}) {
  const title = c.kind === 'own' ? c.title || 'My comic' : task.title;
  const art = c.kind === 'own'
    ? (() => { const b = bgOf(c.setting); return b ? '<img src="' + esc(b.src['600']) + '" alt="" draggable="false">' : ''; })()
    : '<img src="' + esc(pic(task.pictures[0].file, 600)) + '" alt="" width="600" height="450">';
  return '<div class="cover"><div class="cover__art">' + art + '</div><div class="cover__words"><span class="cover__kicker">A Waystead comic</span><h2 class="cover__title">' + esc(title) + '</h2>'
    + (name ? '<p class="cover__by">by ' + esc(name) + '</p>' : '') + '</div>' + (stamp ? '<span class="stamp" aria-label="Finished: a stamp">' + ICONS.stamp + '</span>' : '') + '</div>';
}
export const starsHtml = (n, max = 3, label = '') => '<span class="stars" aria-label="' + esc(label || n + ' of ' + max + ' stars') + '">' + Array.from({ length: max }, (_, k) => '<i class="' + (k < n ? 'is-on' : '') + '">' + ICONS.star + '</i>').join('') + '</span>';
export const comicLines = linesFor;

/**
 * The child's own typed words in this comic (K.typedBits), for speech.js. An
 * own story saves a chosen card by its text, so every line our cards and title
 * ideas can make for this story is left out.
 */
export function ownWordsOf(c) {
  if (!c || c.kind !== 'own') return K.typedBits(c);
  const st = stickers() || {};
  const own = (comicShared() || {}).own || {};
  const charName = (id) => { const x = (st.characters || []).find((y) => y.id === id); return x ? x.name : ''; };
  const thingName = (id) => { const x = (st.objects || []).find((y) => y.id === id); return x ? x.name : ''; };
  const who = charName(c.cast && c.cast[0]) || 'Someone';
  const thing = c.props && c.props[0] ? thingName(c.props[0]) : '';
  const fill = { who, thing: thing || 'something' };
  const fixed = new Set([
    ...(own.speech || []), ...(own.endings || []),
    ...[...(own.problems || []), ...(own.solutions || [])].map((x) => K.sparkText(x.text, fill)),
    ...K.ownTitleIdeas(who, thing, (bgOf(c.setting) || {}).name || ''),
  ]);
  return K.typedBits(c, fixed);
}
